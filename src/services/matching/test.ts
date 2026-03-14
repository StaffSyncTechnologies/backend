import { SmartMatchingEngine } from './engine';
import { WorkerProfile, ShiftRequirement } from './types';

// Test data for demonstration
const testWorker: WorkerProfile = {
  id: 'worker-123',
  fullName: 'John Smith',
  skills: ['customer service', 'cash handling', 'inventory management', 'team leadership'],
  certifications: ['food safety', 'first aid'],
  experience: {
    years: 3,
    relevantRoles: ['retail associate', 'team lead'],
  },
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
    preferredLocations: ['central london', 'westminster'],
    shiftTypes: ['retail', 'customer service'],
  },
  performance: {
    reliabilityScore: 0.92,
    averageRating: 4.6,
    completedShifts: 45,
    noShowRate: 0.02,
    punctualityScore: 0.95,
  },
};

const testShift: ShiftRequirement = {
  id: 'shift-456',
  title: 'Retail Sales Associate',
  description: 'Customer service and cash handling for busy retail store',
  requiredSkills: ['customer service', 'cash handling'],
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
    bonuses: [
      {
        type: 'performance',
        amount: 50,
        condition: 'Excellent customer feedback',
      },
    ],
  },
  specialRequirements: ['weekend availability preferred'],
};

// Test function
async function testSmartMatching() {
  console.log('🚀 Testing Smart Matching Engine...\n');
  
  const engine = new SmartMatchingEngine();
  
  try {
    // Test 1: Single worker to single shift
    console.log('📊 Test 1: Single Worker → Single Shift');
    const match = await engine.matchWorkerToShift(testWorker, testShift);
    
    console.log('🎯 Matching Results:');
    console.log(`   Overall Score: ${match.overallScore}%`);
    console.log(`   Confidence: ${(match.confidence * 100).toFixed(1)}%`);
    console.log('\n📈 Score Breakdown:');
    console.log(`   Skill Match: ${match.breakdown.skillMatch}%`);
    console.log(`   Performance: ${match.breakdown.performanceScore}%`);
    console.log(`   Availability: ${match.breakdown.availabilityMatch}%`);
    console.log(`   Location: ${match.breakdown.locationMatch}%`);
    console.log(`   Preferences: ${match.breakdown.preferenceMatch}%`);
    
    console.log('\n✅ Positive Reasons:');
    match.reasons.forEach(reason => console.log(`   • ${reason}`));
    
    if (match.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      match.warnings.forEach(warning => console.log(`   • ${warning}`));
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Test 2: Multiple workers to single shift
    console.log('📊 Test 2: Multiple Workers → Single Shift');
    
    const testWorkers: WorkerProfile[] = [
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
      {
        ...testWorker,
        id: 'worker-789',
        fullName: 'Mike Johnson',
        skills: ['customer service', 'cash handling', 'inventory management', 'team leadership', 'visual merchandising'],
        experience: { years: 5, relevantRoles: ['store manager', 'team lead'] },
        performance: {
          reliabilityScore: 0.98,
          averageRating: 4.9,
          completedShifts: 120,
          noShowRate: 0.01,
          punctualityScore: 0.99,
        },
      },
    ];
    
    const batchMatches = await engine.matchWorkersToShift(testWorkers, testShift);
    
    console.log('🏆 Top 3 Matches:');
    batchMatches.slice(0, 3).forEach((match, index) => {
      const worker = testWorkers.find(w => w.id === match.workerId);
      console.log(`\n${index + 1}. ${worker?.fullName || 'Unknown'} - Score: ${match.overallScore}%`);
      console.log(`   Confidence: ${(match.confidence * 100).toFixed(1)}%`);
      console.log(`   Top reasons: ${match.reasons.slice(0, 2).join(', ')}`);
    });
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Test 3: Worker to multiple shifts
    console.log('📊 Test 3: Single Worker → Multiple Shifts');
    
    const testShifts: ShiftRequirement[] = [
      testShift,
      {
        ...testShift,
        id: 'shift-789',
        title: ' Overnight Stock Associate',
        requiredSkills: ['inventory management'],
        timing: {
          startTime: new Date('2024-03-15T23:00:00Z'),
          endTime: new Date('2024-03-16T07:00:00Z'),
          breakDuration: 30,
        },
        urgency: 'critical',
      },
      {
        ...testShift,
        id: 'shift-101',
        title: 'Senior Team Leader',
        requiredSkills: ['team leadership', 'customer service', 'inventory management'],
        experienceLevel: 'senior',
        compensation: {
          hourlyRate: 18.00,
          overtimeRate: 27.00,
          bonuses: [],
        },
      },
    ];
    
    const shiftMatches = await engine.matchWorkerToShifts(testWorker, testShifts);
    
    console.log('🎯 Best Shift Matches for John Smith:');
    shiftMatches.forEach((match, index) => {
      const shift = testShifts.find(s => s.id === match.shiftId);
      console.log(`\n${index + 1}. ${shift?.title || 'Unknown'} - Score: ${match.overallScore}%`);
      console.log(`   Urgency: ${shift?.urgency}`);
      console.log(`   Pay Rate: £${shift?.compensation.hourlyRate}/hour`);
      console.log(`   Top reasons: ${match.reasons.slice(0, 2).join(', ')}`);
    });
    
    console.log('\n🎉 Smart Matching Engine Test Complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
if (require.main === module) {
  testSmartMatching();
}

export { testSmartMatching };
