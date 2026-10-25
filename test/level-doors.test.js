// wall-objects/level-doors.js: guild, Khazard, Shantay jail, Zanaris, Stone Gate and cage doors, driven by fakes.

const test = require('node:test');
const assert = require('node:assert/strict');

const doors = require('../src/plugins/wall-objects/level-doors');

function fakeNpc(id, x, y) {
    const npc = { id, x, y, said: [], async say(...l) { npc.said.push(...l); } };
    return npc;
}

function fakePlayer({ x = 0, y = 0, levels = {}, inv = {}, worn = [], npcs = [], answers = [], stages = {} } = {}) {
    const player = {
        x, y, messages: [], entered: [], tele: [], xp: [], said: [], cache: {}, questStages: stages,
        world: { async sleepTicks() {}, npcs: { *getAllByID(id) { for (const n of npcs) if (n.id === id) yield n; } } },
        skills: new Proxy({}, { get: (_, k) => ({ current: levels[k] || 1 }) }),
        inventory: {
            has: (id, n = 1) => (inv[id] || 0) >= n,
            remove: (id, n = 1) => { inv[id] -= n; },
            add: (id, n = 1) => { inv[id] = (inv[id] || 0) + n; },
            isEquipped: (id) => worn.includes(id)
        },
        message(...m) { player.messages.push(...m); },
        async enterDoor(d) { player.entered.push(d.id); },
        teleport(a, b) { player.tele.push([a, b]); },
        addExperience(s, e) { player.xp.push([s, e]); },
        engage() {}, disengage() {},
        getNearestEntityByID: (t, id) => npcs.find((n) => n.id === id),
        async say(...l) { player.said.push(...l); },
        async ask() { return answers.shift(); }
    };
    return player;
}

test('Fishing Guild door: level 68 passes', async () => {
    const p = fakePlayer({ levels: { fishing: 68 } });
    assert.equal(await doors.onWallObjectCommandOne(p, { id: 112, x: 586, y: 524 }), true);
    assert.deepEqual(p.entered, [112]);
});

test('Fishing Guild door: below 68 is refused with the Java texts', async () => {
    const master = fakeNpc(368, 584, 525);
    const p = fakePlayer({ levels: { fishing: 67 }, npcs: [master] });
    assert.equal(await doors.onWallObjectCommandOne(p, { id: 112, x: 586, y: 524 }), true);
    assert.deepEqual(p.entered, []);
    assert.deepEqual(master.said, ['Hello only the top fishers are allowed in here']);
    assert.deepEqual(p.messages, ['You need a fishing level of 68 to enter']);
});

test('Magic Guild door: 66 passes, below is refused by the head wizard', async () => {
    const ok = fakePlayer({ levels: { magic: 66 } });
    await doors.onWallObjectCommandOne(ok, { id: 146, x: 599, y: 757 });
    assert.deepEqual(ok.entered, [146]);
    const wiz = fakeNpc(513, 596, 756);
    const p = fakePlayer({ levels: { magic: 65 }, npcs: [wiz] });
    assert.equal(await doors.onWallObjectCommandOne(p, { id: 146, x: 599, y: 757 }), true);
    assert.deepEqual(p.entered, []);
    assert.deepEqual(wiz.said, ['You need a magic level of 66 to get in here', 'The magical energy in here is unsafe for those below that level']);
});

test('Khazard door: worn helmet and chainmail open it, otherwise the guard turns you away', async () => {
    const worn = fakePlayer({ x: 620, y: 698, worn: [733, 734] });
    await doors.onWallObjectCommandOne(worn, { id: 113, x: 621, y: 699 });
    assert.deepEqual(worn.entered, [113]);
    const guard = fakeNpc(374, 620, 697);
    const p = fakePlayer({ x: 621, y: 698, npcs: [guard] });
    assert.equal(await doors.onWallObjectCommandOne(p, { id: 113, x: 621, y: 699 }), true);
    assert.deepEqual(p.entered, []);
    assert.deepEqual(guard.said.slice(0, 1), ['you there! halt!']);
    const inside = fakePlayer({ x: 621, y: 700 });
    await doors.onWallObjectCommandOne(inside, { id: 113, x: 621, y: 699 });
    assert.deepEqual(inside.entered, [113]);
});

