import jwt from 'jsonwebtoken';
import axios from 'axios';

async function checkTokenStructure() {
  try {
    // Get client token
    const loginResponse = await axios.post('https://backend-rp5c.onrender.com/api/v1/client/auth/login', {
      email: 'admin@acmecorporation.com',
      password: 'Client123!'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://app.staffsynctech.co.uk'
      }
    });
    
    const clientToken = loginResponse.data.data.token;
    console.log('🔍 Client Token Structure:');
    console.log(jwt.decode(clientToken));
    
    // Get staff token for comparison
    const staffLoginResponse = await axios.post('https://backend-rp5c.onrender.com/api/v1/auth/staff/login', {
      email: 'admin@acmecorporation.com',
      password: 'Admin123!'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://app.staffsynctech.co.uk'
      }
    });
    
    const staffToken = staffLoginResponse.data.data.token;
    console.log('\n🔍 Staff Token Structure:');
    console.log(jwt.decode(staffToken));
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkTokenStructure();
