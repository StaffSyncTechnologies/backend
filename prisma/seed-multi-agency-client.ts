import { prisma } from '../src/lib/prisma';
import bcrypt from 'bcryptjs';

async function seedMultiAgencyClient() {
  console.log('🌱 Seeding multi-agency client user...');

  try {
    // Find or create client companies
    const agency1 = await prisma.clientCompany.findFirst({
      where: { name: { contains: 'Health', mode: 'insensitive' } }
    }) || await prisma.clientCompany.create({
      data: {
        organizationId: (await prisma.organization.findFirst())!.id,
        name: 'Healthcare Agency Ltd',
        defaultPayRate: 25.00,
        address: '123 Medical Street, Health City',
        contactEmail: 'contact@healthcare.com',
        contactPhone: '+1234567890',
      },
    });

    const agency2 = await prisma.clientCompany.findFirst({
      where: { name: { contains: 'Industrial', mode: 'insensitive' } }
    }) || await prisma.clientCompany.create({
      data: {
        organizationId: (await prisma.organization.findFirst())!.id,
        name: 'Industrial Solutions Inc',
        defaultPayRate: 22.50,
        address: '456 Factory Road, Industrial Park',
        contactEmail: 'info@industrial.com',
        contactPhone: '+0987654321',
      },
    });

    // Create client user
    const email = 'multiagency@client.com';
    const hashedPin = await bcrypt.hash('1234', 10);

    let clientUser = await prisma.clientUser.findUnique({
      where: { clientCompanyId_email: { clientCompanyId: agency1.id, email } },
    });

    if (!clientUser) {
      clientUser = await prisma.clientUser.create({
        data: {
          clientCompanyId: agency1.id, // Primary agency
          email,
          fullName: 'Multi Agency Client',
          role: 'CLIENT_ADMIN',
          passwordHash: hashedPin,
          status: 'ACTIVE',
        },
      });
    }

    // Create agency assignments
    await prisma.clientAgencyAssignment.deleteMany({
      where: { clientUserId: clientUser.id },
    });

    // Primary agency assignment
    await prisma.clientAgencyAssignment.create({
      data: {
        clientUserId: clientUser.id,
        clientCompanyId: agency1.id,
        isPrimary: true,
        status: 'ACTIVE',
        joinedAt: new Date(),
      },
    });

    // Secondary agency assignment
    await prisma.clientAgencyAssignment.create({
      data: {
        clientUserId: clientUser.id,
        clientCompanyId: agency2.id,
        isPrimary: false,
        status: 'ACTIVE',
        joinedAt: new Date(),
      },
    });

    console.log('✅ Multi-agency client user created successfully!');
    console.log(`📧 Email: ${email}`);
    console.log('🔑 PIN: 1234');
    console.log(`🏢 Primary Agency: ${agency1.name}`);
    console.log(`🏢 Secondary Agency: ${agency2.name}`);

  } catch (error) {
    console.error('❌ Error seeding multi-agency client:', error);
    throw error;
  }
}

// Run the seed
seedMultiAgencyClient()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
