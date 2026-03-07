import { Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { ApiResponse } from '../utils/ApiResponse';
import { NotFoundError, AppError } from '../utils/AppError';
import { EmailService } from '../services/notifications/email.service';

export class WorkerMembershipController {
  /**
   * Get all organizations a worker belongs to
   * GET /api/worker/memberships
   */
  getMyMemberships = async (req: AuthRequest, res: Response) => {
    const workerId = req.user!.id;

    // Get primary organization
    const user = await prisma.user.findUnique({
      where: { id: workerId },
      include: {
        organization: {
          select: { id: true, name: true, logoUrl: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    // Get additional memberships
    const memberships = await prisma.workerOrgMembership.findMany({
      where: { 
        workerId,
        status: 'ACTIVE',
      },
      include: {
        organization: {
          select: { id: true, name: true, logoUrl: true },
        },
      },
    });

    // Combine primary org with memberships
    const organizations = [
      {
        organizationId: user.organization.id,
        name: user.organization.name,
        logoUrl: user.organization.logoUrl,
        isPrimary: true,
        status: 'ACTIVE' as const,
      },
      ...memberships
        .filter(m => m.organizationId !== user.organizationId)
        .map(m => ({
          organizationId: m.organization.id,
          name: m.organization.name,
          logoUrl: m.organization.logoUrl,
          isPrimary: false,
          status: m.status,
        })),
    ];

    ApiResponse.ok(res, 'Worker memberships', { organizations });
  };

  /**
   * Switch worker's active organization context
   * POST /api/worker/memberships/switch
   */
  switchOrganization = async (req: AuthRequest, res: Response) => {
    const workerId = req.user!.id;
    const { organizationId } = z.object({
      organizationId: z.string().uuid(),
    }).parse(req.body);

    // Check if worker has access to this org
    const user = await prisma.user.findUnique({
      where: { id: workerId },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    // Check if it's the primary org or an active membership
    const hasAccess = 
      user.organizationId === organizationId ||
      await prisma.workerOrgMembership.findFirst({
        where: {
          workerId,
          organizationId,
          status: 'ACTIVE',
        },
      });

    if (!hasAccess) {
      throw new AppError('No access to this organization', 403, 'NO_ACCESS');
    }

    // Get organization details
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, logoUrl: true },
    });

    if (!organization) {
      throw new NotFoundError('Organization');
    }

    // Return new context (frontend will use this to filter data)
    ApiResponse.ok(res, 'Organization switched', {
      activeOrganization: organization,
    });
  };

  /**
   * Invite existing worker to organization (for agency use)
   * POST /api/worker/memberships/invite
   */
  inviteWorkerByEmail = async (req: AuthRequest, res: Response) => {
    const inviterId = req.user!.id;
    const inviterOrgId = req.user!.organizationId;

    const { email, hourlyRate } = z.object({
      email: z.string().email(),
      hourlyRate: z.number().positive().optional(),
    }).parse(req.body);

    // Find worker by email (across all organizations)
    const worker = await prisma.user.findFirst({
      where: {
        email,
        role: 'WORKER',
      },
      include: {
        workerProfile: true,
      },
    });

    if (!worker) {
      throw new AppError('Worker not found with this email', 404, 'WORKER_NOT_FOUND');
    }

    // Check if already a member
    const existingMembership = await prisma.workerOrgMembership.findUnique({
      where: {
        workerId_organizationId: {
          workerId: worker.id,
          organizationId: inviterOrgId,
        },
      },
    });

    if (existingMembership) {
      throw new AppError('Worker already has membership with this organization', 400, 'ALREADY_MEMBER');
    }

    // Check if worker is from this org (primary)
    if (worker.organizationId === inviterOrgId) {
      throw new AppError('Worker is already in this organization', 400, 'ALREADY_IN_ORG');
    }

    // Get organization details
    const organization = await prisma.organization.findUnique({
      where: { id: inviterOrgId },
      select: { id: true, name: true },
    });

    // Generate invite code for this membership
    const code = `${crypto.randomBytes(3).toString('hex').toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    // Create invite code record
    const inviteCode = await prisma.inviteCode.create({
      data: {
        organizationId: inviterOrgId,
        code,
        codeHash,
        email: worker.email,
        workerName: worker.fullName,
        type: 'WORKER_TRANSFER',
        createdBy: inviterId,
      },
    });

    // Create pending membership
    const membership = await prisma.workerOrgMembership.create({
      data: {
        workerId: worker.id,
        organizationId: inviterOrgId,
        status: 'PENDING',
        hourlyRate,
        invitedBy: inviterId,
      },
      include: {
        worker: {
          select: { id: true, fullName: true, email: true },
        },
        organization: {
          select: { id: true, name: true },
        },
      },
    });

    // Send email notification to worker
    if (worker.email) {
      try {
        await EmailService.sendInviteCode(
          worker.email,
          code,
          worker.fullName,
          organization?.name || 'An organization'
        );
        console.log(`✅ Organization invite email sent to ${worker.email}`);
      } catch (emailError) {
        console.error('❌ Failed to send organization invite email:', emailError);
      }
    }

    ApiResponse.created(res, 'Worker invited to organization', { 
      membership,
      inviteCode: code,
    });
  };

  /**
   * Accept membership invitation
   * POST /api/worker/memberships/:membershipId/accept
   */
  acceptMembership = async (req: AuthRequest, res: Response) => {
    const workerId = req.user!.id;
    const { membershipId } = req.params;

    const membership = await prisma.workerOrgMembership.findFirst({
      where: {
        id: membershipId,
        workerId,
        status: 'PENDING',
      },
      include: {
        organization: {
          select: { id: true, name: true },
        },
      },
    });

    if (!membership) {
      throw new NotFoundError('Membership invitation');
    }

    await prisma.workerOrgMembership.update({
      where: { id: membershipId },
      data: {
        status: 'ACTIVE',
        acceptedAt: new Date(),
      },
    });

    ApiResponse.ok(res, 'Membership accepted', {
      organization: membership.organization,
    });
  };

  /**
   * Decline membership invitation
   * POST /api/worker/memberships/:membershipId/decline
   */
  declineMembership = async (req: AuthRequest, res: Response) => {
    const workerId = req.user!.id;
    const { membershipId } = req.params;

    const membership = await prisma.workerOrgMembership.findFirst({
      where: {
        id: membershipId,
        workerId,
        status: 'PENDING',
      },
    });

    if (!membership) {
      throw new NotFoundError('Membership invitation');
    }

    await prisma.workerOrgMembership.delete({
      where: { id: membershipId },
    });

    ApiResponse.ok(res, 'Membership declined');
  };

  /**
   * Get pending invitations for worker
   * GET /api/worker/memberships/pending
   */
  getPendingInvitations = async (req: AuthRequest, res: Response) => {
    const workerId = req.user!.id;

    const invitations = await prisma.workerOrgMembership.findMany({
      where: {
        workerId,
        status: 'PENDING',
      },
      include: {
        organization: {
          select: { id: true, name: true, logoUrl: true },
        },
      },
      orderBy: { invitedAt: 'desc' },
    });

    ApiResponse.ok(res, 'Pending invitations', { invitations });
  };

  /**
   * Remove worker from organization (admin/ops only)
   * DELETE /api/worker/memberships/:membershipId
   */
  removeMembership = async (req: AuthRequest, res: Response) => {
    const adminOrgId = req.user!.organizationId;
    const { membershipId } = req.params;

    const membership = await prisma.workerOrgMembership.findFirst({
      where: {
        id: membershipId,
        organizationId: adminOrgId,
      },
    });

    if (!membership) {
      throw new NotFoundError('Membership');
    }

    await prisma.workerOrgMembership.update({
      where: { id: membershipId },
      data: { status: 'TERMINATED' },
    });

    ApiResponse.ok(res, 'Membership terminated');
  };

  /**
   * Get skills for a specific organization
   * GET /api/worker/memberships/:organizationId/skills
   */
  getOrgSkills = async (req: AuthRequest, res: Response) => {
    const { organizationId } = req.params;
    const workerId = req.user!.id;

    const skills = await prisma.workerOrgSkill.findMany({
      where: { workerId, organizationId },
      include: { skill: true },
    });

    ApiResponse.ok(res, 'Organization skills', { skills });
  };

  /**
   * Add/update a skill for a specific organization
   * POST /api/worker/memberships/:organizationId/skills
   */
  addOrgSkill = async (req: AuthRequest, res: Response) => {
    const { organizationId } = req.params;
    const workerId = req.user!.id;
    const { skillId, experienceLevel } = z.object({
      skillId: z.string().uuid(),
      experienceLevel: z.string().optional(),
    }).parse(req.body);

    // Verify active membership
    const membership = await prisma.workerOrgMembership.findUnique({
      where: { workerId_organizationId: { workerId, organizationId } },
    });

    if (!membership || membership.status !== 'ACTIVE') {
      throw new AppError('Not an active member of this organization', 403, 'NOT_MEMBER');
    }

    const skill = await prisma.workerOrgSkill.upsert({
      where: { workerId_organizationId_skillId: { workerId, organizationId, skillId } },
      update: { experienceLevel },
      create: { workerId, organizationId, skillId, experienceLevel },
      include: { skill: true },
    });

    ApiResponse.ok(res, 'Skill added', { skill });
  };

  /**
   * Remove a skill for a specific organization
   * DELETE /api/worker/memberships/:organizationId/skills/:skillId
   */
  removeOrgSkill = async (req: AuthRequest, res: Response) => {
    const { organizationId, skillId } = req.params;
    const workerId = req.user!.id;

    await prisma.workerOrgSkill.deleteMany({
      where: { workerId, organizationId, skillId },
    });

    ApiResponse.ok(res, 'Skill removed');
  };

  /**
   * Get RTW status for a specific organization
   * GET /api/worker/memberships/:organizationId/rtw
   */
  getOrgRTW = async (req: AuthRequest, res: Response) => {
    const { organizationId } = req.params;
    const workerId = req.user!.id;

    let rtw = await prisma.workerOrgRTW.findUnique({
      where: { workerId_organizationId: { workerId, organizationId } },
    });

    // Create if doesn't exist
    if (!rtw) {
      rtw = await prisma.workerOrgRTW.create({
        data: { workerId, organizationId },
      });
    }

    ApiResponse.ok(res, 'Organization RTW status', { rtw });
  };

  /**
   * Update RTW for a specific organization (worker submits share code)
   * PUT /api/worker/memberships/:organizationId/rtw
   */
  updateOrgRTW = async (req: AuthRequest, res: Response) => {
    const { organizationId } = req.params;
    const workerId = req.user!.id;
    const data = z.object({
      shareCode: z.string().max(9).optional(),
    }).parse(req.body);

    const rtw = await prisma.workerOrgRTW.upsert({
      where: { workerId_organizationId: { workerId, organizationId } },
      update: { shareCode: data.shareCode, status: 'PENDING' },
      create: { workerId, organizationId, shareCode: data.shareCode, status: 'PENDING' },
    });

    ApiResponse.ok(res, 'RTW updated', { rtw });
  };

  /**
   * Copy skills from one organization to another
   * POST /api/worker/memberships/copy-skills
   */
  copySkillsToOrg = async (req: AuthRequest, res: Response) => {
    const workerId = req.user!.id;
    const { fromOrgId, toOrgId } = z.object({
      fromOrgId: z.string().uuid(),
      toOrgId: z.string().uuid(),
    }).parse(req.body);

    // Get source skills
    const sourceSkills = await prisma.workerOrgSkill.findMany({
      where: { workerId, organizationId: fromOrgId },
    });

    // Copy to target (without verification)
    const copied = await Promise.all(
      sourceSkills.map((s) =>
        prisma.workerOrgSkill.upsert({
          where: { workerId_organizationId_skillId: { workerId, organizationId: toOrgId, skillId: s.skillId } },
          update: { experienceLevel: s.experienceLevel },
          create: { workerId, organizationId: toOrgId, skillId: s.skillId, experienceLevel: s.experienceLevel, verified: false },
        })
      )
    );

    ApiResponse.ok(res, `Copied ${copied.length} skills`, { copied });
  };
}
