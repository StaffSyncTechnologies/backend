export { SmartMatchingEngine } from './engine';
export { SmartMatchingService } from './service';
export * from './types';

// Service configuration
export const MATCHING_CONFIG = {
  weights: {
    skillMatch: 0.35,
    performanceScore: 0.25,
    availabilityMatch: 0.20,
    locationMatch: 0.15,
    preferenceMatch: 0.05,
  },
  thresholds: {
    minimumScore: 60,
    highScore: 80,
    excellentScore: 90,
  },
  limits: {
    maxResults: 50,
    defaultResults: 10,
  },
};
