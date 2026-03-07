import { Router } from 'express';
import { BankAccountController } from '../controllers/bankAccount.controller';
import { authenticate, authorizeOps } from '../middleware/auth';

const router = Router();
const controller = new BankAccountController();

router.use(authenticate);

// Worker self-service
router.get('/me', controller.getMyBankAccount);
router.post('/me', controller.saveMyBankAccount);

// Admin/Ops - list all workers with bank account status
router.get('/list', authorizeOps, controller.listAllBankAccounts);

// Admin/Ops - view & manage worker bank accounts
router.get('/worker/:workerId', authorizeOps, controller.getWorkerBankAccount);
router.put('/worker/:workerId', authorizeOps, controller.updateWorkerBankAccount);
router.post('/worker/:workerId/verify', authorizeOps, controller.verifyBankAccount);

// Payment sheet generation (admin/ops)
router.get('/payment-sheet', authorizeOps, controller.generatePaymentSheet);
router.get('/payment-sheet/summary', authorizeOps, controller.getPaymentSheetSummary);

export default router;
