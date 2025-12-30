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

      // Priority 1: Anti-throw warnings (highest priority)
      const throwWarning = antiThrowSystem.checkThrowScenarios(gameState);
      if (throwWarning) {
        const advice = this.enrichAdvice(throwWarning, gameState, 'anti_throw');
        if (advice) return advice;
      }

      // Priority 2: Push windows (game-ending opportunities)
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

      // Priority 3: Net worth-based recommendations
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

      // Priority 4: Phase-specific coaching
      const phaseAdvice = phaseCoaching.getAdvice(gameState, this.gamePhase, this.winConditionAnalysis);
      if (phaseAdvice) {
        const enriched = this.enrichAdvice(phaseAdvice, gameState, 'phase_coaching');
        if (enriched) return enriched;
      }

      // Priority 5: General strategic advice
      const strategicAdvice = this.generateStrategicAdvice(gameState);
      if (strategicAdvice) {
        const enriched = this.enrichAdvice(strategicAdvice, gameState, 'strategic');
        if (enriched) return enriched;
      }

      // Priority 6: Check for "do nothing" state (for internal tracking)
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
    // Check CS targets
    const minuteMark = Math.floor(gameState.gameTime / 60);
    const expectedCS = CS_TARGETS[minuteMark as keyof typeof CS_TARGETS];
    
    if (expectedCS && gameState.player.lastHits < expectedCS * 0.7) {
      return {
        priority: 'MEDIUM',
        message: `CS: ${gameState.player.lastHits}/${expectedCS} - Focus farm, need gold for push timing`,
        action: 'farm',
        timestamp: Date.now(),
        gameTime: gameState.gameTime
      };
    }

    // Check for objective opportunities
    const enemyBuildings = gameState.buildings[gameState.player.team === 'radiant' ? 'dire' : 'radiant'];
    const lowTowers = [
      ...(enemyBuildings.t1 || []),
      ...(enemyBuildings.t2 || [])
    ].filter(t => !t.destroyed && t.healthPercent < 50 && t.healthPercent > 0);

    if (lowTowers.length > 0 && gameState.hero.healthPercent > 60) {
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

