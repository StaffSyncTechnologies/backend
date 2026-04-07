import { PrismaClient, SkillCategory } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding specialized workers...');

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

  // Specialized workers with specific roles
  const specializedWorkers = [
    {
      email: 'john.warehouse@staffsync-demo.com',
      fullName: 'John Warehouse',
      phone: '+44 7700 300001',
      niNumber: 'JW300001A',
      skills: ['Picking', 'Packing', 'RF Scanner', 'Counterbalance', 'Reach Truck', 'Forklift Licence'],
      hourlyRate: 13.50,
      specialty: 'Warehouse Operations',
      address: '123 Industrial Estate, Manchester',
      postcode: 'M1 3AB',
      dateOfBirth: new Date('1985-03-15')
    },
    {
      email: 'mary.nurse@staffsync-demo.com',
      fullName: 'Mary Nurse',
      phone: '+44 7700 300002',
      niNumber: 'MN300002B',
      skills: ['NMC Registered (Nurse)', 'Medication Administration', 'Wound Care', 'Phlebotomy', 'First Aid'],
      hourlyRate: 18.00,
      specialty: 'Healthcare Nursing',
      address: '456 Hospital Road, Birmingham',
      postcode: 'B2 1CD',
      dateOfBirth: new Date('1988-07-22')
    },
    {
      email: 'robert.security@staffsync-demo.com',
      fullName: 'Robert Security',
      phone: '+44 7700 300003',
      niNumber: 'RS300003C',
      skills: ['SIA Door Supervisor', 'CCTV Monitoring', 'Event Security', 'Patrol Duties', 'Conflict Management'],
      hourlyRate: 14.00,
      specialty: 'Security Services',
      address: '789 Security House, London',
      postcode: 'EC1A 2BB',
      dateOfBirth: new Date('1982-11-10')
    },
    {
      email: 'susan.cleaner@staffsync-demo.com',
      fullName: 'Susan Cleaner',
      phone: '+44 7700 300004',
      niNumber: 'SC300004D',
      skills: ['Deep Cleaning', 'Industrial Cleaning', 'Biohazard Cleaning', 'COSHH Trained', 'Waste Management'],
      hourlyRate: 12.00,
      specialty: 'Professional Cleaning',
      address: '321 Clean Street, Leeds',
      postcode: 'LS2 3DE',
      dateOfBirth: new Date('1990-05-18')
    },
    {
      email: 'paul.hospitality@staffsync-demo.com',
      fullName: 'Paul Hospitality',
      phone: '+44 7700 300005',
      niNumber: 'PH300005E',
      skills: ['Waiting / Table Service', 'Bar Work', 'Barista', 'Food Preparation', 'Food Hygiene Certificate'],
      hourlyRate: 11.50,
      specialty: 'Hospitality Services',
      address: '654 Restaurant Row, Bristol',
      postcode: 'BS1 4FG',
      dateOfBirth: new Date('1993-09-25')
    },
    {
      email: 'kevin.labour@staffsync-demo.com',
      fullName: 'Kevin Labour',
      phone: '+44 7700 300006',
      niNumber: 'KL300006F',
      skills: ['Construction Labour', 'General Labouring', 'CSCS Card', 'Manual Handling Certificate', 'Heavy Lifting'],
      hourlyRate: 12.50,
      specialty: 'Construction Labour',
      address: '987 Build Site, Glasgow',
      postcode: 'G2 1HI',
      dateOfBirth: new Date('1987-04-12')
    },
    {
      email: 'linda.care@staffsync-demo.com',
      fullName: 'Linda Care',
      phone: '+44 7700 300007',
      niNumber: 'LC300007G',
      skills: ['Personal Care', 'Dementia Care', 'Elderly Care', 'Moving & Handling', 'Safeguarding'],
      hourlyRate: 13.00,
      specialty: 'Elderly Care',
      address: '147 Care Home Lane, Liverpool',
      postcode: 'L1 2JK',
      dateOfBirth: new Date('1991-08-30')
    },
    {
      email: 'steve.forklift@staffsync-demo.com',
      fullName: 'Steve Forklift',
      phone: '+44 7700 300008',
      niNumber: 'SF300008H',
      skills: ['Forklift Licence', 'Counterbalance', 'Reach Truck', 'VNA (Very Narrow Aisle)', 'PPT (Powered Pallet Truck)'],
      hourlyRate: 15.00,
      specialty: 'Forklift Operations',
      address: '258 Warehouse Park, Sheffield',
      postcode: 'S3 4LM',
      dateOfBirth: new Date('1984-12-20')
    }
  ];

  const bcryptModule = await import('bcryptjs');
  const bcrypt = bcryptModule.default || bcryptModule;
  const workerPassword = await bcrypt.hash('Worker123!', 10);

  const createdWorkers = [];
  
  for (const workerData of specializedWorkers) {
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
          maxTravelDistance: 30,
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

      // Assign skills with appropriate experience levels
      for (const skillName of workerData.skills) {
        const skill = skillMap[skillName];
        if (skill) {
          let experienceLevel = '3-5_YEARS';
          
          // Set higher experience for core skills
          if (skillName.includes('Licence') || skillName.includes('Registered') || skillName.includes('Certificate')) {
            experienceLevel = '5+_YEARS';
          } else if (skillName.includes('Forklift') || skillName.includes('NMC')) {
            experienceLevel = '5+_YEARS';
          }
          
          await prisma.workerSkill.create({
            data: {
              workerId: worker.id,
              skillId: skill.id,
              experienceLevel,
            },
          });
        }
      }

      createdWorkers.push(worker);
      console.log(`✅ Created ${workerData.specialty} specialist: ${workerData.fullName} (${workerData.email})`);

    } catch (error) {
      console.error(`❌ Error creating worker ${workerData.email}:`, error);
    }
  }

  // Create specialized shifts for these workers
  console.log('📅 Creating specialized shifts for new workers...');
  
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
    const specializedShifts = [
      {
        title: 'Forklift Operator - Container Unloading',
        siteLocation: 'Port of Liverpool, Liverpool',
        startAt: new Date(tomorrow.setHours(6, 0, 0, 0)),
        endAt: new Date(tomorrow.setHours(14, 0, 0, 0)),
        workersNeeded: 2,
        payRate: 16.00,
        clientIndex: 0,
        workerIndex: 0, // John Warehouse
        priority: 'HIGH'
      },
      {
        title: 'Registered Nurse - ICU Ward',
        siteLocation: 'Royal Infirmary, Edinburgh',
        startAt: new Date(tomorrow.setHours(19, 0, 0, 0)),
        endAt: new Date(tomorrow.setHours(7, 0, 0, 0)),
        workersNeeded: 1,
        payRate: 22.00,
        clientIndex: 1,
        workerIndex: 1, // Mary Nurse
        priority: 'URGENT'
      },
      {
        title: 'SIA Security - VIP Event',
        siteLocation: 'Wembley Stadium, London',
        startAt: new Date(nextWeek.setHours(17, 0, 0, 0)),
        endAt: new Date(nextWeek.setHours(23, 0, 0, 0)),
        workersNeeded: 6,
        payRate: 18.00,
        clientIndex: 2,
        workerIndex: 2, // Robert Security
        priority: 'HIGH'
      },
      {
        title: 'Biohazard Deep Clean - Laboratory',
        siteLocation: 'Science Park, Cambridge',
        startAt: new Date(tomorrow.setHours(20, 0, 0, 0)),
        endAt: new Date(tomorrow.setHours(2, 0, 0, 0)),
        workersNeeded: 3,
        payRate: 18.50,
        clientIndex: 3,
        workerIndex: 3, // Susan Cleaner
        priority: 'URGENT'
      },
      {
        title: 'Fine Dining Service - Michelin Restaurant',
        siteLocation: 'The Ritz, London',
        startAt: new Date(tomorrow.setHours(18, 0, 0, 0)),
        endAt: new Date(tomorrow.setHours(23, 0, 0, 0)),
        workersNeeded: 4,
        payRate: 15.00,
        clientIndex: 0,
        workerIndex: 4, // Paul Hospitality
        priority: 'HIGH'
      },
      {
        title: 'Construction Labour - High Rise Build',
        siteLocation: 'Canary Wharf, London',
        startAt: new Date(tomorrow.setHours(7, 0, 0, 0)),
        endAt: new Date(tomorrow.setHours(15, 0, 0, 0)),
        workersNeeded: 8,
        payRate: 14.00,
        clientIndex: 0,
        workerIndex: 5, // Kevin Labour
        priority: 'NORMAL'
      },
      {
        title: 'Elderly Care - Dementia Ward',
        siteLocation: 'Sunrise Care Home, Manchester',
        startAt: new Date(tomorrow.setHours(14, 0, 0, 0)),
        endAt: new Date(tomorrow.setHours(22, 0, 0, 0)),
        workersNeeded: 2,
        payRate: 14.50,
        clientIndex: 1,
        workerIndex: 6, // Linda Care
        priority: 'HIGH'
      },
      {
        title: 'VNA Truck Driver - Narrow Aisle',
        siteLocation: 'Amazon Warehouse, Peterborough',
        startAt: new Date(tomorrow.setHours(22, 0, 0, 0)),
        endAt: new Date(tomorrow.setHours(6, 0, 0, 0)),
        workersNeeded: 2,
        payRate: 17.00,
        clientIndex: 0,
        workerIndex: 7, // Steve Forklift
        priority: 'HIGH'
      }
    ];

    for (const shiftInfo of specializedShifts) {
      if (shiftInfo.workerIndex < createdWorkers.length && shiftInfo.clientIndex < clients.length) {
        const client = clients[shiftInfo.clientIndex];
        const worker = createdWorkers[shiftInfo.workerIndex];
        const workerData = specializedWorkers.find(w => w.email === worker.email);

        const shift = await prisma.shift.create({
          data: {
            title: shiftInfo.title,
            siteLocation: shiftInfo.siteLocation,
            startAt: shiftInfo.startAt,
            endAt: shiftInfo.endAt,
            workersNeeded: shiftInfo.workersNeeded,
            payRate: shiftInfo.payRate,
            status: 'FILLED',
            priority: shiftInfo.priority as any,
            notes: `Specialized shift assigned to ${worker.fullName} (${workerData?.specialty})`,
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

        console.log(`✅ Created specialized shift: ${shiftInfo.title} to ${worker.fullName}`);
      }
    }
  }

  console.log(`🎉 Successfully created ${createdWorkers.length} specialized workers!`);
  console.log('');
  console.log('📋 Specialized Worker Login Credentials:');
  console.log('=====================================');
  
  for (const worker of createdWorkers) {
    const workerData = specializedWorkers.find(w => w.email === worker.email);
    console.log(`👤 ${worker.fullName} - ${workerData?.specialty}`);
    console.log(`   📧 Email: ${worker.email}`);
    console.log(`   🔑 Password: Worker123!`);
    console.log(`   💰 Rate: £${workerData?.hourlyRate}/hour`);
    console.log('');
  }

  console.log('🎉 Specialized worker seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
