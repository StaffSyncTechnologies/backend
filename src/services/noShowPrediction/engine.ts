import { WorkerHistory, ShiftContext, NoShowPrediction } from './types';

export class NoShowPredictionEngine {
  private weights = {
    historical: 0.40,    // 40% - Past behavior is strongest predictor
    environmental: 0.25, // 25% - Weather, traffic, events
    personal: 0.20,      // 20% - Personal circumstances
    shift: 0.15,         // 15% - Shift characteristics
  };

  /**
   * Predict no-show probability for a worker-shift combination
   */
  public async predictNoShow(
    worker: WorkerHistory, 
    shift: ShiftContext
  ): Promise<NoShowPrediction> {
    
    // Calculate individual risk factors
    const historicalRisk = this.calculateHistoricalRisk(worker, shift);
    const environmentalRisk = this.calculateEnvironmentalRisk(worker, shift);
    const personalRisk = this.calculatePersonalRisk(worker, shift);
    const shiftRisk = this.calculateShiftRisk(worker, shift);

    // Calculate weighted overall probability
    const noShowProbability = 
      historicalRisk * this.weights.historical +
      environmentalRisk * this.weights.environmental +
      personalRisk * this.weights.personal +
      shiftRisk * this.weights.shift;

    // Determine risk level
    const riskLevel = this.getRiskLevel(noShowProbability);

    // Calculate confidence based on data availability
    const confidence = this.calculateConfidence(worker, shift);

    // Identify key risk factors
    const keyRiskFactors = this.identifyKeyRiskFactors(
      worker, 
      shift, 
      { historicalRisk, environmentalRisk, personalRisk, shiftRisk }
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      riskLevel, 
      keyRiskFactors, 
      worker, 
      shift
    );

    // Suggest mitigation strategies
    const mitigationStrategies = this.getMitigationStrategies(riskLevel, keyRiskFactors) as Array<{
      strategy: string;
      effectiveness: number;
      cost: 'low' | 'medium' | 'high';
    }>;

    return {
      workerId: worker.workerId,
      shiftId: shift.id,
      noShowProbability: Math.round(noShowProbability * 1000) / 1000, // 3 decimal places
      riskLevel,
      confidence,
      factors: {
        historical: historicalRisk,
        environmental: environmentalRisk,
        personal: personalRisk,
        shift: shiftRisk,
      },
      keyRiskFactors,
      recommendations,
      mitigationStrategies,
    };
  }

  /**
   * Calculate historical risk based on past behavior
   */
  private calculateHistoricalRisk(worker: WorkerHistory, shift: ShiftContext): number {
    if (worker.totalShifts < 5) return 0.5; // Default for new workers

    // Base no-show rate
    const baseNoShowRate = worker.missedShifts / worker.totalShifts;

    // Recent performance (last 10 shifts)
    const recentShifts = worker.recentPerformance.slice(-10);
    const recentNoShows = recentShifts.filter(s => s.status === 'missed').length;
    const recentNoShowRate = recentNoShows / recentShifts.length;

    // Trend analysis
    const trend = this.analyzeTrend(recentShifts);
    const trendAdjustment = trend === 'improving' ? -0.1 : trend === 'declining' ? 0.1 : 0;

    // Seasonal adjustment
    const seasonalAdjustment = this.getSeasonalAdjustment(worker, shift.startTime);

    // Weight recent performance more heavily
    const weightedRisk = (baseNoShowRate * 0.3) + (recentNoShowRate * 0.7);

    return Math.max(0, Math.min(1, weightedRisk + trendAdjustment + seasonalAdjustment));
  }

  /**
   * Calculate environmental risk factors
   */
  private calculateEnvironmentalRisk(worker: WorkerHistory, shift: ShiftContext): number {
    let risk = 0;

    // Weather impact
    if (shift.environmental.weather) {
      const weather = shift.environmental.weather;
      
      // Bad weather increases risk
      if (weather.precipitation > 10) risk += 0.15; // Heavy rain
      if (weather.temperature < 0 || weather.temperature > 30) risk += 0.10; // Extreme temps
      if (weather.visibility < 5) risk += 0.20; // Poor visibility
      if (weather.windSpeed > 50) risk += 0.10; // Strong winds
    }

    // Local events impact
    shift.environmental.localEvents.forEach(event => {
      if (event.impact === 'high') risk += 0.20;
      else if (event.impact === 'medium') risk += 0.10;
      else if (event.impact === 'low') risk += 0.05;
    });

    // Transport issues
    shift.environmental.transportIssues.forEach(issue => {
      if (issue.severity === 'high') risk += 0.25;
      else if (issue.severity === 'medium') risk += 0.15;
      else if (issue.severity === 'low') risk += 0.08;
    });

    // Commute method vulnerability
    if (worker.personalFactors.commuteMethod === 'public_transport') {
      risk += 0.10; // More vulnerable to disruptions
    }

    return Math.min(1, risk);
  }

