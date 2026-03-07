import 'dotenv/config';
import { WhatsAppService } from '../src/services/notifications/whatsapp.service';

async function testWhatsApp() {
  const testPhone = process.argv[2];
  
  if (!testPhone) {
    console.error('Usage: npx ts-node scripts/test-whatsapp.ts +447XXXXXXXXX');
    process.exit(1);
  }

  console.log(`Sending test WhatsApp to ${testPhone}...`);
  
  try {
    const sid = await WhatsAppService.send({
      to: testPhone,
      message: '*Hello from StaffSync!* 👋\n\nThis is a test WhatsApp message.',
    });
    console.log('✅ WhatsApp sent successfully!');
    console.log('Message SID:', sid);
  } catch (error) {
    console.error('❌ Failed to send WhatsApp:', error);
  }
}

testWhatsApp();
