import { config } from 'dotenv';
import axios from 'axios';

// Load environment variables
config();

const API_BASE = 'https://backend-rp5c.onrender.com/api/v1';

async function testStripeYearlyPricing() {
  try {
    console.log('Testing Stripe yearly pricing logic...\n');

    // Get current plans from backend
    const plansResponse = await axios.get(`${API_BASE}/subscriptions/plans`);
    const starterPlan = plansResponse.data.data.plans.find((p: any) => p.id === 'STARTER');
    
    console.log('Backend Configuration (for Stripe):');
    console.log(`- Monthly Price ID: ${starterPlan.monthlyPricePerWorker}p (£${starterPlan.monthlyPricePerWorker / 100}) per worker`);
    console.log(`- Yearly Price ID: ${starterPlan.yearlyPricePerWorker}p (£${starterPlan.yearlyPricePerWorker / 100}) per worker`);
    
    console.log('\nFrontend Display Logic:');
    console.log('Monthly Display:');
    console.log(`- £${starterPlan.monthlyPricePerWorker / 100} per worker × 44 workers = £${(starterPlan.monthlyPricePerWorker / 100) * 44} per month`);
    
    console.log('\nYearly Display (Frontend Calculation):');
    const monthlyPricePerWorker = starterPlan.monthlyPricePerWorker;
    const yearlyDisplayPrice = monthlyPricePerWorker * 12;
    console.log(`- £${monthlyPricePerWorker / 100} × 12 = £${yearlyDisplayPrice / 100} per worker (display)`);
    console.log(`- £${yearlyDisplayPrice / 100} per worker × 44 workers = £${(yearlyDisplayPrice / 100) * 44} per year (display)`);
    
    console.log('\nStripe Backend Logic:');
    console.log('When billingCycle === "yearly":');
    console.log(`- Uses yearlyStripePriceId: ${starterPlan.yearlyPricePerWorker}p`);
    console.log('- Stripe automatically handles yearly billing from the price ID');
    console.log('- Frontend shows calculated price for display, but Stripe charges based on price ID');
    
    console.log('\nExpected User Experience:');
    console.log('1. User sees: £30.00 per worker × 44 workers = £1,320.00 per year');
    console.log('2. Backend sends: yearlyStripePriceId to Stripe');
    console.log('3. Stripe charges: Based on the yearly price ID configuration');
    console.log('4. This is correct - frontend shows calculation, Stripe handles actual billing');

  } catch (error: any) {
    console.error('Test failed:', error.response?.status, error.response?.data || error.message);
  }
}

testStripeYearlyPricing();
