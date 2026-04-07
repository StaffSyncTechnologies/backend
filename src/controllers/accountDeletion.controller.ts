import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Schema for account deletion request
const accountDeletionRequestSchema = z.object({
  fullName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  reason: z.string().optional(),
});

export class AccountDeletionController {
  /**
   * Submit account deletion request
   * POST /api/v1/auth/request-account-deletion
   */
  static async requestAccountDeletion(req: Request, res: Response) {
    try {
      const data = accountDeletionRequestSchema.parse(req.body);

      // Find the user account
      const user = await prisma.user.findFirst({
        where: {
          email: data.email,
          fullName: data.fullName,
          ...(data.phone && { phone: data.phone }),
        },
        include: {
          organization: true,
        },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'No account found with the provided information',
          code: 'USER_NOT_FOUND'
        });
      }

      // For now, just log the request and send email notification
      // In a production environment, you would:
      // 1. Store the request in a database table
      // 2. Send notification to admins
      // 3. Send confirmation email to user
      
      console.log('Account deletion request received:', {
        userId: user.id,
        email: data.email,
        fullName: data.fullName,
        reason: data.reason,
        timestamp: new Date().toISOString()
      });

      // Send email notification (you would implement this)
      // await EmailService.sendAccountDeletionNotification(data.email, data.fullName);

      return res.status(200).json({
        success: true,
        message: 'Account deletion request submitted successfully',
        data: {
          requestId: `REQ_${Date.now()}`,
          processingTime: '7-10 business days',
          contactEmail: 'info@staffsynctech.co.uk'
        }
      });

    } catch (error: any) {
      console.error('Account deletion request error:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: error.errors
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to submit account deletion request'
      });
    }
  }
}
