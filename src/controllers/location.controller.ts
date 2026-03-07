import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { NotFoundError, AppError } from '../utils/AppError';
import { AuthRequest } from '../middleware/auth';
import { ApiResponse } from '../utils/ApiResponse';
import { z } from 'zod';

// Organization location schema (static work sites)
const locationSchema = z.object({
  name: z.string().min(2).max(255),
  address: z.string().min(1).max(500),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  geofenceRadius: z.number().int().min(50).max(5000).default(100),
  contactName: z.string().max(255).optional(),
  contactPhone: z.string().max(50).optional(),
  isPrimary: z.boolean().optional(),
});

// Worker location schema (dynamic GPS tracking)
const workerLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).optional(),
  isAvailable: z.boolean().optional(),
});

export class LocationController {
  list = async (req: AuthRequest, res: Response) => {
    const locations = await prisma.location.findMany({
      where: {
        organizationId: req.user!.organizationId,
        isActive: true,
      },
      include: {
        _count: { select: { shifts: true } },
      },
      orderBy: { name: 'asc' },
    });

    ApiResponse.ok(res, 'Locations retrieved', locations);
  };

  getById = async (req: AuthRequest, res: Response) => {
    const location = await prisma.location.findFirst({
      where: {
        id: req.params.locationId,
        organizationId: req.user!.organizationId,
      },
    });

    if (!location) throw new NotFoundError('Location');

    ApiResponse.ok(res, 'Location retrieved', location);
  };

  create = async (req: AuthRequest, res: Response) => {
    const data = locationSchema.parse(req.body);

    // If setting as primary, unset other primaries first
    if (data.isPrimary) {
      await prisma.location.updateMany({
        where: { organizationId: req.user!.organizationId },
        data: { isPrimary: false },
      });
    }

    const location = await prisma.location.create({
      data: {
        ...data,
        organizationId: req.user!.organizationId,
      },
    });

    ApiResponse.created(res, 'Location created', location);
  };

  update = async (req: AuthRequest, res: Response) => {
    const data = locationSchema.partial().parse(req.body);

    const result = await prisma.location.updateMany({
      where: {
        id: req.params.locationId,
        organizationId: req.user!.organizationId,
      },
      data,
    });

    if (result.count === 0) throw new NotFoundError('Location');

    ApiResponse.ok(res, 'Location updated');
  };

  delete = async (req: AuthRequest, res: Response) => {
    // Soft delete
    const result = await prisma.location.updateMany({
      where: {
        id: req.params.locationId,
        organizationId: req.user!.organizationId,
      },
      data: { isActive: false },
    });

    if (result.count === 0) throw new NotFoundError('Location');

    ApiResponse.ok(res, 'Location deleted');
  };

  // ============================================================
  // WORKER LOCATION (Dynamic GPS Tracking)
  // ============================================================

  /**
   * Update worker's current location (called from mobile app)
   */
  updateWorkerLocation = async (req: AuthRequest, res: Response) => {
    if (req.user!.role !== 'WORKER') {
      throw new AppError('Only workers can update their location', 403, 'FORBIDDEN');
    }

    const data = workerLocationSchema.parse(req.body);

    const workerLocation = await prisma.workerLocation.upsert({
      where: { workerId: req.user!.id },
      update: {
        latitude: data.latitude,
        longitude: data.longitude,
        accuracy: data.accuracy,
        isAvailable: data.isAvailable,
      },
      create: {
        workerId: req.user!.id,
        latitude: data.latitude,
        longitude: data.longitude,
        accuracy: data.accuracy,
        isAvailable: data.isAvailable ?? false,
      },
    });

    ApiResponse.ok(res, 'Location updated', workerLocation);
  };

  /**
   * Get worker's current location (for managers/admins)
   */
  getWorkerLocation = async (req: AuthRequest, res: Response) => {
    const { workerId } = req.params;

    // Verify worker belongs to same organization
    const worker = await prisma.user.findFirst({
      where: {
        id: workerId,
        organizationId: req.user!.organizationId,
        role: 'WORKER',
      },
      include: { workerLocation: true },
    });

    if (!worker) throw new NotFoundError('Worker');

    ApiResponse.ok(res, 'Worker location retrieved', {
      workerId: worker.id,
      fullName: worker.fullName,
      location: worker.workerLocation,
    });
  };

  /**
   * Get all workers' locations for the organization (for managers/admins)
   */
  listWorkerLocations = async (req: AuthRequest, res: Response) => {
    const workers = await prisma.user.findMany({
      where: {
        organizationId: req.user!.organizationId,
        role: 'WORKER',
        status: 'ACTIVE',
      },
      select: {
        id: true,
        fullName: true,
        workerLocation: true,
      },
    });

    ApiResponse.ok(res, 'Worker locations retrieved', workers);
  };

  /**
   * Get nearby available workers within radius (for shift assignment)
   */
  getNearbyWorkers = async (req: AuthRequest, res: Response) => {
    const { latitude, longitude, radiusKm } = z.object({
      latitude: z.coerce.number().min(-90).max(90),
      longitude: z.coerce.number().min(-180).max(180),
      radiusKm: z.coerce.number().min(1).max(100).default(10),
    }).parse(req.query);

    // Haversine formula approximation for nearby workers
    // 1 degree latitude ≈ 111km
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos(latitude * Math.PI / 180));

    const nearbyWorkers = await prisma.workerLocation.findMany({
      where: {
        isAvailable: true,
        latitude: {
          gte: latitude - latDelta,
          lte: latitude + latDelta,
        },
        longitude: {
          gte: longitude - lngDelta,
          lte: longitude + lngDelta,
        },
        worker: {
          organizationId: req.user!.organizationId,
          status: 'ACTIVE',
        },
      },
      include: {
        worker: {
          select: {
            id: true,
            fullName: true,
            phone: true,
          },
        },
      },
    });

    ApiResponse.ok(res, 'Nearby workers retrieved', nearbyWorkers);
  };
}
