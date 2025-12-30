/**
 * Hero-specific advice system - provides tailored advice based on hero identity
 */

import { ProcessedGameState } from '../types/gameState';
import { CoachingAdvice } from '../types/coaching';
import { logger } from '../utils/logger';

interface HeroAdvice {
  message: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  conditions?: (gameState: ProcessedGameState) => boolean;
}

export class HeroSpecificAdvice {
  private readonly HERO_ADVICE: Record<string, HeroAdvice[]> = {
    'npc_dota_hero_antimage': [
      {
        message: 'Focus on farming - AM needs Battle Fury + Manta before fighting',
        priority: 'HIGH',
        conditions: (gs) => gs.gameTime < 1800 && gs.hero.level < 16
      },
      {
        message: 'Use Blink to escape - save it for disengaging, not engaging',
        priority: 'MEDIUM',
        conditions: (gs) => gs.hero.healthPercent < 50 && gs.hero.alive
      },
      {
        message: 'Mana Break is your strength - target high mana heroes first',
        priority: 'MEDIUM',
        conditions: (gs) => gs.enemies.some(e => e.alive)
      }
    ],
    'npc_dota_hero_juggernaut': [
      {
        message: 'Use Blade Fury to dodge spells - activate before stuns',
        priority: 'HIGH',
        conditions: (gs) => gs.hero.healthPercent < 40 && gs.enemies.some(e => e.alive)
      },
      {
        message: 'Omnislash timing - use when enemies are isolated or low HP',
        priority: 'MEDIUM',
        conditions: (gs) => gs.hero.level >= 6 && gs.enemies.some(e => e.alive)
      },
      {
        message: 'Healing Ward placement - hide it behind trees during fights',
        priority: 'LOW',
        conditions: (gs) => gs.hero.healthPercent < 60
      }
    ],
    'npc_dota_hero_phantom_assassin': [
      {
        message: 'Blur passive - you\'re harder to hit, use it to dive',
        priority: 'MEDIUM',
        conditions: (gs) => gs.hero.level >= 6 && gs.enemies.some(e => e.alive)
      },
      {
        message: 'Coup de Grace crits - farm until you have Desolator for maximum damage',
        priority: 'HIGH',
        conditions: (gs) => gs.gameTime < 1500 && gs.hero.level < 12
      },
      {
        message: 'Dagger spam - use it to last hit and harass from distance',
        priority: 'LOW',
        conditions: (gs) => gs.hero.manaPercent > 50 && gs.gameTime < 900
      }
    ],
    'npc_dota_hero_invoker': [
      {
        message: 'Invoke key spells - Tornado + EMP for teamfights, Cold Snap for ganks',
        priority: 'MEDIUM',
        conditions: (gs) => gs.hero.level >= 8 && gs.enemies.some(e => e.alive)
      },
      {
        message: 'Sun Strike setup - coordinate with team stuns for kills',
        priority: 'LOW',
        conditions: (gs) => gs.enemies.some(e => !e.alive && e.respawnSeconds > 0)
      },
      {
        message: 'Forge Spirits for pushing - use them to take towers',
        priority: 'MEDIUM',
        conditions: (gs) => {
          const enemyBuildings = gs.buildings[gs.player.team === 'radiant' ? 'dire' : 'radiant'];
          return (enemyBuildings.t1 || []).some(t => !t.destroyed);
        }
      }
    ],
    'npc_dota_hero_pudge': [
      {
        message: 'Hook from fog - position in trees for surprise hooks',
        priority: 'MEDIUM',
        conditions: (gs) => gs.enemies.some(e => e.alive && e.visible)
      },
      {
        message: 'Rot + Dismember combo - get close before using ult',
        priority: 'HIGH',
        conditions: (gs) => gs.hero.level >= 6 && gs.enemies.some(e => e.alive)
      },
      {
        message: 'Flesh Heap stacks - prioritize kills/assists for tankiness',
        priority: 'LOW',
        conditions: (gs) => gs.player.kills + gs.player.assists < 10
      }
    ],
    'npc_dota_hero_puck': [
      {
        message: 'Phase Shift timing - use it to dodge projectiles and stuns',
        priority: 'HIGH',
        conditions: (gs) => gs.hero.healthPercent < 50 && gs.enemies.some(e => e.alive)
      },
      {
        message: 'Dream Coil setup - use after Blink for teamfight initiation',
        priority: 'MEDIUM',
        conditions: (gs) => gs.hero.level >= 6 && gs.enemies.filter(e => e.alive).length >= 3
      },
      {
        message: 'Illusory Orb + Ethereal Jaunt - escape combo, always keep mana for it',
        priority: 'HIGH',
        conditions: (gs) => gs.hero.manaPercent < 30 && gs.enemies.some(e => e.alive)
      }
    ],
    'npc_dota_hero_storm_spirit': [
      {
        message: 'Ball Lightning mana cost - manage mana carefully, don\'t overuse',
        priority: 'HIGH',
        conditions: (gs) => gs.hero.manaPercent < 40 && gs.hero.level >= 6
      },
      {
        message: 'Overload procs - use Ball Lightning to proc Overload before fights',
        priority: 'MEDIUM',
        conditions: (gs) => gs.hero.level >= 4 && gs.enemies.some(e => e.alive)
      },
      {
        message: 'Electric Vortex - use to catch enemies or interrupt channels',
        priority: 'LOW',
        conditions: (gs) => gs.enemies.some(e => e.alive)
      }
    ],
    'npc_dota_hero_tinker': [
      {
        message: 'Rearm + Boots of Travel - farm globally, push lanes constantly',
        priority: 'HIGH',
        conditions: (gs) => gs.hero.level >= 6 && gs.gameTime > 1200
      },
      {
        message: 'March of the Machines - use to farm jungle and push lanes',
        priority: 'MEDIUM',
        conditions: (gs) => gs.hero.level >= 3 && gs.gameTime < 1800
      },
      {
        message: 'Laser + Heat-Seeking Missile combo - burst down enemies',
        priority: 'MEDIUM',
        conditions: (gs) => gs.hero.level >= 4 && gs.enemies.some(e => e.alive)
      }
    ],
    'npc_dota_hero_crystal_maiden': [
      {
        message: 'Crystal Nova slow - use to kite enemies and secure kills',
        priority: 'MEDIUM',
        conditions: (gs) => gs.enemies.some(e => e.alive)
      },
      {
        message: 'Freezing Field positioning - channel from fog or behind team',
        priority: 'HIGH',
        conditions: (gs) => gs.hero.level >= 6 && gs.enemies.filter(e => e.alive).length >= 2
      },
      {
        message: 'Arcane Aura - stay near team to provide mana regen',
        priority: 'LOW',
        conditions: (gs) => gs.team.players.length > 1
      }
    ],
    'npc_dota_hero_centaur': [
      {
        message: 'Stomp initiation - Blink + Stomp for teamfight control',
        priority: 'MEDIUM',
        conditions: (gs) => gs.hero.level >= 6 && gs.enemies.filter(e => e.alive).length >= 2
      },
      {
        message: 'Return damage - enemies take damage when hitting you',
        priority: 'LOW',
        conditions: (gs) => gs.hero.healthPercent < 70 && gs.enemies.some(e => e.alive)
      },
      {
        message: 'Double Edge - use when you have high HP, enemies have low HP',
        priority: 'MEDIUM',
        conditions: (gs) => gs.hero.healthPercent > 60 && gs.enemies.some(e => e.alive)
      }
    ],
    'npc_dota_hero_earthshaker': [
      {
        message: '5-man Echo Slam = won game - hide for perfect Echo',
        priority: 'HIGH',
        conditions: (gs) => {
          const ultimates = Object.values(gs.abilities).filter(a => a.isUltimate && a.ready && a.level > 0);
          const aliveEnemies = gs.enemies.filter(e => e.alive).length;
          return ultimates.length > 0 && aliveEnemies >= 3;
        }
      },
      {
        message: 'Don\'t show - hide for Echo Slam, surprise is key',
        priority: 'MEDIUM',
        conditions: (gs) => {
          const ultimates = Object.values(gs.abilities).filter(a => a.isUltimate && a.ready && a.level > 0);
          return ultimates.length > 0 && gs.enemies.some(e => e.alive);
        }
      },
      {
        message: 'Fissure to block retreat - secure kills',
        priority: 'MEDIUM',
        conditions: (gs) => gs.enemies.some(e => e.alive && e.visible)
      }
    ],
    'npc_dota_hero_sniper': [
      {
        message: 'Stay back in fights - you\'re squishy, position safely',
        priority: 'HIGH',
        conditions: (gs) => gs.enemies.some(e => e.alive) && gs.hero.healthPercent < 70
      },
      {
        message: 'Assassinate low HP enemies - secure kills from distance',
        priority: 'MEDIUM',
        conditions: (gs) => {
          const ultimates = Object.values(gs.abilities).filter(a => a.isUltimate && a.ready && a.level > 0);
          return ultimates.length > 0 && gs.enemies.some(e => e.alive);
        }
      }
    ],
    'npc_dota_hero_zeus': [
      {
        message: 'Ultimate on low HP enemies - global kill secure',
        priority: 'MEDIUM',
        conditions: (gs) => {
          const ultimates = Object.values(gs.abilities).filter(a => a.isUltimate && a.ready && a.level > 0);
          return ultimates.length > 0 && gs.enemies.some(e => e.alive);
        }
      },
      {
        message: 'Chain Lightning for farm - spam on creeps',
        priority: 'LOW',
        conditions: (gs) => gs.hero.manaPercent > 50 && gs.gameTime < 1200
      }
    ],
    'npc_dota_hero_slardar': [
      {
        message: 'Crush + Bash combo - stunlock enemies',
        priority: 'MEDIUM',
        conditions: (gs) => gs.enemies.some(e => e.alive)
      },
      {
        message: 'Amplify Damage on carry - reduces armor, team focus',
        priority: 'HIGH',
        conditions: (gs) => {
          const ultimates = Object.values(gs.abilities).filter(a => a.isUltimate && a.ready && a.level > 0);
          const enemyCores = gs.enemies.filter(e => e.alive && e.netWorth > gs.team.netWorth * 0.15);
          return ultimates.length > 0 && enemyCores.length > 0;
        }
      }
    ],
    'npc_dota_hero_enigma': [
      {
        message: '5-man Black Hole = won game - wait for perfect opportunity',
        priority: 'CRITICAL',
        conditions: (gs) => {
          const ultimates = Object.values(gs.abilities).filter(a => a.isUltimate && a.ready && a.level > 0);
          const aliveEnemies = gs.enemies.filter(e => e.alive).length;
          return ultimates.length > 0 && aliveEnemies >= 3;
        }
      },
      {
        message: 'Don\'t show - hide for Black Hole, surprise is everything',
        priority: 'HIGH',
        conditions: (gs) => {
          const ultimates = Object.values(gs.abilities).filter(a => a.isUltimate && a.ready && a.level > 0);
          return ultimates.length > 0 && gs.enemies.some(e => e.alive);
        }
      },
      {
        message: 'Midnight Pulse before Black Hole - extra damage',
        priority: 'MEDIUM',
        conditions: (gs) => {
          const ultimates = Object.values(gs.abilities).filter(a => a.isUltimate && a.ready && a.level > 0);
          return ultimates.length > 0 && gs.enemies.some(e => e.alive);
        }
      }
    ],
    'npc_dota_hero_medusa': [
      {
        message: 'Farm until 3 items - you can\'t fight yet',
        priority: 'HIGH',
        conditions: (gs) => {
          const keyItems = ['manta', 'skadi', 'butterfly'];
          const hasItems = keyItems.filter(item => 
            gs.items.allItems.some(i => i.name.toLowerCase().includes(item))
          ).length;
          return hasItems < 2 && gs.gameTime < 2400;
        }
      },
      {
        message: 'Stone Gaze - use when enemies commit, don\'t waste',
        priority: 'HIGH',
        conditions: (gs) => {
          const ultimates = Object.values(gs.abilities).filter(a => a.isUltimate && a.ready && a.level > 0);
          const aliveEnemies = gs.enemies.filter(e => e.alive).length;
          return ultimates.length > 0 && aliveEnemies >= 2;
        }
      }
    ],
    'npc_dota_hero_spectre': [
      {
        message: 'Farm until Radiance + Manta - you scale late',
        priority: 'HIGH',
        conditions: (gs) => {
          const hasRadiance = gs.items.allItems.some(i => i.name.toLowerCase().includes('radiance'));
          const hasManta = gs.items.allItems.some(i => i.name.toLowerCase().includes('manta'));
          return (!hasRadiance || !hasManta) && gs.gameTime < 1800;
        }
      },
      {
        message: 'Haunt on teamfight - global presence, secure kills',
        priority: 'HIGH',
        conditions: (gs) => {
          const ultimates = Object.values(gs.abilities).filter(a => a.isUltimate && a.ready && a.level > 0);
          const aliveEnemies = gs.enemies.filter(e => e.alive).length;
          return ultimates.length > 0 && aliveEnemies >= 2;
        }
      }
    ]
  };

