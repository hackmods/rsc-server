// Wave 1 authentic combat: magic damage (SpellDamages.java, no accuracy roll),
// god spells in PvP, chaos gauntlets, Protect from Missiles (players and NPC
// archers), thrown weapons (ThrowingEvent.java) and stationary aggro
// (NpcBehavior.java).

const Module = require('module');
const test = require('node:test');
const assert = require('node:assert/strict');

const spells = require('@2003scape/rsc-data/config/spells');
const java = require('./fixtures/openrsc-combat-formula');
const { castNPC, castPlayer } = require('../src/packet-handlers/magic');
const { shoot: npcShoot } = require('../src/npc-ranged');
const rangedData = require('../src/ranged-data');
const NPC = require('../src/model/npc');

const realLoad = Module._load;
Module._load = function load(request, ...rest) {
    return request === '@2003scape/rsc-captcha' ? class {} : realLoad.call(this, request, ...rest);
};
const Player = require('../src/model/player');
const Inventory = require('../src/model/inventory');
Module._load = realLoad;

const WILD = { x: 100, y: 300 };
const ARENA = { x: 225, y: 130 };

// --- magic -------------------------------------------------------------------

function makeCaster(world, id, pos, { equipped = [], cache = {} } = {}) {
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
        combatLevel: 60,
        cache,
        questStages: { undergroundPass: -1 }, // Iban blast needs the Underground Pass quest
        skills: {
            magic: { current: 99, base: 99 },
            hits: { current: 90, base: 90 },
            attack: { current: 60, base: 60 },
            strength: { current: 60, base: 60 },
            defense: { current: 60, base: 60 }
        },
        equipmentBonuses: {},
        walkQueue: [],
        hasInterfaceOpen: () => false,
        withinRange: () => true,
        withinLineOfSight: () => true,
        faceEntity() {},
        sendProjectile() {},
        sendSound() {},
        sendStats() {},
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
            isEquipped: (itemID) => equipped.includes(itemID),
            remove(rune, amount) {
                log.removed.push([rune, amount]);
            }
        }
    };
    return { player, log };
}

function magicWorld() {
    const world = { members: true, ticks: 100, planeElevation: 944, players: {}, npcs: {} };
    world.callPlugin = async () => false;
    return world;
}

function makeTarget(world, { name = 'Chicken', hits = 500 } = {}) {
    const log = { damage: [] };
    const npc = {
        index: 7,
        id: 3,
        x: WILD.x,
        y: WILD.y,
        definition: { name, hostility: 'aggressive' },
        skills: { hits: { current: hits, base: hits }, defense: { current: 99, base: 99 }, attack: { current: 10, base: 10 } },
        locked: false,
        opponent: null,
        attack: () => Promise.resolve(),
        damage(amount, from, kind) {
            log.damage.push([amount, from, kind]);
            return false;
        }
    };
    world.npcs.getByIndex = (index) => (index === npc.index ? npc : null);
    return { npc, log };
}

// spell name -> SpellDamages.java constant (wind strike -> WIND_STRIKE)
const javaPower = (name) => java.MODERN_MAGIC[name.toUpperCase().replace(/ /g, '_')];

const ELEMENTAL = [0, 2, 4, 6, 8, 11, 14, 17, 20, 23, 27, 32, 37, 39, 43, 45];

async function maxCast(t, handler, caster, target, id) {
    delete caster.player.magicReadyTick;
    t.mock.method(Math, 'random', () => 0.9999999);
    await handler({ player: caster.player }, { index: target.index, id });
    t.mock.restoreAll();
}

test('every elemental missile hits for at most floor(SpellDamages power), same against NPCs and players, and 0 at the bottom', async (t) => {
    for (const id of ELEMENTAL) {
        const world = magicWorld();
        const caster = makeCaster(world, 1, WILD);
        const victim = makeCaster(world, 2, WILD);
        world.players.getByIndex = (index) => [caster.player, victim.player].find((p) => p.index === index) || null;
        const { npc, log } = makeTarget(world);

        const [pvn, pvp] = javaPower(spells[id].name);
        await maxCast(t, castNPC, caster, npc, id);
        assert.deepEqual(log.damage.map((d) => d[0]), [java.maxMagicHit(pvn)], spells[id].name);

        await maxCast(t, castPlayer, caster, victim.player, id);
        assert.deepEqual(victim.log.damage.map((d) => d[0]), [java.maxMagicHit(pvp)], spells[id].name);

        // no accuracy roll: the lowest roll is a 0, never a miss-then-hit pattern
        delete caster.player.magicReadyTick;
        t.mock.method(Math, 'random', () => 0);
        await castNPC({ player: caster.player }, { index: npc.index, id });
        t.mock.restoreAll();
        assert.equal(log.damage[1][0], 0);
    }
});

