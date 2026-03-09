import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { exit } from 'process';

// Use the remote database URL from .env
const DATABASE_URL = "postgresql://staffsync_97y9_user:C4kD8ioJWWGXslW7TArnw6ro0gtEyQLz@dpg-d6maih7kijhs73frn22g-a.oregon-postgres.render.com/staffsync_97y9";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL,
    },
  },
});

async function seedRemoteData() {
  try {
    console.log('🌱 Seeding remote database with test data...');

    // Find or create the organization
    let organization = await prisma.organization.findFirst();
    if (!organization) {
      organization = await prisma.organization.create({
        data: {
          name: 'Test Organization',
          deploymentMode: 'AGENCY',
          primaryColor: '#38BDF8',
          secondaryColor: '#1E40AF',
          onboardingComplete: true,
        },
      });
      console.log('✅ Created organization:', organization.name);
    }

    // Create admin user if not exists
    let adminUser = await prisma.user.findFirst({
      where: { email: 'admin@test.com' },
    });
    if (!adminUser) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      adminUser = await prisma.user.create({
        data: {
          organizationId: organization.id,
          role: 'ADMIN',
          fullName: 'Admin User',
          email: 'admin@test.com',
          passwordHash: hashedPassword,
          status: 'ACTIVE',
          emailVerified: true,
        },
      });
      console.log('✅ Created admin user:', adminUser.email);
    }

    // Create manager user if not exists
    let managerUser = await prisma.user.findFirst({
      where: { email: 'manager@test.com' },
    });
    if (!managerUser) {
      const hashedPassword = await bcrypt.hash('manager123', 10);
      managerUser = await prisma.user.create({
        data: {
          organizationId: organization.id,
          managerId: adminUser.id,
          role: 'OPS_MANAGER',
          fullName: 'Manager User',
          email: 'manager@test.com',
          passwordHash: hashedPassword,
          status: 'ACTIVE',
          emailVerified: true,
        },
      });
      console.log('✅ Created manager user:', managerUser.email);
    }

    // Create John Smith worker if not exists
    let johnSmith = await prisma.user.findFirst({
      where: { email: 'john.smith@test.com' },
    });
    if (!johnSmith) {
      const hashedPassword = await bcrypt.hash('worker123', 10);
      johnSmith = await prisma.user.create({
        data: {
          organizationId: organization.id,
          managerId: managerUser.id,
          role: 'WORKER',
          fullName: 'John Smith',
          email: 'john.smith@test.com',
          passwordHash: hashedPassword,
          status: 'ACTIVE',
          emailVerified: true,
          teamNumber: 'WS001',
        },
      });

      // Create worker profile
      await prisma.workerProfile.create({
        data: {
          userId: johnSmith.id,
          rtwStatus: 'APPROVED',
          onboardingStatus: 'COMPLETE',
          emergencyContact: 'Jane Smith',
          emergencyPhone: '+447700900123',
        },
      });

      console.log('✅ Created John Smith worker:', johnSmith.email);
    }

    // Create a test client company
    let clientCompany = await prisma.clientCompany.findFirst({
      where: { name: 'Test Client Ltd' },
    });
    if (!clientCompany) {
      clientCompany = await prisma.clientCompany.create({
        data: {
          organizationId: organization.id,
          name: 'Test Client Ltd',
          address: '123 Test Street, London, UK',
          industry: 'Healthcare',
          contactName: 'Contact Person',
          contactEmail: 'contact@testclient.com',
          contactPhone: '+447700900999',
        },
      });
      console.log('✅ Created client company:', clientCompany.name);
    }

    // Assign manager to client company
    const managerAssignment = await prisma.staffCompanyAssignment.findFirst({
      where: {
        staffId: managerUser.id,
        clientCompanyId: clientCompany.id,
      },
    });
    if (!managerAssignment) {
      await prisma.staffCompanyAssignment.create({
        data: {
          staffId: managerUser.id,
          clientCompanyId: clientCompany.id,
          status: 'ACTIVE',
        },
      });
      console.log('✅ Assigned manager to client company');
    }

    // Create a test location
    let location = await prisma.location.findFirst({
      where: { name: 'Test Hospital' },
    });
    if (!location) {
      location = await prisma.location.create({
        data: {
          organizationId: organization.id,
          name: 'Test Hospital',
          address: '123 Test Street, London, UK',
          latitude: 51.5074,
          longitude: -0.1278,
          geofenceRadius: 300,
        },
      });
      console.log('✅ Created location:', location.name);
    }

    // Create a test shift for today (in 2 hours from now)
    const now = new Date();
    const startTime = new Date(now.getTime() + (2 * 60 * 60 * 1000)); // 2 hours from now
    const endTime = new Date(startTime.getTime() + (8 * 60 * 60 * 1000)); // 8 hours later

    let testShift = await prisma.shift.findFirst({
      where: {
        title: 'Day Shift - Test Hospital',
        startAt: startTime,
      },
    });
    if (!testShift) {
      testShift = await prisma.shift.create({
        data: {
          organizationId: organization.id,
          clientCompanyId: clientCompany.id,
          locationId: location.id,
          title: 'Day Shift - Test Hospital',
          role: 'Healthcare Assistant',
          siteLocation: 'Test Hospital, Main Ward',
          siteLat: 51.5074,
          siteLng: -0.1278,
          startAt: startTime,
          endAt: endTime,
          breakMinutes: 30,
          hourlyRate: 12.50,
          workersNeeded: 1,
          status: 'FILLED',
          priority: 'NORMAL',
          createdBy: managerUser.id,
        },
      });
      console.log('✅ Created test shift:', testShift.title);
      console.log(`   Start: ${startTime.toISOString()}`);
      console.log(`   End: ${endTime.toISOString()}`);
    }

    // Assign John Smith to the shift
    const shiftAssignment = await prisma.shiftAssignment.findFirst({
      where: {
        shiftId: testShift.id,
        workerId: johnSmith.id,
      },
    });
    if (!shiftAssignment) {
      await prisma.shiftAssignment.create({
        data: {
          shiftId: testShift.id,
          workerId: johnSmith.id,
          status: 'ACCEPTED',
          acceptedAt: new Date(),
        },
      });
      console.log('✅ Assigned John Smith to test shift');
    }

    console.log('\n🎉 Remote database seeding completed!');
    console.log('\n📱 Login credentials:');
    console.log('John Smith (Worker): john.smith@test.com / worker123');
    console.log('Manager: manager@test.com / manager123');
    console.log('Admin: admin@test.com / admin123');
    console.log('\n📍 Shift details:');
    console.log(`Shift: ${testShift.title}`);
    console.log(`Time: ${startTime.toLocaleString()} - ${endTime.toLocaleString()}`);
    console.log(`Location: ${location.name} (Lat: ${location.latitude}, Lng: ${location.longitude})`);
    console.log(`Geofence radius: ${location.geofenceRadius}m`);

  } catch (error) {
    console.error('❌ Error seeding remote data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    exit(0);
  }
}

seedRemoteData();
