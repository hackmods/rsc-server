// The porting foundation for Open-RSC quests (docs/PORTING.md): player.completeQuest and changeStat,
// world.spawnTimedNPC, addTimedGroundItem, replaceTimed and NPC replaceEntity, inventory.count, and the plugin hooks
// onCastOnGameObject, onCastOnGroundItem, onPlayerDeath, onWearItem, onRemoveItem and onNPCRangedAttack.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const Module = require('node:module');

// player.js and world.js load the captcha and the landscape, which need the native canvas module; none of this needs
// either (the world here has no landscape)
const realLoad = Module._load;
Module._load = function load(request, ...rest) {
    if (request === '@2003scape/rsc-captcha') return class {};
    if (request === '@2003scape/rsc-landscape') return { Landscape: class {} };
    return realLoad.call(this, request, ...rest);
};
const Player = require('../src/model/player');
const World = require('../src/model/world');
Module._load = realLoad;

const EntityList = require('../src/model/entity-list');
const GameObject = require('../src/model/game-object');
const GroundItem = require('../src/model/ground-item');
const Inventory = require('../src/model/inventory');
const NPC = require('../src/model/npc');
const magic = require('../src/packet-handlers/magic');
const inventoryHandlers = require('../src/packet-handlers/inventory');

const worldSource = fs.readFileSync(require.resolve('../src/model/world.js'), 'utf8');
const PLUGIN_TYPES = [.../const PLUGIN_TYPES = \[([\s\S]*?)\]/.exec(worldSource)[1].matchAll(/'(\w+)'/g)].map((m) => m[1]);

const CHICKEN = 3;
const GOBLIN = 62;
const CLOSED_CUPBOARD = 56;
const OPEN_CUPBOARD = 71;
const COINS = 10;
const SHORTBOW = 188;
const TELEKINETIC_GRAB = 16;
const SKILLS = ['attack', 'defense', 'strength', 'hits', 'prayer', 'cooking', 'magic', 'ranged'];

function makeWorld() {
    const world = Object.create(World.prototype);

    Object.assign(world, {
        members: true,
        ticks: 0,
        tickIndex: 0,
        tickFunctions: new Map(),
        plugins: new Map(),
        players: new EntityList(2304, 7104),
        npcs: new EntityList(2304, 7104),
        gameObjects: new EntityList(2304, 7104),
        wallObjects: new EntityList(2304, 7104),
        groundItems: new EntityList(2304, 7104),
        pathFinder: { addObject() {}, addWallObject() {} },
        server: { config: { experienceRate: 1 } }
    });

    return world;
}

// what World#tick does with tickFunctions
function runTicks(world, count) {
    for (let i = 0; i < count; i += 1) {
        for (const [id, entry] of world.tickFunctions) {
            entry.ticks -= 1;

            if (entry.ticks === 0) {
                entry.func();
                world.tickFunctions.delete(id);
            }
        }
    }
}

// a world whose plugins all answer `result` and record the call
function claimingWorld(result, calls = []) {
    const world = makeWorld();
    world.callPlugin = async (name, ...args) => (calls.push([name, ...args]), result);
    return world;
}

function makePlayer(world = makeWorld()) {
    const player = Object.create(Player.prototype);

    Object.assign(player, {
        world,
        id: 7,
        messages: [],
        sent: 0,
        questStages: {},
        questPoints: 0,
        combatLevel: 3,
        locked: false,
        walkQueue: [],
        skills: Object.fromEntries(SKILLS.map((name) => [name, { current: 10, base: 10, experience: 0 }])),
        inventory: new Inventory(null, [])
    });

    player.inventory.player = player;
    player.message = (...m) => player.messages.push(...m);
    player.sendStats = () => (player.sent += 1);
    player.sendQuestList = () => {};
    player.sendExperience = () => {};
    player.sendFatigue = () => {};
    player.sendSound = () => {};
    player.broadcastPlayerAppearance = () => {};
    player.hasInterfaceOpen = () => false;

    return player;
}

test('PLUGIN_TYPES includes the porting hooks', () => {
    for (const name of ['onCastOnGameObject', 'onCastOnGroundItem', 'onPlayerDeath', 'onWearItem', 'onRemoveItem', 'onNPCRangedAttack']) {
        assert.ok(PLUGIN_TYPES.includes(name), name);
    }
});

test('completeQuest marks the quest done, pays experience and quest points with the usual message', () => {
    const player = makePlayer();
    player.questStages.cooksAssistant = 2;
    player.skills.cooking = { current: 1, base: 1, experience: 0 };

    player.completeQuest('cooksAssistant', { questPoints: 1, experience: { cooking: 100 }, message: 'Well done' });

    assert.equal(player.questStages.cooksAssistant, -1);
    assert.equal(player.questPoints, 1);
    assert.equal(player.skills.cooking.experience, 100);
    assert.deepEqual(player.messages, ['Well done', '@gre@You haved gained 1 quest point!']);

    player.completeQuest('other', { questPoints: 3, message: ['a', 'b'] });
    assert.deepEqual(player.messages.slice(2), ['a', 'b', '@gre@You haved gained 3 quest points!']);
});

