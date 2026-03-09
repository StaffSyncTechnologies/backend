// Test the get shift by ID API call
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

interface ShiftResponse {
  success: boolean;
  data: {
    id: string;
    title: string;
    siteLocation: string;
    siteLat: number;
    siteLng: number;
    startAt: string;
    endAt: string;
    hourlyRate: number;
    // Add other fields as needed
  };
}

async function testGetShiftById() {
  try {
    console.log('🔍 Testing get shift by ID API...');
    
    // Login as John Smith
    const loginResponse = await fetch('https://backend-rp5c.onrender.com/api/v1/auth/worker/password-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'john.smith@test.com', // Try the test user first
        password: 'worker123'
      })
    });

    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status} ${loginResponse.statusText}`);
    }

    const loginData = await loginResponse.json() as LoginResponse;
    console.log('✅ Login successful');

    // First get the homepage to find a shift ID
    console.log('\n🏠 Getting homepage to find shift ID...');
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
    console.log('Today shift:', homeData.data?.todayShift ? 'PRESENT' : 'NULL');
    
    if (!homeData.data?.todayShift) {
      console.log('❌ No today shift found to test with');
      return;
    }

    const shiftId = homeData.data.todayShift.id;
    console.log('Found shift ID:', shiftId);

    // Test the get by ID API
    console.log('\n📡 Testing get by ID API...');
    const shiftResponse = await fetch(`https://backend-rp5c.onrender.com/api/v1/shifts/${shiftId}`, {
      headers: {
        'Authorization': `Bearer ${loginData.data.token}`,
        'Content-Type': 'application/json',
      }
    });

    console.log('Response status:', shiftResponse.status);
    console.log('Response ok:', shiftResponse.ok);

    if (!shiftResponse.ok) {
      const errorText = await shiftResponse.text();
      console.log('❌ Error response:', errorText);
      return;
    }

    const shiftData = await shiftResponse.json() as ShiftResponse;
    console.log('✅ Shift data received:');
    console.log('- Success:', shiftData.success);
    console.log('- Has data:', !!shiftData.data);
    console.log('- Shift title:', shiftData.data?.title);
    console.log('- Shift hourlyRate:', shiftData.data?.hourlyRate);
    console.log('- Full response:', JSON.stringify(shiftData, null, 2));

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

testGetShiftById();
