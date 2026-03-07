import { Router } from 'express';
import { WorkerMembershipController } from '../controllers/workerMembership.controller';
import { authenticate, authorizeOps } from '../middleware/auth';

const router = Router();
const controller = new WorkerMembershipController();

router.use(authenticate);

// Worker endpoints
router.get('/memberships', controller.getMyMemberships);
router.get('/memberships/pending', controller.getPendingInvitations);
router.post('/memberships/switch', controller.switchOrganization);
router.post('/memberships/:membershipId/accept', controller.acceptMembership);
router.post('/memberships/:membershipId/decline', controller.declineMembership);

// Admin/Ops endpoints (invite workers, remove memberships)
router.post('/memberships/invite', authorizeOps, controller.inviteWorkerByEmail);
router.delete('/memberships/:membershipId', authorizeOps, controller.removeMembership);

// Per-organization skills
router.get('/memberships/:organizationId/skills', controller.getOrgSkills);
router.post('/memberships/:organizationId/skills', controller.addOrgSkill);
router.delete('/memberships/:organizationId/skills/:skillId', controller.removeOrgSkill);
router.post('/memberships/copy-skills', controller.copySkillsToOrg);

// Per-organization RTW
router.get('/memberships/:organizationId/rtw', controller.getOrgRTW);
router.put('/memberships/:organizationId/rtw', controller.updateOrgRTW);

export default router;
