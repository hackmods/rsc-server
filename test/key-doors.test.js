// Key doors: wall-objects/key-doors.js (Open-RSC DoorAction.java), driven by fake player and wall objects.

const test = require('node:test');
const assert = require('node:assert/strict');

const items = require('@2003scape/rsc-data/config/items.json');
const walls = require('@2003scape/rsc-data/config/wall-objects.json');
const keyDoors = require('../src/plugins/wall-objects/key-doors');

function fakePlayer({ has = [], quest = 1 } = {}) {
    const player = {
        messages: [],
        bubbles: [],
        doors: [],
        said: [],
        removed: [],
        cache: { witchSpawned: true },
        questStages: { witchsHouse: quest },
        inventory: {
            has: (id) => has.includes(id),
            remove: (id) => player.removed.push(id)
        },
        message(...m) {
            player.messages.push(...m);
        },
        sendBubble(id) {
            player.bubbles.push(id);
        },
        async enterDoor(door) {
            player.doors.push(door);
            player.messages.push('<walk>');
        },
        async say(...m) {
            player.said.push(...m);
        }
    };
    return player;
}

test('ids match rsc-data names', () => {
    for (const id of [23, 69, 83, 84, 110]) {
        assert.equal(walls[id].name, 'Door');
    }
    assert.equal(items[99].name, 'Brass key');
    assert.equal(items[538].name, 'Front door key');
    assert.equal(items[595].name, 'Jail keys');
    assert.equal(items[596].name.toLowerCase(), 'dusty key');
    assert.equal(items[732].name.toLowerCase(), 'shiny key');
});

test('brass key opens door 23, shows the bubble, keeps the key', async () => {
    const player = fakePlayer({ has: [99] });
    const door = { id: 23, x: 202, y: 485 };
    assert.equal(await keyDoors.onUseWithWallObject(player, door, { id: 99 }), true);
    assert.deepEqual(player.bubbles, [99]);
    assert.deepEqual(player.doors, [door]);
    assert.deepEqual(player.messages, ['you unlock the door', '<walk>', 'you go through the door']);
    assert.deepEqual(player.removed, []);
});

test('Open on a key door says it is locked, even holding the key', async () => {
    for (const door of [
        { id: 23, x: 202, y: 485 },
        { id: 69, x: 363, y: 494 },
        { id: 83, x: 360, y: 3428 },
        { id: 84, x: 355, y: 3353 },
        { id: 110, x: 554, y: 449 }
    ]) {
        const player = fakePlayer({ has: [99, 538, 595, 596, 732] });
        assert.equal(await keyDoors.onWallObjectCommandOne(player, door), true);
        assert.deepEqual(player.messages, ['the door is locked']);
        assert.deepEqual(player.doors, []);
    }
});

test('wrong item gives "Nothing interesting happens" and the door stays shut', async () => {
    const player = fakePlayer({ has: [99, 596] });
    assert.equal(await keyDoors.onUseWithWallObject(player, { id: 84, x: 355, y: 3353 }, { id: 99 }), true);
    assert.deepEqual(player.messages, ['Nothing interesting happens']);
    assert.deepEqual(player.doors, []);
});

test('right id but key not in the pack does nothing', async () => {
    const player = fakePlayer({ has: [] });
    assert.equal(await keyDoors.onUseWithWallObject(player, { id: 110, x: 554, y: 449 }, { id: 732 }), true);
    assert.deepEqual(player.messages, ['Nothing interesting happens']);
});

test('jail and dusty doors are key doors only on the Java tiles', async () => {
    for (const door of [
        { id: 83, x: 360, y: 3425 },
        { id: 83, x: 360, y: 3428 }
    ]) {
        const player = fakePlayer({ has: [595] });
        assert.equal(await keyDoors.onUseWithWallObject(player, door, { id: 595 }), true);
        assert.equal(player.doors.length, 1);
    }

    for (const door of [
        { id: 83, x: 204, y: 752 },
        { id: 84, x: 209, y: 754 }
    ]) {
        const player = fakePlayer({ has: [595, 596] });
        assert.equal(await keyDoors.onUseWithWallObject(player, door, { id: door.id === 83 ? 595 : 596 }), false);
        assert.equal(await keyDoors.onWallObjectCommandOne(player, door), false);
        assert.deepEqual(player.messages, []);
    }
});

test('witchs house: no bubble, clears the witch flag, refuses before the quest', async () => {
    const door = { id: 69, x: 363, y: 494 };

    const started = fakePlayer({ has: [538], quest: 1 });
    assert.equal(await keyDoors.onUseWithWallObject(started, door, { id: 538 }), true);
    assert.deepEqual(started.bubbles, []);
    assert.equal(started.cache.witchSpawned, undefined);
    assert.equal(started.doors.length, 1);

    const fresh = fakePlayer({ has: [538], quest: 0 });
    assert.equal(await keyDoors.onUseWithWallObject(fresh, door, { id: 538 }), true);
    assert.deepEqual(fresh.said, ["It'd be rude to break into this house"]);
    assert.deepEqual(fresh.doors, []);
});

test('consume removes the key and says so (table entry, as the maze keys do)', async () => {
    const { onUseWithWallObject } = keyDoors.makeHandlers([{ wallId: 48, key: 390, consume: true, bubble: false }]);
    const player = fakePlayer({ has: [390] });
    assert.equal(await onUseWithWallObject(player, { id: 48, x: 349, y: 629 }, { id: 390 }), true);
    assert.deepEqual(player.removed, [390]);
    assert.deepEqual(player.messages.slice(-1), ['Your red key has gone!']);
});

test('unrelated walls are left alone', async () => {
    const player = fakePlayer({ has: [99] });
    assert.equal(await keyDoors.onWallObjectCommandOne(player, { id: 2, x: 1, y: 1 }), false);
    assert.equal(await keyDoors.onUseWithWallObject(player, { id: 2, x: 1, y: 1 }, { id: 99 }), false);
    assert.deepEqual(player.messages, []);
});
