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
import { config } from '../../config';

// Initialize Stripe only if key is provided
const stripe = config.stripe.secretKey 
  ? new Stripe(config.stripe.secretKey, { apiVersion: '2026-01-28.clover' as any })
  : null;

const isStripeConfigured = (): boolean => {
  if (!stripe) {
    console.warn('⚠️  Stripe not configured. Set STRIPE_SECRET_KEY in .env');
    return false;
  }
  return true;
};

// Trial duration from config
export const FREE_TRIAL_DAYS = config.stripe.freeTrialDays;

/**
 * Helper: Calculate total price based on worker count
 */
export function calculateTotalPrice(
  planTier: PlanTier,
  workerCount: number,
  billingCycle: 'monthly' | 'yearly'
): number {
  const plan = PLANS[planTier as keyof typeof PLANS];
  
  if (!plan || (plan as any).isCustomPricing) {
    return 0; // Enterprise - contact sales
  }
  
  const pricePerWorker = billingCycle === 'yearly' 
    ? plan.yearlyPricePerWorker 
    : plan.monthlyPricePerWorker;
  
  // Handle null prices (Enterprise tier)
  if (pricePerWorker === null || pricePerWorker === undefined) {
    return 0;
  }
  
  return workerCount * pricePerWorker;
}

/**
 * Helper: Determine appropriate plan tier based on worker count
 */
export function determinePlanTier(workerCount: number): PlanTier {
  if (workerCount <= 10) return 'STARTER' as PlanTier;
  if (workerCount <= 50) return 'PROFESSIONAL' as PlanTier;
  if (workerCount <= 200) return 'BUSINESS' as PlanTier;
  return 'ENTERPRISE' as PlanTier;
}

