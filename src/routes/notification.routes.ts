import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = new NotificationController();

// All routes require authentication
router.use(authenticate);

// Get notifications (paginated)
router.get('/', asyncHandler(controller.getNotifications));

// Get unread count
router.get('/unread-count', asyncHandler(controller.getUnreadCount));

// Mark notification as read
router.post('/:id/read', asyncHandler(controller.markAsRead));

// Mark all notifications as read
router.post('/read-all', asyncHandler(controller.markAllAsRead));

// Register device for push notifications
router.post('/register-device', asyncHandler(controller.registerDevice));

// Deactivate device
router.post('/deactivate-device', asyncHandler(controller.deactivateDevice));

// Notification preferences
router.get('/preferences', asyncHandler(controller.getPreferences));
router.put('/preferences', asyncHandler(controller.updatePreference));
router.put('/preferences/bulk', asyncHandler(controller.updatePreferencesBulk));

export default router;
