import { prisma } from '../../lib/prisma';
import { SmartMatchingEngine } from './engine';
import { WorkerProfile, ShiftRequirement, MatchingResult } from './types';

/**
 * Database integration for Smart Matching Engine
 * Bridges the gap between database models and matching engine types
 */
export class SmartMatchingService {
  private matchingEngine: SmartMatchingEngine;

  constructor() {
    this.matchingEngine = new SmartMatchingEngine();
  }

  /**
   * Transform database worker to matching engine format
   */
  private transformWorkerFromDB(worker: any): WorkerProfile {
    return {
      id: worker.id,
      fullName: worker.fullName,
      skills: worker.workerSkills?.map((s: any) => s.skill.name) || [],
      certifications: [], // Worker documents don't have certifications in this schema
      experience: {
        years: 0, // Not stored in current schema
        relevantRoles: [],
      },
      availability: {
        preferredShifts: ['morning', 'afternoon'], // Default preferences
        maxWeeklyHours: 40,
        noticePeriod: 24,
      },
      location: {
        latitude: worker.workerLocation?.latitude || 0,
        longitude: worker.workerLocation?.longitude || 0,
        maxTravelDistance: worker.workerProfile?.maxTravelDistance || 50,
      },
      preferences: {
        minHourlyRate: worker.workerProfile?.hourlyRate || 0,
        preferredLocations: [],
        shiftTypes: [],
      },
      performance: {
        reliabilityScore: (worker.reliabilityScore?.score || 100) / 100,
        averageRating: worker.reliabilityScore?.avgRating || 3.0,
        completedShifts: worker.reliabilityScore?.completedShifts || 0,
        noShowRate: worker.reliabilityScore?.noShows || 0,
        punctualityScore: 0.5, // Not tracked in current schema
      },
    };
  }

  /**
   * Transform database shift to matching engine format
   */
  private transformShiftFromDB(shift: any): ShiftRequirement {
    return {
      id: shift.id,
      title: shift.title,
      description: shift.notes || '',
      requiredSkills: shift.requiredSkills?.map((rs: any) => rs.skill.name) || [],
      requiredCertifications: shift.requiredSkills?.map((rs: any) => rs.skill.certification).filter(Boolean) || [],
      experienceLevel: 'intermediate', // Default, could be stored in DB
      urgency: this.mapPriorityToUrgency(shift.priority),
      location: {
        latitude: shift.siteLat || 0,
        longitude: shift.siteLng || 0,
        address: shift.siteLocation || '',
      },
      timing: {
        startTime: shift.startAt,
        endTime: shift.endAt,
        breakDuration: shift.breakMinutes || 30,
      },
      compensation: {
        hourlyRate: shift.payRate || 0,
        overtimeRate: (shift.payRate || 0) * 1.5, // Default overtime
        bonuses: [],
      },
      specialRequirements: [], // Could be stored in DB
    };
  }

  /**
   * Map priority enum to urgency
   */
  private mapPriorityToUrgency(priority: string): 'low' | 'medium' | 'high' | 'critical' {
    switch (priority) {
      case 'LOW': return 'low';
      case 'NORMAL': return 'medium';
      case 'HIGH': return 'high';
      case 'URGENT': return 'critical';
      default: return 'medium';
    }
  }

