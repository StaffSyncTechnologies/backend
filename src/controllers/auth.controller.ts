import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';
import { StorageService } from '../services/storage';
import { rtwService } from '../services/rtw';
import {
  RegisterRequest,
  LoginRequest,
  ChangePasswordRequest,
  UpdateMeRequest,
  SendOtpRequest,
  VerifyOtpRequest,
  WorkerRegisterRequest,
  WorkerLoginRequest,
  WorkerVerifyOtpRequest,
  AuthResponse,
  GetMeResponse,
  UpdateMeResponse,
} from '../types/dto/auth.dto';
import crypto from 'crypto';
import { EmailService } from '../services/notifications/email.service';
import { NotificationService } from '../services/notifications';
import { SubscriptionNotificationService } from '../services/notifications/subscription.notification';

const registerSchema: z.ZodType<RegisterRequest> = z.object({
  // Organization fields
  organizationName: z.string().min(2).max(255),
  organizationEmail: z.string().email().optional(),
  tradingName: z.string().max(255).optional(),
  companyNumber: z.string().max(50).optional(),
  industry: z.string().max(100).optional(),
  numberOfWorkers: z.string().max(20).optional(),
  location: z.string().max(500).optional(),
  website: z.string().max(500).optional(),
  deploymentMode: z.enum(['AGENCY', 'DIRECT_COMPANY']),
  // Admin user fields
  fullName: z.string().min(2).max(255),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
  jobTitle: z.string().max(100).optional(),
});

const loginSchema: z.ZodType<LoginRequest> = z.object({
  email: z.string().email(),
  password: z.string(),
});
const sendOtpSchema: z.ZodType<SendOtpRequest> = z.object({
  email: z.string().email(),
});
const verifyOtpSchema: z.ZodType<VerifyOtpRequest> = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

const workerRegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  inviteCode: z.string().min(1),
  fullName: z.string().min(2).max(255).optional(),
  phone: z.string().optional(),
});

const workerLoginSchema: z.ZodType<WorkerLoginRequest> = z.object({
  email: z.string().email(),
});

const workerPasswordLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const workerVerifyOtpSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  pushToken: z.string().optional(),
  platform: z.enum(['ios', 'android', 'expo']).optional().default('expo'),
  deviceId: z.string().optional(),
});

