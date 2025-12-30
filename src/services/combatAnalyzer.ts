/**
 * Real-time combat analyzer - calculates win probabilities during fights
 */

import { ProcessedGameState } from '../types/gameState';
import { CoachingAdvice } from '../types/coaching';
import { winrateTracker } from './winrateTracker';
import { logger } from '../utils/logger';

interface CombatState {
  yourHero: {
    level: number;
    health: number;
    maxHealth: number;
    mana: number;
    maxMana: number;
    netWorth: number;
    items: string[];
    abilities: { name: string; ready: boolean; level: number; isUltimate: boolean }[];
  };
  enemyHero: {
    level: number;
    health?: number;
    maxHealth?: number;
    netWorth: number;
    alive: boolean;
    visible: boolean;
    heroName?: string;
  };
  context: {
    alliesNearby: number;
    enemiesNearby: number;
    yourTeamNW: number;
    enemyTeamNW: number;
  };
}

export class CombatAnalyzer {
  private lastCombatAdvice: number = 0;
  private readonly COMBAT_ADVICE_COOLDOWN = 5000; // 5 seconds between combat advice

  /**
   * Analyze current combat situation and calculate win probability
   */
  public analyzeCombat(gameState: ProcessedGameState): CoachingAdvice | null {
    try {
      const now = Date.now();
      
      // Cooldown check
      if (now - this.lastCombatAdvice < this.COMBAT_ADVICE_COOLDOWN) {
        return null;
      }

      // Check if we're in combat (enemies visible and nearby)
      const visibleEnemies = gameState.enemies.filter(e => e.alive && e.visible);
      if (visibleEnemies.length === 0) {
        return null;
      }

      // Analyze each visible enemy
      for (const enemy of visibleEnemies) {
        const combatState = this.buildCombatState(gameState, enemy);
        const analysis = this.calculateWinProbability(combatState);
        
        // Record prediction for winrate tracking
        winrateTracker.recordPrediction(
          gameState,
          enemy.heroName || enemy.name || 'unknown',
          analysis.winProbability,
          analysis.factors || []
        );
        
        if (analysis.shouldAdvise) {
          this.lastCombatAdvice = now;
          
          // Add winrate context if available
          let advice = analysis.advice;
          const winrate = winrateTracker.getWinrateVsHero(enemy.heroName || enemy.name || '');
          if (winrate > 0) {
            const winratePercent = Math.round(winrate * 100);
            advice += ` (Your winrate vs this hero: ${winratePercent}%)`;
          }
          
          return {
            priority: analysis.priority,
            message: advice,
            action: 'combat_analysis',
            timestamp: Date.now(),
            gameTime: gameState.gameTime
          };
        }
      }

      return null;
    } catch (error) {
      logger.error('Error analyzing combat:', error);
      return null;
    }
  }

  /**
   * Build combat state from game state
   */
  private buildCombatState(gameState: ProcessedGameState, enemy: any): CombatState {
    const yourAbilities = Object.values(gameState.abilities).map(ab => ({
      name: ab.name,
      ready: ab.ready,
      level: ab.level,
      isUltimate: ab.isUltimate
    }));

    const yourItems = gameState.items.inventory.map(i => i.name);

    // Estimate nearby allies/enemies (simplified - would need position data)
    const alliesNearby = Math.max(1, gameState.team.players.length); // Simplified
    const enemiesNearby = gameState.enemies.filter(e => e.alive && e.visible).length;

    return {
      yourHero: {
        level: gameState.hero.level,
        health: gameState.hero.health,
        maxHealth: gameState.hero.maxHealth,
        mana: gameState.hero.mana,
        maxMana: gameState.hero.maxMana,
        netWorth: gameState.player.netWorth,
        items: yourItems,
        abilities: yourAbilities
      },
      enemyHero: {
        level: enemy.level || gameState.hero.level,
        health: undefined, // Not always available
        maxHealth: undefined,
        netWorth: enemy.netWorth,
        alive: enemy.alive,
        visible: enemy.visible,
        heroName: enemy.heroName
      },
      context: {
        alliesNearby,
        enemiesNearby,
        yourTeamNW: gameState.team.netWorth,
        enemyTeamNW: gameState.enemies.reduce((sum, e) => sum + e.netWorth, 0)
      }
    };
  }

