import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    organizationId: string;
    role: string;
    email: string;
    fullName: string;
  };
}

export const authenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('No token provided', 401, 'UNAUTHORIZED');
  }

  const token = authHeader.split(' ')[1];

  try {
    // Check if token is blacklisted
    const blacklisted = await prisma.tokenBlacklist.findUnique({
      where: { token },
    });

    if (blacklisted) {
      throw new AppError('Token has been revoked', 401, 'TOKEN_REVOKED');
    }

    const decoded = jwt.verify(token, config.jwt.secret) as {
      userId?: string;
      clientUserId?: string;
      organizationId: string;
    };

    // Debug logging
    console.log('🔍 Auth middleware - Token decoded:', {
      hasUserId: !!decoded.userId,
      hasClientUserId: !!decoded.clientUserId,
      tokenKeys: Object.keys(decoded),
      decoded
    });

    if (!decoded.userId) {
      throw new AppError('Invalid token structure - missing userId', 401, 'INVALID_TOKEN');
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        organizationId: true,
        role: true,
        email: true,
        fullName: true,
        status: true,
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new AppError('User not found or inactive', 401, 'UNAUTHORIZED');
    }

    req.user = {
      id: user.id,
      organizationId: user.organizationId,
      role: user.role,
      email: user.email,
      fullName: user.fullName,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AppError('Invalid token', 401, 'INVALID_TOKEN');
    }
    throw error;
  }
};

export const authorize = (...allowedRoles: string[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError('Not authenticated', 401, 'UNAUTHORIZED');
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new AppError('Not authorized', 403, 'FORBIDDEN');
    }

    next();
  };
};

export const authorizeAdmin = authorize('ADMIN');
export const authorizeOps = authorize('ADMIN', 'OPS_MANAGER', 'SHIFT_COORDINATOR');
export const authorizeCompliance = authorize('ADMIN', 'OPS_MANAGER', 'COMPLIANCE_OFFICER');

// Granular role-based middleware
export const authorizeStaff = authorize('ADMIN', 'OPS_MANAGER', 'SHIFT_COORDINATOR', 'COMPLIANCE_OFFICER');
export const authorizeShiftManagement = authorize('ADMIN', 'OPS_MANAGER', 'SHIFT_COORDINATOR');
export const authorizeWorkerManagement = authorize('ADMIN', 'OPS_MANAGER');
export const authorizeTimesheetApproval = authorize('ADMIN', 'OPS_MANAGER');
export const authorizeRtwVerification = authorize('ADMIN', 'OPS_MANAGER', 'COMPLIANCE_OFFICER');
export const authorizeDocumentVerification = authorize('ADMIN', 'COMPLIANCE_OFFICER');
export const authorizeBilling = authorize('ADMIN');
export const authorizeReports = authorize('ADMIN', 'OPS_MANAGER', 'COMPLIANCE_OFFICER');

// Permission-based middleware (checks specific permissions)
export const requirePermission = (permission: string) => {
  const permissionRoles: Record<string, string[]> = {
    'manage_team': ['ADMIN'],
    'manage_workers': ['ADMIN', 'OPS_MANAGER'],
    'manage_shifts': ['ADMIN', 'OPS_MANAGER', 'SHIFT_COORDINATOR'],
    'assign_workers': ['ADMIN', 'OPS_MANAGER', 'SHIFT_COORDINATOR'],
    'broadcast_shifts': ['ADMIN', 'OPS_MANAGER', 'SHIFT_COORDINATOR'],
    'approve_timesheets': ['ADMIN', 'OPS_MANAGER'],
    'manage_clients': ['ADMIN'],
    'view_reports': ['ADMIN', 'OPS_MANAGER', 'COMPLIANCE_OFFICER'],
    'manage_billing': ['ADMIN'],
    'verify_rtw': ['ADMIN', 'OPS_MANAGER', 'COMPLIANCE_OFFICER'],
    'verify_documents': ['ADMIN', 'COMPLIANCE_OFFICER'],
    'view_compliance_reports': ['ADMIN', 'COMPLIANCE_OFFICER'],
  };

  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError('Not authenticated', 401, 'UNAUTHORIZED');
    }

    const allowedRoles = permissionRoles[permission] || [];
    if (!allowedRoles.includes(req.user.role)) {
      throw new AppError(`Permission '${permission}' required`, 403, 'FORBIDDEN');
    }

    next();
  };
};
