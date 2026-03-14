import { z } from 'zod';

// Worker location and availability data
export const WorkerLocationSchema = z.object({
  workerId: z.string(),
  fullName: z.string(),
  currentLocation: z.object({
    latitude: z.number(),
    longitude: z.number(),
    accuracy: z.number(), // meters
    timestamp: z.date(),
    address: z.string().optional(),
  }),
  homeLocation: z.object({
    latitude: z.number(),
    longitude: z.number(),
    address: z.string(),
  }),
  availability: z.object({
    isAvailable: z.boolean(),
    availableFrom: z.date().optional(),
    availableUntil: z.date().optional(),
    maxTravelDistance: z.number(), // km
    preferredWorkRadius: z.number(), // km
  }),
  skills: z.array(z.string()),
  certifications: z.array(z.string()),
  performance: z.object({
    reliabilityScore: z.number().min(0).max(1),
    averageRating: z.number().min(0).max(5),
    completedShifts: z.number(),
    responseTime: z.number(), // minutes average
  }),
  commutePreferences: z.object({
    transportMethods: z.array(z.enum(['walk', 'car', 'public_transport', 'bike', 'taxi'])),
    maxCommuteTime: z.number(), // minutes
    avoidTolls: z.boolean(),
    preferCoveredTransport: z.boolean(),
  }),
  workPreferences: z.object({
    shiftTypes: z.array(z.string()),
    minHourlyRate: z.number(),
    emergencyOnly: z.boolean(),
    lastWorked: z.date().optional(),
  }),
});

// Shift location and requirements
export const ShiftLocationSchema = z.object({
  shiftId: z.string(),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
    address: z.string(),
    venue: z.string().optional(),
    floor: z.number().optional(),
    parking: z.boolean().optional(),
    publicTransportAccess: z.boolean().optional(),
  }),
  requirements: z.object({
    urgency: z.enum(['low', 'medium', 'high', 'critical']),
    startTime: z.date(),
    endTime: z.date(),
    duration: z.number(), // hours
    skills: z.array(z.string()),
    certifications: z.array(z.string()),
    experienceLevel: z.enum(['entry', 'intermediate', 'senior', 'expert']),
  }),
  compensation: z.object({
    hourlyRate: z.number(),
    bonuses: z.array(z.object({
      type: z.string(),
      amount: z.number(),
      condition: z.string(),
    })),
    travelReimbursement: z.boolean(),
    parkingAllowance: z.number().optional(),
  }),
  environmental: z.object({
    weatherConditions: z.object({
      temperature: z.number(),
      precipitation: z.number(),
      windSpeed: z.number(),
      visibility: z.number(),
    }),
    transportConditions: z.object({
      trafficLevel: z.enum(['low', 'medium', 'high', 'severe']),
      publicTransportStatus: z.enum(['normal', 'delays', 'disrupted', 'suspended']),
      roadClosures: z.array(z.string()),
      specialEvents: z.array(z.object({
        type: z.string(),
        impact: z.enum(['low', 'medium', 'high']),
        description: z.string(),
      })),
    }),
  }),
});

// Ranking result
export const WorkerRankingSchema = z.object({
  workerId: z.string(),
  shiftId: z.string(),
  overallScore: z.number().min(0).max(100),
  rank: z.number(),
  factors: z.object({
    proximity: z.number().min(0).max(100),
    availability: z.number().min(0).max(100),
    skills: z.number().min(0).max(100),
    performance: z.number().min(0).max(100),
    response: z.number().min(0).max(100),
    cost: z.number().min(0).max(100),
  }),
  distance: z.object({
    current: z.number(), // km from current location
    home: z.number(), // km from home location
    estimatedTravelTime: z.number(), // minutes
    recommendedTransport: z.string(),
  }),
  availability: z.object({
    isAvailable: z.boolean(),
    availableFrom: z.date().optional(),
    availableUntil: z.date().optional(),
    conflicts: z.array(z.string()),
  }),
  insights: z.object({
    strengths: z.array(z.string()),
    concerns: z.array(z.string()),
    recommendations: z.array(z.string()),
  }),
  contactInfo: z.object({
    phoneNumber: z.string().optional(),
    email: z.string().optional(),
    lastContact: z.date().optional(),
    preferredContact: z.enum(['phone', 'email', 'app', 'sms']),
  }),
  confidence: z.number().min(0).max(1),
});

export type WorkerLocation = z.infer<typeof WorkerLocationSchema>;
export type ShiftLocation = z.infer<typeof ShiftLocationSchema>;
export type WorkerRanking = z.infer<typeof WorkerRankingSchema>;
