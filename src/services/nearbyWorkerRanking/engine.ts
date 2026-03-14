import { WorkerLocation, ShiftLocation, WorkerRanking } from './types';

export class NearbyWorkerRankingEngine {
  private weights = {
    proximity: 0.25,      // 25% - Distance and travel time
    availability: 0.20,   // 20% - Current availability
    skills: 0.20,         // 20% - Skill match
    performance: 0.15,    // 15% - Past performance
    response: 0.10,       // 10% - Response time
    cost: 0.10,           // 10% - Pay rate and costs
  };

  /**
   * Rank nearby workers for a specific shift
   */
  public async rankNearbyWorkers(
    workers: WorkerLocation[], 
    shift: ShiftLocation
  ): Promise<WorkerRanking[]> {
    
    const rankings = await Promise.all(
      workers.map(worker => this.rankWorker(worker, shift))
    );

    // Sort by overall score (descending) and assign ranks
    rankings.sort((a, b) => b.overallScore - a.overallScore);
    rankings.forEach((ranking, index) => {
      ranking.rank = index + 1;
    });

    return rankings;
  }

  /**
   * Rank a single worker for a shift
   */
  private async rankWorker(
    worker: WorkerLocation, 
    shift: ShiftLocation
  ): Promise<WorkerRanking> {
    
    // Calculate individual factor scores
    const proximityScore = this.calculateProximityScore(worker, shift);
    const availabilityScore = this.calculateAvailabilityScore(worker, shift);
    const skillsScore = this.calculateSkillsScore(worker, shift);
    const performanceScore = this.calculatePerformanceScore(worker);
    const responseScore = this.calculateResponseScore(worker);
    const costScore = this.calculateCostScore(worker, shift);

    // Calculate weighted overall score
    const overallScore = 
      proximityScore * this.weights.proximity +
      availabilityScore * this.weights.availability +
      skillsScore * this.weights.skills +
      performanceScore * this.weights.performance +
      responseScore * this.weights.response +
      costScore * this.weights.cost;

    // Calculate distance and travel information
    const distanceInfo = this.calculateDistanceInfo(worker, shift);
    
    // Check availability conflicts
    const availabilityInfo = this.checkAvailability(worker, shift);
    
    // Generate insights
    const insights = this.generateInsights(worker, shift, {
      proximityScore,
      availabilityScore,
      skillsScore,
      performanceScore,
      responseScore,
      costScore,
    });

    // Calculate confidence
    const confidence = this.calculateConfidence(worker, shift);

    return {
      workerId: worker.workerId,
      shiftId: shift.shiftId,
      overallScore: Math.round(overallScore * 100) / 100,
      rank: 0, // Will be set after sorting
      factors: {
        proximity: Math.round(proximityScore * 100) / 100,
        availability: Math.round(availabilityScore * 100) / 100,
        skills: Math.round(skillsScore * 100) / 100,
        performance: Math.round(performanceScore * 100) / 100,
        response: Math.round(responseScore * 100) / 100,
        cost: Math.round(costScore * 100) / 100,
      },
      distance: distanceInfo,
      availability: availabilityInfo,
      insights,
      contactInfo: {
        preferredContact: 'app', // Default, should come from worker profile
      },
      confidence,
    };
  }

  /**
   * Calculate proximity score based on distance and travel time
   */
  private calculateProximityScore(worker: WorkerLocation, shift: ShiftLocation): number {
    const currentDistance = this.calculateDistance(
      worker.currentLocation.latitude,
      worker.currentLocation.longitude,
      shift.location.latitude,
      shift.location.longitude
    );

    const homeDistance = this.calculateDistance(
      worker.homeLocation.latitude,
      worker.homeLocation.longitude,
      shift.location.latitude,
      shift.location.longitude
    );

    // Use the closer of current or home location
    const effectiveDistance = Math.min(currentDistance, homeDistance);
    
    // Score based on distance (closer is better)
    if (effectiveDistance <= 1) return 100; // Within 1km
    if (effectiveDistance <= 3) return 90;  // Within 3km
    if (effectiveDistance <= 5) return 80;  // Within 5km
    if (effectiveDistance <= 10) return 70; // Within 10km
    if (effectiveDistance <= 15) return 60; // Within 15km
    if (effectiveDistance <= 20) return 50; // Within 20km
    
    // Beyond preferred radius, penalize heavily
    if (effectiveDistance > worker.availability.maxTravelDistance) {
      return Math.max(0, 50 - (effectiveDistance - worker.availability.maxTravelDistance) * 2);
    }
    
    return Math.max(0, 40 - (effectiveDistance - 20) * 2);
  }

