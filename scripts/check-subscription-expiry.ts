#!/usr/bin/env npx tsx

/**
 * Subscription Expiry Check Script
 * 
 * This script checks for expiring subscriptions and sends reminder notifications.
 * It should be run daily via cron job.
 * 
 * Usage: npx tsx scripts/check-subscription-expiry.ts
 */

import { SubscriptionChecker } from '../src/services/subscriptionChecker';

async function main() {
  console.log('='.repeat(60));
  console.log('SUBSCRIPTION EXPIRY CHECK');
  console.log('='.repeat(60));
  console.log(`Started at: ${new Date().toISOString()}`);
  
  try {
    await SubscriptionChecker.checkExpiringSubscriptions();
    
    console.log('='.repeat(60));
    console.log('SUBSCRIPTION EXPIRY CHECK COMPLETED SUCCESSFULLY');
    console.log(`Completed at: ${new Date().toISOString()}`);
    console.log('='.repeat(60));
    
    process.exit(0);
  } catch (error) {
    console.error('Subscription expiry check failed:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run the main function
if (require.main === module) {
  main();
}
