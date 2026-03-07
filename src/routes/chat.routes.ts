import { Router } from 'express';
import { ChatController } from '../controllers/chat.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
const controller = new ChatController();

router.use(authenticate);

router.get('/rooms', controller.getMyRooms);
router.post('/rooms', controller.getOrCreateRoom);
router.get('/rooms/:roomId/messages', controller.getRoomMessages);
router.post('/rooms/:roomId/read', controller.markAsRead);
router.get('/unread-count', controller.getUnreadCount);
router.post('/worker-room', controller.workerGetOrCreateRoom);
router.get('/workers', controller.getAssignedWorkers);

export default router;
