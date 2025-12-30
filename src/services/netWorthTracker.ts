/**
 * Tracks net worth deltas and provides strategic signals
 * Net worth delta is one of the strongest predictors of correct macro decisions
 */

import { ProcessedGameState } from '../types/gameState';
import { logger } from '../utils/logger';

export interface NetWorthAnalysis {
  teamNetWorth: number;
  enemyNetWorth: number;
  delta: number;
  deltaPercent: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  recommendation: string;
  signals: string[];
}

export class NetWorthTracker {
  private history: Array<{ time: number; teamNW: number; enemyNW: number; delta: number }> = [];
  private readonly HISTORY_SIZE = 20; // Keep last 20 data points

  /**
   * Analyze net worth delta and provide strategic signals
   */
  public analyze(gameState: ProcessedGameState): NetWorthAnalysis {
    const teamNetWorth = gameState.team.netWorth;
    const enemyNetWorth = gameState.enemies.reduce((sum, e) => sum + e.netWorth, 0);
    const delta = teamNetWorth - enemyNetWorth;
    const deltaPercent = enemyNetWorth > 0 ? (delta / enemyNetWorth) * 100 : 0;

    // Track history
    this.history.push({
      time: gameState.gameTime,
      teamNW: teamNetWorth,
      enemyNW: enemyNetWorth,
      delta
    });

    // Keep history size manageable
    if (this.history.length > this.HISTORY_SIZE) {
      this.history.shift();
    }

    // Calculate trend
    const trend = this.calculateTrend();

    // Generate signals and recommendations
    const signals: string[] = [];
    let recommendation = '';

    // Large lead analysis
    if (delta > 8000) {
      signals.push('Large net worth lead');
      signals.push('Force objectives');
      recommendation = 'Large lead - force objectives, avoid risky fights';
      
      // Check buyback status
      const deadEnemiesNoBuyback = gameState.enemies.filter(e => 
        !e.alive && !e.buybackAvailable && e.netWorth > teamNetWorth * 0.7
      );
      if (deadEnemiesNoBuyback.length > 0) {
        signals.push('Enemy core dead, no buyback');
        recommendation = 'END GAME NOW - Core dead, no buyback, huge lead';
      }
    } else if (delta > 4000) {
      signals.push('Moderate net worth lead');
      signals.push('Push advantages');
      recommendation = 'Moderate lead - push objectives, trade safely';
    } else if (delta > -2000 && delta < 2000) {
      signals.push('Even net worth');
      signals.push('Avoid 5v5');
      recommendation = 'Even game - avoid 5v5, look for pickoffs';
    } else if (delta < -4000) {
      signals.push('Net worth deficit');
      signals.push('Play defensively');
      recommendation = 'Behind - play defensively, farm safely, wait for mistakes';
    } else {
      signals.push('Slight deficit');
      signals.push('Trade carefully');
      recommendation = 'Slightly behind - trade carefully, avoid bad fights';
    }

    // Trend-based signals
    if (trend === 'increasing' && delta > 0) {
      signals.push('Lead increasing');
      recommendation += ' - Lead growing, maintain pressure';
    } else if (trend === 'decreasing' && delta > 0) {
      signals.push('Lead shrinking');
      recommendation += ' - Lead shrinking, secure objectives soon';
    } else if (trend === 'decreasing' && delta < 0) {
      signals.push('Deficit growing');
      recommendation += ' - Falling further behind, need to stabilize';
    }

    // Net worth spike detection (synchronize pushes)
    const recentSpike = this.detectNetWorthSpike();
    if (recentSpike) {
      signals.push('Net worth spike detected');
      recommendation += ' - Power spike, coordinate push';
    }

    return {
      teamNetWorth,
      enemyNetWorth,
      delta,
      deltaPercent,
      trend,
      recommendation,
      signals
    };
  }

  private calculateTrend(): 'increasing' | 'decreasing' | 'stable' {
    if (this.history.length < 3) {
      return 'stable';
    }

    const recent = this.history.slice(-3);
    const deltas = recent.map(r => r.delta);
    
    // Check if consistently increasing or decreasing
    const increasing = deltas[2] > deltas[1] && deltas[1] > deltas[0];
    const decreasing = deltas[2] < deltas[1] && deltas[1] < deltas[0];
    
    if (increasing) return 'increasing';
    if (decreasing) return 'decreasing';
    return 'stable';
  }

  private detectNetWorthSpike(): boolean {
    if (this.history.length < 2) {
      return false;
    }

    const last = this.history[this.history.length - 1];
    const previous = this.history[this.history.length - 2];

    // Detect significant increase in team net worth (e.g., >2000 in short time)
    const timeDelta = last.time - previous.time;
    const netWorthDelta = last.teamNW - previous.teamNW;

    // Significant spike if >2000 gold in <60 seconds
    if (timeDelta < 60 && netWorthDelta > 2000) {
      return true;
    }

    return false;
  }

  /**
   * Get net worth-based push recommendation
   */
  public getPushRecommendation(analysis: NetWorthAnalysis, gameState: ProcessedGameState): string | null {
    // Large lead + no buybacks → force objectives
    if (analysis.delta > 8000) {
      const deadEnemiesNoBuyback = gameState.enemies.filter(e => 
        !e.alive && !e.buybackAvailable
      );
      if (deadEnemiesNoBuyback.length >= 2) {
        return 'Large lead + enemies dead no buyback → FORCE OBJECTIVES NOW';
      }
    }

    // Small lead → trade safely, avoid 5v5
    if (analysis.delta > 0 && analysis.delta < 4000) {
      return 'Small lead → Trade safely, avoid 5v5';
    }

    // Net worth spike → synchronize pushes
    if (this.detectNetWorthSpike() && analysis.delta > 0) {
      return 'Net worth spike → Coordinate push now';
    }

    return null;
  }

  /**
   * Clear history (for new game)
   */
  public clear(): void {
    this.history = [];
  }
}

export const netWorthTracker = new NetWorthTracker();

