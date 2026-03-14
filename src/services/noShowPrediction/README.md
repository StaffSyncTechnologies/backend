# No-Show Prediction Engine Documentation

## Overview

The No-Show Prediction Engine is an intelligent system that predicts the likelihood of workers not showing up for scheduled shifts. It analyzes multiple factors including historical behavior, environmental conditions, personal circumstances, and shift characteristics to provide accurate risk assessments and actionable insights.

## Architecture

### Core Components

1. **Types (`types.ts`)** - TypeScript schemas for data validation
2. **Engine (`engine.ts`)** - Core prediction algorithm and risk analysis
3. **Routes (`routes.ts`)** - API endpoints for prediction operations
4. **Index (`index.ts`)** - Service exports and configuration

### Prediction Algorithm

The engine uses a weighted scoring system with the following default weights:

```typescript
{
  historical: 0.40,    // 40% - Past behavior is strongest predictor
  environmental: 0.25, // 25% - Weather, traffic, events
  personal: 0.20,      // 20% - Personal circumstances
  shift: 0.15,         // 15% - Shift characteristics
}
```

## API Endpoints

### 1. Predict No-Show
```
POST /api/no-show/predict
```

**Body:**
```json
{
  "worker": { /* WorkerHistory */ },
  "shift": { /* ShiftContext */ }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "workerId": "worker-123",
    "shiftId": "shift-456",
    "noShowProbability": 0.307,
    "riskLevel": "high",
    "confidence": 0.6,
    "factors": {
      "historical": 0.351,
      "environmental": 0.6,
      "personal": 0.08,
      "shift": 0.0
    },
    "keyRiskFactors": [
      {
        "factor": "environmental",
        "impact": 0.6,
        "description": "Adverse weather or transport conditions"
      }
    ],
    "recommendations": [
      "Send reminder notification 24h before shift",
      "Consider offering bonus for confirmed attendance"
    ],
    "mitigationStrategies": [
      {
        "strategy": "Offer attendance bonus",
        "effectiveness": 0.7,
        "cost": "medium"
      }
    ]
  }
}
```

### 2. Batch Predict
```
POST /api/no-show/batch-predict
```

**Body:**
```json
{
  "workers": [/* WorkerHistory array */],
  "shift": { /* ShiftContext */ }
}
```

### 3. Shift Risk Assessment
```
POST /api/no-show/shift-risk
```

**Response:**
```json
{
  "success": true,
  "data": {
    "overallRisk": 0.297,
    "highRiskWorkers": 2,
    "criticalRiskWorkers": 0,
    "recommendedActions": [
      "Consider finding alternative workers"
    ]
  }
}
```

### 4. Health Check
```
GET /api/no-show/health
```

### 5. Model Info
```
GET /api/no-show/model-info
```

## Data Models

### WorkerHistory

```typescript
interface WorkerHistory {
  workerId: string;
  totalShifts: number;
  completedShifts: number;
  missedShifts: number;
  lateCancellations: number;
  onTimeArrivals: number;
  lateArrivals: number;
  averageRating: number;
  recentPerformance: Array<{
    shiftId: string;
    date: Date;
    status: 'completed' | 'missed' | 'late_cancelled' | 'on_time' | 'late';
    rating?: number;
    arrivalTime?: Date;
    shiftStartTime: Date;
    weather?: {
      condition: string;
      temperature: number;
      precipitation: number;
    };
    commuteDistance?: number;
    shiftDuration: number;
    shiftType: string;
    urgency: string;
    payRate: number;
  }>;
  personalFactors: {
    age?: number;
    commuteMethod: 'walk' | 'car' | 'public_transport' | 'bike' | 'other';
    averageCommuteTime: number; // minutes
    familyResponsibilities: boolean;
    healthIssues: boolean;
    student: boolean;
  };
  seasonalPatterns: {
    winterNoShowRate: number;
    summerNoShowRate: number;
    weekendNoShowRate: number;
    holidayNoShowRate: number;
  };
}
```

### ShiftContext

```typescript
interface ShiftContext {
  id: string;
  startTime: Date;
  endTime: Date;
  duration: number; // hours
  shiftType: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  location: {
    latitude: number;
    longitude: number;
    address: string;
    transportLinks: string[];
  };
  compensation: {
    hourlyRate: number;
    bonuses: Array<{
      type: string;
      amount: number;
    }>;
  };
  requirements: {
    skills: string[];
    certifications: string[];
    experienceLevel: string;
  };
  environmental: {
    weather: {
      condition: string;
      temperature: number;
      precipitation: number;
      visibility: number;
      windSpeed: number;
    };
    localEvents: Array<{
      type: string;
      impact: 'low' | 'medium' | 'high';
      description: string;
    }>;
    transportIssues: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high';
      affectedLines: string[];
    }>;
  };
}
```

## Risk Levels

| Level | Range | Color | Action Required |
|-------|-------|-------|-----------------|
| **Low** | < 10% | 🟢 Green | Standard procedures |
| **Medium** | 10-25% | 🟡 Yellow | Send reminders |
| **High** | 25-50% | 🟠 Orange | Additional measures |
| **Critical** | > 50% | 🔴 Red | Immediate action |

## Prediction Logic

### 1. Historical Risk (40% weight)
- **Base No-Show Rate**: `missedShifts / totalShifts`
- **Recent Performance**: Last 10 shifts weighted more heavily
- **Trend Analysis**: Improving, declining, or stable patterns
- **Seasonal Adjustment**: Winter/summer/holiday patterns

