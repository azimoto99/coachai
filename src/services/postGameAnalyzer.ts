/**
 * Post-game analysis system
 * Tracks missed opportunities and decisive moments
 */

import { ProcessedGameState } from '../types/gameState';
import { CoachingAdvice } from '../types/coaching';
import { logger } from '../utils/logger';

export interface GameEvent {
  type: 'push_window' | 'back_opportunity' | 'decisive_moment' | 'throw_warning' | 'objective_taken';
  timestamp: number;
  gameTime: number;
  description: string;
  severity: 'high' | 'medium' | 'low';
  adviceGiven?: string;
  outcome?: 'taken' | 'missed' | 'unknown';
  confidence?: number; // Confidence at time of event (0-1)
  netWorthContext?: {
    delta: number;
    deltaPercent: number;
  }; // Net worth context at time of event
  weight?: number; // Confidence-weighted importance (0-1)
}

export interface PostGameSummary {
  gameDuration: number;
  events: GameEvent[];
  missedPushWindows: GameEvent[];
  missedBackOpportunities: GameEvent[];
  decisiveMoments: GameEvent[];
  recommendations: string[];
  confidenceWeightedAnalysis: {
    highConfidenceMissed: number;
    lowConfidenceMissed: number;
    highConfidenceTaken: number;
    averageConfidence: number;
  };
}

export class PostGameAnalyzer {
  private events: GameEvent[] = [];
  private adviceHistory: CoachingAdvice[] = [];
  private gameStartTime: number = 0;
  private gameEndTime: number = 0;
  private isGameActive: boolean = false;

  /**
   * Record a game event
   */
  public recordEvent(event: GameEvent): void {
    this.events.push(event);
    logger.debug(`Game event recorded: ${event.type} at ${event.gameTime}s`);
  }

  /**
   * Record coaching advice given
   */
  public recordAdvice(advice: CoachingAdvice): void {
    this.adviceHistory.push(advice);
  }

  /**
   * Track push window opportunity
   */
  public trackPushWindow(
    gameState: ProcessedGameState,
    windowType: string,
    advice: CoachingAdvice | null,
    netWorthContext?: { delta: number; deltaPercent: number }
  ): void {
    const confidence = advice?.confidence || 0.5;
    const weight = this.calculateEventWeight(confidence, netWorthContext);

    const event: GameEvent = {
      type: 'push_window',
      timestamp: Date.now(),
      gameTime: gameState.gameTime,
      description: `Push window: ${windowType}`,
      severity: advice?.priority === 'GAME_ENDING' ? 'high' : 'medium',
      adviceGiven: advice?.message,
      outcome: advice ? 'taken' : 'missed',
      confidence,
      netWorthContext,
      weight
    };

    this.recordEvent(event);
  }

  /**
   * Track back opportunity
   */
  public trackBackOpportunity(
    gameState: ProcessedGameState,
    reason: string,
    advice: CoachingAdvice | null,
    netWorthContext?: { delta: number; deltaPercent: number }
  ): void {
    const confidence = advice?.confidence || 0.5;
    const weight = this.calculateEventWeight(confidence, netWorthContext);

    const event: GameEvent = {
      type: 'back_opportunity',
      timestamp: Date.now(),
      gameTime: gameState.gameTime,
      description: `Back opportunity: ${reason}`,
      severity: 'medium',
      adviceGiven: advice?.message,
      outcome: advice ? 'taken' : 'missed',
      confidence,
      netWorthContext,
      weight
    };

    this.recordEvent(event);
  }

  /**
   * Track decisive moment
   */
  public trackDecisiveMoment(
    gameState: ProcessedGameState,
    description: string,
    impact: 'high' | 'medium' | 'low'
  ): void {
    const event: GameEvent = {
      type: 'decisive_moment',
      timestamp: Date.now(),
      gameTime: gameState.gameTime,
      description,
      severity: impact,
      outcome: 'unknown'
    };

    this.recordEvent(event);
  }

