import axios from 'axios';

async function testClientDashboard() {
  try {
    // First login to get a token
    console.log('🔐 Testing client login...');
    const loginResponse = await axios.post('https://backend-rp5c.onrender.com/api/v1/client/auth/login', {
      email: 'admin@acmecorporation.com',
      password: 'Client123!'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://app.staffsynctech.co.uk'
      }
    });
    
    console.log('✅ Login successful:', loginResponse.data.data.token.substring(0, 50) + '...');
    
    // Now test accessing the client dashboard
    console.log('🔍 Testing client dashboard access...');
    const dashboardResponse = await axios.get('https://backend-rp5c.onrender.com/api/v1/client/dashboard', {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${loginResponse.data.data.token}`,
        'Origin': 'https://app.staffsynctech.co.uk'
      }
    });
    
    console.log('✅ Dashboard access successful:', dashboardResponse.data);
    
  } catch (error) {
    console.error('❌ Error:', error.response?.status, error.response?.data);
  }
}

testClientDashboard();
