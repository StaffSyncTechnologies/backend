// ============================================================
// SIMPLE CLIENT AGENCY ASSIGNMENT ROUTES
// ============================================================

import { Router } from 'express';
import { ClientAgencyController } from '../controllers/clientAgency.controller';
import { authenticate, authorize } from '../middleware/auth';
import { ClientAgencyService } from '../services/clientAgency.service';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();
const clientAgencyService = new ClientAgencyService(prisma);
const clientAgencyController = new ClientAgencyController(clientAgencyService, prisma);

// All routes require authentication
router.use(authenticate);

/**
 * @route PUT /api/v1/admin/client/:clientCompanyId/agency
 * @desc Update client's agency assignment
 * @access Admin only
 */
router.put('/client/:clientCompanyId/agency', authorize('ADMIN'), clientAgencyController.updateClientAgency);

/**
 * @route GET /api/v1/admin/client/:clientCompanyId/agency
 * @desc Get client's current agency
 * @access Admin only
 */
router.get('/client/:clientCompanyId/agency', authorize('ADMIN'), clientAgencyController.getClientAgency);

/**
 * @route GET /api/v1/admin/agencies
 * @desc List all available agencies for assignment
 * @access Admin only
 */
router.get('/agencies', authorize('ADMIN'), clientAgencyController.getAvailableAgencies);

export default router;
