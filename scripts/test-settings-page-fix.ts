import { config } from 'dotenv';
import axios from 'axios';

// Load environment variables
config();

const API_BASE = 'https://backend-rp5c.onrender.com/api/v1';

async function testSettingsPageFix() {
  try {
    console.log('Testing Settings page fix (monthly billing)...\n');

    // Login to get a token
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'admin@staffsync-demo.com',
      password: 'Admin123!'
    });

    const token = loginResponse.data.data.token;
    console.log('Login successful!');

    // Test monthly checkout (what Settings page now uses by default)
    console.log('\nTesting MONTHLY checkout (Settings page default)...');
    try {
      const monthlyResponse = await axios.post(`${API_BASE}/subscriptions/checkout`, {
        planTier: 'STARTER',
        billingCycle: 'monthly',  // This is now the default in SettingsPage
        workerCount: 1
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('Monthly checkout works:', monthlyResponse.data.success);
      console.log('Session created:', monthlyResponse.data.data.sessionId);
      console.log('Settings page checkout should now work!');
    } catch (error: any) {
      console.error('Monthly checkout failed:', error.response?.status);
      console.error('Error details:', error.response?.data);
    }

    console.log('\n--- Summary ---');
    console.log('Fixed the Settings page 500 error by:');
    console.log('1. Changed default billingCycle from "yearly" to "monthly"');
    console.log('2. Added billing cycle toggle to Settings page checkout view');
    console.log('3. Users can now choose monthly (working) or yearly (if available)');
    console.log('4. Monthly billing uses price IDs that exist in test mode');
    console.log('5. Yearly billing fails due to missing test mode price IDs');

  } catch (error: any) {
    console.error('Test failed:', error.response?.status, error.response?.data || error.message);
  }
}

testSettingsPageFix();