test('completeQuest without quest points says nothing about them', () => {
    const player = makePlayer();
    player.completeQuest('other');
    assert.equal(player.questStages.other, -1);
    assert.deepEqual(player.messages, []);
});

test('changeStat raises, lowers, floors at 0 and honours the cap', () => {
    const player = makePlayer();

    assert.equal(player.changeStat('attack', 5), 15);
    assert.equal(player.changeStat('attack', -20), 0);

    assert.equal(player.changeStat('strength', 10, { cap: 13 }), 13);

    // a level already above the cap is never lowered by a boost
    player.skills.defense.current = 20;
    assert.equal(player.changeStat('defense', 3, { cap: 13 }), 20);

    // the cap does not limit a drain
    assert.equal(player.changeStat('defense', -5, { cap: 13 }), 15);
    assert.equal(player.sent, 5);
});

test('inventory.count sums stacks and slots', () => {
    const player = makePlayer();
    player.inventory.items.push({ id: COINS, amount: 120 }, { id: CHICKEN, amount: 1 }, { id: CHICKEN, amount: 1 });

    assert.equal(player.inventory.count(COINS), 120);
    assert.equal(player.inventory.count(CHICKEN), 2);
    assert.equal(player.inventory.count(SHORTBOW), 0);
});

test('spawnTimedNPC adds an NPC and removes it after the ticks', () => {
    const world = makeWorld();
    const npc = world.spawnTimedNPC({ id: GOBLIN, x: 100, y: 100, ticks: 5 });

    assert.equal(npc.id, GOBLIN);
    assert.equal(npc.respawn, undefined);
    assert.deepEqual([npc.minX, npc.maxX, npc.minY, npc.maxY], [100, 100, 100, 100]);
    assert.equal(world.npcs.length, 1);

    runTicks(world, 4);
    assert.equal(world.npcs.length, 1);
    runTicks(world, 1);
    assert.equal(world.npcs.length, 0);
});

test('spawnTimedNPC keeps a wander range and survives the NPC being removed early', () => {
    const world = makeWorld();
    const npc = world.spawnTimedNPC({ id: GOBLIN, x: 100, y: 100, ticks: 2, minX: 95, maxX: 105, minY: 96, maxY: 104 });

    assert.deepEqual([npc.minX, npc.maxX, npc.minY, npc.maxY], [95, 105, 96, 104]);

    world.removeEntity('npcs', npc);
    runTicks(world, 2);
    assert.equal(world.npcs.length, 0);
});

test('addTimedGroundItem drops an item, optionally owned, that goes away', () => {
    const world = makeWorld();
    const item = world.addTimedGroundItem({ id: COINS, amount: 5, x: 50, y: 60, ticks: 3, owner: { id: 7 } });

    assert.equal(item.amount, 5);
    assert.equal(item.owner, 7);
    assert.equal(world.groundItems.getAtPoint(50, 60).length, 1);

    const other = world.addTimedGroundItem({ id: COINS, x: 51, y: 60, ticks: 1 });
    assert.equal(other.owner, undefined);

    runTicks(world, 1);
    assert.equal(world.groundItems.length, 1);
    runTicks(world, 2);
    assert.equal(world.groundItems.length, 0);
});

test('replaceTimed swaps an object and puts the original back', () => {
    const world = makeWorld();
    const original = new GameObject(world, { id: CLOSED_CUPBOARD, x: 10, y: 10, direction: 0 });
    world.addEntity('gameObjects', original);

    const open = world.replaceTimed('gameObjects', original, OPEN_CUPBOARD, 4);

    assert.equal(open.id, OPEN_CUPBOARD);
    assert.deepEqual([...world.gameObjects.getAll()].map((o) => o.id), [OPEN_CUPBOARD]);

    runTicks(world, 4);
    assert.deepEqual([...world.gameObjects.getAll()].map((o) => o.id), [CLOSED_CUPBOARD]);
});

test('replaceTimed does not bring back an object that was removed meanwhile', () => {
    const world = makeWorld();
    const original = new GameObject(world, { id: CLOSED_CUPBOARD, x: 10, y: 10, direction: 0 });
    world.addEntity('gameObjects', original);

    const open = world.replaceTimed('gameObjects', original, OPEN_CUPBOARD, 4);
    world.removeEntity('gameObjects', open);

    runTicks(world, 4);
    assert.equal(world.gameObjects.length, 0);
});

