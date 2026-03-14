export { NearbyWorkerRankingEngine } from './engine';
export { nearbyWorkerRankingRouter } from './routes';
export * from './types';

// Service configuration
export const NEARBY_WORKER_CONFIG = {
  weights: {
    proximity: 0.25,
    availability: 0.20,
    skills: 0.20,
    performance: 0.15,
    response: 0.10,
    cost: 0.10,
  },
  thresholds: {
    maxDistance: 50, // km
    urgentDistance: 10, // km
    minConfidence: 0.5,
  },
  transport: {
    walkingSpeed: 5, // km/h
    cyclingSpeed: 15, // km/h
    drivingSpeed: 30, // km/h (city average)
    publicTransportSpeed: 20, // km/h
  },
};
