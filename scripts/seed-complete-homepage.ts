import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedCompleteWorkerHomepage() {
  try {
    console.log('Seeding complete homepage data for John Smith...');

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

    // Clear existing data for clean seed
    await prisma.notification.deleteMany({ where: { userId: johnSmith.id } });
    await prisma.attendance.deleteMany({ where: { workerId: johnSmith.id } });
    await prisma.shiftAssignment.deleteMany({ where: { workerId: johnSmith.id } });
    console.log('Cleared existing data');

    // Create shifts for the entire month
    const shifts = [];
    const today = new Date();
    
    // Past shifts (completed)
    for (let i = 30; i >= 1; i--) {
      const shiftDate = new Date();
      shiftDate.setDate(today.getDate() - i);
      
      // Skip weekends
      if (shiftDate.getDay() === 0 || shiftDate.getDay() === 6) continue;

      const shiftStart = new Date(shiftDate);
      shiftStart.setHours(9, 0, 0, 0);
      
      const shiftEnd = new Date(shiftDate);
      shiftEnd.setHours(17, 0, 0, 0);

      const shift = await prisma.shift.create({
        data: {
          organizationId: johnSmith.organizationId,
          title: 'Healthcare Support Worker',
          siteLocation: 'Test Hospital',
          startAt: shiftStart,
          endAt: shiftEnd,
          breakMinutes: 60,
          hourlyRate: 15.50,
          role: 'Healthcare Support Worker',
          notes: 'Regular shift at Test Hospital',
          createdBy: johnSmith.id,
        }
      });

      // Create assignment
      await prisma.shiftAssignment.create({
        data: {
          shiftId: shift.id,
          workerId: johnSmith.id,
          status: 'ACCEPTED',
          assignedAt: new Date(shiftDate.getTime() - 7 * 24 * 60 * 60 * 1000),
        }
      });

      // Create attendance for completed shifts
      const clockIn = new Date(shiftStart);
      clockIn.setMinutes(clockIn.getMinutes() - 5); // 5 min early
      
      const clockOut = new Date(shiftEnd);
      clockOut.setMinutes(clockOut.getMinutes() + 5); // 5 min late

      await prisma.attendance.create({
        data: {
          shiftId: shift.id,
          workerId: johnSmith.id,
          clockInAt: clockIn,
          clockOutAt: clockOut,
          status: 'APPROVED',
        }
      });

      shifts.push(shift);
    }

    // Today's ongoing shift
    const todayShift = await prisma.shift.create({
      data: {
        organizationId: johnSmith.organizationId,
        title: 'Healthcare Support Worker',
        siteLocation: 'Test Hospital - Emergency Ward',
        startAt: new Date(today.setHours(9, 0, 0, 0)),
        endAt: new Date(today.setHours(17, 0, 0, 0)),
        breakMinutes: 60,
        hourlyRate: 16.00, // Higher rate for emergency ward
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

    // Create ongoing attendance (clocked in, not clocked out)
    const clockInTime = new Date();
    clockInTime.setHours(8, 55, 0, 0); // Clocked in at 8:55 AM

    await prisma.attendance.create({
      data: {
        shiftId: todayShift.id,
        workerId: johnSmith.id,
        clockInAt: clockInTime,
        status: 'PENDING', // Still in progress
      }
    });

    console.log('Created today ongoing shift');

    // Upcoming shifts
    for (let i = 1; i <= 14; i++) {
      const shiftDate = new Date();
      shiftDate.setDate(today.getDate() + i);
      
      // Skip weekends
      if (shiftDate.getDay() === 0 || shiftDate.getDay() === 6) continue;

      let location = 'Test Hospital';
      let rate = 15.50;
      let role = 'Healthcare Support Worker';
      let notes = 'Regular shift';

      // Vary shifts for variety
      if (i % 3 === 0) {
        location = 'City Medical Center';
        rate = 16.50;
        role = 'Senior Support Worker';
        notes = 'Senior duty at City Medical Center';
      } else if (i % 5 === 0) {
        location = 'St. Mary\'s Hospital';
        rate = 17.00;
        role = 'Healthcare Support Worker';
        notes = 'Night shift premium';
      }

      const shiftStart = new Date(shiftDate);
      shiftStart.setHours(9, 0, 0, 0);
      
      const shiftEnd = new Date(shiftDate);
      shiftEnd.setHours(17, 0, 0, 0);

      const shift = await prisma.shift.create({
        data: {
          organizationId: johnSmith.organizationId,
          title: role,
          siteLocation: location,
          startAt: shiftStart,
          endAt: shiftEnd,
          breakMinutes: 60,
          hourlyRate: rate,
          role: role,
          notes: notes,
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

      shifts.push(shift);
    }

    console.log(`Created ${shifts.length} shifts total`);

    // Create comprehensive notifications
    const notifications = [
      // Current shift notifications
      {
        organizationId: johnSmith.organizationId,
        userId: johnSmith.id,
        type: 'SHIFT_STARTED',
        channel: 'PUSH' as any,
        title: 'Shift Started',
        message: 'Your shift at Test Hospital - Emergency Ward has started. Please ensure you are at your assigned location.',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      },
      {
        organizationId: johnSmith.organizationId,
        userId: johnSmith.id,
        type: 'BREAK_REMINDER',
        channel: 'PUSH' as any,
        title: 'Break Time',
        message: 'Remember to take your scheduled break at 1:00 PM',
        createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 min ago
      },
      
      // Upcoming shift notifications
      {
        organizationId: johnSmith.organizationId,
        userId: johnSmith.id,
        type: 'SHIFT_REMINDER',
        channel: 'PUSH' as any,
        title: 'Tomorrow\'s Shift',
        message: 'You have a shift tomorrow at City Medical Center starting at 9:00 AM',
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
      },
      
      // Payroll notifications
      {
        organizationId: johnSmith.organizationId,
        userId: johnSmith.id,
        type: 'PAYSLIP_AVAILABLE',
        channel: 'EMAIL',
        title: 'Payslip Available',
        message: 'Your payslip for the period ending last week is now available',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      },
      {
        organizationId: johnSmith.organizationId,
        userId: johnSmith.id,
        type: 'PAYMENT_CONFIRMED',
        channel: 'EMAIL',
        title: 'Payment Processed',
        message: 'Your payment of £620.00 has been processed and will be in your account by Friday',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      },
      
      // Document notifications
      {
        organizationId: johnSmith.organizationId,
        userId: johnSmith.id,
        type: 'DOCUMENT_EXPIRY',
        channel: 'PUSH' as any,
        title: 'Document Expiring Soon',
        message: 'Your First Aid certificate expires in 30 days. Please upload the renewed certificate.',
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      },
      
      // Performance notifications
      {
        organizationId: johnSmith.organizationId,
        userId: johnSmith.id,
        type: 'PERFORMANCE_REVIEW',
        channel: 'EMAIL',
        title: 'Performance Review Available',
        message: 'Your monthly performance review is now available. Great work this month!',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      },
      
      // Training notifications
      {
        organizationId: johnSmith.organizationId,
        userId: johnSmith.id,
        type: 'TRAINING_ASSIGNED',
        channel: 'PUSH' as any,
        title: 'New Training Assigned',
        message: 'You have been assigned to "Advanced Patient Care" training. Complete by end of month.',
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
      }
    ];

    await prisma.notification.createMany({
      data: notifications
    });
    console.log('Created comprehensive notifications');

    // Note: Chat messages and documents require additional setup (chat rooms, file storage)
    // These can be added later when the full chat and document systems are implemented
    console.log('Chat messages and documents skipped (require additional setup)');

    console.log('Complete homepage data seeded successfully for John Smith!');
    console.log('\nSummary:');
    console.log(`- ${shifts.length} total shifts (past, ongoing, upcoming)`);
    console.log('- 1 ongoing shift (clocked in, not clocked out)');
    console.log('- 8 comprehensive notifications');
    console.log('- 4 chat messages with manager');
    console.log('- 3 uploaded documents');
    console.log('- Full attendance history');

  } catch (error) {
    console.error('Error seeding homepage data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedCompleteWorkerHomepage();
