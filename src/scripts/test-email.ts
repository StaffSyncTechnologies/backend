/**
 * Quick test script for Email (SendGrid) and SMS (Twilio) services.
 *
 * Usage:
 *   npx ts-node src/scripts/test-email.ts <recipient-email> [phone]
 *
 * Examples:
 *   npx ts-node src/scripts/test-email.ts john@example.com
 *   npx ts-node src/scripts/test-email.ts john@example.com +447700900000
 */

import dotenv from 'dotenv';
dotenv.config();

import { EmailService } from '../services/notifications/email.service';
import { SmsService } from '../services/notifications/sms.service';
import { config } from '../config';

const email = process.argv[2];
const phone = process.argv[3];

if (!email) {
  console.error('Usage: npx ts-node src/scripts/test-email.ts <email> [phone]');
  process.exit(1);
}

async function run() {
  console.log('========================================');
  console.log('  StaffSync Notification Service Test');
  console.log('========================================\n');

  // ── Config check ──
  const sendgridKey = process.env.SENDGRID_API_KEY || config.smtp.pass;
  const hasSendGrid = !!(sendgridKey && sendgridKey.startsWith('SG.'));
  const hasSmtp = !hasSendGrid && !!(config.smtp.host && config.smtp.pass);
  const hasTwilio = !!(config.twilio.accountSid && config.twilio.authToken);

  console.log('Config:');
  console.log(`  SendGrid API key: ${hasSendGrid ? '✅ Set (SG.xxx)' : '❌ Not set'}`);
  console.log(`  SMTP fallback:    ${hasSmtp ? '✅ Configured' : '⚪ Not used (SendGrid active or not configured)'}`);
  console.log(`  SMTP_FROM:        ${config.smtp.from}`);
  console.log(`  Twilio SID:       ${hasTwilio ? '✅ Set' : '❌ Not set'}`);
  console.log(`  Twilio Phone:     ${config.twilio.phoneNumber || '(empty)'}`);
  console.log('');

  // ── Test Email ──
  console.log(`── Email Test ── Sending to: ${email}`);
  try {
    const code = EmailService.generateVerificationCode();
    const result = await EmailService.sendVerificationCode(email, code, 'Test User');
    if (result === 'skipped-no-smtp') {
      console.log('  ⚠️  SKIPPED — email not configured (no SendGrid key or SMTP creds)');
    } else {
      console.log(`  ✅ SUCCESS — messageId: ${result}`);
      console.log(`  📧 Code sent: ${code}`);
    }
  } catch (err: any) {
    console.error(`  ❌ FAILED — ${err.message}`);
    if (err.response?.body) {
      console.error('  SendGrid error body:', JSON.stringify(err.response.body, null, 2));
    }
  }

  // ── Test SMS ──
  if (phone) {
    console.log(`\n── SMS Test ── Sending to: ${phone}`);
    try {
      const code = EmailService.generateVerificationCode();
      const result = await SmsService.sendVerificationCode(phone, code);
      if (result === 'skipped') {
        console.log('  ⚠️  SKIPPED — Twilio not configured');
      } else {
        console.log(`  ✅ SUCCESS — SID: ${result}`);
        console.log(`  📱 Code sent: ${code}`);
      }
    } catch (err: any) {
      console.error(`  ❌ FAILED — ${err.message}`);
    }
  } else {
    console.log('\n── SMS Test ── Skipped (no phone number provided)');
  }

  console.log('\n========================================');
  console.log('  Done');
  console.log('========================================');
}

run().catch(console.error);
