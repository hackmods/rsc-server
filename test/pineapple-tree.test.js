// Pineapple trees (game-objects/pineapple-tree.js, Open-RSC misc/PickFromTree.java), driven by fake player and tree.

const test = require('node:test');
const assert = require('node:assert/strict');

const items = require('@2003scape/rsc-data/config/items.json');
const objects = require('@2003scape/rsc-data/config/objects.json');
const pineapple = require('../src/plugins/game-objects/pineapple-tree');

function fakePlayer(cache = {}) {
    const log = { messages: [], replaced: [] };
    const player = {
        bag: [],
        cache,
        world: { replaceTimed: (type, entity, id, ticks) => log.replaced.push({ type, id, ticks }) },
        inventory: { add: (id) => player.bag.push(id) },
        message: (...m) => log.messages.push(...m)
    };
    return { player, log };
}

test('the data: 430 is a pineapple tree with "Pick pineapple", 431 the bare one, 861 a fresh pineapple', () => {
    assert.equal(objects[430].name, 'Pineapple tree');
    assert.equal(objects[430].commands[1], 'Pick pineapple');
    assert.match(objects[431].description, /no pineapples left/);
    assert.equal(items[861].name, 'Fresh Pineapple');
});

test('four picks, then the tree is bare for 750 ticks and the count starts again', async () => {
    const { player, log } = fakePlayer();
    const tree = { id: 430, x: 462, y: 719 };
    for (let i = 0; i < 4; i += 1) {
        assert.equal(await pineapple.onGameObjectCommandTwo(player, tree), true);
    }
    assert.deepEqual(player.bag, [861, 861, 861, 861]);
    assert.deepEqual(log.messages, ['you pick a pineapple', 'you pick a pineapple', 'you pick a pineapple']);
    assert.deepEqual(log.replaced, [{ type: 'gameObjects', id: 431, ticks: 750 }]);
    assert.equal(player.cache.pineapple_pick, undefined);
});

test('a bare tree has nothing to pick', async () => {
    const { player, log } = fakePlayer();
    assert.equal(await pineapple.onGameObjectCommandTwo(player, { id: 431 }), true);
    assert.deepEqual(player.bag, []);
    assert.deepEqual(log.messages, ['there are no pineapples left on the tree']);
});

test('other objects are left to other plugins', async () => {
    const { player } = fakePlayer();
    for (const id of [183, 184, 432, 0]) {
        assert.equal(await pineapple.onGameObjectCommandTwo(player, { id }), false);
    }
});
