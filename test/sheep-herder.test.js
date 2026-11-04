// Sheep Herder (quests/members/sheep-herder.js and npcs/ardougne/doctor-orbon.js, ports of Open-RSC SheepHerder.java and
// DoctorOrbon.java): every stage driven with fake players over a real World/NPC model, herding included.

const test = require('node:test');
const assert = require('node:assert/strict');

const { makePlayer, makeWorld, fakeNpc, addNpc, addObject, wear, runTicks, settle } = require('./quest-port-fakes');
const herder = require('../src/plugins/quests/members/sheep-herder');
const orbon = require('../src/plugins/npcs/ardougne/doctor-orbon');
const npcRespawn = require('@2003scape/rsc-data/npc-respawn');
const { World } = require('./quest-port-fakes');

const HALGRIVE = 436;
const BRUMTY = 434;
const DOCTOR_ORBON = 435;
const SHEEP = [430, 431, 432, 433];
const REMAINS = { 430: 758, 431: 762, 432: 763, 433: 764 };
const COINS = 10;
const CATTLE_PROD = 757;
const FEED = 759;
const JACKET = 760;
const TROUSERS = 761;

function suited(options = {}) {
    const player = makePlayer({ items: [JACKET, TROUSERS, CATTLE_PROD, FEED], stages: { sheepHerder: 2 }, ...options });
    wear(player, JACKET, 'body');
    wear(player, TROUSERS, 'legs');
    return player;
}

// a world whose pauses run on ticks (the hop, then the walk back two ticks later)
function tickWorld() {
    const world = makeWorld();
    world.sleepTicks = World.prototype.sleepTicks;
    return world;
}

// one prod, with the tick of the sheep's yell
async function nudge(world, player, id) {
    const done = herder.onUseWithNPC(player, sheepOf(world, id), { id: CATTLE_PROD });
    await settle();
    runTicks(world, 1);
    await settle();
    return done;
}

// ticks with the NPCs free to take a step each (NPC#tick clears isWalking)
async function walkTicks(world, count) {
    for (let i = 0; i < count; i += 1) {
        for (const npc of world.npcs.getAll()) npc.isWalking = false;
        runTicks(world, 1);
        await settle(3);
    }
}

// the live sheep of a type (the plugin respawns a moved sheep as a new entity)
function sheepOf(world, id) {
    return [...world.npcs.getAll()].find((npc) => npc.id === id);
}

test('rsc-data fix: the plague sheep respawn (Open-RSC respawnTime 43)', () => {
    for (const id of SHEEP) {
        assert.equal(npcRespawn[id], 43000);
    }
});

test('Halgrive starts the quest and hands over the poison (stage 0 -> 1), more on request', async () => {
    const player = makePlayer({ answers: [0, 0] });
    assert.equal(await herder.onTalkToNPC(player, fakeNpc(HALGRIVE)), true);
    assert.equal(player.questStages.sheepHerder, 1);
    assert.equal(player.inventory.count(FEED), 1);

    const refuse = makePlayer({ answers: [1] });
    await herder.onTalkToNPC(refuse, fakeNpc(HALGRIVE));
    assert.equal(refuse.questStages.sheepHerder, undefined);

    const lost = makePlayer({ stages: { sheepHerder: 1 } });
    await herder.onTalkToNPC(lost, fakeNpc(HALGRIVE));
    assert.equal(lost.inventory.count(FEED), 1);
});

test('Doctor Orbon sells the protective suit for 100 coins (stage 1 -> 2), and again at stage 2', async () => {
    const poor = makePlayer({ stages: { sheepHerder: 1 }, answers: [1] });
    await orbon.onTalkToNPC(poor, fakeNpc(DOCTOR_ORBON));
    assert.equal(poor.questStages.sheepHerder, 1);
    assert.ok(poor.said.includes("oops, I don't have enough money"));

    const player = makePlayer({ stages: { sheepHerder: 1 }, answers: [1], items: [[COINS, 100]] });
    await orbon.onTalkToNPC(player, fakeNpc(DOCTOR_ORBON));
    assert.equal(player.questStages.sheepHerder, 2);
    assert.equal(player.inventory.count(JACKET), 1);
    assert.equal(player.inventory.count(TROUSERS), 1);
    assert.equal(player.inventory.count(COINS), 0);

    const again = makePlayer({ stages: { sheepHerder: 2 }, answers: [1], items: [[COINS, 100]] });
    await orbon.onTalkToNPC(again, fakeNpc(DOCTOR_ORBON));
    assert.equal(again.inventory.count(JACKET), 1);

    const before = makePlayer({ answers: [1] });
    await orbon.onTalkToNPC(before, fakeNpc(DOCTOR_ORBON));
    assert.ok(before.said.includes("ok I'll be careful"));
    assert.equal(await orbon.onTalkToNPC(before, fakeNpc(1)), false);
});

