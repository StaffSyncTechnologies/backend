import { PrismaClient, SkillCategory } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding John-like workers...');

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

  // Common names like John Smith with realistic skills
  const johnLikeWorkers = [
    {
      email: 'john.smith.jr@staffsync-demo.com',
      fullName: 'John Smith Jr',
      phone: '+44 7700 400001',
      niNumber: 'JSJ400001A',
      skills: ['Picking', 'Packing', 'Manual Handling', 'RF Scanner'],
      hourlyRate: 11.25,
      address: '123 High Street, London',
      postcode: 'SW1A 1AA',
      dateOfBirth: new Date('1992-06-15')
    },
    {
      email: 'john.brown@staffsync-demo.com',
      fullName: 'John Brown',
      phone: '+44 7700 400002',
      niNumber: 'JB400002B',
      skills: ['Construction Labour', 'General Labouring', 'CSCS Card', 'Manual Handling Certificate'],
      hourlyRate: 11.50,
      address: '456 Church Road, Manchester',
      postcode: 'M1 4AA',
      dateOfBirth: new Date('1989-03-22')
    },
    {
      email: 'john.taylor@staffsync-demo.com',
      fullName: 'John Taylor',
      phone: '+44 7700 400003',
      niNumber: 'JT400003C',
      skills: ['Door Supervision', 'SIA Badge', 'Patrol Duties', 'Conflict Management'],
      hourlyRate: 12.75,
      address: '789 Park Lane, Birmingham',
      postcode: 'B1 2BB',
      dateOfBirth: new Date('1987-11-08')
    },
    {
      email: 'john.wilson@staffsync-demo.com',
      fullName: 'John Wilson',
      phone: '+44 7700 400004',
      niNumber: 'JW400004D',
      skills: ['Personal Care', 'First Aid', 'Moving & Handling', 'Care Certificate'],
      hourlyRate: 11.00,
      address: '321 Queen Street, Glasgow',
      postcode: 'G1 1AB',
      dateOfBirth: new Date('1991-04-18')
    },
    {
      email: 'john.davies@staffsync-demo.com',
      fullName: 'John Davies',
      phone: '+44 7700 400005',
      niNumber: 'JD400005E',
      skills: ['Waiting / Table Service', 'Bar Work', 'Food Hygiene Certificate', 'Kitchen Porter'],
      hourlyRate: 10.75,
      address: '654 Castle Street, Cardiff',
      postcode: 'CF10 2CD',
      dateOfBirth: new Date('1993-08-25')
    },
    {
      email: 'john.evans@staffsync-demo.com',
      fullName: 'John Evans',
      phone: '+44 7700 400006',
      niNumber: 'JE400006F',
      skills: ['Office Cleaning', 'Deep Cleaning', 'Washroom Cleaning', 'COSHH Trained'],
      hourlyRate: 10.50,
      address: '987 Market Square, Leeds',
      postcode: 'LS1 3DE',
      dateOfBirth: new Date('1990-12-30')
    },
    {
      email: 'john.thomas@staffsync-demo.com',
      fullName: 'John Thomas',
      phone: '+44 7700 400007',
      niNumber: 'JT400007G',
      skills: ['Forklift Licence', 'Counterbalance', 'PPT (Powered Pallet Truck)', 'Loading'],
      hourlyRate: 13.25,
      address: '147 Station Road, Sheffield',
      postcode: 'S1 4FG',
      dateOfBirth: new Date('1988-05-12')
    },
    {
      email: 'john.roberts@staffsync-demo.com',
      fullName: 'John Roberts',
      phone: '+44 7700 400008',
      niNumber: 'JR400008H',
      skills: ['Event Security', 'Crowd Control', 'SIA Door Supervisor', 'Retail Security'],
      hourlyRate: 12.50,
      address: '258 High Street, Bristol',
      postcode: 'BS1 5HI',
      dateOfBirth: new Date('1986-09-20')
    },
    {
      email: 'michael.smith@staffsync-demo.com',
      fullName: 'Michael Smith',
      phone: '+44 7700 400009',
      niNumber: 'MS400009J',
      skills: ['Picking', 'Sorting', 'Order Fulfilment', 'Goods In/Out'],
      hourlyRate: 11.00,
      address: '369 Victoria Street, Liverpool',
      postcode: 'L1 6JK',
      dateOfBirth: new Date('1994-02-14')
    },
    {
      email: 'david.smith@staffsync-demo.com',
      fullName: 'David Smith',
      phone: '+44 7700 400010',
      niNumber: 'DS400010K',
      skills: ['Warehouse Labour', 'Heavy Lifting', 'Manual Handling', 'Inventory Count'],
      hourlyRate: 11.75,
      address: '741 Albert Road, Newcastle',
      postcode: 'NE1 4LM',
      dateOfBirth: new Date('1985-07-10')
    },
    {
      email: 'james.smith@staffsync-demo.com',
      fullName: 'James Smith',
      phone: '+44 7700 400011',
      niNumber: 'JS400011L',
      skills: ['Driving (Van)', 'Removals', 'General Labouring', 'Manual Handling Certificate'],
      hourlyRate: 12.00,
      address: '852 George Street, Edinburgh',
      postcode: 'EH2 2MN',
      dateOfBirth: new Date('1992-11-28')
    },
    {
      email: 'robert.smith@staffsync-demo.com',
      fullName: 'Robert Smith',
      phone: '+44 7700 400012',
      niNumber: 'RS400012M',
      skills: ['Construction Labour', 'Festival / Event Setup', 'CSCS Card', 'Driving (Car)'],
      hourlyRate: 11.50,
      address: '963 Princess Street, Manchester',
      postcode: 'M1 4NO',
      dateOfBirth: new Date('1989-04-05')
    }
  ];

  const bcryptModule = await import('bcryptjs');
  const bcrypt = bcryptModule.default || bcryptModule;
  const workerPassword = await bcrypt.hash('Worker123!', 10);

  const createdWorkers = [];
  
  for (const workerData of johnLikeWorkers) {
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
          maxTravelDistance: 20,
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
              experienceLevel: '1-2_YEARS',
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

  // Create some general shifts for these workers
  console.log('📅 Creating general shifts for John-like workers...');
  
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
    const generalShifts = [
      {
        title: 'General Warehouse Operative',
        siteLocation: 'Distribution Centre, Milton Keynes',
        startAt: new Date(tomorrow.setHours(8, 0, 0, 0)),
        endAt: new Date(tomorrow.setHours(16, 0, 0, 0)),
        workersNeeded: 4,
        payRate: 11.00,
        clientIndex: 0,
        workerIndex: 0, // John Smith Jr
      },
      {
        title: 'Construction Site Labour',
        siteLocation: 'Building Site, London Docklands',
        startAt: new Date(tomorrow.setHours(7, 0, 0, 0)),
        endAt: new Date(tomorrow.setHours(15, 0, 0, 0)),
        workersNeeded: 6,
        payRate: 11.50,
        clientIndex: 1,
        workerIndex: 1, // John Brown
      },
      {
        title: 'Retail Security Guard',
        siteLocation: 'Shopping Centre, Birmingham',
        startAt: new Date(tomorrow.setHours(10, 0, 0, 0)),
        endAt: new Date(tomorrow.setHours(18, 0, 0, 0)),
        workersNeeded: 2,
        payRate: 12.00,
        clientIndex: 2,
        workerIndex: 2, // John Taylor
      },
      {
        title: 'Care Home Support Worker',
        siteLocation: 'Residential Care Home, Manchester',
        startAt: new Date(tomorrow.setHours(14, 0, 0, 0)),
        endAt: new Date(tomorrow.setHours(22, 0, 0, 0)),
        workersNeeded: 3,
        payRate: 11.25,
        clientIndex: 1,
        workerIndex: 3, // John Wilson
      },
      {
        title: 'Restaurant Kitchen Assistant',
        siteLocation: 'City Restaurant, Leeds',
        startAt: new Date(tomorrow.setHours(17, 0, 0, 0)),
        endAt: new Date(tomorrow.setHours(23, 0, 0, 0)),
        workersNeeded: 2,
        payRate: 10.50,
        clientIndex: 3,
        workerIndex: 4, // John Davies
      }
    ];

    for (const shiftInfo of generalShifts) {
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
            notes: `General shift assigned to ${worker.fullName}`,
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

        console.log(`✅ Created general shift: ${shiftInfo.title} to ${worker.fullName}`);
      }
    }
  }

  console.log(`🎉 Successfully created ${createdWorkers.length} John-like workers!`);
  console.log('');
  console.log('📋 John-like Worker Login Credentials:');
  console.log('=====================================');
  
  for (const worker of createdWorkers) {
    const workerData = johnLikeWorkers.find(w => w.email === worker.email);
    console.log(`👤 ${worker.fullName}`);
    console.log(`   📧 Email: ${worker.email}`);
    console.log(`   🔑 Password: Worker123!`);
    console.log(`   💰 Rate: £${workerData?.hourlyRate}/hour`);
    console.log('');
  }

  console.log('🎉 John-like worker seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