  /**
   * Calculate personal risk factors
   */
  private calculatePersonalRisk(worker: WorkerHistory, shift: ShiftContext): number {
    let risk = 0;

    // Age factor
    if (worker.personalFactors.age) {
      if (worker.personalFactors.age < 20) risk += 0.10; // Young workers less reliable
      if (worker.personalFactors.age > 60) risk += 0.15; // Health concerns
    }

    // Family responsibilities
    if (worker.personalFactors.familyResponsibilities) {
      risk += 0.08; // Potential family emergencies
    }

    // Health issues
    if (worker.personalFactors.healthIssues) {
      risk += 0.20; // Health-related absences
    }

    // Student status
    if (worker.personalFactors.student) {
      risk += 0.12; // Exam/study conflicts
    }

    // Commute time impact
    if (worker.personalFactors.averageCommuteTime > 90) {
      risk += 0.15; // Long commutes increase risk
    }

    // Recent performance pattern
    const recentShifts = worker.recentPerformance.slice(-5);
    const latePattern = recentShifts.filter(s => 
      s.status === 'late' || s.status === 'late_cancelled'
    ).length;

    if (latePattern >= 3) risk += 0.25; // Pattern of lateness

    return Math.min(1, risk);
  }

  /**
   * Calculate shift-specific risk factors
   */
  private calculateShiftRisk(worker: WorkerHistory, shift: ShiftContext): number {
    let risk = 0;

    // Time of day
    const shiftHour = new Date(shift.startTime).getHours();
    if (shiftHour >= 6 && shiftHour < 9) risk += 0.05; // Morning rush
    if (shiftHour >= 22 || shiftHour < 6) risk += 0.15; // Late night/overnight

    // Shift duration
    if (shift.duration > 10) risk += 0.10; // Long shifts

    // Urgency (paradoxically, urgent shifts might have higher no-show)
    if (shift.urgency === 'critical') risk += 0.12;
    if (shift.urgency === 'high') risk += 0.08;

    // Pay rate (lower pay = higher risk)
    const averagePay = worker.recentPerformance.reduce((sum: number, shift) => 
      sum + (shift.payRate || 0), 0) / worker.recentPerformance.length;
    
    if (shift.compensation.hourlyRate < averagePay * 0.9) {
      risk += 0.15; // Below average pay
    }

    // Weekend shifts
    const shiftDay = new Date(shift.startTime).getDay();
    if (shiftDay === 0 || shiftDay === 6) risk += 0.08; // Weekend

    return Math.min(1, risk);
  }

  /**
   * Analyze performance trend
   */
  private analyzeTrend(recentShifts: any[]): 'improving' | 'declining' | 'stable' {
    if (recentShifts.length < 3) return 'stable';

    const scores = recentShifts.map(shift => {
      if (shift.status === 'completed' && shift.arrivalTime) {
        const onTime = shift.arrivalTime <= shift.shiftStartTime;
        return onTime ? 1 : 0.5;
      } else if (shift.status === 'missed') {
        return 0;
      }
      return 0.5;
    });

    const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
    const secondHalf = scores.slice(Math.floor(scores.length / 2));

    const firstAvg = firstHalf.reduce((a: number, b: number) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a: number, b: number) => a + b, 0) / secondHalf.length;

