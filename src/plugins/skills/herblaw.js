// ARSC overlay: upstream has no herblaw plugin. Classic herblaw (https://classic.runescape.wiki/w/Herblaw) from rsc-data
// skills/herblaw.json:
//  - identify: the "Identify" command on an unidentified herb (`herbs`): level, XP, swaps the item;
//  - herb on a vial of water (`unfinished`): level, no XP, makes an unfinished potion;
//  - secondary ingredient on an unfinished potion (`potions`): level, XP, makes the potion.
// All of it needs the Druidic Ritual quest (questStages.druidicRitual === -1). Drinking is in items/potions.js.
// Grinding (pestle and mortar on an item, Herblaw.java doGrind, no level, no quest, no XP) is ported from the same file:
// one item per use, the pestle and mortar is kept.
// rsc-data experience values are quarter points, which player.addExperience takes as is.
// Ported from Open-RSC Core-Framework authentic/skills/herblaw/Herblaw.java (AGPL-3.0): the Jungle Potion herbs
// (ItemUnIdentHerbDef.xml 815-823, rsc-data has no entry for them: level 3, no XP, same Druidic Ritual gate as every herb)
// and InvUseOnItem.java blamish oil on a fishing rod -> oily fishing rod (no level, no quest, no XP).

const items = require('@2003scape/rsc-data/config/items');
const herblaw = require('@2003scape/rsc-data/skills/herblaw');

const VIAL_OF_WATER_ID = 464;
const ASHES_ID = 181;
const CURE_POISON_ID = 566;
const MARRENTILL_UNFINISHED_ID = 455;
const PESTLE_AND_MORTAR_ID = 468;
const BAT_BONES_ID = 604;
const CHARCOAL_ID = 983;
const BLAMISH_OIL_ID = 588;
const FISHING_ROD_ID = 377;
const OILY_FISHING_ROD_ID = 589;

// Jungle Potion unidentified herbs -> snake weed, ardrigal, sito foil, volencia moss, rogue's purse
const JUNGLE_HERBS = [[815, 816], [817, 818], [819, 820], [821, 822], [823, 824]];

// item ground on a pestle and mortar -> ground item
const GRINDABLE = new Map([
    [466, 473], // unicorn horn
    [467, 472], // blue dragon scale
    [BAT_BONES_ID, 1051],
    [CHARCOAL_ID, 1179], // ground charcoal (Shilo Village)
    [337, 772] // chocolate bar -> chocolate dust
]);

// rsc-data lists the cure poison potion as its own secondary ingredient; the real recipe is marrentill + ashes
const POTION_FIXES = [{ unfinished: MARRENTILL_UNFINISHED_ID, secondary: ASHES_ID, level: 5, experience: 150, id: CURE_POISON_ID }];

const unfinishedByHerb = new Map(Object.entries(herblaw.unfinished).map(([id, def]) => [Number(id), def]));
const herbsByID = new Map(Object.entries(herblaw.herbs).map(([id, def]) => [Number(id), def]));

for (const [unidentified, identified] of JUNGLE_HERBS) {
    if (!herbsByID.has(unidentified)) {
        herbsByID.set(unidentified, { level: 3, experience: 0, id: identified });
    }
}

// unfinished potion id -> Map(secondary id -> { level, experience, id })
const recipes = new Map();

for (const [unfinished, secondaries] of Object.entries(herblaw.potions)) {
    const byItem = new Map();

    for (const [secondary, def] of Object.entries(secondaries)) {
        // skip the self-referential cure poison entry
        if (def.id !== Number(secondary)) {
            byItem.set(Number(secondary), def);
        }
    }

    recipes.set(Number(unfinished), byItem);
}

for (const fix of POTION_FIXES) {
    recipes.get(fix.unfinished).set(fix.secondary, fix);
}

function druidicRitualDone(player) {
    return player.questStages.druidicRitual === -1;
}

function itemName(id) {
    return items[id].name.toLowerCase();
}

function herblawLevel(player) {
    return player.skills.herblaw.current;
}

function refuseWithoutQuest(player) {
    player.message(
        'You cannot use herblaw until you have completed the Druidic Ritual quest'
    );
}

