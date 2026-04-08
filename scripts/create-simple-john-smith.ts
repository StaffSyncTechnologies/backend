import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createSimpleJohnSmith() {
  try {
    console.log('Creating John Smith account for Google testing...');

    // Find StaffSync Demo Agency
    const organization = await prisma.organization.findFirst({
      where: { name: { contains: 'StaffSync Demo' } }
    });

    if (!organization) {
      console.log('StaffSync Demo Agency not found. Please run main seed first.');
      return;
    }

    console.log('Found organization:', organization.name);

    // Check if john.smith@test.com already exists
    const existingJohn = await prisma.user.findFirst({
      where: { email: 'john.smith@test.com' }
    });

    if (existingJohn) {
      console.log('john.smith@test.com already exists:');
      console.log('Email:', existingJohn.email);
      console.log('Password: worker123');
      return;
    }

    // Create John Smith with minimal required fields
    const johnSmith = await prisma.user.create({
      data: {
        email: 'john.smith@test.com',
        fullName: 'John Smith',
        role: 'WORKER',
        organizationId: organization.id,
        passwordHash: 'worker123', // Simple password for testing
        emailVerified: true,
      }
    });

    console.log('Created John Smith user:', johnSmith.email);

    console.log('\nJohn Smith created successfully for Google testing!');
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

createSimpleJohnSmith();
