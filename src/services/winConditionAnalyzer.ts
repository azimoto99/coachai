/**
 * Analyzes team composition and identifies optimal win condition
 */

import { ProcessedGameState, ProcessedPlayer } from '../types/gameState';
import { WinCondition, WinConditionAnalysis } from '../types/coaching';
import { WIN_CONDITIONS } from '../config/constants';
import { logger } from '../utils/logger';

export class WinConditionAnalyzer {
  /**
   * Analyze team composition and determine primary win condition
   */
  public analyze(gameState: ProcessedGameState): WinConditionAnalysis {
    const teamHeroes = this.extractTeamHeroes(gameState);
    const enemyHeroes = this.extractEnemyHeroes(gameState);

    // Score each win condition based on team composition
    const scores: Record<WinCondition, number> = {
      earlyPush: this.scoreEarlyPush(teamHeroes, enemyHeroes),
      timingPush: this.scoreTimingPush(teamHeroes, enemyHeroes),
      splitPush: this.scoreSplitPush(teamHeroes, enemyHeroes),
      highgroundSiege: this.scoreHighgroundSiege(teamHeroes, enemyHeroes),
      outscale: this.scoreOutscale(teamHeroes, enemyHeroes),
      unknown: 0
    };

    // Find highest scoring condition
    const primaryCondition = Object.entries(scores)
      .filter(([condition]) => condition !== 'unknown')
      .sort(([, a], [, b]) => b - a)[0]?.[0] as WinCondition || 'unknown';

    const confidence = scores[primaryCondition] / 10; // Normalize to 0-1

    const conditionData = primaryCondition !== 'unknown' 
      ? WIN_CONDITIONS[primaryCondition] 
      : WIN_CONDITIONS.timingPush;

    return {
      primaryCondition,
      confidence: Math.min(confidence, 1),
      timing: conditionData.timing,
      strategy: conditionData.strategy,
      heroes: teamHeroes,
      keyItems: conditionData.keyItems,
      pushTiming: this.calculatePushTiming(primaryCondition, gameState)
    };
  }

  private extractTeamHeroes(gameState: ProcessedGameState): string[] {
    // In a real implementation, we'd need hero names from allplayers
    // For now, we'll use the player's hero name and infer team composition
    // This is a limitation of GSI - we only see full hero data for local player
    const heroes: string[] = [];
    
    if (gameState.hero.name && gameState.hero.name !== 'unknown') {
      heroes.push(gameState.hero.name);
    }

    // Note: Full team composition requires draft phase data or spectating
    // For now, we'll work with what we have and adapt dynamically
    return heroes;
  }

  private extractEnemyHeroes(gameState: ProcessedGameState): string[] {
    // Similar limitation - we only see enemy heroes when they're visible
    return gameState.enemies
      .filter(e => e.heroName && e.visible)
      .map(e => e.heroName!);
  }

  private scoreEarlyPush(teamHeroes: string[], enemyHeroes: string[]): number {
    let score = 0;
    
    for (const hero of teamHeroes) {
      if (WIN_CONDITIONS.earlyPush.heroes.includes(hero)) {
        score += 3;
      }
    }

    // Penalize if enemy has strong late game
    const lateGameEnemies = enemyHeroes.filter(h => 
      WIN_CONDITIONS.outscale.heroes.includes(h)
    );
    if (lateGameEnemies.length >= 2) {
      score += 2; // More incentive to push early
    }

    return score;
  }

  private scoreTimingPush(teamHeroes: string[], enemyHeroes: string[]): number {
    let score = 0;
    
    for (const hero of teamHeroes) {
      if (WIN_CONDITIONS.timingPush.heroes.includes(hero)) {
        score += 2;
      }
    }

    return score;
  }

  private scoreSplitPush(teamHeroes: string[], enemyHeroes: string[]): number {
    let score = 0;
    
    for (const hero of teamHeroes) {
      if (WIN_CONDITIONS.splitPush.heroes.includes(hero)) {
        score += 3;
      }
    }

    return score;
  }

  private scoreHighgroundSiege(teamHeroes: string[], enemyHeroes: string[]): number {
    let score = 0;
    
    for (const hero of teamHeroes) {
      if (WIN_CONDITIONS.highgroundSiege.heroes.includes(hero)) {
        score += 2;
      }
    }

    return score;
  }

  private scoreOutscale(teamHeroes: string[], enemyHeroes: string[]): number {
    let score = 0;
    
    for (const hero of teamHeroes) {
      if (WIN_CONDITIONS.outscale.heroes.includes(hero)) {
        score += 2;
      }
    }

    // Check if enemy is early push oriented
    const earlyPushEnemies = enemyHeroes.filter(h => 
      WIN_CONDITIONS.earlyPush.heroes.includes(h)
    );
    if (earlyPushEnemies.length >= 2) {
      score -= 2; // Less viable if enemy wants to end early
    }

    return Math.max(score, 0);
  }

  private calculatePushTiming(condition: WinCondition, gameState: ProcessedGameState): number {
    const gameTime = gameState.gameTime;
    
    switch (condition) {
      case 'earlyPush':
        return Math.max(300, gameTime + 120); // Start pushing in 2 min if not already
      case 'timingPush':
        // Wait for key items (BKB typically 15-20min)
        return Math.max(900, gameTime + 300); // 15min or 5min from now
      case 'splitPush':
        return gameTime; // Can start immediately
      case 'highgroundSiege':
        return Math.max(1500, gameTime + 300); // 25min or 5min from now
      case 'outscale':
        return Math.max(2100, gameTime + 600); // 35min or 10min from now
      default:
        return gameTime + 300;
    }
  }

  /**
   * Check if current game state aligns with identified win condition
   */
  public validateWinCondition(
    analysis: WinConditionAnalysis,
    gameState: ProcessedGameState
  ): boolean {
    const gameTime = gameState.gameTime;
    const pushTiming = analysis.pushTiming;

    // Check if we're in the right timing window
    if (gameTime < pushTiming - 60) {
      return false; // Too early
    }

    if (gameTime > pushTiming + 600) {
      return false; // Window may have passed
    }

    // Check if key items are present
    const hasKeyItems = analysis.keyItems.some(itemName =>
      gameState.items.allItems.some(item => 
        item.name.toLowerCase().includes(itemName.toLowerCase())
      )
    );

    return hasKeyItems || analysis.keyItems.length === 0;
  }
}

export const winConditionAnalyzer = new WinConditionAnalyzer();

