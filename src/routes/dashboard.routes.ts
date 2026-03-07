import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
const controller = new DashboardController();

// All routes require authentication
router.use(authenticate);

// Role-based dashboard - returns data based on user role
router.get('/my-dashboard', controller.getRoleDashboard);

// Agency dashboard - shows registered client companies
router.get('/', controller.getAgencyDashboard);
router.get('/stats', controller.getStats);
router.get('/recent-clients', controller.getRecentClients);
router.get('/recent-workers', controller.getRecentWorkers);
router.get('/pending-approvals', controller.getPendingApprovals);
router.get('/shifts-overview', controller.getShiftsOverview);

// Admin dashboard endpoints - accessible to all authenticated staff
router.get('/admin/stats', controller.getAdminStats);
router.get('/admin/shifts-by-day', controller.getShiftsByDay);
router.get('/admin/workers-availability', controller.getWorkersAvailability);
router.get('/admin/recent-activity', controller.getRecentActivity);

export default router;
