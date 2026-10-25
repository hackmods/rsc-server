// Firemaking (authentic path): skills/firemaking.js, driven by fake player and world objects. Only normal logs light.
// Oak, willow, maple, yew and magic logs get "Nothing interesting happens" on the ground. Expected values are the
// Open-RSC numbers from Firemaking.java, not read back from the plugin.

const test = require('node:test');
const assert = require('node:assert/strict');

const items = require('@2003scape/rsc-data/config/items.json');
const firemaking = require('../src/plugins/skills/firemaking');

const TINDERBOX = 166;
const ASHES = 181;
const LOGS = 14;
const CUSTOM_LOGS = [632, 633, 634, 635, 636];

function fakeWorld() {
    const world = {
        removed: [],
        added: [],
        timeouts: [],
        sleeps: [],
        landscape: {
            getTileAtGameCoords: () => ({ getTileDef: () => ({ indoors: false }) })
        },
        gameObjects: {
            getAtPoint: () => []
        },
        async sleepTicks(n) {
            world.sleeps.push(n);
        },
        setTimeout(fn, ms) {
            world.timeouts.push({ fn, ms });
        },
        removeEntity(kind, entity) {
            world.removed.push({ kind, entity });
        },
        addEntity(kind, entity) {
            world.added.push({ kind, entity });
        }
    };
    return world;
}

function fakePlayer({ level = 1, max = level } = {}) {
    const player = {
        world: fakeWorld(),
        messages: [],
        xp: [],
        bubbles: [],
        skills: {
            firemaking: { current: level, base: max }
        },
        message(...m) {
            player.messages.push(...m.map((s) => s.replace('@que@', '')));
        },
        sendBubble(id) {
            player.bubbles.push(id);
        },
        addExperience(skill, experience) {
            player.xp.push({ skill, experience });
        }
    };
    return player;
}

async function withRandom(value, fn) {
    const original = Math.random;
    Math.random = () => value;
    try {
        return await fn();
    } finally {
        Math.random = original;
    }
}

// Math.random = 0 gives roll 1 (under every threshold); 0.999 gives roll 256 (over every threshold below 256).
const SUCCESS = 0;
const FAILURE = 0.999;

// Java (int) of (25 + maxStat * 1.75) * 4
const javaLogExp = (maxStat) => Math.floor((25 + maxStat * 1.75) * 4);

const groundItem = (id) => ({ id, x: 100, y: 200 });
const tinderbox = { id: TINDERBOX };

test('rsc-data names: logs, tinderbox, ashes and the custom log types', () => {
    assert.equal(items[LOGS].name, 'Logs');
    assert.equal(items[TINDERBOX].name, 'tinderbox');
    assert.equal(items[ASHES].name, 'Ashes');
    assert.equal(items[632].name, 'Oak Logs');
    assert.equal(items[633].name, 'Willow Logs');
    assert.equal(items[634].name, 'Maple Logs');
    assert.equal(items[635].name, 'Yew Logs');
    assert.equal(items[636].name, 'Magic Logs');
});

test('normal logs: a successful roll lights a fire, removes the logs and gives Java XP', async () => {
    for (const [level, max] of [[1, 1], [10, 10], [50, 50], [99, 99]]) {
        const player = fakePlayer({ level, max });
        const ground = groundItem(LOGS);

        const claimed = await withRandom(SUCCESS, () =>
            firemaking.onUseWithGroundItem(player, ground, tinderbox)
        );

        assert.equal(claimed, true);
        assert.ok(player.messages.includes('The fire catches and the logs begin to burn'));
        assert.deepEqual(player.world.sleeps, [3]);
        assert.deepEqual(player.bubbles, [TINDERBOX]);

        assert.deepEqual(player.world.removed, [{ kind: 'groundItems', entity: ground }]);
        assert.equal(player.world.added.length, 1);
        assert.equal(player.world.added[0].kind, 'gameObjects');
        const fire = player.world.added[0].entity;
        assert.equal(fire.id, 97);
        assert.equal(fire.definition.name, 'fire');
        assert.equal(fire.x, 100);
        assert.equal(fire.y, 200);

        assert.deepEqual(player.xp, [{ skill: 'firemaking', experience: javaLogExp(max) }]);
    }
});

