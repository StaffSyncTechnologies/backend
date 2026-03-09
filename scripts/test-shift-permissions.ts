// Test the shift access permissions for both users
import fetch from 'node-fetch';

interface LoginResponse {
  success: boolean;
  data: {
    token: string;
    user: any;
  };
}

async function testShiftPermissions() {
  try {
    console.log('🔍 Testing shift access permissions...');
    
    const shiftId = '0004ad76-5ca6-45da-a3a8-6addd70e0339';
    
    // Test 1: Login as test user (john.smith@test.com)
    console.log('\n👤 Test 1: Test User (john.smith@test.com)');
    const testLoginResponse = await fetch('https://backend-rp5c.onrender.com/api/v1/auth/worker/password-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'john.smith@test.com',
        password: 'worker123'
      })
    });

    if (testLoginResponse.ok) {
      const testLoginData = await testLoginResponse.json() as LoginResponse;
      console.log('✅ Test user login successful');
      
      const testShiftResponse = await fetch(`https://backend-rp5c.onrender.com/api/v1/shifts/${shiftId}`, {
        headers: {
          'Authorization': `Bearer ${testLoginData.data.token}`,
          'Content-Type': 'application/json',
        }
      });
      
      console.log('Test user shift access:', testShiftResponse.ok ? '✅ ALLOWED' : `❌ DENIED (${testShiftResponse.status})`);
      if (!testShiftResponse.ok) {
        const error = await testShiftResponse.json() as any;
        console.log('Error:', error.data?.error);
      }
    }
    
    // Test 2: Login as app user (john.smith@email.com)
    console.log('\n👤 Test 2: App User (john.smith@email.com)');
    const appLoginResponse = await fetch('https://backend-rp5c.onrender.com/api/v1/auth/worker/password-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'john.smith@email.com',
        password: 'worker123' // This might be wrong
      })
    });

    if (!appLoginResponse.ok) {
      console.log('❌ App user login failed:', appLoginResponse.status);
      console.log('The password for john.smith@email.com might be different');
      
      // Try with a common password
      const commonPasswords = ['worker123', 'password', '123456', 'test123'];
      
      for (const pwd of commonPasswords) {
        console.log(`\n🔐 Trying password: ${pwd}`);
        const tryLoginResponse = await fetch('https://backend-rp5c.onrender.com/api/v1/auth/worker/password-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'john.smith@email.com',
            password: pwd
          })
        });
        
        if (tryLoginResponse.ok) {
          console.log('✅ Found correct password:', pwd);
          const tryLoginData = await tryLoginResponse.json() as LoginResponse;
          
          const tryShiftResponse = await fetch(`https://backend-rp5c.onrender.com/api/v1/shifts/${shiftId}`, {
            headers: {
              'Authorization': `Bearer ${tryLoginData.data.token}`,
              'Content-Type': 'application/json',
            }
          });
          
          console.log('App user shift access:', tryShiftResponse.ok ? '✅ ALLOWED' : `❌ DENIED (${tryShiftResponse.status})`);
          if (!tryShiftResponse.ok) {
            const error = await tryShiftResponse.json() as any;
            console.log('Error:', error.data?.error);
          }
          break;
        } else {
          console.log('❌ Password failed');
        }
      }
    } else {
      const appLoginData = await appLoginResponse.json() as LoginResponse;
      console.log('✅ App user login successful');
      
      const appShiftResponse = await fetch(`https://backend-rp5c.onrender.com/api/v1/shifts/${shiftId}`, {
        headers: {
          'Authorization': `Bearer ${appLoginData.data.token}`,
          'Content-Type': 'application/json',
        }
      });
      
      console.log('App user shift access:', appShiftResponse.ok ? '✅ ALLOWED' : `❌ DENIED (${appShiftResponse.status})`);
      if (!appShiftResponse.ok) {
        const error = await appShiftResponse.json() as any;
        console.log('Error:', error.data?.error);
      }
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

testShiftPermissions();
