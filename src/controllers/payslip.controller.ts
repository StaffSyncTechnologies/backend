import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { AppError, NotFoundError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import { z } from 'zod';

// UK Tax rates (2024/25)
const TAX_FREE_ALLOWANCE = 12570;
const BASIC_RATE = 0.20;
const HIGHER_RATE = 0.40;
const BASIC_RATE_THRESHOLD = 50270;

// UK National Insurance rates
const NI_PRIMARY_THRESHOLD_WEEKLY = 242;
const NI_UPPER_EARNINGS_WEEKLY = 967;
const NI_RATE_MAIN = 0.12;
const NI_RATE_UPPER = 0.02;

// Default pension contribution rate
const PENSION_RATE = 0.04;

// Overtime multiplier
const OVERTIME_MULTIPLIER = 1.5;

/**
 * Calculate weekly tax deduction (simplified UK PAYE)
 */
function calculateWeeklyTax(weeklyGross: number): number {
  const weeklyAllowance = TAX_FREE_ALLOWANCE / 52;
  const taxable = Math.max(0, weeklyGross - weeklyAllowance);
  const weeklyBasicThreshold = BASIC_RATE_THRESHOLD / 52;
  
  if (taxable <= weeklyBasicThreshold) {
    return taxable * BASIC_RATE;
  }
  return (weeklyBasicThreshold * BASIC_RATE) + ((taxable - weeklyBasicThreshold) * HIGHER_RATE);
}

/**
 * Calculate weekly NI deduction
 */
function calculateWeeklyNI(weeklyGross: number): number {
  if (weeklyGross <= NI_PRIMARY_THRESHOLD_WEEKLY) return 0;
  
  if (weeklyGross <= NI_UPPER_EARNINGS_WEEKLY) {
    return (weeklyGross - NI_PRIMARY_THRESHOLD_WEEKLY) * NI_RATE_MAIN;
  }
  
  return ((NI_UPPER_EARNINGS_WEEKLY - NI_PRIMARY_THRESHOLD_WEEKLY) * NI_RATE_MAIN) +
         ((weeklyGross - NI_UPPER_EARNINGS_WEEKLY) * NI_RATE_UPPER);
}

/**
 * Get week number in month
 */
function getWeekOfMonth(date: Date): number {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const dayOfMonth = date.getDate();
  const firstDayOfWeek = firstDay.getDay();
  return Math.ceil((dayOfMonth + firstDayOfWeek) / 7);
}

/**
 * Get start and end dates for a pay period
 */
function getPayPeriodDates(periodType: 'WEEKLY' | 'MONTHLY', date: Date = new Date()): { startDate: Date; endDate: Date } {
  const startDate = new Date(date);
  const endDate = new Date(date);

  if (periodType === 'WEEKLY') {
    const day = startDate.getDay();
    const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
    startDate.setDate(diff);
    startDate.setHours(0, 0, 0, 0);
    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);
  } else {
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);
    endDate.setMonth(endDate.getMonth() + 1);
    endDate.setDate(0);
    endDate.setHours(23, 59, 59, 999);
  }

  return { startDate, endDate };
}

/**
 * Format week label like "Week 1 (01 Oct - 07 Oct)"
 */
function formatWeekLabel(startDate: Date, endDate: Date): string {
  const weekNum = getWeekOfMonth(startDate);
  const startDay = startDate.getDate().toString().padStart(2, '0');
  const endDay = endDate.getDate().toString().padStart(2, '0');
  const startMonth = startDate.toLocaleDateString('en-GB', { month: 'short' });
  const endMonth = endDate.toLocaleDateString('en-GB', { month: 'short' });
  return `Week ${weekNum} (${startDay} ${startMonth} - ${endDay} ${endMonth})`;
}

