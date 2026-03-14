import { NearbyWorkerRankingEngine } from './engine';
import { WorkerLocation, ShiftLocation } from './types';

// Test data for demonstration
const testWorkers: WorkerLocation[] = [
  {
    workerId: 'worker-1',
    fullName: 'Alice Johnson',
    currentLocation: {
      latitude: 51.5074,
      longitude: -0.1278,
      accuracy: 10,
      timestamp: new Date(),
      address: 'Oxford Street, London',
    },
    homeLocation: {
      latitude: 51.5074,
      longitude: -0.1278,
      address: 'Oxford Street, London',
    },
    availability: {
      isAvailable: true,
      availableFrom: new Date(),
      availableUntil: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours from now
      maxTravelDistance: 15,
      preferredWorkRadius: 10,
    },
    skills: ['customer service', 'cash handling', 'inventory'],
    certifications: ['food safety'],
    performance: {
      reliabilityScore: 0.95,
      averageRating: 4.8,
      completedShifts: 120,
      responseTime: 8, // minutes
    },
    commutePreferences: {
      transportMethods: ['public_transport', 'walk'],
      maxCommuteTime: 60,
      avoidTolls: false,
      preferCoveredTransport: true,
    },
    workPreferences: {
      shiftTypes: ['retail', 'customer service'],
      minHourlyRate: 12.00,
      emergencyOnly: false,
    },
  },
  {
    workerId: 'worker-2',
    fullName: 'Bob Smith',
    currentLocation: {
      latitude: 51.5000,
      longitude: -0.1200,
      accuracy: 15,
      timestamp: new Date(),
      address: 'Regent Street, London',
    },
    homeLocation: {
      latitude: 51.5150,
      longitude: -0.1400,
      address: 'Camden, London',
    },
    availability: {
      isAvailable: true,
      availableFrom: new Date(),
      availableUntil: new Date(Date.now() + 6 * 60 * 60 * 1000),
      maxTravelDistance: 20,
      preferredWorkRadius: 12,
    },
    skills: ['customer service', 'sales', 'visual merchandising'],
    certifications: ['first aid'],
    performance: {
      reliabilityScore: 0.88,
      averageRating: 4.5,
      completedShifts: 85,
      responseTime: 15,
    },
    commutePreferences: {
      transportMethods: ['car', 'public_transport'],
      maxCommuteTime: 45,
      avoidTolls: true,
      preferCoveredTransport: false,
    },
    workPreferences: {
      shiftTypes: ['retail', 'sales'],
      minHourlyRate: 13.50,
      emergencyOnly: false,
    },
  },
  {
    workerId: 'worker-3',
    fullName: 'Carol Davis',
    currentLocation: {
      latitude: 51.5200,
      longitude: -0.1100,
      accuracy: 8,
      timestamp: new Date(),
      address: 'King\'s Cross, London',
    },
    homeLocation: {
      latitude: 51.5300,
      longitude: -0.1000,
      address: 'Islington, London',
    },
    availability: {
      isAvailable: false,
      maxTravelDistance: 25,
      preferredWorkRadius: 15,
    },
    skills: ['customer service', 'team leadership', 'training'],
    certifications: ['management', 'food safety'],
    performance: {
      reliabilityScore: 0.92,
      averageRating: 4.7,
      completedShifts: 200,
      responseTime: 5,
    },
    commutePreferences: {
      transportMethods: ['car'],
      maxCommuteTime: 30,
      avoidTolls: false,
      preferCoveredTransport: false,
    },
    workPreferences: {
      shiftTypes: ['management', 'training'],
      minHourlyRate: 18.00,
      emergencyOnly: true,
    },
  },
  {
    workerId: 'worker-4',
    fullName: 'David Wilson',
    currentLocation: {
      latitude: 51.4900,
      longitude: -0.1500,
      accuracy: 20,
      timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      address: 'South Kensington, London',
    },
    homeLocation: {
      latitude: 51.4800,
      longitude: -0.1600,
      address: 'Chelsea, London',
    },
    availability: {
      isAvailable: true,
      availableFrom: new Date(Date.now() + 2 * 60 * 60 * 1000), // Available in 2 hours
      availableUntil: new Date(Date.now() + 10 * 60 * 60 * 1000),
      maxTravelDistance: 8,
      preferredWorkRadius: 5,
    },
    skills: ['stock management', 'inventory', 'logistics'],
    certifications: ['forklift'],
    performance: {
      reliabilityScore: 0.78,
      averageRating: 4.2,
      completedShifts: 45,
      responseTime: 45,
    },
    commutePreferences: {
      transportMethods: ['bike', 'public_transport'],
      maxCommuteTime: 40,
      avoidTolls: true,
      preferCoveredTransport: true,
    },
    workPreferences: {
      shiftTypes: ['warehouse', 'logistics'],
      minHourlyRate: 11.50,
      emergencyOnly: false,
    },
  },
];

