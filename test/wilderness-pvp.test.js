// Wilderness PvP: src/wilderness.js rules, Player skull/death methods, Character attack/retreat hooks, the
// playerAttack and logout packet handlers, and the rewardKill extraction (NPC deaths still pay experience).
// Everything is faked by hand; Player.prototype methods are called on fakes.

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const realLoad = Module._load;
Module._load = function load(request, ...rest) {
    return request === '@2003scape/rsc-captcha' ? class {} : realLoad.call(this, request, ...rest);
};
const Player = require('../src/model/player');
const Character = require('../src/model/character');
const NPC = require('../src/model/npc');
Module._load = realLoad;

const wild = require('../src/wilderness');
const { playerAttack } = require('../src/packet-handlers/player');
const { logout } = require('../src/packet-handlers/logout');
const items = require('@2003scape/rsc-data/config/items.json');

const COINS = 10;
const FIRE_RUNE = 31;
const BONES = 20;
const BRONZE_SWORD = 70;
const RUNE_2H = 81;
const RUNE_AXE = 93;
const RUNE_BODY = 400;
const IRON_MACE = 0;
const CHISEL = 167;
const FLOUR = 23; // untradeable

const def = (id) => items[id];
const it = (id, amount = 1, equipped = false) => ({ id, amount, equipped, definition: def(id) });

function makeWorld() {
    const drops = [];
    const world = {
        ticks: 100,
        planeElevation: 944,
        members: true,
        drops,
        byId: new Map(),
        players: {
            getByID: (id) => world.byId.get(id),
            getByIndex: (index) => [...world.byId.values()].find((p) => p.index === index)
        },
        nextTick: (fn) => fn(),
        addPlayerDrop(owner, item, x, y) {
            drops.push({ owner, item, x, y });
        }
    };
    return world;
}

const SKILLS = ['attack', 'defense', 'strength', 'hits', 'ranged', 'prayer', 'magic'];

let nextId = 1;
function makePlayer(world, extra = {}) {
    const p = Object.create(Player.prototype);
    const id = nextId++;
    const bag = [];
    Object.assign(
        p,
        {
            id,
            index: id,
            username: 'user' + id,
            world,
            x: 200,
            y: 300,
            combatLevel: 50,
            loggedIn: true,
            skulled: 0,
            opponent: null,
            messages: [],
            sent: [],
            appearances: 0,
            sounds: [],
            cache: {},
            playerDamage: new Map(),
            rangedDamage: new Map(),
            magicDamage: new Map(),
            prayers: [],
            combatStyle: 1,
            xp: {},
            skills: Object.fromEntries(SKILLS.map((s) => [s, { current: 10, base: 10, experience: 0 }])),
            inventory: {
                items: bag,
                unequipped: [],
                unequip(index) {
                    bag[index].equipped = false;
                    this.unequipped.push(index);
                },
                sendAll() {},
                add(item) {
                    bag.push(item);
                },
                getRangedWeapon: () => undefined
            }
        },
        extra
    );
    p.message = (...m) => p.messages.push(...m);
    p.send = (m) => p.sent.push(m);
    p.sendSound = (s) => p.sounds.push(s);
    p.sendStats = () => {};
    p.sendDeath = () => {};
    p.curePoison = () => {};
    p.broadcastPlayerAppearance = () => {
        p.appearances += 1;
    };
    p.teleport = (x, y) => {
        p.teleported = [x, y];
    };
    p.addExperience = (skill, amount) => {
        p.xp[skill] = (p.xp[skill] || 0) + amount;
    };
    p.retreat = () => {
        p.retreated = true;
    };
    world.byId.set(id, p);
    return p;
}

const give = (p, id, amount = 1, equipped = false) => {
    const item = it(id, amount, equipped);
    p.inventory.items.push(item);
    return item;
};

// ---------------------------------------------------------------- wildernessLevel

test('wildernessLevel matches the classic fold and edges', () => {
    const w = { planeElevation: 944 };
    const lvl = (x, y) => wild.wildernessLevel({ x, y, world: w });
    assert.equal(lvl(200, 426), 1);
    assert.equal(lvl(200, 427), 0);
    assert.equal(lvl(200, 300), 22);
    assert.equal(lvl(336, 300), 0);
    assert.equal(lvl(335, 300), 22);
    assert.equal(lvl(200, 300 + 944), 22);
    assert.equal(lvl(200, 300 + 944 * 2), 22);
    assert.equal(lvl(200, 0), 72);
});

