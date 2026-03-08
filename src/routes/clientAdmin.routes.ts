import { Router } from 'express';
import { ClientController } from '../controllers/client.controller';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const clientController = new ClientController();

// All routes require agency staff authentication
router.use(authenticate);

const authorizeAdmin = authorize('ADMIN');
const authorizeOps = authorize('ADMIN', 'OPS_MANAGER', 'SHIFT_COORDINATOR');

// ============================================================
// CLIENT MANAGEMENT (Agency Dashboard)
// ============================================================

// Client stats and list
router.get('/stats', asyncHandler(clientController.getClientStats));
router.get('/list', asyncHandler(clientController.getClientList));

// CRUD operations
router.post('/', authorizeOps, asyncHandler(clientController.createClient));
router.get('/:clientId/details', asyncHandler(clientController.getClientDetails));
router.put('/:clientId', authorizeOps, asyncHandler(clientController.updateClient));
router.post('/:clientId/invoices/generate', authorizeOps, asyncHandler(clientController.generateClientInvoice));
router.get('/invoices/:invoiceId', asyncHandler(clientController.getAgencyInvoiceDetails));
router.get('/invoices/:invoiceId/pdf', asyncHandler(clientController.downloadInvoicePDF));

// ============================================================
// STAFF-CLIENT COMPANY ASSIGNMENT
// ============================================================

// Get my assigned clients (for logged-in staff)
router.get('/my-clients', asyncHandler(clientController.getMyClients));

// Get client companies assigned to a staff member
router.get('/staff/:staffId/clients', authorizeOps, asyncHandler(clientController.getStaffClients));

// Assign staff to client companies (ADMIN only)
router.post('/staff/:staffId/assign', authorizeAdmin, asyncHandler(clientController.assignStaffToClients));

// Unassign staff from client companies (ADMIN only)
router.post('/staff/:staffId/unassign', authorizeAdmin, asyncHandler(clientController.unassignStaffFromClients));

// Get staff assigned to a client company
router.get('/:clientCompanyId/staff', authorizeOps, asyncHandler(clientController.getClientStaff));

// Get workers under a client company
router.get('/:clientCompanyId/workers', asyncHandler(clientController.getClientWorkers));

export default router;
