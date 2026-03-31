import { prisma } from './src/lib/prisma';

async function checkAgencyAssignmentsDirectly() {
  const email = 'admin@acmecorporation.com';
  
  console.log(`🔍 Direct database check for: ${email}`);
  
  try {
    // Get the client user first
    const clientUser = await prisma.clientUser.findFirst({
      where: { email },
      select: { id: true, email: true, fullName: true }
    });

    if (!clientUser) {
      console.log('❌ Client user not found');
      return;
    }

    console.log(`✅ Found client user: ${clientUser.fullName} (ID: ${clientUser.id})`);

    // Check agency assignments directly
    const assignments = await prisma.clientAgencyAssignment.findMany({
      where: { 
        clientUserId: clientUser.id,
        status: 'ACTIVE'
      },
      include: {
        clientCompany: {
          select: { id: true, name: true, organizationId: true }
        }
      }
    });

    console.log(`📊 Agency assignments found: ${assignments.length}`);
    
    assignments.forEach((assignment, index) => {
      console.log(`  ${index + 1}. ${assignment.clientCompany.name} (Primary: ${assignment.isPrimary})`);
    });

    // If no assignments, create one
    if (assignments.length === 0) {
      console.log('⚠️ No assignments found, creating one...');
      
      // Get the client company
      const clientCompany = await prisma.clientCompany.findFirst({
        where: { name: { contains: 'Acme', mode: 'insensitive' } }
      });

      if (!clientCompany) {
        console.log('❌ Client company not found');
        return;
      }

      console.log(`🏢 Using client company: ${clientCompany.name}`);

      const newAssignment = await prisma.clientAgencyAssignment.create({
        data: {
          clientUserId: clientUser.id,
          clientCompanyId: clientCompany.id,
          isPrimary: true,
          status: 'ACTIVE',
          joinedAt: new Date(),
        },
        include: {
          clientCompany: {
            select: { id: true, name: true, organizationId: true }
          }
        }
      });

      console.log('✅ Created assignment:', newAssignment);

      // Verify it was created
      const verifyAssignments = await prisma.clientAgencyAssignment.findMany({
        where: { 
          clientUserId: clientUser.id,
          status: 'ACTIVE'
        },
        include: {
          clientCompany: {
            select: { id: true, name: true, organizationId: true }
          }
        }
      });

      console.log(`📊 Verification - Total assignments: ${verifyAssignments.length}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAgencyAssignmentsDirectly();
