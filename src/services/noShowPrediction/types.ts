import { z } from 'zod';

// Worker historical data for prediction
export const WorkerHistorySchema = z.object({
  workerId: z.string(),
  totalShifts: z.number(),
  completedShifts: z.number(),
  missedShifts: z.number(),
  lateCancellations: z.number(),
  onTimeArrivals: z.number(),
  lateArrivals: z.number(),
  averageRating: z.number(),
  recentPerformance: z.array(z.object({
    shiftId: z.string(),
    date: z.date(),
    status: z.enum(['completed', 'missed', 'late_cancelled', 'on_time', 'late']),
    rating: z.number().optional(),
    arrivalTime: z.date().optional(),
    shiftStartTime: z.date(),
    weather: z.object({
      condition: z.string(),
      temperature: z.number(),
      precipitation: z.number(),
    }).optional(),
    commuteDistance: z.number().optional(),
    shiftDuration: z.number(),
    shiftType: z.string(),
    urgency: z.string(),
    payRate: z.number(),
  })),
  personalFactors: z.object({
    age: z.number().optional(),
    commuteMethod: z.enum(['walk', 'car', 'public_transport', 'bike', 'other']),
    averageCommuteTime: z.number(), // minutes
    familyResponsibilities: z.boolean(),
    healthIssues: z.boolean(),
    student: z.boolean(),
  }),
  seasonalPatterns: z.object({
    winterNoShowRate: z.number(),
    summerNoShowRate: z.number(),
    weekendNoShowRate: z.number(),
    holidayNoShowRate: z.number(),
  }),
});

// Shift context for prediction
export const ShiftContextSchema = z.object({
  id: z.string(),
  startTime: z.date(),
  endTime: z.date(),
  duration: z.number(), // hours
  shiftType: z.string(),
  urgency: z.enum(['low', 'medium', 'high', 'critical']),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
    address: z.string(),
    transportLinks: z.array(z.string()),
  }),
  compensation: z.object({
    hourlyRate: z.number(),
    bonuses: z.array(z.object({
      type: z.string(),
      amount: z.number(),
    })),
  }),
  requirements: z.object({
    skills: z.array(z.string()),
    certifications: z.array(z.string()),
    experienceLevel: z.string(),
  }),
  environmental: z.object({
    weather: z.object({
      condition: z.string(),
      temperature: z.number(),
      precipitation: z.number(),
      visibility: z.number(),
      windSpeed: z.number(),
    }),
    localEvents: z.array(z.object({
      type: z.string(),
      impact: z.enum(['low', 'medium', 'high']),
      description: z.string(),
    })),
    transportIssues: z.array(z.object({
      type: z.string(),
      severity: z.enum(['low', 'medium', 'high']),
      affectedLines: z.array(z.string()),
    })),
  }),
});

// Prediction result
export const NoShowPredictionSchema = z.object({
  workerId: z.string(),
  shiftId: z.string(),
  noShowProbability: z.number().min(0).max(1), // 0-1 probability
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  confidence: z.number().min(0).max(1),
  factors: z.object({
    historical: z.number().min(0).max(1),
    environmental: z.number().min(0).max(1),
    personal: z.number().min(0).max(1),
    shift: z.number().min(0).max(1),
  }),
  keyRiskFactors: z.array(z.object({
    factor: z.string(),
    impact: z.number().min(0).max(1),
    description: z.string(),
  })),
  recommendations: z.array(z.string()),
  mitigationStrategies: z.array(z.object({
    strategy: z.string(),
    effectiveness: z.number().min(0).max(1),
    cost: z.enum(['low', 'medium', 'high']),
  })),
});

export type WorkerHistory = z.infer<typeof WorkerHistorySchema>;
export type ShiftContext = z.infer<typeof ShiftContextSchema>;
export type NoShowPrediction = z.infer<typeof NoShowPredictionSchema>;
