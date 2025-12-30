/**
 * Main coaching engine that orchestrates all coaching logic
 */

import { ProcessedGameState } from '../types/gameState';
import { CoachingAdvice, GamePhase, MessagePriority } from '../types/coaching';
import { winConditionAnalyzer } from './winConditionAnalyzer';
import { pushTimingDetector } from './pushTimingDetector';
import { antiThrowSystem } from './antiThrowSystem';
import { phaseCoaching } from './phaseCoaching';
import { confidenceCalculator } from './confidenceCalculator';
import { netWorthTracker } from './netWorthTracker';
import { messageFormatter } from './messageFormatter';
import { postGameAnalyzer } from './postGameAnalyzer';
import { playerTrustCalibrator } from './playerTrustCalibrator';
import { doNothingDetector } from './doNothingDetector';
import { itemBuildAdvisor } from './itemBuildAdvisor';
import { heroSpecificAdvice } from './heroSpecificAdvice';
import { situationDatabase } from './situationDatabase';
import { combatAnalyzer } from './combatAnalyzer';
import { laningCoach } from './laningCoach';
import { midgameCoach } from './midgameCoach';
import { lategameCoach } from './lategameCoach';
import { GAME_PHASES, CS_TARGETS } from '../config/constants';
import { logger } from '../utils/logger';

export class CoachingEngine {
  private lastAdviceTime: number = 0;
  private winConditionAnalysis: any = null;
  private gamePhase: GamePhase = 'laning';
  private lastNetWorthAnalysis: any = null;

