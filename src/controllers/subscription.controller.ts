/**
 * Subscription Controller
 * 
 * Handles subscription management, billing, and payment operations
 */

import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthRequest } from '../middleware/auth';
import { stripeService, PLANS, FREE_TRIAL_DAYS } from '../services/stripe';
import { PlanTier } from '@prisma/client';
import { SubscriptionNotificationService } from '../services/notifications/subscription.notification';
import { SubscriptionChecker } from '../services/subscriptionChecker';

export class SubscriptionController {
  /**
   * Get available plans
   */
  getPlans = async (req: Request, res: Response) => {
    const plans = Object.entries(PLANS).map(([key, plan]) => ({
      id: key,
      name: plan.name,
      monthlyPrice: plan.monthlyPrice,
      yearlyPrice: plan.yearlyPrice,
      workerLimit: plan.workerLimit === -1 ? 'Unlimited' : plan.workerLimit,
      clientLimit: plan.clientLimit === -1 ? 'Unlimited' : plan.clientLimit,
      features: plan.features,
      isCustomPricing: (plan as any).isCustomPricing || false,
      trialDays: (plan as any).trialDays || null,
    }));

    ApiResponse.ok(res, 'Plans retrieved', { 
      plans,
      freeTrialDays: FREE_TRIAL_DAYS,
      currency: 'GBP',
    });
  };

  /**
   * Get current subscription for organization
   */
  getSubscription = async (req: AuthRequest, res: Response) => {
    const organizationId = req.user!.organizationId;

    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
      include: {
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!subscription) {
      // Return trial/free tier info
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
      });

