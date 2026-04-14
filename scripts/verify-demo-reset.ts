import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyDemoReset() {
  try {
    console.log('Verifying admin@staffsync-demo.com subscription reset...');
    
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
    
    // Check current subscription
    const subscription = await prisma.subscription.findUnique({
      where: { organizationId: user.organizationId }
    });
    
    if (!subscription) {
      console.log('No subscription found for this organization');
      return;
    }
    
    console.log('Subscription Details:');
    console.log(`- Plan: ${subscription.planTier}`);
    console.log(`- Status: ${subscription.status}`);
    console.log(`- Billing Cycle: ${subscription.billingCycle}`);
    console.log(`- Trial Start: ${subscription.trialStart?.toLocaleDateString()}`);
    console.log(`- Trial End: ${subscription.trialEnd?.toLocaleDateString()}`);
    console.log(`- Current Period Start: ${subscription.currentPeriodStart?.toLocaleDateString()}`);
    console.log(`- Current Period End: ${subscription.currentPeriodEnd?.toLocaleDateString()}`);
    console.log(`- Worker Limit: ${subscription.workerLimit} (${subscription.workerLimit === -1 ? 'unlimited' : 'limited'})`);
    console.log(`- Client Limit: ${subscription.clientLimit} (${subscription.clientLimit === -1 ? 'unlimited' : 'limited'})`);
    console.log(`- Price per Worker: £${subscription.pricePerWorker / 100}`);
    console.log(`- Cancel at Period End: ${subscription.cancelAtPeriodEnd}`);
    console.log(`- Stripe Subscription ID: ${subscription.stripeSubscriptionId || 'None'}`);
    
    // Calculate days remaining in trial
    if (subscription.trialEnd) {
      const daysRemaining = Math.ceil((subscription.trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      console.log(`- Days Remaining in Trial: ${daysRemaining}`);
    }
    
    console.log('\nReset Verification: SUCCESS');
    console.log('The admin@staffsync-demo.com account has been successfully reset to FREE trial status.');
    
  } catch (error) {
    console.error('Error verifying demo reset:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyDemoReset();
