import { PrismaClient } from '@prisma/client';
import { exit } from 'process';

const prisma = new PrismaClient();

async function testBackendLogic() {
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
    
    const workerId = john.id;
    const now = new Date();
    console.log('🔍 Testing exact backend logic for:', john.fullName);
    console.log('Current time:', now.toISOString());

    // Backend date boundaries
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    console.log('Today boundaries:', startOfToday.toISOString(), 'to', endOfToday.toISOString());

    // Backend query for today's assignment
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

    console.log('\n📋 Today assignment found:', !!todayAssignment);
    
    if (!todayAssignment) {
      console.log('❌ No today assignment found - this is the problem!');
      return;
    }

    console.log('✅ Today assignment details:');
    console.log('- Shift ID:', todayAssignment.shift.id);
    console.log('- Title:', todayAssignment.shift.title);
    console.log('- Start:', todayAssignment.shift.startAt.toISOString());
    console.log('- End:', todayAssignment.shift.endAt.toISOString());
    console.log('- Assignment Status:', todayAssignment.status);

    // Check attendance (this might be causing the issue)
    console.log('\n🕐 Checking attendance...');
    const attendance = await prisma.attendance.findUnique({
      where: {
        shiftId_workerId: {
          shiftId: todayAssignment.shiftId,
          workerId,
        },
      },
      select: { clockInAt: true, clockOutAt: true },
    });

    console.log('Attendance found:', !!attendance);
    if (attendance) {
      console.log('- Clock In:', attendance.clockInAt);
      console.log('- Clock Out:', attendance.clockOutAt);
    }

    // Calculate startsIn
    const shiftStart = new Date(todayAssignment.shift.startAt);
    const minutesUntilStart = Math.round((shiftStart.getTime() - now.getTime()) / 60000);
    console.log('Minutes until start:', minutesUntilStart);

    // Build the todayShift object exactly like backend
    const todayShift = {
      id: todayAssignment.shift.id,
      title: todayAssignment.shift.title,
      location: todayAssignment.shift.siteLocation,
      client: todayAssignment.shift.clientCompany?.name,
      startAt: todayAssignment.shift.startAt,
      endAt: todayAssignment.shift.endAt,
      hourlyRate: todayAssignment.shift.hourlyRate ? Number(todayAssignment.shift.hourlyRate) : null,
      startsIn: minutesUntilStart > 0 ? minutesUntilStart : null,
      status: attendance?.clockInAt ? 'IN_PROGRESS' : attendance?.clockOutAt ? 'COMPLETED' : 'PENDING',
      clockedIn: !!attendance?.clockInAt,
      clockedOut: !!attendance?.clockOutAt,
    };

    console.log('\n🎯 Final todayShift object:');
    console.log(JSON.stringify(todayShift, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
    exit(0);
  }
}

testBackendLogic();
