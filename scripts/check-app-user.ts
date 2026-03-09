// Check which user the app is actually using
import fetch from 'node-fetch';

interface LoginResponse {
  success: boolean;
  data: {
    token: string;
    user: any;
  };
}

async function checkAppUser() {
  try {
    console.log('🔍 Checking which user the app is actually using...');
    
    // Login as John Smith (same as app)
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
    console.log('User ID:', loginData.data.user.id);
    console.log('User Name:', loginData.data.user.fullName);
    console.log('User Email:', loginData.data.user.email);
    console.log('User Role:', loginData.data.user.role);

    // Call homepage API
    console.log('\n🏠 Calling homepage API...');
    const homeResponse = await fetch('https://backend-rp5c.onrender.com/api/v1/workers/home', {
      headers: {
        'Authorization': `Bearer ${loginData.data.token}`,
        'Content-Type': 'application/json',
      }
    });

    if (!homeResponse.ok) {
      throw new Error(`Homepage API failed: ${homeResponse.status} ${homeResponse.statusText}`);
    }

    const homeData = await homeResponse.json();
    console.log('\n📊 Homepage API Response:');
    console.log('- Success:', homeData.success);
    console.log('- Worker ID:', homeData.data?.worker?.id);
    console.log('- Worker Name:', homeData.data?.worker?.name);
    console.log('- Today Shift:', homeData.data?.todayShift ? 'PRESENT' : 'NULL');
    
    if (homeData.data?.todayShift) {
      console.log('- Today Shift Title:', homeData.data.todayShift.title);
      console.log('- Today Shift Start:', homeData.data.todayShift.startAt);
    } else {
      console.log('❌ Today Shift is NULL!');
    }

    // Check if there are multiple John Smith users
    console.log('\n🔍 Checking for multiple John Smith users...');
    
    // This would require admin access, but let's see what we can check
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

checkAppUser();
