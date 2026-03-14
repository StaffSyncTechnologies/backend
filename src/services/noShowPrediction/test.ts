import { NoShowPredictionEngine } from './engine';
import { WorkerHistory, ShiftContext } from './types';

// Test data for demonstration
const testWorker: WorkerHistory = {
  workerId: 'worker-123',
  totalShifts: 50,
  completedShifts: 45,
  missedShifts: 3,
  lateCancellations: 2,
  onTimeArrivals: 40,
  lateArrivals: 5,
  averageRating: 4.2,
  recentPerformance: [
    {
      shiftId: 'shift-1',
      date: new Date('2024-03-01T09:00:00Z'),
      status: 'completed',
      rating: 4,
      arrivalTime: new Date('2024-03-01T08:55:00Z'),
      shiftStartTime: new Date('2024-03-01T09:00:00Z'),
      weather: { condition: 'sunny', temperature: 15, precipitation: 0 },
      commuteDistance: 5,
      shiftDuration: 8,
      shiftType: 'retail',
      urgency: 'medium',
      payRate: 12.50,
    },
    {
      shiftId: 'shift-2',
      date: new Date('2024-02-28T14:00:00Z'),
      status: 'missed',
      shiftStartTime: new Date('2024-02-28T14:00:00Z'),
      weather: { condition: 'rainy', temperature: 8, precipitation: 15 },
      commuteDistance: 5,
      shiftDuration: 6,
      shiftType: 'retail',
      urgency: 'medium',
      payRate: 12.50,
    },
    {
      shiftId: 'shift-3',
      date: new Date('2024-02-27T22:00:00Z'),
      status: 'late',
      rating: 3,
      arrivalTime: new Date('2024-02-27T22:15:00Z'),
      shiftStartTime: new Date('2024-02-27T22:00:00Z'),
      weather: { condition: 'cloudy', temperature: 10, precipitation: 0 },
      commuteDistance: 5,
      shiftDuration: 4,
      shiftType: 'retail',
      urgency: 'high',
      payRate: 15.00,
    },
  ],
  personalFactors: {
    age: 28,
    commuteMethod: 'public_transport',
    averageCommuteTime: 45,
    familyResponsibilities: true,
    healthIssues: false,
    student: false,
  },
  seasonalPatterns: {
    winterNoShowRate: 0.08,
    summerNoShowRate: 0.04,
    weekendNoShowRate: 0.06,
    holidayNoShowRate: 0.12,
  },
};

const testShift: ShiftContext = {
  id: 'shift-456',
  startTime: new Date('2024-03-15T09:00:00Z'),
  endTime: new Date('2024-03-15T17:00:00Z'),
  duration: 8,
  shiftType: 'retail',
  urgency: 'medium',
  location: {
    latitude: 51.5074,
    longitude: -0.1278,
    address: '123 Oxford Street, London',
    transportLinks: ['central_line', 'piccadilly_line'],
  },
  compensation: {
    hourlyRate: 14.50,
    bonuses: [
      {
        type: 'performance',
        amount: 25,
      },
    ],
  },
  requirements: {
    skills: ['customer service'],
    certifications: [],
    experienceLevel: 'intermediate',
  },
  environmental: {
    weather: {
      condition: 'rainy',
      temperature: 8,
      precipitation: 12,
      visibility: 8,
      windSpeed: 20,
    },
    localEvents: [
      {
        type: 'marathon',
        impact: 'high',
        description: 'London Marathon causing transport disruptions',
      },
    ],
    transportIssues: [
      {
        type: 'tube_strike',
        severity: 'medium',
        affectedLines: ['central_line', 'piccadilly_line'],
      },
    ],
  },
};