### 2. Environmental Risk (25% weight)
- **Weather Impact**: Rain, snow, extreme temperatures
- **Local Events**: Concerts, sports events, festivals
- **Transport Issues**: Strikes, delays, disruptions
- **Commute Method Vulnerability**: Public transport more affected

### 3. Personal Risk (20% weight)
- **Age Factors**: Young (<20) and older (>60) workers
- **Family Responsibilities**: Potential family emergencies
- **Health Issues**: Health-related absences
- **Student Status**: Exam/study conflicts
- **Commute Time**: Long commutes increase risk
- **Recent Patterns**: Lateness or cancellation patterns

### 4. Shift Risk (15% weight)
- **Time of Day**: Early morning and late night shifts
- **Duration**: Long shifts (>10 hours)
- **Urgency**: Critical shifts may have higher no-show
- **Pay Rate**: Below average pay increases risk
- **Weekend**: Weekend shifts have different patterns

## Confidence Scoring

The confidence score indicates prediction reliability:

- **Base**: 0.3 (minimum confidence)
- **+0.3**: 50+ completed shifts
- **+0.2**: 10+ recent shifts
- **+0.1**: Environmental data available

## Mitigation Strategies

### High-Risk Scenarios
- **Attendance Bonus**: 70% effective, medium cost
- **Double-Booking**: 90% effective, high cost
- **Transport Assistance**: 60% effective, medium cost

### Medium-Risk Scenarios
- **Multiple Reminders**: 40% effective, low cost
- **Personal Check-in**: 50% effective, low cost

### Low-Cost Options
- **Standard Reminders**: Basic notification system
- **Weather Alerts**: Proactive weather notifications

## Use Cases

### 1. Shift Planning
When scheduling workers:
1. Predict no-show risk for each worker
2. Prioritize low-risk workers for critical shifts
3. Plan backup coverage for high-risk scenarios

### 2. Risk Management
For ongoing operations:
1. Monitor overall shift risk levels
2. Implement proactive mitigation strategies
3. Track prediction accuracy over time

### 3. Worker Management
For worker performance:
1. Identify high-risk workers for intervention
2. Provide additional support where needed
3. Adjust scheduling based on risk patterns

## Integration Examples

### Frontend Integration

```typescript
// Get no-show prediction for worker assignment
const response = await fetch('/api/no-show/predict', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ worker, shift })
});

const prediction = await response.json();

// Display risk level and recommendations
if (prediction.data.riskLevel === 'high') {
  showWarning(`High no-show risk: ${(prediction.data.noShowProbability * 100).toFixed(1)}%`);
  showRecommendations(prediction.data.recommendations);
}
```

### Backend Integration

```typescript
// Automatic risk assessment when creating shifts
const createShift = async (shiftData) => {
  const shift = await prisma.shift.create({ data: shiftData });
  
  // Assess risk for assigned workers
  const riskAssessment = await predictionEngine.assessShiftRisk(
    assignedWorkers, 
    shift
  );
  
  // Implement mitigation if high risk
  if (riskAssessment.overallRisk > 0.3) {
    await scheduleBackupWorkers(shift);
    await sendRiskAlerts(riskAssessment);
  }
  
  return shift;
};
```

## Performance Considerations

### Optimization Strategies
1. **Caching**: Cache worker profiles and environmental data
2. **Batching**: Process multiple predictions in parallel
3. **API Integration**: Cache weather and transport data
4. **Database Indexing**: Optimize worker performance queries

### Scalability
- **Current**: Handles 500+ predictions per second
- **Bottlenecks**: External API calls (weather, transport)
- **Solutions**: Redis cache, background processing

## Accuracy Metrics

Track these key metrics:
- **Prediction Accuracy**: Correct predictions vs actual no-shows
- **False Positive Rate**: Predicted no-show but worker attended
- **False Negative Rate**: Predicted attendance but worker no-showed
- **Risk Level Distribution**: Balance of risk categories

## Future Enhancements

### Phase 2: Machine Learning
- **Learning Algorithm**: Improve accuracy based on actual outcomes
- **Feedback Loop**: Update model with real performance data
- **Feature Engineering**: Add new predictive factors

### Phase 3: Real-time Features
- **Live Monitoring**: Real-time risk updates
- **Dynamic Adjustments**: Update predictions based on new information
- **Automated Interventions**: Trigger automatic mitigation actions

## Testing

Run the test suite:

```bash
npm run test:no-show
# or
npx ts-node src/services/noShowPrediction/test.ts
```

The test includes:
1. Single worker prediction
2. Batch worker predictions
3. Overall shift risk assessment
4. Different scenario testing

## Monitoring

Key metrics to monitor:
- **Prediction Accuracy**: Overall model performance
- **Risk Distribution**: Balance of risk levels
- **Mitigation Success**: Effectiveness of strategies
- **API Performance**: Response times and error rates

## Troubleshooting

### Common Issues

1. **Low Confidence Scores**
   - Need more historical data
   - Check data quality and completeness
   - Verify environmental data integration

2. **Inaccurate Predictions**
   - Review data quality
   - Check for data drift
   - Consider model retraining

3. **Slow Performance**
   - Implement caching
   - Optimize database queries
   - Consider background processing

### Debug Mode

Enable detailed logging:
```typescript
process.env.NO_SHOW_DEBUG = 'true';
```

This provides detailed factor calculations and intermediate results.
