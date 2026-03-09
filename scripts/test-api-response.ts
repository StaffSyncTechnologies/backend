// Test script to check the actual API response
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
    todayShift: {
      id: string;
      title: string;
      location: string;
      client?: string;
      startAt: string;
      endAt: string;
      hourlyRate: number | null;
      startsIn: number | null;
      status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
      clockedIn: boolean;
      clockedOut: boolean;
    } | null;
    nextShifts: any[];
    upcomingHolidays: any[];
  };
}

async function testHomepageAPI() {
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

    // Now call the homepage API
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

    const homeData = await homeResponse.json() as HomeResponse;
    console.log('✅ Homepage API response received');
    console.log('\n📊 Response structure:');
    console.log('- Success:', homeData.success);
    console.log('- Has data:', !!homeData.data);
    
    if (homeData.data) {
      console.log('- Greeting:', homeData.data.greeting);
      console.log('- Worker name:', homeData.data.worker?.firstName);
      console.log('- Today shift:', homeData.data.todayShift ? 'Present' : 'Missing');
      
      if (homeData.data.todayShift) {
        console.log('\n📅 Today shift details:');
        console.log('- Title:', homeData.data.todayShift.title);
        console.log('- Location:', homeData.data.todayShift.location);
        console.log('- Start:', homeData.data.todayShift.startAt);
        console.log('- End:', homeData.data.todayShift.endAt);
        console.log('- Status:', homeData.data.todayShift.status);
        console.log('- Clocked in:', homeData.data.todayShift.clockedIn);
        console.log('- Starts in:', homeData.data.todayShift.startsIn);
      }
      
      console.log('\n📈 Weekly stats:');
      console.log('- Shifts:', homeData.data.weeklyStats?.shifts);
      console.log('- Hours:', homeData.data.weeklyStats?.hoursWorked);
      console.log('- Holiday balance:', homeData.data.weeklyStats?.holidayBalance);
      
      console.log('\n📋 Next shifts:', homeData.data.nextShifts?.length || 0);
      console.log('🏖️ Upcoming holidays:', homeData.data.upcomingHolidays?.length || 0);
    }
    
    console.log('\n🎯 Full response:');
    console.log(JSON.stringify(homeData, null, 2));

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

testHomepageAPI();
