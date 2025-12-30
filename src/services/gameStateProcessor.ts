/**
 * Processes raw GSI payload into structured game state
 */

import {
  GSIPayload,
  ProcessedGameState,
  ProcessedPlayer,
  ProcessedHero,
  ProcessedTeam,
  ProcessedEnemy,
  ProcessedBuildings,
  ProcessedRoshan,
  ProcessedItems,
  ProcessedAbilities,
  ProcessedBuilding,
  MapState
} from '../types/gameState';
import { logger } from '../utils/logger';

class GameStateProcessor {
  /**
   * Process raw GSI payload into structured game state
   */
  public process(payload: GSIPayload): ProcessedGameState | null {
    try {
      if (!payload.map || !payload.player) {
        logger.debug('Incomplete GSI payload - missing map or player data');
        return null;
      }

      const player = this.processPlayer(payload);
      const hero = this.processHero(payload);
      const team = this.processTeam(payload);
      const enemies = this.processEnemies(payload);
      const buildings = this.processBuildings(payload);
      const roshan = this.processRoshan(payload);
      const items = this.processItems(payload);
      const abilities = this.processAbilities(payload);

      return {
        gameTime: payload.map.game_time || 0,
        clockTime: payload.map.clock_time || 0,
        gameState: payload.map.game_state || 'UNKNOWN',
        isDaytime: payload.map.daytime !== false,
        player,
        hero,
        team,
        enemies,
        buildings,
        roshan,
        items,
        abilities
      };
    } catch (error) {
      logger.error('Error processing game state:', error);
      return null;
    }
  }

  private processPlayer(payload: GSIPayload): ProcessedPlayer {
    const player = payload.player!;
    const team = player.team_name?.toLowerCase() === 'dire' ? 'dire' : 'radiant';

    return {
      steamId: player.steamid || '',
      name: player.name || 'Unknown',
      kills: player.kills || 0,
      deaths: player.deaths || 0,
      assists: player.assists || 0,
      lastHits: player.last_hits || 0,
      denies: player.denies || 0,
      gold: player.gold || 0,
      goldReliable: player.gold_reliable || 0,
      goldUnreliable: player.gold_unreliable || 0,
      netWorth: player.net_worth || 0,
      gpm: player.gpm || 0,
      xpm: player.xpm || 0,
      team
    };
  }

  private processHero(payload: GSIPayload): ProcessedHero {
    const hero = payload.hero || {} as any;

    return {
      id: hero.id || 0,
      name: hero.name || 'unknown',
      level: hero.level || 1,
      x: hero.xpos || 0,
      y: hero.ypos || 0,
      alive: hero.alive !== false,
      respawnSeconds: hero.respawn_seconds || 0,
      buybackCost: hero.buyback_cost || 0,
      buybackAvailable: hero.buyback_cooldown === 0,
      health: hero.health || 0,
      maxHealth: hero.max_health || 0,
      healthPercent: hero.health_percent || 0,
      mana: hero.mana || 0,
      maxMana: hero.max_mana || 0,
      manaPercent: hero.mana_percent || 0,
      magicImmune: hero.magicimmune === true,
      hasAghanimsScepter: hero.aghanims_scepter === true,
      hasAghanimsShard: hero.aghanims_shard === true
    };
  }

  private processTeam(payload: GSIPayload): ProcessedTeam {
    const allPlayers = payload.allplayers || [];
    const playerTeam = payload.player?.team_name?.toLowerCase() || 'radiant';
    
    const teamPlayers = allPlayers
      .filter(p => p.team_name?.toLowerCase() === playerTeam)
      .map(p => ({
        steamId: p.steamid || '',
        name: p.name || 'Unknown',
        kills: p.kills || 0,
        deaths: p.deaths || 0,
        assists: p.assists || 0,
        lastHits: p.last_hits || 0,
        denies: p.denies || 0,
        gold: p.gold || 0,
        goldReliable: p.gold_reliable || 0,
        goldUnreliable: p.gold_unreliable || 0,
        netWorth: p.net_worth || 0,
        gpm: p.gpm || 0,
        xpm: p.xpm || 0,
        team: playerTeam as 'radiant' | 'dire'
      }));

    return {
      players: teamPlayers,
      netWorth: teamPlayers.reduce((sum, p) => sum + p.netWorth, 0),
      totalKills: teamPlayers.reduce((sum, p) => sum + p.kills, 0),
      totalDeaths: teamPlayers.reduce((sum, p) => sum + p.deaths, 0)
    };
  }

