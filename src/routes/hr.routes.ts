import { Router } from 'express';
import { HRController } from '../controllers/hr.controller';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const hrController = new HRController();

// All HR routes require authentication
router.use(authenticate);

// Default authorization for manager-related routes
const authorizeAdminOps = authorize('ADMIN', 'OPS_MANAGER');

// Manager statistics
router.get('/managers/stats', authorizeAdminOps, asyncHandler(hrController.getManagerStats));

// List managers with pagination, search, filter
router.get('/managers', asyncHandler(hrController.listManagers));

// Export managers to XLS
router.get('/managers/export', asyncHandler(hrController.exportManagers));

// Get single manager
router.get('/managers/:managerId', asyncHandler(hrController.getManager));

// Update manager status
router.patch('/managers/:managerId/status', asyncHandler(hrController.updateManagerStatus));

// Delete manager
router.delete('/managers/:managerId', authorizeAdminOps, asyncHandler(hrController.deleteManager));

// ============================================================
// WORKER-MANAGER ASSIGNMENT
// ============================================================

// Get staff with worker counts
router.get('/staff/worker-counts', authorizeAdminOps, asyncHandler(hrController.getStaffWithWorkerCounts));

// Get unassigned workers
router.get('/workers/unassigned', authorizeAdminOps, asyncHandler(hrController.getUnassignedWorkers));

// Get my managed workers (for logged-in staff)
router.get('/workers/my-team', asyncHandler(hrController.getMyManagedWorkers));

// Get managed workers by manager ID
router.get('/:managerId/managed-workers', authorizeAdminOps, asyncHandler(hrController.getManagedWorkers));

// Assign workers to manager (ADMIN and OPS_MANAGER only)
router.post('/:managerId/assign-workers', authorizeAdminOps, asyncHandler(hrController.assignWorkersToManager));

// Unassign workers from manager (ADMIN only)
router.post('/workers/unassign', authorize('ADMIN'), asyncHandler(hrController.unassignWorkersFromManager));

export default router;
