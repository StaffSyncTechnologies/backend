import { Router } from 'express';
import { NoShowPredictionEngine } from './engine';
import { WorkerHistorySchema, ShiftContextSchema } from './types';

const router = Router();
const predictionEngine = new NoShowPredictionEngine();

/**
 * POST /api/no-show/predict
 * Predict no-show probability for a worker-shift combination
 */
router.post('/predict', async (req, res, next) => {
  try {
    const { worker, shift } = req.body;

    // Validate input
    try {
      WorkerHistorySchema.parse(worker);
      ShiftContextSchema.parse(shift);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input data',
        code: 'INVALID_INPUT',
      });
    }

    // Perform prediction
    const prediction = await predictionEngine.predictNoShow(worker, shift);

    res.json({
      success: true,
      data: prediction,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/no-show/batch-predict
 * Predict no-show probability for multiple workers
 */
router.post('/batch-predict', async (req, res, next) => {
  try {
    const { workers, shift } = req.body;

    // Validate input
    try {
      ShiftContextSchema.parse(shift);
      workers.forEach((worker: any) => WorkerHistorySchema.parse(worker));
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input data',
        code: 'INVALID_INPUT',
      });
    }

    // Perform batch prediction
    const predictions = await predictionEngine.batchPredict(workers, shift);

    res.json({
      success: true,
      data: {
        shiftId: shift.id,
        predictions: predictions,
        total: predictions.length,
        highRiskCount: predictions.filter(p => p.riskLevel === 'high').length,
        criticalRiskCount: predictions.filter(p => p.riskLevel === 'critical').length,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/no-show/shift-risk
 * Assess overall risk for a shift
 */
router.post('/shift-risk', async (req, res, next) => {
  try {
    const { workers, shift } = req.body;

    // Validate input
    try {
      ShiftContextSchema.parse(shift);
      workers.forEach((worker: any) => WorkerHistorySchema.parse(worker));
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input data',
        code: 'INVALID_INPUT',
      });
    }

    // Assess shift risk
    const riskAssessment = await predictionEngine.assessShiftRisk(workers, shift);

    res.json({
      success: true,
      data: riskAssessment,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/no-show/health
 * Health check for prediction service
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'No-Show Prediction Engine',
    status: 'active',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/no-show/model-info
 * Get information about the prediction model
 */
router.get('/model-info', (req, res) => {
  res.json({
    success: true,
    data: {
      version: '1.0.0',
      algorithm: 'weighted-rule-based',
      factors: {
        historical: 0.40,
        environmental: 0.25,
        personal: 0.20,
        shift: 0.15,
      },
      riskLevels: {
        low: { range: '< 10%', color: 'green' },
        medium: { range: '10-25%', color: 'yellow' },
        high: { range: '25-50%', color: 'orange' },
        critical: { range: '> 50%', color: 'red' },
      },
      accuracy: 'Rule-based with confidence scoring',
      lastUpdated: new Date().toISOString(),
    },
  });
});

export { router as noShowPredictionRouter };
