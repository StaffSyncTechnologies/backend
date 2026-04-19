/**
 * Enhanced Subscription Notification Service with Duplicate Prevention
 * 
 * Extends the existing subscription notification service with duplicate prevention
 * and improved tracking capabilities.
 */

import { prisma } from '../../lib/prisma';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { EmailService } from './email.service';

export type SubscriptionNotificationType = 
  | 'TRIAL_STARTED'
  | 'TRIAL_ENDING_SOON_30'  // 30 days before expiry
  | 'TRIAL_ENDING_SOON_5'   // 5 days before expiry
  | 'TRIAL_EXPIRED'
  | 'SUBSCRIPTION_ACTIVATED'
  | 'SUBSCRIPTION_UPGRADED'
  | 'SUBSCRIPTION_DOWNGRADED'
  | 'SUBSCRIPTION_CANCELED'
  | 'SUBSCRIPTION_RESUMED'
  | 'PAYMENT_SUCCESSFUL'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_METHOD_EXPIRING';

interface SubscriptionNotificationData {
  organizationId: string;
  type: SubscriptionNotificationType;
  planTier?: string;
  daysRemaining?: number;
  trialEnd?: Date;
  amount?: number;
  currency?: string;
  invoiceUrl?: string;
  billingUrl?: string;
}

/**
 * Enhanced Subscription Notification Service with duplicate prevention
 */
export class EnhancedSubscriptionNotificationService {
  /**
   * Hours to wait before sending the same type of notification again
   */
  private static readonly DUPLICATE_PREVENTION_HOURS = {
    TRIAL_STARTED: 24 * 7,        // 1 week
    TRIAL_ENDING_SOON_30: 12,      // 12 hours
    TRIAL_ENDING_SOON_5: 6,       // 6 hours
    TRIAL_EXPIRED: 24,            // 1 day
    SUBSCRIPTION_ACTIVATED: 24,   // 1 day
    SUBSCRIPTION_UPGRADED: 24,     // 1 day
    SUBSCRIPTION_DOWNGRADED: 24,   // 1 day
    SUBSCRIPTION_CANCELED: 24,     // 1 day
    SUBSCRIPTION_RESUMED: 24,      // 1 day
    PAYMENT_SUCCESSFUL: 1,        // 1 hour
    PAYMENT_FAILED: 6,            // 6 hours
    PAYMENT_METHOD_EXPIRING: 24,  // 1 day
  };

