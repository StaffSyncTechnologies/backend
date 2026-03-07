import nodemailer from 'nodemailer';
import { config } from '../../config';

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.secure,
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass,
  },
});

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  static async send({ to, subject, html, text }: EmailOptions): Promise<string> {
    const result = await transporter.sendMail({
      from: config.smtp.from,
      to,
      subject,
      html,
      text,
    });

    return result.messageId;
  }

  static async sendVerificationCode(email: string, code: string, fullName: string): Promise<string> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">StaffSync</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Hello ${fullName},</h2>
          <p>Thank you for registering with StaffSync. Please use the verification code below to complete your registration:</p>
          <div style="background: #667eea; color: white; font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 20px; text-align: center; border-radius: 8px; margin: 30px 0;">
            ${code}
          </div>
          <p style="color: #666; font-size: 14px;">This code will expire in ${config.emailVerification.expiresInMinutes} minutes.</p>
          <p style="color: #666; font-size: 14px;">If you didn't create an account with StaffSync, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} StaffSync. All rights reserved.
          </p>
        </div>
      </body>
      </html>
    `;

    return this.send({
      to: email,
      subject: 'Verify Your Email - StaffSync',
      html,
      text: `Your StaffSync verification code is: ${code}. This code expires in ${config.emailVerification.expiresInMinutes} minutes.`,
    });
  }

  static async sendNotification(email: string, title: string, body: string, fullName?: string): Promise<string> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">StaffSync</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          ${fullName ? `<h2 style="color: #333; margin-top: 0;">Hello ${fullName},</h2>` : ''}
          <h3 style="color: #667eea; margin-top: 0;">${title}</h3>
          <p>${body}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} StaffSync. All rights reserved.
          </p>
        </div>
      </body>
      </html>
    `;

    return this.send({
      to: email,
      subject: `${title} - StaffSync`,
      html,
      text: `${title}\n\n${body}`,
    });
  }

  static async sendShiftNotification(email: string, fullName: string, shiftDetails: {
    type: 'assigned' | 'reminder' | 'cancelled';
    date: string;
    time: string;
    location: string;
  }): Promise<string> {
    const subjects = {
      assigned: 'New Shift Assigned',
      reminder: 'Shift Reminder',
      cancelled: 'Shift Cancelled',
    };

    const bodies = {
      assigned: `You have been assigned a new shift on ${shiftDetails.date} at ${shiftDetails.time} at ${shiftDetails.location}.`,
      reminder: `Reminder: Your shift starts on ${shiftDetails.date} at ${shiftDetails.time} at ${shiftDetails.location}.`,
      cancelled: `Your shift on ${shiftDetails.date} at ${shiftDetails.time} has been cancelled.`,
    };

    return this.sendNotification(email, subjects[shiftDetails.type], bodies[shiftDetails.type], fullName);
  }

  static generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  static async sendStaffInvite(email: string, inviteToken: string, fullName: string, organizationName: string, role: string): Promise<string> {
    const inviteUrl = `${config.appUrl}/accept-invite?token=${inviteToken}`;
    const roleDisplay = role.replace('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">StaffSync</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Hello ${fullName},</h2>
          <p>You've been invited to join <strong>${organizationName}</strong> as a <strong>${roleDisplay}</strong> on StaffSync!</p>
          <p>Click the button below to set up your account and access your dashboard:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteUrl}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Accept Invitation</a>
          </div>
          <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
          <p style="color: #667eea; font-size: 14px; word-break: break-all;">${inviteUrl}</p>
          <p style="color: #666; font-size: 14px;">This invitation will expire in 7 days.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} StaffSync. All rights reserved.
          </p>
        </div>
      </body>
      </html>
    `;

    return this.send({
      to: email,
      subject: `You're invited to join ${organizationName} as ${roleDisplay} - StaffSync`,
      html,
      text: `Hello ${fullName}, you've been invited to join ${organizationName} as ${roleDisplay} on StaffSync! Click here to accept: ${inviteUrl}. This invitation expires in 7 days.`,
    });
  }

  static async sendInviteCode(email: string, code: string, fullName: string, organizationName: string): Promise<string> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">StaffSync</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Hello ${fullName},</h2>
          <p>You've been invited to join <strong>${organizationName}</strong> on StaffSync!</p>
          <p>Use the invite code below to create your account:</p>
          <div style="background: #667eea; color: white; font-size: 24px; font-weight: bold; letter-spacing: 4px; padding: 20px; text-align: center; border-radius: 8px; margin: 30px 0;">
            ${code}
          </div>
          <p><strong>How to get started:</strong></p>
          <ol style="color: #666;">
            <li>Download the StaffSync app</li>
            <li>Tap "Join with Invite Code"</li>
            <li>Enter the code above and your email</li>
          </ol>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} StaffSync. All rights reserved.
          </p>
        </div>
      </body>
      </html>
    `;

    return this.send({
      to: email,
      subject: `You're invited to join ${organizationName} on StaffSync`,
      html,
      text: `Hello ${fullName}, you've been invited to join ${organizationName} on StaffSync! Your invite code is: ${code}. Download the app and enter this code to get started.`,
    });
  }

  static async sendPasswordReset(email: string, resetToken: string, fullName: string): Promise<string> {
    const resetUrl = `${config.appUrl}/reset-password?token=${resetToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">StaffSync</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Hello ${fullName},</h2>
          <p>We received a request to reset your password. Click the button below to set a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Reset Password</a>
          </div>
          <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
          <p style="color: #667eea; font-size: 14px; word-break: break-all;">${resetUrl}</p>
          <p style="color: #666; font-size: 14px;">This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} StaffSync. All rights reserved.
          </p>
        </div>
      </body>
      </html>
    `;

    return this.send({
      to: email,
      subject: 'Reset Your Password - StaffSync',
      html,
      text: `Hello ${fullName}, we received a request to reset your password. Visit this link to set a new password: ${resetUrl}. This link expires in 1 hour. If you didn't request this, please ignore this email.`,
    });
  }

  static async sendClientInvite(email: string, code: string, contactName: string, organizationName: string): Promise<string> {
    const registrationUrl = `${config.appUrl}/client/register?code=${code}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">StaffSync</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Hello ${contactName},</h2>
          <p>You've been added as a client of <strong>${organizationName}</strong> on StaffSync!</p>
          <p>Use the invite code below to set up your client portal account:</p>
          <div style="background: #667eea; color: white; font-size: 24px; font-weight: bold; letter-spacing: 4px; padding: 20px; text-align: center; border-radius: 8px; margin: 30px 0;">
            ${code}
          </div>
          <p>Or click the button below to get started:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${registrationUrl}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Set Up Your Account</a>
          </div>
          <p><strong>With your client portal, you can:</strong></p>
          <ul style="color: #666;">
            <li>Request workers for shifts</li>
            <li>Track shift assignments</li>
            <li>View and manage invoices</li>
            <li>Access reports and analytics</li>
          </ul>
          <p style="color: #666; font-size: 14px;">This invite code expires in 30 days.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} StaffSync. All rights reserved.
          </p>
        </div>
      </body>
      </html>
    `;

    return this.send({
      to: email,
      subject: `You're invited to join ${organizationName}'s Client Portal - StaffSync`,
      html,
      text: `Hello ${contactName}, you've been added as a client of ${organizationName} on StaffSync! Your invite code is: ${code}. Visit ${registrationUrl} to set up your account. This code expires in 30 days.`,
    });
  }
}