  /**
   * Calculate availability score
   */
  private calculateAvailabilityScore(worker: WorkerLocation, shift: ShiftLocation): number {
    let score = 0;

    // Basic availability check
    if (!worker.availability.isAvailable) {
      return 0;
    }

    score += 50; // Base score for being available

    // Time availability
    const now = new Date();
    const shiftStart = shift.requirements.startTime;
    
    if (worker.availability.availableFrom && shiftStart >= worker.availability.availableFrom) {
      score += 20;
    }
    
    if (worker.availability.availableUntil && shiftStart <= worker.availability.availableUntil) {
      score += 20;
    }

    // Emergency availability bonus
    if (shift.requirements.urgency === 'critical' && !worker.workPreferences.emergencyOnly) {
      score += 10;
    }

    // Recent work check (avoid overworking)
    if (worker.workPreferences.lastWorked) {
      const daysSinceLastWork = (now.getTime() - worker.workPreferences.lastWorked.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLastWork >= 1) {
        score += 10; // Rested worker
      } else if (daysSinceLastWork < 0.5) {
        score -= 20; // Recently worked
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate skills match score
   */
  private calculateSkillsScore(worker: WorkerLocation, shift: ShiftLocation): number {
    const workerSkills = new Set(worker.skills.map(s => s.toLowerCase()));
    const requiredSkills = new Set(shift.requirements.skills.map(s => s.toLowerCase()));
    const requiredCerts = new Set(shift.requirements.certifications.map(c => c.toLowerCase()));
    const workerCerts = new Set(worker.certifications.map(c => c.toLowerCase()));

    // Check required skills
    const matchedSkills = shift.requirements.skills.filter(skill => 
      workerSkills.has(skill.toLowerCase())
    ).length;
    
    const skillsScore = shift.requirements.skills.length > 0 
      ? (matchedSkills / shift.requirements.skills.length) * 60 
      : 50; // If no skills required, neutral score

    // Check certifications
    const matchedCerts = shift.requirements.certifications.filter(cert => 
      workerCerts.has(cert.toLowerCase())
    ).length;
    
    const certsScore = shift.requirements.certifications.length > 0
      ? (matchedCerts / shift.requirements.certifications.length) * 40
      : 50; // If no certs required, neutral score

    return Math.min(100, skillsScore + certsScore);
  }

  /**
   * Calculate performance score
   */
  private calculatePerformanceScore(worker: WorkerLocation): number {
    const reliabilityWeight = 0.5;
    const ratingWeight = 0.3;
    const experienceWeight = 0.2;

    const reliabilityScore = worker.performance.reliabilityScore * 100;
    const ratingScore = (worker.performance.averageRating / 5) * 100;
    const experienceScore = Math.min(100, (worker.performance.completedShifts / 100) * 100);

    return (
      reliabilityScore * reliabilityWeight +
      ratingScore * ratingWeight +
      experienceScore * experienceWeight
    );
  }

  /**
   * Calculate response time score
   */
  private calculateResponseScore(worker: WorkerLocation): number {
    const avgResponseTime = worker.performance.responseTime; // in minutes
    
    if (avgResponseTime <= 5) return 100;  // Very fast response
    if (avgResponseTime <= 15) return 90;  // Fast response
    if (avgResponseTime <= 30) return 80;  // Good response
    if (avgResponseTime <= 60) return 70;  // Acceptable response
    if (avgResponseTime <= 120) return 60; // Slow response
    if (avgResponseTime <= 240) return 50; // Very slow response
    
    return Math.max(0, 40 - (avgResponseTime - 240) / 60); // Beyond 4 hours
  }

  /**
   * Calculate cost score (lower cost is better for employer)
   */
  private calculateCostScore(worker: WorkerLocation, shift: ShiftLocation): number {
    const workerMinRate = worker.workPreferences.minHourlyRate;
    const shiftRate = shift.compensation.hourlyRate;

    if (shiftRate >= workerMinRate * 1.2) return 100; // Well above minimum
    if (shiftRate >= workerMinRate * 1.1) return 90;  // Above minimum
    if (shiftRate >= workerMinRate) return 80;       // Meets minimum
    if (shiftRate >= workerMinRate * 0.9) return 60;  // Slightly below minimum
    
    return Math.max(0, 40 - ((workerMinRate - shiftRate) / workerMinRate) * 100);
  }

  /**
   * Calculate distance and travel information
   */
  private calculateDistanceInfo(worker: WorkerLocation, shift: ShiftLocation) {
    const currentDistance = this.calculateDistance(
      worker.currentLocation.latitude,
      worker.currentLocation.longitude,
      shift.location.latitude,
      shift.location.longitude
    );

    const homeDistance = this.calculateDistance(
      worker.homeLocation.latitude,
      worker.homeLocation.longitude,
      shift.location.latitude,
      shift.location.longitude
    );

    // Estimate travel time based on distance and transport conditions
    const travelTime = this.estimateTravelTime(
      Math.min(currentDistance, homeDistance),
      worker.commutePreferences,
      shift.environmental.transportConditions
    );

    const recommendedTransport = this.recommendTransport(
      Math.min(currentDistance, homeDistance),
      worker.commutePreferences,
      shift.environmental.transportConditions
    );

    return {
      current: Math.round(currentDistance * 100) / 100,
      home: Math.round(homeDistance * 100) / 100,
      estimatedTravelTime: travelTime,
      recommendedTransport,
    };
  }

  /**
   * Check worker availability and conflicts
   */
  private checkAvailability(worker: WorkerLocation, shift: ShiftLocation) {
    const conflicts: string[] = [];
    
    if (!worker.availability.isAvailable) {
      conflicts.push('Worker is not currently available');
    }

    const shiftStart = shift.requirements.startTime;
    const now = new Date();

    if (worker.availability.availableFrom && shiftStart < worker.availability.availableFrom) {
      conflicts.push('Shift starts before worker is available');
    }

    if (worker.availability.availableUntil && shiftStart > worker.availability.availableUntil) {
      conflicts.push('Shift starts after worker availability ends');
    }

    if (worker.workPreferences.emergencyOnly && shift.requirements.urgency !== 'critical') {
      conflicts.push('Worker only accepts emergency shifts');
    }

    // Check if recently worked
    if (worker.workPreferences.lastWorked) {
      const hoursSinceLastWork = (shiftStart.getTime() - worker.workPreferences.lastWorked.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastWork < 8) {
        conflicts.push('Worker recently worked another shift');
      }
    }

    return {
      isAvailable: worker.availability.isAvailable && conflicts.length === 0,
      availableFrom: worker.availability.availableFrom,
      availableUntil: worker.availability.availableUntil,
      conflicts,
    };
  }

  /**
   * Generate insights about the worker-shift match
   */
  private generateInsights(
    worker: WorkerLocation, 
    shift: ShiftLocation, 
    scores: any
  ) {
    const strengths = [];
    const concerns = [];
    const recommendations = [];

    // Strengths
    if (scores.proximityScore >= 80) strengths.push('Very close to work location');
    if (scores.skillsScore >= 90) strengths.push('Excellent skill match');
    if (scores.performanceScore >= 85) strengths.push('Strong performance record');
    if (scores.responseScore >= 90) strengths.push('Very fast response time');
    if (scores.availabilityScore >= 90) strengths.push('Perfectly available');

    // Concerns
    if (scores.proximityScore < 50) concerns.push('Long commute distance');
    if (scores.skillsScore < 60) concerns.push('May lack some required skills');
    if (scores.performanceScore < 60) concerns.push('Mixed performance history');
    if (scores.responseScore < 60) concerns.push('Slow to respond to requests');
    if (scores.availabilityScore < 50) concerns.push('Availability issues');

    // Recommendations
    if (scores.proximityScore < 70 && shift.compensation.travelReimbursement) {
      recommendations.push('Offer travel reimbursement to offset commute costs');
    }
    
    if (scores.skillsScore < 80 && shift.requirements.experienceLevel === 'entry') {
      recommendations.push('Consider for training opportunity');
    }
    
    if (scores.responseScore < 70 && shift.requirements.urgency === 'critical') {
      recommendations.push('Contact immediately to confirm availability');
    }

    return {
      strengths,
      concerns,
      recommendations,
    };
  }

  /**
   * Calculate confidence in the ranking
   */
  private calculateConfidence(worker: WorkerLocation, shift: ShiftLocation): number {
    let confidence = 0.5; // Base confidence

    // Location data accuracy
    if (worker.currentLocation.accuracy < 100) confidence += 0.1;
    if (worker.currentLocation.accuracy < 50) confidence += 0.1;

    // Recent location update
    const now = new Date();
    const minutesSinceUpdate = (now.getTime() - worker.currentLocation.timestamp.getTime()) / (1000 * 60);
    if (minutesSinceUpdate < 60) confidence += 0.1;
    if (minutesSinceUpdate < 15) confidence += 0.1;

    // Performance data
    if (worker.performance.completedShifts > 20) confidence += 0.1;
    if (worker.performance.completedShifts > 50) confidence += 0.1;

    return Math.min(1, confidence);
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Estimate travel time based on distance and conditions
   */
  private estimateTravelTime(
    distance: number, 
    preferences: any, 
    transportConditions: any
  ): number {
    let baseTime = distance * 10; // Base: 10 minutes per km

    // Adjust for transport method
    if (preferences.transportMethods.includes('car')) {
      baseTime = distance * 3; // 3 minutes per km by car
    } else if (preferences.transportMethods.includes('bike')) {
      baseTime = distance * 4; // 4 minutes per km by bike
    } else if (preferences.transportMethods.includes('public_transport')) {
      baseTime = distance * 6; // 6 minutes per km by public transport
    }

    // Adjust for traffic conditions
    if (transportConditions.trafficLevel === 'high') baseTime *= 1.5;
    if (transportConditions.trafficLevel === 'severe') baseTime *= 2;

    // Adjust for public transport status
    if (transportConditions.publicTransportStatus === 'delays') baseTime *= 1.3;
    if (transportConditions.publicTransportStatus === 'disrupted') baseTime *= 1.7;
    if (transportConditions.publicTransportStatus === 'suspended') baseTime *= 2.5;

    return Math.round(baseTime);
  }

  /**
   * Recommend best transport method
   */
  private recommendTransport(
    distance: number, 
    preferences: any, 
    transportConditions: any
  ): string {
    if (distance < 1 && preferences.transportMethods.includes('walk')) {
      return 'walk';
    }

    if (preferences.transportMethods.includes('car') && 
        transportConditions.trafficLevel !== 'severe') {
      return 'car';
    }

    if (preferences.transportMethods.includes('bike') && 
        distance < 10 && 
        transportConditions.weatherConditions && 
        transportConditions.weatherConditions.precipitation < 5) {
      return 'bike';
    }

    if (preferences.transportMethods.includes('public_transport') &&
        transportConditions.publicTransportStatus !== 'suspended') {
      return 'public_transport';
    }

    return 'taxi'; // Fallback option
  }

  /**
   * Get urgent nearby workers for critical shifts
   */
  public async getUrgentNearbyWorkers(
    workers: WorkerLocation[], 
    shift: ShiftLocation,
    maxDistance: number = 10,
    limit: number = 10
  ): Promise<WorkerRanking[]> {
    
    // Filter by distance first
    const nearbyWorkers = workers.filter(worker => {
      const distance = this.calculateDistance(
        worker.currentLocation.latitude,
        worker.currentLocation.longitude,
        shift.location.latitude,
        shift.location.longitude
      );
      return distance <= maxDistance && worker.availability.isAvailable;
    });

    // Rank the filtered workers
    const rankings = await this.rankNearbyWorkers(nearbyWorkers, shift);
    
    // Return top results
    return rankings.slice(0, limit);
  }

  /**
   * Get worker availability heatmap for area
   */
  public async getAvailabilityHeatmap(
    workers: WorkerLocation[], 
    area: {
      north: number;
      south: number;
      east: number;
      west: number;
    },
    gridSize: number = 0.01 // ~1km grid
  ): Promise<Array<{
    lat: number;
    lng: number;
    availableWorkers: number;
    totalWorkers: number;
    averageScore: number;
  }>> {
    
    const heatmap = [];
    
    for (let lat = area.south; lat <= area.north; lat += gridSize) {
      for (let lng = area.west; lng <= area.east; lng += gridSize) {
        const gridWorkers = workers.filter(worker => 
          worker.currentLocation.latitude >= lat &&
          worker.currentLocation.latitude < lat + gridSize &&
          worker.currentLocation.longitude >= lng &&
          worker.currentLocation.longitude < lng + gridSize
        );

        if (gridWorkers.length > 0) {
          const availableCount = gridWorkers.filter(w => w.availability.isAvailable).length;
          const avgScore = gridWorkers.reduce((sum, w) => sum + w.performance.reliabilityScore, 0) / gridWorkers.length;

          heatmap.push({
            lat: lat + gridSize / 2,
            lng: lng + gridSize / 2,
            availableWorkers: availableCount,
            totalWorkers: gridWorkers.length,
            averageScore: Math.round(avgScore * 100) / 100,
          });
        }
      }
    }

    return heatmap;
  }
}
