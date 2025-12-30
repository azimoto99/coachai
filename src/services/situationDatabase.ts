/**
 * Comprehensive situation database - checks game state for specific situations
 * and provides tailored, actionable advice
 */

import { ProcessedGameState } from '../types/gameState';
import { CoachingAdvice } from '../types/coaching';
import { logger } from '../utils/logger';

interface Situation {
  id: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  check: (gameState: ProcessedGameState) => boolean;
  getAdvice: (gameState: ProcessedGameState) => string | null;
  cooldown?: number; // Seconds before this situation can trigger again
}

export class SituationDatabase {
  private lastTriggered: Map<string, number> = new Map();
  private readonly COOLDOWN_BUFFER = 30; // 30 seconds cooldown between same situation

  private situations: Situation[] = [];

  constructor() {
    this.initializeSituations();
  }

  private initializeSituations(): void {
    // Enemy hero detection situations
    this.situations.push(
      {
        id: 'enemy_riki_detection',
        priority: 'HIGH',
        check: (gs) => {
          // Check draft or enemy names for Riki
          const hasRiki = gs.enemies.some(e => 
            e.heroName?.toLowerCase().includes('riki') ||
            e.name?.toLowerCase().includes('riki')
          );
          const hasDetection = gs.items.allItems.some(i => 
            i.name.toLowerCase().includes('gem') || 
            i.name.toLowerCase().includes('sentry') ||
            i.name.toLowerCase().includes('dust')
          );
          return hasRiki && !hasDetection && gs.gameTime > 300;
        },
        getAdvice: () => 'Enemy Riki detected - buy detection NOW (sentries/dust/gem) or you will die'
      },
      {
        id: 'enemy_clinkz_detection',
        priority: 'HIGH',
        check: (gs) => {
          const hasClinkz = gs.enemies.some(e => 
            e.heroName?.toLowerCase().includes('clinkz') ||
            e.name?.toLowerCase().includes('clinkz')
          );
          const hasDetection = gs.items.allItems.some(i => 
            i.name.toLowerCase().includes('gem') || 
            i.name.toLowerCase().includes('sentry') ||
            i.name.toLowerCase().includes('dust')
          );
          return hasClinkz && !hasDetection && gs.gameTime > 600;
        },
        getAdvice: () => 'Enemy Clinkz - buy detection, he will pick you off without it'
      },
      {
        id: 'enemy_bounty_hunter_detection',
        priority: 'MEDIUM',
        check: (gs) => {
          const hasBH = gs.enemies.some(e => 
            e.heroName?.toLowerCase().includes('bounty') ||
            e.name?.toLowerCase().includes('bounty')
          );
          const hasDetection = gs.items.allItems.some(i => 
            i.name.toLowerCase().includes('gem') || 
            i.name.toLowerCase().includes('sentry') ||
            i.name.toLowerCase().includes('dust')
          );
          return hasBH && !hasDetection && gs.gameTime > 300;
        },
        getAdvice: () => 'Enemy Bounty Hunter - buy sentries to counter Track'
      }
    );

    // Magic damage situations
    this.situations.push(
      {
        id: 'heavy_magic_damage_no_bkb',
        priority: 'HIGH',
        check: (gs) => {
          const magicHeroes = ['zeus', 'lina', 'lion', 'skywrath', 'pugna', 'tinker', 'invoker'];
          const magicThreats = gs.enemies.filter(e => 
            magicHeroes.some(h => e.heroName?.toLowerCase().includes(h)) && e.level && e.level > 8
          );
          const hasBKB = gs.items.allItems.some(i => i.name.toLowerCase().includes('black_king_bar'));
          return magicThreats.length >= 2 && !hasBKB && gs.gameTime > 1200 && gs.player.gold > 3000;
        },
        getAdvice: () => 'Multiple magic damage dealers - build BKB immediately or you will get bursted'
      },
      {
        id: 'enemy_zeus_no_pipe',
        priority: 'MEDIUM',
        check: (gs) => {
          const hasZeus = gs.enemies.some(e => e.heroName?.toLowerCase().includes('zeus'));
          const hasPipe = gs.team.players.some(p => 
            gs.items.allItems.some(i => i.name.toLowerCase().includes('pipe'))
          );
          return hasZeus && !hasPipe && gs.gameTime > 900 && gs.hero.level > 10;
        },
        getAdvice: () => 'Enemy Zeus - team needs Pipe of Insight, suggest to supports/offlane'
      }
    );

    // Physical damage situations
    this.situations.push(
      {
        id: 'heavy_physical_no_armor',
        priority: 'MEDIUM',
        check: (gs) => {
          const physicalHeroes = ['sven', 'pa', 'troll', 'ursa', 'slardar'];
          const physicalThreats = gs.enemies.filter(e => 
            physicalHeroes.some(h => e.heroName?.toLowerCase().includes(h)) && e.level && e.level > 10
          );
          const hasArmor = gs.items.allItems.some(i => 
            i.name.toLowerCase().includes('assault') || 
            i.name.toLowerCase().includes('shivas') ||
            i.name.toLowerCase().includes('crimson')
          );
          return physicalThreats.length >= 2 && !hasArmor && gs.gameTime > 1500;
        },
        getAdvice: () => 'Heavy physical damage - consider armor items (AC, Shivas, Crimson Guard)'
      }
    );

    // Roshan situations
    this.situations.push(
      {
        id: 'roshan_respawning_soon',
        priority: 'HIGH',
        check: (gs) => {
          return !gs.roshan.alive && 
                 gs.roshan.respawnTime !== undefined && 
                 gs.roshan.respawnTime - gs.gameTime < 90 &&
                 gs.roshan.respawnTime - gs.gameTime > 0 &&
                 gs.gameTime > 1200;
        },
        getAdvice: (gs) => {
          const timeLeft = Math.floor((gs.roshan.respawnTime! - gs.gameTime) / 60);
          return `Roshan respawning in ~${timeLeft}min - secure Aegis for highground push`
        }
      },
      {
        id: 'roshan_available_no_aegis',
        priority: 'HIGH',
        check: (gs) => {
          return gs.roshan.alive && 
                 gs.gameTime > 1200 &&
                 gs.enemies.filter(e => !e.alive && !e.buybackAvailable).length >= 2;
        },
        getAdvice: () => 'Roshan available + enemies dead - TAKE ROSHAN NOW for Aegis advantage'
      },
      {
        id: 'enemy_has_aegis_push',
        priority: 'CRITICAL',
        check: (gs) => {
          return gs.roshan.aegisHolder === (gs.player.team === 'radiant' ? 'dire' : 'radiant') &&
                 gs.gameTime > 1200;
        },
        getAdvice: () => 'ENEMY HAS AEGIS - play defensively, don\'t take bad fights, wait for Aegis to expire'
      }
    );

    // Tower situations
    this.situations.push(
      {
        id: 'enemy_tower_low_health',
        priority: 'MEDIUM',
        check: (gs) => {
          const enemyBuildings = gs.buildings[gs.player.team === 'radiant' ? 'dire' : 'radiant'];
          const lowTowers = [
            ...(enemyBuildings.t1 || []),
            ...(enemyBuildings.t2 || [])
          ].filter(t => !t.destroyed && t.healthPercent < 30 && t.healthPercent > 0);
          return lowTowers.length > 0 && gs.hero.healthPercent > 50 && gs.hero.alive;
        },
        getAdvice: (gs) => {
          const enemyBuildings = gs.buildings[gs.player.team === 'radiant' ? 'dire' : 'radiant'];
          const lowTowers = [
            ...(enemyBuildings.t1 || []),
            ...(enemyBuildings.t2 || [])
          ].filter(t => !t.destroyed && t.healthPercent < 30 && t.healthPercent > 0);
          return `Enemy ${lowTowers[0].name} at ${Math.floor(lowTowers[0].healthPercent)}% - finish it NOW before they defend`
        }
      },
      {
        id: 'your_tower_low_health',
        priority: 'HIGH',
        check: (gs) => {
          const yourBuildings = gs.buildings[gs.player.team];
          const lowTowers = [
            ...(yourBuildings.t1 || []),
            ...(yourBuildings.t2 || [])
          ].filter(t => !t.destroyed && t.healthPercent < 40 && t.healthPercent > 0);
          return lowTowers.length > 0 && gs.enemies.some(e => e.alive);
        },
        getAdvice: () => 'Your tower is low - DEFEND IT or TP back, losing towers opens map for enemy'
      }
    );

    // Buyback situations
    this.situations.push(
      {
        id: 'enemy_core_dead_no_buyback',
        priority: 'HIGH',
        check: (gs) => {
          const deadCores = gs.enemies.filter(e => 
            !e.alive && 
            !e.buybackAvailable && 
            e.netWorth > gs.team.netWorth * 0.15
          );
          return deadCores.length >= 1 && gs.gameTime > 1800;
        },
        getAdvice: () => 'Enemy core dead with no buyback - PUSH NOW, this is your window'
      },
      {
        id: 'you_dead_buyback_available',
        priority: 'MEDIUM',
        check: (gs) => {
          return !gs.hero.alive && 
                 gs.hero.buybackAvailable && 
                 gs.gameTime > 1800 &&
                 gs.enemies.some(e => e.alive) &&
                 gs.player.gold >= gs.hero.buybackCost * 1.2;
        },
        getAdvice: (gs) => {
          const enemyCoresAlive = gs.enemies.filter(e => e.alive && e.netWorth > gs.team.netWorth * 0.15).length;
          if (enemyCoresAlive >= 2) {
            return `Buyback available (${Math.floor(gs.hero.buybackCost)} gold) - save it for critical fight`;
          }
          return 'Buyback available - save it for critical fight';
        }
      }
    );

    // Net worth situations
    this.situations.push(
      {
        id: 'large_lead_enemies_dead',
        priority: 'HIGH',
        check: (gs) => {
          const teamNW = gs.team.netWorth;
          const enemyNW = gs.enemies.reduce((sum, e) => sum + e.netWorth, 0);
          const delta = teamNW - enemyNW;
          const deadEnemies = gs.enemies.filter(e => !e.alive).length;
          return delta > 5000 && deadEnemies >= 2 && gs.gameTime > 1500;
        },
        getAdvice: () => 'Large lead + enemies dead - END THE GAME, don\'t throw by farming'
      },
      {
        id: 'behind_networth_farm',
        priority: 'MEDIUM',
        check: (gs) => {
          const teamNW = gs.team.netWorth;
          const enemyNW = gs.enemies.reduce((sum, e) => sum + e.netWorth, 0);
          const delta = teamNW - enemyNW;
          return delta < -3000 && gs.gameTime < 2400 && gs.hero.level < 18;
        },
        getAdvice: () => 'Behind in net worth - focus on safe farming, avoid fights until you catch up'
      }
    );

    // Ability/Ultimate situations
    this.situations.push(
      {
        id: 'ultimate_ready_long_time',
        priority: 'MEDIUM',
        check: (gs) => {
          const ultimates = Object.values(gs.abilities).filter(a => a.isUltimate && a.ready && a.level > 0);
          if (ultimates.length === 0) return false;
          // Check if we've had ult for a while (approximate - would need better tracking)
          return gs.enemies.some(e => e.alive) && gs.gameTime > 600;
        },
        getAdvice: (gs) => {
          const ultimates = Object.values(gs.abilities).filter(a => a.isUltimate && a.ready && a.level > 0);
          if (ultimates.length > 0) {
            return `Ultimate ready (${ultimates[0].name}) - use it in next fight, don't waste it`;
          }
          return 'Ultimate ready - use it in next fight';
        }
      },
      {
        id: 'low_mana_cant_cast',
        priority: 'MEDIUM',
        check: (gs) => {
          const hasImportantSpells = Object.values(gs.abilities).some(a => 
            a.isUltimate && a.level > 0 && !a.ready && a.cooldownRemaining < 30
          );
          return gs.hero.manaPercent < 30 && hasImportantSpells && gs.enemies.some(e => e.alive);
        },
        getAdvice: () => 'Low mana - buy clarities/mangoes, you need mana for next fight'
      }
    );

    // Map control situations
    this.situations.push(
      {
        id: 'no_vision_enemy_side',
        priority: 'MEDIUM',
        check: (gs) => {
          // Simplified check - in real implementation would track ward placement
          const enemyTowersDown = gs.buildings[gs.player.team === 'radiant' ? 'dire' : 'radiant'];
          const t1sDown = (enemyTowersDown.t1 || []).filter(t => t.destroyed).length;
          return t1sDown >= 2 && gs.gameTime > 1200;
        },
        getAdvice: () => 'Enemy T1s down - place wards in their jungle for map control'
      },
      {
        id: 'pushing_highground_no_vision',
        priority: 'HIGH',
        check: (gs) => {
          const enemyBuildings = gs.buildings[gs.player.team === 'radiant' ? 'dire' : 'radiant'];
          const t3sAlive = (enemyBuildings.t3 || []).filter(t => !t.destroyed).length;
          const t2sDown = (enemyBuildings.t2 || []).filter(t => t.destroyed).length;
          return t2sDown >= 2 && t3sAlive > 0 && gs.enemies.some(e => e.alive);
        },
        getAdvice: () => 'Pushing highground - place sentries/wards before going in, vision is critical'
      }
    );

    // Item timing situations
    this.situations.push(
      {
        id: 'close_to_bkb_timing',
        priority: 'MEDIUM',
        check: (gs) => {
          const hasBKB = gs.items.allItems.some(i => i.name.toLowerCase().includes('black_king_bar'));
          const magicThreats = gs.enemies.filter(e => e.level && e.level > 10).length;
          return !hasBKB && gs.player.gold > 3000 && gs.player.gold < 4500 && magicThreats >= 2 && gs.gameTime > 1200;
        },
        getAdvice: () => 'Close to BKB - finish it ASAP, you need magic immunity for next fights'
      },
      {
        id: 'blink_dagger_timing',
        priority: 'MEDIUM',
        check: (gs) => {
          const needsBlink = ['axe', 'centaur', 'tide', 'enigma', 'magnus', 'sand_king'].some(h => 
            gs.hero.name.toLowerCase().includes(h)
          );
          const hasBlink = gs.items.allItems.some(i => i.name.toLowerCase().includes('blink'));
          return needsBlink && !hasBlink && gs.player.gold > 1800 && gs.player.gold < 2500 && gs.gameTime > 600;
        },
        getAdvice: () => 'Blink Dagger timing - finish it for initiation power spike'
      }
    );

    // Teamfight situations
    this.situations.push(
      {
        id: 'teamfight_advantage',
        priority: 'HIGH',
        check: (gs) => {
          const aliveAllies = gs.team.players.length; // Simplified - assume all team players are alive
          const aliveEnemies = gs.enemies.filter(e => e.alive).length;
          const teamNW = gs.team.netWorth;
          const enemyNW = gs.enemies.reduce((sum, e) => sum + e.netWorth, 0);
          return aliveAllies > aliveEnemies && teamNW > enemyNW && gs.gameTime > 900;
        },
        getAdvice: () => 'Teamfight advantage - group and force fight, you have numbers/gold lead'
      },
      {
        id: 'split_push_opportunity',
        priority: 'MEDIUM',
        check: (gs) => {
          const enemiesAlive = gs.enemies.filter(e => e.alive).length;
          const enemyTowers = gs.buildings[gs.player.team === 'radiant' ? 'dire' : 'radiant'];
          const t2sAlive = (enemyTowers.t2 || []).filter(t => !t.destroyed).length;
          const canSplitPush = ['natures_prophet', 'tinker', 'arc_warden', 'broodmother'].some(h =>
            gs.hero.name.toLowerCase().includes(h)
          );
          return enemiesAlive <= 2 && t2sAlive > 0 && canSplitPush && gs.hero.alive;
        },
        getAdvice: () => 'Enemies grouped - split push opposite lane, create pressure'
      }
    );

    // Laning situations
    this.situations.push(
      {
        id: 'losing_lane_cs',
        priority: 'MEDIUM',
        check: (gs) => {
          const minute = Math.floor(gs.gameTime / 60);
          const expectedCS = minute <= 5 ? 38 : minute <= 10 ? 82 : minute <= 15 ? 120 : 160;
          return gs.gameTime < 900 && gs.player.lastHits < expectedCS * 0.6;
        },
        getAdvice: () => 'Losing lane - focus on last hits, don\'t trade unnecessarily'
      },
      {
        id: 'winning_lane_pressure',
        priority: 'MEDIUM',
        check: (gs) => {
          const enemyLaneOpponent = gs.enemies.find(e => e.alive);
          if (!enemyLaneOpponent) return false;
          const minute = Math.floor(gs.gameTime / 60);
          const expectedCS = minute <= 5 ? 38 : minute <= 10 ? 82 : minute <= 15 ? 120 : 160;
          return gs.gameTime < 900 && 
                 gs.player.lastHits > expectedCS * 0.8 && 
                 gs.hero.level > (enemyLaneOpponent.level || 0);
        },
        getAdvice: () => 'Winning lane - pressure enemy, deny creeps, call for gank'
      }
    );

    // Power spike situations
    this.situations.push(
      {
        id: 'level_6_power_spike',
        priority: 'MEDIUM',
        check: (gs) => {
          return gs.hero.level === 6 && 
                 gs.gameTime < 600 &&
                 Object.values(gs.abilities).some(a => a.isUltimate && a.level === 1);
        },
        getAdvice: () => 'Level 6 power spike - use ultimate to secure kill or force enemy out of lane'
      },
      {
        id: 'key_item_timing',
        priority: 'HIGH',
        check: (gs) => {
          const keyItems = ['battle_fury', 'radiance', 'blink', 'black_king_bar'];
          const hasKeyItem = keyItems.some(item => 
            gs.items.allItems.some(i => i.name.toLowerCase().includes(item))
          );
          const justGotItem = gs.items.allItems.some(i => 
            keyItems.some(ki => i.name.toLowerCase().includes(ki))
          );
          return justGotItem && gs.gameTime > 600 && gs.enemies.some(e => e.alive);
        },
        getAdvice: () => 'Key item completed - this is your power spike, look for fight/objective'
      },
      {
        id: 'level_12_talent_spike',
        priority: 'MEDIUM',
        check: (gs) => {
          return gs.hero.level === 12 && gs.gameTime >= 600 && gs.gameTime < 1800;
        },
        getAdvice: () => 'Level 12 talent unlocked - significant power increase, look for plays'
      },
      {
        id: 'level_20_talent_spike',
        priority: 'HIGH',
        check: (gs) => {
          return gs.hero.level === 20 && gs.gameTime >= 1200;
        },
        getAdvice: () => 'Level 20 talent - major power spike, force objectives'
      }
    );

    // Anti-throw situations
    this.situations.push(
      {
        id: 'dont_chase_kills',
        priority: 'HIGH',
        check: (gs) => {
          const teamNW = gs.team.netWorth;
          const enemyNW = gs.enemies.reduce((sum, e) => sum + e.netWorth, 0);
          const delta = teamNW - enemyNW;
          const deadEnemies = gs.enemies.filter(e => !e.alive).length;
          return delta > 5000 && deadEnemies >= 1 && gs.hero.healthPercent < 50 && gs.gameTime > 900;
        },
        getAdvice: () => 'DON\'T CHASE - take objective instead, kill doesn\'t matter'
      },
      {
        id: 'back_after_objective',
        priority: 'HIGH',
        check: (gs) => {
          const enemyBuildings = gs.buildings[gs.player.team === 'radiant' ? 'dire' : 'radiant'];
          const recentTowerKill = (enemyBuildings.t1 || []).concat(enemyBuildings.t2 || [])
            .some(t => t.destroyed);
          return recentTowerKill && gs.hero.healthPercent < 40 && gs.hero.alive && gs.gameTime > 600;
        },
        getAdvice: () => 'Low health after objective - BACK and heal, don\'t throw the advantage'
      },
      {
        id: 'dont_dive_fountain',
        priority: 'CRITICAL',
        check: (gs) => {
          const enemyBuildings = gs.buildings[gs.player.team === 'radiant' ? 'dire' : 'radiant'];
          const allT3sDown = (enemyBuildings.t3 || []).every(t => t.destroyed);
          const barracksDown = (enemyBuildings.barracks || []).filter(b => !b.destroyed).length === 0;
          return allT3sDown && barracksDown && gs.enemies.some(e => e.alive) && gs.gameTime > 1800;
        },
        getAdvice: () => 'Don\'t dive fountain - take Ancient instead, diving = throw'
      },
      {
        id: 'huge_lead_dont_force',
        priority: 'HIGH',
        check: (gs) => {
          const teamNW = gs.team.netWorth;
          const enemyNW = gs.enemies.reduce((sum, e) => sum + e.netWorth, 0);
          const delta = teamNW - enemyNW;
          return delta > 20000 && gs.gameTime > 1500;
        },
        getAdvice: () => 'You\'re ahead 20k - play safe, don\'t force bad fights, one mistake = lose lead'
      }
    );

    // More tower situations
    this.situations.push(
      {
        id: 'push_t1_mid_4_dead',
        priority: 'HIGH',
        check: (gs) => {
          const deadEnemies = gs.enemies.filter(e => !e.alive).length;
          const enemyBuildings = gs.buildings[gs.player.team === 'radiant' ? 'dire' : 'radiant'];
          const midT1 = (enemyBuildings.t1 || []).find(t => t.name.toLowerCase().includes('mid'));
          if (!midT1) return false;
          return deadEnemies >= 4 && !midT1.destroyed && gs.hero.alive;
        },
        getAdvice: () => 'Push T1 mid NOW - 4 enemies dead, free tower'
      },
      {
        id: 'take_t2_and_back',
        priority: 'MEDIUM',
        check: (gs) => {
          const enemyBuildings = gs.buildings[gs.player.team === 'radiant' ? 'dire' : 'radiant'];
          const t2s = enemyBuildings.t2 || [];
          const lowT2s = t2s.filter(t => !t.destroyed && t.healthPercent < 30 && t.healthPercent > 0);
          const t3sAlive = (enemyBuildings.t3 || []).filter(t => !t.destroyed).length;
          return lowT2s.length > 0 && t3sAlive > 0 && gs.hero.healthPercent < 60;
        },
        getAdvice: () => 'Take T2 and back - don\'t go high ground, heal first'
      },
      {
        id: 'siege_t3_with_aegis',
        priority: 'CRITICAL',
        check: (gs) => {
          const hasAegis = gs.roshan.aegisHolder === gs.player.team;
          const enemyBuildings = gs.buildings[gs.player.team === 'radiant' ? 'dire' : 'radiant'];
          const t3sAlive = (enemyBuildings.t3 || []).filter(t => !t.destroyed).length;
          return hasAegis && t3sAlive > 0 && gs.gameTime > 1200;
        },
        getAdvice: () => 'Siege T3 - you have Aegis, force high ground'
      }
    );

    // More Roshan situations
    this.situations.push(
      {
        id: 'rosh_3_dead_60_sec_window',
        priority: 'HIGH',
        check: (gs) => {
          const deadEnemies = gs.enemies.filter(e => !e.alive).length;
          const respawnTimes = gs.enemies.filter(e => !e.alive).map(e => e.respawnSeconds);
          const minRespawn = respawnTimes.length > 0 ? Math.min(...respawnTimes) : 999;
          return gs.roshan.alive && deadEnemies >= 3 && minRespawn >= 60 && gs.gameTime > 1200;
        },
        getAdvice: () => 'Rosh available - 3 enemies dead, 60 sec window, TAKE IT'
      },
      {
        id: 'dont_rosh_no_vision',
        priority: 'CRITICAL',
        check: (gs) => {
          const hasVision = gs.items.allItems.some(i => 
            i.name.toLowerCase().includes('ward') || 
            i.name.toLowerCase().includes('gem')
          );
          const aliveEnemies = gs.enemies.filter(e => e.alive).length;
          return gs.roshan.alive && !hasVision && aliveEnemies >= 3 && gs.gameTime > 1200;
        },
        getAdvice: () => 'DON\'T ROSH - no vision, enemy smoked, this is how you throw'
      },
      {
        id: 'rosh_respawn_30_sec',
        priority: 'MEDIUM',
        check: (gs) => {
          return !gs.roshan.alive && 
                 gs.roshan.respawnTime !== undefined && 
                 gs.roshan.respawnTime - gs.gameTime <= 30 &&
                 gs.roshan.respawnTime - gs.gameTime > 0 &&
                 gs.gameTime > 1200;
        },
        getAdvice: () => 'Rosh respawning in 30 seconds - position near pit'
      }
    );

    // More buyback situations
    this.situations.push(
      {
        id: 'enemy_no_buyback_end_game',
        priority: 'CRITICAL',
        check: (gs) => {
          const enemiesNoBuyback = gs.enemies.filter(e => 
            !e.buybackAvailable && e.netWorth > gs.team.netWorth * 0.15
          );
          const deadEnemies = gs.enemies.filter(e => !e.alive).length;
          return enemiesNoBuyback.length >= 1 && deadEnemies >= 1 && gs.gameTime > 2400;
        },
        getAdvice: () => 'Enemy core no buyback - kill and END GAME, this is the window'
      },
      {
        id: 'save_buyback_ancient',
        priority: 'HIGH',
        check: (gs) => {
          const yourBuildings = gs.buildings[gs.player.team];
          const enemyT3s = gs.buildings[gs.player.team === 'radiant' ? 'dire' : 'radiant'].t3 || [];
          const enemyT3sAlive = enemyT3s.filter(t => !t.destroyed).length;
          return gs.hero.buybackAvailable && enemyT3sAlive === 0 && gs.gameTime > 2400;
        },
        getAdvice: () => 'Save buyback - only use to defend Ancient or end game'
      }
    );

    // More net worth situations
    this.situations.push(
      {
        id: 'massive_lead_end_game',
        priority: 'CRITICAL',
        check: (gs) => {
          const teamNW = gs.team.netWorth;
          const enemyNW = gs.enemies.reduce((sum, e) => sum + e.netWorth, 0);
          const delta = teamNW - enemyNW;
          const deadEnemies = gs.enemies.filter(e => !e.alive).length;
          return delta > 15000 && deadEnemies >= 2 && gs.gameTime > 2400;
        },
        getAdvice: () => 'MASSIVE LEAD + enemies dead - END GAME NOW, don\'t farm'
      },
      {
        id: 'behind_smoke_gank',
        priority: 'MEDIUM',
        check: (gs) => {
          const teamNW = gs.team.netWorth;
          const enemyNW = gs.enemies.reduce((sum, e) => sum + e.netWorth, 0);
          const delta = teamNW - enemyNW;
          return delta < -5000 && gs.gameTime > 1200 && gs.gameTime < 2400;
        },
        getAdvice: () => 'Behind in net worth - smoke gank enemy carry, need pick off'
      }
    );

    // More teamfight situations
    this.situations.push(
      {
        id: 'all_ultimates_ready',
        priority: 'HIGH',
        check: (gs) => {
          const ultimatesReady = Object.values(gs.abilities).filter(a => 
            a.isUltimate && a.ready && a.level > 0
          ).length;
          const aliveEnemies = gs.enemies.filter(e => e.alive).length;
          return ultimatesReady >= 2 && aliveEnemies >= 3 && gs.gameTime > 900;
        },
        getAdvice: () => 'All ultimates ready - force fight NOW, you have advantage'
      },
      {
        id: 'enemy_bkb_cooldown',
        priority: 'MEDIUM',
        check: (gs) => {
          // Simplified - would need to track enemy BKB usage
          const teamNW = gs.team.netWorth;
          const enemyNW = gs.enemies.reduce((sum, e) => sum + e.netWorth, 0);
          return teamNW > enemyNW && gs.enemies.some(e => e.alive) && gs.gameTime > 1200;
        },
        getAdvice: () => 'Enemy BKB likely on CD - fight NOW before they get it back'
      },
      {
        id: 'disengage_fight_lost',
        priority: 'HIGH',
        check: (gs) => {
          const teamNW = gs.team.netWorth;
          const enemyNW = gs.enemies.reduce((sum, e) => sum + e.netWorth, 0);
          const delta = teamNW - enemyNW;
          const deadAllies = gs.team.players.length - gs.enemies.filter(e => !e.alive).length;
          const aliveEnemies = gs.enemies.filter(e => e.alive).length;
          return delta < -3000 && aliveEnemies >= 3 && gs.hero.healthPercent < 40;
        },
        getAdvice: () => 'Disengage NOW - fight lost, back and regroup'
      }
    );

    // More hero-specific situations
    this.situations.push(
      {
        id: 'antimage_farm_until_items',
        priority: 'MEDIUM',
        check: (gs) => {
          const isAM = gs.hero.name.toLowerCase().includes('antimage');
          const hasBF = gs.items.allItems.some(i => i.name.toLowerCase().includes('battle_fury'));
          const hasManta = gs.items.allItems.some(i => i.name.toLowerCase().includes('manta'));
          return isAM && (!hasBF || !hasManta) && gs.gameTime < 1800;
        },
        getAdvice: () => 'Farm until BF + Manta - you can\'t fight yet, focus farm'
      },
      {
        id: 'invoker_level_16_combo',
        priority: 'HIGH',
        check: (gs) => {
          const isInvoker = gs.hero.name.toLowerCase().includes('invoker');
          return isInvoker && gs.hero.level >= 16 && gs.gameTime > 900;
        },
        getAdvice: () => 'Level 16 - full combo available, Tornado + Meteor on 3+ = won fight'
      },
      {
        id: 'pudge_hook_carry',
        priority: 'MEDIUM',
        check: (gs) => {
          const isPudge = gs.hero.name.toLowerCase().includes('pudge');
          const enemyCores = gs.enemies.filter(e => 
            e.alive && e.netWorth > gs.team.netWorth * 0.15
          );
          return isPudge && enemyCores.length > 0 && gs.gameTime > 600;
        },
        getAdvice: () => 'Hook enemy carry - instant 4v5, game-winning pick'
      },
      {
        id: 'crystal_maiden_ult_positioning',
        priority: 'HIGH',
        check: (gs) => {
          const isCM = gs.hero.name.toLowerCase().includes('crystal') || 
                      gs.hero.name.toLowerCase().includes('maiden');
          const ultimates = Object.values(gs.abilities).filter(a => 
            a.isUltimate && a.ready && a.level > 0
          );
          const aliveEnemies = gs.enemies.filter(e => e.alive).length;
          return isCM && ultimates.length > 0 && aliveEnemies >= 2 && gs.gameTime > 600;
        },
        getAdvice: () => 'Ultimate behind trees - enemy no vision, stay fog until ult'
      }
    );

    // Timing-based situations
    this.situations.push(
      {
        id: '10min_mark_stack_camps',
        priority: 'LOW',
        check: (gs) => {
          const gameTime = gs.gameTime;
          return gameTime >= 600 && gameTime <= 610;
        },
        getAdvice: () => '10min mark - support stack camps for carry'
      },
      {
        id: '20min_mark_aegis_available',
        priority: 'MEDIUM',
        check: (gs) => {
          const gameTime = gs.gameTime;
          return gameTime >= 1200 && gameTime <= 1210;
        },
        getAdvice: () => '20min mark - Aegis available, position for Roshan'
      },
      {
        id: '35min_plus_critical_deaths',
        priority: 'HIGH',
        check: (gs) => {
          return gs.gameTime > 2100;
        },
        getAdvice: () => '35min+ - every death critical, play for pickoffs only'
      }
    );
  }

