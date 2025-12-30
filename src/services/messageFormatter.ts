/**
 * Human-focused language tuning for coaching messages
 * Optimized for clarity and stress situations
 */

import { CoachingAdvice, MessagePriority } from '../types/coaching';

export class MessageFormatter {
  /**
   * Format message with human-focused language tuning
   */
  public format(advice: CoachingAdvice): string {
    let message = advice.message;

    // Apply stress-aware formatting based on priority
    if (advice.priority === 'GAME_ENDING' || advice.priority === 'CRITICAL') {
      message = this.formatHighStress(message);
    } else if (advice.priority === 'HIGH') {
      message = this.formatMediumStress(message);
    } else {
      message = this.formatLowStress(message);
    }

    // Apply confidence-based softening if needed
    if (advice.confidence !== undefined && advice.confidence < 0.7) {
      message = this.softenForLowConfidence(message);
    }

    return message;
  }

  private formatHighStress(message: string): string {
    // High stress: Short sentences, fewer verbs, clear action
    // Capitalization only for true emergencies
    
    // Split into sentences
    let sentences = message.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    // Keep sentences short (max 8 words)
    sentences = sentences.map(s => {
      const words = s.trim().split(/\s+/);
      if (words.length > 8) {
        // Split long sentences
        const mid = Math.floor(words.length / 2);
        return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
      }
      return [s.trim()];
    }).flat();

    // Format with strategic capitalization
    sentences = sentences.map((s, i) => {
      // First sentence gets key words capitalized
      if (i === 0) {
        return this.capitalizeKeyWords(s);
      }
      // Keep rest lowercase for readability
      return s.toLowerCase();
    });

    // Join with periods, no extra punctuation
    return sentences.join('. ').trim() + '.';
  }

  private formatMediumStress(message: string): string {
    // Medium stress: Balanced, clear but not overwhelming
    let sentences = message.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    // Keep sentences reasonable length (max 12 words)
    sentences = sentences.map(s => {
      const words = s.trim().split(/\s+/);
      if (words.length > 12) {
        const mid = Math.floor(words.length / 2);
        return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
      }
      return [s.trim()];
    }).flat();

    // Capitalize first word of each sentence
    sentences = sentences.map(s => {
      return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    });

    return sentences.join('. ').trim() + '.';
  }

  private formatLowStress(message: string): string {
    // Low stress: Normal formatting, can be more verbose
    return message.charAt(0).toUpperCase() + message.slice(1);
  }

  private capitalizeKeyWords(sentence: string): string {
    // Capitalize important action words
    const keyWords = [
      'NOW', 'END', 'PUSH', 'BACK', 'GROUP', 'FIGHT', 'DANGER',
      'BUYBACK', 'AEGIS', 'ROSHAN', 'ANCIENT', 'TOWER'
    ];

    let result = sentence;
    keyWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      result = result.replace(regex, word);
    });

    return result;
  }

  private softenForLowConfidence(message: string): string {
    // Soften language when confidence is low
    return message
      .replace(/NOW/g, 'likely now')
      .replace(/MUST/g, 'should')
      .replace(/FORCE/g, 'consider forcing')
      .replace(/END NOW/g, 'ending opportunity')
      .replace(/PUSH NOW/g, 'push opportunity');
  }

  /**
   * Format examples from requirements:
   * "BKB DONE. GROUP MID. THIS IS THE TIMING."
   * "Carry dead, no buyback. END NOW."
   */
  public formatTimingMessage(item: string, action: string): string {
    return `${item.toUpperCase()} DONE. ${action.toUpperCase()}. THIS IS THE TIMING.`;
  }

  public formatGameEndingMessage(reason: string, action: string): string {
    return `${reason}. ${action.toUpperCase()}.`;
  }
}

export const messageFormatter = new MessageFormatter();

