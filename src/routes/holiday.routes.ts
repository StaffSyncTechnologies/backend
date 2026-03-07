import { Router } from 'express';
import { HolidayController } from '../controllers/holiday.controller';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = new HolidayController();

// All routes require authentication
router.use(authenticate);

// Worker routes
router.get('/', asyncHandler(controller.getHolidays));
router.get('/entitlement', asyncHandler(controller.getEntitlement));
router.post('/', asyncHandler(controller.createLeaveRequest));
router.get('/:id', asyncHandler(controller.getHolidayDetail));
router.post('/:id/cancel', asyncHandler(controller.cancelLeaveRequest));

// Admin/Manager routes - accessible to all authenticated staff
router.get('/admin/requests', asyncHandler(controller.getAllLeaveRequests));
router.post('/grant', asyncHandler(controller.grantLeave));
router.post('/:id/review', asyncHandler(controller.reviewLeaveRequest));
router.put('/entitlement/:workerId', asyncHandler(controller.updateEntitlement));

export default router;
