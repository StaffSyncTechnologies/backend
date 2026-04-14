import { config } from 'dotenv';
import axios from 'axios';

// Load environment variables
config();

const API_BASE = 'https://backend-rp5c.onrender.com/api/v1';

async function testOriginalBackend() {
  try {
    console.log('Testing original backend (backend-rp5c.onrender.com)...\n');

    // First, try to login to get a token
    console.log('1. Testing login...');
    try {
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

      // Test the checkout endpoint (requires auth)
      console.log('\n2. Testing checkout endpoint (with auth)...');
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
          console.log('This is the actual 500 error you experienced.');
          console.log('The error details are:', JSON.stringify(error.response?.data, null, 2));
        }
      }
    } catch (loginError: any) {
      console.error('Login failed:', loginError.response?.status, loginError.response?.data);
    }

  } catch (error: any) {
    console.error('Test failed:', error.response?.status, error.response?.data || error.message);
  }
}

testOriginalBackend();
