import axios from 'axios';

async function testClientChatEndpoints() {
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
    
    const token = loginResponse.data.data.token;
    console.log('✅ Login successful');
    
    // Test client chat endpoints
    console.log('🔍 Testing client chat endpoints...');
    
    const endpoints = [
      '/api/v1/chat/client/rooms',
      '/api/v1/chat/client/unread-count'
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await axios.get(`https://backend-rp5c.onrender.com${endpoint}`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Origin': 'https://app.staffsynctech.co.uk'
          }
        });
        
        console.log(`✅ ${endpoint}: ${response.status}`);
        console.log(`  Data:`, response.data);
      } catch (error) {
        console.error(`❌ ${endpoint}: ${(error as any).response?.status}`);
        console.error(`  Error:`, (error as any).response?.data);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testClientChatEndpoints();
