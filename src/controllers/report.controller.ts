import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { ApiResponse } from '../utils/ApiResponse';
import { AppError } from '../utils/AppError';

export class ReportController {
  // ============================================================
  // WORKFORCE REPORTS
  // ============================================================

  /**
   * Workforce overview report
   * Worker counts, status breakdown, skills distribution
   */
  getWorkforceReport = async (req: AuthRequest, res: Response) => {
    const organizationId = req.user!.organizationId;

    const [
      totalWorkers,
      workersByStatus,
      workersByRtwStatus,
      skillsDistribution,
      recentJoiners,
      workerRetention,
    ] = await Promise.all([
      // Total workers
      prisma.user.count({
        where: { organizationId, role: 'WORKER' },
      }),

      // Workers by status
      prisma.user.groupBy({
        by: ['status'],
        where: { organizationId, role: 'WORKER' },
        _count: true,
      }),

      // Workers by RTW status
      prisma.workerProfile.groupBy({
        by: ['rtwStatus'],
        where: { user: { organizationId, role: 'WORKER' } },
        _count: true,
      }),

      // Skills distribution
      prisma.workerSkill.groupBy({
        by: ['skillId'],
        where: { worker: { organizationId } },
        _count: true,
      }),

      // Recent joiners (last 30 days)
      prisma.user.count({
        where: {
          organizationId,
          role: 'WORKER',
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),

      // Worker retention (active workers who joined > 90 days ago)
      prisma.user.count({
        where: {
          organizationId,
          role: 'WORKER',
          status: 'ACTIVE',
          createdAt: { lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    // Get skill names for distribution
    const skillIds = skillsDistribution.map(s => s.skillId);
    const skills = await prisma.skill.findMany({
      where: { id: { in: skillIds } },
      select: { id: true, name: true },
    });

    const skillsWithNames = skillsDistribution.map(s => ({
      skillId: s.skillId,
      skillName: skills.find(sk => sk.id === s.skillId)?.name || 'Unknown',
      count: s._count,
    }));

    // Calculate percentages
    const statusBreakdown = workersByStatus.map(s => ({
      status: s.status,
      count: s._count,
      percentage: totalWorkers > 0 ? Math.round((s._count / totalWorkers) * 100) : 0,
    }));

    const rtwBreakdown = workersByRtwStatus.map(r => ({
      rtwStatus: r.rtwStatus,
      count: r._count,
      percentage: totalWorkers > 0 ? Math.round((r._count / totalWorkers) * 100) : 0,
    }));

    ApiResponse.ok(res, 'Workforce report retrieved', {
      summary: {
        totalWorkers,
        recentJoiners,
        retainedWorkers: workerRetention,
        retentionRate: totalWorkers > 0 ? Math.round((workerRetention / totalWorkers) * 100) : 0,
      },
      statusBreakdown,
      rtwBreakdown,
      skillsDistribution: skillsWithNames.sort((a, b) => b.count - a.count).slice(0, 10),
    });
  };

  /**
   * Worker reliability report
   * Top performers, attendance rates, no-shows
   */
  getReliabilityReport = async (req: AuthRequest, res: Response) => {
    const organizationId = req.user!.organizationId;
    const { limit = 20 } = req.query;

    const [topPerformers, lowPerformers, overallStats] = await Promise.all([
      // Top performers by reliability score
      prisma.workerReliabilityScore.findMany({
        where: { worker: { organizationId, role: 'WORKER', status: 'ACTIVE' } },
        orderBy: { score: 'desc' },
        take: Number(limit),
        include: {
          worker: {
            select: { id: true, fullName: true, email: true, profilePicUrl: true },
          },
        },
      }),

      // Low performers
      prisma.workerReliabilityScore.findMany({
        where: {
          worker: { organizationId, role: 'WORKER', status: 'ACTIVE' },
          score: { lt: 70 },
        },
        orderBy: { score: 'asc' },
        take: Number(limit),
        include: {
          worker: {
            select: { id: true, fullName: true, email: true },
          },
        },
      }),

      // Overall stats
      prisma.workerReliabilityScore.aggregate({
        where: { worker: { organizationId } },
        _avg: { score: true, acceptanceRate: true },
        _count: true,
      }),
    ]);

    ApiResponse.ok(res, 'Reliability report retrieved', {
      overview: {
        totalScored: overallStats._count,
        avgScore: Math.round(Number(overallStats._avg?.score || 0) * 10) / 10,
        avgAcceptanceRate: Math.round(Number(overallStats._avg?.acceptanceRate || 0) * 10) / 10,
      },
      topPerformers: topPerformers.map(p => ({
        workerId: p.workerId,
        workerName: p.worker.fullName,
        email: p.worker.email,
        profilePic: (p.worker as any).profilePicUrl,
        score: p.score,
        totalShifts: p.totalShifts,
        completedShifts: p.completedShifts,
        noShows: p.noShows,
        lateArrivals: p.lateArrivals,
      })),
      lowPerformers: lowPerformers.map(p => ({
        workerId: p.workerId,
        workerName: p.worker.fullName,
        email: p.worker.email,
        score: p.score,
        totalShifts: p.totalShifts,
        noShows: p.noShows,
        lateArrivals: p.lateArrivals,
      })),
    });
  };

  // ============================================================
  // SHIFT REPORTS
  // ============================================================

  /**
   * Shift analytics report
   * Fill rates, popular times, client breakdown
   */
  getShiftReport = async (req: AuthRequest, res: Response) => {
    const organizationId = req.user!.organizationId;
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    const [
      totalShifts,
      shiftsByStatus,
      shiftsByClient,
      shiftsByDay,
      avgFillTime,
      unfilledShifts,
    ] = await Promise.all([
      // Total shifts in period
      prisma.shift.count({
        where: {
          organizationId,
          startAt: { gte: start, lte: end },
        },
      }),

      // Shifts by status
      prisma.shift.groupBy({
        by: ['status'],
        where: {
          organizationId,
          startAt: { gte: start, lte: end },
        },
        _count: true,
      }),

      // Shifts by client
      prisma.shift.groupBy({
        by: ['clientCompanyId'],
        where: {
          organizationId,
          startAt: { gte: start, lte: end },
          clientCompanyId: { not: null },
        },
        _count: true,
      }),

      // Shifts by day of week
      prisma.$queryRaw`
        SELECT 
          EXTRACT(DOW FROM start_at) as day_of_week,
          COUNT(*) as count
        FROM shift
        WHERE organization_id = ${organizationId}
          AND start_at >= ${start}
          AND start_at <= ${end}
        GROUP BY EXTRACT(DOW FROM start_at)
        ORDER BY day_of_week
      ` as Promise<Array<{ day_of_week: number; count: bigint }>>,

      // Average fill time (time between creation and first assignment)
      prisma.$queryRaw`
        SELECT AVG(EXTRACT(EPOCH FROM (sa.created_at - s.created_at)) / 3600) as avg_hours
        FROM shift s
        JOIN shift_assignment sa ON s.id = sa.shift_id
        WHERE s.organization_id = ${organizationId}
          AND s.created_at >= ${start}
          AND s.created_at <= ${end}
          AND sa.status = 'ACCEPTED'
      ` as Promise<Array<{ avg_hours: number }>>,

      // Unfilled shifts
      prisma.shift.count({
        where: {
          organizationId,
          startAt: { gte: start, lte: end },
          status: 'OPEN',
        },
      }),
    ]);

    // Get client names
    const clientIds = shiftsByClient.map(s => s.clientCompanyId).filter(Boolean) as string[];
    const clients = await prisma.clientCompany.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, name: true },
    });

    const clientBreakdown = shiftsByClient.map(s => ({
      clientId: s.clientCompanyId,
      clientName: clients.find(c => c.id === s.clientCompanyId)?.name || 'Unknown',
      shiftCount: s._count,
      percentage: totalShifts > 0 ? Math.round((s._count / totalShifts) * 100) : 0,
    }));

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayBreakdown = shiftsByDay.map(d => ({
      day: dayNames[Number(d.day_of_week)],
      count: Number(d.count),
    }));

    const filledShifts = shiftsByStatus.find(s => s.status === 'FILLED')?._count || 0;
    const fillRate = totalShifts > 0 ? Math.round((filledShifts / totalShifts) * 100) : 0;

    ApiResponse.ok(res, 'Shift report retrieved', {
      period: { start, end },
      summary: {
        totalShifts,
        filledShifts,
        unfilledShifts,
        fillRate,
        avgFillTimeHours: Math.round((avgFillTime[0]?.avg_hours || 0) * 10) / 10,
      },
      statusBreakdown: shiftsByStatus.map(s => ({
        status: s.status,
        count: s._count,
        percentage: totalShifts > 0 ? Math.round((s._count / totalShifts) * 100) : 0,
      })),
      clientBreakdown: clientBreakdown.sort((a, b) => b.shiftCount - a.shiftCount).slice(0, 10),
      dayBreakdown,
    });
  };

  // ============================================================
  // ATTENDANCE REPORTS
  // ============================================================

  /**
   * Attendance analytics report
   * Punctuality, flagged records, hours worked
   */
  getAttendanceReport = async (req: AuthRequest, res: Response) => {
    const organizationId = req.user!.organizationId;
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    const [
      totalRecords,
      recordsByStatus,
      flaggedByReason,
      totalHoursWorked,
      avgHoursPerShift,
      lateArrivals,
      earlyDepartures,
    ] = await Promise.all([
      // Total attendance records
      prisma.attendance.count({
        where: {
          shift: { organizationId },
          clockInAt: { gte: start, lte: end },
        },
      }),

      // Records by status
      prisma.attendance.groupBy({
        by: ['status'],
        where: {
          shift: { organizationId },
          clockInAt: { gte: start, lte: end },
        },
        _count: true,
      }),

      // Flagged records by reason
      prisma.attendance.groupBy({
        by: ['flagReason'],
        where: {
          shift: { organizationId },
          clockInAt: { gte: start, lte: end },
          status: 'FLAGGED',
        },
        _count: true,
      }),

      // Total hours worked
      prisma.attendance.aggregate({
        where: {
          shift: { organizationId },
          clockInAt: { gte: start, lte: end },
          hoursWorked: { not: null },
        },
        _sum: { hoursWorked: true },
      }),

      // Average hours per shift
      prisma.attendance.aggregate({
        where: {
          shift: { organizationId },
          clockInAt: { gte: start, lte: end },
          hoursWorked: { not: null },
        },
        _avg: { hoursWorked: true },
      }),

      // Late arrivals count
      prisma.attendance.count({
        where: {
          shift: { organizationId },
          clockInAt: { gte: start, lte: end },
          flagReason: { in: ['LATE', 'LATE_CLOCK_IN'] },
        },
      }),

      // Early departures
      prisma.attendance.count({
        where: {
          shift: { organizationId },
          clockInAt: { gte: start, lte: end },
          flagReason: { in: ['EARLY_LEAVE', 'EARLY_CLOCK_OUT'] },
        },
      }),
    ]);

    const approvedRecords = recordsByStatus.find(r => r.status === 'APPROVED')?._count || 0;
    const flaggedRecords = recordsByStatus.find(r => r.status === 'FLAGGED')?._count || 0;

    ApiResponse.ok(res, 'Attendance report retrieved', {
      period: { start, end },
      summary: {
        totalRecords,
        approvedRecords,
        flaggedRecords,
        approvalRate: totalRecords > 0 ? Math.round((approvedRecords / totalRecords) * 100) : 0,
        totalHoursWorked: Math.round(Number(totalHoursWorked._sum.hoursWorked || 0) * 10) / 10,
        avgHoursPerShift: Math.round(Number(avgHoursPerShift._avg.hoursWorked || 0) * 10) / 10,
      },
      punctuality: {
        lateArrivals,
        earlyDepartures,
        punctualityRate: totalRecords > 0 ? Math.round(((totalRecords - lateArrivals) / totalRecords) * 100) : 0,
      },
      statusBreakdown: recordsByStatus.map(r => ({
        status: r.status,
        count: r._count,
        percentage: totalRecords > 0 ? Math.round((r._count / totalRecords) * 100) : 0,
      })),
      flagReasons: flaggedByReason.map(f => ({
        reason: f.flagReason,
        count: f._count,
      })),
    });
  };

  // ============================================================
  // PAYROLL REPORTS
  // ============================================================

  /**
   * Payroll summary report
   * Total payroll, averages, breakdown by period
   */
  getPayrollReport = async (req: AuthRequest, res: Response) => {
    const organizationId = req.user!.organizationId;
    const { year } = req.query;

    const targetYear = year ? Number(year) : new Date().getFullYear();
    const startOfYear = new Date(targetYear, 0, 1);
    const endOfYear = new Date(targetYear, 11, 31, 23, 59, 59);

    const [
      payPeriods,
      totalPayroll,
      payslipsByStatus,
      avgPayPerWorker,
      topEarners,
      monthlyBreakdown,
    ] = await Promise.all([
      // Pay periods in year
      prisma.payPeriod.findMany({
        where: {
          organizationId,
          startDate: { gte: startOfYear },
          endDate: { lte: endOfYear },
        },
        orderBy: { startDate: 'desc' },
        include: {
          _count: { select: { payslips: true } },
        },
      }),

      // Total payroll amount
      prisma.payslip.aggregate({
        where: {
          payPeriod: {
            organizationId,
            startDate: { gte: startOfYear },
            endDate: { lte: endOfYear },
          },
        },
        _sum: { netPay: true, grossPay: true },
        _count: true,
      }),

      // Payslips by status
      prisma.payslip.groupBy({
        by: ['status'],
        where: {
          payPeriod: {
            organizationId,
            startDate: { gte: startOfYear },
            endDate: { lte: endOfYear },
          },
        },
        _count: true,
        _sum: { netPay: true },
      }),

      // Average pay per worker
      prisma.payslip.aggregate({
        where: {
          payPeriod: {
            organizationId,
            startDate: { gte: startOfYear },
            endDate: { lte: endOfYear },
          },
        },
        _avg: { netPay: true, grossPay: true, totalHours: true },
      }),

      // Top earners
      prisma.payslip.groupBy({
        by: ['workerId'],
        where: {
          payPeriod: {
            organizationId,
            startDate: { gte: startOfYear },
            endDate: { lte: endOfYear },
          },
        },
        _sum: { netPay: true, totalHours: true },
        orderBy: { _sum: { netPay: 'desc' } },
        take: 10,
      }),

      // Monthly breakdown
      prisma.$queryRaw`
        SELECT 
          EXTRACT(MONTH FROM p.created_at) as month,
          SUM(p.net_pay) as total_net,
          SUM(p.gross_pay) as total_gross,
          COUNT(*) as payslip_count
        FROM payslip p
        JOIN pay_period pp ON p.pay_period_id = pp.id
        WHERE pp.organization_id = ${organizationId}
          AND p.created_at >= ${startOfYear}
          AND p.created_at <= ${endOfYear}
        GROUP BY EXTRACT(MONTH FROM p.created_at)
        ORDER BY month
      ` as Promise<Array<{ month: number; total_net: number; total_gross: number; payslip_count: bigint }>>,
    ]);

    // Get worker names for top earners
    const workerIds = topEarners.map(e => e.workerId);
    const workers = await prisma.user.findMany({
      where: { id: { in: workerIds } },
      select: { id: true, fullName: true },
    });

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    ApiResponse.ok(res, 'Payroll report retrieved', {
      year: targetYear,
      summary: {
        totalPayPeriods: payPeriods.length,
        totalPayslips: totalPayroll._count,
        totalGrossPay: Math.round(Number(totalPayroll._sum?.grossPay || 0) * 100) / 100,
        totalNetPay: Math.round(Number(totalPayroll._sum?.netPay || 0) * 100) / 100,
        avgNetPayPerWorker: Math.round(Number(avgPayPerWorker._avg?.netPay || 0) * 100) / 100,
        avgHoursPerPayslip: Math.round(Number(avgPayPerWorker._avg?.totalHours || 0) * 10) / 10,
      },
      statusBreakdown: payslipsByStatus.map(s => ({
        status: s.status,
        count: s._count,
        totalNet: Math.round(Number(s._sum?.netPay || 0) * 100) / 100,
      })),
      topEarners: topEarners.map(e => ({
        workerId: e.workerId,
        workerName: workers.find(w => w.id === e.workerId)?.fullName || 'Unknown',
        totalNetPay: Math.round(Number(e._sum?.netPay || 0) * 100) / 100,
        totalHours: Math.round(Number(e._sum?.totalHours || 0) * 10) / 10,
      })),
      monthlyBreakdown: monthlyBreakdown.map(m => ({
        month: monthNames[Number(m.month) - 1],
        totalGross: Math.round(Number(m.total_gross || 0) * 100) / 100,
        totalNet: Math.round(Number(m.total_net || 0) * 100) / 100,
        payslipCount: Number(m.payslip_count),
      })),
      recentPayPeriods: payPeriods.slice(0, 5).map(p => ({
        id: p.id,
        startDate: p.startDate,
        endDate: p.endDate,
        status: p.status,
        payslipCount: p._count.payslips,
      })),
    });
  };

  // ============================================================
  // CLIENT REPORTS
  // ============================================================

  /**
   * Client analytics report
   * Revenue, shift volume, worker utilization per client
   */
  getClientReport = async (req: AuthRequest, res: Response) => {
    const organizationId = req.user!.organizationId;
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    const [
      totalClients,
      activeClients,
      clientsByStatus,
      clientShiftVolume,
      clientHours,
    ] = await Promise.all([
      // Total clients
      prisma.clientCompany.count({
        where: { organizationId },
      }),

      // Active clients (with shifts in period)
      prisma.clientCompany.count({
        where: {
          organizationId,
          shifts: {
            some: {
              startAt: { gte: start, lte: end },
            },
          },
        },
      }),

      // Clients by status
      prisma.clientCompany.groupBy({
        by: ['status'],
        where: { organizationId },
        _count: true,
      }),

      // Shift volume per client
      prisma.shift.groupBy({
        by: ['clientCompanyId'],
        where: {
          organizationId,
          clientCompanyId: { not: null },
          startAt: { gte: start, lte: end },
        },
        _count: true,
      }),

      // Hours worked per client
      prisma.$queryRaw`
        SELECT 
          s.client_company_id,
          SUM(a.hours_worked) as total_hours,
          COUNT(DISTINCT a.worker_id) as unique_workers
        FROM attendance a
        JOIN shift s ON a.shift_id = s.id
        WHERE s.organization_id = ${organizationId}
          AND s.client_company_id IS NOT NULL
          AND a.clock_in_at >= ${start}
          AND a.clock_in_at <= ${end}
        GROUP BY s.client_company_id
      ` as Promise<Array<{ client_company_id: string; total_hours: number; unique_workers: bigint }>>,
    ]);

    // Get client details
    const clientIds = [
      ...new Set([
        ...clientShiftVolume.map(c => c.clientCompanyId),
        ...clientHours.map(c => c.client_company_id),
      ]),
    ].filter(Boolean) as string[];

    const clients = await prisma.clientCompany.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, name: true, status: true, industry: true },
    });

    // Combine data
    const clientAnalytics = clients.map(client => {
      const shifts = clientShiftVolume.find(c => c.clientCompanyId === client.id);
      const hours = clientHours.find(c => c.client_company_id === client.id);
      return {
        clientId: client.id,
        clientName: client.name,
        status: client.status,
        industry: client.industry,
        shiftCount: shifts?._count || 0,
        totalHours: Math.round(Number(hours?.total_hours || 0) * 10) / 10,
        uniqueWorkers: Number(hours?.unique_workers || 0),
      };
    }).sort((a, b) => b.shiftCount - a.shiftCount);

    ApiResponse.ok(res, 'Client report retrieved', {
      period: { start, end },
      summary: {
        totalClients,
        activeClients,
        inactiveClients: totalClients - activeClients,
        activityRate: totalClients > 0 ? Math.round((activeClients / totalClients) * 100) : 0,
      },
      statusBreakdown: clientsByStatus.map(c => ({
        status: c.status,
        count: c._count,
        percentage: totalClients > 0 ? Math.round((c._count / totalClients) * 100) : 0,
      })),
      clientAnalytics: clientAnalytics.slice(0, 20),
      topClientsByShifts: clientAnalytics.slice(0, 5),
      topClientsByHours: [...clientAnalytics].sort((a, b) => b.totalHours - a.totalHours).slice(0, 5),
    });
  };

  // ============================================================
  // COMPLIANCE REPORTS
  // ============================================================

  /**
   * Compliance overview report
   * Document status, RTW verification, expiring documents
   */
  getComplianceReport = async (req: AuthRequest, res: Response) => {
    const organizationId = req.user!.organizationId;

    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const [
      totalWorkers,
      rtwBreakdown,
      documentsExpiringSoon,
      documentsByType,
      pendingVerification,
      blockedWorkers,
    ] = await Promise.all([
      // Total workers
      prisma.user.count({
        where: { organizationId, role: 'WORKER' },
      }),

      // RTW status breakdown
      prisma.workerProfile.groupBy({
        by: ['rtwStatus'],
        where: { user: { organizationId, role: 'WORKER' } },
        _count: true,
      }),

      // Documents expiring in next 30 days
      prisma.workerDocument.findMany({
        where: {
          worker: { organizationId },
          expiresAt: { gte: new Date(), lte: thirtyDaysFromNow },
        },
        include: {
          worker: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { expiresAt: 'asc' },
      }),

      // Documents by type
      prisma.workerDocument.groupBy({
        by: ['type'],
        where: { worker: { organizationId } },
        _count: true,
      }),

      // Pending document verification
      prisma.workerDocument.count({
        where: {
          worker: { organizationId },
          status: 'PENDING',
        },
      }),

      // Currently blocked workers
      prisma.workerBlock.count({
        where: {
          worker: { organizationId },
          status: 'ACTIVE',
        },
      }),
    ]);

    const verifiedRtw = rtwBreakdown.find(r => r.rtwStatus === 'APPROVED')?._count || 0;
    const complianceRate = totalWorkers > 0 ? Math.round((verifiedRtw / totalWorkers) * 100) : 0;

    ApiResponse.ok(res, 'Compliance report retrieved', {
      summary: {
        totalWorkers,
        verifiedRtw,
        complianceRate,
        pendingVerification,
        blockedWorkers,
        documentsExpiringSoon: documentsExpiringSoon.length,
      },
      rtwBreakdown: rtwBreakdown.map(r => ({
        status: r.rtwStatus,
        count: r._count,
        percentage: totalWorkers > 0 ? Math.round((r._count / totalWorkers) * 100) : 0,
      })),
      documentsByType: documentsByType.map(d => ({
        type: d.type,
        count: d._count,
      })),
      expiringDocuments: documentsExpiringSoon.map(d => ({
        documentId: d.id,
        type: d.type,
        title: d.title,
        expiresAt: d.expiresAt,
        workerId: d.worker.id,
        workerName: d.worker.fullName,
        workerEmail: d.worker.email,
        daysUntilExpiry: Math.ceil((d.expiresAt!.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
      })),
    });
  };

  // ============================================================
  // EXECUTIVE SUMMARY
  // ============================================================

  /**
   * Executive summary report
   * High-level KPIs for leadership
   */
  getExecutiveSummary = async (req: AuthRequest, res: Response) => {
    const organizationId = req.user!.organizationId;
    const { period = '30' } = req.query;

    const days = Number(period);
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const previousStart = new Date(startDate.getTime() - days * 24 * 60 * 60 * 1000);

    // Current period stats
    const [
      currentWorkers,
      currentShifts,
      currentHours,
      currentRevenue,
    ] = await Promise.all([
      prisma.user.count({
        where: { organizationId, role: 'WORKER', status: 'ACTIVE' },
      }),
      prisma.shift.count({
        where: { organizationId, startAt: { gte: startDate } },
      }),
      prisma.attendance.aggregate({
        where: { shift: { organizationId }, clockInAt: { gte: startDate } },
        _sum: { hoursWorked: true },
      }),
      prisma.payslip.aggregate({
        where: { payPeriod: { organizationId, startDate: { gte: startDate } } },
        _sum: { grossPay: true },
      }),
    ]);

    // Previous period stats for comparison
    const [
      prevWorkers,
      prevShifts,
      prevHours,
    ] = await Promise.all([
      prisma.user.count({
        where: {
          organizationId,
          role: 'WORKER',
          status: 'ACTIVE',
          createdAt: { lt: startDate },
        },
      }),
      prisma.shift.count({
        where: { organizationId, startAt: { gte: previousStart, lt: startDate } },
      }),
      prisma.attendance.aggregate({
        where: { shift: { organizationId }, clockInAt: { gte: previousStart, lt: startDate } },
        _sum: { hoursWorked: true },
      }),
    ]);

    const calcChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const currentHoursNum = Number(currentHours._sum?.hoursWorked || 0);
    const prevHoursNum = Number(prevHours._sum?.hoursWorked || 0);

    ApiResponse.ok(res, 'Executive summary retrieved', {
      period: { days, startDate, endDate: new Date() },
      kpis: [
        {
          name: 'Active Workers',
          value: currentWorkers,
          change: calcChange(currentWorkers, prevWorkers),
          trend: currentWorkers >= prevWorkers ? 'up' : 'down',
        },
        {
          name: 'Shifts Created',
          value: currentShifts,
          change: calcChange(currentShifts, prevShifts),
          trend: currentShifts >= prevShifts ? 'up' : 'down',
        },
        {
          name: 'Hours Worked',
          value: Math.round(currentHoursNum),
          change: calcChange(currentHoursNum, prevHoursNum),
          trend: currentHoursNum >= prevHoursNum ? 'up' : 'down',
        },
        {
          name: 'Gross Payroll',
          value: Math.round(Number(currentRevenue._sum?.grossPay || 0)),
          change: 0, // Would need previous period payroll
          trend: 'neutral',
          format: 'currency',
        },
      ],
    });
  };
}
