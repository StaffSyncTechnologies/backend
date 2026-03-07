import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import crypto from 'crypto';
import { z } from 'zod';
import { getModeDefaults, DeploymentMode } from '../utils/deploymentMode';
import { EmailService } from '../services/notifications/email.service';
import { SmsService } from '../services/notifications/sms.service';
import { ApiResponse } from '../utils/ApiResponse';
import { AppError } from '../utils/AppError';

// Zod schemas
const updateBrandingSchema = z.object({
  logoUrl: z.string().url().max(500).optional().nullable(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').optional().nullable(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').optional().nullable(),
});

const addLocationSchema = z.object({
  name: z.string().min(1, 'Location name is required').max(255),
  address: z.string().min(1, 'Address is required').max(500),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  geofenceRadius: z.number().int().min(10).max(5000).default(100),
  contactName: z.string().max(255).optional(),
  contactPhone: z.string().max(50).optional(),
  isActive: z.boolean().default(true),
});

const addClientSchema = z.object({
  name: z.string().min(1, 'Client name is required').max(255),
  address: z.string().max(500).optional(),
  siteLat: z.number().min(-90).max(90).optional(),
  siteLng: z.number().min(-180).max(180).optional(),
  defaultPayRate: z.number().min(0).optional(),
  defaultChargeRate: z.number().min(0).optional(),
  contactName: z.string().max(255).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(50).optional(),
  billingEmail: z.string().email().optional(),
});

export class OnboardingController {
  getStatus = async (req: AuthRequest, res: Response) => {
    const org = await prisma.organization.findUnique({
      where: { id: req.user!.organizationId },
      select: {
        id: true,
        deploymentMode: true,
        onboardingComplete: true,
        onboardingProgress: true,
      },
    });

    if (!org) {
      throw new AppError('Organization not found', 404, 'NOT_FOUND');
    }

    const mode = org.deploymentMode as DeploymentMode;
    const modeDefaults = getModeDefaults(mode);
    const steps = modeDefaults.onboardingSteps;
    const progress = org?.onboardingProgress || [];
    
    const stepStatus = steps.map(step => {
      const found = progress.find((p: any) => p.step === step);
      return {
        step,
        complete: found?.complete || false,
        skipped: found?.skipped || false,
      };
    });

    const completed = stepStatus.filter(s => s.complete || s.skipped).length;
    const total = steps.length;

    ApiResponse.ok(res, 'Onboarding status retrieved', {
      organizationId: org?.id,
      accountType: org?.deploymentMode,
      deploymentMode: mode,
      features: {
        hasClientCompanies: modeDefaults.hasClientCompanies,
        hasChargeRates: modeDefaults.hasChargeRates,
        hasInvoicing: modeDefaults.hasInvoicing,
        hasClientPortal: modeDefaults.hasClientPortal,
        workerLabel: modeDefaults.workerLabel,
      },
      onboardingComplete: org?.onboardingComplete,
      steps: stepStatus,
      progress: {
        completed,
        total,
        percentage: Math.round((completed / total) * 100),
      },
    });
  };

  updateBranding = async (req: AuthRequest, res: Response) => {
    const { logoUrl, primaryColor, secondaryColor } = updateBrandingSchema.parse(req.body);

    await prisma.$transaction([
      prisma.organization.update({
        where: { id: req.user!.organizationId },
        data: { logoUrl, primaryColor, secondaryColor },
      }),
      prisma.organizationOnboarding.upsert({
        where: {
          organizationId_step: {
            organizationId: req.user!.organizationId,
            step: 'BRANDING',
          },
        },
        update: { complete: true, completedAt: new Date() },
        create: {
          organizationId: req.user!.organizationId,
          step: 'BRANDING',
          complete: true,
          completedAt: new Date(),
        },
      }),
    ]);

    ApiResponse.ok(res, 'Branding updated');
  };

  addLocation = async (req: AuthRequest, res: Response) => {
    const data = addLocationSchema.parse(req.body);

    const location = await prisma.location.create({
      data: {
        organizationId: req.user!.organizationId,
        ...data,
      },
    });

    await prisma.organizationOnboarding.upsert({
      where: {
        organizationId_step: {
          organizationId: req.user!.organizationId,
          step: 'LOCATION',
        },
      },
      update: { complete: true, completedAt: new Date() },
      create: {
        organizationId: req.user!.organizationId,
        step: 'LOCATION',
        complete: true,
        completedAt: new Date(),
      },
    });

    ApiResponse.created(res, 'Location added', location);
  };