  /**
   * Calculate win probability for a combat situation
   */
  private calculateWinProbability(state: CombatState): {
    winProbability: number;
    shouldAdvise: boolean;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    advice: string;
    factors: string[];
  } {
    let winProbability = 0.5; // Start at 50/50
    const factors: string[] = [];

    // Factor 1: Level advantage/disadvantage
    const levelDiff = state.yourHero.level - state.enemyHero.level;
    if (levelDiff >= 3) {
      winProbability += 0.15;
      factors.push('level advantage');
    } else if (levelDiff >= 2) {
      winProbability += 0.10;
      factors.push('level advantage');
    } else if (levelDiff <= -3) {
      winProbability -= 0.20;
      factors.push('level disadvantage');
    } else if (levelDiff <= -2) {
      winProbability -= 0.15;
      factors.push('level disadvantage');
    }

    // Factor 2: Net worth advantage
    const nwDiff = state.yourHero.netWorth - state.enemyHero.netWorth;
    const nwDiffPercent = state.enemyHero.netWorth > 0 ? (nwDiff / state.enemyHero.netWorth) * 100 : 0;
    
    if (nwDiffPercent > 30) {
      winProbability += 0.15;
      factors.push('item advantage');
    } else if (nwDiffPercent > 15) {
      winProbability += 0.10;
      factors.push('item advantage');
    } else if (nwDiffPercent < -30) {
      winProbability -= 0.20;
      factors.push('item disadvantage');
    } else if (nwDiffPercent < -15) {
      winProbability -= 0.15;
      factors.push('item disadvantage');
    }

    // Factor 3: Health percentage
    const yourHealthPercent = (state.yourHero.health / state.yourHero.maxHealth) * 100;
    if (yourHealthPercent < 30) {
      winProbability -= 0.25;
      factors.push('low health');
    } else if (yourHealthPercent < 50) {
      winProbability -= 0.15;
      factors.push('low health');
    } else if (yourHealthPercent > 80) {
      winProbability += 0.10;
      factors.push('high health');
    }

    // Factor 4: Mana availability
    const yourManaPercent = (state.yourHero.mana / state.yourHero.maxMana) * 100;
    const hasUltimate = state.yourHero.abilities.some(ab => ab.isUltimate && ab.ready && ab.level > 0);
    const hasKeyAbilities = state.yourHero.abilities.filter(ab => ab.ready && ab.level > 0).length;

    if (hasUltimate) {
      winProbability += 0.15;
      factors.push('ultimate ready');
    }
    if (yourManaPercent < 20 && !hasUltimate) {
      winProbability -= 0.10;
      factors.push('low mana');
    }
    if (hasKeyAbilities >= 3) {
      winProbability += 0.05;
    }

    // Factor 5: Team numbers
    const numberAdvantage = state.context.alliesNearby - state.context.enemiesNearby;
    if (numberAdvantage >= 2) {
      winProbability += 0.20;
      factors.push('number advantage');
    } else if (numberAdvantage >= 1) {
      winProbability += 0.10;
      factors.push('number advantage');
    } else if (numberAdvantage <= -2) {
      winProbability -= 0.25;
      factors.push('outnumbered');
    } else if (numberAdvantage <= -1) {
      winProbability -= 0.15;
      factors.push('outnumbered');
    }

    // Factor 6: Key items
    const hasBKB = state.yourHero.items.some(i => i.toLowerCase().includes('black_king_bar'));
    const hasBlink = state.yourHero.items.some(i => i.toLowerCase().includes('blink'));
    const hasEscape = hasBlink || state.yourHero.items.some(i => 
      i.toLowerCase().includes('force') || i.toLowerCase().includes('shadow_blade')
    );

    if (hasBKB) {
      winProbability += 0.10;
      factors.push('BKB available');
    }
    if (hasEscape && yourHealthPercent < 50) {
      winProbability += 0.05; // Escape option
    }

    // Factor 7: Hero matchup (simplified - would need full matchup database)
    const matchupBonus = this.getHeroMatchupBonus(state.yourHero, state.enemyHero);
    winProbability += matchupBonus.bonus;
    if (matchupBonus.reason) {
      factors.push(matchupBonus.reason);
    }

    // Clamp probability between 0 and 1
    winProbability = Math.max(0, Math.min(1, winProbability));

    // Determine if we should advise
    const shouldAdvise = winProbability < 0.35 || winProbability > 0.70 || factors.length > 0;
    
    let priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
    if (winProbability < 0.25 || winProbability > 0.85) {
      priority = 'HIGH';
    } else if (winProbability < 0.40 || winProbability > 0.70) {
      priority = 'MEDIUM';
    }

    // Generate advice message
    const winPercent = Math.round(winProbability * 100);
    let advice = `Combat odds: ${winPercent}% chance to win`;
    
    if (winProbability < 0.30) {
      advice = `⚠️ LOW WIN CHANCE (${winPercent}%) - ${factors.join(', ')}. Consider retreating`;
    } else if (winProbability < 0.45) {
      advice = `⚠️ Unfavorable trade (${winPercent}%) - ${factors.join(', ')}. Play carefully`;
    } else if (winProbability > 0.75) {
      advice = `✅ Favorable trade (${winPercent}%) - ${factors.join(', ')}. You should win this`;
    } else if (winProbability > 0.60) {
      advice = `✅ Good odds (${winPercent}%) - ${factors.join(', ')}. Advantage in your favor`;
    } else {
      advice = `⚖️ Even fight (${winPercent}%) - ${factors.join(', ')}. Skill dependent`;
    }

    return {
      winProbability,
      shouldAdvise,
      priority,
      advice,
      factors
    };
  }

  /**
   * Get hero matchup bonus (simplified - would need full matchup database)
   */
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
   * Calculate trade win probability when enemy attacks
   */
  public analyzeTrade(gameState: ProcessedGameState, attackingEnemy: any): CoachingAdvice | null {
    const combatState = this.buildCombatState(gameState, attackingEnemy);
    const analysis = this.calculateWinProbability(combatState);

    if (analysis.winProbability < 0.40) {
      return {
        priority: 'HIGH',
        message: `⚠️ Enemy attacking - ${Math.round(analysis.winProbability * 100)}% win chance. ${analysis.advice.split(' - ')[1] || 'Consider retreating'}`,
        action: 'trade_analysis',
        timestamp: Date.now(),
        gameTime: gameState.gameTime
      };
    }

    return null;
  }
}

export const combatAnalyzer = new CombatAnalyzer();

