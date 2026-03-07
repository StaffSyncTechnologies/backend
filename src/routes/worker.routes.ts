import { Router } from 'express';
import { WorkerController } from '../controllers/worker.controller';
import { authenticate, authorizeOps, authorizeCompliance } from '../middleware/auth';

const router = Router();
const controller = new WorkerController();

router.use(authenticate);

// Worker homepage (must be before :workerId routes)
router.get('/home', controller.getHomepage);

// Worker schedule (must be before :workerId routes)
router.get('/my-schedule', controller.getMySchedule);

// Worker self-service RTW management (must be before :workerId routes)
router.get('/my-rtw', controller.getMyRTW);
router.post('/my-rtw', controller.submitMyRTW);

// Worker self-service skill management (must be before :workerId routes)
router.get('/my-skills', controller.getMySkills);
router.post('/my-skills', controller.addMySkill);
router.delete('/my-skills/:skillId', controller.removeMySkill);

// Worker self-service document management (must be before :workerId routes)
router.get('/my-documents', controller.getMyDocuments);
router.post('/my-documents', controller.uploadMyDocument);
router.delete('/my-documents/:docId', controller.deleteMyDocument);

// Export workers (must be before :workerId routes)
router.get('/export', authorizeOps, controller.export);

// List workers
router.get('/', authorizeOps, controller.list);
router.get('/list-stats', authorizeOps, controller.getListStats);
router.get('/:workerId', authorizeOps, controller.getById);
router.get('/:workerId/stats', authorizeOps, controller.getStats);
router.get('/:workerId/shifts', authorizeOps, controller.getShifts);

// Worker profile
router.get('/:workerId/profile', authorizeOps, controller.getProfile);
router.put('/:workerId/profile', authorizeOps, controller.updateProfile);

// Skills
router.get('/:workerId/skills', authorizeOps, controller.getSkills);
router.put('/:workerId/skills', authorizeOps, controller.updateSkills);

// Documents
router.get('/:workerId/documents', authorizeOps, controller.getDocuments);
router.post('/:workerId/documents', authorizeOps, controller.uploadDocument);
router.put('/:workerId/documents/:docId/verify', authorizeCompliance, controller.verifyDocument);
router.delete('/:workerId/documents/:docId', authorizeOps, controller.deleteDocument);

// RTW
router.get('/:workerId/rtw', authorizeCompliance, controller.getRTWStatus);
router.post('/:workerId/rtw/initiate', authorizeCompliance, controller.initiateRTW);
router.put('/:workerId/rtw/update', authorizeCompliance, controller.updateRTW);

// Availability
router.get('/:workerId/availability', authorizeOps, controller.getAvailability);
router.put('/:workerId/availability', authorizeOps, controller.updateAvailability);

// Blocks
router.get('/:workerId/blocks', authorizeOps, controller.getBlocks);
router.post('/:workerId/blocks', authorizeOps, controller.createBlock);
router.put('/:workerId/blocks/:blockId/lift', authorizeOps, controller.liftBlock);

// Reliability score
router.get('/:workerId/reliability', authorizeOps, controller.getReliability);

// Suspend/Reactivate
router.put('/:workerId/suspend', authorizeOps, controller.suspend);
router.put('/:workerId/reactivate', authorizeOps, controller.reactivate);

// Invite worker
router.post('/invite', authorizeOps, controller.invite);

// Worker-Client Assignment (validates manager is assigned to client)
router.post('/bulk-assign-client', authorizeOps, controller.bulkAssignToClient);
router.get('/:workerId/clients', authorizeOps, controller.getWorkerClients);
router.post('/:workerId/assign-client', authorizeOps, controller.assignToClient);
router.post('/:workerId/transfer', authorizeOps, controller.transferToClient);
router.post('/:workerId/remove-client', authorizeOps, controller.removeFromClient);
router.get('/client/:clientCompanyId/available', authorizeOps, controller.getAvailableWorkersForClient);

export default router;
