// Player#shootRanged at a player target: wilderness re-check before each shot, player damage roll, skull and combat
// marks; the NPC path keeps using rollPlayerNPCRangedDamage.

const test = require('node:test');
const assert = require('node:assert/strict');

const combat = require('../src/combat');

const calls = { npc: 0, player: 0 };
combat.rollPlayerNPCRangedDamage = () => (calls.npc++, 3);
combat.rollPlayerPlayerRangedDamage = () => (calls.player++, 4);

const Player = require('../src/model/player');

const BOW = 188;
const ARROWS = 11;

function makeShooter(x, y) {
    const ticks = [];
    const shooter = {
        id: 1,
        username: 'shooter',
        x,
        y,
        combatLevel: 40,
        walkQueue: [],
        messages: [],
        arrows: 10,
        skulled: 0,
        timeouts: ticks,
        world: {
            ticks: 100,
            clearTickTimeout() {},
            setTickTimeout(fn, n) {
                ticks.push({ fn, n });
                return ticks.length;
            },
            sleepTicks: async () => {},
            callPlugin: async () => false,
            groundItems: { getAtPoint: () => [] },
            addPlayerDrop() {}
        },
        inventory: {
            getRangedWeapon: () => ({ id: BOW }),
            getAmmunitionID: () => (shooter.arrows > 0 ? ARROWS : -1),
            remove() {
                shooter.arrows -= 1;
            },
            has: () => shooter.arrows > 0
        },
        getDistance: () => 5,
        withinLineOfSight: () => true,
        withinRange: () => true,
        shootRanged(c) {
            return Player.prototype.shootRanged.call(shooter, c);
        },
        faceDirection() {},
        sendProjectile() {},
        message(m) {
            shooter.messages.push(m);
        },
        addSkull(t) {
            shooter.skulled = t;
        },
        skills: { ranged: { current: 40, base: 40 } }
    };
    return shooter;
}

function makePlayerTarget(x, y) {
    const target = {
        id: 2,
        username: 'victim',
        x,
        y,
        combatLevel: 40,
        loggedIn: true,
        skills: { hits: { current: 10 } },
        hits: [],
        damage(amount, from, kind) {
            target.hits.push({ amount, from, kind });
        }
    };
    return target;
}

const shoot = (shooter, target) => Player.prototype.shootRanged.call(shooter, target);

test('shooting a player in the wilderness damages as ranged, uses an arrow, skulls the shooter', async () => {
    const shooter = makeShooter(200, 300);
    const target = makePlayerTarget(200, 300);
    calls.player = 0;
    calls.npc = 0;

    assert.equal(await shoot(shooter, target), true);

    assert.deepEqual(target.hits, [{ amount: 4, from: shooter, kind: 'ranged' }]);
    assert.equal(calls.player, 1);
    assert.equal(calls.npc, 0);
    assert.equal(shooter.arrows, 9);
    assert.ok(shooter.skulled > 0);
    assert.equal(shooter.lastCombatTick, 100);
    assert.equal(shooter.timeouts.length, 1);
    assert.equal(shooter.timeouts[0].n, 4);
});

test('a target outside the wilderness is refused: no damage, no arrow, a message', async () => {
    const shooter = makeShooter(200, 300);
    const target = makePlayerTarget(200, 500);

    assert.equal(await shoot(shooter, target), false);

    assert.equal(target.hits.length, 0);
    assert.equal(shooter.arrows, 10);
    assert.equal(shooter.skulled, 0);
    assert.equal(shooter.messages.length, 1);
});

test('repeat shots re-check: a target that walked out of the wilderness stops the volley', async () => {
    const shooter = makeShooter(200, 300);
    const target = makePlayerTarget(200, 300);

    await shoot(shooter, target);
    target.y = 500;
    shooter.timeouts[0].fn();
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(target.hits.length, 1);
    assert.equal(shooter.arrows, 9);
});

test('a logged out or dead player target is not shot', async () => {
    const shooter = makeShooter(200, 300);
    const gone = makePlayerTarget(200, 300);
    gone.loggedIn = false;
    const dead = makePlayerTarget(200, 300);
    dead.skills.hits.current = 0;

    assert.equal(await shoot(shooter, gone), false);
    assert.equal(await shoot(shooter, dead), false);
    assert.equal(shooter.arrows, 10);
    assert.equal(gone.hits.length + dead.hits.length, 0);
});

test('shooting an NPC still rolls rollPlayerNPCRangedDamage and ignores the wilderness rules', async () => {
    const shooter = makeShooter(200, 500);
    const npc = {
        x: 200,
        y: 500,
        locked: true,
        skills: { hits: { current: 10 } },
        hits: [],
        constructor: { name: 'NPC' },
        damage(amount, from, kind) {
            npc.hits.push({ amount, kind });
        }
    };
    calls.player = 0;
    calls.npc = 0;

    assert.equal(await shoot(shooter, npc), true);

    assert.equal(calls.npc, 1);
    assert.equal(calls.player, 0);
    assert.deepEqual(npc.hits, [{ amount: 3, kind: 'ranged' }]);
    assert.equal(shooter.arrows, 9);
    assert.equal(shooter.skulled, 0);
});

test('rollPlayerPlayerRangedDamage is exported and (not stubbed)', () => {
    delete require.cache[require.resolve('../src/combat')];
    const real = require('../src/combat');
    assert.equal(typeof real.rollPlayerPlayerRangedDamage, 'function');
});
