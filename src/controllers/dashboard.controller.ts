import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { isAgencyMode } from '../utils/deploymentMode';

export class DashboardController {
  /**
   * Get main agency dashboard data
   * Shows registered client companies after successful registration
   */
  getAgencyDashboard = async (req: AuthRequest, res: Response) => {
    const organizationId = req.user!.organizationId;
    const isAgency = await isAgencyMode(organizationId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Base stats for both modes
    const [
      totalWorkers,
      activeWorkers,
      totalShifts,
      shiftsToday,
      shiftsThisWeek,
      pendingTimesheets,
    ] = await Promise.all([
      prisma.user.count({
        where: { organizationId, role: 'WORKER' },
      }),
      prisma.user.count({
        where: { organizationId, role: 'WORKER', status: 'ACTIVE' },
      }),
      prisma.shift.count({
        where: { organizationId },
      }),
      prisma.shift.count({
        where: {
          organizationId,
          startAt: { gte: today, lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.shift.count({
        where: {
          organizationId,
          startAt: { gte: today, lt: weekFromNow },
        },
      }),
      prisma.attendance.count({
        where: {
          shift: { organizationId },
          status: 'PENDING',
          clockOutAt: { not: null },
        },
      }),
    ]);

    // Agency-specific data
    let clientStats = null;
    let recentClients: any[] = [];

    if (isAgency) {
      const [totalClients, activeClients, pendingClients, clients] = await Promise.all([
        prisma.clientCompany.count({
          where: { organizationId },
        }),
        prisma.clientCompany.count({
          where: { organizationId, status: 'ACTIVE' },
        }),
        prisma.clientCompany.count({
          where: { organizationId, status: 'PENDING' },
        }),
        prisma.clientCompany.findMany({
          where: { organizationId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            name: true,
            status: true,
            createdAt: true,
            contactName: true,
            contactEmail: true,
            _count: {
              select: { shifts: true },
            },
          },
        }),
      ]);

      clientStats = {
        total: totalClients,
        active: activeClients,
        pending: pendingClients,
      };

      recentClients = clients.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        registeredAt: c.createdAt,
        contactName: c.contactName,
        contactEmail: c.contactEmail,
        totalShifts: c._count.shifts,
      }));
    }

    // Upcoming shifts
    const upcomingShifts = await prisma.shift.findMany({
      where: {
        organizationId,
        startAt: { gte: today },
        status: { in: ['OPEN', 'FILLED'] },
      },
      orderBy: { startAt: 'asc' },
      take: 10,
      select: {
        id: true,
        title: true,
        role: true,
        startAt: true,
        endAt: true,
        status: true,
        workersNeeded: true,
        clientCompany: isAgency ? { select: { name: true } } : false,
        _count: {
          select: {
            assignments: { where: { status: 'ACCEPTED' } },
          },
        },
      },
    });

    res.json({
      success: true,
      data: {
        isAgencyMode: isAgency,
        stats: {
          workers: {
            total: totalWorkers,
            active: activeWorkers,
          },
          shifts: {
            total: totalShifts,
            today: shiftsToday,
            thisWeek: shiftsThisWeek,
          },
          pendingTimesheets,
          ...(isAgency && { clients: clientStats }),
        },
        recentClients: isAgency ? recentClients : undefined,
        upcomingShifts: upcomingShifts.map((s) => ({
          ...s,
          workersAssigned: s._count.assignments,
          clientName: (s as any).clientCompany?.name,
        })),
      },
    });
  };

  /**
   * Get dashboard stats only
   */
  getStats = async (req: AuthRequest, res: Response) => {
    const organizationId = req.user!.organizationId;
    const isAgency = await isAgencyMode(organizationId);

    const stats: any = {
      workers: await prisma.user.count({
        where: { organizationId, role: 'WORKER', status: 'ACTIVE' },
      }),
      shiftsToday: await prisma.shift.count({
        where: {
          organizationId,
          startAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lt: new Date(new Date().setHours(23, 59, 59, 999)),
          },
        },
      }),
      pendingTimesheets: await prisma.attendance.count({
        where: {
          shift: { organizationId },
          status: 'PENDING',
          clockOutAt: { not: null },
        },
      }),
    };

    if (isAgency) {
      stats.clients = await prisma.clientCompany.count({
        where: { organizationId, status: 'ACTIVE' },
      });
    }

    res.json({ success: true, data: stats });
  };

  /**
   * Get recently registered client companies
   */
  getRecentClients = async (req: AuthRequest, res: Response) => {
    const organizationId = req.user!.organizationId;
    const { limit = 10, status } = req.query;

    const clients = await prisma.clientCompany.findMany({
      where: {
        organizationId,
        ...(status && { status: status as any }),
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      include: {
        _count: {
          select: {
            shifts: true,
            clientUsers: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: clients.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        registeredAt: c.createdAt,
        contactName: c.contactName,
        contactEmail: c.contactEmail,
        contactPhone: c.contactPhone,
        industry: c.industry,
        totalShifts: c._count.shifts,
        totalUsers: c._count.clientUsers,
      })),
    });
  };

  /**
   * Get recently registered workers
   */
  getRecentWorkers = async (req: AuthRequest, res: Response) => {
    const organizationId = req.user!.organizationId;
    const { limit = 10 } = req.query;

    const workers = await prisma.user.findMany({
      where: { organizationId, role: 'WORKER' },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      select: {
        id: true,
        fullName: true,
        email: true,
        status: true,
        createdAt: true,
        workerSkills: {
          include: { skill: true },
          take: 3,
        },
        workerProfile: {
          select: { rtwStatus: true },
        },
      },
    });

    res.json({
      success: true,
      data: workers.map(w => ({
        ...w,
        rtwStatus: w.workerProfile?.rtwStatus,
      })),
    });
  };

  /**
   * Get items pending approval
   */
  getPendingApprovals = async (req: AuthRequest, res: Response) => {
    const organizationId = req.user!.organizationId;

    const [pendingWorkers, pendingTimesheets, pendingClients] = await Promise.all([
      // Workers awaiting RTW verification
      prisma.user.findMany({
        where: {
          organizationId,
          role: 'WORKER',
          workerProfile: { rtwStatus: 'NOT_STARTED' },
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          createdAt: true,
        },
        take: 10,
      }),
      // Timesheets awaiting approval
      prisma.attendance.findMany({
        where: {
          shift: { organizationId },
          status: 'PENDING',
          clockOutAt: { not: null },
        },
        include: {
          worker: { select: { id: true, fullName: true } },
          shift: { select: { title: true, startAt: true } },
        },
        take: 10,
      }),
      // Client companies awaiting activation
      prisma.clientCompany.findMany({
        where: {
          organizationId,
          status: 'PENDING',
        },
        select: {
          id: true,
          name: true,
          contactName: true,
          contactEmail: true,
          createdAt: true,
        },
        take: 10,
      }),
    ]);

    res.json({
      success: true,
      data: {
        workers: pendingWorkers,
        timesheets: pendingTimesheets,
        clients: pendingClients,
        counts: {
          workers: pendingWorkers.length,
          timesheets: pendingTimesheets.length,
          clients: pendingClients.length,
        },
      },
    });
  };

  /**
   * Get role-based dashboard data
   * Returns different data based on user role
   */
  getRoleDashboard = async (req: AuthRequest, res: Response) => {
    const { organizationId, role } = req.user!;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Common data for all staff roles
    const baseData = {
      role,
      user: {
        id: req.user!.id,
        fullName: req.user!.fullName,
        email: req.user!.email,
      },
    };

    switch (role) {
      case 'ADMIN': {
        // Admin sees everything
        const [workers, shifts, clients, pendingApprovals, teamMembers] = await Promise.all([
          prisma.user.count({ where: { organizationId, role: 'WORKER', status: 'ACTIVE' } }),
          prisma.shift.count({ where: { organizationId, startAt: { gte: today, lt: weekFromNow } } }),
          prisma.clientCompany.count({ where: { organizationId, status: 'ACTIVE' } }),
          prisma.attendance.count({ where: { shift: { organizationId }, status: 'PENDING', clockOutAt: { not: null } } }),
          prisma.user.findMany({
            where: { organizationId, role: { not: 'WORKER' } },
            select: { id: true, fullName: true, email: true, role: true, status: true, lastLoginAt: true },
          }),
        ]);
        return res.json({
          success: true,
          data: {
            ...baseData,
            stats: { workers, shiftsThisWeek: shifts, clients, pendingApprovals },
            teamMembers,
            permissions: ['manage_team', 'manage_workers', 'manage_shifts', 'manage_clients', 'view_reports', 'manage_billing'],
          },
        });
      }

      case 'OPS_MANAGER': {
        // Ops Manager sees workers, shifts, attendance
        const [workers, activeShifts, pendingTimesheets, openShifts, recentAttendance] = await Promise.all([
          prisma.user.count({ where: { organizationId, role: 'WORKER', status: 'ACTIVE' } }),
          prisma.shift.count({ where: { organizationId, status: 'IN_PROGRESS' } }),
          prisma.attendance.count({ where: { shift: { organizationId }, status: 'PENDING', clockOutAt: { not: null } } }),
          prisma.shift.count({ where: { organizationId, status: 'OPEN', startAt: { gte: today } } }),
          prisma.attendance.findMany({
            where: { shift: { organizationId }, clockOutAt: { not: null } },
            orderBy: { clockOutAt: 'desc' },
            take: 10,
            include: {
              worker: { select: { id: true, fullName: true } },
              shift: { select: { title: true, startAt: true } },
            },
          }),
        ]);
        return res.json({
          success: true,
          data: {
            ...baseData,
            stats: { activeWorkers: workers, activeShifts, pendingTimesheets, openShifts },
            recentAttendance,
            permissions: ['manage_workers', 'manage_shifts', 'approve_timesheets', 'view_reports'],
          },
        });
      }

      case 'SHIFT_COORDINATOR': {
        // Shift Coordinator focuses on shifts and assignments
        const [todayShifts, weekShifts, openShifts, upcomingShifts] = await Promise.all([
          prisma.shift.count({ where: { organizationId, startAt: { gte: today, lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) } } }),
          prisma.shift.count({ where: { organizationId, startAt: { gte: today, lt: weekFromNow } } }),
          prisma.shift.count({ where: { organizationId, status: 'OPEN', startAt: { gte: today } } }),
          prisma.shift.findMany({
            where: { organizationId, startAt: { gte: today }, status: { in: ['OPEN', 'FILLED'] } },
            orderBy: { startAt: 'asc' },
            take: 15,
            include: {
              clientCompany: { select: { name: true } },
              _count: { select: { assignments: { where: { status: 'ACCEPTED' } } } },
            },
          }),
        ]);
        return res.json({
          success: true,
          data: {
            ...baseData,
            stats: { shiftsToday: todayShifts, shiftsThisWeek: weekShifts, openShifts },
            upcomingShifts: upcomingShifts.map(s => ({
              ...s,
              workersAssigned: s._count.assignments,
              clientName: s.clientCompany?.name,
            })),
            permissions: ['manage_shifts', 'assign_workers', 'broadcast_shifts'],
          },
        });
      }

      case 'COMPLIANCE_OFFICER': {
        // Compliance Officer focuses on RTW, documents, compliance
        const [pendingRtw, expiringSoon, pendingDocuments, complianceIssues] = await Promise.all([
          prisma.user.count({ where: { organizationId, role: 'WORKER', workerProfile: { rtwStatus: 'PENDING' } } }),
          prisma.workerDocument.count({
            where: {
              worker: { organizationId },
              expiresAt: { gte: today, lte: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000) },
            },
          }),
          prisma.workerDocument.count({ where: { worker: { organizationId }, verified: false } }),
          prisma.user.findMany({
            where: { organizationId, role: 'WORKER', workerProfile: { rtwStatus: { in: ['PENDING', 'REQUIRES_REVIEW', 'EXPIRED'] } } },
            select: {
              id: true,
              fullName: true,
              email: true,
              workerProfile: { select: { rtwStatus: true, rtwExpiresAt: true } },
            },
            take: 20,
          }),
        ]);
        return res.json({
          success: true,
          data: {
            ...baseData,
            stats: { pendingRtw, expiringSoon, pendingDocuments },
            complianceIssues,
            permissions: ['verify_rtw', 'verify_documents', 'view_compliance_reports'],
          },
        });
      }

      default:
        return res.json({
          success: true,
          data: {
            ...baseData,
            stats: {},
            permissions: [],
          },
        });
    }
  };

