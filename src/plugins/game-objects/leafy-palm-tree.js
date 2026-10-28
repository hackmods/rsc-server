// Ported from Open-RSC Core-Framework authentic/misc/LeafyPalmTree.java (AGPL-3.0): shaking a Leafy Palm Tree (1176)
// drops a palm leaf at its foot and leaves a plain palm (33) for 15 seconds, then the leaves grow back. The client shows
// the full tree with a loose frond (Autonomous-RSC scripts/client-config/fruit-trees.mjs), so "shake" is visible.

const LEAFY_PALM_TREE_ID = 1176;
const PALM_TREE_ID = 33;
const PALM_TREE_LEAF_ID = 1279;

const REGROW_TICKS = 24; // 15 seconds of 640ms ticks

async function onGameObjectCommandTwo(player, gameObject) {
    if (gameObject.id !== LEAFY_PALM_TREE_ID) {
        return false;
    }

    const { world } = player;

    player.message('You give the palm tree a good shake.');
    await world.sleepTicks(2);

    // someone else may have shaken it while we waited
    if (world.gameObjects.getAtPoint(gameObject.x, gameObject.y)[0] !== gameObject) {
        return true;
    }

    player.message('A palm leaf falls down.');
    world.addPlayerDrop(player, { id: PALM_TREE_LEAF_ID }, gameObject.x, gameObject.y);
    world.replaceTimed('gameObjects', gameObject, PALM_TREE_ID, REGROW_TICKS);

    return true;
}

module.exports = { onGameObjectCommandTwo };
