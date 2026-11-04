// The dwarf multi cannon (items/multi-cannon.js, Open-RSC Cannon.java + FireCannonEvent.java) and cannon balls
// (skills/smithing/cannon-balls.js, Smelting.java): set-up rules, assembly, ownership, firing, ammo, pick-up.

const test = require('node:test');
const assert = require('node:assert/strict');

const cannon = require('../src/plugins/items/multi-cannon');
const cannonBalls = require('../src/plugins/skills/smithing/cannon-balls');
const { fakeNpc, fakePlayer, fakeWorld, gameObject } = require('./wave2b-fakes');

const BASE = 1032;
const STAND = 1033;
const BARRELS = 1034;
const FURNACE = 1035;
const BALL = 1041;
const MOULD = 1057;
const STEEL_BAR = 171;

function answer(p, ...choices) {
    p.ask = async (options) => {
        p.asked.push(options);
        return choices.shift();
    };
}

function item(id) {
    return { id, definition: {} };
}

function owned(world, id, x, y, owner) {
    const object = world.objects.find((o) => o.id === id && o.x === x && o.y === y);
    assert.ok(object, `object ${id} at ${x},${y}`);
    assert.equal(object.owner, owner);
    return object;
}

async function setUp(p) {
    await cannon.onInventoryCommand(p, item(BASE));
    const base = owned(p.world, 946, p.x, p.y, p.username);
    await cannon.onUseWithGameObject(p, base, item(STAND));
    const stand = owned(p.world, 947, p.x, p.y, p.username);
    await cannon.onUseWithGameObject(p, stand, item(BARRELS));
    const barrels = owned(p.world, 948, p.x, p.y, p.username);
    await cannon.onUseWithGameObject(p, barrels, item(FURNACE));
    return owned(p.world, 943, p.x, p.y, p.username);
}

test('hooks pass on unrelated ids', async () => {
    const p = fakePlayer();
    assert.equal(await cannon.onInventoryCommand(p, item(10)), false);
    assert.equal(await cannon.onGameObjectCommandOne(p, gameObject(1, 0, 0)), false);
    assert.equal(await cannon.onUseWithGameObject(p, gameObject(1, 0, 0), item(BALL)), false);
    assert.equal(await cannon.onUseWithGameObject(p, gameObject(943, 0, 0), item(10)), false);
    assert.equal(await cannonBalls.onUseWithGameObject(p, gameObject(118, 0, 0), item(10)), false);
    assert.equal(await cannonBalls.onUseWithGameObject(p, gameObject(1, 0, 0), item(STEEL_BAR)), false);
});

test('the base cannot be set down before the quest, near the black guard, twice, or in the KBD lair', async () => {
    const early = fakePlayer({ quests: { dwarfCannon: 6 }, items: [BASE], x: 100, y: 100 });
    await cannon.onInventoryCommand(early, item(BASE));
    assert.deepEqual(early.messages, ["you can't set up this cannon...", '...you need to complete the dwarf cannon quest']);

    const dwarves = fakePlayer({ quests: { dwarfCannon: -1 }, items: [BASE], x: 270, y: 490 });
    await cannon.onInventoryCommand(dwarves, item(BASE));
    assert.equal(dwarves.messages[0], 'it is not permitted to set up a cannon...');

    const twice = fakePlayer({ quests: { dwarfCannon: -1 }, items: [BASE], cache: { has_cannon: true }, x: 100, y: 100 });
    await cannon.onInventoryCommand(twice, item(BASE));
    assert.equal(twice.messages[0], 'you cannot construct more than one cannon at a time...');

    const kbd = fakePlayer({ quests: { dwarfCannon: -1 }, items: [BASE], x: 567, y: 3320 });
    await cannon.onInventoryCommand(kbd, item(BASE));
    assert.deepEqual(kbd.messages, ["you can't set up the cannon here"]);

    const onObject = fakePlayer({ quests: { dwarfCannon: -1 }, items: [BASE], x: 100, y: 100 });
    onObject.world.objects.push({ id: 1, x: 100, y: 100 });
    await cannon.onInventoryCommand(onObject, item(BASE));
    assert.deepEqual(onObject.messages, ["you can't set up the cannon here"]);

    for (const p of [early, dwarves, twice, kbd, onObject]) assert.equal(p.inventory.has(BASE), true);
});

