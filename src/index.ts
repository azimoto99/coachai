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
import { winrateTracker } from './services/winrateTracker';
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
      
      // Try to get Steam ID from player data if available
      if (!this.activeCoachingSteamID && gameState.player?.steamId) {
        const playerSteamId = gameState.player.steamId;
        logger.info(`Setting active Steam ID from player data: ${playerSteamId}`);
        this.activeCoachingSteamID = playerSteamId;
        
        // Set it in the Steam bot if available
        if (this.steamBot) {
          this.steamBot.setActiveCoachingSteamID(playerSteamId);
          this.steamBot.sendChatMessage(playerSteamId, 'Coaching activated! I\'ll provide advice during your match.');
        }
      } else if (!this.activeCoachingSteamID && this.steamBot) {
        logger.info('Coaching active but no Steam ID available - will log advice only');
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

      // Track combat outcomes for winrate calculation
      if (this.previousGameState && this.lastGameState) {
        this.trackCombatOutcomes();
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

      // Check for duplicate advice - don't send the same message twice in a row
      const lastAdvice = Array.from(this.adviceTracking.values()).slice(-1)[0];
      if (lastAdvice === advice.message) {
        logger.debug('Duplicate advice detected, skipping');
        return; // Don't spam the same message
      }

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

  private trackCombatOutcomes(): void {
    if (!this.previousGameState || !this.lastGameState) return;

    const prev = this.previousGameState;
    const curr = this.lastGameState;

    // Check if player got a kill (combat win)
    if (curr.player.kills > prev.player.kills) {
      winrateTracker.recordOutcome('win');
      logger.debug('Combat outcome: WIN (kill recorded)');
    }

    // Check if player died (combat loss)
    if (!curr.hero.alive && prev.hero.alive) {
      winrateTracker.recordOutcome('loss');
      logger.debug('Combat outcome: LOSS (death recorded)');
    }

    // Check if enemy died (combat win)
    const prevAliveEnemies = prev.enemies.filter(e => e.alive).length;
    const currAliveEnemies = curr.enemies.filter(e => e.alive).length;
    if (currAliveEnemies < prevAliveEnemies && curr.hero.alive) {
      winrateTracker.recordOutcome('win');
      logger.debug('Combat outcome: WIN (enemy death)');
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

      // Always log advice to console
      const confidenceInfo = advice.confidence 
        ? ` [Confidence: ${(advice.confidence * 100).toFixed(0)}%]`
        : '';
      logger.info(`[COACHING] ${message}${confidenceInfo}`);

      // Try to send via Steam if available
      if (this.steamBot && this.steamBot.isReady()) {
        const sent = await this.steamBot.sendCoachingMessage(message);
        if (!sent) {
          logger.info('Advice logged to console (Steam message sending unavailable)');
        }
      } else {
        logger.info('Advice logged to console (Steam bot not available)');
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

