// Locks: every authentically locked door/gate answers as Open-RSC does, and the way through (key, level, item, pick lock)
// works. One representative per kind (key-door, skill-door, npc-door, locked, pick-lock) plus every row changed by the
// locks pass (gate 260 and 356, wall 120, Temple of Ikov 104 and 105). Defects in files this pass does not own are
// recorded as todo tests: they show up in the report but do not fail the suite.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const gate = require('../src/plugins/game-objects/gate');
const doors = require('../src/plugins/wall-objects/doors');
const keyDoors = require('../src/plugins/wall-objects/key-doors');
const levelDoors = require('../src/plugins/wall-objects/level-doors');
const lockedDoor = require('../src/plugins/game-objects/locked-door');
const thieving = require('../src/plugins/skills/thieving');
const melzar = require('../src/plugins/quests/free/dragon-slayer/melzars-maze-doors');

const FORESTER = 348;
const MOURNER = 445;

function fakeNpc(id, x = 0, y = 0) {
    const npc = { id, x, y, said: [], async say(...l) { npc.said.push(...l); } };
    return npc;
}

function fakePlayer({ x = 10, y = 10, npcs = [], worn = [], inv = {}, levels = {}, hits = 10, stages = {} } = {}) {
    const events = [];
    const player = {
        x, y, events, messages: [], entered: [], gates: [], tele: [], damaged: [], interlocutor: null,
        cache: {}, questStages: stages,
        world: {
            async sleepTicks(n) { events.push(['sleep', n]); },
            npcs: { *getAllByID(id) { for (const n of npcs) if (n.id === id) yield n; } }
        },
        skills: new Proxy({ hits: { current: hits } }, { get: (t, k) => t[k] || { current: levels[k] || 1 } }),
        inventory: {
            has: (id, n = 1) => (inv[id] || 0) >= n,
            remove: (id, n = 1) => { inv[id] -= n; },
            isEquipped: (id) => worn.includes(id)
        },
        message(...m) { player.messages.push(...m); events.push(['msg', ...m]); },
        sendSound() {},
        sendBubble() {},
        addExperience(s, e) { player.xp = [s, e]; },
        async say() {},
        engage(npc) { player.engaged = npc; },
        disengage() { player.engaged = null; },
        async enterDoor(d) { player.entered.push(d.id); },
        async enterGate(g, id) { player.gates.push([g.id, id]); },
        teleport(a, b) { player.tele.push([a, b]); },
        damage(n) { player.damaged.push(n); },
        getNearbyEntitiesByID: (t, id) => npcs.filter((n) => n.id === id),
        getNearestEntityByID: (t, id) => npcs.find((n) => n.id === id)
    };
    return player;
}

const gateObj = (id, x, y, direction = 2) => ({ id, x, y, direction, definition: { name: 'gate' } });
const wall = (id, x, y, direction = 0) => ({ id, x, y, direction });

// ---- gate 260 (GATE_BANK_VAULT) -----------------------------------------------------------------------------------

test('bank vault gate 260: always locked, the player stays put', async () => {
    const p = fakePlayer({ x: 149, y: 3331 });
    assert.equal(await gate.onGameObjectCommandOne(p, gateObj(260, 149, 3332)), true);
    assert.deepEqual(p.messages, ['@que@the gate is locked']);
    assert.deepEqual(p.gates, []);
    assert.deepEqual(p.tele, []);
});

// ---- gate 356 (GATE_MCGRUBORS_WOOD) -------------------------------------------------------------------------------

test('McGrubor gate 356 from the south (y <= 472): locked', async () => {
    const p = fakePlayer({ x: 560, y: 472, npcs: [fakeNpc(FORESTER)] });
    assert.equal(await gate.onGameObjectCommandOne(p, gateObj(356, 560, 472)), true);
    assert.deepEqual(p.messages, ['@que@the gate is locked']);
    assert.deepEqual(p.gates, []);
});

test('McGrubor gate 356 from the north with the Forester: he turns you away, then the QUEST line', async () => {
    const forester = fakeNpc(FORESTER);
    const p = fakePlayer({ x: 560, y: 473, npcs: [forester] });
    assert.equal(await gate.onGameObjectCommandOne(p, gateObj(356, 560, 472)), true);
    assert.deepEqual(forester.said, ["Hey you can't come through here", 'This is private land']);
    assert.deepEqual(p.messages, ['@que@You will need to find another way in']);
    assert.deepEqual(p.events.filter((e) => e[0] === 'sleep'), [['sleep', 2]]);
    assert.deepEqual(p.gates, []);
    assert.equal(p.engaged, null);
});

