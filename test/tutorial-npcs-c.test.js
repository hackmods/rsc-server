const { test } = require('node:test');
const assert = require('node:assert');

const t = require('../src/plugins/tutorial/core');
const magic = require('../src/plugins/tutorial/npcs/magic-instructor');
const fatigue = require('../src/plugins/tutorial/npcs/fatigue-expert');
const community = require('../src/plugins/tutorial/npcs/community-instructor');
const boatman = require('../src/plugins/tutorial/npcs/boatman');

// choices: scripted menu answers; a function receives the options array
function makePlayer(stage, { choices = [], full = false } = {}) {
    const inv = [];
    const queue = Array.isArray(choices) ? [...choices] : null;

    return {
        cache: stage === null ? {} : { tutorial: stage },
        engaged: 0,
        disengaged: 0,
        messages: [],
        inventory: {
            items: inv,
            has: (id) => inv.some((i) => i.id === id),
            add(id, amount = 1) {
                const e = inv.find((i) => i.id === id);
                if (e) e.amount += amount;
                else inv.push({ id, amount });
            },
            remove(id) {
                const i = inv.findIndex((x) => x.id === id);
                if (i >= 0) inv.splice(i, 1);
            },
            isFull: () => full
        },
        engage() {
            this.engaged++;
        },
        disengage() {
            this.disengaged++;
        },
        async say() {},
        message(m) {
            this.messages.push(m);
        },
        async ask(options) {
            return queue ? (queue.length ? queue.shift() : 0) : choices(options);
        },
        world: { sleepTicks: async () => {} },
        async save() {}
    };
}

const npcOf = (id) => ({ id, async say() {} });

test('magic: 70 -> 75 -> 76 gives runes, 77, 78, 80', async () => {
    const p = makePlayer(70, { choices: [1] });
    const npc = npcOf(t.NPC.MAGIC);
    assert.ok(await magic.onTalkToNPC(p, npc));
    assert.strictEqual(p.cache.tutorial, 75);
    await magic.onTalkToNPC(p, npc);
    assert.strictEqual(p.cache.tutorial, 76);
    assert.ok(p.inventory.has(t.ITEM.AIR_RUNE));
    assert.ok(p.inventory.has(t.ITEM.MIND_RUNE));
    await magic.onTalkToNPC(p, npc);
    assert.strictEqual(p.cache.tutorial, 77);
    await magic.onTalkToNPC(p, npc);
    assert.strictEqual(p.cache.tutorial, 78);
    await magic.onTalkToNPC(p, npc);
    assert.strictEqual(p.cache.tutorial, 80);
    assert.strictEqual(p.engaged, p.disengaged);
});

test('magic: re-gives runes at 77 when out of them', async () => {
    const p = makePlayer(77);
    await magic.onTalkToNPC(p, npcOf(t.NPC.MAGIC));
    assert.ok(p.inventory.has(t.ITEM.AIR_RUNE));
    assert.strictEqual(p.cache.tutorial, 78);
});

test('magic: full inventory does not advance', async () => {
    const p = makePlayer(75, { full: true });
    await magic.onTalkToNPC(p, npcOf(t.NPC.MAGIC));
    assert.strictEqual(p.cache.tutorial, 75);
    assert.ok(p.messages.some((m) => m.startsWith('@que@')));
    assert.strictEqual(p.disengaged, 1);
});

test('fatigue: bag + 85, then 86 -> 90', async () => {
    const p = makePlayer(80);
    const npc = npcOf(t.NPC.FATIGUE);
    await fatigue.onTalkToNPC(p, npc);
    assert.strictEqual(p.cache.tutorial, 85);
    assert.ok(p.inventory.has(t.ITEM.SLEEPING_BAG));
    p.cache.tutorial = 86;
    await fatigue.onTalkToNPC(p, npc);
    assert.strictEqual(p.cache.tutorial, 90);
    assert.strictEqual(p.engaged, p.disengaged);
});

test('fatigue: full inventory does not advance', async () => {
    const p = makePlayer(80, { full: true });
    await fatigue.onTalkToNPC(p, npcOf(t.NPC.FATIGUE));
    assert.strictEqual(p.cache.tutorial, 80);
    assert.strictEqual(p.disengaged, 1);
});

test('community: loops through topics, goodbye sets 100', async () => {
    const seen = [];
    const p = makePlayer(90, {
        choices: (options) => {
            seen.push([...options]);
            // first two menus pick topic 0, then goodbye (always last)
            return seen.length < 3 ? 0 : options.length - 1;
        }
    });
    await community.onTalkToNPC(p, npcOf(t.NPC.COMMUNITY));
    assert.strictEqual(p.cache.tutorial, 100);
    assert.strictEqual(seen.length, 3);
    assert.strictEqual(p.engaged, p.disengaged);
});

test('community: refuses before stage 90', async () => {
    const p = makePlayer(85);
    await community.onTalkToNPC(p, npcOf(t.NPC.COMMUNITY));
    assert.strictEqual(p.cache.tutorial, 85);
});

test('boatman: complete only at >= 100 and on yes', async () => {
    const real = t.complete;
    const calls = [];
    t.complete = async (p) => {
        calls.push(p);
        return true;
    };

    try {
        const npc = npcOf(t.NPC.BOATMAN);

        const early = makePlayer(95, { choices: [0] });
        await boatman.onTalkToNPC(early, npc);
        assert.strictEqual(calls.length, 0);
        assert.strictEqual(early.disengaged, 1);

        const no = makePlayer(100, { choices: [1] });
        await boatman.onTalkToNPC(no, npc);
        assert.strictEqual(calls.length, 0);

        const ready = makePlayer(100, { choices: [0] });
        await boatman.onTalkToNPC(ready, npc);
        assert.deepStrictEqual(calls, [ready]);
        assert.strictEqual(ready.disengaged, 1);

        const done = makePlayer(null, { choices: [0] });
        assert.ok(await boatman.onTalkToNPC(done, npc));
        assert.strictEqual(calls.length, 1);
    } finally {
        t.complete = real;
    }
});

test('off-tutorial player untouched; wrong id returns false', async () => {
    for (const [mod, id] of [
        [magic, t.NPC.MAGIC],
        [fatigue, t.NPC.FATIGUE],
        [community, t.NPC.COMMUNITY],
        [boatman, t.NPC.BOATMAN]
    ]) {
        const p = makePlayer(null);
        assert.ok(await mod.onTalkToNPC(p, npcOf(id)));
        assert.deepStrictEqual(p.cache, {});
        assert.strictEqual(p.inventory.items.length, 0);
        assert.strictEqual(p.disengaged, 1);

        const q = makePlayer(50);
        assert.strictEqual(await mod.onTalkToNPC(q, npcOf(9999)), false);
        assert.strictEqual(q.engaged, 0);
    }
});
