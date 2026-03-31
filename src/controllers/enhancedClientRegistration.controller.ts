// ============================================================
// ENHANCED CLIENT REGISTRATION CONTROLLER
// Supports multi-agency client onboarding
// ============================================================

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

const joinAgencySchema = z.object({
  inviteCode: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
});

export class EnhancedClientRegistrationController {
  /**
   * Validate an invite code and check if user is new or existing
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

    // Check if this email is already registered with ANY agency
    const existingClientUser = await prisma.clientUser.findFirst({
      where: {
        email: code.email || '', // If email is stored on invite code
      },
      include: {
        agencyAssignments: {
          include: {
            clientCompany: {
              include: { organization: true }
            }
          }
        }
      }
    });

    const response = {
      success: true,
      data: {
        valid: true,
        agency: {
          id: code.organization.id,
          name: code.organization.name,
          logo: code.organization.logoUrl,
          primaryColor: code.organization.primaryColor,
        },
        // New fields for enhanced workflow
        isNewUser: !existingClientUser,
        existingAgencies: existingClientUser?.agencyAssignments.map(assignment => ({
          id: assignment.clientCompany.organization.id,
          name: assignment.clientCompany.organization.name,
          clientCompanyId: assignment.clientCompanyId,
          isPrimary: assignment.isPrimary,
        })) || [],
        inviteEmail: code.email, // Email the invite was sent to
      },
    };

    res.json(response);
  };

  /**
   * Register a new client (first-time registration)
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
      // Instead of throwing error, suggest using join-agency flow
      throw new AppError(
        'Email already registered. Use the "Join Agency" option to add this agency to your existing account.', 
        409, 
        'EMAIL_EXISTS_SUGGEST_JOIN'
      );
    }

    // Continue with existing registration logic...
    const passwordHash = await bcrypt.hash(data.admin.password, 12);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

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
          contactPhone: data.company.contactPhone,
          billingEmail: data.company.billingEmail,
        },
      });

      // Create admin user
      const adminUser = await tx.clientUser.create({
        data: {
          clientCompanyId: clientCompany.id,
          email: data.admin.email,
          fullName: data.admin.fullName,
          jobTitle: data.admin.jobTitle,
          phone: data.admin.phone,
          passwordHash,
          role: 'CLIENT_ADMIN',
          status: 'ACTIVE',
          emailVerificationToken: verificationToken,
          emailVerificationExpires: verificationExpires,
          emailVerified: false, // Require email verification
        },
      });

      // Create agency assignment (primary since this is their first agency)
      await tx.clientAgencyAssignment.create({
        data: {
          clientUserId: adminUser.id,
          clientCompanyId: clientCompany.id,
          isPrimary: true,
          status: 'ACTIVE',
          assignedAt: new Date(),
        },
      });

      // Mark invite code as used
      await tx.inviteCode.update({
        where: { id: inviteCode.id },
        data: { 
          status: 'USED',
          usedAt: new Date(),
          usedBy: adminUser.id,
        },
      });

      return { clientCompany, adminUser };
    });

    // Generate JWT token
    const token = jwt.sign(
      {
        id: result.adminUser.id,
        email: result.adminUser.email,
        role: result.adminUser.role,
        clientCompanyId: result.clientCompany.id,
        organizationId: inviteCode.organizationId,
      },
      config.jwt.secret,
      { expiresIn: '7d' }
    );

    // Get agencies for response
    const agencies = await prisma.clientAgencyAssignment.findMany({
      where: { clientUserId: result.adminUser.id },
      include: {
        clientCompany: {
          include: { organization: true }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful! Please check your email to verify your account.',
      data: {
        user: {
          id: result.adminUser.id,
          email: result.adminUser.email,
          fullName: result.adminUser.fullName,
          role: result.adminUser.role,
          emailVerified: result.adminUser.emailVerified,
        },
        token,
        agencies: agencies.map(assignment => ({
          clientCompanyId: assignment.clientCompanyId,
          organizationId: assignment.clientCompany.organizationId,
          name: assignment.clientCompany.organization.name,
          isPrimary: assignment.isPrimary,
          status: assignment.status,
        })),
        currentAgency: {
          id: result.clientCompany.id,
          organizationId: inviteCode.organizationId,
        },
      },
    });
  };

  /**
   * Join an additional agency (for existing clients)
   */
  joinAgency = async (req: Request, res: Response) => {
    const { inviteCode, email, password } = joinAgencySchema.parse(req.body);

    // Validate invite code
    const codeRecord = await prisma.inviteCode.findFirst({
      where: {
        code: inviteCode,
        type: 'CLIENT',
        status: 'ACTIVE',
      },
      include: {
        organization: true,
      },
    });

    if (!codeRecord) {
      throw new AppError('Invalid or expired invite code', 400, 'INVALID_INVITE_CODE');
    }

    // Authenticate existing user
    const existingUser = await prisma.clientUser.findFirst({
      where: { email },
      include: {
        agencyAssignments: {
          include: {
            clientCompany: {
              include: { organization: true }
            }
          }
        }
      }
    });

    if (!existingUser) {
      throw new AppError('No account found with this email. Please register first.', 404, 'USER_NOT_FOUND');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, existingUser.passwordHash || '');
    if (!isPasswordValid) {
      throw new AppError('Invalid password', 401, 'INVALID_PASSWORD');
    }

    // Check if already assigned to this agency
    const existingAssignment = existingUser.agencyAssignments.find(
      assignment => assignment.clientCompany.organizationId === codeRecord.organizationId
    );

    if (existingAssignment) {
      throw new AppError('You are already a member of this agency', 409, 'ALREADY_MEMBER');
    }

    // Get or create client company for this agency
    let clientCompany = await prisma.clientCompany.findFirst({
      where: {
        organizationId: codeRecord.organizationId,
        name: existingUser.agencyAssignments[0]?.clientCompany.name || `${existingUser.fullName}'s Company`,
      },
    });

    if (!clientCompany) {
      // Create new client company for this agency
      clientCompany = await prisma.clientCompany.create({
        data: {
          organizationId: codeRecord.organizationId,
          name: existingUser.agencyAssignments[0]?.clientCompany.name || `${existingUser.fullName}'s Company`,
          // Copy basic info from existing company
          ...(existingUser.agencyAssignments[0]?.clientCompany && {
            registrationNumber: existingUser.agencyAssignments[0].clientCompany.registrationNumber,
            industry: existingUser.agencyAssignments[0].clientCompany.industry,
            address: existingUser.agencyAssignments[0].clientCompany.address,
            city: existingUser.agencyAssignments[0].clientCompany.city,
            postcode: existingUser.agencyAssignments[0].clientCompany.postcode,
            contactPhone: existingUser.agencyAssignments[0].clientCompany.contactPhone,
            billingEmail: existingUser.agencyAssignments[0].clientCompany.billingEmail,
          }),
        },
      });
    }

    // Create agency assignment
    await prisma.$transaction(async (tx) => {
      await tx.clientAgencyAssignment.create({
        data: {
          clientUserId: existingUser.id,
          clientCompanyId: clientCompany.id,
          isPrimary: false, // Additional agencies are not primary
          status: 'ACTIVE',
          assignedAt: new Date(),
        },
      });

      // Mark invite code as used
      await tx.inviteCode.update({
        where: { id: codeRecord.id },
        data: { 
          status: 'USED',
          usedAt: new Date(),
          usedBy: existingUser.id,
        },
      });
    });

    // Generate new JWT token with updated agency context
    const token = jwt.sign(
      {
        id: existingUser.id,
        email: existingUser.email,
        role: existingUser.role,
        clientCompanyId: clientCompany.id,
        organizationId: codeRecord.organizationId,
      },
      config.jwt.secret,
      { expiresIn: '7d' }
    );

    // Get updated agencies list
    const updatedAgencies = await prisma.clientAgencyAssignment.findMany({
      where: { clientUserId: existingUser.id },
      include: {
        clientCompany: {
          include: { organization: true }
        }
      }
    });

    res.json({
      success: true,
      message: `Successfully joined ${codeRecord.organization.name}!`,
      data: {
        user: {
          id: existingUser.id,
          email: existingUser.email,
          fullName: existingUser.fullName,
          role: existingUser.role,
        },
        token,
        agencies: updatedAgencies.map(assignment => ({
          clientCompanyId: assignment.clientCompanyId,
          organizationId: assignment.clientCompany.organizationId,
          name: assignment.clientCompany.organization.name,
          isPrimary: assignment.isPrimary,
          status: assignment.status,
        })),
        currentAgency: {
          id: clientCompany.id,
          organizationId: codeRecord.organizationId,
        },
        newAgency: {
          id: codeRecord.organization.id,
          name: codeRecord.organization.name,
        },
      },
    });
  };
}
