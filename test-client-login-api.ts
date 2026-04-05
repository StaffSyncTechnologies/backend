import axios from 'axios';

async function testClientLogin() {
  try {
    const response = await axios.post('https://backend-rp5c.onrender.com/api/v1/client/auth/login', {
      email: 'admin@acmecorporation.com',
      password: 'Client123!'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://app.staffsynctech.co.uk'
      }
    });
    
    console.log('✅ Client login successful:', response.data);
  } catch (error) {
    console.error('❌ Client login failed:', error.response?.data || error.message);
    console.error('Status:', error.response?.status);
    console.error('Headers:', error.response?.headers);
  }
}

testClientLogin();
