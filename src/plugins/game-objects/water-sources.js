const Item = require('../../model/item');

const BUCKET_ID = 21;
const SOURCE_IDS = new Set([26, 48, 86, 1130]);
const WELL_IDS = new Set([2, 466, 814]);

async function onUseWithGameObject(player, gameObject, item) {
    const refilledID = Item.getFullWater(item.id);

    // Open-RSC Refill.blockUseLoc: a refillable item on a source (fountain, sink, pump), or a bucket on a well. The old test
    // (`undefined || well-and-not-bucket && not-source`) let every other object through: an empty vial used on the Dig Site's
    // barrel of unidentified liquid came back full of water, and the quest's step after it had nothing to use.
    const fromSource = SOURCE_IDS.has(gameObject.id);
    const fromWell = WELL_IDS.has(gameObject.id) && item.id === BUCKET_ID;

    if (typeof refilledID === 'undefined' || !(fromSource || fromWell)) {
        return false;
    }

    const { world } = player;

    player.sendBubble(item.id);
    player.sendSound('filljug');
    await world.sleepTicks(2);

    player.inventory.remove(item.id);
    player.inventory.add(refilledID);

    player.message(
        `You fill the ${item.definition.name.toLowerCase()} from the ` +
            gameObject.definition.name.toLowerCase()
    );

    return true;
}

module.exports = { onUseWithGameObject };
