import { prisma } from './src/lib/prisma';

async function createClientAgencyAssignments() {
  try {
    console.log('🔧 Creating client agency assignments...');

    // Get all client users
    const clientUsers = await prisma.clientUser.findMany({
      include: {
        agencyAssignments: true,
      }
    });

    console.log(`📋 Found ${clientUsers.length} client users`);

    // Get Acme Corporation organization (agency)
    const acmeAgencies = await prisma.organization.findMany({
      where: { name: 'Acme Corporation' }
    });

    if (acmeAgencies.length === 0) {
      console.log('❌ Acme Corporation organization not found');
      return;
    }

    const acmeAgency = acmeAgencies[0];
    console.log('✅ Found Acme Corporation agency:', acmeAgency.name);

    // Get Acme Corporation client company
    const acmeClientCompany = await prisma.clientCompany.findFirst({
      where: { name: 'Acme Corporation' }
    });

    if (!acmeClientCompany) {
      console.log('❌ Acme Corporation client company not found');
      return;
    }

    console.log('✅ Found Acme Corporation client company');

    // Create assignments for client users that don't have them
    for (const user of clientUsers) {
      if (user.agencyAssignments.length === 0) {
        console.log(`🔧 Creating agency assignment for: ${user.email}`);
        
        await prisma.clientAgencyAssignment.create({
          data: {
            clientUserId: user.id,
            clientCompanyId: acmeClientCompany.id,
            status: 'ACTIVE',
            isPrimary: true,
          }
        });

        console.log(`✅ Created assignment for: ${user.email}`);
      } else {
        console.log(`ℹ️  ${user.email} already has ${user.agencyAssignments.length} assignments`);
      }
    }

    console.log('\n🎉 Client agency assignments created successfully!');

  } catch (error) {
    console.error('❌ Error creating assignments:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createClientAgencyAssignments();
