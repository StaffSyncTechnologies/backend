import { PrismaClient } from '@prisma/client';
import { exit } from 'process';

const prisma = new PrismaClient();

async function createTodayShift() {
  try {
    // Get John Smith
    const john = await prisma.user.findFirst({
      where: { email: 'john.smith@test.com' },
      select: { id: true }
    });
    
    if (!john) {
      console.log('John Smith not found');
      return;
    }
    
    // Get the existing shift
    const existingShift = await prisma.shift.findFirst({
      where: { title: 'Day Shift - Test Hospital' }
    });
    
    if (!existingShift) {
      console.log('Shift not found');
      return;
    }
    
    // Update shift to be for later today (in 2 hours from now)
    const now = new Date();
    const startTime = new Date(now.getTime() + (2 * 60 * 60 * 1000)); // 2 hours from now
    const endTime = new Date(startTime.getTime() + (8 * 60 * 60 * 1000)); // 8 hours later
    
    console.log('Current time:', now.toISOString());
    console.log('New start time:', startTime.toISOString());
    console.log('New end time:', endTime.toISOString());
    
    // Update the shift
    await prisma.shift.update({
      where: { id: existingShift.id },
      data: {
        startAt: startTime,
        endAt: endTime
      }
    });
    
    console.log('✅ Updated shift for today!');
    
    // Verify the assignment
    const assignment = await prisma.shiftAssignment.findFirst({
      where: {
        workerId: john.id,
        shiftId: existingShift.id
      }
    });
    
    if (assignment) {
      console.log('✅ Assignment found:', assignment.status);
    } else {
      console.log('❌ No assignment found');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
    exit(0);
  }
}

createTodayShift();
