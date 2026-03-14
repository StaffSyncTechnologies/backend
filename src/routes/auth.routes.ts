import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { OnboardingController } from '../controllers/onboarding.controller';
import { authenticate, authorizeAdmin, authorizeOps } from '../middleware/auth';
import { uploadCertification, uploadProfilePic } from '../middleware/upload';

const router = Router();
const authController = new AuthController();
const onboardingController = new OnboardingController();

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/send-otp', authController.sendOtp);
router.post('/verify-otp', authController.verifyOtp);

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
router.post('/worker/login', authController.workerLogin);
router.post('/worker/password-login', authController.workerPasswordLogin);
router.post('/worker/verify-otp', authController.workerVerifyOtp);
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
