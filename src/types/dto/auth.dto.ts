import { DeploymentMode, UserRole } from '@prisma/client';

// Request DTOs
export interface RegisterRequest {
  // Organization fields
  organizationName: string;
  organizationEmail?: string;
  tradingName?: string;
  companyNumber?: string;
  industry?: string;
  numberOfWorkers?: string;
  location?: string;
  website?: string;
  deploymentMode: DeploymentMode;
  // Admin user fields
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  jobTitle?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateMeRequest {
  fullName?: string;
  phone?: string;
}

export interface SendOtpRequest {
  email: string;
}

export interface VerifyOtpRequest {
  email: string;
  code: string;
}

// Worker Registration (with invite code)
export interface WorkerRegisterRequest {
  email: string;
  password: string;
  inviteCode: string;
  fullName?: string;
  phone?: string;
}

// Worker Login (OTP-based)
export interface WorkerLoginRequest {
  email: string;
}

export interface WorkerVerifyOtpRequest {
  email: string;
  code: string;
}

// Response DTOs
export interface AuthResponse {
  token: string;
  user: AuthUserResponse;
  organization: AuthOrganizationResponse;
}

export interface AuthUserResponse {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}

export interface AuthOrganizationResponse {
  id: string;
  name: string;
  deploymentMode: DeploymentMode;
  logoUrl?: string | null;
  primaryColor?: string | null;
}

export interface GetMeResponse {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  phone: string | null;
  organization: AuthOrganizationResponse;
  workerProfile?: Record<string, unknown>;
}

export interface UpdateMeResponse {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
}

export interface TokenPayload {
  userId: string;
  organizationId: string;
  role: UserRole;
}
