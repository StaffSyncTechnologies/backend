// ============================================================
// SEED: ADD SECOND AGENCY FOR TESTING CLIENT SWITCHING
// ============================================================

import { PrismaClient, UserRole, UserStatus, DeploymentMode, ClientStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seedSecondAgency() {
  console.log('🏢 Creating second agency (Acme Corporation)...');

  try {
    // Create Acme Corporation organization
    let acmeOrganization = await prisma.organization.findFirst({
      where: { name: 'Acme Corporation' },
    });

    if (!acmeOrganization) {
      acmeOrganization = await prisma.organization.create({
        data: {
          name: 'Acme Corporation',
          deploymentMode: 'AGENCY',
          email: 'info@acmecorporation.com',
          phone: '+44 20 7123 4567',
          address: '456 Business Avenue, Manchester, UK',
          tradingName: 'Acme Staffing Solutions',
          registrationNumber: 'AC123456',
          vatNumber: 'GB123456789',
          website: 'https://acmecorporation.com',
          industry: 'Healthcare Staffing',
          numberOfWorkers: '500+',
          primaryColor: '#2563eb',
          secondaryColor: '#64748b',
          onboardingComplete: true,
          plan: 'STARTER',
          trialEndsAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 180 days
        },
      });
      console.log('✅ Created Acme Corporation organization');
    } else {
      console.log('✅ Acme Corporation organization already exists');
    }

    // Create admin user for Acme Corporation
    const adminPassword = await bcrypt.hash('Admin123!', 10);
    const acmeAdmin = await prisma.user.upsert({
      where: { organizationId_email: { organizationId: acmeOrganization.id, email: 'admin@acmecorporation.com' } },
      update: {},
      create: {
        email: 'admin@acmecorporation.com',
        passwordHash: adminPassword,
        fullName: 'Acme Admin',
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        organizationId: acmeOrganization.id,
        emailVerified: true,
        phone: '+44 7700 900003',
      },
    });

    console.log('✅ Created Acme admin user (admin@acmecorporation.com / Admin123!)');

    // Create additional staff for Acme Corporation
    const acmeOpsPassword = await bcrypt.hash('Admin123!', 10);
    const acmeOpsManager = await prisma.user.upsert({
      where: { organizationId_email: { organizationId: acmeOrganization.id, email: 'ops@acmecorporation.com' } },
      update: {},
      create: {
        email: 'ops@acmecorporation.com',
        passwordHash: acmeOpsPassword,
        fullName: 'Acme Operations Manager',
        role: UserRole.OPS_MANAGER,
        status: UserStatus.ACTIVE,
        organizationId: acmeOrganization.id,
        emailVerified: true,
        phone: '+44 7700 900004',
        teamNumber: 'AC-20260101-0001',
      },
    });

    const acmeCoordinatorPassword = await bcrypt.hash('Admin123!', 10);
    const acmeCoordinator = await prisma.user.upsert({
      where: { organizationId_email: { organizationId: acmeOrganization.id, email: 'coordinator@acmecorporation.com' } },
      update: { managerId: acmeOpsManager.id },
      create: {
        email: 'coordinator@acmecorporation.com',
        passwordHash: acmeCoordinatorPassword,
        fullName: 'Acme Shift Coordinator',
        role: UserRole.SHIFT_COORDINATOR,
        status: UserStatus.ACTIVE,
        organizationId: acmeOrganization.id,
        emailVerified: true,
        phone: '+44 7700 900005',
        teamNumber: 'AC-20260101-0002',
        managerId: acmeOpsManager.id,
      },
    });

    const acmeCompliancePassword = await bcrypt.hash('Admin123!', 10);
    const acmeCompliance = await prisma.user.upsert({
      where: { organizationId_email: { organizationId: acmeOrganization.id, email: 'compliance@acmecorporation.com' } },
      update: {},
      create: {
        email: 'compliance@acmecorporation.com',
        passwordHash: acmeCompliancePassword,
        fullName: 'Acme Compliance Officer',
        role: UserRole.COMPLIANCE_OFFICER,
        status: UserStatus.ACTIVE,
        organizationId: acmeOrganization.id,
        emailVerified: true,
        phone: '+44 7700 900006',
        teamNumber: 'AC-20260101-0003',
      },
    });

    console.log('✅ Created Acme staff users');
    console.log('   - ops@acmecorporation.com / Admin123!');
    console.log('   - coordinator@acmecorporation.com / Admin123!');
    console.log('   - compliance@acmecorporation.com / Admin123!');

    // Create subscription for Acme Corporation
    const trialEnd = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000); // 180 days
    const existingSubscription = await prisma.subscription.findUnique({
      where: { organizationId: acmeOrganization.id },
    });

    if (!existingSubscription) {
      await prisma.subscription.create({
        data: {
          organizationId: acmeOrganization.id,
          planTier: 'STARTER',
          status: 'TRIALING',
          workerLimit: 500,
          clientLimit: 50,
          currentPeriodStart: new Date(),
          currentPeriodEnd: trialEnd,
          trialStart: new Date(),
          trialEnd: trialEnd,
        },
      });

      // Update organization with trial end date
      await prisma.organization.update({
        where: { id: acmeOrganization.id },
        data: { trialEndsAt: trialEnd },
      });

      console.log('✅ Created Acme Corporation subscription (180-day trial)');
    }

    // Create some sample clients for Acme Corporation
    const acmeClients = [
      {
        name: 'Manchester General Hospital',
        address: 'Hospital Lane, Manchester, M1 2AB',
        city: 'Manchester',
        postcode: 'M1 2AB',
        contactName: 'Sarah Johnson',
        contactEmail: 'sarah.j@mgh.nhs.uk',
        contactPhone: '+44 161 123 4567',
        defaultPayRate: 15.50,
        defaultChargeRate: 22.00,
        industry: 'Healthcare',
        registrationNumber: 'NHS_TRUST_001',
      },
      {
        name: 'Royal Care Home',
        address: 'Care Street, Manchester, M3 4CD',
        city: 'Manchester',
        postcode: 'M3 4CD',
        contactName: 'David Smith',
        contactEmail: 'david@royalcare.co.uk',
        contactPhone: '+44 161 234 5678',
        defaultPayRate: 12.00,
        defaultChargeRate: 18.00,
        industry: 'Elderly Care',
        registrationNumber: 'CARE_HOME_001',
      },
      {
        name: 'Urgent Care Clinic',
        address: 'Clinic Road, Manchester, M2 5EF',
        city: 'Manchester',
        postcode: 'M2 5EF',
        contactName: 'Emma Wilson',
        contactEmail: 'emma@urgentcare.co.uk',
        contactPhone: '+44 161 345 6789',
        defaultPayRate: 18.00,
        defaultChargeRate: 25.00,
        industry: 'Healthcare',
        registrationNumber: 'CLINIC_001',
      },
    ];

    for (const clientData of acmeClients) {
      const existingClient = await prisma.clientCompany.findFirst({
        where: { 
          organizationId: acmeOrganization.id, 
          name: clientData.name 
        },
      });

      if (!existingClient) {
        await prisma.clientCompany.create({
          data: {
            ...clientData,
            organizationId: acmeOrganization.id,
            status: ClientStatus.ACTIVE,
          },
        });
        console.log(`✅ Created Acme client: ${clientData.name}`);
      }
    }

    // Create invite code for Acme Corporation
    const acmeInviteCode = 'ACME-WORKER-2024';
    const acmeCodeHash = await bcrypt.hash(acmeInviteCode, 10);
    const existingAcmeInviteCode = await prisma.inviteCode.findFirst({
      where: { organizationId: acmeOrganization.id },
    });

    if (!existingAcmeInviteCode) {
      await prisma.inviteCode.create({
        data: {
          organizationId: acmeOrganization.id,
          code: acmeInviteCode,
          codeHash: acmeCodeHash,
          type: 'WORKER',
          usageType: 'MULTI_USE',
          status: 'ACTIVE',
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
          createdBy: acmeAdmin.id,
        },
      });

      console.log(`✅ Created Acme invite code: ${acmeInviteCode}`);
    }

    // Create sample workers for Acme Corporation
    const acmeWorkers = [
      {
        email: 'nurse.brown@acmecorporation.com',
        fullName: 'Nurse Rebecca Brown',
        phone: '+44 7700 900010',
        niNumber: 'AB123456C',
        address: '123 Nurse Street, Manchester, M1 1AA',
        postcode: 'M1 1AA',
        bankAccount: '12345678',
        sortCode: '20-30-40',
      },
      {
        email: 'carer.davis@acmecorporation.com',
        fullName: 'Carer James Davis',
        phone: '+44 7700 900011',
        niNumber: 'CD789012E',
        address: '456 Care Avenue, Manchester, M2 2BB',
        postcode: 'M2 2BB',
        bankAccount: '87654321',
        sortCode: '40-50-60',
      },
      {
        email: 'support.wilson@acmecorporation.com',
        fullName: 'Support Worker Emma Wilson',
        phone: '+44 7700 900012',
        niNumber: 'EF345678G',
        address: '789 Support Road, Manchester, M3 3CC',
        postcode: 'M3 3CC',
        bankAccount: '13579246',
        sortCode: '60-70-80',
      },
    ];

    const workerPassword = await bcrypt.hash('Worker123!', 10);
    for (const workerData of acmeWorkers) {
      const existingWorker = await prisma.user.findFirst({
        where: { 
          organizationId: acmeOrganization.id, 
          email: workerData.email 
        },
      });

      if (!existingWorker) {
        const worker = await prisma.user.create({
          data: {
            email: workerData.email,
            passwordHash: workerPassword,
            fullName: workerData.fullName,
            role: UserRole.WORKER,
            status: UserStatus.ACTIVE,
            organizationId: acmeOrganization.id,
            emailVerified: true,
            phone: workerData.phone,
            niNumber: workerData.niNumber,
            managerId: acmeCoordinator.id,
          },
        });

        // Create worker organization membership
        await prisma.workerOrgMembership.create({
          data: {
            workerId: worker.id,
            organizationId: acmeOrganization.id,
            status: 'ACTIVE',
            acceptedAt: new Date(),
          },
        });

        console.log(`✅ Created Acme worker: ${workerData.fullName}`);
      }
    }

    console.log('\n🎉 Acme Corporation setup complete!');
    console.log('\n📋 Login Credentials:');
    console.log('🔑 Admin: admin@acmecorporation.com / Admin123!');
    console.log('🔑 Ops: ops@acmecorporation.com / Admin123!');
    console.log('🔑 Coordinator: coordinator@acmecorporation.com / Admin123!');
    console.log('🔑 Compliance: compliance@acmecorporation.com / Admin123!');
    console.log('🔑 Workers: *.acmecorporation.com / Worker123!');
    console.log('\n🎫 Worker Invite Code: ACME-WORKER-2024');
    console.log('\n📊 This agency can now be used for client switching tests!');

  } catch (error) {
    console.error('❌ Error seeding Acme Corporation:', error);
    throw error;
  }
}

// Run the seed
seedSecondAgency()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
