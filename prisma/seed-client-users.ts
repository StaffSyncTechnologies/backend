import { PrismaClient, ClientUserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createTestClientUsers() {
  try {
    console.log('🔧 Creating test client users...');

    // Get existing client companies
    const clientCompanies = await prisma.clientCompany.findMany();
    
    if (clientCompanies.length === 0) {
      console.log('❌ No client companies found. Please run the main seed first.');
      return;
    }

    console.log(`📋 Found ${clientCompanies.length} client companies`);

    // Create client users for each company
    for (const company of clientCompanies) {
      const clientPassword = await bcrypt.hash('Client123!', 10);
      
      // Create CLIENT_ADMIN
      const adminEmail = `admin@${company.name.toLowerCase().replace(/\s+/g, '')}.com`;
      const adminUser = await prisma.clientUser.upsert({
        where: { 
          clientCompanyId_email: { 
            clientCompanyId: company.id, 
            email: adminEmail 
          } 
        },
        update: {},
        create: {
          clientCompanyId: company.id,
          email: adminEmail,
          fullName: `${company.name} Admin`,
          jobTitle: 'Administrator',
          passwordHash: clientPassword,
          role: ClientUserRole.CLIENT_ADMIN,
          status: 'ACTIVE',
          emailVerified: true,
        },
      });

      // Create CLIENT_USER (regular user)
      const userEmail = `user@${company.name.toLowerCase().replace(/\s+/g, '')}.com`;
      const regularUser = await prisma.clientUser.upsert({
        where: { 
          clientCompanyId_email: { 
            clientCompanyId: company.id, 
            email: userEmail 
          } 
        },
        update: {},
        create: {
          clientCompanyId: company.id,
          email: userEmail,
          fullName: `${company.name} User`,
          jobTitle: 'Manager',
          passwordHash: clientPassword,
          role: ClientUserRole.CLIENT_USER,
          status: 'ACTIVE',
          emailVerified: true,
        },
      });

      console.log(`✅ Created client users for ${company.name}:`);
      console.log(`   📧 Admin: ${adminEmail} / Client123!`);
      console.log(`   📧 User:  ${userEmail} / Client123!`);
    }

    console.log('\n🎉 Test client users created successfully!');
    console.log('\n📋 Login Credentials:');
    console.log('=====================================');
    
    for (const company of clientCompanies) {
      console.log(`\n🏢 ${company.name}:`);
      console.log(`   Admin: admin@${company.name.toLowerCase().replace(/\s+/g, '')}.com`);
      console.log(`   User:  user@${company.name.toLowerCase().replace(/\s+/g, '')}.com`);
      console.log(`   Password: Client123!`);
    }

  } catch (error) {
    console.error('❌ Error creating client users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestClientUsers();
