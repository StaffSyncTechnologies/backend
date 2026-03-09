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

async function checkRemoteData() {
  try {
    console.log('🌐 Checking REMOTE database data...');
    
    // Get John Smith from remote DB
    const john = await prisma.user.findFirst({
      where: { email: 'john.smith@test.com' },
      select: { id: true, fullName: true }
    });
    
    if (!john) {
      console.log('❌ John Smith not found in remote DB');
      return;
    }
    
    console.log('✅ Found John Smith in remote DB:', john.fullName);
    
    // Get all assignments for John Smith in remote DB
    const assignments = await prisma.shiftAssignment.findMany({
      where: { workerId: john.id },
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

    console.log('\n📋 John Smith assignments in remote DB:', assignments.length);
    
    if (assignments.length === 0) {
      console.log('❌ No assignments found in remote DB - this is the problem!');
      return;
    }

    // Check today's shifts in remote DB
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    console.log('\n📅 Today boundaries (UTC):', startOfToday.toISOString(), 'to', endOfToday.toISOString());

    const todayAssignments = assignments.filter(a => {
      const shiftStart = a.shift.startAt;
      return shiftStart >= startOfToday && shiftStart <= endOfToday && ['ASSIGNED', 'ACCEPTED'].includes(a.status);
    });

    console.log('🎯 Today assignments in remote DB:', todayAssignments.length);
    
    todayAssignments.forEach((a, index) => {
      console.log(`\n${index + 1}. Shift: ${a.shift.title}`);
      console.log(`   Start: ${a.shift.startAt.toISOString()}`);
      console.log(`   End: ${a.shift.endAt.toISOString()}`);
      console.log(`   Assignment Status: ${a.status}`);
      console.log(`   Shift Status: ${a.shift.status}`);
    });

    // If no today assignments, check all shifts
    if (todayAssignments.length === 0) {
      console.log('\n📅 All shifts in remote DB:');
      assignments.forEach((a, index) => {
        console.log(`\n${index + 1}. Shift: ${a.shift.title}`);
        console.log(`   Start: ${a.shift.startAt.toISOString()}`);
        console.log(`   End: ${a.shift.endAt.toISOString()}`);
        console.log(`   Assignment Status: ${a.status}`);
        console.log(`   Is today: ${a.shift.startAt >= startOfToday && a.shift.startAt <= endOfToday}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
    exit(0);
  }
}

checkRemoteData();
