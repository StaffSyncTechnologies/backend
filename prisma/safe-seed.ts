import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Safe seeding process started...');
  
  // Step 1: Check for existing STANDARD subscriptions
  console.log('📊 Checking for STANDARD plan subscriptions...');
  const standardSubs = await prisma.$queryRaw`
    SELECT COUNT(*) as count 
    FROM subscription 
    WHERE plan_tier = 'STANDARD'
  `;
  
  console.log(`Found ${(standardSubs as any)[0]?.count || 0} STANDARD subscriptions`);
  
  // Step 2: Migrate STANDARD to STARTER if any exist
  if ((standardSubs as any)[0]?.count > 0) {
    console.log('🔄 Migrating STANDARD subscriptions to STARTER...');
    await prisma.$executeRaw`
      UPDATE subscription 
      SET 
        plan_tier = 'STARTER',
        worker_count = COALESCE(worker_count, 10),
        price_per_worker = COALESCE(price_per_worker, 250),
        billing_cycle = COALESCE(billing_cycle, 'monthly')
      WHERE plan_tier = 'STANDARD'
    `;
    console.log('✅ Migration complete');
  }
  
  // Step 3: Add new columns if they don't exist
  console.log('🔧 Ensuring schema columns exist...');
  try {
    await prisma.$executeRaw`
      ALTER TABLE subscription 
      ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(20) DEFAULT 'monthly',
      ADD COLUMN IF NOT EXISTS worker_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS price_per_worker DECIMAL(10,2)
    `;
    console.log('✅ Schema columns verified');
  } catch (error) {
    console.log('ℹ️  Columns may already exist');
  }
  
  console.log('✅ Safe seeding preparation complete!');
  console.log('👉 You can now run: npx prisma db push --accept-data-loss');
  console.log('👉 Then run: npx prisma db seed');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
