import { PrismaClient, ShiftStatus, ShiftPriority, LeaveType, LeaveStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const workerEmail = 'oluwasuyibabayomi@gmail.com';
  const worker = await prisma.user.findFirst({ where: { email: workerEmail } });
  if (!worker) {
    console.log('Worker not found:', workerEmail);
    return;
  }
  console.log('Found worker:', worker.id, worker.fullName);

  const org = await prisma.organization.findFirst();
  if (!org) { console.log('No org found'); return; }

  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN', organizationId: org.id } });
  if (!admin) { console.log('No admin found'); return; }

  const client = await prisma.clientCompany.findFirst({ where: { organizationId: org.id } });

  // Create today's shift
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(10, 30, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(13, 0, 0, 0);

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStart = new Date(tomorrow);
  tomorrowStart.setHours(18, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setHours(20, 0, 0, 0);

  const day3 = new Date(now);
  day3.setDate(day3.getDate() + 3);
  const day3Start = new Date(day3);
  day3Start.setHours(7, 0, 0, 0);
  const day3End = new Date(day3);
  day3End.setHours(15, 0, 0, 0);

  const day5 = new Date(now);
  day5.setDate(day5.getDate() + 5);
  const day5Start = new Date(day5);
  day5Start.setHours(16, 0, 0, 0);
  const day5End = new Date(day5);
  day5End.setHours(23, 30, 0, 0);

  const shiftsData = [
    { title: 'Warehouse Operative', siteLocation: 'New York, London', startAt: todayStart, endAt: todayEnd, payRate: 10.00 },
    { title: 'Warehouse Operative', siteLocation: 'New York, London', startAt: tomorrowStart, endAt: tomorrowEnd, payRate: 12.50 },
    { title: 'Healthcare Support Worker', siteLocation: 'St Mary Hospital, Birmingham', startAt: day3Start, endAt: day3End, payRate: 14.00 },
    { title: 'Event Security', siteLocation: 'O2 Arena, London', startAt: day5Start, endAt: day5End, payRate: 15.00 },
  ];

  for (const s of shiftsData) {
    const shift = await prisma.shift.create({
      data: {
        title: s.title,
        siteLocation: s.siteLocation,
        startAt: s.startAt,
        endAt: s.endAt,
        workersNeeded: 3,
        payRate: s.payRate,
        status: ShiftStatus.FILLED,
        priority: ShiftPriority.NORMAL,
        organizationId: org.id,
        createdBy: admin.id,
        clientCompanyId: client?.id || null,
      },
    });
    await prisma.shiftAssignment.create({
      data: {
        shiftId: shift.id,
        workerId: worker.id,
        status: 'ACCEPTED',
        assignedAt: new Date(s.startAt.getTime() - 2 * 86400000),
        acceptedAt: new Date(s.startAt.getTime() - 86400000),
      },
    });
    console.log('Created shift:', s.title, s.startAt.toISOString());
  }

  // Ensure worker profile exists with holiday balance
  const profile = await prisma.workerProfile.findUnique({ where: { userId: worker.id } });
  if (!profile) {
    await prisma.workerProfile.create({
      data: {
        userId: worker.id,
        address: '123 Worker Street, London',
        postcode: 'SW1A 1AA',
        dateOfBirth: new Date('1995-01-01'),
        rtwStatus: 'APPROVED',
        onboardingStatus: 'COMPLETE',
        holidayBalance: 28,
      },
    });
    console.log('Created worker profile');
  } else {
    await prisma.workerProfile.update({ where: { userId: worker.id }, data: { holidayBalance: 28 } });
    console.log('Updated holiday balance to 28');
  }

  // Create leave requests
  await prisma.leaveRequest.createMany({
    data: [
      {
        workerId: worker.id,
        leaveType: LeaveType.ANNUAL,
        title: 'Summer Holiday',
        startDate: new Date('2026-07-15'),
        endDate: new Date('2026-07-22'),
        totalDays: 5,
        totalHours: 40,
        reason: 'Family vacation',
        status: LeaveStatus.APPROVED,
        reviewedBy: admin.id,
      },
      {
        workerId: worker.id,
        leaveType: LeaveType.ANNUAL,
        title: 'Christmas Break',
        startDate: new Date('2026-12-23'),
        endDate: new Date('2026-12-31'),
        totalDays: 5,
        totalHours: 40,
        reason: 'Christmas with family',
        status: LeaveStatus.PENDING,
      },
    ],
  });
  console.log('Created 2 leave requests');

  // Create leave entitlement
  await prisma.leaveEntitlement.upsert({
    where: { workerId_year: { workerId: worker.id, year: 2026 } },
    update: {},
    create: {
      workerId: worker.id,
      contractedHours: 40,
      totalHours: 224,
      usedHours: 0,
      carryOverHours: 0,
      year: 2026,
    },
  });
  console.log('Created leave entitlement');

  console.log('✅ Done! Homepage data seeded for', workerEmail);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
