// ARSC Monster Slayer guild: slayer module, Varrock master plugin, feature flag and spawn.

const test = require('node:test');
const assert = require('node:assert/strict');

const slayer = require('../src/slayer');
const plugin = require('../src/plugins/npcs/varrock/slayer-master');
const plugins = require('../src/plugins');
const arscLocations = require('../src/arsc-locations');
const npcs = require('@2003scape/rsc-data/config/npcs');
const items = require('@2003scape/rsc-data/config/items');
const config = require('../config.json');

const MASTER = plugin.SLAYER_MASTER_ID;
const MASTER_X = 118;
const MASTER_Y = 504;

function makeInventory() {
    const inv = { items: [], added: [] };

    inv.add = (id, amount = 1) => {
        inv.added.push({ id, amount });
        inv.items.push({ id, amount });
    };

    return inv;
}

function makePlayer(overrides = {}) {
    const player = {
        cache: {},
        messages: [],
        combatLevel: 50,
        inventory: makeInventory(),
        engage() {},
        disengage() {},
        message(...m) {
            player.messages.push(...m);
        },
        async say() {},
        getCombatLevel() {
            return player.combatLevel;
        },
        ...overrides
    };

    return player;
}

function makeNpc(id, x = MASTER_X, y = MASTER_Y) {
    return {
        id,
        x,
        y,
        definition: npcs[id],
        async say() {}
    };
}

function makeAskPlayer(choices, playerOverrides = {}) {
    const queue = [...choices];
    const player = makePlayer(playerOverrides);

    player.ask = async (options) => {
        return queue.length ? queue.shift() : options.length - 1;
    };

    return player;
}

test('tasks use real npc ids and sane counts', () => {
    assert.ok(slayer.tasks.length >= 12 && slayer.tasks.length <= 20);

    for (const task of slayer.tasks) {
        assert.ok(npcs[task.npcId], `npc ${task.npcId} for ${task.id}`);
        assert.ok(task.minCount > 0 && task.maxCount >= task.minCount);
        assert.ok(task.pointsPerKill > 0);
        assert.ok(task.combatMin >= 1);
    }
});

test('assignTask picks an eligible task and stores cache state', () => {
    slayer.resetEnabledForTests();
    const player = makePlayer({ combatLevel: 50 });
    const alwaysMin = () => 0;

    const result = slayer.assignTask(player, 50, alwaysMin);

    assert.equal(result.ok, true);
    assert.ok(result.task);
    assert.equal(result.remaining, result.task.minCount);

    const state = player.cache.slayer;

    assert.equal(state.taskId, result.task.id);
    assert.equal(state.npcId, result.task.npcId);
    assert.equal(state.remaining, result.remaining);
    assert.ok(state.assignedAt);
});

test('creditKill decrements remaining, awards points and completes with bonus', () => {
    slayer.resetEnabledForTests();
    const player = makePlayer();
    const task = slayer.tasks.find((t) => t.id === 'chickens');

    player.cache.slayer = {
        taskId: task.id,
        npcId: task.npcId,
        remaining: 2,
        points: 0,
        assignedAt: Date.now()
    };

    const first = slayer.creditKill(player, task.npcId);

    assert.equal(first.credited, true);
    assert.equal(first.remaining, 1);
    assert.equal(player.cache.slayer.remaining, 1);
    assert.equal(player.cache.slayer.points, task.pointsPerKill);

    const last = slayer.creditKill(player, task.npcId);

    assert.equal(last.completed, true);
    assert.equal(last.bonus, task.pointsPerKill * 5);
    assert.equal(player.cache.slayer.taskId, null);
    assert.equal(
        player.cache.slayer.points,
        task.pointsPerKill * 2 + last.bonus
    );
});

test('creditKill ignores wrong npc id', () => {
    slayer.resetEnabledForTests();
    const player = makePlayer();

    player.cache.slayer = {
        taskId: 'chickens',
        npcId: 3,
        remaining: 5,
        points: 0,
        assignedAt: Date.now()
    };

    assert.equal(slayer.creditKill(player, 4).credited, false);
    assert.equal(player.cache.slayer.remaining, 5);
});

test('spendPoints deducts points and adds inventory items', () => {
    slayer.resetEnabledForTests();
    const player = makePlayer();

    player.cache.slayer = { points: 20, taskId: null, npcId: null, remaining: 0 };

    const meat = slayer.spendPoints(player, 1);

    assert.equal(meat.ok, true);
    assert.equal(meat.entry.itemId, 132);
    assert.equal(player.cache.slayer.points, 5);
    assert.deepEqual(player.inventory.added, [{ id: 132, amount: 1 }]);

    const broke = slayer.spendPoints(player, 3);

    assert.equal(broke.ok, false);
    assert.equal(broke.reason, 'not_enough_points');
});

test('feature flag off makes talk and kills no-op', async () => {
    slayer.setEnabledForTests(false);

    const player = makeAskPlayer([0]);
    assert.equal(await plugin.onTalkToNPC(player, makeNpc(MASTER)), false);

    player.cache.slayer = {
        taskId: 'chickens',
        npcId: 3,
        remaining: 1,
        points: 0,
        assignedAt: Date.now()
    };

    assert.equal(await plugin.onNPCDeath(player, { id: 3 }), false);
    assert.equal(player.cache.slayer.remaining, 1);

    slayer.resetEnabledForTests();
});

test('wrong npc id or location is not claimed', async () => {
    slayer.resetEnabledForTests();

    assert.equal(await plugin.onTalkToNPC(makeAskPlayer([0]), makeNpc(65)), false);
    assert.equal(
        await plugin.onTalkToNPC(makeAskPlayer([0]), makeNpc(MASTER, 200, 200)),
        false
    );
});

test('onNPCDeath always returns false', async () => {
    slayer.resetEnabledForTests();
    const player = makePlayer();

    player.cache.slayer = {
        taskId: 'chickens',
        npcId: 3,
        remaining: 1,
        points: 0,
        assignedAt: Date.now()
    };

    assert.equal(await plugin.onNPCDeath(player, { id: 3 }), false);
});

test('plugin is registered and spawn exists', () => {
    assert.ok(Object.values(plugins).includes(plugin));
    assert.equal(config.slayerGuild.enabled, true);

    const spawn = arscLocations.npcs.find((n) => n.id === MASTER);

    assert.ok(spawn);
    assert.equal(spawn.x, MASTER_X);
    assert.equal(spawn.y, MASTER_Y);
});

test('shop rewards are existing items', () => {
    for (const entry of slayer.SHOP) {
        assert.ok(items[entry.itemId], `item ${entry.itemId}`);
        assert.ok(entry.points > 0 && entry.amount > 0);
    }
});
