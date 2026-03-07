import { Router } from 'express';
import { ReportController } from '../controllers/report.controller';
import { authenticate, authorizeAdmin, authorizeOps } from '../middleware/auth';

const router = Router();
const controller = new ReportController();

router.use(authenticate);

// Workforce Reports
router.get('/workforce', authorizeOps, controller.getWorkforceReport);
router.get('/reliability', authorizeOps, controller.getReliabilityReport);

// Shift Reports
router.get('/shifts', authorizeOps, controller.getShiftReport);

// Attendance Reports
router.get('/attendance', authorizeOps, controller.getAttendanceReport);

// Payroll Reports
router.get('/payroll', authorizeAdmin, controller.getPayrollReport);

// Client Reports
router.get('/clients', authorizeOps, controller.getClientReport);

// Compliance Reports
router.get('/compliance', authorizeOps, controller.getComplianceReport);

// Executive Summary
router.get('/executive-summary', authorizeAdmin, controller.getExecutiveSummary);

export default router;
