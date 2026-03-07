import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AppError, NotFoundError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthRequest } from '../middleware/auth';
import { config } from '../config';
import { NotificationService } from '../services/notifications';
import { z } from 'zod';
import { LeaveStatus } from '@prisma/client';

// UK statutory holiday entitlement from config
const { statutoryWeeks, defaultContractedHours, workingDaysPerWeek, hoursPerShift, yearStartMonth } = config.leave;

/**
 * Get UK leave year (April-March)
 * If current date is Jan-Mar, leave year started previous calendar year
 * If current date is Apr-Dec, leave year started current calendar year
 * Returns the year when the leave year started (e.g., 2026 for Apr 2026 - Mar 2027)
 */
function getLeaveYear(date: Date = new Date()): number {
  const month = date.getMonth() + 1; // getMonth() is 0-indexed
  const year = date.getFullYear();
  
  // If before April, we're in the previous leave year
  if (month < yearStartMonth) {
    return year - 1;
  }
  return year;
}

const createLeaveRequestSchema = z.object({
  leaveType: z.enum(['ANNUAL', 'SICK', 'UNPAID', 'COMPASSIONATE', 'MATERNITY', 'PATERNITY', 'OTHER']),
  title: z.string().min(2).max(255),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().optional(),
});

const reviewLeaveSchema = z.object({
  status: z.enum(['APPROVED', 'DENIED']),
  reviewNote: z.string().optional(),
});

/**
 * Calculate UK statutory holiday entitlement in hours
 * Formula: contracted weekly hours × 5.6 weeks
 */
function calculateStatutoryEntitlement(contractedHoursPerWeek: number): number {
  return contractedHoursPerWeek * statutoryWeeks;
}

/**
 * Calculate business days between two dates (excludes weekends)
 */
function calculateLeaveDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);
  
  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}

/**
 * Calculate leave hours based on standard shift (8 hours)
 * 1 day of holiday = 8 hours (standard shift)
 */
function calculateLeaveHours(days: number): number {
  return days * hoursPerShift;
}

