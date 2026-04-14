import { config } from 'dotenv';
import axios from 'axios';

// Load environment variables
config();

const API_BASE = 'https://backend-rp5c.onrender.com/api/v1';

async function testYearlyPricing() {
  try {
    console.log('Testing yearly pricing and checkout...\n');

    // Login to get a token
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'admin@staffsync-demo.com',
      password: 'Admin123!'
    });

    const token = loginResponse.data.data.token;
    console.log('Login successful!');

    // Get plans to see pricing
    console.log('\n1. Getting plans to check pricing...');
    try {
      const plansResponse = await axios.get(`${API_BASE}/subscriptions/plans`);
      const starterPlan = plansResponse.data.data.plans.find((p: any) => p.id === 'STARTER');
      
      console.log('Starter Plan Pricing:');
      console.log(`- Monthly: £${starterPlan.monthlyPricePerWorker / 100} per worker`);
      console.log(`- Yearly: £${starterPlan.yearlyPricePerWorker / 100} per worker`);
      console.log(`- Yearly savings: £${(starterPlan.monthlyPricePerWorker - starterPlan.yearlyPricePerWorker) / 100} per worker per year`);
    } catch (error: any) {
      console.error('Failed to get plans:', error.response?.status, error.response?.data);
    }

    // Test monthly checkout (should work)
    console.log('\n2. Testing MONTHLY checkout...');
    try {
      const monthlyResponse = await axios.post(`${API_BASE}/subscriptions/checkout`, {
        planTier: 'STARTER',
        billingCycle: 'monthly',
        workerCount: 5
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('Monthly checkout successful!');
      console.log('Session ID:', monthlyResponse.data.data.sessionId);
      console.log('Expected charge: £2.50 × 5 workers = £12.50 per month');
    } catch (error: any) {
      console.error('Monthly checkout failed:', error.response?.status);
      console.error('Error details:', error.response?.data);
    }

    // Test yearly checkout (should fail due to missing yearly price IDs)
    console.log('\n3. Testing YEARLY checkout...');
    try {
      const yearlyResponse = await axios.post(`${API_BASE}/subscriptions/checkout`, {
        planTier: 'STARTER',
        billingCycle: 'yearly',
        workerCount: 5
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('Yearly checkout successful!');
      console.log('Session ID:', yearlyResponse.data.data.sessionId);
      console.log('Expected charge: £2.00 × 5 workers = £10.00 per year');
    } catch (error: any) {
      console.error('Yearly checkout failed:', error.response?.status);
      console.error('Error details:', error.response?.data);
      
      if (error.response?.data?.error?.includes('No such price')) {
        console.log('\n--- Yearly Price ID Issue ---');
        console.log('The yearly price ID does not exist in test mode.');
        console.log('Frontend will show yearly pricing, but checkout will fail.');
        console.log('Solution: Create yearly price IDs in Stripe test mode.');
      }
    }

  } catch (error: any) {
    console.error('Test failed:', error.response?.status, error.response?.data || error.message);
  }
}

testYearlyPricing();
