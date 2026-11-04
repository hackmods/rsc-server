// Ported from Open-RSC Core-Framework authentic/misc/PickFromTree.java (AGPL-3.0), the pineapple half (the banana tree
// is game-objects/banana-tree.js): "Pick pineapple" on a pineapple tree (430, Karamja) gives a fresh pineapple (861).
// The picks are counted per player (Java cache key pineapple_pick, here player.cache.pineapple_pick): the 4th pick
// strips the tree, which shows as the bare tree (431) for 750 ticks (8 minutes) and the count starts again.
// Cutting pineapples into rings and chunks, and gnome cooking with them, are not this plugin.

const PINEAPPLE_TREE_ID = 430;
const EMPTY_PINEAPPLE_TREE_ID = 431;
const FRESH_PINEAPPLE_ID = 861;

const TOTAL_PICKS = 4;
const REGROW_TICKS = 750;

async function onGameObjectCommandTwo(player, gameObject) {
    if (gameObject.id === EMPTY_PINEAPPLE_TREE_ID) {
        player.message('there are no pineapples left on the tree');
        return true;
    }

    if (gameObject.id !== PINEAPPLE_TREE_ID) {
        return false;
    }

    const picks = (Number(player.cache.pineapple_pick) || 0) + 1;

    player.cache.pineapple_pick = picks;
    player.inventory.add(FRESH_PINEAPPLE_ID);

    if (picks >= TOTAL_PICKS) {
        player.world.replaceTimed('gameObjects', gameObject, EMPTY_PINEAPPLE_TREE_ID, REGROW_TICKS);
        delete player.cache.pineapple_pick;
    } else {
        player.message('you pick a pineapple');
    }

    return true;
}

module.exports = { onGameObjectCommandTwo };
