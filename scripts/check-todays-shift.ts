import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkTodaysShift() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    console.log('Checking shifts for today:', today.toDateString());
    console.log('Time range:', today.toISOString(), 'to', tomorrow.toISOString());
    
    // Find John Smith
    const johnSmith = await prisma.user.findFirst({
      where: { email: 'john.smith@test.com' }
    });
    
    if (!johnSmith) {
      console.log('John Smith not found');
      return;
    }
    
    console.log('John Smith ID:', johnSmith.id);
    
    // Check shifts for today
    const todaysShifts = await prisma.shift.findMany({
      where: {
        startAt: {
          gte: today,
          lt: tomorrow
        }
      },
      include: {
        assignments: {
          where: {
            workerId: johnSmith.id
          }
        }
      }
    });
    
    console.log('Todays shifts found:', todaysShifts.length);
    
    todaysShifts.forEach((shift, index) => {
      console.log(`Shift ${index + 1}:`);
      console.log('- ID:', shift.id);
      console.log('- Title:', shift.title);
      console.log('- Location:', shift.siteLocation);
      console.log('- Start:', shift.startAt);
      console.log('- End:', shift.endAt);
      console.log('- Assignments:', shift.assignments.length);
      shift.assignments.forEach(assignment => {
        console.log('  - Assignment ID:', assignment.id);
        console.log('  - Status:', assignment.status);
        console.log('  - Worker ID:', assignment.workerId);
      });
    });
    
    // Check all shifts for John Smith
    const allJohnShifts = await prisma.shiftAssignment.findMany({
      where: {
        workerId: johnSmith.id
      },
      include: {
        shift: true
      }
    });
    
    console.log('\nAll John Smith assignments:', allJohnShifts.length);
    
    allJohnShifts.forEach((assignment, index) => {
      const shift = assignment.shift;
      const isToday = shift.startAt >= today && shift.startAt < tomorrow;
      console.log(`Assignment ${index + 1}:`);
      console.log('- Shift ID:', shift.id);
      console.log('- Date:', shift.startAt.toDateString());
      console.log('- Start:', shift.startAt);
      console.log('- Is Today:', isToday);
      console.log('- Assignment Status:', assignment.status);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTodaysShift();
