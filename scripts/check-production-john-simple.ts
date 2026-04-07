import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkProductionJohnSmith() {
  try {
    console.log('Checking production John Smith users...');

    // Find all John Smith users
    const johnSmiths = await prisma.user.findMany({
      where: { email: 'john.smith@test.com' },
      include: { organization: true }
    });

    console.log('Found John Smith users:', johnSmiths.length);
    
    for (let i = 0; i < johnSmiths.length; i++) {
      const user = johnSmiths[i];
      console.log(`\nJohn Smith ${i + 1}:`);
      console.log('- ID:', user.id);
      console.log('- Email:', user.email);
      console.log('- Name:', user.fullName);
      console.log('- Role:', user.role);
      console.log('- Status:', user.status);
      console.log('- Organization:', user.organization?.name);
      
      // Check assignments for this user
      const assignments = await prisma.shiftAssignment.findMany({
        where: { workerId: user.id },
        include: { shift: true },
        take: 3,
      });
      
      console.log('- Assignments:', assignments.length);
      for (let j = 0; j < assignments.length; j++) {
        const assignment = assignments[j];
        console.log(`  ${j + 1}. Shift: ${assignment.shift.title}, Date: ${assignment.shift.startAt.toDateString()}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkProductionJohnSmith();
