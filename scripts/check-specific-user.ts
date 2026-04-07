import { PrismaClient } from '@prisma/client';
import { exit } from 'process';

// Use the remote database URL
const DATABASE_URL = "postgresql://neondb_owner:npg_Q29bTqnxMpUe@ep-dawn-breeze-abnc271v.eu-west-2.aws.neon.tech/neondb?sslmode=require";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL,
    },
  },
});

async function checkSpecificUser() {
  try {
    console.log('🔍 Checking the specific user from frontend logs...');
    
    // The user ID from your frontend logs
    const userId = "0dafefb3-b8a5-48fa-948c-fa29649ad4f5";
    
    console.log('Looking for user ID:', userId);
    
    // Find this specific user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
      }
    });

    if (!user) {
      console.log('❌ User not found in remote database!');
      return;
    }

    console.log('✅ Found user:');
    console.log('- ID:', user.id);
    console.log('- Name:', user.fullName);
    console.log('- Email:', user.email);
    console.log('- Role:', user.role);
    console.log('- Status:', user.status);

    // Check this user's assignments
    const assignments = await prisma.shiftAssignment.findMany({
      where: { workerId: userId },
      include: {
        shift: {
          select: {
            id: true,
            title: true,
            startAt: true,
            endAt: true,
            status: true
          }
        }
      }
    });

    console.log('\n📋 Assignments for this user:', assignments.length);
    
    if (assignments.length === 0) {
      console.log('❌ This user has NO assignments!');
      console.log('This explains why todayShift is null - this user has no shifts assigned.');
      return;
    }

    // Check for today's shifts
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    console.log('\n📅 Today boundaries:', startOfToday.toISOString(), 'to', endOfToday.toISOString());

    const todayAssignments = assignments.filter(a => {
      const shiftStart = a.shift.startAt;
      return shiftStart >= startOfToday && shiftStart <= endOfToday && ['ASSIGNED', 'ACCEPTED'].includes(a.status);
    });

    console.log('🎯 Today assignments for this user:', todayAssignments.length);

    if (todayAssignments.length === 0) {
      console.log('❌ This user has NO assignments for today!');
      console.log('This explains why todayShift is null.');
      
      console.log('\n📅 All assignments for this user:');
      assignments.forEach((a, index) => {
        console.log(`${index + 1}. ${a.shift.title}`);
        console.log(`   Start: ${a.shift.startAt.toISOString()}`);
        console.log(`   End: ${a.shift.endAt.toISOString()}`);
        console.log(`   Assignment Status: ${a.status}`);
        console.log(`   Is today: ${a.shift.startAt >= startOfToday && a.shift.startAt <= endOfToday}`);
      });
    } else {
      console.log('✅ Found today assignments:');
      todayAssignments.forEach((a, index) => {
        console.log(`${index + 1}. ${a.shift.title}`);
        console.log(`   Start: ${a.shift.startAt.toISOString()}`);
        console.log(`   End: ${a.shift.endAt.toISOString()}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
    exit(0);
  }
}

checkSpecificUser();