test('normal logs: the fire lasts 90 seconds, then leaves ashes on the same tile', async () => {
    const player = fakePlayer({ level: 1 });

    await withRandom(SUCCESS, () =>
        firemaking.onUseWithGroundItem(player, groundItem(LOGS), tinderbox)
    );

    assert.equal(player.world.timeouts.length, 1);
    assert.equal(player.world.timeouts[0].ms, 90000);

    const fire = player.world.added[0].entity;
    player.world.timeouts[0].fn();

    assert.deepEqual(player.world.removed[1], { kind: 'gameObjects', entity: fire });
    assert.equal(player.world.added[1].kind, 'groundItems');
    assert.equal(player.world.added[1].entity.id, ASHES);
    assert.equal(player.world.added[1].entity.x, 100);
    assert.equal(player.world.added[1].entity.y, 200);
});

test('normal logs: a failed roll leaves the logs and gives no XP', async () => {
    const player = fakePlayer({ level: 1 });
    const ground = groundItem(LOGS);

    const claimed = await withRandom(FAILURE, () =>
        firemaking.onUseWithGroundItem(player, ground, tinderbox)
    );

    assert.equal(claimed, true);
    assert.ok(player.messages.includes('You fail to light a fire'));
    assert.deepEqual(player.world.removed, []);
    assert.deepEqual(player.world.added, []);
    assert.deepEqual(player.xp, []);
});

test('normal logs: XP uses the max level, not the boosted level', async () => {
    const player = fakePlayer({ level: 20, max: 10 });

    await withRandom(SUCCESS, () =>
        firemaking.onUseWithGroundItem(player, groundItem(LOGS), tinderbox)
    );

    assert.deepEqual(player.xp, [{ skill: 'firemaking', experience: javaLogExp(10) }]);
});

for (const id of CUSTOM_LOGS) {
    test(`${items[id].name} on the ground with a tinderbox: Nothing interesting happens, no fire`, async () => {
        const player = fakePlayer({ level: 99 });
        const ground = groundItem(id);

        const claimed = await withRandom(SUCCESS, () =>
            firemaking.onUseWithGroundItem(player, ground, tinderbox)
        );

        assert.equal(claimed, true);
        assert.deepEqual(player.messages, ['Nothing interesting happens']);
        assert.deepEqual(player.bubbles, []);
        assert.deepEqual(player.world.sleeps, []);
        assert.deepEqual(player.world.removed, []);
        assert.deepEqual(player.world.added, []);
        assert.deepEqual(player.world.timeouts, []);
        assert.deepEqual(player.xp, []);
    });
}

test('a non-log ground item is not claimed', async () => {
    const player = fakePlayer({ level: 99 });

    const claimed = await firemaking.onUseWithGroundItem(player, groundItem(ASHES), tinderbox);

    assert.equal(claimed, false);
    assert.deepEqual(player.messages, []);
    assert.deepEqual(player.world.added, []);
});

test('a log used with something other than a tinderbox is not claimed', async () => {
    const player = fakePlayer({ level: 99 });

    assert.equal(await firemaking.onUseWithGroundItem(player, groundItem(LOGS), { id: 1 }), false);
    assert.equal(await firemaking.onUseWithGroundItem(player, groundItem(632), { id: 1 }), false);
    assert.deepEqual(player.messages, []);
});

test('tinderbox on normal logs in the inventory says to put the logs down, both orders', async () => {
    const player = fakePlayer();

    assert.equal(await firemaking.onUseWithInventory(player, tinderbox, { id: LOGS }), true);
    assert.equal(await firemaking.onUseWithInventory(player, { id: LOGS }, tinderbox), true);
    assert.deepEqual(player.messages, [
        'I think you should put the logs down before you light them!',
        'I think you should put the logs down before you light them!'
    ]);
});

test('tinderbox on the other log types in the inventory is not claimed', async () => {
    for (const id of CUSTOM_LOGS) {
        const player = fakePlayer();

        assert.equal(await firemaking.onUseWithInventory(player, tinderbox, { id }), false);
        assert.equal(await firemaking.onUseWithInventory(player, { id }, tinderbox), false);
        assert.deepEqual(player.messages, []);
    }
});

test('inventory use of two non-log items is not claimed', async () => {
    const player = fakePlayer();

    assert.equal(await firemaking.onUseWithInventory(player, { id: 1 }, { id: 2 }), false);
    assert.deepEqual(player.messages, []);
});
