import { PrismaClient } from '@prisma/client';
import { PlanTier, SubscriptionStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function resetAdminDemoAccount() {
  try {
    console.log('Resetting admin@staffsync-demo.com account to FREE trial...');
    
    // Find the admin demo user
    const user = await prisma.user.findFirst({
      where: { 
        email: 'admin@staffsync-demo.com',
        role: 'ADMIN'
      }
    });
    
    if (!user) {
      console.error('Admin demo account not found');
      return;
    }
    
    console.log(`Found admin user: ${user.fullName}, Org ID: ${user.organizationId}`);
    
    // Check current subscription
    const currentSubscription = await prisma.subscription.findUnique({
      where: { organizationId: user.organizationId }
    });
    
    console.log(`Current subscription:`, currentSubscription ? `${currentSubscription.planTier} - ${currentSubscription.status}` : 'None');
    
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
    
    console.log('Successfully reset subscription to FREE trial:');
    console.log(`- Plan: ${updatedSubscription.planTier}`);
    console.log(`- Status: ${updatedSubscription.status}`);
    console.log(`- Trial ends: ${updatedSubscription.trialEnd?.toLocaleDateString()}`);
    console.log(`- Worker limit: ${updatedSubscription.workerLimit} (unlimited)`);
    console.log(`- Client limit: ${updatedSubscription.clientLimit} (unlimited)`);
    
  } catch (error) {
    console.error('Error resetting admin demo account:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetAdminDemoAccount();