  private getHeroMatchupBonus(yourHero: any, enemyHero: any): { bonus: number; reason?: string } {
    // Simplified matchup knowledge
    const yourHeroName = yourHero.name?.toLowerCase() || '';
    const enemyHeroName = enemyHero.heroName?.toLowerCase() || '';

    // Some basic matchup knowledge
    const favorableMatchups: Record<string, string[]> = {
      'antimage': ['zeus', 'storm', 'queenofpain', 'tinker'],
      'pudge': ['sniper', 'drow', 'crystal_maiden'],
      'puck': ['melee_heroes'],
      'storm_spirit': ['squishy_heroes'],
    };

    const unfavorableMatchups: Record<string, string[]> = {
      'antimage': ['slardar', 'bloodseeker'],
      'pudge': ['pugna', 'tinker'],
      'storm_spirit': ['silencer', 'doom'],
    };

    // Check favorable matchups
    for (const [hero, counters] of Object.entries(favorableMatchups)) {
      if (yourHeroName.includes(hero)) {
        if (counters.some(c => enemyHeroName.includes(c))) {
          return { bonus: 0.10, reason: 'favorable matchup' };
        }
      }
    }

    // Check unfavorable matchups
    for (const [hero, counters] of Object.entries(unfavorableMatchups)) {
      if (yourHeroName.includes(hero)) {
        if (counters.some(c => enemyHeroName.includes(c))) {
          return { bonus: -0.15, reason: 'unfavorable matchup' };
        }
      }
    }

    return { bonus: 0 };
  }

