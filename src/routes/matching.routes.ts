import { Router } from 'express';
import { SmartMatchingService } from '../services/matching/service';

const router = Router();
const matchingService = new SmartMatchingService();

/**
 * GET /api/matching/shifts/:shiftId/workers
 * Get best matching workers for a specific shift
 */
router.get('/shifts/:shiftId/workers', async (req, res, next) => {
  console.log('🔍 MATCHING ROUTE: /shifts/:shiftId/workers called with:', req.params, req.query);
  try {
    const { shiftId } = req.params;
    const { limit = 20, minScore = 60, includeUnavailable = false } = req.query;

    console.log('🔍 MATCHING ROUTE: Processing request for shiftId:', shiftId);

    const matches = await matchingService.getBestWorkersForShift(shiftId, {
      limit: Number(limit),
      minScore: Number(minScore),
      includeUnavailable: includeUnavailable === 'true',
    });

    console.log('🔍 MATCHING ROUTE: Found', matches.length, 'matches');

    res.json({
      success: true,
      data: {
        shiftId,
        matches: matches,
        total: matches.length,
      },
    });
  } catch (error) {
    console.log('🔍 MATCHING ROUTE: Error:', error);
    next(error);
  }
});

/**
 * GET /api/matching/workers/:workerId/shifts
 * Get best matching shifts for a specific worker
 */
router.get('/workers/:workerId/shifts', async (req, res, next) => {
  try {
    const { workerId } = req.params;
    const { limit = 20, minScore = 60, status = 'OPEN' } = req.query;

    const matches = await matchingService.getBestShiftsForWorker(workerId, {
      limit: Number(limit),
      minScore: Number(minScore),
      status: status as any,
    });

    res.json({
      success: true,
      data: {
        workerId,
        matches: matches,
        total: matches.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/matching/quick-match
 * Quick match for a worker and shift
 */
router.post('/quick-match', async (req, res, next) => {
  try {
    const { workerId, shiftId } = req.body;

    const match = await matchingService.quickMatch(workerId, shiftId);

    res.json({
      success: true,
      data: match,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/matching/workers/:workerId/insights
 * Get matching insights for a worker
 */
router.get('/workers/:workerId/insights', async (req, res, next) => {
  try {
    const { workerId } = req.params;

    const insights = await matchingService.getWorkerMatchingInsights(workerId);

    res.json({
      success: true,
      data: insights,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/matching/suggest/:shiftId
 * Get worker suggestions for a new shift
 */
router.post('/suggest/:shiftId', async (req, res, next) => {
  try {
    const { shiftId } = req.params;

    const suggestions = await matchingService.suggestWorkersForNewShift(shiftId);

    res.json({
      success: true,
      data: {
        shiftId,
        suggestions: suggestions,
        total: suggestions.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/matching/health
 * Health check for matching service
 */
router.get('/health', (req, res) => {
  console.log('🔍 MATCHING ROUTE: /health called');
  res.json({
    success: true,
    service: 'Smart Matching Engine',
    status: 'active',
    timestamp: new Date().toISOString(),
  });
});

export default router;