  /**
   * Get admin dashboard stats with weekly comparison
   * Returns: Total Workers, Total Clients, Total Revenue, Shifts Today with % change
   */
  getAdminStats = async (req: AuthRequest, res: Response) => {
    const organizationId = req.user!.organizationId;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    
    // This week (Mon-Sun)
    const dayOfWeek = today.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const thisWeekStart = new Date(today.getTime() - diffToMonday * 24 * 60 * 60 * 1000);
    const lastWeekStart = new Date(thisWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastWeekEnd = thisWeekStart;

    // Current stats
    const [totalWorkers, totalClients, shiftsToday, totalRevenueResult] = await Promise.all([
      prisma.user.count({ where: { organizationId, role: 'WORKER' } }),
      prisma.clientCompany.count({ where: { organizationId } }),
      prisma.shift.count({ where: { organizationId, startAt: { gte: today, lt: tomorrow } } }),
      prisma.payslipLineItem.aggregate({
        where: { payslip: { payPeriod: { organizationId } } },
        _sum: { amount: true },
      }),
    ]);

    // Last week stats for comparison
    const [lastWeekWorkers, lastWeekClients, lastWeekShiftsOnSameDay, lastWeekRevenue] = await Promise.all([
      prisma.user.count({
        where: { organizationId, role: 'WORKER', createdAt: { lt: lastWeekEnd } },
      }),
      prisma.clientCompany.count({
        where: { organizationId, createdAt: { lt: lastWeekEnd } },
      }),
      prisma.shift.count({
        where: {
          organizationId,
          startAt: {
            gte: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
            lt: new Date(tomorrow.getTime() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.payslipLineItem.aggregate({
        where: {
          payslip: { is: { payPeriod: { is: { organizationId, endDate: { lt: lastWeekEnd } } } } },
        },
        _sum: { amount: true },
      }),
    ]);

    const totalRevenue = Number(totalRevenueResult._sum?.amount || 0);
    const lastRevenue = Number(lastWeekRevenue._sum?.amount || 0);

    const calcChange = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100 * 10) / 10;
    };

    res.json({
      success: true,
      data: {
        totalWorkers: { value: totalWorkers, change: calcChange(totalWorkers, lastWeekWorkers) },
        totalClients: { value: totalClients, change: calcChange(totalClients, lastWeekClients) },
        totalRevenue: { value: totalRevenue, change: calcChange(totalRevenue, lastRevenue), currency: 'GBP' },
        shiftsToday: { value: shiftsToday, change: calcChange(shiftsToday, lastWeekShiftsOnSameDay) },
      },
    });
  };

  /**
   * Get shifts by day for bar chart
   * Returns shift counts for each day of the week
   */
  getShiftsByDay = async (req: AuthRequest, res: Response) => {
    const organizationId = req.user!.organizationId;
    const { days = 7 } = req.query;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get start of current week (Monday)
    const dayOfWeek = today.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(today.getTime() - diffToMonday * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    const shifts = await prisma.shift.findMany({
      where: {
        organizationId,
        startAt: { gte: weekStart, lt: weekEnd },
      },
      select: { startAt: true },
    });

    const dayNames = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
    const shiftsByDay = dayNames.map((day, index) => {
      const dayStart = new Date(weekStart.getTime() + index * 24 * 60 * 60 * 1000);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const count = shifts.filter(s => s.startAt >= dayStart && s.startAt < dayEnd).length;
      return { day, count };
    });

    res.json({
      success: true,
      data: {
        period: { start: weekStart, end: weekEnd },
        shifts: shiftsByDay,
      },
    });
  };

  /**
   * Get workers availability for pie chart
   * Returns: Available vs Booked workers percentage
   */
  getWorkersAvailability = async (req: AuthRequest, res: Response) => {
    const organizationId = req.user!.organizationId;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    // Total active workers
    const totalWorkers = await prisma.user.count({
      where: { organizationId, role: 'WORKER', status: 'ACTIVE' },
    });

    // Workers with shifts today (booked)
    const bookedWorkers = await prisma.shiftAssignment.findMany({
      where: {
        shift: {
          organizationId,
          startAt: { gte: today, lt: tomorrow },
        },
        status: 'ACCEPTED',
      },
      select: { workerId: true },
      distinct: ['workerId'],
    });

    const booked = bookedWorkers.length;
    const available = Math.max(0, totalWorkers - booked);
    const activePercentage = totalWorkers > 0 ? Math.round((available / totalWorkers) * 100) : 0;

    res.json({
      success: true,
      data: {
        total: totalWorkers,
        available: { count: available, percentage: totalWorkers > 0 ? Math.round((available / totalWorkers) * 100) : 0 },
        booked: { count: booked, percentage: totalWorkers > 0 ? Math.round((booked / totalWorkers) * 100) : 0 },
        activePercentage,
      },
    });
  };

  /**
   * Get recent worker activity (clock-in/clock-out)
   * Supports pagination, search, and date filtering
   */
  getRecentActivity = async (req: AuthRequest, res: Response) => {
    const organizationId = req.user!.organizationId;
    const { 
      page = 1, 
      limit = 10, 
      search, 
      startDate, 
      endDate,
      status,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {
      shift: { organizationId },
      clockInAt: { not: null },
    };

    // Date range filter
    if (startDate || endDate) {
      where.clockInAt = {
        ...(startDate && { gte: new Date(startDate as string) }),
        ...(endDate && { lte: new Date(endDate as string) }),
      };
    }

    // Status filter
    if (status) {
      where.status = status;
    }

    // Search by worker name
    if (search) {
      where.worker = {
        fullName: { contains: search as string, mode: 'insensitive' },
      };
    }

    const [attendance, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        orderBy: { clockInAt: 'desc' },
        skip,
        take: Number(limit),
        include: {
          worker: {
            select: { id: true, fullName: true, profilePicUrl: true },
          },
          shift: {
            select: {
              id: true,
              title: true,
              startAt: true,
              endAt: true,
              clientCompany: { select: { name: true } },
              location: { select: { name: true, address: true } },
            },
          },
        },
      }),
      prisma.attendance.count({ where }),
    ]);

    const activities = attendance.map(a => ({
      id: a.id,
      worker: {
        id: a.worker.id,
        name: a.worker.fullName,
        avatar: a.worker.profilePicUrl,
      },
      clockIn: a.clockInAt,
      clockOut: a.clockOutAt,
      location: a.shift.location?.name 
        ? `${a.shift.location.name}${a.shift.clientCompany?.name ? ', ' + a.shift.clientCompany.name : ''}`
        : a.shift.clientCompany?.name || 'N/A',
      status: a.clockOutAt ? 'Completed' : 'Ongoing',
      shiftId: a.shift.id,
      shiftTitle: a.shift.title,
    }));

    res.json({
      success: true,
      data: {
        activities,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    });
  };

  /**
   * Get shifts overview for dashboard
   */
  getShiftsOverview = async (req: AuthRequest, res: Response) => {
    const organizationId = req.user!.organizationId;
    const { days = 7 } = req.query;

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate.getTime() + Number(days) * 24 * 60 * 60 * 1000);

    const shifts = await prisma.shift.groupBy({
      by: ['status'],
      where: {
        organizationId,
        startAt: { gte: startDate, lt: endDate },
      },
      _count: true,
    });

    const byStatus = shifts.reduce((acc, s) => {
      acc[s.status] = s._count;
      return acc;
    }, {} as Record<string, number>);

    const fillRate = await prisma.shift.findMany({
      where: {
        organizationId,
        startAt: { gte: startDate, lt: endDate },
      },
      select: {
        workersNeeded: true,
        _count: {
          select: { assignments: { where: { status: 'ACCEPTED' } } },
        },
      },
    });

    const totalNeeded = fillRate.reduce((sum, s) => sum + s.workersNeeded, 0);
    const totalFilled = fillRate.reduce((sum, s) => sum + s._count.assignments, 0);

    res.json({
      success: true,
      data: {
        period: { start: startDate, end: endDate, days: Number(days) },
        byStatus,
        fillRate: {
          needed: totalNeeded,
          filled: totalFilled,
          percentage: totalNeeded > 0 ? Math.round((totalFilled / totalNeeded) * 100) : 0,
        },
      },
    });
  };
}
