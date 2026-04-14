import { config } from 'dotenv';
import axios from 'axios';

// Load environment variables
config();

const API_BASE = 'https://app.staffsynctech.co.uk/api/v1';

async function testCheckoutEndpoint() {
  try {
    console.log('Testing checkout endpoint...\n');

    // First, try to login to get a token
    console.log('1. Testing login...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'admin@staffsync-demo.com',
      password: 'Admin123!'
    });

    if (!loginResponse.data.success) {
      console.error('Login failed:', loginResponse.data);
      return;
    }

    const token = loginResponse.data.data.token;
    console.log('Login successful! Token obtained.');

    // Test the plans endpoint (should work without auth)
    console.log('\n2. Testing plans endpoint (no auth)...');
    try {
      const plansResponse = await axios.get(`${API_BASE}/subscriptions/plans`);
      console.log('Plans endpoint works:', plansResponse.data.success);
    } catch (error: any) {
      console.error('Plans endpoint failed:', error.response?.status, error.response?.data);
    }

    // Test the subscription summary endpoint (requires auth)
    console.log('\n3. Testing subscription summary endpoint (with auth)...');
    try {
      const summaryResponse = await axios.get(`${API_BASE}/subscriptions/summary`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('Subscription summary works:', summaryResponse.data.success);
      console.log('Current plan:', summaryResponse.data.data.planTier);
    } catch (error: any) {
      console.error('Subscription summary failed:', error.response?.status, error.response?.data);
    }

    // Test the checkout endpoint (requires auth)
    console.log('\n4. Testing checkout endpoint (with auth)...');
    try {
      const checkoutResponse = await axios.post(`${API_BASE}/subscriptions/checkout`, {
        planTier: 'STARTER',
        billingCycle: 'monthly',
        workerCount: 1
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('Checkout endpoint works:', checkoutResponse.data.success);
      console.log('Checkout session created:', checkoutResponse.data.data.sessionId);
      console.log('Checkout URL:', checkoutResponse.data.data.url);
    } catch (error: any) {
      console.error('Checkout endpoint failed:', error.response?.status);
      console.error('Error details:', error.response?.data);
      
      if (error.response?.status === 500) {
        console.log('\n--- 500 Error Analysis ---');
        console.log('This is likely a backend server error.');
        console.log('Possible causes:');
        console.log('1. Stripe configuration issue');
        console.log('2. Database connection issue');
        console.log('3. Missing environment variables');
        console.log('4. Stripe API key issue');
      }
    }

  } catch (error: any) {
    console.error('Test failed:', error.response?.status, error.response?.data || error.message);
  }
}

testCheckoutEndpoint();
