// Cactus water (game-objects/cactus.js, Open-RSC itemactions/Cactus.java), driven by fake player, world and cactus.

const test = require('node:test');
const assert = require('node:assert/strict');

const items = require('@2003scape/rsc-data/config/items.json');
const objects = require('@2003scape/rsc-data/config/objects.json');
const cactus = require('../src/plugins/game-objects/cactus');

function setup(bag, { taken = false } = {}) {
    const plant = { id: 35, x: 100, y: 780 };
    const log = { messages: [], experience: [], replaced: [] };
    const player = {
        bag: [...bag],
        world: {
            sleepTicks: async () => {},
            gameObjects: { getAtPoint: () => [taken ? { id: 1028 } : plant] },
            replaceTimed: (type, entity, id, ticks) => log.replaced.push({ type, id, ticks })
        },
        inventory: {
            add: (id) => player.bag.push(id),
            has: (id) => player.bag.includes(id),
            remove: (id) => player.bag.splice(player.bag.lastIndexOf(id), 1)
        },
        message: (...m) => log.messages.push(...m),
        sendBubble: () => {},
        addExperience: (skill, xp) => log.experience.push([skill, xp])
    };
    return { plant, player, log };
}

test('the data: cactus 35, dried cactus 1028, the water skins 1016 and 1082-1085', () => {
    assert.equal(objects[35].name, 'Cactus');
    assert.equal(objects[1028].name, 'Dried Cactus');
    assert.equal(items[1016].name, 'Full Water Skin');
    assert.equal(items[1082].name, 'Water Skin mostly full');
    assert.equal(items[1083].name, 'Water Skin mostly empty');
    assert.equal(items[1084].name, 'Water Skin mouthful left');
    assert.equal(items[1085].name, 'Empty Water Skin');
});

test('a knife on a cactus tops the fullest non-full skin up one step and dries the cactus for 50 ticks', async (t) => {
    t.mock.method(Math, 'random', () => 0);
    const { plant, player, log } = setup([13, 1085, 1083]);
    assert.equal(await cactus.onUseWithGameObject(player, plant, { id: 13 }), true);
    assert.deepEqual(player.bag, [13, 1085, 1082]);
    assert.deepEqual(log.experience, [['woodcutting', 100]]);
    assert.deepEqual(log.replaced, [{ type: 'gameObjects', id: 1028, ticks: 50 }]);
    assert.ok(log.messages.includes('You collect some precious water in your waterskin.'));
});

test('the chain: empty -> mouthful -> mostly empty -> mostly full -> full', async (t) => {
    t.mock.method(Math, 'random', () => 0);
    const steps = [[1085, 1084], [1084, 1083], [1083, 1082], [1082, 1016]];
    for (const [from, to] of steps) {
        const { plant, player } = setup([13, from]);
        await cactus.onUseWithGameObject(player, plant, { id: 13 });
        assert.deepEqual(player.bag, [13, to], `${from} -> ${to}`);
    }
});

test('a mistake keeps the skin and gives 4 experience', async (t) => {
    t.mock.method(Math, 'random', () => 0.99); // random(0, 100) = 99 > 75
    const { plant, player, log } = setup([13, 1085]);
    await cactus.onUseWithGameObject(player, plant, { id: 13 });
    assert.deepEqual(player.bag, [13, 1085]);
    assert.deepEqual(log.experience, [['woodcutting', 4]]);
    assert.deepEqual(log.replaced, []);
    assert.ok(log.messages.includes('You make a mistake and fail to fill your waterskin.'));
});

test('only full skins or none: nothing to fill', async () => {
    const { plant, player, log } = setup([13, 1016]);
    await cactus.onUseWithGameObject(player, plant, { id: 13 });
    assert.deepEqual(player.bag, [13, 1016]);
    assert.equal(log.messages.at(-1), 'You need to have a non-full waterskin to contain the fluid.');
});

test('a cactus someone else drained while we waited gives nothing', async (t) => {
    t.mock.method(Math, 'random', () => 0);
    const { plant, player, log } = setup([13, 1085], { taken: true });
    await cactus.onUseWithGameObject(player, plant, { id: 13 });
    assert.deepEqual(player.bag, [13, 1085]);
    assert.deepEqual(log.replaced, []);
});

test('other items and objects are left to other plugins', async () => {
    const { plant, player } = setup([13]);
    assert.equal(await cactus.onUseWithGameObject(player, plant, { id: 14 }), false);
    assert.equal(await cactus.onUseWithGameObject(player, { id: 1028 }, { id: 13 }), false);
});
