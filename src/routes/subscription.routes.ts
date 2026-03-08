import { Router, raw } from 'express';
import { SubscriptionController } from '../controllers/subscription.controller';
import { authenticate, authorizeAdmin } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

// Create separate routers
const router = Router();
const webhookRouter = Router();
const controller = new SubscriptionController();

// Public routes
router.get('/plans', asyncHandler(controller.getPlans));

// Webhook-only router (for early registration before body parsing)
webhookRouter.post(
  '/webhook',
  raw({ type: 'application/json' }),
  asyncHandler(controller.handleWebhook)
);

// Protected routes (require authentication)
router.use(authenticate);

// Get current subscription
router.get('/', asyncHandler(controller.getSubscription));

// Get trial status
router.get('/trial', asyncHandler(controller.getTrialStatus));

// Get subscription summary for dashboard
router.get('/summary', asyncHandler(controller.getSummary));

// Get plan limits and usage
router.get('/limits', asyncHandler(controller.getLimits));

// Get payment methods
router.get('/payment-methods', asyncHandler(controller.getPaymentMethods));

// Get invoices/payment history
router.get('/invoices', asyncHandler(controller.getInvoices));

// Get subscription history (for frontend table)
router.get('/history', asyncHandler(controller.getHistory));

// Admin-only routes
router.use(authorizeAdmin);

// Create checkout session
router.post('/checkout', asyncHandler(controller.createCheckoutSession));

// Create subscription directly
router.post('/', asyncHandler(controller.createSubscription));

// Update subscription (upgrade/downgrade)
router.put('/', asyncHandler(controller.updateSubscription));

// Cancel subscription
router.post('/cancel', asyncHandler(controller.cancelSubscription));

// Resume canceled subscription
router.post('/resume', asyncHandler(controller.resumeSubscription));

// Get billing portal URL
router.post('/billing-portal', asyncHandler(controller.getBillingPortal));

// Create setup intent for adding payment method
router.post('/setup-intent', asyncHandler(controller.createSetupIntent));

// Request enterprise plan (contact us)
router.post('/enterprise-request', asyncHandler(controller.requestEnterprisePlan));

// Export both routers
export { webhookRouter };
export default router;