  inviteWorker = async (req: AuthRequest, res: Response) => {
    const { email, phone, fullName } = req.body;

    const code = `${crypto.randomBytes(3).toString('hex').toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    const inviteCode = await prisma.inviteCode.create({
      data: {
        organizationId: req.user!.organizationId,
        code,
        codeHash,
        email,
        phone,
        workerName: fullName,
        createdBy: req.user!.id,
      },
    });

    await prisma.organizationOnboarding.upsert({
      where: {
        organizationId_step: {
          organizationId: req.user!.organizationId,
          step: 'WORKER',
        },
      },
      update: { complete: true, completedAt: new Date() },
      create: {
        organizationId: req.user!.organizationId,
        step: 'WORKER',
        complete: true,
        completedAt: new Date(),
      },
    });

    // Get organization name for the invite message
    const organization = await prisma.organization.findUnique({
      where: { id: req.user!.organizationId },
      select: { name: true },
    });
    const orgName = organization?.name || 'your organization';

    // Send invite via email and SMS
    if (email) {
      try {
        const messageId = await EmailService.sendInviteCode(email, code, fullName, orgName);
        console.log(`✅ Onboarding invite email sent to ${email}, messageId: ${messageId}`);
      } catch (emailError) {
        console.error('❌ Onboarding failed to send invite email:', emailError);
      }
    }
    if (phone) {
      try {
        await SmsService.sendInviteCode(phone, code, orgName);
        console.log(`✅ Onboarding invite SMS sent to ${phone}`);
      } catch (smsError) {
        console.error('❌ Onboarding failed to send invite SMS:', smsError);
      }
    }

    ApiResponse.created(res, 'Worker invited successfully', {
      inviteCode: inviteCode.code,
      email,
      phone,
      sent: true,
    });
  };

  addClient = async (req: AuthRequest, res: Response) => {
    const data = addClientSchema.parse(req.body);

    const client = await prisma.clientCompany.create({
      data: {
        organizationId: req.user!.organizationId,
        ...data,
      },
    });

    await prisma.organizationOnboarding.upsert({
      where: {
        organizationId_step: {
          organizationId: req.user!.organizationId,
          step: 'CLIENT',
        },
      },
      update: { complete: true, completedAt: new Date() },
      create: {
        organizationId: req.user!.organizationId,
        step: 'CLIENT',
        complete: true,
        completedAt: new Date(),
      },
    });

    ApiResponse.created(res, 'Client added', client);
  };

  inviteTeam = async (req: AuthRequest, res: Response) => {
    const { members } = z.object({
      members: z.array(z.object({
        email: z.string().email(),
        fullName: z.string().optional(),
        phone: z.string().max(50).optional(),
        role: z.enum(['OPS_MANAGER', 'SHIFT_COORDINATOR', 'COMPLIANCE_OFFICER']),
      })),
    }).parse(req.body);

    const organization = await prisma.organization.findUnique({
      where: { id: req.user!.organizationId },
      select: { name: true },
    });

    // Create team members with invite tokens
    const created = await Promise.all(
      members.map(async (member) => {
        // Check if user already exists
        const existing = await prisma.user.findFirst({
          where: { email: member.email, organizationId: req.user!.organizationId },
        });
        if (existing) {
          return { ...existing, skipped: true };
        }

        // Generate invite token
        const inviteToken = crypto.randomBytes(32).toString('hex');
        const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        const user = await prisma.user.create({
          data: {
            organizationId: req.user!.organizationId,
            fullName: member.fullName || member.email.split('@')[0],
            email: member.email,
            phone: member.phone,
            role: member.role,
            inviteToken,
            inviteExpiresAt,
          },
        });

        // Send invite email
        await EmailService.sendStaffInvite(
          member.email,
          inviteToken,
          user.fullName,
          organization?.name || 'Your Organization',
          member.role
        );

        return user;
      })
    );

    await prisma.organizationOnboarding.upsert({
      where: {
        organizationId_step: {
          organizationId: req.user!.organizationId,
          step: 'TEAM',
        },
      },
      update: { complete: true, completedAt: new Date() },
      create: {
        organizationId: req.user!.organizationId,
        step: 'TEAM',
        complete: true,
        completedAt: new Date(),
      },
    });

    const invitedCount = created.filter((u: any) => !u.skipped).length;
    const skippedCount = created.filter((u: any) => u.skipped).length;

    ApiResponse.created(res, 'Team members invited', { 
      invitedCount,
      skippedCount,
      members: created.map((u: any) => ({
        email: u.email,
        role: u.role,
        status: u.skipped ? 'already_exists' : 'invited',
      })),
    });
  };

  skipOnboarding = async (req: AuthRequest, res: Response) => {
    // Mark all remaining steps as skipped
    const steps = ['BRANDING', 'LOCATION', 'SHIFT', 'WORKER', 'CLIENT', 'TEAM'];
    
    await Promise.all(
      steps.map(step =>
        prisma.organizationOnboarding.upsert({
          where: {
            organizationId_step: {
              organizationId: req.user!.organizationId,
              step: step as any,
            },
          },
          update: {},
          create: {
            organizationId: req.user!.organizationId,
            step: step as any,
            complete: false,
            skipped: true,
          },
        })
      )
    );

    await prisma.organization.update({
      where: { id: req.user!.organizationId },
      data: { onboardingComplete: true },
    });

    ApiResponse.ok(res, 'Onboarding skipped');
  };

  completeOnboarding = async (req: AuthRequest, res: Response) => {
    await prisma.organization.update({
      where: { id: req.user!.organizationId },
      data: { onboardingComplete: true },
    });

    ApiResponse.ok(res, 'Onboarding completed');
  };
}
