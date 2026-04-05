import axios from 'axios';
import jwt from 'jsonwebtoken';

async function testFrontendFlow() {
  try {
    console.log('🔐 Testing exact frontend flow...');
    
    // Step 1: Login exactly like frontend
    console.log('1. Login request...');
    const loginResponse = await axios.post('https://backend-rp5c.onrender.com/api/v1/client/auth/login', {
      email: 'admin@acmecorporation.com',
      password: 'Client123!'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://app.staffsynctech.co.uk'
      }
    });
    
    console.log('✅ Login successful');
    const token = loginResponse.data.data.token;
    console.log('🔑 Token length:', token.length);
    
    // Step 2: Simulate localStorage storage
    console.log('2. Simulating localStorage...');
    const authToken = token; // This is what localStorage.getItem('authToken') would return
    
    // Step 3: Test axiosBaseQuery behavior (like frontend clientDashboardApi)
    console.log('3. Testing axiosBaseQuery behavior...');
    
    // Create axios instance like frontend does
    const apiClient = axios.create({
      baseURL: 'https://backend-rp5c.onrender.com',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    // Add request interceptor like frontend
    apiClient.interceptors.request.use((config) => {
      const token = authToken; // Simulate localStorage.getItem('authToken')
      if (token) {
        config.headers.authorization = `Bearer ${token}`;
      }
      return config;
    });
    
    // Add response interceptor like frontend (this is what triggers the redirect)
    apiClient.interceptors.response.use(
      (response) => response,
      (error) => {
        console.log('🚨 Axios error intercepted:', (error as any).response?.status);
        if ((error as any).response?.status === 401) {
          console.log('🔄 401 detected - this would trigger redirect to login');
          console.log('Error details:', (error as any).response?.data);
        }
        return Promise.reject(error);
      }
    );
    
    // Step 4: Test dashboard call like frontend
    console.log('4. Testing dashboard call...');
    try {
      const dashboardResponse = await apiClient.get('/api/v1/client/dashboard');
      console.log('✅ Dashboard successful:', dashboardResponse.status);
    } catch (error) {
      console.error('❌ Dashboard failed:', (error as any).response?.status, (error as any).response?.data);
    }
    
    // Step 5: Test other API calls
    console.log('5. Testing other APIs...');
    const apis = ['/api/v1/client/workers', '/api/v1/client/shifts', '/api/v1/client/timesheets'];
    
    for (const api of apis) {
      try {
        const response = await apiClient.get(api);
        console.log(`✅ ${api}: ${response.status}`);
      } catch (error) {
        console.error(`❌ ${api}: ${(error as any).response?.status}`, (error as any).response?.data?.error || (error as any).response?.data?.message);
      }
    }
    
    // Step 6: Test token decode
    console.log('6. Testing token decode...');
    try {
      const decoded = jwt.decode(token);
      console.log('🔍 Token payload:', decoded);
    } catch (error) {
      console.error('❌ Token decode failed:', error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testFrontendFlow();
