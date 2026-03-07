import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { AppError, NotFoundError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import { config } from '../config';
import * as XLSX from 'xlsx';

/**
 * Calculate distance between two coordinates using Haversine formula
 * @returns distance in meters
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const clockInSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().optional(),
  deviceInfo: z.string().max(255).optional(),
});

const clockOutSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export class AttendanceController {
  /**
   * Clock in to a shift
   * POST /api/attendance/:shiftId/clock-in
   */
  clockIn = async (req: AuthRequest, res: Response) => {
    const { shiftId } = req.params;
    const workerId = req.user!.id;
    const data = clockInSchema.parse(req.body);

    // Get shift with location info
    const shift = await prisma.shift.findFirst({
      where: {
        id: shiftId,
        organizationId: req.user!.organizationId,
      },
      include: {
        location: true,
        clientCompany: true,
        assignments: {
          where: { workerId },
        },
      },
    });

    if (!shift) {
      throw new NotFoundError('Shift');
    }

    // Verify worker is assigned to this shift
    if (shift.assignments.length === 0) {
      throw new AppError('You are not assigned to this shift', 403, 'NOT_ASSIGNED');
    }

    // Check if already clocked in
    const existingAttendance = await prisma.attendance.findUnique({
      where: {
        shiftId_workerId: { shiftId, workerId },
      },
    });

    if (existingAttendance?.clockInAt) {
      throw new AppError('Already clocked in to this shift', 400, 'ALREADY_CLOCKED_IN');
    }

    // Check timing - can clock in up to 15 mins before shift starts
    const now = new Date();
    const shiftStart = new Date(shift.startAt);
    const earliestClockIn = new Date(shiftStart.getTime() - config.attendance.earlyClockInMinutes * 60 * 1000);
    const shiftEnd = new Date(shift.endAt);

    if (now < earliestClockIn) {
      throw new AppError(
        `Too early to clock in. You can clock in from ${earliestClockIn.toLocaleTimeString()}`,
        400,
        'TOO_EARLY'
      );
    }

    if (now > shiftEnd) {
      throw new AppError('This shift has already ended', 400, 'SHIFT_ENDED');
    }

    // Get site location for geofence check
    let siteLat: number | null = null;
    let siteLng: number | null = null;
    let geofenceRadius = config.attendance.defaultGeofenceRadius;

    // Priority: Shift siteLat/siteLng > Location > ClientCompany
    if (shift.siteLat && shift.siteLng) {
      siteLat = Number(shift.siteLat);
      siteLng = Number(shift.siteLng);
    } else if (shift.location) {
      siteLat = Number(shift.location.latitude);
      siteLng = Number(shift.location.longitude);
      geofenceRadius = shift.location.geofenceRadius || config.attendance.defaultGeofenceRadius;
    }

    // Calculate distance and validate geofence
    let distance: number | null = null;
    let geofenceValid = true;

    if (siteLat && siteLng) {
      distance = calculateDistance(data.latitude, data.longitude, siteLat, siteLng);
      geofenceValid = distance <= geofenceRadius;
    }

    // Determine if we should flag this attendance
    let flagReason: 'LATE_CLOCK_IN' | 'EARLY_CLOCK_OUT' | 'LOCATION_MISMATCH' | 'HOURS_DISCREPANCY' | null = null;
    let flagNote: string | null = null;

    // Check if clocking in late (more than 5 minutes after shift start)
    if (now > new Date(shiftStart.getTime() + 5 * 60 * 1000)) {
      flagReason = 'LATE_CLOCK_IN';
      const minutesLate = Math.round((now.getTime() - shiftStart.getTime()) / 60000);
      flagNote = `Clocked in ${minutesLate} minutes late`;
    }

    if (!geofenceValid) {
      flagReason = 'LOCATION_MISMATCH';
      flagNote = `Distance from site: ${Math.round(distance || 0)}m (allowed: ${geofenceRadius}m)`;
    }

    // Create or update attendance record
    const attendance = await prisma.attendance.upsert({
      where: {
        shiftId_workerId: { shiftId, workerId },
      },
      create: {
        shiftId,
        workerId,
        clockInAt: now,
        clockInLat: data.latitude,
        clockInLng: data.longitude,
        clockInAccuracy: data.accuracy,
        clockInDistance: distance,
        clockInDevice: data.deviceInfo,
        geofenceValid,
        status: flagReason ? 'FLAGGED' : 'PENDING',
        flagReason,
        flagNote,
      },
      update: {
        clockInAt: now,
        clockInLat: data.latitude,
        clockInLng: data.longitude,
        clockInAccuracy: data.accuracy,
        clockInDistance: distance,
        clockInDevice: data.deviceInfo,
        geofenceValid,
        status: flagReason ? 'FLAGGED' : 'PENDING',
        flagReason,
        flagNote,
      },
    });

    // Update worker's current location
    await prisma.workerLocation.upsert({
      where: { workerId },
      create: {
        workerId,
        latitude: data.latitude,
        longitude: data.longitude,
        accuracy: data.accuracy,
        updatedAt: now,
      },
      update: {
        latitude: data.latitude,
        longitude: data.longitude,
        accuracy: data.accuracy,
        updatedAt: now,
      },
    });

    ApiResponse.ok(res, 'Clocked in successfully', {
      attendanceId: attendance.id,
      clockInAt: attendance.clockInAt,
      geofenceValid,
      distance: distance ? Math.round(distance) : null,
      flagged: !!flagReason,
      flagReason,
      shift: {
        id: shift.id,
        title: shift.title,
        startAt: shift.startAt,
        endAt: shift.endAt,
        siteLocation: shift.siteLocation,
        clientCompany: shift.clientCompany?.name,
      },
    });
  };

  /**
   * Clock out from a shift
   * POST /api/attendance/:shiftId/clock-out
   */
  clockOut = async (req: AuthRequest, res: Response) => {
    const { shiftId } = req.params;
    const workerId = req.user!.id;
    const data = clockOutSchema.parse(req.body);

    // Get existing attendance record
    const attendance = await prisma.attendance.findUnique({
      where: {
        shiftId_workerId: { shiftId, workerId },
      },
      include: {
        shift: {
          include: {
            location: true,
            clientCompany: true,
          },
        },
      },
    });

    if (!attendance) {
      throw new AppError('No attendance record found. Did you clock in?', 404, 'NO_ATTENDANCE');
    }

    if (!attendance.clockInAt) {
      throw new AppError('You must clock in before clocking out', 400, 'NOT_CLOCKED_IN');
    }

    if (attendance.clockOutAt) {
      throw new AppError('Already clocked out from this shift', 400, 'ALREADY_CLOCKED_OUT');
    }

    const now = new Date();
    const shift = attendance.shift;

    // Calculate hours worked
    const clockInTime = new Date(attendance.clockInAt);
    const msWorked = now.getTime() - clockInTime.getTime();
    const hoursWorked = Math.round((msWorked / (1000 * 60 * 60)) * 100) / 100;

    // Check for flags
    let flagReason = attendance.flagReason;
    let flagNote = attendance.flagNote;

    // Check if clocking out early (more than 5 minutes before shift end)
    const shiftEnd = new Date(shift.endAt);
    if (now < new Date(shiftEnd.getTime() - 5 * 60 * 1000)) {
      flagReason = 'EARLY_CLOCK_OUT';
      const minutesEarly = Math.round((shiftEnd.getTime() - now.getTime()) / 60000);
      flagNote = flagNote
        ? `${flagNote}; Clocked out ${minutesEarly} minutes early`
        : `Clocked out ${minutesEarly} minutes early`;
    }

    // Check hours discrepancy
    const expectedHours =
      (new Date(shift.endAt).getTime() - new Date(shift.startAt).getTime()) / (1000 * 60 * 60) -
      shift.breakMinutes / 60;
    if (Math.abs(hoursWorked - expectedHours) > 0.5) {
      if (!flagReason) flagReason = 'HOURS_DISCREPANCY';
      const diff = Math.abs(hoursWorked - expectedHours).toFixed(1);
      flagNote = flagNote
        ? `${flagNote}; Hours difference: ${diff}h`
        : `Hours difference from expected: ${diff}h`;
    }

    // Update attendance record
    const updatedAttendance = await prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        clockOutAt: now,
        clockOutLat: data.latitude,
        clockOutLng: data.longitude,
        hoursWorked,
        status: flagReason ? 'FLAGGED' : 'PENDING',
        flagReason,
        flagNote,
      },
    });

    // Update worker's current location
    await prisma.workerLocation.upsert({
      where: { workerId },
      create: {
        workerId,
        latitude: data.latitude,
        longitude: data.longitude,
        updatedAt: now,
      },
      update: {
        latitude: data.latitude,
        longitude: data.longitude,
        updatedAt: now,
      },
    });

    ApiResponse.ok(res, 'Clocked out successfully', {
      attendanceId: updatedAttendance.id,
      clockInAt: updatedAttendance.clockInAt,
      clockOutAt: updatedAttendance.clockOutAt,
      hoursWorked,
      flagged: !!flagReason,
      flagReason,
      shift: {
        id: shift.id,
        title: shift.title,
        clientCompany: shift.clientCompany?.name,
      },
    });
  };

  /**
   * Get current shift status for worker
   * GET /api/attendance/my-status
   */
  getMyStatus = async (req: AuthRequest, res: Response) => {
    const workerId = req.user!.id;
    const now = new Date();

    // Get today's shifts with attendance
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const assignments = await prisma.shiftAssignment.findMany({
      where: {
        workerId,
        shift: {
          startAt: { gte: startOfDay },
          endAt: { lte: endOfDay },
        },
      },
      include: {
        shift: {
          include: {
            clientCompany: { select: { id: true, name: true } },
            location: { select: { id: true, name: true, address: true, latitude: true, longitude: true, geofenceRadius: true } },
            attendances: {
              where: { workerId },
            },
          },
        },
      },
      orderBy: { shift: { startAt: 'asc' } },
    });

    const shifts = assignments.map((a) => {
      const attendance = a.shift.attendances[0];
      return {
        shiftId: a.shift.id,
        title: a.shift.title,
        startAt: a.shift.startAt,
        endAt: a.shift.endAt,
        siteLocation: a.shift.siteLocation,
        clientCompany: a.shift.clientCompany,
        location: a.shift.location,
        siteLat: a.shift.siteLat ? Number(a.shift.siteLat) : a.shift.location?.latitude ? Number(a.shift.location.latitude) : null,
        siteLng: a.shift.siteLng ? Number(a.shift.siteLng) : a.shift.location?.longitude ? Number(a.shift.location.longitude) : null,
        geofenceRadius: a.shift.location?.geofenceRadius || config.attendance.defaultGeofenceRadius,
        attendance: attendance
          ? {
              id: attendance.id,
              clockInAt: attendance.clockInAt,
              clockOutAt: attendance.clockOutAt,
              hoursWorked: attendance.hoursWorked ? Number(attendance.hoursWorked) : null,
              status: attendance.status,
              geofenceValid: attendance.geofenceValid,
            }
          : null,
        status: !attendance?.clockInAt
          ? 'PENDING'
          : attendance.clockOutAt
          ? 'COMPLETED'
          : 'IN_PROGRESS',
      };
    });

    // Find active shift (clocked in but not out)
    const activeShift = shifts.find((s) => s.status === 'IN_PROGRESS');

    ApiResponse.ok(res, 'Status retrieved', {
      activeShift: activeShift || null,
      todayShifts: shifts,
    });
  };

  /**
   * Get attendance history for worker
   * GET /api/attendance/my-history
   */
  getMyHistory = async (req: AuthRequest, res: Response) => {
    const workerId = req.user!.id;
    const { startDate, endDate, limit = '20', offset = '0' } = req.query;

    const where: any = { workerId };

    if (startDate || endDate) {
      where.clockInAt = {};
      if (startDate) where.clockInAt.gte = new Date(startDate as string);
      if (endDate) where.clockInAt.lte = new Date(endDate as string);
    }

    const [attendances, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        include: {
          shift: {
            select: {
              id: true,
              title: true,
              startAt: true,
              endAt: true,
              siteLocation: true,
              clientCompany: { select: { name: true } },
            },
          },
        },
        orderBy: { clockInAt: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.attendance.count({ where }),
    ]);

    ApiResponse.ok(res, 'Attendance history', {
      data: attendances.map((a) => ({
        id: a.id,
        clockInAt: a.clockInAt,
        clockOutAt: a.clockOutAt,
        hoursWorked: a.hoursWorked ? Number(a.hoursWorked) : null,
        status: a.status,
        flagReason: a.flagReason,
        geofenceValid: a.geofenceValid,
        shift: a.shift,
      })),
      total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  };

  /**
   * Get attendance records for a shift (manager view)
   * GET /api/attendance/shift/:shiftId
   */
  getShiftAttendance = async (req: AuthRequest, res: Response) => {
    const { shiftId } = req.params;

    const shift = await prisma.shift.findFirst({
      where: {
        id: shiftId,
        organizationId: req.user!.organizationId,
      },
      include: {
        clientCompany: { select: { name: true } },
        location: true,
        assignments: {
          include: {
            worker: {
              select: { id: true, fullName: true, email: true, phone: true },
            },
          },
        },
        attendances: {
          include: {
            worker: {
              select: { id: true, fullName: true, email: true },
            },
          },
        },
      },
    });

    if (!shift) {
      throw new NotFoundError('Shift');
    }

    // Combine assignments with attendance data
    const workerAttendance = shift.assignments.map((assignment) => {
      const attendance = shift.attendances.find((a) => a.workerId === assignment.workerId);
      return {
        worker: assignment.worker,
        assignmentStatus: assignment.status,
        attendance: attendance
          ? {
              id: attendance.id,
              clockInAt: attendance.clockInAt,
              clockOutAt: attendance.clockOutAt,
              hoursWorked: attendance.hoursWorked ? Number(attendance.hoursWorked) : null,
              clockInDistance: attendance.clockInDistance ? Number(attendance.clockInDistance) : null,
              geofenceValid: attendance.geofenceValid,
              status: attendance.status,
              flagReason: attendance.flagReason,
              flagNote: attendance.flagNote,
            }
          : null,
      };
    });

    ApiResponse.ok(res, 'Shift attendance', {
      shift: {
        id: shift.id,
        title: shift.title,
        startAt: shift.startAt,
        endAt: shift.endAt,
        siteLocation: shift.siteLocation,
        clientCompany: shift.clientCompany?.name,
        location: shift.location,
      },
      workers: workerAttendance,
    });
  };

  /**
   * Approve attendance record
   * POST /api/attendance/:attendanceId/approve
   */
  approveAttendance = async (req: AuthRequest, res: Response) => {
    const { attendanceId } = req.params;

    const attendance = await prisma.attendance.findFirst({
      where: {
        id: attendanceId,
        shift: { organizationId: req.user!.organizationId },
      },
    });

    if (!attendance) {
      throw new NotFoundError('Attendance record');
    }

    if (!attendance.clockOutAt) {
      throw new AppError('Cannot approve incomplete attendance', 400, 'INCOMPLETE');
    }

    await prisma.attendance.update({
      where: { id: attendanceId },
      data: { status: 'APPROVED' },
    });

    ApiResponse.ok(res, 'Attendance approved');
  };

  /**
   * Flag attendance record
   * POST /api/attendance/:attendanceId/flag
   */
  flagAttendance = async (req: AuthRequest, res: Response) => {
    const { attendanceId } = req.params;
    const { reason, note } = z.object({
      reason: z.enum(['LATE_CLOCK_IN', 'EARLY_CLOCK_OUT', 'LOCATION_MISMATCH', 'HOURS_DISCREPANCY']),
      note: z.string().max(500).optional(),
    }).parse(req.body);

    const attendance = await prisma.attendance.findFirst({
      where: {
        id: attendanceId,
        shift: { organizationId: req.user!.organizationId },
      },
    });

    if (!attendance) {
      throw new NotFoundError('Attendance record');
    }

    await prisma.attendance.update({
      where: { id: attendanceId },
      data: {
        status: 'FLAGGED',
        flagReason: reason,
        flagNote: note,
      },
    });

    ApiResponse.ok(res, 'Attendance flagged');
  };

  /**
   * Get daily timesheet for manager's staff
   * GET /api/attendance/timesheet/daily
   * Query: date (YYYY-MM-DD), defaults to today
   */
  getDailyTimesheet = async (req: AuthRequest, res: Response) => {
    const { date } = req.query;
    const isAdminOrOps = ['ADMIN', 'OPS_MANAGER', 'SHIFT_COORDINATOR'].includes(req.user!.role);

    // Parse date or default to today
    const targetDate = date ? new Date(date as string) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Build worker filter based on role
    const workerFilter = isAdminOrOps
      ? { organizationId: req.user!.organizationId, role: 'WORKER' as const }
      : { managerId: req.user!.id, role: 'WORKER' as const };

    // Get all workers managed by this user (or all org workers for admin/ops)
    const workers = await prisma.user.findMany({
      where: workerFilter,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
      },
      orderBy: { fullName: 'asc' },
    });

    const workerIds = workers.map(w => w.id);

    // Get all attendance records for these workers on the target date
    const attendances = await prisma.attendance.findMany({
      where: {
        workerId: { in: workerIds },
        OR: [
          { clockInAt: { gte: startOfDay, lte: endOfDay } },
          { shift: { startAt: { gte: startOfDay, lte: endOfDay } } },
        ],
      },
      include: {
        shift: {
          select: {
            id: true,
            title: true,
            startAt: true,
            endAt: true,
            siteLocation: true,
            clientCompany: { select: { name: true } },
          },
        },
      },
    });

    // Get shift assignments for workers on this date (to show scheduled but not clocked in)
    const assignments = await prisma.shiftAssignment.findMany({
      where: {
        workerId: { in: workerIds },
        shift: {
          startAt: { gte: startOfDay, lte: endOfDay },
          organizationId: req.user!.organizationId,
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
            clientCompany: { select: { name: true } },
          },
        },
      },
    });

    // Build timesheet data per worker
    const timesheet = workers.map(worker => {
      const workerAttendances = attendances.filter(a => a.workerId === worker.id);
      const workerAssignments = assignments.filter(a => a.workerId === worker.id);

      // Map assignments to include attendance status
      const shifts = workerAssignments.map(assignment => {
        const attendance = workerAttendances.find(a => a.shiftId === assignment.shiftId);
        return {
          shiftId: assignment.shift.id,
          title: assignment.shift.title,
          scheduledStart: assignment.shift.startAt,
          scheduledEnd: assignment.shift.endAt,
          location: assignment.shift.siteLocation,
          client: assignment.shift.clientCompany?.name,
          clockInAt: attendance?.clockInAt || null,
          clockOutAt: attendance?.clockOutAt || null,
          hoursWorked: attendance?.hoursWorked ? Number(attendance.hoursWorked) : null,
          status: attendance
            ? attendance.clockOutAt
              ? 'COMPLETED'
              : 'IN_PROGRESS'
            : new Date() > assignment.shift.startAt
              ? 'NO_SHOW'
              : 'SCHEDULED',
          attendanceStatus: attendance?.status || null,
          geofenceValid: attendance?.geofenceValid ?? null,
        };
      });

      const totalHours = shifts.reduce((sum, s) => sum + (s.hoursWorked || 0), 0);

      return {
        worker,
        shifts,
        summary: {
          totalShifts: shifts.length,
          completed: shifts.filter(s => s.status === 'COMPLETED').length,
          inProgress: shifts.filter(s => s.status === 'IN_PROGRESS').length,
          noShow: shifts.filter(s => s.status === 'NO_SHOW').length,
          scheduled: shifts.filter(s => s.status === 'SCHEDULED').length,
          totalHours: Math.round(totalHours * 100) / 100,
        },
      };
    });

    ApiResponse.ok(res, 'Daily timesheet', {
      date: targetDate.toISOString().split('T')[0],
      workers: timesheet,
      totals: {
        totalWorkers: workers.length,
        totalShifts: timesheet.reduce((sum, w) => sum + w.summary.totalShifts, 0),
        totalHours: Math.round(timesheet.reduce((sum, w) => sum + w.summary.totalHours, 0) * 100) / 100,
      },
    });
  };

  /**
   * Get flagged attendance records for review
   * GET /api/attendance/flagged
   */
  getFlaggedAttendance = async (req: AuthRequest, res: Response) => {
    const { limit = '20', offset = '0' } = req.query;

    const [attendances, total] = await Promise.all([
      prisma.attendance.findMany({
        where: {
          shift: { organizationId: req.user!.organizationId },
          status: 'FLAGGED',
        },
        include: {
          worker: { select: { id: true, fullName: true, email: true } },
          shift: {
            select: {
              id: true,
              title: true,
              startAt: true,
              endAt: true,
              clientCompany: { select: { name: true } },
            },
          },
        },
        orderBy: { clockInAt: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.attendance.count({
        where: {
          shift: { organizationId: req.user!.organizationId },
          status: 'FLAGGED',
        },
      }),
    ]);

    ApiResponse.ok(res, 'Flagged attendance', { data: attendances, total });
  };

  /**
   * Get timesheet statistics
   * GET /api/attendance/timesheet/stats
   */
  getTimesheetStats = async (req: AuthRequest, res: Response) => {
    const orgId = req.user!.organizationId;
    
    // Current week
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    // Previous week for comparison
    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
    const endOfLastWeek = new Date(startOfWeek);

    const baseWhere = { shift: { organizationId: orgId } };

    // Current week counts
    const [total, approved, pending, flagged] = await Promise.all([
      prisma.attendance.count({
        where: { ...baseWhere, clockInAt: { gte: startOfWeek, lt: endOfWeek } },
      }),
      prisma.attendance.count({
        where: { ...baseWhere, status: 'APPROVED', clockInAt: { gte: startOfWeek, lt: endOfWeek } },
      }),
      prisma.attendance.count({
        where: { ...baseWhere, status: 'PENDING', clockInAt: { gte: startOfWeek, lt: endOfWeek } },
      }),
      prisma.attendance.count({
        where: { ...baseWhere, status: 'FLAGGED', clockInAt: { gte: startOfWeek, lt: endOfWeek } },
      }),
    ]);

    // Last week counts for comparison
    const [lastTotal, lastApproved, lastPending, lastFlagged] = await Promise.all([
      prisma.attendance.count({
        where: { ...baseWhere, clockInAt: { gte: startOfLastWeek, lt: endOfLastWeek } },
      }),
      prisma.attendance.count({
        where: { ...baseWhere, status: 'APPROVED', clockInAt: { gte: startOfLastWeek, lt: endOfLastWeek } },
      }),
      prisma.attendance.count({
        where: { ...baseWhere, status: 'PENDING', clockInAt: { gte: startOfLastWeek, lt: endOfLastWeek } },
      }),
      prisma.attendance.count({
        where: { ...baseWhere, status: 'FLAGGED', clockInAt: { gte: startOfLastWeek, lt: endOfLastWeek } },
      }),
    ]);

    const calcChange = (current: number, last: number) => {
      if (last === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - last) / last) * 1000) / 10;
    };

    ApiResponse.ok(res, 'Timesheet stats', {
      total: { count: total, change: calcChange(total, lastTotal) },
      approved: { count: approved, change: calcChange(approved, lastApproved) },
      pending: { count: pending, change: calcChange(pending, lastPending) },
      flagged: { count: flagged, change: calcChange(flagged, lastFlagged) },
      period: { start: startOfWeek, end: endOfWeek },
    });
  };

  /**
   * Get timesheet hours by client - weekly breakdown
   * GET /api/attendance/timesheet/by-client
   */
  getTimesheetByClient = async (req: AuthRequest, res: Response) => {
    const query = z.object({
      weeks: z.coerce.number().min(1).max(12).default(4),
    }).parse(req.query);

    const orgId = req.user!.organizationId;
    const now = new Date();

    // Get clients with attendance data
    const clients = await prisma.clientCompany.findMany({
      where: { organizationId: orgId, status: 'ACTIVE' },
      select: { id: true, name: true },
    });

    // Calculate weekly data for each client
    const weeklyData = [];
    
    for (let i = 0; i < query.weeks; i++) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay() - (i * 7));
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      const weekLabel = weekStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

      const clientHours: Record<string, { hours: number; workers: number }> = {};

      for (const client of clients) {
        const attendances = await prisma.attendance.findMany({
          where: {
            shift: {
              organizationId: orgId,
              clientCompanyId: client.id,
            },
            clockInAt: { gte: weekStart, lt: weekEnd },
            clockOutAt: { not: null },
          },
          select: {
            hoursWorked: true,
            workerId: true,
          },
        });

        const totalHours = attendances.reduce((sum, a) => sum + (Number(a.hoursWorked) || 0), 0);
        const uniqueWorkers = new Set(attendances.map(a => a.workerId)).size;

        clientHours[client.id] = {
          hours: Math.round(totalHours * 10) / 10,
          workers: uniqueWorkers,
        };
      }

      weeklyData.push({
        week: weekLabel,
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
        clients: clientHours,
      });
    }

    // Calculate totals per client
    const clientTotals = clients.map(client => {
      const totalHours = weeklyData.reduce((sum, week) => sum + (week.clients[client.id]?.hours || 0), 0);
      const avgWorkers = Math.round(
        weeklyData.reduce((sum, week) => sum + (week.clients[client.id]?.workers || 0), 0) / query.weeks
      );

      return {
        clientId: client.id,
        clientName: client.name,
        totalHours: Math.round(totalHours * 10) / 10,
        avgWeeklyHours: Math.round((totalHours / query.weeks) * 10) / 10,
        avgWorkers,
        weeklyBreakdown: weeklyData.map(week => ({
          week: week.week,
          hours: week.clients[client.id]?.hours || 0,
          workers: week.clients[client.id]?.workers || 0,
        })).reverse(),
      };
    });

    // Sort by total hours descending
    clientTotals.sort((a, b) => b.totalHours - a.totalHours);

    ApiResponse.ok(res, 'Timesheet by client', {
      clients: clientTotals,
      period: {
        weeks: query.weeks,
        from: weeklyData[weeklyData.length - 1]?.weekStart,
        to: weeklyData[0]?.weekEnd,
      },
    });
  };

  /**
   * Get weekly timesheet for a specific client
   * GET /api/attendance/timesheet/client/:clientId
   */
  getClientWeeklyTimesheet = async (req: AuthRequest, res: Response) => {
    const { clientId } = req.params;
    const query = z.object({
      weeks: z.coerce.number().min(1).max(12).default(8),
    }).parse(req.query);

    const orgId = req.user!.organizationId;

    // Verify client belongs to organization
    const client = await prisma.clientCompany.findFirst({
      where: { id: clientId, organizationId: orgId },
    });

    if (!client) {
      throw new NotFoundError('Client');
    }

    const now = new Date();
    interface WeekData {
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
    }
    
    const weeks: WeekData[] = [];

    for (let i = 0; i < query.weeks; i++) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay() - (i * 7));
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      // Get attendance data for this week
      const attendances = await prisma.attendance.findMany({
        where: {
          shift: { clientCompanyId: clientId, organizationId: orgId },
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
          clientCompanyId: clientId,
          periodStart: { lte: weekEnd },
          periodEnd: { gte: weekStart },
        },
        select: { id: true, status: true },
      });

      const totalHours = attendances.reduce((sum, a) => sum + (Number(a.hoursWorked) || 0), 0);
      const uniqueWorkers = new Set(attendances.map(a => a.workerId)).size;
      
      // Calculate amount using charge rate (1.3x pay rate)
      const totalAmount = attendances.reduce((sum, a) => {
        const payRate = Number(a.shift.payRate) || 12;
        const chargeRate = payRate * 1.3;
        return sum + ((Number(a.hoursWorked) || 0) * chargeRate);
      }, 0);

      weeks.push({
        weekNumber: query.weeks - i,
        weekLabel: `Week ${query.weeks - i}`,
        weekStart,
        weekEnd,
        totalHours: Math.round(totalHours * 10) / 10,
        totalShifts: attendances.length,
        totalWorkers: uniqueWorkers,
        totalAmount: Math.round(totalAmount * 100) / 100,
        status: existingInvoice ? 'INVOICED' : 'UNINVOICED',
        invoiceId: existingInvoice?.id,
      });
    }

    ApiResponse.ok(res, 'Client weekly timesheet', {
      client: { id: client.id, name: client.name },
      weeks: weeks.reverse(), // Oldest first
      summary: {
        totalHours: weeks.reduce((s, w) => s + w.totalHours, 0),
        totalAmount: weeks.reduce((s, w) => s + w.totalAmount, 0),
        uninvoicedWeeks: weeks.filter(w => w.status === 'UNINVOICED' && w.totalShifts > 0).length,
      },
    });
  };

  /**
   * Get timesheet list with filters, search, pagination
   * GET /api/attendance/timesheet/list
   */
  getTimesheetList = async (req: AuthRequest, res: Response) => {
    const query = z.object({
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(100).default(20),
      search: z.string().optional(),
      status: z.enum(['PENDING', 'APPROVED', 'FLAGGED']).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      clientId: z.string().uuid().optional(),
      sortBy: z.enum(['date', 'worker', 'hours', 'status']).default('date'),
      sortOrder: z.enum(['asc', 'desc']).default('desc'),
    }).parse(req.query);

    const skip = (query.page - 1) * query.limit;
    const orgId = req.user!.organizationId;

    // Build where clause
    const where: any = {
      shift: { organizationId: orgId },
      clockInAt: { not: null },
    };

    if (query.status) where.status = query.status;
    if (query.clientId) where.shift = { ...where.shift, clientCompanyId: query.clientId };

    if (query.startDate || query.endDate) {
      where.clockInAt = {};
      if (query.startDate) where.clockInAt.gte = new Date(query.startDate);
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.clockInAt.lte = end;
      }
    }

    if (query.search) {
      where.worker = {
        OR: [
          { fullName: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
        ],
      };
    }

    // Build orderBy
    let orderBy: any = { clockInAt: query.sortOrder };
    if (query.sortBy === 'worker') orderBy = { worker: { fullName: query.sortOrder } };
    if (query.sortBy === 'hours') orderBy = { hoursWorked: query.sortOrder };
    if (query.sortBy === 'status') orderBy = { status: query.sortOrder };

    const [attendances, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        include: {
          worker: {
            select: { id: true, fullName: true, email: true, profilePicUrl: true },
          },
          shift: {
            select: {
              id: true,
              title: true,
              startAt: true,
              endAt: true,
              breakMinutes: true,
              clientCompany: { select: { id: true, name: true } },
            },
          },
        },
        orderBy,
        skip,
        take: query.limit,
      }),
      prisma.attendance.count({ where }),
    ]);

    const timesheets = attendances.map(a => ({
      id: a.id,
      worker: {
        id: a.worker.id,
        fullName: a.worker.fullName,
        email: a.worker.email,
        avatar: a.worker.profilePicUrl,
      },
      client: a.shift.clientCompany,
      date: a.clockInAt ? new Date(a.clockInAt).toISOString().split('T')[0] : null,
      shiftTime: {
        scheduled: { start: a.shift.startAt, end: a.shift.endAt },
        actual: { start: a.clockInAt, end: a.clockOutAt },
      },
      duration: a.hoursWorked ? `${Number(a.hoursWorked).toFixed(1)} hours` : null,
      durationHours: a.hoursWorked ? Number(a.hoursWorked) : 0,
      status: a.status,
      flagReason: a.flagReason,
      geofenceValid: a.geofenceValid,
    }));

    ApiResponse.ok(res, 'Timesheet list', {
      timesheets,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    });
  };

  /**
   * Get timesheet detail for a specific attendance
   * GET /api/attendance/timesheet/:attendanceId
   */
  getTimesheetDetail = async (req: AuthRequest, res: Response) => {
    const { attendanceId } = req.params;

    const attendance = await prisma.attendance.findFirst({
      where: {
        id: attendanceId,
        shift: { organizationId: req.user!.organizationId },
      },
      include: {
        worker: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            profilePicUrl: true,
          },
        },
        shift: {
          include: {
            clientCompany: { select: { id: true, name: true } },
            location: true,
          },
        },
      },
    }) as any;

    if (!attendance) {
      throw new NotFoundError('Timesheet');
    }

    // Calculate break duration (if tracked)
    const breakDuration = attendance.shift.breakMinutes || 0;

    // Build activity log
    const activityLog: Array<{ time: Date; action: string; details?: string }> = [];
    
    if (attendance.clockInAt) {
      activityLog.push({
        time: attendance.clockInAt,
        action: 'Clock In',
        details: attendance.geofenceValid ? 'Location verified' : 'Location outside geofence',
      });
    }
    
    if (attendance.clockOutAt) {
      activityLog.push({
        time: attendance.clockOutAt,
        action: 'Clock Out',
      });
    }

    if (attendance.flagReason) {
      activityLog.push({
        time: attendance.updatedAt,
        action: 'Flagged',
        details: attendance.flagNote || attendance.flagReason,
      });
    }

    if (attendance.status === 'APPROVED') {
      activityLog.push({
        time: attendance.updatedAt,
        action: 'Approved',
        details: 'Timesheet verified and sent to payroll',
      });
    }

    // Sort activity log by time
    activityLog.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    ApiResponse.ok(res, 'Timesheet detail', {
      id: attendance.id,
      worker: attendance.worker,
      shift: {
        id: attendance.shift.id,
        title: attendance.shift.title,
        scheduledStart: attendance.shift.startAt,
        scheduledEnd: attendance.shift.endAt,
        client: attendance.shift.clientCompany,
        location: attendance.shift.location,
        siteLat: attendance.shift.siteLat ? Number(attendance.shift.siteLat) : null,
        siteLng: attendance.shift.siteLng ? Number(attendance.shift.siteLng) : null,
      },
      attendance: {
        clockInAt: attendance.clockInAt,
        clockOutAt: attendance.clockOutAt,
        clockInLat: attendance.clockInLat ? Number(attendance.clockInLat) : null,
        clockInLng: attendance.clockInLng ? Number(attendance.clockInLng) : null,
        clockOutLat: attendance.clockOutLat ? Number(attendance.clockOutLat) : null,
        clockOutLng: attendance.clockOutLng ? Number(attendance.clockOutLng) : null,
        clockInDistance: attendance.clockInDistance ? Number(attendance.clockInDistance) : null,
      },
      totalHours: attendance.hoursWorked ? Number(attendance.hoursWorked) : 0,
      breakDuration,
      status: attendance.status,
      flagReason: attendance.flagReason,
      flagNote: attendance.flagNote,
      geofenceValid: attendance.geofenceValid,
      locationVerified: attendance.geofenceValid ? 'GPS-Verified' : 'Location Mismatch',
      activityLog,
    });
  };

  /**
   * Bulk approve timesheets
   * POST /api/attendance/timesheet/bulk-approve
   */
  bulkApproveTimesheets = async (req: AuthRequest, res: Response) => {
    const { attendanceIds } = z.object({
      attendanceIds: z.array(z.string().uuid()),
    }).parse(req.body);

    // Get all valid attendance records
    const attendances = await prisma.attendance.findMany({
      where: {
        id: { in: attendanceIds },
        shift: { organizationId: req.user!.organizationId },
        clockOutAt: { not: null },
        status: { in: ['PENDING', 'FLAGGED'] },
      },
      include: {
        worker: { select: { id: true, fullName: true, organizationId: true } },
      },
    });

    if (attendances.length === 0) {
      throw new AppError('No valid timesheets to approve', 400, 'NO_TIMESHEETS');
    }

    // Bulk update
    await prisma.attendance.updateMany({
      where: { id: { in: attendances.map(a => a.id) } },
      data: { status: 'APPROVED' },
    });

    // Send notifications
    await prisma.notification.createMany({
      data: attendances.map(a => ({
        organizationId: a.worker.organizationId,
        userId: a.worker.id,
        type: 'TIMESHEET',
        channel: 'PUSH' as const,
        title: 'Timesheet Approved',
        message: 'Your timesheet has been verified and sent to payroll.',
        referenceType: 'attendance',
        referenceId: a.id,
      })),
    });

    ApiResponse.ok(res, `${attendances.length} timesheet(s) approved and sent to payroll`, {
      approvedCount: attendances.length,
    });
  };

  /**
   * Export timesheets to XLS
   * GET /api/attendance/timesheet/export
   */
  exportTimesheetsXLS = async (req: AuthRequest, res: Response) => {
    const query = z.object({
      status: z.enum(['PENDING', 'APPROVED', 'FLAGGED']).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).parse(req.query);

    const where: any = {
      shift: { organizationId: req.user!.organizationId },
      clockInAt: { not: null },
    };

    if (query.status) where.status = query.status;

    if (query.startDate || query.endDate) {
      where.clockInAt = { not: null };
      if (query.startDate) where.clockInAt.gte = new Date(query.startDate);
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.clockInAt.lte = end;
      }
    }

    const attendances = await prisma.attendance.findMany({
      where,
      include: {
        worker: { select: { fullName: true, email: true } },
        shift: {
          select: {
            title: true,
            startAt: true,
            endAt: true,
            clientCompany: { select: { name: true } },
          },
        },
      },
      orderBy: { clockInAt: 'desc' },
      take: 1000,
    });

    const data = attendances.map(a => ({
      'Worker Name': a.worker.fullName,
      'Worker Email': a.worker.email,
      'Client': a.shift.clientCompany?.name || '-',
      'Date': a.clockInAt ? new Date(a.clockInAt).toLocaleDateString() : '-',
      'Scheduled Start': new Date(a.shift.startAt).toLocaleTimeString(),
      'Scheduled End': new Date(a.shift.endAt).toLocaleTimeString(),
      'Actual Start': a.clockInAt ? new Date(a.clockInAt).toLocaleTimeString() : '-',
      'Actual End': a.clockOutAt ? new Date(a.clockOutAt).toLocaleTimeString() : '-',
      'Hours Worked': a.hoursWorked ? Number(a.hoursWorked).toFixed(2) : '0',
      'Status': a.status,
      'Flag Reason': a.flagReason || '-',
      'GPS Verified': a.geofenceValid ? 'Yes' : 'No',
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Timesheets');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=timesheets-${new Date().toISOString().split('T')[0]}.xlsx`);
    res.send(buffer);
  };
}
