/**
 * Late game coach - high ground, buybacks, win conditions (30+ minutes)
 */

import { ProcessedGameState } from '../types/gameState';
import { CoachingAdvice } from '../types/coaching';
import { logger } from '../utils/logger';

export class LategameCoach {
  private lastAdvice: Map<string, number> = new Map();
  private readonly COOLDOWN = 60000; // 60 seconds between same advice

  /**
   * Get late game advice
   */
  public getAdvice(gameState: ProcessedGameState): CoachingAdvice | null {
    if (gameState.gameTime < 1800) return null; // After 30 minutes

    try {
      // High ground sieging
      const siegeAdvice = this.checkHighGround(gameState);
      if (siegeAdvice) return siegeAdvice;

      // Buyback management
      const buybackAdvice = this.checkBuybacks(gameState);
      if (buybackAdvice) return buybackAdvice;

      // Win condition execution
      const winConditionAdvice = this.checkWinConditions(gameState);
      if (winConditionAdvice) return winConditionAdvice;

      // Death timer warnings
      const deathTimerAdvice = this.checkDeathTimers(gameState);
      if (deathTimerAdvice) return deathTimerAdvice;

      return null;
    } catch (error) {
      logger.error('Error in lategame coach:', error);
      return null;
    }
  }

  private checkHighGround(gameState: ProcessedGameState): CoachingAdvice | null {
    const enemyBuildings = gameState.buildings[gameState.player.team === 'radiant' ? 'dire' : 'radiant'];
    const t3s = enemyBuildings.t3 || [];
    const aliveT3s = t3s.filter(t => !t.destroyed);
    const barracks = enemyBuildings.barracks || [];
    const aliveBarracks = barracks.filter(b => !b.destroyed);

    if (aliveT3s.length === 0 && aliveBarracks.length > 0) {
      const deadEnemies = gameState.enemies.filter(e => !e.alive).length;
      const hasAegis = gameState.roshan.aegisHolder === gameState.player.team;

      if (deadEnemies >= 2 || hasAegis) {
        return {
          priority: 'CRITICAL',
          message: 'High ground opportunity - T3s down, push racks NOW',
          action: 'push',
          timestamp: Date.now(),
          gameTime: gameState.gameTime
        };
      }
    }

    // Siege execution
    if (aliveT3s.length > 0) {
      const lowT3s = aliveT3s.filter(t => t.healthPercent < 50 && t.healthPercent > 0);
      if (lowT3s.length > 0) {
        return {
          priority: 'HIGH',
          message: `T3 at ${Math.floor(lowT3s[0].healthPercent)}% - finish it, don't back`,
          action: 'push',
          timestamp: Date.now(),
          gameTime: gameState.gameTime
        };
      }
    }

    return null;
  }

  private checkBuybacks(gameState: ProcessedGameState): CoachingAdvice | null {
    const hero = gameState.hero;
    const gameTime = gameState.gameTime;

    // Save buyback warning
    if (gameTime > 2400 && hero.buybackAvailable && gameState.hero.alive) {
      const enemyBuildings = gameState.buildings[gameState.player.team === 'radiant' ? 'dire' : 'radiant'];
      const enemyT3s = enemyBuildings.t3 || [];
      const enemyT3sAlive = enemyT3s.filter(t => !t.destroyed);

      if (enemyT3sAlive.length === 0) {
        return {
          priority: 'HIGH',
          message: 'Save buyback - only use to defend Ancient or end game',
          action: 'save_buyback',
          timestamp: Date.now(),
          gameTime: gameState.gameTime
        };
      }
    }

    // Enemy no buyback opportunity
    const enemiesNoBuyback = gameState.enemies.filter(e => 
      !e.buybackAvailable && e.netWorth > gameState.team.netWorth * 0.15
    );

    if (enemiesNoBuyback.length >= 1 && gameTime > 2400) {
      return {
        priority: 'CRITICAL',
        message: `Enemy core(s) no buyback - kill and END GAME`,
        action: 'end_game',
        timestamp: Date.now(),
        gameTime: gameState.gameTime
      };
    }

    return null;
  }

  private checkWinConditions(gameState: ProcessedGameState): CoachingAdvice | null {
    const teamNW = gameState.team.netWorth;
    const enemyNW = gameState.enemies.reduce((sum, e) => sum + e.netWorth, 0);
    const delta = teamNW - enemyNW;

    // Large lead - execute win condition
    if (delta > 15000 && gameState.gameTime > 2400) {
      const deadEnemies = gameState.enemies.filter(e => !e.alive).length;
      if (deadEnemies >= 2) {
        return {
          priority: 'CRITICAL',
          message: 'MASSIVE LEAD + enemies dead - END GAME NOW, don\'t farm',
          action: 'end_game',
          timestamp: Date.now(),
          gameTime: gameState.gameTime
        };
      }
    }

    return null;
  }

  private checkDeathTimers(gameState: ProcessedGameState): CoachingAdvice | null {
    const gameTime = gameState.gameTime;

    // Ultra-late game death timers
    if (gameTime > 3000) {
      return {
        priority: 'HIGH',
        message: 'Death = lose game - play for pickoffs only, don\'t take risks',
        action: 'play_safe',
        timestamp: Date.now(),
        gameTime: gameState.gameTime
      };
    }

    return null;
  }
}

export const lategameCoach = new LategameCoach();

