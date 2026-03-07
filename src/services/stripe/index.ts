/**
 * Stripe Payment & Subscription Service
 * 
 * Handles all Stripe-related operations including:
 * - Customer management
 * - Subscription lifecycle
 * - Payment processing
 * - Webhook handling
 */

import Stripe from 'stripe';
import { prisma } from '../../lib/prisma';
import { PlanTier, SubscriptionStatus } from '@prisma/client';
import { SubscriptionNotificationService } from '../notifications/subscription.notification';

// Initialize Stripe only if key is provided
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const stripe = STRIPE_SECRET_KEY 
  ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' })
  : null;

const isStripeConfigured = (): boolean => {
  if (!stripe) {
    console.warn('⚠️  Stripe not configured. Set STRIPE_SECRET_KEY in .env');
    return false;
  }
  return true;
};

// Trial duration in days
export const FREE_TRIAL_DAYS = 180;

// Plan configuration
export const PLANS = {
  FREE: {
    name: 'Free Trial',
    monthlyPriceId: null,
    yearlyPriceId: null,
    monthlyPrice: 0,
    yearlyPrice: 0,
    trialDays: FREE_TRIAL_DAYS,
    workerLimit: -1, // Unlimited during trial
    clientLimit: -1, // Unlimited during trial
    features: [
      `${FREE_TRIAL_DAYS}-day free trial`,
      'Unlimited workers',
      'Unlimited clients',
      'Full scheduling features',
      'Time tracking & timesheets',
      'Invoicing & payroll',
      'Reports & analytics',
      'Email support',
    ],
  },
  STANDARD: {
    name: 'Standard',
    monthlyPriceId: process.env.STRIPE_STANDARD_MONTHLY_PRICE_ID || 'price_standard_monthly',
    yearlyPriceId: process.env.STRIPE_STANDARD_YEARLY_PRICE_ID || 'price_standard_yearly',
    monthlyPrice: 500, // £500/month
    yearlyPrice: 5000, // £5000/year (2 months free)
    workerLimit: -1, // Unlimited
    clientLimit: -1, // Unlimited
    features: [
      'Unlimited workers',
      'Unlimited clients',
      'Full scheduling features',
      'Time tracking & timesheets',
      'Invoicing & payroll',
      'Reports & analytics',
      'Compliance management',
      'Priority email & phone support',
      'API access',
    ],
  },
  ENTERPRISE: {
    name: 'Enterprise',
    monthlyPriceId: process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID || 'price_enterprise_custom',
    yearlyPriceId: process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID || 'price_enterprise_custom',
    monthlyPrice: null, // Custom pricing - contact us
    yearlyPrice: null, // Custom pricing - contact us
    workerLimit: -1, // Unlimited
    clientLimit: -1, // Unlimited
    isCustomPricing: true,
    features: [
      'Everything in Standard',
      'White-label branding',
      'Custom integrations',
      'Dedicated account manager',
      '24/7 phone support',
      'On-site training',
      'Custom SLA',
      'Volume discounts',
    ],
  },
};

export interface CreateCustomerInput {
  organizationId: string;
  email: string;
  name: string;
  metadata?: Record<string, string>;
}

export interface CreateSubscriptionInput {
  organizationId: string;
  planTier: PlanTier;
  billingCycle: 'monthly' | 'yearly';
  paymentMethodId?: string;
  trialDays?: number;
}

export interface UpdateSubscriptionInput {
  subscriptionId: string;
  planTier?: PlanTier;
  billingCycle?: 'monthly' | 'yearly';
  cancelAtPeriodEnd?: boolean;
}

class StripeService {
  /**
   * Create a Stripe customer for an organization
   */
  async createCustomer(input: CreateCustomerInput): Promise<Stripe.Customer | null> {
    if (!isStripeConfigured() || !stripe) return null;

    const customer = await stripe.customers.create({
      email: input.email,
      name: input.name,
      metadata: {
        organizationId: input.organizationId,
        ...input.metadata,
      },
    });

    return customer;
  }