  /**
   * Generate coaching advice based on current game state
   */
  public generateAdvice(gameState: ProcessedGameState): CoachingAdvice | null {
    try {
      // Update game phase
      this.gamePhase = this.determineGamePhase(gameState.gameTime);

      // Track net worth delta (core signal)
      this.lastNetWorthAnalysis = netWorthTracker.analyze(gameState);

      // Update win condition analysis (re-analyze periodically)
      if (!this.winConditionAnalysis || Math.random() < 0.1) {
        this.winConditionAnalysis = winConditionAnalyzer.analyze(gameState);
        logger.debug(`Win condition: ${this.winConditionAnalysis.primaryCondition}`);
      }

      // Priority 1: Combat analysis (real-time fight calculations)
      const combatAdvice = combatAnalyzer.analyzeCombat(gameState);
      if (combatAdvice) {
        const enriched = this.enrichAdvice(combatAdvice, gameState, 'combat');
        if (enriched) return enriched;
      }

      // Priority 2: Phase-specific coaching (laning/mid/late game)
      const gameTime = gameState.gameTime;
      if (gameTime < 600) {
        // Laning phase (0-10 min)
        const laningAdvice = laningCoach.getAdvice(gameState);
        if (laningAdvice) {
          const enriched = this.enrichAdvice(laningAdvice, gameState, 'laning');
          if (enriched) return enriched;
        }
      } else if (gameTime >= 600 && gameTime < 1800) {
        // Mid game (10-30 min)
        const midgameAdvice = midgameCoach.getAdvice(gameState);
        if (midgameAdvice) {
          const enriched = this.enrichAdvice(midgameAdvice, gameState, 'midgame');
          if (enriched) return enriched;
        }
      } else {
        // Late game (30+ min)
        const lategameAdvice = lategameCoach.getAdvice(gameState);
        if (lategameAdvice) {
          const enriched = this.enrichAdvice(lategameAdvice, gameState, 'lategame');
          if (enriched) return enriched;
        }
      }

      // Priority 3: Situation database (comprehensive situational checks)
      const situationAdvice = situationDatabase.checkSituations(gameState);
      if (situationAdvice) {
        const enriched = this.enrichAdvice(situationAdvice, gameState, 'situational');
        if (enriched) return enriched;
      }

      // Priority 3: Anti-throw warnings (highest priority)
      const throwWarning = antiThrowSystem.checkThrowScenarios(gameState);
      if (throwWarning) {
        const advice = this.enrichAdvice(throwWarning, gameState, 'anti_throw');
        if (advice) return advice;
      }

      // Priority 3: Push windows (game-ending opportunities)
      const pushWindows = pushTimingDetector.detectPushWindows(gameState);
      if (pushWindows.length > 0) {
        const topWindow = pushWindows[0];
        const netWorthContext = this.lastNetWorthAnalysis ? {
          delta: this.lastNetWorthAnalysis.delta,
          deltaPercent: this.lastNetWorthAnalysis.deltaPercent
        } : undefined;

        const advice: CoachingAdvice = {
          priority: topWindow.priority,
          message: topWindow.message,
          action: this.getActionFromWindowType(topWindow.type),
          timestamp: Date.now(),
          gameTime: gameState.gameTime,
          netWorthContext
        };
        
        const enriched = this.enrichAdvice(advice, gameState, 'push_window', topWindow.duration);
        
        // Track push window for post-game analysis with context
        postGameAnalyzer.trackPushWindow(gameState, topWindow.type, enriched, netWorthContext);
        
        if (enriched) return enriched;
      }

      // Priority 4: Net worth-based recommendations
      const netWorthRecommendation = netWorthTracker.getPushRecommendation(
        this.lastNetWorthAnalysis,
        gameState
      );
      if (netWorthRecommendation) {
        const advice: CoachingAdvice = {
          priority: 'HIGH',
          message: netWorthRecommendation,
          action: 'push',
          timestamp: Date.now(),
          gameTime: gameState.gameTime
        };
        const enriched = this.enrichAdvice(advice, gameState, 'net_worth');
        if (enriched) return enriched;
      }

      // Priority 5: Phase-specific coaching
      const phaseAdvice = phaseCoaching.getAdvice(gameState, this.gamePhase, this.winConditionAnalysis);
      if (phaseAdvice) {
        const enriched = this.enrichAdvice(phaseAdvice, gameState, 'phase_coaching');
        if (enriched) return enriched;
      }

      // Priority 6: Item build recommendations
      const itemAdvice = itemBuildAdvisor.getRecommendations(gameState);
      if (itemAdvice) {
        const enriched = this.enrichAdvice(itemAdvice, gameState, 'item_build');
        if (enriched) return enriched;
      }

      // Priority 7: Hero-specific advice
      const heroAdvice = heroSpecificAdvice.getAdvice(gameState);
      if (heroAdvice) {
        const enriched = this.enrichAdvice(heroAdvice, gameState, 'hero_specific');
        if (enriched) return enriched;
      }

      // Priority 8: Ability usage tips
      const abilityTips = heroSpecificAdvice.getAbilityTips(gameState);
      if (abilityTips) {
        const enriched = this.enrichAdvice(abilityTips, gameState, 'ability_usage');
        if (enriched) return enriched;
      }

      // Priority 9: General strategic advice
      const strategicAdvice = this.generateStrategicAdvice(gameState);
      if (strategicAdvice) {
        const enriched = this.enrichAdvice(strategicAdvice, gameState, 'strategic');
        if (enriched) return enriched;
      }

      // Priority 10: Check for "do nothing" state (for internal tracking)
      const doNothingState = doNothingDetector.detect(gameState);
      if (doNothingState) {
        const doNothingAdvice = doNothingDetector.createDoNothingAdvice(doNothingState, gameState);
        // Record internally but don't send to player (unless verbosity is high)
        postGameAnalyzer.recordAdvice(doNothingAdvice);
        
        // Only show if trust calibrator says we need more explanation
        if (playerTrustCalibrator.shouldIncreaseExplanation()) {
          const enriched = this.enrichAdvice(doNothingAdvice, gameState, 'do_nothing');
          if (enriched) return enriched;
        }
      }

      return null;
    } catch (error) {
      logger.error('Error generating coaching advice:', error);
      return null;
    }
  }

