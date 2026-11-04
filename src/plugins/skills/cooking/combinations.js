// https://classic.runescape.wiki/w/Cooking

// using items on other items to create new ones (knife on pineapple, pizzas,
// stews, etc.)
// Ported from Open-RSC Core-Framework authentic/skills/cooking/InvCooking.java (AGPL-3.0) handleCombineCooking: the
// rows come from rsc-data skills/cooking.json combinations, corrected and extended by src/data-fixes.json (the Oomlie
// meat parcel, the tasty Ugthanki kebab, which knives are needed). A row's experience is in quarter points; a row
// with several messages sends them all; a row with dodgy gives that item instead 1 time in 32, with no experience
// (DataConversions.random(0, 31) < 1: the tasty kebab comes out a dodgy Ugthanki kebab).

require('../../../data-fixes');
const items = require('@2003scape/rsc-data/config/items');
const { combinations } = require('@2003scape/rsc-data/skills/cooking');

const BOWL_OF_WATER_ID = 342;
const CHEESE_ID = 319;
const KNIFE_ID = 13;
const PIZZA_BASE_ID = 321;

function isRawMeat(item) {
    return item.definition.sprite === 60 && /raw/i.test(item.definition.name);
}

function getCombination(item, target) {
    return combinations.find(({ item: itemID, with: targetID }) => {
        return (
            (item.id === itemID && target.id === targetID) ||
            (item.id === targetID && target.id === itemID)
        );
    });
}

async function onUseWithInventory(player, item, target) {
    if (
        (isRawMeat(item) && target.id === BOWL_OF_WATER_ID) ||
        (item.id === BOWL_OF_WATER_ID && isRawMeat(target))
    ) {
        player.message('@que@you need to precook the meat');
        return true;
    }

    if (
        (item.id === PIZZA_BASE_ID && target.id === CHEESE_ID) ||
        (item.id === CHEESE_ID && target.id === PIZZA_BASE_ID)
    ) {
        player.message('@que@I should add the tomato first');
        return true;
    }

    const combination = getCombination(item, target);

    if (!combination) {
        return false;
    }

    const { world } = player;
    const cookingLevel = player.skills.cooking.current;
    const { level, knife, result: resultID, message, experience, dodgy } = combination;

    if (!world.members && items[resultID].members) {
        return false;
    }

    if (cookingLevel < level) {
        player.message(`@que@You need level ${level} cooking to do this`);
        return true;
    }

    if (knife && !player.inventory.has(KNIFE_ID)) {
        player.message('You need a knife in order to cut this');
        return true;
    }

    player.inventory.remove(item.id);
    player.inventory.remove(target.id);

    if (dodgy && Math.floor(Math.random() * 32) < 1) {
        player.inventory.add(dodgy);
        player.message('@que@You make a dodgy looking ugthanki kebab');
        return true;
    }

    player.inventory.add(resultID);

    for (const line of Array.isArray(message) ? message : [message]) {
        player.message(`@que@${line}`);
    }

    if (experience) {
        player.addExperience('cooking', experience);
    }

    return true;
}

module.exports = { onUseWithInventory };
