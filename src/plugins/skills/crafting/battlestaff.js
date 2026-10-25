// Ported from Open-RSC Core-Framework authentic/skills/crafting/BattlestaffCrafting.java (AGPL-3.0)

const { battlestaves } = require('@2003scape/rsc-data/skills/crafting');

const BATTLESTAFF_ID = 614;
const ORB_IDS = new Set(Object.keys(battlestaves).map(Number));

// Names used in the level message, as in BattlestaffCrafting.resultItemString (including its "a earth" spelling)
const STAFF_NAMES = {
    612: 'a fire battlestaff',
    613: 'a water battlestaff',
    626: 'an air battlestaff',
    627: 'a earth battlestaff'
};

async function onUseWithInventory(player, item, target) {
    if (
        (item.id !== BATTLESTAFF_ID || !ORB_IDS.has(target.id)) &&
        (!ORB_IDS.has(item.id) || target.id !== BATTLESTAFF_ID)
    ) {
        return false;
    }

    const orbID = item.id === BATTLESTAFF_ID ? target.id : item.id;
    const { level, experience, id: resultID } = battlestaves[orbID];

    if (player.skills.crafting.current < level) {
        player.message(
            `@que@You need a crafting level of ${level} to make ${STAFF_NAMES[orbID]}`
        );

        return true;
    }

    player.inventory.remove(BATTLESTAFF_ID);
    player.inventory.remove(orbID);
    player.inventory.add(resultID);
    player.addExperience('crafting', experience);

    return true;
}

module.exports = { onUseWithInventory };
