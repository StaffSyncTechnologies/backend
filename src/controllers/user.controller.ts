import { Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { AppError, NotFoundError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';
import { EmailService } from '../services/notifications/email.service';

const createUserSchema = z.object({
  fullName: z.string().min(2).max(255),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.enum(['OPS_MANAGER', 'SHIFT_COORDINATOR', 'COMPLIANCE_OFFICER']),
  password: z.string().min(8).optional(),
});

export class UserController {
  list = async (req: AuthRequest, res: Response) => {
    const { role, status } = req.query;

    const users = await prisma.user.findMany({
      where: {
        organizationId: req.user!.organizationId,
        role: { not: 'WORKER' },
        ...(role && { role: role as any }),
        ...(status && { status: status as any }),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { fullName: 'asc' },
    });

    res.json({ success: true, data: users });
  };

  getById = async (req: AuthRequest, res: Response) => {
    const user = await prisma.user.findFirst({
      where: {
        id: req.params.userId,
        organizationId: req.user!.organizationId,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!user) throw new NotFoundError('User');

    res.json({ success: true, data: user });
  };

  create = async (req: AuthRequest, res: Response) => {
    const data = createUserSchema.parse(req.body);

    const existing = await prisma.user.findFirst({
      where: {
        organizationId: req.user!.organizationId,
        email: data.email,
      },
    });

    if (existing) {
      throw new AppError('Email already exists in organization', 409, 'EMAIL_EXISTS');
    }

    const passwordHash = data.password 
      ? await bcrypt.hash(data.password, 12) 
      : '';

    // Generate invite token if no password provided
    const inviteToken = !data.password ? crypto.randomBytes(32).toString('hex') : undefined;
    const inviteExpiresAt = !data.password ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : undefined; // 7 days

    const user = await prisma.user.create({
      data: {
        organizationId: req.user!.organizationId,
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        role: data.role,
        passwordHash,
        emailVerified: !!data.password, // If password provided, mark as verified
        inviteToken,
        inviteExpiresAt,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
      },
    });

    // Send invite email if no password provided
    if (inviteToken) {
      const organization = await prisma.organization.findUnique({
        where: { id: req.user!.organizationId },
        select: { name: true },
      });
      await EmailService.sendStaffInvite(
        data.email,
        inviteToken,
        data.fullName,
        organization?.name || 'Your Organization',
        data.role
      );
    }

    ApiResponse.created(res, inviteToken ? 'User invited successfully. Invite email sent.' : 'User created successfully.', user);
  };

  update = async (req: AuthRequest, res: Response) => {
    const data = createUserSchema.partial().parse(req.body);

    const result = await prisma.user.updateMany({
      where: {
        id: req.params.userId,
        organizationId: req.user!.organizationId,
        role: { not: 'ADMIN' },
      },
      data: {
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        role: data.role,
      },
    });

    if (result.count === 0) {
      throw new NotFoundError('User');
    }

    res.json({ success: true, message: 'User updated' });
  };

  delete = async (req: AuthRequest, res: Response) => {
    if (req.params.userId === req.user!.id) {
      throw new AppError('Cannot delete yourself', 400, 'CANNOT_DELETE_SELF');
    }

    const result = await prisma.user.deleteMany({
      where: {
        id: req.params.userId,
        organizationId: req.user!.organizationId,
        role: { not: 'ADMIN' },
      },
    });

    if (result.count === 0) {
      throw new NotFoundError('User');
    }

    res.json({ success: true, message: 'User deleted' });
  };

  suspend = async (req: AuthRequest, res: Response) => {
    const result = await prisma.user.updateMany({
      where: {
        id: req.params.userId,
        organizationId: req.user!.organizationId,
        role: { not: 'ADMIN' },
        status: 'ACTIVE',
      },
      data: { status: 'SUSPENDED' },
    });

    if (result.count === 0) {
      throw new AppError('User not found or cannot be suspended', 400, 'CANNOT_SUSPEND');
    }

    res.json({ success: true, message: 'User suspended' });
  };

  reactivate = async (req: AuthRequest, res: Response) => {
    const result = await prisma.user.updateMany({
      where: {
        id: req.params.userId,
        organizationId: req.user!.organizationId,
        status: 'SUSPENDED',
      },
      data: { status: 'ACTIVE' },
    });

    if (result.count === 0) {
      throw new AppError('User not found or not suspended', 400, 'CANNOT_REACTIVATE');
    }

    res.json({ success: true, message: 'User reactivated' });
  };
}