test('Farmer Brumty points to the cattle prod at stage 2', async () => {
    const player = makePlayer({ stages: { sheepHerder: 2 } });
    const brumty = fakeNpc(BRUMTY);
    await herder.onTalkToNPC(player, brumty);
    assert.ok(brumty.lines.includes('there should be a cattle prod in the barn'));
});

test('the pen gate needs the suit to go in; anyone leaves from x 589', async () => {
    const world = makeWorld();
    const gate = addObject(world, { id: 443, x: 588, y: 540, direction: 4 });

    const plain = makePlayer({ world, x: 587, y: 540 });
    assert.equal(await herder.onGameObjectCommandOne(plain, gate), true);
    assert.equal(plain.teleported, null);
    assert.ok(plain.messages.includes('@que@you cannot enter without protective clothing'));

    const player = suited({ world, x: 587, y: 540 });
    await herder.onGameObjectCommandOne(player, gate);
    assert.deepEqual(player.teleported.slice(0, 2), [589, 541]);
    // the gate stands open for a moment
    assert.equal([...world.gameObjects.getAll()][0].id, 442);
    runTicks(world, 5);
    assert.equal([...world.gameObjects.getAll()][0].id, 443);

    const leaving = makePlayer({ world, x: 589, y: 541 });
    await herder.onGameObjectCommandOne(leaving, [...world.gameObjects.getAll()][0]);
    assert.deepEqual(leaving.teleported.slice(0, 2), [588, 540]);
});

test('without the suit the sheep may not be touched', async () => {
    const world = makeWorld();
    const sheep = addNpc(world, { id: 430, x: 578, y: 564 });
    const player = makePlayer({ world, items: [CATTLE_PROD], stages: { sheepHerder: 2 }, x: 578, y: 565 });
    assert.equal(await herder.onUseWithNPC(player, sheep, { id: CATTLE_PROD }), true);
    assert.ok(player.messages.includes('@que@this sheep has the plague'));
    assert.equal(sheep.x, 578);
});

test('the 1st sheep: three nudges north, then it jumps into the pen', async () => {
    const world = tickWorld();
    addNpc(world, { id: 430, x: 578, y: 564 });
    const player = suited({ world, x: 578, y: 565 });

    await nudge(world, player, 430);
    assert.deepEqual([sheepOf(world, 430).x, sheepOf(world, 430).y], [580, 558]);
    assert.ok(player.messages.includes('the sheep runs to the north'));
    assert.ok(player.messages.includes('@yel@:Baaaaaaaaa!!!'));

    player.y = 559;
    await nudge(world, player, 430);
    assert.deepEqual([sheepOf(world, 430).x, sheepOf(world, 430).y], [585, 553]);

    player.y = 550;
    await nudge(world, player, 430);
    assert.deepEqual([sheepOf(world, 430).x, sheepOf(world, 430).y], [594, 538]);

    player.y = 539;
    await nudge(world, player, 430);
    const penned = sheepOf(world, 430);
    assert.deepEqual([penned.x, penned.y], [590, 546]);
    assert.ok(player.messages.includes('the sheep jumps the gate into the enclosure'));
    // one sheep in the world all along, still spawning at home
    assert.equal(world.npcs.length, 1);
    assert.deepEqual([penned.spawnX, penned.spawnY], [578, 564]);

    player.messages.length = 0;
    await herder.onUseWithNPC(player, penned, { id: CATTLE_PROD });
    assert.deepEqual(player.messages, ['The sheep is already in the pen']);
});

test('a nudged sheep walks back home unless nudged again', async () => {
    const world = tickWorld();
    addNpc(world, { id: 430, x: 578, y: 564 });
    const player = suited({ world, x: 578, y: 565 });

    await nudge(world, player, 430);
    const hopped = sheepOf(world, 430);
    hopped.walkToPoint = async (x, y) => {
        hopped.walkedTo = [x, y];
    };
    runTicks(world, 1);
    await settle();
    assert.deepEqual(hopped.walkedTo, [578, 564]);
});

