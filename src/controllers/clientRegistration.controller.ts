import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { AppError, NotFoundError } from '../utils/AppError';
import { z } from 'zod';

const validateCodeSchema = z.object({
  inviteCode: z.string().min(1),
});

const registerSchema = z.object({
  inviteCode: z.string().min(1),
  company: z.object({
    name: z.string().min(2),
    registrationNumber: z.string().optional(),
    industry: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    postcode: z.string().optional(),
    contactPhone: z.string().optional(),
    billingEmail: z.string().email().optional(),
  }),
  admin: z.object({
    fullName: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
    phone: z.string().optional(),
    jobTitle: z.string().optional(),
  }),
});

export class ClientRegistrationController {
  /**
   * Validate an invite code before registration
   */
  validateInviteCode = async (req: Request, res: Response) => {
    const { inviteCode } = validateCodeSchema.parse(req.body);

    const code = await prisma.inviteCode.findFirst({
      where: {
        code: inviteCode,
        type: 'CLIENT',
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

    if (!code) {
      throw new AppError('Invalid or expired invite code', 400, 'INVALID_INVITE_CODE');
    }

    res.json({
      success: true,
      data: {
        valid: true,
        agency: {
          id: code.organization.id,
          name: code.organization.name,
          logo: code.organization.logoUrl,
          primaryColor: code.organization.primaryColor,
        },
      },
    });
  };

  /**
   * Get agency public info for registration page branding
   */
  getAgencyPublicInfo = async (req: Request, res: Response) => {
    const { inviteCode } = req.params;

    const code = await prisma.inviteCode.findFirst({
      where: {
        code: inviteCode,
        type: 'CLIENT',
        status: 'ACTIVE',
      },
      include: {
        organization: {
          select: {
            name: true,
            logoUrl: true,
            primaryColor: true,
            secondaryColor: true,
          },
        },
      },
    });

    if (!code) {
      throw new NotFoundError('Agency');
    }

    res.json({
      success: true,
      data: code.organization,
    });
  };

  /**
   * Register a new client company under an agency
   */
  register = async (req: Request, res: Response) => {
    const data = registerSchema.parse(req.body);

    // Validate invite code
    const inviteCode = await prisma.inviteCode.findFirst({
      where: {
        code: data.inviteCode,
        type: 'CLIENT',
        status: 'ACTIVE',
      },
    });

    if (!inviteCode) {
      throw new AppError('Invalid or expired invite code', 400, 'INVALID_INVITE_CODE');
    }

    // Check if email already exists
    const existingUser = await prisma.clientUser.findFirst({
      where: { email: data.admin.email },
    });

    if (existingUser) {
      throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
    }

    // Check if company name exists under this agency
    const existingCompany = await prisma.clientCompany.findFirst({
      where: {
        organizationId: inviteCode.organizationId,
        name: data.company.name,
      },
    });

    if (existingCompany) {
      throw new AppError('Company name already registered with this agency', 409, 'COMPANY_EXISTS');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.admin.password, 12);

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create client company and admin user in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create client company
      const clientCompany = await tx.clientCompany.create({
        data: {
          organizationId: inviteCode.organizationId,
          name: data.company.name,
          registrationNumber: data.company.registrationNumber,
          industry: data.company.industry,
          address: data.company.address,
          city: data.company.city,
          postcode: data.company.postcode,
          contactName: data.admin.fullName,
          contactEmail: data.admin.email,
          contactPhone: data.company.contactPhone,
          billingEmail: data.company.billingEmail || data.admin.email,
          status: 'PENDING', // Pending until email verified
        },
      });

      // Create admin user for the client company
      const clientUser = await tx.clientUser.create({
        data: {
          clientCompanyId: clientCompany.id,
          email: data.admin.email,
          fullName: data.admin.fullName,
          phone: data.admin.phone,
          jobTitle: data.admin.jobTitle,
          role: 'CLIENT_ADMIN',
          passwordHash,
          status: 'PENDING', // Pending until email verified
          emailVerificationToken: verificationToken,
          emailVerificationExpires: verificationExpires,
        },
      });

      // Increment invite code usage
      await tx.inviteCode.update({
        where: { id: inviteCode.id },
        data: { timesUsed: { increment: 1 } },
      });

      return { clientCompany, clientUser };
    });

    // TODO: Send verification email with token
    // await sendVerificationEmail(data.admin.email, verificationToken);

    // Generate JWT for immediate login (limited access until verified)
    const token = jwt.sign(
      {
        clientUserId: result.clientUser.id,
        clientCompanyId: result.clientCompany.id,
        verified: false,
      },
      config.jwt.secret,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please verify your email.',
      data: {
        token,
        clientCompanyId: result.clientCompany.id,
        clientUserId: result.clientUser.id,
        verificationRequired: true,
        company: {
          id: result.clientCompany.id,
          name: result.clientCompany.name,
        },
        user: {
          id: result.clientUser.id,
          email: result.clientUser.email,
          fullName: result.clientUser.fullName,
        },
      },
    });
  };

  /**
   * Verify email address
   */
  verifyEmail = async (req: Request, res: Response) => {
    const { token } = req.body;

    const clientUser = await prisma.clientUser.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpires: { gt: new Date() },
      },
      include: { clientCompany: true },
    });

    if (!clientUser) {
      throw new AppError('Invalid or expired verification token', 400, 'INVALID_TOKEN');
    }

    // Activate user and company
    await prisma.$transaction([
      prisma.clientUser.update({
        where: { id: clientUser.id },
        data: {
          status: 'ACTIVE',
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpires: null,
        },
      }),
      prisma.clientCompany.update({
        where: { id: clientUser.clientCompanyId },
        data: { status: 'ACTIVE' },
      }),
    ]);

    // Generate new token with verified status
    const newToken = jwt.sign(
      {
        clientUserId: clientUser.id,
        clientCompanyId: clientUser.clientCompanyId,
        verified: true,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn } as SignOptions
    );

    // TODO: Notify agency of new client registration
    // await notifyAgency(clientUser.clientCompany.organizationId, clientUser.clientCompany);

    res.json({
      success: true,
      message: 'Email verified successfully',
      data: {
        token: newToken,
        redirectTo: '/client/dashboard',
      },
    });
  };

  /**
   * Resend verification email
   */
  resendVerification = async (req: Request, res: Response) => {
    const { email } = req.body;

    const clientUser = await prisma.clientUser.findFirst({
      where: { email, status: 'PENDING' },
    });

    if (!clientUser) {
      // Don't reveal if email exists
      res.json({ success: true, message: 'If email exists, verification sent' });
      return;
    }

    // Generate new token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.clientUser.update({
      where: { id: clientUser.id },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
      },
    });

    // TODO: Send verification email
    // await sendVerificationEmail(email, verificationToken);

    res.json({ success: true, message: 'Verification email sent' });
  };
}