export class PayslipController {
  /**
   * Get payslip list for worker (grouped by month)
   * GET /api/payslips/list
   * Returns total earnings and weekly/monthly payslips grouped by month
   */
  getPayslipList = async (req: AuthRequest, res: Response) => {
    const workerId = req.user!.id;
    const { limit = '12' } = req.query;

    // Get worker details
    const worker = await prisma.user.findUnique({
      where: { id: workerId },
      select: { organizationId: true },
    });

    if (!worker) throw new NotFoundError('Worker');

    // Get organization settings
    const org = await prisma.organization.findUnique({
      where: { id: worker.organizationId },
      select: { payPeriodType: true },
    });

    if (!org) throw new NotFoundError('Organization');

    // Get payslips for this worker (only approved or paid - workers shouldn't see drafts)
    const payslips = await prisma.payslip.findMany({
      where: { 
        workerId,
        status: { in: ['APPROVED', 'PAID'] },
      },
      include: {
        payPeriod: true,
      },
      orderBy: { payPeriod: { startDate: 'desc' } },
      take: parseInt(limit as string),
    });

    // Calculate totals
    const totalGrossPay = payslips.reduce((sum, p) => sum + (p.grossPay ? Number(p.grossPay) : 0), 0);
    const totalNetPay = payslips.reduce((sum, p) => sum + (p.netPay ? Number(p.netPay) : 0), 0);
    const totalTax = payslips.reduce((sum, p) => sum + (p.taxDeduction ? Number(p.taxDeduction) : 0), 0);

    // Group payslips by month
    const byMonth: Record<string, {
      month: string;
      year: number;
      payslips: Array<{
        id: string;
        periodLabel: string;
        periodStart: Date;
        periodEnd: Date;
        status: string;
        grossPay: number;
        netPay: number;
        payDate: Date | null;
      }>;
    }> = {};

    for (const payslip of payslips) {
      const monthKey = `${payslip.payPeriod.startDate.getFullYear()}-${payslip.payPeriod.startDate.getMonth()}`;
      const monthName = payslip.payPeriod.startDate.toLocaleDateString('en-GB', { month: 'long' });
      const year = payslip.payPeriod.startDate.getFullYear();

      if (!byMonth[monthKey]) {
        byMonth[monthKey] = {
          month: monthName,
          year,
          payslips: [],
        };
      }

      const periodLabel = org.payPeriodType === 'WEEKLY'
        ? formatWeekLabel(payslip.payPeriod.startDate, payslip.payPeriod.endDate)
        : `${monthName} ${year}`;

      byMonth[monthKey].payslips.push({
        id: payslip.id,
        periodLabel,
        periodStart: payslip.payPeriod.startDate,
        periodEnd: payslip.payPeriod.endDate,
        status: payslip.status,
        grossPay: payslip.grossPay ? Number(payslip.grossPay) : 0,
        netPay: payslip.netPay ? Number(payslip.netPay) : 0,
        payDate: payslip.paidAt,
      });
    }

    ApiResponse.ok(res, 'Payslip list', {
      summary: {
        totalNetEarnings: Math.round(totalNetPay * 100) / 100,
        totalGrossPay: Math.round(totalGrossPay * 100) / 100,
        totalTax: Math.round(totalTax * 100) / 100,
      },
      months: Object.values(byMonth),
    });
  };

  /**
   * Get detailed payslip receipt
   * GET /api/payslips/:payslipId
   * Returns full payslip with employee details, earnings breakdown, deductions
   */
  getPayslipDetail = async (req: AuthRequest, res: Response) => {
    const { payslipId } = req.params;
    const isAdminOrOps = ['ADMIN', 'OPS_MANAGER', 'SHIFT_COORDINATOR'].includes(req.user!.role);

    // Get payslip with all details
    const payslip = await prisma.payslip.findUnique({
      where: { id: payslipId },
      include: {
        payPeriod: true,
        worker: {
          select: {
            id: true,
            fullName: true,
            email: true,
            niNumber: true,
            taxCode: true,
            workerProfile: {
              select: { holidayBalance: true },
            },
          },
        },
        lineItems: {
          include: {
            shift: {
              select: {
                title: true,
                hourlyRate: true,
              },
            },
            attendance: {
              select: {
                hoursWorked: true,
              },
            },
          },
        },
      },
    });

    if (!payslip) throw new NotFoundError('Payslip');

    // Verify access
    if (!isAdminOrOps && payslip.workerId !== req.user!.id) {
      throw new AppError('Access denied', 403, 'ACCESS_DENIED');
    }

    // Calculate payments from line items (TIME RATE AMOUNT)
    const payments = payslip.lineItems.map(item => {
      const hours = item.hours ? Number(item.hours) : 0;
      const rate = item.rate ? Number(item.rate) : 0;
      const amount = item.amount ? Number(item.amount) : hours * rate;
      return {
        time: Math.round(hours * 100) / 100,
        rate: Math.round(rate * 100) / 100,
        amount: Math.round(amount * 100) / 100,
      };
    });

    const basicPay = payments.reduce((sum: number, p) => sum + p.amount, 0);

    // Benefits (Holiday Pay from worker profile balance if used)
    const holidayBalance = payslip.worker.workerProfile?.holidayBalance 
      ? Number(payslip.worker.workerProfile.holidayBalance) 
      : 0;
    const holidayPayUsed = 0; // TODO: Track actual holiday pay claimed this period
    const benefits = holidayPayUsed > 0 ? [
      { name: 'Holiday Pay', amount: Math.round(holidayPayUsed * 100) / 100 },
    ] : [];
    const totalBenefits = benefits.reduce((sum: number, b) => sum + b.amount, 0);

    // Gross Pay = Basic Pay + Benefits
    const grossPay = payslip.grossPay ? Number(payslip.grossPay) : (basicPay + totalBenefits);

    // Deductions - Tax, NI, Pension
    const taxDeduction = payslip.taxDeduction ? Number(payslip.taxDeduction) : calculateWeeklyTax(grossPay);
    const niDeduction = payslip.niEmployee ? Number(payslip.niEmployee) : calculateWeeklyNI(grossPay);
    const pensionContribution = payslip.otherDeductions 
      ? Number(payslip.otherDeductions) 
      : grossPay * PENSION_RATE;
    const deductions = [
      { name: 'PAYE Tax', amount: Math.round(taxDeduction * 100) / 100 },
      { name: 'National Insurance', amount: Math.round(niDeduction * 100) / 100 },
      { name: 'Pension (4%)', amount: Math.round(pensionContribution * 100) / 100 },
    ];
    const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);