export class AuthController {
  register = async (req: Request, res: Response) => {
    const data = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findFirst({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const verificationCode = EmailService.generateVerificationCode();
    const expiresAt = new Date(Date.now() + config.emailVerification.expiresInMinutes * 60 * 1000);

    // Delete any existing pending registration for this email
    await prisma.pendingRegistration.deleteMany({
      where: { email: data.email },
    });

    // Create pending registration with OTP
    await prisma.pendingRegistration.create({
      data: {
        email: data.email,
        fullName: data.fullName,
        phone: data.phone,
        jobTitle: data.jobTitle,
        passwordHash,
        organizationName: data.organizationName,
        organizationEmail: data.organizationEmail,
        tradingName: data.tradingName,
        companyNumber: data.companyNumber,
        industry: data.industry,
        numberOfWorkers: data.numberOfWorkers,
        location: data.location,
        website: data.website,
        deploymentMode: data.deploymentMode,
        verificationCode,
        expiresAt,
      },
    });

    // Send verification email
    await EmailService.sendVerificationCode(data.email, verificationCode, data.fullName);

    ApiResponse.created(res, 'Verification code sent to your email.', {
      email: data.email,
      requiresVerification: true,
    });
  };

  login = async (req: Request, res: Response) => {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findFirst({
      where: { email: data.email },
      include: { organization: true },
    });

    if (!user || !user.passwordHash) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    const isValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValid) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    if (user.status !== 'ACTIVE') {
      throw new AppError('Account suspended', 403, 'ACCOUNT_SUSPENDED');
    }

    if (!user.emailVerified) {
      throw new AppError('Please verify your email before logging in', 403, 'EMAIL_NOT_VERIFIED');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const token = jwt.sign(
      { userId: user.id, organizationId: user.organizationId },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn } as SignOptions
    );

    const response: AuthResponse = {
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
      organization: {
        id: user.organization.id,
        name: user.organization.name,
        deploymentMode: user.organization.deploymentMode,
      },
    };

    ApiResponse.ok(res, 'Login successful', response);
  };

  getMe = async (req: AuthRequest, res: Response) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        organization: true,
        workerProfile: req.user!.role === 'WORKER',
      },
    });

    if (!user) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    const response: GetMeResponse = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      phone: user.phone,
      organization: {
        id: user.organization.id,
        name: user.organization.name,
        deploymentMode: user.organization.deploymentMode,
        logoUrl: user.organization.logoUrl,
        primaryColor: user.organization.primaryColor,
      },
      ...(user.workerProfile && { workerProfile: user.workerProfile }),
    };

    ApiResponse.ok(res, 'User retrieved', response);
  };

  updateMe = async (req: AuthRequest, res: Response) => {
    const { fullName, phone, address, postcode, dateOfBirth } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { fullName, phone },
      include: { workerProfile: req.user!.role === 'WORKER' },
    });

    // Update worker profile fields if provided
    if (req.user!.role === 'WORKER' && (address || postcode || dateOfBirth)) {
      await prisma.workerProfile.upsert({
        where: { userId: req.user!.id },
        update: {
          ...(address && { address }),
          ...(postcode && { postcode }),
          ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
        },
        create: {
          userId: req.user!.id,
          address: address || '',
          postcode: postcode || '',
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : new Date(),
        },
      });
    }

    // Re-fetch with profile
    const updated = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { workerProfile: req.user!.role === 'WORKER', organization: true },
    });

    ApiResponse.ok(res, 'Profile updated', {
      id: updated!.id,
      email: updated!.email,
      fullName: updated!.fullName,
      phone: updated!.phone,
      workerProfile: updated!.workerProfile,
    });
  };

  changePassword = async (req: AuthRequest, res: Response) => {
    const { currentPassword, newPassword } = req.body as ChangePasswordRequest;

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });

    if (!user || !user.passwordHash) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new AppError('Current password is incorrect', 400, 'INVALID_PASSWORD');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    ApiResponse.ok(res, 'Password changed successfully');
  };

  forgotPassword = async (req: Request, res: Response) => {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);

    // Always return the same response to prevent email enumeration
    const successMessage = 'If an account with that email exists, a password reset link has been sent';

    const user = await prisma.user.findFirst({
      where: { email },
    });

    if (!user) {
      ApiResponse.ok(res, successMessage);
      return;
    }

    // Generate a secure reset token and hash it for storage
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: hashedToken,
        resetTokenExpiresAt: expiresAt,
      },
    });

    // Send the unhashed token via email so the user can present it back
    try {
      await EmailService.sendPasswordReset(user.email, rawToken, user.fullName);
    } catch (err) {
      console.error('Failed to send password reset email:', err);
    }

    ApiResponse.ok(res, successMessage);
  };

  resetPassword = async (req: Request, res: Response) => {
    const { token, newPassword } = z.object({
      token: z.string().min(1),
      newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    }).parse(req.body);

    // Hash the incoming token to compare against stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await prisma.user.findFirst({
      where: {
        resetToken: hashedToken,
        resetTokenExpiresAt: { gt: new Date() },
      },
    });

    if (!user) {
      throw new AppError('Invalid or expired reset token', 400, 'INVALID_RESET_TOKEN');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiresAt: null,
      },
    });

    ApiResponse.ok(res, 'Password reset successfully');
  };

  sendOtp = async (req: Request, res: Response) => {
    const { email } = sendOtpSchema.parse(req.body);

    const pending = await prisma.pendingRegistration.findUnique({
      where: { email },
    });

    if (!pending) {
      // Don't reveal if email exists
      ApiResponse.ok(res, 'If a pending registration exists, a verification code has been sent');
      return;
    }

    const verificationCode = EmailService.generateVerificationCode();
    const expiresAt = new Date(Date.now() + config.emailVerification.expiresInMinutes * 60 * 1000);

    await prisma.pendingRegistration.update({
      where: { email },
      data: { verificationCode, expiresAt },
    });

    await EmailService.sendVerificationCode(email, verificationCode, pending.fullName);

    ApiResponse.ok(res, 'Verification code sent successfully');
  };

  verifyOtp = async (req: Request, res: Response) => {
    const data = verifyOtpSchema.parse(req.body);

    const pending = await prisma.pendingRegistration.findUnique({
      where: { email: data.email },
    });

    if (!pending) {
      throw new AppError('No pending registration found', 404, 'NOT_FOUND');
    }

    if (pending.verificationCode !== data.code) {
      throw new AppError('Invalid verification code', 400, 'INVALID_CODE');
    }

    if (pending.expiresAt < new Date()) {
      throw new AppError('Verification code expired', 400, 'CODE_EXPIRED');
    }

    // Free trial: 180 days
    const FREE_TRIAL_DAYS = 180;
    const trialStart = new Date();
    const trialEnd = new Date(trialStart.getTime() + FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000);

    // Create user, organization, and subscription in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: pending.organizationName,
          deploymentMode: pending.deploymentMode,
          email: pending.organizationEmail,
          tradingName: pending.tradingName,
          registrationNumber: pending.companyNumber,
          industry: pending.industry,
          numberOfWorkers: pending.numberOfWorkers,
          address: pending.location,
          website: pending.website,
          onboardingComplete: false,
          trialEndsAt: trialEnd,
        },
      });

      const user = await tx.user.create({
        data: {
          organizationId: organization.id,
          role: 'ADMIN',
          fullName: pending.fullName,
          email: pending.email,
          phone: pending.phone,
          passwordHash: pending.passwordHash,
          emailVerified: true,
        },
      });

      // Initialize free trial subscription
      await tx.subscription.create({
        data: {
          organizationId: organization.id,
          planTier: 'FREE',
          status: 'TRIALING',
          workerLimit: -1, // Unlimited during trial
          clientLimit: -1,
          trialStart,
          trialEnd,
          currentPeriodStart: trialStart,
          currentPeriodEnd: trialEnd,
        },
      });

      // Delete pending registration
      await tx.pendingRegistration.delete({
        where: { id: pending.id },
      });

      return { organization, user, trialEnd };
    });

    // Send trial started notification (async, don't block response)
    SubscriptionNotificationService.notifyTrialStarted(
      result.organization.id,
      result.trialEnd
    ).catch(err => console.error('Failed to send trial started notification:', err));

    const token = jwt.sign(
      { userId: result.user.id, organizationId: result.organization.id },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn } as SignOptions
    );

    const response: AuthResponse = {
      token,
      user: {
        id: result.user.id,
        email: result.user.email,
        fullName: result.user.fullName,
        role: result.user.role,
      },
      organization: {
        id: result.organization.id,
        name: result.organization.name,
        deploymentMode: result.organization.deploymentMode,
      },
    };

    ApiResponse.ok(res, 'Email verified successfully', response);
  };

  logout = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (token) {
      // Decode token to get expiration
      const decoded = jwt.decode(token) as { exp?: number };
      const expiresAt = decoded?.exp 
        ? new Date(decoded.exp * 1000) 
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default 7 days

      // Blacklist the token
      await prisma.tokenBlacklist.create({
        data: {
          token,
          userId,
          expiresAt,
        },
      });

      // Deactivate all device tokens for this user
      await prisma.deviceToken.updateMany({
        where: { userId },
        data: { isActive: false },
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'LOGOUT',
          ipAddress: req.ip || req.socket.remoteAddress,
          userAgent: req.headers['user-agent']?.substring(0, 500),
        },
      });
    }

    ApiResponse.ok(res, 'Logged out successfully');
  };

  // ============================================================
  // STAFF AUTH (Dashboard Users - OPS_MANAGER, SHIFT_COORDINATOR, COMPLIANCE_OFFICER)
  // ============================================================

  /**
   * Staff Login - For dashboard users (non-workers)
   * Returns additional data like permissions and dashboard config
   */
  staffLogin = async (req: Request, res: Response) => {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findFirst({
      where: { email: data.email },
      include: { organization: true },
    });

    if (!user || !user.passwordHash) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    // Ensure this is a staff user, not a worker
    if (user.role === 'WORKER') {
      throw new AppError('Please use the mobile app to login', 400, 'USE_MOBILE_APP');
    }

    const isValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValid) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    if (user.status !== 'ACTIVE') {
      throw new AppError('Account suspended', 403, 'ACCOUNT_SUSPENDED');
    }

    if (!user.emailVerified) {
      throw new AppError('Please verify your email before logging in', 403, 'EMAIL_NOT_VERIFIED');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const token = jwt.sign(
      { userId: user.id, organizationId: user.organizationId, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn } as SignOptions
    );

    // Role-based permissions
    const permissionsByRole: Record<string, string[]> = {
      ADMIN: ['manage_team', 'manage_workers', 'manage_shifts', 'manage_clients', 'view_reports', 'manage_billing', 'approve_timesheets', 'verify_rtw', 'verify_documents'],
      OPS_MANAGER: ['manage_workers', 'manage_shifts', 'approve_timesheets', 'view_reports', 'verify_rtw'],
      SHIFT_COORDINATOR: ['manage_shifts', 'assign_workers', 'broadcast_shifts'],
      COMPLIANCE_OFFICER: ['verify_rtw', 'verify_documents', 'view_compliance_reports'],
    };

    // Dashboard route by role
    const dashboardRoutes: Record<string, string> = {
      ADMIN: '/admin/dashboard',
      OPS_MANAGER: '/ops/dashboard',
      SHIFT_COORDINATOR: '/shifts/dashboard',
      COMPLIANCE_OFFICER: '/compliance/dashboard',
    };

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          phone: user.phone,
          role: user.role,
          lastLoginAt: user.lastLoginAt,
        },
        organization: {
          id: user.organization.id,
          name: user.organization.name,
          deploymentMode: user.organization.deploymentMode,
          logoUrl: user.organization.logoUrl,
          primaryColor: user.organization.primaryColor,
          secondaryColor: user.organization.secondaryColor,
          onboardingComplete: user.organization.onboardingComplete,
        },
        permissions: permissionsByRole[user.role] || [],
        dashboardRoute: dashboardRoutes[user.role] || '/dashboard',
        features: {
          canManageTeam: user.role === 'ADMIN',
          canManageWorkers: ['ADMIN', 'OPS_MANAGER'].includes(user.role),
          canManageShifts: ['ADMIN', 'OPS_MANAGER', 'SHIFT_COORDINATOR'].includes(user.role),
          canApproveTimesheets: ['ADMIN', 'OPS_MANAGER'].includes(user.role),
          canVerifyCompliance: ['ADMIN', 'OPS_MANAGER', 'COMPLIANCE_OFFICER'].includes(user.role),
          canAccessBilling: user.role === 'ADMIN',
          canViewReports: ['ADMIN', 'OPS_MANAGER', 'COMPLIANCE_OFFICER'].includes(user.role),
        },
      },
    });
  };

  /**
   * Validate staff invite token - returns user info if valid
   */
  validateStaffInvite = async (req: Request, res: Response) => {
    const { token } = req.params;

    const user = await prisma.user.findFirst({
      where: {
        inviteToken: token,
        inviteExpiresAt: { gt: new Date() },
        passwordHash: '',
      },
      include: {
        organization: {
          select: { id: true, name: true, logoUrl: true },
        },
      },
    });

    if (!user) {
      throw new AppError('Invalid or expired invite link', 400, 'INVALID_INVITE');
    }

    ApiResponse.ok(res, 'Invite valid', {
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      organization: (user as any).organization,
    });
  };

  /**
   * Accept staff invite - set password, update profile details, and activate account
   */
  acceptStaffInvite = async (req: Request, res: Response) => {
    const { token } = req.params;
    const data = z.object({
      password: z.string().min(8, 'Password must be at least 8 characters'),
      fullName: z.string().min(2, 'Full name must be at least 2 characters').max(255).optional(),
      phone: z.string().max(50).optional(),
      niNumber: z.string().max(9).optional(),
    }).parse(req.body);

    const user = await prisma.user.findFirst({
      where: {
        inviteToken: token,
        inviteExpiresAt: { gt: new Date() },
        passwordHash: '',
      },
      include: { organization: true },
    });

    if (!user) {
      throw new AppError('Invalid or expired invite link', 400, 'INVALID_INVITE');
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    // Generate unique team number (format: TM-YYYYMMDD-XXXX)
    const teamNumber = await this.generateTeamNumber(user.organizationId);

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        emailVerified: true,
        inviteToken: null,
        inviteExpiresAt: null,
        teamNumber,
        ...(data.fullName && { fullName: data.fullName }),
        ...(data.phone && { phone: data.phone }),
        ...(data.niNumber && { niNumber: data.niNumber }),
      },
      include: { organization: true },
    });

    // Generate JWT for immediate login
    const jwtToken = jwt.sign(
      { userId: updatedUser.id, organizationId: updatedUser.organizationId, role: updatedUser.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn } as SignOptions
    );

    // Role-based permissions
    const permissionsByRole: Record<string, string[]> = {
      ADMIN: ['manage_team', 'manage_workers', 'manage_shifts', 'manage_clients', 'view_reports', 'manage_billing', 'approve_timesheets', 'verify_rtw', 'verify_documents'],
      OPS_MANAGER: ['manage_workers', 'manage_shifts', 'approve_timesheets', 'view_reports', 'verify_rtw'],
      SHIFT_COORDINATOR: ['manage_shifts', 'assign_workers', 'broadcast_shifts'],
      COMPLIANCE_OFFICER: ['verify_rtw', 'verify_documents', 'view_compliance_reports'],
    };

    const dashboardRoutes: Record<string, string> = {
      ADMIN: '/admin/dashboard',
      OPS_MANAGER: '/ops/dashboard',
      SHIFT_COORDINATOR: '/shifts/dashboard',
      COMPLIANCE_OFFICER: '/compliance/dashboard',
    };

    res.json({
      success: true,
      message: 'Account activated successfully',
      data: {
        token: jwtToken,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          fullName: updatedUser.fullName,
          phone: updatedUser.phone,
          role: updatedUser.role,
          teamNumber: updatedUser.teamNumber,
        },
        organization: {
          id: updatedUser.organization.id,
          name: updatedUser.organization.name,
          deploymentMode: updatedUser.organization.deploymentMode,
          logoUrl: updatedUser.organization.logoUrl,
        },
        permissions: permissionsByRole[updatedUser.role] || [],
        dashboardRoute: dashboardRoutes[updatedUser.role] || '/dashboard',
      },
    });
  };

  /**
   * Resend staff invite email
   */
  resendStaffInvite = async (req: AuthRequest, res: Response) => {
    const { userId } = req.params;

    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        organizationId: req.user!.organizationId,
        passwordHash: '',
        role: { not: 'WORKER' },
      },
    });

    if (!user) {
      throw new AppError('User not found or already activated', 404, 'NOT_FOUND');
    }

    // Generate new invite token
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { inviteToken, inviteExpiresAt },
    });

    const organization = await prisma.organization.findUnique({
      where: { id: req.user!.organizationId },
      select: { name: true },
    });

    const { EmailService } = await import('../services/notifications/email.service');
    await EmailService.sendStaffInvite(
      user.email,
      inviteToken,
      user.fullName,
      organization?.name || 'Your Organization',
      user.role
    );

    ApiResponse.ok(res, 'Invite email resent successfully');
  };

  /**
   * Validate invite code (for team members) - returns organization info if valid
   */
  validateInviteCode = async (req: Request, res: Response) => {
    const { inviteCode } = z.object({
      inviteCode: z.string().min(1),
    }).parse(req.body);

    // Hash the invite code to look it up
    const codeHash = crypto.createHash('sha256').update(inviteCode).digest('hex');

    // Find valid invite code for STAFF type
    const invite = await prisma.inviteCode.findFirst({
      where: {
        OR: [
          { code: inviteCode },
          { codeHash },
        ],
        type: 'STAFF',
        status: 'ACTIVE',
        AND: [
          {
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } },
            ],
          },
        ],
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            primaryColor: true,
          },
        },
      },
    });

    if (!invite) {
      throw new AppError('Invalid or expired invite code', 400, 'INVALID_INVITE_CODE');
    }

    ApiResponse.ok(res, 'Invite code valid', {
      valid: true,
      agency: {
        id: invite.organization.id,
        name: invite.organization.name,
        logo: invite.organization.logoUrl,
        primaryColor: invite.organization.primaryColor,
      },
    });
  };

  /**
   * Accept invite code and create team member account
   */
  acceptInviteCode = async (req: Request, res: Response) => {
    const data = z.object({
      inviteCode: z.string().min(1),
      fullName: z.string().min(2).max(255),
      email: z.string().email(),
      password: z.string().min(8),
      phone: z.string().optional(),
      jobTitle: z.string().optional(),
      address: z.string().optional(),
      postcode: z.string().optional(),
    }).parse(req.body);

    // Hash the invite code to look it up
    const codeHash = crypto.createHash('sha256').update(data.inviteCode).digest('hex');

    // Find valid invite code
    const invite = await prisma.inviteCode.findFirst({
      where: {
        OR: [
          { code: data.inviteCode },
          { codeHash },
        ],
        type: 'STAFF',
        status: 'ACTIVE',
        AND: [
          {
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } },
            ],
          },
        ],
      },
      include: { organization: true },
    });

    if (!invite) {
      throw new AppError('Invalid or expired invite code', 400, 'INVALID_INVITE_CODE');
    }

    // Check if email already exists in this organization
    const existingUser = await prisma.user.findFirst({
      where: {
        email: data.email,
        organizationId: invite.organizationId,
      },
    });

    if (existingUser) {
      throw new AppError('Email already registered in this organization', 409, 'EMAIL_EXISTS');
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const teamNumber = await this.generateTeamNumber(invite.organizationId);

    // Create user
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          organizationId: invite.organizationId,
          role: 'SHIFT_COORDINATOR', // Default role for team invites
          fullName: data.fullName,
          email: data.email,
          passwordHash,
          phone: data.phone,
          teamNumber,
          emailVerified: true,
          status: 'ACTIVE',
        },
      });

      // Update invite code usage
      if (invite.usageType === 'SINGLE_USE') {
        await tx.inviteCode.update({
          where: { id: invite.id },
          data: {
            status: 'USED',
            usedBy: newUser.id,
            usedAt: new Date(),
          },
        });
      } else {
        await tx.inviteCode.update({
          where: { id: invite.id },
          data: { timesUsed: { increment: 1 } },
        });
      }

      return newUser;
    });

    ApiResponse.created(res, 'Account created successfully', {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    });
  };

  // ============================================================
  // WORKER PASSWORDLESS AUTH (Mobile App)
  // ============================================================

  /**
   * Validate worker invite code - returns organization info if valid
   */
  validateWorkerInvite = async (req: Request, res: Response) => {
    const { code } = z.object({
      code: z.string().min(1),
    }).parse(req.body);

    // Hash the invite code to look it up
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    // Find valid invite code for WORKER type
    const invite = await prisma.inviteCode.findFirst({
      where: {
        OR: [
          { code: code },
          { codeHash },
        ],
        type: 'WORKER',
        status: { in: ['ACTIVE', 'PENDING'] },
        AND: [
          {
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } },
            ],
          },
        ],
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            coverImageUrl: true,
            primaryColor: true,
            secondaryColor: true,
          },
        },
      },
    });

    if (!invite) {
      throw new AppError('Invalid or expired invite code', 400, 'INVALID_INVITE_CODE');
    }

    ApiResponse.ok(res, 'Invite code valid', {
      organizationId: invite.organization.id,
      organizationName: invite.organization.name,
      logoUrl: invite.organization.logoUrl,
      coverImageUrl: invite.organization.coverImageUrl,
      primaryColor: invite.organization.primaryColor,
      secondaryColor: invite.organization.secondaryColor,
    });
  };

  /**
   * Worker Registration - First time login with invite code
   * Creates account and sends OTP for verification
   */
  workerRegister = async (req: Request, res: Response) => {
    const data = workerRegisterSchema.parse(req.body);

    // Hash the invite code to look it up
    const codeHash = crypto.createHash('sha256').update(data.inviteCode).digest('hex');

    // Find valid invite code (accept ACTIVE or PENDING status)
    const invite = await prisma.inviteCode.findFirst({
      where: {
        OR: [
          { code: data.inviteCode },
          { codeHash },
        ],
        type: 'WORKER',
        status: { in: ['ACTIVE', 'PENDING'] },
        AND: [
          {
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } },
            ],
          },
        ],
      },
      include: { organization: true },
    });

    if (!invite) {
      throw new AppError('Invalid or expired invite code', 400, 'INVALID_INVITE_CODE');
    }

    // Check if worker already exists in this organization
    const existingUser = await prisma.user.findFirst({
      where: {
        email: data.email,
        organizationId: invite.organizationId,
      },
      include: { workerProfile: true },
    });

    if (existingUser) {
      const onboardingComplete = existingUser.workerProfile?.onboardingStatus === 'COMPLETE';

      if (onboardingComplete) {
        throw new AppError('Account already exists. Please use login instead.', 409, 'ACCOUNT_EXISTS');
      }

      // Onboarding incomplete — resend OTP so they can continue
      const verificationCode = EmailService.generateVerificationCode();
      const expiresAt = new Date(Date.now() + config.emailVerification.expiresInMinutes * 60 * 1000);

      await prisma.workerOtp.upsert({
        where: { email: data.email },
        update: { code: verificationCode, expiresAt },
        create: { email: data.email, code: verificationCode, expiresAt },
      });

      await EmailService.sendVerificationCode(data.email, verificationCode, existingUser.fullName || 'there');

      return ApiResponse.ok(res, 'Verification code sent to your email.', {
        email: data.email,
        requiresVerification: true,
      });
    }

    // Generate OTP
    const verificationCode = EmailService.generateVerificationCode();
    const expiresAt = new Date(Date.now() + config.emailVerification.expiresInMinutes * 60 * 1000);

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Create worker user
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          organizationId: invite.organizationId,
          role: 'WORKER',
          fullName: data.fullName || data.email.split('@')[0],
          email: data.email,
          phone: data.phone,
          passwordHash,
          emailVerified: false,
        },
      });

      // Create worker profile
      await tx.workerProfile.create({
        data: {
          userId: newUser.id,
          onboardingStatus: 'INCOMPLETE',
        },
      });

      // Create reliability score
      await tx.workerReliabilityScore.create({
        data: { workerId: newUser.id },
      });

      // Store OTP for verification
      await tx.workerOtp.upsert({
        where: { email: data.email },
        update: { code: verificationCode, expiresAt },
        create: { email: data.email, code: verificationCode, expiresAt },
      });

      // Mark invite as used (for single-use codes)
      if (invite.usageType === 'SINGLE_USE') {
        await tx.inviteCode.update({
          where: { id: invite.id },
          data: {
            status: 'USED',
            usedBy: newUser.id,
            usedAt: new Date(),
            timesUsed: { increment: 1 },
          },
        });
      } else {
        await tx.inviteCode.update({
          where: { id: invite.id },
          data: { timesUsed: { increment: 1 } },
        });
      }

      return newUser;
    });

    // Send OTP email
    await EmailService.sendVerificationCode(data.email, verificationCode, data.fullName || 'there');

    ApiResponse.created(res, 'Account created. Verification code sent to your email.', {
      email: data.email,
      requiresVerification: true,
    });
  };

  /**
   * Worker Login - Request OTP (passwordless)
   */
  workerLogin = async (req: Request, res: Response) => {
    const data = workerLoginSchema.parse(req.body);

    // Find worker by email
    const user = await prisma.user.findFirst({
      where: {
        email: data.email,
        role: 'WORKER',
      },
    });

    if (!user) {
      // Don't reveal if email exists
      ApiResponse.ok(res, 'If an account exists, a verification code has been sent');
      return;
    }

    // Generate OTP
    const verificationCode = EmailService.generateVerificationCode();
    const expiresAt = new Date(Date.now() + config.emailVerification.expiresInMinutes * 60 * 1000);

    // Store OTP
    await prisma.workerOtp.upsert({
      where: { email: data.email },
      update: { code: verificationCode, expiresAt },
      create: { email: data.email, code: verificationCode, expiresAt },
    });

    // Send OTP email
    await EmailService.sendVerificationCode(data.email, verificationCode, user.fullName);

    ApiResponse.ok(res, 'Verification code sent to your email', {
      email: data.email,
    });
  };

  /**
   * Worker Password Login - Email + Password based login
   */
  workerPasswordLogin = async (req: Request, res: Response) => {
    const data = workerPasswordLoginSchema.parse(req.body);

    const user = await prisma.user.findFirst({
      where: {
        email: data.email,
        role: 'WORKER',
      },
      include: { organization: true, workerProfile: true },
    });

    if (!user || !user.passwordHash) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const isValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValid) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    if (user.status !== 'ACTIVE') {
      throw new AppError('Account suspended. Please contact your agency.', 403, 'ACCOUNT_SUSPENDED');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const token = jwt.sign(
      { userId: user.id, organizationId: user.organizationId, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn } as SignOptions
    );

    const onboardingComplete = user.workerProfile?.onboardingStatus === 'COMPLETE';

    ApiResponse.ok(res, 'Login successful', {
      token,
      worker: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone || '',
        profilePicUrl: user.profilePicUrl,
        status: user.status,
        organizationId: user.organizationId,
        organization: {
          id: user.organization.id,
          name: user.organization.name,
          logoUrl: user.organization.logoUrl,
          primaryColor: user.organization.primaryColor,
          secondaryColor: user.organization.secondaryColor,
        },
      },
      onboardingComplete,
    });
  };

  /**
   * Worker Verify OTP - Complete login
   */
  workerVerifyOtp = async (req: Request, res: Response) => {
    const data = workerVerifyOtpSchema.parse(req.body);

    // Find OTP record
    const otpRecord = await prisma.workerOtp.findUnique({
      where: { email: data.email },
    });

    if (!otpRecord) {
      throw new AppError('No verification code found. Please request a new one.', 400, 'OTP_NOT_FOUND');
    }

    if (otpRecord.expiresAt < new Date()) {
      throw new AppError('Verification code expired. Please request a new one.', 400, 'OTP_EXPIRED');
    }

    if (otpRecord.code !== data.code) {
      throw new AppError('Invalid verification code', 400, 'INVALID_OTP');
    }

    // Find worker
    const user = await prisma.user.findFirst({
      where: {
        email: data.email,
        role: 'WORKER',
      },
      include: { organization: true, workerProfile: true },
    });

    if (!user) {
      throw new AppError('Account not found', 404, 'NOT_FOUND');
    }

    // Delete used OTP and update user
    await prisma.$transaction([
      prisma.workerOtp.delete({ where: { email: data.email } }),
      prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true, lastLoginAt: new Date() },
      }),
    ]);

    // Register push token if provided
    if (data.pushToken) {
      try {
        await NotificationService.registerPushToken(
          user.id,
          data.pushToken,
          data.platform,
          data.deviceId
        );
      } catch (error) {
        console.error('Failed to register push token:', error);
      }
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, organizationId: user.organizationId, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn } as SignOptions
    );

    const onboardingComplete = user.workerProfile?.onboardingStatus === 'COMPLETE';

    ApiResponse.ok(res, 'Login successful', {
      token,
      worker: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone || '',
        profilePicUrl: user.profilePicUrl,
        status: user.status,
        organizationId: user.organizationId,
        organization: {
          id: user.organization.id,
          name: user.organization.name,
          logoUrl: user.organization.logoUrl,
        },
      },
      onboardingComplete,
    });
  };

  // ============================================================
  // WORKER DOCUMENT UPLOAD (Registration Step 3)
  // ============================================================

  /**
   * Upload worker certification/document during registration
   * Called from mobile app Step 3 of 4
   */
  workerUploadDocument = async (req: Request, res: Response) => {
    const { email, title, type } = req.body;

    if (!email) {
      throw new AppError('Email is required', 400, 'EMAIL_REQUIRED');
    }

    if (!req.file) {
      throw new AppError('No file uploaded', 400, 'NO_FILE');
    }

    // Find the worker by email (they're in registration flow)
    const worker = await prisma.user.findFirst({
      where: { email, role: 'WORKER' },
    });

    if (!worker) {
      throw new AppError('Worker not found. Please complete registration first.', 404, 'WORKER_NOT_FOUND');
    }

    // Process the uploaded file
    const fileData = StorageService.processUpload(req.file, 'certifications');

    // Create document record
    const document = await prisma.workerDocument.create({
      data: {
        workerId: worker.id,
        type: type || 'CERTIFICATION',
        title: title || req.file.originalname,
        fileName: fileData.filename,
        fileUrl: fileData.url,
        fileSize: fileData.size,
        mimeType: fileData.mimetype,
        status: 'PENDING',
      },
    });

    ApiResponse.created(res, 'Document uploaded successfully', {
      id: document.id,
      title: document.title,
      type: document.type,
      fileName: document.fileName,
      fileUrl: document.fileUrl,
      status: document.status,
    });
  };

  /**
   * Get worker's uploaded documents during registration
   */
  workerGetDocuments = async (req: Request, res: Response) => {
    const { email } = req.query;

    if (!email || typeof email !== 'string') {
      throw new AppError('Email is required', 400, 'EMAIL_REQUIRED');
    }

    const worker = await prisma.user.findFirst({
      where: { email, role: 'WORKER' },
    });

    if (!worker) {
      throw new AppError('Worker not found', 404, 'WORKER_NOT_FOUND');
    }

    const documents = await prisma.workerDocument.findMany({
      where: { workerId: worker.id },
      select: {
        id: true,
        type: true,
        title: true,
        fileName: true,
        fileUrl: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    ApiResponse.ok(res, 'Documents retrieved', documents);
  };

  /**
   * Delete worker document during registration
   */
  workerDeleteDocument = async (req: Request, res: Response) => {
    const { documentId } = req.params;
    const { email } = req.body;

    if (!email) {
      throw new AppError('Email is required', 400, 'EMAIL_REQUIRED');
    }

    const worker = await prisma.user.findFirst({
      where: { email, role: 'WORKER' },
    });

    if (!worker) {
      throw new AppError('Worker not found', 404, 'WORKER_NOT_FOUND');
    }

    const document = await prisma.workerDocument.findFirst({
      where: { id: documentId, workerId: worker.id },
    });

    if (!document) {
      throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    }

    // Delete file from storage
    if (document.fileName) {
      await StorageService.deleteFile(document.fileName, 'certifications');
    }

    // Delete record
    await prisma.workerDocument.delete({
      where: { id: documentId },
    });

    ApiResponse.ok(res, 'Document deleted successfully');
  };

  /**
   * Upload worker profile picture during registration
   */
  workerUploadProfilePic = async (req: Request, res: Response) => {
    const { email } = req.body;

    if (!email) {
      throw new AppError('Email is required', 400, 'EMAIL_REQUIRED');
    }

    if (!req.file) {
      throw new AppError('No file uploaded', 400, 'NO_FILE');
    }

    // Find the worker by email
    const worker = await prisma.user.findFirst({
      where: { email, role: 'WORKER' },
    });

    if (!worker) {
      throw new AppError('Worker not found. Please complete registration first.', 404, 'WORKER_NOT_FOUND');
    }

    // Process the uploaded file
    const fileData = StorageService.processUpload(req.file, 'profile');

    // Update worker with profile pic URL
    await prisma.user.update({
      where: { id: worker.id },
      data: { profilePicUrl: fileData.url },
    });

    ApiResponse.ok(res, 'Profile picture uploaded successfully', {
      profilePicUrl: fileData.url,
    });
  };

  /**
   * Verify worker's Right to Work using UK Home Office share code (Step 4 of 4)
   * This is a self-service endpoint for workers during registration
   */
  workerVerifyRTW = async (req: Request, res: Response) => {
    const { email, shareCode, dateOfBirth } = req.body;

    if (!email) {
      throw new AppError('Email is required', 400, 'EMAIL_REQUIRED');
    }

    if (!shareCode) {
      throw new AppError('Share code is required', 400, 'SHARE_CODE_REQUIRED');
    }

    if (!dateOfBirth) {
      throw new AppError('Date of birth is required', 400, 'DOB_REQUIRED');
    }

    // Validate share code format
    const codeValidation = rtwService.validateShareCode(shareCode);
    if (!codeValidation.valid) {
      throw new AppError(codeValidation.error || 'Invalid share code format', 400, 'INVALID_SHARE_CODE');
    }

    // Validate date of birth
    const dobValidation = rtwService.validateDateOfBirth(dateOfBirth);
    if (!dobValidation.valid) {
      throw new AppError(dobValidation.error || 'Invalid date of birth', 400, 'INVALID_DOB');
    }

    // Find the worker by email
    const worker = await prisma.user.findFirst({
      where: { email, role: 'WORKER' },
      include: { workerProfile: true },
    });

    if (!worker) {
      throw new AppError('Worker not found. Please complete registration first.', 404, 'WORKER_NOT_FOUND');
    }

    if (!worker.workerProfile) {
      throw new AppError('Worker profile not found', 404, 'PROFILE_NOT_FOUND');
    }

    // Set status to pending while verifying
    await prisma.workerProfile.update({
      where: { userId: worker.id },
      data: {
        rtwStatus: 'PENDING',
        rtwShareCode: codeValidation.normalized,
        dateOfBirth: dobValidation.date,
      },
    });

    // Call RTW verification service
    const result = await rtwService.verify({
      shareCode: codeValidation.normalized,
      dateOfBirth,
    });

    // Map verification result to RTW status
    let rtwStatus: 'NOT_STARTED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
    if (result.verified && result.status === 'VALID') {
      rtwStatus = 'APPROVED';
    } else if (result.status === 'EXPIRED') {
      rtwStatus = 'EXPIRED';
    } else if (result.status === 'NOT_FOUND') {
      rtwStatus = 'REJECTED';
    } else {
      rtwStatus = 'REJECTED';
    }

    // Update worker profile with verification result
    const updatedProfile = await prisma.workerProfile.update({
      where: { userId: worker.id },
      data: {
        rtwStatus,
        rtwShareCode: codeValidation.normalized,
        rtwCheckedAt: result.checkDate,
        rtwCheckedBy: 'SELF_SERVICE',
        rtwExpiresAt: result.expiryDate,
        rtwAuditNote: result.verified
          ? `Verified: ${result.workRestriction || 'UNLIMITED'} - ${result.nationality || 'N/A'}`
          : result.errorMessage,
        rtwAuditUrl: result.referenceNumber
          ? rtwService.generateAuditUrl(result.referenceNumber)
          : undefined,
      },
    });

    // Return result
    ApiResponse.ok(res, result.verified ? 'Right to work verified successfully' : 'Verification failed', {
      verified: result.verified,
      status: rtwStatus,
      workRestriction: result.workRestriction,
      expiryDate: result.expiryDate,
      referenceNumber: result.referenceNumber,
      errorMessage: result.errorMessage,
      canProceed: result.verified,
    });
  };

  /**
   * Worker Save Profile (Onboarding Step 1)
   */
  workerSaveProfile = async (req: Request, res: Response) => {
    const data = z.object({
      email: z.string().email(),
      fullName: z.string().min(2).max(255),
      phone: z.string().min(1).max(50),
      dateOfBirth: z.string().min(1),
      address: z.string().min(1).max(500),
      postcode: z.string().min(1).max(10),
      niNumber: z.string().min(1).max(9),
    }).parse(req.body);

    const worker = await prisma.user.findFirst({
      where: { email: data.email, role: 'WORKER' },
    });

    if (!worker) {
      throw new AppError('Worker not found', 404, 'WORKER_NOT_FOUND');
    }

    // Update user record
    await prisma.user.update({
      where: { id: worker.id },
      data: {
        fullName: data.fullName,
        phone: data.phone,
        niNumber: data.niNumber,
      },
    });

    // Upsert worker profile
    await prisma.workerProfile.upsert({
      where: { userId: worker.id },
      update: {
        dateOfBirth: new Date(data.dateOfBirth),
        address: data.address,
        postcode: data.postcode,
      },
      create: {
        userId: worker.id,
        dateOfBirth: new Date(data.dateOfBirth),
        address: data.address,
        postcode: data.postcode,
      },
    });

    ApiResponse.ok(res, 'Profile saved successfully');
  };

  /**
   * Complete worker onboarding (Step 4 - final)
   */
  workerCompleteOnboarding = async (req: Request, res: Response) => {
    const { email } = req.body;

    if (!email) {
      throw new AppError('Email is required', 400, 'EMAIL_REQUIRED');
    }

    const worker = await prisma.user.findFirst({
      where: { email, role: 'WORKER' },
      include: { workerProfile: true },
    });

    if (!worker) {
      throw new AppError('Worker not found', 404, 'WORKER_NOT_FOUND');
    }

    // Update onboarding status
    await prisma.workerProfile.update({
      where: { userId: worker.id },
      data: { onboardingStatus: 'COMPLETE' },
    });

    ApiResponse.ok(res, 'Onboarding completed successfully');
  };

  /**
   * Delete user account (Admin only - deletes organization and all data)
   * DELETE /api/auth/account
   */
  deleteAccount = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const orgId = req.user!.organizationId;
    const userRole = req.user!.role;

    // Only ADMIN can delete the organization account
    if (userRole !== 'ADMIN') {
      throw new AppError('Only administrators can delete the organization account', 403, 'FORBIDDEN');
    }

    // Validate password confirmation
    const { password, confirmText } = z.object({
      password: z.string().min(1, 'Password is required'),
      confirmText: z.string(),
    }).parse(req.body);

    // Verify the confirmation text
    if (confirmText !== 'DELETE MY ACCOUNT') {
      throw new AppError('Please type "DELETE MY ACCOUNT" to confirm', 400, 'CONFIRMATION_REQUIRED');
    }

    // Verify password
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user?.passwordHash) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError('Invalid password', 401, 'INVALID_PASSWORD');
    }

    // Delete the organization (cascades to all related data)
    await prisma.organization.delete({
      where: { id: orgId },
    });

    ApiResponse.ok(res, 'Account deleted successfully');
  };

  /**
   * Generate unique team number for staff members
   * Format: TM-YYYYMMDD-XXXX (e.g., TM-20260220-0001)
   */
  private generateTeamNumber = async (organizationId: string): Promise<string> => {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `TM-${dateStr}-`;

    // Find the highest team number for today in this organization
    const lastUser = await prisma.user.findFirst({
      where: {
        organizationId,
        teamNumber: { startsWith: prefix },
      },
      orderBy: { teamNumber: 'desc' },
      select: { teamNumber: true },
    });

    let sequence = 1;
    if (lastUser?.teamNumber) {
      const lastSequence = parseInt(lastUser.teamNumber.split('-')[2], 10);
      if (!isNaN(lastSequence)) {
        sequence = lastSequence + 1;
      }
    }

    return `${prefix}${sequence.toString().padStart(4, '0')}`;
  };
}
