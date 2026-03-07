import { Router } from 'express';
import { AttendanceController } from '../controllers/attendance.controller';
import { authenticate, authorizeOps } from '../middleware/auth';

const router = Router();
const controller = new AttendanceController();

router.use(authenticate);

// Worker clock-in/clock-out
router.post('/:shiftId/clock-in', controller.clockIn);
router.post('/:shiftId/clock-out', controller.clockOut);

// Worker status and history
router.get('/my-status', controller.getMyStatus);
router.get('/my-history', controller.getMyHistory);

// Manager/Ops views
router.get('/timesheet/daily', controller.getDailyTimesheet);
router.get('/shift/:shiftId', authorizeOps, controller.getShiftAttendance);
router.get('/flagged', authorizeOps, controller.getFlaggedAttendance);

// Timesheet management (for UI)
router.get('/timesheet/stats', authorizeOps, controller.getTimesheetStats);
router.get('/timesheet/by-client', authorizeOps, controller.getTimesheetByClient);
router.get('/timesheet/client/:clientId', authorizeOps, controller.getClientWeeklyTimesheet);
router.get('/timesheet/list', authorizeOps, controller.getTimesheetList);
router.get('/timesheet/export', authorizeOps, controller.exportTimesheetsXLS);
router.post('/timesheet/bulk-approve', authorizeOps, controller.bulkApproveTimesheets);
router.get('/timesheet/:attendanceId', authorizeOps, controller.getTimesheetDetail);

// Attendance management
router.post('/:attendanceId/approve', authorizeOps, controller.approveAttendance);
router.post('/:attendanceId/flag', authorizeOps, controller.flagAttendance);

export default router;