test('set up in order, the cache follows each stage, wrong parts do not fit', async () => {
    const p = fakePlayer({ quests: { dwarfCannon: -1 }, items: [BASE, STAND, BARRELS, FURNACE], x: 120, y: 650 });

    await cannon.onInventoryCommand(p, item(BASE));
    const base = owned(p.world, 946, 120, 650, 'tester');
    assert.deepEqual(
        [p.cache.has_cannon, p.cache.cannon_stage, p.cache.cannon_x, p.cache.cannon_y],
        [true, 1, 120, 650]
    );

    await cannon.onUseWithGameObject(p, base, item(FURNACE));
    assert.equal(p.messages.at(-1), "these parts don't seem to fit together");

    const stranger = fakePlayer({ world: p.world, username: 'other', items: [STAND] });
    await cannon.onUseWithGameObject(stranger, base, item(STAND));
    assert.equal(stranger.messages.at(-1), 'you can only add this stand to your own base');

    await cannon.onUseWithGameObject(p, base, item(STAND));
    assert.equal(p.cache.cannon_stage, 2);
    await cannon.onUseWithGameObject(p, owned(p.world, 947, 120, 650, 'tester'), item(BARRELS));
    assert.equal(p.cache.cannon_stage, 3);
    await cannon.onUseWithGameObject(p, owned(p.world, 948, 120, 650, 'tester'), item(FURNACE));
    assert.equal(p.cache.cannon_stage, 4);
    assert.equal(p.world.objects.length, 1);
    assert.deepEqual(p.inventory.items, []);
});

test('firing: one ball a tick at the nearest valid target, never the same twice running, up to 19 shots', async () => {
    const world = fakeWorld();
    const p = fakePlayer({
        world,
        quests: { dwarfCannon: -1 },
        items: [BASE, STAND, BARRELS, FURNACE, [BALL, 50]],
        x: 120,
        y: 650,
        levels: { ranged: 99 }
    });
    const built = await setUp(p);

    const a = fakeNpc(62, { x: 118, y: 650, hits: 1000 });
    const b = fakeNpc(62, { x: 122, y: 650, hits: 1000 });
    const far = fakeNpc(62, { x: 140, y: 650, hits: 1000 });
    const peaceful = fakeNpc(1, { x: 121, y: 650, hits: 1000, hostility: '' });
    world.npcList.push(a, b, far, peaceful);

    // loading the cannon
    await cannon.onUseWithGameObject(p, built, item(BALL));
    assert.equal(p.messages.at(-1), 'the cannon loads automatically');

    assert.equal(await cannon.onGameObjectCommandOne(p, built), true); // "fire"

    let ticks = 0;
    while (world.runTimeouts() && ticks < 100) ticks += 1;

    assert.equal(p.inventory.count(BALL), 50 - 19);
    assert.equal(p.messages.filter((m) => m === 'searching for targets').length, 19);
    assert.equal(far.damaged.length + peaceful.damaged.length, 0);
    assert.ok(a.damaged.length >= 9 && b.damaged.length >= 9);
    assert.ok([...a.damaged, ...b.damaged].every((d) => d.kind === 'ranged' && d.by === p && d.amount <= 35));
    assert.ok(p.projectiles.every(([, sprite]) => sprite === 5));
    assert.equal(p.cannonFiring, null);
});

test('firing stops out of ammo, with no target, or when the player walks away', async () => {
    const world = fakeWorld();
    const p = fakePlayer({ world, quests: { dwarfCannon: -1 }, items: [BASE, STAND, BARRELS, FURNACE], x: 120, y: 650 });
    const built = await setUp(p);

    await cannon.onGameObjectCommandOne(p, built);
    assert.equal(p.messages.at(-1), "you're out of ammo");
    assert.equal(world.timeouts.length, 0);

    p.inventory.add(BALL, 5);
    await cannon.onGameObjectCommandOne(p, built);
    world.runTimeouts();
    assert.deepEqual(p.messages.slice(-2), ['searching for targets', 'there are no available creatures to target']);
    assert.equal(p.inventory.count(BALL), 5);

    world.npcList.push(fakeNpc(62, { x: 121, y: 651, hits: 1000 }), fakeNpc(62, { x: 119, y: 649, hits: 1000 }));
    await cannon.onGameObjectCommandOne(p, built);
    world.runTimeouts();
    assert.equal(p.inventory.count(BALL), 4);
    p.x += 1;
    let ticks = 0;
    while (world.runTimeouts() && ticks < 50) ticks += 1;
    assert.equal(p.inventory.count(BALL), 4);
});

test('someone else cannot fire or pick up the cannon', async () => {
    const world = fakeWorld();
    const p = fakePlayer({ world, quests: { dwarfCannon: -1 }, items: [BASE, STAND, BARRELS, FURNACE], x: 120, y: 650 });
    const built = await setUp(p);
    const thief = fakePlayer({ world, username: 'thief', items: [[BALL, 5]] });

    await cannon.onGameObjectCommandOne(thief, built);
    await cannon.onGameObjectCommandTwo(thief, built);
    assert.deepEqual(thief.messages, [
        "you can't fire this cannon...",
        "...it doesn't belong to you",
        "you can't pick that up, the owners still around"
    ]);
    assert.equal(world.objects.length, 1);
});

