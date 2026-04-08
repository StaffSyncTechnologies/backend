import { prisma } from '../src/lib/prisma';

async function checkUsers() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        organizationId: true
      },
      take: 10
    });
    
    console.log('Users in database:');
    if (users.length === 0) {
      console.log('No users found!');
    } else {
      users.forEach(user => {
        console.log(`- ${user.fullName} (${user.email}) - ${user.role}`);
      });
    }
    
    // Also check workers
    const workers = await prisma.worker.findMany({
      select: {
        id: true,
        fullName: true,
        email: true,
        status: true
      },
      take: 5
    });
    
    console.log('\nWorkers in database:');
    if (workers.length === 0) {
      console.log('No workers found!');
    } else {
      workers.forEach(worker => {
        console.log(`- ${worker.fullName} (${worker.email}) - ${worker.status}`);
      });
    }
    
  } catch (error) {
    console.error('Error checking users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();
