import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedWorkerHomepage() {
  try {
    console.log('Seeding homepage data for John Smith...');

    // Find John Smith
    const johnSmith = await prisma.user.findFirst({
      where: { email: 'john.smith@test.com' },
      include: { organization: true }
    });

    if (!johnSmith) {
      console.log('John Smith not found');
      return;
    }

    console.log('Found John Smith:', johnSmith.fullName);

    // Create today's shift
    const today = new Date();
    today.setHours(9, 0, 0, 0);
    
    const shiftEnd = new Date(today);
    shiftEnd.setHours(17, 0, 0, 0);

    const shift = await prisma.shift.create({
      data: {
        organizationId: johnSmith.organizationId,
        title: 'Healthcare Support Worker',
        siteLocation: 'Test Hospital',
        startAt: today,
        endAt: shiftEnd,
        breakMinutes: 60,
        hourlyRate: 15.50,
        role: 'Healthcare Support Worker',
        notes: 'Regular shift at Test Hospital',
        createdBy: johnSmith.id,
      }
    });
    console.log('Created today shift:', shift.id);

    // Create upcoming shifts
    for (let i = 1; i <= 5; i++) {
      const shiftDate = new Date();
      shiftDate.setDate(shiftDate.getDate() + i);
      shiftDate.setHours(9, 0, 0, 0);

      if (shiftDate.getDay() === 0 || shiftDate.getDay() === 6) continue; // Skip weekends

      await prisma.shift.create({
        data: {
          organizationId: johnSmith.organizationId,
          title: 'Healthcare Support Worker',
          siteLocation: 'Test Hospital',
          startAt: shiftDate,
          endAt: new Date(shiftDate.getTime() + 8 * 60 * 60 * 1000),
          breakMinutes: 60,
          hourlyRate: 15.50,
          role: 'Healthcare Support Worker',
          notes: 'Upcoming shift',
          createdBy: johnSmith.id,
        }
      });
    }
    console.log('Created upcoming shifts');

    // Create attendance for yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    await prisma.attendance.create({
      data: {
        shiftId: shift.id,
        workerId: johnSmith.id,
        clockInAt: new Date(yesterday.setHours(8, 55, 0, 0)),
        clockOutAt: new Date(yesterday.setHours(17, 5, 0, 0)),
        status: 'APPROVED',
      }
    });
    console.log('Created attendance');

    // Create notifications
    await prisma.notification.createMany({
      data: [
        {
          organizationId: johnSmith.organizationId,
          userId: johnSmith.id,
          type: 'SHIFT_ASSIGNED',
          channel: 'PUSH',
          title: 'New Shift Assigned',
          message: 'You have been assigned to a shift tomorrow at Test Hospital',
          createdAt: new Date(),
        },
        {
          organizationId: johnSmith.organizationId,
          userId: johnSmith.id,
          type: 'PAYSLIP_AVAILABLE',
          channel: 'PUSH',
          title: 'Payslip Available',
          message: 'Your payslip for last week is now available',
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        }
      ]
    });
    console.log('Created notifications');

    console.log('Homepage data seeded successfully for John Smith!');

  } catch (error) {
    console.error('Error seeding homepage data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedWorkerHomepage();
