/**
 * Test SendGrid Email and Twilio SMS/WhatsApp services
 * 
 * Usage:
 *   npx ts-node scripts/test-notifications.ts email
 *   npx ts-node scripts/test-notifications.ts sms +1234567890
 *   npx ts-node scripts/test-notifications.ts whatsapp +1234567890
 *   npx ts-node scripts/test-notifications.ts all +1234567890
 */

import nodemailer from 'nodemailer';
import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

const config = {
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || 'apikey',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'noreply@staffsync.com',
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
    whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER || '',
  },
};

const code = Math.floor(100000 + Math.random() * 900000).toString();

// ============ EMAIL TEST (SendGrid) ============
async function testSendGridEmail(toEmail?: string) {
  console.log('\n📧 Testing SendGrid Email...\n');

  // Check if SendGrid credentials are configured
  if (!config.smtp.pass || config.smtp.pass === 'your-sendgrid-api-key') {
    console.log('⚠️  SendGrid not configured. Using Ethereal for testing.\n');
    
    // Use Ethereal for testing
    const testAccount = await nodemailer.createTestAccount();
    const transporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    const result = await transporter.sendMail({
      from: '"StaffSync" <noreply@staffsync.com>',
      to: toEmail || 'test@example.com',
      subject: 'Verify Your Email - StaffSync',
      html: getEmailHtml(code),
      text: `Your StaffSync verification code is: ${code}`,
    });

    console.log('✅ Email sent via Ethereal (test)');
    console.log(`   Message ID: ${result.messageId}`);
    console.log(`   OTP Code: ${code}`);
    console.log(`\n🔗 Preview: ${nodemailer.getTestMessageUrl(result)}\n`);
    return;
  }

  // Use actual SendGrid
  const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
  });

  try {
    const result = await transporter.sendMail({
      from: config.smtp.from,
      to: toEmail || 'test@example.com',
      subject: 'Verify Your Email - StaffSync',
      html: getEmailHtml(code),
      text: `Your StaffSync verification code is: ${code}`,
    });

    console.log('✅ SendGrid email sent successfully!');
    console.log(`   Message ID: ${result.messageId}`);
    console.log(`   To: ${toEmail || 'test@example.com'}`);
    console.log(`   OTP Code: ${code}\n`);
  } catch (error: any) {
    console.error('❌ SendGrid email failed:', error.message);
    console.log('\nCheck your .env configuration:');
    console.log('   SMTP_HOST=smtp.sendgrid.net');
    console.log('   SMTP_PORT=587');
    console.log('   SMTP_USER=apikey');
    console.log('   SMTP_PASS=SG.your-api-key');
    console.log('   SMTP_FROM=noreply@yourdomain.com\n');
  }
}

// ============ SMS TEST (Twilio) ============
async function testTwilioSms(toPhone: string) {
  console.log('\n📱 Testing Twilio SMS...\n');

  if (!config.twilio.accountSid || !config.twilio.authToken) {
    console.log('❌ Twilio not configured.\n');
    console.log('Add to your .env:');
    console.log('   TWILIO_ACCOUNT_SID=your-account-sid');
    console.log('   TWILIO_AUTH_TOKEN=your-auth-token');
    console.log('   TWILIO_PHONE_NUMBER=+1234567890\n');
    return;
  }

  const client = twilio(config.twilio.accountSid, config.twilio.authToken);
  const message = `Your StaffSync verification code is: ${code}. This code expires in 15 minutes.`;

  try {
    const result = await client.messages.create({
      body: message,
      from: config.twilio.phoneNumber,
      to: toPhone,
    });

    console.log('✅ Twilio SMS sent successfully!');
    console.log(`   SID: ${result.sid}`);
    console.log(`   To: ${toPhone}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   OTP Code: ${code}\n`);
  } catch (error: any) {
    console.error('❌ Twilio SMS failed:', error.message);
    if (error.code) {
      console.log(`   Error Code: ${error.code}`);
    }
    console.log('\nVerify your Twilio credentials and phone number format (+1234567890)\n');
  }
}

