import { PrismaClient } from '@prisma/client';
import { exit } from 'process';

const prisma = new PrismaClient();

async function testHomepageAPI() {
  try {
    // Get John Smith's ID
    const john = await prisma.user.findFirst({
      where: { email: 'john.smith@test.com' },
      select: { id: true, fullName: true }
    });
    
    if (!john) {
      console.log('John Smith not found');
      return;
    }
    
    console.log('Testing homepage API for:', john.fullName, john.id);
    
    // Simulate the homepage API logic
    const workerId = john.id;
    const now = new Date();

    // Get start of current week (Monday)
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // Today boundaries
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    console.log('\nDate boundaries:');
    console.log('Now:', now.toISOString());
    console.log('Start of today:', startOfToday.toISOString());
    console.log('End of today:', endOfToday.toISOString());

    // Get worker info
    const worker = await prisma.user.findUnique({
      where: { id: workerId },
      select: {
        id: true,
        fullName: true,
        workerProfile: {
          select: { holidayBalance: true },
        },
      },
    });

    if (!worker) throw new Error('Worker not found');

    // Get today's shift
    const todayAssignment = await prisma.shiftAssignment.findFirst({
      where: {
        workerId,
        status: { in: ['ASSIGNED', 'ACCEPTED'] },
        shift: {
          startAt: { gte: startOfToday, lte: endOfToday },
        },
      },
      include: {
        shift: {
          select: {
            id: true,
            title: true,
            startAt: true,
            endAt: true,
            siteLocation: true,
            hourlyRate: true,
            clientCompany: { select: { name: true } },
          },
        },
      },
      orderBy: { shift: { startAt: 'asc' } },
    });

    console.log('\nToday\'s assignment found:', !!todayAssignment);
    
    if (todayAssignment) {
      console.log('Shift details:');
      console.log('- Title:', todayAssignment.shift.title);
      console.log('- Start:', todayAssignment.shift.startAt.toISOString());
      console.log('- End:', todayAssignment.shift.endAt.toISOString());
      console.log('- Location:', todayAssignment.shift.siteLocation);
      console.log('- Hourly Rate:', todayAssignment.shift.hourlyRate);
      console.log('- Assignment Status:', todayAssignment.status);
      
      // Check if the shift time is within today's boundaries
      const shiftStart = todayAssignment.shift.startAt;
      const isWithinToday = shiftStart >= startOfToday && shiftStart <= endOfToday;
      console.log('- Is within today boundaries:', isWithinToday);
    }

    // Check all assignments for debugging
    const allAssignments = await prisma.shiftAssignment.findMany({
      where: { workerId },
      include: {
        shift: {
          select: {
            id: true,
            title: true,
            startAt: true,
            endAt: true,
          }
        }
      }
    });

    console.log('\nAll assignments for John Smith:');
    allAssignments.forEach(a => {
      console.log('- Shift:', a.shift.title);
      console.log('  Start:', a.shift.startAt.toISOString());
      console.log('  End:', a.shift.endAt.toISOString());
      console.log('  Status:', a.status);
      console.log('  Within today:', a.shift.startAt >= startOfToday && a.shift.startAt <= endOfToday);
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
    exit(0);
  }
}

testHomepageAPI();
