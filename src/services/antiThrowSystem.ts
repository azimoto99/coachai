/**
 * Anti-throw prevention system
 * Detects common throw scenarios and warns player
 */

import { ProcessedGameState } from '../types/gameState';
import { CoachingAdvice, MessagePriority } from '../types/coaching';
import { logger } from '../utils/logger';

export class AntiThrowSystem {
  private lastRoshWarning: number = 0;
  private readonly ROSH_WARNING_COOLDOWN = 120000; // 2 minutes cooldown

  /**
   * Check for throw scenarios and return warnings
   */
  public checkThrowScenarios(gameState: ProcessedGameState): CoachingAdvice | null {
    // Don't chase kills into fog
    const chaseWarning = this.checkChasingKills(gameState);
    if (chaseWarning) return chaseWarning;

    // Back after objective
    const backWarning = this.checkBackAfterObjective(gameState);
    if (backWarning) return backWarning;

    // Don't Rosh without vision
    const roshWarning = this.checkRoshWithoutVision(gameState);
    if (roshWarning) return roshWarning;

    // Save buyback for Ancient
    const buybackWarning = this.checkBuybackUsage(gameState);
    if (buybackWarning) return buybackWarning;

    // Don't farm when strong enough
    const farmWarning = this.checkOverFarming(gameState);
    if (farmWarning) return farmWarning;

    // Don't fight without key abilities
    const abilityWarning = this.checkFightingWithoutAbilities(gameState);
    if (abilityWarning) return abilityWarning;

    return null;
  }

  private checkChasingKills(gameState: ProcessedGameState): CoachingAdvice | null {
    // Simplified check - in reality we'd need position data
    // If player is low health and far from base, warn about chasing
    if (gameState.hero.healthPercent < 40 && 
        gameState.hero.alive &&
        gameState.enemies.some(e => !e.alive && e.respawnSeconds < 20)) {
      return {
        priority: 'HIGH',
        message: "DON'T chase into fog - take tower instead, kill doesn't matter",
        action: 'retreat',
        timestamp: Date.now(),
        gameTime: gameState.gameTime
      };
    }
    return null;
  }

  private checkBackAfterObjective(gameState: ProcessedGameState): CoachingAdvice | null {
    // Check if we recently took a tower (would need to track this)
    // For now, check if player is low health after a fight
    if (gameState.hero.healthPercent < 30 && 
        gameState.hero.alive &&
        gameState.player.kills > 0) {
      // Recent kill suggests we won a fight
      return {
        priority: 'HIGH',
        message: "Low health after objective - BACK and heal, don't throw the advantage",
        action: 'retreat',
        timestamp: Date.now(),
        gameTime: gameState.gameTime
      };
    }
    return null;
  }

  private checkRoshWithoutVision(gameState: ProcessedGameState): CoachingAdvice | null {
    const now = Date.now();
    
    // Check cooldown - don't spam the same warning
    if (now - this.lastRoshWarning < this.ROSH_WARNING_COOLDOWN) {
      return null;
    }

    // Only warn if:
    // 1. Roshan is alive (we can take it)
    // 2. We're in mid/late game
    // 3. Enemies are dead (we have opportunity)
    // 4. We don't have detection/vision items
    const hasVision = gameState.items.allItems.some(i => 
      i.name.toLowerCase().includes('ward') ||
      i.name.toLowerCase().includes('gem') ||
      i.name.toLowerCase().includes('sentry')
    );

    const deadEnemies = gameState.enemies.filter(e => !e.alive).length;
    const aliveEnemies = gameState.enemies.filter(e => e.alive).length;

    if (gameState.gameTime > 1200 && // After 20min
        gameState.hero.alive &&
        gameState.roshan.alive && // Roshan is alive (we can take it)
        deadEnemies >= 2 && // At least 2 enemies dead
        aliveEnemies <= 2 && // Max 2 enemies alive
        !hasVision) { // No vision items
      this.lastRoshWarning = now;
      return {
        priority: 'CRITICAL',
        message: "STOP ROSH - No vision, this is how you throw. Ward first.",
        action: 'ward',
        timestamp: Date.now(),
        gameTime: gameState.gameTime
      };
    }
    return null;
  }

  private checkBuybackUsage(gameState: ProcessedGameState): CoachingAdvice | null {
    if (gameState.gameTime > 2400 && // After 40min
        gameState.hero.buybackAvailable &&
        !this.isDefendingBase(gameState)) {
      return {
        priority: 'MEDIUM',
        message: "Save buyback - Only use to defend Ancient or to END the game",
        action: 'save_buyback',
        timestamp: Date.now(),
        gameTime: gameState.gameTime
      };
    }
    return null;
  }

  private checkOverFarming(gameState: ProcessedGameState): CoachingAdvice | null {
    // Calculate net worth advantage
    const teamNetWorth = gameState.team.netWorth;
    const enemyNetWorth = gameState.enemies.reduce((sum, e) => sum + e.netWorth, 0);
    const advantage = teamNetWorth - enemyNetWorth;

    // If we have huge lead and player is farming instead of pushing
    if (advantage > 8000 && 
        gameState.hero.alive &&
        gameState.player.lastHits > 0) {
      // Check if we should be pushing (simplified)
      const shouldPush = this.shouldBePushing(gameState);
      
      if (shouldPush) {
        return {
          priority: 'CRITICAL',
          message: "STOP FARMING - Team is 8k ahead, group and END NOW",
          action: 'group',
          timestamp: Date.now(),
          gameTime: gameState.gameTime
        };
      }
    }
    return null;
  }

  private checkFightingWithoutAbilities(gameState: ProcessedGameState): CoachingAdvice | null {
    // Check if key abilities are on cooldown
    const ultimates = Object.values(gameState.abilities).filter(ab => ab.isUltimate);
    const ultsReady = ultimates.filter(ab => ab.ready).length;
    const ultsOnCooldown = ultimates.length - ultsReady;

    // If most ultimates are down and we're about to fight
    if (ultsOnCooldown > 0 && 
        gameState.enemies.some(e => e.alive && e.visible) &&
        gameState.hero.healthPercent > 50) {
      return {
        priority: 'MEDIUM',
        message: "Ultimate on cooldown - Don't force fight, wait for cooldown",
        action: 'wait',
        timestamp: Date.now(),
        gameTime: gameState.gameTime
      };
    }
    return null;
  }

  private isDefendingBase(gameState: ProcessedGameState): boolean {
    // Simplified - check if enemy buildings are close to our base
    const enemyBuildings = gameState.buildings[gameState.player.team === 'radiant' ? 'dire' : 'radiant'];
    const enemyT3s = enemyBuildings.t3 || [];
    const enemyT3sAlive = enemyT3s.filter(t => !t.destroyed);
    
    // If enemy T3s are still up, we're not defending base
    return enemyT3sAlive.length === 0;
  }

  private shouldBePushing(gameState: ProcessedGameState): boolean {
    // Check if we have push windows
    const enemyBuildings = gameState.buildings[gameState.player.team === 'radiant' ? 'dire' : 'radiant'];
    const hasObjectives = [
      ...(enemyBuildings.t1 || []),
      ...(enemyBuildings.t2 || []),
      ...(enemyBuildings.t3 || [])
    ].some(b => !b.destroyed);

    return hasObjectives && gameState.hero.alive;
  }
}

export const antiThrowSystem = new AntiThrowSystem();

