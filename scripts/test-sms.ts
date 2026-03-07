import 'dotenv/config';
import { SmsService } from '../src/services/notifications/sms.service';

async function testSms() {
  const testPhone = process.argv[2];
  
  if (!testPhone) {
    console.error('Usage: npx ts-node scripts/test-sms.ts +447XXXXXXXXX');
    process.exit(1);
  }

  console.log(`Sending test SMS to ${testPhone}...`);
  
  try {
    const sid = await SmsService.send({
      to: testPhone,
      message: 'Hello from StaffSync! This is a test message.',
    });
    console.log('✅ SMS sent successfully!');
    console.log('Message SID:', sid);
  } catch (error) {
    console.error('❌ Failed to send SMS:', error);
  }
}

testSms();
