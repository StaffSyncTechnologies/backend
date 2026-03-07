import { PrismaClient, SkillCategory, ShiftStatus, ShiftPriority, LeaveType, LeaveStatus, PayPeriodStatus, PayslipStatus } from '@prisma/client';

const prisma = new PrismaClient();

const skills = [
  // WAREHOUSE SKILLS
  { name: 'Picking', category: SkillCategory.WAREHOUSE },
  { name: 'Packing', category: SkillCategory.WAREHOUSE },
  { name: 'Sorting', category: SkillCategory.WAREHOUSE },
  { name: 'Loading', category: SkillCategory.WAREHOUSE },
  { name: 'Unloading', category: SkillCategory.WAREHOUSE },
  { name: 'Palletising', category: SkillCategory.WAREHOUSE },
  { name: 'Labelling', category: SkillCategory.WAREHOUSE },
  { name: 'RF Scanner', category: SkillCategory.WAREHOUSE },
  { name: 'Order Fulfilment', category: SkillCategory.WAREHOUSE },
  { name: 'Dispatch', category: SkillCategory.WAREHOUSE },
  { name: 'Goods In/Out', category: SkillCategory.WAREHOUSE },
  { name: 'Inventory Count', category: SkillCategory.WAREHOUSE },
  { name: 'Quality Control', category: SkillCategory.WAREHOUSE },
  { name: 'Returns Processing', category: SkillCategory.WAREHOUSE },
  { name: 'Manual Handling', category: SkillCategory.WAREHOUSE },
  { name: 'Heavy Lifting', category: SkillCategory.WAREHOUSE },
  { name: 'PPT (Powered Pallet Truck)', category: SkillCategory.WAREHOUSE },
  { name: 'LLOP (Low Level Order Picker)', category: SkillCategory.WAREHOUSE },
  { name: 'Reach Truck', category: SkillCategory.WAREHOUSE },
  { name: 'Counterbalance', category: SkillCategory.WAREHOUSE },
  { name: 'VNA (Very Narrow Aisle)', category: SkillCategory.WAREHOUSE },
  { name: 'MHE Trained', category: SkillCategory.WAREHOUSE },

  // HEALTHCARE SKILLS
  { name: 'Personal Care', category: SkillCategory.HEALTHCARE },
  { name: 'Medication Administration', category: SkillCategory.HEALTHCARE },
  { name: 'Moving & Handling', category: SkillCategory.HEALTHCARE },
  { name: 'Dementia Care', category: SkillCategory.HEALTHCARE },
  { name: 'End of Life Care', category: SkillCategory.HEALTHCARE },
  { name: 'Mental Health Support', category: SkillCategory.HEALTHCARE },
  { name: 'Learning Disability Support', category: SkillCategory.HEALTHCARE },
  { name: 'Physical Disability Support', category: SkillCategory.HEALTHCARE },
  { name: 'Wound Care', category: SkillCategory.HEALTHCARE },
  { name: 'Catheter Care', category: SkillCategory.HEALTHCARE },
  { name: 'PEG Feeding', category: SkillCategory.HEALTHCARE },
  { name: 'Stoma Care', category: SkillCategory.HEALTHCARE },
  { name: 'Vital Signs Monitoring', category: SkillCategory.HEALTHCARE },
  { name: 'Safeguarding', category: SkillCategory.HEALTHCARE },
  { name: 'Infection Control', category: SkillCategory.HEALTHCARE },
  { name: 'First Aid', category: SkillCategory.HEALTHCARE },
  { name: 'Basic Life Support', category: SkillCategory.HEALTHCARE },
  { name: 'Phlebotomy', category: SkillCategory.HEALTHCARE },
  { name: 'Tracheostomy Care', category: SkillCategory.HEALTHCARE },
  { name: 'Ventilator Care', category: SkillCategory.HEALTHCARE },
  { name: 'Paediatric Care', category: SkillCategory.HEALTHCARE },
  { name: 'Elderly Care', category: SkillCategory.HEALTHCARE },
  { name: 'Rehabilitation Support', category: SkillCategory.HEALTHCARE },
  { name: 'Nutrition & Hydration', category: SkillCategory.HEALTHCARE },
  { name: 'NMC Registered (Nurse)', category: SkillCategory.HEALTHCARE },
  { name: 'HCA Certificate', category: SkillCategory.HEALTHCARE },
  { name: 'Care Certificate', category: SkillCategory.HEALTHCARE },

  // CLEANING SKILLS
  { name: 'Office Cleaning', category: SkillCategory.CLEANING },
  { name: 'Industrial Cleaning', category: SkillCategory.CLEANING },
  { name: 'Deep Cleaning', category: SkillCategory.CLEANING },
  { name: 'Washroom Cleaning', category: SkillCategory.CLEANING },
  { name: 'Floor Polishing', category: SkillCategory.CLEANING },
  { name: 'Window Cleaning', category: SkillCategory.CLEANING },
  { name: 'Kitchen Cleaning', category: SkillCategory.CLEANING },
  { name: 'Waste Management', category: SkillCategory.CLEANING },
  { name: 'Biohazard Cleaning', category: SkillCategory.CLEANING },
  { name: 'COSHH Trained', category: SkillCategory.CLEANING },

  // SECURITY SKILLS
  { name: 'Door Supervision', category: SkillCategory.SECURITY },
  { name: 'CCTV Monitoring', category: SkillCategory.SECURITY },
  { name: 'Access Control', category: SkillCategory.SECURITY },
  { name: 'Patrol Duties', category: SkillCategory.SECURITY },
  { name: 'Conflict Management', category: SkillCategory.SECURITY },
  { name: 'Crowd Control', category: SkillCategory.SECURITY },
  { name: 'Event Security', category: SkillCategory.SECURITY },
  { name: 'Retail Security', category: SkillCategory.SECURITY },
  { name: 'Corporate Security', category: SkillCategory.SECURITY },
  { name: 'SIA Door Supervisor', category: SkillCategory.SECURITY },
  { name: 'SIA CCTV', category: SkillCategory.SECURITY },

  // HOSPITALITY SKILLS
  { name: 'Waiting / Table Service', category: SkillCategory.HOSPITALITY },
  { name: 'Bar Work', category: SkillCategory.HOSPITALITY },
  { name: 'Barista', category: SkillCategory.HOSPITALITY },
  { name: 'Food Preparation', category: SkillCategory.HOSPITALITY },
  { name: 'Kitchen Porter', category: SkillCategory.HOSPITALITY },
  { name: 'Events / Banqueting', category: SkillCategory.HOSPITALITY },
  { name: 'Housekeeping', category: SkillCategory.HOSPITALITY },
  { name: 'Front of House', category: SkillCategory.HOSPITALITY },
  { name: 'Food Hygiene Certificate', category: SkillCategory.HOSPITALITY },

  // GENERAL LABOUR SKILLS
  { name: 'Construction Labour', category: SkillCategory.LABOUR },
  { name: 'Festival / Event Setup', category: SkillCategory.LABOUR },
  { name: 'Removals', category: SkillCategory.LABOUR },
  { name: 'General Labouring', category: SkillCategory.LABOUR },
  { name: 'Driving (Car)', category: SkillCategory.LABOUR },
  { name: 'Driving (Van)', category: SkillCategory.LABOUR },

  // CERTIFICATIONS
  { name: 'Forklift Licence', category: SkillCategory.CERTIFICATION },
  { name: 'SIA Badge', category: SkillCategory.CERTIFICATION },
  { name: 'DBS Certificate', category: SkillCategory.CERTIFICATION },
  { name: 'CSCS Card', category: SkillCategory.CERTIFICATION },
  { name: 'Food Hygiene Level 2', category: SkillCategory.CERTIFICATION },
  { name: 'First Aid at Work', category: SkillCategory.CERTIFICATION },
  { name: 'Manual Handling Certificate', category: SkillCategory.CERTIFICATION },
  { name: 'Fire Safety Certificate', category: SkillCategory.CERTIFICATION },
];