    if (secondAvg > firstAvg + 0.1) return 'improving';
    if (secondAvg < firstAvg - 0.1) return 'declining';
    return 'stable';
  }

  /**
   * Get seasonal adjustment based on historical patterns
   */
  private getSeasonalAdjustment(worker: WorkerHistory, shiftDate: Date): number {
    const month = shiftDate.getMonth();
    const day = shiftDate.getDay();
    
    // Winter months (Dec-Feb)
    if (month === 11 || month === 0 || month === 1) {
      return worker.seasonalPatterns.winterNoShowRate - 0.1;
    }
    
    // Summer months (Jun-Aug)
    if (month >= 5 && month <= 7) {
      return worker.seasonalPatterns.summerNoShowRate - 0.1;
    }
    
    // Weekends
    if (day === 0 || day === 6) {
      return worker.seasonalPatterns.weekendNoShowRate - 0.1;
    }
    
    return 0;
  }

  /**
   * Determine risk level based on probability
   */
  private getRiskLevel(probability: number): 'low' | 'medium' | 'high' | 'critical' {
    if (probability < 0.1) return 'low';
    if (probability < 0.25) return 'medium';
    if (probability < 0.5) return 'high';
    return 'critical';
  }

  /**
   * Calculate confidence in prediction
   */
  private calculateConfidence(worker: WorkerHistory, shift: ShiftContext): number {
    let confidence = 0.3; // Base confidence

    // More historical data = higher confidence
    if (worker.totalShifts > 50) confidence += 0.3;
    else if (worker.totalShifts > 20) confidence += 0.2;
    else if (worker.totalShifts > 10) confidence += 0.1;

    // Recent data availability
    if (worker.recentPerformance.length > 10) confidence += 0.2;

    // Environmental data availability
    if (shift.environmental.weather) confidence += 0.1;

    return Math.min(1, confidence);
  }

  /**
   * Identify key risk factors
   */
  private identifyKeyRiskFactors(
    worker: WorkerHistory, 
    shift: ShiftContext, 
    risks: any
  ): Array<{factor: string, impact: number, description: string}> {
    const factors = [];

    // Historical factors
    if (risks.historicalRisk > 0.3) {
      factors.push({
        factor: 'historical',
        impact: risks.historicalRisk,
        description: worker.missedShifts > worker.totalShifts * 0.2 
          ? 'High historical no-show rate'
          : 'Recent attendance issues',
      });
    }

    // Environmental factors
    if (risks.environmentalRisk > 0.3) {
      factors.push({
        factor: 'environmental',
        impact: risks.environmentalRisk,
        description: 'Adverse weather or transport conditions',
      });
    }

    // Personal factors
    if (risks.personalRisk > 0.3) {
      factors.push({
        factor: 'personal',
        impact: risks.personalRisk,
        description: 'Personal circumstances may affect attendance',
      });
    }

    // Shift factors
    if (risks.shiftRisk > 0.3) {
      factors.push({
        factor: 'shift',
        impact: risks.shiftRisk,
        description: 'Shift characteristics increase risk',
      });
    }

    return factors.sort((a, b) => b.impact - a.impact);
  }

  /**
   * Generate recommendations based on risk level and factors
   */
  private generateRecommendations(
    riskLevel: string, 
    keyRiskFactors: any[], 
    worker: WorkerHistory, 
    shift: ShiftContext
  ): string[] {
    const recommendations = [];

    if (riskLevel === 'critical') {
      recommendations.push('Consider finding alternative worker');
      recommendations.push('Contact worker to confirm attendance');
      recommendations.push('Prepare backup coverage plan');
    } else if (riskLevel === 'high') {
      recommendations.push('Send reminder notification 24h before shift');
      recommendations.push('Consider offering bonus for confirmed attendance');
    } else if (riskLevel === 'medium') {
      recommendations.push('Send standard reminder 24h before shift');
    }

    // Factor-specific recommendations
    keyRiskFactors.forEach(factor => {
      if (factor.factor === 'environmental') {
        recommendations.push('Monitor weather and transport updates');
      } else if (factor.factor === 'personal') {
        recommendations.push('Check if worker needs any support');
      } else if (factor.factor === 'shift') {
        recommendations.push('Consider adjusting shift conditions if possible');
      }
    });

    return recommendations;
  }

  /**
   * Get mitigation strategies
   */
  private getMitigationStrategies(
    riskLevel: string, 
    keyRiskFactors: any[]
  ): Array<{strategy: string, effectiveness: number, cost: string}> {
    const strategies = [];

    if (riskLevel === 'critical' || riskLevel === 'high') {
      strategies.push({
        strategy: 'Offer attendance bonus',
        effectiveness: 0.7,
        cost: 'medium',
      });
      
      strategies.push({
        strategy: 'Double-book with backup worker',
        effectiveness: 0.9,
        cost: 'high',
      });
    }

    if (keyRiskFactors.some(f => f.factor === 'environmental')) {
      strategies.push({
        strategy: 'Provide transport assistance',
        effectiveness: 0.6,
        cost: 'medium',
      });
    }

    strategies.push({
      strategy: 'Send multiple reminders',
      effectiveness: 0.4,
      cost: 'low',
    });

    strategies.push({
      strategy: 'Personal check-in call',
      effectiveness: 0.5,
      cost: 'low',
    });

    return strategies;
  }

  /**
   * Batch predict for multiple workers
   */
  public async batchPredict(
    workers: WorkerHistory[], 
    shift: ShiftContext
  ): Promise<NoShowPrediction[]> {
    const predictions = await Promise.all(
      workers.map(worker => this.predictNoShow(worker, shift))
    );

    // Sort by risk level (highest risk first)
    return predictions.sort((a, b) => b.noShowProbability - a.noShowProbability);
  }

  /**
   * Get overall shift risk assessment
   */
  public async assessShiftRisk(
    workers: WorkerHistory[], 
    shift: ShiftContext
  ): Promise<{
    overallRisk: number;
    highRiskWorkers: number;
    criticalRiskWorkers: number;
    recommendedActions: string[];
  }> {
    const predictions = await this.batchPredict(workers, shift);
    
    const overallRisk = predictions.reduce((sum: number, p) => sum + p.noShowProbability, 0) / predictions.length;
    
    const highRiskWorkers = predictions.filter(p => p.riskLevel === 'high').length;
    const criticalRiskWorkers = predictions.filter(p => p.riskLevel === 'critical').length;
    
    const recommendedActions = [];
    if (criticalRiskWorkers > 0) {
      recommendedActions.push('Immediate action needed for critical risk workers');
    }
    if (highRiskWorkers > predictions.length * 0.3) {
      recommendedActions.push('Consider finding alternative workers');
    }
    if (overallRisk > 0.3) {
      recommendedActions.push('Increase backup coverage for this shift');
    }

    return {
      overallRisk,
      highRiskWorkers,
      criticalRiskWorkers,
      recommendedActions,
    };
  }
}
