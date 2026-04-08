import { Router } from 'express';
import { ChatController } from '../controllers/chat.controller';
import { authenticate } from '../middleware/auth';
import multer from 'multer';

const router = Router();
const controller = new ChatController();

// Multer configuration for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images, documents, audio, and video files
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/ogg',
      'video/mp4', 'video/avi', 'video/mov'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

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

// File upload and enhanced message endpoints
router.post('/upload', upload.single('file'), controller.uploadFile);
router.post('/rooms/:roomId/send-with-attachments', controller.sendMessageWithAttachments);

export default router;
