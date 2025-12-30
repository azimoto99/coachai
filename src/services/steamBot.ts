/**
 * Steam Bot for Dota 2 coaching
 * Connects to Steam and handles coaching via Steam chat messages
 */

import SteamUser from 'steam-user';
import { logger } from '../utils/logger';
import * as readline from 'readline';

export class SteamBot {
  private client: SteamUser;
  private isConnected: boolean = false;
  private onMessageCallback?: (message: string) => void;
  private onCoachMeCallback?: (steamID: string) => void;

  constructor(username: string, password: string) {
    this.client = new SteamUser({
      promptSteamGuardCode: false,
      dataDirectory: './steam_data'
    });

    this.setupSteamHandlers();
    this.login(username, password);
  }

  private setupSteamHandlers(): void {
    this.client.on('loggedOn', () => {
      logger.info('Logged into Steam');
      this.isConnected = true;
      this.client.setPersona(SteamUser.EPersonaState.Online);
    });

    this.client.on('error', (error: Error) => {
      logger.error('Steam client error:', error);
      this.isConnected = false;
    });

    this.client.on('disconnected', () => {
      logger.warn('Disconnected from Steam');
      this.isConnected = false;
    });

    // Handle Steam Guard authentication
    this.client.on('steamGuard', (domain: string | null, callback: (code: string) => void) => {
      this.promptSteamGuardCode(domain, callback);
    });

    // Handle incoming friend messages
    this.client.on('friendMessage', (senderID: any, message: string) => {
      this.handleFriendMessage(senderID, message);
    });
  }

  /**
   * Prompt user for Steam Guard code
   */
  private promptSteamGuardCode(domain: string | null, callback: (code: string) => void): void {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const domainMessage = domain 
      ? `Steam Guard code required. Check your email ending in ${domain}`
      : 'Steam Guard code required. Check your email or mobile authenticator';

    logger.warn(domainMessage);
    
    rl.question('Enter Steam Guard code: ', (code: string) => {
      rl.close();
      const trimmedCode = code.trim();
      if (trimmedCode) {
        logger.info('Steam Guard code received, submitting...');
        callback(trimmedCode);
      } else {
        logger.error('No Steam Guard code provided');
        // Retry prompt if empty
        this.promptSteamGuardCode(domain, callback);
      }
    });
  }

  private login(username: string, password: string): void {
    try {
      this.client.logOn({
        accountName: username,
        password: password
      });
      logger.info(`Attempting to log in as ${username}...`);
    } catch (error) {
      logger.error('Failed to log in to Steam:', error);
      throw error;
    }
  }


  /**
   * Send coaching message to player
   * Sends via Steam chat to the active coaching session
   */
  private activeCoachingSteamID: string | null = null;

  public setActiveCoachingSteamID(steamID: string | null): void {
    this.activeCoachingSteamID = steamID;
  }

  public async sendCoachingMessage(message: string): Promise<boolean> {
    try {
      if (!this.isConnected) {
        logger.warn('Steam not connected, cannot send message');
        logger.info(`[COACHING] ${message}`);
        return false;
      }

      if (!this.activeCoachingSteamID) {
        logger.warn('No active coaching session Steam ID, logging advice to console');
        logger.info(`[COACHING] ${message}`);
        return false;
      }

      // Send via Steam chat
      this.sendChatMessage(this.activeCoachingSteamID, message);
      
      // Also log to console for visibility
      logger.info(`[COACHING] ${message}`);
      
      // Call callback if registered (for testing/monitoring)
      if (this.onMessageCallback) {
        this.onMessageCallback(message);
      }

      return true;
    } catch (error) {
      logger.error('Failed to send coaching message:', error);
      // Still log the message even if sending fails
      logger.info(`[COACHING] ${message}`);
      return false;
    }
  }

  /**
   * Handle incoming friend messages
   */
  private handleFriendMessage(senderID: any, message: string): void {
    const messageLower = message.trim().toLowerCase();
    logger.info(`Received message from ${senderID.toString()}: ${message}`);

    // Check if message is "coach me" (case-insensitive, with variations)
    if (messageLower === 'coach me' || messageLower === 'coach' || messageLower === 'start coaching') {
      logger.info(`Coach activation requested by ${senderID.toString()}`);
      if (this.onCoachMeCallback) {
        this.onCoachMeCallback(senderID.toString());
      }
      // Send confirmation message
      this.sendChatMessage(senderID.toString(), 'Coaching activated! I\'ll start providing advice based on your game state.');
    } else {
      // Send help message for other messages
      this.sendChatMessage(senderID.toString(), 'Send "coach me" to activate coaching during your Dota 2 game.');
    }
  }

  /**
   * Send a chat message to a Steam user
   */
  public sendChatMessage(steamID: string, message: string): void {
    try {
      if (!this.isConnected) {
        logger.warn('Steam not connected, cannot send chat message');
        return;
      }

      this.client.chatMessage(steamID, message);
      logger.info(`Sent chat message to ${steamID}: ${message}`);
    } catch (error) {
      logger.error('Failed to send chat message:', error);
    }
  }

  /**
   * Register callback for sent messages (for testing)
   */
  public onMessage(callback: (message: string) => void): void {
    this.onMessageCallback = callback;
  }

  /**
   * Register callback for "coach me" activation
   */
  public onCoachMe(callback: (steamID: string) => void): void {
    this.onCoachMeCallback = callback;
  }

  /**
   * Check if bot is ready to send messages
   */
  public isReady(): boolean {
    return this.isConnected;
  }

  /**
   * Disconnect from Steam
   */
  public disconnect(): void {
    if (this.client) {
      this.client.logOff();
    }
    this.isConnected = false;
  }
}

