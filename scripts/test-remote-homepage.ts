// Test the actual remote homepage API with detailed debugging
import fetch from 'node-fetch';

interface LoginResponse {
  success: boolean;
  data: {
    token: string;
    user: any;
  };
}

interface HomeResponse {
  success: boolean;
  data: {
    greeting: string;
    worker: {
      id: string;
      name: string;
      firstName: string;
    };
    weeklyStats: {
      shifts: number;
      holidayBalance: number;
      hoursWorked: number;
    };
    todayShift: any;
    nextShifts: any[];
    upcomingHolidays: any[];
  };
}

async function testRemoteHomepageAPI() {
  try {
    // Login as John Smith
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

    // Call the homepage API
    console.log('\n🏠 Calling homepage API...');
    console.log('Request URL: https://backend-rp5c.onrender.com/api/v1/workers/home');
    console.log('Authorization: Bearer', loginData.data.token.substring(0, 20) + '...');
    
    const homeResponse = await fetch('https://backend-rp5c.onrender.com/api/v1/workers/home', {
      headers: {
        'Authorization': `Bearer ${loginData.data.token}`,
        'Content-Type': 'application/json',
      }
    });

    console.log('\n📊 Response status:', homeResponse.status);
    console.log('Response ok:', homeResponse.ok);

    if (!homeResponse.ok) {
      const errorText = await homeResponse.text();
      console.log('❌ Error response:', errorText);
      return;
    }

    const homeData = await homeResponse.json() as HomeResponse;
    console.log('\n🎯 Full homepage response:');
    console.log(JSON.stringify(homeData, null, 2));

    // Analyze the response
    if (homeData.success && homeData.data) {
      console.log('\n📋 Response analysis:');
      console.log('- Success:', homeData.success);
      console.log('- Has data:', !!homeData.data);
      console.log('- Greeting:', homeData.data.greeting);
      console.log('- Worker name:', homeData.data.worker?.firstName);
      console.log('- Today shift:', homeData.data.todayShift ? 'Present' : 'MISSING');
      console.log('- Next shifts count:', homeData.data.nextShifts?.length || 0);
      
      if (!homeData.data.todayShift) {
        console.log('\n❌ PROBLEM: todayShift is null even though it should exist!');
        console.log('This indicates a bug in the backend getHomepage method.');
      }
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

testRemoteHomepageAPI();
