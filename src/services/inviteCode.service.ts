import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { EmailService } from './notifications/email.service';
import { SmsService } from './notifications/sms.service';

export interface CreateInviteCodeParams {
  organizationId: string;
  createdBy: string;
  email?: string;
  phone?: string;
  workerName?: string;
  type?: string;
  usageType?: 'SINGLE_USE' | 'MULTI_USE';
  maxUses?: number;
  expiresAt?: Date;
}

export interface InviteCodeResult {
  inviteCode: string;
  email?: string;
  phone?: string;
  emailSent: boolean;
  emailError: string | null;
}

export class InviteCodeService {
  /**
   * Generate a worker invite code, persist it, and optionally send email/SMS.
   * Single source of truth — all controllers should call this.
   */
  static async createWorkerInvite(params: CreateInviteCodeParams): Promise<InviteCodeResult> {
    const {
      organizationId,
      createdBy,
      email,
      phone,
      workerName,
      type = 'WORKER',
      usageType = 'SINGLE_USE',
      maxUses = 1,
      expiresAt,
    } = params;

    // Generate code
    const code = `${crypto.randomBytes(3).toString('hex').toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    // Persist
    await prisma.inviteCode.create({
      data: {
        organizationId,
        code,
        codeHash,
        type,
        status: 'ACTIVE',
        email,
        phone,
        workerName,
        usageType,
        maxUses,
        expiresAt,
        createdBy,
      },
    });

    // Get org name for notifications
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });
    const orgName = organization?.name || 'StaffSync';

    // Send email
    let emailSent = false;
    let emailError: string | null = null;
    if (email) {
      try {
        const messageId = await EmailService.sendInviteCode(
          email,
          code,
          workerName || 'Worker',
          orgName
        );
        emailSent = messageId !== 'skipped-no-smtp';
      } catch (err: any) {
        emailError = err?.message || String(err);
        console.error(`❌ Failed to send invite email to ${email}:`, emailError);
      }
    }

    // Send SMS
    if (phone && SmsService) {
      try {
        await SmsService.sendInviteCode(phone, code, orgName);
      } catch (smsErr) {
        console.error(`❌ Failed to send invite SMS to ${phone}:`, smsErr);
      }
    }

    return { inviteCode: code, email, phone, emailSent, emailError };
  }
}
