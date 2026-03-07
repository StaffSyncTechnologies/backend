import { Router } from 'express';
import { SkillController } from '../controllers/skill.controller';
import { authenticate, authorizeAdmin } from '../middleware/auth';

const router = Router();
const controller = new SkillController();

// Public route - list all skills (for worker onboarding)
router.get('/', controller.list);
router.get('/categories', controller.getCategories);
router.get('/category/:category', controller.getByCategory);

// Admin routes
router.use(authenticate);
router.post('/', authorizeAdmin, controller.create);
router.put('/:skillId', authorizeAdmin, controller.update);
router.delete('/:skillId', authorizeAdmin, controller.delete);

export default router;