test('McGrubor gate 356 from the north with no Forester near: two QUEST lines', async () => {
    const p = fakePlayer({ x: 560, y: 480 });
    assert.equal(await gate.onGameObjectCommandOne(p, gateObj(356, 560, 472)), true);
    assert.deepEqual(p.messages, ['@que@You will need to find another way in', '@que@the gate is locked']);
    assert.deepEqual(p.gates, []);
});

test('McGrubor gate 356 elsewhere than (560, 472): Java returns silently, the click is claimed', async () => {
    const p = fakePlayer({ x: 1, y: 1 });
    assert.equal(await gate.onGameObjectCommandOne(p, gateObj(356, 1, 2)), true);
    assert.deepEqual(p.messages, []);
});

test('a generic gate is not claimed by the locked branches', async () => {
    const p = fakePlayer();
    assert.equal(await gate.onGameObjectCommandOne(p, gateObj(9999, 1, 1)), false);
    assert.deepEqual(p.messages, []);
});

// ---- wall 120 (DOOR_PLAGUE_UNOPENABLE) ----------------------------------------------------------------------------

test('plague door 120 east of x 624: "won\'t open", black cross, mourner warns', async () => {
    const mourner = fakeNpc(MOURNER);
    const p = fakePlayer({ x: 625, y: 585, npcs: [mourner] });
    assert.equal(await doors.onWallObjectCommandOne(p, wall(120, 631, 585)), true);
    assert.deepEqual(p.messages, ["The door won't open", 'You notice a black cross on the door']);
    assert.deepEqual(mourner.said, ["I'd stand away from there", 'That black cross means that house has been touched by the plague']);
    assert.deepEqual(p.entered, []);
});

test('plague door 120 east of x 624 with no mourner: messages only', async () => {
    const p = fakePlayer({ x: 640, y: 600 });
    assert.equal(await doors.onWallObjectCommandOne(p, wall(120, 642, 600)), true);
    assert.deepEqual(p.messages, ["The door won't open", 'You notice a black cross on the door']);
});

test('plague door 120 at x <= 624: Java says nothing, the click is claimed', async () => {
    const p = fakePlayer({ x: 624, y: 585, npcs: [fakeNpc(MOURNER)] });
    assert.equal(await doors.onWallObjectCommandOne(p, wall(120, 631, 585)), true);
    assert.deepEqual(p.messages, []);
    assert.deepEqual(p.entered, []);
});

// ---- Temple of Ikov doors 104 and 105 (pendant / boots) -----------------------------------------------------------

test('Ikov fear room door 104 without the pendant from the north: terror, stays put', async () => {
    const p = fakePlayer({ x: 533, y: 3343 });
    assert.equal(await doors.onWallObjectCommandOne(p, wall(104, 533, 3342)), true);
    assert.deepEqual(p.messages, ['As you reach to open the door', 'A great terror comes over you', "You decide you'll not open this door today"]);
    assert.deepEqual(p.entered, []);
});

test('Ikov fear room door 104 with the pendant worn, or from inside (y 3335..3341): passes', async () => {
    const worn = fakePlayer({ x: 533, y: 3343, worn: [721] });
    assert.equal(await doors.onWallObjectCommandOne(worn, wall(104, 533, 3342)), true);
    assert.deepEqual(worn.entered, [104]);
    const inside = fakePlayer({ x: 533, y: 3341 });
    assert.equal(await doors.onWallObjectCommandOne(inside, wall(104, 533, 3342)), true);
    assert.deepEqual(inside.entered, [104]);
    assert.deepEqual(inside.messages, ['You go through the door']);
});

test('Ikov bridge door 105 without boots: you fall, hits/5 rounded up', async () => {
    const p = fakePlayer({ x: 545, y: 3328, hits: 11 });
    assert.equal(await doors.onWallObjectCommandOne(p, wall(105, 546, 3328, 1)), true);
    assert.deepEqual(p.tele, [[544, 3330]]);
    assert.deepEqual(p.damaged, [3]);
    assert.deepEqual(p.messages, ['Your weight is too much for the bridge to hold', 'You fall through the bridge', 'The lava singes you']);
    assert.deepEqual(p.entered, []);
});

