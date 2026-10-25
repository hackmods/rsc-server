const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const objects = require('@2003scape/rsc-data/config/objects');
const wallObjects = require('@2003scape/rsc-data/config/wall-objects');
const tele = require('../src/plugins/game-objects/object-tele-points');
const climbable = require('../src/plugins/game-objects/climbable');
const grandTree = require('../src/plugins/wall-objects/grand-tree-doors');

function fakePlayer() {
    const p = {
        x: 0,
        y: 0,
        messages: [],
        bubbles: 0,
        world: { sleepTicks: async () => {} },
        message(m) {
            this.messages.push(m);
        },
        teleport(x, y) {
            this.x = x;
            this.y = y;
        },
        sendTeleportBubble() {
            this.bubbles += 1;
        }
    };
    return p;
}

function entityFor(row) {
    const table = row.wall ? wallObjects : objects;
    return { id: row.id, x: row.x, y: row.y, direction: 0, definition: table[row.id] };
}

test('every row teleports to its tile and the hook claims it', async () => {
    for (const row of tele.TELE_POINTS) {
        const player = fakePlayer();
        const hook = row.wall ? grandTree.onWallObjectCommandOne : tele.onGameObjectCommandOne;
        assert.equal(await hook(player, entityFor(row)), true, `${row.id} ${row.x},${row.y}`);
        assert.deepEqual([player.x, player.y], row.to);
    }
    assert.equal(tele.TELE_POINTS.filter((r) => r.id !== undefined).length >= 18, true);
});

test('climbable does not claim object rows', async () => {
    for (const row of tele.TELE_POINTS.filter((r) => !r.wall)) {
        const player = fakePlayer();
        assert.equal(await climbable.onGameObjectCommandOne(player, entityFor(row)), false, `${row.id}`);
        assert.deepEqual([player.x, player.y], [0, 0]);
    }
});

test('other placements of the same ids are not claimed by the table', async () => {
    const other = { id: 5, x: 318, y: 561, direction: 0, definition: objects[5] };
    assert.equal(await tele.onGameObjectCommandOne(fakePlayer(), other), false);
});

test('Mage Arena ladder lands on the Java (XML) tile', async () => {
    const ladder = { id: 1187, x: 446, y: 3367, direction: 4, definition: objects[1187] };
    const player = fakePlayer();
    assert.equal(await tele.onGameObjectCommandOne(player, ladder), true);
    assert.deepEqual([player.x, player.y], [223, 109]);
});

test('Grand Tree door passes with the Java messages', async () => {
    const door = { id: 153, x: 703, y: 455, direction: 0, definition: wallObjects[153] };
    const player = fakePlayer();
    assert.equal(await grandTree.onWallObjectCommandOne(player, door), true);
    assert.deepEqual([player.x, player.y], [416, 165]);
    assert.deepEqual(player.messages, ['you open the door', 'and walk through']);
});

test('levers show the bubble on arrival', async () => {
    const lever = { id: 487, x: 282, y: 3020, direction: 0, definition: objects[487] };
    const player = fakePlayer();
    await tele.onGameObjectCommandOne(player, lever);
    assert.equal(player.bubbles, 1);
    assert.deepEqual(player.messages, ['You pull the lever']);
});

const JSON_PATH = path.join(__dirname, '../../knowledge/data/object-tele-points.json');
test('table agrees with the repo JSON', { skip: !fs.existsSync(JSON_PATH) }, () => {
    const json = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
    assert.deepEqual(json.entries, JSON.parse(JSON.stringify(tele.TELE_POINTS)));
});
