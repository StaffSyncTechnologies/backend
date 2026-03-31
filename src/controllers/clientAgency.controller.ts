// ============================================================
// SIMPLE CLIENT AGENCY ASSIGNMENT CONTROLLER
// ============================================================

import { Request, Response } from 'express';
import { ClientAgencyService } from '../services/clientAgency.service';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

export class ClientAgencyController {
  constructor(
    private clientAgencyService: ClientAgencyService,
    private prisma: PrismaClient
  ) {}

  /**
   * PUT /api/v1/admin/client/:clientCompanyId/agency
   * Update client's agency assignment
   */
  updateClientAgency = async (req: AuthRequest, res: Response) => {
    try {
      const { clientCompanyId } = req.params;
      const { newAgencyId } = req.body;
      const updatedBy = req.user?.id;

      if (!newAgencyId) {
        return res.status(400).json({
          success: false,
          message: 'New agency ID is required',
        });
      }

      const result = await this.clientAgencyService.updateClientAgency(
        clientCompanyId,
        newAgencyId,
        updatedBy!
      );

      res.json(result);
    } catch (error: any) {
      console.error('Update client agency error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to update client agency',
      });
    }
  };

  /**
   * GET /api/v1/admin/client/:clientCompanyId/agency
   * Get client's current agency
   */
  getClientAgency = async (req: AuthRequest, res: Response) => {
    try {
      const { clientCompanyId } = req.params;

      const client = await this.clientAgencyService.getClientAgency(clientCompanyId);

      if (!client) {
        return res.status(404).json({
          success: false,
          message: 'Client not found',
        });
      }

      res.json({
        success: true,
        data: client,
      });
    } catch (error: any) {
      console.error('Get client agency error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get client agency',
      });
    }
  };

  /**
   * GET /api/v1/admin/agencies
   * List all available agencies for assignment
   */
  getAvailableAgencies = async (req: AuthRequest, res: Response) => {
    try {
      const agencies = await this.prisma.organization.findMany({
        where: {
          deploymentMode: 'AGENCY', // Only get agencies
        },
        select: {
          id: true,
          name: true,
          tradingName: true,
          email: true,
          createdAt: true,
        },
        orderBy: { name: 'asc' },
      });

      res.json({
        success: true,
        data: agencies,
      });
    } catch (error: any) {
      console.error('Get available agencies error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get available agencies',
      });
    }
  };
}