async function main() {
  console.log('🌱 Seeding database...');

  // Seed skills
  console.log('📚 Seeding skills...');
  for (const skill of skills) {
    await prisma.skill.upsert({
      where: {
        name_category: {
          name: skill.name,
          category: skill.category,
        },
      },
      update: {},
      create: skill,
    });
  }

  console.log(`✅ Seeded ${skills.length} skills`);

  // Create demo organization and admin if they don't exist
  console.log('🏢 Setting up demo organization...');
  
  let organization = await prisma.organization.findFirst();
  let adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });

  if (!organization) {
    organization = await prisma.organization.create({
      data: {
        name: 'StaffSync Demo Agency',
        deploymentMode: 'AGENCY',
        email: 'admin@staffsync-demo.com',
        address: '123 Business Park, London, UK',
      },
    });
    console.log('✅ Created demo organization');
  }

  if (!adminUser) {
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash('Admin123!', 10);
    
    adminUser = await prisma.user.create({
      data: {
        email: 'admin@staffsync-demo.com',
        passwordHash: hashedPassword,
        fullName: 'Demo Admin',
        role: 'ADMIN',
        status: 'ACTIVE',
        organizationId: organization.id,
        emailVerified: true,
      },
    });
    console.log('✅ Created demo admin user (admin@staffsync-demo.com / Admin123!)');

    // Create OPS_MANAGER user
    await prisma.user.create({
      data: {
        email: 'ops@staffsync-demo.com',
        passwordHash: hashedPassword,
        fullName: 'Demo Ops Manager',
        role: 'OPS_MANAGER',
        status: 'ACTIVE',
        organizationId: organization.id,
        emailVerified: true,
        teamNumber: 'TM-20260101-0001',
      },
    });
    console.log('✅ Created demo ops manager (ops@staffsync-demo.com / Admin123!)');

    // Create SHIFT_COORDINATOR user
    await prisma.user.create({
      data: {
        email: 'shift@staffsync-demo.com',
        passwordHash: hashedPassword,
        fullName: 'Demo Shift Coordinator',
        role: 'SHIFT_COORDINATOR',
        status: 'ACTIVE',
        organizationId: organization.id,
        emailVerified: true,
        teamNumber: 'TM-20260101-0002',
      },
    });
    console.log('✅ Created demo shift coordinator (shift@staffsync-demo.com / Admin123!)');

    // Create COMPLIANCE_OFFICER user
    await prisma.user.create({
      data: {
        email: 'compliance@staffsync-demo.com',
        passwordHash: hashedPassword,
        fullName: 'Demo Compliance Officer',
        role: 'COMPLIANCE_OFFICER',
        status: 'ACTIVE',
        organizationId: organization.id,
        emailVerified: true,
        teamNumber: 'TM-20260101-0003',
      },
    });
    console.log('✅ Created demo compliance officer (compliance@staffsync-demo.com / Admin123!)');
  }

  // Seed subscription for organization (180-day free trial)
  console.log('💳 Seeding subscription...');
  const existingSubscription = await prisma.subscription.findUnique({
    where: { organizationId: organization.id },
  });

  if (!existingSubscription) {
    const trialStart = new Date();
    const trialEnd = new Date(trialStart.getTime() + 180 * 24 * 60 * 60 * 1000); // 180 days

    await prisma.subscription.create({
      data: {
        organizationId: organization.id,
        planTier: 'FREE',
        status: 'TRIALING',
        workerLimit: -1,
        clientLimit: -1,
        trialStart,
        trialEnd,
        currentPeriodStart: trialStart,
        currentPeriodEnd: trialEnd,
      },
    });

    // Update organization with trial end date
    await prisma.organization.update({
      where: { id: organization.id },
      data: { trialEndsAt: trialEnd },
    });

    console.log('✅ Created 180-day free trial subscription');
  } else {
    console.log('✅ Subscription already exists');
  }

  // Seed worker invite code for testing
  console.log('🎟️ Seeding worker invite code...');
  const crypto = await import('crypto');
  const testInviteCode = 'TEST-WORKER-123';
  const codeHash = crypto.createHash('sha256').update(testInviteCode).digest('hex');
  
  const existingInviteCode = await prisma.inviteCode.findFirst({
    where: { code: testInviteCode },
  });

  if (!existingInviteCode) {
    await prisma.inviteCode.create({
      data: {
        organizationId: organization.id,
        code: testInviteCode,
        codeHash,
        type: 'WORKER',
        status: 'ACTIVE',
        usageType: 'MULTI_USE',
        createdBy: adminUser.id,
      },
    });
    console.log('✅ Created test worker invite code: TEST-WORKER-123');
  } else {
    console.log('✅ Test worker invite code already exists: TEST-WORKER-123');
  }

  // Seed notifications for admin user
  console.log('🔔 Seeding notifications...');
  const existingNotifications = await prisma.notification.count({
    where: { userId: adminUser.id },
  });

  if (existingNotifications === 0) {
    await prisma.notification.createMany({
      data: [
        {
          organizationId: organization.id,
          userId: adminUser.id,
          type: 'SHIFT_ALERT',
          channel: 'IN_APP',
          title: 'St Mary Hospital needs 2 workers',
          message: 'Urgent: Immediate coverage required for night shifts starting today at 08:00 PM',
          referenceType: 'SHIFT',
          status: 'DELIVERED',
          createdAt: new Date(Date.now() - 5 * 60 * 1000), // 5 mins ago
        },
        {
          organizationId: organization.id,
          userId: adminUser.id,
          type: 'SHIFT_ASSIGNED',
          channel: 'IN_APP',
          title: 'New shift assigned',
          message: 'A new shift at Acme Corporation has been assigned to John Worker for tomorrow morning.',
          referenceType: 'SHIFT',
          status: 'DELIVERED',
          createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 mins ago
        },
        {
          organizationId: organization.id,
          userId: adminUser.id,
          type: 'PAYSLIP_READY',
          channel: 'IN_APP',
          title: 'Payroll processed',
          message: 'Payroll for this week has been processed and completed for 8 workers.',
          referenceType: 'PAYROLL',
          status: 'DELIVERED',
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        },
        {
          organizationId: organization.id,
          userId: adminUser.id,
          type: 'TIMESHEET_PENDING',
          channel: 'IN_APP',
          title: 'Pending Timesheet Approval',
          message: 'Sarah Johnson has clocked out of her shift at Metro Shopping Centre awaiting your approval.',
          referenceType: 'ATTENDANCE',
          status: 'DELIVERED',
          createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
        },
        {
          organizationId: organization.id,
          userId: adminUser.id,
          type: 'HOLIDAY_REQUEST',
          channel: 'IN_APP',
          title: 'New holiday request',
          message: 'Mike Thompson has requested annual leave from March 10 to March 15, 2026.',
          referenceType: 'HOLIDAY',
          status: 'DELIVERED',
          createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
        },
        {
          organizationId: organization.id,
          userId: adminUser.id,
          type: 'WORKER_ONBOARDED',
          channel: 'IN_APP',
          title: 'New worker onboarded',
          message: 'Emily Davis has completed onboarding and is now ready to be assigned shifts.',
          referenceType: 'WORKER',
          status: 'DELIVERED',
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
          readAt: new Date(), // Already read
        },
        {
          organizationId: organization.id,
          userId: adminUser.id,
          type: 'COMPLIANCE_EXPIRING',
          channel: 'IN_APP',
          title: 'Document expiring soon',
          message: 'Right to Work document for James Wilson will expire in 7 days. Please request an update.',
          referenceType: 'COMPLIANCE',
          status: 'DELIVERED',
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        },
        {
          organizationId: organization.id,
          userId: adminUser.id,
          type: 'SYSTEM',
          channel: 'IN_APP',
          title: 'Welcome to StaffSync!',
          message: 'Your agency account is all set up. Start by adding workers and creating shifts.',
          referenceType: 'SYSTEM',
          status: 'DELIVERED',
          createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
          readAt: new Date(), // Already read
        },
      ],
    });

    console.log('✅ Created 8 notifications');
  } else {
    console.log('✅ Notifications already exist');
  }

  // Create demo clients
  console.log('🏢 Seeding client companies...');
  
  const clientsData = [
    { name: 'Acme Corporation', contactName: 'John Smith', contactEmail: 'john@acme.com', contactPhone: '+44 20 7999 8888' },
    { name: 'St Mary Hospital', contactName: 'Sarah Wilson', contactEmail: 'sarah@stmary.nhs.uk', contactPhone: '+44 20 7111 2222' },
    { name: 'Metro Shopping Centre', contactName: 'Mike Brown', contactEmail: 'mike@metrocentre.com', contactPhone: '+44 20 7333 4444' },
    { name: 'TechHub Ltd', contactName: 'Emma Davis', contactEmail: 'emma@techhub.io', contactPhone: '+44 20 7555 6666' },
  ];

  const clients: any[] = [];
  for (const clientData of clientsData) {
    // Check if client exists first
    let client = await prisma.clientCompany.findFirst({
      where: { organizationId: organization.id, name: clientData.name },
    });
    
    if (!client) {
      client = await prisma.clientCompany.create({
        data: {
          ...clientData,
          organizationId: organization.id,
          status: 'ACTIVE',
        },
      });
    }
    clients.push(client);
  }
  console.log(`✅ Created ${clients.length} client companies`);
  
  const client = clients[0]; // Primary client for backwards compatibility

  // Seed shifts
  console.log('📅 Seeding shifts...');

  if (organization && adminUser) {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const shiftData = [
      {
        title: 'Warehouse Night Shift - Picking',
        siteLocation: 'Amazon Fulfilment Centre, Manchester',
        startAt: new Date(tomorrow.setHours(22, 0, 0, 0)),
        endAt: new Date(tomorrow.setHours(6, 0, 0, 0)),
        workersNeeded: 5,
        payRate: 12.50,
        status: ShiftStatus.OPEN,
        priority: ShiftPriority.NORMAL,
        notes: 'Steel toe boots required. Bring ID for site access.',
      },
      {
        title: 'Healthcare Support Worker - Day Shift',
        siteLocation: 'Sunrise Care Home, Birmingham',
        startAt: new Date(tomorrow.setHours(7, 0, 0, 0)),
        endAt: new Date(tomorrow.setHours(19, 0, 0, 0)),
        workersNeeded: 3,
        payRate: 14.00,
        status: ShiftStatus.OPEN,
        priority: ShiftPriority.HIGH,
        notes: 'DBS check required. Experience with dementia care preferred.',
      },
      {
        title: 'Event Security - Weekend Concert',
        siteLocation: 'O2 Arena, London',
        startAt: new Date(nextWeek.setHours(16, 0, 0, 0)),
        endAt: new Date(nextWeek.setHours(23, 30, 0, 0)),
        workersNeeded: 10,
        payRate: 15.00,
        status: ShiftStatus.OPEN,
        priority: ShiftPriority.URGENT,
        notes: 'SIA badge mandatory. Black suit required.',
      },
      {
        title: 'Office Deep Clean',
        siteLocation: 'Tech Hub, Leeds',
        startAt: new Date(tomorrow.setHours(18, 0, 0, 0)),
        endAt: new Date(tomorrow.setHours(22, 0, 0, 0)),
        workersNeeded: 2,
        payRate: 11.50,
        status: ShiftStatus.OPEN,
        priority: ShiftPriority.LOW,
        notes: 'Cleaning supplies provided on site.',
      },
      {
        title: 'Restaurant Server - Evening Service',
        siteLocation: 'The Ivy, Manchester',
        startAt: new Date(tomorrow.setHours(17, 0, 0, 0)),
        endAt: new Date(tomorrow.setHours(23, 0, 0, 0)),
        workersNeeded: 4,
        payRate: 13.00,
        status: ShiftStatus.OPEN,
        priority: ShiftPriority.NORMAL,
        notes: 'Smart black attire. Previous hospitality experience required.',
      },
      {
        title: 'Warehouse Loading - Early Morning',
        siteLocation: 'DHL Distribution Centre, Bristol',
        startAt: new Date(nextWeek.setHours(5, 0, 0, 0)),
        endAt: new Date(nextWeek.setHours(13, 0, 0, 0)),
        workersNeeded: 6,
        payRate: 13.50,
        status: ShiftStatus.FILLED,
        priority: ShiftPriority.NORMAL,
        notes: 'Heavy lifting involved. PPE provided.',
      },
      {
        title: 'Registered Nurse - Night Shift',
        siteLocation: 'Royal Infirmary, Edinburgh',
        startAt: new Date(tomorrow.setHours(20, 0, 0, 0)),
        endAt: new Date(tomorrow.setHours(8, 0, 0, 0)),
        workersNeeded: 2,
        payRate: 25.00,
        status: ShiftStatus.OPEN,
        priority: ShiftPriority.URGENT,
        notes: 'NMC registration required. Ward experience essential.',
      },
      {
        title: 'Festival Setup Crew',
        siteLocation: 'Glastonbury Festival Site, Somerset',
        startAt: new Date(nextWeek.setHours(6, 0, 0, 0)),
        endAt: new Date(nextWeek.setHours(18, 0, 0, 0)),
        workersNeeded: 15,
        payRate: 12.00,
        status: ShiftStatus.OPEN,
        priority: ShiftPriority.HIGH,
        notes: 'Outdoor work. Bring waterproof clothing and sturdy boots.',
      },
    ];

    for (const shift of shiftData) {
      await prisma.shift.create({
        data: {
          ...shift,
          organizationId: organization.id,
          createdBy: adminUser.id,
          clientCompanyId: client?.id || null,
        },
      });
    }

    console.log(`✅ Seeded ${shiftData.length} shifts`);

    // Seed Staff Users (OPS_MANAGER, SHIFT_COORDINATOR)
    console.log('👥 Seeding staff users...');
    const bcrypt = await import('bcryptjs');
    const staffPassword = await bcrypt.hash('Staff123!', 10);

    const opsManager = await prisma.user.upsert({
      where: { organizationId_email: { organizationId: organization.id, email: 'ops@staffsync-demo.com' } },
      update: {},
      create: {
        email: 'ops@staffsync-demo.com',
        passwordHash: staffPassword,
        fullName: 'Sarah Operations',
        role: 'OPS_MANAGER',
        status: 'ACTIVE',
        organizationId: organization.id,
        emailVerified: true,
        phone: '+44 7700 900001',
      },
    });

    const shiftCoordinator = await prisma.user.upsert({
      where: { organizationId_email: { organizationId: organization.id, email: 'coordinator@staffsync-demo.com' } },
      update: { managerId: opsManager.id },
      create: {
        email: 'coordinator@staffsync-demo.com',
        passwordHash: staffPassword,
        fullName: 'Mike Coordinator',
        role: 'SHIFT_COORDINATOR',
        status: 'ACTIVE',
        organizationId: organization.id,
        emailVerified: true,
        phone: '+44 7700 900002',
        managerId: opsManager.id,
      },
    });

    console.log('✅ Created staff users (ops@staffsync-demo.com, coordinator@staffsync-demo.com / Staff123!)');

    // Seed Workers
    console.log('👷 Seeding workers...');
    const workerPassword = await bcrypt.hash('Worker123!', 10);

    const workersData = [
      { email: 'john.smith@email.com', fullName: 'John Smith', phone: '+44 7700 100001', niNumber: 'AB123456C' },
      { email: 'emma.wilson@email.com', fullName: 'Emma Wilson', phone: '+44 7700 100002', niNumber: 'CD234567D' },
      { email: 'james.brown@email.com', fullName: 'James Brown', phone: '+44 7700 100003', niNumber: 'EF345678E' },
      { email: 'olivia.taylor@email.com', fullName: 'Olivia Taylor', phone: '+44 7700 100004', niNumber: 'GH456789F' },
      { email: 'william.davies@email.com', fullName: 'William Davies', phone: '+44 7700 100005', niNumber: 'IJ567890G' },
      { email: 'sophia.jones@email.com', fullName: 'Sophia Jones', phone: '+44 7700 100006', niNumber: 'KL678901H' },
      { email: 'harry.evans@email.com', fullName: 'Harry Evans', phone: '+44 7700 100007', niNumber: 'MN789012I' },
      { email: 'amelia.thomas@email.com', fullName: 'Amelia Thomas', phone: '+44 7700 100008', niNumber: 'OP890123J' },
    ];

    const createdWorkers = [];
    for (const workerData of workersData) {
      const worker = await prisma.user.upsert({
        where: { organizationId_email: { organizationId: organization.id, email: workerData.email } },
        update: {},
        create: {
          email: workerData.email,
          passwordHash: workerPassword,
          fullName: workerData.fullName,
          role: 'WORKER',
          status: 'ACTIVE',
          organizationId: organization.id,
          emailVerified: true,
          phone: workerData.phone,
          niNumber: workerData.niNumber,
          managerId: shiftCoordinator.id,
        },
      });

      // Create worker profile
      await prisma.workerProfile.upsert({
        where: { userId: worker.id },
        update: {},
        create: {
          userId: worker.id,
          address: '123 Worker Street, London',
          postcode: 'SW1A 1AA',
          dateOfBirth: new Date('1990-01-15'),
          emergencyContact: 'Emergency Contact',
          emergencyPhone: '+44 7700 999999',
          rtwStatus: 'APPROVED',
          onboardingStatus: 'COMPLETE',
          shiftPreference: 'FLEXIBLE',
          weekendAvailable: true,
          maxTravelDistance: 25,
          hourlyRate: 12.50,
          holidayBalance: 28,
        },
      });

      // Create leave entitlement
      await prisma.leaveEntitlement.upsert({
        where: { workerId_year: { workerId: worker.id, year: 2026 } },
        update: {},
        create: {
          workerId: worker.id,
          contractedHours: 40,
          totalHours: 224, // 40 * 5.6 weeks
          usedHours: 0,
          carryOverHours: 0,
          year: 2026,
        },
      });

      createdWorkers.push(worker);
    }

    // Create some unassigned workers for testing assign functionality
    const unassignedWorkersData = [
      { email: 'unassigned1@staffsync-demo.com', fullName: 'Alex Thompson', phone: '+44 7700 111001', niNumber: 'UN111001A' },
      { email: 'unassigned2@staffsync-demo.com', fullName: 'Jordan Williams', phone: '+44 7700 111002', niNumber: 'UN111002B' },
      { email: 'unassigned3@staffsync-demo.com', fullName: 'Casey Brown', phone: '+44 7700 111003', niNumber: 'UN111003C' },
      { email: 'unassigned4@staffsync-demo.com', fullName: 'Riley Davis', phone: '+44 7700 111004', niNumber: 'UN111004D' },
      { email: 'unassigned5@staffsync-demo.com', fullName: 'Morgan Wilson', phone: '+44 7700 111005', niNumber: 'UN111005E' },
    ];

    for (const workerData of unassignedWorkersData) {
      const worker = await prisma.user.upsert({
        where: { organizationId_email: { organizationId: organization.id, email: workerData.email } },
        update: {},
        create: {
          email: workerData.email,
          passwordHash: workerPassword,
          fullName: workerData.fullName,
          role: 'WORKER',
          status: 'ACTIVE',
          organizationId: organization.id,
          emailVerified: true,
          phone: workerData.phone,
          niNumber: workerData.niNumber,
          managerId: null, // No manager assigned
        },
      });

      await prisma.workerProfile.upsert({
        where: { userId: worker.id },
        update: {},
        create: {
          userId: worker.id,
          address: '456 New Worker Lane, London',
          postcode: 'E1 6AN',
          dateOfBirth: new Date('1995-06-20'),
          emergencyContact: 'Emergency Contact',
          emergencyPhone: '+44 7700 999888',
          rtwStatus: 'PENDING',
          onboardingStatus: 'INCOMPLETE',
          shiftPreference: 'FLEXIBLE',
          weekendAvailable: true,
          maxTravelDistance: 20,
          hourlyRate: 11.50,
          holidayBalance: 28,
        },
      });
    }

    console.log(`✅ Created ${workersData.length} workers + ${unassignedWorkersData.length} unassigned workers (password: Worker123!)`);

    // Seed Leave Requests (Holidays)
    console.log('🏖️ Seeding holiday requests...');
    const leaveRequestsData = [
      {
        workerId: createdWorkers[0].id,
        leaveType: LeaveType.ANNUAL,
        title: 'Summer Holiday',
        startDate: new Date('2026-07-15'),
        endDate: new Date('2026-07-22'),
        totalDays: 5,
        totalHours: 40,
        reason: 'Family vacation to Spain',
        status: LeaveStatus.APPROVED,
        reviewedBy: opsManager.id,
      },
      {
        workerId: createdWorkers[1].id,
        leaveType: LeaveType.ANNUAL,
        title: 'Christmas Break',
        startDate: new Date('2026-12-23'),
        endDate: new Date('2026-12-31'),
        totalDays: 5,
        totalHours: 40,
        reason: 'Christmas with family',
        status: LeaveStatus.PENDING,
      },
      {
        workerId: createdWorkers[2].id,
        leaveType: LeaveType.SICK,
        title: 'Sick Leave',
        startDate: new Date('2026-03-10'),
        endDate: new Date('2026-03-12'),
        totalDays: 3,
        totalHours: 24,
        reason: 'Flu',
        status: LeaveStatus.APPROVED,
        reviewedBy: opsManager.id,
      },
      {
        workerId: createdWorkers[3].id,
        leaveType: LeaveType.ANNUAL,
        title: 'Easter Break',
        startDate: new Date('2026-04-10'),
        endDate: new Date('2026-04-17'),
        totalDays: 5,
        totalHours: 40,
        reason: 'Easter holiday',
        status: LeaveStatus.PENDING,
      },
    ];

    for (const leaveData of leaveRequestsData) {
      await prisma.leaveRequest.create({ data: leaveData });
    }

    console.log(`✅ Created ${leaveRequestsData.length} leave requests`);

    // Seed homepage shifts (today + upcoming) for first worker
    console.log('🏠 Seeding homepage shifts for first worker...');
    const todayDate = new Date();
    const todayStart = new Date(todayDate);
    todayStart.setHours(10, 30, 0, 0);
    const todayEnd = new Date(todayDate);
    todayEnd.setHours(13, 0, 0, 0);

    const homepageShiftsData = [
      {
        title: 'Warehouse Operative',
        siteLocation: 'New York, London',
        startAt: todayStart,
        endAt: todayEnd,
        workersNeeded: 3,
        payRate: 10.00,
        status: ShiftStatus.FILLED,
        priority: ShiftPriority.NORMAL,
        notes: 'Today shift for homepage demo',
        clientIndex: 0,
      },
      {
        title: 'Warehouse Operative',
        siteLocation: 'New York, London',
        startAt: (() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(18, 0, 0, 0); return d; })(),
        endAt: (() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(20, 0, 0, 0); return d; })(),
        workersNeeded: 2,
        payRate: 12.50,
        status: ShiftStatus.FILLED,
        priority: ShiftPriority.NORMAL,
        notes: 'Tomorrow night shift',
        clientIndex: 0,
      },
      {
        title: 'Healthcare Support Worker',
        siteLocation: 'St Mary Hospital, Birmingham',
        startAt: (() => { const d = new Date(); d.setDate(d.getDate() + 3); d.setHours(7, 0, 0, 0); return d; })(),
        endAt: (() => { const d = new Date(); d.setDate(d.getDate() + 3); d.setHours(15, 0, 0, 0); return d; })(),
        workersNeeded: 2,
        payRate: 14.00,
        status: ShiftStatus.FILLED,
        priority: ShiftPriority.HIGH,
        notes: 'Day shift in 3 days',
        clientIndex: 1,
      },
      {
        title: 'Event Security',
        siteLocation: 'O2 Arena, London',
        startAt: (() => { const d = new Date(); d.setDate(d.getDate() + 5); d.setHours(16, 0, 0, 0); return d; })(),
        endAt: (() => { const d = new Date(); d.setDate(d.getDate() + 5); d.setHours(23, 30, 0, 0); return d; })(),
        workersNeeded: 4,
        payRate: 15.00,
        status: ShiftStatus.FILLED,
        priority: ShiftPriority.URGENT,
        notes: 'Weekend event',
        clientIndex: 2,
      },
    ];

    for (const shiftInfo of homepageShiftsData) {
      const clientForShift = clients[shiftInfo.clientIndex] || clients[0];
      const shift = await prisma.shift.create({
        data: {
          title: shiftInfo.title,
          siteLocation: shiftInfo.siteLocation,
          startAt: shiftInfo.startAt,
          endAt: shiftInfo.endAt,
          workersNeeded: shiftInfo.workersNeeded,
          payRate: shiftInfo.payRate,
          status: shiftInfo.status,
          priority: shiftInfo.priority,
          notes: shiftInfo.notes,
          organizationId: organization.id,
          createdBy: adminUser.id,
          clientCompanyId: clientForShift.id,
        },
      });

      // Assign to first worker
      await prisma.shiftAssignment.create({
        data: {
          shiftId: shift.id,
          workerId: createdWorkers[0].id,
          status: 'ACCEPTED',
          assignedAt: new Date(shiftInfo.startAt.getTime() - 2 * 86400000),
          acceptedAt: new Date(shiftInfo.startAt.getTime() - 86400000),
        },
      });
    }

    console.log(`✅ Created ${homepageShiftsData.length} homepage shifts assigned to ${createdWorkers[0].fullName}`);

    // Seed Pay Periods and Payslips
    console.log('💰 Seeding payroll data...');
    
    // Calculate current week period (Sunday to Saturday)
    const today = new Date();
    const dayOfWeek = today.getDay();
    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() - dayOfWeek); // Go to Sunday
    currentWeekStart.setHours(0, 0, 0, 0);
    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekStart.getDate() + 6); // Saturday
    currentWeekEnd.setHours(23, 59, 59, 999);

    // Previous month (closed)
    const payPeriodClosed = await prisma.payPeriod.create({
      data: {
        organizationId: organization.id,
        periodType: 'MONTHLY',
        startDate: new Date('2026-02-01'),
        endDate: new Date('2026-02-28'),
        status: PayPeriodStatus.CLOSED,
      },
    });

    // Current week period (open)
    const currentPayPeriod = await prisma.payPeriod.create({
      data: {
        organizationId: organization.id,
        periodType: 'WEEKLY',
        startDate: currentWeekStart,
        endDate: currentWeekEnd,
        status: PayPeriodStatus.OPEN,
      },
    });

    // Create PAID payslips for previous period
    const paidPayslipsData = [
      { workerId: createdWorkers[0].id, grossPay: 1850.00, netPay: 1520.00, totalHours: 148, hourlyRate: 12.50, tax: 250, ni: 80 },
      { workerId: createdWorkers[1].id, grossPay: 1720.00, netPay: 1420.00, totalHours: 138, hourlyRate: 12.50, tax: 220, ni: 80 },
      { workerId: createdWorkers[2].id, grossPay: 1650.00, netPay: 1370.00, totalHours: 132, hourlyRate: 12.50, tax: 200, ni: 80 },
      { workerId: createdWorkers[3].id, grossPay: 1900.00, netPay: 1560.00, totalHours: 152, hourlyRate: 12.50, tax: 260, ni: 80 },
      { workerId: createdWorkers[4].id, grossPay: 1580.00, netPay: 1310.00, totalHours: 126, hourlyRate: 12.50, tax: 190, ni: 80 },
    ];

    for (const payslipData of paidPayslipsData) {
      await prisma.payslip.create({
        data: {
          payPeriodId: payPeriodClosed.id,
          workerId: payslipData.workerId,
          grossPay: payslipData.grossPay,
          netPay: payslipData.netPay,
          totalHours: payslipData.totalHours,
          hourlyRate: payslipData.hourlyRate,
          taxDeduction: payslipData.tax,
          niEmployee: payslipData.ni,
          status: PayslipStatus.PAID,
          approvedBy: adminUser.id,
          paidAt: new Date(),
        },
      });
    }

    // Create DRAFT payslips for current period with real values
    const draftPayslipsData = [
      { workerId: createdWorkers[0].id, grossPay: 487.50, netPay: 412.25, totalHours: 39, hourlyRate: 12.50, tax: 52.50, ni: 22.75 },
      { workerId: createdWorkers[1].id, grossPay: 562.50, netPay: 475.00, totalHours: 45, hourlyRate: 12.50, tax: 60.75, ni: 26.75 },
      { workerId: createdWorkers[2].id, grossPay: 437.50, netPay: 370.00, totalHours: 35, hourlyRate: 12.50, tax: 47.00, ni: 20.50 },
      { workerId: createdWorkers[3].id, grossPay: 525.00, netPay: 443.50, totalHours: 42, hourlyRate: 12.50, tax: 56.50, ni: 25.00 },
      { workerId: createdWorkers[4].id, grossPay: 500.00, netPay: 422.50, totalHours: 40, hourlyRate: 12.50, tax: 54.00, ni: 23.50 },
    ];

    for (const payslipData of draftPayslipsData) {
      await prisma.payslip.create({
        data: {
          payPeriodId: currentPayPeriod.id,
          workerId: payslipData.workerId,
          grossPay: payslipData.grossPay,
          netPay: payslipData.netPay,
          totalHours: payslipData.totalHours,
          hourlyRate: payslipData.hourlyRate,
          taxDeduction: payslipData.tax,
          niEmployee: payslipData.ni,
          otherDeductions: payslipData.grossPay * 0.04, // 4% pension
          status: PayslipStatus.DRAFT,
        },
      });
    }

    // Create some APPROVED payslips
    const approvedPayslipsData = [
      { workerId: createdWorkers[0].id, grossPay: 475.00, netPay: 401.50, totalHours: 38, hourlyRate: 12.50, tax: 51.00, ni: 22.50 },
      { workerId: createdWorkers[1].id, grossPay: 550.00, netPay: 464.50, totalHours: 44, hourlyRate: 12.50, tax: 59.25, ni: 26.25 },
    ];

    // Create previous week period for approved payslips
    const prevWeekStart = new Date(currentWeekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const prevWeekEnd = new Date(prevWeekStart);
    prevWeekEnd.setDate(prevWeekStart.getDate() + 6);
    
    const prevWeekPeriod = await prisma.payPeriod.create({
      data: {
        organizationId: organization.id,
        periodType: 'WEEKLY',
        startDate: prevWeekStart,
        endDate: prevWeekEnd,
        status: PayPeriodStatus.PROCESSING,
      },
    });

    for (const payslipData of approvedPayslipsData) {
      await prisma.payslip.create({
        data: {
          payPeriodId: prevWeekPeriod.id,
          workerId: payslipData.workerId,
          grossPay: payslipData.grossPay,
          netPay: payslipData.netPay,
          totalHours: payslipData.totalHours,
          hourlyRate: payslipData.hourlyRate,
          taxDeduction: payslipData.tax,
          niEmployee: payslipData.ni,
          otherDeductions: payslipData.grossPay * 0.04,
          status: PayslipStatus.APPROVED,
          approvedBy: adminUser.id,
        },
      });
    }

    console.log(`✅ Created ${paidPayslipsData.length + draftPayslipsData.length + approvedPayslipsData.length} payslips`);

    // Seed Completed Shifts with Attendance Records
    console.log('✅ Seeding completed shifts with attendance...');
    
    // Use dates from this week (2 days ago) so they show in stats
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 2);
    recentDate.setHours(0, 0, 0, 0);
    
    // For overnight shift, end date is the next day
    const nextDayAfterRecent = new Date(recentDate);
    nextDayAfterRecent.setDate(nextDayAfterRecent.getDate() + 1);
    
    // Create shifts for multiple weeks and clients
    const completedShiftsData = [
      // Week 1 (2 days ago) - Acme Corporation
      {
        title: 'Warehouse Pick & Pack - Completed',
        siteLocation: 'Amazon Fulfilment Centre, Manchester',
        startAt: new Date(new Date(recentDate).setHours(8, 0, 0, 0)),
        endAt: new Date(new Date(recentDate).setHours(16, 0, 0, 0)),
        workersNeeded: 3,
        payRate: 12.50,
        status: ShiftStatus.COMPLETED,
        priority: ShiftPriority.NORMAL,
        notes: 'Completed shift - all workers attended',
        clientIndex: 0, // Acme Corporation
      },
      // Week 1 - St Mary Hospital
      {
        title: 'Healthcare Support - Completed',
        siteLocation: 'St Mary Hospital, London',
        startAt: new Date(new Date(recentDate).setHours(7, 0, 0, 0)),
        endAt: new Date(new Date(recentDate).setHours(15, 0, 0, 0)),
        workersNeeded: 2,
        payRate: 14.00,
        status: ShiftStatus.COMPLETED,
        priority: ShiftPriority.HIGH,
        notes: 'Completed shift - excellent feedback',
        clientIndex: 1, // St Mary Hospital
      },
      // Week 1 - Metro Shopping Centre
      {
        title: 'Security Night Shift - Completed',
        siteLocation: 'Metro Shopping Centre, Birmingham',
        startAt: new Date(new Date(recentDate).setHours(22, 0, 0, 0)),
        endAt: new Date(new Date(nextDayAfterRecent).setHours(6, 0, 0, 0)),
        workersNeeded: 2,
        payRate: 15.00,
        status: ShiftStatus.COMPLETED,
        priority: ShiftPriority.NORMAL,
        notes: 'Completed night shift',
        clientIndex: 2, // Metro Shopping Centre
      },
    ];

    // Add shifts from previous weeks for better chart data
    const weekAgo = new Date(recentDate);
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const twoWeeksAgo = new Date(recentDate);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    // Week 2 shifts
    completedShiftsData.push(
      {
        title: 'Warehouse Morning Shift - Week 2',
        siteLocation: 'Acme Warehouse, Manchester',
        startAt: new Date(new Date(weekAgo).setHours(6, 0, 0, 0)),
        endAt: new Date(new Date(weekAgo).setHours(14, 0, 0, 0)),
        workersNeeded: 2,
        payRate: 12.50,
        status: ShiftStatus.COMPLETED,
        priority: ShiftPriority.NORMAL,
        notes: 'Completed shift',
        clientIndex: 0,
      },
      {
        title: 'Hospital Day Shift - Week 2',
        siteLocation: 'St Mary Hospital, London',
        startAt: new Date(new Date(weekAgo).setHours(8, 0, 0, 0)),
        endAt: new Date(new Date(weekAgo).setHours(18, 0, 0, 0)),
        workersNeeded: 2,
        payRate: 14.00,
        status: ShiftStatus.COMPLETED,
        priority: ShiftPriority.HIGH,
        notes: 'Completed shift',
        clientIndex: 1,
      },
      {
        title: 'TechHub Office Support - Week 2',
        siteLocation: 'TechHub Office, London',
        startAt: new Date(new Date(weekAgo).setHours(9, 0, 0, 0)),
        endAt: new Date(new Date(weekAgo).setHours(17, 0, 0, 0)),
        workersNeeded: 2,
        payRate: 13.00,
        status: ShiftStatus.COMPLETED,
        priority: ShiftPriority.NORMAL,
        notes: 'IT support shift',
        clientIndex: 3,
      }
    );

    // Week 3 shifts
    completedShiftsData.push(
      {
        title: 'Warehouse Afternoon - Week 3',
        siteLocation: 'Acme Warehouse, Manchester',
        startAt: new Date(new Date(twoWeeksAgo).setHours(14, 0, 0, 0)),
        endAt: new Date(new Date(twoWeeksAgo).setHours(22, 0, 0, 0)),
        workersNeeded: 2,
        payRate: 12.50,
        status: ShiftStatus.COMPLETED,
        priority: ShiftPriority.NORMAL,
        notes: 'Completed shift',
        clientIndex: 0,
      },
      {
        title: 'Mall Security - Week 3',
        siteLocation: 'Metro Shopping Centre, Birmingham',
        startAt: new Date(new Date(twoWeeksAgo).setHours(10, 0, 0, 0)),
        endAt: new Date(new Date(twoWeeksAgo).setHours(18, 0, 0, 0)),
        workersNeeded: 2,
        payRate: 15.00,
        status: ShiftStatus.COMPLETED,
        priority: ShiftPriority.NORMAL,
        notes: 'Completed shift',
        clientIndex: 2,
      }
    );

    for (let i = 0; i < completedShiftsData.length; i++) {
      const shiftData = completedShiftsData[i];
      const clientForShift = clients[shiftData.clientIndex] || clients[0];
      
      const shift = await prisma.shift.create({
        data: {
          title: shiftData.title,
          siteLocation: shiftData.siteLocation,
          startAt: shiftData.startAt,
          endAt: shiftData.endAt,
          workersNeeded: shiftData.workersNeeded,
          payRate: shiftData.payRate,
          status: shiftData.status,
          priority: shiftData.priority,
          notes: shiftData.notes,
          organizationId: organization.id,
          createdBy: adminUser.id,
          clientCompanyId: clientForShift.id,
        },
      });

      // Create assignments and attendance for this shift
      const workersForShift = createdWorkers.slice(i * 2, i * 2 + 2);
      
      for (const worker of workersForShift) {
        // Create shift assignment
        await prisma.shiftAssignment.create({
          data: {
            shiftId: shift.id,
            workerId: worker.id,
            status: 'ACCEPTED',
            assignedAt: new Date(shiftData.startAt.getTime() - 86400000), // Day before
            acceptedAt: new Date(shiftData.startAt.getTime() - 86400000), // Day before
          },
        });

        // Create attendance record
        const clockInTime = new Date(shiftData.startAt);
        clockInTime.setMinutes(clockInTime.getMinutes() - 5); // Clocked in 5 mins early
        
        const clockOutTime = new Date(shiftData.endAt);
        clockOutTime.setMinutes(clockOutTime.getMinutes() + 3); // Clocked out 3 mins late

        const hoursWorked = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

        // Create mix of PENDING and APPROVED for testing approval flow
        const isPending = i === 0; // First shift has PENDING status
        
        await prisma.attendance.create({
          data: {
            shiftId: shift.id,
            workerId: worker.id,
            clockInAt: clockInTime,
            clockOutAt: clockOutTime,
            hoursWorked: hoursWorked,
            status: isPending ? 'PENDING' : 'APPROVED',
            geofenceValid: true,
          },
        });
      }
    }

    console.log(`✅ Created ${completedShiftsData.length} completed shifts with attendance records`);

  } else {
    console.log('⚠️ Skipped seeding - no organization or admin user found');
  }

  console.log('🎉 Database seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
