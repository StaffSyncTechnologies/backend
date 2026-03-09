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
    nextShifts: Array<{
      id: string;
      title: string;
      location: string;
      client?: string;
      startAt: string;
      endAt: string;
      hourlyRate: number | null;
    }>;
    upcomingHolidays: any[];
  };
}

async function checkRemoteBackendData() {
  try {
    console.log('🔍 Checking remote backend data...');
    
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

    // Get current time
    const now = new Date();
    console.log('\n📅 Current time info:');
    console.log('Current UTC time:', now.toISOString());
    console.log('Current local time:', now.toString());

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

    const homeData = await homeResponse.json() as HomeResponse;
    console.log('\n📊 Homepage API response:');
    console.log('- Success:', homeData.success);
    console.log('- Greeting:', homeData.data?.greeting);
    console.log('- Worker:', homeData.data?.worker?.firstName);
    console.log('- Today shift:', homeData.data?.todayShift ? 'PRESENT' : 'MISSING');
    
    if (homeData.data?.todayShift) {
      console.log('\n📅 Today shift details:');
      console.log('- Title:', homeData.data.todayShift.title);
      console.log('- Start:', homeData.data.todayShift.startAt);
      console.log('- End:', homeData.data.todayShift.endAt);
      console.log('- Location:', homeData.data.todayShift.location);
      console.log('- Starts in:', homeData.data.todayShift.startsIn, 'minutes');
      console.log('- Status:', homeData.data.todayShift.status);
      
      // Check if shift is actually for today
      const shiftStart = new Date(homeData.data.todayShift.startAt);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      console.log('\n🔍 Date validation:');
      console.log('Today (UTC):', today.toISOString());
      console.log('Tomorrow (UTC):', tomorrow.toISOString());
      console.log('Shift start:', shiftStart.toISOString());
      console.log('Is shift today:', shiftStart >= today && shiftStart < tomorrow);
    } else {
      console.log('\n❌ No today shift found in remote backend!');
      
      // Check next shifts
      if (homeData.data?.nextShifts && homeData.data.nextShifts.length > 0) {
        console.log('\n📋 Next shifts available:');
        homeData.data.nextShifts.forEach((shift, index) => {
          console.log(`${index + 1}. ${shift.title}`);
          console.log(`   Start: ${shift.startAt}`);
          console.log(`   End: ${shift.endAt}`);
        });
      }
    }

    console.log('\n📈 Weekly stats:');
    console.log('- Shifts:', homeData.data?.weeklyStats?.shifts);
    console.log('- Hours worked:', homeData.data?.weeklyStats?.hoursWorked);
    console.log('- Holiday balance:', homeData.data?.weeklyStats?.holidayBalance);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

checkRemoteBackendData();
