// Open-RSC DoorAction.java ports: plain doors (gray bricks 8/9, walk-through 115/150), generic gates and locked bank
// doors, the Karamja glider gate (660), the members gates (93, 319, 346, 508) and the East Varrock gate (513).

const test = require('node:test');
const assert = require('node:assert/strict');

const doors = require('../src/plugins/wall-objects/doors');
const gate = require('../src/plugins/game-objects/gate');
const members = require('../src/plugins/game-objects/members-gates');
const manhole = require('../src/plugins/game-objects/manhole');

function fakePlayer({ x = 10, y = 10, members: isMembers = true, biohazard = 0, items = [], guard = null } = {}) {
    const world = {
        members: isMembers,
        replaced: [],
        sleepTicks: async () => {},
        replaceEntity(kind, obj, id) {
            world.replaced.push([kind, obj.id, id]);
            return { ...obj, id };
        }
    };
    const inv = new Map(items.map((id) => [id, 1]));
    return {
        x,
        y,
        world,
        messages: [],
        sounds: [],
        entered: [],
        doorsEntered: 0,
        locked: 0,
        questStages: { biohazard, grandTree: 0 },
        inventory: {
            has: (id) => inv.has(id),
            remove: (id) => inv.delete(id)
        },
        getNearbyEntitiesByID: () => (guard ? [guard] : []),
        message(m) {
            this.messages.push(m);
        },
        sendSound(s) {
            this.sounds.push(s);
        },
        lock() {
            this.locked += 1;
        },
        unlock() {
            this.locked -= 1;
        },
        async enterGate(g, openID) {
            this.entered.push([g.id, openID]);
        },
        async enterDoor() {
            this.doorsEntered += 1;
        }
    };
}

const wall = (id, x = 5, y = 5) => ({ id, x, y, direction: 0 });
const obj = (id, x = 5, y = 5, direction = 2) => ({ id, x, y, direction, definition: { name: 'gate' } });

test('gray brick door (8) opens to its frame (9) and the frame closes back', async () => {
    let player = fakePlayer();
    assert.equal(await doors.onWallObjectCommandOne(player, wall(8)), true);
    assert.deepEqual(player.world.replaced, [['wallObjects', 8, 9]]);
    assert.deepEqual(player.messages, ['The door swings open']);

    player = fakePlayer();
    assert.equal(await doors.onWallObjectCommandTwo(player, wall(9)), true);
    assert.deepEqual(player.world.replaced, [['wallObjects', 9, 8]]);
    assert.deepEqual(player.messages, ['The door creaks shut']);
    assert.equal(player.locked, 0);
});

test('plain door 2 still swaps with frame 1', async () => {
    const player = fakePlayer();
    assert.equal(await doors.onWallObjectCommandOne(player, wall(2)), true);
    assert.deepEqual(player.world.replaced, [['wallObjects', 2, 1]]);
});

test('Fight Arena doors 115 and 150 walk the player through', async () => {
    for (const id of [115, 150]) {
        const player = fakePlayer();
        assert.equal(await doors.onWallObjectCommandOne(player, wall(id)), true);
        assert.equal(player.doorsEntered, 1);
    }
});

test('an unrelated wall object is not a plain door', async () => {
    const player = fakePlayer();
    assert.equal(await doors.onWallObjectCommandOne(player, wall(23)), false);
    assert.equal(await doors.onWallObjectCommandTwo(player, wall(23)), false);
    assert.deepEqual(player.world.replaced, []);
});

test('Karamja glider gate (660) at (387, 760) lets anyone through', async () => {
    const player = fakePlayer({ members: false });
    assert.equal(await gate.onGameObjectCommandOne(player, obj(660, 387, 760)), true);
    assert.deepEqual(player.entered, [[660, 357]]);
    assert.deepEqual(player.messages, ['you open the gate', 'and walk through']);
});

test('another 660 instance does nothing, as in Java', async () => {
    const player = fakePlayer();
    assert.equal(await gate.onGameObjectCommandOne(player, obj(660, 1, 1)), true);
    assert.deepEqual(player.entered, []);
    assert.deepEqual(player.messages, []);
});

