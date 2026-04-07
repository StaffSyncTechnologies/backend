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
    
    johnSmiths.forEach((user, index) => {
      console.log(`\nJohn Smith ${index + 1}:`);
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
      assignments.forEach((assignment, i) => {
        console.log(`  ${i + 1}. Shift: ${assignment.shift.title}, Date: ${assignment.shift.startAt.toDateString()}`);
      });
    });
    
    // Check which John Smith ID is returned by login
    console.log('\nTesting login...');
    const response = await fetch('https://app.staffsynctech.co.uk/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'john.smith@test.com',
        password: 'worker123'
      })
    });
    
    const loginData = await response.json();
    if (loginData.success) {
      console.log('Login returns user ID:', loginData.data.user.id);
      
      // Check assignments for the logged-in user
      const loggedInUserAssignments = await prisma.shiftAssignment.findMany({
        where: { workerId: loginData.data.user.id },
        include: { shift: true },
      });
      
      console.log('Logged-in user assignments:', loggedInUserAssignments.length);
      loggedInUserAssignments.forEach((assignment, i) => {
        console.log(`  ${i + 1}. Shift: ${assignment.shift.title}, Date: ${assignment.shift.startAt.toDateString()}, Status: ${assignment.status}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkProductionJohnSmith();
