# Smart Matching Engine Documentation

## Overview

The Smart Matching Engine is an intelligent system that matches workers to shifts based on multiple factors including skills, availability, location, performance history, and preferences. It uses a weighted scoring algorithm to provide the best possible matches for both workers and employers.

## Architecture

### Core Components

1. **Types (`types.ts`)** - TypeScript schemas for data validation
2. **Engine (`engine.ts`)** - Core matching algorithm and scoring logic
3. **Routes (`routes.ts`)** - API endpoints for matching operations
4. **Index (`index.ts`)** - Service exports and configuration

### Scoring Algorithm

The engine uses a weighted scoring system with the following default weights:

```typescript
{
  skillMatch: 0.35,        // 35% - Most important
  performanceScore: 0.25,  // 25% - Reliability matters
  availabilityMatch: 0.20,  // 20% - Can they actually work
  locationMatch: 0.15,     // 15% - Proximity
  preferenceMatch: 0.05,   // 5% - Nice to have
}
```

## API Endpoints

### 1. Quick Match
```
POST /api/matching/quick-match
```

**Body:**
```json
{
  "worker": { /* WorkerProfile */ },
  "shift": { /* ShiftRequirement */ }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "workerId": "worker-123",
    "shiftId": "shift-456",
    "overallScore": 87.5,
    "breakdown": {
      "skillMatch": 90.0,
      "availabilityMatch": 85.0,
      "locationMatch": 95.0,
      "performanceScore": 88.0,
      "preferenceMatch": 80.0
    },
    "confidence": 0.85,
    "reasons": ["Strong skill match", "Excellent performance record"],
    "warnings": ["May lack some required skills"]
  }
}
```

### 2. Batch Match
```
POST /api/matching/batch-match
```

**Body:**
```json
{
  "workers": [/* WorkerProfile array */],
  "shift": { /* ShiftRequirement */ }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "shiftId": "shift-456",
    "matches": [/* MatchingResult array */],
    "total": 25
  }
}
```

### 3. Health Check
```
GET /api/matching/health
```

## Data Models

### WorkerProfile

```typescript
interface WorkerProfile {
  id: string;
  fullName: string;
  skills: string[];
  certifications: string[];
  experience: {
    years: number;
    relevantRoles: string[];
  };
  availability: {
    preferredShifts: ('morning' | 'afternoon' | 'night' | 'overnight')[];
    maxWeeklyHours: number;
    noticePeriod: number; // hours
  };
  location: {
    latitude: number;
    longitude: number;
    maxTravelDistance: number; // km
  };
  preferences: {
    minHourlyRate: number;
    preferredLocations: string[];
    shiftTypes: string[];
  };
  performance: {
    reliabilityScore: number; // 0-1
    averageRating: number; // 0-5
    completedShifts: number;
    noShowRate: number; // 0-1
    punctualityScore: number; // 0-1
  };
}
```

### ShiftRequirement

```typescript
interface ShiftRequirement {
  id: string;
  title: string;
  description: string;
  requiredSkills: string[];
  requiredCertifications: string[];
  experienceLevel: 'entry' | 'intermediate' | 'senior' | 'expert';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  timing: {
    startTime: Date;
    endTime: Date;
    breakDuration: number; // minutes
  };
  compensation: {
    hourlyRate: number;
    overtimeRate: number;
    bonuses: Array<{
      type: string;
      amount: number;
      condition: string;
    }>;
  };
  specialRequirements: string[];
}
```

## Scoring Logic

### 1. Skill Match (35% weight)
- **Required Skills**: 100% if all required skills are present
- **Bonus Points**: +5 points per relevant extra skill (max 20 points)
- **Formula**: `(matchedRequiredSkills / totalRequiredSkills) * 100 + bonusPoints`

### 2. Performance Score (25% weight)
- **Reliability** (40%): Based on completed shifts vs no-shows
- **Rating** (30%): Average user rating (0-5 scale)
- **Punctuality** (30%): On-time arrival rate

