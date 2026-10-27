// castPlayer: combat spells on other players, Wilderness only.

const test = require('node:test');
const assert = require('node:assert/strict');

const { castPlayer } = require('../src/packet-handlers/magic');
const { spellExperience } = require('@2003scape/rsc-data/skills/magic');

const WIND_STRIKE = 0;
const SAFE = { x: 120, y: 500 };
const WILD = { x: 100, y: 300 }; // wilderness level 22

function makePlayer(world, id, pos, combatLevel) {
    const log = { messages: [], removed: [], xp: [], damage: [], skulls: [] };

    const player = {
        world,
        id,
        index: id,
        username: `p${id}`,
        loggedIn: true,
        locked: false,
        x: pos.x,
        y: pos.y,
        combatLevel,
        skills: {
            magic: { current: 10, base: 10 },
            hits: { current: 20, base: 20 },
            defense: { current: 1, base: 1 }
        },
        equipmentBonuses: {},
        walkQueue: [],
        hasInterfaceOpen: () => false,
        withinRange: () => true,
        withinLineOfSight: () => true,
        faceEntity() {},
        sendProjectile() {},
        sendSound() {},
        message(...m) {
            log.messages.push(...m);
        },
        addExperience(skill, amount) {
            log.xp.push([skill, amount]);
        },
        addSkull(ticks) {
            log.skulls.push(ticks);
        },
        damage(amount, attacker, kind) {
            log.damage.push([amount, attacker, kind]);
            return false;
        },
        inventory: {
            has: () => true,
            isEquipped: () => false,
            remove(rune, amount) {
                log.removed.push([rune, amount]);
            }
        }
    };

    return { player, log };
}

function setup({ casterPos = WILD, victimPos = WILD, casterCb = 30, victimCb = 30 } = {}) {
    const world = { members: true, ticks: 100, planeElevation: 944, players: {} };
    const caster = makePlayer(world, 1, casterPos, casterCb);
    const victim = makePlayer(world, 2, victimPos, victimCb);

    world.players.getByIndex = (index) =>
        [caster.player, victim.player].find((p) => p.index === index) || null;

    return { caster, victim };
}

function cast(caster, victim) {
    return castPlayer(
        { player: caster.player },
        { index: victim.player.index, id: WIND_STRIKE }
    );
}

test('castPlayer is refused outside the wilderness and costs no runes', async () => {
    const { caster, victim } = setup({ casterPos: SAFE, victimPos: SAFE });

    await cast(caster, victim);

    assert.equal(caster.log.removed.length, 0);
    assert.equal(victim.log.damage.length, 0);
    assert.ok(caster.log.messages.length > 0);
    assert.match(caster.log.messages[0], /can't attack other players here/);
});

test('castPlayer is refused when combat levels differ by more than the wilderness level', async () => {
    // wilderness level 22, difference 40
    const { caster, victim } = setup({ casterCb: 30, victimCb: 70 });

    await cast(caster, victim);

    assert.equal(caster.log.removed.length, 0);
    assert.equal(victim.log.damage.length, 0);
    assert.equal(caster.log.skulls.length, 0);
    assert.match(caster.log.messages[0], /within 22 levels/);
});

test('castPlayer in the wilderness takes runes, damages as magic, skulls and gives xp', async (t) => {
    t.mock.method(Math, 'random', () => 0);
    const { caster, victim } = setup();

    await cast(caster, victim);

    assert.ok(caster.log.removed.length > 0, 'runes were not removed');
    assert.equal(victim.log.damage.length, 1);

    const [amount, attacker, kind] = victim.log.damage[0];
    assert.ok(amount >= 1);
    assert.equal(attacker, caster.player);
    assert.equal(kind, 'magic');

    assert.equal(caster.log.skulls.length, 1);
    assert.deepEqual(caster.log.xp, [['magic', spellExperience[WIND_STRIKE]]]);
});

test('castPlayer does not skull when the victim attacked first', async (t) => {
    t.mock.method(Math, 'random', () => 0);
    const { caster, victim } = setup();
    caster.player.attackedBy = new Map([
        [victim.player.id, Date.now() - 60 * 1000]
    ]);

    await cast(caster, victim);

    assert.equal(victim.log.damage.length, 1);
    assert.equal(caster.log.skulls.length, 0);
});

test('castPlayer ignores a victim who is logged out or the caster', async () => {
    const { caster, victim } = setup();
    victim.player.loggedIn = false;

    await cast(caster, victim);
    await castPlayer({ player: caster.player }, { index: 1, id: WIND_STRIKE });

    assert.equal(caster.log.removed.length, 0);
    assert.equal(victim.log.damage.length, 0);
});
