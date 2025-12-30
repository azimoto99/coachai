/**
 * TypeScript interfaces for Dota 2 Game State Integration (GSI) data
 * Based on official Dota 2 GSI schema
 */

export interface GSIPayload {
  provider?: Provider;
  map?: MapState;
  player?: PlayerState;
  hero?: HeroState;
  abilities?: AbilitiesState;
  items?: ItemsState;
  buildings?: BuildingsState;
  draft?: DraftState;
  allplayers?: PlayerInfo[];
}

export interface Provider {
  name: string;
  appid: number;
  version: number;
  timestamp: number;
}

export interface MapState {
  name: string;
  matchid: string;
  game_time: number;
  clock_time: number;
  daytime: boolean;
  nightstalker_night: boolean;
  game_state: string;
  paused: boolean;
  win_team?: string;
  customgamename?: string;
  ward_purchase_cooldown?: number;
  roshan_state?: string;
  roshan_state_end_seconds?: number;
}

export interface PlayerState {
  steamid: string;
  name: string;
  activity: string;
  kills: number;
  deaths: number;
  assists: number;
  last_hits: number;
  denies: number;
  kill_streak: number;
  team_name: string;
  gold: number;
  gold_reliable: number;
  gold_unreliable: number;
  gold_from_hero_kills: number;
  gold_from_creep_kills: number;
  gold_from_income: number;
  gold_from_shared: number;
  gpm: number;
  xpm: number;
  net_worth: number;
}

export interface HeroState {
  id: number;
  name: string;
  level: number;
  xpos: number;
  ypos: number;
  alive: boolean;
  respawn_seconds: number;
  buyback_cost: number;
  buyback_cooldown: number;
  health: number;
  max_health: number;
  health_percent: number;
  mana: number;
  max_mana: number;
  mana_percent: number;
  silenced: boolean;
  stunned: boolean;
  disarmed: boolean;
  magicimmune: boolean;
  hexed: boolean;
  muted: boolean;
  break: boolean;
  aghanims_scepter: boolean;
  aghanims_shard: boolean;
  moonshard: number;
}

export interface AbilitiesState {
  [key: string]: Ability;
}

export interface Ability {
  name: string;
  level: number;
  can_cast: boolean;
  passive: boolean;
  ability_active: boolean;
  cooldown: number;
  ultimate: boolean;
}

export interface ItemsState {
  [key: string]: Item;
}

export interface Item {
  name: string;
  purchaser: number;
  can_cast: boolean;
  cooldown: number;
  passive: boolean;
  charges?: number;
}

export interface BuildingsState {
  radiant?: BuildingSet;
  dire?: BuildingSet;
}

export interface BuildingSet {
  [key: string]: Building;
}

export interface Building {
  health: number;
  max_health: number;
}

export interface DraftState {
  activeteam: number;
  pick: boolean;
  activeteam_time_remaining: number;
  radiant_bonus_time: number;
  dire_bonus_time: number;
}

export interface PlayerInfo {
  steamid: string;
  name: string;
  activity: string;
  kills: number;
  deaths: number;
  assists: number;
  last_hits: number;
  denies: number;
  kill_streak: number;
  team_name: string;
  gold: number;
  gold_reliable: number;
  gold_unreliable: number;
  gpm: number;
  xpm: number;
  net_worth: number;
  respawn_seconds?: number;
  buyback_cost?: number;
  buyback_cooldown?: number;
  position?: number[];
}

export interface ProcessedGameState {
  gameTime: number;
  clockTime: number;
  gameState: string;
  isDaytime: boolean;
  player: ProcessedPlayer;
  hero: ProcessedHero;
  team: ProcessedTeam;
  enemies: ProcessedEnemy[];
  buildings: ProcessedBuildings;
  roshan: ProcessedRoshan;
  items: ProcessedItems;
  abilities: ProcessedAbilities;
}

export interface ProcessedPlayer {
  steamId: string;
  name: string;
  kills: number;
  deaths: number;
  assists: number;
  lastHits: number;
  denies: number;
  gold: number;
  goldReliable: number;
  goldUnreliable: number;
  netWorth: number;
  gpm: number;
  xpm: number;
  team: 'radiant' | 'dire';
}

export interface ProcessedHero {
  id: number;
  name: string;
  level: number;
  x: number;
  y: number;
  alive: boolean;
  respawnSeconds: number;
  buybackCost: number;
  buybackAvailable: boolean;
  health: number;
  maxHealth: number;
  healthPercent: number;
  mana: number;
  maxMana: number;
  manaPercent: number;
  magicImmune: boolean;
  hasAghanimsScepter: boolean;
  hasAghanimsShard: boolean;
}

export interface ProcessedTeam {
  players: ProcessedPlayer[];
  netWorth: number;
  totalKills: number;
  totalDeaths: number;
}

export interface ProcessedEnemy {
  steamId: string;
  name: string;
  heroId?: number;
  heroName?: string;
  level?: number;
  alive: boolean;
  respawnSeconds: number;
  buybackAvailable: boolean;
  buybackCost: number;
  position?: number[];
  visible: boolean;
  kills: number;
  deaths: number;
  netWorth: number;
}

export interface ProcessedBuildings {
  radiant: {
    ancient?: ProcessedBuilding;
    t4?: ProcessedBuilding[];
    t3?: ProcessedBuilding[];
    t2?: ProcessedBuilding[];
    t1?: ProcessedBuilding[];
    barracks?: ProcessedBuilding[];
  };
  dire: {
    ancient?: ProcessedBuilding;
    t4?: ProcessedBuilding[];
    t3?: ProcessedBuilding[];
    t2?: ProcessedBuilding[];
    t1?: ProcessedBuilding[];
    barracks?: ProcessedBuilding[];
  };
}

export interface ProcessedBuilding {
  name: string;
  health: number;
  maxHealth: number;
  healthPercent: number;
  destroyed: boolean;
}

export interface ProcessedRoshan {
  alive: boolean;
  respawnTime?: number;
  lastDeathTime?: number;
  aegisHolder?: 'radiant' | 'dire' | null;
}

export interface ProcessedItems {
  inventory: Item[];
  stash: Item[];
  backpack: Item[];
  allItems: Item[];
}

export interface ProcessedAbilities {
  [key: string]: {
    name: string;
    level: number;
    canCast: boolean;
    cooldown: number;
    cooldownRemaining: number;
    isUltimate: boolean;
    ready: boolean;
  };
}

