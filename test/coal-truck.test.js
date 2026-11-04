// Stankers' coal trucks (game-objects/coal-truck.js, Open-RSC misc/CoalTrucks.java), driven by fake player and truck.

const test = require('node:test');
const assert = require('node:assert/strict');

const objects = require('@2003scape/rsc-data/config/objects.json');
const trucks = require('../src/plugins/game-objects/coal-truck');

const TRUCK = { id: 383, x: 519, y: 440 };

function fakePlayer(bag, cache = {}) {
    const log = { messages: [] };
    const player = {
        bag: [...bag],
        cache,
        world: { sleepTicks: async () => {} },
        inventory: {
            add: (id) => player.bag.push(id),
            has: (id) => player.bag.includes(id),
            count: (id) => player.bag.filter((x) => x === id).length,
            remove: (id) => player.bag.splice(player.bag.lastIndexOf(id), 1)
        },
        message: (...m) => log.messages.push(...m)
    };
    return { player, log };
}

test('the data: 383 is a coal truck with "get coal from"', () => {
    assert.equal(objects[383].name, 'Coal truck');
    assert.equal(objects[383].commands[0], 'get coal from');
});

test('loading puts every piece of coal in the truck, one at a time', async () => {
    const { player, log } = fakePlayer([155, 155, 155, 1]);
    assert.equal(await trucks.onUseWithGameObject(player, TRUCK, { id: 155 }), true);
    assert.deepEqual(player.bag, [1]);
    assert.equal(player.cache.coal_truck, 3);
    assert.equal(log.messages.filter((m) => m === '@que@You put a piece of coal in the truck').length, 3);
});

test('the truck holds 120', async () => {
    const { player, log } = fakePlayer([155, 155], { coal_truck: 119 });
    await trucks.onUseWithGameObject(player, TRUCK, { id: 155 });
    assert.equal(player.cache.coal_truck, 120);
    assert.deepEqual(player.bag, [155]);
    assert.equal(log.messages.at(-1), 'The coal truck is full');
});

test('getting coal takes one piece out; an empty truck says so', async () => {
    const { player, log } = fakePlayer([], { coal_truck: 1 });
    assert.equal(await trucks.onGameObjectCommandOne(player, TRUCK), true);
    assert.deepEqual(player.bag, [155]);
    assert.equal(player.cache.coal_truck, 0);
    await trucks.onGameObjectCommandOne(player, TRUCK);
    assert.deepEqual(player.bag, [155]);
    assert.deepEqual(log.messages, ['@que@You remove a piece of coal from the truck', '@que@there is no coal left in the truck']);
});

test('other items and objects are left alone', async () => {
    const { player } = fakePlayer([156]);
    assert.equal(await trucks.onUseWithGameObject(player, TRUCK, { id: 156 }), false);
    assert.equal(await trucks.onGameObjectCommandOne(player, { id: 382 }), false);
});
