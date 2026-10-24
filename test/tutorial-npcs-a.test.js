const test = require('node:test');
const assert = require('node:assert');

const t = require('../src/plugins/tutorial/core');
const guide = require('../src/plugins/tutorial/npcs/guide');
const controls = require('../src/plugins/tutorial/npcs/controls-guide');
const combat = require('../src/plugins/tutorial/npcs/combat-instructor');
const cooking = require('../src/plugins/tutorial/npcs/cooking-instructor');
const finance = require('../src/plugins/tutorial/npcs/financial-advisor');

function makePlayer(cache, items = [], { choice = 0, hits = 10, size = 30 } = {}) {
    const inv = items.map((id) => ({ id, amount: 1, equipped: false }));

    const player = {
        cache,
        x: 225,
        y: 735,
        engaged: 0,
        disengaged: 0,
        messages: [],
        said: [],
        skills: { hits: { current: hits, base: 10 } },
        world: {
            sleepTicks: async () => {},
            // a rat is always nearby so the instructor never spawns one
            npcs: { entities: [{ id: t.NPC.RAT, x: 226, y: 735 }] }
        },
        inventory: {
            items: inv,
            has: (id) => inv.some((i) => i.id === id),
            add: (id, amount = 1) => inv.push({ id, amount, equipped: false }),
            remove: (id) => {
                const i = inv.findIndex((x) => x.id === id);
                if (i !== -1) inv.splice(i, 1);
            },
            isFull: () => inv.length >= size
        },
        engage() {
            this.engaged++;
        },
        disengage() {
            this.disengaged++;
        },
        async say(...lines) {
            this.said.push(...lines);
        },
        message(m) {
            this.messages.push(m);
        },
        async ask() {
            return choice;
        }
    };

    return player;
}

function makeNpc(id) {
    const npc = {
        id,
        lines: [],
        async say(...l) {
            npc.lines.push(...l);
        }
    };
    return npc;
}

const ids = (p) => p.inventory.items.map((i) => i.id);

const cases = [
    ['guide', guide, t.NPC.GUIDE],
    ['controls guide', controls, t.NPC.CONTROLS_GUIDE],
    ['combat instructor', combat, t.NPC.COMBAT],
    ['cooking instructor', cooking, t.NPC.COOKING],
    ['financial advisor', finance, t.NPC.FINANCE]
];

for (const [name, mod, npcId] of cases) {
    test(`${name}: ignores other NPCs`, async () => {
        const p = makePlayer({ tutorial: 0 });
        assert.strictEqual(await mod.onTalkToNPC(p, makeNpc(npcId + 1000)), false);
        assert.strictEqual(p.cache.tutorial, 0);
    });

    test(`${name}: off-tutorial player is untouched`, async () => {
        const p = makePlayer({ tutorialDone: 1 });
        const npc = makeNpc(npcId);
        assert.strictEqual(await mod.onTalkToNPC(p, npc), true);
        assert.deepStrictEqual(p.cache, { tutorialDone: 1 });
        assert.deepStrictEqual(ids(p), []);
        assert.ok(npc.lines.length >= 1);
        assert.strictEqual(p.disengaged, 1);
    });
}

test('guide: 0 -> 10', async () => {
    const p = makePlayer({ tutorial: 0 });
    assert.strictEqual(await guide.onTalkToNPC(p, makeNpc(t.NPC.GUIDE)), true);
    assert.strictEqual(p.cache.tutorial, 10);
    assert.strictEqual(p.engaged, 1);
    assert.strictEqual(p.disengaged, 1);
});

test('guide: never lowers the stage', async () => {
    const p = makePlayer({ tutorial: 40 });
    await guide.onTalkToNPC(p, makeNpc(t.NPC.GUIDE));
    assert.strictEqual(p.cache.tutorial, 40);
});

test('controls guide: 10 -> 15', async () => {
    const p = makePlayer({ tutorial: 10 });
    assert.strictEqual(await controls.onTalkToNPC(p, makeNpc(t.NPC.CONTROLS_GUIDE)), true);
    assert.strictEqual(p.cache.tutorial, 15);
    assert.strictEqual(p.disengaged, 1);
});

test('combat: 15 gives sword and shield, -> 16', async () => {
    const p = makePlayer({ tutorial: 15 });
    await combat.onTalkToNPC(p, makeNpc(t.NPC.COMBAT));
    assert.strictEqual(p.cache.tutorial, 16);
    assert.ok(ids(p).includes(t.ITEM.BRONZE_LONG_SWORD));
    assert.ok(ids(p).includes(t.ITEM.WOODEN_SHIELD));
    assert.strictEqual(p.disengaged, 1);
});

