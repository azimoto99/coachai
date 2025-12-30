/**
 * Item build advisor - recommends items based on game state, hero, and situation
 */

import { ProcessedGameState, Item } from '../types/gameState';
import { CoachingAdvice } from '../types/coaching';
import { logger } from '../utils/logger';

interface ItemRecommendation {
  item: string;
  reason: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  timing?: string;
}

export class ItemBuildAdvisor {
  private readonly CORE_ITEMS: Record<string, string[]> = {
    // Carry heroes - using flexible matching (will match item_power_treads, power_treads, etc.)
    'npc_dota_hero_antimage': ['power_treads', 'battle_fury', 'manta', 'abyssal'],
    'npc_dota_hero_juggernaut': ['power_treads', 'maelstrom', 'manta', 'basher'],
    'npc_dota_hero_phantom_assassin': ['power_treads', 'battle_fury', 'desolator', 'black_king_bar'],
    'npc_dota_hero_slark': ['power_treads', 'invis_sword', 'basher', 'abyssal'],
    'npc_dota_hero_spectre': ['power_treads', 'radiance', 'manta', 'skadi'],
    'npc_dota_hero_terrorblade': ['power_treads', 'manta', 'skadi', 'butterfly'],
    'npc_dota_hero_medusa': ['power_treads', 'manta', 'skadi', 'butterfly'],
    
    // Mid heroes
    'npc_dota_hero_invoker': ['power_treads', 'aether_lens', 'octarine', 'refresher'],
    'npc_dota_hero_puck': ['power_treads', 'blink', 'cyclone', 'dagon'],
    'npc_dota_hero_storm_spirit': ['power_treads', 'orchid', 'bloodstone', 'sheepstick'],
    'npc_dota_hero_queenofpain': ['power_treads', 'orchid', 'blink', 'sheepstick'],
    'npc_dota_hero_tinker': ['soul_ring', 'travel_boots', 'blink', 'dagon'],
    
    // Offlane heroes
    'npc_dota_hero_centaur': ['tranquil_boots', 'blink', 'blade_mail', 'heart'],
    'npc_dota_hero_axe': ['tranquil_boots', 'blink', 'blade_mail', 'heart'],
    'npc_dota_hero_tidehunter': ['arcane_boots', 'blink', 'refresher', 'shivas'],
    'npc_dota_hero_dark_seer': ['soul_ring', 'blink', 'refresher', 'shivas'],
    
    // Support heroes
    'npc_dota_hero_crystal_maiden': ['tranquil_boots', 'glimmer', 'force_staff', 'aether_lens'],
    'npc_dota_hero_lion': ['tranquil_boots', 'blink', 'aether_lens', 'sheepstick'],
    'npc_dota_hero_shadow_shaman': ['arcane_boots', 'blink', 'refresher', 'sheepstick'],
    'npc_dota_hero_witch_doctor': ['tranquil_boots', 'glimmer', 'ultimate_scepter', 'refresher'],
  };

  private readonly SITUATIONAL_ITEMS: Record<string, string[]> = {
    'magic_damage': ['item_black_king_bar', 'item_pipe', 'item_hood_of_defiance'],
    'physical_damage': ['item_assault', 'item_crimson_guard', 'item_shivas_guard'],
    'silence': ['item_black_king_bar', 'item_manta', 'item_lotus_orb'],
    'stuns': ['item_black_king_bar', 'item_sphere', 'item_lotus_orb'],
    'invis': ['item_gem', 'item_ward_sentry', 'item_dust'],
    'push': ['item_desolator', 'item_assault', 'item_necronomicon'],
    'split_push': ['item_travel_boots', 'item_manta', 'item_necronomicon'],
  };

