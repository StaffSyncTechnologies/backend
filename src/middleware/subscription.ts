/**
 * Subscription Middleware
 * 
 * Middleware to check subscription status and enforce access control
 */

import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { AuthRequest } from './auth';

export interface SubscriptionInfo {
  planTier: string;
  status: string;
  isTrialing: boolean;
  isActive: boolean;
  isExpired: boolean;
  daysRemaining: number;
  trialEnd: Date | null;
}

/**
 * Check if organization has an active subscription (including trial)
 */
export const requireActiveSubscription = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      throw new AppError('Organization not found', 401);
    }

    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
    });

    if (!subscription) {
      throw new AppError(
        'No subscription found. Please contact support.',
        402,
        'NO_SUBSCRIPTION'
      );
    }

    const now = new Date();
    const { status, trialEnd, planTier } = subscription;

    // Check subscription status
    const isTrialing = status === 'TRIALING' && !!trialEnd && now < trialEnd;
    const isActive = status === 'ACTIVE';
    const isPastDue = status === 'PAST_DUE';

    if (!isTrialing && !isActive && !isPastDue) {
      throw new AppError(
        'Your subscription has expired. Please upgrade to continue using StaffSync.',
        402,
        'SUBSCRIPTION_EXPIRED'
      );
    }

    // Calculate days remaining for trial
    const daysRemaining = trialEnd
      ? Math.max(0, Math.floor((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : null;

    // Attach subscription info to request
    (req as any).subscription = {
      planTier,
      status,
      isTrialing,
      isActive,
      isExpired: !isTrialing && !isActive,
      daysRemaining,
      trialEnd,
    } as SubscriptionInfo;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Check if trial is about to expire (within 14 days)
 * Adds warning header to response
 */
export const checkTrialExpiry = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return next();
    }

    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
    });

    if (subscription?.status === 'TRIALING' && subscription.trialEnd) {
      const now = new Date();
      const daysRemaining = Math.floor(
        (subscription.trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysRemaining <= 14 && daysRemaining > 0) {
        res.setHeader('X-Trial-Days-Remaining', daysRemaining.toString());
        res.setHeader('X-Trial-Warning', 'true');
      } else if (daysRemaining <= 0) {
        res.setHeader('X-Trial-Expired', 'true');
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Require a specific plan tier or higher
 */
export const requirePlanTier = (minTier: 'FREE' | 'STANDARD' | 'ENTERPRISE') => {
  const tierOrder = { FREE: 0, STANDARD: 1, ENTERPRISE: 2 };

  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.user?.organizationId;

      if (!organizationId) {
        throw new AppError('Organization not found', 401);
      }

      const subscription = await prisma.subscription.findUnique({
        where: { organizationId },
      });

      if (!subscription) {
        throw new AppError('No subscription found', 402, 'NO_SUBSCRIPTION');
      }

      const currentTierOrder = tierOrder[subscription.planTier as keyof typeof tierOrder] ?? 0;
      const requiredTierOrder = tierOrder[minTier];

      if (currentTierOrder < requiredTierOrder) {
        throw new AppError(
          `This feature requires ${minTier} plan or higher. Please upgrade your subscription.`,
          403,
          'PLAN_UPGRADE_REQUIRED'
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Check worker/client limits before adding new ones
 */
export const checkLimits = (type: 'worker' | 'client') => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.user?.organizationId;

      if (!organizationId) {
        throw new AppError('Organization not found', 401);
      }

      const subscription = await prisma.subscription.findUnique({
        where: { organizationId },
      });

      if (!subscription) {
        throw new AppError('No subscription found', 402);
      }

      // -1 means unlimited
      if (type === 'worker' && subscription.workerLimit !== -1) {
        const currentWorkers = await prisma.user.count({
          where: { organizationId, role: 'WORKER' },
        });

        if (currentWorkers >= subscription.workerLimit) {
          throw new AppError(
            `Worker limit reached (${subscription.workerLimit}). Please upgrade your subscription.`,
            403,
            'WORKER_LIMIT_REACHED'
          );
        }
      }

      if (type === 'client' && subscription.clientLimit !== -1) {
        const currentClients = await prisma.clientCompany.count({
          where: { organizationId },
        });

        if (currentClients >= subscription.clientLimit) {
          throw new AppError(
            `Client limit reached (${subscription.clientLimit}). Please upgrade your subscription.`,
            403,
            'CLIENT_LIMIT_REACHED'
          );
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Get subscription status for an organization
 */
export const getSubscriptionStatus = async (
  organizationId: string
): Promise<SubscriptionInfo | null> => {
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
  });

  if (!subscription) {
    return null;
  }

  const now = new Date();
  const { status, trialEnd, planTier } = subscription;
  const isTrialing = status === 'TRIALING' && !!trialEnd && now < trialEnd;
  const isActive = status === 'ACTIVE';

  return {
    planTier,
    status,
    isTrialing,
    isActive,
    isExpired: !isTrialing && !isActive,
    daysRemaining: trialEnd
      ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : 0,
    trialEnd,
  };
};