  /**
   * Start tracking a new game
   */
  public startGame(): void {
    this.events = [];
    this.adviceHistory = [];
    this.gameStartTime = Date.now();
    this.isGameActive = true;
    logger.info('Post-game analyzer: Game started');
  }

  /**
   * Calculate confidence-weighted importance for an event
   */
  private calculateEventWeight(
    confidence: number,
    netWorthContext?: { delta: number; deltaPercent: number }
  ): number {
    let weight = confidence;

    // Boost weight if net worth context suggests high importance
    if (netWorthContext) {
      const absDeltaPercent = Math.abs(netWorthContext.deltaPercent);
      if (absDeltaPercent > 20) {
        // Large net worth delta = more important
        weight = Math.min(1, weight + 0.2);
      } else if (absDeltaPercent > 10) {
        weight = Math.min(1, weight + 0.1);
      }
    }

    return weight;
  }

  /**
   * End game and generate summary
   */
  public endGame(finalGameTime: number): PostGameSummary {
    this.gameEndTime = Date.now();
    this.isGameActive = false;
    const gameDuration = finalGameTime;

    const missedPushWindows = this.events.filter(e => 
      e.type === 'push_window' && e.outcome === 'missed'
    );
    const missedBackOpportunities = this.events.filter(e => 
      e.type === 'back_opportunity' && e.outcome === 'missed'
    );
    const decisiveMoments = this.events.filter(e => 
      e.type === 'decisive_moment'
    );

    // Calculate confidence-weighted analysis
    const allMissed = [...missedPushWindows, ...missedBackOpportunities];
    const highConfidenceMissed = allMissed.filter(e => (e.confidence || 0) >= 0.7).length;
    const lowConfidenceMissed = allMissed.filter(e => (e.confidence || 0) < 0.5).length;
    const highConfidenceTaken = this.events
      .filter(e => e.outcome === 'taken' && (e.confidence || 0) >= 0.7).length;
    
    const allConfidences = this.events
      .map(e => e.confidence || 0)
      .filter(c => c > 0);
    const averageConfidence = allConfidences.length > 0
      ? allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length
      : 0;

    const summary: PostGameSummary = {
      gameDuration,
      events: this.events,
      missedPushWindows,
      missedBackOpportunities,
      decisiveMoments,
      recommendations: this.generateRecommendations(highConfidenceMissed, lowConfidenceMissed),
      confidenceWeightedAnalysis: {
        highConfidenceMissed,
        lowConfidenceMissed,
        highConfidenceTaken,
        averageConfidence
      }
    };

    logger.info('Post-game summary generated', {
      duration: gameDuration,
      totalEvents: this.events.length,
      missedWindows: missedPushWindows.length,
      highConfidenceMissed,
      lowConfidenceMissed
    });

    return summary;
  }