test('wildernessLevel depth boundaries step every 6 rows and default plane elevation applies without a world', () => {
    assert.equal(wild.wildernessLevel({ x: 200, y: 421 }), 2);
    assert.equal(wild.wildernessLevel({ x: 200, y: 422 }), 1);
    assert.equal(wild.wildernessLevel({ x: 200, y: 300 + 944 }), 22);
    assert.equal(wild.inWilderness({ x: 200, y: 300 }), true);
    assert.equal(wild.inWilderness({ x: 200, y: 600 }), false);
});

// ---------------------------------------------------------------- attackRefusal

test('attackRefusal: both must be in the wilderness', () => {
    const w = makeWorld();
    const a = makePlayer(w);
    const b = makePlayer(w, { y: 600 });
    assert.match(wild.attackRefusal(a, b), /can't attack other players here/);
    assert.match(wild.attackRefusal(b, a), /can't attack other players here/);
});

test('attackRefusal: combat difference bound is each player\'s wilderness level, both directions', () => {
    const w = makeWorld();
    const a = makePlayer(w, { y: 426, combatLevel: 50 }); // level 1
    const b = makePlayer(w, { y: 300, combatLevel: 51 }); // level 22
    assert.equal(wild.attackRefusal(a, b), null); // diff 1 <= 1
    b.combatLevel = 52;
    assert.match(wild.attackRefusal(a, b), /within 1 levels of your own here/);
    // attacker deep, victim shallow: the victim's level bounds too
    assert.match(wild.attackRefusal(b, a), /within 1 levels of your own there/);
    b.combatLevel = 51;
    assert.equal(wild.attackRefusal(b, a), null);
});

test('attackRefusal: melee needs the re-attack timer passed, missiles do not; refusal is the silent empty string', () => {
    const w = makeWorld();
    const a = makePlayer(w);
    const b = makePlayer(w);
    b.ranAwayTick = w.ticks - 2;
    assert.equal(wild.attackRefusal(a, b), '');
    assert.equal(wild.attackRefusal(a, b, { missile: true }), null);
    b.ranAwayTick = w.ticks - 5;
    assert.equal(wild.attackRefusal(a, b), null);
});

test('canBeReattacked: 5 tick boundary, no ranAwayTick, no world', () => {
    const w = makeWorld();
    const p = { world: w };
    assert.equal(wild.canBeReattacked(p), true);
    p.ranAwayTick = w.ticks;
    assert.equal(wild.canBeReattacked(p), false);
    p.ranAwayTick = w.ticks - 4;
    assert.equal(wild.canBeReattacked(p), false);
    p.ranAwayTick = w.ticks - 5;
    assert.equal(wild.canBeReattacked(p), true);
    assert.equal(wild.canBeReattacked({ ranAwayTick: 99999 }), true);
});

// ---------------------------------------------------------------- skulls

test('skullOnAttack skulls an unprovoked attacker for 1875 ticks and records the victim attackedBy', () => {
    const w = makeWorld();
    const a = makePlayer(w);
    const b = makePlayer(w);
    assert.equal(wild.skullOnAttack(a, b, 1000), true);
    assert.equal(a.skulled, 1875);
    assert.equal(a.appearances, 1);
    assert.equal(b.attackedBy.get(a.id), 1000);
    assert.equal(b.skulled, 0);
});

test('skullOnAttack: retaliation within 20 minutes is exempt, after 20 minutes is not', () => {
    const w = makeWorld();
    const a = makePlayer(w);
    const b = makePlayer(w);
    wild.skullOnAttack(a, b, 0); // a attacks b first
    assert.equal(wild.skullOnAttack(b, a, wild.RETALIATE_MS), false); // exactly 20 min: exempt
    assert.equal(b.skulled, 0);
    const c = makePlayer(w);
    const d = makePlayer(w);
    wild.skullOnAttack(c, d, 0);
    assert.equal(wild.skullOnAttack(d, c, wild.RETALIATE_MS + 1), true);
    assert.equal(d.skulled, 1875);
});

test('addSkull never shortens a longer skull and only broadcasts on the transition', () => {
    const w = makeWorld();
    const p = makePlayer(w);
    p.addSkull(1000);
    assert.equal(p.skulled, 1000);
    assert.equal(p.appearances, 1);
    p.addSkull(500);
    assert.equal(p.skulled, 1000);
    p.addSkull(1875);
    assert.equal(p.skulled, 1875);
    assert.equal(p.appearances, 1);
    assert.equal(p.isSkulled(), true);
});

test('tickSkull counts down and broadcasts exactly once at 0, never goes negative', () => {
    const w = makeWorld();
    const p = makePlayer(w, { skulled: 2 });
    p.tickSkull();
    assert.equal(p.skulled, 1);
    assert.equal(p.appearances, 0);
    p.tickSkull();
    assert.equal(p.skulled, 0);
    assert.equal(p.appearances, 1);
    p.tickSkull();
    p.tickSkull();
    assert.equal(p.skulled, 0);
    assert.equal(p.appearances, 1);
    assert.equal(p.isSkulled(), false);
});

test('removeSkull broadcasts once and is a no-op when unskulled', () => {
    const w = makeWorld();
    const p = makePlayer(w, { skulled: 10 });
    p.removeSkull();
    p.removeSkull();
    assert.equal(p.skulled, 0);
    assert.equal(p.appearances, 1);
});

// ---------------------------------------------------------------- combat bookkeeping

test('markCombat stamps only real players that have a world', () => {
    const w = makeWorld();
    const a = makePlayer(w);
    const npc = { world: w };
    wild.markCombat(a, npc, null, undefined);
    assert.equal(a.lastCombatTick, w.ticks);
    assert.equal(npc.lastCombatTick, undefined);
});

test('inCombatCooldown: opponent, 16 tick window boundary, no stamp', () => {
    const w = makeWorld();
    const p = makePlayer(w);
    assert.equal(wild.inCombatCooldown(p), false);
    p.opponent = {};
    assert.equal(wild.inCombatCooldown(p), true);
    p.opponent = null;
    p.lastCombatTick = w.ticks - 15;
    assert.equal(wild.inCombatCooldown(p), true);
    p.lastCombatTick = w.ticks - 16;
    assert.equal(wild.inCombatCooldown(p), false);
});

test('logout handler: denies during/after combat without logging out, allows otherwise', async () => {
    const w = makeWorld();
    const p = makePlayer(w);
    let loggedOut = 0;
    p.logout = async () => {
        loggedOut += 1;
    };
    const socket = { player: p };
    p.lastCombatTick = w.ticks - 3;
    await logout(socket);
    assert.deepEqual(p.sent, [{ type: 'logoutDeny' }]);
    assert.equal(loggedOut, 0);
    assert.equal(socket.player, p);

    p.lastCombatTick = w.ticks - 16;
    await logout(socket);
    assert.equal(loggedOut, 1);
    assert.equal(socket.player, undefined);
});

test('Character.attack between players skulls the attacker and marks both in combat; running away by walking sets ranAwayTick', async () => {
    const w = makeWorld();
    const a = makePlayer(w);
    const b = makePlayer(w);
    delete a.retreat; // use the real ones for this test
    delete b.retreat;
    // minimal stubs for the parts of attack() we are not testing
    for (const p of [a, b]) {
        Object.assign(p, {
            fightStage: -1,
            locked: false,
            lock() {
                this.locked = true;
            },
            unlock() {
                this.locked = false;
            },
            walkTo() {},
            getDistance: () => 1,
            withinLineOfSight: () => true,
            broadcastDirection() {},
            broadcastDirection() {},
            setTickTimeout() {}
        });
        p.isWalking = false;
        p.queue = [];
        p.walkQueue = [];
        p.direction = 0;
    }
    w.setTickTimeout = () => {};

    let ok;
    try {
        ok = await Character.prototype.attack.call(a, b);
    } catch (e) {
        // attack() may touch more of the fake than we stubbed; the skull/combat hook runs before that
        ok = undefined;
    }
    if (a.skulled === 0) {
        assert.fail(`Character.attack did not skull the attacker (ok=${ok})`);
    }
    assert.equal(a.skulled, 1875);
    assert.equal(a.lastCombatTick, w.ticks);
    assert.equal(b.lastCombatTick, w.ticks);

    a.opponent = b;
    b.opponent = a;
    a.fightStage = 0;
    w.setTickTimeout = () => {};
    w.ticks = 150;
    try {
        await Character.prototype.retreat.call(a);
    } catch (e) {
        // ignore unrelated stubs
    }
    // a retreat alone (the killer after a kill) sets no re-attack timer
    assert.equal(a.ranAwayTick, undefined);

    // walking away from a player fight after round 3 does
    a.opponent = b;
    a.retreating = false;
    a.combatRounds = 4;
    a.world = w;
    a.retreat = async () => {};
    const { walk } = require('../src/packet-handlers/walk');
    try {
        await walk({ player: a }, { targetX: a.x, targetY: a.y + 1, steps: [] });
    } catch (e) {
        // the walk itself needs more of the world than this fake has
    }
    assert.equal(a.ranAwayTick, 150);
    assert.equal(wild.canBeReattacked(a), false);
});

// ---------------------------------------------------------------- keptOnDeath

test('keptOnDeath keeps top 3 non-stackables by price, 0 when skulled, +1 protect item', () => {
    const inv = [it(COINS, 5000), it(BRONZE_SWORD), it(RUNE_2H), it(RUNE_AXE), it(RUNE_BODY), it(IRON_MACE), it(FIRE_RUNE, 99)];
    const ids = (r) => r.map((i) => i.id);
    assert.deepEqual(ids(wild.keptOnDeath(inv)), [RUNE_2H, RUNE_BODY, RUNE_AXE].sort((x, y) => def(y).price - def(x).price));
    assert.equal(wild.keptOnDeath(inv, { skulled: true }).length, 0);
    assert.equal(wild.keptOnDeath(inv, { protectItem: true }).length, 4);
    assert.deepEqual(ids(wild.keptOnDeath(inv, { skulled: true, protectItem: true })), [RUNE_2H]);
});

test('keptOnDeath never keeps stackables, even when they are the most valuable', () => {
    const inv = [it(COINS, 1e6), it(FIRE_RUNE, 100), it(CHISEL)];
    assert.deepEqual(wild.keptOnDeath(inv).map((i) => i.id), [CHISEL]);
});

test('keptOnDeath ties are stable by inventory order and return the same objects', () => {
    const a = it(CHISEL);
    const b = it(CHISEL);
    const c = it(CHISEL);
    const d = it(CHISEL);
    const kept = wild.keptOnDeath([a, b, c, d]);
    assert.equal(kept.length, 3);
    assert.deepEqual(kept, [a, b, c]);
    assert.equal(kept[0], a);
});

// ---------------------------------------------------------------- death

function setupKill({ skulledVictim = false, killerDamage = 5 } = {}) {
    const w = makeWorld();
    const victim = makePlayer(w, { combatLevel: 40, skulled: skulledVictim ? 100 : 0 });
    const killer = makePlayer(w, { combatLevel: 40 });
    victim.playerDamage.set(killer.id, killerDamage);
    victim.attackedBy = new Map([[killer.id, 1]]);
    victim.opponent = killer;
    killer.opponent = victim;
    return { w, victim, killer };
}

test('PvP death: top damager owns drops and gets bones, kill xp and message; victim keeps 3, loses stackables', () => {
    const { w, victim, killer } = setupKill();
    give(victim, COINS, 1000);
    give(victim, FIRE_RUNE, 50);
    give(victim, RUNE_2H);
    give(victim, RUNE_BODY);
    give(victim, RUNE_AXE);
    give(victim, BRONZE_SWORD);
    Player.prototype.processDeath.call(victim);

    const dropped = w.drops.filter((d) => d.item.id !== BONES).map((d) => d.item.id);
    assert.deepEqual(dropped.sort((x, y) => x - y), [COINS, FIRE_RUNE, BRONZE_SWORD].sort((x, y) => x - y));
    for (const d of w.drops) {
        assert.equal(d.owner, killer);
        assert.equal(d.x, 200);
        assert.equal(d.y, 300);
    }
    assert.equal(w.drops.filter((d) => d.item.id === BONES).length, 1);
    assert.deepEqual(victim.inventory.items.map((i) => i.id).sort((x, y) => x - y), [RUNE_2H, RUNE_BODY, RUNE_AXE].sort((x, y) => x - y));
    // kill xp: quarter of (combat*4+40) split to hits plus style
    assert.ok(killer.xp.hits > 0, 'killer should get hits xp');
    assert.ok(killer.xp.strength > 0, 'aggressive style gets strength xp');
    assert.match(killer.messages.join('|'), /You have defeated User\d+!/);
    assert.ok(killer.sounds.includes('victory'));
    assert.equal(victim.xp.hits, undefined);
    assert.deepEqual(victim.teleported.length, 2);
});

test('PvP death: skulled victim keeps nothing; protect item keeps 1 when skulled', () => {
    let s = setupKill({ skulledVictim: true });
    give(s.victim, RUNE_2H);
    give(s.victim, RUNE_AXE);
    Player.prototype.processDeath.call(s.victim);
    assert.equal(s.victim.inventory.items.length, 0);
    assert.equal(s.w.drops.filter((d) => d.item.id !== BONES).length, 2);
    assert.equal(s.victim.skulled, 0, 'skull removed on death');

    s = setupKill({ skulledVictim: true });
    s.victim.prayers[8] = true;
    give(s.victim, RUNE_2H);
    give(s.victim, RUNE_AXE);
    Player.prototype.processDeath.call(s.victim);
    assert.deepEqual(s.victim.inventory.items.map((i) => i.id), [RUNE_2H]);
});

test('PvP death: damage maps and attackedBy are cleared, skull removed with one broadcast', () => {
    const { victim, killer } = setupKill({ skulledVictim: true });
    victim.rangedDamage.set(killer.id, 2);
    victim.magicDamage.set(killer.id, 1);
    Player.prototype.processDeath.call(victim);
    assert.equal(victim.playerDamage.size, 0);
    assert.equal(victim.rangedDamage.size, 0);
    assert.equal(victim.magicDamage.size, 0);
    assert.equal(victim.attackedBy.size, 0);
    assert.equal(victim.appearances, 1);
});

test('PvP death: equipped items are unequipped and then dropped/kept like the rest', () => {
    const { w, victim } = setupKill({ skulledVictim: true });
    give(victim, RUNE_BODY, 1, true);
    give(victim, BRONZE_SWORD, 1, true);
    Player.prototype.processDeath.call(victim);
    assert.deepEqual(victim.inventory.unequipped, [0, 1]);
    assert.equal(w.drops.filter((d) => d.item.id !== BONES).length, 2);
    for (const d of w.drops) assert.notEqual(d.item.equipped, true);
});

test('PvP death: kept items keep their identity and do not come back equipped or with a different amount', () => {
    const { victim } = setupKill();
    give(victim, RUNE_BODY, 1, true);
    Player.prototype.processDeath.call(victim);
    const [kept] = victim.inventory.items;
    assert.equal(kept.id, RUNE_BODY);
    assert.equal(kept.amount, 1);
    assert.equal(kept.equipped, false);
});

test('PvP death: untradeable items stay with the victim as owner, tradeables go to the killer', () => {
    const { w, victim, killer } = setupKill({ skulledVictim: true });
    give(victim, FLOUR);
    give(victim, BRONZE_SWORD);
    Player.prototype.processDeath.call(victim);
    assert.equal(w.drops.find((d) => d.item.id === FLOUR).owner, victim);
    assert.equal(w.drops.find((d) => d.item.id === BRONZE_SWORD).owner, killer);
});

test('PvP death: with no player damage (NPC kill) drops belong to the victim, no bones, no message', () => {
    const w = makeWorld();
    const victim = makePlayer(w, { skulled: 0 });
    give(victim, COINS, 10);
    Player.prototype.processDeath.call(victim);
    assert.equal(w.drops.length, 1);
    assert.equal(w.drops[0].owner, victim);
});

test('getPlayerKiller: highest damage wins, offline / self / zero-damage ignored', () => {
    const w = makeWorld();
    const v = makePlayer(w);
    const a = makePlayer(w);
    const b = makePlayer(w);
    v.playerDamage.set(a.id, 4);
    v.playerDamage.set(b.id, 9);
    v.playerDamage.set(v.id, 100); // self
    v.playerDamage.set(99999, 500); // offline
    assert.equal(Player.prototype.getPlayerKiller.call(v), b);
    v.playerDamage.set(b.id, 0);
    v.playerDamage.set(a.id, 0);
    assert.equal(Player.prototype.getPlayerKiller.call(v), null);
    v.world = null;
    assert.equal(Player.prototype.getPlayerKiller.call(v), null);
});

test('PvP death: a killer who logged out gets nothing and the victim keeps ownership of the drop', () => {
    const { w, victim, killer } = setupKill({ skulledVictim: true });
    w.byId.delete(killer.id);
    give(victim, BRONZE_SWORD);
    Player.prototype.processDeath.call(victim);
    assert.equal(w.drops.length, 1);
    assert.equal(w.drops[0].owner, victim);
    assert.deepEqual(killer.messages, []);
});

test('poison death caused by a player still credits that player (damage with attacker)', () => {
    const w = makeWorld();
    const v = makePlayer(w);
    const a = makePlayer(w);
    v.die = () => {};
    v.broadcastDamage = () => {};
    Player.prototype.damage.call(v, 3, a, 'ranged');
    assert.equal(v.playerDamage.get(a.id), 3);
    assert.equal(v.rangedDamage.get(a.id), 3);
    assert.equal(v.lastCombatTick, w.ticks);
    assert.equal(a.lastCombatTick, w.ticks);
});

test('Player.damage ignores a non-player attacker (NPC) for the kill credit and combat stamp', () => {
    const w = makeWorld();
    const v = makePlayer(w);
    v.die = () => {};
    v.broadcastDamage = () => {};
    Player.prototype.damage.call(v, 2, { id: 5, world: w });
    assert.equal(v.playerDamage.size, 0);
    assert.equal(v.lastCombatTick, undefined);
});

test('Player.getCombatExperience is combat*4+40 and NPCs still use the character formula', () => {
    const w = makeWorld();
    const p = makePlayer(w, { combatLevel: 30 });
    assert.equal(p.getCombatExperience(), 160);
    assert.equal(Character.prototype.getCombatExperience.call({ combatLevel: 30 }), 320);
});

// ---------------------------------------------------------------- rewardKill / NPC

test('rewardKill pays hits and style xp from the shared helper (controlled, aggressive, accurate, defensive)', () => {
    const w = makeWorld();
    const victor = makePlayer(w);
    const victim = { playerDamage: new Map([[victor.id, 10]]), rangedDamage: new Map(), magicDamage: new Map(), getCombatExperience: () => 400 };
    const styles = { 0: ['attack', 'defense', 'strength'], 1: ['strength'], 2: ['attack'], 3: ['defense'] };
    for (const [style, skills] of Object.entries(styles)) {
        victor.xp = {};
        victor.combatStyle = Number(style);
        Character.prototype.rewardKill.call(victim, victor);
        assert.equal(victor.xp.hits, 100);
        for (const s of skills) assert.equal(victor.xp[s], skills.length === 1 ? 300 : 100);
    }
});

test('rewardKill splits ranged damage into ranged xp and removes it from the melee share', () => {
    const w = makeWorld();
    const victor = makePlayer(w);
    const victim = {
        playerDamage: new Map([[victor.id, 10]]),
        rangedDamage: new Map([[victor.id, 10]]),
        magicDamage: new Map(),
        getCombatExperience: () => 400
    };
    Character.prototype.rewardKill.call(victim, victor);
    assert.equal(victor.xp.ranged, 400);
    assert.equal(victor.xp.hits, 0);
});

test('NPC.die still awards experience through rewardKill', () => {
    const w = makeWorld();
    const victor = makePlayer(w);
    victor.opponent = null;
    assert.equal(typeof NPC.prototype.rewardKill, 'function', 'NPC inherits rewardKill');
    const src = require('fs').readFileSync(require('path').join(__dirname, '../src/model/npc.js'), 'utf8');
    assert.match(src, /this\.rewardKill\(victor\)/);
    assert.doesNotMatch(src, /quarterExperience/);
});

// ---------------------------------------------------------------- playerAttack

function attackSetup() {
    const w = makeWorld();
    const attacker = makePlayer(w);
    const target = makePlayer(w);
    attacker.attackCalls = [];
    attacker.attack = async (o) => {
        attacker.attackCalls.push(o);
        return true;
    };
    attacker.shootCalls = [];
    attacker.shootRanged = async (o) => {
        attacker.shootCalls.push(o);
    };
    return { w, attacker, target };
}

test('playerAttack: already fighting gives the busy message', async () => {
    const { attacker, target } = attackSetup();
    attacker.opponent = {};
    await playerAttack({ player: attacker }, { index: target.index });
    assert.deepEqual(attacker.messages, ['You are already busy fighting!']);
    assert.equal(attacker.toAttack, undefined);
});

test('playerAttack: locked or ranged timeout silently ignored', async () => {
    const { attacker, target } = attackSetup();
    attacker.locked = true;
    await playerAttack({ player: attacker }, { index: target.index });
    attacker.locked = false;
    attacker.rangedTimeout = true;
    await playerAttack({ player: attacker }, { index: target.index });
    assert.deepEqual(attacker.messages, []);
    assert.equal(attacker.toAttack, undefined);
});

test('playerAttack: target === self is ignored; unknown index throws RangeError', async () => {
    const { attacker } = attackSetup();
    await playerAttack({ player: attacker }, { index: attacker.index });
    assert.equal(attacker.toAttack, undefined);
    assert.deepEqual(attacker.messages, []);
    await assert.rejects(() => playerAttack({ player: attacker }, { index: 9999 }), RangeError);
});

test('playerAttack: refusal message is sent and nothing is queued', async () => {
    const { attacker, target } = attackSetup();
    target.y = 600;
    await playerAttack({ player: attacker }, { index: target.index });
    assert.match(attacker.messages[0], /can't attack other players here/);
    assert.equal(attacker.toAttack, undefined);
    assert.equal(attacker.endWalkFunction, undefined);
});

test('playerAttack: silent re-attack refusal sends no message but still blocks', async () => {
    const { w, attacker, target } = attackSetup();
    target.ranAwayTick = w.ticks;
    await playerAttack({ player: attacker }, { index: target.index });
    assert.deepEqual(attacker.messages, []);
    assert.equal(attacker.endWalkFunction, undefined);
});

test('playerAttack: ranged path hands off to shootRanged and ignores the re-attack timer', async () => {
    const { w, attacker, target } = attackSetup();
    attacker.inventory.getRangedWeapon = () => ({ id: 188 });
    target.ranAwayTick = w.ticks;
    await playerAttack({ player: attacker }, { index: target.index });
    assert.deepEqual(attacker.shootCalls, [target]);
    assert.equal(attacker.endWalkFunction, undefined);
});

test('playerAttack: melee sets toAttack and an endWalkFunction that attacks', async () => {
    const { attacker, target } = attackSetup();
    await playerAttack({ player: attacker }, { index: target.index });
    assert.equal(attacker.toAttack, target);
    assert.equal(typeof attacker.endWalkFunction, 'function');
    await attacker.endWalkFunction();
    assert.deepEqual(attacker.attackCalls, [target]);
});

test('playerAttack endWalkFunction: re-validates (target left, busy, moved out of wilderness, attack failure)', async () => {
    let s = attackSetup();
    await playerAttack({ player: s.attacker }, { index: s.target.index });
    s.target.loggedIn = false;
    await s.attacker.endWalkFunction();
    assert.equal(s.attacker.toAttack, null);
    assert.equal(s.attacker.attackCalls.length, 0);

    s = attackSetup();
    await playerAttack({ player: s.attacker }, { index: s.target.index });
    s.w.byId.delete(s.target.id);
    await s.attacker.endWalkFunction();
    assert.equal(s.attacker.attackCalls.length, 0);

    s = attackSetup();
    await playerAttack({ player: s.attacker }, { index: s.target.index });
    s.target.opponent = {};
    await s.attacker.endWalkFunction();
    assert.deepEqual(s.attacker.messages, ["I can't get close enough"]);
    assert.equal(s.attacker.toAttack, null);

    s = attackSetup();
    await playerAttack({ player: s.attacker }, { index: s.target.index });
    s.target.y = 600;
    await s.attacker.endWalkFunction();
    assert.match(s.attacker.messages[0], /can't attack other players here/);
    assert.equal(s.attacker.attackCalls.length, 0);

    s = attackSetup();
    s.attacker.attack = async () => false;
    await playerAttack({ player: s.attacker }, { index: s.target.index });
    await s.attacker.endWalkFunction();
    assert.deepEqual(s.attacker.messages, ["I can't reach that!"]);
});

test('combat level bound is enforced in playerAttack melee', async () => {
    const { attacker, target } = attackSetup();
    attacker.y = 426; // level 1
    attacker.combatLevel = 3;
    target.y = 426;
    target.combatLevel = 50;
    await playerAttack({ player: attacker }, { index: target.index });
    assert.match(attacker.messages[0], /within 1 levels/);
    assert.equal(attacker.toAttack, undefined);
});

// ---------------------------------------------------------------- wiring

test('packet handler index exposes playerAttack from player.js and wilderness.js requires resolve', () => {
    const player = require('../src/packet-handlers/player.js');
    assert.equal(typeof player.playerAttack, 'function');
    assert.equal(typeof player.useWithPlayer, 'function');
    assert.equal(typeof require('../src/packet-handlers/logout.js').logout, 'function');
});
