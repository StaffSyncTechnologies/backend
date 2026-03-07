import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || 'apikey',
    pass: process.env.SMTP_PASS || '',
  },
});

async function testSmtp() {
  console.log('Testing SMTP connection...');
  console.log('Host:', process.env.SMTP_HOST);
  console.log('Port:', process.env.SMTP_PORT);
  console.log('User:', process.env.SMTP_USER);
  
  try {
    // Verify connection
    await transporter.verify();
    console.log('✅ SMTP connection successful!');
    
    // Send test email
    const testEmail = process.argv[2] || 'test@example.com';
    console.log(`\nSending test email to: ${testEmail}`);
    
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@staffsync.com',
      to: testEmail,
      subject: 'StaffSync SMTP Test',
      html: `
        <h1>SMTP Test Successful!</h1>
        <p>Your SendGrid SMTP configuration is working correctly.</p>
        <p>Sent at: ${new Date().toISOString()}</p>
      `,
    });
    
    console.log('✅ Test email sent!');
    console.log('Message ID:', info.messageId);
  } catch (error) {
    console.error('❌ SMTP test failed:', error);
    process.exit(1);
  }
}

testSmtp();