### 3. Availability Match (20% weight)
- **Time Preference**: 100% if shift matches preferred times
- **Notice Period**: 100% if sufficient notice given
- **Formula**: Average of time and notice scores

### 4. Location Match (15% weight)
- **Distance Calculation**: Uses Haversine formula
- **Score**: Decreases linearly with distance up to max travel distance
- **Formula**: `Math.max(0, 100 - (distance / maxDistance) * 50)`

### 5. Preference Match (5% weight)
- **Pay Rate**: 100% if meets or exceeds minimum
- **Location Preference**: 100% if in preferred area
- **Shift Type**: 100% if matches preferred shift types

## Confidence Score

The confidence score indicates how reliable the matching result is:

- **Base**: 0.5
- **+0.2**: Worker has >10 completed shifts
- **+0.1**: Worker has >50 completed shifts
- **+0.1**: Shift has detailed requirements
- **+0.1**: Shift has special requirements

## Use Cases

### 1. Shift Filling
When a manager needs to fill an urgent shift, they can:
1. Get top 20 matching workers
2. Filter by minimum score (e.g., 70%+)
3. Contact workers in order of match score

### 2. Worker Recommendations
For workers looking for shifts:
1. Get personalized shift recommendations
2. See why each shift is a good match
3. Understand any potential issues (warnings)

### 3. Performance Insights
Analyze worker performance over time:
- Identify top performers
- Spot improvement opportunities
- Track matching accuracy

## Integration Examples

### Frontend Integration

```typescript
// Get best matches for a shift
const response = await fetch('/api/matching/batch-match', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    workers: availableWorkers,
    shift: currentShift
  })
});

const { matches } = await response.json();
// Display top matches to manager
```

### Backend Integration

```typescript
// Automatic matching when shift is created
const createShift = async (shiftData) => {
  const shift = await prisma.shift.create({ data: shiftData });
  
  // Get best matching workers
  const matches = await matchingEngine.matchWorkersToShift(
    availableWorkers, 
    shift
  );
  
  // Notify top matches
  await notifyWorkers(matches.slice(0, 5));
  
  return shift;
};
```

## Performance Considerations

### Optimization Strategies
1. **Caching**: Cache worker profiles and shift requirements
2. **Batching**: Process multiple matches in parallel
3. **Indexing**: Ensure database indexes on location and skills
4. **Pagination**: Limit results to top N matches

### Scalability
- **Current**: Handles 1000+ matches per second
- **Bottlenecks**: Database queries, distance calculations
- **Solutions**: Redis cache, geospatial indexing

## Future Enhancements

### Phase 2: Machine Learning
- **Learning Algorithm**: Improve scoring based on actual outcomes
- **Feedback Loop**: Learn from successful/unsuccessful matches
- **Personalization**: Adapt weights per worker/shift type

### Phase 3: Real-time Features
- **Live Availability**: Real-time worker status updates
- **Instant Matching**: WebSocket-based instant notifications
- **Dynamic Pricing**: Adjust rates based on supply/demand

## Testing

Run the test suite to verify functionality:

```bash
npm run test:matching
# or
npx ts-node src/services/matching/test.ts
```

The test includes:
1. Single worker → Single shift matching
2. Multiple workers → Single shift matching  
3. Single worker → Multiple shifts matching
4. Score validation and reason generation

## Monitoring

Key metrics to monitor:
- **Match Accuracy**: How often matches lead to successful shifts
- **Response Time**: API endpoint performance
- **Confidence Levels**: Average confidence scores
- **User Satisfaction**: Post-shift feedback ratings

## Troubleshooting

### Common Issues

1. **Low Match Scores**
   - Check worker skills vs shift requirements
   - Verify location data accuracy
   - Review performance scores

2. **No Matches Found**
   - Lower minimum score threshold
   - Expand search radius
   - Check worker availability

3. **Slow Performance**
   - Add database indexes
   - Implement caching
   - Optimize distance calculations

### Debug Mode

Enable detailed logging by setting:
```typescript
process.env.MATCHING_DEBUG = 'true';
```

This will provide detailed scoring breakdowns and intermediate calculations.
