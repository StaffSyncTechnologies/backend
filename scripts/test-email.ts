/**
 * Test email service
 * Run with: npx ts-node scripts/test-email.ts
 */

import nodemailer from 'nodemailer';

async function testEmail() {
  console.log('🔧 Creating test account with Ethereal...\n');
  
  // Create a test account on Ethereal (free fake SMTP)
  const testAccount = await nodemailer.createTestAccount();
  
  console.log('📧 Test SMTP credentials:');
  console.log(`   Host: ${testAccount.smtp.host}`);
  console.log(`   Port: ${testAccount.smtp.port}`);
  console.log(`   User: ${testAccount.user}`);
  console.log(`   Pass: ${testAccount.pass}\n`);

  // Create transporter with test account
  const transporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });

  // Generate a test OTP
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const testEmail = 'test@example.com';
  const fullName = 'Test User';

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

  console.log('📤 Sending test verification email...\n');

  const result = await transporter.sendMail({
    from: '"StaffSync" <noreply@staffsync.com>',
    to: testEmail,
    subject: 'Verify Your Email - StaffSync',
    html,
    text: `Your StaffSync verification code is: ${code}`,
  });

  console.log('✅ Email sent successfully!');
  console.log(`   Message ID: ${result.messageId}`);
  console.log(`   OTP Code: ${code}\n`);
  
  // Get preview URL (Ethereal lets you view the email)
  const previewUrl = nodemailer.getTestMessageUrl(result);
  console.log('🔗 Preview URL (open in browser to see the email):');
  console.log(`   ${previewUrl}\n`);
}

testEmail().catch(console.error);
