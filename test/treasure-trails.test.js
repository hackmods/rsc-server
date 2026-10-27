// Treasure trails: clue scrolls (src/clues) and the plugin hooks that solve them
// (src/plugins/items/treasure-trails.js). The tests never read src/clues/steps.json:
// synthetic "test-" steps replace the loaded steps for the length of this file.

const test = require('node:test');
const assert = require('node:assert/strict');

const clues = require('../src/clues');
const plugin = require('../src/plugins/items/treasure-trails');
const itemDefs = require('@2003scape/rsc-data/config/items.json');
const npcDefs = require('@2003scape/rsc-data/config/npcs.json');

const { config, rewards, steps, STEPS } = clues;

const SPADE = 211;
const COINS = 10;
const BREAD = 138;
const SCYTHE = 1289;

const SCROLL = config.scrolls;
const CASKET = config.caskets;

// synthetic steps: one of each type for easy, one dig for medium
const TEST_STEPS = [
    { id: 'test-easy-dig', tier: 'easy', type: 'dig', x: 100, y: 100, radius: 1, text: 'Dig here', area: 'nowhere' },
    { id: 'test-easy-talk', tier: 'easy', type: 'talk', npc: 7, x: 200, y: 200, radius: 2, text: 'Talk to seven', area: 'nowhere' },
    {
        id: 'test-easy-search',
        tier: 'easy',
        type: 'search',
        object: 64,
        command: 'search',
        x: 300,
        y: 300,
        text: 'Search the crate',
        area: 'nowhere'
    },
    { id: 'test-easy-kill', tier: 'easy', type: 'kill', npc: 9, x: 400, y: 400, radius: 5, text: 'Kill nine', area: 'nowhere' },
    { id: 'test-medium-dig', tier: 'medium', type: 'dig', x: 500, y: 500, radius: 1, text: 'Dig there', area: 'nowhere' }
];

let savedSteps;
let savedMap;

test.before(() => {
    savedSteps = steps.splice(0, steps.length);
    savedMap = new Map(STEPS);
    STEPS.clear();

    for (const step of TEST_STEPS) {
        steps.push(step);
        STEPS.set(step.id, step);
    }
});

test.after(() => {
    steps.splice(0, steps.length, ...savedSteps);
    STEPS.clear();

    for (const [id, step] of savedMap) {
        STEPS.set(id, step);
    }
});

function fakePlayer({ x = 0, y = 0, items = [], bank = [], cache = {}, admin = false } = {}) {
    const player = {
        username: 'tester',
        cache,
        messages: [],
        sent: [],
        teleports: [],
        engaged: 0,
        disengaged: 0,
        x,
        y,
        skills: { mining: { base: 1, current: 1 }, attack: { base: 99, current: 99 } },
        world: { sleepTicks: async () => {}, players: { getAll: () => [] } },
        isAdministrator: () => admin,
        getFormattedUsername: () => 'Tester',
        teleport(...args) {
            player.teleports.push(args);
        },
        engage() {
            player.engaged += 1;
        },
        disengage() {
            player.disengaged += 1;
        },
        message(...m) {
            player.messages.push(...m);
        },
        send(packet) {
            player.sent.push(packet);
        },
        inventory: {
            items: [],
            has: (id) => player.inventory.items.some((i) => i.id === id),
            count: (id) => player.inventory.items.filter((i) => i.id === id).length,
            add(id, amount = 1) {
                const list = player.inventory.items;

                if (itemDefs[id].stackable) {
                    const held = list.find((i) => i.id === id);

                    if (held) {
                        held.amount += amount;
                    } else if (list.length < 30) {
                        list.push({ id, amount });
                    }

                    return;
                }

                for (let i = 0; i < amount; i += 1) {
                    if (list.length < 30) {
                        list.push({ id, amount: 1 });
                    }
                }
            },
            remove(id) {
                const list = player.inventory.items;
                const index = list.findIndex((i) => i.id === id);

                if (index === -1) {
                    return;
                }

                if (itemDefs[id].stackable && list[index].amount > 1) {
                    list[index].amount -= 1;
                } else {
                    list.splice(index, 1);
                }
            }
        },
        bank: {
            items: [],
            has: (id) => player.bank.items.some((i) => i.id === id),
            add(id, amount = 1) {
                const held = player.bank.items.find((i) => i.id === id);

                if (held) {
                    held.amount += amount;
                } else {
                    player.bank.items.push({ id, amount });
                }

                return true;
            }
        }
    };

    for (const item of items) {
        const [id, amount = 1] = Array.isArray(item) ? item : [item];
        player.inventory.add(id, amount);
    }

    for (const item of bank) {
        const [id, amount = 1] = Array.isArray(item) ? item : [item];
        player.bank.add(id, amount);
    }

    return player;
}

