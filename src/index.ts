/**
 * Main entry point for Dota 2 AI Coaching Bot
 */

import * as dotenv from 'dotenv';
import { GSIServer } from './services/gsiServer';
import { coachingEngine } from './services/coachingEngine';
import { messageQueue } from './services/messageQueue';
import { SteamBot } from './services/steamBot';
import { postGameAnalyzer } from './services/postGameAnalyzer';
import { messageFormatter } from './services/messageFormatter';
import { playerTrustCalibrator } from './services/playerTrustCalibrator';
import { CoachingAdvice } from './types/coaching';
import { ProcessedGameState } from './types/gameState';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

class Dota2Coach {
  private gsiServer: GSIServer;
  private steamBot: SteamBot | null = null;
  private lastGameState: ProcessedGameState | null = null;
  private previousGameState: ProcessedGameState | null = null;
  private isRunning: boolean = false;
  private adviceTracking: Map<string, string> = new Map(); // adviceId -> advice message

  constructor() {
    const gsiPort = parseInt(process.env.GSI_PORT || '3000', 10);
    const gsiToken = process.env.GSI_TOKEN || '';

    // Initialize GSI server
    this.gsiServer = new GSIServer(gsiPort, gsiToken);
    this.gsiServer.onUpdate(this.handleGameStateUpdate.bind(this));

    // Initialize Steam bot if credentials provided
    const steamUsername = process.env.STEAM_USERNAME;
    const steamPassword = process.env.STEAM_PASSWORD;

    if (steamUsername && steamPassword) {
      try {
        this.steamBot = new SteamBot(steamUsername, steamPassword);
        this.steamBot.initializeDota2();
        
        // Set up message callback for monitoring
        this.steamBot.onMessage((message) => {
          logger.info(`Message sent: ${message}`);
        });
      } catch (error) {
        logger.error('Failed to initialize Steam bot:', error);
        logger.warn('Continuing without Steam bot - messages will be logged only');
      }
    } else {
      logger.warn('Steam credentials not provided - running in log-only mode');
    }
  }

  private handleGameStateUpdate(gameState: ProcessedGameState): void {
    try {
      this.previousGameState = this.lastGameState;
      this.lastGameState = gameState;

      // Track game state for post-game analysis
      if (gameState.gameState === 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS') {
        if (!postGameAnalyzer.isActive()) {
          postGameAnalyzer.startGame();
          playerTrustCalibrator.clear(); // Reset for new game
        }
      } else if (gameState.gameState === 'DOTA_GAMERULES_STATE_POST_GAME') {
        if (postGameAnalyzer.isActive()) {
          const summary = postGameAnalyzer.endGame(gameState.gameTime);
          logger.info('Post-game summary generated');
          logger.info(postGameAnalyzer.formatSummary(summary));
          
          // Log trust metrics
          const trustMetrics = playerTrustCalibrator.getTrustMetrics();
          logger.info('Player Trust Metrics:', {
            complianceRate: `${(trustMetrics.complianceRate * 100).toFixed(1)}%`,
            positiveOutcomeRate: `${(trustMetrics.positiveOutcomeRate * 100).toFixed(1)}%`,
            verbosityLevel: trustMetrics.verbosityLevel,
            explanationLevel: trustMetrics.explanationLevel
          });
        }
      }

      // Check compliance for previous advice
      if (this.previousGameState && this.lastGameState) {
        this.checkComplianceForPreviousAdvice();
      }

      // Generate coaching advice
      const advice = coachingEngine.generateAdvice(gameState);

      if (!advice) {
        return; // No advice to give
      }

      // Register advice with trust calibrator
      const adviceId = playerTrustCalibrator.registerAdvice(advice, gameState);
      this.adviceTracking.set(adviceId, advice.message);

      // Check if we should send this message
      if (!messageQueue.shouldSend(advice)) {
        return; // Rate limited
      }

      // Send the message
      this.sendAdvice(advice);

      // Check for pending messages
      const pending = messageQueue.getNextPending();
      if (pending) {
        this.sendAdvice(pending);
      }
    } catch (error) {
      logger.error('Error handling game state update:', error);
    }
  }

  private checkComplianceForPreviousAdvice(): void {
    if (!this.previousGameState || !this.lastGameState) return;

    // Check compliance for all tracked advice
    this.adviceTracking.forEach((message, adviceId) => {
      playerTrustCalibrator.checkCompliance(
        adviceId,
        this.lastGameState!,
        this.previousGameState!
      );
    });
  }

  private async sendAdvice(advice: CoachingAdvice): Promise<void> {
    try {
      // Format message using message formatter
      const message = messageFormatter.format(advice);

      // Record advice for post-game analysis
      postGameAnalyzer.recordAdvice(advice);

      if (this.steamBot && this.steamBot.isReady()) {
        await this.steamBot.sendCoachingMessage(message);
      } else {
        // Log-only mode with confidence info
        const confidenceInfo = advice.confidence 
          ? ` [Confidence: ${(advice.confidence * 100).toFixed(0)}%]`
          : '';
        logger.info(`[COACHING] ${message}${confidenceInfo}`);
      }

      messageQueue.markSent(advice);
    } catch (error) {
      logger.error('Error sending advice:', error);
    }
  }

  public start(): void {
    if (this.isRunning) {
      logger.warn('Coach is already running');
      return;
    }

    logger.info('Starting Dota 2 AI Coaching Bot...');
    logger.info('Make sure Dota 2 GSI is configured correctly');
    logger.info('See README.md for setup instructions');

    this.gsiServer.start();
    this.isRunning = true;

    logger.info('Coach is running. Waiting for game state data...');
  }

  public stop(): void {
    logger.info('Stopping Dota 2 AI Coaching Bot...');
    
    this.gsiServer.stop();
    
    if (this.steamBot) {
      this.steamBot.disconnect();
    }

    this.isRunning = false;
    logger.info('Coach stopped');
  }

  public getStatus(): {
    running: boolean;
    gsiConnected: boolean;
    steamConnected: boolean;
    lastGameState: ProcessedGameState | null;
  } {
    return {
      running: this.isRunning,
      gsiConnected: this.isRunning,
      steamConnected: this.steamBot?.isReady() || false,
      lastGameState: this.lastGameState
    };
  }
}

// Create and start the coach
const coach = new Dota2Coach();

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  coach.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  coach.stop();
  process.exit(0);
});

// Start the coach
coach.start();

// Export for testing
export { Dota2Coach };

