import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { AppError, NotFoundError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import { z } from 'zod';

// UK sort code format: XX-XX-XX or XXXXXX
const sortCodeRegex = /^\d{2}-?\d{2}-?\d{2}$/;
// UK account number: 8 digits
const accountNumberRegex = /^\d{8}$/;

const bankAccountSchema = z.object({
  accountHolder: z.string().min(2).max(255),
  bankName: z.string().min(2).max(255),
  sortCode: z.string().regex(sortCodeRegex, 'Sort code must be in XX-XX-XX format'),
  accountNumber: z.string().regex(accountNumberRegex, 'Account number must be 8 digits'),
  buildingSocietyRef: z.string().max(50).optional().nullable(),
});

export class BankAccountController {
  /**
   * Get bank account for the current worker
   * GET /api/v1/bank-account/me
   */
  getMyBankAccount = async (req: AuthRequest, res: Response) => {
    const bankAccount = await prisma.workerBankAccount.findUnique({
      where: { workerId: req.user!.id },
    });

    if (!bankAccount) {
      return ApiResponse.ok(res, 'No bank account found', null);
    }

    // Mask account number for security (show last 4 digits)
    const masked = {
      ...bankAccount,
      accountNumber: '****' + bankAccount.accountNumber.slice(-4),
      sortCode: bankAccount.sortCode,
    };

    ApiResponse.ok(res, 'Bank account retrieved', masked);
  };

  /**
   * Save/update bank account for the current worker (onboarding or self-service)
   * POST /api/v1/bank-account/me
   */
  saveMyBankAccount = async (req: AuthRequest, res: Response) => {
    const data = bankAccountSchema.parse(req.body);

    // Normalise sort code to XX-XX-XX format
    const rawSortCode = data.sortCode.replace(/-/g, '');
    const formattedSortCode = `${rawSortCode.slice(0, 2)}-${rawSortCode.slice(2, 4)}-${rawSortCode.slice(4, 6)}`;

    const bankAccount = await prisma.workerBankAccount.upsert({
      where: { workerId: req.user!.id },
      create: {
        workerId: req.user!.id,
        accountHolder: data.accountHolder,
        bankName: data.bankName,
        sortCode: formattedSortCode,
        accountNumber: data.accountNumber,
        buildingSocietyRef: data.buildingSocietyRef || null,
      },
      update: {
        accountHolder: data.accountHolder,
        bankName: data.bankName,
        sortCode: formattedSortCode,
        accountNumber: data.accountNumber,
        buildingSocietyRef: data.buildingSocietyRef || null,
        isVerified: false, // Reset verification on update
      },
    });

    ApiResponse.ok(res, 'Bank account saved', bankAccount);
  };

  /**
   * List all workers with bank account details (admin/ops)
   * GET /api/v1/bank-account/list
   */
  listAllBankAccounts = async (req: AuthRequest, res: Response) => {
    const { search, status } = req.query;
    const organizationId = req.user!.organizationId;

    const workers = await prisma.user.findMany({
      where: {
        organizationId,
        role: 'WORKER',
        status: 'ACTIVE',
        ...(search && {
          OR: [
            { fullName: { contains: search as string, mode: 'insensitive' } },
            { email: { contains: search as string, mode: 'insensitive' } },
          ],
        }),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        niNumber: true,
        profilePicUrl: true,
        bankAccount: true,
      },
      orderBy: { fullName: 'asc' },
    });

    let result = workers.map((w) => ({
      id: w.id,
      fullName: w.fullName,
      email: w.email,
      phone: w.phone,
      niNumber: w.niNumber,
      profilePicUrl: w.profilePicUrl,
      bankAccount: w.bankAccount
        ? {
            id: w.bankAccount.id,
            accountHolder: w.bankAccount.accountHolder,
            bankName: w.bankAccount.bankName,
            sortCode: w.bankAccount.sortCode,
            accountNumber: w.bankAccount.accountNumber,
            buildingSocietyRef: w.bankAccount.buildingSocietyRef,
            isVerified: w.bankAccount.isVerified,
            createdAt: w.bankAccount.createdAt,
            updatedAt: w.bankAccount.updatedAt,
          }
        : null,
      hasBankAccount: !!w.bankAccount,
      isVerified: w.bankAccount?.isVerified ?? false,
    }));

    // Filter by bank account status if provided
    if (status === 'provided') {
      result = result.filter((w) => w.hasBankAccount);
    } else if (status === 'missing') {
      result = result.filter((w) => !w.hasBankAccount);
    } else if (status === 'verified') {
      result = result.filter((w) => w.isVerified);
    } else if (status === 'unverified') {
      result = result.filter((w) => w.hasBankAccount && !w.isVerified);
    }

    const totalWorkers = workers.length;
    const withBank = workers.filter((w) => w.bankAccount).length;
    const verified = workers.filter((w) => w.bankAccount?.isVerified).length;

    ApiResponse.ok(res, 'Bank accounts listed', {
      workers: result,
      stats: {
        total: totalWorkers,
        withBankAccount: withBank,
        missingBankAccount: totalWorkers - withBank,
        verified,
        unverified: withBank - verified,
      },
    });
  };

  /**
   * Get bank account for a specific worker (admin/ops view)
   * GET /api/v1/bank-account/worker/:workerId
   */
  getWorkerBankAccount = async (req: AuthRequest, res: Response) => {
    const { workerId } = req.params;

    // Verify worker belongs to same organization
    const worker = await prisma.user.findFirst({
      where: { id: workerId, organizationId: req.user!.organizationId, role: 'WORKER' },
    });
    if (!worker) throw new NotFoundError('Worker');

    const bankAccount = await prisma.workerBankAccount.findUnique({
      where: { workerId },
    });

    if (!bankAccount) {
      return ApiResponse.ok(res, 'No bank account on file', null);
    }

    ApiResponse.ok(res, 'Bank account retrieved', bankAccount);
  };

  /**
   * Admin update/save bank account for a worker
   * PUT /api/v1/bank-account/worker/:workerId
   */
  updateWorkerBankAccount = async (req: AuthRequest, res: Response) => {
    const { workerId } = req.params;
    const data = bankAccountSchema.parse(req.body);

    // Verify worker belongs to same organization
    const worker = await prisma.user.findFirst({
      where: { id: workerId, organizationId: req.user!.organizationId, role: 'WORKER' },
    });
    if (!worker) throw new NotFoundError('Worker');

    const rawSortCode = data.sortCode.replace(/-/g, '');
    const formattedSortCode = `${rawSortCode.slice(0, 2)}-${rawSortCode.slice(2, 4)}-${rawSortCode.slice(4, 6)}`;

    const bankAccount = await prisma.workerBankAccount.upsert({
      where: { workerId },
      create: {
        workerId,
        accountHolder: data.accountHolder,
        bankName: data.bankName,
        sortCode: formattedSortCode,
        accountNumber: data.accountNumber,
        buildingSocietyRef: data.buildingSocietyRef || null,
      },
      update: {
        accountHolder: data.accountHolder,
        bankName: data.bankName,
        sortCode: formattedSortCode,
        accountNumber: data.accountNumber,
        buildingSocietyRef: data.buildingSocietyRef || null,
      },
    });

    ApiResponse.ok(res, 'Bank account updated', bankAccount);
  };

  /**
   * Verify a worker's bank account
   * POST /api/v1/bank-account/worker/:workerId/verify
   */
  verifyBankAccount = async (req: AuthRequest, res: Response) => {
    const { workerId } = req.params;

    const bankAccount = await prisma.workerBankAccount.findUnique({
      where: { workerId },
    });
    if (!bankAccount) throw new NotFoundError('Bank account');

    await prisma.workerBankAccount.update({
      where: { workerId },
      data: { isVerified: true },
    });

    ApiResponse.ok(res, 'Bank account verified');
  };

  /**
   * Generate weekly payment sheet CSV for the bank (BACS format)
   * GET /api/v1/bank-account/payment-sheet
   * Query: payPeriodId (optional - defaults to latest APPROVED period)
   *
   * Generates a CSV with columns:
   * Worker Name, Sort Code, Account Number, Amount (Net Pay), Reference
   */
  generatePaymentSheet = async (req: AuthRequest, res: Response) => {
    const { payPeriodId } = req.query;
    const organizationId = req.user!.organizationId;

    // Get the pay period
    let payPeriod;
    if (payPeriodId) {
      payPeriod = await prisma.payPeriod.findFirst({
        where: { id: payPeriodId as string, organizationId },
      });
    } else {
      // Get the latest pay period that has approved payslips
      payPeriod = await prisma.payPeriod.findFirst({
        where: {
          organizationId,
          payslips: { some: { status: { in: ['APPROVED', 'PAID'] } } },
        },
        orderBy: { startDate: 'desc' },
      });
    }

    if (!payPeriod) throw new NotFoundError('Pay period');

    // Get organization details for the reference
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, tradingName: true },
    });

    // Get all approved/paid payslips for this period with bank accounts
    const payslips = await prisma.payslip.findMany({
      where: {
        payPeriodId: payPeriod.id,
        status: { in: ['APPROVED', 'PAID'] },
      },
      include: {
        worker: {
          select: {
            id: true,
            fullName: true,
            email: true,
            niNumber: true,
            bankAccount: true,
          },
        },
      },
      orderBy: { worker: { fullName: 'asc' } },
    });

    if (payslips.length === 0) {
      throw new AppError('No approved payslips found for this period', 400, 'NO_PAYSLIPS');
    }

    // Format period dates
    const periodStart = payPeriod.startDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const periodEnd = payPeriod.endDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const orgName = org?.tradingName || org?.name || 'StaffSync';
    const paymentRef = `${orgName.substring(0, 10).replace(/[^a-zA-Z0-9]/g, '')}-${periodStart.replace(/\//g, '')}`;

    // Build CSV rows
    const csvHeaders = [
      'Worker Name',
      'Email',
      'NI Number',
      'Bank Name',
      'Sort Code',
      'Account Number',
      'Building Society Ref',
      'Total Hours',
      'Hourly Rate',
      'Gross Pay',
      'Tax Deduction',
      'NI Deduction',
      'Other Deductions',
      'Net Pay',
      'Payment Reference',
      'Pay Period',
    ].join(',');

    const csvRows = payslips.map((payslip) => {
      const ba = payslip.worker.bankAccount;
      return [
        `"${payslip.worker.fullName}"`,
        `"${payslip.worker.email}"`,
        `"${payslip.worker.niNumber || ''}"`,
        `"${ba?.bankName || 'NOT PROVIDED'}"`,
        `"${ba?.sortCode || 'NOT PROVIDED'}"`,
        `"${ba?.accountNumber || 'NOT PROVIDED'}"`,
        `"${ba?.buildingSocietyRef || ''}"`,
        payslip.totalHours ? Number(payslip.totalHours).toFixed(2) : '0.00',
        payslip.hourlyRate ? Number(payslip.hourlyRate).toFixed(2) : '0.00',
        payslip.grossPay ? Number(payslip.grossPay).toFixed(2) : '0.00',
        payslip.taxDeduction ? Number(payslip.taxDeduction).toFixed(2) : '0.00',
        payslip.niEmployee ? Number(payslip.niEmployee).toFixed(2) : '0.00',
        payslip.otherDeductions ? Number(payslip.otherDeductions).toFixed(2) : '0.00',
        payslip.netPay ? Number(payslip.netPay).toFixed(2) : '0.00',
        `"${paymentRef}"`,
        `"${periodStart} - ${periodEnd}"`,
      ].join(',');
    });

    // Summary row
    const totalNet = payslips.reduce((sum, p) => sum + (p.netPay ? Number(p.netPay) : 0), 0);
    const totalGross = payslips.reduce((sum, p) => sum + (p.grossPay ? Number(p.grossPay) : 0), 0);
    const totalHours = payslips.reduce((sum, p) => sum + (p.totalHours ? Number(p.totalHours) : 0), 0);
    const missingBankCount = payslips.filter(p => !p.worker.bankAccount).length;

    csvRows.push(''); // blank line
    csvRows.push(`"TOTAL",""," ","","","","",${totalHours.toFixed(2)},"",${totalGross.toFixed(2)},"","","",${totalNet.toFixed(2)},"",""`);

    if (missingBankCount > 0) {
      csvRows.push(`"WARNING: ${missingBankCount} worker(s) missing bank details","","","","","","","","","","","","","","",""`);
    }

    const csv = csvHeaders + '\n' + csvRows.join('\n');

    // Set headers for CSV download
    const fileName = `payment-sheet-${periodStart.replace(/\//g, '-')}-to-${periodEnd.replace(/\//g, '-')}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(csv);
  };

  /**
   * Get payment sheet summary (JSON, for preview before download)
   * GET /api/v1/bank-account/payment-sheet/summary
   */
  getPaymentSheetSummary = async (req: AuthRequest, res: Response) => {
    const { payPeriodId } = req.query;
    const organizationId = req.user!.organizationId;

    let payPeriod;
    if (payPeriodId) {
      payPeriod = await prisma.payPeriod.findFirst({
        where: { id: payPeriodId as string, organizationId },
      });
    } else {
      payPeriod = await prisma.payPeriod.findFirst({
        where: {
          organizationId,
          payslips: { some: { status: { in: ['APPROVED', 'PAID'] } } },
        },
        orderBy: { startDate: 'desc' },
      });
    }

    if (!payPeriod) {
      return ApiResponse.ok(res, 'No pay periods found', null);
    }

    const payslips = await prisma.payslip.findMany({
      where: {
        payPeriodId: payPeriod.id,
        status: { in: ['APPROVED', 'PAID'] },
      },
      include: {
        worker: {
          select: {
            id: true,
            fullName: true,
            bankAccount: {
              select: { id: true, bankName: true, isVerified: true },
            },
          },
        },
      },
    });

    const totalNet = payslips.reduce((sum, p) => sum + (p.netPay ? Number(p.netPay) : 0), 0);
    const totalGross = payslips.reduce((sum, p) => sum + (p.grossPay ? Number(p.grossPay) : 0), 0);
    const withBank = payslips.filter(p => p.worker.bankAccount).length;
    const missingBank = payslips.length - withBank;

    ApiResponse.ok(res, 'Payment sheet summary', {
      payPeriod: {
        id: payPeriod.id,
        startDate: payPeriod.startDate,
        endDate: payPeriod.endDate,
        status: payPeriod.status,
      },
      workerCount: payslips.length,
      withBankDetails: withBank,
      missingBankDetails: missingBank,
      totalGrossPay: Math.round(totalGross * 100) / 100,
      totalNetPay: Math.round(totalNet * 100) / 100,
      workers: payslips.map(p => ({
        id: p.worker.id,
        name: p.worker.fullName,
        netPay: p.netPay ? Math.round(Number(p.netPay) * 100) / 100 : 0,
        hasBankAccount: !!p.worker.bankAccount,
        bankVerified: p.worker.bankAccount?.isVerified || false,
      })),
    });
  };
}
