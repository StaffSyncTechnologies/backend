import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { AppError, NotFoundError } from '../utils/AppError';
import { ClientAuthRequest } from '../middleware/clientAuth';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';
import { EmailService } from '../services/notifications/email.service';

const workerRequestSchema = z.object({
  locationId: z.string().uuid().optional(),
  siteLocation: z.string().optional(),
  role: z.string(),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  workersNeeded: z.number().min(1),
  requiredSkillIds: z.array(z.string().uuid()).optional(),
  notes: z.string().optional(),
});

export class ClientController {
  // ==================== AUTH ====================
  
  login = async (req: Request, res: Response) => {
    const { email, password } = req.body;

    const clientUser = await prisma.clientUser.findFirst({
      where: { email },
      include: { clientCompany: true },
    });

    if (!clientUser || !clientUser.passwordHash) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    const isValid = await bcrypt.compare(password, clientUser.passwordHash);
    if (!isValid) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    if (clientUser.status !== 'ACTIVE') {
      throw new AppError('Account inactive', 403, 'ACCOUNT_INACTIVE');
    }

    await prisma.clientUser.update({
      where: { id: clientUser.id },
      data: { lastLoginAt: new Date() },
    });

    const token = jwt.sign(
      {
        clientUserId: clientUser.id,
        clientCompanyId: clientUser.clientCompanyId,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn } as SignOptions
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: clientUser.id,
          email: clientUser.email,
          fullName: clientUser.fullName,
          role: clientUser.role,
        },
        company: {
          id: clientUser.clientCompany.id,
          name: clientUser.clientCompany.name,
        },
      },
    });
  };

  forgotPassword = async (req: Request, res: Response) => {
    // TODO: Implement password reset
    res.json({ success: true, message: 'If email exists, reset link sent' });
  };

  // ==================== DASHBOARD ====================

  getDashboard = async (req: ClientAuthRequest, res: Response) => {
    const clientCompanyId = req.clientUser!.clientCompanyId;

    const [activeShifts, upcomingShifts, pendingTimesheets, recentInvoices] = await Promise.all([
      // Active shifts (in progress today)
      prisma.shift.count({
        where: {
          clientCompanyId,
          status: 'IN_PROGRESS',
        },
      }),
      // Upcoming shifts (next 7 days)
      prisma.shift.count({
        where: {
          clientCompanyId,
          status: { in: ['OPEN', 'FILLED'] },
          startAt: {
            gte: new Date(),
            lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      // Pending timesheet approvals
      prisma.attendance.count({
        where: {
          shift: { clientCompanyId },
          status: 'PENDING',
          clockOutAt: { not: null },
        },
      }),
      // Recent invoices
      prisma.invoice.findMany({
        where: { clientCompanyId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          invoiceNumber: true,
          total: true,
          status: true,
          dueDate: true,
        },
      }),
    ]);

    // Today's workers on site
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todaysWorkers = await prisma.shiftAssignment.findMany({
      where: {
        shift: {
          clientCompanyId,
          startAt: { gte: todayStart, lte: todayEnd },
        },
        status: 'ACCEPTED',
      },
      include: {
        worker: { select: { id: true, fullName: true } },
        shift: { select: { title: true, startAt: true, endAt: true } },
      },
    });

    res.json({
      success: true,
      data: {
        stats: {
          activeShifts,
          upcomingShifts,
          pendingTimesheets,
          workersOnSiteToday: todaysWorkers.length,
        },
        todaysWorkers,
        recentInvoices,
      },
    });
  };

  // ==================== WORKERS ====================

  getAssignedWorkers = async (req: ClientAuthRequest, res: Response) => {
    const clientCompanyId = req.clientUser!.clientCompanyId;

    // Get workers who have worked at this client
    const workers = await prisma.user.findMany({
      where: {
        role: 'WORKER',
        shiftAssignments: {
          some: {
            shift: { clientCompanyId },
            status: 'ACCEPTED',
          },
        },
      },
      select: {
        id: true,
        fullName: true,
        workerSkills: { include: { skill: true } },
        reliabilityScore: { select: { score: true, avgRating: true } },
        _count: {
          select: {
            shiftAssignments: {
              where: { shift: { clientCompanyId } },
            },
          },
        },
      },
    });

    // Get client-specific blocks
    const blockedWorkerIds = await prisma.workerBlock.findMany({
      where: {
        clientCompanyId,
        status: 'ACTIVE',
      },
      select: { workerId: true },
    });

    const blockedIds = new Set(blockedWorkerIds.map((b) => b.workerId));

    const workersWithStatus = workers.map((w) => ({
      ...w,
      isBlocked: blockedIds.has(w.id),
      shiftsWorked: w._count.shiftAssignments,
    }));

    res.json({ success: true, data: workersWithStatus });
  };

  getWorkerProfile = async (req: ClientAuthRequest, res: Response) => {
    const { workerId } = req.params;
    const clientCompanyId = req.clientUser!.clientCompanyId;

    const worker = await prisma.user.findFirst({
      where: {
        id: workerId,
        role: 'WORKER',
        shiftAssignments: {
          some: { shift: { clientCompanyId } },
        },
      },
      select: {
        id: true,
        fullName: true,
        workerSkills: { include: { skill: true } },
        reliabilityScore: true,
        workerDocuments: {
          where: { verified: true },
          select: { documentType: true, expiresAt: true },
        },
      },
    });

    if (!worker) throw new NotFoundError('Worker');

    // Get shift history at this client
    const shiftHistory = await prisma.shiftAssignment.findMany({
      where: {
        workerId,
        shift: { clientCompanyId },
      },
      include: {
        shift: {
          select: { title: true, startAt: true, endAt: true, role: true },
        },
      },
      orderBy: { shift: { startAt: 'desc' } },
      take: 20,
    });

    res.json({ success: true, data: { worker, shiftHistory } });
  };

  rateWorker = async (req: ClientAuthRequest, res: Response) => {
    const { workerId } = req.params;
    const { shiftId, rating, feedback } = req.body;

    // Store rating (add to worker_rating table - would need to add this)
    // For now, update reliability score average
    const currentScore = await prisma.workerReliabilityScore.findUnique({
      where: { workerId },
    });

    if (currentScore) {
      const totalRatings = currentScore.completedShifts || 1;
      const currentAvg = Number(currentScore.avgRating) || rating;
      const newAvg = ((currentAvg * totalRatings) + rating) / (totalRatings + 1);

      await prisma.workerReliabilityScore.update({
        where: { workerId },
        data: { avgRating: newAvg },
      });
    }

    res.json({ success: true, message: 'Rating submitted' });
  };

  blockWorker = async (req: ClientAuthRequest, res: Response) => {
    const { workerId } = req.params;
    const { reason, notes } = req.body;

    const block = await prisma.workerBlock.create({
      data: {
        workerId,
        clientCompanyId: req.clientUser!.clientCompanyId,
        blockType: 'CLIENT',
        reason: reason || 'CLIENT_REQUEST',
        notes,
        blockedBy: req.clientUser!.id, // Note: This should be agency user, may need adjustment
      },
    });

    res.status(201).json({ success: true, data: block });
  };

  // ==================== SHIFTS / BOOKINGS ====================

  getShifts = async (req: ClientAuthRequest, res: Response) => {
    const { status, from, to } = req.query;
    const clientCompanyId = req.clientUser!.clientCompanyId;

    const shifts = await prisma.shift.findMany({
      where: {
        clientCompanyId,
        ...(status && { status: status as any }),
        ...(from && { startAt: { gte: new Date(from as string) } }),
        ...(to && { endAt: { lte: new Date(to as string) } }),
      },
      include: {
        assignments: {
          where: { status: 'ACCEPTED' },
          include: {
            worker: { select: { id: true, fullName: true } },
          },
        },
        _count: { select: { assignments: true } },
      },
      orderBy: { startAt: 'desc' },
    });

    res.json({ success: true, data: shifts });
  };

  getShiftDetails = async (req: ClientAuthRequest, res: Response) => {
    const shift = await prisma.shift.findFirst({
      where: {
        id: req.params.shiftId,
        clientCompanyId: req.clientUser!.clientCompanyId,
      },
      include: {
        assignments: {
          include: {
            worker: { select: { id: true, fullName: true, phone: true } },
          },
        },
        attendances: {
          include: {
            worker: { select: { id: true, fullName: true } },
          },
        },
        requiredSkills: { include: { skill: true } },
      },
    });

    if (!shift) throw new NotFoundError('Shift');

    res.json({ success: true, data: shift });
  };

  requestWorkers = async (req: ClientAuthRequest, res: Response) => {
    const data = workerRequestSchema.parse(req.body);
    const clientCompanyId = req.clientUser!.clientCompanyId;

    // Get client company to get organization
    const client = await prisma.clientCompany.findUnique({
      where: { id: clientCompanyId },
    });

    if (!client) throw new NotFoundError('Client company');

    // Create shift request
    const shift = await prisma.shift.create({
      data: {
        organizationId: client.organizationId,
        clientCompanyId,
        title: `${data.role} - ${new Date(data.date).toLocaleDateString()}`,
        role: data.role,
        siteLocation: data.siteLocation,
        startAt: new Date(`${data.date}T${data.startTime}`),
        endAt: new Date(`${data.date}T${data.endTime}`),
        workersNeeded: data.workersNeeded,
        payRate: client.defaultPayRate,
        notes: data.notes,
        status: 'OPEN',
        createdBy: req.clientUser!.id, // This would need adjustment for client user
        requiredSkills: data.requiredSkillIds ? {
          create: data.requiredSkillIds.map((skillId) => ({ skillId })),
        } : undefined,
      },
    });

    // TODO: Notify agency of new shift request

    res.status(201).json({ success: true, data: shift });
  };

  cancelShiftRequest = async (req: ClientAuthRequest, res: Response) => {
    const result = await prisma.shift.updateMany({
      where: {
        id: req.params.shiftId,
        clientCompanyId: req.clientUser!.clientCompanyId,
        status: 'OPEN',
      },
      data: { status: 'CANCELLED' },
    });

    if (result.count === 0) {
      throw new AppError('Shift not found or cannot be cancelled', 400, 'CANNOT_CANCEL');
    }

    res.json({ success: true, message: 'Shift request cancelled' });
  };

  // ==================== TIMESHEETS ====================

  getTimesheets = async (req: ClientAuthRequest, res: Response) => {
    const { status, from, to } = req.query;
    const clientCompanyId = req.clientUser!.clientCompanyId;

    const timesheets = await prisma.attendance.findMany({
      where: {
        shift: { clientCompanyId },
        clockOutAt: { not: null },
        ...(status && { status: status as any }),
        ...(from && { clockInAt: { gte: new Date(from as string) } }),
        ...(to && { clockOutAt: { lte: new Date(to as string) } }),
      },
      include: {
        worker: { select: { id: true, fullName: true } },
        shift: { select: { id: true, title: true, role: true, startAt: true, endAt: true } },
      },
      orderBy: { clockInAt: 'desc' },
    });

    res.json({ success: true, data: timesheets });
  };

  getTimesheetDetails = async (req: ClientAuthRequest, res: Response) => {
    const timesheet = await prisma.attendance.findFirst({
      where: {
        id: req.params.timesheetId,
        shift: { clientCompanyId: req.clientUser!.clientCompanyId },
      },
      include: {
        worker: { select: { id: true, fullName: true } },
        shift: true,
      },
    });

    if (!timesheet) throw new NotFoundError('Timesheet');

    res.json({ success: true, data: timesheet });
  };

  approveTimesheet = async (req: ClientAuthRequest, res: Response) => {
    const result = await prisma.attendance.updateMany({
      where: {
        id: req.params.timesheetId,
        shift: { clientCompanyId: req.clientUser!.clientCompanyId },
        status: 'PENDING',
      },
      data: { status: 'APPROVED' },
    });

    if (result.count === 0) {
      throw new AppError('Timesheet not found or already processed', 400, 'INVALID_ACTION');
    }

    res.json({ success: true, message: 'Timesheet approved' });
  };

  disputeTimesheet = async (req: ClientAuthRequest, res: Response) => {
    const { reason } = req.body;

    const result = await prisma.attendance.updateMany({
      where: {
        id: req.params.timesheetId,
        shift: { clientCompanyId: req.clientUser!.clientCompanyId },
        status: 'PENDING',
      },
      data: {
        status: 'FLAGGED',
        flagReason: 'MANUAL_FLAG',
        flagNote: reason,
      },
    });

    if (result.count === 0) {
      throw new AppError('Timesheet not found or already processed', 400, 'INVALID_ACTION');
    }

    // TODO: Notify agency of dispute

    res.json({ success: true, message: 'Timesheet disputed' });
  };

  // ==================== INVOICES ====================

  getInvoices = async (req: ClientAuthRequest, res: Response) => {
    const invoices = await prisma.invoice.findMany({
      where: { clientCompanyId: req.clientUser!.clientCompanyId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: invoices });
  };

  getInvoiceDetails = async (req: ClientAuthRequest, res: Response) => {
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: req.params.invoiceId,
        clientCompanyId: req.clientUser!.clientCompanyId,
      },
      include: {
        lineItems: {
          include: {
            shift: { select: { title: true, startAt: true, role: true } },
            worker: { select: { fullName: true } },
          },
        },
      },
    });

    if (!invoice) throw new NotFoundError('Invoice');

    res.json({ success: true, data: invoice });
  };

  downloadInvoice = async (req: ClientAuthRequest, res: Response) => {
    // TODO: Generate PDF
    res.json({ success: true, message: 'PDF download not implemented' });
  };

  // ==================== REPORTS ====================

  getHoursReport = async (req: ClientAuthRequest, res: Response) => {
    const { from, to } = req.query;
    const clientCompanyId = req.clientUser!.clientCompanyId;

    const fromDate = from ? new Date(from as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to as string) : new Date();

    const attendances = await prisma.attendance.findMany({
      where: {
        shift: { clientCompanyId },
        clockInAt: { gte: fromDate },
        clockOutAt: { lte: toDate },
        status: 'APPROVED',
      },
      include: {
        shift: { select: { role: true } },
      },
    });

    const totalHours = attendances.reduce((sum, a) => sum + (Number(a.hoursWorked) || 0), 0);
    const byRole = attendances.reduce((acc, a) => {
      const role = a.shift.role || 'Unknown';
      acc[role] = (acc[role] || 0) + (Number(a.hoursWorked) || 0);
      return acc;
    }, {} as Record<string, number>);

    res.json({
      success: true,
      data: {
        period: { from: fromDate, to: toDate },
        totalHours,
        totalShifts: attendances.length,
        byRole,
      },
    });
  };

  getSpendReport = async (req: ClientAuthRequest, res: Response) => {
    const { from, to } = req.query;
    const clientCompanyId = req.clientUser!.clientCompanyId;

    const fromDate = from ? new Date(from as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to as string) : new Date();

    const invoices = await prisma.invoice.findMany({
      where: {
        clientCompanyId,
        createdAt: { gte: fromDate, lte: toDate },
      },
    });

    const totalSpend = invoices.reduce((sum, i) => sum + (Number(i.total) || 0), 0);
    const byMonth = invoices.reduce((acc, i) => {
      const month = i.createdAt.toISOString().slice(0, 7);
      acc[month] = (acc[month] || 0) + (Number(i.total) || 0);
      return acc;
    }, {} as Record<string, number>);

    res.json({
      success: true,
      data: {
        period: { from: fromDate, to: toDate },
        totalSpend,
        invoiceCount: invoices.length,
        byMonth,
      },
    });
  };

  // ==================== SETTINGS ====================

  getSettings = async (req: ClientAuthRequest, res: Response) => {
    const client = await prisma.clientCompany.findUnique({
      where: { id: req.clientUser!.clientCompanyId },
      include: { clientPayRates: true },
    });

    res.json({ success: true, data: client });
  };

  updateSettings = async (req: ClientAuthRequest, res: Response) => {
    const { contactName, contactEmail, contactPhone, billingEmail } = req.body;

    const client = await prisma.clientCompany.update({
      where: { id: req.clientUser!.clientCompanyId },
      data: { contactName, contactEmail, contactPhone, billingEmail },
    });

    res.json({ success: true, data: client });
  };

  // ==================== CLIENT USERS ====================

  getUsers = async (req: ClientAuthRequest, res: Response) => {
    const users = await prisma.clientUser.findMany({
      where: { clientCompanyId: req.clientUser!.clientCompanyId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        lastLoginAt: true,
      },
    });

    res.json({ success: true, data: users });
  };

  createUser = async (req: ClientAuthRequest, res: Response) => {
    const { email, fullName, role, password } = req.body;

    const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;

    const user = await prisma.clientUser.create({
      data: {
        clientCompanyId: req.clientUser!.clientCompanyId,
        email,
        fullName,
        role: role || 'CLIENT_VIEWER',
        passwordHash,
      },
    });

    // TODO: Send invite email

    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    });
  };

  updateUser = async (req: ClientAuthRequest, res: Response) => {
    const result = await prisma.clientUser.updateMany({
      where: {
        id: req.params.userId,
        clientCompanyId: req.clientUser!.clientCompanyId,
      },
      data: req.body,
    });

    if (result.count === 0) throw new NotFoundError('User');

    res.json({ success: true, message: 'User updated' });
  };

  deleteUser = async (req: ClientAuthRequest, res: Response) => {
    if (req.params.userId === req.clientUser!.id) {
      throw new AppError('Cannot delete yourself', 400, 'CANNOT_DELETE_SELF');
    }

    const result = await prisma.clientUser.deleteMany({
      where: {
        id: req.params.userId,
        clientCompanyId: req.clientUser!.clientCompanyId,
      },
    });

    if (result.count === 0) throw new NotFoundError('User');

    res.json({ success: true, message: 'User deleted' });
  };

  // ============================================================
  // STAFF-CLIENT COMPANY ASSIGNMENT (Agency Admin Routes)
  // ============================================================

  /**
   * Assign staff to client companies
   */
  assignStaffToClients = async (req: AuthRequest, res: Response) => {
    const { staffId } = req.params;
    const { clientCompanyIds, isPrimary } = z.object({
      clientCompanyIds: z.array(z.string().uuid()),
      isPrimary: z.boolean().optional(),
    }).parse(req.body);

    const staff = await prisma.user.findFirst({
      where: {
        id: staffId,
        organizationId: req.user!.organizationId,
        role: { notIn: ['WORKER'] },
      },
    });

    if (!staff) {
      throw new AppError('Staff member not found', 404, 'STAFF_NOT_FOUND');
    }

    const clients = await prisma.clientCompany.findMany({
      where: {
        id: { in: clientCompanyIds },
        organizationId: req.user!.organizationId,
      },
    });

    if (clients.length !== clientCompanyIds.length) {
      throw new AppError('One or more client companies not found', 400, 'INVALID_CLIENTS');
    }

    const assignments = await prisma.$transaction(
      clientCompanyIds.map(clientCompanyId =>
        prisma.staffCompanyAssignment.upsert({
          where: {
            staffId_clientCompanyId: { staffId, clientCompanyId },
          },
          create: {
            staffId,
            clientCompanyId,
            isPrimary: isPrimary || false,
          },
          update: {
            status: 'ACTIVE',
            isPrimary: isPrimary || false,
          },
        })
      )
    );

    res.json({
      success: true,
      message: `Staff assigned to ${assignments.length} client companies`,
      data: { assignedCount: assignments.length },
    });
  };

  /**
   * Remove staff from client companies
   */
  unassignStaffFromClients = async (req: AuthRequest, res: Response) => {
    const { staffId } = req.params;
    const { clientCompanyIds } = z.object({
      clientCompanyIds: z.array(z.string().uuid()),
    }).parse(req.body);

    const result = await prisma.staffCompanyAssignment.deleteMany({
      where: {
        staffId,
        clientCompanyId: { in: clientCompanyIds },
        staff: { organizationId: req.user!.organizationId },
      },
    });

    res.json({
      success: true,
      message: `Removed ${result.count} client assignments`,
      data: { removedCount: result.count },
    });
  };

  /**
   * Get client companies assigned to a staff member
   */
  getStaffClients = async (req: AuthRequest, res: Response) => {
    const { staffId } = req.params;

    const assignments = await prisma.staffCompanyAssignment.findMany({
      where: {
        staffId,
        staff: { organizationId: req.user!.organizationId },
        status: 'ACTIVE',
      },
      include: {
        clientCompany: {
          select: {
            id: true,
            name: true,
            address: true,
            contactName: true,
            contactEmail: true,
            status: true,
            _count: {
              select: { workerAssignments: true, shifts: true },
            },
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });

    res.json({
      success: true,
      data: assignments.map(a => ({
        ...a.clientCompany,
        isPrimary: a.isPrimary,
        assignedAt: a.assignedAt,
        workerCount: a.clientCompany._count.workerAssignments,
        shiftCount: a.clientCompany._count.shifts,
      })),
    });
  };

  /**
   * Get my assigned clients (for logged-in staff)
   */
  getMyClients = async (req: AuthRequest, res: Response) => {
    if (req.user!.role === 'WORKER') {
      throw new AppError('Workers do not have client assignments', 403, 'FORBIDDEN');
    }

    const assignments = await prisma.staffCompanyAssignment.findMany({
      where: {
        staffId: req.user!.id,
        status: 'ACTIVE',
      },
      include: {
        clientCompany: {
          include: {
            _count: {
              select: { workerAssignments: true, shifts: true },
            },
          },
        },
      },
      orderBy: [{ isPrimary: 'desc' }, { assignedAt: 'desc' }],
    });

    res.json({
      success: true,
      data: assignments.map(a => ({
        id: a.clientCompany.id,
        name: a.clientCompany.name,
        address: a.clientCompany.address,
        contactName: a.clientCompany.contactName,
        contactEmail: a.clientCompany.contactEmail,
        contactPhone: a.clientCompany.contactPhone,
        status: a.clientCompany.status,
        isPrimary: a.isPrimary,
        assignedAt: a.assignedAt,
        workerCount: a.clientCompany._count.workerAssignments,
        shiftCount: a.clientCompany._count.shifts,
      })),
      count: assignments.length,
    });
  };

  /**
   * Get staff assigned to a client company
   */
  getClientStaff = async (req: AuthRequest, res: Response) => {
    const { clientCompanyId } = req.params;

    const assignments = await prisma.staffCompanyAssignment.findMany({
      where: {
        clientCompanyId,
        clientCompany: { organizationId: req.user!.organizationId },
        status: 'ACTIVE',
      },
      include: {
        staff: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            role: true,
            status: true,
          },
        },
      },
      orderBy: [{ isPrimary: 'desc' }, { assignedAt: 'desc' }],
    });

    res.json({
      success: true,
      data: assignments.map(a => ({
        ...a.staff,
        isPrimary: a.isPrimary,
        assignedAt: a.assignedAt,
      })),
    });
  };

  /**
   * Get workers under a client company for a staff member
   * Hierarchy: Staff -> ClientCompany -> Workers
   */
  getClientWorkers = async (req: AuthRequest, res: Response) => {
    const { clientCompanyId } = req.params;

    if (req.user!.role !== 'ADMIN') {
      const hasAccess = await prisma.staffCompanyAssignment.findFirst({
        where: {
          staffId: req.user!.id,
          clientCompanyId,
          status: 'ACTIVE',
        },
      });

      if (!hasAccess) {
        throw new AppError('You are not assigned to this client', 403, 'NOT_ASSIGNED');
      }
    }

    const workers = await prisma.workerCompanyAssignment.findMany({
      where: {
        clientCompanyId,
        clientCompany: { organizationId: req.user!.organizationId },
        status: 'ACTIVE',
      },
      include: {
        worker: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            status: true,
            managerId: true,
            manager: {
              select: { id: true, fullName: true, role: true },
            },
            workerProfile: {
              select: { onboardingStatus: true, rtwStatus: true },
            },
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });

    res.json({
      success: true,
      data: workers.map(w => ({
        ...w.worker,
        payRate: w.payRate,
        assignedAt: w.assignedAt,
      })),
      count: workers.length,
    });
  };

  // ==================== AGENCY CLIENT MANAGEMENT ====================

  /**
   * Get client stats for agency dashboard
   * GET /api/clients/stats
   */
  getClientStats = async (req: AuthRequest, res: Response) => {
    const orgId = req.user!.organizationId;

    const [total, active, inactive, outstandingInvoices] = await Promise.all([
      prisma.clientCompany.count({ where: { organizationId: orgId } }),
      prisma.clientCompany.count({ where: { organizationId: orgId, status: 'ACTIVE' } }),
      prisma.clientCompany.count({ where: { organizationId: orgId, status: { not: 'ACTIVE' } } }),
      prisma.invoice.count({ 
        where: { 
          organizationId: orgId, 
          status: { in: ['SENT', 'OVERDUE'] },
        } 
      }),
    ]);

    // Calculate week-over-week change
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const lastWeekTotal = await prisma.clientCompany.count({
      where: { organizationId: orgId, createdAt: { lt: weekAgo } },
    });

    const change = lastWeekTotal > 0 ? ((total - lastWeekTotal) / lastWeekTotal * 100) : 0;

    res.json({
      success: true,
      data: {
        total: { count: total, change: Math.round(change * 10) / 10 },
        active: { count: active, change: Math.round(change * 10) / 10 },
        inactive: { count: inactive, change: 0 },
        outstandingInvoices: { count: outstandingInvoices, change: 0 },
      },
    });
  };

  /**
   * Get client list for agency with filters and pagination
   * GET /api/clients/list
   */
  getClientList = async (req: AuthRequest, res: Response) => {
    const orgId = req.user!.organizationId;
    const { 
      page = 1, 
      limit = 10, 
      status, 
      search, 
      industry,
      billingStatus,
    } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    const where: any = { organizationId: orgId };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { contactName: { contains: search as string, mode: 'insensitive' } },
        { contactEmail: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (industry) {
      where.industry = industry;
    }

    const [clients, totalCount] = await Promise.all([
      prisma.clientCompany.findMany({
        where,
        include: {
          shifts: {
            where: { 
              status: { in: ['OPEN', 'FILLED', 'IN_PROGRESS'] },
              startAt: { gte: new Date() },
            },
            select: { id: true, workersNeeded: true, status: true },
          },
          _count: {
            select: {
              shifts: true,
              invoices: true,
            },
          },
          invoices: {
            where: { status: { in: ['SENT', 'OVERDUE', 'DRAFT'] } },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { id: true, status: true, total: true, dueDate: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.clientCompany.count({ where }),
    ]);

    // Calculate filled shifts for each client
    const clientsWithStats = await Promise.all(clients.map(async (client) => {
      const activeShifts = client.shifts;
      const totalNeeded = activeShifts.reduce((sum, s) => sum + s.workersNeeded, 0);
      
      // Get filled count from shift assignments
      const filledCount = await prisma.shiftAssignment.count({
        where: {
          shift: { 
            clientCompanyId: client.id,
            status: { in: ['OPEN', 'FILLED', 'IN_PROGRESS'] },
            startAt: { gte: new Date() },
          },
          status: 'ACCEPTED',
        },
      });

      // Determine billing status from latest invoice
      let billingStatus: 'PAID' | 'PENDING' | 'OVERDUE' | 'NONE' = 'NONE';
      if (client.invoices.length > 0) {
        const latestInvoice = client.invoices[0];
        if (latestInvoice.status === 'PAID') billingStatus = 'PAID';
        else if (latestInvoice.status === 'OVERDUE') billingStatus = 'OVERDUE';
        else billingStatus = 'PENDING';
      }

      return {
        id: client.id,
        name: client.name,
        contactName: client.contactName,
        contactEmail: client.contactEmail,
        contactPhone: client.contactPhone,
        industry: client.industry,
        status: client.status,
        activeShifts: {
          filled: filledCount,
          needed: totalNeeded,
          percentage: totalNeeded > 0 ? Math.round((filledCount / totalNeeded) * 100) : 0,
        },
        billingStatus,
        totalShifts: client._count.shifts,
        totalInvoices: client._count.invoices,
        createdAt: client.createdAt,
      };
    }));

    // Filter by billing status if requested
    let filteredClients = clientsWithStats;
    if (billingStatus) {
      filteredClients = clientsWithStats.filter(c => c.billingStatus === billingStatus);
    }

    res.json({
      success: true,
      data: {
        clients: filteredClients,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limitNum),
        },
      },
    });
  };

  /**
   * Create a new client company
   * POST /api/clients
   * Sends invite code to contact email if provided
   */
  createClient = async (req: AuthRequest, res: Response) => {
    const orgId = req.user!.organizationId;
    const data = z.object({
      name: z.string().min(1),
      contactName: z.string().optional(),
      contactEmail: z.string().email().optional(),
      contactPhone: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      postcode: z.string().optional(),
      industry: z.string().optional(),
      defaultPayRate: z.number().positive().optional(),
      defaultChargeRate: z.number().positive().optional(),
      sendInvite: z.boolean().optional(),
    }).parse(req.body);

    const { sendInvite, ...clientData } = data;

    // Get organization name for the invite email
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    });

    const client = await prisma.clientCompany.create({
      data: {
        ...clientData,
        organizationId: orgId,
        status: 'ACTIVE',
      },
    });

    let inviteCode = null;

    // Generate and send invite code if contact email is provided
    if (data.contactEmail && (sendInvite !== false)) {
      // Generate invite code
      const code = `${crypto.randomBytes(3).toString('hex').toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const codeHash = crypto.createHash('sha256').update(code).digest('hex');

      // Create invite code in database
      inviteCode = await prisma.inviteCode.create({
        data: {
          organizationId: orgId,
          code,
          codeHash,
          type: 'CLIENT',
          email: data.contactEmail,
          usageType: 'SINGLE_USE',
          maxUses: 1,
          status: 'ACTIVE',
          createdBy: req.user!.id,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      });

      // Send invite email to contact
      try {
        await EmailService.sendClientInvite(
          data.contactEmail,
          code,
          data.contactName || client.name,
          organization?.name || 'StaffSync Agency',
        );
      } catch (emailError) {
        console.error('Failed to send client invite email:', emailError);
        // Don't fail the request if email fails - client is still created
      }
    }

    res.status(201).json({
      success: true,
      message: data.contactEmail ? 'Client created and invite sent' : 'Client created',
      data: {
        ...client,
        inviteCodeSent: !!inviteCode,
      },
    });
  };

  /**
   * Update a client company
   * PUT /api/clients/:clientId
   */
  updateClient = async (req: AuthRequest, res: Response) => {
    const orgId = req.user!.organizationId;
    const { clientId } = req.params;

    const data = z.object({
      name: z.string().min(1).optional(),
      contactName: z.string().optional(),
      contactEmail: z.string().email().optional(),
      contactPhone: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      postcode: z.string().optional(),
      industry: z.string().optional(),
      status: z.enum(['PENDING', 'ACTIVE', 'INACTIVE']).optional(),
      defaultPayRate: z.number().positive().optional(),
      defaultChargeRate: z.number().positive().optional(),
    }).parse(req.body);

    const client = await prisma.clientCompany.updateMany({
      where: { id: clientId, organizationId: orgId },
      data,
    });

    if (client.count === 0) {
      throw new NotFoundError('Client');
    }

    const updated = await prisma.clientCompany.findUnique({ where: { id: clientId } });

    res.json({
      success: true,
      message: 'Client updated',
      data: updated,
    });
  };

  /**
   * Get single client details
   * GET /api/clients/:clientId
   */
  getClientDetails = async (req: AuthRequest, res: Response) => {
    const orgId = req.user!.organizationId;
    const { clientId } = req.params;

    const client = await prisma.clientCompany.findFirst({
      where: { id: clientId, organizationId: orgId },
      include: {
        clientPayRates: true,
        _count: {
          select: {
            shifts: true,
            invoices: true,
            workerAssignments: { where: { status: 'ACTIVE' } },
          },
        },
      },
    });

    if (!client) {
      throw new NotFoundError('Client');
    }

    // Get recent shifts
    const recentShifts = await prisma.shift.findMany({
      where: { clientCompanyId: clientId },
      orderBy: { startAt: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        startAt: true,
        endAt: true,
        status: true,
        workersNeeded: true,
      },
    });

    // Get recent invoices
    const recentInvoices = await prisma.invoice.findMany({
      where: { clientCompanyId: clientId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        invoiceNumber: true,
        total: true,
        status: true,
        dueDate: true,
      },
    });

    res.json({
      success: true,
      data: {
        ...client,
        recentShifts,
        recentInvoices,
      },
    });
  };

  /**
   * Generate invoice for a specific client (agency staff)
   * POST /api/clients/:clientId/invoices/generate
   */
  generateClientInvoice = async (req: AuthRequest, res: Response) => {
    const orgId = req.user!.organizationId;
    const { clientId } = req.params;
    const { weekStart: weekStartStr, weekEnd: weekEndStr } = z.object({
      weekStart: z.string(),
      weekEnd: z.string(),
    }).parse(req.body);

    const weekStart = new Date(weekStartStr);
    const weekEnd = new Date(weekEndStr);

    // Get client company
    const client = await prisma.clientCompany.findFirst({
      where: { id: clientId, organizationId: orgId },
    });

    if (!client) throw new NotFoundError('Client company');

    // Check if invoice already exists for this period
    const existingInvoice = await prisma.invoice.findFirst({
      where: {
        clientCompanyId: clientId,
        periodStart: weekStart,
        periodEnd: weekEnd,
      },
    });

    if (existingInvoice) {
      throw new AppError('Invoice already exists for this period', 400, 'INVOICE_EXISTS');
    }

    // Get approved attendance for this period
    const attendances = await prisma.attendance.findMany({
      where: {
        shift: { clientCompanyId: clientId },
        clockInAt: { gte: weekStart, lte: weekEnd },
        status: 'APPROVED',
      },
      include: {
        shift: { select: { id: true, title: true, payRate: true, role: true } },
        worker: { select: { id: true, fullName: true } },
      },
    });

    if (attendances.length === 0) {
      throw new AppError('No approved timesheets for this period', 400, 'NO_TIMESHEETS');
    }

    // Generate invoice number
    const invoiceCount = await prisma.invoice.count({
      where: { organizationId: orgId },
    });
    const invoiceNumber = `INV-${String(invoiceCount + 1).padStart(5, '0')}`;

    // Calculate line items
    const lineItems = attendances.map(a => {
      const payRate = Number(a.shift.payRate) || 12;
      const chargeRate = payRate * 1.3; // 30% margin
      const hours = Number(a.hoursWorked) || 0;
      return {
        shiftId: a.shift.id,
        workerId: a.worker.id,
        description: `${a.worker.fullName} - ${a.shift.title || a.shift.role}`,
        hours,
        chargeRate,
        amount: hours * chargeRate,
      };
    });

    const subtotal = lineItems.reduce((s, li) => s + li.amount, 0);
    const vatRate = 20;
    const vatAmount = subtotal * (vatRate / 100);
    const total = subtotal + vatAmount;

    // Create invoice with line items
    const invoice = await prisma.invoice.create({
      data: {
        organizationId: orgId,
        clientCompanyId: clientId,
        invoiceNumber,
        periodStart: weekStart,
        periodEnd: weekEnd,
        subtotal,
        vatRate,
        vatAmount,
        total,
        status: 'DRAFT',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        lineItems: {
          create: lineItems,
        },
      },
      include: {
        lineItems: true,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Invoice generated',
      data: invoice,
    });
  };

  /**
   * Get invoice details (agency staff)
   * GET /api/clients/invoices/:invoiceId
   */
  getAgencyInvoiceDetails = async (req: AuthRequest, res: Response) => {
    const orgId = req.user!.organizationId;
    const { invoiceId } = req.params;

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId: orgId },
      include: {
        clientCompany: {
          select: {
            id: true,
            name: true,
            contactName: true,
            contactEmail: true,
            address: true,
            city: true,
            postcode: true,
          },
        },
        organization: {
          select: { name: true },
        },
        lineItems: {
          select: {
            id: true,
            description: true,
            hours: true,
            chargeRate: true,
            amount: true,
          },
        },
      },
    });

    if (!invoice) throw new NotFoundError('Invoice');

    res.json({
      success: true,
      data: invoice,
    });
  };

  /**
   * Download invoice as PDF (agency staff)
   * GET /api/clients/invoices/:invoiceId/pdf
   */
  downloadInvoicePDF = async (req: AuthRequest, res: Response) => {
    const orgId = req.user!.organizationId;
    const { invoiceId } = req.params;

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId: orgId },
      include: {
        clientCompany: {
          select: {
            name: true,
            contactName: true,
            address: true,
            city: true,
            postcode: true,
          },
        },
        organization: {
          select: { name: true },
        },
        lineItems: {
          select: {
            description: true,
            hours: true,
            chargeRate: true,
            amount: true,
          },
        },
      },
    });

    if (!invoice) throw new NotFoundError('Invoice');

    // Generate simple HTML-based PDF content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Invoice ${invoice.invoiceNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Helvetica', sans-serif; padding: 40px; color: #333; }
          .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
          h1 { font-size: 32px; color: #1e3a5f; }
          .invoice-number { font-size: 14px; color: #666; margin-top: 8px; }
          .section { margin-bottom: 24px; }
          .label { font-size: 12px; font-weight: bold; color: #666; text-transform: uppercase; margin-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; margin: 24px 0; }
          th { text-align: left; padding: 12px; border-bottom: 2px solid #e5e7eb; font-size: 12px; color: #666; text-transform: uppercase; }
          td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
          .amount { text-align: right; }
          .totals { margin-top: 24px; text-align: right; }
          .total-row { display: flex; justify-content: flex-end; gap: 40px; padding: 8px 0; }
          .total-label { color: #666; }
          .grand-total { font-size: 18px; font-weight: bold; border-top: 2px solid #333; padding-top: 16px; margin-top: 8px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>${invoice.organization?.name || 'StaffSync Agency'}</h1>
            <p>123 Business Street, London, UK</p>
          </div>
          <div style="text-align: right;">
            <h1>INVOICE</h1>
            <div class="invoice-number">${invoice.invoiceNumber}</div>
          </div>
        </div>
        
        <div class="section">
          <div class="label">Bill To</div>
          <p><strong>${invoice.clientCompany?.name}</strong></p>
          ${invoice.clientCompany?.contactName ? `<p>${invoice.clientCompany.contactName}</p>` : ''}
          ${invoice.clientCompany?.address ? `<p>${invoice.clientCompany.address}</p>` : ''}
          ${invoice.clientCompany?.city || invoice.clientCompany?.postcode ? `<p>${invoice.clientCompany.city || ''} ${invoice.clientCompany.postcode || ''}</p>` : ''}
        </div>

        <div style="display: flex; gap: 40px; margin-bottom: 24px;">
          <div><div class="label">Invoice Date</div><p>${new Date(invoice.createdAt).toLocaleDateString('en-GB')}</p></div>
          <div><div class="label">Due Date</div><p>${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-GB') : '-'}</p></div>
          <div><div class="label">Period</div><p>${new Date(invoice.periodStart).toLocaleDateString('en-GB')} - ${new Date(invoice.periodEnd).toLocaleDateString('en-GB')}</p></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Hours</th>
              <th>Rate</th>
              <th class="amount">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.lineItems.map(item => `
              <tr>
                <td>${item.description || ''}</td>
                <td>${Number(item.hours).toFixed(2)}</td>
                <td>£${Number(item.chargeRate).toFixed(2)}/hr</td>
                <td class="amount">£${Number(item.amount).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals">
          <div class="total-row"><span class="total-label">Subtotal:</span><span>£${Number(invoice.subtotal).toFixed(2)}</span></div>
          <div class="total-row"><span class="total-label">VAT (${invoice.vatRate}%):</span><span>£${Number(invoice.vatAmount).toFixed(2)}</span></div>
          <div class="total-row grand-total"><span>Total:</span><span>£${Number(invoice.total).toFixed(2)}</span></div>
        </div>

        <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #666;">
          <p><strong>Payment Terms:</strong> Payment due within 30 days of invoice date.</p>
          <p><strong>Bank Details:</strong> Sort Code: 12-34-56 | Account: 12345678</p>
        </div>
      </body>
      </html>
    `;

    // Return as HTML for browser to handle printing/PDF
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="Invoice-${invoice.invoiceNumber}.html"`);
    res.send(htmlContent);
  };

  // ==================== WEEKLY TIMESHEET & INVOICING ====================

  /**
   * Get weekly timesheet summary for client
   * GET /api/client/timesheet/weekly
   */
  getWeeklyTimesheetSummary = async (req: ClientAuthRequest, res: Response) => {
    const clientCompanyId = req.clientUser!.clientCompanyId;
    const { weeks = 8 } = req.query;
    const numWeeks = Math.min(Number(weeks) || 8, 12);

    const now = new Date();
    const weeklyData: Array<{
      weekNumber: number;
      weekLabel: string;
      weekStart: Date;
      weekEnd: Date;
      totalHours: number;
      totalShifts: number;
      totalWorkers: number;
      totalAmount: number;
      status: 'UNINVOICED' | 'INVOICED' | 'PARTIAL';
      invoiceId?: string;
    }> = [];

    for (let i = 0; i < numWeeks; i++) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay() - (i * 7));
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      // Get attendance data for this week
      const attendances = await prisma.attendance.findMany({
        where: {
          shift: { clientCompanyId },
          clockInAt: { gte: weekStart, lte: weekEnd },
          status: 'APPROVED',
        },
        include: {
          shift: { select: { payRate: true } },
        },
      });

      // Check if invoice exists for this period
      const existingInvoice = await prisma.invoice.findFirst({
        where: {
          clientCompanyId,
          periodStart: { lte: weekEnd },
          periodEnd: { gte: weekStart },
        },
        select: { id: true, status: true },
      });

      const totalHours = attendances.reduce((sum, a) => sum + (Number(a.hoursWorked) || 0), 0);
      const uniqueWorkers = new Set(attendances.map(a => a.workerId)).size;
      
      // Calculate amount using charge rate (typically 1.3x pay rate for agency margin)
      const totalAmount = attendances.reduce((sum, a) => {
        const payRate = Number(a.shift.payRate) || 12;
        const chargeRate = payRate * 1.3; // 30% margin
        return sum + ((Number(a.hoursWorked) || 0) * chargeRate);
      }, 0);

      const weekLabel = `Week ${numWeeks - i}`;
      
      weeklyData.push({
        weekNumber: numWeeks - i,
        weekLabel,
        weekStart,
        weekEnd,
        totalHours: Math.round(totalHours * 10) / 10,
        totalShifts: attendances.length,
        totalWorkers: uniqueWorkers,
        totalAmount: Math.round(totalAmount * 100) / 100,
        status: existingInvoice ? 'INVOICED' : (attendances.length > 0 ? 'UNINVOICED' : 'UNINVOICED'),
        invoiceId: existingInvoice?.id,
      });
    }

    res.json({
      success: true,
      data: {
        weeks: weeklyData.reverse(), // Oldest first
        summary: {
          totalHours: weeklyData.reduce((s, w) => s + w.totalHours, 0),
          totalAmount: weeklyData.reduce((s, w) => s + w.totalAmount, 0),
          uninvoicedWeeks: weeklyData.filter(w => w.status === 'UNINVOICED' && w.totalShifts > 0).length,
        },
      },
    });
  };

  /**
   * Generate invoice for a specific week
   * POST /api/client/invoices/generate
   */
  generateWeeklyInvoice = async (req: ClientAuthRequest, res: Response) => {
    const clientCompanyId = req.clientUser!.clientCompanyId;
    const { weekStart: weekStartStr, weekEnd: weekEndStr } = z.object({
      weekStart: z.string(),
      weekEnd: z.string(),
    }).parse(req.body);

    const weekStart = new Date(weekStartStr);
    const weekEnd = new Date(weekEndStr);

    // Get client company
    const client = await prisma.clientCompany.findUnique({
      where: { id: clientCompanyId },
    });

    if (!client) throw new NotFoundError('Client company');

    // Check if invoice already exists for this period
    const existingInvoice = await prisma.invoice.findFirst({
      where: {
        clientCompanyId,
        periodStart: weekStart,
        periodEnd: weekEnd,
      },
    });

    if (existingInvoice) {
      throw new AppError('Invoice already exists for this period', 400, 'INVOICE_EXISTS');
    }

    // Get approved attendance for this period
    const attendances = await prisma.attendance.findMany({
      where: {
        shift: { clientCompanyId },
        clockInAt: { gte: weekStart, lte: weekEnd },
        status: 'APPROVED',
      },
      include: {
        shift: { select: { id: true, title: true, payRate: true, role: true } },
        worker: { select: { id: true, fullName: true } },
      },
    });

    if (attendances.length === 0) {
      throw new AppError('No approved timesheets for this period', 400, 'NO_TIMESHEETS');
    }

    // Generate invoice number
    const invoiceCount = await prisma.invoice.count({
      where: { organizationId: client.organizationId },
    });
    const invoiceNumber = `INV-${String(invoiceCount + 1).padStart(5, '0')}`;

    // Calculate line items
    const lineItems = attendances.map(a => {
      const payRate = Number(a.shift.payRate) || 12;
      const chargeRate = payRate * 1.3; // 30% margin
      const hours = Number(a.hoursWorked) || 0;
      return {
        shiftId: a.shift.id,
        workerId: a.worker.id,
        description: `${a.worker.fullName} - ${a.shift.title || a.shift.role}`,
        hours,
        chargeRate,
        amount: hours * chargeRate,
      };
    });

    const subtotal = lineItems.reduce((s, li) => s + li.amount, 0);
    const vatRate = 20;
    const vatAmount = subtotal * (vatRate / 100);
    const total = subtotal + vatAmount;

    // Create invoice with line items
    const invoice = await prisma.invoice.create({
      data: {
        organizationId: client.organizationId,
        clientCompanyId,
        invoiceNumber,
        periodStart: weekStart,
        periodEnd: weekEnd,
        subtotal,
        vatRate,
        vatAmount,
        total,
        status: 'DRAFT',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        lineItems: {
          create: lineItems,
        },
      },
      include: {
        lineItems: true,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Invoice generated',
      data: invoice,
    });
  };

  /**
   * Get weekly timesheet details for a specific week
   * GET /api/client/timesheet/weekly/:weekNumber
   */
  getWeeklyTimesheetDetails = async (req: ClientAuthRequest, res: Response) => {
    const clientCompanyId = req.clientUser!.clientCompanyId;
    const { weekStart: weekStartStr, weekEnd: weekEndStr } = req.query;

    if (!weekStartStr || !weekEndStr) {
      throw new AppError('weekStart and weekEnd are required', 400, 'MISSING_PARAMS');
    }

    const weekStart = new Date(weekStartStr as string);
    const weekEnd = new Date(weekEndStr as string);

    // Get all attendance records for this week
    const attendances = await prisma.attendance.findMany({
      where: {
        shift: { clientCompanyId },
        clockInAt: { gte: weekStart, lte: weekEnd },
      },
      include: {
        worker: { select: { id: true, fullName: true } },
        shift: { select: { id: true, title: true, role: true, startAt: true, endAt: true, payRate: true } },
      },
      orderBy: { clockInAt: 'asc' },
    });

    // Group by day
    const byDay: Record<string, typeof attendances> = {};
    attendances.forEach(a => {
      const day = a.clockInAt!.toISOString().split('T')[0];
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(a);
    });

    const totalHours = attendances.reduce((s, a) => s + (Number(a.hoursWorked) || 0), 0);
    const approvedHours = attendances
      .filter(a => a.status === 'APPROVED')
      .reduce((s, a) => s + (Number(a.hoursWorked) || 0), 0);
    const pendingHours = attendances
      .filter(a => a.status === 'PENDING')
      .reduce((s, a) => s + (Number(a.hoursWorked) || 0), 0);

    res.json({
      success: true,
      data: {
        period: { weekStart, weekEnd },
        summary: {
          totalHours,
          approvedHours,
          pendingHours,
          totalShifts: attendances.length,
          uniqueWorkers: new Set(attendances.map(a => a.workerId)).size,
        },
        byDay,
        attendances,
      },
    });
  };
}
