// Debug script to check why no workers are being found
// Add this to your SmartMatchingService to debug the issue

export class SmartMatchingService {
  // ... existing code ...

  /**
   * DEBUG VERSION - Get best matching workers for a shift with logging
   */
  async getBestWorkersForShiftDebug(
    shiftId: string,
    options: {
      limit?: number;
      minScore?: number;
      includeUnavailable?: boolean;
    } = {}
  ): Promise<MatchingResult[]> {
    const { limit = 20, minScore = 60, includeUnavailable = false } = options;

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

    // Get available workers - DEBUG VERSION
    console.log('🔍 DEBUG: Querying workers with conditions:', {
      role: 'WORKER',
      status: 'ACTIVE',
      includeUnavailable,
    });

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
      take: limit * 2,
    });

    console.log('🔍 DEBUG: Workers found:', workers.length);
    
    if (workers.length === 0) {
      console.log('🔍 DEBUG: No workers found! Checking total workers in database...');
      
      // Check total workers
      const totalWorkers = await prisma.user.count({
        where: { role: 'WORKER' }
      });
      console.log('🔍 DEBUG: Total workers in DB:', totalWorkers);
      
      // Check active workers
      const activeWorkers = await prisma.user.count({
        where: { role: 'WORKER', status: 'ACTIVE' }
      });
      console.log('🔍 DEBUG: Active workers in DB:', activeWorkers);
      
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
      
      // Show a sample worker to check structure
      const sampleWorker = await prisma.user.findFirst({
        where: { role: 'WORKER' },
        include: {
          workerSkills: { include: { skill: true } },
          workerAvailability: true,
          workerLocation: true,
          workerProfile: true,
        },
      });
      console.log('🔍 DEBUG: Sample worker structure:', sampleWorker);
    }

    // Transform data
    const shiftRequirement = this.transformShiftFromDB(shift);
    const workerProfiles = workers.map(worker => this.transformWorkerFromDB(worker));

    console.log('🔍 DEBUG: Transformed shift requirement:', {
      id: shiftRequirement.id,
      requiredSkills: shiftRequirement.requiredSkills,
      location: shiftRequirement.location,
      compensation: shiftRequirement.compensation,
    });

    console.log('🔍 DEBUG: Sample worker profile:', workerProfiles[0] || 'NO WORKERS');

    // Get matches
    const matches = await this.matchingEngine.matchWorkersToShift(workerProfiles, shiftRequirement);
    
    console.log('🔍 DEBUG: Raw matches from engine:', matches.length);
    
    if (matches.length > 0) {
      console.log('🔍 DEBUG: Sample match:', matches[0]);
    }
    
    // Filter and limit results
    const filteredMatches = matches
      .filter(match => match.overallScore >= minScore)
      .slice(0, limit);
    
    console.log('🔍 DEBUG: Final matches after filtering:', filteredMatches.length);
    console.log('🔍 DEBUG: Final matches:', filteredMatches);

    return filteredMatches;
  }
}

// HOW TO USE:
// 1. Replace the original getBestWorkersForShift method with this debug version
// 2. Check your browser console or server logs for the debug output
// 3. Look for the 🔍 DEBUG messages to see what's happening