test('the 3rd and 4th sheep go by where the sheep stands', async () => {
    const world = tickWorld();
    addNpc(world, { id: 432, x: 623, y: 529 });
    addNpc(world, { id: 433, x: 603, y: 587 });
    const player = suited({ world, x: 600, y: 560 });

    const hops3 = [];
    for (let i = 0; i < 6; i += 1) {
        await nudge(world, player, 432);
        hops3.push([sheepOf(world, 432).x, sheepOf(world, 432).y]);
    }
    assert.deepEqual(hops3, [[614, 531], [604, 531], [594, 531], [584, 531], [579, 543], [590, 546]]);

    // the 4th sheep needs its walks: over the river it walks on to 595,587, and from 589,562 (no hop matches there)
    // on to 595,567, before the next hop
    const where = () => [sheepOf(world, 433).x, sheepOf(world, 433).y];
    const hops4 = [];
    for (const walk of [0, 0, 20, 0, 0, 20, 0, 0, 0]) {
        await nudge(world, player, 433);
        hops4.push(where());
        await walkTicks(world, walk);
        if (walk) hops4.push(where());
    }
    assert.deepEqual(hops4, [
        [603, 595], [591, 603], [587, 596], [595, 587], [588, 578], [588, 570], [589, 562], [595, 567],
        [587, 552], [586, 547], [590, 546]
    ]);
});

test('an idle sheep is removed after ~80 s and comes back home', async () => {
    const world = tickWorld();
    addNpc(world, { id: 431, x: 581, y: 564 });
    const player = suited({ world, x: 581, y: 565 });

    await nudge(world, player, 431);
    // the nudge took one tick
    runTicks(world, 122);
    assert.equal(world.npcs.length, 1);
    runTicks(world, 1);
    assert.equal(world.npcs.length, 0);
    // the respawn timer brings it back at its spawn
    const respawn = world.timeouts.at(-1);
    assert.equal(respawn.ms, 43000);
    respawn.func();
    assert.deepEqual([sheepOf(world, 431).x, sheepOf(world, 431).y], [581, 564]);
});

test('poison only in the pen; the remains burn once each; Halgrive pays (stage 2 -> -1)', async () => {
    const world = makeWorld();
    const furnace = addObject(world, { id: 444, x: 593, y: 547 });
    const player = suited({ world, x: 590, y: 545 });

    const outside = addNpc(world, { id: 430, x: 578, y: 564 });
    await herder.onUseWithNPC(player, outside, { id: FEED });
    assert.ok(player.messages.includes("@que@you can't kill the sheep out here"));
    world.removeEntity('npcs', outside);

    for (const id of SHEEP) {
        const sheep = addNpc(world, { id, x: 590, y: 546 });
        await herder.onUseWithNPC(player, sheep, { id: FEED });
        assert.ok(player.messages.includes('the sheep collapses to the floor and dies'));
        assert.equal(sheepOf(world, id), undefined);

        const drop = [...world.groundItems.getAll()].find((item) => item.id === REMAINS[id]);
        assert.ok(drop, `remains ${REMAINS[id]} dropped`);
        assert.equal(drop.owner, player.id);
        world.removeEntity('groundItems', drop);
        player.inventory.add(REMAINS[id]);

        await herder.onUseWithGameObject(player, furnace, { id: REMAINS[id] });
        assert.equal(player.inventory.count(REMAINS[id]), 0);
    }

    // the feed is not used up; a second batch of remains is refused
    assert.equal(player.inventory.count(FEED), 1);
    player.inventory.add(758);
    await herder.onUseWithGameObject(player, furnace, { id: 758 });
    assert.ok(player.messages.includes('@que@You need to kill this sheep yourself'));
    assert.equal(await herder.onUseWithGameObject(player, furnace, { id: COINS }), true);

    const halgrive = fakeNpc(HALGRIVE);
    await herder.onTalkToNPC(player, halgrive);
    assert.equal(player.questStages.sheepHerder, -1);
    assert.equal(player.questPoints, 4);
    assert.equal(player.inventory.count(COINS), 3100);
    assert.ok(player.messages.includes('well done, you have completed the Plaguesheep quest'));
    assert.equal(player.cache.plagueremain1st, undefined);
});

test('Halgrive sends you back while a sheep is left', async () => {
    const player = suited({ cache: { plagueremain1st: true } });
    await herder.onTalkToNPC(player, fakeNpc(HALGRIVE));
    assert.equal(player.questStages.sheepHerder, 2);
    assert.ok(player.said.includes('erm not quite'));
});
