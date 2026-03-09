import { PrismaClient } from '@prisma/client';
import { exit } from 'process';

const prisma = new PrismaClient();

async function checkJohnShifts() {
  try {
    const john = await prisma.user.findFirst({
      where: { email: 'john.smith@test.com' },
      select: { id: true, fullName: true }
    });
    
    if (!john) {
      console.log('John Smith not found');
      return;
    }
    
    console.log('Found John Smith:', john.fullName, john.id);
    
    const assignments = await prisma.shiftAssignment.findMany({
      where: { workerId: john.id },
      include: {
        shift: {
          select: {
            id: true,
            title: true,
            startAt: true,
            endAt: true,
            status: true
          }
        }
      }
    });
    
    console.log('\nShift assignments:', assignments.length);
    assignments.forEach(a => {
      console.log('- Shift:', a.shift.title);
      console.log('  Start:', a.shift.startAt);
      console.log('  End:', a.shift.endAt);
      console.log('  Status:', a.status);
      console.log('  Shift Status:', a.shift.status);
      console.log('');
    });
    
    // Check today's date
    const today = new Date();
    console.log('Today is:', today.toDateString());
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
    exit(0);
  }
}

checkJohnShifts();
