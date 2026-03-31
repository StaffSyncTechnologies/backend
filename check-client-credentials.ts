import { prisma } from './src/lib/prisma';

async function checkClientCredentials() {
  const email = 'admin@acmecorporation.com';
  
  console.log(`🔍 Checking credentials for: ${email}`);
  
  try {
    const clientUser = await prisma.clientUser.findFirst({
      where: { email },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        passwordHash: true,
        createdAt: true,
      },
    });

    if (!clientUser) {
      console.log('❌ Client user not found');
      return;
    }

    console.log('✅ Found client user:');
    console.log(`  📧 Email: ${clientUser.email}`);
    console.log(`  👤 Name: ${clientUser.fullName}`);
    console.log(`  🔑 Has Password: ${!!clientUser.passwordHash}`);
    console.log(`  📊 Status: ${clientUser.status}`);
    console.log(`  📅 Created: ${clientUser.createdAt}`);

    // Check if there are any existing client users with passwords
    const usersWithPasswords = await prisma.clientUser.count({
      where: {
        passwordHash: {
          not: null
        }
      }
    });

    console.log(`📊 Total users with passwords: ${usersWithPasswords}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkClientCredentials();
