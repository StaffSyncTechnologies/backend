import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { AppError, NotFoundError } from '../utils/AppError';
import { rtwService } from '../services/rtw';
import { NotificationService } from '../services/notifications';
import { WorkerProfile } from '@prisma/client';

export class ComplianceController {
  /**
   * Get compliance dashboard stats
   * GET /api/v1/compliance/stats
   */
  getStats = async (req: AuthRequest, res: Response) => {
    const orgId = req.user!.organizationId;

    const [total, pending, approved, rejected, expired, requiresReview] = await Promise.all([
      prisma.workerProfile.count({
        where: { user: { organizationId: orgId, role: 'WORKER' } },
      }),
      prisma.workerProfile.count({
        where: { user: { organizationId: orgId, role: 'WORKER' }, rtwStatus: 'PENDING' },
      }),
      prisma.workerProfile.count({
        where: { user: { organizationId: orgId, role: 'WORKER' }, rtwStatus: 'APPROVED' },
      }),
      prisma.workerProfile.count({
        where: { user: { organizationId: orgId, role: 'WORKER' }, rtwStatus: 'REJECTED' },
      }),
      prisma.workerProfile.count({
        where: { user: { organizationId: orgId, role: 'WORKER' }, rtwStatus: 'EXPIRED' },
      }),
      prisma.workerProfile.count({
        where: { user: { organizationId: orgId, role: 'WORKER' }, rtwStatus: 'REQUIRES_REVIEW' },
      }),
    ]);

    // Get expiring soon (within 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const expiringSoon = await prisma.workerProfile.count({
      where: {
        user: { organizationId: orgId, role: 'WORKER' },
        rtwStatus: 'APPROVED',
        rtwExpiresAt: {
          lte: thirtyDaysFromNow,
          gte: new Date(),
        },
      },
    });

    res.json({
      success: true,
      data: {
        total,
        pending,
        approved,
        rejected,
        expired,
        requiresReview,
        expiringSoon,
        notStarted: total - pending - approved - rejected - expired - requiresReview,
      },
    });
  };

  /**
   * List workers for compliance review
   * GET /api/v1/compliance/workers
   */
  listWorkers = async (req: AuthRequest, res: Response) => {
    const orgId = req.user!.organizationId;
    const { status, search, page = '1', limit = '10' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      user: {
        organizationId: orgId,
        role: 'WORKER',
      },
    };

    if (status && status !== 'ALL') {
      where.rtwStatus = status;
    }

    if (search) {
      where.user = {
        ...where.user,
        OR: [
          { fullName: { contains: search as string, mode: 'insensitive' } },
          { email: { contains: search as string, mode: 'insensitive' } },
        ],
      };
    }

    const [workers, total] = await Promise.all([
      prisma.workerProfile.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: [
          { rtwStatus: 'asc' },
          { createdAt: 'desc' },
        ],
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
              status: true,
              createdAt: true,
              orgRTWs: {
                where: { organizationId: orgId },
                take: 1,
              },
            },
          },
          rtwChecker: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      }),
      prisma.workerProfile.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        workers: workers.map((w) => {
          const orgRtw = w.user.orgRTWs?.[0];
          return {
            id: w.userId,
            fullName: w.user.fullName,
            email: w.user.email,
            phone: w.user.phone,
            status: w.user.status,
            rtwStatus: orgRtw?.status || w.rtwStatus,
            rtwShareCode: w.rtwShareCode || orgRtw?.shareCode || null,
            rtwCheckedAt: w.rtwCheckedAt || orgRtw?.checkedAt || null,
            rtwExpiresAt: w.rtwExpiresAt || orgRtw?.expiresAt || null,
            rtwAuditNote: w.rtwAuditNote || orgRtw?.auditNote || null,
            rtwCheckedBy: w.rtwChecker
              ? (w.rtwChecker.id === w.userId ? 'Self Service' : w.rtwChecker.fullName)
              : null,
            onboardingStatus: w.onboardingStatus,
            createdAt: w.user.createdAt,
          };
        }),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  };

  /**
   * Verify RTW using API (share code + DOB)
   * POST /api/v1/compliance/workers/:workerId/verify-api
   */
  verifyRTWApi = async (req: AuthRequest, res: Response) => {
    const { workerId } = req.params;
    const { shareCode, dateOfBirth } = req.body;
    const orgId = req.user!.organizationId;

    if (!shareCode || !dateOfBirth) {
      throw new AppError('Share code and date of birth are required', 400);
    }

    // Verify worker belongs to org
    const worker = await prisma.user.findFirst({
      where: { id: workerId, organizationId: orgId, role: 'WORKER' },
      include: { workerProfile: true },
    });

    if (!worker) {
      throw new NotFoundError('Worker');
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
    let rtwStatus: 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'REQUIRES_REVIEW';
    if (result.verified && result.status === 'VALID') {
      rtwStatus = 'APPROVED';
    } else if (result.status === 'EXPIRED') {
      rtwStatus = 'EXPIRED';
    } else if (result.status === 'NOT_FOUND') {
      rtwStatus = 'REQUIRES_REVIEW';
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
        rtwCheckedBy: req.user!.id,
        rtwExpiresAt: result.expiryDate,
        rtwAuditNote: result.verified
          ? `API Verified: ${result.workRestriction || 'UNLIMITED'} - ${result.nationality || 'N/A'}`
          : `API Check Failed: ${result.errorMessage}`,
        rtwAuditUrl: result.referenceNumber
          ? rtwService.generateAuditUrl(result.referenceNumber)
          : undefined,
      },
    });

    // If approved, update onboarding status
    if (rtwStatus === 'APPROVED') {
      await prisma.workerProfile.update({
        where: { userId: workerId },
        data: { onboardingStatus: 'COMPLETE' },
      });

      // Activate worker if they were pending
      if (worker.status === 'PENDING') {
        await prisma.user.update({
          where: { id: workerId },
          data: { status: 'ACTIVE' },
        });
      }
    }

    // Notify worker about RTW verification result
    await NotificationService.send({
      userId: workerId,
      title: rtwStatus === 'APPROVED' ? 'Right to Work Approved' : 'Right to Work Update',
      body: rtwStatus === 'APPROVED'
        ? 'Your right to work has been verified. You can now accept shifts!'
        : rtwStatus === 'REJECTED'
          ? 'Your right to work verification was not successful. Please contact your agency.'
          : 'Your right to work status has been updated. Please check your profile for details.',
      type: rtwStatus === 'APPROVED' ? 'RTW_APPROVED' : 'RTW_REJECTED',
      channels: ['push'],
      data: { action: 'VIEW_RTW', rtwStatus },
    });

    res.json({
      success: result.verified,
      data: {
        workerId,
        rtwStatus: profile.rtwStatus,
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

  /**
   * Manual RTW approval/rejection
   * POST /api/v1/compliance/workers/:workerId/verify-manual
   */
  verifyRTWManual = async (req: AuthRequest, res: Response) => {
    const { workerId } = req.params;
    const { status, auditNote, expiresAt, documentType } = req.body;
    const orgId = req.user!.organizationId;

    if (!status || !['APPROVED', 'REJECTED', 'REQUIRES_REVIEW'].includes(status)) {
      throw new AppError('Valid status is required (APPROVED, REJECTED, or REQUIRES_REVIEW)', 400);
    }

    if (status === 'APPROVED' && !auditNote) {
      throw new AppError('Audit note is required for manual approval', 400);
    }

    // Verify worker belongs to org
    const worker = await prisma.user.findFirst({
      where: { id: workerId, organizationId: orgId, role: 'WORKER' },
      include: { workerProfile: true },
    });

    if (!worker) {
      throw new NotFoundError('Worker');
    }

    // Update worker profile
    const profile = await prisma.workerProfile.update({
      where: { userId: workerId },
      data: {
        rtwStatus: status,
        rtwCheckedAt: new Date(),
        rtwCheckedBy: req.user!.id,
        rtwExpiresAt: expiresAt ? new Date(expiresAt) : null,
        rtwAuditNote: `Manual ${status}: ${auditNote}${documentType ? ` (${documentType})` : ''}`,
      },
    });

    // If approved, update onboarding status and activate worker
    if (status === 'APPROVED') {
      await prisma.workerProfile.update({
        where: { userId: workerId },
        data: { onboardingStatus: 'COMPLETE' },
      });

      if (worker.status === 'PENDING') {
        await prisma.user.update({
          where: { id: workerId },
          data: { status: 'ACTIVE' },
        });
      }
    }

    // Notify worker about RTW decision
    await NotificationService.send({
      userId: workerId,
      title: status === 'APPROVED' ? 'Right to Work Approved' : status === 'REJECTED' ? 'Right to Work Rejected' : 'Right to Work Needs Review',
      body: status === 'APPROVED'
        ? 'Your right to work has been approved. You can now accept shifts!'
        : status === 'REJECTED'
          ? 'Your right to work verification was rejected. Please contact your agency.'
          : 'Your right to work requires additional review. Please check your profile.',
      type: status === 'APPROVED' ? 'RTW_APPROVED' : 'RTW_REJECTED',
      channels: ['push'],
      data: { action: 'VIEW_RTW', rtwStatus: status },
    });

    res.json({
      success: true,
      message: `Worker RTW ${status.toLowerCase()} successfully`,
      data: {
        workerId,
        rtwStatus: profile.rtwStatus,
        rtwCheckedAt: profile.rtwCheckedAt,
        rtwAuditNote: profile.rtwAuditNote,
      },
    });
  };

  /**
   * Get single worker RTW details
   * GET /api/v1/compliance/workers/:workerId
   */
  getWorkerRTW = async (req: AuthRequest, res: Response) => {
    const { workerId } = req.params;
    const orgId = req.user!.organizationId;

    const worker = await prisma.user.findFirst({
      where: { id: workerId, organizationId: orgId, role: 'WORKER' },
    });

    if (!worker) {
      throw new NotFoundError('Worker');
    }

    const [profile, orgRtw, documents] = await Promise.all([
      prisma.workerProfile.findUnique({
        where: { userId: workerId },
        include: {
          rtwChecker: {
            select: { id: true, fullName: true },
          },
        },
      }),
      prisma.workerOrgRTW.findUnique({
        where: { workerId_organizationId: { workerId, organizationId: orgId } },
      }),
      prisma.workerDocument.findMany({
        where: { workerId },
        select: {
          id: true,
          documentType: true,
          status: true,
          createdAt: true,
          verifiedAt: true,
          expiresAt: true,
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        id: worker.id,
        fullName: worker.fullName,
        email: worker.email,
        phone: worker.phone,
        status: worker.status,
        rtwStatus: orgRtw?.status || profile?.rtwStatus,
        rtwShareCode: profile?.rtwShareCode || orgRtw?.shareCode || null,
        rtwCheckedAt: profile?.rtwCheckedAt || orgRtw?.checkedAt || null,
        rtwExpiresAt: profile?.rtwExpiresAt || orgRtw?.expiresAt || null,
        rtwAuditNote: profile?.rtwAuditNote || orgRtw?.auditNote || null,
        rtwAuditUrl: profile?.rtwAuditUrl,
        rtwCheckedBy: profile?.rtwChecker
          ? (profile.rtwChecker.id === workerId ? 'Self Service' : profile.rtwChecker.fullName)
          : null,
        onboardingStatus: profile?.onboardingStatus,
        dateOfBirth: profile?.dateOfBirth,
        documents,
      },
    });
  };

  /**
   * Bulk approve workers (for batch processing)
   * POST /api/v1/compliance/bulk-approve
   */
  bulkApprove = async (req: AuthRequest, res: Response) => {
    const { workerIds, auditNote } = req.body;
    const orgId = req.user!.organizationId;

    if (!workerIds || !Array.isArray(workerIds) || workerIds.length === 0) {
      throw new AppError('Worker IDs array is required', 400);
    }

    if (!auditNote) {
      throw new AppError('Audit note is required for bulk approval', 400);
    }

    // Verify all workers belong to org
    const workers = await prisma.user.findMany({
      where: {
        id: { in: workerIds },
        organizationId: orgId,
        role: 'WORKER',
      },
    });

    if (workers.length !== workerIds.length) {
      throw new AppError('Some workers not found or do not belong to your organization', 400);
    }

    // Update all worker profiles
    await prisma.workerProfile.updateMany({
      where: { userId: { in: workerIds } },
      data: {
        rtwStatus: 'APPROVED',
        rtwCheckedAt: new Date(),
        rtwCheckedBy: req.user!.id,
        rtwAuditNote: `Bulk Manual Approval: ${auditNote}`,
        onboardingStatus: 'COMPLETE',
      },
    });

    // Activate pending workers
    await prisma.user.updateMany({
      where: {
        id: { in: workerIds },
        status: 'PENDING',
      },
      data: { status: 'ACTIVE' },
    });

    // Notify all approved workers
    await NotificationService.sendToMultiple(workerIds, {
      title: 'Right to Work Approved',
      body: 'Your right to work has been approved. You can now accept shifts!',
      type: 'RTW_APPROVED',
      channels: ['push'],
      data: { action: 'VIEW_RTW', rtwStatus: 'APPROVED' },
    });

    res.json({
      success: true,
      message: `${workerIds.length} workers approved successfully`,
      data: { approvedCount: workerIds.length },
    });
  };
}
