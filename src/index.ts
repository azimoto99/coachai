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
  private isCoachingActive: boolean = false;
  private activeCoachingSteamID: string | null = null;
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
        
        // Set up message callback for monitoring
        this.steamBot.onMessage((message) => {
          logger.info(`Message sent: ${message}`);
        });

        // Set up "coach me" activation callback
        this.steamBot.onCoachMe((steamID: string) => {
          this.activateCoaching(steamID);
        });
      } catch (error) {
        logger.error('Failed to initialize Steam bot:', error);
        logger.warn('Continuing without Steam bot - messages will be logged only');
      }
    } else {
      logger.warn('Steam credentials not provided - running in log-only mode');
    }
  }

  /**
   * Activate coaching when user sends "coach me" message
   */
  private activateCoaching(steamID: string): void {
    if (this.isCoachingActive) {
      logger.info(`Coaching already active for ${steamID}`);
      if (this.steamBot) {
        this.steamBot.sendChatMessage(steamID, 'Coaching is already active!');
      }
      return;
    }

    logger.info(`Activating coaching for ${steamID}`);
    this.activeCoachingSteamID = steamID;
    this.isCoachingActive = true;

    // Set the active Steam ID in the bot
    if (this.steamBot) {
      this.steamBot.setActiveCoachingSteamID(steamID);
    }

    // GSI server should already be running, but ensure it is
    if (!this.isRunning) {
      this.start();
    }

    if (this.steamBot) {
      this.steamBot.sendChatMessage(steamID, 'Coaching activated! Make sure Dota 2 GSI is configured and start a game. I\'ll provide coaching advice during your match.');
    }
  }

  private handleGameStateUpdate(gameState: ProcessedGameState): void {
    logger.info('handleGameStateUpdate called', {
      isCoachingActive: this.isCoachingActive,
      gameTime: gameState.gameTime,
      gameState: gameState.gameState
    });

    // Auto-activate coaching if we receive game state data and coaching isn't active
    if (!this.isCoachingActive) {
      logger.info('Auto-activating coaching - GSI data received');
      this.isCoachingActive = true;
      // If we have a Steam bot but no active Steam ID, we'll work in log-only mode
      if (!this.activeCoachingSteamID && this.steamBot) {
        logger.info('Coaching active but no Steam ID set - will log advice only');
      }
    }

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
      logger.info('Calling coaching engine to generate advice', {
        gameTime: gameState.gameTime,
        gameState: gameState.gameState,
        hasPlayer: !!gameState.player,
        hasTeam: !!gameState.team
      });
      
      const advice = coachingEngine.generateAdvice(gameState);

      if (!advice) {
        logger.info('No advice generated for current game state', {
          gameTime: gameState.gameTime,
          gameState: gameState.gameState
        });
        return; // No advice to give
      }

      logger.info('Coaching advice generated', {
        priority: advice.priority,
        message: advice.message.substring(0, 100) + '...',
        confidence: advice.confidence
      });

      // Register advice with trust calibrator
      const adviceId = playerTrustCalibrator.registerAdvice(advice, gameState);
      this.adviceTracking.set(adviceId, advice.message);

      // Check if we should send this message
      if (!messageQueue.shouldSend(advice)) {
        logger.debug('Advice rate limited, not sending');
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
      logger.warn('GSI Server is already running');
      return;
    }

    logger.info('Starting GSI Server...');
    logger.info('Make sure Dota 2 GSI is configured correctly');
    logger.info('See README.md for setup instructions');

    this.gsiServer.start();
    this.isRunning = true;

    logger.info('GSI Server is running. Waiting for game state data...');
  }

  public stop(): void {
    logger.info('Stopping Dota 2 AI Coaching Bot...');
    
    this.gsiServer.stop();
    this.isRunning = false;
    this.isCoachingActive = false;
    this.activeCoachingSteamID = null;

    if (this.steamBot) {
      this.steamBot.setActiveCoachingSteamID(null);
    }

    logger.info('Coach stopped');
  }

  public deactivateCoaching(): void {
    if (!this.isCoachingActive) {
      return;
    }

    logger.info('Deactivating coaching');
    this.isCoachingActive = false;
    const steamID = this.activeCoachingSteamID;
    this.activeCoachingSteamID = null;

    if (this.steamBot) {
      this.steamBot.setActiveCoachingSteamID(null);
      if (steamID) {
        this.steamBot.sendChatMessage(steamID, 'Coaching deactivated. Send "coach me" to reactivate.');
      }
    }
  }

  public getStatus(): {
    running: boolean;
    coachingActive: boolean;
    gsiConnected: boolean;
    steamConnected: boolean;
    activeCoachingSteamID: string | null;
    lastGameState: ProcessedGameState | null;
  } {
    return {
      running: this.isRunning,
      coachingActive: this.isCoachingActive,
      gsiConnected: this.isRunning,
      steamConnected: this.steamBot?.isReady() || false,
      activeCoachingSteamID: this.activeCoachingSteamID,
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

// Start GSI server immediately so it can receive data
coach.start();

// Don't start coaching automatically - wait for "coach me" message
logger.info('Bot is ready! Send "coach me" via Steam chat to activate coaching.');
logger.info('GSI Server is running and ready to receive game state data.');

// Export for testing
export { Dota2Coach };