  /**
   * Enrich advice with confidence scoring and formatting
   */
  private enrichAdvice(
    advice: CoachingAdvice,
    gameState: ProcessedGameState,
    adviceType: string,
    timingWindow?: number
  ): CoachingAdvice | null {
    // Calculate confidence
    const confidenceResult = confidenceCalculator.calculateConfidence(
      gameState,
      adviceType,
      timingWindow
    );

    // Check if we should suppress low-confidence advice
    if (confidenceCalculator.shouldSuppressAdvice(confidenceResult.score, advice.priority)) {
      logger.debug(`Suppressing low-confidence advice: ${advice.message} (confidence: ${confidenceResult.score.toFixed(2)})`);
      return null;
    }

    // Check trust calibrator for verbosity (with safeguards)
    if (playerTrustCalibrator.shouldReduceVerbosity() && advice.priority === 'LOW' && !advice.isDoNothing) {
      // Suppress low-priority advice if player has high compliance
      // BUT: Always send if high-value opportunity (override)
      if (!this.isHighValueOpportunity(advice)) {
        logger.debug(`Suppressing low-priority advice due to high compliance rate`);
        return null;
      }
    }

    // Soften language if confidence is low
    let message = advice.message;
    if (confidenceResult.score < 0.7) {
      message = confidenceCalculator.softenLanguage(message, confidenceResult.score);
    }

    // Add explanation if trust calibrator indicates need
    if (playerTrustCalibrator.shouldIncreaseExplanation() && !advice.isDoNothing) {
      message = this.addExplanation(message, advice, confidenceResult.reasons);
    }

    // Apply human-focused formatting
    message = messageFormatter.format({
      ...advice,
      message,
      confidence: confidenceResult.score
    });

    // Add net worth context if not already present
    const netWorthContext = advice.netWorthContext || (this.lastNetWorthAnalysis ? {
      delta: this.lastNetWorthAnalysis.delta,
      deltaPercent: this.lastNetWorthAnalysis.deltaPercent
    } : undefined);

    // Return enriched advice
    return {
      ...advice,
      message,
      confidence: confidenceResult.score,
      confidenceReasons: confidenceResult.reasons,
      netWorthContext
    };
  }

  private addExplanation(message: string, advice: CoachingAdvice, reasons: string[]): string {
    if (reasons.length > 0 && reasons[0] !== 'High confidence - all data reliable') {
      return `${message} (${reasons.join(', ')})`;
    }
    return message;
  }

  /**
   * Check if advice represents a high-value opportunity (should override verbosity)
   */
  private isHighValueOpportunity(advice: CoachingAdvice): boolean {
    // Always send game-ending or critical advice
    if (advice.priority === 'GAME_ENDING' || advice.priority === 'CRITICAL') {
      return true;
    }

    // Send if high confidence (>85%)
    if (advice.confidence && advice.confidence > 0.85) {
      return true;
    }

    // Send if high-value net worth swing (>10k)
    if (advice.netWorthContext) {
      const absDelta = Math.abs(advice.netWorthContext.delta);
      if (absDelta > 10000) {
        return true;
      }
    }

    return false;
  }

  private determineGamePhase(gameTime: number): GamePhase {
    if (gameTime < GAME_PHASES.laning.end) {
      return 'laning';
    } else if (gameTime < GAME_PHASES.midgame.end) {
      return 'midgame';
    } else {
      return 'lategame';
    }
  }

  private getActionFromWindowType(type: string): string {
    const actionMap: Record<string, string> = {
      'hero_deaths': 'push',
      'no_buyback': 'end_game',
      'power_spike': 'group',
      'creep_wave': 'push',
      'ultimate_advantage': 'fight',
      'aegis': 'highground'
    };
    return actionMap[type] || 'push';
  }

