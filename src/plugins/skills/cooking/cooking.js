// https://classic.runescape.wiki/w/Cooking

// using items on ranges or fires

const { rollSkillSuccess } = require('../../../rolls');
require('../../../data-fixes');
const { uncooked } = require('@2003scape/rsc-data/skills/cooking');

// Ported from Open-RSC Core-Framework authentic/skills/cooking/ObjectCooking.java and Formulae.burnFood (AGPL-3.0)

const CAKE_TIN_ID = 338;
const COOKS_RANGE_ID = 119;
const FIRE_IDS = new Set([97, 274]);
const RANGE_IDS = new Set([11, 435, 491]);

const GAUNTLETS_OF_COOKING_ID = 700;
const RAW_OOMLIE_MEAT_ID = 1268;
const BURNT_MEAT_ID = 134;
const UNCOOKED_SWAMP_PASTE_ID = 784;
const SWAMP_PASTE_ID = 785;
const SEAWEED_ID = 622;
const SODA_ASH_ID = 624;

// Formulae.burnFood: gauntlets of cooking add effective levels on these raw foods (swordfish, lobster, shark)
const GAUNTLET_LEVELS = { 369: 6, 372: 11, 545: 11 };

const COOKS_RANGE_BONUS = 1.05;
const FIRE_PENALTY = 0.95;

function getDefinition(id) {
    const definition = uncooked[id];

    if (definition.reference) {
        return getDefinition(definition.reference);
    }

    return definition; // the uncooked cake row (339) is corrected by src/data-fixes.json
}

function isMeat(item) {
    return item.definition.sprite === 60;
}

// the use-on-object cases that are not raw food: seaweed, swamp paste and oomlie meat
async function cookSpecial(player, gameObject, item, isFire) {
    const { world } = player;

    if (item.id === RAW_OOMLIE_MEAT_ID) {
        player.message(
            `You cook the meat on the ${isFire ? 'fire' : 'stove'}...`
        );
        await world.sleepTicks(5);
        player.inventory.remove(RAW_OOMLIE_MEAT_ID);
        player.inventory.add(BURNT_MEAT_ID);
        player.message('This meat is too delicate to cook like this.');
        await world.sleepTicks(2);
        player.message(
            'Perhaps you can wrap something around it to protect it from the heat.'
        );
        await world.sleepTicks(2);
        return;
    }

    const seaweed = item.id === SEAWEED_ID;

    if (!player.inventory.has(item.id)) {
        player.message("You don't have all the ingredients");
        return;
    }

    if (seaweed) {
        player.sendBubble(item.id);
    }

    player.sendSound('cooking');

    if (seaweed) {
        const name = ((gameObject.definition || {}).name || 'fire').toLowerCase();
        player.message(`You put the seaweed on the ${name}`);
        await world.sleepTicks(3);
        player.message('The seaweed burns to ashes');
    } else {
        player.message('you warm the paste over the fire');
        await world.sleepTicks(3);
        player.message('it thickens into a sticky goo');
    }

    await world.sleepTicks(3);
    player.inventory.remove(item.id);
    player.inventory.add(seaweed ? SODA_ASH_ID : SWAMP_PASTE_ID);
}

async function onUseWithGameObject(player, gameObject, item) {
    const special =
        item.id === RAW_OOMLIE_MEAT_ID ||
        item.id === SEAWEED_ID ||
        item.id === UNCOOKED_SWAMP_PASTE_ID;

    if (!special && !uncooked.hasOwnProperty(item.id)) {
        return false;
    }

    let isRange;
    let isCooksRange = false;

    if (FIRE_IDS.has(gameObject.id)) {
        isRange = false;
    } else if (RANGE_IDS.has(gameObject.id)) {
        isRange = true;
    } else if (gameObject.id === COOKS_RANGE_ID) {
        if (player.questStages.cooksAssistant !== -1) {
            return false;
        }

        isRange = true;
        isCooksRange = true;
    } else {
        return false;
    }

    if (special) {
        await cookSpecial(player, gameObject, item, FIRE_IDS.has(gameObject.id));
        return true;
    }

    const cookingLevel = player.skills.cooking.current;

    const {
        level,
        experience,
        cooked: cookedID,
        burnt: burntID,
        roll: definitionRoll,
        perfect,
        range: needsRange
    } = getDefinition(item.id);

    let cookedName = item.definition.name
        .toLowerCase()
        .replace('raw ', '')
        .replace('uncooked ', '');

    if (cookingLevel < level) {
        player.message(
            `@que@You need a cooking level of ${level} to cook ${cookedName}`
        );

        return true;
    }

    let cookTicks = 3;

    if (needsRange) {
        cookTicks += 2;

        if (!isRange) {
            player.message('@que@You need a proper oven to cook this');
            return true;
        }
    }

    if (isMeat(item)) {
        cookedName = 'meat';
    }

    if (needsRange) {
        player.message(`You cook the ${cookedName} in the oven...`);
    } else {
        // ( QUEST) You cook the stew on the range...
        // from 08-01-2018 21.50.15 cooking pizza and cake
        // by Tylerberg
        const rangeName = /stew/.test(cookedName) ? 'range' : 'stove';

        // (QUEST) You cook the meat on the stove...
        // (QUEST) You cook the meat on the fire...
        const ellipsis = /(meat|stew)/.test(cookedName) ? '...' : '';

        player.message(
            `You cook the ${cookedName} on the ` +
                `${isRange ? rangeName : 'fire'}${ellipsis}`
        );
    }

    player.sendBubble(item.id);

    if (player.isTired()) {
        player.message('You are too tired to cook this food');
        return true;
    }

    const { world } = player;

    player.sendSound('cooking');
    await world.sleepTicks(cookTicks);

    player.inventory.remove(item.id);

    // rows with only a perfect [low, high] roll (oomlie meat parcel) roll with that
    const roll = definitionRoll || perfect;
    let lowRoll = roll[0];

    if (!isRange) {
        lowRoll *= FIRE_PENALTY;
    } else if (isCooksRange) {
        lowRoll *= COOKS_RANGE_BONUS;
    }

    // Formulae.burnFood: gauntlets add effective levels, and at the perfect level food stops burning
    const effectiveLevel =
        cookingLevel +
        (GAUNTLET_LEVELS[item.id] &&
        player.inventory.isEquipped(GAUNTLETS_OF_COOKING_ID)
            ? GAUNTLET_LEVELS[item.id]
            : 0);

    const cookSuccess =
        (typeof perfect === 'number' && effectiveLevel >= perfect) ||
        rollSkillSuccess(lowRoll, roll[1], effectiveLevel);

    if (/pie/.test(cookedName)) {
        cookedName = 'pie';
    }

    if (/cake/.test(cookedName)) {
        player.inventory.add(CAKE_TIN_ID);
    }

    if (cookSuccess) {
        player.inventory.add(cookedID);
        player.addExperience('cooking', experience);

        if (needsRange) {
            player.message(`You remove the ${cookedName} from the oven`);
        } else {
            player.message(`The ${cookedName} is now nicely cooked`);
        }
    } else {
        player.inventory.add(burntID);
        player.message(`@que@You accidentially burn the ${cookedName}`);
    }

    return true;
}

module.exports = { onUseWithGameObject, getDefinition };