  /**
   * Get best matching workers for a shift
   */
  async getBestWorkersForShift(
    shiftId: string,
    options: {
      limit?: number;
      minScore?: number;
      includeUnavailable?: boolean;
    } = {}
  ): Promise<MatchingResult[]> {
    const { limit = 20, minScore = 60, includeUnavailable = false } = options;

    // DEBUG: Add logging
    console.log('🔍 DEBUG: Starting worker matching for shift:', shiftId);
    console.log('🔍 DEBUG: Options:', { limit, minScore, includeUnavailable });

    // Get shift details
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      include: {
        requiredSkills: { include: { skill: true } },
        clientCompany: { select: { id: true, name: true } },
      },
    });

    console.log('🔍 DEBUG: Shift found:', shift ? 'YES' : 'NO');
    if (shift) {
      console.log('🔍 DEBUG: Shift details:', {
        id: shift.id,
        title: shift.title,
        requiredSkills: shift.requiredSkills?.length || 0,
        payRate: shift.payRate,
        startAt: shift.startAt,
      });
    }

    if (!shift) {
      throw new Error('Shift not found');
    }

    // DEBUG: Check worker availability conditions
    if (!includeUnavailable) {
      console.log('🔍 DEBUG: Checking worker availability...');
      
      // Check total workers
      const totalWorkers = await prisma.user.count({
        where: { role: 'WORKER', status: 'ACTIVE' }
      });
      console.log('🔍 DEBUG: Total active workers:', totalWorkers);
      
      // Check workers with availability
      const workersWithAvailability = await prisma.user.count({
        where: { 
          role: 'WORKER', 
          status: 'ACTIVE',
          workerAvailability: {
            some: {
              isAvailable: true,
            },
          },
        }
      });
      console.log('🔍 DEBUG: Workers with availability:', workersWithAvailability);
      
      if (workersWithAvailability === 0) {
        console.log('🔍 DEBUG: ISSUE: No workers have availability marked as true!');
        console.log('🔍 DEBUG: Try setting includeUnavailable=true to see all workers');
      }
    }

    // Get available workers
    const workers = await prisma.user.findMany({
      where: {
        role: 'WORKER',
        status: 'ACTIVE',
        ...(includeUnavailable ? {} : {
          workerAvailability: {
            some: {
              isAvailable: true,
            },
          },
        }),
      },
      include: {
        workerSkills: { include: { skill: true } },
        workerDocuments: true,
        reliabilityScore: true,
        workerAvailability: true,
        workerLocation: true,
        workerProfile: true,
      },
      take: limit * 2, // Get more to filter by score
    });

    console.log('🔍 DEBUG: Workers found in query:', workers.length);
    
    if (workers.length > 0) {
      console.log('🔍 DEBUG: Sample worker data:', {
        id: workers[0].id,
        fullName: workers[0].fullName,
        skillsCount: workers[0].workerSkills?.length || 0,
        hasLocation: !!workers[0].workerLocation,
        hasProfile: !!workers[0].workerProfile,
        availabilityCount: workers[0].workerAvailability?.length || 0,
      });
    }

    // Transform data
    const shiftRequirement = this.transformShiftFromDB(shift);
    const workerProfiles = workers.map(worker => this.transformWorkerFromDB(worker));

    console.log('🔍 DEBUG: Shift requirement:', {
      requiredSkills: shiftRequirement.requiredSkills,
      location: shiftRequirement.location,
      payRate: shiftRequirement.compensation.hourlyRate,
    });

    console.log('🔍 DEBUG: Sample worker profile:', workerProfiles[0] || 'NO WORKERS');

    // Get matches
    const matches = await this.matchingEngine.matchWorkersToShift(workerProfiles, shiftRequirement);
    
    console.log('🔍 DEBUG: Raw matches from engine:', matches.length);
    
    if (matches.length > 0) {
      console.log('🔍 DEBUG: Sample match scores:', matches.map(m => ({
        workerId: m.workerId,
        overallScore: m.overallScore,
        skillMatch: m.breakdown.skillMatch,
        locationMatch: m.breakdown.locationMatch,
      })));
    }
    
    // Filter and limit results
    const filteredMatches = matches
      .filter(match => match.overallScore >= minScore)
      .slice(0, limit);
    
    console.log('🔍 DEBUG: Matches after minScore filter (>=', minScore, '):', filteredMatches.length);
    console.log('🔍 DEBUG: Final matches:', filteredMatches);

    return filteredMatches;
  }

  /**
   * Get best shifts for a worker
   */
  async getBestShiftsForWorker(
    workerId: string,
    options: {
      limit?: number;
      minScore?: number;
      status?: 'OPEN' | 'FILLED' | 'CANCELLED';
    } = {}
  ): Promise<MatchingResult[]> {
    const { limit = 20, minScore = 60, status = 'OPEN' } = options;

    // Get worker details
    const worker = await prisma.user.findUnique({
      where: { id: workerId },
      include: {
        workerSkills: { include: { skill: true } },
        workerDocuments: true,
        reliabilityScore: true,
        workerAvailability: true,
        workerLocation: true,
        workerProfile: true,
      },
    });

    if (!worker) {
      throw new Error('Worker not found');
    }

    // Get available shifts
    const shifts = await prisma.shift.findMany({
      where: {
        status: status,
        startAt: { gt: new Date() },
        // Only shifts from same organization or client
        ...(worker.organizationId ? {
          OR: [
            { organizationId: worker.organizationId },
            { clientCompany: { staffAssignments: { some: { staffId: worker.id } } } }
          ]
        } : {}),
      },
      include: {
        requiredSkills: { include: { skill: true } },
        clientCompany: { select: { id: true, name: true } },
      },
      take: limit * 2,
      orderBy: { startAt: 'asc' },
    });

    // Transform data
    const workerProfile = this.transformWorkerFromDB(worker);
    const shiftRequirements = shifts.map(shift => this.transformShiftFromDB(shift));

    // Get matches
    const matches = await this.matchingEngine.matchWorkerToShifts(workerProfile, shiftRequirements);
    
    // Filter and limit results
    return matches
      .filter(match => match.overallScore >= minScore)
      .slice(0, limit);
  }

  /**
   * Quick match for a specific worker and shift
   */
  async quickMatch(workerId: string, shiftId: string): Promise<MatchingResult> {
    // Get worker and shift data
    const [worker, shift] = await Promise.all([
      prisma.user.findUnique({
        where: { id: workerId },
        include: {
          workerSkills: { include: { skill: true } },
          workerDocuments: true,
          reliabilityScore: true,
          workerAvailability: true,
          workerLocation: true,
          workerProfile: true,
        },
      }),
      prisma.shift.findUnique({
        where: { id: shiftId },
        include: {
          requiredSkills: { include: { skill: true } },
          clientCompany: { select: { id: true, name: true } },
        },
      }),
    ]);

    if (!worker) {
      throw new Error('Worker not found');
    }

    if (!shift) {
      throw new Error('Shift not found');
    }

    // Transform and match
    const workerProfile = this.transformWorkerFromDB(worker);
    const shiftRequirement = this.transformShiftFromDB(shift);
    
    return await this.matchingEngine.matchWorkerToShift(workerProfile, shiftRequirement);
  }

  /**
   * Create automatic matching suggestions when shift is created
   */
  async suggestWorkersForNewShift(shiftId: string): Promise<MatchingResult[]> {
    return await this.getBestWorkersForShift(shiftId, {
      limit: 5,
      minScore: 70,
      includeUnavailable: false,
    });
  }

  /**
   * Get matching insights for a worker
   */
  async getWorkerMatchingInsights(workerId: string): Promise<{
    topSkills: string[];
    preferredShiftTypes: string[];
    averageMatchScore: number;
    recentMatches: MatchingResult[];
    recommendations: string[];
  }> {
    // Get recent matches (last 30 days)
    const recentShifts = await prisma.shift.findMany({
      where: {
        startAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
        assignments: {
          some: { workerId },
        },
      },
      include: {
        requiredSkills: { include: { skill: true } },
      },
      take: 20,
    });

    const worker = await prisma.user.findUnique({
      where: { id: workerId },
      include: {
        workerSkills: { include: { skill: true } },
        workerAvailability: true,
        reliabilityScore: true,
        workerProfile: true,
      },
    });

    if (!worker) {
      throw new Error('Worker not found');
    }

    // Transform and get matches
    const workerProfile = this.transformWorkerFromDB(worker);
    const shiftRequirements = recentShifts.map(shift => this.transformShiftFromDB(shift));
    
    const recentMatches = await this.matchingEngine.matchWorkerToShifts(workerProfile, shiftRequirements);
    
    // Calculate insights
    const averageMatchScore = recentMatches.reduce((sum, match) => sum + match.overallScore, 0) / recentMatches.length;
    
    const topSkills = worker.workerSkills
      .map((s: any) => s.skill.name)
      .slice(0, 5);
    
    const preferredShiftTypes = ['morning', 'afternoon', 'night']; // Default preferences
    
    const recommendations = [];
    if (averageMatchScore < 70) {
      recommendations.push('Consider additional training to improve match scores');
    }
    if (topSkills.length < 3) {
      recommendations.push('Add more skills to increase opportunities');
    }
    if (worker.reliabilityScore?.score && worker.reliabilityScore.score < 80) {
      recommendations.push('Focus on improving reliability for better matches');
    }

    return {
      topSkills,
      preferredShiftTypes,
      averageMatchScore: Math.round(averageMatchScore * 100) / 100,
      recentMatches: recentMatches.slice(0, 5),
      recommendations,
    };
  }
}
