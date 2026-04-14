import Stripe from 'stripe';
import { config } from 'dotenv';
import { config as appConfig } from '../src/config';

// Load environment variables
config();

const stripe = new Stripe(appConfig.stripe.secretKey!);

async function createStarterYearlyPrice() {
  try {
    console.log('Creating yearly Stripe price for Starter plan...\n');

    // Get the current monthly price to calculate yearly amount
    const monthlyPriceId = appConfig.stripe.perWorkerPricing.starter.monthlyStripePriceId;
    console.log(`Using monthly price ID: ${monthlyPriceId}`);
    
    // Calculate yearly amount (monthly price × 12 months)
    const monthlyPricePerWorker = appConfig.stripe.perWorkerPricing.starter.monthlyPricePerWorker; // 250p = £2.50
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
      console.log(`Add this line to your .env file:`);
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