// Test function
async function testNoShowPrediction() {
  console.log('🚀 Testing No-Show Prediction Engine...\n');
  
  const engine = new NoShowPredictionEngine();
  
  try {
    // Test 1: Single worker prediction
    console.log('📊 Test 1: Single Worker → Single Shift');
    const prediction = await engine.predictNoShow(testWorker, testShift);
    
    console.log('🎯 Prediction Results:');
    console.log(`   No-Show Probability: ${(prediction.noShowProbability * 100).toFixed(1)}%`);
    console.log(`   Risk Level: ${prediction.riskLevel.toUpperCase()}`);
    console.log(`   Confidence: ${(prediction.confidence * 100).toFixed(1)}%`);
    
    console.log('\n📈 Risk Factor Breakdown:');
    console.log(`   Historical: ${(prediction.factors.historical * 100).toFixed(1)}%`);
    console.log(`   Environmental: ${(prediction.factors.environmental * 100).toFixed(1)}%`);
    console.log(`   Personal: ${(prediction.factors.personal * 100).toFixed(1)}%`);
    console.log(`   Shift: ${(prediction.factors.shift * 100).toFixed(1)}%`);
    
    console.log('\n⚠️  Key Risk Factors:');
    prediction.keyRiskFactors.forEach(factor => {
      console.log(`   • ${factor.description} (${(factor.impact * 100).toFixed(1)}% impact)`);
    });
    
    console.log('\n💡 Recommendations:');
    prediction.recommendations.forEach(rec => console.log(`   • ${rec}`));
    
    console.log('\n🛡️  Mitigation Strategies:');
    prediction.mitigationStrategies.forEach(strategy => {
      console.log(`   • ${strategy.strategy} (${(strategy.effectiveness * 100).toFixed(0)}% effective, ${strategy.cost} cost)`);
    });
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Test 2: Multiple workers prediction
    console.log('📊 Test 2: Multiple Workers → Single Shift');
    
    const testWorkers: WorkerHistory[] = [
      testWorker,
      {
        ...testWorker,
        workerId: 'worker-456',
        totalShifts: 20,
        completedShifts: 15,
        missedShifts: 4,
        personalFactors: {
          ...testWorker.personalFactors,
          healthIssues: true,
        },
        recentPerformance: [
          ...testWorker.recentPerformance.slice(0, 2),
          {
            shiftId: 'shift-4',
            date: new Date('2024-03-10T10:00:00Z'),
            status: 'missed',
            shiftStartTime: new Date('2024-03-10T10:00:00Z'),
            weather: { condition: 'sunny', temperature: 20, precipitation: 0 },
            commuteDistance: 8,
            shiftDuration: 6,
            shiftType: 'retail',
            urgency: 'low',
            payRate: 11.00,
          },
        ],
      },
      {
        ...testWorker,
        workerId: 'worker-789',
        totalShifts: 100,
        completedShifts: 98,
        missedShifts: 1,
        personalFactors: {
          ...testWorker.personalFactors,
          commuteMethod: 'car',
          averageCommuteTime: 20,
          familyResponsibilities: false,
        },
        recentPerformance: testWorker.recentPerformance.map(shift => ({
          ...shift,
          status: 'completed' as const,
          arrivalTime: new Date(shift.shiftStartTime.getTime() - 10 * 60 * 1000), // 10 mins early
        })),
      },
    ];
    
    const batchPredictions = await engine.batchPredict(testWorkers, testShift);
    
    console.log('🏆 Risk Rankings (Highest to Lowest):');
    batchPredictions.forEach((pred, index) => {
      const worker = testWorkers.find(w => w.workerId === pred.workerId);
      console.log(`\n${index + 1}. Worker ${pred.workerId} - Risk: ${(pred.noShowProbability * 100).toFixed(1)}% (${pred.riskLevel.toUpperCase()})`);
      console.log(`   Confidence: ${(pred.confidence * 100).toFixed(1)}%`);
      console.log(`   Top risk factor: ${pred.keyRiskFactors[0]?.description || 'None'}`);
    });
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Test 3: Overall shift risk assessment
    console.log('📊 Test 3: Overall Shift Risk Assessment');
    
    const shiftAssessment = await engine.assessShiftRisk(testWorkers, testShift);
    
    console.log('🎯 Shift Risk Summary:');
    console.log(`   Overall Risk: ${(shiftAssessment.overallRisk * 100).toFixed(1)}%`);
    console.log(`   High Risk Workers: ${shiftAssessment.highRiskWorkers}`);
    console.log(`   Critical Risk Workers: ${shiftAssessment.criticalRiskWorkers}`);
    
    console.log('\n⚠️  Recommended Actions:');
    shiftAssessment.recommendedActions.forEach(action => console.log(`   • ${action}`));
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Test 4: Different shift scenarios
    console.log('📊 Test 4: Different Shift Scenarios');
    
    const scenarios = [
      {
        name: 'Perfect Conditions',
        shift: {
          ...testShift,
          urgency: 'low' as const,
          environmental: {
            weather: { condition: 'sunny', temperature: 20, precipitation: 0, visibility: 10, windSpeed: 5 },
            localEvents: [],
            transportIssues: [],
          },
          compensation: { hourlyRate: 18.00, bonuses: [] },
        },
      },
      {
        name: 'Challenging Conditions',
        shift: {
          ...testShift,
          urgency: 'critical' as const,
          startTime: new Date('2024-03-15T23:00:00Z'), // Late night
          environmental: {
            weather: { condition: 'snow', temperature: -2, precipitation: 25, visibility: 2, windSpeed: 40 },
            localEvents: [
              { type: 'concert', impact: 'high' as const, description: 'Major concert event' },
            ],
            transportIssues: [
              { type: 'bus_strike', severity: 'high' as const, affectedLines: ['all_routes'] },
            ],
          },
          compensation: { hourlyRate: 10.00, bonuses: [] },
        },
      },
    ];
    
    for (const scenario of scenarios) {
      console.log(`\n🎯 ${scenario.name}:`);
      const scenarioPrediction = await engine.predictNoShow(testWorker, scenario.shift);
      console.log(`   Risk: ${(scenarioPrediction.noShowProbability * 100).toFixed(1)}% (${scenarioPrediction.riskLevel.toUpperCase()})`);
      console.log(`   Key factors: ${scenarioPrediction.keyRiskFactors.slice(0, 2).map(f => f.description).join(', ')}`);
    }
    
    console.log('\n🎉 No-Show Prediction Engine Test Complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
if (require.main === module) {
  testNoShowPrediction();
}

export { testNoShowPrediction };