  /**
   * Get hero-specific advice based on current game state
   */
  public getAdvice(gameState: ProcessedGameState): CoachingAdvice | null {
    try {
      const heroName = gameState.hero.name;
      const adviceList = this.HERO_ADVICE[heroName];

      if (!adviceList || adviceList.length === 0) {
        return null;
      }

      // Find advice that matches current conditions
      for (const advice of adviceList) {
        if (!advice.conditions || advice.conditions(gameState)) {
          return {
            priority: advice.priority,
            message: advice.message,
            action: 'hero_specific',
            timestamp: Date.now(),
            gameTime: gameState.gameTime
          };
        }
      }

      // Return first available advice if no conditions match
      if (adviceList.length > 0) {
        const firstAdvice = adviceList[0];
        return {
          priority: firstAdvice.priority,
          message: firstAdvice.message,
          action: 'hero_specific',
          timestamp: Date.now(),
          gameTime: gameState.gameTime
        };
      }

      return null;
    } catch (error) {
      logger.error('Error generating hero-specific advice:', error);
      return null;
    }
  }

  /**
   * Get ability usage tips for current hero
   */
  public getAbilityTips(gameState: ProcessedGameState): CoachingAdvice | null {
    const heroName = gameState.hero.name;
    const abilities = gameState.abilities;
    const gameTime = gameState.gameTime;

    // Check for unused ultimates
    const ultimates = Object.values(abilities).filter(ability => ability.isUltimate);
    const readyUltimates = ultimates.filter(ability => ability.ready && ability.level > 0);

    if (readyUltimates.length > 0 && gameTime > 600) {
      const unusedUltTime = gameTime - (readyUltimates[0].cooldownRemaining || 0);
      if (unusedUltTime > 60 && gameState.enemies.some(e => e.alive)) {
        return {
          priority: 'MEDIUM',
          message: `Ultimate ready (${readyUltimates[0].name}) - look for opportunity to use it`,
          action: 'ability_usage',
          timestamp: Date.now(),
          gameTime: gameState.gameTime
        };
      }
    }

    return null;
  }
}

export const heroSpecificAdvice = new HeroSpecificAdvice();

