// Gnome stronghold gate (626): a members gate (Open-RSC DoorAction.java GNOME_STRONGHOLD_GATE) with The Grand Tree's
// two refusals, and Player#enterGate's direction-2 crossing (Open-RSC Functions.doGate).

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

// player.js loads the captcha, which needs the native canvas module
const realLoad = Module._load;
Module._load = function load(request, ...rest) {
    return request === '@2003scape/rsc-captcha' ? class {} : realLoad.call(this, request, ...rest);
};
const Player = require('../src/model/player');
Module._load = realLoad;

const gates = require('../src/plugins/game-objects/members-gates');

const GATE = { id: 626, x: 703, y: 531, direction: 2, definition: { description: 'The gate is closed' } };

function fakePlayer({ x = 703, y = 532, stage = 0, guard = null, cache = { helpedFemi: false }, answers = [] } = {}) {
    const said = [];
    const world = {
        members: true,
        sleepTicks: async () => {},
        spawnTimedNPC: (o) => {
            world.spawned = o;
            return { say: async (...m) => said.push(...m) };
        },
        removeEntity: (kind) => (world.removed = kind)
    };
    return {
        x,
        y,
        world,
        said,
        messages: [],
        entered: 0,
        questStages: { grandTree: stage },
        cache,
        ask: async (options) => {
            const choice = answers.shift();
            said.push(options[choice]);
            return choice;
        },
        getNearbyEntitiesByID: () => (guard ? [guard] : []),
        say: async (...m) => said.push(...m),
        message(m) {
            this.messages.push(m);
        },
        async enterGate() {
            this.entered += 1;
        }
    };
}

test('stronghold gate opens for members outside the quest stages', async () => {
    const player = fakePlayer();
    assert.equal(await gates.onGameObjectCommandOne(player, GATE), true);
    assert.equal(player.entered, 1);
    assert.deepEqual(player.messages, ['you go through the gate']);
});

test('Grand Tree stage 8 keeps the player inside, with a spawned guard', async () => {
    const player = fakePlayer({ y: 530, stage: 8 });
    assert.equal(await gates.onGameObjectCommandOne(player, GATE), true);
    assert.equal(player.entered, 0);
    assert.equal(player.world.spawned.id, 562);
    assert.equal(player.world.removed, 'npcs');
    assert.ok(player.messages.includes('the gnome refuses to open the gate'));
});

test('Grand Tree stage 10 keeps the player outside', async () => {
    const guard = { say: async () => {} };
    const player = fakePlayer({ y: 532, stage: 10, guard });
    assert.equal(await gates.onGameObjectCommandOne(player, GATE), true);
    assert.equal(player.entered, 0);
    assert.ok(player.said.includes('glough!'));
});

test('Grand Tree stage 0: Femi asks for a hand with her barrel the first time in from the south', async () => {
    const femi = { said: [], say: async (...m) => femi.said.push(...m) };
    const player = fakePlayer({ cache: {}, guard: femi, answers: [1] });
    assert.equal(await gates.onGameObjectCommandOne(player, GATE), true);
    assert.equal(player.entered, 0);
    assert.equal(player.cache.helpedFemi, true);
    assert.ok(player.messages.includes('you help the gnome lift the barrel'));

    // either answer is remembered and the gate opens from then on
    const busy = fakePlayer({ cache: {}, guard: femi, answers: [0] });
    await gates.onGameObjectCommandOne(busy, GATE);
    assert.equal(busy.cache.helpedFemi, false);
    await gates.onGameObjectCommandOne(busy, GATE);
    assert.equal(busy.entered, 1);

    // from inside, or once the quest is started, no barrel
    const inside = fakePlayer({ cache: {}, y: 530 });
    await gates.onGameObjectCommandOne(inside, GATE);
    assert.equal(inside.entered, 1);
});

test('another object is not a members gate', async () => {
    assert.equal(await gates.onGameObjectCommandOne(fakePlayer(), { ...GATE, id: 57 }), false);
});

function gatePlayer(x, y) {
    const player = Object.create(Player.prototype);
    const walked = [];
    Object.assign(player, {
        x,
        y,
        walkToPoint: async (wx, wy) => {
            player.x = wx;
            player.y = wy;
        },
        faceDirection() {},
        walkTo(dx, dy) {
            walked.push([dx, dy]);
        },
        message() {},
        sendSound() {},
        world: { sleepTicks: async () => {}, replaceEntity: (kind, obj) => obj }
    });
    return { player, walked };
}

test('enterGate direction 2 crosses south from inside and north from outside', async () => {
    let { player, walked } = gatePlayer(703, 529);
    await player.enterGate(GATE);
    assert.deepEqual(walked, [[0, 1]]);
    ({ player, walked } = gatePlayer(703, 534));
    await player.enterGate(GATE);
    assert.deepEqual([player.x, player.y], [703, 532]);
    assert.deepEqual(walked, [[0, -1]]);
});