// ============ WHATSAPP TEST (Twilio) ============
async function testTwilioWhatsApp(toPhone: string) {
  console.log('\n💬 Testing Twilio WhatsApp...\n');

  if (!config.twilio.accountSid || !config.twilio.authToken) {
    console.log('❌ Twilio not configured.\n');
    console.log('Add to your .env:');
    console.log('   TWILIO_ACCOUNT_SID=your-account-sid');
    console.log('   TWILIO_AUTH_TOKEN=your-auth-token');
    console.log('   TWILIO_WHATSAPP_NUMBER=+14155238886\n');
    return;
  }

  const client = twilio(config.twilio.accountSid, config.twilio.authToken);
  const message = `Your StaffSync verification code is: *${code}*\n\nThis code expires in 15 minutes.\n\nIf you didn't request this, please ignore this message.`;

  // Format phone number for WhatsApp
  const cleaned = toPhone.replace(/\D/g, '');
  const whatsappTo = `whatsapp:+${cleaned}`;
  const whatsappFrom = `whatsapp:${config.twilio.whatsappNumber}`;

  try {
    const result = await client.messages.create({
      body: message,
      from: whatsappFrom,
      to: whatsappTo,
    });

    console.log('✅ Twilio WhatsApp sent successfully!');
    console.log(`   SID: ${result.sid}`);
    console.log(`   To: ${whatsappTo}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   OTP Code: ${code}\n`);
  } catch (error: any) {
    console.error('❌ Twilio WhatsApp failed:', error.message);
    if (error.code) {
      console.log(`   Error Code: ${error.code}`);
    }
    console.log('\nNote: For WhatsApp testing, the recipient must have joined the Twilio Sandbox:');
    console.log('   Send "join <sandbox-keyword>" to your Twilio WhatsApp number\n');
  }
}

// ============ EMAIL HTML TEMPLATE ============
function getEmailHtml(code: string): string {
  return `
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
        <h2 style="color: #333; margin-top: 0;">Hello,</h2>
        <p>Thank you for registering with StaffSync. Please use the verification code below to complete your registration:</p>
        <div style="background: #667eea; color: white; font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 20px; text-align: center; border-radius: 8px; margin: 30px 0;">
          ${code}
        </div>
        <p style="color: #666; font-size: 14px;">This code will expire in 15 minutes.</p>
        <p style="color: #666; font-size: 14px;">If you didn't create an account with StaffSync, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px; text-align: center;">
          © ${new Date().getFullYear()} StaffSync. All rights reserved.
        </p>
      </div>
    </body>
    </html>
  `;
}

// ============ MAIN ============
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'email';
  const target = args[1]; // email address or phone number

  console.log('═══════════════════════════════════════════════════════════');
  console.log('   StaffSync Notification Services Test');
  console.log('═══════════════════════════════════════════════════════════');

  switch (command) {
    case 'email':
      await testSendGridEmail(target);
      break;
    case 'sms':
      if (!target) {
        console.log('\n❌ Phone number required: npx ts-node scripts/test-notifications.ts sms +1234567890\n');
        return;
      }
      await testTwilioSms(target);
      break;
    case 'whatsapp':
      if (!target) {
        console.log('\n❌ Phone number required: npx ts-node scripts/test-notifications.ts whatsapp +1234567890\n');
        return;
      }
      await testTwilioWhatsApp(target);
      break;
    case 'all':
      await testSendGridEmail(target);
      if (target) {
        await testTwilioSms(target);
        await testTwilioWhatsApp(target);
      }
      break;
    default:
      console.log('\nUsage:');
      console.log('  npx ts-node scripts/test-notifications.ts email [email@example.com]');
      console.log('  npx ts-node scripts/test-notifications.ts sms +1234567890');
      console.log('  npx ts-node scripts/test-notifications.ts whatsapp +1234567890');
      console.log('  npx ts-node scripts/test-notifications.ts all +1234567890\n');
  }
}

main().catch(console.error);
