const { test } = require('node:test');
const assert = require('node:assert');

const t = require('../src/plugins/tutorial/core');
const fishing = require('../src/plugins/tutorial/npcs/fishing-instructor');
const mining = require('../src/plugins/tutorial/npcs/mining-instructor');
const bank = require('../src/plugins/tutorial/npcs/bank-assistant');
const quest = require('../src/plugins/tutorial/npcs/quest-advisor');
const wilderness = require('../src/plugins/tutorial/npcs/wilderness-guide');

function makePlayer(stage, choices = [], { full = false } = {}) {
    const cache = {};

    if (stage !== undefined) {
        cache.tutorial = stage;
    }

    const items = [];
    const p = {
        cache,
        items,
        said: [],
        messages: [],
        bankOpened: 0,
        engaged: 0,
        disengaged: 0,
        inventory: {
            items,
            has: (id) => items.some((i) => i.id === id),
            add: (id, amount = 1) => items.push({ id, amount }),
            remove: (id) => {
                const i = items.findIndex((x) => x.id === id);
                if (i >= 0) items.splice(i, 1);
            },
            isFull: () => full
        },
        engage() {
            p.engaged++;
        },
        disengage() {
            p.disengaged++;
        },
        async say(...lines) {
            p.said.push(...lines);
        },
        message(m) {
            p.messages.push(m);
        },
        async ask() {
            return choices.shift();
        },
        isMale: () => true,
        world: { sleepTicks: async () => {} },
        bank: {
            open() {
                p.bankOpened++;
            }
        }
    };
    return p;
}

function makeNpc(id) {
    const n = { id, lines: [] };
    n.say = async (...l) => {
        n.lines.push(...l);
    };
    return n;
}

const cases = [
    ['fishing', fishing, t.NPC.FISHING],
    ['mining', mining, t.NPC.MINING],
    ['bank', bank, t.NPC.BANK],
    ['quest', quest, t.NPC.QUEST],
    ['wilderness', wilderness, t.NPC.WILDERNESS]
];

for (const [name, mod, id] of cases) {
    test(`${name}: non-matching id returns false`, async () => {
        const p = makePlayer(0);
        assert.strictEqual(await mod.onTalkToNPC(p, makeNpc(1)), false);
        assert.strictEqual(p.engaged, 0);
        assert.strictEqual(p.cache.tutorial, 0);
    });

    test(`${name}: off-tutorial player is untouched`, async () => {
        const p = makePlayer(undefined);
        assert.strictEqual(await mod.onTalkToNPC(p, makeNpc(id)), true);
        assert.strictEqual('tutorial' in p.cache, false);
        assert.strictEqual(p.items.length, 0);
        assert.strictEqual(p.bankOpened, 0);
        assert.strictEqual(p.disengaged, 1);
    });
}

test('fishing: 40 -> 41 gives a net', async () => {
    const p = makePlayer(40);
    await fishing.onTalkToNPC(p, makeNpc(t.NPC.FISHING));
    assert.strictEqual(p.cache.tutorial, 41);
    assert.ok(p.inventory.has(t.ITEM.NET));
    assert.strictEqual(p.disengaged, 1);
});

test('fishing: full inventory at 40 does not advance', async () => {
    const p = makePlayer(40, [], { full: true });
    await fishing.onTalkToNPC(p, makeNpc(t.NPC.FISHING));
    assert.strictEqual(p.cache.tutorial, 40);
    assert.strictEqual(p.items.length, 0);
    assert.ok(p.messages.length > 0);
    assert.strictEqual(p.disengaged, 1);
});

test('fishing: 41 without a net regives one, stage stays', async () => {
    const p = makePlayer(41);
    await fishing.onTalkToNPC(p, makeNpc(t.NPC.FISHING));
    assert.strictEqual(p.cache.tutorial, 41);
    assert.ok(p.inventory.has(t.ITEM.NET));
});

test('fishing: 42 -> 45', async () => {
    const p = makePlayer(42);
    await fishing.onTalkToNPC(p, makeNpc(t.NPC.FISHING));
    assert.strictEqual(p.cache.tutorial, 45);
});

test('mining: 45 -> 49, no pickaxe yet', async () => {
    const p = makePlayer(45);
    await mining.onTalkToNPC(p, makeNpc(t.NPC.MINING));
    assert.strictEqual(p.cache.tutorial, 49);
    assert.strictEqual(p.items.length, 0);
});