  /**
   * Check all situations and return the highest priority advice
   */
  public checkSituations(gameState: ProcessedGameState): CoachingAdvice | null {
    try {
      const now = Date.now();
      const validSituations = this.situations.filter(situation => {
        // Check cooldown
        const lastTriggered = this.lastTriggered.get(situation.id) || 0;
        const cooldownMs = (situation.cooldown || this.COOLDOWN_BUFFER) * 1000;
        if (now - lastTriggered < cooldownMs) {
          return false;
        }

        // Check if situation applies
        try {
          return situation.check(gameState);
        } catch (error) {
          logger.error(`Error checking situation ${situation.id}:`, error);
          return false;
        }
      });

      if (validSituations.length === 0) {
        return null;
      }

      // Sort by priority (CRITICAL > HIGH > MEDIUM > LOW)
      const priorityOrder: Record<string, number> = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
      validSituations.sort((a, b) => 
        (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0)
      );

      const topSituation = validSituations[0];
      const advice = topSituation.getAdvice(gameState);

      if (!advice) {
        return null;
      }

      // Record trigger time
      this.lastTriggered.set(topSituation.id, now);

      return {
        priority: topSituation.priority === 'CRITICAL' ? 'CRITICAL' : topSituation.priority,
        message: advice,
        action: 'situational',
        timestamp: Date.now(),
        gameTime: gameState.gameTime
      };
    } catch (error) {
      logger.error('Error checking situations:', error);
      return null;
    }
  }

  /**
   * Clear cooldowns (for new game)
   */
  public clearCooldowns(): void {
    this.lastTriggered.clear();
  }
}

export const situationDatabase = new SituationDatabase();

