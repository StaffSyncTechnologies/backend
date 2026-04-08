import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createJohnSmithEmail() {
  try {
    console.log('Checking/Creating john.smith@email.com...');

    // Find StaffSync Demo Agency
    const organization = await prisma.organization.findFirst({
      where: { name: { contains: 'StaffSync Demo' } }
    });

    if (!organization) {
      console.log('StaffSync Demo Agency not found. Please run main seed first.');
      return;
    }

    console.log('Found organization:', organization.name);

    // Check if john.smith@email.com already exists
    const existingJohn = await prisma.user.findFirst({
      where: { email: 'john.smith@email.com' },
      include: { organization: true }
    });

    if (existingJohn) {
      console.log('john.smith@email.com already exists:');
      console.log('Email:', existingJohn.email);
      console.log('Full Name:', existingJohn.fullName);
      console.log('Password: Worker123!');
      return;
    }

    // Create John Smith with email.com domain
    const johnSmith = await prisma.user.create({
      data: {
        email: 'john.smith@email.com',
        fullName: 'John Smith',
        role: 'WORKER',
        organizationId: organization.id,
        passwordHash: 'Worker123!',
        emailVerified: true,
      }
    });

    console.log('Created John Smith user:', johnSmith.email);

    console.log('\nJohn Smith created successfully!');
    console.log('Login Details:');
    console.log('Email: john.smith@email.com');
    console.log('Password: Worker123!');
    console.log('Organization: StaffSync Demo Agency');

  } catch (error) {
    console.error('Error creating John Smith:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createJohnSmithEmail();