  private processEnemies(payload: GSIPayload): ProcessedEnemy[] {
    const allPlayers = payload.allplayers || [];
    const playerTeam = payload.player?.team_name?.toLowerCase() || 'radiant';
    const enemyTeam = playerTeam === 'radiant' ? 'dire' : 'radiant';

    return allPlayers
      .filter(p => p.team_name?.toLowerCase() === enemyTeam)
      .map(p => ({
        steamId: p.steamid || '',
        name: p.name || 'Unknown',
        heroId: undefined, // Not always available in GSI
        heroName: undefined,
        level: undefined,
        alive: p.respawn_seconds === undefined || p.respawn_seconds === 0,
        respawnSeconds: p.respawn_seconds || 0,
        buybackAvailable: p.buyback_cooldown === 0,
        buybackCost: p.buyback_cost || 0,
        position: p.position,
        visible: p.position !== undefined, // If we have position, they're visible
        kills: p.kills || 0,
        deaths: p.deaths || 0,
        netWorth: p.net_worth || 0
      }));
  }

  private processBuildings(payload: GSIPayload): ProcessedBuildings {
    const buildings = payload.buildings || {};
    const playerTeam = payload.player?.team_name?.toLowerCase() || 'radiant';
    const enemyTeam = playerTeam === 'radiant' ? 'dire' : 'radiant';

    const processBuildingSet = (buildingSet: any): any => {
      if (!buildingSet) return {};

      const processed: any = {
        ancient: undefined,
        t4: [],
        t3: [],
        t2: [],
        t1: [],
        barracks: []
      };

      for (const [key, building] of Object.entries(buildingSet)) {
        const b = building as any;
        const health = b.health || 0;
        const maxHealth = b.max_health || 0;
        const destroyed = health === 0;

        const processedBuilding: ProcessedBuilding = {
          name: key,
          health,
          maxHealth,
          healthPercent: maxHealth > 0 ? (health / maxHealth) * 100 : 0,
          destroyed
        };

        // Categorize buildings
        if (key.includes('ancient')) {
          processed.ancient = processedBuilding;
        } else if (key.includes('t4')) {
          processed.t4.push(processedBuilding);
        } else if (key.includes('t3')) {
          processed.t3.push(processedBuilding);
        } else if (key.includes('t2')) {
          processed.t2.push(processedBuilding);
        } else if (key.includes('t1')) {
          processed.t1.push(processedBuilding);
        } else if (key.includes('barracks')) {
          processed.barracks.push(processedBuilding);
        }
      }

      return processed;
    };

    return {
      radiant: processBuildingSet(buildings.radiant),
      dire: processBuildingSet(buildings.dire)
    };
  }

  private processRoshan(payload: GSIPayload): ProcessedRoshan {
    const map: MapState = payload.map || {} as MapState;
    const roshanState = map.roshan_state || '';
    const roshanStateEndSeconds = map.roshan_state_end_seconds || 0;

    // Roshan state can be: "alive", "dead", "respawn_timer"
    const alive = roshanState === 'alive';
    const respawnTime = roshanState === 'respawn_timer' ? roshanStateEndSeconds : undefined;

    // Determine Aegis holder (if any)
    let aegisHolder: 'radiant' | 'dire' | null = null;
    // This would need to be tracked separately or inferred from item data
    // For now, we'll leave it as null and track it in the coaching engine

    return {
      alive,
      respawnTime,
      aegisHolder
    };
  }

  private processItems(payload: GSIPayload): ProcessedItems {
    const items = payload.items || {};
    const inventory: any[] = [];
    const stash: any[] = [];
    const backpack: any[] = [];

    for (const [slot, item] of Object.entries(items)) {
      const itemData = item as any;
      const processedItem = {
        name: itemData.name || slot,
        slot: slot,
        canCast: itemData.can_cast === true,
        cooldown: itemData.cooldown || 0,
        charges: itemData.charges
      };

      if (slot.startsWith('slot')) {
        inventory.push(processedItem);
      } else if (slot.startsWith('stash')) {
        stash.push(processedItem);
      } else if (slot.startsWith('backpack')) {
        backpack.push(processedItem);
      }
    }

    return {
      inventory,
      stash,
      backpack,
      allItems: [...inventory, ...stash, ...backpack]
    };
  }

  private processAbilities(payload: GSIPayload): ProcessedAbilities {
    const abilities = payload.abilities || {};
    const processed: ProcessedAbilities = {};

    for (const [key, ability] of Object.entries(abilities)) {
      const ab = ability as any;
      processed[key] = {
        name: ab.name || key,
        level: ab.level || 0,
        canCast: ab.can_cast === true,
        cooldown: ab.cooldown || 0,
        cooldownRemaining: ab.cooldown || 0,
        isUltimate: ab.ultimate === true,
        ready: ab.cooldown === 0 && ab.can_cast === true
      };
    }

    return processed;
  }
}

export const gameStateProcessor = new GameStateProcessor();