export class HolidayController {
  /**
   * Get holiday summary and list for worker
   * GET /api/holidays
   */
  getHolidays = async (req: AuthRequest, res: Response) => {
    const workerId = req.user!.id;
    const currentYear = getLeaveYear();

    // Get or create leave entitlement for current year
    let entitlement = await prisma.leaveEntitlement.findUnique({
      where: {
        workerId_year: {
          workerId,
          year: currentYear,
        },
      },
    });

    if (!entitlement) {
      // Create entitlement based on UK statutory: 5.6 weeks × contracted hours
      const totalHours = calculateStatutoryEntitlement(defaultContractedHours);
      entitlement = await prisma.leaveEntitlement.create({
        data: {
          workerId,
          year: currentYear,
          contractedHours: defaultContractedHours,
          totalHours,
          usedHours: 0,
          carryOverHours: 0,
        },
      });
    }

    // Get all leave requests for this worker
    const leaveRequests = await prisma.leaveRequest.findMany({
      where: { workerId },
      include: {
        reviewer: {
          select: { id: true, fullName: true },
        },
        logs: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    // Separate upcoming (approved, future dates) from requests
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingHolidays = leaveRequests.filter(
      (lr) => lr.status === 'APPROVED' && new Date(lr.startDate) >= today
    );

    const holidayRequests = leaveRequests;

    // Calculate totals (in hours)
    const contractedHours = Number(entitlement.contractedHours);
    const totalHours = Number(entitlement.totalHours) + Number(entitlement.carryOverHours);
    const usedHours = Number(entitlement.usedHours);
    const remainingHours = totalHours - usedHours;
    
    // Convert to days for display (based on standard 8-hour shift)
    const totalDays = Math.round((totalHours / hoursPerShift) * 10) / 10;
    const usedDays = Math.round((usedHours / hoursPerShift) * 10) / 10;
    const daysLeft = Math.round((remainingHours / hoursPerShift) * 10) / 10;

    ApiResponse.success(res, 'Holidays retrieved', {
      summary: {
        // Hours (actual entitlement)
        contractedHoursPerWeek: contractedHours,
        totalHours: Math.round(totalHours * 100) / 100,
        usedHours: Math.round(usedHours * 100) / 100,
        remainingHours: Math.round(remainingHours * 100) / 100,
        // Days (for display convenience)
        totalDays,
        usedDays,
        daysLeft,
      },
      upcomingHolidays: upcomingHolidays.map((h) => ({
        id: h.id,
        title: h.title,
        startDate: h.startDate,
        endDate: h.endDate,
        totalDays: h.totalDays,
        totalHours: Number(h.totalHours),
        leaveType: h.leaveType,
        status: h.status,
      })),
      holidayRequests: holidayRequests.map((h) => ({
        id: h.id,
        title: h.title,
        startDate: h.startDate,
        endDate: h.endDate,
        totalDays: h.totalDays,
        totalHours: Number(h.totalHours),
        leaveType: h.leaveType,
        status: h.status,
        reason: h.reason,
        reviewedBy: h.reviewer?.fullName,
        reviewedAt: h.reviewedAt,
        createdAt: h.createdAt,
      })),
    });
  };

  /**
   * Get single holiday request detail
   * GET /api/holidays/:id
   */
  getHolidayDetail = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    const leaveRequest = await prisma.leaveRequest.findFirst({
      where: {
        id,
        ...(userRole === 'WORKER' ? { workerId: userId } : {}),
      },
      include: {
        worker: {
          select: { id: true, fullName: true },
        },
        reviewer: {
          select: { id: true, fullName: true },
        },
        logs: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!leaveRequest) throw new NotFoundError('Leave request');

    // Get performer names for logs
    const performerIds = leaveRequest.logs.map((l) => l.performedBy);
    const performers = await prisma.user.findMany({
      where: { id: { in: performerIds } },
      select: { id: true, fullName: true },
    });
    const performerMap = new Map(performers.map((p) => [p.id, p.fullName]));

    ApiResponse.success(res, 'Holiday detail retrieved', {
      id: leaveRequest.id,
      title: leaveRequest.title,
      startDate: leaveRequest.startDate,
      endDate: leaveRequest.endDate,
      totalDays: leaveRequest.totalDays,
      leaveType: leaveRequest.leaveType,
      status: leaveRequest.status,
      reason: leaveRequest.reason,
      worker: leaveRequest.worker,
      reviewedBy: leaveRequest.reviewer,
      reviewedAt: leaveRequest.reviewedAt,
      reviewNote: leaveRequest.reviewNote,
      createdAt: leaveRequest.createdAt,
      logs: leaveRequest.logs.map((log) => ({
        id: log.id,
        action: log.action,
        performedBy: performerMap.get(log.performedBy) || 'Unknown',
        performedById: log.performedBy,
        note: log.note,
        createdAt: log.createdAt,
      })),
    });
  };

  /**
   * Create leave request (worker)
   * POST /api/holidays
   */
  createLeaveRequest = async (req: AuthRequest, res: Response) => {
    const workerId = req.user!.id;
    const data = createLeaveRequestSchema.parse(req.body);

    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    if (endDate < startDate) {
      throw new AppError('End date must be after start date', 400);
    }

    const totalDays = calculateLeaveDays(startDate, endDate);

    // Get worker's entitlement to calculate hours
    const currentYear = getLeaveYear();
    let entitlement = await prisma.leaveEntitlement.findUnique({
      where: {
        workerId_year: {
          workerId,
          year: currentYear,
        },
      },
    });

    // Create default entitlement if not exists
    if (!entitlement) {
      const totalHours = calculateStatutoryEntitlement(defaultContractedHours);
      entitlement = await prisma.leaveEntitlement.create({
        data: {
          workerId,
          year: currentYear,
          contractedHours: defaultContractedHours,
          totalHours,
          usedHours: 0,
          carryOverHours: 0,
        },
      });
    }

    // Calculate hours based on standard 8-hour shift
    const totalHours = calculateLeaveHours(totalDays);

    // Check if worker has enough hours (for annual leave)
    if (data.leaveType === 'ANNUAL') {
      const availableHours = Number(entitlement.totalHours) + Number(entitlement.carryOverHours) - Number(entitlement.usedHours);
      const availableDays = Math.round((availableHours / hoursPerShift) * 10) / 10;

      if (totalHours > availableHours) {
        throw new AppError(`Insufficient leave balance. You have ${availableHours.toFixed(1)} hours (${availableDays} days) available.`, 400);
      }
    }

    // Check for overlapping requests
    const overlapping = await prisma.leaveRequest.findFirst({
      where: {
        workerId,
        status: { in: ['PENDING', 'APPROVED'] },
        OR: [
          {
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
        ],
      },
    });

    if (overlapping) {
      throw new AppError('You already have a leave request for these dates', 400);
    }

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        workerId,
        leaveType: data.leaveType,
        title: data.title,
        startDate,
        endDate,
        totalDays,
        totalHours,
        reason: data.reason,
        status: 'PENDING',
      },
    });

    // Create log entry
    await prisma.leaveRequestLog.create({
      data: {
        leaveRequestId: leaveRequest.id,
        action: 'Submitted',
        performedBy: workerId,
        note: 'Leave request submitted',
      },
    });

    // Notify staff (admin, ops manager, shift coordinator) about the leave request
    const worker = await prisma.user.findUnique({
      where: { id: workerId },
      select: { fullName: true, organizationId: true },
    });

    if (worker) {
      const staffToNotify = await prisma.user.findMany({
        where: {
          organizationId: worker.organizationId,
          role: { in: ['ADMIN', 'OPS_MANAGER', 'SHIFT_COORDINATOR'] },
          status: 'ACTIVE',
        },
        select: { id: true },
      });

      // Send notification to each staff member
      await NotificationService.sendToMultiple(
        staffToNotify.map(s => s.id),
        {
          title: 'Holiday Request',
          body: `${worker.fullName} has requested ${totalDays} day(s) leave from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`,
          type: 'LEAVE_REQUEST',
          data: { leaveRequestId: leaveRequest.id },
          channels: ['push'],
        }
      );
    }

    ApiResponse.created(res, 'Leave request submitted', {
      id: leaveRequest.id,
      title: leaveRequest.title,
      startDate: leaveRequest.startDate,
      endDate: leaveRequest.endDate,
      totalDays: leaveRequest.totalDays,
      totalHours: Number(leaveRequest.totalHours),
      status: leaveRequest.status,
    });
  };

  /**
   * Cancel leave request (worker)
   * POST /api/holidays/:id/cancel
   */
  cancelLeaveRequest = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const workerId = req.user!.id;

    const leaveRequest = await prisma.leaveRequest.findFirst({
      where: {
        id,
        workerId,
        status: { in: ['PENDING', 'APPROVED'] },
      },
    });

    if (!leaveRequest) {
      throw new NotFoundError('Leave request');
    }

    // If it was approved, restore the hours
    if (leaveRequest.status === 'APPROVED' && leaveRequest.leaveType === 'ANNUAL') {
      const currentYear = getLeaveYear();
      await prisma.leaveEntitlement.update({
        where: {
          workerId_year: {
            workerId,
            year: currentYear,
          },
        },
        data: {
          usedHours: { decrement: Number(leaveRequest.totalHours) },
        },
      });
    }

    await prisma.leaveRequest.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    await prisma.leaveRequestLog.create({
      data: {
        leaveRequestId: id,
        action: 'Cancelled',
        performedBy: workerId,
        note: 'Request cancelled by worker',
      },
    });

    ApiResponse.success(res, 'Leave request cancelled');
  };

  /**
   * Get all leave requests for organization (admin/manager)
   * GET /api/holidays/admin/requests
   */
  getAllLeaveRequests = async (req: AuthRequest, res: Response) => {
    const { status, workerId, page = '1', limit = '10' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where = {
      worker: { organizationId: req.user!.organizationId },
      ...(status ? { status: status as LeaveStatus } : {}),
      ...(workerId ? { workerId: workerId as string } : {}),
    };

    const [leaveRequests, total, pendingCount, approvedCount, deniedCount] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        include: {
          worker: {
            select: { id: true, fullName: true, email: true },
          },
          reviewer: {
            select: { id: true, fullName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.leaveRequest.count({ where }),
      prisma.leaveRequest.count({ where: { ...where, status: 'PENDING' } }),
      prisma.leaveRequest.count({ where: { ...where, status: 'APPROVED' } }),
      prisma.leaveRequest.count({ where: { ...where, status: 'DENIED' } }),
    ]);

    ApiResponse.success(res, 'Leave requests retrieved', {
      requests: leaveRequests.map((lr) => ({
        id: lr.id,
        title: lr.title,
        worker: lr.worker,
        leaveType: lr.leaveType,
        startDate: lr.startDate,
        endDate: lr.endDate,
        days: lr.totalDays,
        hours: Number(lr.totalHours),
        reason: lr.reason,
        status: lr.status,
        reviewedBy: lr.reviewer,
        reviewedAt: lr.reviewedAt,
        createdAt: lr.createdAt,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
      stats: {
        pending: pendingCount,
        approved: approvedCount,
        denied: deniedCount,
      },
    });
  };

  /**
   * Approve or deny leave request (admin/manager)
   * POST /api/holidays/:id/review
   */
  reviewLeaveRequest = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const reviewerId = req.user!.id;
    const data = reviewLeaveSchema.parse(req.body);

    const leaveRequest = await prisma.leaveRequest.findFirst({
      where: {
        id,
        worker: { organizationId: req.user!.organizationId },
        status: 'PENDING',
      },
    });

    if (!leaveRequest) {
      throw new NotFoundError('Leave request');
    }

    // If approving annual leave, check worker has sufficient hours
    if (data.status === 'APPROVED' && leaveRequest.leaveType === 'ANNUAL') {
      const currentYear = getLeaveYear();
      const totalHoursRequested = Number(leaveRequest.totalHours);
      
      const entitlement = await prisma.leaveEntitlement.findUnique({
        where: {
          workerId_year: {
            workerId: leaveRequest.workerId,
            year: currentYear,
          },
        },
      });

      const availableHours = entitlement
        ? Number(entitlement.totalHours) + Number(entitlement.carryOverHours) - Number(entitlement.usedHours)
        : calculateStatutoryEntitlement(defaultContractedHours);

      if (totalHoursRequested > availableHours) {
        const availableDays = Math.round((availableHours / hoursPerShift) * 10) / 10;
        throw new AppError(
          `Cannot approve: Worker only has ${availableHours.toFixed(1)} hours (${availableDays} days) available, but requested ${totalHoursRequested.toFixed(1)} hours.`,
          400
        );
      }
    }

    // Update the leave request
    await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: data.status,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewNote: data.reviewNote,
      },
    });

    // If approved and annual leave, deduct hours from entitlement
    if (data.status === 'APPROVED' && leaveRequest.leaveType === 'ANNUAL') {
      const currentYear = getLeaveYear();
      const totalHoursToDeduct = Number(leaveRequest.totalHours);
      
      await prisma.leaveEntitlement.upsert({
        where: {
          workerId_year: {
            workerId: leaveRequest.workerId,
            year: currentYear,
          },
        },
        create: {
          workerId: leaveRequest.workerId,
          year: currentYear,
          contractedHours: defaultContractedHours,
          totalHours: calculateStatutoryEntitlement(defaultContractedHours),
          usedHours: totalHoursToDeduct,
          carryOverHours: 0,
        },
        update: {
          usedHours: { increment: totalHoursToDeduct },
        },
      });
    }

    // Create log entry
    await prisma.leaveRequestLog.create({
      data: {
        leaveRequestId: id,
        action: data.status === 'APPROVED' ? 'Approved' : 'Denied',
        performedBy: reviewerId,
        note: data.reviewNote,
      },
    });

    // Notify worker about leave decision (push + SMS)
    const leaveDetails = await prisma.leaveRequest.findUnique({
      where: { id },
      select: { title: true, startDate: true, endDate: true },
    });

    if (leaveDetails) {
      const statusText = data.status === 'APPROVED' ? 'approved' : 'denied';
      await NotificationService.send({
        userId: leaveRequest.workerId,
        title: `Holiday ${data.status === 'APPROVED' ? 'Approved' : 'Denied'}`,
        body: `Your leave request "${leaveDetails.title}" from ${leaveDetails.startDate.toLocaleDateString()} to ${leaveDetails.endDate.toLocaleDateString()} has been ${statusText}.`,
        type: 'LEAVE_DECISION',
        data: { leaveRequestId: id, status: data.status },
        channels: ['push', 'sms'],
      });
    }

    ApiResponse.success(res, `Leave request ${data.status.toLowerCase()}`);
  };

  /**
   * Get worker's leave entitlement
   * GET /api/holidays/entitlement
   */
  getEntitlement = async (req: AuthRequest, res: Response) => {
    const workerId = req.user!.role === 'WORKER' ? req.user!.id : (req.query.workerId as string);
    const year = parseInt(req.query.year as string) || getLeaveYear();

    if (!workerId) {
      throw new AppError('Worker ID required', 400);
    }

    let entitlement = await prisma.leaveEntitlement.findUnique({
      where: {
        workerId_year: {
          workerId,
          year,
        },
      },
    });

    if (!entitlement) {
      const totalHours = calculateStatutoryEntitlement(defaultContractedHours);
      entitlement = await prisma.leaveEntitlement.create({
        data: {
          workerId,
          year,
          contractedHours: defaultContractedHours,
          totalHours,
          usedHours: 0,
          carryOverHours: 0,
        },
      });
    }

    const contractedHours = Number(entitlement.contractedHours);
    const totalHours = Number(entitlement.totalHours);
    const usedHours = Number(entitlement.usedHours);
    const carryOverHours = Number(entitlement.carryOverHours);
    const remainingHours = totalHours + carryOverHours - usedHours;
    
    ApiResponse.success(res, 'Entitlement retrieved', {
      year: entitlement.year,
      contractedHoursPerWeek: contractedHours,
      // Hours (UK statutory)
      totalHours: Math.round(totalHours * 100) / 100,
      usedHours: Math.round(usedHours * 100) / 100,
      carryOverHours: Math.round(carryOverHours * 100) / 100,
      remainingHours: Math.round(remainingHours * 100) / 100,
      // Days equivalent (based on standard 8-hour shift)
      totalDays: Math.round((totalHours / hoursPerShift) * 10) / 10,
      usedDays: Math.round((usedHours / hoursPerShift) * 10) / 10,
      remainingDays: Math.round((remainingHours / hoursPerShift) * 10) / 10,
    });
  };

  /**
   * Grant leave directly to a worker (admin/ops staff/shift coordinator)
   * POST /api/holidays/grant
   * Creates an auto-approved leave request on behalf of a worker
   */
  grantLeave = async (req: AuthRequest, res: Response) => {
    const granterId = req.user!.id;
    const data = z.object({
      workerId: z.string().uuid(),
      leaveType: z.enum(['ANNUAL', 'SICK', 'UNPAID', 'COMPASSIONATE', 'MATERNITY', 'PATERNITY', 'OTHER']),
      title: z.string().min(2).max(255),
      startDate: z.string(),
      endDate: z.string(),
      reason: z.string().optional(),
    }).parse(req.body);

    // Verify worker exists and is in same organization
    const worker = await prisma.user.findFirst({
      where: {
        id: data.workerId,
        organizationId: req.user!.organizationId,
        role: 'WORKER',
      },
    });

    if (!worker) {
      throw new NotFoundError('Worker');
    }

    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    if (endDate < startDate) {
      throw new AppError('End date must be after start date', 400);
    }

    const totalDays = calculateLeaveDays(startDate, endDate);

    // Get worker's entitlement to calculate hours
    const currentYear = getLeaveYear();
    let entitlement = await prisma.leaveEntitlement.findUnique({
      where: {
        workerId_year: {
          workerId: data.workerId,
          year: currentYear,
        },
      },
    });

    // Create default entitlement if not exists
    if (!entitlement) {
      const totalHours = calculateStatutoryEntitlement(defaultContractedHours);
      entitlement = await prisma.leaveEntitlement.create({
        data: {
          workerId: data.workerId,
          year: currentYear,
          contractedHours: defaultContractedHours,
          totalHours,
          usedHours: 0,
          carryOverHours: 0,
        },
      });
    }

    // Calculate hours based on standard 8-hour shift
    const totalHours = calculateLeaveHours(totalDays);

    // Check if worker has enough hours (for annual leave)
    if (data.leaveType === 'ANNUAL') {
      const availableHours = Number(entitlement.totalHours) + Number(entitlement.carryOverHours) - Number(entitlement.usedHours);
      
      if (totalHours > availableHours) {
        const availableDays = Math.round((availableHours / hoursPerShift) * 10) / 10;
        throw new AppError(`Insufficient leave balance. Worker has ${availableHours.toFixed(1)} hours (${availableDays} days) available.`, 400);
      }
    }

    // Check for overlapping requests
    const overlapping = await prisma.leaveRequest.findFirst({
      where: {
        workerId: data.workerId,
        status: { in: ['PENDING', 'APPROVED'] },
        OR: [
          {
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
        ],
      },
    });

    if (overlapping) {
      throw new AppError('Worker already has a leave request for these dates', 400);
    }

    // Create leave request as auto-approved
    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        workerId: data.workerId,
        leaveType: data.leaveType,
        title: data.title,
        startDate,
        endDate,
        totalDays,
        totalHours,
        reason: data.reason,
        status: 'APPROVED',
        reviewedBy: granterId,
        reviewedAt: new Date(),
        reviewNote: 'Granted by admin/staff',
      },
    });

    // Deduct hours from entitlement if annual leave
    if (data.leaveType === 'ANNUAL') {
      await prisma.leaveEntitlement.update({
        where: {
          workerId_year: {
            workerId: data.workerId,
            year: currentYear,
          },
        },
        data: {
          usedHours: { increment: totalHours },
        },
      });
    }

    // Create log entries
    await prisma.leaveRequestLog.createMany({
      data: [
        {
          leaveRequestId: leaveRequest.id,
          action: 'Granted',
          performedBy: granterId,
          note: `Leave granted by ${req.user!.role}`,
        },
        {
          leaveRequestId: leaveRequest.id,
          action: 'Approved',
          performedBy: granterId,
          note: 'Auto-approved (granted by admin/staff)',
        },
      ],
    });

    ApiResponse.created(res, 'Leave granted to worker', {
      id: leaveRequest.id,
      worker: { id: worker.id, fullName: worker.fullName },
      title: leaveRequest.title,
      startDate: leaveRequest.startDate,
      endDate: leaveRequest.endDate,
      totalDays: leaveRequest.totalDays,
      totalHours: Number(leaveRequest.totalHours),
      leaveType: leaveRequest.leaveType,
      status: leaveRequest.status,
      grantedBy: granterId,
    });
  };

