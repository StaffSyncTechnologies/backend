import { PrismaClient } from '@prisma/client';
import { exit } from 'process';

const prisma = new PrismaClient();

async function debugDateLogic() {
  try {
    // Get John Smith
    const john = await prisma.user.findFirst({
      where: { email: 'john.smith@test.com' },
      select: { id: true, fullName: true }
    });
    
    if (!john) {
      console.log('John Smith not found');
      return;
    }
    
    console.log('🔍 Debugging date logic for:', john.fullName);
    
    // Simulate the backend's date logic
    const now = new Date();
    console.log('\n📅 Current time info:');
    console.log('Now (UTC):', now.toISOString());
    console.log('Now (local):', now.toString());
    console.log('Hours UTC:', now.getUTCHours());
    console.log('Hours local:', now.getHours());
    
    // Get start of current week (Monday) - backend logic
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    console.log('\n📆 Week boundaries:');
    console.log('Start of week:', startOfWeek.toISOString());
    console.log('End of week:', endOfWeek.toISOString());

    // Today boundaries - backend logic
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    console.log('\n📅 Today boundaries:');
    console.log('Start of today:', startOfToday.toISOString());
    console.log('End of today:', endOfToday.toISOString());

    // Get all John's assignments
    const allAssignments = await prisma.shiftAssignment.findMany({
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

    console.log('\n📋 All assignments for John Smith:');
    allAssignments.forEach((a, index) => {
      const shiftStart = a.shift.startAt;
      const isWithinToday = shiftStart >= startOfToday && shiftStart <= endOfToday;
      const isWithinWeek = shiftStart >= startOfWeek && shiftStart <= endOfWeek;
      
      console.log(`\n${index + 1}. Shift: ${a.shift.title}`);
      console.log(`   Start: ${shiftStart.toISOString()}`);
      console.log(`   End: ${a.shift.endAt.toISOString()}`);
      console.log(`   Assignment Status: ${a.status}`);
      console.log(`   Is within today: ${isWithinToday}`);
      console.log(`   Is within week: ${isWithinWeek}`);
      console.log(`   Should be todayShift: ${isWithinToday && ['ASSIGNED', 'ACCEPTED'].includes(a.status)}`);
      console.log(`   Should be in nextShifts: ${!isWithinToday && isWithinWeek && ['ASSIGNED', 'ACCEPTED'].includes(a.status)}`);
    });

    // Test the exact backend query for today's shift
    console.log('\n🔍 Testing backend todayShift query...');
    const todayAssignment = await prisma.shiftAssignment.findFirst({
      where: {
        workerId: john.id,
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

    console.log('Today assignment result:', !!todayAssignment);
    if (todayAssignment) {
      console.log('Found today shift:', todayAssignment.shift.title);
      console.log('Start time:', todayAssignment.shift.startAt.toISOString());
    } else {
      console.log('No today shift found!');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
    exit(0);
  }
}

debugDateLogic();
