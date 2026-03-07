import { Router } from 'express';
import { OnboardingController } from '../controllers/onboarding.controller';
import { authenticate, authorizeAdmin } from '../middleware/auth';

const router = Router();
const controller = new OnboardingController();

router.use(authenticate);

// Get onboarding status
router.get('/status', controller.getStatus);

// Complete steps
router.put('/branding', authorizeAdmin, controller.updateBranding);
router.post('/location', authorizeAdmin, controller.addLocation);
router.post('/worker/invite', controller.inviteWorker);
router.post('/client', authorizeAdmin, controller.addClient);
router.post('/team/invite', authorizeAdmin, controller.inviteTeam);

// Skip / Complete
router.put('/skip', authorizeAdmin, controller.skipOnboarding);
router.put('/complete', authorizeAdmin, controller.completeOnboarding);

export default router;
