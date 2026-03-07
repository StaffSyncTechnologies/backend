import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding dashboard data for oluwasuyibabayomi@gmail.com...');

  // Find the user and organization
  const adminUser = await prisma.user.findFirst({
    where: { email: 'oluwasuyibabayomi@gmail.com' },
    include: { organization: true },
  });

  if (!adminUser) {
    console.error('❌ User oluwasuyibabayomi@gmail.com not found');
    process.exit(1);
  }

  const organizationId = adminUser.organizationId;
  console.log(`📍 Found organization: ${adminUser.organization.name} (${organizationId})`);

  // Get some skills for workers
  const skills = await prisma.skill.findMany({ take: 10 });

  // Create Workers
  console.log('👷 Creating workers...');
  const workerNames = [
    { fullName: 'Sarah Joe', email: 'sarah.joe@example.com', phone: '+447700100001' },
    { fullName: 'James Wilson', email: 'james.wilson@example.com', phone: '+447700100002' },
    { fullName: 'Emma Thompson', email: 'emma.thompson@example.com', phone: '+447700100003' },
    { fullName: 'Michael Brown', email: 'michael.brown@example.com', phone: '+447700100004' },
    { fullName: 'Sophie Davis', email: 'sophie.davis@example.com', phone: '+447700100005' },
    { fullName: 'David Miller', email: 'david.miller@example.com', phone: '+447700100006' },
    { fullName: 'Lucy Taylor', email: 'lucy.taylor@example.com', phone: '+447700100007' },
    { fullName: 'Robert Anderson', email: 'robert.anderson@example.com', phone: '+447700100008' },
    { fullName: 'Emily White', email: 'emily.white@example.com', phone: '+447700100009' },
    { fullName: 'Thomas Harris', email: 'thomas.harris@example.com', phone: '+447700100010' },
    { fullName: 'Jessica Martin', email: 'jessica.martin@example.com', phone: '+447700100011' },
    { fullName: 'Daniel Garcia', email: 'daniel.garcia@example.com', phone: '+447700100012' },
    { fullName: 'Olivia Martinez', email: 'olivia.martinez@example.com', phone: '+447700100013' },
    { fullName: 'William Robinson', email: 'william.robinson@example.com', phone: '+447700100014' },
    { fullName: 'Ava Clark', email: 'ava.clark@example.com', phone: '+447700100015' },
    { fullName: 'Joseph Rodriguez', email: 'joseph.rodriguez@example.com', phone: '+447700100016' },
    { fullName: 'Mia Lewis', email: 'mia.lewis@example.com', phone: '+447700100017' },
    { fullName: 'Charles Lee', email: 'charles.lee@example.com', phone: '+447700100018' },
    { fullName: 'Isabella Walker', email: 'isabella.walker@example.com', phone: '+447700100019' },
    { fullName: 'Christopher Hall', email: 'christopher.hall@example.com', phone: '+447700100020' },
    { fullName: 'Amelia Allen', email: 'amelia.allen@example.com', phone: '+447700100021' },
    { fullName: 'Matthew Young', email: 'matthew.young@example.com', phone: '+447700100022' },
    { fullName: 'Harper King', email: 'harper.king@example.com', phone: '+447700100023' },
    { fullName: 'Andrew Wright', email: 'andrew.wright@example.com', phone: '+447700100024' },
    { fullName: 'Evelyn Scott', email: 'evelyn.scott@example.com', phone: '+447700100025' },
    { fullName: 'Joshua Green', email: 'joshua.green@example.com', phone: '+447700100026' },
    { fullName: 'Abigail Baker', email: 'abigail.baker@example.com', phone: '+447700100027' },
    { fullName: 'Ryan Adams', email: 'ryan.adams@example.com', phone: '+447700100028' },
    { fullName: 'Sofia Nelson', email: 'sofia.nelson@example.com', phone: '+447700100029' },
    { fullName: 'Brandon Hill', email: 'brandon.hill@example.com', phone: '+447700100030' },
    { fullName: 'Victoria Ramirez', email: 'victoria.ramirez@example.com', phone: '+447700100031' },
    { fullName: 'Nathan Campbell', email: 'nathan.campbell@example.com', phone: '+447700100032' },
    { fullName: 'Grace Mitchell', email: 'grace.mitchell@example.com', phone: '+447700100033' },
    { fullName: 'Kevin Roberts', email: 'kevin.roberts@example.com', phone: '+447700100034' },
    { fullName: 'Chloe Carter', email: 'chloe.carter@example.com', phone: '+447700100035' },
    { fullName: 'Justin Phillips', email: 'justin.phillips@example.com', phone: '+447700100036' },
    { fullName: 'Lily Evans', email: 'lily.evans@example.com', phone: '+447700100037' },
    { fullName: 'Tyler Turner', email: 'tyler.turner@example.com', phone: '+447700100038' },
    { fullName: 'Zoe Torres', email: 'zoe.torres@example.com', phone: '+447700100039' },
    { fullName: 'Aaron Parker', email: 'aaron.parker@example.com', phone: '+447700100040' },
  ];

  const passwordHash = await bcrypt.hash('Worker123!', 12);
  const workers: any[] = [];

  for (const worker of workerNames) {
    const existing = await prisma.user.findFirst({ where: { email: worker.email } });
    if (!existing) {
      const created = await prisma.user.create({
        data: {
          organizationId,
          role: 'WORKER',
          fullName: worker.fullName,
          email: worker.email,
          phone: worker.phone,
          passwordHash,
          status: 'ACTIVE',
          emailVerified: true,
          workerProfile: {
            create: {
              rtwStatus: 'APPROVED',
              onboardingStatus: 'COMPLETE',
            },
          },
        },
      });
      workers.push(created);

      // Assign random skills
      if (skills.length > 0) {
        const randomSkills = skills.slice(0, Math.floor(Math.random() * 5) + 1);
        for (const skill of randomSkills) {
          await prisma.workerSkill.create({
            data: { workerId: created.id, skillId: skill.id },
          }).catch(() => {}); // Ignore duplicates
        }
      }
    } else {
      workers.push(existing);
    }
  }
  console.log(`✅ Created/found ${workers.length} workers`);

  // Create Client Companies
  console.log('🏢 Creating client companies...');
  const clientCompanies = [
    { name: 'Amazon Warehouse UK', contactName: 'John Smith', contactEmail: 'john@amazon-uk.example.com', industry: 'Logistics' },
    { name: 'Tesco Distribution', contactName: 'Mary Johnson', contactEmail: 'mary@tesco.example.com', industry: 'Retail' },
    { name: 'NHS Trust London', contactName: 'Dr. Sarah Brown', contactEmail: 'sarah@nhs.example.com', industry: 'Healthcare' },
    { name: 'Hilton Hotels', contactName: 'Peter Wilson', contactEmail: 'peter@hilton.example.com', industry: 'Hospitality' },
    { name: 'G4S Security', contactName: 'Mike Davis', contactEmail: 'mike@g4s.example.com', industry: 'Security' },
    { name: 'DHL Express', contactName: 'Anna White', contactEmail: 'anna@dhl.example.com', industry: 'Logistics' },
    { name: 'Marriott Hotels', contactName: 'James Taylor', contactEmail: 'james@marriott.example.com', industry: 'Hospitality' },
    { name: 'Boots Pharmacy', contactName: 'Lisa Green', contactEmail: 'lisa@boots.example.com', industry: 'Retail' },
    { name: 'ISS Facilities', contactName: 'Tom Harris', contactEmail: 'tom@iss.example.com', industry: 'Cleaning' },
    { name: 'Sainsburys Distribution', contactName: 'Emma Clark', contactEmail: 'emma@sainsburys.example.com', industry: 'Retail' },
    { name: 'Compass Group', contactName: 'David Lee', contactEmail: 'david@compass.example.com', industry: 'Hospitality' },
    { name: 'Securitas UK', contactName: 'Chris Martin', contactEmail: 'chris@securitas.example.com', industry: 'Security' },
    { name: 'Royal Mail', contactName: 'Sophie Adams', contactEmail: 'sophie@royalmail.example.com', industry: 'Logistics' },
    { name: 'Care UK', contactName: 'Dr. Robert Brown', contactEmail: 'robert@careuk.example.com', industry: 'Healthcare' },
    { name: 'Wetherspoons', contactName: 'Karen Wilson', contactEmail: 'karen@wetherspoons.example.com', industry: 'Hospitality' },
    { name: 'Mitie Cleaning', contactName: 'Steve Thompson', contactEmail: 'steve@mitie.example.com', industry: 'Cleaning' },
    { name: 'Ocado Warehouse', contactName: 'Rachel Moore', contactEmail: 'rachel@ocado.example.com', industry: 'Logistics' },
    { name: 'Premier Inn', contactName: 'Mark Jackson', contactEmail: 'mark@premierinn.example.com', industry: 'Hospitality' },
    { name: 'Bupa Care Homes', contactName: 'Dr. Helen White', contactEmail: 'helen@bupa.example.com', industry: 'Healthcare' },
  ];

  const clients: any[] = [];
  for (const client of clientCompanies) {
    const existing = await prisma.clientCompany.findFirst({
      where: { organizationId, name: client.name },
    });
    if (!existing) {
      const created = await prisma.clientCompany.create({
        data: {
          organizationId,
          name: client.name,
          contactName: client.contactName,
          contactEmail: client.contactEmail,
          industry: client.industry,
          status: 'ACTIVE',
        },
      });
      clients.push(created);
    } else {
      clients.push(existing);
    }
  }
  console.log(`✅ Created/found ${clients.length} client companies`);

  // Create Locations
  console.log('📍 Creating locations...');
  const locations: any[] = [];
  for (const client of clients.slice(0, 10)) {
    const existing = await prisma.location.findFirst({
      where: { organizationId, name: `${client.name} - Main Site` },
    });
    if (!existing) {
      const created = await prisma.location.create({
        data: {
          organizationId,
          name: `${client.name} - Main Site`,
          address: 'New York, London',
          latitude: 51.5074 + (Math.random() - 0.5) * 0.1,
          longitude: -0.1278 + (Math.random() - 0.5) * 0.1,
          geofenceRadius: 100,
        },
      });
      locations.push(created);
    } else {
      locations.push(existing);
    }
  }
  console.log(`✅ Created/found ${locations.length} locations`);

  // Create Shifts for this week
  console.log('📅 Creating shifts...');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay();
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(today.getTime() - diffToMonday * 24 * 60 * 60 * 1000);

  const shiftRoles = ['Warehouse Operative', 'Care Assistant', 'Security Guard', 'Cleaner', 'Kitchen Porter', 'Receptionist'];
  const shifts: any[] = [];

  // Create shifts for each day of the week
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const shiftDate = new Date(weekStart.getTime() + dayIndex * 24 * 60 * 60 * 1000);
    
    // More shifts on weekdays
    const shiftsPerDay = dayIndex < 5 ? Math.floor(Math.random() * 15) + 40 : Math.floor(Math.random() * 10) + 20;
    
    for (let i = 0; i < shiftsPerDay; i++) {
      const client = clients[Math.floor(Math.random() * clients.length)];
      const location = locations[Math.floor(Math.random() * locations.length)];
      const role = shiftRoles[Math.floor(Math.random() * shiftRoles.length)];
      const startHour = Math.floor(Math.random() * 12) + 6; // 6am to 6pm
      
      const startAt = new Date(shiftDate);
      startAt.setHours(startHour, 0, 0, 0);
      
      const endAt = new Date(startAt);
      endAt.setHours(startAt.getHours() + 8);

      const shift = await prisma.shift.create({
        data: {
          organizationId,
          clientCompanyId: client.id,
          locationId: location?.id,
          title: `${role} - ${client.name}`,
          role,
          startAt,
          endAt,
          workersNeeded: Math.floor(Math.random() * 3) + 1,
          hourlyRate: 12 + Math.random() * 8,
          status: shiftDate < today ? 'COMPLETED' : (Math.random() > 0.3 ? 'FILLED' : 'OPEN'),
          createdBy: adminUser.id,
        },
      });
      shifts.push(shift);
    }
  }
  console.log(`✅ Created ${shifts.length} shifts`);

  // Create Shift Assignments and Attendance
  console.log('📋 Creating shift assignments and attendance...');
  let attendanceCount = 0;

  for (const shift of shifts) {
    const numWorkers = Math.min(shift.workersNeeded, Math.floor(Math.random() * 3) + 1);
    const assignedWorkers = workers.slice(0, numWorkers);

    for (const worker of assignedWorkers) {
      // Create assignment
      await prisma.shiftAssignment.create({
        data: {
          shiftId: shift.id,
          workerId: worker.id,
          status: 'ACCEPTED',
        },
      }).catch(() => {}); // Ignore duplicates

      // Create attendance for past/today shifts
      if (new Date(shift.startAt) <= today) {
        const clockInAt = new Date(shift.startAt);
        clockInAt.setMinutes(clockInAt.getMinutes() + Math.floor(Math.random() * 15) - 5);

        const isCompleted = new Date(shift.endAt) < new Date();
        let clockOutAt = null;
        let hoursWorked = null;

        if (isCompleted) {
          clockOutAt = new Date(shift.endAt);
          clockOutAt.setMinutes(clockOutAt.getMinutes() + Math.floor(Math.random() * 30) - 10);
          hoursWorked = (clockOutAt.getTime() - clockInAt.getTime()) / (1000 * 60 * 60);
        }

        await prisma.attendance.create({
          data: {
            shiftId: shift.id,
            workerId: worker.id,
            clockInAt,
            clockOutAt,
            hoursWorked,
            status: isCompleted ? 'APPROVED' : 'PENDING',
            geofenceValid: true,
          },
        }).catch(() => {}); // Ignore duplicates

        attendanceCount++;
      }
    }
  }
  console.log(`✅ Created ${attendanceCount} attendance records`);

  // Create some payslips for revenue data
  console.log('💰 Creating payslip data...');
  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const periodStartDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
  const periodEndDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);

  // Create a pay period first
  let payPeriod = await prisma.payPeriod.findFirst({
    where: { organizationId, startDate: periodStartDate },
  });
  if (!payPeriod) {
    payPeriod = await prisma.payPeriod.create({
      data: {
        organizationId,
        periodType: 'MONTHLY',
        startDate: periodStartDate,
        endDate: periodEndDate,
        status: 'CLOSED',
      },
    });
  }

  // Get some shifts for payslip line items
  const pastShifts = shifts.filter(s => new Date(s.startAt) < today).slice(0, 40);

  for (let i = 0; i < Math.min(workers.length, 20); i++) {
    const worker = workers[i];
    const workerShift = pastShifts[i % pastShifts.length];
    if (!workerShift) continue;

    const existing = await prisma.payslip.findFirst({
      where: { payPeriodId: payPeriod.id, workerId: worker.id },
    });
    if (existing) continue;

    const grossPay = 800 + Math.random() * 1200;
    const taxDeduction = grossPay * 0.2;
    const niEmployee = grossPay * 0.12;
    const netPay = grossPay - taxDeduction - niEmployee;

    const payslip = await prisma.payslip.create({
      data: {
        payPeriodId: payPeriod.id,
        workerId: worker.id,
        totalHours: 120 + Math.random() * 40,
        hourlyRate: 12 + Math.random() * 5,
        grossPay,
        taxDeduction,
        niEmployee,
        netPay,
        status: 'PAID',
        paidAt: new Date(),
      },
    });

    await prisma.payslipLineItem.create({
      data: {
        payslipId: payslip.id,
        shiftId: workerShift.id,
        date: new Date(workerShift.startAt),
        hours: 8,
        rate: 12 + Math.random() * 5,
        amount: 100 + Math.random() * 100,
      },
    });
  }
  console.log('✅ Created payslip data');

  console.log('🎉 Dashboard seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
