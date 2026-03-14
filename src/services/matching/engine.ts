import { WorkerProfile, ShiftRequirement, MatchingResult } from './types';

export class SmartMatchingEngine {
  private weights = {
    skillMatch: 0.35,        // 35% - Most important
    performanceScore: 0.25,  // 25% - Reliability matters
    availabilityMatch: 0.20,  // 20% - Can they actually work
    locationMatch: 0.15,     // 15% - Proximity
    preferenceMatch: 0.05,   // 5% - Nice to have
  };

  /**
   * Calculate skill match score between worker and shift
   */
  private calculateSkillMatch(worker: WorkerProfile, shift: ShiftRequirement): number {
    const workerSkills = new Set(worker.skills.map(s => s.toLowerCase()));
    const requiredSkills = new Set(shift.requiredSkills.map(s => s.toLowerCase()));
    
    // Check required skills
    const requiredMatches = shift.requiredSkills.filter(skill => 
      workerSkills.has(skill.toLowerCase())
    ).length;
    
    const requiredScore = shift.requiredSkills.length > 0 
      ? (requiredMatches / shift.requiredSkills.length) * 100 
      : 100; // If no skills required, full score
    
    // Bonus for extra relevant skills
    const extraSkills = worker.skills.filter(skill => 
      !requiredSkills.has(skill.toLowerCase()) && 
      this.isSkillRelevant(skill, shift)
    ).length;
    
    const bonusScore = Math.min(extraSkills * 5, 20); // Max 20 points bonus
    
    return Math.min(requiredScore + bonusScore, 100);
  }

  /**
   * Calculate performance score based on worker history
   */
  private calculatePerformanceScore(worker: WorkerProfile): number {
    const reliabilityWeight = 0.4;
    const ratingWeight = 0.3;
    const punctualityWeight = 0.3;
    
    const reliabilityScore = worker.performance.reliabilityScore * 100;
    const ratingScore = (worker.performance.averageRating / 5) * 100;
    const punctualityScore = worker.performance.punctualityScore * 100;
    
    return (
      reliabilityScore * reliabilityWeight +
      ratingScore * ratingWeight +
      punctualityScore * punctualityWeight
    );
  }

  /**
   * Calculate availability match
   */
  private calculateAvailabilityMatch(worker: WorkerProfile, shift: ShiftRequirement): number {
    const shiftStart = new Date(shift.timing.startTime);
    const shiftHour = shiftStart.getHours();
    
    // Check if shift time matches worker preferences
    let timeMatch = 0;
    if (shiftHour >= 6 && shiftHour < 12 && worker.availability.preferredShifts.includes('morning')) timeMatch = 100;
    else if (shiftHour >= 12 && shiftHour < 18 && worker.availability.preferredShifts.includes('afternoon')) timeMatch = 100;
    else if (shiftHour >= 18 && shiftHour < 22 && worker.availability.preferredShifts.includes('night')) timeMatch = 100;
    else if ((shiftHour >= 22 || shiftHour < 6) && worker.availability.preferredShifts.includes('overnight')) timeMatch = 100;
    else timeMatch = 50; // Partial match if not preferred
    
    // Check notice period
    const now = new Date();
    const hoursUntilShift = (shiftStart.getTime() - now.getTime()) / (1000 * 60 * 60);
    const noticeMatch = hoursUntilShift >= worker.availability.noticePeriod ? 100 : 50;
    
    return (timeMatch + noticeMatch) / 2;
  }

  /**
   * Calculate location match based on distance
   */
  private calculateLocationMatch(worker: WorkerProfile, shift: ShiftRequirement): number {
    const distance = this.calculateDistance(
      worker.location.latitude,
      worker.location.longitude,
      shift.location.latitude,
      shift.location.longitude
    );
    
    if (distance <= worker.location.maxTravelDistance) {
      // Score based on how close they are vs max distance
      return Math.max(0, 100 - (distance / worker.location.maxTravelDistance) * 50);
    }
    
    return 0; // Too far
  }

