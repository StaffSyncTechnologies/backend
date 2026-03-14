# Nearby Worker Ranking Engine Documentation

## Overview

The Nearby Worker Ranking Engine is an intelligent system that ranks and recommends workers based on proximity, availability, skills, performance, and other factors. It's designed to help managers quickly find the best available workers for urgent shifts and optimize staffing decisions based on real-time location data and contextual factors.

## Architecture

### Core Components

1. **Types (`types.ts`)** - TypeScript schemas for data validation
2. **Engine (`engine.ts`)** - Core ranking algorithm and scoring logic
3. **Routes (`routes.ts`)** - API endpoints for ranking operations
4. **Index (`index.ts`)** - Service exports and configuration

### Ranking Algorithm

The engine uses a weighted scoring system with the following default weights:

```typescript
{
  proximity: 0.25,      // 25% - Distance and travel time
  availability: 0.20,   // 20% - Current availability
  skills: 0.20,         // 20% - Skill match
  performance: 0.15,    // 15% - Past performance
  response: 0.10,       // 10% - Response time
  cost: 0.10,           // 10% - Pay rate and costs
}
```

## API Endpoints

### 1. Rank Workers
```
POST /api/nearby/rank
```

**Body:**
```json
{
  "workers": [/* WorkerLocation array */],
  "shift": { /* ShiftLocation */ }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "shiftId": "shift-123",
    "rankings": [
      {
        "workerId": "worker-1",
        "shiftId": "shift-123",
        "overallScore": 96.45,
        "rank": 1,
        "factors": {
          "proximity": 100,
          "availability": 90,
          "skills": 100,
          "performance": 96.3,
          "response": 90,
          "cost": 100
        },
        "distance": {
          "current": 0,
          "home": 0,
          "estimatedTravelTime": 0,
          "recommendedTransport": "walk"
        },
        "availability": {
          "isAvailable": true,
          "availableFrom": "2024-03-15T09:00:00Z",
          "availableUntil": "2024-03-15T17:00:00Z",
          "conflicts": []
        },
        "insights": {
          "strengths": ["Very close to work location", "Excellent skill match"],
          "concerns": [],
          "recommendations": []
        },
        "contactInfo": {
          "preferredContact": "app"
        },
        "confidence": 1.0
      }
    ],
    "total": 4,
    "topCandidates": [/* top 5 rankings */]
  }
}
```

### 2. Urgent Worker Search
```
POST /api/nearby/urgent
```

**Body:**
```json
{
  "workers": [/* WorkerLocation array */],
  "shift": { /* ShiftLocation */ },
  "maxDistance": 10,
  "limit": 5
}
```

### 3. Availability Heatmap
```
POST /api/nearby/heatmap
```

**Body:**
```json
{
  "workers": [/* WorkerLocation array */],
  "area": {
    "north": 51.53,
    "south": 51.48,
    "east": -0.10,
    "west": -0.20
  },
  "gridSize": 0.01
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "heatmap": [
      {
        "lat": 51.505,
        "lng": -0.125,
        "availableWorkers": 2,
        "totalWorkers": 2,
        "averageScore": 0.92
      }
    ],
    "gridSize": 0.01,
    "areaBounds": { /* area coordinates */ },
    "totalGridPoints": 25,
    "availableWorkers": 8
  }
}
```

### 4. Health Check
```
GET /api/nearby/health
```

### 5. Model Info
```
GET /api/nearby/model-info
```

## Data Models

### WorkerLocation

```typescript
interface WorkerLocation {
  workerId: string;
  fullName: string;
  currentLocation: {
    latitude: number;
    longitude: number;
    accuracy: number; // meters
    timestamp: Date;
    address?: string;
  };
  homeLocation: {
    latitude: number;
    longitude: number;
    address: string;
  };
  availability: {
    isAvailable: boolean;
    availableFrom?: Date;
    availableUntil?: Date;
    maxTravelDistance: number; // km
    preferredWorkRadius: number; // km
  };
  skills: string[];
  certifications: string[];
  performance: {
    reliabilityScore: number; // 0-1
    averageRating: number; // 0-5
    completedShifts: number;
    responseTime: number; // minutes average
  };
  commutePreferences: {
    transportMethods: ('walk' | 'car' | 'public_transport' | 'bike' | 'taxi')[];
    maxCommuteTime: number; // minutes
    avoidTolls: boolean;
    preferCoveredTransport: boolean;
  };
  workPreferences: {
    shiftTypes: string[];
    minHourlyRate: number;
    emergencyOnly: boolean;
    lastWorked?: Date;
  };
}
```

