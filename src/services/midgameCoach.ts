/**
 * Mid game coach - objectives, teamfighting, power spikes (10-30 minutes)
 */

import { ProcessedGameState } from '../types/gameState';
import { CoachingAdvice } from '../types/coaching';
import { logger } from '../utils/logger';

export class MidgameCoach {
  private lastAdvice: Map<string, number> = new Map();
  private readonly COOLDOWN = 45000; // 45 seconds between same advice

  /**
   * Get mid game advice
   */
  public getAdvice(gameState: ProcessedGameState): CoachingAdvice | null {
    if (gameState.gameTime < 600 || gameState.gameTime > 1800) return null; // 10-30 minutes

    try {
      // Objective taking
      const objectiveAdvice = this.checkObjectives(gameState);
      if (objectiveAdvice) return objectiveAdvice;

      // Teamfight positioning
      const fightAdvice = this.checkTeamfights(gameState);
      if (fightAdvice) return fightAdvice;

      // Power spikes
      const spikeAdvice = this.checkPowerSpikes(gameState);
      if (spikeAdvice) return spikeAdvice;

      // Farm efficiency
      const farmAdvice = this.checkFarmEfficiency(gameState);
      if (farmAdvice) return farmAdvice;

      return null;
    } catch (error) {
      logger.error('Error in midgame coach:', error);
      return null;
    }
  }

  private checkObjectives(gameState: ProcessedGameState): CoachingAdvice | null {
    const enemyBuildings = gameState.buildings[gameState.player.team === 'radiant' ? 'dire' : 'radiant'];
    const deadEnemies = gameState.enemies.filter(e => !e.alive).length;
    const aliveEnemies = gameState.enemies.filter(e => e.alive).length;

    // Tower pushing opportunities
    const t1s = enemyBuildings.t1 || [];
    const t2s = enemyBuildings.t2 || [];
    const lowTowers = [...t1s, ...t2s].filter(t => 
      !t.destroyed && t.healthPercent < 50 && t.healthPercent > 0
    );

    if (lowTowers.length > 0 && deadEnemies >= 2 && gameState.hero.alive) {
      return {
        priority: 'HIGH',
        message: `Push ${lowTowers[0].name} NOW - ${deadEnemies} enemies dead, finish tower`,
        action: 'push',
        timestamp: Date.now(),
        gameTime: gameState.gameTime
      };
    }

    // Roshan opportunities
    if (gameState.roshan.alive && deadEnemies >= 2 && aliveEnemies <= 2) {
      const hasVision = gameState.items.allItems.some(i => 
        i.name.toLowerCase().includes('ward') || 
        i.name.toLowerCase().includes('gem')
      );

      if (hasVision) {
        return {
          priority: 'HIGH',
          message: 'Rosh available - 2+ enemies dead, secure Aegis',
          action: 'roshan',
          timestamp: Date.now(),
          gameTime: gameState.gameTime
        };
      } else {
        return {
          priority: 'MEDIUM',
          message: 'Rosh available but no vision - ward first then Rosh',
          action: 'ward',
          timestamp: Date.now(),
          gameTime: gameState.gameTime
        };
      }
    }

    return null;
  }

  private checkTeamfights(gameState: ProcessedGameState): CoachingAdvice | null {
    const aliveEnemies = gameState.enemies.filter(e => e.alive && e.visible).length;
    const alliesNearby = gameState.team.players.length; // Simplified

    if (aliveEnemies === 0) return null;

    // Pre-fight positioning
    const hasBKB = gameState.items.allItems.some(i => 
      i.name.toLowerCase().includes('black_king_bar')
    );
    const ultimatesReady = Object.values(gameState.abilities).filter(a => 
      a.isUltimate && a.ready && a.level > 0
    ).length;

    if (aliveEnemies >= 3 && alliesNearby >= 4 && ultimatesReady >= 2) {
      return {
        priority: 'HIGH',
        message: 'Teamfight advantage - 2+ ultimates ready, numbers advantage, force fight',
        action: 'fight',
        timestamp: Date.now(),
        gameTime: gameState.gameTime
      };
    }

    // BKB usage
    if (hasBKB && gameState.hero.healthPercent < 60 && aliveEnemies >= 2) {
      return {
        priority: 'MEDIUM',
        message: 'Low HP with BKB - use BKB if about to get stunned',
        action: 'item_usage',
        timestamp: Date.now(),
        gameTime: gameState.gameTime
      };
    }

    return null;
  }

  private checkPowerSpikes(gameState: ProcessedGameState): CoachingAdvice | null {
    const hero = gameState.hero;
    const gameTime = gameState.gameTime;

    // Key item timings
    const hasBKB = gameState.items.allItems.some(i => 
      i.name.toLowerCase().includes('black_king_bar')
    );
    const hasBlink = gameState.items.allItems.some(i => 
      i.name.toLowerCase().includes('blink')
    );

    // Level 12 talent spike
    if (hero.level === 12 && gameTime < 1800) {
      return {
        priority: 'MEDIUM',
        message: 'Level 12 talent unlocked - significant power increase, look for plays',
        action: 'power_spike',
        timestamp: Date.now(),
        gameTime: gameState.gameTime
      };
    }

    // BKB timing
    if (hasBKB && gameTime >= 1200 && gameTime <= 1500) {
      return {
        priority: 'HIGH',
        message: 'BKB timing - group and push, this is your window',
        action: 'push',
        timestamp: Date.now(),
        gameTime: gameState.gameTime
      };
    }

    // Blink timing
    if (hasBlink && gameTime >= 600 && gameTime <= 1200) {
      const needsBlink = ['axe', 'centaur', 'tide', 'enigma', 'earthshaker'].some(h =>
        hero.name.toLowerCase().includes(h)
      );
      
      if (needsBlink) {
        return {
          priority: 'HIGH',
          message: 'Blink dagger complete - start making plays, hunt enemy cores',
          action: 'initiate',
          timestamp: Date.now(),
          gameTime: gameState.gameTime
        };
      }
    }

    return null;
  }

  private checkFarmEfficiency(gameState: ProcessedGameState): CoachingAdvice | null {
    const teamNW = gameState.team.netWorth;
    const enemyNW = gameState.enemies.reduce((sum, e) => sum + e.netWorth, 0);
    const delta = teamNW - enemyNW;

    // Behind in farm
    if (delta < -3000 && gameState.gameTime < 1800) {
      return {
        priority: 'MEDIUM',
        message: 'Behind in farm - focus on safe farming, avoid risky fights',
        action: 'farm',
        timestamp: Date.now(),
        gameTime: gameState.gameTime
      };
    }

    // Ahead but farming inefficiently
    if (delta > 5000 && gameState.player.lastHits > 0 && gameState.gameTime < 1500) {
      return {
        priority: 'LOW',
        message: 'Large lead - stop farming, group and push objectives',
        action: 'group',
        timestamp: Date.now(),
        gameTime: gameState.gameTime
      };
    }

    return null;
  }
}

export const midgameCoach = new MidgameCoach();

