// https://classic.runescape.wiki/w/Crafting#Gems
// The semi-precious gems (opal, jade, red topaz) can smash into a crushed gemstone (915), as in Open-RSC Core-Framework
// authentic/skills/crafting/Crafting.java batchGemCutting and Formulae.smashGem (AGPL-3.0): the cut succeeds on
// calcProductionSuccessfulLegacy(level, crafting, true, level + 89), a smash still gives a little experience
// (red topaz 25, jade 20, opal 15, quarter points).

const items = require('@2003scape/rsc-data/config/items');
const { cutting } = require('@2003scape/rsc-data/skills/crafting');

const CHISEL_ID = 167;
const CRUSHED_GEMSTONE_ID = 915;
const UNCUT_GEM_IDS = new Set(Object.keys(cutting).map(Number));

// uncut opal 891, jade 890, red topaz 889 -> experience for a smash
const SMASH_EXPERIENCE = new Map([
    [891, 15],
    [890, 20],
    [889, 25]
]);

// Formulae.calcProductionSuccessfulLegacy(levelReq, skillLevel, stopsFailing = true, levelStopFail)
function productionSuccessLegacy(levelReq, skillLevel, levelStopFail, roll = 1 + Math.floor(Math.random() * 256)) {
    if (skillLevel < levelReq) {
        return false;
    }

    const threshold = Math.min(256, Math.floor(64 + (skillLevel - 1) * (19200 / (levelStopFail * 98))));

    return roll <= threshold;
}

function smashes(uncutID, level, craftingLevel) {
    return SMASH_EXPERIENCE.has(uncutID) && !productionSuccessLegacy(level, craftingLevel, level + 89);
}

async function onUseWithInventory(player, item, target) {
    if (
        (item.id !== CHISEL_ID || !UNCUT_GEM_IDS.has(target.id)) &&
        (!UNCUT_GEM_IDS.has(item.id) || target.id !== CHISEL_ID)
    ) {
        return false;
    }

    const craftingLevel = player.skills.crafting.current;
    const uncutID = item.id === CHISEL_ID ? target.id : item.id;
    const { level, experience, id: cutID, alias } = cutting[uncutID];

    if (craftingLevel < level) {
        const gemName = alias || items[cutID].name;

        player.message(
            `@que@you need a crafting level of ${level} to cut ${gemName}`
        );

        return true;
    }

    player.inventory.remove(uncutID);

    if (smashes(uncutID, level, craftingLevel)) {
        player.message(`You miss hit the chisel and smash the ${items[cutID].name} to pieces!`);
        player.inventory.add(CRUSHED_GEMSTONE_ID);
        player.addExperience('crafting', SMASH_EXPERIENCE.get(uncutID));

        return true;
    }

    player.inventory.add(cutID);
    player.message(`You cut the ${items[cutID].name.toLowerCase()}`);
    player.sendSound('chisel');
    player.addExperience('crafting', experience);

    return true;
}

module.exports = { onUseWithInventory, productionSuccessLegacy };
