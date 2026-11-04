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
// Herblaw.java doHerblaw's non-herb vial mixes (jangerberries -> unfinished potion 1074, ardrigal and snake weed ->
// their solutions 1252/1251, ground bat bones fizz away) and the Gujuo potion (Legends' Quest gated) are ported too.

require('../../data-fixes'); // corrects the potion and Jungle Potion herb rows
const items = require('@2003scape/rsc-data/config/items');
const herblaw = require('@2003scape/rsc-data/skills/herblaw');

const VIAL_OF_WATER_ID = 464;
const PESTLE_AND_MORTAR_ID = 468;
const BAT_BONES_ID = 604;
const CHARCOAL_ID = 983;
const BLAMISH_OIL_ID = 588;
const FISHING_ROD_ID = 377;
const OILY_FISHING_ROD_ID = 589;
const EMPTY_VIAL_ID = 465;
const GROUND_BAT_BONES_ID = 1051;
const JANGERBERRIES_ID = 936;
const SNAKE_WEED_ID = 816;
const ARDRIGAL_ID = 818;
const UNFINISHED_POTION_ID = 1074;
const SNAKES_WEED_SOLUTION_ID = 1251;
const ARDRIGAL_SOLUTION_ID = 1252;
const GUJUO_POTION_ID = 1253;

// Herblaw.java doHerblaw: things put in a vial of water that are not herblaw herbs. No level, no quest, no experience.
// The ground bat bones fizz away and leave an empty vial.
const VIAL_MIXES = new Map([
    [JANGERBERRIES_ID, { id: UNFINISHED_POTION_ID, messages: ['You mix the berries into the water'] }],
    [ARDRIGAL_ID, { id: ARDRIGAL_SOLUTION_ID, messages: ['You put the ardrigal herb into the watervial.', 'You make a solution of Ardrigal.'] }],
    [SNAKE_WEED_ID, { id: SNAKES_WEED_SOLUTION_ID, messages: ['You put the Snake Weed herb into the watervial.', 'You make a solution of Snake Weed.'] }]
]);

// Herblaw.java onUseInv: the Gujuo potion (Legends' Quest) from either solution and the other herb: herblaw 45, the
// Druidic Ritual, and the secret Gujuo tells at Legends' Quest stage 7 (not started counts as stage 0)
const GUJUO_MIXES = [
    { solution: SNAKES_WEED_SOLUTION_ID, herb: ARDRIGAL_ID, message: 'You add the Ardrigal to the Snakesweed Solution.' },
    { solution: ARDRIGAL_SOLUTION_ID, herb: SNAKE_WEED_ID, message: 'You add the Snake Weed to the Ardrigal solution.' }
];

// item ground on a pestle and mortar -> ground item
const GRINDABLE = new Map([
    [466, 473], // unicorn horn
    [467, 472], // blue dragon scale
    [BAT_BONES_ID, 1051],
    [CHARCOAL_ID, 1179], // ground charcoal (Shilo Village)
    [337, 772] // chocolate bar -> chocolate dust
]);

const unfinishedByHerb = new Map(Object.entries(herblaw.unfinished).map(([id, def]) => [Number(id), def]));
const herbsByID = new Map(Object.entries(herblaw.herbs).map(([id, def]) => [Number(id), def]));

// unfinished potion id -> Map(secondary id -> { level, experience, id })
const recipes = new Map();

for (const [unfinished, secondaries] of Object.entries(herblaw.potions)) {
    const byItem = new Map();

    for (const [secondary, def] of Object.entries(secondaries)) {
        byItem.set(Number(secondary), def);
    }

    recipes.set(Number(unfinished), byItem);
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

async function mixInVial(player, id) {
    if (!player.inventory.has(id) || !player.inventory.has(VIAL_OF_WATER_ID)) {
        return true;
    }

    player.inventory.remove(VIAL_OF_WATER_ID);
    player.inventory.remove(id);

    if (id === GROUND_BAT_BONES_ID) {
        player.message('You mix the ground bones into the water');
        player.message('Fizz!!!');
        await player.say('Oh dear, the mixture has evaporated!', "It's useless...");
        player.inventory.add(EMPTY_VIAL_ID);
        return true;
    }

    const mix = VIAL_MIXES.get(id);

    for (const message of mix.messages) {
        player.message(message);
    }

    player.inventory.add(mix.id);

    return true;
}

async function mixGujuo(player, { solution, herb, message }) {
    if (herblawLevel(player) < 45) {
        player.message('@que@You need to have a herblaw level of 45 or over to mix this potion');
        return true;
    }

    if (!druidicRitualDone(player)) {
        player.message('You need to complete Druidic ritual quest first');
        return true;
    }

    const legends = player.questStages.legendsQuest || 0;

    if (legends >= 0 && legends < 7) {
        player.message("You're not quite sure what effect this will have.");
        player.message('You decide against experimenting.');
        return true;
    }

    if (!player.inventory.has(solution) || !player.inventory.has(herb)) {
        return true;
    }

    player.message(message);
    player.message('The mixture seems to bubble slightly with a strange effervescence...');
    player.inventory.remove(herb);
    player.inventory.remove(solution);
    player.inventory.add(GUJUO_POTION_ID);

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
        const gujuo = GUJUO_MIXES.find((m) => m.solution === first.id && m.herb === second.id);

        if (gujuo) {
            return mixGujuo(player, gujuo);
        }

        if (second.id === VIAL_OF_WATER_ID && (VIAL_MIXES.has(first.id) || first.id === GROUND_BAT_BONES_ID)) {
            return mixInVial(player, first.id);
        }

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
