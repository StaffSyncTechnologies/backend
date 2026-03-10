import { Router } from 'express';
import { InviteRequestController } from '../controllers/inviteRequest.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
const controller = new InviteRequestController();

// Public: worker submits a request
router.post('/invite-request', controller.submit);

// Protected: list requests for the org
router.get('/invite-requests', authenticate, controller.list);

// Protected: approve/reject a request
router.patch('/invite-requests/:id', authenticate, controller.review);

export default router;
