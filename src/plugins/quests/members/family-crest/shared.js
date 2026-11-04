// Family Crest (members): ids, the gauntlet enchantment and the helpers the skill code calls.
// Ported from Open-RSC Core-Framework (AGPL-3.0):
//   authentic/quests/members/FamilyCrest.java (getGauntletEnchantment), external/Gauntlets.java,
//   model/container/Inventory.java dropOnDeath (gauntlets come back after death), skills/mining/Mining.java
//   (perfect gold rock), skills/smithing/Smelting.java (perfect gold, gauntlets of goldsmithing),
//   skills/crafting/Crafting.java (perfect ruby ring and necklace), util/rsc/Formulae.java burnFood (gauntlets of
//   cooking), net/rsc/handlers/SpellHandler.java (gauntlets of chaos), npcs/alkharid/*.java (asking about Avan).
//
// Stages (player.questStages.familyCrest):
//   0 not started (Dimintheis, Varrock)          1 sent to Caleb (Catherby chef)
//   2 Caleb wants cooked swordfish, bass, tuna, salmon and shrimp
//   3 has crest fragment 695, look for Avan in Al Kharid
//   4 gem trader said Avan is in the scorpion pit  5 Avan wants perfect gold ruby ring + necklace
//   6 Boot told where the perfect gold is         7 has fragment 696, find Johnathon (Jolly Boar inn)
//   8 Johnathon cured, kill Chronozon for fragment 697     -1 done (1 quest point, steel gauntlets)
//
// player.cache.famcrest_gauntlets (Open-RSC key): 0 steel, 1 goldsmithing, 2 cooking, 3 chaos.

const ITEMS = {
    perfectGold: 690,
    perfectGoldBar: 691,
    perfectRubyRing: 692,
    perfectRubyNecklace: 693,
    familyCrest: 694,
    crestFragmentOne: 695,
    crestFragmentTwo: 696,
    crestFragmentThree: 697,
    steelGauntlets: 698,
    gauntletsOfGoldsmithing: 699,
    gauntletsOfCooking: 700,
    gauntletsOfChaos: 701,
    ashes: 181,
    goldBar: 172,
    rubyRing: 286,
    rubyNecklace: 291
};

const NPCS = {
    avan: 307,
    dimintheis: 309,
    caleb: 310,
    boot: 313,
    johnathon: 314,
    chronozon: 315
};

// Gauntlets.java: enchantment id -> item
const GAUNTLETS = {
    STEEL: 0,
    GOLDSMITHING: 1,
    COOKING: 2,
    CHAOS: 3
};

const GAUNTLET_ITEMS = [
    ITEMS.steelGauntlets,
    ITEMS.gauntletsOfGoldsmithing,
    ITEMS.gauntletsOfCooking,
    ITEMS.gauntletsOfChaos
];

const PERFECT_GOLD_ROCK_ID = 315;

function stage(player) {
    return player.questStages.familyCrest || 0;
}

// FamilyCrest.getGauntletEnchantment: steel when the key is missing
function getGauntletEnchantment(player) {
    const value = player.cache && player.cache.famcrest_gauntlets;
    return typeof value === 'number' ? value : GAUNTLETS.STEEL;
}

// the enchanted pair is worn and the cache agrees with it
function wearsGauntlets(player, enchantment) {
    return (
        getGauntletEnchantment(player) === enchantment &&
        player.inventory.isEquipped(GAUNTLET_ITEMS[enchantment])
    );
}

// SpellHandler: gauntlets of chaos add 1 to the max hit of the bolt spells
function boltBonus(player, spellName) {
    return /bolt/.test(String(spellName).toLowerCase()) &&
        wearsGauntlets(player, GAUNTLETS.CHAOS)
        ? 1
        : 0;
}

// Smelting: gauntlets of goldsmithing add 45 (quarter points) to a gold bar
function goldsmithingBonus(player, barID) {
    return barID === ITEMS.goldBar &&
        wearsGauntlets(player, GAUNTLETS.GOLDSMITHING)
        ? 45
        : 0;
}

// Formulae.burnFood: the cooking bonus needs the worn gauntlets of cooking and famcrest_gauntlets == COOKING
function cookingGauntlets(player) {
    return wearsGauntlets(player, GAUNTLETS.COOKING);
}

// Mining: the perfect gold rocks only give ore from stage 6 (Boot's lead) until the quest ends
function canMinePerfectGold(player, rockID) {
    return rockID !== PERFECT_GOLD_ROCK_ID || stage(player) >= 6;
}

// Crafting: a perfect gold bar makes the quest ruby ring and necklace, anything else as usual
function perfectJewellery(barID, resultID) {
    if (barID !== ITEMS.perfectGoldBar) {
        return resultID;
    }

    if (resultID === ITEMS.rubyRing) {
        return ITEMS.perfectRubyRing;
    }

    if (resultID === ITEMS.rubyNecklace) {
        return ITEMS.perfectRubyNecklace;
    }

    return resultID;
}

// Inventory.dropOnDeath: after the quest the gauntlets come back unless they are in the bank or still carried
// (authentically this duplicates a pair that was just dropped)
function returnGauntletsOnDeath(player) {
    if (!player.questStages || player.questStages.familyCrest !== -1) {
        return false;
    }

    const id = GAUNTLET_ITEMS[getGauntletEnchantment(player)];

    if (!id || player.inventory.has(id) || (player.bank && player.bank.has(id))) {
        return false;
    }

    player.inventory.add(id);
    return true;
}

// swap the carried (or worn) steel gauntlets for an enchanted pair
function enchantGauntlets(player, enchantment) {
    if (!player.inventory.has(ITEMS.steelGauntlets)) {
        return false;
    }

    player.inventory.remove(ITEMS.steelGauntlets);
    player.inventory.add(GAUNTLET_ITEMS[enchantment]);
    player.cache.famcrest_gauntlets = enchantment;

    return true;
}

// the Al Kharid shopkeepers offer this question at stages 3 and 4
function canAskForAvan(player) {
    const questStage = stage(player);
    return questStage > 2 && questStage < 5;
}

const ASK_FOR_AVAN = "I'm in search of a man named adam fitzharmon";

// LouieLegs, RanaelSkirt, ZekeScimitars, KebabSeller
async function kebabSellerAdamFitzharmon(npc) {
    await npc.say(
        "I haven't seen him",
        "I'm sure if he's been to Al Kharid recently",
        'Someone around here will have seen him though'
    );
}

module.exports = {
    ITEMS,
    NPCS,
    GAUNTLETS,
    GAUNTLET_ITEMS,
    PERFECT_GOLD_ROCK_ID,
    ASK_FOR_AVAN,
    stage,
    getGauntletEnchantment,
    wearsGauntlets,
    boltBonus,
    goldsmithingBonus,
    cookingGauntlets,
    canMinePerfectGold,
    perfectJewellery,
    returnGauntletsOnDeath,
    enchantGauntlets,
    canAskForAvan,
    kebabSellerAdamFitzharmon
};
