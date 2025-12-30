/**
 * Constants for Dota 2 coaching bot
 */

export const WIN_CONDITIONS = {
  earlyPush: {
    heroes: ['chen', 'enchantress', 'lycan', 'beastmaster', 'shadow_shaman', 'pugna', 'death_prophet'],
    timing: '5-15min',
    strategy: 'Group early, take towers before enemy cores come online',
    keyItems: ['mekansm', 'pipe', 'soul_ring', 'arcane_boots']
  },
  timingPush: {
    heroes: ['sven', 'dragon_knight', 'leshrac', 'death_prophet', 'luna', 'drow_ranger'],
    timing: '15-25min',
    strategy: 'Push when BKB/key items complete, force highground',
    keyItems: ['black_king_bar', 'blink_dagger', 'desolator', 'assault_cuirass']
  },
  splitPush: {
    heroes: ['natures_prophet', 'lycan', 'arc_warden', 'terrorblade', 'tinker', 'broodmother'],
    timing: 'Any',
    strategy: 'Create map pressure, force rotations, hit buildings',
    keyItems: ['boots_of_travel', 'manta_style', 'necronomicon']
  },
  highgroundSiege: {
    heroes: ['sniper', 'techies', 'keeper_of_the_light', 'tinker', 'pugna', 'jakiro'],
    timing: '25-40min',
    strategy: 'Starve enemy, siege slowly with superior range',
    keyItems: ['aether_lens', 'octarine_core', 'refresher_orb']
  },
  outscale: {
    heroes: ['medusa', 'spectre', 'anti_mage', 'phantom_assassin', 'faceless_void', 'troll_warlord'],
    timing: '35min+',
    strategy: 'Delay game, defend highground, farm to 6-slot',
    keyItems: ['manta_style', 'skadi', 'butterfly', 'satanic']
  }
};

export const POWER_SPIKES = {
  level: {
    6: 'Ultimate available - major spike for most heroes',
    12: 'Level 2 ultimate',
    15: 'Key talent unlock',
    20: 'Second major talent',
    25: 'Game-changing talent'
  },
  items: {
    // Early game (0-15min)
    'blink_dagger': { description: 'Initiation spike - force fights', timing: '10-15min' },
    'arcane_boots': { description: 'Mana sustain - enable push', timing: '3-5min' },
    'soul_ring': { description: 'Spam abilities for push', timing: '5-8min' },
    'mekansm': { description: 'Team sustain for push', timing: '8-12min' },
    'pipe_of_insight': { description: 'Magic resistance for push', timing: '12-15min' },
    
    // Mid game (15-30min)
    'black_king_bar': { description: 'HUGE spike - magic immunity window', timing: '15-20min' },
    'desolator': { description: 'Building damage spike', timing: '15-20min' },
    'maelstrom': { description: 'Wave clear spike', timing: '12-18min' },
    'shadow_blade': { description: 'Pick-off potential', timing: '12-18min' },
    'assault_cuirass': { description: 'Team fight + building damage', timing: '20-25min' },
    
    // Late game (30min+)
    'refresher_orb': { description: 'Double ultimates - end game now', timing: '30min+' },
    'aegis': { description: 'Roshan - force highground immediately', timing: '20min+' },
    'cheese': { description: 'Extra life for cores', timing: '20min+' }
  },
  hero_specific: {
    'phantom_assassin': ['battle_fury', 'desolator'],
    'sven': ['echo_sabre', 'blink_dagger', 'black_king_bar'],
    'medusa': ['manta_style', 'skadi'],
    'alchemist': ['radiance'],
    'lone_druid': 'level_5',
    'nightstalker': 'first_night',
    'dragon_knight': 'level_6'
  }
};

export const TOWER_PRIORITY = {
  'ancient': 100,
  't3': 80,
  'barracks': 75,
  't2_mid': 60,
  't2_safelane': 55,
  't2_offlane': 50,
  't1_mid': 40,
  't1_safelane': 35,
  't1_offlane': 30
};

export const RATE_LIMITS = {
  GAME_ENDING: 0,
  CRITICAL: 10000,    // 10 seconds
  HIGH: 30000,        // 30 seconds
  MEDIUM: 60000,      // 1 minute
  LOW: 120000         // 2 minutes
};

export const CS_TARGETS = {
  5: 38,   // ~40 CS at 5 min
  10: 82,  // ~80 CS at 10 min
  15: 120, // ~120 CS at 15 min
  20: 160  // ~160 CS at 20 min
};

export const GAME_PHASES = {
  laning: { start: 0, end: 600 },      // 0-10 min
  midgame: { start: 600, end: 1500 },  // 10-25 min
  lategame: { start: 1500, end: Infinity } // 25+ min
};

