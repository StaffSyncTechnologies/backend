// ============================================================
// SIMPLE CLIENT AGENCY ASSIGNMENT UPDATE
// ============================================================

import { PrismaClient } from '@prisma/client';
import { AppError } from '../utils/AppError';

export class ClientAgencyService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Update client's agency assignment
   * When this changes, all data queries will automatically show new agency's data
   */
  async updateClientAgency(
    clientCompanyId: string,
    newAgencyId: string,
    updatedBy: string
  ) {
    // Validate client exists
    const client = await this.prisma.clientCompany.findUnique({
      where: { id: clientCompanyId },
    });

    if (!client) {
      throw new AppError('Client company not found', 404, 'CLIENT_NOT_FOUND');
    }

    // Validate new agency exists
    const agency = await this.prisma.organization.findUnique({
      where: { id: newAgencyId },
    });

    if (!agency) {
      throw new AppError('Agency not found', 404, 'AGENCY_NOT_FOUND');
    }

    // Update client's agency assignment
    const updatedClient = await this.prisma.clientCompany.update({
      where: { id: clientCompanyId },
      data: { 
        organizationId: newAgencyId,
      },
    });

    return {
      success: true,
      message: 'Client agency assignment updated successfully',
      data: {
        client: updatedClient,
        previousAgency: client.organizationId,
        newAgency: newAgencyId,
        updatedBy,
      },
    };
  }

  /**
   * Get client's current agency
   */
  async getClientAgency(clientCompanyId: string) {
    const client = await this.prisma.clientCompany.findUnique({
      where: { id: clientCompanyId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            tradingName: true,
          },
        },
      },
    });

    return client;
  }
}
