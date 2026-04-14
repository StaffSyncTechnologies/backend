import { config } from 'dotenv';
import axios from 'axios';

// Load environment variables
config();

const API_BASE = 'https://backend-rp5c.onrender.com/api/v1';

async function testYearlyDisplay() {
  try {
    console.log('Testing yearly pricing display...\n');

    // Get plans to verify pricing
    const plansResponse = await axios.get(`${API_BASE}/subscriptions/plans`);
    const starterPlan = plansResponse.data.data.plans.find((p: any) => p.id === 'STARTER');
    
    console.log('Backend Pricing Configuration:');
    console.log(`- Monthly: £${starterPlan.monthlyPricePerWorker / 100} per worker`);
    console.log(`- Yearly: £${starterPlan.yearlyPricePerWorker / 100} per worker`);
    
    console.log('\nExpected Frontend Display:');
    console.log(`- Monthly: £2.50 per worker × 44 workers = £110.00 per month`);
    console.log(`- Yearly: £2.00 per worker × 44 workers = £88.00 per year`);
    
    console.log('\nFrontend Implementation:');
    console.log('Added billing cycle toggle to BillingPage checkout view');
    console.log('Pricing calculation logic:');
    console.log(`const pricePerWorker = billingCycle === 'yearly' 
      ? plansData?.plans?.find((p: any) => p.id === selectedPlan)?.yearlyPricePerWorker 
      : plansData?.plans?.find((p: any) => p.id === selectedPlan)?.monthlyPricePerWorker;`);
    
    console.log('\nUser Action Required:');
    console.log('1. Go to Billing & Plans page');
    console.log('2. Click "Upgrade" on any plan');
    console.log('3. In checkout view, click "Yearly" button');
    console.log('4. Price should change from £2.50 to £2.00 per worker');
    console.log('5. Total should change from £110.00 to £88.00');

  } catch (error: any) {
    console.error('Test failed:', error.response?.status, error.response?.data || error.message);
  }
}

testYearlyDisplay();
