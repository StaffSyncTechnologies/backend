import Stripe from 'stripe';
import { config } from 'dotenv';
import { config as appConfig } from '../src/config';

// Load environment variables
config();

const stripe = new Stripe(appConfig.stripe.secretKey!);

async function updatePricesWithVAT() {
  try {
    console.log('Creating new Stripe prices with VAT included...\n');

    const vatMultiplier = 1.2; // 20% VAT

    // Update Starter plan prices
    const starterMonthlyPrice = appConfig.stripe.perWorkerPricing.starter.monthlyPricePerWorker;
    const starterYearlyPrice = appConfig.stripe.perWorkerPricing.starter.yearlyPricePerWorker;

    if (starterMonthlyPrice) {
      const priceWithVAT = Math.round(starterMonthlyPrice * vatMultiplier);
      console.log(`Creating Starter Monthly price: £${starterMonthlyPrice/100} -> £${priceWithVAT/100} (including VAT)`);
      
      try {
        const newPrice = await stripe.prices.create({
          unit_amount: priceWithVAT,
          currency: 'gbp',
          recurring: {
            interval: 'month',
            interval_count: 1,
          },
          product_data: {
            name: 'Starter Plan (including VAT)',
            description: 'Starter plan with 20% VAT included',
          },
          tax_behavior: 'inclusive', // This price already includes tax
          metadata: {
            plan_tier: 'STARTER',
            billing_cycle: 'monthly',
            includes_vat: 'true',
            vat_rate: '20',
            base_price: starterMonthlyPrice.toString(),
          },
        });
        
        console.log(`New price ID: ${newPrice.id}`);
        console.log(`Update STRIPE_STARTER_MONTHLY_PRICE_ID_VAT=${newPrice.id} in .env`);
      } catch (error) {
        console.error(`Error creating starter monthly price: ${error}`);
      }
    }

    if (starterYearlyPrice) {
      const priceWithVAT = Math.round(starterYearlyPrice * vatMultiplier);
      console.log(`Creating Starter Yearly price: £${starterYearlyPrice/100} -> £${priceWithVAT/100} (including VAT)`);
      
      try {
        const newPrice = await stripe.prices.create({
          unit_amount: priceWithVAT,
          currency: 'gbp',
          recurring: {
            interval: 'year',
            interval_count: 1,
          },
          product_data: {
            name: 'Starter Plan Yearly (including VAT)',
            description: 'Starter yearly plan with 20% VAT included',
          },
          tax_behavior: 'inclusive',
          metadata: {
            plan_tier: 'STARTER',
            billing_cycle: 'yearly',
            includes_vat: 'true',
            vat_rate: '20',
            base_price: starterYearlyPrice.toString(),
          },
        });
        
        console.log(`New price ID: ${newPrice.id}`);
        console.log(`Update STRIPE_STARTER_YEARLY_PRICE_ID_VAT=${newPrice.id} in .env`);
      } catch (error) {
        console.error(`Error creating starter yearly price: ${error}`);
      }
    }

    // Update Professional plan prices
    const professionalMonthlyPrice = appConfig.stripe.perWorkerPricing.professional.monthlyPricePerWorker;
    const professionalYearlyPrice = appConfig.stripe.perWorkerPricing.professional.yearlyPricePerWorker;

    if (professionalMonthlyPrice) {
      const priceWithVAT = Math.round(professionalMonthlyPrice * vatMultiplier);
      console.log(`Creating Professional Monthly price: £${professionalMonthlyPrice/100} -> £${priceWithVAT/100} (including VAT)`);
      
      try {
        const newPrice = await stripe.prices.create({
          unit_amount: priceWithVAT,
          currency: 'gbp',
          recurring: {
            interval: 'month',
            interval_count: 1,
          },
          product_data: {
            name: 'Professional Plan (including VAT)',
            description: 'Professional plan with 20% VAT included',
          },
          tax_behavior: 'inclusive',
          metadata: {
            plan_tier: 'PROFESSIONAL',
            billing_cycle: 'monthly',
            includes_vat: 'true',
            vat_rate: '20',
            base_price: professionalMonthlyPrice.toString(),
          },
        });
        
        console.log(`New price ID: ${newPrice.id}`);
        console.log(`Update STRIPE_PROFESSIONAL_MONTHLY_PRICE_ID_VAT=${newPrice.id} in .env`);
      } catch (error) {
        console.error(`Error creating professional monthly price: ${error}`);
      }
    }

    console.log('\n--- Next Steps ---');
    console.log('1. Add the new price IDs to your .env file:');
    console.log('   STRIPE_STARTER_MONTHLY_PRICE_ID_VAT=<new_price_id>');
    console.log('   STRIPE_STARTER_YEARLY_PRICE_ID_VAT=<new_price_id>');
    console.log('   STRIPE_PROFESSIONAL_MONTHLY_PRICE_ID_VAT=<new_price_id>');
    console.log('2. Update the config to use VAT-inclusive prices');
    console.log('3. Update frontend to show "VAT included" instead of separate VAT line');

  } catch (error) {
    console.error('Error:', error);
  }
}

updatePricesWithVAT();
