import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { AppError, NotFoundError } from '../utils/AppError';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';
import crypto from 'crypto';
import { ExportService } from '../services/export';
import { EmailService } from '../services/notifications/email.service';
import { InviteCodeService } from '../services/inviteCode.service';
import { rtwService, RTWVerificationResult } from '../services/rtw';

/** Parse DD/MM/YYYY string into a valid Date object */
function parseDDMMYYYY(str: string): Date {
  const parts = str.split('/');
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts;
    const d = new Date(`${yyyy}-${mm}-${dd}`);
    if (!isNaN(d.getTime())) return d;
  }
  // Fallback: try native parsing
  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? new Date('1970-01-01') : fallback;
}

export class WorkerController {
  list = async (req: AuthRequest, res: Response) => {
    const { status, skills, rtwStatus, search } = req.query;
    const userRole = req.user!.role;
    const userId = req.user!.id;

    // Build hierarchy-based filter
    let managerFilter: any = {};
    
    if (userRole === 'SHIFT_COORDINATOR') {
      // Shift Coordinator sees workers assigned to them + unassigned workers
      managerFilter = { OR: [{ managerId: userId }, { managerId: null }] };
    } else if (userRole === 'OPS_MANAGER') {
      // Ops Manager sees workers assigned to their Shift Coordinators + unassigned workers
      const myShiftCoordinators = await prisma.user.findMany({
        where: {
          organizationId: req.user!.organizationId,
          role: 'SHIFT_COORDINATOR',
          managerId: userId,
        },
        select: { id: true },
      });
      const coordinatorIds = myShiftCoordinators.map(sc => sc.id);
      managerFilter = { OR: [{ managerId: { in: coordinatorIds } }, { managerId: null }] };
    }
    // ADMIN sees all workers (no filter)

    const workers = await prisma.user.findMany({
      where: {
        organizationId: req.user!.organizationId,
        role: 'WORKER',
        ...managerFilter,
        ...(status && { status: status as any }),
        ...(search && {
          OR: [
            { fullName: { contains: search as string, mode: 'insensitive' } },
            { email: { contains: search as string, mode: 'insensitive' } },
          ],
        }),
        ...(rtwStatus && {
          workerProfile: { rtwStatus: rtwStatus as any },
        }),
      },
      include: {
        workerProfile: true,
        workerSkills: { include: { skill: true } },
        reliabilityScore: true,
        manager: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: { fullName: 'asc' },
    });

    res.json({ success: true, data: workers });
  };

  // Worker List Stats (Total, Active, On Shift, Blocked) - hierarchy-aware
  getListStats = async (req: AuthRequest, res: Response) => {
    const organizationId = req.user!.organizationId;
    const userRole = req.user!.role;
    const userId = req.user!.id;

    // Build hierarchy-based filter
    let managerFilter: any = {};
    
    if (userRole === 'SHIFT_COORDINATOR') {
      managerFilter = { OR: [{ managerId: userId }, { managerId: null }] };
    } else if (userRole === 'OPS_MANAGER') {
      const myShiftCoordinators = await prisma.user.findMany({
        where: {
          organizationId,
          role: 'SHIFT_COORDINATOR',
          managerId: userId,
        },
        select: { id: true },
      });
      const coordinatorIds = myShiftCoordinators.map(sc => sc.id);
      managerFilter = { OR: [{ managerId: { in: coordinatorIds } }, { managerId: null }] };
    }

    // Calculate week boundaries for percentage change
    const now = new Date();
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - now.getDay());
    thisWeekStart.setHours(0, 0, 0, 0);

    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekStart);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    const baseWhere = { organizationId, role: 'WORKER' as const, ...managerFilter };

    // Current counts
    const [totalWorkers, activeWorkers, blockedWorkers, onShiftWorkers] = await Promise.all([
      // Total workers
      prisma.user.count({
        where: baseWhere,
      }),
      // Active workers
      prisma.user.count({
        where: { ...baseWhere, status: 'ACTIVE' },
      }),
      // Blocked workers
      prisma.user.count({
        where: {
          ...baseWhere,
          workerBlocks: { some: { status: 'ACTIVE' } },
        },
      }),
      // On shift today (workers with active attendance)
      prisma.attendance.count({
        where: {
          clockInAt: { gte: today, lt: tomorrow },
          clockOutAt: null,
          worker: baseWhere,
        },
      }),
    ]);

    // Last week counts for percentage change
    const [lastWeekTotal, lastWeekActive] = await Promise.all([
      prisma.user.count({
        where: {
          ...baseWhere,
          createdAt: { lt: lastWeekEnd },
        },
      }),
      prisma.user.count({
        where: {
          ...baseWhere,
          status: 'ACTIVE',
          createdAt: { lt: lastWeekEnd },
        },
      }),
    ]);

