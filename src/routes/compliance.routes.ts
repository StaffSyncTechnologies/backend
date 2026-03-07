import { Router } from 'express';
import { ComplianceController } from '../controllers/compliance.controller';
import { authenticate, authorizeCompliance } from '../middleware/auth';

const router = Router();
const controller = new ComplianceController();

router.use(authenticate);
router.use(authorizeCompliance);

// Dashboard stats
router.get('/stats', controller.getStats);

// List workers for compliance review
router.get('/workers', controller.listWorkers);

// Get single worker RTW details
router.get('/workers/:workerId', controller.getWorkerRTW);

// Verify RTW using API (share code + DOB)
router.post('/workers/:workerId/verify-api', controller.verifyRTWApi);

// Manual RTW approval/rejection
router.post('/workers/:workerId/verify-manual', controller.verifyRTWManual);

// Bulk approve workers
router.post('/bulk-approve', controller.bulkApprove);

export default router;
