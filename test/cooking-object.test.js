// Ported from Open-RSC authentic/skills/cooking/ObjectCooking.java: gauntlets, perfect level, seaweed.

const test = require('node:test');
const assert = require('node:assert');

const cooking = require('../src/plugins/skills/cooking/cooking');
const items = require('@2003scape/rsc-data/config/items');
const objects = require('@2003scape/rsc-data/config/objects');

const FIRE_ID = 97;
const RANGE_ID = 11;

function makePlayer(level, equipped = []) {
    const added = [];
    const have = new Set();
    return {
        added,
        have,
        questStages: {},
        skills: { cooking: { current: level, base: level } },
        world: { sleepTicks: async () => {} },
        inventory: {
            add: (id) => added.push(id),
            remove: () => {},
            has: (id) => have.has(id),
            isEquipped: (id) => equipped.includes(id)
        },
        message() {},
        sendBubble() {},
        sendSound() {},
        isTired: () => false,
        addExperience() {}
    };
}

async function use(player, objectID, itemID, random = 0) {
    const original = Math.random;
    Math.random = () => random;
    try {
        const object = { id: objectID, definition: objects[objectID] };
        const item = { id: itemID, definition: items[itemID] };
        return await cooking.onUseWithGameObject(player, object, item);
    } finally {
        Math.random = original;
    }
}

test('gauntlets of cooking change a lobster outcome at the same roll', async () => {
    // lobster (372) at level 40, roll 0.7: fails bare handed, passes with +11 effective levels
    const bare = makePlayer(40);
    assert.strictEqual(await use(bare, RANGE_ID, 372, 0.7), true);
    assert.deepStrictEqual(bare.added, [374]);

    const gloved = makePlayer(40, [700]);
    assert.strictEqual(await use(gloved, RANGE_ID, 372, 0.7), true);
    assert.deepStrictEqual(gloved.added, [373]);

    // gauntlets do nothing for other foods
    const trout = makePlayer(20, [700]);
    await use(trout, RANGE_ID, 358, 0.999);
    assert.notStrictEqual(trout.added[0], 359);
});

test('at the perfect level food never burns, even on the worst roll', async () => {
    // raw herring (361): perfect level 41
    const perfect = makePlayer(41);
    await use(perfect, FIRE_ID, 361, 0.9999);
    assert.deepStrictEqual(perfect.added, [362]);

    const below = makePlayer(40);
    await use(below, FIRE_ID, 361, 0.9999);
    assert.deepStrictEqual(below.added, [365]);
});

test('seaweed on a fire gives soda ash and claims the action', async () => {
    const player = makePlayer(1);
    player.have.add(622);
    assert.strictEqual(await use(player, FIRE_ID, 622), true);
    assert.deepStrictEqual(player.added, [624]);
});

test('uncooked swamp paste on a fire gives swamp paste', async () => {
    const player = makePlayer(1);
    player.have.add(784);
    assert.strictEqual(await use(player, FIRE_ID, 784), true);
    assert.deepStrictEqual(player.added, [785]);
});

test('raw oomlie meat always burns', async () => {
    const player = makePlayer(99);
    player.have.add(1268);
    assert.strictEqual(await use(player, FIRE_ID, 1268), true);
    assert.deepStrictEqual(player.added, [134]);
});

test('an uncookable item returns false', async () => {
    const player = makePlayer(99);
    assert.strictEqual(await use(player, FIRE_ID, 10), false);
    assert.deepStrictEqual(player.added, []);
});
