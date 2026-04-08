import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkJohnSmith() {
  try {
    console.log('Checking for John Smith...');

    // Find John Smith
    const johnSmith = await prisma.user.findFirst({
      where: { 
        OR: [
          { email: 'john.smith@test.com' },
          { email: { contains: 'john' } }
        ]
      },
      include: {
        organization: true
      }
    });

    if (johnSmith) {
      console.log('John Smith Found:');
      console.log('Email:', johnSmith.email);
      console.log('Full Name:', johnSmith.fullName);
      console.log('Role:', johnSmith.role);
      console.log('Organization:', johnSmith.organization?.name);
      console.log('Password: worker123');
      console.log('User ID:', johnSmith.id);
    } else {
      console.log('John Smith not found in database');
      
      // Check if there are any workers at all
      const workers = await prisma.user.findMany({
        where: { role: 'WORKER' },
        include: { organization: true },
        take: 5
      });
      
      if (workers.length > 0) {
        console.log('\nAvailable workers:');
        workers.forEach(worker => {
          console.log(`- ${worker.fullName} (${worker.email}) - ${worker.organization?.name}`);
          console.log('  Password: worker123');
        });
      } else {
        console.log('No workers found in database. Please run the main seed first.');
      }
    }

  } catch (error) {
    console.error('Error checking John Smith:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkJohnSmith();
