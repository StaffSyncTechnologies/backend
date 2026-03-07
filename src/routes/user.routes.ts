import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { AuthController } from '../controllers/auth.controller';
import { authenticate, authorizeAdmin, authorizeOps } from '../middleware/auth';

const router = Router();
const controller = new UserController();
const authController = new AuthController();

router.use(authenticate);

// List users (admin/ops)
router.get('/', authorizeOps, controller.list);
router.get('/:userId', authorizeOps, controller.getById);

// Create team member (admin only)
router.post('/', authorizeAdmin, controller.create);
router.put('/:userId', authorizeAdmin, controller.update);
router.delete('/:userId', authorizeAdmin, controller.delete);

// Suspend/reactivate
router.post('/:userId/suspend', authorizeAdmin, controller.suspend);
router.post('/:userId/reactivate', authorizeAdmin, controller.reactivate);

// Resend invite
router.post('/:userId/resend-invite', authorizeAdmin, authController.resendStaffInvite);

export default router;
