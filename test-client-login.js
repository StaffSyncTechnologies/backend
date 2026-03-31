import axios from 'axios';

async function testClientLogin() {
  const email = 'admin@acmecorporation.com';
  const password = 'Client123!'; // Correct password from seed data

  try {
    console.log('🔑 Testing client login...');
    
    const response = await axios.post('http://localhost:3001/api/v1/client/auth/login', {
      email,
      password
    });

    console.log('✅ Login successful!');
    console.log('📊 Response structure:', {
      hasData: !!response.data.data,
      dataKeys: response.data.data ? Object.keys(response.data.data) : [],
      hasAgencies: !!(response.data.data?.agencies),
      agenciesCount: response.data.data?.agencies?.length,
      hasCurrentAgency: !!(response.data.data?.currentAgency),
      tokenLength: response.data.data?.token?.length
    });

    if (response.data.data?.agencies) {
      console.log('🏢 Agencies:', response.data.data.agencies);
    }
    if (response.data.data?.currentAgency) {
      console.log('📍 Current Agency:', response.data.data.currentAgency);
    }

  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
  }
}

testClientLogin();
