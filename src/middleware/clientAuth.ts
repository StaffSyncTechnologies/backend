import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';

export interface ClientAuthRequest extends Request {
  clientUser?: {
    id: string;
    clientCompanyId: string;
    organizationId: string;
    role: string;
    email: string;
    agencies: Array<{
      clientCompanyId: string;
      organizationId: string;
      name: string;
      isPrimary: boolean;
      status: string;
    }>;
  };
}

export const authenticateClient = async (
  req: ClientAuthRequest,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('No token provided', 401, 'UNAUTHORIZED');
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as {
      clientUserId: string;
      clientCompanyId?: string; // Optional for backward compatibility
    };

    const clientUser = await prisma.clientUser.findUnique({
      where: { id: decoded.clientUserId },
      include: {
        agencyAssignments: {
          include: {
            clientCompany: {
              select: { id: true, organizationId: true, name: true },
            },
          },
          where: { status: 'ACTIVE' },
        },
      },
    });

    if (!clientUser || clientUser.status !== 'ACTIVE') {
      throw new AppError('User not found or inactive', 401, 'UNAUTHORIZED');
    }

    if (clientUser.agencyAssignments.length === 0) {
      throw new AppError('No active agency assignments found', 401, 'NO_AGENCIES');
    }

    // Determine which agency to use
    let selectedAgency;
    if (decoded.clientCompanyId) {
      // Use specific agency from token (new approach)
      selectedAgency = clientUser.agencyAssignments.find(
        assignment => assignment.clientCompanyId === decoded.clientCompanyId
      );
      if (!selectedAgency) {
        throw new AppError('Agency not found or not accessible', 401, 'AGENCY_NOT_FOUND');
      }
    } else {
      // Use primary agency (backward compatibility)
      selectedAgency = clientUser.agencyAssignments.find(
        assignment => assignment.isPrimary
      ) || clientUser.agencyAssignments[0];
    }

    req.clientUser = {
      id: clientUser.id,
      clientCompanyId: selectedAgency.clientCompanyId,
      organizationId: selectedAgency.clientCompany.organizationId,
      role: clientUser.role,
      email: clientUser.email,
      agencies: clientUser.agencyAssignments.map(assignment => ({
        clientCompanyId: assignment.clientCompanyId,
        organizationId: assignment.clientCompany.organizationId,
        name: assignment.clientCompany.name,
        isPrimary: assignment.isPrimary,
        status: assignment.status,
      })),
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AppError('Invalid token', 401, 'INVALID_TOKEN');
    }
    throw error;
  }
};

export const authorizeClientAdmin = (
  req: ClientAuthRequest,
  _res: Response,
  next: NextFunction
) => {
  if (!req.clientUser) {
    throw new AppError('Not authenticated', 401, 'UNAUTHORIZED');
  }

  if (req.clientUser.role !== 'CLIENT_ADMIN' && req.clientUser.role !== 'CLIENT_MANAGER') {
    throw new AppError('Not authorized', 403, 'FORBIDDEN');
  }

  next();
};