      return ApiResponse.ok(res, 'No active subscription', {
        subscription: null,
        trial: {
          active: organization?.trialEndsAt ? new Date() < organization.trialEndsAt : false,
          endsAt: organization?.trialEndsAt,
        },
        limits: await stripeService.getPlanLimits(organizationId),
      });
    }

    // Get Stripe subscription details if available
    let stripeDetails = null;
    if (subscription.stripeSubscriptionId) {
      try {
        stripeDetails = await stripeService.getSubscription(subscription.stripeSubscriptionId);
      } catch (error) {
        console.error('Failed to fetch Stripe subscription:', error);
      }
    }

    ApiResponse.ok(res, 'Subscription retrieved', {
      subscription: {
        id: subscription.id,
        planTier: subscription.planTier,
        status: subscription.status,
        workerLimit: subscription.workerLimit,
        clientLimit: subscription.clientLimit,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        canceledAt: subscription.canceledAt,
        trialStart: subscription.trialStart,
        trialEnd: subscription.trialEnd,
      },
      recentPayments: subscription.payments.map(p => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        paidAt: p.paidAt,
        invoiceUrl: p.invoiceUrl,
      })),
      limits: await stripeService.getPlanLimits(organizationId),
      stripeDetails: stripeDetails ? {
        status: stripeDetails.status,
        cancelAtPeriodEnd: stripeDetails.cancel_at_period_end,
        currentPeriodEnd: new Date((stripeDetails as any).current_period_end * 1000),
      } : null,
    });
  };

  /**
   * Create checkout session for new subscription
   */
  /**
   * Initialize free trial for a new organization (called during registration)
   */
  initializeFreeTrial = async (organizationId: string): Promise<void> => {
    const trialStart = new Date();
    const trialEnd = new Date(trialStart.getTime() + FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000);

    await prisma.subscription.create({
      data: {
        organizationId,
        planTier: 'FREE',
        status: 'TRIALING',
        workerLimit: -1, // Unlimited during trial
        clientLimit: -1,
        trialStart,
        trialEnd,
        currentPeriodStart: trialStart,
        currentPeriodEnd: trialEnd,
      },
    });

    // Update organization with trial end date
    await prisma.organization.update({
      where: { id: organizationId },
      data: { trialEndsAt: trialEnd },
    });
  };

  /**
   * Get trial status for organization
   */
  getTrialStatus = async (req: AuthRequest, res: Response) => {
    const organizationId = req.user!.organizationId;

    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
    });

    if (!subscription) {
      throw new AppError('No subscription found', 404);
    }

    const now = new Date();
    const trialEnd = subscription.trialEnd;
    const isTrialing = subscription.status === 'TRIALING' && trialEnd && now < trialEnd;
    const daysRemaining = trialEnd 
      ? Math.max(0, Math.floor((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    ApiResponse.ok(res, 'Trial status retrieved', {
      isTrialing,
      trialStart: subscription.trialStart,
      trialEnd: subscription.trialEnd,
      daysRemaining,
      planTier: subscription.planTier,
      status: subscription.status,
    });
  };

  /**
   * Get subscription summary for dashboard display
   */
  getSummary = async (req: AuthRequest, res: Response) => {
    const organizationId = req.user!.organizationId;
    
    // Check if subscription exists, if not create one (for existing accounts)
    let subscription = await prisma.subscription.findUnique({
      where: { organizationId },
    });

    if (!subscription) {
      // Initialize free trial for existing organization without subscription
      await this.initializeFreeTrial(organizationId);
    }

    const summary = await SubscriptionChecker.getSubscriptionSummary(organizationId);
    
    // Get plan display name
    const planNames: Record<string, string> = {
      FREE: 'Free Trial',
      STANDARD: 'Standard',
      ENTERPRISE: 'Enterprise',
    };

    ApiResponse.ok(res, 'Subscription summary retrieved', {
      ...summary,
      planName: planNames[summary.planTier] || summary.planTier,
    });
  };

  /**
   * Request enterprise plan (contact us)
   */
  requestEnterprisePlan = async (req: AuthRequest, res: Response) => {
    const organizationId = req.user!.organizationId;
    const { contactName, contactEmail, contactPhone, companySize, message } = req.body;

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new AppError('Organization not found', 404);
    }

    // TODO: Send email to sales team
    // For now, just log the request
    console.log('Enterprise plan request:', {
      organizationId,
      organizationName: organization.name,
      contactName,
      contactEmail,
      contactPhone,
      companySize,
      message,
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'ENTERPRISE_PLAN_REQUEST',
        entityType: 'subscription',
        entityId: organizationId,
        metadata: { contactName, contactEmail, contactPhone, companySize, message, organizationId },
      },
    });

    ApiResponse.ok(res, 'Enterprise plan request submitted. Our team will contact you within 24 hours.', {
      submitted: true,
    });
  };

  createCheckoutSession = async (req: AuthRequest, res: Response) => {
    const organizationId = req.user!.organizationId;
    const { planTier, billingCycle = 'monthly' } = req.body;

    // Only STANDARD plan can be purchased via checkout
    if (!planTier || !['STANDARD'].includes(planTier)) {
      throw new AppError('Invalid plan tier. Use STANDARD for checkout or contact us for ENTERPRISE.', 400);
    }

    if (!['monthly', 'yearly'].includes(billingCycle)) {
      throw new AppError('Invalid billing cycle', 400);
    }

    // Check for existing active subscription
    const existing = await prisma.subscription.findUnique({
      where: { organizationId },
    });

    if (existing && existing.status === 'ACTIVE') {
      throw new AppError('Organization already has an active subscription. Use upgrade instead.', 400);
    }

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const successUrl = `${baseUrl}/settings/billing?success=true&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/settings/billing?canceled=true`;

    const session = await stripeService.createCheckoutSession(
      organizationId,
      planTier as PlanTier,
      billingCycle,
      successUrl,
      cancelUrl
    );

    ApiResponse.ok(res, 'Checkout session created', {
      sessionId: session.id,
      url: session.url,
    });
  };

  /**
   * Create subscription directly (with payment method)
   */
  createSubscription = async (req: AuthRequest, res: Response) => {
    const organizationId = req.user!.organizationId;
    const { planTier, billingCycle = 'monthly', paymentMethodId } = req.body;

    // Only STANDARD plan can be created via API
    if (!planTier || !['STANDARD'].includes(planTier)) {
      throw new AppError('Invalid plan tier. Use STANDARD or contact us for ENTERPRISE.', 400);
    }

    // Check for existing active subscription
    const existing = await prisma.subscription.findUnique({
      where: { organizationId },
    });

    if (existing && existing.status === 'ACTIVE') {
      throw new AppError('Organization already has an active subscription', 400);
    }

    const result = await stripeService.createSubscription({
      organizationId,
      planTier: planTier as PlanTier,
      billingCycle,
      paymentMethodId,
      trialDays: 0, // No additional trial for paid plans - trial is on FREE tier
    });

    ApiResponse.ok(res, 'Subscription created', {
      subscriptionId: result!.subscription.id,
      status: result!.subscription.status,
      clientSecret: result!.clientSecret,
    });
  };

  /**
   * Update subscription (upgrade/downgrade)
   */
  updateSubscription = async (req: AuthRequest, res: Response) => {
    const organizationId = req.user!.organizationId;
    const { planTier, billingCycle } = req.body;

    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
    });

    if (!subscription?.stripeSubscriptionId) {
      throw new AppError('No active subscription found', 404);
    }

    // Validate plan tier if provided (only STANDARD can be selected via self-service)
    if (planTier && !['STANDARD'].includes(planTier)) {
      throw new AppError('Invalid plan tier. Contact us for ENTERPRISE plans.', 400);
    }

    // Check limits when downgrading
    if (planTier) {
      const plan = PLANS[planTier as PlanTier];
      const limits = await stripeService.getPlanLimits(organizationId);

      if (plan.workerLimit !== -1 && limits.currentWorkers > plan.workerLimit) {
        throw new AppError(
          `Cannot downgrade: you have ${limits.currentWorkers} workers but ${planTier} plan only allows ${plan.workerLimit}`,
          400
        );
      }

      if (plan.clientLimit !== -1 && limits.currentClients > plan.clientLimit) {
        throw new AppError(
          `Cannot downgrade: you have ${limits.currentClients} clients but ${planTier} plan only allows ${plan.clientLimit}`,
          400
        );
      }
    }

    const updated = await stripeService.updateSubscription({
      subscriptionId: subscription.stripeSubscriptionId,
      planTier: planTier as PlanTier,
      billingCycle,
    });

    ApiResponse.ok(res, 'Subscription updated', {
      status: updated.status,
      currentPeriodEnd: new Date((updated as any).current_period_end * 1000),
    });
  };

  /**
   * Cancel subscription
   */
  cancelSubscription = async (req: AuthRequest, res: Response) => {
    const organizationId = req.user!.organizationId;
    const { immediately = false } = req.body;

    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
    });

    if (!subscription?.stripeSubscriptionId) {
      throw new AppError('No active subscription found', 404);
    }

    const canceled = await stripeService.cancelSubscription(
      subscription.stripeSubscriptionId,
      immediately
    );

    // Send cancellation notification
    SubscriptionNotificationService.notifySubscriptionCanceled(organizationId)
      .catch(err => console.error('Failed to send cancellation notification:', err));

    ApiResponse.ok(res, immediately ? 'Subscription canceled' : 'Subscription will cancel at period end', {
      status: canceled.status,
      cancelAtPeriodEnd: canceled.cancel_at_period_end,
      cancelAt: canceled.cancel_at ? new Date(canceled.cancel_at * 1000) : null,
    });
  };

  /**
   * Resume a canceled subscription
   */
  resumeSubscription = async (req: AuthRequest, res: Response) => {
    const organizationId = req.user!.organizationId;

    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
    });

    if (!subscription?.stripeSubscriptionId) {
      throw new AppError('No subscription found', 404);
    }

    const resumed = await stripeService.resumeSubscription(subscription.stripeSubscriptionId);

    // Send resumed notification
    SubscriptionNotificationService.notifySubscriptionResumed(organizationId, subscription.planTier)
      .catch(err => console.error('Failed to send resumed notification:', err));

    ApiResponse.ok(res, 'Subscription resumed', {
      status: resumed.status,
      cancelAtPeriodEnd: resumed.cancel_at_period_end,
    });
  };

  /**
   * Get billing portal URL
   */
  getBillingPortal = async (req: AuthRequest, res: Response) => {
    const organizationId = req.user!.organizationId;
    const returnUrl = req.body.returnUrl || `${process.env.FRONTEND_URL}/settings/billing`;

    const session = await stripeService.createBillingPortalSession(organizationId, returnUrl);

    ApiResponse.ok(res, 'Billing portal session created', {
      url: session.url,
    });
  };

  /**
   * Create setup intent for adding payment method
   */
  createSetupIntent = async (req: AuthRequest, res: Response) => {
    const organizationId = req.user!.organizationId;

    const setupIntent = await stripeService.createSetupIntent(organizationId);

    ApiResponse.ok(res, 'Setup intent created', {
      clientSecret: setupIntent.client_secret,
    });
  };

  /**
   * Get payment methods
   */
  getPaymentMethods = async (req: AuthRequest, res: Response) => {
    const organizationId = req.user!.organizationId;

    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
    });

    if (!subscription?.stripeCustomerId) {
      return ApiResponse.ok(res, 'No payment methods', { paymentMethods: [] });
    }

    const paymentMethods = await stripeService.getPaymentMethods(subscription.stripeCustomerId);

    ApiResponse.ok(res, 'Payment methods retrieved', {
      paymentMethods: paymentMethods.map(pm => ({
        id: pm.id,
        type: pm.type,
        card: pm.card ? {
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year,
        } : null,
      })),
    });
  };

  /**
   * Get invoices/payment history
   */
  getInvoices = async (req: AuthRequest, res: Response) => {
    const organizationId = req.user!.organizationId;
    const { limit = 10 } = req.query;

    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
    });

    if (!subscription?.stripeCustomerId) {
      return ApiResponse.ok(res, 'No invoices', { invoices: [] });
    }

    const invoices = await stripeService.getInvoices(
      subscription.stripeCustomerId,
      Number(limit)
    );

    ApiResponse.ok(res, 'Invoices retrieved', {
      invoices: invoices.map(inv => ({
        id: inv.id,
        number: inv.number,
        amount: inv.amount_paid / 100,
        currency: inv.currency,
        status: inv.status,
        paidAt: inv.status_transitions?.paid_at
          ? new Date(inv.status_transitions.paid_at * 1000)
          : null,
        invoiceUrl: inv.hosted_invoice_url,
        invoicePdf: inv.invoice_pdf,
        createdAt: new Date(inv.created * 1000),
      })),
    });
  };

  /**
   * Get plan limits and usage
   */
  getLimits = async (req: AuthRequest, res: Response) => {
    const organizationId = req.user!.organizationId;

    const limits = await stripeService.getPlanLimits(organizationId);

    ApiResponse.ok(res, 'Limits retrieved', limits);
  };

  /**
   * Get subscription history for the organization
   * Returns a list of all subscription changes and payments
   */
  getHistory = async (req: AuthRequest, res: Response) => {
    const organizationId = req.user!.organizationId;
    const { page = 1, limit = 10 } = req.query;
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get subscription
    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
    });

    // Get all payments for this organization
    const [payments, totalCount] = await Promise.all([
      prisma.payment.findMany({
        where: { subscription: { organizationId } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.payment.count({
        where: { subscription: { organizationId } },
      }),
    ]);

    // Map payments to history format
    const history = payments.map(payment => ({
      id: payment.id,
      planType: subscription?.planTier || 'FREE',
      amount: `£${(Number(payment.amount) / 100).toFixed(2)}`,
      billingCycle: 'Annually',
      date: payment.paidAt || payment.createdAt,
      transactionId: payment.stripePaymentIntentId || payment.id,
      status: this.mapPaymentStatus(payment.status),
    }));

    ApiResponse.ok(res, 'Subscription history retrieved', {
      history,
      currentPlan: subscription ? {
        planTier: subscription.planTier,
        status: subscription.status,
        startDate: subscription.currentPeriodStart,
        nextBillingDate: subscription.currentPeriodEnd,
        cost: subscription.planTier === 'FREE' ? '£0.00' : '£99.00',
      } : null,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
      },
    });
  };

  /**
   * Map payment status to frontend display status
   */
  private mapPaymentStatus = (status: string): string => {
    switch (status) {
      case 'SUCCEEDED':
      case 'PAID':
        return 'Active';
      case 'PENDING':
        return 'Pending';
      case 'FAILED':
        return 'Failed';
      case 'REFUNDED':
        return 'Refunded';
      case 'CANCELED':
        return 'Cancelled';
      default:
        return 'Renewed';
    }
  };

  /**
   * Handle Stripe webhook
   */
  handleWebhook = async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      throw new AppError('Missing stripe-signature header', 400);
    }

    try {
      const event = stripeService.verifyWebhookSignature(req.body, signature);
      if (!event) throw new AppError('Failed to verify webhook signature', 400);
      await stripeService.handleWebhookEvent(event);

      res.json({ received: true });
    } catch (error: any) {
      console.error('Webhook error:', error.message);
      throw new AppError(`Webhook error: ${error.message}`, 400);
    }
  };
}
