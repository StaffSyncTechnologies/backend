import { PrismaClient, ShiftStatus, ShiftPriority, LeaveType, LeaveStatus, PayslipStatus, PayPeriodStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding worker: oluwasuyibabayomi@gmail.com ...');

  const bcryptModule = await import('bcryptjs');
  const bcrypt = bcryptModule.default || bcryptModule;

  // Get existing org and admin
  const organization = await prisma.organization.findFirst();
  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const opsManager = await prisma.user.findFirst({ where: { role: 'OPS_MANAGER' } });
  const shiftCoordinator = await prisma.user.findFirst({ where: { role: 'SHIFT_COORDINATOR' } });

  if (!organization || !adminUser) {
    console.error('❌ No organization or admin found. Run the main seed first.');
    process.exit(1);
  }

  // Get existing clients
  const clients = await prisma.clientCompany.findMany({
    where: { organizationId: organization.id },
  });

  if (clients.length === 0) {
    console.error('❌ No clients found. Run the main seed first.');
    process.exit(1);
  }

  // Get existing pay periods
  const payPeriods = await prisma.payPeriod.findMany({
    where: { organizationId: organization.id },
    orderBy: { startDate: 'desc' },
  });

  // Create the worker
  const workerPassword = await bcrypt.hash('Worker123!', 10);

  const worker = await prisma.user.upsert({
    where: {
      organizationId_email: {
        organizationId: organization.id,
        email: 'oluwasuyibabayomi@gmail.com',
      },
    },
    update: {},
    create: {
      email: 'oluwasuyibabayomi@gmail.com',
      passwordHash: workerPassword,
      fullName: 'Babayomi Oluwasu',
      role: 'WORKER',
      status: 'ACTIVE',
      organizationId: organization.id,
      emailVerified: true,
      phone: '+44 7700 200001',
      niNumber: 'BO123456A',
      managerId: shiftCoordinator?.id || null,
    },
  });
  console.log(`✅ Created worker: ${worker.fullName} (${worker.email}) / Worker123!`);

  // Worker profile
  await prisma.workerProfile.upsert({
    where: { userId: worker.id },
    update: {},
    create: {
      userId: worker.id,
      address: '45 Camden Road, London',
      postcode: 'NW1 9LR',
      dateOfBirth: new Date('1995-05-15'),
      emergencyContact: 'Yomi Oluwasu',
      emergencyPhone: '+44 7700 200002',
      rtwStatus: 'APPROVED',
      onboardingStatus: 'COMPLETE',
      shiftPreference: 'FLEXIBLE',
      weekendAvailable: true,
      maxTravelDistance: 30,
      hourlyRate: 13.00,
      holidayBalance: 28,
    },
  });
  console.log('✅ Created worker profile');

  // Leave entitlement
  await prisma.leaveEntitlement.upsert({
    where: { workerId_year: { workerId: worker.id, year: 2026 } },
    update: {},
    create: {
      workerId: worker.id,
      contractedHours: 40,
      totalHours: 224,
      usedHours: 16,
      carryOverHours: 0,
      year: 2026,
    },
  });
  console.log('✅ Created leave entitlement');

  // Assign worker skills
  const skills = await prisma.skill.findMany({ take: 5 });
  for (const skill of skills) {
    await prisma.workerSkill.upsert({
      where: { workerId_skillId: { workerId: worker.id, skillId: skill.id } },
      update: {},
      create: {
        workerId: worker.id,
        skillId: skill.id,
      },
    });
  }
  console.log(`✅ Assigned ${skills.length} skills`);

  // ── TODAY'S SHIFT (upcoming, assigned) ──
  const now = new Date();
  const todayShiftStart = new Date(now);
  todayShiftStart.setHours(14, 0, 0, 0);
  const todayShiftEnd = new Date(now);
  todayShiftEnd.setHours(22, 0, 0, 0);

  const todayShift = await prisma.shift.create({
    data: {
      title: 'Warehouse Operative - Afternoon',
      siteLocation: 'Amazon Fulfilment Centre, Manchester',
      startAt: todayShiftStart,
      endAt: todayShiftEnd,
      workersNeeded: 3,
      payRate: 13.00,
      status: ShiftStatus.FILLED,
      priority: ShiftPriority.NORMAL,
      notes: 'Steel toe boots required.',
      organizationId: organization.id,
      createdBy: adminUser.id,
      clientCompanyId: clients[0].id,
    },
  });
  await prisma.shiftAssignment.create({
    data: {
      shiftId: todayShift.id,
      workerId: worker.id,
      status: 'ACCEPTED',
      assignedAt: new Date(now.getTime() - 2 * 86400000),
      acceptedAt: new Date(now.getTime() - 86400000),
    },
  });
  console.log('✅ Created today\'s shift (assigned)');

  // ── TOMORROW SHIFT ──
  const tomorrowStart = new Date(now);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  tomorrowStart.setHours(7, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setHours(15, 0, 0, 0);

  const tomorrowShift = await prisma.shift.create({
    data: {
      title: 'Healthcare Support Worker',
      siteLocation: 'St Mary Hospital, Birmingham',
      startAt: tomorrowStart,
      endAt: tomorrowEnd,
      workersNeeded: 2,
      payRate: 14.00,
      status: ShiftStatus.FILLED,
      priority: ShiftPriority.HIGH,
      notes: 'DBS check required. Dementia care experience preferred.',
      organizationId: organization.id,
      createdBy: adminUser.id,
      clientCompanyId: clients[1]?.id || clients[0].id,
    },
  });
  await prisma.shiftAssignment.create({
    data: {
      shiftId: tomorrowShift.id,
      workerId: worker.id,
      status: 'ACCEPTED',
      assignedAt: new Date(now.getTime() - 86400000),
      acceptedAt: new Date(),
    },
  });
  console.log('✅ Created tomorrow\'s shift (assigned)');

  // ── 3 DAYS FROM NOW ──
  const in3DaysStart = new Date(now);
  in3DaysStart.setDate(in3DaysStart.getDate() + 3);
  in3DaysStart.setHours(18, 0, 0, 0);
  const in3DaysEnd = new Date(in3DaysStart);
  in3DaysEnd.setHours(23, 30, 0, 0);

  const in3DaysShift = await prisma.shift.create({
    data: {
      title: 'Event Security - Evening',
      siteLocation: 'O2 Arena, London',
      startAt: in3DaysStart,
      endAt: in3DaysEnd,
      workersNeeded: 5,
      payRate: 15.00,
      status: ShiftStatus.FILLED,
      priority: ShiftPriority.URGENT,
      notes: 'SIA badge mandatory. Black suit required.',
      organizationId: organization.id,
      createdBy: adminUser.id,
      clientCompanyId: clients[2]?.id || clients[0].id,
    },
  });
  await prisma.shiftAssignment.create({
    data: {
      shiftId: in3DaysShift.id,
      workerId: worker.id,
      status: 'ACCEPTED',
      assignedAt: new Date(),
      acceptedAt: new Date(),
    },
  });
  console.log('✅ Created shift in 3 days (assigned)');

  // ── NEXT WEEK SHIFT ──
  const nextWeekStart = new Date(now);
  nextWeekStart.setDate(nextWeekStart.getDate() + 7);
  nextWeekStart.setHours(6, 0, 0, 0);
  const nextWeekEnd = new Date(nextWeekStart);
  nextWeekEnd.setHours(14, 0, 0, 0);

  const nextWeekShift = await prisma.shift.create({
    data: {
      title: 'Warehouse Loading - Early Morning',
      siteLocation: 'DHL Distribution Centre, Bristol',
      startAt: nextWeekStart,
      endAt: nextWeekEnd,
      workersNeeded: 4,
      payRate: 13.50,
      status: ShiftStatus.FILLED,
      priority: ShiftPriority.NORMAL,
      notes: 'Heavy lifting. PPE provided.',
      organizationId: organization.id,
      createdBy: adminUser.id,
      clientCompanyId: clients[3]?.id || clients[0].id,
    },
  });
  await prisma.shiftAssignment.create({
    data: {
      shiftId: nextWeekShift.id,
      workerId: worker.id,
      status: 'ASSIGNED',
      assignedAt: new Date(),
    },
  });
  console.log('✅ Created next week shift (pending acceptance)');

  // ── COMPLETED SHIFTS (past, with attendance) ──
  const completedShiftsData = [
    {
      title: 'Warehouse Pick & Pack',
      siteLocation: 'Amazon Fulfilment Centre, Manchester',
      daysAgo: 2,
      startHour: 8, endHour: 16,
      payRate: 13.00,
      clientIndex: 0,
    },
    {
      title: 'Healthcare Support - Day',
      siteLocation: 'St Mary Hospital, Birmingham',
      daysAgo: 4,
      startHour: 7, endHour: 15,
      payRate: 14.00,
      clientIndex: 1,
    },
    {
      title: 'Office Deep Clean',
      siteLocation: 'TechHub Office, London',
      daysAgo: 7,
      startHour: 18, endHour: 22,
      payRate: 11.50,
      clientIndex: 3,
    },
    {
      title: 'Security Night Shift',
      siteLocation: 'Metro Shopping Centre, Birmingham',
      daysAgo: 9,
      startHour: 22, endHour: 6,
      payRate: 15.00,
      clientIndex: 2,
    },
    {
      title: 'Warehouse Morning Shift',
      siteLocation: 'Acme Warehouse, Manchester',
      daysAgo: 11,
      startHour: 6, endHour: 14,
      payRate: 12.50,
      clientIndex: 0,
    },
    {
      title: 'Restaurant Server - Evening',
      siteLocation: 'The Ivy, Manchester',
      daysAgo: 14,
      startHour: 17, endHour: 23,
      payRate: 13.00,
      clientIndex: 0,
    },
  ];

  for (const sd of completedShiftsData) {
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - sd.daysAgo);
    startDate.setHours(sd.startHour, 0, 0, 0);

    const endDate = new Date(startDate);
    if (sd.endHour < sd.startHour) {
      endDate.setDate(endDate.getDate() + 1);
    }
    endDate.setHours(sd.endHour, 0, 0, 0);

    const shift = await prisma.shift.create({
      data: {
        title: sd.title,
        siteLocation: sd.siteLocation,
        startAt: startDate,
        endAt: endDate,
        workersNeeded: 2,
        payRate: sd.payRate,
        status: ShiftStatus.COMPLETED,
        priority: ShiftPriority.NORMAL,
        organizationId: organization.id,
        createdBy: adminUser.id,
        clientCompanyId: clients[sd.clientIndex]?.id || clients[0].id,
      },
    });

    await prisma.shiftAssignment.create({
      data: {
        shiftId: shift.id,
        workerId: worker.id,
        status: 'ACCEPTED',
        assignedAt: new Date(startDate.getTime() - 2 * 86400000),
        acceptedAt: new Date(startDate.getTime() - 86400000),
      },
    });

    // Attendance record
    const clockIn = new Date(startDate);
    clockIn.setMinutes(clockIn.getMinutes() - 5);
    const clockOut = new Date(endDate);
    clockOut.setMinutes(clockOut.getMinutes() + 2);
    const hoursWorked = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);

    await prisma.attendance.create({
      data: {
        shiftId: shift.id,
        workerId: worker.id,
        clockInAt: clockIn,
        clockOutAt: clockOut,
        hoursWorked,
        status: sd.daysAgo <= 3 ? 'PENDING' : 'APPROVED',
        geofenceValid: true,
      },
    });
  }
  console.log(`✅ Created ${completedShiftsData.length} completed shifts with attendance`);

  // ── PAYSLIPS ──
  if (payPeriods.length >= 2) {
    // Paid payslip (older period)
    const closedPeriod = payPeriods.find(p => p.status === 'CLOSED') || payPeriods[payPeriods.length - 1];
    await prisma.payslip.create({
      data: {
        payPeriodId: closedPeriod.id,
        workerId: worker.id,
        grossPay: 1690.00,
        netPay: 1395.00,
        totalHours: 130,
        hourlyRate: 13.00,
        taxDeduction: 215.00,
        niEmployee: 80.00,
        status: PayslipStatus.PAID,
        approvedBy: adminUser.id,
        paidAt: new Date(closedPeriod.endDate.getTime() + 3 * 86400000),
      },
    });
    console.log('✅ Created PAID payslip');

    // Draft payslip (current period)
    const openPeriod = payPeriods.find(p => p.status === 'OPEN') || payPeriods[0];
    await prisma.payslip.create({
      data: {
        payPeriodId: openPeriod.id,
        workerId: worker.id,
        grossPay: 520.00,
        netPay: 439.50,
        totalHours: 40,
        hourlyRate: 13.00,
        taxDeduction: 56.00,
        niEmployee: 24.50,
        otherDeductions: 520.00 * 0.04,
        status: PayslipStatus.DRAFT,
      },
    });
    console.log('✅ Created DRAFT payslip');

    // Approved payslip (processing period)
    const processingPeriod = payPeriods.find(p => p.status === 'PROCESSING');
    if (processingPeriod) {
      await prisma.payslip.create({
        data: {
          payPeriodId: processingPeriod.id,
          workerId: worker.id,
          grossPay: 487.50,
          netPay: 412.00,
          totalHours: 37.5,
          hourlyRate: 13.00,
          taxDeduction: 52.50,
          niEmployee: 23.00,
          otherDeductions: 487.50 * 0.04,
          status: PayslipStatus.APPROVED,
          approvedBy: adminUser.id,
        },
      });
      console.log('✅ Created APPROVED payslip');
    }
  }

  // ── LEAVE REQUESTS ──
  await prisma.leaveRequest.createMany({
    data: [
      {
        workerId: worker.id,
        leaveType: LeaveType.ANNUAL,
        title: 'Easter Holiday',
        startDate: new Date('2026-04-03'),
        endDate: new Date('2026-04-10'),
        totalDays: 5,
        totalHours: 40,
        reason: 'Easter family reunion',
        status: LeaveStatus.APPROVED,
        reviewedBy: opsManager?.id || adminUser.id,
      },
      {
        workerId: worker.id,
        leaveType: LeaveType.ANNUAL,
        title: 'Summer Break',
        startDate: new Date('2026-08-10'),
        endDate: new Date('2026-08-21'),
        totalDays: 9,
        totalHours: 72,
        reason: 'Summer vacation',
        status: LeaveStatus.PENDING,
      },
      {
        workerId: worker.id,
        leaveType: LeaveType.SICK,
        title: 'Sick Day',
        startDate: new Date('2026-02-20'),
        endDate: new Date('2026-02-20'),
        totalDays: 1,
        totalHours: 8,
        reason: 'Feeling unwell',
        status: LeaveStatus.APPROVED,
        reviewedBy: opsManager?.id || adminUser.id,
      },
    ],
  });
  console.log('✅ Created 3 leave requests');

  // ── NOTIFICATIONS ──
  await prisma.notification.createMany({
    data: [
      {
        organizationId: organization.id,
        userId: worker.id,
        type: 'SHIFT_ASSIGNED',
        channel: 'IN_APP',
        title: 'New Shift Assigned',
        message: `You have been assigned to "Warehouse Operative - Afternoon" today at 2:00 PM.`,
        referenceType: 'SHIFT',
        status: 'DELIVERED',
        createdAt: new Date(now.getTime() - 30 * 60 * 1000),
      },
      {
        organizationId: organization.id,
        userId: worker.id,
        type: 'SHIFT_ALERT',
        channel: 'IN_APP',
        title: 'Shift Reminder',
        message: `Your shift at St Mary Hospital starts tomorrow at 7:00 AM.`,
        referenceType: 'SHIFT',
        status: 'DELIVERED',
        createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      },
      {
        organizationId: organization.id,
        userId: worker.id,
        type: 'PAYSLIP_READY',
        channel: 'IN_APP',
        title: 'Payslip Ready',
        message: 'Your payslip for last month is now available to view.',
        referenceType: 'PAYROLL',
        status: 'DELIVERED',
        createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
      {
        organizationId: organization.id,
        userId: worker.id,
        type: 'HOLIDAY_REQUEST',
        channel: 'IN_APP',
        title: 'Holiday Approved',
        message: 'Your Easter Holiday request (3-10 April) has been approved.',
        referenceType: 'HOLIDAY',
        status: 'DELIVERED',
        createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        readAt: new Date(),
      },
      {
        organizationId: organization.id,
        userId: worker.id,
        type: 'SYSTEM',
        channel: 'IN_APP',
        title: 'Welcome to StaffSync!',
        message: 'Your account is set up. You can now view shifts, track hours, and manage your schedule.',
        referenceType: 'SYSTEM',
        status: 'DELIVERED',
        createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        readAt: new Date(),
      },
    ],
  });
  console.log('✅ Created 5 notifications');

  console.log('\n🎉 Worker seeding complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📧 Email:    oluwasuyibabayomi@gmail.com`);
  console.log(`🔑 Password: Worker123!`);
  console.log(`👤 Name:     ${worker.fullName}`);
  console.log(`📅 Shifts:   4 upcoming + 6 completed`);
  console.log(`💰 Payslips: 3 (paid, approved, draft)`);
  console.log(`🏖️ Leave:    3 requests`);
  console.log(`🔔 Notifs:   5`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