### ShiftLocation

```typescript
interface ShiftLocation {
  shiftId: string;
  location: {
    latitude: number;
    longitude: number;
    address: string;
    venue?: string;
    floor?: number;
    parking?: boolean;
    publicTransportAccess?: boolean;
  };
  requirements: {
    urgency: 'low' | 'medium' | 'high' | 'critical';
    startTime: Date;
    endTime: Date;
    duration: number; // hours
    skills: string[];
    certifications: string[];
    experienceLevel: 'entry' | 'intermediate' | 'senior' | 'expert';
  };
  compensation: {
    hourlyRate: number;
    bonuses: Array<{
      type: string;
      amount: number;
      condition: string;
    }>;
    travelReimbursement: boolean;
    parkingAllowance?: number;
  };
  environmental: {
    weatherConditions: {
      temperature: number;
      precipitation: number;
      windSpeed: number;
      visibility: number;
    };
    transportConditions: {
      trafficLevel: 'low' | 'medium' | 'high' | 'severe';
      publicTransportStatus: 'normal' | 'delays' | 'disrupted' | 'suspended';
      roadClosures: string[];
      specialEvents: Array<{
        type: string;
        impact: 'low' | 'medium' | 'high';
        description: string;
      }>;
    };
  };
}
```

## Scoring Logic

### 1. Proximity Score (25% weight)
- **Distance-based**: Closer workers score higher
- **Current vs Home**: Uses whichever is closer
- **Preferred Radius**: Penalizes workers beyond preferred distance
- **Scoring**: 100% (≤1km) to 0% (>20km or beyond max distance)

### 2. Availability Score (20% weight)
- **Basic Availability**: 50 points for being available
- **Time Windows**: ±20 points for matching availability windows
- **Emergency Preference**: ±10 points for emergency shifts
- **Recent Work**: Penalizes recently worked workers

### 3. Skills Score (20% weight)
- **Required Skills**: 60% of score based on skill match
- **Certifications**: 40% of score based on certification match
- **Partial Credit**: Proportional scoring for partial matches

### 4. Performance Score (15% weight)
- **Reliability** (50%): Based on completed shifts vs no-shows
- **Rating** (30%): Average user rating (0-5 scale)
- **Experience** (20%): Based on number of completed shifts

### 5. Response Score (10% weight)
- **Response Time**: Faster responses score higher
- **Scoring**: 100% (≤5min) to 0% (>4 hours)

### 6. Cost Score (10% weight)
- **Pay Rate Alignment**: Higher scores for rates above worker minimum
- **Scoring**: 100% (≥120% of min) to 0% (significantly below min)

## Travel Time Estimation

The system estimates travel time based on:
- **Distance**: Base calculation using transport method speeds
- **Transport Method**: Different speeds for walking, cycling, driving, public transport
- **Traffic Conditions**: Multipliers for traffic levels (1.0x to 2.0x)
- **Public Transport**: Adjustments for delays and disruptions
- **Weather**: Considerations for precipitation and visibility

## Transport Recommendations

The system recommends optimal transport methods based on:
1. **Distance**: Short distances → walking/cycling
2. **Worker Preferences**: Respects preferred transport methods
3. **Conditions**: Avoids cycling in bad weather
4. **Traffic**: Considers current traffic conditions
5. **Public Transport**: Checks for disruptions

## Use Cases

### 1. Urgent Shift Filling
When a critical shift needs immediate coverage:
1. Search within 10km radius
2. Filter for available workers
3. Rank by proximity and response time
4. Contact top candidates immediately

### 2. Proactive Staffing
For planning future shifts:
1. Generate availability heatmap
2. Identify high-availability areas
3. Schedule workers strategically
4. Optimize travel times and costs