    // Net Pay = Gross Pay - Deductions
    const netPay = payslip.netPay ? Number(payslip.netPay) : (grossPay - totalDeductions);

    // Year to Date calculations (sum of all payslips for this worker this tax year)
    const taxYearStart = new Date();
    taxYearStart.setMonth(3, 6); // April 6th
    if (taxYearStart > new Date()) {
      taxYearStart.setFullYear(taxYearStart.getFullYear() - 1);
    }

    const ytdPayslips = await prisma.payslip.findMany({
      where: {
        workerId: payslip.workerId,
        payPeriod: { startDate: { gte: taxYearStart } },
        status: { in: ['APPROVED', 'PAID'] },
      },
    });

    const ytdGrossPay = ytdPayslips.reduce((sum, p) => sum + (p.grossPay ? Number(p.grossPay) : 0), 0);
    const ytdTaxablePay = ytdGrossPay; // Simplified - same as gross for now
    const ytdTax = ytdPayslips.reduce((sum, p) => sum + (p.taxDeduction ? Number(p.taxDeduction) : 0), 0);
    const ytdEmployeeNI = ytdPayslips.reduce((sum, p) => sum + (p.niEmployee ? Number(p.niEmployee) : 0), 0);
    const ytdEmployerNI = ytdPayslips.reduce((sum, p) => sum + (p.niEmployer ? Number(p.niEmployer) : 0), 0);
    const ytdEmployeePension = ytdPayslips.reduce((sum, p) => sum + (p.otherDeductions ? Number(p.otherDeductions) : 0), 0);
    const ytdEmployerPension = ytdEmployeePension * 0.6; // Employer typically contributes ~3% vs employee 4%

    // Generate employee codes
    const empCode = payslip.worker.id.slice(-6).toUpperCase();
    const payrollNumber = `ABS${payslip.worker.id.slice(0, 4).toUpperCase()}`;

