const test = require('node:test');
const assert = require('node:assert/strict');

require('../src/clues');
require('../src/arsc-items');

const miningGeode = require('../src/plugins/items/mining-geode');

function fakePlayer(held = []) {
    const player = {
        held: [...held],
        bag: [],
        messages: [],
        world: { sleepTicks: async () => {} },
        message(...m) {
            player.messages.push(...m);
        },
        inventory: {
            items: held.map((id) => ({ id })),
            has: (id) => player.held.includes(id),
            remove(id) {
                const index = player.held.indexOf(id);

                if (index > -1) {
                    player.held.splice(index, 1);
                    player.inventory.items.splice(index, 1);
                }
            },
            add(id, amount = 1) {
                for (let i = 0; i < amount; i += 1) {
                    player.held.push(id);
                    player.inventory.items.push({ id });
                    player.bag.push([id, 1]);
                }
            }
        }
    };

    return player;
}

function withRandom(values, fn) {
    const real = Math.random;
    let index = 0;
    Math.random = () => values[Math.min(index++, values.length - 1)];

    try {
        return fn();
    } finally {
        Math.random = real;
    }
}

test('arsc-items registers geodes at 1299-1302', () => {
    const items = require('@2003scape/rsc-data/config/items');

    assert.equal(items.length, 1306);
    assert.equal(items[1299].name, 'Small geode');
    assert.equal(items[1302].name, 'Huge geode');
});

test('rollMiningGeode favours smaller geodes', () => {
    const counts = new Map();

    for (let i = 0; i < 1000; i += 1) {
        const id = miningGeode.rollMiningGeode(() => i / 1000);
        counts.set(id, (counts.get(id) || 0) + 1);
    }

    assert.ok((counts.get(1299) || 0) > (counts.get(1302) || 0));
});

test('small geode cracks to coins and never key halves', () => {
    const player = fakePlayer([1299]);
    const loot = miningGeode.rollGeodeLoot(1299, () => 0.9999);

    assert.notEqual(loot.id, 526);
    assert.notEqual(loot.id, 527);
});

test('standard geode can roll a key half at the top of the table', () => {
    const loot = miningGeode.rollGeodeLoot(1300, () => 0.9999);

    assert.ok(loot.id === 526 || loot.id === 527);
});

test('crackGeode removes the geode and adds loot', async () => {
    const player = fakePlayer([1299]);

    await withRandom([0, 0], async () => {
        assert.equal(await miningGeode.crackGeode(player, 1299), true);
    });

    assert.ok(!player.held.includes(1299));
    assert.ok(player.bag.length >= 1);
    assert.ok(player.messages.some((line) => /treasure inside/i.test(line)));
});

test('onInventoryCommand ignores other items', async () => {
    const player = fakePlayer([549]);
    assert.equal(await miningGeode.onInventoryCommand(player, { id: 549 }), false);
});
