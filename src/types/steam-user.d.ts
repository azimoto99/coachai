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

  class SteamUser {
    constructor(options?: SteamUserOptions);
    
    logOn(credentials: {
      accountName: string;
      password: string;
      steamGuardCode?: string;
    }): void;
    
    logOff(): void;
    
    setPersona(state: EPersonaState): void;
    
    on(event: 'loggedOn', callback: () => void): void;
    on(event: 'error', callback: (error: Error) => void): void;
    on(event: 'disconnected', callback: () => void): void;
    on(event: 'steamGuard', callback: (domain: string | null, callback: (code: string) => void) => void): void;
  }

  export default SteamUser;
}