test('magic ignores the target defence: a 99-defence NPC still takes the max', async (t) => {
    const world = magicWorld();
    const caster = makeCaster(world, 1, WILD);
    caster.player.skills.magic.current = 59;
    const { npc, log } = makeTarget(world);
    npc.skills.defense.current = 255;
    await maxCast(t, castNPC, caster, npc, 32); // fire blast, power 8
    assert.deepEqual(log.damage.map((d) => d[0]), [8]);
});

test('crumble undead 8, Iban blast 15 (Constants.CRUMBLE_UNDEAD_MAX, calculateIbanSpellDamage)', async (t) => {
    const world = magicWorld();
    const caster = makeCaster(world, 1, WILD, { equipped: [1000] });
    const skeleton = makeTarget(world, { name: 'Skeleton' });
    await maxCast(t, castNPC, caster, skeleton.npc, 19);
    await maxCast(t, castNPC, caster, skeleton.npc, 25);
    assert.deepEqual(skeleton.log.damage.map((d) => d[0]), [8, 15]);
});

test('Iban blast without the staff is refused with the SpellHandler message', async () => {
    const world = magicWorld();
    const caster = makeCaster(world, 1, WILD);
    const { npc, log } = makeTarget(world);
    await castNPC({ player: caster.player }, { index: npc.index, id: 25 });
    assert.equal(log.damage.length, 0);
    assert.deepEqual(caster.log.messages, ['you need the staff of iban to cast this spell']);
});

test('chaos gauntlets add 1 to the bolt spells only', async (t) => {
    const world = magicWorld();
    const caster = makeCaster(world, 1, WILD, { equipped: [701] });
    const { npc, log } = makeTarget(world);
    for (const id of [8, 11, 14, 17, 0, 20]) {
        await maxCast(t, castNPC, caster, npc, id);
    }
    // wind bolt 5.5, water bolt 6, earth bolt 6.5, fire bolt 7, wind strike 1, wind blast 6.5
    assert.deepEqual(log.damage.map((d) => d[0]), [5, 6, 6, 7, 1, 6]);

    // a Family Crest record of other gauntlets cancels it
    caster.player.cache.famcrest_gauntlets = 1;
    await maxCast(t, castNPC, caster, npc, 8);
    assert.equal(log.damage[6][0], 4);
});

function pvpWorld(casterPos = WILD, victimPos = WILD, casterOpts = {}) {
    const world = magicWorld();
    const caster = makeCaster(world, 1, casterPos, casterOpts);
    const victim = makeCaster(world, 2, victimPos);
    world.players.getByIndex = (index) => [caster.player, victim.player].find((p) => p.index === index) || null;
    return { world, caster, victim };
}

