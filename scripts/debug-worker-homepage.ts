import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function debugWorkerHomepage() {
  try {
    // Find John Smith
    const johnSmith = await prisma.user.findFirst({
      where: { email: 'john.smith@test.com' }
    });
    
    if (!johnSmith) {
      console.log('John Smith not found');
      return;
    }
    
    const workerId = johnSmith.id;
    const now = new Date();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    console.log('Debugging worker homepage for:', johnSmith.fullName);
    console.log('Worker ID:', workerId);
    console.log('Current time:', now.toISOString());
    
    // Test the exact query from the controller
    const todayAssignment = await prisma.shiftAssignment.findFirst({
      where: {
        workerId,
        status: { in: ['ASSIGNED', 'ACCEPTED'] },
        shift: {
          startAt: { gte: today, lte: tomorrow },
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
    
    console.log('\nToday assignment found:', todayAssignment ? 'Yes' : 'No');
    
    if (todayAssignment) {
      console.log('Shift details:');
      console.log('- ID:', todayAssignment.shift.id);
      console.log('- Title:', todayAssignment.shift.title);
      console.log('- Start:', todayAssignment.shift.startAt.toISOString());
      console.log('- End:', todayAssignment.shift.endAt.toISOString());
      console.log('- Location:', todayAssignment.shift.siteLocation);
      console.log('- Assignment Status:', todayAssignment.status);
      
      // Check attendance
      const attendance = await prisma.attendance.findUnique({
        where: {
          shiftId_workerId: {
            shiftId: todayAssignment.shift.id,
            workerId,
          },
        },
        select: { clockInAt: true, clockOutAt: true },
      });
      
      console.log('\nAttendance record:');
      console.log('- Found:', attendance ? 'Yes' : 'No');
      if (attendance) {
        console.log('- Clock In:', attendance.clockInAt?.toISOString());
        console.log('- Clock Out:', attendance.clockOutAt?.toISOString());
      }
      
      // Test the status logic
      const shiftStart = new Date(todayAssignment.shift.startAt);
      const minutesUntilStart = Math.round((shiftStart.getTime() - now.getTime()) / 60000);
      
      console.log('\nStatus calculation:');
      console.log('- Shift start:', shiftStart.toISOString());
      console.log('- Minutes until start:', minutesUntilStart);
      console.log('- Attendance clock out:', attendance?.clockOutAt?.toISOString());
      
      const status = attendance?.clockOutAt
        ? 'COMPLETED'
        : attendance?.clockInAt
        ? 'ACTIVE'
        : minutesUntilStart > 0
        ? 'UPCOMING'
        : 'MISSED';
        
      console.log('- Calculated status:', status);
      
    } else {
      console.log('No assignment found for today');
      
      // Check all assignments for debugging
      const allAssignments = await prisma.shiftAssignment.findMany({
        where: { workerId },
        include: { shift: true },
        take: 5,
      });
      
      console.log('\nRecent assignments:');
      allAssignments.forEach((assignment, index) => {
        console.log(`${index + 1}. Shift: ${assignment.shift.title}, Date: ${assignment.shift.startAt.toDateString()}, Status: ${assignment.status}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugWorkerHomepage();
