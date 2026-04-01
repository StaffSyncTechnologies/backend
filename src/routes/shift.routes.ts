import { Router } from 'express';
import { ShiftController } from '../controllers/shift.controller';
import { AttendanceController } from '../controllers/attendance.controller';
import { authenticate, authorizeOps } from '../middleware/auth';

const router = Router();
const controller = new ShiftController();
const attendanceController = new AttendanceController();

// Email actions (for email links - no auth required)
router.post('/:shiftId/accept-email', controller.acceptShiftByEmail);
router.post('/:shiftId/reject-email', controller.rejectShiftByEmail);

router.use(authenticate);

// CRUD
router.get('/', controller.list);
router.post('/', authorizeOps, controller.create);

// History (must be before :shiftId routes)
router.get('/my-history', controller.getMyShiftHistory);
router.get('/staff-history', authorizeOps, controller.getStaffShiftHistory);

router.get('/:shiftId', controller.getById);
router.put('/:shiftId', authorizeOps, controller.update);
router.delete('/:shiftId', authorizeOps, controller.delete);

// Assignments
router.get('/:shiftId/assignments', controller.getAssignments);
router.post('/:shiftId/assignments', authorizeOps, controller.assignWorker);
router.delete('/:shiftId/assignments/:assignmentId', authorizeOps, controller.removeAssignment);

// Worker actions
router.post('/:shiftId/accept', controller.acceptShift);
router.post('/:shiftId/decline', controller.declineShift);

// Clock in/out (using AttendanceController for comprehensive validation)
router.post('/:shiftId/clock-in', attendanceController.clockIn);
router.post('/:shiftId/clock-out', attendanceController.clockOut);

// Broadcast
router.post('/:shiftId/broadcast', authorizeOps, controller.broadcast);

// Cancel
router.post('/:shiftId/cancel', authorizeOps, controller.cancel);

export default router;