test('picking up gives back the parts set up so far and clears the cache', async () => {
    const p = fakePlayer({ quests: { dwarfCannon: -1 }, items: [BASE, STAND, BARRELS, FURNACE], x: 120, y: 650 });
    const built = await setUp(p);

    p.fatigue = 7500;
    await cannon.onGameObjectCommandTwo(p, built);
    assert.equal(p.messages.at(-1), 'you arms are too tired to pick it up');
    p.fatigue = 0;

    await cannon.onGameObjectCommandTwo(p, built);
    assert.deepEqual(p.inventory.items.map((it) => it.id), [BASE, STAND, BARRELS, FURNACE]);
    assert.equal(p.world.objects.length, 0);
    assert.equal(p.cache.has_cannon, undefined);
    assert.equal(p.cache.cannon_stage, 4, 'sic: the finished cannon leaves cannon_stage');

    const q = fakePlayer({ quests: { dwarfCannon: -1 }, items: [BASE, STAND], x: 120, y: 650 });
    await cannon.onInventoryCommand(q, item(BASE));
    await cannon.onUseWithGameObject(q, owned(q.world, 946, 120, 650, 'tester'), item(STAND));
    await cannon.onGameObjectCommandOne(q, owned(q.world, 947, 120, 650, 'tester'));
    assert.deepEqual(q.inventory.items.map((it) => it.id), [BASE, STAND]);
    assert.deepEqual(q.cache, {});
});

test('the instruction manual and the notes are read in a box', async () => {
    const p = fakePlayer();
    const sent = [];
    p.send = (msg) => sent.push(msg);
    answer(p, 1);
    assert.equal(await cannon.onInventoryCommand(p, item(1073)), true);
    assert.equal(await cannon.onInventoryCommand(p, item(1056)), true);
    assert.equal(sent.length, 2);
    assert.ok(sent[0].message.startsWith('Making ammo% %'));
    assert.equal(sent[1].type, 'serverMessageOnTop');
    assert.deepEqual(p.messages, ['the manual has four pages', 'the note reads....']);
});

test('cannon balls: a steel bar on a furnace with the mould', async () => {
    const furnace = gameObject(118, 0, 0);

    const noMould = fakePlayer({ quests: { dwarfCannon: -1 }, items: [STEEL_BAR], levels: { smithing: 40 } });
    assert.equal(await cannonBalls.onUseWithGameObject(noMould, furnace, item(STEEL_BAR)), true);
    assert.deepEqual(noMould.messages, ['you heat the steel bar']);
    assert.equal(noMould.inventory.has(STEEL_BAR), true);

    const low = fakePlayer({ quests: { dwarfCannon: -1 }, items: [STEEL_BAR, MOULD], levels: { smithing: 29 } });
    await cannonBalls.onUseWithGameObject(low, furnace, item(STEEL_BAR));
    assert.deepEqual(low.messages, ['You need at least level 30 smithing to make cannon balls']);

    const noQuest = fakePlayer({ quests: { dwarfCannon: 6 }, items: [STEEL_BAR, MOULD], levels: { smithing: 40 } });
    await cannonBalls.onUseWithGameObject(noQuest, furnace, item(STEEL_BAR));
    assert.deepEqual(noQuest.messages, ['You need to complete the dwarf cannon quest']);

    const smith = fakePlayer({ quests: { dwarfCannon: -1 }, items: [STEEL_BAR, MOULD], levels: { smithing: 40 } });
    await cannonBalls.onUseWithGameObject(smith, furnace, item(STEEL_BAR));
    assert.deepEqual(smith.inventory.items.map((it) => it.id), [MOULD, BALL]);
    assert.deepEqual(smith.experience, [['smithing', 100, true]]);
    assert.equal(smith.messages.at(-1), "it's very heavy");
    assert.deepEqual(smith.bubbles, [BALL]);

    const tired = fakePlayer({ quests: { dwarfCannon: -1 }, items: [STEEL_BAR, MOULD], levels: { smithing: 40 }, fatigue: 7500 });
    tired.world.drops = [];
    tired.world.addPlayerDrop = (pl, id, x, y) => tired.world.drops.push(id);
    await cannonBalls.onUseWithGameObject(tired, furnace, item(STEEL_BAR));
    assert.deepEqual(tired.world.drops, [BALL]);
    assert.equal(tired.inventory.has(STEEL_BAR), false);
    assert.deepEqual(tired.experience, []);
    assert.equal(tired.messages.at(-1), 'you are too tired to lift the ammo');
});
