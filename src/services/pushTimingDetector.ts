/**
 * Detects push windows and opportunities to take objectives
 */

import { ProcessedGameState } from '../types/gameState';
import { PushWindow, MessagePriority } from '../types/coaching';
import { logger } from '../utils/logger';

export class PushTimingDetector {
  private lastItemCompletions: Map<string, number> = new Map();

  /**
   * Detect all current push windows
   */
  public detectPushWindows(gameState: ProcessedGameState): PushWindow[] {
    const windows: PushWindow[] = [];

    // Check for enemy hero deaths
    const heroDeathWindow = this.detectHeroDeathWindow(gameState);
    if (heroDeathWindow) windows.push(heroDeathWindow);

    // Check for buyback status
    const buybackWindow = this.detectBuybackWindow(gameState);
    if (buybackWindow) windows.push(buybackWindow);

    // Check for power spike (item completion)
    const powerSpikeWindow = this.detectPowerSpikeWindow(gameState);
    if (powerSpikeWindow) windows.push(powerSpikeWindow);

    // Check for ultimate advantage
    const ultimateWindow = this.detectUltimateAdvantage(gameState);
    if (ultimateWindow) windows.push(ultimateWindow);

    // Check for Aegis
    const aegisWindow = this.detectAegisWindow(gameState);
    if (aegisWindow) windows.push(aegisWindow);

    // Check for creep wave advantage
    const creepWaveWindow = this.detectCreepWaveWindow(gameState);
    if (creepWaveWindow) windows.push(creepWaveWindow);

    // Sort by priority
    return windows.sort((a, b) => {
      const priorityOrder: Record<MessagePriority, number> = {
        GAME_ENDING: 0,
        CRITICAL: 1,
        HIGH: 2,
        MEDIUM: 3,
        LOW: 4
      };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  private detectHeroDeathWindow(gameState: ProcessedGameState): PushWindow | null {
    const deadEnemies = gameState.enemies.filter(e => !e.alive && e.respawnSeconds > 0);
    
    if (deadEnemies.length >= 2) {
      const minRespawn = Math.min(...deadEnemies.map(e => e.respawnSeconds));
      
      // Check if any dead enemy is a core without buyback
      const deadCores = deadEnemies.filter(e => 
        e.netWorth > gameState.player.netWorth * 0.8 && !e.buybackAvailable
      );

      const priority: MessagePriority = deadCores.length >= 1 ? 'GAME_ENDING' : 'CRITICAL';

      return {
        type: 'hero_deaths',
        priority,
        duration: minRespawn,
        message: `${deadEnemies.length} enemies dead${deadCores.length > 0 ? ' (core no buyback)' : ''} - PUSH NOW`,
        timestamp: Date.now()
      };
    }

    return null;
  }

  private detectBuybackWindow(gameState: ProcessedGameState): PushWindow | null {
    const deadEnemies = gameState.enemies.filter(e => !e.alive);
    
    // Check if enemy carry/core is dead with no buyback
    const deadCoresNoBuyback = deadEnemies.filter(e => 
      e.netWorth > gameState.player.netWorth * 0.7 && 
      !e.buybackAvailable &&
      e.respawnSeconds > 30
    );

    if (deadCoresNoBuyback.length >= 1) {
      const minRespawn = Math.min(...deadCoresNoBuyback.map(e => e.respawnSeconds));
      
      return {
        type: 'no_buyback',
        priority: 'GAME_ENDING',
        duration: minRespawn,
        message: `Enemy core NO BUYBACK - This is THE window to end (${Math.floor(minRespawn)}s)`,
        timestamp: Date.now()
      };
    }

    return null;
  }

  private detectPowerSpikeWindow(gameState: ProcessedGameState): PushWindow | null {
    const keyItems = ['black_king_bar', 'blink_dagger', 'desolator', 'assault_cuirass', 'refresher_orb'];
    const inventory = gameState.items.inventory;

    for (const item of inventory) {
      const itemName = item.name.toLowerCase();
      
      // Check if this is a key item we just completed
      const lastCompletion = this.lastItemCompletions.get(itemName) || 0;
      const now = Date.now();
      
      // If item was completed in last 30 seconds, it's a fresh spike
      if (now - lastCompletion < 30000) {
        continue; // Already detected
      }

      if (keyItems.some(keyItem => itemName.includes(keyItem))) {
        this.lastItemCompletions.set(itemName, now);
        
        return {
          type: 'power_spike',
          priority: 'HIGH',
          duration: 300, // 5 minute window
          message: `${item.name} complete - Group and push while spike is fresh`,
          timestamp: now
        };
      }
    }

    // Check for level 6 spike
    if (gameState.hero.level === 6 && gameState.hero.level > 0) {
      const lastLevel6 = this.lastItemCompletions.get('level_6') || 0;
      if (Date.now() - lastLevel6 > 60000) {
        this.lastItemCompletions.set('level_6', Date.now());
        
        return {
          type: 'power_spike',
          priority: 'MEDIUM',
          message: 'Level 6 - Ultimate ready, look for fight or objective',
          timestamp: Date.now()
        };
      }
    }

    return null;
  }

  private detectUltimateAdvantage(gameState: ProcessedGameState): PushWindow | null {
    // Count ready ultimates on team vs enemies
    // This is simplified - in reality we'd need full team data
    const playerUltReady = Object.values(gameState.abilities).some(ab => 
      ab.isUltimate && ab.ready
    );

    // Estimate enemy ultimates on cooldown (if we have that data)
    // For now, we'll use a simplified check
    if (playerUltReady && gameState.team.players.length >= 3) {
      return {
        type: 'ultimate_advantage',
        priority: 'MEDIUM',
        message: 'Ultimate advantage - Force fight and take objective',
        timestamp: Date.now()
      };
    }

    return null;
  }

  private detectAegisWindow(gameState: ProcessedGameState): PushWindow | null {
    // Check if player has Aegis
    const hasAegis = gameState.items.allItems.some(item => 
      item.name.toLowerCase().includes('aegis')
    );

    if (hasAegis) {
      return {
        type: 'aegis',
        priority: 'CRITICAL',
        duration: 300, // 5 minutes
        message: 'AEGIS - Go highground NOW before it expires',
        timestamp: Date.now()
      };
    }

    // Check if Roshan is dead and we should take it
    if (!gameState.roshan.alive && gameState.roshan.respawnTime) {
      const timeUntilRespawn = gameState.roshan.respawnTime - gameState.gameTime;
      if (timeUntilRespawn < 60 && timeUntilRespawn > 0) {
        return {
          type: 'aegis',
          priority: 'HIGH',
          message: `Roshan respawning in ${Math.floor(timeUntilRespawn)}s - Secure Aegis`,
          timestamp: Date.now()
        };
      }
    }

    return null;
  }

  private detectCreepWaveWindow(gameState: ProcessedGameState): PushWindow | null {
    // This is simplified - full implementation would track creep positions
    // For now, we'll check if we're near enemy towers with good health/mana
    const enemyBuildings = gameState.buildings[gameState.player.team === 'radiant' ? 'dire' : 'radiant'];
    
    // Check if any enemy T1 or T2 is low
    const lowTowers = [
      ...(enemyBuildings.t1 || []),
      ...(enemyBuildings.t2 || [])
    ].filter(tower => !tower.destroyed && tower.healthPercent < 30 && tower.healthPercent > 0);

    if (lowTowers.length > 0 && gameState.hero.healthPercent > 50) {
      return {
        type: 'creep_wave',
        priority: 'MEDIUM',
        message: `Enemy tower low (${Math.floor(lowTowers[0].healthPercent)}%) - Push to finish it`,
        timestamp: Date.now()
      };
    }

    return null;
  }

  /**
   * Check if we should be pushing right now
   */
  public shouldPush(gameState: ProcessedGameState): boolean {
    const windows = this.detectPushWindows(gameState);
    return windows.some(w => 
      w.priority === 'GAME_ENDING' || 
      w.priority === 'CRITICAL' || 
      w.priority === 'HIGH'
    );
  }
}

export const pushTimingDetector = new PushTimingDetector();

