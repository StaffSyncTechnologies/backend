import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const workerEmail = 'oluwasuyibabayomi@gmail.com';
  const worker = await prisma.user.findFirst({ where: { email: workerEmail } });
  if (!worker) { console.log('Worker not found'); return; }
  console.log('Found worker:', worker.id, worker.fullName);

  // 1. Fix RTW status so shifts list is visible
  const profile = await prisma.workerProfile.findUnique({ where: { userId: worker.id } });
  if (profile) {
    await prisma.workerProfile.update({
      where: { userId: worker.id },
      data: { rtwStatus: 'APPROVED', onboardingStatus: 'COMPLETE' },
    });
    console.log('✅ Updated RTW status to APPROVED');
  } else {
    await prisma.workerProfile.create({
      data: {
        userId: worker.id,
        address: '123 Worker Street',
        postcode: 'SW1A 1AA',
        dateOfBirth: new Date('1995-01-01'),
        rtwStatus: 'APPROVED',
        onboardingStatus: 'COMPLETE',
        holidayBalance: 28,
      },
    });
    console.log('✅ Created worker profile with RTW APPROVED');
  }

  // 2. Also assign a manager so shifts from manager's clients are visible
  const manager = await prisma.user.findFirst({
    where: { role: { in: ['OPS_MANAGER', 'SHIFT_COORDINATOR'] }, organizationId: worker.organizationId },
  });
  if (manager) {
    await prisma.user.update({ where: { id: worker.id }, data: { managerId: manager.id } });
    console.log('✅ Assigned manager:', manager.fullName);
  }

  // 3. Seed payslips for this worker
  const org = await prisma.organization.findFirst({ where: { id: worker.organizationId } });
  if (!org) { console.log('No org'); return; }

  // Find existing pay periods
  const payPeriods = await prisma.payPeriod.findMany({
    where: { organizationId: org.id },
    orderBy: { startDate: 'desc' },
    take: 4,
  });

  if (payPeriods.length === 0) {
    console.log('No pay periods found, creating some...');
    // Create pay periods for last 4 weeks
    const now = new Date();
    for (let i = 0; i < 4; i++) {
      const end = new Date(now);
      end.setDate(end.getDate() - (i * 7));
      end.setHours(23, 59, 59, 999);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);

      const pp = await prisma.payPeriod.create({
        data: {
          organizationId: org.id,
          periodType: 'WEEKLY',
          startDate: start,
          endDate: end,
          status: i === 0 ? 'OPEN' : 'CLOSED',
        },
      });
      payPeriods.push(pp);
    }
    console.log('✅ Created', payPeriods.length, 'pay periods');
  }

  // Create payslips for the worker
  let created = 0;
  for (let i = 0; i < Math.min(payPeriods.length, 4); i++) {
    const pp = payPeriods[i];
    const existing = await prisma.payslip.findFirst({
      where: { workerId: worker.id, payPeriodId: pp.id },
    });
    if (existing) continue;

    const totalHours = 20 + Math.random() * 20; // 20-40 hours
    const hourlyRate = 12;
    const grossPay = totalHours * hourlyRate;
    const taxDeduction = grossPay * 0.2;
    const niEmployee = grossPay * 0.12;
    const netPay = grossPay - taxDeduction - niEmployee;

    await prisma.payslip.create({
      data: {
        workerId: worker.id,
        payPeriodId: pp.id,
        totalHours,
        grossPay,
        netPay,
        taxDeduction,
        niEmployee,
        niEmployer: grossPay * 0.138,
        otherDeductions: grossPay * 0.04,
        status: i === 0 ? 'APPROVED' : 'PAID',
        paidAt: i === 0 ? null : new Date(pp.endDate.getTime() + 5 * 86400000),
      },
    });
    created++;
  }
  console.log(`✅ Created ${created} payslips`);

  console.log('🎉 All fixes applied!');
}

main()
  .catch((e) => { console.error('Error:', e); })
  .finally(async () => { await prisma.$disconnect(); });
