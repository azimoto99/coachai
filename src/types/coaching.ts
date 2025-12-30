/**
 * Types for coaching system
 */

export type MessagePriority = 'GAME_ENDING' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type WinCondition = 
  | 'earlyPush' 
  | 'timingPush' 
  | 'splitPush' 
  | 'highgroundSiege' 
  | 'outscale' 
  | 'unknown';

export type GamePhase = 'laning' | 'midgame' | 'lategame';

export interface CoachingAdvice {
  priority: MessagePriority;
  message: string;
  action?: string;
  visualAid?: VisualAid;
  timestamp: number;
  gameTime: number;
  confidence?: number; // 0-1 scale, how confident we are in this advice
  confidenceReasons?: string[]; // Why this confidence level
  isDoNothing?: boolean; // True if this is an intentional "no action" message
  netWorthContext?: {
    delta: number;
    deltaPercent: number;
  }; // Net worth context at time of advice
}

export interface VisualAid {
  type: 'arrow' | 'circle' | 'ping' | 'line';
  color: 'green' | 'red' | 'yellow' | 'blue';
  startPos?: number[];
  endPos?: number[];
  centerPos?: number[];
  radius?: number;
  path?: number[][];
  repeats?: number;
}

export interface PushWindow {
  type: 'hero_deaths' | 'no_buyback' | 'power_spike' | 'creep_wave' | 'ultimate_advantage' | 'aegis';
  priority: MessagePriority;
  duration?: number;
  message: string;
  lanes?: string[];
  timestamp: number;
}

export interface PowerSpike {
  type: 'level' | 'item' | 'hero_specific' | 'roshan';
  description: string;
  timing: number;
  duration?: number;
  completed: boolean;
}

export interface WinConditionAnalysis {
  primaryCondition: WinCondition;
  confidence: number;
  timing: string;
  strategy: string;
  heroes: string[];
  keyItems: string[];
  pushTiming: number;
}