test('bank doors (64) swap, except the two locked instances', async () => {
    let player = fakePlayer();
    assert.equal(await gate.onGameObjectCommandOne(player, obj(64, 100, 100)), true);
    assert.deepEqual(player.world.replaced, [['gameObjects', 64, 63]]);

    for (const [x, y] of [[467, 518], [558, 587]]) {
        player = fakePlayer();
        assert.equal(await gate.onGameObjectCommandOne(player, obj(64, x, y)), true);
        assert.deepEqual(player.world.replaced, []);
        assert.deepEqual(player.messages, ['The doors are locked']);
    }
});

test('an unrelated object is not a generic gate', async () => {
    const player = fakePlayer();
    assert.equal(await gate.onGameObjectCommandOne(player, obj(1)), false);
    assert.equal(await gate.onGameObjectCommandTwo(player, obj(1)), false);
});

test('members gates 93, 319, 346 and 508 pass on a members world', async () => {
    for (const id of [93, 319, 346, 508]) {
        const player = fakePlayer();
        assert.equal(await members.onGameObjectCommandOne(player, obj(id)), true);
        assert.deepEqual(player.entered, [[id, undefined]]);
        assert.deepEqual(player.messages, ['you go through the gate']);
    }
});

test('members gates refuse on a non-members world with the Java message', async () => {
    for (const id of [93, 137, 319, 346, 508, 513]) {
        const player = fakePlayer({ members: false });
        assert.equal(await members.onGameObjectCommandOne(player, obj(id, 93, 521)), true);
        assert.deepEqual(player.entered, []);
        assert.deepEqual(player.messages, ['You need to be a member to use this gate']);
    }
});

test('East Varrock gate (513) passes with the open twin 514', async () => {
    const player = fakePlayer({ x: 92 });
    assert.equal(await members.onGameObjectCommandOne(player, obj(513, 93, 521, 4)), true);
    assert.deepEqual(player.entered, [[513, 514]]);
    assert.deepEqual(player.messages, ['you open the gate and pass through']);
});

test('Biohazard stage 6 search takes the three vials from the east side', async () => {
    const said = [];
    const guard = { say: async (...m) => said.push(...m) };
    const player = fakePlayer({ x: 94, biohazard: 6, items: [810, 811, 809, 5], guard });
    assert.equal(await members.onGameObjectCommandOne(player, obj(513, 93, 521, 4)), true);
    assert.equal(said.length, 2);
    assert.deepEqual(player.messages.slice(0, 3), [
        'He takes the vial of ethenea from you',
        'He takes the vial of sulphuric broline from you',
        'He takes the vial of liquid honey from you'
    ]);
    assert.equal(player.inventory.has(810), false);
    assert.equal(player.inventory.has(5), true);
    assert.deepEqual(player.entered, [[513, 514]]);
});

test('Biohazard search does not run from the west side or outside stages 6 and 7', async () => {
    let player = fakePlayer({ x: 92, biohazard: 6, items: [810] });
    await members.onGameObjectCommandOne(player, obj(513, 93, 521, 4));
    assert.equal(player.inventory.has(810), true);

    player = fakePlayer({ x: 94, biohazard: 8, items: [810] });
    await members.onGameObjectCommandOne(player, obj(513, 93, 521, 4));
    assert.equal(player.inventory.has(810), true);
});

test('an unrelated object is not a members gate', async () => {
    assert.equal(await members.onGameObjectCommandOne(fakePlayer(), obj(57)), false);
});

test('manhole 78 slides open with the door sound', async () => {
    const player = fakePlayer();
    assert.equal(await manhole.onGameObjectCommandOne(player, obj(78)), true);
    assert.deepEqual(player.world.replaced, [['gameObjects', 78, 79]]);
    assert.deepEqual(player.sounds, ['opendoor']);
    assert.equal(await manhole.onGameObjectCommandOne(player, obj(1)), false);
});
