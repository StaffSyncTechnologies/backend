const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkJohnSmithTokens() {
  try {
    const users = await prisma.user.findMany({
      where: { 
        OR: [
          { email: 'john.smith@email.com' },
          { email: 'john.smith@test.com' },
          { email: { contains: 'john.smith' } }
        ]
      },
      include: {
        deviceTokens: {
          select: { 
            token: true, 
            platform: true, 
            deviceId: true, 
            createdAt: true, 
            isActive: true 
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    
    console.log(`Found ${users.length} users with john.smith email:`);
    
    if (users.length === 0) {
      console.log('No users found with john.smith email');
      return;
    }
    
    users.forEach((user, index) => {
      console.log(`\nUser ${index + 1}:`);
      console.log(`  Name: ${user.fullName || 'N/A'}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Device tokens: ${user.deviceTokens.length}`);
      
      if (user.deviceTokens.length > 0) {
        user.deviceTokens.forEach((dt, i) => {
          const isEmulator = dt.deviceId?.includes('sdk_gphone') || dt.deviceId?.includes('emulator');
          console.log(`\n  Token ${i+1}:`);
          console.log(`    Token: ${dt.token}`);
          console.log(`    Device ID: ${dt.deviceId || 'N/A'}`);
          console.log(`    Platform: ${dt.platform}`);
          console.log(`    Status: ${dt.isActive ? 'Active' : 'Inactive'}`);
          console.log(`    Type: ${isEmulator ? 'Emulator' : 'Physical Device'}`);
          console.log(`    Created: ${dt.createdAt}`);
        });
      } else {
        console.log('  No device tokens found');
      }
    });
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkJohnSmithTokens();
