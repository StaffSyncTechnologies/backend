import { Router } from 'express';
import { NearbyWorkerRankingEngine } from './engine';
import { WorkerLocationSchema, ShiftLocationSchema } from './types';

const router = Router();
const rankingEngine = new NearbyWorkerRankingEngine();

/**
 * POST /api/nearby/rank
 * Rank nearby workers for a specific shift
 */
router.post('/rank', async (req, res, next) => {
  try {
    const { workers, shift } = req.body;

    // Validate input
    try {
      ShiftLocationSchema.parse(shift);
      workers.forEach((worker: any) => WorkerLocationSchema.parse(worker));
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input data',
        code: 'INVALID_INPUT',
      });
    }

    // Perform ranking
    const rankings = await rankingEngine.rankNearbyWorkers(workers, shift);

    res.json({
      success: true,
      data: {
        shiftId: shift.id,
        rankings: rankings,
        total: rankings.length,
        topCandidates: rankings.slice(0, 5),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/nearby/urgent
 * Get urgent nearby workers for critical shifts
 */
router.post('/urgent', async (req, res, next) => {
  try {
    const { workers, shift, maxDistance = 10, limit = 10 } = req.body;

    // Validate input
    try {
      ShiftLocationSchema.parse(shift);
      workers.forEach((worker: any) => WorkerLocationSchema.parse(worker));
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input data',
        code: 'INVALID_INPUT',
      });
    }

    // Get urgent nearby workers
    const urgentWorkers = await rankingEngine.getUrgentNearbyWorkers(
      workers, 
      shift, 
      maxDistance, 
      limit
    );

    res.json({
      success: true,
      data: {
        shiftId: shift.id,
        urgentWorkers: urgentWorkers,
        total: urgentWorkers.length,
        searchRadius: maxDistance,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/nearby/heatmap
 * Get availability heatmap for an area
 */
router.post('/heatmap', async (req, res, next) => {
  try {
    const { workers, area, gridSize = 0.01 } = req.body;

    // Validate input
    try {
      workers.forEach((worker: any) => WorkerLocationSchema.parse(worker));
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input data',
        code: 'INVALID_INPUT',
      });
    }

    // Validate area bounds
    if (!area.north || !area.south || !area.east || !area.west) {
      return res.status(400).json({
        success: false,
        error: 'Invalid area bounds',
        code: 'INVALID_AREA',
      });
    }

    // Generate heatmap
    const heatmap = await rankingEngine.getAvailabilityHeatmap(workers, area, gridSize);

    res.json({
      success: true,
      data: {
        heatmap: heatmap,
        gridSize: gridSize,
        areaBounds: area,
        totalGridPoints: heatmap.length,
        availableWorkers: heatmap.reduce((sum, point) => sum + point.availableWorkers, 0),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/nearby/health
 * Health check for ranking service
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'Nearby Worker Ranking Engine',
    status: 'active',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/nearby/model-info
 * Get information about the ranking algorithm
 */
router.get('/model-info', (req, res) => {
  res.json({
    success: true,
    data: {
      version: '1.0.0',
      algorithm: 'weighted-scoring',
      weights: {
        proximity: 0.25,
        availability: 0.20,
        skills: 0.20,
        performance: 0.15,
        response: 0.10,
        cost: 0.10,
      },
      features: [
        'Real-time location tracking',
        'Multi-factor scoring',
        'Transport condition awareness',
        'Availability conflict detection',
        'Travel time estimation',
        'Skill matching',
        'Performance weighting',
      ],
      accuracy: 'Rule-based with confidence scoring',
      lastUpdated: new Date().toISOString(),
    },
  });
});

export { router as nearbyWorkerRankingRouter };