  /**
   * Check if a similar notification was sent recently
   */
  private static async wasNotificationSentRecently(
    organizationId: string,
    type: SubscriptionNotificationType,
    userId: string
  ): Promise<boolean> {
    const hoursAgo = this.DUPLICATE_PREVENTION_HOURS[type] || 24;
    const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

    const existingNotification = await prisma.notification.findFirst({
      where: {
        organizationId,
        userId,
        type: `SUBSCRIPTION_${type}`,
        channel: 'EMAIL',
        status: 'SENT',
        createdAt: {
          gte: cutoffTime,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return !!existingNotification;
  }

  /**
   * Send notification to all admins of an organization with duplicate prevention
   */
  static async notifyOrganizationAdmins(data: SubscriptionNotificationData): Promise<{
    sent: number;
    skipped: number;
    errors: string[];
  }> {
    const { organizationId, type } = data;
    const results = { sent: 0, skipped: 0, errors: [] as string[] };

    // Get organization details
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true },
    });

    if (!organization) {
      const error = `Organization ${organizationId} not found for notification`;
      console.error(error);
      results.errors.push(error);
      return results;
    }

    // Get all admins
    const admins = await prisma.user.findMany({
      where: { 
        organizationId, 
        role: { in: ['ADMIN', 'OPS_MANAGER'] },
        status: 'ACTIVE',
      },
      select: { id: true, email: true, fullName: true },
    });

    if (admins.length === 0) {
      const warning = `No admins found for organization ${organizationId}`;
      console.warn(warning);
      results.errors.push(warning);
      return results;
    }

    // Get notification content
    const { title, message, emailSubject, emailBody } = this.getNotificationContent(data, organization.name);

    // Create in-app notifications and send emails with duplicate prevention
    for (const admin of admins) {
      try {
        // Check for recent duplicate notifications
        const wasSentRecently = await this.wasNotificationSentRecently(organizationId, type, admin.id);
        
        if (wasSentRecently) {
          console.log(`Skipping duplicate ${type} notification for admin ${admin.id} (sent recently)`);
          results.skipped++;
          continue;
        }

        // In-app notification (always create, no duplicate prevention for in-app)
        await prisma.notification.create({
          data: {
            organizationId,
            userId: admin.id,
            type: `SUBSCRIPTION_${type}`,
            channel: 'IN_APP',
            title,
            message,
            referenceType: 'subscription',
            referenceId: organizationId,
            status: 'DELIVERED',
          },
        });

        // Email notification
        await EmailService.send({
          to: admin.email,
          subject: emailSubject,
          html: this.buildEmailTemplate(emailBody, admin.fullName, organization.name),
        });

        // Record email notification
        await prisma.notification.create({
          data: {
            organizationId,
            userId: admin.id,
            type: `SUBSCRIPTION_${type}`,
            channel: 'EMAIL',
            title,
            message,
            referenceType: 'subscription',
            referenceId: organizationId,
            status: 'SENT',
            sentAt: new Date(),
          },
        });

        results.sent++;
        console.log(`Subscription notification ${type} sent to admin ${admin.email}`);
      } catch (error) {
        const errorMsg = `Failed to send notification to admin ${admin.email}: ${error}`;
        console.error(errorMsg);
        results.errors.push(errorMsg);
      }
    }

    console.log(`Subscription notification ${type} completed for org ${organizationId}: ${results.sent} sent, ${results.skipped} skipped, ${results.errors.length} errors`);
    return results;
  }

  /**
   * Get notification content based on type
   */
  private static getNotificationContent(
    data: SubscriptionNotificationData,
    orgName: string
  ): { title: string; message: string; emailSubject: string; emailBody: string } {
    const { type, planTier, daysRemaining, amount, currency, trialEnd } = data;
    const formattedAmount = amount ? `£${amount.toFixed(2)}` : '';
    const trialEndDate = trialEnd ? trialEnd.toLocaleDateString('en-GB', { 
      day: 'numeric', month: 'long', year: 'numeric' 
    }) : '';

    const content: Record<SubscriptionNotificationType, { title: string; message: string; emailSubject: string; emailBody: string }> = {
      TRIAL_STARTED: {
        title: 'Welcome to StaffSync!',
        message: 'Your 180-day free trial has started. Enjoy full access to all features!',
        emailSubject: 'Welcome to StaffSync - Your Free Trial Has Started',
        emailBody: `
          <p>Your <strong>180-day free trial</strong> has started!</p>
          <p>You now have full access to all StaffSync features:</p>
          <ul>
            <li>Unlimited workers & clients</li>
            <li>Full scheduling & shift management</li>
            <li>Time tracking & timesheets</li>
            <li>Invoicing & payroll</li>
            <li>Reports & analytics</li>
          </ul>
          <p>Your trial ends on <strong>${trialEndDate}</strong>.</p>
        `,
      },
      TRIAL_ENDING_SOON_30: {
        title: 'Trial Ending Soon',
        message: `Your free trial ends in ${daysRemaining} days. Upgrade to continue using StaffSync.`,
        emailSubject: `Your StaffSync Trial Ends in ${daysRemaining} Days`,
        emailBody: `
          <p>Your free trial ends in <strong>${daysRemaining} days</strong> (${trialEndDate}).</p>
          <p>To continue using StaffSync without interruption, please choose a plan:</p>
          <ul>
            <li><strong>Starter:</strong> £2.50/worker/month (1-10 workers)</li>
            <li><strong>Professional:</strong> £3.50/worker/month (11-50 workers)</li>
            <li><strong>Business:</strong> £4.50/worker/month (51-200 workers)</li>
            <li><strong>Enterprise:</strong> Custom pricing (200+ workers)</li>
          </ul>
          <p><a href="${data.billingUrl || '/settings/billing'}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Choose a Plan</a></p>
        `,
      },
      TRIAL_ENDING_SOON_5: {
        title: 'URGENT: Trial Ends This Week',
        message: `Your free trial ends in ${daysRemaining} days. Upgrade now to avoid service interruption.`,
        emailSubject: `URGENT: Your StaffSync Trial Ends in ${daysRemaining} Days`,
        emailBody: `
          <p><strong>URGENT:</strong> Your free trial ends in <strong>${daysRemaining} days</strong> (${trialEndDate}).</p>
          <p>Your account will be limited if you don't upgrade. Choose a plan to continue using StaffSync:</p>
          <ul>
            <li><strong>Starter:</strong> £2.50/worker/month (1-10 workers)</li>
            <li><strong>Professional:</strong> £3.50/worker/month (11-50 workers)</li>
            <li><strong>Business:</strong> £4.50/worker/month (51-200 workers)</li>
            <li><strong>Enterprise:</strong> Custom pricing (200+ workers)</li>
          </ul>
          <p><a href="${data.billingUrl || '/settings/billing'}" style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Upgrade Now</a></p>
        `,
      },
      TRIAL_EXPIRED: {
        title: 'Trial Expired',
        message: 'Your free trial has ended. Please upgrade to continue using StaffSync.',
        emailSubject: 'Your StaffSync Trial Has Expired',
        emailBody: `
          <p>Your <strong>180-day free trial</strong> has ended.</p>
          <p>Your account access is now limited. To restore full access, please choose a plan:</p>
          <ul>
            <li><strong>Starter:</strong> £2.50/worker/month (1-10 workers)</li>
            <li><strong>Professional:</strong> £3.50/worker/month (11-50 workers)</li>
            <li><strong>Business:</strong> £4.50/worker/month (51-200 workers)</li>
            <li><strong>Enterprise:</strong> Custom pricing (200+ workers)</li>
          </ul>
          <p><a href="${data.billingUrl || '/settings/billing'}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Choose a Plan</a></p>
          <p>Need a custom solution? <a href="/contact">Contact our sales team</a> for Enterprise pricing.</p>
        `,
      },
      SUBSCRIPTION_ACTIVATED: {
        title: 'Subscription Activated',
        message: `Your ${planTier} subscription is now active. Thank you for choosing StaffSync!`,
        emailSubject: 'Your StaffSync Subscription is Active',
        emailBody: `
          <p>Great news! Your <strong>${planTier}</strong> subscription is now active.</p>
          <p>You have full access to all StaffSync features. Thank you for choosing us!</p>
          <p>Manage your subscription anytime from your <a href="/settings/billing">billing settings</a>.</p>
        `,
      },
      SUBSCRIPTION_UPGRADED: {
        title: 'Subscription Upgraded',
        message: `You've upgraded to the ${planTier} plan. New features are now available!`,
        emailSubject: `You've Upgraded to ${planTier}`,
        emailBody: `
          <p>Your subscription has been upgraded to <strong>${planTier}</strong>!</p>
          <p>You now have access to additional features. Explore your new capabilities in the dashboard.</p>
        `,
      },
      SUBSCRIPTION_DOWNGRADED: {
        title: 'Subscription Downgraded',
        message: `Your subscription has been changed to ${planTier}. Changes take effect at the end of the billing period.`,
        emailSubject: 'Subscription Plan Changed',
        emailBody: `
          <p>Your subscription has been changed to <strong>${planTier}</strong>.</p>
          <p>This change will take effect at the end of your current billing period.</p>
        `,
      },
      SUBSCRIPTION_CANCELED: {
        title: 'Subscription Canceled',
        message: 'Your subscription has been canceled. You\'ll have access until the end of the billing period.',
        emailSubject: 'Your StaffSync Subscription Has Been Canceled',
        emailBody: `
          <p>Your subscription has been canceled.</p>
          <p>You'll continue to have access until the end of your current billing period.</p>
          <p>Changed your mind? You can <a href="/settings/billing">reactivate your subscription</a> anytime before it expires.</p>
          <p>We'd love to hear your feedback on how we can improve. <a href="/feedback">Share your thoughts</a>.</p>
        `,
      },
      SUBSCRIPTION_RESUMED: {
        title: 'Subscription Resumed',
        message: 'Your subscription has been reactivated. Welcome back!',
        emailSubject: 'Welcome Back! Your Subscription is Reactivated',
        emailBody: `
          <p>Great news! Your <strong>${planTier}</strong> subscription has been reactivated.</p>
          <p>You have full access to all features again. Welcome back to StaffSync!</p>
        `,
      },
      PAYMENT_SUCCESSFUL: {
        title: 'Payment Successful',
        message: `Payment of ${formattedAmount} received. Thank you!`,
        emailSubject: `Payment Receipt - ${formattedAmount}`,
        emailBody: `
          <p>We've received your payment of <strong>${formattedAmount}</strong>.</p>
          <p>Thank you for your continued subscription to StaffSync.</p>
          ${data.invoiceUrl ? `<p><a href="${data.invoiceUrl}">View Invoice</a></p>` : ''}
        `,
      },
      PAYMENT_FAILED: {
        title: 'Payment Failed',
        message: `Payment of ${formattedAmount} failed. Please update your payment method.`,
        emailSubject: 'Action Required: Payment Failed',
        emailBody: `
          <p>We were unable to process your payment of <strong>${formattedAmount}</strong>.</p>
          <p>Please update your payment method to avoid service interruption.</p>
          <p><a href="${data.billingUrl || '/settings/billing'}" style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Update Payment Method</a></p>
          <p>If you believe this is an error, please contact your bank or our support team.</p>
        `,
      },
      PAYMENT_METHOD_EXPIRING: {
        title: 'Card Expiring Soon',
        message: 'Your payment method is expiring soon. Please update to avoid interruption.',
        emailSubject: 'Your Payment Method is Expiring Soon',
        emailBody: `
          <p>Your saved payment method is expiring soon.</p>
          <p>Please update your payment method to ensure uninterrupted service.</p>
          <p><a href="${data.billingUrl || '/settings/billing'}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Update Payment Method</a></p>
        `,
      },
    };

    return content[type];
  }

  /**
   * Build HTML email template
   */
  private static buildEmailTemplate(body: string, userName: string, orgName: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>StaffSync</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">StaffSync</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">Workforce Management Platform</p>
        </div>
        
        <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
          <p style="margin-top: 0;">Hi ${userName},</p>
          
          ${body}
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="color: #6b7280; font-size: 14px; margin-bottom: 0;">
            Organization: ${orgName}<br>
            Need help? <a href="mailto:info@staffsynctech.co.uk" style="color: #2563eb;">Contact Support</a>
          </p>
        </div>
        
        <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">© ${new Date().getFullYear()} StaffSync. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Notify trial started
   */
  static async notifyTrialStarted(organizationId: string, trialEnd: Date): Promise<{
    sent: number;
    skipped: number;
    errors: string[];
  }> {
    return this.notifyOrganizationAdmins({
      organizationId,
      type: 'TRIAL_STARTED',
      trialEnd,
      daysRemaining: 180,
    });
  }

  /**
   * Notify trial ending soon (30 days)
   */
  static async notifyTrialEndingSoon30(organizationId: string, daysRemaining: number, trialEnd: Date): Promise<{
    sent: number;
    skipped: number;
    errors: string[];
  }> {
    return this.notifyOrganizationAdmins({
      organizationId,
      type: 'TRIAL_ENDING_SOON_30',
      daysRemaining,
      trialEnd,
      billingUrl: '/settings/billing',
    });
  }

  /**
   * Notify trial ending soon (5 days)
   */
  static async notifyTrialEndingSoon5(organizationId: string, daysRemaining: number, trialEnd: Date): Promise<{
    sent: number;
    skipped: number;
    errors: string[];
  }> {
    return this.notifyOrganizationAdmins({
      organizationId,
      type: 'TRIAL_ENDING_SOON_5',
      daysRemaining,
      trialEnd,
      billingUrl: '/settings/billing',
    });
  }

  /**
   * Notify trial expired
   */
  static async notifyTrialExpired(organizationId: string): Promise<{
    sent: number;
    skipped: number;
    errors: string[];
  }> {
    return this.notifyOrganizationAdmins({
      organizationId,
      type: 'TRIAL_EXPIRED',
      billingUrl: '/settings/billing',
    });
  }

  /**
   * Notify subscription activated
   */
  static async notifySubscriptionActivated(organizationId: string, planTier: string): Promise<{
    sent: number;
    skipped: number;
    errors: string[];
  }> {
    return this.notifyOrganizationAdmins({
      organizationId,
      type: 'SUBSCRIPTION_ACTIVATED',
      planTier,
    });
  }

  /**
   * Notify subscription canceled
   */
  static async notifySubscriptionCanceled(organizationId: string): Promise<{
    sent: number;
    skipped: number;
    errors: string[];
  }> {
    return this.notifyOrganizationAdmins({
      organizationId,
      type: 'SUBSCRIPTION_CANCELED',
    });
  }

  /**
   * Notify subscription resumed
   */
  static async notifySubscriptionResumed(organizationId: string, planTier: string): Promise<{
    sent: number;
    skipped: number;
    errors: string[];
  }> {
    return this.notifyOrganizationAdmins({
      organizationId,
      type: 'SUBSCRIPTION_RESUMED',
      planTier,
    });
  }

  /**
   * Notify payment successful
   */
  static async notifyPaymentSuccessful(
    organizationId: string, 
    amount: number, 
    currency: string,
    invoiceUrl?: string
  ): Promise<{
    sent: number;
    skipped: number;
    errors: string[];
  }> {
    return this.notifyOrganizationAdmins({
      organizationId,
      type: 'PAYMENT_SUCCESSFUL',
      amount,
      currency,
      invoiceUrl,
    });
  }

  /**
   * Notify payment failed
   */
  static async notifyPaymentFailed(
    organizationId: string, 
    amount: number, 
    currency: string
  ): Promise<{
    sent: number;
    skipped: number;
    errors: string[];
  }> {
    return this.notifyOrganizationAdmins({
      organizationId,
      type: 'PAYMENT_FAILED',
      amount,
      currency,
      billingUrl: '/settings/billing',
    });
  }
}
