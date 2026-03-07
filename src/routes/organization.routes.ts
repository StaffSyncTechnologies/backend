import { Router } from 'express';
import { OrganizationController } from '../controllers/organization.controller';
import { authenticate, authorizeAdmin } from '../middleware/auth';
import { uploadLogo, uploadCoverImage } from '../middleware/upload';

const router = Router();
const controller = new OrganizationController();

router.use(authenticate);

// Get current organization
router.get('/current', controller.getCurrent);
router.put('/current', authorizeAdmin, controller.updateCurrent);

// Branding
router.put('/current/branding', authorizeAdmin, controller.updateBranding);
router.post('/current/logo', authorizeAdmin, uploadLogo, controller.uploadLogo);
router.post('/current/cover', authorizeAdmin, uploadCoverImage, controller.uploadCoverImage);

// Settings
router.get('/current/settings', controller.getSettings);
router.put('/current/settings', authorizeAdmin, controller.updateSettings);

// Client companies (Agency mode) - Agency registers clients directly
router.get('/current/clients', controller.getClients);
router.post('/current/clients', authorizeAdmin, controller.createClient);
router.get('/current/clients/:clientId', controller.getClient);
router.put('/current/clients/:clientId', authorizeAdmin, controller.updateClient);
router.delete('/current/clients/:clientId', authorizeAdmin, controller.deleteClient);

// Client company users (managed by agency)
router.get('/current/clients/:clientId/users', controller.getClientUsers);
router.post('/current/clients/:clientId/users', authorizeAdmin, controller.addClientUser);
router.post('/current/clients/:clientId/users/:userId/resend-invite', authorizeAdmin, controller.resendClientInvite);

// Client pay rates
router.put('/current/clients/:clientId/pay-rates', authorizeAdmin, controller.setClientPayRates);

// Invite codes
router.get('/current/invite-codes', controller.getInviteCodes);
router.post('/current/invite-codes', controller.createInviteCode);
router.delete('/current/invite-codes/:codeId', controller.revokeInviteCode);

export default router;