async function withRandom(values, fn) {
    const real = Math.random;
    let i = 0;
    Math.random = () => values[Math.min(i++, values.length - 1)];
    try {
        return await fn();
    } finally {
        Math.random = real;
    }
}

// deterministic PRNG for the many-roll tests
function seeded(seed) {
    let a = seed;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function setState(player, tier, step, remaining = 2, done = []) {
    player.cache.clues = Object.assign(player.cache.clues || {}, {
        [tier]: { step, remaining, done }
    });
}

const itemCount = (list, id) => list.items.filter((i) => i.id === id).length;

// --- 1. reading a scroll ---------------------------------------------------

test('reading the easy scroll with no state creates state and shows the step text', async () => {
    const player = fakePlayer({ items: [SCROLL.easy] });
    const [min, max] = config.stepCounts.easy;

    const result = await plugin.onInventoryCommand(player, { id: SCROLL.easy });

    assert.equal(result, true);

    const state = player.cache.clues.easy;
    assert.ok(state, 'state created');
    assert.ok(STEPS.has(state.step));
    assert.ok(state.remaining >= min && state.remaining <= max);
    assert.deepEqual(state.done, []);

    assert.equal(player.sent.length, 1);
    assert.equal(player.sent[0].type, 'serverMessage');
    assert.ok(player.sent[0].message.includes(STEPS.get(state.step).text));
});

test('reading a scroll again keeps its state and step', async () => {
    const player = fakePlayer({ items: [SCROLL.easy] });
    setState(player, 'easy', 'test-easy-talk', 2, ['test-easy-dig']);

    assert.equal(await plugin.onInventoryCommand(player, { id: SCROLL.easy }), true);
    assert.equal(player.cache.clues.easy.step, 'test-easy-talk');
    assert.ok(player.sent[0].message.includes('clue 2 of 3'));
});

// --- 2. dig ------------------------------------------------------------------

test('digging on the step tile advances the trail', async () => {
    const player = fakePlayer({ x: 100, y: 100, items: [SPADE, SCROLL.easy] });
    setState(player, 'easy', 'test-easy-dig', 2);

    assert.equal(await plugin.onInventoryCommand(player, { id: SPADE }), true);

    const state = player.cache.clues.easy;
    assert.deepEqual(state.done, ['test-easy-dig']);
    assert.equal(state.remaining, 1);
    assert.ok(STEPS.has(state.step));
    assert.equal(player.sent.length, 1, 'the next clue is shown');
});

test('digging elsewhere finds nothing and does not advance', async () => {
    const player = fakePlayer({ x: 110, y: 100, items: [SPADE, SCROLL.easy] });
    setState(player, 'easy', 'test-easy-dig', 2);

    assert.equal(await plugin.onInventoryCommand(player, { id: SPADE }), true);

    assert.deepEqual(player.cache.clues.easy, { step: 'test-easy-dig', remaining: 2, done: [] });
    assert.ok(player.messages.some((m) => m.includes('nothing of interest')));
});

test('a spade with no clue carried is not claimed', async () => {
    const player = fakePlayer({ x: 100, y: 100, items: [SPADE] });

    assert.equal(await plugin.onInventoryCommand(player, { id: SPADE }), false);
    assert.deepEqual(player.messages, []);
    assert.equal(player.cache.clues, undefined);
});

// --- 3. talk -----------------------------------------------------------------

test('talking to the step npc near the step claims and advances', async () => {
    const player = fakePlayer({ items: [SCROLL.easy] });
    setState(player, 'easy', 'test-easy-talk', 2);
    const said = [];
    const npc = { id: 7, x: 201, y: 200, say: async (m) => said.push(m) };

    assert.equal(await plugin.onTalkToNPC(player, npc), true);

    assert.equal(said.length, 1);
    assert.equal(player.engaged, 1);
    assert.equal(player.disengaged, 1);
    assert.deepEqual(player.cache.clues.easy.done, ['test-easy-talk']);
    assert.equal(player.cache.clues.easy.remaining, 1);
});

test('talking to a different npc does not claim or change state', async () => {
    const player = fakePlayer({ items: [SCROLL.easy] });
    setState(player, 'easy', 'test-easy-talk', 2);
    const npc = { id: 8, x: 201, y: 200, say: async () => {} };

    assert.equal(await plugin.onTalkToNPC(player, npc), false);
    assert.deepEqual(player.cache.clues.easy, { step: 'test-easy-talk', remaining: 2, done: [] });
    assert.equal(player.engaged, 0);
});

test('the step npc far from the step is not claimed', async () => {
    const player = fakePlayer({ items: [SCROLL.easy] });
    setState(player, 'easy', 'test-easy-talk', 2);
    const npc = { id: 7, x: 260, y: 200, say: async () => {} };

    assert.equal(await plugin.onTalkToNPC(player, npc), false);
    assert.equal(player.cache.clues.easy.remaining, 2);
});

// --- 4. search ---------------------------------------------------------------

const crate = (overrides = {}) => ({
    id: 64,
    x: 300,
    y: 300,
    definition: { name: 'Crate', commands: ['Open', 'Search'] },
    ...overrides
});

test('search only claims on the command index that equals step.command', async () => {
    const player = fakePlayer({ items: [SCROLL.easy] });
    setState(player, 'easy', 'test-easy-search', 2);

    assert.equal(await plugin.onGameObjectCommandOne(player, crate()), false);
    assert.equal(player.cache.clues.easy.remaining, 2, 'Open does not advance');

    assert.equal(await plugin.onGameObjectCommandTwo(player, crate()), true);
    assert.deepEqual(player.cache.clues.easy.done, ['test-easy-search']);
    assert.equal(player.cache.clues.easy.remaining, 1);
});

test('search matches only at the exact tile', async () => {
    const player = fakePlayer({ items: [SCROLL.easy] });
    setState(player, 'easy', 'test-easy-search', 2);

    assert.equal(await plugin.onGameObjectCommandTwo(player, crate({ x: 301 })), false);
    assert.equal(await plugin.onGameObjectCommandTwo(player, crate({ y: 299 })), false);
    assert.equal(await plugin.onGameObjectCommandTwo(player, crate({ id: 65 })), false);
    assert.equal(player.cache.clues.easy.remaining, 2);
});

// --- 5. kill -----------------------------------------------------------------

test('onNPCDeath advances on the right npc and never claims', async () => {
    const player = fakePlayer({ items: [SCROLL.easy] });
    setState(player, 'easy', 'test-easy-kill', 2);

    assert.equal(await plugin.onNPCDeath(player, { id: 9, x: 402, y: 400 }), false);
    assert.deepEqual(player.cache.clues.easy.done, ['test-easy-kill']);
    assert.equal(player.cache.clues.easy.remaining, 1);
});

test('onNPCDeath on another npc returns false and leaves state alone', async () => {
    const player = fakePlayer({ items: [SCROLL.easy] });
    setState(player, 'easy', 'test-easy-kill', 2);

    assert.equal(await plugin.onNPCDeath(player, { id: 10, x: 402, y: 400 }), false);
    assert.equal(player.cache.clues.easy.remaining, 2);
    assert.equal(await plugin.onNPCDeath(null, { id: 9, x: 0, y: 0 }), false);
});

// --- 6. final step -----------------------------------------------------------

test('the final step removes the scroll, gives the casket and clears the state', async () => {
    const player = fakePlayer({ items: [SCROLL.easy] });
    setState(player, 'easy', 'test-easy-kill', 1);

    await plugin.onNPCDeath(player, { id: 9, x: 400, y: 400 });

    assert.equal(player.inventory.has(SCROLL.easy), false);
    assert.equal(player.inventory.has(CASKET.easy), true);
    assert.equal(player.cache.clues, undefined);
    assert.equal(clues.getState(player, 'easy'), null);
    assert.ok(player.messages.some((m) => m.includes('completed the easy treasure trail')));
});

test('a final dig gives the casket too', async () => {
    const player = fakePlayer({ x: 100, y: 100, items: [SPADE, SCROLL.easy] });
    setState(player, 'easy', 'test-easy-dig', 1);

    await plugin.onInventoryCommand(player, { id: SPADE });

    assert.equal(player.inventory.has(CASKET.easy), true);
    assert.equal(player.inventory.has(SCROLL.easy), false);
    assert.equal(player.cache.clues, undefined);
});

// --- 7. drop -----------------------------------------------------------------

test('dropping the scroll abandons that tier only and returns false', async () => {
    const player = fakePlayer({ items: [SCROLL.easy, SCROLL.medium] });
    setState(player, 'easy', 'test-easy-dig', 2);
    setState(player, 'medium', 'test-medium-dig', 3);

    assert.equal(await plugin.onDropItem(player, { id: SCROLL.easy }), false);

    assert.equal(player.cache.clues.easy, undefined);
    assert.ok(player.cache.clues.medium, 'medium trail untouched');
    assert.ok(player.messages.some((m) => m.includes('abandoned')));
});

test('dropping an unrelated item does nothing', async () => {
    const player = fakePlayer({ items: [SCROLL.easy] });
    setState(player, 'easy', 'test-easy-dig', 2);

    assert.equal(await plugin.onDropItem(player, { id: BREAD }), false);
    assert.equal(await plugin.onDropItem(player, null), false);
    assert.ok(player.cache.clues.easy);
    assert.deepEqual(player.messages, []);
});

// --- 8. scroll no longer owned -----------------------------------------------

test('a scroll no longer owned makes getState null and deletes the state', () => {
    const player = fakePlayer({ items: [SCROLL.easy] });
    setState(player, 'easy', 'test-easy-dig', 2);
    player.inventory.remove(SCROLL.easy);

    assert.equal(clues.getState(player, 'easy'), null);
    assert.equal(player.cache.clues, undefined);
});

test('a banked scroll keeps its state', () => {
    const player = fakePlayer({ bank: [SCROLL.easy] });
    setState(player, 'easy', 'test-easy-dig', 2);

    assert.deepEqual(clues.getState(player, 'easy'), { step: 'test-easy-dig', remaining: 2, done: [] });
});

test('state pointing at an unknown step is dropped', () => {
    const player = fakePlayer({ items: [SCROLL.easy] });
    setState(player, 'easy', 'test-no-such-step', 2);

    assert.equal(clues.getState(player, 'easy'), null);
    assert.equal(player.cache.clues, undefined);
});

// --- 9. ground item take -----------------------------------------------------

test('taking a second scroll of a held tier is blocked (inventory or bank)', async () => {
    const carrying = fakePlayer({ items: [SCROLL.easy] });
    assert.equal(await plugin.onGroundItemTake(carrying, { id: SCROLL.easy }), true);
    assert.ok(carrying.messages.some((m) => m.includes('already have an easy clue scroll')));

    const banking = fakePlayer({ bank: [SCROLL.easy] });
    assert.equal(await plugin.onGroundItemTake(banking, { id: SCROLL.easy }), true);
});

test('taking a scroll not held, another tier, or a non-scroll is allowed', async () => {
    const player = fakePlayer({ items: [SCROLL.medium] });

    assert.equal(await plugin.onGroundItemTake(player, { id: SCROLL.easy }), false);
    assert.equal(await plugin.onGroundItemTake(player, { id: SCROLL.hard }), false);
    assert.equal(await plugin.onGroundItemTake(player, { id: BREAD }), false);
    assert.deepEqual(player.messages, []);
});

// --- 10. openCasket ----------------------------------------------------------

test('openCasket removes the casket, delivers loot and counts the trail', async () => {
    const player = fakePlayer({ items: [CASKET.easy] });

    // every roll 0: 2 common rolls of the first entry at its minimum, and the rare roll passes
    const loot = await withRandom([0], () => plugin.onInventoryCommand(player, { id: CASKET.easy }));

    assert.equal(loot, true);
    assert.equal(player.inventory.has(CASKET.easy), false);
    assert.equal(player.cache.clueCaskets.easy, 1);

    const first = rewards.easy.common[0];
    const min = Array.isArray(first.amount) ? first.amount[0] : first.amount;
    const coins = player.inventory.items.find((i) => i.id === first.id);
    assert.ok(coins, 'common loot delivered');
    assert.equal(coins.amount, min * rewards.easy.rolls[0]);
    assert.ok(player.inventory.has(rewards.easy.rare.table[0].id), 'rare delivered');
    assert.ok(player.messages.some((m) => m.includes('something rare')));
});

test('openCasket counts each opened trail per tier and ignores a casket not held', () => {
    const player = fakePlayer({ items: [CASKET.hard, CASKET.hard] });

    assert.ok(clues.openCasket(player, 'hard', seeded(1)));
    assert.ok(clues.openCasket(player, 'hard', seeded(2)));
    assert.equal(player.cache.clueCaskets.hard, 2);
    assert.equal(clues.openCasket(player, 'hard', seeded(3)), null);
    assert.equal(player.cache.clueCaskets.hard, 2);
});

test('a unique rare the player already owns (Scythe in the bank) is never given', () => {
    const owned = { given: 0, rares: 0 };
    const free = { given: 0, rares: 0 };
    const random = seeded(20260101);

    for (let i = 0; i < 4000; i += 1) {
        const withScythe = fakePlayer({ items: [CASKET.medium], bank: [SCYTHE] });
        const loot = clues.openCasket(withScythe, 'medium', random);
        owned.rares += loot.filter((l) => l.rare).length;
        owned.given += loot.filter((l) => l.id === SCYTHE).length;

        const without = fakePlayer({ items: [CASKET.medium] });
        const loot2 = clues.openCasket(without, 'medium', random);
        free.rares += loot2.filter((l) => l.rare).length;
        free.given += loot2.filter((l) => l.id === SCYTHE).length;
    }

    assert.ok(owned.rares > 50, `enough rare rolls to mean something (${owned.rares})`);
    assert.equal(owned.given, 0, 'owned unique never given');
    assert.ok(free.given > 0, 'control: the Scythe can drop when not owned');
});

test('a unique rare held in the inventory is also left out of the roll', () => {
    const random = seeded(77);

    for (let i = 0; i < 1500; i += 1) {
        const player = fakePlayer({ items: [CASKET.medium, SCYTHE] });
        const loot = clues.openCasket(player, 'medium', random);
        assert.equal(loot.filter((l) => l.id === SCYTHE).length, 0);
    }
});

// --- 11. deliver -------------------------------------------------------------

test('deliver puts the non-stackable remainder in the bank when the inventory is full', () => {
    const player = fakePlayer({ items: Array.from({ length: 28 }, () => [BREAD]) });
    assert.equal(itemDefs[BREAD].stackable, false);

    clues.deliver(player, BREAD, 5);

    assert.equal(player.inventory.items.length, 30);
    assert.equal(itemCount(player.inventory, BREAD), 30);
    assert.equal(player.bank.items.find((i) => i.id === BREAD).amount, 3);
    assert.ok(player.messages.some((m) => /3 x .+ are sent to your bank/.test(m)));
});

test('deliver sends everything to the bank from a full inventory, and stacks fit while held', () => {
    const full = fakePlayer({ items: Array.from({ length: 30 }, () => [BREAD]) });
    clues.deliver(full, COINS, 100);
    assert.equal(full.inventory.has(COINS), false);
    assert.equal(full.bank.items.find((i) => i.id === COINS).amount, 100);

    const holding = fakePlayer({ items: [[COINS, 10], ...Array.from({ length: 29 }, () => [BREAD])] });
    clues.deliver(holding, COINS, 100);
    assert.equal(holding.inventory.items.find((i) => i.id === COINS).amount, 110);
    assert.deepEqual(holding.bank.items, []);
});

// --- 12. rollKillDrop --------------------------------------------------------

function npcInBand(min, max) {
    const id = npcDefs.findIndex((n, i) => n.hostility && clues.npcCombatLevel(i) >= min && clues.npcCombatLevel(i) <= max);
    assert.ok(id >= 0, `an npc with combat ${min}-${max} exists`);
    return { id };
}

test('rollKillDrop gives the easy scroll for an easy-band npc with a winning roll', () => {
    const npc = npcInBand(1, config.kill.bands[0].maxCombat);
    const player = fakePlayer();

    assert.deepEqual(clues.rollKillDrop(player, npc, () => 0), { tier: 'easy', id: SCROLL.easy });
});

test('rollKillDrop uses Math.random by default', async () => {
    const npc = npcInBand(1, config.kill.bands[0].maxCombat);
    const player = fakePlayer();

    assert.equal((await withRandom([0], () => clues.rollKillDrop(player, npc))).id, SCROLL.easy);
    assert.equal(await withRandom([0.9999], () => clues.rollKillDrop(player, npc)), null);
});

test('rollKillDrop picks the medium and hard tiers from the combat level', () => {
    const medium = npcInBand(config.kill.bands[0].maxCombat + 1, config.kill.bands[1].maxCombat);
    const hard = npcInBand(config.kill.bands[1].maxCombat + 1, 1000);
    const player = fakePlayer();

    assert.equal(clues.rollKillDrop(player, medium, () => 0).tier, 'medium');
    assert.equal(clues.rollKillDrop(player, hard, () => 0).tier, 'hard');
});

test('rollKillDrop returns null when the player already holds the easy scroll', () => {
    const npc = npcInBand(1, config.kill.bands[0].maxCombat);

    assert.equal(clues.rollKillDrop(fakePlayer({ items: [SCROLL.easy] }), npc, () => 0), null);
    assert.equal(clues.rollKillDrop(fakePlayer({ bank: [SCROLL.easy] }), npc, () => 0), null);
});

test('rollKillDrop returns null for a non-hostile npc, an unknown npc, and on the tutorial', () => {
    const peaceful = npcDefs.findIndex((n) => n.hostility === null);
    assert.ok(peaceful >= 0);
    assert.equal(npcDefs[peaceful].hostility, null);

    assert.equal(clues.rollKillDrop(fakePlayer(), { id: peaceful }, () => 0), null);
    assert.equal(clues.rollKillDrop(fakePlayer(), { id: 999999 }, () => 0), null);

    const npc = npcInBand(1, config.kill.bands[0].maxCombat);
    assert.equal(clues.rollKillDrop(fakePlayer({ cache: { tutorial: 3 } }), npc, () => 0), null);
});

test('rollKillDrop returns null when the rate roll fails', () => {
    const npc = npcInBand(1, config.kill.bands[0].maxCombat);
    assert.equal(clues.rollKillDrop(fakePlayer(), npc, () => 0.9999), null);
});

// --- 13. rollSkillDrop -------------------------------------------------------

test('rollSkillDrop mining at level 10 adds the easy scroll', () => {
    const player = fakePlayer();
    player.skills.mining.base = 10;

    assert.deepEqual(clues.rollSkillDrop(player, 'mining', () => 0), { tier: 'easy', id: SCROLL.easy });
    assert.equal(player.inventory.has(SCROLL.easy), true);
});

test('rollSkillDrop mining at level 80 gives the hard scroll, level 50 the medium one', () => {
    const high = fakePlayer();
    high.skills.mining.base = 80;
    assert.equal(clues.rollSkillDrop(high, 'mining', () => 0).tier, 'hard');
    assert.equal(high.inventory.has(SCROLL.hard), true);

    const mid = fakePlayer();
    mid.skills.mining.base = 50;
    assert.equal(clues.rollSkillDrop(mid, 'mining', () => 0).tier, 'medium');
});

test('rollSkillDrop never drops for a skill that is not listed', () => {
    const player = fakePlayer();

    assert.equal(clues.rollSkillDrop(player, 'attack', () => 0), null);
    assert.equal(clues.rollSkillDrop(player, 'nonsense', () => 0), null);
    assert.deepEqual(player.inventory.items, []);
});

test('rollSkillDrop respects a held scroll, a failed roll and the tutorial', () => {
    const holding = fakePlayer({ items: [SCROLL.easy] });
    holding.skills.mining.base = 10;
    assert.equal(clues.rollSkillDrop(holding, 'mining', () => 0), null);

    const unlucky = fakePlayer();
    unlucky.skills.mining.base = 10;
    assert.equal(clues.rollSkillDrop(unlucky, 'mining', () => 0.9999), null);
    assert.equal(unlucky.inventory.items.length, 0);

    const tutorial = fakePlayer({ cache: { tutorial: 2 } });
    tutorial.skills.mining.base = 10;
    assert.equal(clues.rollSkillDrop(tutorial, 'mining', () => 0), null);
});

// --- 14. command -------------------------------------------------------------

test('::clue refuses non-administrators', () => {
    const player = fakePlayer({ admin: false });

    clues.command(player, ['medium']);

    assert.ok(player.messages.some((m) => m.includes('Only administrators')));
    assert.equal(player.inventory.has(SCROLL.medium), false);
    assert.equal(player.cache.clues, undefined);
});

test('::clue medium gives the medium scroll and starts the trail', () => {
    const player = fakePlayer({ admin: true });

    clues.command(player, ['medium']);

    assert.equal(player.inventory.has(SCROLL.medium), true);
    const state = player.cache.clues.medium;
    const [min, max] = config.stepCounts.medium;
    assert.equal(state.step, 'test-medium-dig');
    assert.ok(state.remaining >= min && state.remaining <= max);
    assert.equal(player.sent.length, 1);
    assert.equal(player.sent[0].type, 'serverMessage');
});

test('::clue tp teleports to the current step', () => {
    const player = fakePlayer({ admin: true });
    clues.command(player, ['medium']);

    clues.command(player, ['tp']);

    const step = STEPS.get(player.cache.clues.medium.step);
    assert.equal(player.teleports.length, 1);
    assert.deepEqual(player.teleports[0].slice(0, 2), [step.x, step.y]);
});

test('::clue skip advances the trail', () => {
    const player = fakePlayer({ admin: true });
    clues.command(player, ['medium']);
    const before = player.cache.clues.medium.remaining;

    clues.command(player, ['skip']);

    const state = player.cache.clues.medium;
    assert.equal(state.done.length, 1);
    assert.equal(state.remaining, before - 1);
});

test('::clue with no clue held prints usage', () => {
    const player = fakePlayer({ admin: true });

    clues.command(player, ['tp']);

    assert.deepEqual(player.teleports, []);
    assert.ok(player.messages.some((m) => m.startsWith('Usage')));
});

// --- 15. rollCasket ----------------------------------------------------------

test('rollCasket gives rolls[0]..rolls[1] common items and supplies.rolls supply piles for every tier', () => {
    for (const tier of clues.TIERS) {
        const [min, max] = rewards[tier].rolls;
        const [supplyMin, supplyMax] = rewards[tier].supplies.rolls;
        const commonIds = new Set(rewards[tier].common.map((e) => e.id));
        const supplyIds = new Set(rewards[tier].supplies.table.map((e) => e.id));

        // 0.3 -> the minimum, 0.999 -> the maximum; both fail the rare roll
        for (const [value, expected, expectedSupplies] of [[0.3, min, supplyMin], [0.999, max, supplyMax]]) {
            const loot = clues.rollCasket(tier, { random: () => value });
            const common = loot.filter((l) => !l.rare && !l.supply);
            const supplies = loot.filter((l) => l.supply);

            assert.equal(loot.filter((l) => l.rare).length, 0, `${tier}: no rare at ${value}`);
            assert.equal(common.length, expected, `${tier} at ${value}`);
            assert.equal(supplies.length, expectedSupplies, `${tier} supplies at ${value}`);
            assert.ok(common.every((l) => commonIds.has(l.id) && l.amount >= 1));
            assert.ok(supplies.every((l) => supplyIds.has(l.id) && l.amount >= 1));
        }

        for (let i = 0; i < 200; i += 1) {
            const common = clues.rollCasket(tier, { random: seeded(i) }).filter((l) => !l.rare && !l.supply);
            assert.ok(common.length >= min && common.length <= max, `${tier} seed ${i}`);
        }
    }
});

test('harder trails give bigger rune, herb and bone piles', () => {
    const most = (tier) =>
        Math.max(...rewards[tier].supplies.table.map((e) => (Array.isArray(e.amount) ? e.amount[1] : e.amount)));

    assert.ok(most('medium') > most('easy'));
    assert.ok(most('hard') > most('medium'));
    assert.ok(rewards.hard.supplies.rolls[0] > rewards.easy.supplies.rolls[1]);
});

test('rollCasket rolls exactly one rare when the rare roll passes, and honours excluded', () => {
    for (const tier of clues.TIERS) {
        const loot = clues.rollCasket(tier, { random: () => 0 });
        assert.equal(loot.filter((l) => l.rare).length, 1, tier);

        const everything = new Set(rewards[tier].rare.table.map((e) => e.id));
        const none = clues.rollCasket(tier, { random: () => 0, excluded: everything });
        assert.equal(none.filter((l) => l.rare).length, 0, `${tier} with the whole rare table excluded`);
    }
});
