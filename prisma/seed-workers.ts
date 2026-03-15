import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedWorkers() {
  console.log('🌱 Starting to seed workers...');

  try {
    // Create sample skills
    const skills = await Promise.all([
      prisma.skill.upsert({ where: { name: 'Nursing' }, update: {}, create: { name: 'Nursing' } }),
      prisma.skill.upsert({ where: { name: 'Care' }, update: {}, create: { name: 'Care' } }),
      prisma.skill.upsert({ where: { name: 'First Aid' }, update: {}, create: { name: 'First Aid' } }),
      prisma.skill.upsert({ where: { name: 'Medication' }, update: {}, create: { name: 'Medication' } }),
      prisma.skill.upsert({ where: { name: 'Emergency' }, update: {}, create: { name: 'Emergency' } }),
      prisma.skill.upsert({ where: { name: 'Support' }, update: {}, create: { name: 'Support' } }),
      prisma.skill.upsert({ where: { name: 'Communication' }, update: {}, create: { name: 'Communication' } }),
      prisma.skill.upsert({ where: { name: 'Time Management' }, update: {}, create: { name: 'Time Management' } }),
    ]);

    const skillMap = skills.reduce((map, skill) => {
      map[skill.name] = skill;
      return map;
    }, {} as Record<string, any>);

    // Sample workers data
    const workers = [
      {
        fullName: 'Sarah Johnson',
        email: 'sarah.johnson@staffsync.com',
        phone: '+447700900123',
        skills: ['Nursing', 'Care', 'First Aid', 'Medication'],
        performance: 0.95,
        location: { lat: 51.5074, lng: -0.1278 }, // London
        available: true,
      },
      {
        fullName: 'Michael Chen',
        email: 'michael.chen@staffsync.com',
        phone: '+447700900124',
        skills: ['Care', 'Support', 'Communication'],
        performance: 0.85,
        location: { lat: 51.5074, lng: -0.1278 }, // London
        available: true,
      },
      {
        fullName: 'Emma Williams',
        email: 'emma.williams@staffsync.com',
        phone: '+447700900125',
        skills: ['Nursing', 'Emergency', 'First Aid'],
        performance: 0.90,
        location: { lat: 51.5074, lng: -0.1278 }, // London
        available: true,
      },
      {
        fullName: 'James Brown',
        email: 'james.brown@staffsync.com',
        phone: '+447700900126',
        skills: ['Support', 'Care', 'Time Management'],
        performance: 0.75,
        location: { lat: 51.5074, lng: -0.1278 }, // London
        available: true,
      },
      {
        fullName: 'Olivia Davis',
        email: 'olivia.davis@staffsync.com',
        phone: '+447700900127',
        skills: ['First Aid', 'Emergency', 'Communication'],
        performance: 0.88,
        location: { lat: 51.5074, lng: -0.1278 }, // London
        available: true,
      },
      {
        fullName: 'Robert Miller',
        email: 'robert.miller@staffsync.com',
        phone: '+447700900128',
        skills: ['Nursing', 'Medication', 'Care'],
        performance: 0.82,
        location: { lat: 51.5074, lng: -0.1278 }, // London
        available: true,
      },
      {
        fullName: 'Sophia Wilson',
        email: 'sophia.wilson@staffsync.com',
        phone: '+447700900129',
        skills: ['Support', 'Communication', 'Time Management'],
        performance: 0.70,
        location: { lat: 51.5074, lng: -0.1278 }, // London
        available: true,
      },
      {
        fullName: 'Daniel Moore',
        email: 'daniel.moore@staffsync.com',
        phone: '+447700900130',
        skills: ['Emergency', 'First Aid', 'Care'],
        performance: 0.92,
        location: { lat: 51.5074, lng: -0.1278 }, // London
        available: true,
      },
      {
        fullName: 'Isabella Taylor',
        email: 'isabella.taylor@staffsync.com',
        phone: '+447700900131',
        skills: ['Nursing', 'Care', 'Communication'],
        performance: 0.78,
        location: { lat: 51.5074, lng: -0.1278 }, // London
        available: true,
      },
      {
        fullName: 'William Anderson',
        email: 'william.anderson@staffsync.com',
        phone: '+447700900132',
        skills: ['Support', 'Time Management', 'Care'],
        performance: 0.65,
        location: { lat: 51.5074, lng: -0.1278 }, // London
        available: true,
      },
    ];

    console.log(`👥 Creating ${workers.length} workers...`);

    for (const workerData of workers) {
      // Create user
      const user = await prisma.user.upsert({
        where: { email: workerData.email },
        update: {},
        create: {
          fullName: workerData.fullName,
          email: workerData.email,
          phone: workerData.phone,
          role: 'WORKER',
          status: 'ACTIVE',
        },
      });

      // Create worker profile
      const profile = await prisma.workerProfile.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          experience: Math.floor(Math.random() * 10) + 1, // 1-10 years
          rating: workerData.performance * 5, // Convert to 5-star scale
          bio: `Experienced ${workerData.skills[0]} professional with excellent communication skills.`,
          preferredShifts: ['MORNING', 'AFTERNOON', 'EVENING'],
          hourlyRate: Math.floor(Math.random() * 10) + 15, // £15-25 per hour
        },
      });

      // Create worker location
      await prisma.workerLocation.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          address: 'London, UK',
          city: 'London',
          postalCode: 'SW1A 1AA',
          latitude: workerData.location.lat,
          longitude: workerData.location.lng,
          maxTravelDistance: 20, // 20 km
        },
      });

      // Create worker skills
      for (const skillName of workerData.skills) {
        await prisma.workerSkill.upsert({
          where: {
            userId_skillId: {
              userId: user.id,
              skillId: skillMap[skillName].id,
            },
          },
          update: {},
          create: {
            userId: user.id,
            skillId: skillMap[skillName].id,
            proficiency: 'ADVANCED',
            yearsExperience: Math.floor(Math.random() * 5) + 1,
          },
        });
      }

      // Create worker availability (available for next 30 days)
      const today = new Date();
      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        
        await prisma.workerAvailability.upsert({
          where: {
            userId_date: {
              userId: user.id,
              date: date,
            },
          },
          update: {},
          create: {
            userId: user.id,
            date: date,
            isAvailable: workerData.available,
            preferredShifts: ['MORNING', 'AFTERNOON', 'EVENING'],
          },
        });
      }

      console.log(`✅ Created worker: ${workerData.fullName}`);
    }

    console.log('🎉 Workers seeded successfully!');
    
    // Create a sample shift for testing
    console.log('📅 Creating sample shift...');
    
    const shift = await prisma.shift.create({
      data: {
        title: 'Emergency Care Support - Night Shift',
        description: 'Urgent need for experienced care support worker for night shift',
        clientId: 'client-demo-id', // This would be a real client ID
        startAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        endAt: new Date(Date.now() + 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000), // Tomorrow + 8 hours
        payRate: 22.50,
        location: 'London General Hospital',
        latitude: 51.5074,
        longitude: -0.1278,
        status: 'OPEN',
        requiredSkills: {
          create: [
            { skillId: skillMap['Care'].id, priority: 'REQUIRED' },
            { skillId: skillMap['First Aid'].id, priority: 'REQUIRED' },
            { skillId: skillMap['Nursing'].id, priority: 'PREFERRED' },
          ],
        },
      },
    });

    console.log(`✅ Created sample shift: ${shift.id}`);
    console.log('🎯 Database seeding complete!');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}

seedWorkers()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
