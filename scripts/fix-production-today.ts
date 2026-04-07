import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixProductionTodayShift() {
  try {
    console.log('Fixing production today shift...');

    // Find John Smith
    const johnSmith = await prisma.user.findFirst({
      where: { email: 'john.smith@test.com' },
      include: { organization: true }
    });

    if (!johnSmith) {
      console.log('John Smith not found');
      return;
    }

    console.log('John Smith ID:', johnSmith.id);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check if today's shift exists
    const todayShift = await prisma.shift.findFirst({
      where: {
        startAt: { gte: today, lt: tomorrow },
        title: 'Healthcare Support Worker',
      },
    });

    console.log('Today shift found:', todayShift ? 'Yes' : 'No');
    
    if (todayShift) {
      console.log('Shift ID:', todayShift.id);
      console.log('Shift start:', todayShift.startAt.toISOString());
      
      // Check if assignment exists
      const existingAssignment = await prisma.shiftAssignment.findFirst({
        where: {
          shiftId: todayShift.id,
          workerId: johnSmith.id,
        },
      });
      
      console.log('Assignment exists:', existingAssignment ? 'Yes' : 'No');
      
      if (!existingAssignment) {
        console.log('Creating assignment...');
        const assignment = await prisma.shiftAssignment.create({
          data: {
            shiftId: todayShift.id,
            workerId: johnSmith.id,
            status: 'ACCEPTED',
            assignedAt: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
          }
        });
        console.log('Assignment created:', assignment.id);
      }
      
      // Check if attendance exists
      const existingAttendance = await prisma.attendance.findUnique({
        where: {
          shiftId_workerId: {
            shiftId: todayShift.id,
            workerId: johnSmith.id,
          },
        },
      });
      
      console.log('Attendance exists:', existingAttendance ? 'Yes' : 'No');
      
      if (!existingAttendance) {
        console.log('Creating attendance...');
        const clockInTime = new Date();
        clockInTime.setHours(8, 55, 0, 0);
        
        const attendance = await prisma.attendance.create({
          data: {
            shiftId: todayShift.id,
            workerId: johnSmith.id,
            clockInAt: clockInTime,
            status: 'PENDING',
          }
        });
        console.log('Attendance created:', attendance.id);
      }
    } else {
      console.log('Creating today shift and assignment...');
      
      // Create today's shift
      const shift = await prisma.shift.create({
        data: {
          organizationId: johnSmith.organizationId,
          title: 'Healthcare Support Worker',
          siteLocation: 'Test Hospital - Emergency Ward',
          startAt: new Date(today.setHours(9, 0, 0, 0)),
          endAt: new Date(today.setHours(17, 0, 0, 0)),
          breakMinutes: 60,
          hourlyRate: 16.00,
          role: 'Healthcare Support Worker',
          notes: 'Emergency ward duty - critical shift',
          createdBy: johnSmith.id,
        }
      });
      
      console.log('Shift created:', shift.id);
      
      // Create assignment
      const assignment = await prisma.shiftAssignment.create({
        data: {
          shiftId: shift.id,
          workerId: johnSmith.id,
          status: 'ACCEPTED',
          assignedAt: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
        }
      });
      
      console.log('Assignment created:', assignment.id);
      
      // Create attendance
      const clockInTime = new Date();
      clockInTime.setHours(8, 55, 0, 0);
      
      const attendance = await prisma.attendance.create({
        data: {
          shiftId: shift.id,
          workerId: johnSmith.id,
          clockInAt: clockInTime,
          status: 'PENDING',
        }
      });
      
      console.log('Attendance created:', attendance.id);
    }

    console.log('Production today shift fixed!');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixProductionTodayShift();