  /**
   * Update worker's leave entitlement (admin)
   * PUT /api/holidays/entitlement/:workerId
   * Can update contracted hours which recalculates statutory entitlement
   */
  updateEntitlement = async (req: AuthRequest, res: Response) => {
    const { workerId } = req.params;
    const { contractedHoursPerWeek, carryOverHours } = z.object({
      contractedHoursPerWeek: z.number().min(1).max(48).optional(),
      carryOverHours: z.number().min(0).optional(),
    }).parse(req.body);

    const year = getLeaveYear();

    // Calculate new total hours based on contracted hours
    const newContractedHours = contractedHoursPerWeek ?? defaultContractedHours;
    const newTotalHours = calculateStatutoryEntitlement(newContractedHours);

    const entitlement = await prisma.leaveEntitlement.upsert({
      where: {
        workerId_year: {
          workerId,
          year,
        },
      },
      create: {
        workerId,
        year,
        contractedHours: newContractedHours,
        totalHours: newTotalHours,
        usedHours: 0,
        carryOverHours: carryOverHours ?? 0,
      },
      update: {
        ...(contractedHoursPerWeek !== undefined ? { 
          contractedHours: newContractedHours,
          totalHours: newTotalHours,
        } : {}),
        ...(carryOverHours !== undefined ? { carryOverHours } : {}),
      },
    });

    ApiResponse.success(res, 'Entitlement updated', {
      year: entitlement.year,
      contractedHoursPerWeek: Number(entitlement.contractedHours),
      totalHours: Number(entitlement.totalHours),
      usedHours: Number(entitlement.usedHours),
      carryOverHours: Number(entitlement.carryOverHours),
      remainingHours: Number(entitlement.totalHours) + Number(entitlement.carryOverHours) - Number(entitlement.usedHours),
      totalDays: Math.round((Number(entitlement.totalHours) / hoursPerShift) * 10) / 10,
    });
  };
}
