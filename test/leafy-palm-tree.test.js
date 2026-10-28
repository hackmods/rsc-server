// Leafy Palm Tree (1176): game-objects/leafy-palm-tree.js, driven by fake player, world and game object.

const test = require('node:test');
const assert = require('node:assert/strict');

const items = require('@2003scape/rsc-data/config/items.json');
const objects = require('@2003scape/rsc-data/config/objects.json');
const palm = require('../src/plugins/game-objects/leafy-palm-tree');

function setup({ taken = false } = {}) {
    const tree = { id: 1176, x: 363, y: 877 };
    const log = { drops: [], replaced: [], messages: [] };
    const world = {
        gameObjects: { getAtPoint: () => [taken ? { id: 33 } : tree] },
        sleepTicks: async () => {},
        addPlayerDrop: (player, item, x, y) => log.drops.push({ item, x, y }),
        replaceTimed: (type, entity, id, ticks) => log.replaced.push({ type, entity, id, ticks })
    };
    const player = { world, message: (m) => log.messages.push(m) };

    return { tree, player, log };
}

test('the data: 1176 is a Shake tree, 33 the plain palm, 1279 a palm tree leaf', () => {
    assert.equal(objects[1176].name, 'Leafy Palm Tree');
    assert.match(objects[1176].commands[1], /shake/i);
    assert.equal(objects[33].name, 'PalmTree');
    assert.match(items[1279].name, /palm tree leaf/i);
});

test('shaking drops a palm leaf at the tree and leaves a plain palm for 15 seconds', async () => {
    const { tree, player, log } = setup();

    assert.equal(await palm.onGameObjectCommandTwo(player, tree), true);
    assert.deepEqual(log.messages, ['You give the palm tree a good shake.', 'A palm leaf falls down.']);
    assert.deepEqual(log.drops, [{ item: { id: 1279 }, x: 363, y: 877 }]);
    assert.equal(log.replaced.length, 1);
    assert.equal(log.replaced[0].type, 'gameObjects');
    assert.equal(log.replaced[0].id, 33);
    assert.equal(log.replaced[0].ticks, 24);
});

test('a tree someone else shook while we waited gives nothing', async () => {
    const { tree, player, log } = setup({ taken: true });

    assert.equal(await palm.onGameObjectCommandTwo(player, tree), true);
    assert.deepEqual(log.drops, []);
    assert.deepEqual(log.replaced, []);
});

test('other objects are left to other plugins', async () => {
    for (const id of [33, 32, 183, 553, 0]) {
        const { player, log } = setup();

        assert.equal(await palm.onGameObjectCommandTwo(player, { id, x: 1, y: 1 }), false, `object ${id}`);
        assert.deepEqual(log.messages, []);
    }
});
