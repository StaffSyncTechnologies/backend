// API Test for Smart Matching Engine
// Run this after starting the backend server

const API_BASE = 'http://localhost:3001/api/matching';

async function testMatchingAPI() {
  console.log('🚀 Testing Smart Matching API...\n');

  try {
    // Test 1: Health Check
    console.log('📊 Test 1: Health Check');
    const healthResponse = await fetch(`${API_BASE}/health`);
    const health = await healthResponse.json();
    
    console.log('✅ Health Check Result:');
    console.log(`   Status: ${health.status}`);
    console.log(`   Service: ${health.service}`);
    console.log(`   Timestamp: ${health.timestamp}`);

    // Test 2: Quick Match
    console.log('\n📊 Test 2: Quick Match API');
    
    const testWorker = {
      id: 'worker-123',
      fullName: 'John Smith',
      skills: ['customer service', 'cash handling'],
      certifications: ['food safety'],
      experience: { years: 3, relevantRoles: ['retail associate'] },
      availability: {
        preferredShifts: ['morning', 'afternoon'],
        maxWeeklyHours: 40,
        noticePeriod: 24,
      },
      location: {
        latitude: 51.5074,
        longitude: -0.1278,
        maxTravelDistance: 25,
      },
      preferences: {
        minHourlyRate: 12,
        preferredLocations: ['central london'],
        shiftTypes: ['retail'],
      },
      performance: {
        reliabilityScore: 0.92,
        averageRating: 4.6,
        completedShifts: 45,
        noShowRate: 0.02,
        punctualityScore: 0.95,
      },
    };

    const testShift = {
      id: 'shift-456',
      title: 'Retail Sales Associate',
      description: 'Customer service role',
      requiredSkills: ['customer service'],
      requiredCertifications: [],
      experienceLevel: 'intermediate',
      urgency: 'medium',
      location: {
        latitude: 51.5074,
        longitude: -0.1278,
        address: '123 Oxford Street, London',
      },
      timing: {
        startTime: new Date('2024-03-15T09:00:00Z'),
        endTime: new Date('2024-03-15T17:00:00Z'),
        breakDuration: 60,
      },
      compensation: {
        hourlyRate: 14.50,
        overtimeRate: 21.75,
        bonuses: [],
      },
      specialRequirements: [],
    };

    const quickMatchResponse = await fetch(`${API_BASE}/quick-match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ worker: testWorker, shift: testShift }),
    });

    const quickMatch = await quickMatchResponse.json();
    
    console.log('✅ Quick Match Result:');
    console.log(`   Overall Score: ${quickMatch.data.overallScore}%`);
    console.log(`   Confidence: ${(quickMatch.data.confidence * 100).toFixed(1)}%`);
    console.log(`   Top Reasons: ${quickMatch.data.reasons.slice(0, 2).join(', ')}`);

    // Test 3: Batch Match
    console.log('\n📊 Test 3: Batch Match API');
    
    const testWorkers = [
      testWorker,
      {
        ...testWorker,
        id: 'worker-456',
        fullName: 'Jane Doe',
        skills: ['customer service'],
        performance: {
          reliabilityScore: 0.75,
          averageRating: 3.8,
          completedShifts: 12,
          noShowRate: 0.15,
          punctualityScore: 0.80,
        },
      },
    ];

    const batchMatchResponse = await fetch(`${API_BASE}/batch-match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workers: testWorkers, shift: testShift }),
    });

    const batchMatch = await batchMatchResponse.json();
    
    console.log('✅ Batch Match Result:');
    console.log(`   Total Matches: ${batchMatch.data.total}`);
    console.log(`   Top Match: ${batchMatch.data.matches[0].overallScore}%`);
    console.log(`   Second Match: ${batchMatch.data.matches[1].overallScore}%`);

    console.log('\n🎉 All API Tests Passed!');
    
  } catch (error) {
    console.error('❌ API Test Failed:', error.message);
    console.log('\n💡 Make sure the backend server is running on port 3001');
    console.log('   Run: npm run dev or npm start');
  }
}

// Instructions
console.log('📋 Smart Matching API Test Instructions:');
console.log('1. Start the backend server: npm run dev');
console.log('2. Run this test: node -e "require(\'./api-test.js\').testMatchingAPI()"');
console.log('3. Or use curl/Postman to test endpoints manually\n');

console.log('🔗 Available Endpoints:');
console.log('GET  /api/matching/health');
console.log('POST /api/matching/quick-match');
console.log('POST /api/matching/batch-match');

// Export for programmatic use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testMatchingAPI };
}