  /**
   * Calculate preference match (rate, location preferences, etc.)
   */
  private calculatePreferenceMatch(worker: WorkerProfile, shift: ShiftRequirement): number {
    let score = 0;
    let factors = 0;
    
    // Pay rate match
    if (shift.compensation.hourlyRate >= worker.preferences.minHourlyRate) {
      score += 100;
    } else {
      score += (shift.compensation.hourlyRate / worker.preferences.minHourlyRate) * 100;
    }
    factors++;
    
    // Location preference
    const isPreferredLocation = worker.preferences.preferredLocations.some(pref =>
      shift.location.address.toLowerCase().includes(pref.toLowerCase())
    );
    score += isPreferredLocation ? 100 : 50;
    factors++;
    
    return score / factors;
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
   * Check if a skill is relevant to the shift
   */
  private isSkillRelevant(skill: string, shift: ShiftRequirement): boolean {
    const relevantKeywords = [
      ...shift.requiredSkills,
      ...shift.title.split(' '),
      ...shift.description.split(' ')
    ].map(s => s.toLowerCase());
    
    return relevantKeywords.some(keyword => 
      skill.toLowerCase().includes(keyword) || 
      keyword.includes(skill.toLowerCase())
    );
  }

  /**
   * Generate matching reasons and warnings
   */
  private generateInsights(
    worker: WorkerProfile, 
    shift: ShiftRequirement, 
    scores: any
  ): { reasons: string[]; warnings: string[] } {
    const reasons: string[] = [];
    const warnings: string[] = [];

    // Positive reasons
    if (scores.skillMatch >= 80) reasons.push('Strong skill match');
    if (scores.performanceScore >= 80) reasons.push('Excellent performance record');
    if (scores.locationMatch >= 80) reasons.push('Very close to work location');
    if (scores.availabilityMatch >= 80) reasons.push('Perfect time availability');
    if (shift.urgency === 'critical' && worker.performance.reliabilityScore >= 0.9) {
      reasons.push('Highly reliable for urgent shifts');
    }

    // Warnings
    if (scores.skillMatch < 60) warnings.push('May lack some required skills');
    if (scores.performanceScore < 60) warnings.push('Mixed performance history');
    if (scores.locationMatch < 40) warnings.push('Long commute distance');
    if (shift.compensation.hourlyRate < worker.preferences.minHourlyRate) {
      warnings.push('Below preferred pay rate');
    }
    if (worker.performance.noShowRate > 0.1) {
      warnings.push('History of occasional no-shows');
    }

    return { reasons, warnings };
  }

  /**
   * Main matching function
   */
  public async matchWorkerToShift(
    worker: WorkerProfile, 
    shift: ShiftRequirement
  ): Promise<MatchingResult> {
    // Calculate individual scores
    const skillMatch = this.calculateSkillMatch(worker, shift);
    const performanceScore = this.calculatePerformanceScore(worker);
    const availabilityMatch = this.calculateAvailabilityMatch(worker, shift);
    const locationMatch = this.calculateLocationMatch(worker, shift);
    const preferenceMatch = this.calculatePreferenceMatch(worker, shift);

    // Calculate weighted overall score
    const overallScore = 
      skillMatch * this.weights.skillMatch +
      performanceScore * this.weights.performanceScore +
      availabilityMatch * this.weights.availabilityMatch +
      locationMatch * this.weights.locationMatch +
      preferenceMatch * this.weights.preferenceMatch;

    // Generate insights
    const { reasons, warnings } = this.generateInsights(worker, shift, {
      skillMatch,
      performanceScore,
      availabilityMatch,
      locationMatch,
      preferenceMatch,
    });

    // Calculate confidence based on data completeness
    const confidence = this.calculateConfidence(worker, shift);

    return {
      workerId: worker.id,
      shiftId: shift.id,
      overallScore: Math.round(overallScore * 100) / 100, // Round to 2 decimal places
      breakdown: {
        skillMatch: Math.round(skillMatch * 100) / 100,
        availabilityMatch: Math.round(availabilityMatch * 100) / 100,
        locationMatch: Math.round(locationMatch * 100) / 100,
        performanceScore: Math.round(performanceScore * 100) / 100,
        preferenceMatch: Math.round(preferenceMatch * 100) / 100,
      },
      confidence,
      reasons,
      warnings,
    };
  }

  /**
   * Calculate confidence in the matching result
   */
  private calculateConfidence(worker: WorkerProfile, shift: ShiftRequirement): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence with more worker data
    if (worker.performance.completedShifts > 10) confidence += 0.2;
    if (worker.performance.completedShifts > 50) confidence += 0.1;

    // Increase confidence with detailed shift requirements
    if (shift.requiredSkills.length > 0) confidence += 0.1;
    if (shift.specialRequirements.length > 0) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  /**
   * Match multiple workers to a shift
   */
  public async matchWorkersToShift(
    workers: WorkerProfile[], 
    shift: ShiftRequirement
  ): Promise<MatchingResult[]> {
    const matches = await Promise.all(
      workers.map(worker => this.matchWorkerToShift(worker, shift))
    );

    // Sort by overall score (descending)
    return matches.sort((a, b) => b.overallScore - a.overallScore);
  }

  /**
   * Match a worker to multiple shifts
   */
  public async matchWorkerToShifts(
    worker: WorkerProfile, 
    shifts: ShiftRequirement[]
  ): Promise<MatchingResult[]> {
    const matches = await Promise.all(
      shifts.map(shift => this.matchWorkerToShift(worker, shift))
    );

    // Sort by overall score (descending)
    return matches.sort((a, b) => b.overallScore - a.overallScore);
  }
}