    // Calculate percentage changes
    const calcChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100 * 10) / 10;
    };

    res.json({
      success: true,
      data: {
        totalWorkers: { value: totalWorkers, change: calcChange(totalWorkers, lastWeekTotal) },
        activeWorkers: { value: activeWorkers, change: calcChange(activeWorkers, lastWeekActive) },
        onShift: { value: onShiftWorkers, change: 0 }, // Real-time, no historical comparison
        blocked: { value: blockedWorkers, change: 0 }, // No historical comparison for blocks
      },
    });
  };

  getById = async (req: AuthRequest, res: Response) => {
    const worker = await prisma.user.findFirst({
      where: {
        id: req.params.workerId,
        organizationId: req.user!.organizationId,
        role: 'WORKER',
      },
      include: {
        workerProfile: true,
        workerSkills: { include: { skill: true } },
        workerDocuments: true,
        workerAvailability: true,
        reliabilityScore: true,
        workerBlocks: { where: { status: 'ACTIVE' } },
        bankAccount: true,
      },
    });

    if (!worker) throw new NotFoundError('Worker');

    res.json({ success: true, data: worker });
  };

  // Worker Stats (Total Shifts, Earnings, Hours, Attendance Rate)
  getStats = async (req: AuthRequest, res: Response) => {
    const { workerId } = req.params;

    // Verify worker exists and belongs to organization
    const worker = await prisma.user.findFirst({
      where: {
        id: workerId,
        organizationId: req.user!.organizationId,
        role: 'WORKER',
      },
    });

    if (!worker) throw new NotFoundError('Worker');

    // Get all shift assignments for this worker
    const shiftAssignments = await prisma.shiftAssignment.findMany({
      where: { workerId },
      include: {
        shift: {
          include: {
            attendances: {
              where: { workerId },
              take: 1,
            },
          },
        },
      },
    });

    // Calculate stats
    const totalShifts = shiftAssignments.length;

    // Calculate total hours from completed shifts with attendance
    let totalMinutes = 0;
    let completedShifts = 0;
    let attendedShifts = 0;

    for (const assignment of shiftAssignments) {
      const attendance = assignment.shift.attendances?.[0];
      if (attendance && attendance.clockInAt) {
        attendedShifts++;
        if (attendance.clockOutAt) {
          completedShifts++;
          const clockIn = new Date(attendance.clockInAt);
          const clockOut = new Date(attendance.clockOutAt);
          totalMinutes += (clockOut.getTime() - clockIn.getTime()) / (1000 * 60);
        }
      }
    }

    const totalHours = Math.floor(totalMinutes / 60);
    const totalMins = Math.round(totalMinutes % 60);

    // Calculate attendance rate (shifts attended / total assigned shifts)
    const attendanceRate = totalShifts > 0 
      ? Math.round((attendedShifts / totalShifts) * 100) 
      : 0;

    // Get total earnings from payroll
    const payslips = await prisma.payslip.findMany({
      where: { 
        workerId,
        status: 'APPROVED',
      },
    });

    const totalEarnings = payslips.reduce((sum: number, ps) => sum + (ps.netPay?.toNumber() || 0), 0);

    res.json({
      success: true,
      data: {
        totalShifts,
        totalEarnings,
        totalHours: `${totalHours}h ${totalMins}m`,
        totalMinutes: Math.round(totalMinutes),
        attendanceRate,
        completedShifts,
        attendedShifts,
      },
    });
  };

  // Worker Shift History
  getShifts = async (req: AuthRequest, res: Response) => {
    const { workerId } = req.params;
    const { status, search, page = '1', limit = '10' } = req.query;

    // Verify worker exists and belongs to organization
    const worker = await prisma.user.findFirst({
      where: {
        id: workerId,
        organizationId: req.user!.organizationId,
        role: 'WORKER',
      },
    });

    if (!worker) throw new NotFoundError('Worker');

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = { workerId };
    
    if (status) {
      where.status = status;
    }

    const shiftAssignmentInclude = {
      shift: {
        select: {
          id: true,
          title: true,
          startAt: true,
          endAt: true,
          location: true,
          attendances: {
            where: { workerId },
            take: 1,
          },
        },
      },
    } satisfies Prisma.ShiftAssignmentInclude;

    const [assignments, total] = await Promise.all([
      prisma.shiftAssignment.findMany({
        where,
        include: shiftAssignmentInclude,
        orderBy: { assignedAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.shiftAssignment.count({ where }),
    ]);

    const shifts = assignments.map((a) => {
      const attendance = a.shift.attendances?.[0];
      return {
        id: a.id,
        shiftId: a.shift.id,
        shiftCode: `#${a.shift.id.slice(-8).toUpperCase()}`,
        title: a.shift.title,
        location: a.shift.location?.name || 'Unknown',
        date: a.shift.startAt.toLocaleDateString('en-GB'),
        startTime: a.shift.startAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        endTime: a.shift.endAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        duration: `${a.shift.startAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} - ${a.shift.endAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`,
        status: attendance?.clockOutAt ? 'Completed' 
          : attendance?.clockInAt ? 'Ongoing'
          : new Date(a.shift.startAt) > new Date() ? 'Upcoming'
          : 'No show',
        assignmentStatus: a.status,
      };
    });

    res.json({
      success: true,
      data: shifts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  };

  getProfile = async (req: AuthRequest, res: Response) => {
    const profile = await prisma.workerProfile.findUnique({
      where: { userId: req.params.workerId },
    });

    if (!profile) throw new NotFoundError('Worker profile');

    res.json({ success: true, data: profile });
  };

  updateProfile = async (req: AuthRequest, res: Response) => {
    const profile = await prisma.workerProfile.upsert({
      where: { userId: req.params.workerId },
      update: req.body,
      create: {
        userId: req.params.workerId,
        ...req.body,
      },
    });

    res.json({ success: true, data: profile });
  };

  // Skills
  getSkills = async (req: AuthRequest, res: Response) => {
    const skills = await prisma.workerSkill.findMany({
      where: { workerId: req.params.workerId },
      include: { skill: true },
    });

    res.json({ success: true, data: skills });
  };

  updateSkills = async (req: AuthRequest, res: Response) => {
    const { skillIds } = req.body;

    await prisma.$transaction([
      prisma.workerSkill.deleteMany({
        where: { workerId: req.params.workerId },
      }),
      prisma.workerSkill.createMany({
        data: skillIds.map((skillId: string) => ({
          workerId: req.params.workerId,
          skillId,
        })),
      }),
    ]);

    res.json({ success: true, message: 'Skills updated' });
  };

  // Documents
  getDocuments = async (req: AuthRequest, res: Response) => {
    const documents = await prisma.workerDocument.findMany({
      where: { workerId: req.params.workerId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: documents });
  };

  uploadDocument = async (req: AuthRequest, res: Response) => {
    const document = await prisma.workerDocument.create({
      data: {
        workerId: req.params.workerId,
        ...req.body,
      },
    });

    res.status(201).json({ success: true, data: document });
  };

  verifyDocument = async (req: AuthRequest, res: Response) => {
    const document = await prisma.workerDocument.update({
      where: { id: req.params.docId },
      data: {
        verified: true,
        verifiedBy: req.user!.id,
        verifiedAt: new Date(),
      },
    });

    res.json({ success: true, data: document });
  };

  deleteDocument = async (req: AuthRequest, res: Response) => {
    await prisma.workerDocument.delete({
      where: { id: req.params.docId },
    });

    res.json({ success: true, message: 'Document deleted' });
  };

  // RTW
  getRTWStatus = async (req: AuthRequest, res: Response) => {
    const profile = await prisma.workerProfile.findUnique({
      where: { userId: req.params.workerId },
      select: {
        rtwStatus: true,
        rtwShareCode: true,
        rtwCheckedAt: true,
        rtwExpiresAt: true,
        rtwAuditNote: true,
      },
    });

    res.json({ success: true, data: profile });
  };

  initiateRTW = async (req: AuthRequest, res: Response) => {
    const { shareCode, dateOfBirth } = req.body;
    const workerId = req.params.workerId;

    if (!shareCode || !dateOfBirth) {
      throw new AppError('Share code and date of birth are required', 400);
    }

    // Validate share code format
    const codeValidation = rtwService.validateShareCode(shareCode);
    if (!codeValidation.valid) {
      throw new AppError(codeValidation.error || 'Invalid share code', 400);
    }

    // Set status to pending while verifying
    await prisma.workerProfile.update({
      where: { userId: workerId },
      data: {
        rtwStatus: 'PENDING',
        rtwShareCode: codeValidation.normalized,
      },
    });

    // Call RTW verification service
    const result = await rtwService.verify({
      shareCode: codeValidation.normalized,
      dateOfBirth,
    });

    // Map verification result to RTW status
    let rtwStatus: 'NOT_STARTED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
    if (result.verified && result.status === 'VALID') {
      rtwStatus = 'APPROVED';
    } else if (result.status === 'EXPIRED') {
      rtwStatus = 'EXPIRED';
    } else {
      rtwStatus = 'REJECTED';
    }

    // Update worker profile with verification result
    const profile = await prisma.workerProfile.update({
      where: { userId: workerId },
      data: {
        rtwStatus,
        rtwShareCode: codeValidation.normalized,
        rtwCheckedAt: result.checkDate,
        rtwCheckedBy: req.user?.id || 'SYSTEM',
        rtwExpiresAt: result.expiryDate,
        rtwAuditNote: result.verified
          ? `Verified: ${result.workRestriction || 'UNLIMITED'} - ${result.nationality || 'N/A'}`
          : result.errorMessage,
        rtwAuditUrl: result.referenceNumber
          ? rtwService.generateAuditUrl(result.referenceNumber)
          : undefined,
      },
    });

    // If approved, check if onboarding can be completed
    if (rtwStatus === 'APPROVED') {
      // Check if all required documents are uploaded
      const documents = await prisma.workerDocument.count({
        where: { workerId, status: 'VERIFIED' },
      });

      if (documents > 0) {
        await prisma.workerProfile.update({
          where: { userId: workerId },
          data: { onboardingStatus: 'COMPLETE' },
        });
      }
    }

    res.json({
      success: result.verified,
      data: {
        ...profile,
        verificationResult: {
          verified: result.verified,
          status: result.status,
          workRestriction: result.workRestriction,
          expiryDate: result.expiryDate,
          referenceNumber: result.referenceNumber,
          errorMessage: result.errorMessage,
        },
      },
    });
  };

  updateRTW = async (req: AuthRequest, res: Response) => {
    const profile = await prisma.workerProfile.update({
      where: { userId: req.params.workerId },
      data: {
        rtwStatus: req.body.status,
        rtwCheckedAt: new Date(),
        rtwCheckedBy: req.user!.id,
        rtwExpiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined,
        rtwAuditNote: req.body.auditNote,
      },
    });

    // Update onboarding status
    if (req.body.status === 'APPROVED') {
      await prisma.workerProfile.update({
        where: { userId: req.params.workerId },
        data: { onboardingStatus: 'COMPLETE' },
      });
    }

    res.json({ success: true, data: profile });
  };

  // Availability
  getAvailability = async (req: AuthRequest, res: Response) => {
    const availability = await prisma.workerAvailability.findMany({
      where: { workerId: req.params.workerId },
    });

    const unavailableDates = await prisma.workerUnavailableDate.findMany({
      where: { workerId: req.params.workerId },
    });

    res.json({ success: true, data: { availability, unavailableDates } });
  };

  updateAvailability = async (req: AuthRequest, res: Response) => {
    const { availability } = req.body;

    await prisma.$transaction([
      prisma.workerAvailability.deleteMany({
        where: { workerId: req.params.workerId },
      }),
      prisma.workerAvailability.createMany({
        data: availability.map((a: any) => ({
          workerId: req.params.workerId,
          ...a,
        })),
      }),
    ]);

    res.json({ success: true, message: 'Availability updated' });
  };

  // Blocks
  getBlocks = async (req: AuthRequest, res: Response) => {
    const blocks = await prisma.workerBlock.findMany({
      where: { workerId: req.params.workerId },
      include: {
        blocker: { select: { id: true, fullName: true } },
        clientCompany: { select: { id: true, name: true } },
      },
      orderBy: { blockedAt: 'desc' },
    });

    res.json({ success: true, data: blocks });
  };

  createBlock = async (req: AuthRequest, res: Response) => {
    const block = await prisma.workerBlock.create({
      data: {
        workerId: req.params.workerId,
        blockedBy: req.user!.id,
        ...req.body,
      },
    });

    res.status(201).json({ success: true, data: block });
  };

  liftBlock = async (req: AuthRequest, res: Response) => {
    const block = await prisma.workerBlock.update({
      where: { id: req.params.blockId },
      data: { status: 'LIFTED' },
    });

    res.json({ success: true, data: block });
  };

  // Reliability
  getReliability = async (req: AuthRequest, res: Response) => {
    const score = await prisma.workerReliabilityScore.findUnique({
      where: { workerId: req.params.workerId },
    });

    res.json({ success: true, data: score });
  };

  // Invite
  invite = async (req: AuthRequest, res: Response) => {
    const { email, phone, fullName } = req.body;

    const result = await InviteCodeService.createWorkerInvite({
      organizationId: req.user!.organizationId,
      createdBy: req.user!.id,
      email,
      phone,
      workerName: fullName,
      
    });

    res.status(201).json({ success: true, data: result });
  };

  // Suspend worker
  suspend = async (req: AuthRequest, res: Response) => {
    const { workerId } = req.params;
    const { reason } = req.body;

    const worker = await prisma.user.findFirst({
      where: {
        id: workerId,
        organizationId: req.user!.organizationId,
        role: 'WORKER',
      },
    });

    if (!worker) {
      throw new NotFoundError('Worker');
    }

    await prisma.user.update({
      where: { id: workerId },
      data: { status: 'SUSPENDED' },
    });

    res.json({ success: true, message: 'Worker suspended', reason });
  };

  // Reactivate worker
  reactivate = async (req: AuthRequest, res: Response) => {
    const { workerId } = req.params;

    const worker = await prisma.user.findFirst({
      where: {
        id: workerId,
        organizationId: req.user!.organizationId,
        role: 'WORKER',
      },
    });

    if (!worker) {
      throw new NotFoundError('Worker');
    }

    await prisma.user.update({
      where: { id: workerId },
      data: { status: 'ACTIVE' },
    });

    res.json({ success: true, message: 'Worker reactivated' });
  };

  // ============================================================
  // WORKER-CLIENT COMPANY ASSIGNMENT
  // ============================================================

  /**
   * Assign worker to client company
   * Validates that worker's manager is assigned to the client (unless Admin/Ops override)
   */
  assignToClient = async (req: AuthRequest, res: Response) => {
    const { workerId } = req.params;
    const { clientCompanyId, payRate, forceTransfer } = z.object({
      clientCompanyId: z.string().uuid(),
      payRate: z.number().optional(),
      forceTransfer: z.boolean().optional(),
    }).parse(req.body);

    // Get worker with manager
    const worker = await prisma.user.findFirst({
      where: {
        id: workerId,
        organizationId: req.user!.organizationId,
        role: 'WORKER',
      },
      select: { id: true, fullName: true, managerId: true },
    });

    if (!worker) {
      throw new NotFoundError('Worker');
    }

    // Verify client company exists
    const clientCompany = await prisma.clientCompany.findFirst({
      where: {
        id: clientCompanyId,
        organizationId: req.user!.organizationId,
      },
    });

    if (!clientCompany) {
      throw new NotFoundError('Client company');
    }

    // Check if worker's manager is assigned to this client (unless forceTransfer by Ops/Admin)
    const isOpsOrAdmin = ['ADMIN', 'OPS_MANAGER'].includes(req.user!.role);
    
    if (!forceTransfer || !isOpsOrAdmin) {
      if (worker.managerId) {
        const managerAssigned = await prisma.staffCompanyAssignment.findFirst({
          where: {
            staffId: worker.managerId,
            clientCompanyId,
            status: 'ACTIVE',
          },
        });

        if (!managerAssigned) {
          throw new AppError(
            'Worker\'s manager is not assigned to this client. Use transfer to reassign.',
            400,
            'MANAGER_NOT_ASSIGNED'
          );
        }
      }
    }

    // Create or update assignment
    const assignment = await prisma.workerCompanyAssignment.upsert({
      where: {
        workerId_clientCompanyId: { workerId, clientCompanyId },
      },
      create: {
        workerId,
        clientCompanyId,
        payRate,
        status: 'ACTIVE',
      },
      update: {
        payRate,
        status: 'ACTIVE',
      },
    });

    res.json({
      success: true,
      message: `Worker assigned to ${clientCompany.name}`,
      data: assignment,
    });
  };

  /**
   * Bulk assign workers to client company
   * All workers must have the same manager who is assigned to the client
   * POST /api/workers/assign-to-client
   */
  bulkAssignToClient = async (req: AuthRequest, res: Response) => {
    const { workerIds, clientCompanyId, payRate } = z.object({
      workerIds: z.array(z.string().uuid()).min(1),
      clientCompanyId: z.string().uuid(),
      payRate: z.number().optional(),
    }).parse(req.body);

    const isOpsOrAdmin = ['ADMIN', 'OPS_MANAGER', 'SHIFT_COORDINATOR'].includes(req.user!.role);

    // Verify client company exists
    const clientCompany = await prisma.clientCompany.findFirst({
      where: {
        id: clientCompanyId,
        organizationId: req.user!.organizationId,
      },
    });

    if (!clientCompany) {
      throw new NotFoundError('Client company');
    }

    // Get all workers with their managers
    const workers = await prisma.user.findMany({
      where: {
        id: { in: workerIds },
        organizationId: req.user!.organizationId,
        role: 'WORKER',
      },
      select: { id: true, fullName: true, managerId: true },
    });

    if (workers.length === 0) {
      throw new AppError('No valid workers found', 400, 'NO_WORKERS');
    }

    if (workers.length !== workerIds.length) {
      throw new AppError(
        `Only ${workers.length} of ${workerIds.length} workers found`,
        400,
        'WORKERS_NOT_FOUND'
      );
    }

    // Verify all workers have the same manager (unless Admin/Ops)
    if (!isOpsOrAdmin) {
      const managerIds = [...new Set(workers.map(w => w.managerId))];
      
      if (managerIds.length > 1) {
        throw new AppError(
          'All workers must have the same manager for bulk assignment',
          400,
          'DIFFERENT_MANAGERS'
        );
      }

      const managerId = managerIds[0];
      
      if (managerId) {
        // Verify the manager is assigned to this client
        const managerAssigned = await prisma.staffCompanyAssignment.findFirst({
          where: {
            staffId: managerId,
            clientCompanyId,
            status: 'ACTIVE',
          },
        });

        if (!managerAssigned) {
          throw new AppError(
            'Workers\' manager is not assigned to this client',
            400,
            'MANAGER_NOT_ASSIGNED'
          );
        }
      }
    }

    // Bulk create/update assignments using transaction
    const results = await prisma.$transaction(
      workers.map(worker =>
        prisma.workerCompanyAssignment.upsert({
          where: {
            workerId_clientCompanyId: {
              workerId: worker.id,
              clientCompanyId,
            },
          },
          create: {
            workerId: worker.id,
            clientCompanyId,
            payRate,
            status: 'ACTIVE',
          },
          update: {
            payRate,
            status: 'ACTIVE',
          },
        })
      )
    );

    res.json({
      success: true,
      message: `${results.length} worker(s) assigned to ${clientCompany.name}`,
      data: {
        count: results.length,
        clientCompany: clientCompany.name,
      },
    });
  };

  /**
   * Transfer worker to a new client (Ops/Admin only)
   * This bypasses manager validation
   */
  transferToClient = async (req: AuthRequest, res: Response) => {
    const { workerId } = req.params;
    const { clientCompanyId, newManagerId, payRate } = z.object({
      clientCompanyId: z.string().uuid(),
      newManagerId: z.string().uuid().optional(),
      payRate: z.number().optional(),
    }).parse(req.body);

    // Get worker
    const worker = await prisma.user.findFirst({
      where: {
        id: workerId,
        organizationId: req.user!.organizationId,
        role: 'WORKER',
      },
    });

    if (!worker) {
      throw new NotFoundError('Worker');
    }

    // Verify client company
    const clientCompany = await prisma.clientCompany.findFirst({
      where: {
        id: clientCompanyId,
        organizationId: req.user!.organizationId,
      },
    });

    if (!clientCompany) {
      throw new NotFoundError('Client company');
    }

    // If new manager specified, verify they're assigned to the client
    if (newManagerId) {
      const managerAssigned = await prisma.staffCompanyAssignment.findFirst({
        where: {
          staffId: newManagerId,
          clientCompanyId,
          status: 'ACTIVE',
        },
      });

      if (!managerAssigned) {
        throw new AppError('New manager is not assigned to this client', 400, 'MANAGER_NOT_ASSIGNED');
      }
    }

    // Update worker's manager and create client assignment
    await prisma.$transaction([
      // Update manager if specified
      ...(newManagerId ? [
        prisma.user.update({
          where: { id: workerId },
          data: { managerId: newManagerId },
        })
      ] : []),
      // Create/update client assignment
      prisma.workerCompanyAssignment.upsert({
        where: {
          workerId_clientCompanyId: { workerId, clientCompanyId },
        },
        create: {
          workerId,
          clientCompanyId,
          payRate,
          status: 'ACTIVE',
        },
        update: {
          payRate,
          status: 'ACTIVE',
        },
      }),
    ]);

    res.json({
      success: true,
      message: `Worker transferred to ${clientCompany.name}${newManagerId ? ' with new manager' : ''}`,
    });
  };

  /**
   * Remove worker from client company
   */
  removeFromClient = async (req: AuthRequest, res: Response) => {
    const { workerId } = req.params;
    const { clientCompanyId } = z.object({
      clientCompanyId: z.string().uuid(),
    }).parse(req.body);

    const result = await prisma.workerCompanyAssignment.updateMany({
      where: {
        workerId,
        clientCompanyId,
        worker: { organizationId: req.user!.organizationId },
      },
      data: { status: 'INACTIVE' },
    });

    if (result.count === 0) {
      throw new NotFoundError('Worker assignment');
    }

    res.json({
      success: true,
      message: 'Worker removed from client',
    });
  };

  /**
   * Get worker's assigned clients
   */
  getWorkerClients = async (req: AuthRequest, res: Response) => {
    const { workerId } = req.params;

    const assignments = await prisma.workerCompanyAssignment.findMany({
      where: {
        workerId,
        worker: { organizationId: req.user!.organizationId },
        status: 'ACTIVE',
      },
      include: {
        clientCompany: {
          select: {
            id: true,
            name: true,
            address: true,
            contactName: true,
            status: true,
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });

    res.json({
      success: true,
      data: assignments.map(a => ({
        ...a.clientCompany,
        payRate: a.payRate,
        assignedAt: a.assignedAt,
      })),
    });
  };

  /**
   * Get workers available for a client (their manager is assigned to the client)
   */
  getAvailableWorkersForClient = async (req: AuthRequest, res: Response) => {
    const { clientCompanyId } = req.params;

    // Get staff assigned to this client
    const staffAssignments = await prisma.staffCompanyAssignment.findMany({
      where: {
        clientCompanyId,
        clientCompany: { organizationId: req.user!.organizationId },
        status: 'ACTIVE',
      },
      select: { staffId: true },
    });

    const staffIds = staffAssignments.map(s => s.staffId);

    // Get workers managed by these staff who are not already assigned to this client
    const workers = await prisma.user.findMany({
      where: {
        organizationId: req.user!.organizationId,
        role: 'WORKER',
        status: 'ACTIVE',
        managerId: { in: staffIds },
        workerCompanyAssignments: {
          none: {
            clientCompanyId,
            status: 'ACTIVE',
          },
        },
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        manager: {
          select: { id: true, fullName: true, role: true },
        },
        workerProfile: {
          select: { onboardingStatus: true, rtwStatus: true },
        },
      },
      orderBy: { fullName: 'asc' },
    });

    res.json({
      success: true,
      data: workers,
      count: workers.length,
    });
  };

  /**
   * Worker Homepage Dashboard
   * GET /api/workers/home
   * Returns: greeting, weekly stats, today's shift, upcoming shifts
   */
  getHomepage = async (req: AuthRequest, res: Response) => {
    const workerId = req.user!.id;
    const now = new Date();

    // Get start of current week (Monday)
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // Today boundaries
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    // Get worker info
    const worker = await prisma.user.findUnique({
      where: { id: workerId },
      select: {
        id: true,
        fullName: true,
        workerProfile: {
          select: { holidayBalance: true },
        },
      },
    }) as { id: string; fullName: string; workerProfile: { holidayBalance: number | null } | null } | null;

    if (!worker) throw new NotFoundError('Worker');

    // Get weekly stats
    const [weeklyShifts, weeklyAttendances] = await Promise.all([
      // Count of shifts this week
      prisma.shiftAssignment.count({
        where: {
          workerId,
          status: { in: ['ASSIGNED', 'ACCEPTED'] },
          shift: {
            startAt: { gte: startOfWeek },
            endAt: { lte: endOfWeek },
          },
        },
      }),
      // Total hours worked this week
      prisma.attendance.findMany({
        where: {
          workerId,
          clockInAt: { gte: startOfWeek },
          clockOutAt: { lte: endOfWeek },
        },
        select: { hoursWorked: true },
      }),
    ]);

    const weeklyHours = weeklyAttendances.reduce(
      (sum, a) => sum + (a.hoursWorked ? Number(a.hoursWorked) : 0),
      0
    );

    // Get today's shift
    const todayAssignment = await prisma.shiftAssignment.findFirst({
      where: {
        workerId,
        status: { in: ['ASSIGNED', 'ACCEPTED'] },
        shift: {
          startAt: { gte: startOfToday, lte: endOfToday },
        },
      },
      include: {
        shift: {
          select: {
            id: true,
            title: true,
            startAt: true,
            endAt: true,
            siteLocation: true,
            hourlyRate: true,
            clientCompany: { select: { name: true } },
          },
        },
      },
      orderBy: { shift: { startAt: 'asc' } },
    });

    // Check if already clocked in for today's shift
    let todayShift = null;
    if (todayAssignment) {
      const attendance = await prisma.attendance.findUnique({
        where: {
          shiftId_workerId: {
            shiftId: todayAssignment.shiftId,
            workerId,
          },
        },
        select: { clockInAt: true, clockOutAt: true },
      });

      const shiftStart = new Date(todayAssignment.shift.startAt);
      const minutesUntilStart = Math.round((shiftStart.getTime() - now.getTime()) / 60000);

      todayShift = {
        id: todayAssignment.shift.id,
        title: todayAssignment.shift.title,
        location: todayAssignment.shift.siteLocation,
        client: todayAssignment.shift.clientCompany?.name,
        startAt: todayAssignment.shift.startAt,
        endAt: todayAssignment.shift.endAt,
        hourlyRate: todayAssignment.shift.hourlyRate ? Number(todayAssignment.shift.hourlyRate) : null,
        startsIn: minutesUntilStart > 0 ? minutesUntilStart : null,
        status: attendance?.clockOutAt
          ? 'COMPLETED'
          : attendance?.clockInAt
            ? 'IN_PROGRESS'
            : 'PENDING',
        clockedIn: !!attendance?.clockInAt,
        clockedOut: !!attendance?.clockOutAt,
      };
    }

    // Get next upcoming assigned shifts (excluding today)
    const upcomingShifts = await prisma.shiftAssignment.findMany({
      where: {
        workerId,
        status: { in: ['ASSIGNED', 'ACCEPTED'] },
        shift: {
          startAt: { gt: endOfToday },
        },
      },
      include: {
        shift: {
          select: {
            id: true,
            title: true,
            startAt: true,
            endAt: true,
            siteLocation: true,
            hourlyRate: true,
            clientCompany: { select: { name: true } },
          },
        },
      },
      orderBy: { shift: { startAt: 'asc' } },
      take: 5,
    });

    // Also get broadcast shifts available to this worker
    const broadcasts = await prisma.shiftBroadcast.findMany({
      where: {
        shift: {
          organizationId: req.user!.organizationId,
          startAt: { gt: endOfToday },
        },
        status: 'OPEN',
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
      select: { shiftId: true, filters: true },
    });

    const broadcastShiftIds = broadcasts
      .filter((b) => {
        const targets: string[] = (b.filters as any)?.targetWorkerIds || [];
        return targets.includes(workerId);
      })
      .map((b) => b.shiftId);

    // Exclude shifts already assigned to this worker
    const assignedShiftIds = upcomingShifts.map((a) => a.shiftId);
    const newBroadcastIds = broadcastShiftIds.filter((id) => !assignedShiftIds.includes(id));

    let broadcastShifts: any[] = [];
    if (newBroadcastIds.length > 0) {
      broadcastShifts = await prisma.shift.findMany({
        where: { id: { in: newBroadcastIds } },
        select: {
          id: true,
          title: true,
          startAt: true,
          endAt: true,
          siteLocation: true,
          hourlyRate: true,
          clientCompany: { select: { name: true } },
        },
        orderBy: { startAt: 'asc' },
        take: 5,
      });
    }

    // Merge assigned + broadcast shifts, sorted by startAt, max 5
    const allUpcoming = [
      ...upcomingShifts.map((a) => ({
        id: a.shift.id,
        title: a.shift.title,
        location: a.shift.siteLocation,
        client: a.shift.clientCompany?.name,
        startAt: a.shift.startAt,
        endAt: a.shift.endAt,
        hourlyRate: a.shift.hourlyRate ? Number(a.shift.hourlyRate) : null,
        isBroadcast: false,
      })),
      ...broadcastShifts.map((s) => ({
        id: s.id,
        title: s.title,
        location: s.siteLocation,
        client: s.clientCompany?.name,
        startAt: s.startAt,
        endAt: s.endAt,
        hourlyRate: s.hourlyRate ? Number(s.hourlyRate) : null,
        isBroadcast: true,
      })),
    ]
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
      .slice(0, 5);

    const nextShifts = allUpcoming;

    // Get upcoming holidays (approved or pending, future start dates)
    const upcomingHolidays = await prisma.leaveRequest.findMany({
      where: {
        workerId,
        status: { in: ['APPROVED', 'PENDING'] },
        startDate: { gte: startOfToday },
      },
      select: {
        id: true,
        title: true,
        startDate: true,
        endDate: true,
        totalDays: true,
        leaveType: true,
        status: true,
      },
      orderBy: { startDate: 'asc' },
      take: 3,
    });

    const holidays = upcomingHolidays.map(h => ({
      id: h.id,
      title: h.title,
      startDate: h.startDate,
      endDate: h.endDate,
      totalDays: h.totalDays,
      leaveType: h.leaveType,
      status: h.status.toLowerCase(),
    }));

    // Determine greeting based on time
    const hour = now.getHours();
    let greeting = 'Good morning';
    if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
    else if (hour >= 17) greeting = 'Good evening';

    res.json({
      success: true,
      data: {
        greeting,
        worker: {
          id: worker.id,
          name: worker.fullName,
          firstName: worker.fullName.split(' ')[0],
        },
        weeklyStats: {
          shifts: weeklyShifts,
          holidayBalance: worker.workerProfile?.holidayBalance ? Number(worker.workerProfile.holidayBalance) : 0,
          hoursWorked: Math.round(weeklyHours * 10) / 10,
        },
        todayShift,
        nextShifts,
        upcomingHolidays: holidays,
      },
    });
  };

  /**
   * Get worker's scheduled (assigned) shifts
   * GET /api/workers/my-schedule
   * Query: from, to (ISO date strings)
   */
  getMySchedule = async (req: AuthRequest, res: Response) => {
    const workerId = req.user!.id;
    const { from, to } = req.query;

    const dateFilter: any = {};
    if (from) dateFilter.gte = new Date(from as string);
    if (to) dateFilter.lte = new Date(to as string);

    const assignments = await prisma.shiftAssignment.findMany({
      where: {
        workerId,
        status: { in: ['ASSIGNED', 'ACCEPTED'] },
        shift: {
          organizationId: req.user!.organizationId,
          ...(Object.keys(dateFilter).length > 0 && { startAt: dateFilter }),
        },
      },
      include: {
        shift: {
          select: {
            id: true,
            title: true,
            siteLocation: true,
            startAt: true,
            endAt: true,
            payRate: true,
            status: true,
            clientCompany: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { shift: { startAt: 'asc' } },
    });

    const shifts = assignments.map((a) => ({
      id: a.shift.id,
      title: a.shift.title,
      siteLocation: a.shift.siteLocation,
      startAt: a.shift.startAt,
      endAt: a.shift.endAt,
      payRate: a.shift.payRate ? Number(a.shift.payRate) : null,
      status: a.shift.status,
      clientCompany: a.shift.clientCompany,
    }));

    res.json({ success: true, data: shifts });
  };

  /**
   * Export workers list as PDF or Excel
   * GET /api/workers/export
   * Query params: format (pdf|excel), status, rtwStatus, search, skillId
   */
  export = async (req: AuthRequest, res: Response) => {
    const { format = 'excel', status, rtwStatus, search, skillId } = req.query;

    // Validate format
    if (format !== 'pdf' && format !== 'excel') {
      throw new AppError('Invalid format. Use "pdf" or "excel"', 400);
    }

    // Build filter
    const where: any = {
      organizationId: req.user!.organizationId,
      role: 'WORKER',
    };

    if (status) {
      where.status = status as string;
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (rtwStatus) {
      where.workerProfile = { rtwStatus: rtwStatus as string };
    }

    if (skillId) {
      where.workerSkills = { some: { skillId: skillId as string } };
    }

    // Fetch workers with required relations
    const workers = await prisma.user.findMany({
      where,
      include: {
        workerProfile: true,
        workerSkills: { include: { skill: true } },
        reliabilityScore: true,
      },
      orderBy: { fullName: 'asc' },
    });

    // Get organization name
    const organization = await prisma.organization.findUnique({
      where: { id: req.user!.organizationId },
      select: { name: true },
    });

    const orgName = organization?.name || 'StaffSync';

    if (format === 'excel') {
      await ExportService.exportWorkersToExcel(res, workers, orgName);
    } else {
      await ExportService.exportWorkersToPDF(res, workers, orgName);
    }
  };

  // Worker self-service RTW management
  getMyRTW = async (req: AuthRequest, res: Response) => {
    const profile = await prisma.workerProfile.findUnique({
      where: { userId: req.user!.id },
      select: {
        rtwStatus: true,
        rtwShareCode: true,
        rtwCheckedAt: true,
        rtwExpiresAt: true,
        rtwAuditNote: true,
      },
    });

    res.json({ success: true, data: profile || { rtwStatus: 'NOT_STARTED' } });
  };

  submitMyRTW = async (req: AuthRequest, res: Response) => {
    const { shareCode, dateOfBirth } = req.body;
    const workerId = req.user!.id;

    if (!shareCode) {
      throw new AppError('Share code is required', 400);
    }

    // Validate share code format
    const codeValidation = rtwService.validateShareCode(shareCode);
    if (!codeValidation.valid) {
      throw new AppError(codeValidation.error || 'Invalid share code', 400);
    }

    // Set status to pending while verifying
    await prisma.workerProfile.upsert({
      where: { userId: workerId },
      update: {
        rtwStatus: 'PENDING',
        rtwShareCode: codeValidation.normalized,
      },
      create: {
        userId: workerId,
        rtwStatus: 'PENDING',
        rtwShareCode: codeValidation.normalized,
        address: '',
        postcode: '',
        dateOfBirth: dateOfBirth ? parseDDMMYYYY(dateOfBirth) : new Date('1970-01-01'),
      },
    });

    // Call RTW verification service
    const result = await rtwService.verify({
      shareCode: codeValidation.normalized,
      dateOfBirth,
    });

    let rtwStatus: 'NOT_STARTED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
    if (result.verified && result.status === 'VALID') {
      rtwStatus = 'APPROVED';
    } else if (result.status === 'EXPIRED') {
      rtwStatus = 'EXPIRED';
    } else {
      rtwStatus = 'REJECTED';
    }

    const profile = await prisma.workerProfile.update({
      where: { userId: workerId },
      data: {
        rtwStatus,
        rtwShareCode: codeValidation.normalized,
        rtwCheckedAt: result.checkDate,
        rtwCheckedBy: workerId, // Self-service: store worker's own ID
        rtwExpiresAt: result.expiryDate,
        rtwAuditNote: result.verified
          ? `Verified: ${result.workRestriction || 'UNLIMITED'} - ${result.nationality || 'N/A'}`
          : result.errorMessage,
      },
    });

    res.json({
      success: true,
      data: {
        rtwStatus: profile.rtwStatus,
        rtwShareCode: profile.rtwShareCode,
        rtwCheckedAt: profile.rtwCheckedAt,
        rtwExpiresAt: profile.rtwExpiresAt,
        rtwAuditNote: profile.rtwAuditNote,
        verificationResult: {
          verified: result.verified,
          status: result.status,
          workRestriction: result.workRestriction,
          expiryDate: result.expiryDate,
          errorMessage: result.errorMessage,
        },
      },
    });
  };

  // Worker self-service skill management
  getMySkills = async (req: AuthRequest, res: Response) => {
    const skills = await prisma.workerSkill.findMany({
      where: { workerId: req.user!.id },
      include: { skill: true },
    });

    res.json({ success: true, data: skills });
  };

  addMySkill = async (req: AuthRequest, res: Response) => {
    const { skillId } = req.body;
    if (!skillId) throw new AppError('skillId is required', 400);

    const existing = await prisma.workerSkill.findFirst({
      where: { workerId: req.user!.id, skillId },
    });
    if (existing) {
      res.json({ success: true, message: 'Skill already added', data: existing });
      return;
    }

    const workerSkill = await prisma.workerSkill.create({
      data: { workerId: req.user!.id, skillId },
      include: { skill: true },
    });

    res.status(201).json({ success: true, data: workerSkill });
  };

  removeMySkill = async (req: AuthRequest, res: Response) => {
    const { skillId } = req.params;

    await prisma.workerSkill.deleteMany({
      where: { workerId: req.user!.id, skillId },
    });

    res.json({ success: true, message: 'Skill removed' });
  };

  // Worker self-service document management
  getMyDocuments = async (req: AuthRequest, res: Response) => {
    const documents = await prisma.workerDocument.findMany({
      where: { workerId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      include: {
        verifier: { select: { fullName: true } },
      },
    });

    res.json({ success: true, data: documents });
  };

  uploadMyDocument = async (req: AuthRequest, res: Response) => {
    const { type, title, documentNumber, issuedAt, expiresAt } = req.body;

    if (!type || !title) {
      throw new AppError('Document type and title are required', 400);
    }

    const document = await prisma.workerDocument.create({
      data: {
        workerId: req.user!.id,
        type,
        title,
        documentNumber,
        issuedAt: issuedAt ? new Date(issuedAt) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        status: 'PENDING',
      },
    });

    res.status(201).json({ success: true, data: document });
  };

  deleteMyDocument = async (req: AuthRequest, res: Response) => {
    const { docId } = req.params;

    // Verify document belongs to the worker
    const document = await prisma.workerDocument.findFirst({
      where: { id: docId, workerId: req.user!.id },
    });

    if (!document) {
      throw new NotFoundError('Document');
    }

    // Can't delete verified documents
    if (document.verified) {
      throw new AppError('Cannot delete verified documents', 400);
    }

    await prisma.workerDocument.delete({ where: { id: docId } });

    res.json({ success: true, message: 'Document deleted' });
  };
}
