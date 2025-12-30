/**
 * Phase-specific coaching logic
 */

import { ProcessedGameState } from '../types/gameState';
import { CoachingAdvice, GamePhase, WinConditionAnalysis } from '../types/coaching';
import { CS_TARGETS } from '../config/constants';
import { logger } from '../utils/logger';

export class PhaseCoaching {
  /**
   * Get phase-specific coaching advice
   */
  public getAdvice(
    gameState: ProcessedGameState,
    phase: GamePhase,
    winCondition: WinConditionAnalysis | null
  ): CoachingAdvice | null {
    switch (phase) {
      case 'laning':
        return this.laningPhaseAdvice(gameState, winCondition);
      case 'midgame':
        return this.midgameAdvice(gameState, winCondition);
      case 'lategame':
        return this.lategameAdvice(gameState, winCondition);
      default:
        return null;
    }
  }

  private laningPhaseAdvice(
    gameState: ProcessedGameState,
    winCondition: WinConditionAnalysis | null
  ): CoachingAdvice | null {
    const gameTime = gameState.gameTime;
    const currentTime = gameTime;

    // CS targets
    const minuteMark = Math.floor(currentTime / 60);
    const expectedCS = CS_TARGETS[minuteMark as keyof typeof CS_TARGETS];
    
    if (expectedCS && gameState.player.lastHits < expectedCS * 0.7) {
      return {
        priority: 'HIGH',
        message: `CS: ${gameState.player.lastHits}/${expectedCS} - Focus farm, need gold for push timing`,
        action: 'farm',
        timestamp: Date.now(),
        gameTime: currentTime
      };
    }

    // Water rune timing (4:00)
    if (currentTime >= 240 && currentTime <= 260) {
      return {
        priority: 'MEDIUM',
        message: 'Water runes spawn at 4min - Secure for XP and gold',
        action: 'rune_timing',
        timestamp: Date.now(),
        gameTime: currentTime
      };
    }

    // First night timing (5:00) - Night Stalker spike
    if (currentTime >= 290 && currentTime <= 310) {
      return {
        priority: 'MEDIUM',
        message: 'Approaching 5min - First night (NS powerspike if on team)',
        action: 'timing_window',
        timestamp: Date.now(),
        gameTime: currentTime
      };
    }

    // Early push strategy - check for tower opportunities
    if (winCondition?.primaryCondition === 'earlyPush') {
      const enemyBuildings = gameState.buildings[gameState.player.team === 'radiant' ? 'dire' : 'radiant'];
      const enemyT1s = enemyBuildings.t1 || [];
      const lowT1 = enemyT1s.find(t => !t.destroyed && t.healthPercent < 50 && t.healthPercent > 0);
      
      if (lowT1 && gameState.hero.healthPercent > 50) {
        return {
          priority: 'HIGH',
          message: 'Enemy T1 low - Group and finish it at next wave (early push strategy)',
          action: 'tower_opportunity',
          timestamp: Date.now(),
          gameTime: currentTime
        };
      }
    }

    // Level 6 timing
    if (gameState.hero.level === 6 && gameState.hero.level > 0) {
      const ultimates = Object.values(gameState.abilities).filter(ab => ab.isUltimate && ab.ready);
      if (ultimates.length > 0) {
        return {
          priority: 'MEDIUM',
          message: 'Level 6 - Ultimate ready, look for kill or objective',
          action: 'timing_window',
          timestamp: Date.now(),
          gameTime: currentTime
        };
      }
    }

    return null;
  }

  private midgameAdvice(
    gameState: ProcessedGameState,
    winCondition: WinConditionAnalysis | null
  ): CoachingAdvice | null {
    const gameTime = gameState.gameTime;

    // BKB timing check (15-20min)
    if (gameTime >= 900 && gameTime <= 1200) {
      const hasBKB = gameState.items.allItems.some(item => 
        item.name.toLowerCase().includes('black_king_bar')
      );

      if (!hasBKB && winCondition?.keyItems.includes('black_king_bar')) {
        const goldNeeded = 3975 - gameState.player.gold;
        if (goldNeeded < 1000) {
          return {
            priority: 'HIGH',
            message: `BKB in ${Math.ceil(goldNeeded / gameState.player.gpm * 60)}s - Farm until complete, then group`,
            action: 'farm',
            timestamp: Date.now(),
            gameTime: gameTime
          };
        }
      }
    }

    // Roshan timing (20-30min window)
    if (gameTime >= 1200 && gameTime <= 1800) {
      if (!gameState.roshan.alive && gameState.roshan.respawnTime) {
        const timeUntilRespawn = gameState.roshan.respawnTime - gameTime;
        if (timeUntilRespawn < 120 && timeUntilRespawn > 0) {
          return {
            priority: 'HIGH',
            message: `Roshan respawning in ${Math.floor(timeUntilRespawn)}s - Prepare to secure Aegis`,
            action: 'roshan',
            timestamp: Date.now(),
            gameTime: gameTime
          };
        }
      }
    }

    // Check for T2 opportunities
    const enemyBuildings = gameState.buildings[gameState.player.team === 'radiant' ? 'dire' : 'radiant'];
    const enemyT2s = enemyBuildings.t2 || [];
    const lowT2 = enemyT2s.find(t => !t.destroyed && t.healthPercent < 40 && t.healthPercent > 0);

    if (lowT2 && gameState.hero.healthPercent > 60) {
      return {
        priority: 'HIGH',
        message: `Enemy T2 at ${Math.floor(lowT2.healthPercent)}% - Group and finish it`,
        action: 'push',
        timestamp: Date.now(),
        gameTime: gameTime
      };
    }

    return null;
  }

  private lategameAdvice(
    gameState: ProcessedGameState,
    winCondition: WinConditionAnalysis | null
  ): CoachingAdvice | null {
    const gameTime = gameState.gameTime;
    const enemyBuildings = gameState.buildings[gameState.player.team === 'radiant' ? 'dire' : 'radiant'];

    // Check Ancient status
    const enemyAncient = enemyBuildings.ancient;
    if (enemyAncient && !enemyAncient.destroyed && enemyAncient.healthPercent < 50) {
      return {
        priority: 'GAME_ENDING',
        message: `ANCIENT AT ${Math.floor(enemyAncient.healthPercent)}% - FINISH IT NOW`,
        action: 'end_game',
        timestamp: Date.now(),
        gameTime: gameTime
      };
    }

    // Check for T3/Barracks opportunities
    const enemyT3s = enemyBuildings.t3 || [];
    const enemyRax = enemyBuildings.barracks || [];
    const aliveT3s = enemyT3s.filter(t => !t.destroyed);
    const aliveRax = enemyRax.filter(r => !r.destroyed);

    if (aliveT3s.length === 0 && aliveRax.length > 0) {
      return {
        priority: 'CRITICAL',
        message: `T3s down - Hit barracks to create megas, then end`,
        action: 'highground',
        timestamp: Date.now(),
        gameTime: gameTime
      };
    }

    // Buyback status check
    const deadEnemies = gameState.enemies.filter(e => !e.alive);
    const deadCoresNoBuyback = deadEnemies.filter(e => 
      e.netWorth > gameState.player.netWorth * 0.7 && !e.buybackAvailable
    );

    if (deadCoresNoBuyback.length > 0) {
      return {
        priority: 'GAME_ENDING',
        message: `Enemy core dead NO BUYBACK - This is the window to END`,
        action: 'end_game',
        timestamp: Date.now(),
        gameTime: gameTime
      };
    }

    return null;
  }
}

export const phaseCoaching = new PhaseCoaching();

