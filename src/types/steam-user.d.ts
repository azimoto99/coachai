/**
 * Type declarations for steam-user package
 */

declare module 'steam-user' {
  export enum EPersonaState {
    Offline = 0,
    Online = 1,
    Busy = 2,
    Away = 3,
    Snooze = 4,
    LookingToTrade = 5,
    LookingToPlay = 6,
    Invisible = 7
  }

  export interface SteamUserOptions {
    promptSteamGuardCode?: boolean;
    dataDirectory?: string;
  }

  // SteamID can be a string or an object - using any for flexibility
  type SteamID = any;

  class SteamUser {
    static EPersonaState: typeof EPersonaState;
    
    constructor(options?: SteamUserOptions);
    
    logOn(credentials: {
      accountName: string;
      password: string;
      steamGuardCode?: string;
    }): void;
    
    logOff(): void;
    
    setPersona(state: EPersonaState): void;
    
    chatMessage(recipient: SteamID | string, message: string, type?: number): void;
    
    on(event: 'loggedOn', callback: () => void): void;
    on(event: 'error', callback: (error: Error) => void): void;
    on(event: 'disconnected', callback: () => void): void;
    on(event: 'steamGuard', callback: (domain: string | null, callback: (code: string) => void) => void): void;
    on(event: 'friendMessage', callback: (senderID: SteamID, message: string) => void): void;
  }

  export default SteamUser;
}