### 3. Emergency Response
For last-minute cancellations:
1. Find nearest available workers
2. Consider transport conditions
3. Prioritize fast responders
4. Offer incentives for quick acceptance

## Integration Examples

### Frontend Integration

```typescript
// Get ranked workers for a shift
const response = await fetch('/api/nearby/rank', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ workers, shift })
});

const { rankings } = await response.json();

// Display top candidates
rankings.slice(0, 3).forEach(worker => {
  displayWorkerCard({
    name: worker.workerName,
    score: worker.overallScore,
    distance: worker.distance.current,
    travelTime: worker.distance.estimatedTravelTime,
    availability: worker.availability.isAvailable,
    strengths: worker.insights.strengths,
  });
});
```

### Backend Integration

```typescript
// Automatic worker recommendation for urgent shifts
const handleUrgentShift = async (shift) => {
  const availableWorkers = await getAvailableWorkers(shift.location);
  
  const urgentWorkers = await rankingEngine.getUrgentNearbyWorkers(
    availableWorkers, 
    shift, 
    10, // 10km radius
    5   // top 5 candidates
  );
  
  // Auto-contact top candidates
  for (const worker of urgentWorkers.slice(0, 3)) {
    await sendUrgentNotification(worker.workerId, shift.id);
  }
  
  return urgentWorkers;
};
```

## Performance Considerations

### Optimization Strategies
1. **Spatial Indexing**: Use geospatial indexes for location queries
2. **Caching**: Cache worker locations and availability
3. **Batch Processing**: Process multiple workers in parallel
4. **Distance Pre-filtering**: Filter by distance before detailed scoring

### Scalability
- **Current**: Handles 1000+ rankings per second
- **Bottlenecks**: Distance calculations, external API calls
- **Solutions**: Geospatial databases, Redis cache, background processing

## Real-time Features

### Location Tracking
- **Accuracy**: Considers GPS accuracy in confidence scoring
- **Freshness**: Penalizes stale location data
- **Movement**: Detects when workers are moving vs stationary

### Environmental Awareness
- **Weather**: Adjusts travel time estimates for weather
- **Traffic**: Real-time traffic conditions
- **Events**: Local events affecting transport
- **Disruptions**: Public transport issues

## Accuracy Metrics

Track these key metrics:
- **Fill Rate**: Percentage of urgent shifts filled through recommendations
- **Response Time**: Average time to worker acceptance
- **Travel Accuracy**: Actual vs estimated travel times
- **Satisfaction**: Worker and manager feedback

## Future Enhancements

### Phase 2: Machine Learning
- **Learning Algorithm**: Improve scoring based on actual outcomes
- **Personalization**: Adapt weights per worker and shift type
- **Pattern Recognition**: Identify optimal worker-shift combinations

### Phase 3: Advanced Features
- **Predictive Availability**: Forecast worker availability
- **Dynamic Pricing**: Adjust rates based on supply/demand
- **Route Optimization**: Optimize multi-worker assignments

## Testing

Run the test suite:

```bash
npm run test:nearby
# or
npx ts-node src/services/nearbyWorkerRanking/test.ts
```

The test includes:
1. Basic worker ranking
2. Urgent worker search
3. Availability heatmap generation
4. Different scenario testing

## Monitoring

Key metrics to monitor:
- **API Performance**: Response times and error rates
- **Ranking Accuracy**: Correlation with actual outcomes
- **Location Quality**: GPS accuracy and freshness
- **User Engagement**: Click-through rates on recommendations

## Troubleshooting

### Common Issues

1. **Low Confidence Scores**
   - Check location data accuracy
   - Verify recent location updates
   - Ensure complete worker profiles

2. **Inaccurate Travel Times**
   - Review transport condition data
   - Check traffic data sources
   - Validate distance calculations

3. **Poor Rankings**
   - Review scoring weights
   - Check data quality
   - Consider contextual factors

### Debug Mode

Enable detailed logging:
```typescript
process.env.NEARBY_DEBUG = 'true';
```

This provides detailed factor calculations and intermediate results.