// Plan configuration - per-worker pricing model
export const PLANS = {
  FREE: {
    name: 'Free Trial',
    trialDays: FREE_TRIAL_DAYS,
    monthlyPricePerWorker: 0,
    yearlyPricePerWorker: 0,
    minWorkers: 1,
    maxWorkers: -1,
    workerLimit: -1,
    clientLimit: -1,
    features: [
      `${FREE_TRIAL_DAYS}-day free trial`,
      'Unlimited workers',
      'Full scheduling features',
      'Time tracking & timesheets',
      'Invoicing & payroll',
      'Reports & analytics',
      'Email support',
    ],
  },
  STARTER: {
    name: config.stripe.perWorkerPricing.starter.name,
    monthlyPricePerWorker: config.stripe.perWorkerPricing.starter.monthlyPricePerWorker,
    yearlyPricePerWorker: config.stripe.perWorkerPricing.starter.yearlyPricePerWorker,
    minWorkers: config.stripe.perWorkerPricing.starter.minWorkers,
    maxWorkers: config.stripe.perWorkerPricing.starter.maxWorkers,
    workerLimit: config.stripe.perWorkerPricing.starter.maxWorkers,
    clientLimit: -1,
    stripePriceId: config.stripe.perWorkerPricing.starter.stripePriceId,
    monthlyStripePriceId: (config.stripe.perWorkerPricing.starter as any).monthlyStripePriceId,
    yearlyStripePriceId: (config.stripe.perWorkerPricing.starter as any).yearlyStripePriceId,
    features: config.stripe.perWorkerPricing.starter.features,
  },
  PROFESSIONAL: {
    name: config.stripe.perWorkerPricing.professional.name,
    monthlyPricePerWorker: config.stripe.perWorkerPricing.professional.monthlyPricePerWorker,
    yearlyPricePerWorker: config.stripe.perWorkerPricing.professional.yearlyPricePerWorker,
    minWorkers: config.stripe.perWorkerPricing.professional.minWorkers,
    maxWorkers: config.stripe.perWorkerPricing.professional.maxWorkers,
    workerLimit: config.stripe.perWorkerPricing.professional.maxWorkers,
    clientLimit: -1,
    stripePriceId: config.stripe.perWorkerPricing.professional.stripePriceId,
    monthlyStripePriceId: (config.stripe.perWorkerPricing.professional as any).monthlyStripePriceId,
    yearlyStripePriceId: (config.stripe.perWorkerPricing.professional as any).yearlyStripePriceId,
    features: config.stripe.perWorkerPricing.professional.features,
  },
  BUSINESS: {
    name: config.stripe.perWorkerPricing.business.name,
    monthlyPricePerWorker: config.stripe.perWorkerPricing.business.monthlyPricePerWorker,
    yearlyPricePerWorker: config.stripe.perWorkerPricing.business.yearlyPricePerWorker,
    minWorkers: config.stripe.perWorkerPricing.business.minWorkers,
    maxWorkers: config.stripe.perWorkerPricing.business.maxWorkers,
    workerLimit: config.stripe.perWorkerPricing.business.maxWorkers,
    clientLimit: -1,
    stripePriceId: config.stripe.perWorkerPricing.business.stripePriceId,
    monthlyStripePriceId: (config.stripe.perWorkerPricing.business as any).monthlyStripePriceId,
    yearlyStripePriceId: (config.stripe.perWorkerPricing.business as any).yearlyStripePriceId,
    features: config.stripe.perWorkerPricing.business.features,
  },
  ENTERPRISE: {
    name: config.stripe.perWorkerPricing.enterprise.name,
    monthlyPricePerWorker: null,
    yearlyPricePerWorker: null,
    minWorkers: config.stripe.perWorkerPricing.enterprise.minWorkers,
    maxWorkers: config.stripe.perWorkerPricing.enterprise.maxWorkers,
    workerLimit: -1,
    clientLimit: -1,
    stripePriceId: config.stripe.perWorkerPricing.enterprise.stripePriceId,
    monthlyStripePriceId: (config.stripe.perWorkerPricing.enterprise as any).monthlyStripePriceId,
    yearlyStripePriceId: (config.stripe.perWorkerPricing.enterprise as any).yearlyStripePriceId,
    isCustomPricing: true,
    features: config.stripe.perWorkerPricing.enterprise.features,
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
  workerCount: number; // Number of workers to bill for
  paymentMethodId?: string;
  trialDays?: number;
}

export interface UpdateSubscriptionInput {
  subscriptionId: string;
  planTier?: PlanTier;
  billingCycle?: 'monthly' | 'yearly';
  workerCount?: number;
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
   * Create a subscription with per-worker pricing
   */
  async createSubscription(input: CreateSubscriptionInput): Promise<{
    subscription: Stripe.Subscription;
    clientSecret?: string;
  } | null> {
    if (!isStripeConfigured() || !stripe) return null;

    const plan = PLANS[input.planTier as keyof typeof PLANS];
    
    // For Enterprise, require custom pricing setup
    if ((plan as any).isCustomPricing) {
      throw new Error('Enterprise plan requires custom pricing. Please contact sales.');
    }

    // Get the Stripe price ID for this plan
    const priceId = (plan as any).stripePriceId;
    
    if (!priceId) {
      throw new Error(`No Stripe price ID configured for ${input.planTier} plan`);
    }

    // Get or create customer
    const customerId = await this.getOrCreateCustomer(input.organizationId);

    // Attach payment method if provided
    if (input.paymentMethodId) {
      await stripe.paymentMethods.attach(input.paymentMethodId, {
        customer: customerId!,
      });

      await stripe.customers.update(customerId!, {
        invoice_settings: {
          default_payment_method: input.paymentMethodId,
        },
      });
    }

    // Create subscription with quantity (worker count)
    const subscriptionParams: Stripe.SubscriptionCreateParams = {
      customer: customerId!,
      items: [{ 
        price: priceId,
        quantity: input.workerCount, // Per-worker billing
      }],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        organizationId: input.organizationId,
        planTier: input.planTier,
        workerCount: input.workerCount.toString(),
        billingCycle: input.billingCycle,
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
    if ((latestInvoice as any)?.payment_intent) {
      const paymentIntent = (latestInvoice as any).payment_intent as Stripe.PaymentIntent;
      clientSecret = paymentIntent.client_secret || undefined;
    }

    // Save subscription to database
    await this.syncSubscriptionToDatabase(subscription, input.organizationId, input.workerCount, input.billingCycle);

    return { subscription, clientSecret };
  }

  /**
   * Update an existing subscription
   */
  async updateSubscription(input: UpdateSubscriptionInput): Promise<Stripe.Subscription> {
    if (!isStripeConfigured() || !stripe) throw new Error('Stripe not configured');

    const dbSubscription = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: input.subscriptionId },
    });

    if (!dbSubscription) {
      throw new Error('Subscription not found');
    }

    const updateParams: Stripe.SubscriptionUpdateParams = {};

    // Get current subscription to find the item ID
    const currentSub = await stripe.subscriptions.retrieve(input.subscriptionId);
    const itemId = currentSub.items.data[0]?.id;

    // Update plan/price and/or worker count
    if (input.planTier || input.billingCycle || input.workerCount) {
      const planTier = input.planTier || dbSubscription.planTier;
      const plan = PLANS[planTier as keyof typeof PLANS];
      const cycle = input.billingCycle || 'monthly';
      
      // Determine price ID based on billing cycle
      const pricePerWorker = cycle === 'yearly' 
        ? plan.yearlyPricePerWorker 
        : plan.monthlyPricePerWorker;
      
      const stripePriceId = (plan as any).stripePriceId;

      if (itemId && stripePriceId) {
        const quantity = input.workerCount || dbSubscription.workerCount || 1;
        
        updateParams.items = [{ 
          id: itemId, 
          price: stripePriceId as string,
          quantity: quantity,
        }];
        updateParams.proration_behavior = 'create_prorations';
        
        // Update metadata
        updateParams.metadata = {
          organizationId: dbSubscription.organizationId,
          planTier: planTier,
          workerCount: quantity.toString(),
          billingCycle: cycle,
        };
      }
    } else if (input.workerCount && itemId) {
      // Just update quantity without changing price
      updateParams.items = [{ 
        id: itemId, 
        quantity: input.workerCount,
      }];
      updateParams.proration_behavior = 'create_prorations';
      
      updateParams.metadata = {
        ...currentSub.metadata,
        workerCount: input.workerCount.toString(),
      };
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
    if (!isStripeConfigured() || !stripe) throw new Error('Stripe not configured');

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
    if (!isStripeConfigured() || !stripe) throw new Error('Stripe not configured');

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
   * Create a checkout session for subscription with per-worker pricing
   */
  async createCheckoutSession(
    organizationId: string,
    planTier: PlanTier,
    billingCycle: 'monthly' | 'yearly',
    successUrl: string,
    cancelUrl: string,
    workerCount: number = 1
  ): Promise<Stripe.Checkout.Session> {
    if (!isStripeConfigured() || !stripe) throw new Error('Stripe not configured');

    const plan = PLANS[planTier as keyof typeof PLANS];
    
    // For Enterprise, require custom pricing
    if ((plan as any).isCustomPricing) {
      throw new Error('Enterprise plan requires custom pricing. Please contact sales.');
    }
    
    const priceId = billingCycle === 'yearly'
      ? ((plan as any).yearlyStripePriceId || (plan as any).stripePriceId)
      : ((plan as any).monthlyStripePriceId || (plan as any).stripePriceId);
    
    if (!priceId) {
      throw new Error(`No Stripe price ID configured for ${planTier} ${billingCycle} plan. Please check environment variables.`);
    }
    
    const customerId = await this.getOrCreateCustomer(organizationId);

    try {
      const session = await stripe.checkout.sessions.create({
        customer: customerId!,
        mode: 'subscription',
        line_items: [{ 
          price: priceId,
          quantity: workerCount, // Per-worker billing
        }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        subscription_data: {
          metadata: {
            organizationId,
            planTier,
            workerCount: workerCount.toString(),
            billingCycle,
          },
        },
        metadata: {
          organizationId,
          planTier,
          workerCount: workerCount.toString(),
          billingCycle,
        },
      });

      return session;
    } catch (error: any) {
      // If Stripe price IDs are for live mode but we're using test key, return a mock session
      if (error.message?.includes('test mode key was used') || error.message?.includes('No such price')) {
        console.warn('Stripe price IDs not configured for test mode, returning mock session');
        return {
          id: 'demo_session_' + Date.now(),
          url: successUrl.replace('{CHECKOUT_SESSION_ID}', 'demo').replace('?success=true', '?success=demo').replace('/settings/', '/#/settings/'),
        } as Stripe.Checkout.Session;
      }
      throw error;
    }
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

    if (!isStripeConfigured() || !stripe) throw new Error('Stripe not configured');

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
    if (!isStripeConfigured() || !stripe) throw new Error('Stripe not configured');

    return stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['latest_invoice', 'default_payment_method'],
    });
  }

  /**
   * Get payment methods for a customer
   */
  async getPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
    if (!isStripeConfigured() || !stripe) throw new Error('Stripe not configured');

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
    if (!isStripeConfigured() || !stripe) throw new Error('Stripe not configured');

    const customerId = await this.getOrCreateCustomer(organizationId);

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId!,
      payment_method_types: ['card'],
    });

    return setupIntent;
  }

  /**
   * Get invoices for an organization
   */
  async getInvoices(customerId: string, limit: number = 10): Promise<Stripe.Invoice[]> {
    if (!isStripeConfigured() || !stripe) throw new Error('Stripe not configured');

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
    organizationId: string,
    workerCount?: number,
    billingCycle?: 'monthly' | 'yearly'
  ): Promise<void> {
    const planTier = (stripeSubscription.metadata.planTier as PlanTier) || 'STARTER';
    const plan = PLANS[planTier as keyof typeof PLANS];

    const status = this.mapStripeStatus(stripeSubscription.status);
    
    // Get worker count from metadata or parameter
    const finalWorkerCount = workerCount || 
      parseInt(stripeSubscription.metadata.workerCount || '0') || 
      stripeSubscription.items.data[0]?.quantity || 
      0;
    
    // Get billing cycle from metadata or parameter
    const finalBillingCycle = billingCycle || 
      (stripeSubscription.metadata.billingCycle as 'monthly' | 'yearly') || 
      'monthly';
    
    // Calculate price per worker
    const pricePerWorker = finalBillingCycle === 'yearly' 
      ? plan.yearlyPricePerWorker 
      : plan.monthlyPricePerWorker;

    await prisma.subscription.upsert({
      where: { organizationId },
      create: {
        organizationId,
        stripeCustomerId: stripeSubscription.customer as string,
        stripeSubscriptionId: stripeSubscription.id,
        stripePriceId: stripeSubscription.items.data[0]?.price.id,
        planTier,
        status,
        billingCycle: finalBillingCycle,
        workerCount: finalWorkerCount,
        pricePerWorker: pricePerWorker || 0,
        workerLimit: plan.workerLimit,
        clientLimit: plan.clientLimit,
        currentPeriodStart: new Date((stripeSubscription as any).current_period_start * 1000),
        currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000),
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
        billingCycle: finalBillingCycle,
        workerCount: finalWorkerCount,
        pricePerWorker: pricePerWorker || 0,
        workerLimit: plan.workerLimit,
        clientLimit: plan.clientLimit,
        currentPeriodStart: new Date((stripeSubscription as any).current_period_start * 1000),
        currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000),
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
        if (organizationId && session.subscription && stripe) {
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
    const invoiceSubscription = (invoice as any).subscription;
    if (!invoiceSubscription) return;

    const dbSubscription = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: invoiceSubscription as string },
    });

    if (!dbSubscription) return;

    await prisma.payment.upsert({
      where: { id: invoice.id },
      create: {
        id: invoice.id,
        subscriptionId: dbSubscription.id,
        stripeInvoiceId: invoice.id,
        stripePaymentIntentId: (invoice as any).payment_intent as string,
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
    const webhookSecret = config.stripe.webhookSecret;
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

    const workerLimit = subscription?.workerLimit || -1;
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
