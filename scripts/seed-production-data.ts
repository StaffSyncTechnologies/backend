import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedProductionData() {
  try {
    console.log('Seeding production data for John Smith...');

    // Find John Smith
    const johnSmith = await prisma.user.findFirst({
      where: { email: 'john.smith@test.com' },
      include: { organization: true }
    });

    if (!johnSmith) {
      console.log('John Smith not found in production');
      return;
    }

    console.log('Found John Smith:', johnSmith.fullName);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Create today's shift
    const todayShift = await prisma.shift.create({
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

    // Create assignment for today's shift
    await prisma.shiftAssignment.create({
      data: {
        shiftId: todayShift.id,
        workerId: johnSmith.id,
        status: 'ACCEPTED',
        assignedAt: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
      }
    });

    // Create attendance (clocked in, not clocked out)
    const clockInTime = new Date();
    clockInTime.setHours(8, 55, 0, 0);

    await prisma.attendance.create({
      data: {
        shiftId: todayShift.id,
        workerId: johnSmith.id,
        clockInAt: clockInTime,
        status: 'PENDING',
      }
    });

    console.log('Created today shift for production:', todayShift.id);

    // Create upcoming shifts
    for (let i = 1; i <= 5; i++) {
      const shiftDate = new Date();
      shiftDate.setDate(today.getDate() + i);
      
      if (shiftDate.getDay() === 0 || shiftDate.getDay() === 6) continue;

      const shift = await prisma.shift.create({
        data: {
          organizationId: johnSmith.organizationId,
          title: 'Healthcare Support Worker',
          siteLocation: 'Test Hospital',
          startAt: new Date(shiftDate.setHours(9, 0, 0, 0)),
          endAt: new Date(shiftDate.setHours(17, 0, 0, 0)),
          breakMinutes: 60,
          hourlyRate: 15.50,
          role: 'Healthcare Support Worker',
          notes: 'Regular shift',
          createdBy: johnSmith.id,
        }
      });

      await prisma.shiftAssignment.create({
        data: {
          shiftId: shift.id,
          workerId: johnSmith.id,
          status: 'ACCEPTED',
          assignedAt: new Date(shiftDate.getTime() - 7 * 24 * 60 * 60 * 1000),
        }
      });
    }

    // Create notifications
    await prisma.notification.createMany({
      data: [
        {
          organizationId: johnSmith.organizationId,
          userId: johnSmith.id,
          type: 'SHIFT_STARTED',
          channel: 'PUSH' as any,
          title: 'Shift Started',
          message: 'Your shift at Test Hospital - Emergency Ward has started.',
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        },
        {
          organizationId: johnSmith.organizationId,
          userId: johnSmith.id,
          type: 'PAYSLIP_AVAILABLE',
          channel: 'PUSH' as any,
          title: 'Payslip Available',
          message: 'Your payslip for last week is now available.',
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        }
      ]
    });

    console.log('Production data seeded successfully for John Smith!');

  } catch (error) {
    console.error('Error seeding production data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedProductionData();