  /**
   * Get or create a Stripe customer
   */
  async getOrCreateCustomer(organizationId: string): Promise<string | null> {
    if (!isStripeConfigured() || !stripe) return null;

    // Check if subscription exists with customer ID
    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
    });

    if (subscription?.stripeCustomerId) {
      return subscription.stripeCustomerId;
    }

    // Get organization details
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        users: {
          where: { role: 'ADMIN' },
          take: 1,
        },
      },
    });

    if (!organization) {
      throw new Error('Organization not found');
    }

    const adminEmail = organization.users[0]?.email || `billing@${organization.name.toLowerCase().replace(/\s+/g, '')}.com`;

    // Create Stripe customer
    const customer = await this.createCustomer({
      organizationId,
      email: adminEmail,
      name: organization.name,
    });

    return customer?.id || null;
  }

  /**
   * Create a subscription with optional trial
   */
  async createSubscription(input: CreateSubscriptionInput): Promise<{
    subscription: Stripe.Subscription;
    clientSecret?: string;
  } | null> {
    if (!isStripeConfigured() || !stripe) return null;

    const plan = PLANS[input.planTier];
    const priceId = input.billingCycle === 'yearly' ? plan.yearlyPriceId : plan.monthlyPriceId;

    // Get or create customer
    const customerId = await this.getOrCreateCustomer(input.organizationId);

    // Attach payment method if provided
    if (input.paymentMethodId) {
      await stripe.paymentMethods.attach(input.paymentMethodId, {
        customer: customerId,
      });

      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: input.paymentMethodId,
        },
      });
    }

    // Create subscription
    const subscriptionParams: Stripe.SubscriptionCreateParams = {
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        organizationId: input.organizationId,
        planTier: input.planTier,
      },
    };

    // Add trial if specified
    if (input.trialDays && input.trialDays > 0) {
      subscriptionParams.trial_period_days = input.trialDays;
    }

    const subscription = await stripe.subscriptions.create(subscriptionParams);

    // Get client secret for payment confirmation
    let clientSecret: string | undefined;
    const latestInvoice = subscription.latest_invoice as Stripe.Invoice;
    if (latestInvoice?.payment_intent) {
      const paymentIntent = latestInvoice.payment_intent as Stripe.PaymentIntent;
      clientSecret = paymentIntent.client_secret || undefined;
    }

    // Save subscription to database
    await this.syncSubscriptionToDatabase(subscription, input.organizationId);

    return { subscription, clientSecret };
  }

  /**
   * Update an existing subscription
   */
  async updateSubscription(input: UpdateSubscriptionInput): Promise<Stripe.Subscription> {
    const dbSubscription = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: input.subscriptionId },
    });

    if (!dbSubscription) {
      throw new Error('Subscription not found');
    }

    const updateParams: Stripe.SubscriptionUpdateParams = {};

    // Update plan/price
    if (input.planTier || input.billingCycle) {
      const plan = PLANS[input.planTier || dbSubscription.planTier];
      const cycle = input.billingCycle || 'monthly';
      const priceId = cycle === 'yearly' ? plan.yearlyPriceId : plan.monthlyPriceId;

      // Get current subscription to find the item ID
      const currentSub = await stripe.subscriptions.retrieve(input.subscriptionId);
      const itemId = currentSub.items.data[0]?.id;

      if (itemId) {
        updateParams.items = [{ id: itemId, price: priceId }];
        updateParams.proration_behavior = 'create_prorations';
      }
    }

    // Cancel at period end
    if (input.cancelAtPeriodEnd !== undefined) {
      updateParams.cancel_at_period_end = input.cancelAtPeriodEnd;
    }

    const subscription = await stripe.subscriptions.update(input.subscriptionId, updateParams);

    // Sync to database
    await this.syncSubscriptionToDatabase(subscription, dbSubscription.organizationId);

    return subscription;
  }

  /**
   * Cancel a subscription immediately
   */
  async cancelSubscription(subscriptionId: string, immediately: boolean = false): Promise<Stripe.Subscription> {
    const dbSubscription = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: subscriptionId },
    });

    if (!dbSubscription) {
      throw new Error('Subscription not found');
    }

    let subscription: Stripe.Subscription;

    if (immediately) {
      subscription = await stripe.subscriptions.cancel(subscriptionId);
    } else {
      subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    }

    // Sync to database
    await this.syncSubscriptionToDatabase(subscription, dbSubscription.organizationId);

    return subscription;
  }

  /**
   * Resume a canceled subscription
   */
  async resumeSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });

    const dbSubscription = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: subscriptionId },
    });

    if (dbSubscription) {
      await this.syncSubscriptionToDatabase(subscription, dbSubscription.organizationId);
    }

    return subscription;
  }

  /**
   * Create a checkout session for subscription
   */
  async createCheckoutSession(
    organizationId: string,
    planTier: PlanTier,
    billingCycle: 'monthly' | 'yearly',
    successUrl: string,
    cancelUrl: string
  ): Promise<Stripe.Checkout.Session> {
    const plan = PLANS[planTier];
    const priceId = billingCycle === 'yearly' ? plan.yearlyPriceId : plan.monthlyPriceId;
    const customerId = await this.getOrCreateCustomer(organizationId);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: {
        trial_period_days: FREE_TRIAL_DAYS,
        metadata: {
          organizationId,
          planTier,
        },
      },
      metadata: {
        organizationId,
        planTier,
      },
    });

    return session;
  }

  /**
   * Create a billing portal session
   */
  async createBillingPortalSession(
    organizationId: string,
    returnUrl: string
  ): Promise<Stripe.BillingPortal.Session> {
    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
    });

    if (!subscription?.stripeCustomerId) {
      throw new Error('No subscription found for this organization');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: returnUrl,
    });

    return session;
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['latest_invoice', 'default_payment_method'],
    });
  }

  /**
   * Get payment methods for a customer
   */
  async getPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });

    return paymentMethods.data;
  }

  /**
   * Create a setup intent for adding a payment method
   */
  async createSetupIntent(organizationId: string): Promise<Stripe.SetupIntent> {
    const customerId = await this.getOrCreateCustomer(organizationId);

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
    });

    return setupIntent;
  }

  /**
   * Get invoices for an organization
   */
  async getInvoices(customerId: string, limit: number = 10): Promise<Stripe.Invoice[]> {
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit,
    });

    return invoices.data;
  }

  /**
   * Sync Stripe subscription to database
   */
  async syncSubscriptionToDatabase(
    stripeSubscription: Stripe.Subscription,
    organizationId: string
  ): Promise<void> {
    const planTier = (stripeSubscription.metadata.planTier as PlanTier) || 'STARTER';
    const plan = PLANS[planTier];

    const status = this.mapStripeStatus(stripeSubscription.status);

    await prisma.subscription.upsert({
      where: { organizationId },
      create: {
        organizationId,
        stripeCustomerId: stripeSubscription.customer as string,
        stripeSubscriptionId: stripeSubscription.id,
        stripePriceId: stripeSubscription.items.data[0]?.price.id,
        planTier,
        status,
        workerLimit: plan.workerLimit,
        clientLimit: plan.clientLimit,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        canceledAt: stripeSubscription.canceled_at
          ? new Date(stripeSubscription.canceled_at * 1000)
          : null,
        trialStart: stripeSubscription.trial_start
          ? new Date(stripeSubscription.trial_start * 1000)
          : null,
        trialEnd: stripeSubscription.trial_end
          ? new Date(stripeSubscription.trial_end * 1000)
          : null,
      },
      update: {
        stripeSubscriptionId: stripeSubscription.id,
        stripePriceId: stripeSubscription.items.data[0]?.price.id,
        planTier,
        status,
        workerLimit: plan.workerLimit,
        clientLimit: plan.clientLimit,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        canceledAt: stripeSubscription.canceled_at
          ? new Date(stripeSubscription.canceled_at * 1000)
          : null,
        trialStart: stripeSubscription.trial_start
          ? new Date(stripeSubscription.trial_start * 1000)
          : null,
        trialEnd: stripeSubscription.trial_end
          ? new Date(stripeSubscription.trial_end * 1000)
          : null,
      },
    });
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const organizationId = subscription.metadata.organizationId;
        if (organizationId) {
          await this.syncSubscriptionToDatabase(subscription, organizationId);
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        await this.recordPayment(invoice, 'succeeded');
        
        // Send payment success notification
        const paidSubId = (invoice as any).subscription;
        if (paidSubId) {
          const sub = await prisma.subscription.findFirst({
            where: { stripeSubscriptionId: paidSubId as string },
          });
          if (sub) {
            await SubscriptionNotificationService.notifyPaymentSuccessful(
              sub.organizationId,
              invoice.amount_paid / 100,
              invoice.currency.toUpperCase(),
              invoice.hosted_invoice_url || undefined
            );
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await this.recordPayment(invoice, 'failed');
        
        // Send payment failed notification
        const failedSubId = (invoice as any).subscription;
        if (failedSubId) {
          const sub = await prisma.subscription.findFirst({
            where: { stripeSubscriptionId: failedSubId as string },
          });
          if (sub) {
            await SubscriptionNotificationService.notifyPaymentFailed(
              sub.organizationId,
              invoice.amount_due / 100,
              invoice.currency.toUpperCase()
            );
          }
        }
        break;
      }

      case 'customer.subscription.trial_will_end': {
        const subscription = event.data.object as Stripe.Subscription;
        const organizationId = subscription.metadata.organizationId;
        if (organizationId) {
          await this.handleTrialEnding(organizationId, subscription);
        }
        break;
      }

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const organizationId = session.metadata?.organizationId;
        if (organizationId && session.subscription) {
          // Fetch full subscription and sync
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          await this.syncSubscriptionToDatabase(subscription, organizationId);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  }

  /**
   * Handle trial ending notification
   */
  private async handleTrialEnding(organizationId: string, subscription: Stripe.Subscription): Promise<void> {
    const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null;
    const daysRemaining = trialEnd 
      ? Math.floor((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 0;

    // Send trial ending notification via notification service
    await SubscriptionNotificationService.notifyTrialEndingSoon(
      organizationId,
      daysRemaining,
      trialEnd || new Date()
    );

    console.log(`Trial ending notification sent for organization ${organizationId}`);
  }

  /**
   * Record a payment from invoice
   */
  private async recordPayment(invoice: Stripe.Invoice, status: string): Promise<void> {
    if (!invoice.subscription) return;

    const dbSubscription = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: invoice.subscription as string },
    });

    if (!dbSubscription) return;

    await prisma.payment.upsert({
      where: { id: invoice.id },
      create: {
        id: invoice.id,
        subscriptionId: dbSubscription.id,
        stripeInvoiceId: invoice.id,
        stripePaymentIntentId: invoice.payment_intent as string,
        amount: invoice.amount_paid / 100, // Convert from cents
        currency: invoice.currency,
        status,
        invoiceUrl: invoice.hosted_invoice_url || undefined,
        invoicePdf: invoice.invoice_pdf || undefined,
        description: invoice.description || `Invoice for ${dbSubscription.planTier} plan`,
        paidAt: status === 'succeeded' ? new Date() : null,
      },
      update: {
        status,
        paidAt: status === 'succeeded' ? new Date() : null,
      },
    });
  }

  /**
   * Map Stripe subscription status to our enum
   */
  private mapStripeStatus(stripeStatus: Stripe.Subscription.Status): SubscriptionStatus {
    const statusMap: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
      trialing: 'TRIALING',
      active: 'ACTIVE',
      past_due: 'PAST_DUE',
      canceled: 'CANCELED',
      unpaid: 'UNPAID',
      paused: 'PAUSED',
      incomplete: 'UNPAID',
      incomplete_expired: 'CANCELED',
    };

    return statusMap[stripeStatus] || 'UNPAID';
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string | Buffer, signature: string): Stripe.Event | null {
    if (!isStripeConfigured() || !stripe) return null;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }

  /**
   * Get plan limits for an organization
   */
  async getPlanLimits(organizationId: string): Promise<{
    workerLimit: number;
    clientLimit: number;
    currentWorkers: number;
    currentClients: number;
    canAddWorker: boolean;
    canAddClient: boolean;
  }> {
    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
    });

    const [currentWorkers, currentClients] = await Promise.all([
      prisma.user.count({
        where: { organizationId, role: 'WORKER' },
      }),
      prisma.clientCompany.count({
        where: { organizationId },
      }),
    ]);

    const workerLimit = subscription?.workerLimit || 10;
    const clientLimit = subscription?.clientLimit || 5;

    return {
      workerLimit,
      clientLimit,
      currentWorkers,
      currentClients,
      canAddWorker: workerLimit === -1 || currentWorkers < workerLimit,
      canAddClient: clientLimit === -1 || currentClients < clientLimit,
    };
  }
}

export const stripeService = new StripeService();
export default StripeService;
