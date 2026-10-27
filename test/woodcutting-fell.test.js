// Woodcutting: per-tree fell chance (skills/woodcutting.js). Expected percentages are the `fell` values in Open-RSC
// ObjectWoodcutting.xml, rolled as random(1, 100) <= fell in authentic Woodcutting.java; not read back from the plugin.

const test = require('node:test');
const assert = require('node:assert/strict');

const woodcutting = require('../src/plugins/skills/woodcutting');

const AXE = 87;
const FELL = { 0: 100, 1: 100, 70: 100, 306: 10, 307: 12, 308: 15, 309: 17, 310: 20 };

// returns true when the tree was replaced by its stump after one cut
async function cut(treeID, fellRoll) {
    const gameObject = {
        id: treeID,
        x: 10,
        y: 20,
        definition: { commands: ['Chop down', 'Examine'] }
    };
    const replaced = [];
    const world = {
        gameObjects: { getAtPoint: () => [gameObject] },
        async sleepTicks() {},
        setTimeout() {},
        replaceEntity(kind, entity, id) {
            replaced.push(id);
            return { id };
        }
    };
    const player = {
        world,
        skills: { woodcutting: { current: 99, base: 99 } },
        inventory: { has: (id) => id === AXE, add() {} },
        message() {},
        sendBubble() {},
        addExperience() {},
        isTired: () => false
    };

    // first Math.random is the skill roll (0 = success), the second is the fell roll
    const original = Math.random;
    let calls = 0;
    Math.random = () => (calls++ === 0 ? 0 : fellRoll);

    try {
        await woodcutting.onGameObjectCommandOne(player, gameObject);
    } finally {
        Math.random = original;
    }

    return replaced.length > 0;
}

for (const [id, percent] of Object.entries(FELL)) {
    test(`tree ${id} falls on a roll of ${percent} but not ${percent + 1}`, async () => {
        // random(1, 100) = floor(r * 100) + 1
        assert.equal(await cut(Number(id), (percent - 1) / 100), true);

        if (percent < 100) {
            assert.equal(await cut(Number(id), percent / 100), false);
        }
    });
}

test('normal trees fall on the highest roll', async () => {
    assert.equal(await cut(0, 0.9999), true);
});

test('magic falls more often than oak', async () => {
    // roll 15: inside magic (20%), outside oak (10%)
    assert.equal(await cut(310, 0.14), true);
    assert.equal(await cut(306, 0.14), false);
});
