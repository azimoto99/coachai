/**
 * Winrate tracker - tracks combat outcomes and calculates winrates
 */

import { ProcessedGameState } from '../types/gameState';
import { logger } from '../utils/logger';

interface CombatRecord {
  timestamp: number;
  gameTime: number;
  yourHero: string;
  enemyHero: string;
  predictedWinProb: number;
  actualOutcome?: 'win' | 'loss' | 'draw';
  factors: string[];
}

export class WinrateTracker {
  private combatHistory: CombatRecord[] = [];
  private readonly MAX_HISTORY = 100;

  /**
   * Record a combat prediction
   */
  public recordPrediction(
    gameState: ProcessedGameState,
    enemyHero: string,
    predictedWinProb: number,
    factors: string[]
  ): void {
    const record: CombatRecord = {
      timestamp: Date.now(),
      gameTime: gameState.gameTime,
      yourHero: gameState.hero.name,
      enemyHero,
      predictedWinProb,
      factors
    };

    this.combatHistory.push(record);

    // Keep history manageable
    if (this.combatHistory.length > this.MAX_HISTORY) {
      this.combatHistory.shift();
    }
  }

  /**
   * Record actual combat outcome
   */
  public recordOutcome(outcome: 'win' | 'loss' | 'draw'): void {
    if (this.combatHistory.length === 0) return;

    const lastRecord = this.combatHistory[this.combatHistory.length - 1];
    if (!lastRecord.actualOutcome) {
      lastRecord.actualOutcome = outcome;
    }
  }

  /**
   * Calculate overall winrate
   */
  public getOverallWinrate(): number {
    const completed = this.combatHistory.filter(r => r.actualOutcome !== undefined);
    if (completed.length === 0) return 0;

    const wins = completed.filter(r => r.actualOutcome === 'win').length;
    return wins / completed.length;
  }

  /**
   * Calculate winrate vs specific hero
   */
  public getWinrateVsHero(heroName: string): number {
    const vsHero = this.combatHistory.filter(r => 
      r.enemyHero.toLowerCase().includes(heroName.toLowerCase()) && 
      r.actualOutcome !== undefined
    );
    
    if (vsHero.length === 0) return 0;

    const wins = vsHero.filter(r => r.actualOutcome === 'win').length;
    return wins / vsHero.length;
  }

  /**
   * Calculate accuracy of predictions
   */
  public getPredictionAccuracy(): number {
    const completed = this.combatHistory.filter(r => r.actualOutcome !== undefined);
    if (completed.length === 0) return 0;

    let correct = 0;
    for (const record of completed) {
      const predictedWin = record.predictedWinProb > 0.5;
      const actualWin = record.actualOutcome === 'win';
      if (predictedWin === actualWin) {
        correct++;
      }
    }

    return correct / completed.length;
  }

  /**
   * Get recent combat history
   */
  public getRecentHistory(count: number = 10): CombatRecord[] {
    return this.combatHistory.slice(-count);
  }

  /**
   * Clear history (for new game)
   */
  public clear(): void {
    this.combatHistory = [];
  }
}

export const winrateTracker = new WinrateTracker();

