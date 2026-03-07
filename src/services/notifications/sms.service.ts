import twilio from 'twilio';
import { config } from '../../config';

// Only create client if credentials are configured
const client = config.twilio.accountSid && config.twilio.authToken 
  ? twilio(config.twilio.accountSid, config.twilio.authToken)
  : null;

export interface SmsOptions {
  to: string;
  message: string;
}

export class SmsService {
  static async send({ to, message }: SmsOptions): Promise<string> {
    if (!client || !config.twilio.accountSid || !config.twilio.authToken) {
      console.warn('Twilio credentials not configured, skipping SMS');
      return 'skipped';
    }

    const result = await client.messages.create({
      body: message,
      from: config.twilio.phoneNumber,
      to,
    });

    return result.sid;
  }

  static async sendVerificationCode(to: string, code: string): Promise<string> {
    const message = `Your StaffSync verification code is: ${code}. This code expires in 15 minutes.`;
    return this.send({ to, message });
  }

  static async sendShiftReminder(to: string, shiftDetails: string): Promise<string> {
    const message = `StaffSync Reminder: ${shiftDetails}`;
    return this.send({ to, message });
  }

  static async sendInviteCode(to: string, code: string, organizationName: string): Promise<string> {
    const message = `You've been invited to join ${organizationName} on StaffSync! Your invite code is: ${code}. Download the app and enter this code to get started.`;
    return this.send({ to, message });
  }
}
