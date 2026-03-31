import { prisma } from './src/lib/prisma';

async function checkClientAgencies() {
  const email = 'admin@acmecorporation.com';
  
  console.log(`🔍 Checking agency assignments for: ${email}`);
  
  try {
    // Find the client user
    const clientUser = await prisma.clientUser.findFirst({
      where: { email },
      include: {
        agencyAssignments: {
          include: {
            clientCompany: {
              select: { id: true, organizationId: true, name: true },
            },
          },
          where: { status: 'ACTIVE' },
        },
        clientCompany: true,
      },
    });

    if (!clientUser) {
      console.log('❌ Client user not found');
      return;
    }

    console.log(`✅ Found client user: ${clientUser.fullName}`);
    console.log(`📧 Email: ${clientUser.email}`);
    console.log(`🏢 Primary Company: ${clientUser.clientCompany.name}`);
    console.log(`📊 Agency Assignments: ${clientUser.agencyAssignments.length}`);

    if (clientUser.agencyAssignments.length === 0) {
      console.log('⚠️ No agency assignments found. Creating one...');
      
      // Create agency assignment for the existing client company
      await prisma.clientAgencyAssignment.create({
        data: {
          clientUserId: clientUser.id,
          clientCompanyId: clientUser.clientCompanyId,
          isPrimary: true,
          status: 'ACTIVE',
          joinedAt: new Date(),
        },
      });

      console.log('✅ Agency assignment created');
    } else {
      console.log('📋 Agency assignments:');
      clientUser.agencyAssignments.forEach((assignment, index) => {
        console.log(`  ${index + 1}. ${assignment.clientCompany.name} (${assignment.isPrimary ? 'Primary' : 'Secondary'})`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkClientAgencies();
