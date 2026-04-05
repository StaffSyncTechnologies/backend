import { PrismaClient, PlanTier } from '@prisma/client';
import { PLANS } from '../stripe';

const prisma = new PrismaClient();

interface WorkerLimitCheck {
  currentWorkers: number;
  workerLimit: number;
  isWithinLimit: boolean;
  requiresUpgrade: boolean;
  suggestedTier?: PlanTier;
  suggestedWorkerCount?: number;
}

/**
 * Determine which plan tier is appropriate for a given worker count
 */
export function determinePlanTierForWorkerCount(workerCount: number): PlanTier {
  if (workerCount <= PLANS.STARTER.maxWorkers) {
    return 'STARTER';
  } else if (workerCount <= PLANS.PROFESSIONAL.maxWorkers) {
    return 'PROFESSIONAL';
  } else if (workerCount <= PLANS.BUSINESS.maxWorkers) {
    return 'BUSINESS';
  } else {
    return 'ENTERPRISE';
  }
}

/**
 * Check if organization is within worker limits
 */
export async function checkWorkerLimit(organizationId: string): Promise<WorkerLimitCheck> {
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
  });

  if (!subscription) {
    throw new Error('No subscription found');
  }

  const currentWorkers = await prisma.user.count({
    where: { 
      organizationId, 
      role: 'WORKER',
    },
  });

  const workerLimit = subscription.workerLimit;
  const isWithinLimit = workerLimit === -1 || currentWorkers <= workerLimit;
  const requiresUpgrade = !isWithinLimit;

  let suggestedTier: PlanTier | undefined;
  let suggestedWorkerCount: number | undefined;

  if (requiresUpgrade) {
    // Suggest the appropriate tier for current worker count
    suggestedTier = determinePlanTierForWorkerCount(currentWorkers);
    suggestedWorkerCount = currentWorkers;
  }

  return {
    currentWorkers,
    workerLimit,
    isWithinLimit,
    requiresUpgrade,
    suggestedTier,
    suggestedWorkerCount,
  };
}

/**
 * Get upgrade options when worker limit is exceeded
 */
export async function getUpgradeOptions(organizationId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
  });

  if (!subscription) {
    throw new Error('No subscription found');
  }

  const currentWorkers = await prisma.user.count({
    where: { 
      organizationId, 
      role: 'WORKER',
    },
  });

  const currentTier = subscription.planTier;
  const currentBillingCycle = ('monthly' as 'monthly' | 'yearly'); // Default to monthly if not set

  // Calculate pricing for different options
  const options = [];

  // Option 1: Increase worker count in current tier (if possible)
  const currentPlan = PLANS[currentTier];
  if (currentPlan && currentWorkers <= currentPlan.maxWorkers) {
    const pricePerWorker = currentBillingCycle === 'yearly' 
      ? currentPlan.yearlyPricePerWorker 
      : currentPlan.monthlyPricePerWorker;
    
    if (pricePerWorker && pricePerWorker > 0) {
      const monthlyPrice = currentPlan.monthlyPricePerWorker || 0;
      const yearlyPrice = currentPlan.yearlyPricePerWorker || 0;
      const savings = currentBillingCycle === 'yearly' && monthlyPrice && yearlyPrice
        ? ((monthlyPrice - yearlyPrice) * currentWorkers * 12) / 100
        : 0;

      options.push({
        type: 'increase_workers',
        tier: currentTier,
        workerCount: currentWorkers,
        pricePerWorker: pricePerWorker / 100, // Convert pence to pounds
        totalPrice: (currentWorkers * pricePerWorker) / 100,
        billingCycle: currentBillingCycle,
        savings,
      });
    }
  }

  // Option 2: Upgrade to next tier
  const suggestedTier = determinePlanTierForWorkerCount(currentWorkers);
  if (suggestedTier !== currentTier && suggestedTier !== 'ENTERPRISE') {
    const suggestedPlan = PLANS[suggestedTier];
    const pricePerWorker = currentBillingCycle === 'yearly'
      ? suggestedPlan.yearlyPricePerWorker
      : suggestedPlan.monthlyPricePerWorker;

    if (pricePerWorker) {
      options.push({
        type: 'upgrade_tier',
        tier: suggestedTier,
        workerCount: currentWorkers,
        pricePerWorker: pricePerWorker / 100,
        totalPrice: (currentWorkers * pricePerWorker) / 100,
        billingCycle: currentBillingCycle,
        savings: currentBillingCycle === 'yearly'
          ? ((suggestedPlan.monthlyPricePerWorker - suggestedPlan.yearlyPricePerWorker) * currentWorkers * 12) / 100
          : 0,
      });
    }
  }

  // Option 3: Switch to annual billing for savings (if currently monthly)
  if (currentBillingCycle === 'monthly' && currentPlan && currentPlan.yearlyPricePerWorker) {
    const yearlyPrice = currentPlan.yearlyPricePerWorker;
    const monthlySavings = ((currentPlan.monthlyPricePerWorker - yearlyPrice) * currentWorkers * 12) / 100;

    options.push({
      type: 'switch_to_annual',
      tier: currentTier,
      workerCount: currentWorkers,
      pricePerWorker: yearlyPrice / 100,
      totalPrice: (currentWorkers * yearlyPrice) / 100,
      billingCycle: 'yearly',
      savings: monthlySavings,
    });
  }

  return {
    currentWorkers,
    currentTier,
    currentBillingCycle,
    workerLimit: subscription.workerLimit,
    options,
  };
}

/**
 * Validate if downgrade is possible
 */
export async function validateDowngrade(
  organizationId: string,
  newTier: PlanTier,
  newWorkerCount: number
): Promise<{ valid: boolean; reason?: string }> {
  const currentWorkers = await prisma.user.count({
    where: { 
      organizationId, 
      role: 'WORKER',
    },
  });

  const newPlan = PLANS[newTier];

  // Check if new tier can accommodate current workers
  if (newPlan.maxWorkers !== -1 && currentWorkers > newPlan.maxWorkers) {
    return {
      valid: false,
      reason: `Cannot downgrade to ${newTier}: You have ${currentWorkers} workers but this tier only supports up to ${newPlan.maxWorkers} workers.`,
    };
  }

  // Check if new worker count is sufficient
  if (newWorkerCount < currentWorkers) {
    return {
      valid: false,
      reason: `Cannot set worker count to ${newWorkerCount}: You currently have ${currentWorkers} active workers.`,
    };
  }

  // Check if new worker count is within tier limits
  if (newWorkerCount < newPlan.minWorkers || newWorkerCount > newPlan.maxWorkers) {
    return {
      valid: false,
      reason: `Worker count ${newWorkerCount} is outside the range for ${newTier} tier (${newPlan.minWorkers}-${newPlan.maxWorkers} workers).`,
    };
  }

  return { valid: true };
}

/**
 * Calculate prorated amount for mid-cycle changes
 */
export function calculateProratedAmount(
  currentPrice: number,
  newPrice: number,
  daysRemaining: number,
  totalDaysInPeriod: number
): number {
  const unusedAmount = (currentPrice * daysRemaining) / totalDaysInPeriod;
  const newAmount = (newPrice * daysRemaining) / totalDaysInPeriod;
  return newAmount - unusedAmount;
}
