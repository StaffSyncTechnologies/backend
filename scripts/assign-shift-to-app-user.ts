import { PrismaClient } from '@prisma/client';
import { exit } from 'process';

// Use the remote database URL
const DATABASE_URL = "postgresql://staffsync_97y9_user:C4kD8ioJWWGXslW7TArnw6ro0gtEyQLz@dpg-d6maih7kijhs73frn22g-a.oregon-postgres.render.com/staffsync_97y9";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL,
    },
  },
});

async function assignShiftToAppUser() {
  try {
    console.log('🔧 Assigning today\'s shift to the app\'s John Smith...');
    
    // The app's user ID
    const appUserId = "0dafefb3-b8a5-48fa-948c-fa29649ad4f5";
    
    // Find the today shift we created
    const todayShift = await prisma.shift.findFirst({
      where: { 
        title: 'Day Shift - Test Hospital',
        startAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lte: new Date(new Date().setHours(23, 59, 59, 999))
        }
      }
    });

    if (!todayShift) {
      console.log('❌ Today shift not found. Creating a new one...');
      
      // Create a new shift for today
      const now = new Date();
      const startTime = new Date(now.getTime() + (2 * 60 * 60 * 1000)); // 2 hours from now
      const endTime = new Date(startTime.getTime() + (8 * 60 * 60 * 1000)); // 8 hours later
      
      const newShift = await prisma.shift.create({
        data: {
          organizationId: 'default-org', // This might need adjustment
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
          createdBy: 'system', // This might need adjustment
        },
      });
      
      console.log('✅ Created new shift:', newShift.id);
      
      // Create assignment
      const assignment = await prisma.shiftAssignment.create({
        data: {
          shiftId: newShift.id,
          workerId: appUserId,
          status: 'ACCEPTED',
          acceptedAt: new Date(),
        },
      });
      
      console.log('✅ Created assignment for app user');
      
    } else {
      console.log('✅ Found today shift:', todayShift.id);
      
      // Check if assignment already exists
      const existingAssignment = await prisma.shiftAssignment.findFirst({
        where: {
          shiftId: todayShift.id,
          workerId: appUserId,
        },
      });
      
      if (!existingAssignment) {
        console.log('Creating assignment for app user...');
        
        // Create assignment
        const assignment = await prisma.shiftAssignment.create({
          data: {
            shiftId: todayShift.id,
            workerId: appUserId,
            status: 'ACCEPTED',
            acceptedAt: new Date(),
          },
        });
        
        console.log('✅ Created assignment for app user');
      } else {
        console.log('✅ Assignment already exists for app user');
      }
    }

    // Verify the assignment
    console.log('\n🔍 Verifying assignment...');
    const assignments = await prisma.shiftAssignment.findMany({
      where: { workerId: appUserId },
      include: {
        shift: {
          select: {
            id: true,
            title: true,
            startAt: true,
            endAt: true,
          }
        }
      }
    });

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const todayAssignments = assignments.filter(a => {
      const shiftStart = a.shift.startAt;
      return shiftStart >= startOfToday && shiftStart <= endOfToday && ['ASSIGNED', 'ACCEPTED'].includes(a.status);
    });

    console.log('🎯 Today assignments for app user:', todayAssignments.length);
    
    if (todayAssignments.length > 0) {
      console.log('✅ SUCCESS! App user now has today\'s shift:');
      todayAssignments.forEach((a, index) => {
        console.log(`${index + 1}. ${a.shift.title}`);
        console.log(`   Start: ${a.shift.startAt.toISOString()}`);
        console.log(`   End: ${a.shift.endAt.toISOString()}`);
      });
    } else {
      console.log('❌ Still no today assignments');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
    exit(0);
  }
}

assignShiftToAppUser();
