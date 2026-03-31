import { Router } from 'express';
import { ChatController } from '../controllers/chat.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
const controller = new ChatController();

router.use(authenticate);

// HR-Worker chat routes (existing)
router.get('/rooms', controller.getMyRooms);
router.post('/rooms', controller.getOrCreateRoom);
router.get('/rooms/:roomId/messages', controller.getRoomMessages);
router.post('/rooms/:roomId/read', controller.markAsRead);
router.get('/unread-count', controller.getUnreadCount);
router.post('/worker-room', controller.workerGetOrCreateRoom);
router.get('/workers', controller.getAssignedWorkers);

// Message sending
router.post('/rooms/:roomId/send', controller.sendMessage);

// Client-Agency chat routes (new)
router.get('/client/rooms', controller.clientGetMyRooms);
router.post('/client/rooms', controller.clientGetOrCreateRoom);
router.get('/client/rooms/:roomId/messages', controller.clientGetRoomMessages);
router.post('/client/rooms/:roomId/read', controller.clientMarkAsRead);
router.get('/client/unread-count', controller.clientGetUnreadCount);
router.post('/client/rooms/:roomId/send', controller.clientSendMessage);

router.get('/agency/rooms', controller.agencyGetMyRooms);
router.post('/agency/rooms', controller.agencyGetOrCreateRoom);
router.get('/agency/clients', controller.getAvailableClients);

export default router;
