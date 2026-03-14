import { Router } from 'express';
import authRoutes from './auth.routes';
import organizationRoutes from './organization.routes';
import userRoutes from './user.routes';
import workerRoutes from './worker.routes';
import shiftRoutes from './shift.routes';
import skillRoutes from './skill.routes';
import locationRoutes from './location.routes';
import onboardingRoutes from './onboarding.routes';
import clientRoutes from './client.routes';
import clientRegistrationRoutes from './clientRegistration.routes';
import dashboardRoutes from './dashboard.routes';
import chatRoutes from './chat.routes';
import attendanceRoutes from './attendance.routes';
import payslipRoutes from './payslip.routes';
import holidayRoutes from './holiday.routes';
import notificationRoutes from './notification.routes';
import reportRoutes from './report.routes';
import subscriptionRoutes from './subscription.routes';
import hrRoutes from './hr.routes';
import clientAdminRoutes from './clientAdmin.routes';
import workerMembershipRoutes from './workerMembership.routes';
import complianceRoutes from './compliance.routes';
import bankAccountRoutes from './bankAccount.routes';
import nearbyAgencyRoutes from './nearbyAgency.routes';
import inviteRequestRoutes from './inviteRequest.routes';
import filesRoutes from './files.routes';
import { matchingRouter } from '../services/matching';
import { noShowPredictionRouter } from '../services/noShowPrediction';
import { nearbyWorkerRankingRouter } from '../services/nearbyWorkerRanking';

const router = Router();

// Public routes
router.use('/auth', authRoutes);
router.use('/agencies', nearbyAgencyRoutes); // Public: nearby agencies for workers without invite code
router.use('/agencies', inviteRequestRoutes); // Public POST + Protected GET/PATCH for invite requests
router.use('/client-registration', clientRegistrationRoutes); // Client company self-registration
router.use('/files', filesRoutes); // File proxy for private Supabase bucket

// Protected routes (Agency/Admin)
router.use('/dashboard', dashboardRoutes);
router.use('/organizations', organizationRoutes);
router.use('/users', userRoutes);
router.use('/workers', workerRoutes);
router.use('/shifts', shiftRoutes);
router.use('/skills', skillRoutes);
router.use('/locations', locationRoutes);
router.use('/onboarding', onboardingRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/payslips', payslipRoutes);
router.use('/holidays', holidayRoutes);

// Client Portal routes (separate auth)
router.use('/client', clientRoutes);

// Chat routes (HR <-> Worker communication)
router.use('/chat', chatRoutes);

// Notification routes
router.use('/notifications', notificationRoutes);

// Reporting routes
router.use('/reports', reportRoutes);

// Subscription & Billing routes
router.use('/subscriptions', subscriptionRoutes);

// HR Management routes
router.use('/hr', hrRoutes);

// Compliance routes (RTW verification)
router.use('/compliance', complianceRoutes);

// Client Admin routes (agency staff managing client assignments)
router.use('/clients', clientAdminRoutes);

// Worker multi-agency membership routes
router.use('/worker', workerMembershipRoutes);

// Bank account & payment sheet routes
router.use('/bank-account', bankAccountRoutes);

// Smart Matching routes
router.use('/matching', matchingRouter);

// No-Show Prediction routes
router.use('/no-show', noShowPredictionRouter);

// Nearby Worker Ranking routes
router.use('/nearby', nearbyWorkerRankingRouter);

export default router;
