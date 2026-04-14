import { config } from 'dotenv';
import axios from 'axios';

// Load environment variables
config();

const API_BASE = 'https://backend-rp5c.onrender.com/api/v1';

async function testMonthlyCheckout() {
  try {
    console.log('Testing monthly vs yearly checkout...\n');

    // Login to get a token
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'admin@staffsync-demo.com',
      password: 'Admin123!'
    });

    const token = loginResponse.data.data.token;
    console.log('Login successful!');

    // Test monthly checkout (what BillingPage uses)
    console.log('\n1. Testing MONTHLY checkout...');
    try {
      const monthlyResponse = await axios.post(`${API_BASE}/subscriptions/checkout`, {
        planTier: 'STARTER',
        billingCycle: 'monthly',
        workerCount: 1
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('Monthly checkout works:', monthlyResponse.data.success);
      console.log('Monthly session:', monthlyResponse.data.data.sessionId);
    } catch (error: any) {
      console.error('Monthly checkout failed:', error.response?.status);
      console.error('Monthly error details:', error.response?.data);
    }

    // Test yearly checkout (what SettingsPage uses)
    console.log('\n2. Testing YEARLY checkout...');
    try {
      const yearlyResponse = await axios.post(`${API_BASE}/subscriptions/checkout`, {
        planTier: 'STARTER',
        billingCycle: 'yearly',
        workerCount: 1
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('Yearly checkout works:', yearlyResponse.data.success);
      console.log('Yearly session:', yearlyResponse.data.data.sessionId);
    } catch (error: any) {
      console.error('Yearly checkout failed:', error.response?.status);
      console.error('Yearly error details:', error.response?.data);
    }

  } catch (error: any) {
    console.error('Test failed:', error.response?.status, error.response?.data || error.message);
  }
}

testMonthlyCheckout();
