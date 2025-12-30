/**
 * Calculates confidence scores for coaching advice
 * Based on data completeness, vision certainty, and timing precision
 */

import { ProcessedGameState } from '../types/gameState';
import { logger } from '../utils/logger';

export interface ConfidenceFactors {
  dataCompleteness: number; // 0-1: How complete is our game state data?
  visionCertainty: number; // 0-1: How certain are we about enemy positions/status?
  timingPrecision: number; // 0-1: How precise is the timing window?
  netWorthReliability: number; // 0-1: How reliable is net worth data?
}

export class ConfidenceCalculator {
  /**
   * Calculate overall confidence score for advice
   */
  public calculateConfidence(
    gameState: ProcessedGameState,
    adviceType: string,
    timingWindow?: number
  ): { score: number; factors: ConfidenceFactors; reasons: string[] } {
    const factors: ConfidenceFactors = {
      dataCompleteness: this.calculateDataCompleteness(gameState),
      visionCertainty: this.calculateVisionCertainty(gameState),
      timingPrecision: this.calculateTimingPrecision(timingWindow, adviceType),
      netWorthReliability: this.calculateNetWorthReliability(gameState)
    };

    const reasons: string[] = [];

    // Weighted average (timing precision is most important for push windows)
    let weights: Record<keyof ConfidenceFactors, number>;
    if (adviceType.includes('push') || adviceType.includes('window')) {
      weights = {
        dataCompleteness: 0.2,
        visionCertainty: 0.3,
        timingPrecision: 0.4,
        netWorthReliability: 0.1
      };
    } else {
      weights = {
        dataCompleteness: 0.3,
        visionCertainty: 0.3,
        timingPrecision: 0.2,
        netWorthReliability: 0.2
      };
    }

    const score = 
      factors.dataCompleteness * weights.dataCompleteness +
      factors.visionCertainty * weights.visionCertainty +
      factors.timingPrecision * weights.timingPrecision +
      factors.netWorthReliability * weights.netWorthReliability;

    // Generate reasons
    if (factors.dataCompleteness < 0.7) {
      reasons.push('Limited game state data');
    }
    if (factors.visionCertainty < 0.6) {
      reasons.push('Uncertain enemy positions');
    }
    if (factors.timingPrecision < 0.7 && adviceType.includes('timing')) {
      reasons.push('Timing window unclear');
    }
    if (factors.netWorthReliability < 0.7) {
      reasons.push('Net worth data incomplete');
    }

    if (reasons.length === 0) {
      reasons.push('High confidence - all data reliable');
    }

    return { score, factors, reasons };
  }

  private calculateDataCompleteness(gameState: ProcessedGameState): number {
    let completeness = 1.0;
    let checks = 0;

    // Check essential data
    if (!gameState.player || !gameState.hero) {
      completeness -= 0.3;
    }
    checks++;

    if (!gameState.buildings || !gameState.buildings.radiant || !gameState.buildings.dire) {
      completeness -= 0.2;
    }
    checks++;

    if (!gameState.items || gameState.items.allItems.length === 0) {
      completeness -= 0.1;
    }
    checks++;

    if (!gameState.abilities || Object.keys(gameState.abilities).length === 0) {
      completeness -= 0.1;
    }
    checks++;

    // Check team data completeness
    const teamDataCompleteness = gameState.team.players.length / 5; // Assuming 5 players
    completeness = (completeness + teamDataCompleteness) / 2;

    return Math.max(0, Math.min(1, completeness));
  }

  private calculateVisionCertainty(gameState: ProcessedGameState): number {
    // Count visible enemies
    const visibleEnemies = gameState.enemies.filter(e => e.visible).length;
    const totalEnemies = gameState.enemies.length || 5; // Fallback to 5

    // Base certainty on how many enemies we can see
    let certainty = visibleEnemies / totalEnemies;

    // Boost certainty if we have position data for enemies
    const enemiesWithPosition = gameState.enemies.filter(e => e.position).length;
    if (enemiesWithPosition > 0) {
      certainty = Math.min(1, certainty + 0.2);
    }

    // Reduce certainty if many enemies are missing
    const missingEnemies = totalEnemies - visibleEnemies;
    if (missingEnemies >= 3) {
      certainty *= 0.7; // Significant uncertainty
    }

    return Math.max(0, Math.min(1, certainty));
  }

  private calculateTimingPrecision(timingWindow?: number, adviceType?: string): number {
    if (!timingWindow) {
      // No specific timing window - lower precision
      return 0.5;
    }

    // Smaller windows = higher precision
    if (timingWindow < 30) {
      return 0.9; // Very precise (under 30 seconds)
    } else if (timingWindow < 60) {
      return 0.8; // Precise (under 1 minute)
    } else if (timingWindow < 120) {
      return 0.6; // Moderate (1-2 minutes)
    } else {
      return 0.4; // Low precision (over 2 minutes)
    }
  }

  private calculateNetWorthReliability(gameState: ProcessedGameState): number {
    // Check if we have net worth data for team and enemies
    const teamNetWorth = gameState.team.netWorth;
    const enemyNetWorth = gameState.enemies.reduce((sum, e) => sum + e.netWorth, 0);

    // If we have data for both, reliability is high
    if (teamNetWorth > 0 && enemyNetWorth > 0) {
      // Check if enemy data seems complete (at least 3 enemies with net worth)
      const enemiesWithNetWorth = gameState.enemies.filter(e => e.netWorth > 0).length;
      const enemyDataCompleteness = enemiesWithNetWorth / Math.max(gameState.enemies.length, 1);
      
      return 0.5 + (enemyDataCompleteness * 0.5); // 0.5-1.0 range
    }

    // If we only have team data, moderate reliability
    if (teamNetWorth > 0) {
      return 0.6;
    }

    // No net worth data
    return 0.3;
  }

  /**
   * Determine if advice should be suppressed based on confidence
   */
  public shouldSuppressAdvice(confidence: number, priority: string): boolean {
    // Never suppress game-ending or critical advice
    if (priority === 'GAME_ENDING' || priority === 'CRITICAL') {
      return false;
    }

    // Suppress low-confidence advice (below 0.5)
    if (confidence < 0.5) {
      return true;
    }

    // Suppress medium-confidence low-priority advice
    if (confidence < 0.7 && priority === 'LOW') {
      return true;
    }

    return false;
  }

  /**
   * Soften language based on confidence
   */
  public softenLanguage(message: string, confidence: number): string {
    if (confidence >= 0.8) {
      // High confidence - keep strong language
      return message;
    } else if (confidence >= 0.6) {
      // Medium confidence - soften slightly
      return message
        .replace(/NOW/g, 'likely now')
        .replace(/MUST/g, 'should')
        .replace(/CRITICAL/g, 'important');
    } else {
      // Low confidence - soften significantly
      return message
        .replace(/NOW/g, 'consider')
        .replace(/MUST/g, 'might want to')
        .replace(/CRITICAL/g, 'worth considering')
        .replace(/PUSH NOW/g, 'push opportunity')
        .replace(/END NOW/g, 'ending opportunity');
    }
  }
}

export const confidenceCalculator = new ConfidenceCalculator();

