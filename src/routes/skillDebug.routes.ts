import { Router } from 'express';
import { SkillDebugController } from '../controllers/skillDebug.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
const skillDebugController = new SkillDebugController();

// Apply authentication to all routes
router.use(authenticate);

// GET /api/v1/debug/skills/worker?email=worker@example.com
// Get detailed worker info with skills for debugging
router.get('/worker', skillDebugController.getWorkerSkillsDebug);

// POST /api/v1/debug/skills/add
// Add skills to a worker
// Body: { email: "worker@example.com", skillIds: ["skill-id-1", "skill-id-2"] }
router.post('/add', skillDebugController.addSkillsToWorker);

// DELETE /api/v1/debug/skills/remove
// Remove skills from a worker
// Body: { email: "worker@example.com", skillIds: ["skill-id-1", "skill-id-2"] }
router.post('/remove', skillDebugController.removeSkillsFromWorker);

export default router;
