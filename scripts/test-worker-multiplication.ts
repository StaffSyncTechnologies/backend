import { config } from 'dotenv';
import axios from 'axios';

// Load environment variables
config();

const API_BASE = 'https://backend-rp5c.onrender.com/api/v1';

async function testWorkerMultiplication() {
  try {
    console.log('Testing pricing calculation with multiple workers...\n');

    // Login to get a token
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'admin@staffsync-demo.com',
      password: 'Admin123!'
    });

    const token = loginResponse.data.data.token;
    console.log('Login successful!');

    // Get current subscription limits to see worker count
    console.log('\n1. Getting subscription limits...');
    try {
      const limitsResponse = await axios.get(`${API_BASE}/subscriptions/limits`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('Current workers:', limitsResponse.data.data.currentWorkers);
      console.log('Worker limit:', limitsResponse.data.data.workerLimit);
      
      const currentWorkers = limitsResponse.data.data.currentWorkers;
      const pricePerWorker = 2.50; // £2.50 per worker for Starter plan
      const expectedTotal = pricePerWorker * currentWorkers;
      
      console.log(`\nExpected pricing calculation:`);
      console.log(`£${pricePerWorker} per worker × ${currentWorkers} workers = £${expectedTotal}`);
    } catch (error: any) {
      console.error('Failed to get limits:', error.response?.status, error.response?.data);
    }

    // Test checkout with multiple workers
    console.log('\n2. Testing checkout with multiple workers...');
    try {
      const checkoutResponse = await axios.post(`${API_BASE}/subscriptions/checkout`, {
        planTier: 'STARTER',
        billingCycle: 'monthly',
        workerCount: 5 // Test with 5 workers
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('Checkout with 5 workers successful!');
      console.log('Session created:', checkoutResponse.data.data.sessionId);
      console.log('Stripe should charge: £2.50 × 5 = £12.50');
    } catch (error: any) {
      console.error('Checkout with multiple workers failed:', error.response?.status);
      console.error('Error details:', error.response?.data);
    }

    // Test checkout with single worker for comparison
    console.log('\n3. Testing checkout with single worker...');
    try {
      const checkoutResponse = await axios.post(`${API_BASE}/subscriptions/checkout`, {
        planTier: 'STARTER',
        billingCycle: 'monthly',
        workerCount: 1 // Test with 1 worker
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('Checkout with 1 worker successful!');
      console.log('Session created:', checkoutResponse.data.data.sessionId);
      console.log('Stripe should charge: £2.50 × 1 = £2.50');
    } catch (error: any) {
      console.error('Checkout with single worker failed:', error.response?.status);
      console.error('Error details:', error.response?.data);
    }

  } catch (error: any) {
    console.error('Test failed:', error.response?.status, error.response?.data || error.message);
  }
}

testWorkerMultiplication();
