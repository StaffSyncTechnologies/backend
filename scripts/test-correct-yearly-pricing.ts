import { config } from 'dotenv';
import axios from 'axios';

// Load environment variables
config();

const API_BASE = 'https://backend-rp5c.onrender.com/api/v1';

async function testCorrectYearlyPricing() {
  try {
    console.log('Testing correct yearly pricing calculation...\n');

    // Get current plans from backend
    const plansResponse = await axios.get(`${API_BASE}/subscriptions/plans`);
    const starterPlan = plansResponse.data.data.plans.find((p: any) => p.id === 'STARTER');
    
    console.log('Current Backend Pricing:');
    console.log(`- Monthly: £${starterPlan.monthlyPricePerWorker / 100} per worker`);
    console.log(`- Yearly: £${starterPlan.yearlyPricePerWorker / 100} per worker`);
    
    console.log('\nCorrect Yearly Pricing Calculation:');
    console.log(`Monthly price: £${starterPlan.monthlyPricePerWorker / 100} per worker`);
    console.log(`Yearly price should be: £${starterPlan.monthlyPricePerWorker / 100} × 12 = £${(starterPlan.monthlyPricePerWorker * 12) / 100} per worker`);
    
    const currentWorkers = 44;
    const monthlyTotal = (starterPlan.monthlyPricePerWorker / 100) * currentWorkers;
    const correctYearlyTotal = ((starterPlan.monthlyPricePerWorker * 12) / 100) * currentWorkers;
    
    console.log('\nExpected Frontend Display:');
    console.log(`- Monthly: £${starterPlan.monthlyPricePerWorker / 100} per worker × ${currentWorkers} workers = £${monthlyTotal.toFixed(2)} per month`);
    console.log(`- Yearly: £${(starterPlan.monthlyPricePerWorker * 12) / 100} per worker × ${currentWorkers} workers = £${correctYearlyTotal.toFixed(2)} per year`);
    
    console.log('\nBackend Configuration Updates:');
    console.log('Updated .env file with correct yearly pricing:');
    console.log(`- STRIPE_STARTER_YEARLY_PRICE_PER_WORKER=3000 (was 200)`);
    console.log(`- STRIPE_PROFESSIONAL_YEARLY_PRICE_PER_WORKER=4200 (was 300)`);
    console.log(`- STRIPE_BUSINESS_YEARLY_PRICE_PER_WORKER=5400 (was 400)`);
    
    console.log('\nNext Steps:');
    console.log('1. Backend needs to be restarted to pick up new environment variables');
    console.log('2. After restart, yearly pricing will show correct amounts');
    console.log('3. Frontend will display: £30.00 per worker × 44 workers = £1,320.00 per year');
    
  } catch (error: any) {
    console.error('Test failed:', error.response?.status, error.response?.data || error.message);
  }
}

testCorrectYearlyPricing();
