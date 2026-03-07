import twilio from 'twilio';
import { config } from '../../config';

const client = twilio(config.twilio.accountSid, config.twilio.authToken);

export interface WhatsAppOptions {
  to: string;
  message: string;
  templateSid?: string;
  templateVariables?: Record<string, string>;
}

export class WhatsAppService {
  static formatWhatsAppNumber(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    return `whatsapp:+${cleaned}`;
  }

  static async send({ to, message }: WhatsAppOptions): Promise<string> {
    if (!config.twilio.accountSid || !config.twilio.authToken) {
      console.warn('Twilio credentials not configured, skipping WhatsApp');
      return 'skipped';
    }

    const result = await client.messages.create({
      body: message,
      from: `whatsapp:${config.twilio.whatsappNumber}`,
      to: this.formatWhatsAppNumber(to),
    });

    return result.sid;
  }

  static async sendVerificationCode(to: string, code: string): Promise<string> {
    const message = `Your StaffSync verification code is: *${code}*\n\nThis code expires in 15 minutes.\n\nIf you didn't request this, please ignore this message.`;
    return this.send({ to, message });
  }

  static async sendShiftNotification(to: string, shiftDetails: {
    type: 'assigned' | 'reminder' | 'cancelled';
    date: string;
    time: string;
    location: string;
  }): Promise<string> {
    const templates = {
      assigned: `🎯 *New Shift Assigned*\n\n📅 Date: ${shiftDetails.date}\n⏰ Time: ${shiftDetails.time}\n📍 Location: ${shiftDetails.location}\n\nOpen the StaffSync app for details.`,
      reminder: `⏰ *Shift Reminder*\n\nYour shift starts soon!\n\n📅 Date: ${shiftDetails.date}\n⏰ Time: ${shiftDetails.time}\n📍 Location: ${shiftDetails.location}`,
      cancelled: `❌ *Shift Cancelled*\n\nYour shift has been cancelled.\n\n📅 Date: ${shiftDetails.date}\n⏰ Time: ${shiftDetails.time}\n\nPlease check the app for available shifts.`,
    };

    return this.send({ to, message: templates[shiftDetails.type] });
  }
}
