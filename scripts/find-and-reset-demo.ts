import { PrismaClient } from '@prisma/client';
import { PlanTier, SubscriptionStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function findAndResetDemoAccount() {
  try {
    console.log('Searching for demo@staffsync-demo.com account...');
    
    // Search for any user with this email
    const users = await prisma.user.findMany({
      where: { email: 'demo@staffsync-demo.com' }
    });
    
    if (users.length === 0) {
      console.log('No users found with demo@staffsync-demo.com email');
      
      // Let's check what admin users exist
      const adminUsers = await prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: { email: true, fullName: true, organizationId: true }
      });
      
      console.log('Available admin users:');
      adminUsers.forEach(user => {
        console.log(`- ${user.fullName} (${user.email}) - Org: ${user.organizationId}`);
      });
      
      return;
    }
    
    console.log(`Found ${users.length} user(s) with demo@staffsync-demo.com email:`);
    
    for (const user of users) {
      console.log(`- User: ${user.fullName}, Org ID: ${user.organizationId}, Role: ${user.role}`);
      
      // Check current subscription
      const currentSubscription = await prisma.subscription.findUnique({
        where: { organizationId: user.organizationId }
      });
      
      console.log(`  Current subscription:`, currentSubscription ? `${currentSubscription.planTier} - ${currentSubscription.status}` : 'None');
      
      // Reset to FREE trial
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 180); // 180 days from now
      
      const updatedSubscription = await prisma.subscription.upsert({
        where: { organizationId: user.organizationId },
        update: {
          planTier: 'FREE' as PlanTier,
          status: 'TRIALING' as SubscriptionStatus,
          billingCycle: 'monthly',
          workerCount: 0,
          pricePerWorker: 0,
          workerLimit: -1,
          clientLimit: -1,
          currentPeriodStart: new Date(),
          currentPeriodEnd: trialEnd,
          trialStart: new Date(),
          trialEnd: trialEnd,
          cancelAtPeriodEnd: false,
          canceledAt: null,
          stripeSubscriptionId: null,
          stripeCustomerId: null,
          stripePriceId: null,
        },
        create: {
          organizationId: user.organizationId,
          planTier: 'FREE' as PlanTier,
          status: 'TRIALING' as SubscriptionStatus,
          billingCycle: 'monthly',
          workerCount: 0,
          pricePerWorker: 0,
          workerLimit: -1,
          clientLimit: -1,
          currentPeriodStart: new Date(),
          currentPeriodEnd: trialEnd,
          trialStart: new Date(),
          trialEnd: trialEnd,
          cancelAtPeriodEnd: false,
        }
      });
      
      console.log(`  Reset subscription to FREE trial:`);
      console.log(`    - Plan: ${updatedSubscription.planTier}`);
      console.log(`    - Status: ${updatedSubscription.status}`);
      console.log(`    - Trial ends: ${updatedSubscription.trialEnd?.toLocaleDateString()}`);
      console.log(`    - Worker limit: ${updatedSubscription.workerLimit}`);
      console.log(`    - Client limit: ${updatedSubscription.clientLimit}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findAndResetDemoAccount();