  /**
   * Get item recommendations based on current game state
   */
  public getRecommendations(gameState: ProcessedGameState): CoachingAdvice | null {
    try {
      const heroName = gameState.hero.name;
      const currentItems = gameState.items.inventory.map(item => item.name);
      const gold = gameState.player.gold;
      const level = gameState.hero.level;
      const gameTime = gameState.gameTime;

      // Check for missing core items
      const coreItems = this.CORE_ITEMS[heroName];
      if (coreItems) {
        const missingCore = coreItems.find(item => !this.hasItem(currentItems, item));
        if (missingCore) {
          const itemCost = this.getItemCost(missingCore);
          const canAfford = gold >= itemCost * 0.8; // Can afford 80% of item

          if (canAfford || this.isGoodTiming(gameTime, missingCore)) {
            return {
              priority: 'MEDIUM',
              message: `Consider building ${this.formatItemName(missingCore)} - core item for ${this.formatHeroName(heroName)}`,
              action: 'item_build',
              timestamp: Date.now(),
              gameTime: gameState.gameTime
            };
          }
        }
      }

      // Check for situational items based on enemy team
      const situationalAdvice = this.checkSituationalItems(gameState, currentItems, gold);
      if (situationalAdvice) {
        return situationalAdvice;
      }

      // Check for upgrade opportunities
      const upgradeAdvice = this.checkUpgrades(gameState, currentItems, gold);
      if (upgradeAdvice) {
        return upgradeAdvice;
      }

      // Check for consumables
      const consumableAdvice = this.checkConsumables(gameState, currentItems, gold);
      if (consumableAdvice) {
        return consumableAdvice;
      }

      return null;
    } catch (error) {
      logger.error('Error generating item recommendations:', error);
      return null;
    }
  }

  private checkSituationalItems(
    gameState: ProcessedGameState,
    currentItems: string[],
    gold: number
  ): CoachingAdvice | null {
    const enemies = gameState.enemies;
    
    // Check for magic damage threats
    const magicThreats = enemies.filter(e => 
      e.level && e.level > 10 && !this.hasItem(currentItems, 'black_king_bar')
    );
    if (magicThreats.length >= 3 && gameState.gameTime > 1200) {
      if (gold > 3975) {
        return {
          priority: 'HIGH',
          message: 'Enemy has heavy magic damage - consider BKB soon',
          action: 'item_build',
          timestamp: Date.now(),
          gameTime: gameState.gameTime
        };
      }
    }

    // Check for invis heroes
    const invisHeroes = ['npc_dota_hero_riki', 'npc_dota_hero_clinkz', 'npc_dota_hero_bounty_hunter'];
    const hasInvisEnemy = enemies.some(e => invisHeroes.includes(e.heroName || ''));
    if (hasInvisEnemy && !this.hasItem(currentItems, 'gem') && !this.hasItem(currentItems, 'sentry_ward')) {
      return {
        priority: 'MEDIUM',
        message: 'Enemy has invis heroes - buy detection (sentries/gem)',
        action: 'item_build',
        timestamp: Date.now(),
        gameTime: gameState.gameTime
      };
    }

    return null;
  }

  private checkUpgrades(
    gameState: ProcessedGameState,
    currentItems: string[],
    gold: number
  ): CoachingAdvice | null {
    const upgrades: Record<string, { from: string[], to: string, cost: number }> = {
      'power_treads': { from: ['boots'], to: 'power_treads', cost: 1400 },
      'phase_boots': { from: ['boots'], to: 'phase_boots', cost: 1500 },
      'arcane_boots': { from: ['boots'], to: 'arcane_boots', cost: 1300 },
      'tranquil_boots': { from: ['boots'], to: 'tranquil_boots', cost: 925 },
      'blink_dagger': { from: [], to: 'blink_dagger', cost: 2250 },
      'force_staff': { from: [], to: 'force_staff', cost: 2200 },
    };

    for (const [itemName, upgrade] of Object.entries(upgrades)) {
      if (this.hasItem(currentItems, upgrade.from) && !this.hasItem(currentItems, itemName)) {
        if (gold >= upgrade.cost * 0.9) {
          return {
            priority: 'MEDIUM',
            message: `Upgrade available: ${this.formatItemName(itemName)} - good mobility/utility`,
            action: 'item_build',
            timestamp: Date.now(),
            gameTime: gameState.gameTime
          };
        }
      }
    }

    return null;
  }

