import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AppError, NotFoundError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import { NotificationService } from '../services/notifications';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const createShiftSchema = z.object({
  title: z.string().min(2).max(255),
  clientCompanyId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  siteLocation: z.string().optional(),
  siteLat: z.number().optional(),
  siteLng: z.number().optional(),
  role: z.string().optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  breakMinutes: z.number().min(0).default(0),
  payRate: z.number().positive().optional(),
  workersNeeded: z.number().min(1).default(1),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  notes: z.string().optional(),
  requiredSkillIds: z.array(z.string().uuid()).optional(),
});

export class ShiftController {
  list = async (req: AuthRequest, res: Response) => {
    const { status, from, to, clientId, locationId } = req.query;

    // For workers: only show shifts from clients their manager is assigned to
    let clientFilter: any = clientId ? { clientCompanyId: clientId as string } : {};

    if (req.user!.role === 'WORKER') {
      // Check if worker has approved RTW - they can't see shifts without it
      const workerProfile = await prisma.workerProfile.findUnique({
        where: { userId: req.user!.id },
        select: { rtwStatus: true },
      });

      if (!workerProfile || workerProfile.rtwStatus !== 'APPROVED') {
        // Worker doesn't have approved RTW - return empty list with message
        return ApiResponse.ok(res, 'RTW verification required to view shifts', [], {
          rtwRequired: true,
          rtwStatus: workerProfile?.rtwStatus || 'NOT_STARTED',
        });
      }

      // Get the worker's manager
      const worker = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { managerId: true },
      });