test('Ikov bridge door 105 with the boots or from x >= 546: passes', async () => {
    const boots = fakePlayer({ x: 545, y: 3328, worn: [722] });
    assert.equal(await doors.onWallObjectCommandOne(boots, wall(105, 546, 3328, 1)), true);
    assert.deepEqual(boots.entered, [105]);
    const east = fakePlayer({ x: 547, y: 3328 });
    assert.equal(await doors.onWallObjectCommandOne(east, wall(105, 546, 3328, 1)), true);
    assert.deepEqual(east.entered, [105]);
});

test('plain doors keep working: 2 swaps to the doorframe, an unknown wall is not claimed', async () => {
    const p = fakePlayer();
    p.world.replaceEntity = (k, o, id) => ({ ...o, id });
    assert.equal(await doors.onWallObjectCommandOne(p, wall(2, 1, 1)), true);
    assert.equal(await doors.onWallObjectCommandOne(p, wall(9999, 1, 1)), false);
});

// ---- representative per kind -------------------------------------------------------------------------------------

test('key-door (wall 69 Witch front door): Open is locked, wrong item refuses, key passes', async () => {
    const door = wall(69, 363, 494);
    const p = fakePlayer({ stages: { witchsHouse: 1 } });
    assert.equal(await keyDoors.onWallObjectCommandOne(p, door), true);
    assert.deepEqual(p.messages, ['the door is locked']);
    const none = fakePlayer({ stages: { witchsHouse: 1 } });
    assert.equal(await keyDoors.onUseWithWallObject(none, door, { id: 1 }), true);
    assert.deepEqual(none.messages, ['Nothing interesting happens']);
    assert.deepEqual(none.entered, []);
    const has = fakePlayer({ stages: { witchsHouse: 1 }, inv: { 538: 1 } });
    assert.equal(await keyDoors.onUseWithWallObject(has, door, { id: 538 }), true);
    assert.deepEqual(has.entered, [69]);
});

test('skill-door (wall 112 Fishing Guild): level 67 refused, 68 passes', async () => {
    const door = wall(112, 586, 524);
    const low = fakePlayer({ levels: { fishing: 67 }, npcs: [fakeNpc(368, 584, 525)] });
    assert.equal(await levelDoors.onWallObjectCommandOne(low, door), true);
    assert.deepEqual(low.messages, ['You need a fishing level of 68 to enter']);
    assert.deepEqual(low.entered, []);
    const ok = fakePlayer({ levels: { fishing: 68 } });
    assert.equal(await levelDoors.onWallObjectCommandOne(ok, door), true);
    assert.deepEqual(ok.entered, [112]);
});

test('npc-door (wall 113 Khazard house): outsider turned away, helmet+chainmail passes', async () => {
    const guard = fakeNpc(374);
    const door = wall(113, 621, 699);
    const out = fakePlayer({ x: 621, y: 698, npcs: [guard] });
    assert.equal(await levelDoors.onWallObjectCommandOne(out, door), true);
    assert.deepEqual(out.entered, []);
    assert.ok(guard.said.length > 0);
    const worn = fakePlayer({ x: 621, y: 698, worn: [733, 734] });
    assert.equal(await levelDoors.onWallObjectCommandOne(worn, door), true);
    assert.deepEqual(worn.entered, [113]);
});

test('npc-door (wall 67 Zanaris doorman): no diamond, no entry', async () => {
    const doorman = fakeNpc(221, 110, 3540);
    const p = fakePlayer({ x: 115, y: 3540, npcs: [doorman] });
    p.ask = async () => 2;
    assert.equal(await levelDoors.onWallObjectCommandOne(p, wall(67, 117, 3539)), true);
    assert.deepEqual(p.entered, []);
});

test('locked (object 142 Black Knights doors): never opens', async () => {
    const p = fakePlayer();
    assert.equal(await lockedDoor.onGameObjectCommandOne(p, { id: 142 }), true);
    assert.equal(p.entered.length + p.gates.length, 0);
    assert.equal(await lockedDoor.onGameObjectCommandOne(p, { id: 143 }), false);
});

