import { PrismaClient } from '@prisma/client';
import { PlanTier, SubscriptionStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function resetDemoAccount() {
  try {
    console.log('Finding admin@staffsync-demo.com account...');
    
    // Find the user using compound unique key
    const user = await prisma.user.findUnique({
      where: { 
        organizationId_email: {
          email: 'admin@staffsync-demo.com',
          organizationId: '' // We'll find this first
        }
      }
    });
    
    // If not found with compound key, try finding by email alone first
    let foundUser = user;
    if (!foundUser) {
      // Find any user with this email first to get organizationId
      const anyUser = await prisma.user.findFirst({
        where: { email: 'admin@staffsync-demo.com' }
      });
      
      if (anyUser) {
        foundUser = await prisma.user.findUnique({
          where: { 
            organizationId_email: {
              email: 'admin@staffsync-demo.com',
              organizationId: anyUser.organizationId
            }
          }
        });
      }
    }
    
    if (!foundUser) {
      console.error('Demo account not found');
      return;
    }
    
    console.log(`Found user: ${foundUser.fullName}, Organization ID: ${foundUser.organizationId}`);
    
    // Get organization details
    const organization = await prisma.organization.findUnique({
      where: { id: foundUser.organizationId }
    });
    
    if (!organization) {
      console.error('Organization not found');
      return;
    }
    
    console.log(`Organization: ${organization.name}`);
    
    // Check current subscription
    const currentSubscription = await prisma.subscription.findUnique({
      where: { organizationId: foundUser.organizationId }
    });
    
    console.log('Current subscription:', currentSubscription);
    
    // Reset to FREE trial
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 180); // 180 days from now
    
    const updatedSubscription = await prisma.subscription.upsert({
      where: { organizationId: foundUser.organizationId },
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
        organizationId: foundUser.organizationId,
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
    
    console.log('Subscription reset to FREE trial:');
    console.log(`- Plan: ${updatedSubscription.planTier}`);
    console.log(`- Status: ${updatedSubscription.status}`);
    console.log(`- Trial ends: ${updatedSubscription.trialEnd}`);
    console.log(`- Worker limit: ${updatedSubscription.workerLimit}`);
    console.log(`- Client limit: ${updatedSubscription.clientLimit}`);
    
  } catch (error) {
    console.error('Error resetting demo account:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetDemoAccount();
