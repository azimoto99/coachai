/**
 * Soft "Do Nothing" Message Detector
 * Encodes intentional silence as a state for internal consistency and future ML labeling
 */

import { ProcessedGameState } from '../types/gameState';
import { CoachingAdvice } from '../types/coaching';
import { logger } from '../utils/logger';

export interface DoNothingState {
  detected: boolean;
  reason: string;
  confidence: number;
  duration: number; // How long to maintain this state (seconds)
}

export class DoNothingDetector {
  /**
   * Detect if "do nothing" is the best advice right now
   */
  public detect(gameState: ProcessedGameState): DoNothingState | null {
    // Check various conditions where doing nothing is optimal

    // 1. Farming phase - no immediate objectives
    if (this.isFarmingPhase(gameState)) {
      return {
        detected: true,
        reason: 'Farming phase - maintain map control, no immediate action needed',
        confidence: 0.8,
        duration: 60 // 1 minute
      };
    }

    // 2. Waiting for cooldowns - key abilities on cooldown
    if (this.isWaitingForCooldowns(gameState)) {
      return {
        detected: true,
        reason: 'Key abilities on cooldown - wait before engaging',
        confidence: 0.7,
        duration: 30 // 30 seconds
      };
    }

    // 3. Maintaining advantage - ahead and no windows
    if (this.isMaintainingAdvantage(gameState)) {
      return {
        detected: true,
        reason: 'Maintaining map control - no action recommended',
        confidence: 0.75,
        duration: 90 // 1.5 minutes
      };
    }

    // 4. Defensive positioning - behind and playing safe
    if (this.isDefensivePositioning(gameState)) {
      return {
        detected: true,
        reason: 'Defensive positioning - maintain current state',
        confidence: 0.7,
        duration: 60
      };
    }

    return null;
  }

  /**
   * Create a "do nothing" advice message (for internal tracking, optionally shown)
   */
  public createDoNothingAdvice(
    state: DoNothingState,
    gameState: ProcessedGameState
  ): CoachingAdvice {
    return {
      priority: 'LOW',
      message: state.reason,
      action: 'maintain',
      timestamp: Date.now(),
      gameTime: gameState.gameTime,
      confidence: state.confidence,
      isDoNothing: true,
      netWorthContext: this.getNetWorthContext(gameState)
    };
  }

  private isFarmingPhase(gameState: ProcessedGameState): boolean {
    // Early game, no immediate objectives, good farm available
    if (gameState.gameTime < 600) { // First 10 minutes
      const enemyBuildings = gameState.buildings[gameState.player.team === 'radiant' ? 'dire' : 'radiant'];
      const t1sAlive = (enemyBuildings.t1 || []).filter(b => !b.destroyed).length;
      
      // If all T1s still up and we're farming, it's a farming phase
      if (t1sAlive >= 2 && gameState.player.lastHits > 0) {
        return true;
      }
    }
    return false;
  }

  private isWaitingForCooldowns(gameState: ProcessedGameState): boolean {
    // Check if key ultimates are on cooldown
    const ultimates = Object.values(gameState.abilities).filter(ab => ab.isUltimate);
    const ultsOnCooldown = ultimates.filter(ab => ab.cooldownRemaining > 0 && ab.cooldownRemaining < 60);
    
    // If most ultimates are on short cooldown (<60s), wait
    if (ultsOnCooldown.length > 0 && ultsOnCooldown.length >= ultimates.length * 0.5) {
      return true;
    }
    return false;
  }

  private isMaintainingAdvantage(gameState: ProcessedGameState): boolean {
    // Check if we have a lead and no immediate push windows
    const teamNetWorth = gameState.team.netWorth;
    const enemyNetWorth = gameState.enemies.reduce((sum, e) => sum + e.netWorth, 0);
    const delta = teamNetWorth - enemyNetWorth;

    // If we have a moderate lead (>3k) and no enemies dead
    if (delta > 3000) {
      const deadEnemies = gameState.enemies.filter(e => !e.alive).length;
      if (deadEnemies === 0) {
        // No immediate push window, maintain advantage
        return true;
      }
    }
    return false;
  }

  private isDefensivePositioning(gameState: ProcessedGameState): boolean {
    // Check if we're behind and playing defensively
    const teamNetWorth = gameState.team.netWorth;
    const enemyNetWorth = gameState.enemies.reduce((sum, e) => sum + e.netWorth, 0);
    const delta = teamNetWorth - enemyNetWorth;

    // If we're behind (>2k deficit) and low health
    if (delta < -2000 && gameState.hero.healthPercent < 50) {
      return true;
    }
    return false;
  }

  private getNetWorthContext(gameState: ProcessedGameState): { delta: number; deltaPercent: number } {
    const teamNetWorth = gameState.team.netWorth;
    const enemyNetWorth = gameState.enemies.reduce((sum, e) => sum + e.netWorth, 0);
    const delta = teamNetWorth - enemyNetWorth;
    const deltaPercent = enemyNetWorth > 0 ? (delta / enemyNetWorth) * 100 : 0;
    return { delta, deltaPercent };
  }
}

export const doNothingDetector = new DoNothingDetector();