      if (worker?.managerId) {
        // Get clients assigned to the worker's manager
        const managerClients = await prisma.staffCompanyAssignment.findMany({
          where: {
            staffId: worker.managerId,
            status: 'ACTIVE',
          },
          select: { clientCompanyId: true },
        });

        const allowedClientIds = managerClients.map(c => c.clientCompanyId);

        // Filter shifts to only those from manager's clients
        clientFilter = {
          clientCompanyId: { in: allowedClientIds },
        };
      } else {
        // Worker has no manager - show no client shifts
        clientFilter = { clientCompanyId: null };
      }
    }

    const shifts = await prisma.shift.findMany({
      where: {
        organizationId: req.user!.organizationId,
        ...(status && { status: status as any }),
        ...clientFilter,
        ...(locationId && { locationId: locationId as string }),
        ...(from && { startAt: { gte: new Date(from as string) } }),
        ...(to && { endAt: { lte: new Date(to as string) } }),
      },
      include: {
        clientCompany: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
        assignments: {
          include: { worker: { select: { id: true, fullName: true } } },
        },
        requiredSkills: { include: { skill: true } },
        _count: { select: { assignments: true, attendances: true } },
      },
      orderBy: { startAt: 'asc' },
    });

    ApiResponse.ok(res, 'Shifts retrieved', shifts);
  };

  getById = async (req: AuthRequest, res: Response) => {
    const shift = await prisma.shift.findFirst({
      where: {
        id: req.params.shiftId,
        organizationId: req.user!.organizationId,
      },
      include: {
        clientCompany: true,
        location: true,
        assignments: {
          include: { worker: { select: { id: true, fullName: true, email: true } } },
        },
        attendances: {
          include: { worker: { select: { id: true, fullName: true } } },
        },
        requiredSkills: { include: { skill: true } },
        broadcasts: true,
      },
    });

    if (!shift) throw new NotFoundError('Shift');

    // Workers can only view shifts from their manager's clients
    if (req.user!.role === 'WORKER' && shift.clientCompanyId) {
      const worker = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { managerId: true },
      });

      if (worker?.managerId) {
        const managerHasClient = await prisma.staffCompanyAssignment.findFirst({
          where: {
            staffId: worker.managerId,
            clientCompanyId: shift.clientCompanyId,
            status: 'ACTIVE',
          },
        });

        if (!managerHasClient) {
          throw new AppError('You do not have access to this shift', 403, 'ACCESS_DENIED');
        }
      } else {
        throw new AppError('You do not have access to this shift', 403, 'ACCESS_DENIED');
      }
    }

    ApiResponse.ok(res, 'Shift retrieved', shift);
  };

  create = async (req: AuthRequest, res: Response) => {
    const data = createShiftSchema.parse(req.body);
    const { requiredSkillIds, ...shiftData } = data;

    const { clientCompanyId } = shiftData;
    const isAdminOrOps = ['ADMIN', 'OPS_MANAGER', 'SHIFT_COORDINATOR'].includes(req.user!.role);

    // If clientCompanyId provided, validate access
    if (clientCompanyId) {
      // Admins and Ops Managers can create shifts for any client
      if (!isAdminOrOps) {
        // Regular managers must be assigned to the client
        const managerAssignment = await prisma.staffCompanyAssignment.findFirst({
          where: {
            staffId: req.user!.id,
            clientCompanyId,
            status: 'ACTIVE',
          },
        });

        if (!managerAssignment) {
          throw new AppError('You are not assigned to this client', 403, 'CLIENT_NOT_ASSIGNED');
        }
      }
    }
    // If no clientCompanyId, it's an internal organization shift

    const shift = await prisma.shift.create({
      data: {
        ...shiftData,
        clientCompanyId,
        startAt: new Date(shiftData.startAt),
        endAt: new Date(shiftData.endAt),
        organizationId: req.user!.organizationId,
        createdBy: req.user!.id,
        requiredSkills: requiredSkillIds ? {
          create: requiredSkillIds.map((skillId) => ({ skillId })),
        } : undefined,
      },
      include: { 
        requiredSkills: { include: { skill: true } },
        clientCompany: { select: { id: true, name: true } },
      },
    });

    ApiResponse.created(res, 'Shift created', shift);
  };

  update = async (req: AuthRequest, res: Response) => {
    const data = createShiftSchema.partial().parse(req.body);

    const shift = await prisma.shift.updateMany({
      where: {
        id: req.params.shiftId,
        organizationId: req.user!.organizationId,
      },
      data: {
        ...data,
        ...(data.startAt && { startAt: new Date(data.startAt) }),
        ...(data.endAt && { endAt: new Date(data.endAt) }),
      },
    });

    if (shift.count === 0) throw new NotFoundError('Shift');

    ApiResponse.ok(res, 'Shift updated');
  };

  delete = async (req: AuthRequest, res: Response) => {
    const result = await prisma.shift.deleteMany({
      where: {
        id: req.params.shiftId,
        organizationId: req.user!.organizationId,
        status: 'OPEN',
      },
    });

    if (result.count === 0) {
      throw new AppError('Shift not found or cannot be deleted', 400, 'CANNOT_DELETE');
    }

    ApiResponse.ok(res, 'Shift deleted');
  };

  // Assignments
  getAssignments = async (req: AuthRequest, res: Response) => {
    const assignments = await prisma.shiftAssignment.findMany({
      where: { shiftId: req.params.shiftId },
      include: { worker: { select: { id: true, fullName: true, email: true } } },
    });

    ApiResponse.ok(res, 'Assignments retrieved', assignments);
  };

  assignWorker = async (req: AuthRequest, res: Response) => {
    const { workerIds } = req.body as { workerIds: string[] };

    if (!workerIds || !Array.isArray(workerIds) || workerIds.length === 0) {
      throw new AppError('workerIds array is required', 400, 'INVALID_INPUT');
    }

    const isAdminOrOps = ['ADMIN', 'OPS_MANAGER', 'SHIFT_COORDINATOR'].includes(req.user!.role);

    // Validate workers are managed by current user (unless admin/ops)
    if (!isAdminOrOps) {
      const managedWorkers = await prisma.user.findMany({
        where: {
          id: { in: workerIds },
          managerId: req.user!.id,
          role: 'WORKER',
          status: 'ACTIVE',
        },
        select: { id: true },
      });

      const managedIds = managedWorkers.map(w => w.id);
      const invalidIds = workerIds.filter(id => !managedIds.includes(id));

      if (invalidIds.length > 0) {
        throw new AppError('Some workers are not assigned to you', 403, 'WORKERS_NOT_MANAGED');
      }
    }

    // Get shift details for notification
    const shift = await prisma.shift.findUnique({
      where: { id: req.params.shiftId },
      select: {
        id: true,
        title: true,
        startAt: true,
        endAt: true,
        siteLocation: true,
        clientCompany: { select: { name: true } },
      },
    });

    if (!shift) throw new NotFoundError('Shift');

    // Create assignments for all workers
    const assignments = await prisma.shiftAssignment.createMany({
      data: workerIds.map(workerId => ({
        shiftId: req.params.shiftId,
        workerId,
      })),
      skipDuplicates: true,
    });

    // Send push and SMS notifications to assigned workers
    const shiftDate = new Date(shift.startAt).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    const shiftTime = new Date(shift.startAt).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });

    await NotificationService.sendToMultiple(workerIds, {
      title: 'New Shift Assigned',
      body: `You've been assigned to ${shift.title} on ${shiftDate} at ${shiftTime}${shift.clientCompany ? ` - ${shift.clientCompany.name}` : ''}`,
      type: 'SHIFT_ASSIGNED',
      preferenceType: 'NEW_SHIFT_ALERTS',
      channels: ['push', 'sms'],
      categoryId: 'shift_action',
      data: {
        shiftId: shift.id,
        startAt: shift.startAt.toISOString(),
        action: 'VIEW_SHIFT',
      },
    });

    ApiResponse.created(res, `${assignments.count} worker(s) assigned and notified`, { count: assignments.count });
  };

  removeAssignment = async (req: AuthRequest, res: Response) => {
    await prisma.shiftAssignment.delete({
      where: { id: req.params.assignmentId },
    });

    ApiResponse.ok(res, 'Assignment removed');
  };

  // Shift History
  /**
   * Get past shifts for the current worker
   * GET /api/shifts/my-history
   */
  getMyShiftHistory = async (req: AuthRequest, res: Response) => {
    const { limit = '20', offset = '0', startDate, endDate } = req.query;
    const workerId = req.user!.id;

    const dateFilter: any = { endAt: { lt: new Date() } };
    if (startDate) dateFilter.startAt = { gte: new Date(startDate as string) };
    if (endDate) dateFilter.endAt = { ...dateFilter.endAt, lte: new Date(endDate as string) };

    const [assignments, total] = await Promise.all([
      prisma.shiftAssignment.findMany({
        where: {
          workerId,
          shift: {
            organizationId: req.user!.organizationId,
            ...dateFilter,
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
              clientCompany: { select: { id: true, name: true } },
              location: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { shift: { startAt: 'desc' } },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.shiftAssignment.count({
        where: {
          workerId,
          shift: {
            organizationId: req.user!.organizationId,
            ...dateFilter,
          },
        },
      }),
    ]);

    // Get attendance records for these shifts
    const shiftIds = assignments.map(a => a.shiftId);
    const attendances = await prisma.attendance.findMany({
      where: { workerId, shiftId: { in: shiftIds } },
    });

    const history = assignments.map(assignment => {
      const attendance = attendances.find(a => a.shiftId === assignment.shiftId);
      return {
        ...assignment.shift,
        assignmentStatus: assignment.status,
        clockInAt: attendance?.clockInAt || null,
        clockOutAt: attendance?.clockOutAt || null,
        hoursWorked: attendance?.hoursWorked ? Number(attendance.hoursWorked) : null,
        attendanceStatus: attendance?.status || null,
      };
    });

    ApiResponse.ok(res, 'Shift history', { data: history, total });
  };

  /**
   * Get past shifts for manager's staff
   * GET /api/shifts/staff-history
   */
  getStaffShiftHistory = async (req: AuthRequest, res: Response) => {
    const { limit = '50', offset = '0', startDate, endDate, workerId } = req.query;
    const isAdminOrOps = ['ADMIN', 'OPS_MANAGER', 'SHIFT_COORDINATOR'].includes(req.user!.role);

    // Date filter for past shifts
    const dateFilter: any = { endAt: { lt: new Date() } };
    if (startDate) dateFilter.startAt = { gte: new Date(startDate as string) };
    if (endDate) dateFilter.endAt = { ...dateFilter.endAt, lte: new Date(endDate as string) };

    // Worker filter based on role
    let workerFilter: any = {};
    if (workerId) {
      workerFilter = { workerId: workerId as string };
    } else if (!isAdminOrOps) {
      // Regular managers only see their managed workers
      const managedWorkers = await prisma.user.findMany({
        where: { managerId: req.user!.id, role: 'WORKER' },
        select: { id: true },
      });
      workerFilter = { workerId: { in: managedWorkers.map(w => w.id) } };
    }

    const [shifts, total] = await Promise.all([
      prisma.shift.findMany({
        where: {
          organizationId: req.user!.organizationId,
          ...dateFilter,
          assignments: { some: workerFilter },
        },
        include: {
          clientCompany: { select: { id: true, name: true } },
          location: { select: { id: true, name: true } },
          assignments: {
            where: workerFilter,
            include: {
              worker: { select: { id: true, fullName: true, email: true } },
            },
          },
          attendances: {
            where: workerFilter,
            select: {
              workerId: true,
              clockInAt: true,
              clockOutAt: true,
              hoursWorked: true,
              status: true,
            },
          },
        },
        orderBy: { startAt: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.shift.count({
        where: {
          organizationId: req.user!.organizationId,
          ...dateFilter,
          assignments: { some: workerFilter },
        },
      }),
    ]);

    // Format response with worker attendance data
    const history = shifts.map(shift => ({
      id: shift.id,
      title: shift.title,
      startAt: shift.startAt,
      endAt: shift.endAt,
      siteLocation: shift.siteLocation,
      hourlyRate: shift.hourlyRate ? Number(shift.hourlyRate) : null,
      client: shift.clientCompany?.name,
      location: shift.location?.name,
      workers: shift.assignments.map(assignment => {
        const attendance = shift.attendances.find(a => a.workerId === assignment.workerId);
        return {
          id: assignment.worker.id,
          name: assignment.worker.fullName,
          email: assignment.worker.email,
          assignmentStatus: assignment.status,
          clockInAt: attendance?.clockInAt || null,
          clockOutAt: attendance?.clockOutAt || null,
          hoursWorked: attendance?.hoursWorked ? Number(attendance.hoursWorked) : null,
          attendanceStatus: attendance?.status || null,
        };
      }),
      totalWorkers: shift.assignments.length,
      totalHours: shift.attendances.reduce((sum, a) => sum + (a.hoursWorked ? Number(a.hoursWorked) : 0), 0),
    }));

    ApiResponse.ok(res, 'Staff shift history', { data: history, total });
  };

  // Worker actions
  acceptShift = async (req: AuthRequest, res: Response) => {
    const assignment = await prisma.shiftAssignment.updateMany({
      where: {
        shiftId: req.params.shiftId,
        workerId: req.user!.id,
        status: 'ASSIGNED',
      },
      data: { status: 'ACCEPTED', acceptedAt: new Date() },
    });

    if (assignment.count === 0) {
      throw new AppError('Assignment not found or already processed', 400, 'INVALID_ACTION');
    }

    ApiResponse.ok(res, 'Shift accepted');
  };

  declineShift = async (req: AuthRequest, res: Response) => {
    const workerId = req.user!.id;
    const shiftId = req.params.shiftId;

    const assignment = await prisma.shiftAssignment.updateMany({
      where: {
        shiftId,
        workerId,
        status: 'ASSIGNED',
      },
      data: { status: 'DECLINED', declinedAt: new Date() },
    });

    if (assignment.count === 0) {
      throw new AppError('Assignment not found or already processed', 400, 'INVALID_ACTION');
    }

    // Notify staff about shift decline
    const [worker, shift] = await Promise.all([
      prisma.user.findUnique({
        where: { id: workerId },
        select: { fullName: true, organizationId: true },
      }),
      prisma.shift.findUnique({
        where: { id: shiftId },
        select: { title: true, startAt: true },
      }),
    ]);

    if (worker && shift) {
      const staffToNotify = await prisma.user.findMany({
        where: {
          organizationId: worker.organizationId,
          role: { in: ['ADMIN', 'OPS_MANAGER', 'SHIFT_COORDINATOR'] },
          status: 'ACTIVE',
        },
        select: { id: true },
      });

      await NotificationService.sendToMultiple(
        staffToNotify.map(s => s.id),
        {
          title: 'Shift Declined',
          body: `${worker.fullName} has declined shift "${shift.title}" on ${shift.startAt.toLocaleDateString()}`,
          type: 'SHIFT_DECLINED',
          preferenceType: 'NEW_SHIFT_ALERTS',
          data: { shiftId },
          channels: ['push'],
        }
      );
    }

    ApiResponse.ok(res, 'Shift declined');
  };

  // Broadcast
  broadcast = async (req: AuthRequest, res: Response) => {
    const { broadcastType, radiusKm, filters, expiresAt } = req.body;
    const userRole = req.user!.role;

    // Admin, OPS, SHIFT_COORDINATOR can broadcast to all workers
    // Managers can only broadcast to workers assigned to them
    const canBroadcastToAll = ['ADMIN', 'OPS_MANAGER'].includes(userRole);

    const targetWorkers = await prisma.user.findMany({
      where: {
        organizationId: req.user!.organizationId,
        role: 'WORKER',
        status: 'ACTIVE',
        ...(canBroadcastToAll ? {} : { managerId: req.user!.id }),
      },
      select: { id: true, fullName: true },
    });

    // Get shift details for notification
    const shift = await prisma.shift.findUnique({
      where: { id: req.params.shiftId },
      select: {
        id: true,
        title: true,
        startAt: true,
        clientCompany: { select: { name: true } },
      },
    });

    if (!shift) throw new NotFoundError('Shift');

    const broadcast = await prisma.shiftBroadcast.create({
      data: {
        shiftId: req.params.shiftId,
        broadcastType: broadcastType || 'STANDARD',
        radiusKm,
        filters: {
          ...((filters as object) || {}),
          targetWorkerIds: targetWorkers.map(w => w.id),
        },
        sentToCount: targetWorkers.length,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        createdBy: req.user!.id,
      },
    });

    // Notify workers about available shift
    const shiftDate = new Date(shift.startAt).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });

    await NotificationService.sendToMultiple(
      targetWorkers.map(w => w.id),
      {
        title: 'New Shift Available',
        body: `A new shift "${shift.title}" is available on ${shiftDate}${shift.clientCompany ? ` - ${shift.clientCompany.name}` : ''}`,
        type: 'SHIFT_AVAILABLE',
        preferenceType: 'NEW_SHIFT_ALERTS',
        channels: ['push'],
        categoryId: 'shift_action',
        data: {
          shiftId: shift.id,
          broadcastId: broadcast.id,
          action: 'VIEW_SHIFT',
        },
      }
    );

    ApiResponse.created(res, 'Shift broadcast sent', { broadcast, notifiedWorkers: targetWorkers.length });
  };

  // Cancel
  cancel = async (req: AuthRequest, res: Response) => {
    const shiftId = req.params.shiftId;

    // Get shift details and assigned workers before cancelling
    const shift = await prisma.shift.findFirst({
      where: {
        id: shiftId,
        organizationId: req.user!.organizationId,
        status: { in: ['OPEN', 'FILLED'] },
      },
      select: {
        id: true,
        title: true,
        startAt: true,
        assignments: {
          where: { status: { in: ['ASSIGNED', 'ACCEPTED'] } },
          select: { workerId: true },
        },
      },
    });

    if (!shift) {
      throw new AppError('Shift not found or cannot be cancelled', 400, 'CANNOT_CANCEL');
    }

    await prisma.shift.update({
      where: { id: shiftId },
      data: { status: 'CANCELLED' },
    });

    // Notify assigned workers about cancellation
    const assignedWorkerIds = shift.assignments.map((a: { workerId: string }) => a.workerId);
    if (assignedWorkerIds.length > 0) {
      const shiftDate = new Date(shift.startAt).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });

      await NotificationService.sendToMultiple(assignedWorkerIds, {
        title: 'Shift Cancelled',
        body: `The shift "${shift.title}" on ${shiftDate} has been cancelled.`,
        type: 'SHIFT_CANCELLED',
        preferenceType: 'NEW_SHIFT_ALERTS',
        channels: ['push', 'sms'],
        data: {
          shiftId: shift.id,
          action: 'SHIFT_CANCELLED',
        },
      });
    }

    ApiResponse.ok(res, 'Shift cancelled');
  };
}