test('a god spell on a player is no longer refused: outside the arena it needs 100 arena casts first', async (t) => {
    const { caster, victim } = pvpWorld(WILD, WILD, { equipped: [1218] });
    await castPlayer({ player: caster.player }, { index: 2, id: 34 });
    assert.equal(victim.log.damage.length, 0);
    assert.equal(caster.log.removed.length, 0);
    assert.ok(!caster.log.messages.some((m) => /can't attack other players here/.test(m)));
    assert.deepEqual(caster.log.messages, [
        'this spell can only be used in the mage arena',
        'You must learn this spell first, you need 100 more casts in the mage arena'
    ]);

    caster.player.cache['Saradomin strike_casts'] = 100;
    caster.log.messages.length = 0;
    await maxCast(t, castPlayer, caster, victim.player, 34);
    assert.deepEqual(victim.log.damage.map((d) => d[0]), [18]);
    assert.equal(victim.log.damage[0][2], 'magic');
});

test('god spells: Charge lifts them to 25 only with a god cape (calculateGodSpellDamage)', async (t) => {
    const { world, caster, victim } = pvpWorld(WILD, WILD, {
        equipped: [1218],
        cache: { 'Saradomin strike_casts': 100 }
    });
    caster.player.chargeExpiresTick = world.ticks + 100;
    await maxCast(t, castPlayer, caster, victim.player, 34);

    caster.player.inventory.isEquipped = (id) => id === 1218 || id === 1214;
    await maxCast(t, castPlayer, caster, victim.player, 34);

    delete caster.player.chargeExpiresTick;
    await maxCast(t, castPlayer, caster, victim.player, 34);
    assert.deepEqual(victim.log.damage.map((d) => d[0]), [18, 25, 18]);
});

test('a god spell inside the Mage Arena counts towards the 100', async (t) => {
    const { caster, victim } = pvpWorld(ARENA, ARENA, { equipped: [1217], cache: { 'Claws of Guthix_casts': 99 } });
    await maxCast(t, castPlayer, caster, victim.player, 33);
    assert.equal(caster.player.cache['Claws of Guthix_casts'], 100);
    assert.ok(caster.log.messages.includes('Well done .. you can now use the Claws of Guthix outside the arena'));
    assert.equal(victim.log.damage.length, 1);
});

test('god staff messages are the SpellHandler ones', async () => {
    const { caster } = pvpWorld();
    await castPlayer({ player: caster.player }, { index: 2, id: 35 });
    assert.deepEqual(caster.log.messages, ['you must weild the staff of zamorak to cast this spell']);
});

test('crumble undead on a player, and a PvP curse tells the victim and lowers by ceil(level * share)', async () => {
    const { caster, victim } = pvpWorld();
    await castPlayer({ player: caster.player }, { index: 2, id: 19 });
    assert.deepEqual(caster.log.messages, ['You can not use this spell on a Player']);

    victim.player.skills.attack = { current: 61, base: 61 };
    victim.player.message = (m) => victim.log.messages.push(m);
    delete caster.player.magicReadyTick;
    await castPlayer({ player: caster.player }, { index: 2, id: 46 }); // stun, 10%
    assert.equal(victim.player.skills.attack.current, 61 - Math.ceil(61 * 0.1));
    assert.ok(victim.log.messages.includes('Your attack has been reduced by a stun spell!'));
});

// --- ranged: Protect from Missiles and thrown weapons ---------------------------

function makeShooter({ weapon, ammo = weapon, count = 10, stackable = true, x = 200, y = 300 }) {
    const log = { messages: [], drops: [], timeouts: [], ranges: [], removed: 0 };
    const stack = { id: ammo, owner: 1, amount: 3 };
    const shooter = {
        id: 1,
        username: 'shooter',
        x,
        y,
        combatLevel: 40,
        combatStyle: 0,
        prayers: [],
        walkQueue: [],
        skills: { ranged: { current: 60, base: 60 }, hits: { current: 50 } },
        equipmentBonuses: { weaponAim: 1, weaponPower: 1, armour: 1 },
        world: {
            ticks: 100,
            clearTickTimeout() {},
            setTickTimeout(fn, n) {
                log.timeouts.push(n);
                return log.timeouts.length;
            },
            sleepTicks: async () => {},
            callPlugin: async () => false,
            groundItems: { getAtPoint: () => [stack] },
            addPlayerDrop(player, item) {
                log.drops.push(item.id);
            }
        },
        inventory: {
            getRangedWeapon: () => (count > 0 ? { id: weapon } : undefined),
            getAmmunitionID: () => (count > 0 ? ammo : -1),
            remove() {
                count -= 1;
                log.removed += 1;
            },
            has: () => count > 0
        },
        getDistance: () => 3,
        withinLineOfSight: () => true,
        withinRange(target, range) {
            log.ranges.push(range);
            return true;
        },
        faceDirection() {},
        sendProjectile() {},
        message(m) {
            log.messages.push(m);
        },
        addSkull() {}
    };
    return { shooter, log, stack, stackable };
}

function makeVictimPlayer({ pfm = false } = {}) {
    const prayers = new Array(14).fill(false);
    prayers[13] = pfm;
    const victim = {
        id: 2,
        username: 'victim',
        x: 200,
        y: 300,
        combatLevel: 40,
        combatStyle: 0,
        loggedIn: true,
        prayers,
        messages: [],
        hits: [],
        skills: { hits: { current: 50 }, defense: { current: 1 } },
        equipmentBonuses: { armour: 1 },
        message(m) {
            victim.messages.push(m);
        },
        damage(amount, from, kind) {
            victim.hits.push({ amount, from, kind });
        }
    };
    return victim;
}

const shoot = (shooter, target) => Player.prototype.shootRanged.call(shooter, target);

test('Protect from Missiles: a bow shot at a praying player does not fire, spends no arrow, retries in 3 ticks', async () => {
    const { shooter, log } = makeShooter({ weapon: 188, ammo: 11 });
    const victim = makeVictimPlayer({ pfm: true });
    assert.equal(await shoot(shooter, victim), false);
    assert.deepEqual(victim.hits, []);
    assert.equal(log.removed, 0);
    assert.deepEqual(log.messages, ['Player has a protection from missiles prayer active!']);
    assert.deepEqual(log.timeouts, [3]);
});

test('Protect from Missiles stops thrown weapons too, and off it the shot lands', async () => {
    const { shooter, log } = makeShooter({ weapon: 1013 });
    const victim = makeVictimPlayer({ pfm: true });
    assert.equal(await shoot(shooter, victim), false);
    assert.equal(log.removed, 0);

    victim.prayers[13] = false;
    assert.equal(await shoot(shooter, victim), true);
    assert.equal(log.removed, 1);
    assert.equal(victim.hits.length, 1);
    assert.equal(victim.hits[0].kind, 'ranged');
});

test('a wielded dart is thrown from 4 tiles, a knife or spear from 3 (ThrowingEvent.canReach)', async (t) => {
    t.mock.method(Math, 'random', () => 0.5);
    for (const [weapon, tiles] of [[1013, 4], [1122, 4], [1076, 3], [827, 3], [1140, 3]]) {
        const { shooter, log } = makeShooter({ weapon });
        const npc = new NPC({}, { id: 3, x: 203, y: 300, minX: 203, maxX: 203, minY: 300, maxY: 300 });
        npc.damage = () => false;
        npc.attack = () => Promise.resolve();
        npc.locked = true;
        assert.equal(await shoot(shooter, npc), true);
        assert.equal(log.ranges[0], tiles * 2, `item ${weapon}`);
        assert.equal(log.removed, 1);
        assert.deepEqual(log.timeouts, [3]);
    }
});

test('6 in 7 thrown items land: darts join the stack, knives and spears are separate ground items', async (t) => {
    t.mock.method(Math, 'random', () => 0.5); // floor(0.5 * 7) = 3, not 0: dropped
    const victim = makeVictimPlayer();

    const darts = makeShooter({ weapon: 1013 });
    await shoot(darts.shooter, victim);
    assert.equal(darts.stack.amount, 4);
    assert.deepEqual(darts.log.drops, []);

    const knife = makeShooter({ weapon: 1076 });
    await shoot(knife.shooter, victim);
    assert.equal(knife.stack.amount, 3);
    assert.deepEqual(knife.log.drops, [1076]);

    t.mock.method(Math, 'random', () => 0.1); // floor(0.7) = 0: lost
    const lost = makeShooter({ weapon: 1024 });
    await shoot(lost.shooter, victim);
    assert.equal(lost.stack.amount, 3);
    assert.deepEqual(lost.log.drops, []);
});

test('the thrown weapon rolls with its own aim and power (doRangedDamage(player, throwingID, throwingID))', (t) => {
    const combat = require('../src/combat');
    const { shooter } = makeShooter({ weapon: 1092 });
    const npc = { skills: { defense: { current: 1 }, hits: { current: 5 } } };
    assert.equal(combat.getRangedAccuracy(shooter, 1092), (60 + 8) * (65 + 65));
    assert.equal(combat.getRangedMaxRoll(shooter, 1092), (60 + 8) * (69 + 65));

    // the ids default to what the inventory holds: the spear for both
    t.mock.method(Math, 'random', () => 0);
    assert.equal(combat.rollPlayerNPCRangedDamage(shooter, npc), 0); // (0 + 320) / 640
    t.mock.method(Math, 'random', () => 0.9999999);
    assert.equal(combat.rollPlayerNPCRangedDamage(shooter, { skills: { defense: { current: 255 } } }), 0); // a miss
    t.mock.method(Math, 'random', () => 0);
    const max = combat.getRangedMaxHit(shooter, 1092);
    let calls = 0;
    t.mock.method(Math, 'random', () => (calls++ === 0 ? 0 : 0.9999999));
    assert.equal(combat.rollPlayerNPCRangedDamage(shooter, npc), max);
});

test('Inventory: a wielded thrown weapon is the ranged weapon and its own ammunition', () => {
    const player = { world: { members: true }, message() {}, send() {} };
    const inventory = new Inventory(player, [
        { id: 1013, amount: 50, equipped: true },
        { id: 11, amount: 10 }
    ]);
    inventory.equipmentSlots['right-hand'] = 0;
    assert.equal(inventory.getRangedWeapon().id, 1013);
    assert.equal(inventory.getThrowingWeapon().id, 1013);
    assert.equal(inventory.getAmmunitionID(false), 1013);

    const knives = new Inventory(player, [{ id: 1076 }, { id: 1076, equipped: true }, { id: 1076 }]);
    knives.equipmentSlots['right-hand'] = 1;
    assert.equal(knives.getAmmunitionID(false), 1076);

    // a bow is not a thrown weapon
    const bow = new Inventory(player, [{ id: 188, equipped: true }, { id: 11, amount: 5 }]);
    bow.equipmentSlots['right-hand'] = 0;
    assert.equal(bow.getRangedWeapon().id, 188);
    assert.equal(bow.getThrowingWeapon(), undefined);
    assert.equal(bow.getAmmunitionID(false), 11);
});

test('ranged-data: 38 throwable items (Formulae.throwingIDs), darts are the 12 four-tile ones', () => {
    assert.equal(rangedData.THROWING_IDS.size, 38);
    assert.equal(rangedData.THROWING_DARTS.size, 12);
    for (const id of rangedData.THROWING_IDS) {
        assert.ok(rangedData.RANGED_AIM[id] > 0, `aim for ${id}`);
        assert.ok(rangedData.RANGED_POWER[id] > 0, `power for ${id}`);
    }
});

test('poisoned thrown weapons poison like poisoned arrows (1 in 8 on a player)', (t) => {
    const poison = require('../src/poison');
    t.mock.method(Math, 'random', () => 0);
    const target = { constructor: { name: 'Player' }, poisoned: 0, poison(p) { target.poisoned = p; return true; } };
    Object.setPrototypeOf(target, { constructor: { name: 'Player' } });
    assert.equal(poison.rangedHit({}, target, 1122), true);
    assert.equal(target.poisoned, 20);
    assert.equal(poison.rangedHit({}, target, 1013), false);
});

// --- NPC archers ------------------------------------------------------------------

function makeArcher(victim) {
    const world = { addTimedGroundItem() {}, npcs: {} };
    const npc = {
        index: 4,
        x: victim.x + 3,
        y: victim.y,
        minX: victim.x,
        maxX: victim.x + 6,
        minY: victim.y,
        maxY: victim.y,
        world,
        definition: { name: 'Man' },
        skills: { hits: { current: 7 }, attack: { current: 5 }, strength: { current: 5 }, defense: { current: 5 } },
        withinLineOfSight: () => true,
        faceEntity() {}
    };
    world.npcs.getByIndex = () => npc;
    return npc;
}

test('an NPC archer cannot shoot a player praying Protect from Missiles (RangeEventNpc.java:80-87)', () => {
    const victim = makeVictimPlayer({ pfm: true });
    const npc = makeArcher(victim);
    assert.equal(npcShoot(npc, victim), false);
    assert.deepEqual(victim.messages, ['Man is trying to shoot you!']);
    assert.deepEqual(victim.hits, []);

    victim.prayers[13] = false;
    victim.messages.length = 0;
    assert.equal(npcShoot(npc, victim), true);
    assert.deepEqual(victim.messages, ['Man is shooting at you!']);
    assert.equal(victim.hits.length, 1);
    assert.equal(victim.hits[0].kind, 'ranged');
});

test('an NPC archer stops when the victim gets 6 tiles away', () => {
    const victim = makeVictimPlayer();
    const npc = makeArcher(victim);
    npc.x = victim.x + 6;
    assert.equal(npcShoot(npc, victim), false);
    assert.deepEqual(victim.messages, ['You got away']);
});

// --- aggro ------------------------------------------------------------------------

const npcs = require('@2003scape/rsc-data/config/npcs');
const SKELETON = npcs.findIndex((n) => n.name.toLowerCase() === 'skeleton' && n.hostility === 'aggressive');
const SAFE = { x: 200, y: 600 };

test('aggressive NPCs notice a player 1 tile away (aggro_range 1), the black knight 10', () => {
    const npc = new NPC({}, { id: SKELETON, x: SAFE.x, y: SAFE.y, minX: SAFE.x - 5, maxX: SAFE.x + 5, minY: SAFE.y - 5, maxY: SAFE.y + 5 });
    const at = (dx, dy) => ({ x: SAFE.x + dx, y: SAFE.y + dy, combatLevel: 3 });
    assert.equal(npc.canAggro(at(1, 1)), true);
    assert.equal(npc.canAggro(at(2, 0)), false);
    assert.equal(npc.canAggro({ ...at(1, 0), combatLevel: 200 }), false);

    // the aggressive bandit notices from 2 tiles
    const bandit = new NPC({}, { id: 232, x: SAFE.x, y: SAFE.y, minX: SAFE.x - 10, maxX: SAFE.x + 10, minY: SAFE.y, maxY: SAFE.y });
    assert.equal(bandit.aggressive, true);
    assert.equal(bandit.canAggro(at(2, 0)), true);
    assert.equal(bandit.canAggro(at(3, 0)), false);
});

test('aggro needs the player inside the wander box + 4 (canAggro outOfBounds)', () => {
    const npc = new NPC({}, { id: 542, x: SAFE.x, y: SAFE.y, minX: SAFE.x - 1, maxX: SAFE.x - 1, minY: SAFE.y, maxY: SAFE.y });
    // the undead one notices from 3 tiles; its box (x - 1) + 4 ends at x + 3
    assert.equal(npc.canAggro({ x: SAFE.x + 3, y: SAFE.y, combatLevel: 3 }), true);
    // its box moved one tile west: x + 3 is now outside box + 4, though in range
    npc.minX = npc.maxX = SAFE.x - 2;
    assert.equal(npc.canAggro({ x: SAFE.x + 3, y: SAFE.y, combatLevel: 3 }), false);
    assert.equal(npc.canAggro({ x: SAFE.x + 2, y: SAFE.y, combatLevel: 3 }), true);
});

test('a stationary aggressive NPC aggroes but never wanders', () => {
    const npc = new NPC({}, { id: SKELETON, x: SAFE.x, y: SAFE.y, minX: SAFE.x, maxX: SAFE.x, minY: SAFE.y, maxY: SAFE.y });
    assert.equal(npc.stationary, true);
    let attacked = null;
    let walked = 0;
    npc.updateKnownPlayers = () => {};
    npc.attack = (p) => {
        attacked = p;
        return Promise.resolve();
    };
    npc.walkNextRandomStep = () => {
        walked += 1;
    };

    const far = { x: SAFE.x + 3, y: SAFE.y, combatLevel: 3, opponent: null, withinLineOfSight: () => true };
    npc.knownPlayers.add(far);
    npc.tick();
    assert.equal(attacked, null);
    assert.equal(walked, 0);

    const near = { x: SAFE.x + 1, y: SAFE.y, combatLevel: 3, opponent: null, withinLineOfSight: () => true };
    npc.knownPlayers.add(near);
    npc.tick();
    assert.equal(attacked, near);
    assert.equal(walked, 0);
});

// SpellHandler IBAN_BLAST: the Underground Pass quest, then 25 casts of the cache counter per charge
test('Iban blast needs the Underground Pass quest and spends a charge per cast', async (t) => {
    const world = magicWorld();
    const caster = makeCaster(world, 1, WILD, { equipped: [1000], cache: { 'Iban blast_casts': 1 } });
    const skeleton = makeTarget(world, { name: 'Skeleton' });

    caster.player.questStages.undergroundPass = 5;
    delete caster.player.magicReadyTick;
    await castNPC({ player: caster.player }, { index: skeleton.npc.index, id: 25 });
    assert.deepEqual(caster.log.messages, ['you need to complete underground pass quest to cast this spell']);
    assert.equal(skeleton.log.damage.length, 0);

    caster.player.questStages.undergroundPass = -1;
    await maxCast(t, castNPC, caster, skeleton.npc, 25);
    assert.deepEqual(skeleton.log.damage.map((d) => d[0]), [15]);
    assert.equal(caster.player.cache['Iban blast_casts'], 0);

    caster.log.messages.length = 0;
    delete caster.player.magicReadyTick;
    await castNPC({ player: caster.player }, { index: skeleton.npc.index, id: 25 });
    assert.deepEqual(caster.log.messages, ['you need to recharge the staff of iban', "at iban's temple"]);
    assert.equal(skeleton.log.damage.length, 1);
});