async function identifyHerb(player, item, herb) {
    const { world } = player;

    if (!druidicRitualDone(player)) {
        refuseWithoutQuest(player);
        return true;
    }

    if (herblawLevel(player) < herb.level) {
        player.message(
            'Your herblaw ability is not high enough to identify this herb'
        );

        return true;
    }

    player.message('@que@You identify the herb');
    await world.sleepTicks(2);

    if (!player.inventory.has(item.id)) {
        return true;
    }

    player.inventory.remove(item.id);
    player.inventory.add(herb.id);

    if (herb.experience) {
        player.addExperience('herblaw', herb.experience);
    }

    player.message(`@que@This herb is ${itemName(herb.id)}`);

    return true;
}

async function makeUnfinished(player, herbItem, unfinished) {
    const { world } = player;

    if (!druidicRitualDone(player)) {
        refuseWithoutQuest(player);
        return true;
    }

    if (herblawLevel(player) < unfinished.level) {
        player.message(
            `You need level ${unfinished.level} herblaw to mix this herb`
        );

        return true;
    }

    player.message(
        `@que@You put the ${itemName(herbItem.id)} into the vial of water`
    );

    await world.sleepTicks(2);

    if (!player.inventory.has(herbItem.id) || !player.inventory.has(VIAL_OF_WATER_ID)) {
        return true;
    }

    player.inventory.remove(herbItem.id);
    player.inventory.remove(VIAL_OF_WATER_ID);
    player.inventory.add(unfinished.id);

    return true;
}

async function makePotion(player, unfinishedItem, secondaryItem, recipe) {
    const { world } = player;

    if (!druidicRitualDone(player)) {
        refuseWithoutQuest(player);
        return true;
    }

    if (herblawLevel(player) < recipe.level) {
        player.message(
            `You need level ${recipe.level} herblaw to mix these ingredients`
        );

        return true;
    }

    player.message(
        `@que@You mix the ${itemName(secondaryItem.id)} into your potion`
    );

    await world.sleepTicks(2);

    if (!player.inventory.has(unfinishedItem.id) || !player.inventory.has(secondaryItem.id)) {
        return true;
    }

    player.inventory.remove(unfinishedItem.id);
    player.inventory.remove(secondaryItem.id);
    player.inventory.add(recipe.id);
    player.addExperience('herblaw', recipe.experience);
    const name = itemName(recipe.id);
    player.message(`@que@You make ${/^[aeiou]/.test(name) ? 'an' : 'a'} ${name}`);

    return true;
}

function grind(player, item, product) {
    player.inventory.remove(item.id);

    if (item.id === CHARCOAL_ID) {
        player.message('You grind the charcoal to a powder');
    }

    player.message(`@que@You grind the ${items[item.id].name} to dust`);

    if (item.id === BAT_BONES_ID) {
        player.sendBubble(PESTLE_AND_MORTAR_ID);
    }

    player.inventory.add(product);

    return true;
}

async function onInventoryCommand(player, item) {
    const herb = herbsByID.get(item.id);

    if (!herb || !/identify/i.test(item.definition.command || '')) {
        return false;
    }

    return identifyHerb(player, item, herb);
}

async function onUseWithInventory(player, item, target) {
    if (
        (item.id === BLAMISH_OIL_ID && target.id === FISHING_ROD_ID) ||
        (item.id === FISHING_ROD_ID && target.id === BLAMISH_OIL_ID)
    ) {
        if (player.inventory.has(BLAMISH_OIL_ID) && player.inventory.has(FISHING_ROD_ID)) {
            player.inventory.remove(BLAMISH_OIL_ID);
            player.inventory.remove(FISHING_ROD_ID);
            player.message('You rub the oil onto the fishing rod');
            player.inventory.add(OILY_FISHING_ROD_ID);
        }

        return true;
    }

    for (const [first, second] of [[item, target], [target, item]]) {
        if (first.id === PESTLE_AND_MORTAR_ID && GRINDABLE.has(second.id)) {
            return grind(player, second, GRINDABLE.get(second.id));
        }

        if (second.id === VIAL_OF_WATER_ID && unfinishedByHerb.has(first.id)) {
            return makeUnfinished(player, first, unfinishedByHerb.get(first.id));
        }

        const recipe = recipes.has(first.id) && recipes.get(first.id).get(second.id);

        if (recipe) {
            return makePotion(player, first, second, recipe);
        }
    }

    return false;
}

module.exports = { onInventoryCommand, onUseWithInventory };