test('replaceEntity turns an NPC into another, keeping its range and spawn; the old one never respawns', () => {
    const world = makeWorld();
    const chicken = new NPC(world, { id: CHICKEN, x: 120, y: 130, minX: 115, maxX: 125, minY: 125, maxY: 135 });
    world.addEntity('npcs', chicken);
    assert.notEqual(chicken.respawn, undefined, 'chickens respawn, which is what this guards against');

    const goblin = world.replaceEntity('npcs', chicken, GOBLIN);

    assert.equal(goblin.id, GOBLIN);
    assert.deepEqual([goblin.minX, goblin.maxX, goblin.minY, goblin.maxY], [115, 125, 125, 135]);
    assert.deepEqual([goblin.spawnX, goblin.spawnY], [120, 130]);
    assert.deepEqual([...world.npcs.getAll()], [goblin]);
    assert.equal(chicken.respawn, undefined);
});

test('castObject and castGroundItem offer the cast to plugins; an unclaimed cast keeps the default message', async () => {
    for (const claimed of [true, false]) {
        const calls = [];
        const world = claimingWorld(claimed, calls);
        const player = makePlayer(world);
        const gameObject = new GameObject(world, { id: CLOSED_CUPBOARD, x: 10, y: 10, direction: 0 });
        const groundItem = new GroundItem(world, { id: COINS, x: 11, y: 11 });
        world.addEntity('gameObjects', gameObject);
        world.addEntity('groundItems', groundItem);

        await magic.castObject({ player }, { x: 10, y: 10, id: TELEKINETIC_GRAB });
        await magic.castGroundItem({ player }, { x: 11, y: 11, id: TELEKINETIC_GRAB, itemID: COINS });

        const [objectCall, itemCall] = calls;
        assert.equal(objectCall[0], 'onCastOnGameObject');
        assert.deepEqual([objectCall[1], objectCall[2], objectCall[4]], [player, gameObject, TELEKINETIC_GRAB]);
        assert.ok(Array.isArray(objectCall[3].runes), 'the spell is the spells.json entry');
        assert.equal(itemCall[0], 'onCastOnGroundItem');
        assert.deepEqual([itemCall[1], itemCall[2], itemCall[4]], [player, groundItem, TELEKINETIC_GRAB]);
        assert.deepEqual(player.messages, claimed ? [] : ['Nothing interesting happens', 'Nothing interesting happens']);
    }
});

test('onPlayerDeath: a claiming handler skips the default death, otherwise it runs', async () => {
    for (const claimed of [true, false]) {
        const world = claimingWorld(claimed);
        world.plugins.set('onPlayerDeath', [() => {}]);
        const player = makePlayer(world);
        let processed = 0;
        player.processDeath = () => (processed += 1);

        player.die();
        await new Promise((resolve) => setImmediate(resolve));

        assert.equal(processed, claimed ? 0 : 1);
    }
});

test('onPlayerDeath: with no handler registered death stays synchronous', () => {
    const player = makePlayer();
    let processed = 0;
    player.processDeath = () => (processed += 1);

    player.die();
    assert.equal(processed, 1);

    player.world.plugins.set('onPlayerDeath', []);
    player.die();
    assert.equal(processed, 2);
});

test('onWearItem and onRemoveItem can block equipping and unequipping', async () => {
    for (const claimed of [true, false]) {
        const calls = [];
        const player = makePlayer(claimingWorld(claimed, calls));
        const item = { id: 1 };
        const done = [];
        player.inventory = { items: [item], equip: (i) => done.push(['equip', i]), unequip: (i) => done.push(['unequip', i]) };

        await inventoryHandlers.inventoryWear({ player }, { index: 0 });
        await inventoryHandlers.inventoryUnequip({ player }, { index: 0 });

        assert.deepEqual(calls, [['onWearItem', player, item], ['onRemoveItem', player, item]]);
        assert.deepEqual(done, claimed ? [] : [['equip', 0], ['unequip', 0]]);
    }
});

test('onNPCRangedAttack fires before a ranged shot, and a claim stops it', async () => {
    for (const claimed of [true, false]) {
        const calls = [];
        const world = claimingWorld(claimed, calls);
        const player = makePlayer(world);
        const npc = new NPC(world, { id: CHICKEN, x: 20, y: 20, minX: 20, maxX: 20, minY: 20, maxY: 20 });
        let reachedWeaponCheck = false;
        player.getDistance = () => 5;
        player.inventory.getRangedWeapon = () => ((reachedWeaponCheck = true), null);

        const result = await player.shootRanged(npc);

        assert.deepEqual(calls, [['onNPCRangedAttack', player, npc]]);
        assert.equal(result, false);
        assert.equal(reachedWeaponCheck, !claimed, 'unclaimed carries on into the normal path');
    }
});
