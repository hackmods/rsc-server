// Ported from Open-RSC Core-Framework authentic/itemactions/InvUseOnItem.java (crest fragments) (AGPL-3.0).
// Any crest fragment (695, 696, 697) on another joins all three into the family crest (694).

const { ITEMS } = require('./shared');

const FRAGMENT_IDS = [ITEMS.crestFragmentOne, ITEMS.crestFragmentTwo, ITEMS.crestFragmentThree];

async function onUseWithInventory(player, item, target) {
    if (!FRAGMENT_IDS.includes(item.id) || !FRAGMENT_IDS.includes(target.id)) {
        return false;
    }

    if (!FRAGMENT_IDS.every((id) => player.inventory.has(id))) {
        player.message('You still need one more piece of the crest');
        return true;
    }

    for (const id of FRAGMENT_IDS) {
        player.inventory.remove(id);
    }

    player.message('You put all the pieces of the crest together');
    player.inventory.add(ITEMS.familyCrest);

    return true;
}

module.exports = { onUseWithInventory };