test('Zanaris doorman takes one diamond', async () => {
    const man = fakeNpc(221, 110, 3540);
    const p = fakePlayer({ x: 115, y: 3540, inv: { 161: 1 }, npcs: [man], answers: [0] });
    assert.equal(await doors.onWallObjectCommandOne(p, { id: 67, x: 117, y: 3539 }), true);
    assert.deepEqual(p.entered, [67]);
    assert.equal(p.inv, undefined);
    assert.deepEqual(p.messages, ['You give the doorman a diamond']);
    const none = fakePlayer({ x: 115, y: 3540, npcs: [man], answers: [0] });
    await doors.onWallObjectCommandOne(none, { id: 67, x: 117, y: 3539 });
    assert.deepEqual(none.entered, []);
});

test('Shantay jail door opens when not jailed, is locked otherwise', async () => {
    const p = fakePlayer({ x: 65, y: 729 });
    await doors.onWallObjectCommandOne(p, { id: 176, x: 66, y: 729 });
    assert.deepEqual(p.entered, [176]);
    const shantay = fakeNpc(549, 68, 729);
    const j = fakePlayer({ x: 67, y: 729, npcs: [shantay], inv: { 10: 5 }, answers: [0] });
    j.cache.shantayJail = 1;
    await doors.onWallObjectCommandOne(j, { id: 176, x: 66, y: 729 });
    assert.equal(j.messages[0], 'This door is locked.');
    assert.equal(j.cache.shantayJail, undefined);
});

test('Stone Gate needs a pass', async () => {
    const guard = fakeNpc(719, 62, 733);
    const no = fakePlayer({ x: 62, y: 733, npcs: [guard], answers: [0] });
    assert.equal(await doors.onGameObjectCommandOne(no, { id: 916 }), true);
    assert.deepEqual(no.tele, []);
    assert.deepEqual(guard.said, ['You need a Shantay pass to get through this gate.', 'See Shantay, he will sell you one for a very reasonable price.']);
    const yes = fakePlayer({ x: 62, y: 733, npcs: [guard], inv: { 1030: 1 }, answers: [0] });
    await doors.onGameObjectCommandOne(yes, { id: 916 });
    assert.deepEqual(yes.tele, [[62, 735]]);
});

test('railings 169 need thieving 50', async () => {
    const low = fakePlayer({ x: 1, y: 1, levels: { thieving: 49 } });
    await doors.onWallObjectCommandOne(low, { id: 169, x: 1, y: 1, direction: 0 });
    assert.equal(low.messages.at(-1), 'you need a level of 50 thieving to pick this lock');
    assert.deepEqual(low.tele, []);
    const ok = fakePlayer({ x: 1, y: 1, levels: { thieving: 50 } });
    await doors.onWallObjectCommandOne(ok, { id: 169, x: 1, y: 1, direction: 0 });
    assert.deepEqual(ok.tele, [[1, 0]]);
});

test('unrelated ids return false', async () => {
    const p = fakePlayer();
    assert.equal(await doors.onWallObjectCommandOne(p, { id: 2, x: 0, y: 0 }), false);
    assert.equal(await doors.onWallObjectCommandOne(p, { id: 112, x: 1, y: 1 }), false);
    assert.equal(await doors.onWallObjectCommandTwo(p, { id: 112, x: 586, y: 524 }), false);
    assert.equal(await doors.onGameObjectCommandOne(p, { id: 1 }), false);
    assert.equal(await doors.onGameObjectCommandTwo(p, { id: 1 }), false);
    assert.deepEqual(p.messages, []);
});
