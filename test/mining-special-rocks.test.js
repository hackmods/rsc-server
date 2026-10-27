// Mining plugin: object 770 "Rocks" gives the Rocks item (986) with a pickaxe.

const test = require('node:test');
const assert = require('node:assert/strict');

const items = require('@2003scape/rsc-data/config/items.json');
const mining = require('../src/plugins/skills/mining');

function fakePlayer(inventoryIds) {
    const player = {
        bag: [],
        messages: [],
        sleeps: 0,
        skills: { mining: { current: 1 } },
        xp: [],
        world: {
            sleepTicks: async () => {
                player.sleeps += 1;
            }
        },
        inventory: {
            has: (id) => inventoryIds.includes(id),
            add: (id) => player.bag.push(id)
        },
        message: (...m) => player.messages.push(...m),
        addExperience: (...a) => player.xp.push(a)
    };
    return player;
}

const rocksObject = {
    id: 770,
    x: 1,
    y: 1,
    definition: { commands: ['mine', 'prospect'] }
};

test('item 986 is Rocks', () => {
    assert.equal(items[986].name, 'Rocks');
});

test('mining object 770 with a pickaxe gives Rocks, no xp', async () => {
    const player = fakePlayer([156]);
    assert.equal(await mining.onGameObjectCommandOne(player, rocksObject), true);
    assert.deepEqual(player.bag, [986]);
    assert.deepEqual(player.xp, []);
    assert.equal(player.sleeps, 2);
    assert.match(player.messages.join('|'), /you mine the rock.*break of several large chunks/i);
});

test('mining object 770 without a pickaxe gives nothing', async () => {
    const player = fakePlayer([]);
    assert.equal(await mining.onGameObjectCommandOne(player, rocksObject), true);
    assert.deepEqual(player.bag, []);
    assert.match(player.messages[0], /need a pickaxe/i);
});
