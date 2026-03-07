/**
 * Subscription Expiry Checker
 * 
 * Checks for expiring subscriptions and sends reminder emails
 * Should be run as a daily cron job
 */

import { prisma } from '../lib/prisma';
import { SubscriptionNotificationService } from './notifications/subscription.notification';

export class SubscriptionChecker {
  /**
   * Check all subscriptions for expiry and send reminders
   * Call this daily via cron job or scheduler
   */
  static async checkExpiringSubscriptions(): Promise<void> {
    console.log('[SubscriptionChecker] Starting subscription expiry check...');
    
    const now = new Date();
    
    // Check for trials expiring in 30 days
    await this.checkTrialsExpiringSoon(now, 30);
    
    // Check for trials expiring in 5 days (second reminder)
    await this.checkTrialsExpiringSoon(now, 5);
    
    // Check for expired trials
    await this.checkExpiredTrials(now);
    
    // Check for paid subscriptions expiring in 5 days
    await this.checkPaidSubscriptionsExpiringSoon(now, 5);
    
    console.log('[SubscriptionChecker] Subscription expiry check completed');
  }

  /**
   * Check for trials expiring soon and send reminder
   */
  private static async checkTrialsExpiringSoon(now: Date, daysRemaining: number): Promise<void> {
    const targetDate = new Date(now.getTime() + daysRemaining * 24 * 60 * 60 * 1000);
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    const expiringTrials = await prisma.subscription.findMany({
      where: {
        status: 'TRIALING',
        trialEnd: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      select: {
        organizationId: true,
        trialEnd: true,
      },
    });

    console.log(`[SubscriptionChecker] Found ${expiringTrials.length} trials expiring in ${daysRemaining} days`);

    for (const trial of expiringTrials) {
      try {
        await SubscriptionNotificationService.notifyTrialEndingSoon(
          trial.organizationId,
          daysRemaining,
          trial.trialEnd!
        );
        console.log(`[SubscriptionChecker] Sent ${daysRemaining}-day reminder to org ${trial.organizationId}`);
      } catch (error) {
        console.error(`[SubscriptionChecker] Failed to notify org ${trial.organizationId}:`, error);
      }
    }
  }

  /**
   * Check for expired trials and update status
   */
  private static async checkExpiredTrials(now: Date): Promise<void> {
    const expiredTrials = await prisma.subscription.findMany({
      where: {
        status: 'TRIALING',
        trialEnd: {
          lt: now,
        },
      },
      select: {
        id: true,
        organizationId: true,
      },
    });

    console.log(`[SubscriptionChecker] Found ${expiredTrials.length} expired trials`);

    for (const trial of expiredTrials) {
      try {
        // Update subscription status to CANCELED (expired)
        await prisma.subscription.update({
          where: { id: trial.id },
          data: { status: 'CANCELED' },
        });

        // Send expiry notification
        await SubscriptionNotificationService.notifyTrialExpired(trial.organizationId);
        console.log(`[SubscriptionChecker] Marked trial as expired for org ${trial.organizationId}`);
      } catch (error) {
        console.error(`[SubscriptionChecker] Failed to expire trial for org ${trial.organizationId}:`, error);
      }
    }
  }

  /**
   * Check for paid subscriptions expiring soon
   */
  private static async checkPaidSubscriptionsExpiringSoon(now: Date, daysRemaining: number): Promise<void> {
    const targetDate = new Date(now.getTime() + daysRemaining * 24 * 60 * 60 * 1000);
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    const expiringSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        cancelAtPeriodEnd: true,
        currentPeriodEnd: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      select: {
        organizationId: true,
        currentPeriodEnd: true,
        planTier: true,
      },
    });

    console.log(`[SubscriptionChecker] Found ${expiringSubscriptions.length} paid subscriptions expiring in ${daysRemaining} days`);

    for (const sub of expiringSubscriptions) {
      try {
        await SubscriptionNotificationService.notifyTrialEndingSoon(
          sub.organizationId,
          daysRemaining,
          sub.currentPeriodEnd!
        );
        console.log(`[SubscriptionChecker] Sent ${daysRemaining}-day expiry reminder to org ${sub.organizationId}`);
      } catch (error) {
        console.error(`[SubscriptionChecker] Failed to notify org ${sub.organizationId}:`, error);
      }
    }
  }

  /**
   * Get subscription status summary for an organization
   */
  static async getSubscriptionSummary(organizationId: string): Promise<{
    planTier: string;
    status: string;
    isTrialing: boolean;
    isExpired: boolean;
    daysRemaining: number | null;
    trialEnd: Date | null;
    currentPeriodEnd: Date | null;
    canAccessDashboard: boolean;
  }> {
    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
    });

    if (!subscription) {
      return {
        planTier: 'FREE',
        status: 'NO_SUBSCRIPTION',
        isTrialing: false,
        isExpired: true,
        daysRemaining: null,
        trialEnd: null,
        currentPeriodEnd: null,
        canAccessDashboard: false,
      };
    }

    const now = new Date();
    const endDate = subscription.trialEnd || subscription.currentPeriodEnd;
    const daysRemaining = endDate 
      ? Math.max(0, Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : null;

    const isTrialing = subscription.status === 'TRIALING';
    const trialExpired = isTrialing && subscription.trialEnd ? now > subscription.trialEnd : false;
    const isExpired = subscription.status === 'CANCELED' || trialExpired;
    
    // Can access dashboard if not expired and not canceled
    const canAccessDashboard = !isExpired && ['TRIALING', 'ACTIVE'].includes(subscription.status);

    return {
      planTier: subscription.planTier,
      status: subscription.status,
      isTrialing,
      isExpired,
      daysRemaining,
      trialEnd: subscription.trialEnd,
      currentPeriodEnd: subscription.currentPeriodEnd,
      canAccessDashboard,
    };
  }
}
