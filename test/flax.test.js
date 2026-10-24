// Flax picking: game-objects/flax.js, driven by fake player and game object objects.

const test = require('node:test');
const assert = require('node:assert/strict');

const items = require('@2003scape/rsc-data/config/items.json');
const flax = require('../src/plugins/game-objects/flax');

function fakePlayer() {
    const player = {
        bag: [],
        messages: [],
        sounds: [],
        inventory: {
            add: (id) => player.bag.push(id)
        },
        message(...m) {
            player.messages.push(...m);
        },
        sendSound(name) {
            player.sounds.push(name);
        }
    };
    return player;
}

test('flax is item 675 and has the expected name', () => {
    assert.equal(items[675].name.toLowerCase(), 'flax');
});

test('picking object 313 gives flax, says so and returns true', async () => {
    const player = fakePlayer();
    assert.equal(await flax.onGameObjectCommandTwo(player, { id: 313 }), true);
    assert.deepEqual(player.bag, [675]);
    assert.deepEqual(player.messages, ['You uproot a flax plant']);
    assert.deepEqual(player.sounds, ['potato']);
});

test('other objects are left to other plugins', async () => {
    for (const id of [72, 191, 312, 314, 0]) {
        const player = fakePlayer();
        assert.equal(await flax.onGameObjectCommandTwo(player, { id }), false, `object ${id}`);
        assert.deepEqual(player.bag, []);
        assert.deepEqual(player.messages, []);
    }
});

test('the plant stays put: picking again gives flax again', async () => {
    const player = fakePlayer();
    await flax.onGameObjectCommandTwo(player, { id: 313 });
    await flax.onGameObjectCommandTwo(player, { id: 313 });
    assert.deepEqual(player.bag, [675, 675]);
});

test('spinning flax below crafting 10 keeps the flax', async () => {
    const spinningWheel = require('../src/plugins/skills/crafting/spinning-wheel');
    const removed = [];
    const messages = [];
    const player = {
        skills: { crafting: { current: 9 } },
        inventory: { remove: (id) => removed.push(id), add() {} },
        message: (...m) => messages.push(...m)
    };

    assert.equal(await spinningWheel.onUseWithGameObject(player, { id: 121 }, { id: 675 }), true);
    assert.deepEqual(removed, []);
    assert.match(messages[0], /crafting level of 10/);
});
