/**
 * Message queue with priority-based rate limiting
 */

import { CoachingAdvice, MessagePriority } from '../types/coaching';
import { RATE_LIMITS } from '../config/constants';
import { logger } from '../utils/logger';

export class MessageQueue {
  private lastMessageTime: number = 0;
  private messageHistory: CoachingAdvice[] = [];
  private pendingMessages: CoachingAdvice[] = [];

  /**
   * Check if message should be sent based on priority and rate limits
   */
  public shouldSend(advice: CoachingAdvice): boolean {
    const now = Date.now();
    const timeSinceLastMessage = now - this.lastMessageTime;

    // Game-ending messages bypass rate limits (truly urgent)
    if (advice.priority === 'GAME_ENDING') {
      return true;
    }

    // CRITICAL messages have a minimum 30 second cooldown to prevent spam
    if (advice.priority === 'CRITICAL') {
      const criticalCooldown = 30000; // 30 seconds
      if (timeSinceLastMessage < criticalCooldown) {
        return false;
      }
      return true;
    }

    // Check rate limit for other priorities
    const rateLimit = RATE_LIMITS[advice.priority];
    if (timeSinceLastMessage < rateLimit) {
      // Queue the message if it's high priority
      if (advice.priority === 'HIGH') {
        this.pendingMessages.push(advice);
      }
      return false;
    }

    return true;
  }

  /**
   * Mark message as sent
   */
  public markSent(advice: CoachingAdvice): void {
    this.lastMessageTime = Date.now();
    this.messageHistory.push(advice);
    
    // Keep only last 50 messages
    if (this.messageHistory.length > 50) {
      this.messageHistory.shift();
    }

    // Remove from pending if it was there
    this.pendingMessages = this.pendingMessages.filter(m => m !== advice);
  }

  /**
   * Get next pending message if rate limit allows
   */
  public getNextPending(): CoachingAdvice | null {
    const now = Date.now();
    const timeSinceLastMessage = now - this.lastMessageTime;

    if (this.pendingMessages.length === 0) {
      return null;
    }

    const nextMessage = this.pendingMessages[0];
    const rateLimit = RATE_LIMITS[nextMessage.priority];

    if (timeSinceLastMessage >= rateLimit) {
      return this.pendingMessages.shift() || null;
    }

    return null;
  }

  /**
   * Clear message history
   */
  public clear(): void {
    this.messageHistory = [];
    this.pendingMessages = [];
    this.lastMessageTime = 0;
  }

  /**
   * Get message history
   */
  public getHistory(): CoachingAdvice[] {
    return [...this.messageHistory];
  }
}

export const messageQueue = new MessageQueue();

