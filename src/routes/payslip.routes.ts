import { Router } from 'express';
import { PayslipController } from '../controllers/payslip.controller';
import { authenticate, authorizeOps, authorizeAdmin } from '../middleware/auth';

const router = Router();
const controller = new PayslipController();

router.use(authenticate);

// Worker view
router.get('/list', controller.getPayslipList);
router.get('/my-payslip', controller.getMyPayslip);

// Manager/Ops views
router.get('/team-summary', authorizeOps, controller.getTeamPayslipSummary);
router.get('/worker/:workerId', authorizeOps, controller.getWorkerPayslip);

// Payslip management - accessible to all authenticated staff
router.post('/generate', controller.generatePayslips);
router.get('/admin/list', controller.getAdminPayslipList);
router.post('/bulk-approve', controller.bulkApprovePayslips);

// Payslip detail and actions (must be after static routes)
router.get('/:payslipId', controller.getPayslipDetail);
router.post('/:payslipId/approve', controller.approvePayslip);
router.post('/:payslipId/mark-paid', controller.markPaid);

// Admin settings
router.put('/settings', authorizeAdmin, controller.updatePayPeriodSetting);

export default router;