test('combat: 15 with a full inventory does not advance', async () => {
    const p = makePlayer({ tutorial: 15 }, Array(29).fill(1));
    await combat.onTalkToNPC(p, makeNpc(t.NPC.COMBAT));
    assert.strictEqual(p.cache.tutorial, 15);
    assert.ok(!ids(p).includes(t.ITEM.BRONZE_LONG_SWORD));
    assert.ok(p.messages.some((m) => m.startsWith('@que@')));
    assert.strictEqual(p.disengaged, 1);
});

test('combat: 16 unwielded gear is nagged, stage stays', async () => {
    const p = makePlayer({ tutorial: 16 }, [t.ITEM.WOODEN_SHIELD, t.ITEM.BRONZE_LONG_SWORD]);
    await combat.onTalkToNPC(p, makeNpc(t.NPC.COMBAT));
    assert.strictEqual(p.cache.tutorial, 16);
});

test('combat: 16 wielded gear gives the rat speech, stage stays', async () => {
    const p = makePlayer({ tutorial: 16 }, [t.ITEM.WOODEN_SHIELD, t.ITEM.BRONZE_LONG_SWORD]);
    p.inventory.items.forEach((i) => (i.equipped = true));
    const npc = makeNpc(t.NPC.COMBAT);
    await combat.onTalkToNPC(p, npc);
    assert.strictEqual(p.cache.tutorial, 16);
    assert.ok(npc.lines.includes('left click on the rat to attack it'));
});

test('combat: 20 -> 25', async () => {
    const p = makePlayer({ tutorial: 20 });
    await combat.onTalkToNPC(p, makeNpc(t.NPC.COMBAT));
    assert.strictEqual(p.cache.tutorial, 25);
});

test('cooking: 25 gives raw rat meat, stays 25', async () => {
    const p = makePlayer({ tutorial: 25 });
    await cooking.onTalkToNPC(p, makeNpc(t.NPC.COOKING));
    assert.strictEqual(p.cache.tutorial, 25);
    assert.deepStrictEqual(ids(p), [t.ITEM.RAW_RAT_MEAT]);
});

test('cooking: 25 with meat already does not duplicate', async () => {
    const p = makePlayer({ tutorial: 25 }, [t.ITEM.RAW_RAT_MEAT]);
    await cooking.onTalkToNPC(p, makeNpc(t.NPC.COOKING));
    assert.deepStrictEqual(ids(p), [t.ITEM.RAW_RAT_MEAT]);
});

test('cooking: 25 with a full inventory gives nothing', async () => {
    const p = makePlayer({ tutorial: 25 }, Array(30).fill(1));
    await cooking.onTalkToNPC(p, makeNpc(t.NPC.COOKING));
    assert.ok(!ids(p).includes(t.ITEM.RAW_RAT_MEAT));
    assert.strictEqual(p.disengaged, 1);
});

test('cooking: 30 regives meat when missing, stays 30', async () => {
    const p = makePlayer({ tutorial: 30 }, [t.ITEM.BURNT_MEAT]);
    await cooking.onTalkToNPC(p, makeNpc(t.NPC.COOKING));
    assert.strictEqual(p.cache.tutorial, 30);
    assert.ok(ids(p).includes(t.ITEM.RAW_RAT_MEAT));
});

test('cooking: 31 -> 34', async () => {
    const p = makePlayer({ tutorial: 31 }, [t.ITEM.COOKED_MEAT]);
    await cooking.onTalkToNPC(p, makeNpc(t.NPC.COOKING));
    assert.strictEqual(p.cache.tutorial, 34);
});

test('cooking: 34 -> 35', async () => {
    const p = makePlayer({ tutorial: 34 });
    await cooking.onTalkToNPC(p, makeNpc(t.NPC.COOKING));
    assert.strictEqual(p.cache.tutorial, 35);
});

test('cooking: 34 hurt with cooked meat gets the eat hint, still -> 35', async () => {
    const p = makePlayer({ tutorial: 34 }, [t.ITEM.COOKED_MEAT], { hits: 5 });
    const npc = makeNpc(t.NPC.COOKING);
    await cooking.onTalkToNPC(p, npc);
    assert.ok(npc.lines[0].startsWith('to eat the food'));
    assert.strictEqual(p.cache.tutorial, 35);
});

test('financial advisor: 35 -> 40', async () => {
    const p = makePlayer({ tutorial: 35 });
    assert.strictEqual(await finance.onTalkToNPC(p, makeNpc(t.NPC.FINANCE)), true);
    assert.strictEqual(p.cache.tutorial, 40);
    assert.strictEqual(p.disengaged, 1);
});
