// Test to simulate the client login flow and token storage
import { prisma } from './src/lib/prisma';
import bcrypt from 'bcryptjs';

async function testClientLoginFlow() {
  try {
    console.log('🔐 Testing client login flow...');
    
    // Step 1: Login (this works as we tested before)
    const loginResponse = await fetch('https://backend-rp5c.onrender.com/api/v1/client/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://app.staffsynctech.co.uk'
      },
      body: JSON.stringify({
        email: 'admin@acmecorporation.com',
        password: 'Client123!'
      })
    });
    
    const loginData = await loginResponse.json();
    
    if (!loginData.success) {
      console.error('❌ Login failed:', loginData);
      return;
    }
    
    console.log('✅ Login successful');
    const token = loginData.data.token;
    console.log('🔑 Token received:', token.substring(0, 50) + '...');
    
    // Step 2: Simulate storing token in localStorage (like frontend does)
    console.log('💾 Storing token in localStorage simulation...');
    
    // Step 3: Test API call with token (like clientDashboard does)
    console.log('🔍 Testing dashboard API call...');
    const dashboardResponse = await fetch('https://backend-rp5c.onrender.com/api/v1/client/dashboard', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Origin': 'https://app.staffsynctech.co.uk'
      }
    });
    
    if (dashboardResponse.ok) {
      const dashboardData = await dashboardResponse.json();
      console.log('✅ Dashboard API successful:', dashboardData.success);
    } else {
      console.error('❌ Dashboard API failed:', dashboardResponse.status, dashboardResponse.statusText);
      const errorData = await dashboardResponse.text();
      console.error('Error details:', errorData);
    }
    
    // Step 4: Test other client APIs that might be causing issues
    console.log('🔍 Testing other client APIs...');
    
    const apisToTest = [
      '/api/v1/client/workers',
      '/api/v1/client/shifts',
      '/api/v1/client/timesheets'
    ];
    
    for (const apiPath of apisToTest) {
      try {
        const response = await fetch(`https://backend-rp5c.onrender.com${apiPath}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Origin': 'https://app.staffsynctech.co.uk'
          }
        });
        
        console.log(`${apiPath}: ${response.status} ${response.statusText}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.log(`  Error: ${errorText.substring(0, 100)}...`);
        }
      } catch (error) {
        console.error(`${apiPath}: Network error:`, error);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testClientLoginFlow();
