/**
 * Player Trust Calibration System
 * Tracks compliance and adapts messaging based on player behavior
 */

import { CoachingAdvice } from '../types/coaching';
import { ProcessedGameState } from '../types/gameState';
import { logger } from '../utils/logger';

export type ComplianceState = 
  | 'full_compliance' 
  | 'partial_compliance' 
  | 'ambiguous_compliance' 
  | 'no_compliance'
  | 'delayed_compliance';

export interface ComplianceRecord {
  adviceId: string;
  advice: CoachingAdvice;
  timestamp: number;
  gameTime: number;
  followed: boolean;
  complianceState: ComplianceState; // More granular than binary
  outcome: 'positive' | 'negative' | 'neutral' | 'unknown';
  timeToComply?: number; // Seconds between advice and action (if followed)
  certainty: number; // 0-1: How certain we are about compliance
}

export interface TrustMetrics {
  complianceRate: number; // 0-1: How often advice is followed
  positiveOutcomeRate: number; // 0-1: How often following advice leads to positive outcomes
  averageResponseTime: number; // Average time to comply (seconds)
  verbosityLevel: 'high' | 'medium' | 'low'; // Current messaging verbosity
  explanationLevel: 'detailed' | 'standard' | 'minimal'; // Current explanation depth
}

export class PlayerTrustCalibrator {
  private complianceHistory: ComplianceRecord[] = [];
  private readonly MAX_HISTORY = 100; // Keep last 100 records
  private currentTrustMetrics: TrustMetrics;
  private adviceTracking: Map<string, CoachingAdvice> = new Map();

  constructor() {
    this.currentTrustMetrics = {
      complianceRate: 0.5, // Start neutral
      positiveOutcomeRate: 0.5,
      averageResponseTime: 0,
      verbosityLevel: 'medium',
      explanationLevel: 'standard'
    };
  }