    // Calculate period number (week of year for weekly payslips)
    const periodStart = new Date(payslip.payPeriod.startDate);
    const startOfYear = new Date(periodStart.getFullYear(), 0, 1);
    const periodNumber = Math.ceil(((periodStart.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);

    ApiResponse.ok(res, 'Payslip detail', {
      // Payments section (TIME RATE AMOUNT)
      payments,
      
      // Benefits section
      benefits,
      
      // Deductions section
      deductions,
      
      // Year to Date
      yearToDate: {
        grossPay: Math.round(ytdGrossPay * 100) / 100,
        taxablePay: Math.round(ytdTaxablePay * 100) / 100,
        tax: Math.round(ytdTax * 100) / 100,
        employeeNI: Math.round(ytdEmployeeNI * 100) / 100,
        employerNI: Math.round(ytdEmployerNI * 100) / 100,
        employeePension: Math.round(ytdEmployeePension * 100) / 100,
        employerPension: Math.round(ytdEmployerPension * 100) / 100,
      },
      
      // Summary row
      summary: {
        basicPay: Math.round(basicPay * 100) / 100,
        grossPay: Math.round(grossPay * 100) / 100,
        deductions: Math.round(totalDeductions * 100) / 100,
        netPay: Math.round(netPay * 100) / 100,
      },
      
      // Employee details
      employee: {
        name: payslip.worker.fullName,
        email: payslip.worker.email,
        empCode,
        payrollNumber,
        niNumber: payslip.worker.niNumber || 'Not provided',
        niCode: 'A', // Standard NI code
        taxCode: payslip.worker.taxCode || '1257L',
      },
      
      // Pay period details
      period: {
        number: periodNumber,
        batchNumber: 1,
        payDate: payslip.paidAt,
        payMethod: 'BACS',
        startDate: payslip.payPeriod.startDate,
        endDate: payslip.payPeriod.endDate,
      },
      
      // Payslip status
      status: payslip.status,
    });
  };

  /**
   * Generate payslips for a pay period
   * POST /api/payslips/generate
   * Admin/Ops only - generates payslips for all workers in the organization
   */
  generatePayslips = async (req: AuthRequest, res: Response) => {
    const { periodStart, periodEnd } = z.object({
      periodStart: z.string().optional(),
      periodEnd: z.string().optional(),
    }).parse(req.body);

    // Get organization settings
    const org = await prisma.organization.findUnique({
      where: { id: req.user!.organizationId },
      select: { payPeriodType: true },
    });

    if (!org) throw new NotFoundError('Organization');

    // Calculate current pay period if dates not provided
    let startDate: Date;
    let endDate: Date;
    
    if (periodStart && periodEnd) {
      startDate = new Date(periodStart);
      endDate = new Date(periodEnd);
    } else {
      // Auto-calculate current pay period
      const { startDate: calcStart, endDate: calcEnd } = getPayPeriodDates(org.payPeriodType);
      startDate = calcStart;
      endDate = calcEnd;
    }

    // Create or get pay period
    let payPeriod = await prisma.payPeriod.findFirst({
      where: {
        organizationId: req.user!.organizationId,
        startDate,
        endDate,
      },
    });

    if (!payPeriod) {
      payPeriod = await prisma.payPeriod.create({
        data: {
          organizationId: req.user!.organizationId,
          periodType: org.payPeriodType,
          startDate,
          endDate,
          status: 'OPEN',
        },
      });
    }

    // Get all workers in organization
    const workers = await prisma.user.findMany({
      where: {
        organizationId: req.user!.organizationId,
        role: 'WORKER',
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    let generatedCount = 0;

    // Generate payslip for each worker with attendance in period
    for (const worker of workers) {
      const attendances = await prisma.attendance.findMany({
        where: {
          workerId: worker.id,
          status: 'APPROVED',
          // Capture shifts where worker clocked in within the pay period (e.g., 1st-7th)
          clockInAt: { gte: startDate, lte: endDate },
          clockOutAt: { not: null },
        },
        include: {
          shift: {
            select: { id: true, hourlyRate: true },
          },
        },
      });

      // Get approved annual leave within this pay period
      const approvedLeave = await prisma.leaveRequest.findMany({
        where: {
          workerId: worker.id,
          status: 'APPROVED',
          leaveType: 'ANNUAL',
          // Leave that overlaps with pay period
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
      });

      // Calculate holiday hours within this specific pay period
      let holidayHours = 0;
      for (const leave of approvedLeave) {
        const leaveStart = new Date(leave.startDate) < startDate ? startDate : new Date(leave.startDate);
        const leaveEnd = new Date(leave.endDate) > endDate ? endDate : new Date(leave.endDate);
        
        // Count business days in the overlapping range
        let days = 0;
        const current = new Date(leaveStart);
        while (current <= leaveEnd) {
          const dayOfWeek = current.getDay();
          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            days++;
          }
          current.setDate(current.getDate() + 1);
        }
        holidayHours += days * 8; // 8 hours per day
      }

      // Skip if no attendance and no holiday
      if (attendances.length === 0 && holidayHours === 0) continue;

      // Calculate totals
      const totalHours = attendances.reduce((sum, a) => sum + (a.hoursWorked ? Number(a.hoursWorked) : 0), 0);
      const avgRate = attendances.length > 0 
        ? attendances.reduce((sum, a) => sum + (a.shift.hourlyRate ? Number(a.shift.hourlyRate) : 0), 0) / attendances.length
        : 0;
      
      // Holiday pay uses same hourly rate
      const holidayPay = holidayHours * avgRate;
      const workPay = totalHours * avgRate;
      const grossPay = workPay + holidayPay;
      const taxDeduction = calculateWeeklyTax(grossPay);
      const niEmployee = calculateWeeklyNI(grossPay);
      const pensionDeduction = grossPay * PENSION_RATE;
      const netPay = grossPay - taxDeduction - niEmployee - pensionDeduction;

      // Create payslip
      const payslip = await prisma.payslip.upsert({
        where: {
          payPeriodId_workerId: {
            payPeriodId: payPeriod.id,
            workerId: worker.id,
          },
        },
        create: {
          payPeriodId: payPeriod.id,
          workerId: worker.id,
          totalHours,
          hourlyRate: avgRate,
          holidayHours,
          holidayPay,
          grossPay,
          taxDeduction,
          niEmployee,
          otherDeductions: pensionDeduction,
          netPay,
          status: 'DRAFT',
        },
        update: {
          totalHours,
          hourlyRate: avgRate,
          holidayHours,
          holidayPay,
          grossPay,
          taxDeduction,
          niEmployee,
          otherDeductions: pensionDeduction,
          netPay,
        },
      });

      // Create line items
      await prisma.payslipLineItem.deleteMany({
        where: { payslipId: payslip.id },
      });

      await prisma.payslipLineItem.createMany({
        data: attendances.map(att => ({
          payslipId: payslip.id,
          shiftId: att.shiftId,
          attendanceId: att.id,
          date: att.clockInAt!,
          hours: att.hoursWorked,
          rate: att.shift.hourlyRate,
          amount: (att.hoursWorked ? Number(att.hoursWorked) : 0) * (att.shift.hourlyRate ? Number(att.shift.hourlyRate) : 0),
        })),
      });

      generatedCount++;
    }

    ApiResponse.created(res, `Generated ${generatedCount} payslip(s)`, {
      payPeriodId: payPeriod.id,
      count: generatedCount,
    });
  };

  /**
   * Approve payslip (mark as APPROVED)
   * POST /api/payslips/:payslipId/approve
   */
  approvePayslip = async (req: AuthRequest, res: Response) => {
    const { payslipId } = req.params;

    const payslip = await prisma.payslip.findFirst({
      where: {
        id: payslipId,
        worker: { organizationId: req.user!.organizationId },
        status: 'DRAFT',
      },
      include: { worker: { select: { id: true, fullName: true } } },
    });

    if (!payslip) throw new NotFoundError('Payslip');

    await prisma.payslip.update({
      where: { id: payslipId },
      data: {
        status: 'APPROVED',
        approvedBy: req.user!.id,
      },
    });

    // Send notification to worker
    const worker = await prisma.user.findUnique({
      where: { id: payslip.workerId },
      select: { organizationId: true },
    });
    
    if (worker) {
      await prisma.notification.create({
        data: {
          organizationId: worker.organizationId,
          userId: payslip.workerId,
          type: 'PAYSLIP',
          channel: 'PUSH',
          title: 'Payslip Available',
          message: 'Your payslip has been approved and is now available to view.',
          referenceType: 'payslip',
          referenceId: payslipId,
        },
      });
    }

    ApiResponse.ok(res, 'Payslip approved and worker notified');
  };

  /**
   * Bulk approve payslips
   * POST /api/payslips/bulk-approve
   */
  bulkApprovePayslips = async (req: AuthRequest, res: Response) => {
    const { payslipIds } = z.object({
      payslipIds: z.array(z.string().uuid()),
    }).parse(req.body);

    // Get all draft payslips
    const payslips = await prisma.payslip.findMany({
      where: {
        id: { in: payslipIds },
        worker: { organizationId: req.user!.organizationId },
        status: 'DRAFT',
      },
      select: { id: true, workerId: true },
    });

    if (payslips.length === 0) {
      throw new AppError('No draft payslips found to approve', 400, 'NO_PAYSLIPS');
    }

    // Bulk update to approved
    await prisma.payslip.updateMany({
      where: { id: { in: payslips.map(p => p.id) } },
      data: {
        status: 'APPROVED',
        approvedBy: req.user!.id,
      },
    });

    // Send notifications to all workers
    const workerIds = [...new Set(payslips.map(p => p.workerId))];
    const workers = await prisma.user.findMany({
      where: { id: { in: workerIds } },
      select: { id: true, organizationId: true },
    });
    const workerOrgMap = new Map(workers.map(w => [w.id, w.organizationId]));

    await prisma.notification.createMany({
      data: payslips.map(p => ({
        organizationId: workerOrgMap.get(p.workerId) || req.user!.organizationId,
        userId: p.workerId,
        type: 'PAYSLIP',
        channel: 'PUSH' as const,
        title: 'Payslip Available',
        message: 'Your payslip has been approved and is now available to view.',
        referenceType: 'payslip',
        referenceId: p.id,
      })),
    });

    ApiResponse.ok(res, `${payslips.length} payslip(s) approved and workers notified`, {
      approvedCount: payslips.length,
    });
  };

  /**
   * Get all payslips for admin review (includes DRAFT)
   * GET /api/payslips/admin/pending
   */
  getAdminPayslipList = async (req: AuthRequest, res: Response) => {
    const query = z.object({
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(100).default(20),
      status: z.enum(['DRAFT', 'APPROVED', 'PAID']).optional(),
      payPeriodId: z.string().uuid().optional(),
    }).parse(req.query);

    const skip = (query.page - 1) * query.limit;

    const where: any = {
      worker: { organizationId: req.user!.organizationId },
    };

    if (query.status) where.status = query.status;
    if (query.payPeriodId) where.payPeriodId = query.payPeriodId;

    const [payslips, total] = await Promise.all([
      prisma.payslip.findMany({
        where,
        include: {
          worker: { select: { id: true, fullName: true, email: true } },
          payPeriod: { select: { startDate: true, endDate: true } },
        },
        orderBy: { payPeriod: { startDate: 'desc' } },
        skip,
        take: query.limit,
      }),
      prisma.payslip.count({ where }),
    ]);

    // Count by status
    const statusCounts = await prisma.payslip.groupBy({
      by: ['status'],
      where: { worker: { organizationId: req.user!.organizationId } },
      _count: true,
    });

    const counts = {
      draft: statusCounts.find(s => s.status === 'DRAFT')?._count || 0,
      approved: statusCounts.find(s => s.status === 'APPROVED')?._count || 0,
      paid: statusCounts.find(s => s.status === 'PAID')?._count || 0,
    };

    ApiResponse.ok(res, 'Payslips retrieved', {
      payslips: payslips.map((p: any) => ({
        id: p.id,
        worker: p.worker,
        periodStart: p.payPeriod.startDate,
        periodEnd: p.payPeriod.endDate,
        totalHours: p.totalHours ? Number(p.totalHours) : 0,
        grossPay: p.grossPay ? Number(p.grossPay) : 0,
        netPay: p.netPay ? Number(p.netPay) : 0,
        status: p.status,
      })),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
      counts,
    });
  };

  /**
   * Mark payslip as paid
   * POST /api/payslips/:payslipId/mark-paid
   */
  markPaid = async (req: AuthRequest, res: Response) => {
    const { payslipId } = req.params;

    const payslip = await prisma.payslip.findFirst({
      where: {
        id: payslipId,
        worker: { organizationId: req.user!.organizationId },
        status: 'APPROVED',
      },
    });

    if (!payslip) throw new NotFoundError('Payslip');

    await prisma.payslip.update({
      where: { id: payslipId },
      data: {
        status: 'PAID',
        paidAt: new Date(),
      },
    });

    ApiResponse.ok(res, 'Payslip marked as paid');
  };

  /**
   * Get payslip for current worker (weekly or monthly based on org settings)
   * GET /api/payslips/my-payslip
   * Query: period (current, previous), date (YYYY-MM-DD for specific period)
   */
  getMyPayslip = async (req: AuthRequest, res: Response) => {
    const { period = 'current', date } = req.query;
    const workerId = req.user!.id;

    // Get organization pay period setting
    const org = await prisma.organization.findUnique({
      where: { id: req.user!.organizationId },
      select: { payPeriodType: true },
    });

    if (!org) throw new NotFoundError('Organization');

    const periodType = org.payPeriodType;
    let targetDate = date ? new Date(date as string) : new Date();

    // If previous period requested, go back one week/month
    if (period === 'previous') {
      if (periodType === 'WEEKLY') {
        targetDate.setDate(targetDate.getDate() - 7);
      } else {
        targetDate.setMonth(targetDate.getMonth() - 1);
      }
    }

    const { startDate, endDate } = getPayPeriodDates(periodType, targetDate);

    // Get all approved attendances for this worker in the period
    const attendances = await prisma.attendance.findMany({
      where: {
        workerId,
        status: { in: ['APPROVED', 'PENDING'] },
        clockInAt: { gte: startDate },
        clockOutAt: { lte: endDate },
      },
      include: {
        shift: {
          select: {
            id: true,
            title: true,
            startAt: true,
            endAt: true,
            hourlyRate: true,
            clientCompanyId: true,
            clientCompany: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { clockInAt: 'asc' },
    });

    // Group by client company
    const byClient: Record<string, {
      clientId: string | null;
      clientName: string;
      shifts: Array<{
        shiftId: string;
        title: string;
        date: Date;
        clockIn: Date;
        clockOut: Date | null;
        hours: number;
        rate: number;
        amount: number;
      }>;
      totalHours: number;
      totalAmount: number;
    }> = {};

    for (const att of attendances) {
      const clientId = att.shift.clientCompanyId || 'internal';
      const clientName = att.shift.clientCompany?.name || 'Internal Shifts';
      const hours = att.hoursWorked ? Number(att.hoursWorked) : 0;
      const rate = att.shift.hourlyRate ? Number(att.shift.hourlyRate) : 0;
      const amount = hours * rate;

      if (!byClient[clientId]) {
        byClient[clientId] = {
          clientId: att.shift.clientCompanyId,
          clientName,
          shifts: [],
          totalHours: 0,
          totalAmount: 0,
        };
      }

      byClient[clientId].shifts.push({
        shiftId: att.shift.id,
        title: att.shift.title,
        date: att.clockInAt!,
        clockIn: att.clockInAt!,
        clockOut: att.clockOutAt,
        hours,
        rate,
        amount,
      });

      byClient[clientId].totalHours += hours;
      byClient[clientId].totalAmount += amount;
    }

    const clientBreakdown = Object.values(byClient);
    const grandTotalHours = clientBreakdown.reduce((sum, c) => sum + c.totalHours, 0);
    const grandTotalAmount = clientBreakdown.reduce((sum, c) => sum + c.totalAmount, 0);

    ApiResponse.ok(res, 'Payslip retrieved', {
      periodType,
      periodStart: startDate,
      periodEnd: endDate,
      worker: {
        id: req.user!.id,
        name: req.user!.fullName,
      },
      clientBreakdown,
      summary: {
        totalShifts: attendances.length,
        totalHours: Math.round(grandTotalHours * 100) / 100,
        grossPay: Math.round(grandTotalAmount * 100) / 100,
      },
    });
  };

  /**
   * Get payslip for a specific worker (manager view)
   * GET /api/payslips/worker/:workerId
   */
  getWorkerPayslip = async (req: AuthRequest, res: Response) => {
    const { workerId } = req.params;
    const { period = 'current', date } = req.query;
    const isAdminOrOps = ['ADMIN', 'OPS_MANAGER', 'SHIFT_COORDINATOR'].includes(req.user!.role);

    // Verify access to this worker
    if (!isAdminOrOps) {
      const worker = await prisma.user.findFirst({
        where: { id: workerId, managerId: req.user!.id },
      });
      if (!worker) {
        throw new AppError('Worker not found or not managed by you', 403, 'ACCESS_DENIED');
      }
    }

    // Get worker details
    const worker = await prisma.user.findUnique({
      where: { id: workerId },
      select: { id: true, fullName: true, email: true, organizationId: true },
    });

    if (!worker) throw new NotFoundError('Worker');

    // Get organization pay period setting
    const org = await prisma.organization.findUnique({
      where: { id: worker.organizationId },
      select: { payPeriodType: true },
    });

    if (!org) throw new NotFoundError('Organization');

    const periodType = org.payPeriodType;
    let targetDate = date ? new Date(date as string) : new Date();

    if (period === 'previous') {
      if (periodType === 'WEEKLY') {
        targetDate.setDate(targetDate.getDate() - 7);
      } else {
        targetDate.setMonth(targetDate.getMonth() - 1);
      }
    }

    const { startDate, endDate } = getPayPeriodDates(periodType, targetDate);

    // Get all attendances for this worker in the period
    const attendances = await prisma.attendance.findMany({
      where: {
        workerId,
        clockInAt: { gte: startDate },
        clockOutAt: { lte: endDate },
      },
      include: {
        shift: {
          select: {
            id: true,
            title: true,
            startAt: true,
            endAt: true,
            hourlyRate: true,
            clientCompanyId: true,
            clientCompany: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { clockInAt: 'asc' },
    });

    // Group by client company
    const byClient: Record<string, {
      clientId: string | null;
      clientName: string;
      shifts: Array<{
        shiftId: string;
        title: string;
        date: Date;
        clockIn: Date;
        clockOut: Date | null;
        hours: number;
        rate: number;
        amount: number;
        status: string;
      }>;
      totalHours: number;
      totalAmount: number;
    }> = {};

    for (const att of attendances) {
      const clientId = att.shift.clientCompanyId || 'internal';
      const clientName = att.shift.clientCompany?.name || 'Internal Shifts';
      const hours = att.hoursWorked ? Number(att.hoursWorked) : 0;
      const rate = att.shift.hourlyRate ? Number(att.shift.hourlyRate) : 0;
      const amount = hours * rate;

      if (!byClient[clientId]) {
        byClient[clientId] = {
          clientId: att.shift.clientCompanyId,
          clientName,
          shifts: [],
          totalHours: 0,
          totalAmount: 0,
        };
      }

      byClient[clientId].shifts.push({
        shiftId: att.shift.id,
        title: att.shift.title,
        date: att.clockInAt!,
        clockIn: att.clockInAt!,
        clockOut: att.clockOutAt,
        hours,
        rate,
        amount,
        status: att.status,
      });

      byClient[clientId].totalHours += hours;
      byClient[clientId].totalAmount += amount;
    }

    const clientBreakdown = Object.values(byClient);
    const grandTotalHours = clientBreakdown.reduce((sum, c) => sum + c.totalHours, 0);
    const grandTotalAmount = clientBreakdown.reduce((sum, c) => sum + c.totalAmount, 0);

    ApiResponse.ok(res, 'Worker payslip retrieved', {
      periodType,
      periodStart: startDate,
      periodEnd: endDate,
      worker: {
        id: worker.id,
        name: worker.fullName,
        email: worker.email,
      },
      clientBreakdown,
      summary: {
        totalShifts: attendances.length,
        totalHours: Math.round(grandTotalHours * 100) / 100,
        grossPay: Math.round(grandTotalAmount * 100) / 100,
        approvedShifts: attendances.filter(a => a.status === 'APPROVED').length,
        pendingShifts: attendances.filter(a => a.status === 'PENDING').length,
        flaggedShifts: attendances.filter(a => a.status === 'FLAGGED').length,
      },
    });
  };

  /**
   * Get payslip summary for all managed workers
   * GET /api/payslips/team-summary
   */
  getTeamPayslipSummary = async (req: AuthRequest, res: Response) => {
    const { period = 'current', date } = req.query;
    const isAdminOrOps = ['ADMIN', 'OPS_MANAGER', 'SHIFT_COORDINATOR'].includes(req.user!.role);

    // Get organization pay period setting
    const org = await prisma.organization.findUnique({
      where: { id: req.user!.organizationId },
      select: { payPeriodType: true },
    });

    if (!org) throw new NotFoundError('Organization');

    const periodType = org.payPeriodType;
    let targetDate = date ? new Date(date as string) : new Date();

    if (period === 'previous') {
      if (periodType === 'WEEKLY') {
        targetDate.setDate(targetDate.getDate() - 7);
      } else {
        targetDate.setMonth(targetDate.getMonth() - 1);
      }
    }

    const { startDate, endDate } = getPayPeriodDates(periodType, targetDate);

    // Get workers based on role
    const workerFilter = isAdminOrOps
      ? { organizationId: req.user!.organizationId, role: 'WORKER' as const }
      : { managerId: req.user!.id, role: 'WORKER' as const };

    const workers = await prisma.user.findMany({
      where: workerFilter,
      select: { id: true, fullName: true, email: true },
      orderBy: { fullName: 'asc' },
    });

    const workerIds = workers.map(w => w.id);

    // Get all attendances for these workers in the period
    const attendances = await prisma.attendance.findMany({
      where: {
        workerId: { in: workerIds },
        clockInAt: { gte: startDate },
        clockOutAt: { lte: endDate },
      },
      include: {
        shift: {
          select: {
            hourlyRate: true,
            clientCompanyId: true,
            clientCompany: { select: { name: true } },
          },
        },
      },
    });

    // Build summary per worker
    const workerSummaries = workers.map(worker => {
      const workerAttendances = attendances.filter(a => a.workerId === worker.id);
      
      // Group by client
      const clientHours: Record<string, { name: string; hours: number; amount: number }> = {};
      
      for (const att of workerAttendances) {
        const clientKey = att.shift.clientCompanyId || 'internal';
        const clientName = att.shift.clientCompany?.name || 'Internal';
        const hours = att.hoursWorked ? Number(att.hoursWorked) : 0;
        const rate = att.shift.hourlyRate ? Number(att.shift.hourlyRate) : 0;
        
        if (!clientHours[clientKey]) {
          clientHours[clientKey] = { name: clientName, hours: 0, amount: 0 };
        }
        clientHours[clientKey].hours += hours;
        clientHours[clientKey].amount += hours * rate;
      }

      const totalHours = Object.values(clientHours).reduce((sum, c) => sum + c.hours, 0);
      const totalAmount = Object.values(clientHours).reduce((sum, c) => sum + c.amount, 0);

      return {
        worker,
        totalShifts: workerAttendances.length,
        totalHours: Math.round(totalHours * 100) / 100,
        grossPay: Math.round(totalAmount * 100) / 100,
        byClient: Object.values(clientHours).map(c => ({
          client: c.name,
          hours: Math.round(c.hours * 100) / 100,
          amount: Math.round(c.amount * 100) / 100,
        })),
      };
    });

    const grandTotalHours = workerSummaries.reduce((sum, w) => sum + w.totalHours, 0);
    const grandTotalAmount = workerSummaries.reduce((sum, w) => sum + w.grossPay, 0);

    ApiResponse.ok(res, 'Team payslip summary', {
      periodType,
      periodStart: startDate,
      periodEnd: endDate,
      workers: workerSummaries,
      totals: {
        totalWorkers: workers.length,
        totalShifts: attendances.length,
        totalHours: Math.round(grandTotalHours * 100) / 100,
        totalGrossPay: Math.round(grandTotalAmount * 100) / 100,
      },
    });
  };

  /**
   * Update organization pay period setting
   * PUT /api/payslips/settings
   */
  updatePayPeriodSetting = async (req: AuthRequest, res: Response) => {
    const { payPeriodType } = z.object({
      payPeriodType: z.enum(['WEEKLY', 'MONTHLY']),
    }).parse(req.body);

    await prisma.organization.update({
      where: { id: req.user!.organizationId },
      data: { payPeriodType },
    });

    ApiResponse.ok(res, `Pay period updated to ${payPeriodType.toLowerCase()}`);
  };
}
