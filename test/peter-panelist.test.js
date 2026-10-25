// Peter Panelist: hops are 1-2 minutes, 1 in 5 is a cracker and the rest coins from 1 to 100,000, one prize per player
// per hiding place, tavern rumours never claim the talk, and every cracker holds a party hat and a prize.

const test = require('node:test');
const assert = require('node:assert/strict');

const items = require('@2003scape/rsc-data/config/items');
const wieldable = require('@2003scape/rsc-data/wieldable');
const npcLocations = require('@2003scape/rsc-data/locations/npcs');
const plugins = require('../src/plugins');
const peter = require('../src/peter-panelist');
const talk = require('../src/plugins/npcs/peter-panelist');
const rumours = require('../src/plugins/npcs/peter-rumours');
const cracker = require('../src/plugins/items/christmas-cracker');

const HATS = [576, 577, 578, 579, 580, 581];

function seeded(values) {
    let i = 0;
    return () => values[i++ % values.length];
}

function makePlayer(id = 1) {
    const bag = [];
    return {
        id,
        world: { setTickTimeout: (fn) => fn() },
        bag,
        messages: [],
        inventory: { add: (a, n = 1) => bag.push(typeof a === 'number' ? { id: a, amount: n } : a) },
        engage() {},
        disengage() {},
        message(m) {
            this.messages.push(m);
        }
    };
}

function makePeter() {
    return {
        peterPanelist: true,
        rewarded: new Set(),
        said: [],
        async say(...lines) {
            this.said.push(...lines);
        }
    };
}

test('plugins are listed and Peter has a body no one else uses', () => {
    assert.ok(Object.values(plugins).includes(talk));
    assert.ok(Object.values(plugins).includes(rumours));
    assert.ok(!npcLocations.some((n) => n.id === peter.PETER_NPC_ID));
});

test('hops are 60 to 120 seconds at 640ms a tick', () => {
    assert.ok(peter.HOP_MIN_TICKS * 0.64 >= 60 && peter.HOP_MIN_TICKS * 0.64 < 61);
    assert.ok(peter.HOP_MAX_TICKS * 0.64 <= 121 && peter.HOP_MAX_TICKS * 0.64 > 119);
    assert.equal(peter.nextHopTicks(() => 0), peter.HOP_MIN_TICKS);
    assert.equal(peter.nextHopTicks(() => 0.9999), peter.HOP_MAX_TICKS);
});

test('spots are unique and pickSpot avoids recent ones', () => {
    assert.equal(new Set(peter.SPOTS.map((s) => s.id)).size, peter.SPOTS.length);
    assert.ok(peter.SPOTS.length >= 30);
    const recent = peter.SPOTS.slice(0, 6).map((s) => s.id);
    for (let i = 0; i < 200; i += 1) {
        assert.ok(!recent.includes(peter.pickSpot(recent).id));
    }
});

test('1 in 5 is a cracker, the rest coins from 1 to 100000', () => {
    assert.deepEqual(peter.rollReward(seeded([0.19])), { kind: 'cracker' });
    assert.equal(peter.rollReward(seeded([0.2, 0, 0])).kind, 'coins');
    assert.equal(peter.rollReward(seeded([0.2, 0, 0])).amount, 1);
    assert.equal(peter.rollReward(seeded([0.2, 0.9999999, 0.9999999])).amount, 100000);

    let crackers = 0;

    for (let i = 0; i < 20000; i += 1) {
        const reward = peter.rollReward();

        if (reward.kind === 'cracker') {
            crackers += 1;
        } else {
            assert.ok(reward.amount >= 1 && reward.amount <= 100000);
        }
    }

    assert.ok(crackers > 3600 && crackers < 4400, `crackers ${crackers}`);
});

test('coin tiers cover 1..100000 with weights summing to 1000', () => {
    assert.equal(peter.COIN_TIERS.reduce((sum, tier) => sum + tier.weight, 0), 1000);
    assert.equal(peter.COIN_TIERS[0].min, 1);
    assert.equal(peter.COIN_TIERS[peter.COIN_TIERS.length - 1].max, 100000);
    peter.COIN_TIERS.slice(1).forEach((tier, i) => assert.equal(tier.min, peter.COIN_TIERS[i].max + 1));
});

test('talking pays once per hiding place and ignores other NPCs', async () => {
    const npc = makePeter();
    const player = makePlayer();

    assert.equal(await talk.onTalkToNPC(player, { id: 211 }), false);
    assert.equal(await talk.onTalkToNPC(player, npc), true);
    assert.equal(player.bag.length, 1);
    assert.ok([peter.CHRISTMAS_CRACKER_ID, peter.COINS_ID].includes(player.bag[0].id));
    assert.equal(await talk.onTalkToNPC(player, npc), true);
    assert.equal(player.bag.length, 1);

    const other = makePlayer(2);
    await talk.onTalkToNPC(other, npc);
    assert.equal(other.bag.length, 1);
});

test('rumours never claim the talk and only tellers mention him', async () => {
    const original = Math.random;
    Math.random = () => 0;

    try {
        const teller = makePlayer();
        assert.equal(await rumours.onTalkToNPC(teller, { definition: { name: 'Bartender' } }), false);
        assert.equal(teller.messages.length, 1);

        const quiet = makePlayer();
        assert.equal(await rumours.onTalkToNPC(quiet, { definition: { name: 'Guard' } }), false);
        assert.equal(quiet.messages.length, 0);
    } finally {
        Math.random = original;
    }

    assert.ok(rumours.rumour().startsWith('You overhear'));
});

test('the cracker table: six party hats and ten prizes exist, hats can be worn, every cracker holds a hat and a prize', () => {
    const table = require('@2003scape/rsc-data/rolls/cracker');

    assert.deepEqual(table['party-hat'].map((e) => e.id).sort(), HATS);
    assert.equal(table.miscellaneous.length, 10);

    for (const entry of [...table['party-hat'], ...table.miscellaneous]) {
        assert.ok(items[entry.id], `item ${entry.id}`);
    }

    for (const id of HATS) {
        assert.ok(wieldable[id], `hat ${id} wieldable`);
    }

    const seenHats = new Set();
    const seenPrizes = new Set();

    for (let i = 0; i < 5000; i += 1) {
        const [hat, prize] = cracker.rollCracker();

        assert.ok(HATS.includes(hat.id));
        assert.ok(table.miscellaneous.some((e) => e.id === prize.id));
        seenHats.add(hat.id);
        seenPrizes.add(prize.id);
    }

    assert.equal(seenHats.size, 6);
    assert.equal(seenPrizes.size, 10);
    assert.equal(cracker.rollCracker(() => 0.9999999)[0].id, 580);
});
