import { PrismaClient } from '@prisma/client';
import { exit } from 'process';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const DATABASE_URL = "postgresql://neondb_owner:npg_Q29bTqnxMpUe@ep-dawn-breeze-abnc271v.eu-west-2.aws.neon.tech/neondb?sslmode=require";

const prisma = new PrismaClient({
  datasources: { db: { url: DATABASE_URL } },
});

/**
 * Seed nearby agencies with locations around the Android Emulator default
 * (Mountain View — 37.422, -122.084) plus Bay Area & London.
 */
const agencies = [
  // --- Mountain View / Googleplex area (closest to emulator at 37.422, -122.084) ---
  {
    name: 'Mountain View Care Services',
    email: 'hire@mvcare.com',
    phone: '+16505550010',
    website: 'www.mvcare.com',
    address: '1600 Amphitheatre Pkwy, Mountain View, CA 94043',
    primaryColor: '#0EA5E9',
    secondaryColor: '#0284C7',
    location: {
      name: 'Mountain View HQ',
      address: '1600 Amphitheatre Pkwy, Mountain View, CA 94043',
      latitude: 37.4220,
      longitude: -122.0841,
      contactPhone: '+16505550010',
      contactName: 'Rachel Adams',
      isPrimary: true,
    },
  },
  {
    name: 'NorCal Nursing Agency',
    email: 'apply@norcalnursing.com',
    phone: '+16505550020',
    website: 'www.norcalnursing.com',
    address: '800 W El Camino Real, Mountain View, CA 94040',
    primaryColor: '#E11D48',
    secondaryColor: '#BE123C',
    location: {
      name: 'El Camino Office',
      address: '800 W El Camino Real, Mountain View, CA 94040',
      latitude: 37.4030,
      longitude: -122.0970,
      contactPhone: '+16505550020',
      contactName: 'Tom Garcia',
      isPrimary: true,
    },
  },
  {
    name: 'Sunnyvale Staffing Co.',
    email: 'jobs@sunnyvalestaffing.com',
    phone: '+14085550030',
    website: 'www.sunnyvalestaffing.com',
    address: '123 Mathilda Ave, Sunnyvale, CA 94086',
    primaryColor: '#F59E0B',
    secondaryColor: '#D97706',
    location: {
      name: 'Sunnyvale Office',
      address: '123 Mathilda Ave, Sunnyvale, CA 94086',
      latitude: 37.3688,
      longitude: -122.0363,
      contactPhone: '+14085550030',
      contactName: 'Priya Patel',
      isPrimary: true,
    },
  },
  // --- Wider Bay Area ---
  {
    name: 'Bay Area Staffing Solutions',
    email: 'hire@bayareastaffing.com',
    website: 'www.bayareastaffing.com',
    address: '100 Market Street, San Francisco, CA 94105',
    primaryColor: '#2563EB',
    secondaryColor: '#1E40AF',
    location: {
      name: 'SF Head Office',
      address: '100 Market Street, San Francisco, CA 94105',
      latitude: 37.7937,
      longitude: -122.3965,
      contactPhone: '+14155550101',
      contactName: 'Sarah Chen',
      isPrimary: true,
    },
  },
  {
    name: 'Pacific Recruitment Group',
    email: 'contact@pacificrecruitment.com',
    website: 'www.pacificrecruitment.com',
    address: '200 University Ave, Palo Alto, CA 94301',
    primaryColor: '#059669',
    secondaryColor: '#047857',
    location: {
      name: 'Palo Alto Office',
      address: '200 University Ave, Palo Alto, CA 94301',
      latitude: 37.4419,
      longitude: -122.1430,
      contactPhone: '+16505550202',
      contactName: 'Mike Johnson',
      isPrimary: true,
    },
  },
  {
    name: 'Golden Gate Healthcare Staffing',
    email: 'jobs@gghealthcare.com',
    website: 'www.gghealthcare.com',
    address: '500 Terry A Francois Blvd, San Francisco, CA 94158',
    primaryColor: '#DC2626',
    secondaryColor: '#B91C1C',
    location: {
      name: 'Mission Bay Office',
      address: '500 Terry A Francois Blvd, San Francisco, CA 94158',
      latitude: 37.7707,
      longitude: -122.3870,
      contactPhone: '+14155550303',
      contactName: 'Lisa Park',
      isPrimary: true,
    },
  },
  {
    name: 'Silicon Valley Workforce',
    email: 'info@svworkforce.com',
    website: 'www.svworkforce.com',
    address: '1 Infinite Loop, Cupertino, CA 95014',
    primaryColor: '#7C3AED',
    secondaryColor: '#6D28D9',
    location: {
      name: 'Cupertino Office',
      address: '1 Infinite Loop, Cupertino, CA 95014',
      latitude: 37.3318,
      longitude: -122.0312,
      contactPhone: '+14085550404',
      contactName: 'David Kim',
      isPrimary: true,
    },
  },
  {
    name: 'South Bay Temps Agency',
    email: 'hello@southbaytemps.com',
    website: 'www.southbaytemps.com',
    address: '87 N San Pedro St, San Jose, CA 95110',
    primaryColor: '#EA580C',
    secondaryColor: '#C2410C',
    location: {
      name: 'San Jose Office',
      address: '87 N San Pedro St, San Jose, CA 95110',
      latitude: 37.3382,
      longitude: -121.8863,
      contactPhone: '+14085550505',
      contactName: 'Ana Rivera',
      isPrimary: true,
    },
  },
  // --- London, UK (fallback if simulator set to UK) ---
  {
    name: 'London Care Agency',
    email: 'recruitment@londoncareagency.co.uk',
    website: 'www.londoncareagency.co.uk',
    address: '45 Great Portland St, London W1W 7LT',
    primaryColor: '#0891B2',
    secondaryColor: '#0E7490',
    location: {
      name: 'Central London Office',
      address: '45 Great Portland St, London W1W 7LT',
      latitude: 51.5204,
      longitude: -0.1437,
      contactPhone: '+442071234567',
      contactName: 'James Wright',
      isPrimary: true,
    },
  },
  {
    name: 'UK Workforce Solutions',
    email: 'apply@ukworkforce.co.uk',
    website: 'www.ukworkforce.co.uk',
    address: '30 Fenchurch St, London EC3M 3BD',
    primaryColor: '#1D4ED8',
    secondaryColor: '#1E3A8A',
    location: {
      name: 'City of London Office',
      address: '30 Fenchurch St, London EC3M 3BD',
      latitude: 51.5115,
      longitude: -0.0832,
      contactPhone: '+442079876543',
      contactName: 'Emma Thompson',
      isPrimary: true,
    },
  },
  {
    name: 'Thames Staffing Partners',
    email: 'jobs@thamesstaffing.co.uk',
    website: 'www.thamesstaffing.co.uk',
    address: '1 Waterloo Road, London SE1 8UD',
    primaryColor: '#4F46E5',
    secondaryColor: '#4338CA',
    location: {
      name: 'Waterloo Office',
      address: '1 Waterloo Road, London SE1 8UD',
      latitude: 51.5031,
      longitude: -0.1132,
      contactPhone: '+442034561234',
      contactName: 'Oliver Brown',
      isPrimary: true,
    },
  },
];

