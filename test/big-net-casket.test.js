// Big net fishing, caskets and oysters.

const test = require('node:test');
const assert = require('node:assert/strict');

const fishing = require('../src/plugins/skills/fishing');
const casket = require('../src/plugins/items/casket');
const oyster = require('../src/plugins/items/oyster');

function fakePlayer(level, held) {
    const player = {
        bag: [],
        held: [...held],
        messages: [],
        xp: [],
        skills: { fishing: { current: level } },
        world: { sleepTicks: async () => {} },
        isTired: () => false,
        sendSound() {},
        sendBubble() {},
        message(...m) {
            player.messages.push(...m);
        },
        addExperience(skill, xp) {
            player.xp.push([skill, xp]);
        },
        inventory: {
            has: (id) => player.held.includes(id),
            remove(id) {
                const i = player.held.indexOf(id);
                if (i > -1) player.held.splice(i, 1);
            },
            add(id, amount = 1) {
                player.bag.push([id, amount]);
            }
        }
    };
    return player;
}

const spot = (id) => ({ id, definition: { commands: ['Net', 'Harpoon'] } });

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

test('big net with the net catches from the table and gives xp', async () => {
    const player = fakePlayer(99, [548]);
    // every roll succeeds
    const result = await withRandom([0], () =>
        fishing.onGameObjectCommandOne(player, spot(261))
    );
    assert.equal(result, true);
    const ids = player.bag.map(([id]) => id).sort((a, b) => a - b);
    assert.deepEqual(ids, [16, 17, 549, 550, 552, 552, 554, 622, 793]);
    assert.equal(
        player.xp.reduce((n, [, xp]) => n + xp, 0),
        400 + 180 + 80 * 2 + 40 + 40 + 4 + 4 + 4
    );
    assert.ok(player.messages.includes('@que@You catch a bass'));
});

test('big net at level 16 only rolls the level 16 fish', async () => {
    const player = fakePlayer(16, [548]);
    await withRandom([0], () =>
        fishing.onGameObjectCommandOne(player, spot(261))
    );
    const ids = player.bag.map(([id]) => id);
    assert.ok(!ids.includes(554) && !ids.includes(550));
    assert.ok(ids.includes(552));
});

test('big net with all rolls failing says so', async () => {
    const player = fakePlayer(99, [548]);
    await withRandom([0.999], () =>
        fishing.onGameObjectCommandOne(player, spot(261))
    );
    assert.deepEqual(player.bag, []);
    assert.ok(player.messages.includes('@que@You fail to catch anything'));
});

test('without the net the Java message is sent and true returned', async () => {
    const player = fakePlayer(99, []);
    assert.equal(await fishing.onGameObjectCommandOne(player, spot(261)), true);
    assert.deepEqual(player.messages, [
        '@que@You need a big net to catch these fish'
    ]);
    assert.deepEqual(player.bag, []);
});

test('casket opens to coins from the table and is removed', async () => {
    const player = fakePlayer(1, [549]);
    // chance 0 -> coins; coin index 6 -> 640
    const result = await withRandom([0, 0.999], () =>
        casket.onInventoryCommand(player, { id: 549 })
    );
    assert.equal(result, true);
    assert.deepEqual(player.held, []);
    assert.deepEqual(player.bag, [[10, 640]]);
    assert.deepEqual(player.messages, [
        'you open the casket',
        'you find some treasure inside!'
    ]);
});

test('casket can give a gem', async () => {
    const player = fakePlayer(1, [549]);
    await withRandom([0.6], () =>
        casket.onInventoryCommand(player, { id: 549 })
    );
    assert.deepEqual(player.bag, [[160, 1]]);
});

test('casket rolls the key halves at the top of the table', async () => {
    const player = fakePlayer(1, [549]);
    await withRandom([0.9999, 0.9999], () =>
        casket.onInventoryCommand(player, { id: 549 })
    );
    assert.deepEqual(player.bag, [[527, 1]]);
});

test('oyster opens to a pearl or an empty shell', async () => {
    let player = fakePlayer(1, [793]);
    assert.equal(
        await withRandom([1 / 11 + 0.001], () =>
            oyster.onInventoryCommand(player, { id: 793 })
        ),
        true
    );
    assert.deepEqual(player.bag, [[792, 1]]);
    assert.deepEqual(player.held, []);

    player = fakePlayer(1, [793]);
    await withRandom([0.9], () =>
        oyster.onInventoryCommand(player, { id: 793 })
    );
    assert.deepEqual(player.bag, [[791, 1]]);
});

test('other inventory commands are not claimed', async () => {
    const player = fakePlayer(1, [1]);
    assert.equal(await casket.onInventoryCommand(player, { id: 1 }), false);
    assert.equal(await oyster.onInventoryCommand(player, { id: 1 }), false);
    assert.deepEqual(player.messages, []);
});
