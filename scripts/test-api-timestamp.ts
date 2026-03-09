// Test the API with timestamp parameter to see if it works
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
      hourlyRate: number;
      startsIn: number;
      status: string;
      clockedIn: boolean;
      clockedOut: boolean;
    } | null;
    nextShifts: any[];
    upcomingHolidays: any[];
  };
}

async function testAPIWithTimestamp() {
  try {
    console.log('🔍 Testing API with timestamp parameter...');
    
    // Login as John Smith
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

    // Test 1: API without timestamp
    console.log('\n📡 Test 1: API without timestamp');
    const response1 = await fetch('https://backend-rp5c.onrender.com/api/v1/workers/home', {
      headers: {
        'Authorization': `Bearer ${loginData.data.token}`,
        'Content-Type': 'application/json',
      }
    });

    const data1 = await response1.json() as HomeResponse;
    console.log('- Status:', response1.status);
    console.log('- Today shift:', data1.data?.todayShift ? 'PRESENT' : 'MISSING');
    if (data1.data?.todayShift) {
      console.log('- Shift title:', data1.data.todayShift.title);
    }

    // Test 2: API with timestamp
    console.log('\n📡 Test 2: API with timestamp parameter');
    const timestamp = Date.now();
    const response2 = await fetch(`https://backend-rp5c.onrender.com/api/v1/workers/home?_t=${timestamp}`, {
      headers: {
        'Authorization': `Bearer ${loginData.data.token}`,
        'Content-Type': 'application/json',
      }
    });

    const data2 = await response2.json() as HomeResponse;
    console.log('- Status:', response2.status);
    console.log('- Timestamp used:', timestamp);
    console.log('- Today shift:', data2.data?.todayShift ? 'PRESENT' : 'MISSING');
    if (data2.data?.todayShift) {
      console.log('- Shift title:', data2.data.todayShift.title);
    }

    // Test 3: API with different timestamp
    console.log('\n📡 Test 3: API with different timestamp');
    const timestamp2 = Date.now() + 1000;
    const response3 = await fetch(`https://backend-rp5c.onrender.com/api/v1/workers/home?_t=${timestamp2}`, {
      headers: {
        'Authorization': `Bearer ${loginData.data.token}`,
        'Content-Type': 'application/json',
      }
    });

    const data3 = await response3.json() as HomeResponse;
    console.log('- Status:', response3.status);
    console.log('- Timestamp used:', timestamp2);
    console.log('- Today shift:', data3.data?.todayShift ? 'PRESENT' : 'MISSING');
    if (data3.data?.todayShift) {
      console.log('- Shift title:', data3.data.todayShift.title);
    }

    // Compare results
    console.log('\n🔍 Comparison:');
    console.log('- Response 1 todayShift:', !!data1.data?.todayShift);
    console.log('- Response 2 todayShift:', !!data2.data?.todayShift);
    console.log('- Response 3 todayShift:', !!data3.data?.todayShift);
    console.log('- All responses identical:', JSON.stringify(data1.data) === JSON.stringify(data2.data) && JSON.stringify(data2.data) === JSON.stringify(data3.data));

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

testAPIWithTimestamp();