  private generateStrategicAdvice(gameState: ProcessedGameState): CoachingAdvice | null {
    // Check CS targets (more sensitive - trigger at 85% instead of 70%)
    const minuteMark = Math.floor(gameState.gameTime / 60);
    let expectedCS: number | undefined;
    
    // Get CS target for current minute
    if (minuteMark <= 5) {
      expectedCS = CS_TARGETS[5];
    } else if (minuteMark <= 10) {
      expectedCS = CS_TARGETS[10];
    } else if (minuteMark <= 15) {
      expectedCS = CS_TARGETS[15];
    } else if (minuteMark <= 20) {
      expectedCS = CS_TARGETS[20];
    } else {
      expectedCS = CS_TARGETS[20]; // Use 20min target for later
    }
    
    if (expectedCS && gameState.player.lastHits < expectedCS * 0.85) {
      return {
        priority: 'MEDIUM',
        message: `CS: ${gameState.player.lastHits}/${expectedCS} - Focus farm, need gold for push timing`,
        action: 'farm',
        timestamp: Date.now(),
        gameTime: gameState.gameTime
      };
    }

    // Check for objective opportunities (more sensitive - trigger at 70% instead of 50%)
    const enemyBuildings = gameState.buildings[gameState.player.team === 'radiant' ? 'dire' : 'radiant'];
    const lowTowers = [
      ...(enemyBuildings.t1 || []),
      ...(enemyBuildings.t2 || [])
    ].filter(t => !t.destroyed && t.healthPercent < 70 && t.healthPercent > 0);

    if (lowTowers.length > 0 && gameState.hero.healthPercent > 50) {
      return {
        priority: 'MEDIUM',
        message: `Enemy tower at ${Math.floor(lowTowers[0].healthPercent)}% - Finish it on next wave`,
        action: 'push',
        timestamp: Date.now(),
        gameTime: gameState.gameTime
      };
    }

    // Check for Roshan timing
    if (gameState.gameTime > 1200 && // After 20min
        !gameState.roshan.alive &&
        gameState.roshan.respawnTime &&
        gameState.roshan.respawnTime - gameState.gameTime < 60) {
      return {
        priority: 'HIGH',
        message: `Roshan respawning soon - Secure Aegis for highground push`,
        action: 'roshan',
        timestamp: Date.now(),
        gameTime: gameState.gameTime
      };
    }

    return null;
  }

  /**
   * Generate periodic general advice (fallback when no specific advice)
   * Public method so it can be called when forcing periodic advice
   */
  public generatePeriodicAdvice(gameState: ProcessedGameState): CoachingAdvice | null {
    const phase = this.determineGamePhase(gameState.gameTime);
    const minute = Math.floor(gameState.gameTime / 60);
    
    // Get CS target for current minute (use closest available target)
    const getCSTarget = (min: number): number => {
      if (min <= 5) return CS_TARGETS[5];
      if (min <= 10) return CS_TARGETS[10];
      if (min <= 15) return CS_TARGETS[15];
      if (min <= 20) return CS_TARGETS[20];
      return CS_TARGETS[20]; // Use 20min target for later game
    };
    
    // Generate phase-appropriate general advice
    const adviceMessages: Record<GamePhase, string[]> = {
      laning: [
        `Focus on last hits - aim for ${getCSTarget(minute)} CS by ${minute}min`,
        'Secure runes at 2:00 and 4:00 for XP/gold advantage',
        'Watch minimap for missing enemies - play safe',
        'Stack camps when possible for later farm',
        'Trade efficiently - use spells when enemy is out of position'
      ],
      midgame: [
        'Group with team for objectives - don\'t farm alone',
        'Control vision around Roshan pit',
        'Push lanes before taking fights',
        'Save buyback for important fights',
        'Focus on taking T2 towers to open map'
      ],
      lategame: [
        'Stick together - one pickoff can lose the game',
        'Secure Aegis before highground push',
        'Don\'t throw - wait for enemy mistakes',
        'Control highground vision before pushing',
        'Save buyback - critical for late game fights'
      ]
    };

    const messages = adviceMessages[phase];
    if (!messages || messages.length === 0) {
      return null;
    }

    // Rotate through messages based on game time
    const messageIndex = Math.floor(gameState.gameTime / 30) % messages.length;
    
    return {
      priority: 'LOW',
      message: messages[messageIndex],
      timestamp: Date.now(),
      gameTime: gameState.gameTime
    };
  }

  /**
   * Get current win condition analysis
   */
  public getWinConditionAnalysis() {
    return this.winConditionAnalysis;
  }

  /**
   * Get current game phase
   */
  public getGamePhase(): GamePhase {
    return this.gamePhase;
  }
}

export const coachingEngine = new CoachingEngine();

