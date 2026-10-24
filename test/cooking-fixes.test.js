// rsc-data cooks the uncooked cake into a Diamond Amulet (item 300); cooking.js overrides the row (COOKING_FIXES).

const test = require('node:test');
const assert = require('node:assert');

const cooking = require('../src/plugins/skills/cooking/cooking');
const items = require('@2003scape/rsc-data/config/items');
const objects = require('@2003scape/rsc-data/config/objects');

const UNCOOKED_CAKE_ID = 339;
const CAKE_ID = 330;
const BURNT_CAKE_ID = 331;
const CAKE_TIN_ID = 338;
const RANGE_ID = 11;

function makePlayer(level) {
    const added = [];
    const player = {
        added,
        questStages: {},
        skills: { cooking: { current: level, base: level } },
        world: { sleepTicks: async () => {} },
        inventory: { add: (id) => added.push(id), remove: () => {} },
        message() {},
        sendBubble() {},
        sendSound() {},
        isTired: () => false,
        addExperience() {}
    };
    return player;
}

async function cookCake(random, level = 99) {
    const original = Math.random;
    Math.random = () => random;
    try {
        const player = makePlayer(level);
        const range = { id: RANGE_ID, definition: objects[RANGE_ID] };
        const item = { id: UNCOOKED_CAKE_ID, definition: items[UNCOOKED_CAKE_ID] };
        assert.strictEqual(await cooking.onUseWithGameObject(player, range, item), true);
        return player.added;
    } finally {
        Math.random = original;
    }
}

test('the uncooked cake row cooks into a cake, not item 300', () => {
    assert.strictEqual(items[300].name, 'Diamond Amulet');
    assert.strictEqual(cooking.getDefinition(UNCOOKED_CAKE_ID).cooked, CAKE_ID);
    // the rest of the row is still rsc-data's
    assert.strictEqual(cooking.getDefinition(UNCOOKED_CAKE_ID).burnt, BURNT_CAKE_ID);
    assert.strictEqual(cooking.getDefinition(UNCOOKED_CAKE_ID).level, 40);
});

test('cooking a cake on a range gives the tin back and a cake', async () => {
    assert.deepStrictEqual((await cookCake(0)).sort(), [CAKE_ID, CAKE_TIN_ID].sort());
});

test('burning a cake (level 40) gives the tin back and a burnt cake', async () => {
    assert.deepStrictEqual((await cookCake(0.9999, 40)).sort(), [BURNT_CAKE_ID, CAKE_TIN_ID].sort());
});

test('rows without a fix are untouched', () => {
    // raw shrimp
    assert.strictEqual(cooking.getDefinition(349).cooked, 350);
});