async function seedNearbyAgencies() {
  try {
    console.log('🌱 Seeding nearby agencies with admin users + invite codes...\n');
    const adminPassword = await bcrypt.hash('Admin123!', 10);

    for (const agency of agencies) {
      // Check if org already exists by name
      const existing = await prisma.organization.findFirst({
        where: { name: agency.name },
        include: { inviteCodes: { take: 1 } },
      });

      if (existing) {
        const code = existing.inviteCodes?.[0]?.code || '(check DB)';
        console.log(`⏭️  Skipped (already exists): ${agency.name}  |  invite: ${code}`);
        continue;
      }

      const org = await prisma.organization.create({
        data: {
          name: agency.name,
          deploymentMode: 'AGENCY',
          email: agency.email,
          phone: agency.phone ?? null,
          website: agency.website,
          address: agency.address,
          primaryColor: agency.primaryColor,
          secondaryColor: agency.secondaryColor,
          onboardingComplete: true,
          plan: 'STARTER',
          trialEndsAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
        },
      });

      // Create location
      await prisma.location.create({
        data: {
          organizationId: org.id,
          name: agency.location.name,
          address: agency.location.address,
          latitude: agency.location.latitude,
          longitude: agency.location.longitude,
          contactPhone: agency.location.contactPhone,
          contactName: agency.location.contactName,
          isPrimary: agency.location.isPrimary,
          isActive: true,
          geofenceRadius: 300,
        },
      });

      // Create admin user
      const adminEmail = `admin@${agency.email.split('@')[1]}`;
      const adminUser = await prisma.user.create({
        data: {
          email: adminEmail,
          passwordHash: adminPassword,
          fullName: `${agency.name} Admin`,
          role: 'ADMIN',
          status: 'ACTIVE',
          organizationId: org.id,
          emailVerified: true,
        },
      });

      // Create a MULTI_USE invite code for worker registration
      const inviteCode = crypto.randomBytes(3).toString('hex').toUpperCase();
      const codeHash = crypto.createHash('sha256').update(inviteCode).digest('hex');
      await prisma.inviteCode.create({
        data: {
          organizationId: org.id,
          code: inviteCode,
          codeHash,
          type: 'WORKER',
          status: 'ACTIVE',
          usageType: 'MULTI_USE',
          maxUses: 100,
          createdBy: adminUser.id,
        },
      });

      console.log(`✅ Created: ${agency.name}`);
      console.log(`   📍 ${agency.location.address} (${agency.location.latitude}, ${agency.location.longitude})`);
      console.log(`   � ${adminEmail} / Admin123!`);
      console.log(`   🔑 Invite code: ${inviteCode}\n`);
    }

    console.log('🎉 Nearby agencies seeding complete!');

  } catch (error) {
    console.error('❌ Error seeding agencies:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    exit(0);
  }
}

seedNearbyAgencies();