test('mining: 49 stays', async () => {
    const p = makePlayer(49);
    await mining.onTalkToNPC(p, makeNpc(t.NPC.MINING));
    assert.strictEqual(p.cache.tutorial, 49);
});

test('mining: 50 -> 51 gives a pickaxe', async () => {
    const p = makePlayer(50);
    await mining.onTalkToNPC(p, makeNpc(t.NPC.MINING));
    assert.strictEqual(p.cache.tutorial, 51);
    assert.ok(p.inventory.has(t.ITEM.BRONZE_PICKAXE));
});

test('mining: 50 with full inventory does not advance', async () => {
    const p = makePlayer(50, [], { full: true });
    await mining.onTalkToNPC(p, makeNpc(t.NPC.MINING));
    assert.strictEqual(p.cache.tutorial, 50);
    assert.strictEqual(p.items.length, 0);
    assert.strictEqual(p.disengaged, 1);
});

test('mining: 51 lost pickaxe regives it', async () => {
    const p = makePlayer(51);
    await mining.onTalkToNPC(p, makeNpc(t.NPC.MINING));
    assert.strictEqual(p.cache.tutorial, 51);
    assert.ok(p.inventory.has(t.ITEM.BRONZE_PICKAXE));
});

test('mining: 52 -> 55', async () => {
    const p = makePlayer(52);
    await mining.onTalkToNPC(p, makeNpc(t.NPC.MINING));
    assert.strictEqual(p.cache.tutorial, 55);
});

test('bank: 55 -> 60 opens the bank after disengaging', async () => {
    const p = makePlayer(55);
    await bank.onTalkToNPC(p, makeNpc(t.NPC.BANK));
    assert.strictEqual(p.cache.tutorial, 60);
    assert.strictEqual(p.bankOpened, 1);
    assert.strictEqual(p.disengaged, 1);
});

test('bank: later stage opens only when asked, stage kept', async () => {
    const p = makePlayer(60, [0]);
    await bank.onTalkToNPC(p, makeNpc(t.NPC.BANK));
    assert.strictEqual(p.cache.tutorial, 60);
    assert.strictEqual(p.bankOpened, 1);

    const q = makePlayer(60, [1]);
    await bank.onTalkToNPC(q, makeNpc(t.NPC.BANK));
    assert.strictEqual(q.bankOpened, 0);
    assert.strictEqual(q.disengaged, 1);
});

test('bank: earlier stage cannot advance', async () => {
    const p = makePlayer(50, [1]);
    await bank.onTalkToNPC(p, makeNpc(t.NPC.BANK));
    assert.strictEqual(p.cache.tutorial, 50);
});

test('quest: both choices set 65', async () => {
    for (const c of [0, 1]) {
        const p = makePlayer(60, [c]);
        await quest.onTalkToNPC(p, makeNpc(t.NPC.QUEST));
        assert.strictEqual(p.cache.tutorial, 65);
        assert.strictEqual(p.disengaged, 1);
    }
});

test('quest: cancelled menu leaves stage', async () => {
    const p = makePlayer(60, [-1]);
    await quest.onTalkToNPC(p, makeNpc(t.NPC.QUEST));
    assert.strictEqual(p.cache.tutorial, 60);
});

test('quest: never lowers a later stage', async () => {
    const p = makePlayer(80, [0]);
    await quest.onTalkToNPC(p, makeNpc(t.NPC.QUEST));
    assert.strictEqual(p.cache.tutorial, 80);
});

test('wilderness: yes then options -> 70', async () => {
    const p = makePlayer(65, [0, 0]);
    await wilderness.onTalkToNPC(p, makeNpc(t.NPC.WILDERNESS));
    assert.strictEqual(p.cache.tutorial, 70);
    assert.strictEqual(p.disengaged, 1);
});

test('wilderness: avoid then options (die first) -> 70', async () => {
    const p = makePlayer(65, [1, 1]);
    await wilderness.onTalkToNPC(p, makeNpc(t.NPC.WILDERNESS));
    assert.strictEqual(p.cache.tutorial, 70);
});

test('wilderness: cancelled options leaves stage', async () => {
    const p = makePlayer(65, [0, -1]);
    await wilderness.onTalkToNPC(p, makeNpc(t.NPC.WILDERNESS));
    assert.strictEqual(p.cache.tutorial, 65);
});