test('pick-lock door (wall 93): low level refused, lockpick doors need the pick, success walks through', async () => {
    const low = fakePlayer({ x: 539, y: 532, levels: { thieving: 1 } });
    assert.equal(await thieving.onWallObjectCommandTwo(low, wall(93, 539, 531)), true);
    assert.deepEqual(low.entered, []);
    const noPick = fakePlayer({ x: 160, y: 105, levels: { thieving: 99 } });
    assert.equal(await thieving.onWallObjectCommandTwo(noPick, wall(100, 160, 107)), true);
    assert.deepEqual(noPick.entered, []);
    const strong = fakePlayer({ x: 539, y: 532, levels: { thieving: 99 } });
    const real = Math.random;
    Math.random = () => 0;
    try {
        assert.equal(await thieving.onWallObjectCommandTwo(strong, wall(93, 539, 531)), true);
    } finally {
        Math.random = real;
    }
    assert.deepEqual(strong.entered, [93]);
    const open = fakePlayer({ x: 539, y: 532 });
    assert.equal(await thieving.onWallObjectCommandOne(open, wall(93, 539, 531)), true);
    assert.deepEqual(open.messages, ['The door is locked']);
});

// ---- re-close (timed replace) -------------------------------------------------------------------------------------

// player.js cannot be required here (it loads the native canvas module), so the method text is lifted from the source
function method(name) {
    const src = fs.readFileSync(path.join(__dirname, '../src/model/player.js'), 'utf8');
    const start = src.indexOf(`async ${name}(`);
    const end = src.indexOf('\n    }\n', start);
    return src.slice(start, end + 6).replace(/^async \w+\(/, 'async function (');
}

test('enterDoor opens the door to a doorframe and puts the original wall id back (re-close)', async () => {
    const calls = [];
    const world = {
        replaceEntity(kind, obj, id) { calls.push([kind, obj.id, id]); return { ...obj, id }; },
        async sleepTicks() {}
    };
    const self = { world, x: 0, y: 0, sendSound() {}, walkTo() {}, broadcastDirection() {}, isWalking: true };
    const enterDoor = new Function(`return (${method('enterDoor')})`)();
    await enterDoor.call(self, { id: 112, x: 586, y: 524, direction: 0 });
    assert.deepEqual(calls, [['wallObjects', 112, 11], ['wallObjects', 11, 112]]);
});

test('enterGate replaces the gate with its open twin and back (re-close)', async () => {
    const calls = [];
    const world = {
        replaceEntity(kind, obj, id) { calls.push([kind, obj.id, id]); return { ...obj, id }; },
        async sleepTicks() {}
    };
    const self = {
        world, x: 560, y: 473, walkToPoint: async () => {}, faceDirection() {}, walkTo() {}, message() {}, sendSound() {}
    };
    const enterGate = new Function(`return (${method('enterGate')})`)();
    await enterGate.call(self, { id: 59, x: 560, y: 472, direction: 2 }, 60);
    assert.deepEqual(calls, [['gameObjects', 59, 60], ['gameObjects', 60, 59]]);
});

// ---- defects in files this pass does not own (todo: they do not fail the suite) -----------------------------------

test('thieving.js: Open on a pick-lock door from the unlocked side goes through (Java goThrough)', { todo: true }, async () => {
    const p = fakePlayer({ x: 539, y: 590 });
    await thieving.onWallObjectCommandOne(p, wall(93, 539, 591));
    assert.deepEqual(p.messages, ['You go through the door']);
});

test('thieving.js: level refusal reads "You are not a high enough level to pick this lock" after the attempt line', { todo: true }, async () => {
    const p = fakePlayer({ levels: { thieving: 1 } });
    await thieving.onWallObjectCommandTwo(p, wall(93, 539, 591));
    assert.deepEqual(p.messages, ['you attempt to pick the lock', 'You are not a high enough level to pick this lock']);
});

test('locked-door.js: Java says plain "the doors are locked" (no @que@)', { todo: true }, async () => {
    const p = fakePlayer();
    await lockedDoor.onGameObjectCommandOne(p, { id: 142 });
    assert.deepEqual(p.messages, ['the doors are locked']);
});

test('melzars-maze-doors.js: clicking Open on the maze entrance (60) says "The door is locked"', { todo: true }, async () => {
    const p = fakePlayer();
    assert.equal(await melzar.onWallObjectCommandOne(p, wall(60, 338, 632)), true);
    assert.deepEqual(p.messages, ['the door is locked']);
});
