import Stripe from 'stripe';
import { config } from 'dotenv';
import { config as appConfig } from '../src/config';

// Load environment variables
config();

const stripe = new Stripe(appConfig.stripe.secretKey!);

async function checkStripePrices() {
  try {
    console.log('Checking Stripe price configuration...\n');

    // Check the Starter plan monthly price
    const starterMonthlyPriceId = appConfig.stripe.perWorkerPricing.starter.monthlyStripePriceId;
    console.log(`Starter Monthly Price ID: ${starterMonthlyPriceId}`);

    if (starterMonthlyPriceId) {
      try {
        const price = await stripe.prices.retrieve(starterMonthlyPriceId);
        console.log(`Price details:`);
        console.log(`- Amount: ${price.unit_amount} pence (£${(price.unit_amount! / 100).toFixed(2)})`);
        console.log(`- Currency: ${price.currency.toUpperCase()}`);
        console.log(`- Type: ${price.type}`);
        console.log(`- Recurring: ${price.recurring ? `${price.recurring.interval} ${price.recurring.interval_count}` : 'One-time'}`);
        
        // Check if tax behavior is set
        if ((price as any).tax_behavior) {
          console.log(`- Tax Behavior: ${(price as any).tax_behavior}`);
        } else {
          console.log(`- Tax Behavior: Not set (prices exclude tax by default)`);
        }
      } catch (error) {
        console.error(`Error retrieving price: ${error}`);
      }
    }

    console.log('\n--- VAT/Tax Configuration Check ---');
    
    // Check if Stripe Tax is enabled
    try {
      const taxRates = await stripe.taxRates.list({ limit: 5 });
      console.log(`Available Tax Rates: ${taxRates.data.length}`);
      taxRates.data.forEach(tax => {
        console.log(`- ${tax.display_name}: ${tax.percentage}% (${tax.jurisdiction || 'No jurisdiction'})`);
      });
    } catch (error) {
      console.log(`Stripe Tax not configured or error: ${error}`);
    }

    console.log('\n--- Recommendation ---');
    console.log('Current issue: Frontend shows £3.00 (£2.50 + £0.50 VAT) but Stripe only charges £2.50');
    console.log('Options to fix:');
    console.log('1. Update Stripe price to include VAT (£3.00)');
    console.log('2. Configure Stripe Tax to automatically add VAT');
    console.log('3. Update frontend to show base price only');

  } catch (error) {
    console.error('Error:', error);
  }
}

checkStripePrices();
