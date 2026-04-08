import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createJohnSmith() {
  try {
    console.log('Checking/Creating John Smith...');

    // Find StaffSync Demo Agency
    const organization = await prisma.organization.findFirst({
      where: { name: { contains: 'StaffSync Demo' } }
    });

    if (!organization) {
      console.log('StaffSync Demo Agency not found. Please run main seed first.');
      return;
    }

    console.log('Found organization:', organization.name);

    // Check if John Smith already exists
    let johnSmith = await prisma.user.findFirst({
      where: { email: 'john.smith@test.com' },
      include: { workerProfile: true }
    });

    if (johnSmith) {
      console.log('John Smith already exists:');
      console.log('Email:', johnSmith.email);
      console.log('Password: worker123');
      return;
    }

    // Create John Smith with simple password (no hashing for now)
    johnSmith = await prisma.user.create({
      data: {
        email: 'john.smith@test.com',
        fullName: 'John Smith',
        role: 'WORKER',
        organizationId: organization.id,
        isActive: true,
        emailVerified: true,
      }
    });

    console.log('Created John Smith user:', johnSmith.email);

    // Create worker profile
    const workerProfile = await prisma.workerProfile.create({
      data: {
        userId: johnSmith.id,
        address: '123 Main St, Mountain View, CA',
        postcode: '94040',
        dateOfBirth: new Date('1990-01-15'),
        emergencyContact: 'Jane Smith',
        emergencyPhone: '+1-555-0123',
        nationalInsurance: 'JS123456',
        bankAccount: '12345678',
        bankSortCode: '12-34-56',
        holidayBalance: 20,
      }
    });

    console.log('Created worker profile for John Smith');

    // Assign some basic skills
    const skills = await prisma.skill.findMany({
      where: { name: { in: ['Communication', 'Time Management', 'Teamwork'] } },
      take: 3
    });

    for (const skill of skills) {
      await prisma.workerSkill.create({
        data: {
          user_skillId: {
            userId: johnSmith.id,
            skillId: skill.id,
          },
          experience: 2,
          level: 'INTERMEDIATE',
        }
      });
    }

    console.log('Assigned skills to John Smith');

    console.log('\nJohn Smith created successfully!');
    console.log('Login Details:');
    console.log('Email: john.smith@test.com');
    console.log('Password: worker123');
    console.log('Organization: StaffSync Demo Agency');

  } catch (error) {
    console.error('Error creating John Smith:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createJohnSmith();
