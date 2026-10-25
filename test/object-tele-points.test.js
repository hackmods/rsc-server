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
        cache: {},
        skills: { mining: { current: 99 } },
        held: new Map(),
        fatigue: 0,
        answers: [],
        world: { sleepTicks: async () => {} },
        inventory: {
            has: (id) => p.held.get(id) > 0,
            remove: (id, n) => p.held.set(id, p.held.get(id) - n)
        },
        nearby: [],
        getNearbyEntitiesByID(type, id) {
            return this.nearby.filter((n) => n.id === id);
        },
        async ask() {
            return this.answers.shift();
        },
        async say() {},
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
    for (const row of tele.TELE_POINTS.filter((r) => !r.custom)) {
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

function row(id, x, y) {
    return tele.TELE_POINTS.find((r) => r.id === id && r.x === x && r.y === y && !r.wall);
}

async function click(player, id, x, y, index = 0) {
    const hook = index ? tele.onGameObjectCommandTwo : tele.onGameObjectCommandOne;
    return hook(player, { id, x, y, direction: 0, definition: objects[id] });
}

test('every custom row is claimed and has the Java destination for its main path', () => {
    for (const r of tele.TELE_POINTS.filter((r) => r.custom)) {
        assert.ok(Array.isArray(r.to), `${r.id}`);
        assert.ok(tele.findTelePoint(entityFor(r), { commandIndex: objects[r.id].commands.findIndex((c) => c.toLowerCase() === r.command.toLowerCase()) }), `${r.id}`);
    }
});

test('776 dormitory ladder consumes the ticket and lands on (395,2713)', async () => {
    const p = fakePlayer();
    assert.equal(await click(p, 776, 395, 1770), true);
    assert.deepEqual([p.x, p.y], [0, 0]);
    assert.deepEqual(p.messages, ['Kaleb is busy at the moment.']);
    p.held.set(987, 1);
    assert.equal(await click(p, 776, 395, 1770), true);
    assert.deepEqual([p.x, p.y], [395, 2713]);
    assert.equal(p.held.get(987), 0);
});

test('342 paladin stairs: a paladin that gets into a fight stops the climb', async () => {
    const said = [];
    const paladin = { id: 323, broadcastChat: (m) => said.push(m), chase: async () => {} };
    const p = fakePlayer();
    p.nearby = [paladin];
    p.opponent = {};
    assert.equal(await click(p, 342, 611, 601), true);
    assert.deepEqual(said, ['Stop right there']);
    assert.deepEqual([p.x, p.y], [0, 0]);
    p.opponent = null;
    await click(p, 342, 611, 601);
    assert.deepEqual([p.x, p.y], [611, 1544]);
    const q = fakePlayer();
    await click(q, 342, 611, 601);
    assert.deepEqual([q.x, q.y], [611, 1544]);
});

test('348 wilderness lever asks once, then remembers', async () => {
    const p = fakePlayer();
    p.answers = [1];
    await click(p, 348, 621, 596);
    assert.deepEqual([p.x, p.y], [0, 0]);
    p.answers = [2];
    await click(p, 348, 621, 596);
    assert.deepEqual([p.x, p.y], [180, 128]);
    assert.equal(p.cache.hideWildLeverWarn, true);
    p.x = 0;
    await click(p, 348, 621, 596);
    assert.deepEqual([p.x, p.y], [180, 128]);
});

test('249 Zanaris ladder needs the attendant and a yes', async () => {
    const p = fakePlayer();
    await click(p, 249, 98, 3537);
    assert.deepEqual([p.x, p.y], [0, 0]);
    p.nearby = [{ id: 229, say: async () => {} }];
    p.answers = [0];
    await click(p, 249, 98, 3537);
    assert.deepEqual([p.x, p.y], [0, 0]);
    p.answers = [1];
    await click(p, 249, 98, 3537);
    assert.deepEqual([p.x, p.y], [98, 706]);
});

test('269 rockslide: pickaxe, level 50, and the far side', async () => {
    const p = fakePlayer();
    await click(p, 269, 426, 438);
    assert.deepEqual(p.messages, ['you need a pickaxe to clear the rockslide']);
    p.held.set(156, 1);
    p.skills.mining.current = 49;
    await click(p, 269, 426, 438);
    assert.equal(p.messages[1], 'You need a mining level of 50 to clear the rockslide');
    p.skills.mining.current = 50;
    p.x = 425;
    await click(p, 269, 426, 438);
    assert.deepEqual([p.x, p.y], [428, 438]);
    await click(p, 269, 426, 438);
    assert.deepEqual([p.x, p.y], [425, 438]);
    const q = fakePlayer();
    assert.equal(await click(q, 269, 426, 438, 1), true);
    assert.equal(q.messages.length, 2);
});

test('sewer valves set flags and the raft stops at the matching island', async () => {
    const p = fakePlayer();
    await click(p, 432, 621, 3477);
    assert.deepEqual([p.x, p.y], [621, 3465]);
    await click(p, 412, 623, 634, 1);
    await click(p, 413, 622, 603);
    assert.deepEqual(Object.keys(p.cache).sort(), ['valve1Right', 'valve2Left']);
    await click(p, 432, 621, 3477);
    assert.deepEqual([p.x, p.y], [622, 3422]);
    await click(p, 413, 622, 603, 1);
    assert.deepEqual(Object.keys(p.cache), ['valve1Right']);
    await click(p, 433, 622, 3436);
    assert.deepEqual([p.x, p.y], [620, 3478]);
});

test('Lady of the Waves needs a ship ticket', async () => {
    const p = fakePlayer();
    p.answers = [1];
    await click(p, 780, 471, 850);
    assert.deepEqual([p.x, p.y], [0, 0]);
    p.held.set(988, 1);
    p.answers = [1];
    await click(p, 780, 471, 850);
    assert.deepEqual([p.x, p.y], [269, 640]);
    assert.equal(p.held.get(988), 0);
});

test('Shilo cart: east side jumps back, west side asks', async () => {
    const p = fakePlayer();
    p.x = 387;
    await click(p, 613, 384, 851, 1);
    assert.deepEqual([p.x, p.y], [383, 852]);
    p.answers = [0];
    await click(p, 613, 384, 851, 1);
    assert.deepEqual([p.x, p.y], [386, 852]);
});

const JSON_PATH = path.join(__dirname, '../../knowledge/data/object-tele-points.json');
test('table agrees with the repo JSON', { skip: !fs.existsSync(JSON_PATH) }, () => {
    const json = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
    assert.deepEqual(json.entries, JSON.parse(JSON.stringify(tele.TELE_POINTS)));
});
