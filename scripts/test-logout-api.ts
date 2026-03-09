// Test script to check the logout API
import fetch from 'node-fetch';

interface LoginResponse {
  success: boolean;
  data: {
    token: string;
    user: any;
  };
}

async function testLogoutAPI() {
  try {
    // First login as John Smith to get a token
    console.log('🔐 Logging in as John Smith...');
    
    const loginResponse = await fetch('https://backend-rp5c.onrender.com/api/v1/auth/worker/password-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'john.smith@test.com',
        password: 'worker123'
      })
    });

    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status} ${loginResponse.statusText}`);
    }

    const loginData = await loginResponse.json() as LoginResponse;
    console.log('✅ Login successful');
    console.log('Token:', loginData.data.token ? 'Present' : 'Missing');
    
    if (!loginData.data.token) {
      throw new Error('No token received');
    }

    // Now test the logout API
    console.log('\n🚪 Testing logout API...');
    
    const logoutResponse = await fetch('https://backend-rp5c.onrender.com/api/v1/auth/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${loginData.data.token}`,
        'Content-Type': 'application/json',
      }
    });

    console.log('Logout response status:', logoutResponse.status);
    console.log('Logout response ok:', logoutResponse.ok);

    if (logoutResponse.ok) {
      const logoutData = await logoutResponse.json();
      console.log('✅ Logout API response:', logoutData);
    } else {
      const errorText = await logoutResponse.text();
      console.log('❌ Logout API error:', errorText);
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

testLogoutAPI();
