import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { OnboardingController } from '../controllers/onboarding.controller';
import { AccountDeletionController } from '../controllers/accountDeletion.controller';
import { authenticate, authorizeAdmin, authorizeOps } from '../middleware/auth';
import { uploadCertification, uploadProfilePic } from '../middleware/upload';
import { authLimiter, strictLimiter } from '../middleware/rateLimiter';

const router = Router();
const authController = new AuthController();
const onboardingController = new OnboardingController();

// Public routes (rate limited)
router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/forgot-password', strictLimiter, authController.forgotPassword);
router.post('/reset-password', strictLimiter, authController.resetPassword);
router.post('/send-otp', authLimiter, authController.sendOtp);
router.post('/verify-otp', authLimiter, authController.verifyOtp);

// Account deletion request (public)
router.post('/request-account-deletion', AccountDeletionController.requestAccountDeletion);

// Data deletion request (public)
router.post('/request-data-deletion', AccountDeletionController.requestDataDeletion);

// Staff auth (dashboard users - non-workers)
router.post('/staff/login', authController.staffLogin);
router.get('/staff-invite/:token', authController.validateStaffInvite);
router.post('/staff-invite/:token/accept', authController.acceptStaffInvite);
router.post('/staff/invite', authenticate, authorizeAdmin, onboardingController.inviteTeam);
router.post('/staff/:userId/resend-invite', authenticate, authorizeAdmin, authController.resendStaffInvite);

// Invite code flow (team members joining via code)
router.post('/validate-invite', authController.validateInviteCode);
router.post('/accept-invite', authController.acceptInviteCode);

// Worker passwordless auth (mobile app)
router.post('/worker/validate-invite', authController.validateWorkerInvite);
router.post('/worker/register', authController.workerRegister);
router.post('/worker/login', authLimiter, authController.workerLogin);
router.post('/worker/password-login', authLimiter, authController.workerPasswordLogin);
router.post('/worker/verify-otp', authLimiter, authController.workerVerifyOtp);
router.post('/worker/invite', authenticate, authorizeOps, onboardingController.inviteWorker);

// Worker profile save (onboarding Step 1)
router.post('/worker/save-profile', authController.workerSaveProfile);

// Worker skills save (onboarding Step 2)
router.post('/worker/save-skills', authController.workerSaveSkills);

// Worker document upload (registration Step 3)
router.post('/worker/documents', uploadCertification, authController.workerUploadDocument);
router.get('/worker/documents', authController.workerGetDocuments);
router.delete('/worker/documents/:documentId', authController.workerDeleteDocument);

// Worker profile picture upload
router.post('/worker/profile-pic', uploadProfilePic, authController.workerUploadProfilePic);

// Worker RTW verification (Step 4 of 4)
router.post('/worker/verify-rtw', authController.workerVerifyRTW);

// Complete onboarding (Final)
router.post('/worker/complete-onboarding', authController.workerCompleteOnboarding);

// Protected routes
router.get('/me', authenticate, authController.getMe);
router.put('/me', authenticate, authController.updateMe);
router.post('/change-password', authenticate, authController.changePassword);
router.post('/logout', authenticate, authController.logout);
router.delete('/account', authenticate, authController.deleteAccount);

export default router;
