import { config } from 'dotenv';
import axios from 'axios';

// Load environment variables
config();

const API_BASE = 'https://backend-rp5c.onrender.com/api/v1';

async function testNewYearlyPrice() {
  try {
    console.log('Testing new yearly price ID...\n');

    // Login to get a token
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'admin@staffsync-demo.com',
      password: 'Admin123!'
    });

    const token = loginResponse.data.data.token;
    console.log('Login successful!');

    // Test yearly checkout with new price ID
    console.log('\nTesting yearly checkout with new price ID...');
    try {
      const checkoutResponse = await axios.post(`${API_BASE}/subscriptions/checkout`, {
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
      console.log('Session ID:', checkoutResponse.data.data.sessionId);
      console.log('Checkout URL:', checkoutResponse.data.data.url);
      console.log('Expected charge: £30.00 × 5 workers = £150.00 per year');
      
      console.log('\n--- Success! ---');
      console.log('The new yearly price ID is working correctly.');
      console.log('Users can now select yearly billing and it will create a valid Stripe checkout.');
      
    } catch (error: any) {
      console.error('Yearly checkout failed:', error.response?.status);
      console.error('Error details:', error.response?.data);
      
      if (error.response?.data?.error?.includes('No such price')) {
        console.log('\n--- Price ID Issue ---');
        console.log('The price ID might not be available yet or there might be a delay.');
        console.log('Try again in a few minutes or check the Stripe dashboard.');
      }
    }

  } catch (error: any) {
    console.error('Test failed:', error.response?.status, error.response?.data || error.message);
  }
}

testNewYearlyPrice();