  /**
   * Register advice given to player
   */
  public registerAdvice(advice: CoachingAdvice, gameState: ProcessedGameState): string {
    const adviceId = `${advice.gameTime}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.adviceTracking.set(adviceId, advice);
    return adviceId;
  }

  /**
   * Check if advice was followed by analyzing subsequent game state
   */
  public checkCompliance(
    adviceId: string,
    currentGameState: ProcessedGameState,
    previousGameState: ProcessedGameState
  ): void {
    const advice = this.adviceTracking.get(adviceId);
    if (!advice) return;

    const complianceResult = this.detectCompliance(advice, currentGameState, previousGameState);
    const outcome = this.assessOutcome(advice, currentGameState, previousGameState);
    const timeToComply = complianceResult.state !== 'no_compliance' 
      ? this.calculateResponseTime(advice, currentGameState) 
      : undefined;

    const record: ComplianceRecord = {
      adviceId,
      advice,
      timestamp: Date.now(),
      gameTime: currentGameState.gameTime,
      followed: complianceResult.state !== 'no_compliance',
      complianceState: complianceResult.state,
      outcome,
      timeToComply,
      certainty: complianceResult.certainty
    };

    this.complianceHistory.push(record);
    if (this.complianceHistory.length > this.MAX_HISTORY) {
      this.complianceHistory.shift();
    }

    // Update trust metrics (only if we have enough certainty)
    if (this.shouldUpdateTrust()) {
      this.updateTrustMetrics();
    }

    logger.debug(`Compliance check: ${complianceResult.state} (certainty: ${(complianceResult.certainty * 100).toFixed(0)}%), outcome: ${outcome}`);
  }

  private detectCompliance(advice: CoachingAdvice, current: ProcessedGameState, previous: ProcessedGameState): {
    state: ComplianceState;
    certainty: number;
  } {
    // More granular compliance detection with certainty scoring

    switch (advice.action) {
      case 'push':
        return this.detectPushCompliance(advice, current, previous);

      case 'retreat':
      case 'back':
        return this.detectRetreatCompliance(advice, current, previous);

      case 'farm':
        return this.detectFarmCompliance(advice, current, previous);

      case 'group':
        return this.detectGroupCompliance(advice, current, previous);

      case 'end_game':
        return this.detectEndGameCompliance(advice, current, previous);

      default:
        return { state: 'ambiguous_compliance', certainty: 0.3 };
    }
  }

  private detectPushCompliance(advice: CoachingAdvice, current: ProcessedGameState, previous: ProcessedGameState): {
    state: ComplianceState;
    certainty: number;
  } {
    const buildingsBefore = this.countBuildings(previous);
    const buildingsAfter = this.countBuildings(current);
    const buildingsLost = buildingsBefore - buildingsAfter;

    if (buildingsLost > 0) {
      // Objective taken - high certainty of compliance
      return { state: 'full_compliance', certainty: 0.9 };
    }

    // Check for partial compliance (damage dealt but not destroyed)
    const enemyBuildings = current.buildings[current.player.team === 'radiant' ? 'dire' : 'radiant'];
    const lowHealthBuildings = [
      ...(enemyBuildings.t1 || []),
      ...(enemyBuildings.t2 || []),
      ...(enemyBuildings.t3 || [])
    ].filter(b => !b.destroyed && b.healthPercent < 50);

    if (lowHealthBuildings.length > 0) {
      // Partial compliance - building damaged but not destroyed
      return { state: 'partial_compliance', certainty: 0.6 };
    }

    return { state: 'no_compliance', certainty: 0.7 };
  }

  private detectRetreatCompliance(advice: CoachingAdvice, current: ProcessedGameState, previous: ProcessedGameState): {
    state: ComplianceState;
    certainty: number;
  } {
    const healthIncrease = current.hero.healthPercent - previous.hero.healthPercent;
    const avoidedDeath = previous.hero.healthPercent < 30 && current.hero.healthPercent > previous.hero.healthPercent;

    if (healthIncrease > 15 || avoidedDeath) {
      // Significant health recovery - likely followed advice
      return { state: 'full_compliance', certainty: 0.8 };
    } else if (healthIncrease > 5) {
      // Some health recovery - partial compliance
      return { state: 'partial_compliance', certainty: 0.5 };
    } else if (current.player.deaths === previous.player.deaths) {
      // Didn't die - ambiguous (could be luck or compliance)
      return { state: 'ambiguous_compliance', certainty: 0.4 };
    }

    return { state: 'no_compliance', certainty: 0.6 };
  }

  private detectFarmCompliance(advice: CoachingAdvice, current: ProcessedGameState, previous: ProcessedGameState): {
    state: ComplianceState;
    certainty: number;
  } {
    const csIncrease = current.player.lastHits - previous.player.lastHits;
    const timeDelta = current.gameTime - previous.gameTime;

    // Normalize by time (CS per second)
    const csPerSecond = timeDelta > 0 ? csIncrease / timeDelta : 0;

    if (csPerSecond > 0.5) {
      // Good farming rate - likely following advice
      return { state: 'full_compliance', certainty: 0.7 };
    } else if (csPerSecond > 0.2) {
      // Some farming - partial compliance
      return { state: 'partial_compliance', certainty: 0.5 };
    }

    return { state: 'no_compliance', certainty: 0.6 };
  }

  private detectGroupCompliance(advice: CoachingAdvice, current: ProcessedGameState, previous: ProcessedGameState): {
    state: ComplianceState;
    certainty: number;
  } {
    // Hard to detect without position tracking
    // Return ambiguous for now
    return { state: 'ambiguous_compliance', certainty: 0.3 };
  }

  private detectEndGameCompliance(advice: CoachingAdvice, current: ProcessedGameState, previous: ProcessedGameState): {
    state: ComplianceState;
    certainty: number;
  } {
    const ancientBefore = this.getAncientHealth(previous);
    const ancientAfter = this.getAncientHealth(current);
    const ancientDamage = ancientBefore - ancientAfter;

    if (ancientAfter === 0) {
      // Ancient destroyed - full compliance
      return { state: 'full_compliance', certainty: 1.0 };
    } else if (ancientDamage > 0) {
      // Ancient damaged - partial compliance
      return { state: 'partial_compliance', certainty: 0.7 };
    }

    return { state: 'no_compliance', certainty: 0.6 };
  }

  private assessOutcome(
    advice: CoachingAdvice,
    current: ProcessedGameState,
    previous: ProcessedGameState
  ): 'positive' | 'negative' | 'neutral' | 'unknown' {
    // Assess if following advice led to positive outcome
    // Simplified assessment - full implementation would be more sophisticated

    if (advice.action === 'push' || advice.action === 'end_game') {
      // Positive if objectives taken without major losses
      const buildingsBefore = this.countBuildings(previous);
      const buildingsAfter = this.countBuildings(current);
      const objectivesGained = buildingsBefore - buildingsAfter;
      
      if (objectivesGained > 0 && current.player.deaths === previous.player.deaths) {
        return 'positive';
      } else if (objectivesGained > 0 && current.player.deaths > previous.player.deaths) {
        return 'neutral'; // Got objective but died
      }
    }

    if (advice.action === 'retreat' || advice.action === 'back') {
      // Positive if avoided death
      if (current.player.deaths === previous.player.deaths) {
        return 'positive';
      }
    }

    return 'unknown';
  }

  private calculateResponseTime(advice: CoachingAdvice, currentGameState: ProcessedGameState): number {
    return currentGameState.gameTime - advice.gameTime;
  }

  private countBuildings(gameState: ProcessedGameState): number {
    const enemyBuildings = gameState.buildings[gameState.player.team === 'radiant' ? 'dire' : 'radiant'];
    let count = 0;
    if (enemyBuildings.ancient && !enemyBuildings.ancient.destroyed) count++;
    if (enemyBuildings.t4) count += enemyBuildings.t4.filter(b => !b.destroyed).length;
    if (enemyBuildings.t3) count += enemyBuildings.t3.filter(b => !b.destroyed).length;
    if (enemyBuildings.t2) count += enemyBuildings.t2.filter(b => !b.destroyed).length;
    if (enemyBuildings.t1) count += enemyBuildings.t1.filter(b => !b.destroyed).length;
    return count;
  }

  private getAncientHealth(gameState: ProcessedGameState): number {
    const enemyBuildings = gameState.buildings[gameState.player.team === 'radiant' ? 'dire' : 'radiant'];
    return enemyBuildings.ancient?.health || 0;
  }

  /**
   * Check if we should update trust metrics (noise filtering)
   */
  private shouldUpdateTrust(): boolean {
    // Require minimum history before updating
    if (this.complianceHistory.length < 10) return false;

    // Check for consistent patterns (not just noise)
    const recent = this.complianceHistory.slice(-10);
    const complianceValues: number[] = recent.map(r => r.followed ? 1 : 0);
    const mean = complianceValues.reduce((a, b) => a + b, 0) / complianceValues.length;
    const variance = complianceValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / complianceValues.length;

    // Only update if pattern is consistent (low variance) or we have high certainty
    const avgCertainty = recent.reduce((sum, r) => sum + r.certainty, 0) / recent.length;
    return variance < 0.3 || avgCertainty > 0.7;
  }

  private updateTrustMetrics(): void {
    if (this.complianceHistory.length === 0) return;

    // Weight updates by compliance certainty (conservative updates)
    const weightedCompliance = this.complianceHistory.map(record => {
      const weight = this.getWeightForCertainty(record.certainty, record.complianceState);
      return { record, weight };
    });

    // Calculate weighted compliance rate
    const totalWeight = weightedCompliance.reduce((sum, w) => sum + w.weight, 0);
    if (totalWeight === 0) return;

    const complianceWeight = weightedCompliance
      .filter(w => w.record.followed)
      .reduce((sum, w) => sum + w.weight, 0);

    this.currentTrustMetrics.complianceRate = complianceWeight / totalWeight;

    // Calculate positive outcome rate (for followed advice, weighted)
    const followedAdvice = weightedCompliance.filter(w => w.record.followed);
    if (followedAdvice.length > 0) {
      const positiveWeight = followedAdvice
        .filter(w => w.record.outcome === 'positive')
        .reduce((sum, w) => sum + w.weight, 0);
      const totalFollowedWeight = followedAdvice.reduce((sum, w) => sum + w.weight, 0);
      this.currentTrustMetrics.positiveOutcomeRate = totalFollowedWeight > 0
        ? positiveWeight / totalFollowedWeight
        : 0.5;
    }

    // Calculate average response time (weighted by certainty)
    const responseTimes = this.complianceHistory
      .filter(r => r.timeToComply !== undefined)
      .map(r => ({ time: r.timeToComply!, weight: r.certainty }));
    if (responseTimes.length > 0) {
      const totalTimeWeight = responseTimes.reduce((sum, r) => sum + r.weight, 0);
      const weightedTime = responseTimes.reduce((sum, r) => sum + (r.time * r.weight), 0);
      this.currentTrustMetrics.averageResponseTime = totalTimeWeight > 0
        ? weightedTime / totalTimeWeight
        : 0;
    }

    // Adjust verbosity and explanation based on weighted compliance
    // Use more conservative thresholds to prevent over-silencing
    if (this.currentTrustMetrics.complianceRate > 0.75) {
      // High compliance - reduce verbosity (but not completely)
      this.currentTrustMetrics.verbosityLevel = 'low';
      this.currentTrustMetrics.explanationLevel = 'minimal';
    } else if (this.currentTrustMetrics.complianceRate < 0.25) {
      // Low compliance - increase verbosity and explanation
      this.currentTrustMetrics.verbosityLevel = 'high';
      this.currentTrustMetrics.explanationLevel = 'detailed';
    } else {
      // Medium compliance - standard
      this.currentTrustMetrics.verbosityLevel = 'medium';
      this.currentTrustMetrics.explanationLevel = 'standard';
    }
  }

  /**
   * Get weight for trust update based on certainty and compliance state
   */
  private getWeightForCertainty(certainty: number, state: ComplianceState): number {
    // Base weight from certainty
    let weight = certainty;

    // Adjust based on compliance state
    switch (state) {
      case 'full_compliance':
        weight *= 1.0; // Full weight
        break;
      case 'partial_compliance':
        weight *= 0.5; // Reduced weight
        break;
      case 'ambiguous_compliance':
        weight *= 0.2; // Minimal weight
        break;
      case 'no_compliance':
        weight *= 1.0; // Full negative weight
        break;
      case 'delayed_compliance':
        weight *= 0.7; // Slightly reduced (delayed)
        break;
    }

    return Math.max(0, Math.min(1, weight));
  }

  /**
   * Get current trust metrics
   */
  public getTrustMetrics(): TrustMetrics {
    return { ...this.currentTrustMetrics };
  }

  /**
   * Check if we should reduce verbosity
   */
  public shouldReduceVerbosity(): boolean {
    return this.currentTrustMetrics.verbosityLevel === 'low';
  }

  /**
   * Check if we should increase explanation
   */
  public shouldIncreaseExplanation(): boolean {
    return this.currentTrustMetrics.explanationLevel === 'detailed';
  }

  /**
   * Clear history (for new game)
   */
  public clear(): void {
    this.complianceHistory = [];
    this.adviceTracking.clear();
    this.currentTrustMetrics = {
      complianceRate: 0.5,
      positiveOutcomeRate: 0.5,
      averageResponseTime: 0,
      verbosityLevel: 'medium',
      explanationLevel: 'standard'
    };
  }
}

export const playerTrustCalibrator = new PlayerTrustCalibrator();

