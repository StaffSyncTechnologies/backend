import { PrismaClient, SkillCategory } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding additional workers...');

  // Get existing organization and skills
  const organization = await prisma.organization.findFirst();
  if (!organization) {
    console.log('❌ No organization found. Please run main seed first.');
    return;
  }

  const skills = await prisma.skill.findMany();
  const skillMap = skills.reduce((acc, skill) => {
    acc[skill.name] = skill;
    return acc;
  }, {} as Record<string, any>);

  // Get shift coordinator for manager assignment
  const shiftCoordinator = await prisma.user.findFirst({
    where: { role: 'SHIFT_COORDINATOR', organizationId: organization.id }
  });

  // Additional workers data
  const workersData = [
    {
      email: 'john.davis@staffsync-demo.com',
      fullName: 'John Davis',
      phone: '+44 7700 200001',
      niNumber: 'JD200001A',
      skills: ['Picking', 'Packing', 'RF Scanner', 'Manual Handling'],
      hourlyRate: 11.75,
      address: '456 Oak Street, Manchester',
      postcode: 'M1 2BX',
      dateOfBirth: new Date('1988-05-15')
    },
    {
      email: 'sarah.miller@staffsync-demo.com',
      fullName: 'Sarah Miller',
      phone: '+44 7700 200002',
      niNumber: 'SM200002B',
      skills: ['Personal Care', 'Medication Administration', 'First Aid', 'NMC Registered (Nurse)'],
      hourlyRate: 15.50,
      address: '789 Pine Avenue, Birmingham',
      postcode: 'B1 1HH',
      dateOfBirth: new Date('1992-08-22')
    },
    {
      email: 'mike.wilson@staffsync-demo.com',
      fullName: 'Mike Wilson',
      phone: '+44 7700 200003',
      niNumber: 'MW200003C',
      skills: ['Door Supervision', 'CCTV Monitoring', 'SIA Door Supervisor', 'Conflict Management'],
      hourlyRate: 13.25,
      address: '321 Elm Road, London',
      postcode: 'E14 5AB',
      dateOfBirth: new Date('1985-12-10')
    },
    {
      email: 'emma.thompson@staffsync-demo.com',
      fullName: 'Emma Thompson',
      phone: '+44 7700 200004',
      niNumber: 'ET200004D',
      skills: ['Office Cleaning', 'Deep Cleaning', 'COSHH Trained', 'Waste Management'],
      hourlyRate: 10.50,
      address: '654 Maple Drive, Leeds',
      postcode: 'LS1 2BA',
      dateOfBirth: new Date('1990-03-18')
    },
    {
      email: 'david.chen@staffsync-demo.com',
      fullName: 'David Chen',
      phone: '+44 7700 200005',
      niNumber: 'DC200005E',
      skills: ['Waiting / Table Service', 'Bar Work', 'Barista', 'Food Hygiene Certificate'],
      hourlyRate: 11.00,
      address: '987 Cedar Lane, Bristol',
      postcode: 'BS1 4ED',
      dateOfBirth: new Date('1993-07-25')
    },
    {
      email: 'lisa.anderson@staffsync-demo.com',
      fullName: 'Lisa Anderson',
      phone: '+44 7700 200006',
      niNumber: 'LA200006F',
      skills: ['Construction Labour', 'General Labouring', 'CSCS Card', 'Manual Handling Certificate'],
      hourlyRate: 12.00,
      address: '147 Birch Street, Glasgow',
      postcode: 'G1 1AA',
      dateOfBirth: new Date('1987-09-12')
    },
    {
      email: 'james.patel@staffsync-demo.com',
      fullName: 'James Patel',
      phone: '+44 7700 200007',
      niNumber: 'JP200007G',
      skills: ['Forklift Licence', 'Counterbalance', 'Reach Truck', 'PPT (Powered Pallet Truck)'],
      hourlyRate: 14.00,
      address: '258 Willow Way, Sheffield',
      postcode: 'S1 2HE',
      dateOfBirth: new Date('1991-11-30')
    },
    {
      email: 'maria.garcia@staffsync-demo.com',
      fullName: 'Maria Garcia',
      phone: '+44 7700 200008',
      niNumber: 'MG200008H',
      skills: ['Housekeeping', 'Front of House', 'Kitchen Porter', 'Food Hygiene Level 2'],
      hourlyRate: 10.75,
      address: '369 Ash Grove, Cardiff',
      postcode: 'CF10 1AY',
      dateOfBirth: new Date('1989-04-05')
    },
    {
      email: 'alex.turner@staffsync-demo.com',
      fullName: 'Alex Turner',
      phone: '+44 7700 200009',
      niNumber: 'AT200009J',
      skills: ['Event Security', 'Patrol Duties', 'SIA Badge', 'Crowd Control'],
      hourlyRate: 13.75,
      address: '741 Spruce Court, Edinburgh',
      postcode: 'EH1 1YZ',
      dateOfBirth: new Date('1986-06-20')
    },
    {
      email: 'rachel.white@staffsync-demo.com',
      fullName: 'Rachel White',
      phone: '+44 7700 200010',
      niNumber: 'RW200010K',
      skills: ['Dementia Care', 'Mental Health Support', 'Elderly Care', 'Safeguarding'],
      hourlyRate: 14.50,
      address: '852 Pine Crescent, Liverpool',
      postcode: 'L1 4AA',
      dateOfBirth: new Date('1994-02-14')
    }
  ];

  const bcryptModule = await import('bcryptjs');
  const bcrypt = bcryptModule.default || bcryptModule;
  const workerPassword = await bcrypt.hash('Worker123!', 10);

  const createdWorkers = [];
  
  for (const workerData of workersData) {
    try {
      // Check if worker already exists
      const existingWorker = await prisma.user.findFirst({
        where: { 
          organizationId: organization.id, 
          email: workerData.email 
        }
      });

      if (existingWorker) {
        console.log(`⚠️ Worker ${workerData.email} already exists, skipping...`);
        continue;
      }

      // Create worker user
      const worker = await prisma.user.create({
        data: {
          email: workerData.email,
          passwordHash: workerPassword,
          fullName: workerData.fullName,
          role: 'WORKER',
          status: 'ACTIVE',
          organizationId: organization.id,
          emailVerified: true,
          phone: workerData.phone,
          niNumber: workerData.niNumber,
          managerId: shiftCoordinator?.id || null,
        },
      });

      // Create worker profile
      await prisma.workerProfile.create({
        data: {
          userId: worker.id,
          address: workerData.address,
          postcode: workerData.postcode,
          dateOfBirth: workerData.dateOfBirth,
          emergencyContact: 'Emergency Contact',
          emergencyPhone: '+44 7700 999999',
          rtwStatus: 'APPROVED',
          onboardingStatus: 'COMPLETE',
          shiftPreference: 'FLEXIBLE',
          weekendAvailable: true,
          maxTravelDistance: 25,
          hourlyRate: workerData.hourlyRate,
          holidayBalance: 28,
        },
      });

      // Create leave entitlement
      await prisma.leaveEntitlement.create({
        data: {
          workerId: worker.id,
          contractedHours: 40,
          totalHours: 224, // 40 * 5.6 weeks
          usedHours: 0,
          carryOverHours: 0,
          year: 2026,
        },
      });

      // Assign skills
      for (const skillName of workerData.skills) {
        const skill = skillMap[skillName];
        if (skill) {
          await prisma.workerSkill.create({
            data: {
              workerId: worker.id,
              skillId: skill.id,
              experienceLevel: '3-5_YEARS',
            },
          });
        }
      }

      createdWorkers.push(worker);
      console.log(`✅ Created worker: ${workerData.fullName} (${workerData.email})`);

    } catch (error) {
      console.error(`❌ Error creating worker ${workerData.email}:`, error);
    }
  }

  // Create some shifts for these workers
  console.log('📅 Creating shifts for new workers...');
  
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);

  // Get clients for shift assignment
  const clients = await prisma.clientCompany.findMany({
    where: { organizationId: organization.id }
  });

  if (clients.length > 0 && createdWorkers.length > 0) {
    const shiftData = [
      {
        title: 'Night Shift - Warehouse Picking',
        siteLocation: 'Amazon Fulfilment Centre, Manchester',
        startAt: new Date(tomorrow.setHours(22, 0, 0, 0)),
        endAt: new Date(tomorrow.setHours(6, 0, 0, 0)),
        workersNeeded: 3,
        payRate: 12.00,
        clientIndex: 0,
        workerIndex: 0, // John Davis
      },
      {
        title: 'Healthcare Support - Day Shift',
        siteLocation: 'St Mary Hospital, Birmingham',
        startAt: new Date(tomorrow.setHours(7, 0, 0, 0)),
        endAt: new Date(tomorrow.setHours(15, 0, 0, 0)),
        workersNeeded: 2,
        payRate: 15.00,
        clientIndex: 1,
        workerIndex: 1, // Sarah Miller
      },
      {
        title: 'Event Security - Evening',
        siteLocation: 'O2 Arena, London',
        startAt: new Date(nextWeek.setHours(18, 0, 0, 0)),
        endAt: new Date(nextWeek.setHours(23, 0, 0, 0)),
        workersNeeded: 4,
        payRate: 14.00,
        clientIndex: 2,
        workerIndex: 2, // Mike Wilson
      },
      {
        title: 'Office Cleaning - Night',
        siteLocation: 'Tech Hub, Leeds',
        startAt: new Date(tomorrow.setHours(20, 0, 0, 0)),
        endAt: new Date(tomorrow.setHours(23, 0, 0, 0)),
        workersNeeded: 2,
        payRate: 11.00,
        clientIndex: 3,
        workerIndex: 3, // Emma Thompson
      },
      {
        title: 'Restaurant Service - Evening',
        siteLocation: 'The Ivy, Manchester',
        startAt: new Date(tomorrow.setHours(17, 0, 0, 0)),
        endAt: new Date(tomorrow.setHours(22, 0, 0, 0)),
        workersNeeded: 3,
        payRate: 11.50,
        clientIndex: 0,
        workerIndex: 4, // David Chen
      },
    ];

    for (const shiftInfo of shiftData) {
      if (shiftInfo.workerIndex < createdWorkers.length && shiftInfo.clientIndex < clients.length) {
        const client = clients[shiftInfo.clientIndex];
        const worker = createdWorkers[shiftInfo.workerIndex];

        const shift = await prisma.shift.create({
          data: {
            title: shiftInfo.title,
            siteLocation: shiftInfo.siteLocation,
            startAt: shiftInfo.startAt,
            endAt: shiftInfo.endAt,
            workersNeeded: shiftInfo.workersNeeded,
            payRate: shiftInfo.payRate,
            status: 'FILLED',
            priority: 'NORMAL',
            notes: `Shift assigned to ${worker.fullName}`,
            organizationId: organization.id,
            createdBy: shiftCoordinator?.id || organization.id,
            clientCompanyId: client.id,
          },
        });

        // Assign worker to shift
        await prisma.shiftAssignment.create({
          data: {
            shiftId: shift.id,
            workerId: worker.id,
            status: 'ACCEPTED',
            assignedAt: new Date(),
            acceptedAt: new Date(),
          },
        });

        console.log(`✅ Created and assigned shift: ${shiftInfo.title} to ${worker.fullName}`);
      }
    }
  }

  console.log(`🎉 Successfully created ${createdWorkers.length} additional workers!`);
  console.log('');
  console.log('📋 New Worker Login Credentials:');
  console.log('=====================================');
  
  for (const worker of createdWorkers) {
    console.log(`👤 ${worker.fullName}`);
    console.log(`   📧 Email: ${worker.email}`);
    console.log(`   🔑 Password: Worker123!`);
    console.log('');
  }

  console.log('🎉 Additional worker seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
