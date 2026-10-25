// Glassmaking: sand pit, furnace and glassblowing.

const test = require('node:test');
const assert = require('node:assert/strict');

const sandPit = require('../src/plugins/game-objects/sand-pit');
const glass = require('../src/plugins/skills/crafting/glass');

function fakePlayer({ bag = [], crafting = 99, choice = 0, tired = false } = {}) {
    const player = {
        bag: [...bag],
        messages: [],
        xp: [],
        world: { sleepTicks: async () => {} },
        skills: { crafting: { current: crafting } },
        inventory: {
            has: (id) => player.bag.includes(id),
            add: (id) => player.bag.push(id),
            remove: (id) => {
                const i = player.bag.indexOf(id);
                if (i === -1) return false;
                player.bag.splice(i, 1);
                return true;
            }
        },
        message: (...m) => player.messages.push(...m),
        sendBubble() {},
        isTired: () => tired,
        ask: async () => choice,
        addExperience: (skill, xp) => player.xp.push([skill, xp])
    };
    return player;
}

test('bucket on sand pit gives sand', async () => {
    const p = fakePlayer({ bag: [21] });
    assert.equal(await sandPit.onUseWithGameObject(p, { id: 302 }, { id: 21 }), true);
    assert.deepEqual(p.bag, [625]);
    assert.equal(await sandPit.onUseWithGameObject(p, { id: 302 }, { id: 625 }), false);
    assert.equal(await sandPit.onUseWithGameObject(p, { id: 118 }, { id: 21 }), false);
});

test('sand and soda ash on furnace make molten glass', async () => {
    const p = fakePlayer({ bag: [625, 624] });
    assert.equal(await glass.onUseWithGameObject(p, { id: 118 }, { id: 625 }), true);
    assert.deepEqual(p.bag.sort(), [21, 623]);
    assert.deepEqual(p.xp, [['crafting', 80]]);
});

test('missing soda ash or sand gives the Java message', async () => {
    const p = fakePlayer({ bag: [625] });
    assert.equal(await glass.onUseWithGameObject(p, { id: 118 }, { id: 625 }), true);
    assert.match(p.messages[0], /need some soda ash/);
    const q = fakePlayer({ bag: [624] });
    assert.equal(await glass.onUseWithGameObject(q, { id: 813 }, { id: 624 }), true);
    assert.match(q.messages[0], /need some sand/);
    assert.deepEqual(q.bag, [624]);
});

test('unrelated items and objects are not claimed', async () => {
    const p = fakePlayer({ bag: [625, 624] });
    assert.equal(await glass.onUseWithGameObject(p, { id: 118 }, { id: 150 }), false);
    assert.equal(await glass.onUseWithGameObject(p, { id: 5 }, { id: 625 }), false);
    assert.equal(await glass.onUseWithInventory(p, { id: 621 }, { id: 150 }), false);
    assert.equal(p.messages.length, 0);
});

test('pipe on molten glass makes the chosen product', async () => {
    for (const [choice, id, xp] of [[0, 465, 140], [1, 611, 210], [2, 620, 70]]) {
        const p = fakePlayer({ bag: [621, 623], choice });
        assert.equal(await glass.onUseWithInventory(p, { id: 621 }, { id: 623 }), true);
        assert.deepEqual(p.bag.sort(), [621, id].sort());
        assert.deepEqual(p.xp, [['crafting', xp]]);
    }
});

test('too low level gives the Java message', async () => {
    const p = fakePlayer({ bag: [621, 623], crafting: 10, choice: 1 });
    assert.equal(await glass.onUseWithInventory(p, { id: 623 }, { id: 621 }), true);
    assert.ok(p.messages.includes('You need a crafting level of 46 to make orbs'));
    assert.deepEqual(p.bag, [621, 623]);
    assert.deepEqual(p.xp, []);
});