  private generateRecommendations(
    highConfidenceMissed: number,
    lowConfidenceMissed: number
  ): string[] {
    const recommendations: string[] = [];

    // Confidence-weighted recommendations
    if (highConfidenceMissed > 0) {
      recommendations.push(
        `You missed ${highConfidenceMissed} high-confidence game-ending window(s) - These were critical opportunities`
      );
    }

    if (lowConfidenceMissed > 0 && highConfidenceMissed === 0) {
      recommendations.push(
        `You missed ${lowConfidenceMissed} low-certainty suggestion(s) - These were less critical`
      );
    }

    // Analyze missed push windows (weighted)
    const missedWindows = this.events.filter(e => 
      e.type === 'push_window' && e.outcome === 'missed'
    );
    const highWeightWindows = missedWindows.filter(e => (e.weight || 0) >= 0.7);
    if (highWeightWindows.length > 0) {
      recommendations.push(
        `${highWeightWindows.length} high-importance push window(s) missed - Review these carefully`
      );
    }

    // Analyze missed back opportunities
    const missedBacks = this.events.filter(e => 
      e.type === 'back_opportunity' && e.outcome === 'missed'
    );
    if (missedBacks.length > 0) {
      recommendations.push(
        `Missed ${missedBacks.length} back opportunity(ies) - Improve risk assessment`
      );
    }

    // Analyze decisive moments
    const highImpactMoments = this.events.filter(e => 
      e.type === 'decisive_moment' && e.severity === 'high'
    );
    if (highImpactMoments.length > 0) {
      recommendations.push(
        `${highImpactMoments.length} decisive moment(s) identified - Review these key plays`
      );
    }

    // Overall advice frequency
    const criticalAdvice = this.adviceHistory.filter(a => 
      a.priority === 'CRITICAL' || a.priority === 'GAME_ENDING'
    );
    if (criticalAdvice.length > 5) {
      recommendations.push(
        'Many critical situations occurred - Focus on preventing mistakes earlier'
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('Good decision making overall - Keep up the solid play');
    }

    return recommendations;
  }

  /**
   * Generate formatted summary text
   */
  public formatSummary(summary: PostGameSummary): string {
    const lines: string[] = [];
    
    lines.push('=== POST-GAME ANALYSIS ===');
    lines.push(`Game Duration: ${Math.floor(summary.gameDuration / 60)}:${String(Math.floor(summary.gameDuration % 60)).padStart(2, '0')}`);
    lines.push('');

    if (summary.missedPushWindows.length > 0) {
      lines.push('MISSED PUSH WINDOWS:');
      // Sort by weight (importance)
      const sortedWindows = [...summary.missedPushWindows].sort((a, b) => 
        (b.weight || 0) - (a.weight || 0)
      );
      sortedWindows.forEach(event => {
        const confidence = event.confidence ? ` [Confidence: ${(event.confidence * 100).toFixed(0)}%]` : '';
        const weight = event.weight ? ` [Weight: ${(event.weight * 100).toFixed(0)}%]` : '';
        lines.push(`  - ${Math.floor(event.gameTime / 60)}:${String(Math.floor(event.gameTime % 60)).padStart(2, '0')} - ${event.description}${confidence}${weight}`);
        if (event.adviceGiven) {
          lines.push(`    Advice: ${event.adviceGiven}`);
        }
      });
      lines.push('');
    }

    if (summary.missedBackOpportunities.length > 0) {
      lines.push('MISSED BACK OPPORTUNITIES:');
      summary.missedBackOpportunities.forEach(event => {
        lines.push(`  - ${Math.floor(event.gameTime / 60)}:${String(Math.floor(event.gameTime % 60)).padStart(2, '0')} - ${event.description}`);
      });
      lines.push('');
    }

    if (summary.decisiveMoments.length > 0) {
      lines.push('DECISIVE MOMENTS:');
      summary.decisiveMoments.forEach(event => {
        lines.push(`  - ${Math.floor(event.gameTime / 60)}:${String(Math.floor(event.gameTime % 60)).padStart(2, '0')} - ${event.description} (${event.severity} impact)`);
      });
      lines.push('');
    }

    lines.push('RECOMMENDATIONS:');
    summary.recommendations.forEach(rec => {
      lines.push(`  - ${rec}`);
    });
    lines.push('');

    // Add confidence-weighted summary
    lines.push('CONFIDENCE-WEIGHTED ANALYSIS:');
    lines.push(`  High-confidence missed: ${summary.confidenceWeightedAnalysis.highConfidenceMissed}`);
    lines.push(`  Low-confidence missed: ${summary.confidenceWeightedAnalysis.lowConfidenceMissed}`);
    lines.push(`  High-confidence taken: ${summary.confidenceWeightedAnalysis.highConfidenceTaken}`);
    lines.push(`  Average confidence: ${(summary.confidenceWeightedAnalysis.averageConfidence * 100).toFixed(1)}%`);

    return lines.join('\n');
  }

  /**
   * Check if game is active
   */
  public isActive(): boolean {
    return this.isGameActive;
  }
}

export const postGameAnalyzer = new PostGameAnalyzer();

