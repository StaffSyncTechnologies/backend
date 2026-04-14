import Stripe from 'stripe';
import { config } from 'dotenv';

// Load environment variables
config();

// Directly access the Stripe key
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.error('STRIPE_SECRET_KEY not found in environment variables');
  process.exit(1);
}

const stripe = new Stripe(stripeSecretKey);

async function createStarterYearlyPrice() {
  try {
    console.log('Creating yearly Stripe price for Starter plan...\n');

    // Calculate yearly amount (monthly price × 12 months)
    const monthlyPricePerWorker = 250; // £2.50 in pence
    const yearlyPricePerWorker = monthlyPricePerWorker * 12; // 3000p = £30.00
    
    console.log(`Monthly price: £${monthlyPricePerWorker / 100} per worker`);
    console.log(`Yearly price: £${yearlyPricePerWorker / 100} per worker (${monthlyPricePerWorker / 100} × 12)`);

    try {
      // Create the yearly price
      const yearlyPrice = await stripe.prices.create({
        unit_amount: yearlyPricePerWorker, // 3000p = £30.00 per worker per year
        currency: 'gbp',
        recurring: {
          interval: 'year',
          interval_count: 1,
        },
        product_data: {
          name: 'Starter Plan (Yearly)',
        },
        tax_behavior: 'inclusive', // Price includes tax if applicable
        metadata: {
          plan_tier: 'STARTER',
          billing_cycle: 'yearly',
          monthly_equivalent: monthlyPricePerWorker.toString(),
          created_by: 'staffsync-script',
        },
      });
      
      console.log('\n--- Yearly Price Created Successfully ---');
      console.log(`Price ID: ${yearlyPrice.id}`);
      console.log(`Amount: £${yearlyPrice.unit_amount! / 100} per worker per year`);
      console.log(`Currency: ${yearlyPrice.currency.toUpperCase()}`);
      console.log(`Interval: ${yearlyPrice.recurring?.interval} (${yearlyPrice.recurring?.interval_count})`);
      
      console.log('\n--- Update Your .env File ---');
      console.log(`Replace this line in your .env file:`);
      console.log(`STRIPE_STARTER_YEARLY_PRICE_ID=${yearlyPrice.id}`);
      
      console.log('\n--- Test the New Price ---');
      console.log('After updating .env, test with:');
      console.log('1. Go to Billing & Plans page');
      console.log('2. Click "Upgrade" on Starter plan');
      console.log('3. Select "Yearly" billing cycle');
      console.log('4. Should show: £30.00 per worker × 44 workers = £1,320.00 per year');
      console.log('5. Click "Continue to Payment" to test Stripe checkout');

    } catch (error: any) {
      console.error('Error creating yearly price:', error.message);
      
      if (error.type === 'StripeInvalidRequestError') {
        console.log('\n--- Common Issues ---');
        console.log('1. Check if Stripe API key is valid');
        console.log('2. Ensure you have the correct permissions');
        console.log('3. Verify the product exists or create a new one');
      }
    }

  } catch (error: any) {
    console.error('Script failed:', error.message);
  }
}

createStarterYearlyPrice();
