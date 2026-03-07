import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AppError, NotFoundError } from '../utils/AppError';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';
import crypto from 'crypto';

const updateOrgSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  registrationNumber: z.string().optional(),
  vatNumber: z.string().optional(),
  address: z.string().optional(),
});

const brandingSchema = z.object({
  logoUrl: z.string().url().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

const clientSchema = z.object({
  name: z.string().min(2).max(255),
  registrationNumber: z.string().optional(),
  industry: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postcode: z.string().optional(),
  siteLat: z.number().optional(),
  siteLng: z.number().optional(),
  defaultPayRate: z.number().positive().optional(),
  defaultChargeRate: z.number().positive().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  billingEmail: z.string().email().optional(),
  notes: z.string().optional(),
});

const clientWithAdminSchema = clientSchema.extend({
  createAdmin: z.boolean().optional(),
  admin: z.object({
    fullName: z.string().min(2),
    email: z.string().email(),
    phone: z.string().optional(),
    jobTitle: z.string().optional(),
    sendInvite: z.boolean().optional(),
  }).optional(),
});

const clientPayRateSchema = z.object({
  role: z.string(),
  payRate: z.number().positive(),
  chargeRate: z.number().positive().optional(),
  overtimeMultiplier: z.number().positive().optional(),
});

export class OrganizationController {
  getCurrent = async (req: AuthRequest, res: Response) => {
    const org = await prisma.organization.findUnique({
      where: { id: req.user!.organizationId },
      include: {
        onboardingProgress: true,
        _count: {
          select: {
            users: true,
            clientCompanies: true,
            locations: true,
            shifts: true,
          },
        },
      },
    });

    if (!org) throw new NotFoundError('Organization');

    res.json({ success: true, data: org });
  };

  updateCurrent = async (req: AuthRequest, res: Response) => {
    const data = updateOrgSchema.parse(req.body);

    const org = await prisma.organization.update({
      where: { id: req.user!.organizationId },
      data,
    });

    res.json({ success: true, data: org });
  };

  updateBranding = async (req: AuthRequest, res: Response) => {
    const data = brandingSchema.parse(req.body);

    const org = await prisma.organization.update({
      where: { id: req.user!.organizationId },
      data,
    });

    res.json({ success: true, data: org });
  };

  uploadLogo = async (req: AuthRequest, res: Response) => {
    if (!req.file) {
      throw new AppError('No file uploaded', 400, 'NO_FILE');
    }

    const logoUrl = `/uploads/logos/${req.file.filename}`;

    const org = await prisma.organization.update({
      where: { id: req.user!.organizationId },
      data: { logoUrl },
    });

    res.json({
      success: true,
      data: {
        logoUrl: org.logoUrl,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
      }
    });
  };

  uploadCoverImage = async (req: AuthRequest, res: Response) => {
    if (!req.file) {
      throw new AppError('No file uploaded', 400, 'NO_FILE');
    }

    const coverImageUrl = `/uploads/covers/${req.file.filename}`;

    const org = await prisma.organization.update({
      where: { id: req.user!.organizationId },
      data: { coverImageUrl },
    });

    res.json({ 
      success: true, 
      data: { 
        coverImageUrl: org.coverImageUrl,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
      } 
    });
  };

  getSettings = async (req: AuthRequest, res: Response) => {
    const org = await prisma.organization.findUnique({
      where: { id: req.user!.organizationId },
      select: {
        geofenceEnabled: true,
        geofenceRadiusM: true,
        geofenceMode: true,
        minRestHours: true,
        maxWeeklyHours: true,
        enforcementMode: true,
      },
    });

    res.json({ success: true, data: org });
  };

  updateSettings = async (req: AuthRequest, res: Response) => {
    const org = await prisma.organization.update({
      where: { id: req.user!.organizationId },
      data: req.body,
    });

    res.json({ success: true, data: org });
  };

  // Client Companies
  getClients = async (req: AuthRequest, res: Response) => {
    const clients = await prisma.clientCompany.findMany({
      where: { organizationId: req.user!.organizationId },
      include: {
        _count: { select: { shifts: true } },
        clientPayRates: true,
      },
      orderBy: { name: 'asc' },
    });

    res.json({ success: true, data: clients });
  };

  getClient = async (req: AuthRequest, res: Response) => {
    const client = await prisma.clientCompany.findFirst({
      where: {
        id: req.params.clientId,
        organizationId: req.user!.organizationId,
      },
      include: { clientPayRates: true },
    });

    if (!client) throw new NotFoundError('Client');

    res.json({ success: true, data: client });
  };

  /**
   * Agency registers a client company directly
   * Optionally creates admin user and sends invite
   */
  createClient = async (req: AuthRequest, res: Response) => {
    const data = clientWithAdminSchema.parse(req.body);
    const { admin, createAdmin, ...companyData } = data;

    const result = await prisma.$transaction(async (tx) => {
      // Create client company
      const client = await tx.clientCompany.create({
        data: {
          ...companyData,
          organizationId: req.user!.organizationId,
          status: 'ACTIVE', // Agency-created clients are active immediately
        },
      });

      let clientAdmin = null;

      // Create admin user if requested
      if (createAdmin && admin) {
        // Check if email already exists
        const existing = await tx.clientUser.findFirst({
          where: { email: admin.email },
        });

        if (existing) {
          throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
        }

        // Generate temporary password or invite token
        const inviteToken = crypto.randomBytes(32).toString('hex');
        const inviteExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        clientAdmin = await tx.clientUser.create({
          data: {
            clientCompanyId: client.id,
            email: admin.email,
            fullName: admin.fullName,
            phone: admin.phone,
            jobTitle: admin.jobTitle,
            role: 'CLIENT_ADMIN',
            status: admin.sendInvite ? 'INVITED' : 'PENDING',
            emailVerificationToken: inviteToken,
            emailVerificationExpires: inviteExpires,
          },
        });

        // TODO: Send invite email if sendInvite is true
        // if (admin.sendInvite) {
        //   await sendClientInviteEmail(admin.email, inviteToken, client.name);
        // }
      }

      return { client, clientAdmin };
    });

    res.status(201).json({
      success: true,
      data: {
        client: result.client,
        admin: result.clientAdmin ? {
          id: result.clientAdmin.id,
          email: result.clientAdmin.email,
          fullName: result.clientAdmin.fullName,
          status: result.clientAdmin.status,
        } : null,
      },
    });
  };

  /**
   * Add a user to an existing client company
   */
  addClientUser = async (req: AuthRequest, res: Response) => {
    const { clientId } = req.params;
    const { email, fullName, phone, jobTitle, role, sendInvite } = req.body;

    // Verify client belongs to this org
    const client = await prisma.clientCompany.findFirst({
      where: { id: clientId, organizationId: req.user!.organizationId },
    });

    if (!client) throw new NotFoundError('Client');

    // Check email doesn't exist
    const existing = await prisma.clientUser.findFirst({
      where: { email },
    });

    if (existing) {
      throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
    }

    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const user = await prisma.clientUser.create({
      data: {
        clientCompanyId: clientId,
        email,
        fullName,
        phone,
        jobTitle,
        role: role || 'CLIENT_VIEWER',
        status: sendInvite ? 'INVITED' : 'PENDING',
        emailVerificationToken: inviteToken,
        emailVerificationExpires: inviteExpires,
      },
    });

    // TODO: Send invite email
    // if (sendInvite) await sendClientInviteEmail(email, inviteToken, client.name);

    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
      },
    });
  };

  /**
   * Get users for a client company
   */
  getClientUsers = async (req: AuthRequest, res: Response) => {
    const { clientId } = req.params;

    // Verify client belongs to this org
    const client = await prisma.clientCompany.findFirst({
      where: { id: clientId, organizationId: req.user!.organizationId },
    });

    if (!client) throw new NotFoundError('Client');

    const users = await prisma.clientUser.findMany({
      where: { clientCompanyId: clientId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        jobTitle: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    res.json({ success: true, data: users });
  };

  /**
   * Set pay rates for a client company
   */
  setClientPayRates = async (req: AuthRequest, res: Response) => {
    const { clientId } = req.params;
    const rates = z.array(clientPayRateSchema).parse(req.body.rates);

    // Verify client belongs to this org
    const client = await prisma.clientCompany.findFirst({
      where: { id: clientId, organizationId: req.user!.organizationId },
    });

    if (!client) throw new NotFoundError('Client');

    // Upsert pay rates
    const results = await Promise.all(
      rates.map((rate) =>
        prisma.clientPayRate.upsert({
          where: {
            clientCompanyId_role: { clientCompanyId: clientId, role: rate.role },
          },
          update: {
            payRate: rate.payRate,
            chargeRate: rate.chargeRate,
            overtimeMultiplier: rate.overtimeMultiplier,
          },
          create: {
            clientCompanyId: clientId,
            role: rate.role,
            payRate: rate.payRate,
            chargeRate: rate.chargeRate,
            overtimeMultiplier: rate.overtimeMultiplier,
          },
        })
      )
    );

    res.json({ success: true, data: results });
  };

  /**
   * Resend invite to client user
   */
  resendClientInvite = async (req: AuthRequest, res: Response) => {
    const { clientId, userId } = req.params;

    // Verify client belongs to this org
    const client = await prisma.clientCompany.findFirst({
      where: { id: clientId, organizationId: req.user!.organizationId },
    });

    if (!client) throw new NotFoundError('Client');

    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const user = await prisma.clientUser.updateMany({
      where: {
        id: userId,
        clientCompanyId: clientId,
        status: { in: ['PENDING', 'INVITED'] },
      },
      data: {
        status: 'INVITED',
        emailVerificationToken: inviteToken,
        emailVerificationExpires: inviteExpires,
      },
    });

    if (user.count === 0) {
      throw new AppError('User not found or already active', 400, 'INVALID_USER');
    }

    // TODO: Send invite email

    res.json({ success: true, message: 'Invite sent' });
  };

  updateClient = async (req: AuthRequest, res: Response) => {
    const data = clientSchema.partial().parse(req.body);

    const client = await prisma.clientCompany.updateMany({
      where: {
        id: req.params.clientId,
        organizationId: req.user!.organizationId,
      },
      data,
    });

    if (client.count === 0) throw new NotFoundError('Client');

    res.json({ success: true, message: 'Client updated' });
  };

  deleteClient = async (req: AuthRequest, res: Response) => {
    const result = await prisma.clientCompany.deleteMany({
      where: {
        id: req.params.clientId,
        organizationId: req.user!.organizationId,
      },
    });

    if (result.count === 0) throw new NotFoundError('Client');

    res.json({ success: true, message: 'Client deleted' });
  };

  // Invite Codes
  getInviteCodes = async (req: AuthRequest, res: Response) => {
    const codes = await prisma.inviteCode.findMany({
      where: { organizationId: req.user!.organizationId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: codes });
  };

  createInviteCode = async (req: AuthRequest, res: Response) => {
    const { email, phone, workerName, usageType, maxUses, expiresAt } = req.body;

    const code = `${crypto.randomBytes(3).toString('hex').toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    const inviteCode = await prisma.inviteCode.create({
      data: {
        organizationId: req.user!.organizationId,
        code,
        codeHash,
        email,
        phone,
        workerName,
        usageType: usageType || 'SINGLE_USE',
        maxUses: maxUses || 1,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        createdBy: req.user!.id,
      },
    });

    res.status(201).json({ success: true, data: inviteCode });
  };

  revokeInviteCode = async (req: AuthRequest, res: Response) => {
    const result = await prisma.inviteCode.updateMany({
      where: {
        id: req.params.codeId,
        organizationId: req.user!.organizationId,
        status: 'PENDING',
      },
      data: { status: 'REVOKED' },
    });

    if (result.count === 0) {
      throw new AppError('Code not found or already used', 400, 'INVALID_CODE');
    }

    res.json({ success: true, message: 'Invite code revoked' });
  };
}
