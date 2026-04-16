import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';

/**
 * API Key middleware - validates X-API-Key header.
 * Skips validation if APP_API_KEY is not set in env (dev mode).
 */
export const validateApiKey = (req: Request, _res: Response, next: NextFunction) => {
  const expectedKey = process.env.APP_API_KEY;

  // Skip if no API key configured (local dev)
  if (!expectedKey) return next();

  const providedKey = req.headers['x-api-key'] as string;

  if (!providedKey || providedKey !== expectedKey) {
    throw new AppError('Invalid or missing API key', 403, 'INVALID_API_KEY');
  }

  next();
};
