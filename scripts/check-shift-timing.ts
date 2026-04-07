import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkShiftTiming() {
  try {
    const now = new Date();
    console.log('Current time:', now.toISOString());
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Find John Smith's today shift
    const johnSmith = await prisma.user.findFirst({
      where: { email: 'john.smith@test.com' }
    });
    
    const todayAssignment = await prisma.shiftAssignment.findFirst({
      where: {
        workerId: johnSmith!.id,
        status: { in: ['ASSIGNED', 'ACCEPTED'] },
        shift: {
          startAt: { gte: today, lte: tomorrow },
        },
      },
      include: {
        shift: true,
      },
    });
    
    if (todayAssignment) {
      const shift = todayAssignment.shift;
      console.log('\nToday\'s shift found:');
      console.log('- Start:', shift.startAt.toISOString());
      console.log('- End:', shift.endAt.toISOString());
      console.log('- Current time:', now.toISOString());
      console.log('- Has shift ended?', now > shift.endAt);
      console.log('- Shift end > now?', shift.endAt > now);
      
      // Test the actual query
      const actualQuery = await prisma.shiftAssignment.findFirst({
        where: {
          workerId: johnSmith!.id,
          status: { in: ['ASSIGNED', 'ACCEPTED'] },
          shift: {
            startAt: { gte: today, lte: tomorrow },
            endAt: { gt: now }, // This is the problematic line
          },
        },
        include: {
          shift: true,
        },
      });
      
      console.log('\nQuery result with endAt filter:', actualQuery ? 'Found' : 'Not found');
      
      if (!actualQuery) {
        console.log('\nISSUE: Shift has already ended, so it\'s filtered out!');
        console.log('SOLUTION: Remove the endAt filter or adjust the time logic');
      }
    } else {
      console.log('No assignment found for today');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkShiftTiming();
