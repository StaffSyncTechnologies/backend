import { Router } from 'express';
import { NearbyAgencyController } from '../controllers/nearbyAgency.controller';

const router = Router();
const controller = new NearbyAgencyController();

router.get('/nearby', controller.getNearby);

export default router;
