import { Router } from 'express';
import { LocationController } from '../controllers/location.controller';
import { authenticate, authorizeOps, authorizeAdmin } from '../middleware/auth';

const router = Router();
const controller = new LocationController();

router.use(authenticate);

// Organization locations (static work sites)
router.get('/', controller.list);
router.post('/', authorizeOps, controller.create);
router.get('/:locationId', controller.getById);
router.put('/:locationId', authorizeOps, controller.update);
router.delete('/:locationId', authorizeAdmin, controller.delete);

// Address validation helper
router.get('/validate-address', controller.validateAddress);

// Worker locations (dynamic GPS tracking)
router.put('/worker/me', controller.updateWorkerLocation);           // Worker updates own location
router.get('/worker/all', authorizeOps, controller.listWorkerLocations);  // Get all workers' locations
router.get('/worker/nearby', authorizeOps, controller.getNearbyWorkers);  // Find nearby available workers
router.get('/worker/:workerId', authorizeOps, controller.getWorkerLocation); // Get specific worker location

export default router;
