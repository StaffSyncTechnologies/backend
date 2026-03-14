import { z } from 'zod';

// Worker profile schema for matching
export const WorkerProfileSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  skills: z.array(z.string()),
  certifications: z.array(z.string()),
  experience: z.object({
    years: z.number(),
    relevantRoles: z.array(z.string()),
  }),
  availability: z.object({
    preferredShifts: z.array(z.enum(['morning', 'afternoon', 'night', 'overnight'])),
    maxWeeklyHours: z.number(),
    noticePeriod: z.number(), // hours
  }),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
    maxTravelDistance: z.number(), // km
  }),
  preferences: z.object({
    minHourlyRate: z.number(),
    preferredLocations: z.array(z.string()),
    shiftTypes: z.array(z.string()),
  }),
  performance: z.object({
    reliabilityScore: z.number().min(0).max(1), // 0-1 score
    averageRating: z.number().min(0).max(5),
    completedShifts: z.number(),
    noShowRate: z.number().min(0).max(1),
    punctualityScore: z.number().min(0).max(1),
  }),
});

// Shift requirement schema
export const ShiftRequirementSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  requiredSkills: z.array(z.string()),
  requiredCertifications: z.array(z.string()),
  experienceLevel: z.enum(['entry', 'intermediate', 'senior', 'expert']),
  urgency: z.enum(['low', 'medium', 'high', 'critical']),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
    address: z.string(),
  }),
  timing: z.object({
    startTime: z.date(),
    endTime: z.date(),
    breakDuration: z.number(), // minutes
  }),
  compensation: z.object({
    hourlyRate: z.number(),
    overtimeRate: z.number(),
    bonuses: z.array(z.object({
      type: z.string(),
      amount: z.number(),
      condition: z.string(),
    })),
  }),
  specialRequirements: z.array(z.string()),
});

// Matching result schema
export const MatchingResultSchema = z.object({
  workerId: z.string(),
  shiftId: z.string(),
  overallScore: z.number().min(0).max(100),
  breakdown: z.object({
    skillMatch: z.number().min(0).max(100),
    availabilityMatch: z.number().min(0).max(100),
    locationMatch: z.number().min(0).max(100),
    performanceScore: z.number().min(0).max(100),
    preferenceMatch: z.number().min(0).max(100),
  }),
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string()),
  warnings: z.array(z.string()),
});

export type WorkerProfile = z.infer<typeof WorkerProfileSchema>;
export type ShiftRequirement = z.infer<typeof ShiftRequirementSchema>;
export type MatchingResult = z.infer<typeof MatchingResultSchema>;