const testShift: ShiftLocation = {
  shiftId: 'shift-123',
  location: {
    latitude: 51.5074,
    longitude: -0.1278,
    address: '123 Oxford Street, London',
    venue: 'Department Store',
    floor: 2,
    parking: true,
    publicTransportAccess: true,
  },
  requirements: {
    urgency: 'medium',
    startTime: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours from now
    endTime: new Date(Date.now() + 11 * 60 * 60 * 1000), // 11 hours from now
    duration: 8,
    skills: ['customer service'],
    certifications: [],
    experienceLevel: 'intermediate',
  },
  compensation: {
    hourlyRate: 14.50,
    bonuses: [
      {
        type: 'performance',
        amount: 25,
        condition: 'Excellent customer feedback',
      },
    ],
    travelReimbursement: true,
    parkingAllowance: 10,
  },
  environmental: {
    weatherConditions: {
      temperature: 15,
      precipitation: 5,
      windSpeed: 10,
      visibility: 8,
    },
    transportConditions: {
      trafficLevel: 'medium',
      publicTransportStatus: 'normal',
      roadClosures: [],
      specialEvents: [],
    },
  },
};

// Test function
async function testNearbyWorkerRanking() {
  console.log('🚀 Testing Nearby Worker Ranking Engine...\n');
  
  const engine = new NearbyWorkerRankingEngine();
  
  try {
    // Test 1: Basic ranking
    console.log('📊 Test 1: Basic Worker Ranking');
    const rankings = await engine.rankNearbyWorkers(testWorkers, testShift);
    
    console.log('🏆 Top 3 Ranked Workers:');
    rankings.slice(0, 3).forEach((ranking, index) => {
      const worker = testWorkers.find(w => w.workerId === ranking.workerId);
      console.log(`\n${index + 1}. ${worker?.fullName} - Score: ${ranking.overallScore}% (Rank #${ranking.rank})`);
      console.log(`   Distance: ${ranking.distance.current}km (current), ${ranking.distance.home}km (home)`);
      console.log(`   Travel Time: ${ranking.distance.estimatedTravelTime} minutes`);
      console.log(`   Available: ${ranking.availability.isAvailable ? '✅' : '❌'}`);
      console.log(`   Confidence: ${(ranking.confidence * 100).toFixed(1)}%`);
      
      console.log('   📈 Factor Scores:');
      console.log(`     Proximity: ${ranking.factors.proximity}%`);
      console.log(`     Availability: ${ranking.factors.availability}%`);
      console.log(`     Skills: ${ranking.factors.skills}%`);
      console.log(`     Performance: ${ranking.factors.performance}%`);
      console.log(`     Response: ${ranking.factors.response}%`);
      console.log(`     Cost: ${ranking.factors.cost}%`);
      
      if (ranking.insights.strengths.length > 0) {
        console.log(`   💪 Strengths: ${ranking.insights.strengths.slice(0, 2).join(', ')}`);
      }
      
      if (ranking.insights.concerns.length > 0) {
        console.log(`   ⚠️  Concerns: ${ranking.insights.concerns.slice(0, 2).join(', ')}`);
      }
    });
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Test 2: Urgent worker search
    console.log('📊 Test 2: Urgent Worker Search (Critical Shift)');
    const urgentShift: ShiftLocation = {
      ...testShift,
      shiftId: 'shift-urgent',
      requirements: {
        ...testShift.requirements,
        urgency: 'critical',
        startTime: new Date(Date.now() + 1 * 60 * 60 * 1000), // 1 hour from now
      },
    };
    
    const urgentWorkers = await engine.getUrgentNearbyWorkers(
      testWorkers, 
      urgentShift, 
      10, // 10km radius
      5   // top 5
    );
    
    console.log('🚨 Urgent Shift Candidates (within 10km):');
    urgentWorkers.forEach((worker, index) => {
      const workerData = testWorkers.find(w => w.workerId === worker.workerId);
      console.log(`\n${index + 1}. ${workerData?.fullName} - Score: ${worker.overallScore}%`);
      console.log(`   Distance: ${worker.distance.current}km`);
      console.log(`   Available: ${worker.availability.isAvailable ? '✅' : '❌'}`);
      console.log(`   Response Time: ${workerData?.performance.responseTime} minutes`);
    });
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Test 3: Availability heatmap
    console.log('📊 Test 3: Availability Heatmap');
    
    const area = {
      north: 51.53,
      south: 51.48,
      east: -0.10,
      west: -0.20,
    };
    
    const heatmap = await engine.getAvailabilityHeatmap(testWorkers, area, 0.01);
    
    console.log('🗺️  Availability Heatmap (Central London):');
    const topAreas = heatmap
      .filter(point => point.availableWorkers > 0)
      .sort((a, b) => b.availableWorkers - a.availableWorkers)
      .slice(0, 5);
    
    topAreas.forEach((point, index) => {
      console.log(`\n${index + 1}. Area (${point.lat.toFixed(3)}, ${point.lng.toFixed(3)})`);
      console.log(`   Available: ${point.availableWorkers}/${point.totalWorkers} workers`);
      console.log(`   Average Score: ${point.averageScore * 100}%`);
    });
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Test 4: Different scenarios
    console.log('📊 Test 4: Different Scenarios');
    
    const scenarios = [
      {
        name: 'Perfect Conditions',
        shift: {
          ...testShift,
          shiftId: 'shift-perfect',
          requirements: {
            ...testShift.requirements,
            urgency: 'low' as const,
            startTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
          },
          compensation: {
            hourlyRate: 18.00,
            bonuses: [],
            travelReimbursement: true,
            parkingAllowance: 20,
          },
          environmental: {
            weatherConditions: {
              temperature: 20,
              precipitation: 0,
              windSpeed: 5,
              visibility: 10,
            },
            transportConditions: {
              trafficLevel: 'low' as const,
              publicTransportStatus: 'normal' as const,
              roadClosures: [],
              specialEvents: [],
            },
          },
        },
      },
      {
        name: 'Challenging Conditions',
        shift: {
          ...testShift,
          shiftId: 'shift-challenging',
          requirements: {
            ...testShift.requirements,
            urgency: 'critical' as const,
            startTime: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
          },
          compensation: {
            hourlyRate: 11.00,
            bonuses: [],
            travelReimbursement: false,
          },
          environmental: {
            weatherConditions: {
              temperature: 2,
              precipitation: 15,
              windSpeed: 25,
              visibility: 4,
            },
            transportConditions: {
              trafficLevel: 'severe' as const,
              publicTransportStatus: 'disrupted' as const,
              roadClosures: ['Oxford Street'],
              specialEvents: [
                {
                  type: 'protest',
                  impact: 'high' as const,
                  description: 'Central London protest causing disruptions',
                },
              ],
            },
          },
        },
      },
    ];
    
    for (const scenario of scenarios) {
      console.log(`\n🎯 ${scenario.name}:`);
      const scenarioRankings = await engine.rankNearbyWorkers(testWorkers, scenario.shift);
      
      const topWorker = scenarioRankings[0];
      const workerData = testWorkers.find(w => w.workerId === topWorker.workerId);
      
      console.log(`   Top Candidate: ${workerData?.fullName} (${topWorker.overallScore}% score)`);
      console.log(`   Available Workers: ${scenarioRankings.filter(r => r.availability.isAvailable).length}/${scenarioRankings.length}`);
      console.log(`   Average Distance: ${(scenarioRankings.reduce((sum, r) => sum + r.distance.current, 0) / scenarioRankings.length).toFixed(1)}km`);
    }
    
    console.log('\n🎉 Nearby Worker Ranking Engine Test Complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
if (require.main === module) {
  testNearbyWorkerRanking();
}

export { testNearbyWorkerRanking };
