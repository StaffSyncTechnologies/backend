import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export class InviteRequestController {
  /**
   * POST /api/v1/agencies/invite-request
   * Public endpoint — worker submits a request for an invite code.
   */
  submit = async (req: Request, res: Response) => {
    try {
      const { organizationId, fullName, email, phone } = req.body;

      if (!organizationId || !fullName || !email) {
        return res.status(400).json({
          success: false,
          message: 'organizationId, fullName, and email are required',
        });
      }

      // Check org exists
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, name: true },
      });

      if (!org) {
        return res.status(404).json({ success: false, message: 'Organization not found' });
      }

      // Prevent duplicate pending requests
      const existing = await prisma.inviteCodeRequest.findFirst({
        where: {
          organizationId,
          email: email.toLowerCase().trim(),
          status: 'PENDING',
        },
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'You already have a pending request for this agency',
        });
      }

      const request = await prisma.inviteCodeRequest.create({
        data: {
          organizationId,
          fullName: fullName.trim(),
          email: email.toLowerCase().trim(),
          phone: phone?.trim() || null,
        },
      });

      res.status(201).json({ success: true, data: request });
    } catch (error) {
      console.error('Error submitting invite request:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  /**
   * GET /api/v1/agencies/invite-requests
   * Protected — list invite requests for the authenticated user's organization.
   */
  list = async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user?.organizationId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const status = req.query.status as string | undefined;

      const where: any = { organizationId: user.organizationId };
      if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status.toUpperCase())) {
        where.status = status.toUpperCase();
      }

      const requests = await prisma.inviteCodeRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          reviewer: { select: { id: true, fullName: true } },
        },
      });

      res.json({ success: true, data: requests });
    } catch (error) {
      console.error('Error listing invite requests:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  /**
   * PATCH /api/v1/agencies/invite-requests/:id
   * Protected — approve or reject a request.
   */
  review = async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user?.organizationId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const { id } = req.params;
      const { status, notes } = req.body;

      if (!status || !['APPROVED', 'REJECTED'].includes(status.toUpperCase())) {
        return res.status(400).json({
          success: false,
          message: 'status must be APPROVED or REJECTED',
        });
      }

      const request = await prisma.inviteCodeRequest.findFirst({
        where: { id, organizationId: user.organizationId },
      });

      if (!request) {
        return res.status(404).json({ success: false, message: 'Request not found' });
      }

      if (request.status !== 'PENDING') {
        return res.status(400).json({
          success: false,
          message: `Request already ${request.status.toLowerCase()}`,
        });
      }

      const updated = await prisma.inviteCodeRequest.update({
        where: { id },
        data: {
          status: status.toUpperCase() as 'APPROVED' | 'REJECTED',
          reviewedBy: user.id,
          reviewedAt: new Date(),
          notes: notes || null,
        },
        include: {
          reviewer: { select: { id: true, fullName: true } },
        },
      });

      res.json({ success: true, data: updated });
    } catch (error) {
      console.error('Error reviewing invite request:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };
}