  private checkConsumables(
    gameState: ProcessedGameState,
    currentItems: string[],
    gold: number
  ): CoachingAdvice | null {
    const healthPercent = gameState.hero.healthPercent;
    const manaPercent = gameState.hero.manaPercent;

    // Check for TP scroll
    if (!this.hasItem(currentItems, ['tpscroll', 'item_tpscroll', 'tp_scroll']) && gold > 50) {
      return {
        priority: 'LOW',
        message: 'Buy TP scroll - essential for map movement',
        action: 'item_build',
        timestamp: Date.now(),
        gameTime: gameState.gameTime
      };
    }

    // Check for regen if low health/mana
    if (healthPercent < 30 && !this.hasItem(currentItems, ['tango', 'item_tango', 'flask', 'item_flask', 'salve', 'item_tango_single']) && gold > 90) {
      return {
        priority: 'MEDIUM',
        message: 'Low health - buy regen (tango/salve)',
        action: 'item_build',
        timestamp: Date.now(),
        gameTime: gameState.gameTime
      };
    }

    if (manaPercent < 20 && gameState.hero.level > 3 && gold > 50 && !this.hasItem(currentItems, ['clarity', 'item_clarity'])) {
      return {
        priority: 'LOW',
        message: 'Low mana - buy clarity for spell usage',
        action: 'item_build',
        timestamp: Date.now(),
        gameTime: gameState.gameTime
      };
    }

    return null;
  }

  private hasItem(items: string[], itemName: string | string[]): boolean {
    const normalizeItemName = (name: string): string => {
      // Handle Dota 2 item name formats: "item_power_treads", "power_treads", etc.
      return name.toLowerCase().replace(/^item_/, '');
    };

    if (Array.isArray(itemName)) {
      return itemName.some(name => {
        const normalized = normalizeItemName(name);
        return items.some(i => normalizeItemName(i).includes(normalized) || normalized.includes(normalizeItemName(i)));
      });
    }
    const normalized = normalizeItemName(itemName);
    return items.some(i => {
      const itemNormalized = normalizeItemName(i);
      return itemNormalized.includes(normalized) || normalized.includes(itemNormalized);
    });
  }

  private getItemCost(itemName: string): number {
    // Approximate costs for common items
    const costs: Record<string, number> = {
      'power_treads': 1400,
      'phase_boots': 1500,
      'arcane_boots': 1300,
      'tranquil_boots': 925,
      'blink_dagger': 2250,
      'battle_fury': 4100,
      'manta_style': 4600,
      'black_king_bar': 3975,
      'desolator': 3500,
      'skull_basher': 2875,
      'abyssal_blade': 6250,
      'radiance': 5050,
      'skadi': 5500,
      'butterfly': 5450,
      'assault_cuirass': 5125,
      'refresher_orb': 5000,
      'scythe_of_vyse': 5675,
      'orchid_malevolence': 3475,
      'bloodstone': 4600,
      'boots_of_travel': 2500,
      'force_staff': 2200,
      'glimmer_cape': 1950,
      'aether_lens': 2275,
      'aghs_scepter': 4200,
    };
    return costs[itemName] || 2000; // Default estimate
  }

  private isGoodTiming(gameTime: number, itemName: string): boolean {
    const timings: Record<string, number> = {
      'power_treads': 300,
      'phase_boots': 300,
      'blink_dagger': 600,
      'battle_fury': 900,
      'black_king_bar': 1200,
      'manta_style': 1500,
    };
    const expectedTime = timings[itemName] || 0;
    return gameTime >= expectedTime * 0.8 && gameTime <= expectedTime * 1.5;
  }

  private formatItemName(itemName: string): string {
    return itemName.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  private formatHeroName(heroName: string): string {
    return heroName.replace('npc_dota_hero_', '').split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }
}

export const itemBuildAdvisor = new ItemBuildAdvisor();

