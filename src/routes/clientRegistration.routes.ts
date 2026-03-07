import { Router } from 'express';
import { ClientRegistrationController } from '../controllers/clientRegistration.controller';

const router = Router();
const controller = new ClientRegistrationController();

// Public routes - Client company self-registration
router.post('/validate-code', controller.validateInviteCode);
router.post('/register', controller.register);
router.post('/verify-email', controller.verifyEmail);
router.post('/resend-verification', controller.resendVerification);

// Get agency public info by invite code (for branding on registration page)
router.get('/agency/:inviteCode', controller.getAgencyPublicInfo);

export default router;
