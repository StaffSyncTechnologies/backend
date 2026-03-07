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
      clientCompanyId: string;
    };

    const clientUser = await prisma.clientUser.findUnique({
      where: { id: decoded.clientUserId },
      include: {
        clientCompany: {
          select: { id: true, organizationId: true, name: true },
        },
      },
    });

    if (!clientUser || clientUser.status !== 'ACTIVE') {
      throw new AppError('User not found or inactive', 401, 'UNAUTHORIZED');
    }

    req.clientUser = {
      id: clientUser.id,
      clientCompanyId: clientUser.clientCompanyId,
      organizationId: clientUser.clientCompany.organizationId,
      role: clientUser.role,
      email: clientUser.email,
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
