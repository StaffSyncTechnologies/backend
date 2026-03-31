// ============================================================
// ENHANCED CLIENT REGISTRATION ROUTES
// Supports multi-agency client onboarding
// ============================================================

import { Router } from 'express';
import { EnhancedClientRegistrationController } from '../controllers/enhancedClientRegistration.controller';

const router = Router();
const controller = new EnhancedClientRegistrationController();

/**
 * Enhanced Client Registration API Routes
 * 
 * POST /api/v1/enhanced-client-registration/validate-code
 * POST /api/v1/enhanced-client-registration/register  
 * POST /api/v1/enhanced-client-registration/join-agency
 */

// Validate invite code and detect if user is new or existing
router.post('/validate-code', controller.validateInviteCode);

// Register new client (first-time users)
router.post('/register', controller.register);

// Join additional agency (existing users)
router.post('/join-agency', controller.joinAgency);

export default router;
