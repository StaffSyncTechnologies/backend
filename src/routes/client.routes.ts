import { Router } from 'express';
import { ClientController } from '../controllers/client.controller';
import { authenticateClient, authorizeClientAdmin } from '../middleware/clientAuth';

const router = Router();
const controller = new ClientController();

// Client authentication (separate from agency auth)
router.post('/auth/login', controller.login);
router.post('/auth/forgot-password', controller.forgotPassword);

// All routes below require client authentication
router.use(authenticateClient);

// Dashboard
router.get('/dashboard', controller.getDashboard);

// Workers
router.get('/workers', controller.getAssignedWorkers);
router.get('/workers/:workerId', controller.getWorkerProfile);
router.post('/workers/:workerId/rate', controller.rateWorker);
router.post('/workers/:workerId/block', authorizeClientAdmin, controller.blockWorker);

// Shifts / Bookings
router.get('/shifts', controller.getShifts);
router.get('/shifts/:shiftId', controller.getShiftDetails);
router.post('/shifts/request', authorizeClientAdmin, controller.requestWorkers);
router.put('/shifts/:shiftId/cancel', authorizeClientAdmin, controller.cancelShiftRequest);

// Timesheets
router.get('/timesheets', controller.getTimesheets);
router.get('/timesheets/weekly', controller.getWeeklyTimesheetSummary);
router.get('/timesheets/weekly/details', controller.getWeeklyTimesheetDetails);
router.get('/timesheets/:timesheetId', controller.getTimesheetDetails);
router.post('/timesheets/:timesheetId/approve', authorizeClientAdmin, controller.approveTimesheet);
router.post('/timesheets/:timesheetId/dispute', authorizeClientAdmin, controller.disputeTimesheet);

// Invoices
router.get('/invoices', controller.getInvoices);
router.post('/invoices/generate', authorizeClientAdmin, controller.generateWeeklyInvoice);
router.get('/invoices/:invoiceId', controller.getInvoiceDetails);
router.get('/invoices/:invoiceId/download', controller.downloadInvoice);

// Reports
router.get('/reports/hours', controller.getHoursReport);
router.get('/reports/spend', controller.getSpendReport);

// Settings
router.get('/settings', controller.getSettings);
router.put('/settings', authorizeClientAdmin, controller.updateSettings);

// Users (client company users)
router.get('/users', authorizeClientAdmin, controller.getUsers);
router.post('/users', authorizeClientAdmin, controller.createUser);
router.put('/users/:userId', authorizeClientAdmin, controller.updateUser);
router.delete('/users/:userId', authorizeClientAdmin, controller.deleteUser);

export default router;
