/**
 * Laning phase coach - detailed mechanics and advice for 0-10 minutes
 */

import { ProcessedGameState } from '../types/gameState';
import { CoachingAdvice } from '../types/coaching';
import { logger } from '../utils/logger';

export class LaningCoach {
  private lastAdvice: Map<string, number> = new Map();
  private readonly COOLDOWN = 30000; // 30 seconds between same advice

  /**
   * Get laning phase advice
   */
  public getAdvice(gameState: ProcessedGameState): CoachingAdvice | null {
    if (gameState.gameTime > 600) return null; // After 10 minutes

    try {
      // Creep equilibrium advice
      const equilibriumAdvice = this.checkCreepEquilibrium(gameState);
      if (equilibriumAdvice) return equilibriumAdvice;

      // Trading advice
      const tradingAdvice = this.checkTrading(gameState);
      if (tradingAdvice) return tradingAdvice;

      // Last hitting advice
      const csAdvice = this.checkLastHitting(gameState);
      if (csAdvice) return csAdvice;

      // Rune control
      const runeAdvice = this.checkRuneControl(gameState);
      if (runeAdvice) return runeAdvice;

      // Vision and map awareness
      const visionAdvice = this.checkVision(gameState);
      if (visionAdvice) return visionAdvice;

      // Power spike detection
      const spikeAdvice = this.checkPowerSpikes(gameState);
      if (spikeAdvice) return spikeAdvice;

      return null;
    } catch (error) {
      logger.error('Error in laning coach:', error);
      return null;
    }
  }

  private checkCreepEquilibrium(gameState: ProcessedGameState): CoachingAdvice | null {
    const gameTime = gameState.gameTime;
    const minute = Math.floor(gameTime / 60);
    const second = gameTime % 60;

    // Pull timing (0:44, 1:14, etc.)
    if (second >= 44 && second <= 50 && minute < 5) {
      return {
        priority: 'MEDIUM',
        message: 'Pull creeps now (0:44) - reset equilibrium, deny XP',
        action: 'pull',
        timestamp: Date.now(),
        gameTime: gameState.gameTime
      };
    }

    // Block creeps at 0:00
    if (gameTime < 5 && gameTime > -5) {
      return {
        priority: 'LOW',
        message: 'Block creeps at 0:00 - establish favorable equilibrium',
        action: 'block',
        timestamp: Date.now(),
        gameTime: gameState.gameTime
      };
    }

    return null;
  }

  private checkTrading(gameState: ProcessedGameState): CoachingAdvice | null {
    const hero = gameState.hero;
    const enemies = gameState.enemies.filter(e => e.alive && e.visible);

    if (enemies.length === 0) return null;

    // Low health warning
    if (hero.healthPercent < 40 && hero.alive) {
      return {
        priority: 'HIGH',
        message: 'Low HP - back and heal, don\'t trade',
        action: 'retreat',
        timestamp: Date.now(),
        gameTime: gameState.gameTime
      };
    }

    // Level advantage trading
    const enemyLevel = enemies[0].level || hero.level;
    if (hero.level >= enemyLevel + 2 && hero.healthPercent > 60) {
      return {
        priority: 'MEDIUM',
        message: 'Level advantage - trade aggressively, you win',
        action: 'trade',
        timestamp: Date.now(),
        gameTime: gameState.gameTime
      };
    }

    return null;
  }

  private checkLastHitting(gameState: ProcessedGameState): CoachingAdvice | null {
    const minute = Math.floor(gameState.gameTime / 60);
    const expectedCS = minute <= 5 ? 38 : minute <= 10 ? 82 : 160;
    const actualCS = gameState.player.lastHits;
    const csPercent = expectedCS > 0 ? (actualCS / expectedCS) * 100 : 0;

    if (csPercent < 70 && minute <= 10) {
      return {
        priority: 'MEDIUM',
        message: `CS: ${actualCS}/${expectedCS} - focus last hits, missing ${expectedCS - actualCS} creeps`,
        action: 'farm',
        timestamp: Date.now(),
        gameTime: gameState.gameTime
      };
    }

    return null;
  }

  private checkRuneControl(gameState: ProcessedGameState): CoachingAdvice | null {
    const gameTime = gameState.gameTime;
    const minute = Math.floor(gameTime / 60);
    const second = gameTime % 60;

    // Bounty runes spawn at 0:00, 3:00, 6:00, etc.
    const bountyRuneTime = minute * 60;
    const timeToBounty = bountyRuneTime - gameTime;

    if (timeToBounty >= 0 && timeToBounty <= 10 && minute <= 10) {
      return {
        priority: 'MEDIUM',
        message: `Bounty rune in ${Math.floor(timeToBounty)}s - secure for 126 gold`,
        action: 'rune',
        timestamp: Date.now(),
        gameTime: gameState.gameTime
      };
    }

    // Power runes at 2:00, 4:00, etc.
    if (minute % 2 === 0 && second >= 0 && second <= 10 && minute <= 10) {
      return {
        priority: 'MEDIUM',
        message: 'Power rune spawning - contest if safe, enemy mid might be low',
        action: 'rune',
        timestamp: Date.now(),
        gameTime: gameState.gameTime
      };
    }

    return null;
  }

  private checkVision(gameState: ProcessedGameState): CoachingAdvice | null {
    const hasWards = gameState.items.allItems.some(i => 
      i.name.toLowerCase().includes('ward') && 
      !i.name.toLowerCase().includes('sentry')
    );

    if (!hasWards && gameState.gameTime < 600) {
      return {
        priority: 'LOW',
        message: 'Buy observer ward - vision prevents ganks',
        action: 'ward',
        timestamp: Date.now(),
        gameTime: gameState.gameTime
      };
    }

    return null;
  }

  private checkPowerSpikes(gameState: ProcessedGameState): CoachingAdvice | null {
    const hero = gameState.hero;
    const gameTime = gameState.gameTime;

    // Level 6 power spike
    if (hero.level === 6 && gameTime < 600) {
      const hasUltimate = Object.values(gameState.abilities).some(a => 
        a.isUltimate && a.level > 0
      );
      
      if (hasUltimate) {
        return {
          priority: 'HIGH',
          message: 'Level 6 power spike - ultimate ready, look for kill opportunity',
          action: 'power_spike',
          timestamp: Date.now(),
          gameTime: gameState.gameTime
        };
      }
    }

    // Level 3 power spike (2 points in main ability)
    if (hero.level === 3 && gameTime < 300) {
      return {
        priority: 'MEDIUM',
        message: 'Level 3 power spike - go aggressive, you have advantage',
        action: 'power_spike',
        timestamp: Date.now(),
        gameTime: gameState.gameTime
      };
    }

    return null;
  }
}

export const laningCoach = new LaningCoach();

