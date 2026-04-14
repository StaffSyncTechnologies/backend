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

// Check worker limit status
router.get('/worker-limit', asyncHandler(controller.checkWorkerLimit));

// Get upgrade options
router.get('/upgrade-options', asyncHandler(controller.getUpgradeOptions));

// User subscription management endpoints (authenticated users only)
router.post('/checkout', asyncHandler(controller.createCheckoutSession));

router.post('/', asyncHandler(controller.createSubscription));

router.put('/', asyncHandler(controller.updateSubscription));

router.put('/worker-count', asyncHandler(controller.updateWorkerCount));

router.post('/upgrade', asyncHandler(controller.upgradePlan));

router.post('/cancel', asyncHandler(controller.cancelSubscription));

router.post('/resume', asyncHandler(controller.resumeSubscription));

router.post('/billing-portal', asyncHandler(controller.getBillingPortal));

router.post('/setup-intent', asyncHandler(controller.createSetupIntent));

router.post('/enterprise-request', asyncHandler(controller.requestEnterprisePlan));

// Admin-only routes
router.use(authorizeAdmin);

// Export both routers
export { webhookRouter };
export default router;
