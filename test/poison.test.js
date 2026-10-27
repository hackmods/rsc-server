// Poison: Character#tickPoison (Open-RSC PoisonEvent.java), poisonous NPC rounds, poisoned weapons and ammunition,
// the weapon poison plugin and the cure poison potions. Players are real Player objects with the networking stubbed.

const test = require('node:test');
const assert = require('node:assert/strict');

const Module = require('node:module');

const NPC = require('../src/model/npc');

// player.js loads the captcha, which needs the native canvas module; none of this needs a captcha
const realLoad = Module._load;
Module._load = function load(request, ...rest) {
    return request === '@2003scape/rsc-captcha' ? class {} : realLoad.call(this, request, ...rest);
};
const Player = require('../src/model/player');
Module._load = realLoad;

const poisonRules = require('../src/poison');
const potions = require('../src/plugins/items/potions');
const weaponPoison = require('../src/plugins/items/weapon-poison');
const pluginIndex = require('../src/plugins');
const items = require('@2003scape/rsc-data/config/items.json');

const POISON_SCORPION = 271;
const CHICKEN = 3;
const COINS = 10;
const WEAPON_POISON = 572;
const BRONZE_DAGGER = 62;
const POISONED_BRONZE_DAGGER = 560;
const BRONZE_ARROWS = 11;
const POISON_BRONZE_ARROWS = 574;
const BRONZE_DART = 1013;
const POISONED_BRONZE_DART = 1122;
const POISON_RUNE_ARROWS = 647;

const SKILLS = ['attack', 'defense', 'strength', 'hits', 'ranged', 'prayer'];

function makeWorld() {
    return {
        ticks: 0,
        members: true,
        players: { getByID: () => undefined },
        callPlugin: async () => false,
        addPlayerDrop() {},
        removeEntity() {},
        async sleepTicks() {}
    };
}

function makePlayer(world = makeWorld(), hits = 50) {
    const bag = [];
    const player = Object.create(Player.prototype);

    Object.assign(player, {
        world,
        messages: [],
        deaths: 0,
        hitsplats: [],
        questStages: {},
        cache: {},
        skills: Object.fromEntries(SKILLS.map((name) => [name, { current: 1, base: 1, experience: 0 }])),
        poisonPower: 0,
        poisonTicks: 0,
        poisonedBy: null,
        opponent: null,
        playerDamage: new Map(),
        rangedDamage: new Map(),
        prayers: [],
        combatStyle: 0,
        equipmentBonuses: { armour: 0, weaponAim: 0, weaponPower: 0 },
        bag,
        inventory: {
            items: bag,
            has: (id, amount = 1) => bag.filter((i) => i.id === id).reduce((n, i) => n + i.amount, 0) >= amount,
            add(id, amount = 1) {
                const stack = items[id].stackable && bag.find((i) => i.id === id);
                if (stack) stack.amount += amount;
                else bag.push({ id, amount, definition: items[id] });
            },
            remove(id, amount = 1) {
                const entry = bag.find((i) => i.id === id);
                if (!entry) return;
                entry.amount -= amount;
                if (entry.amount <= 0 || !items[id].stackable) bag.splice(bag.indexOf(entry), 1);
            }
        }
    });

    player.skills.hits.current = player.skills.hits.base = hits;
    player.message = (...m) => player.messages.push(...m);
    player.sendStats = () => {};
    player.broadcastDamage = (damage) => player.hitsplats.push(damage);
    player.die = function die() {
        this.deaths += 1;
        this.curePoison();
        this.skills.hits.current = this.skills.hits.base;
    };

    return player;
}

function give(player, id, amount = 1, equipped = false) {
    player.bag.push({ id, amount, equipped, definition: items[id] });
}

function makeNPC(world, id) {
    const npc = new NPC(world, { id, x: 0, y: 0, minX: 0, maxX: 0, minY: 0, maxY: 0 });
    npc.broadcastDamage = () => {};
    return npc;
}

// run the world forward n ticks
function run(character, world, n) {
    for (let i = 0; i < n; i += 1) {
        world.ticks += 1;
        character.tickPoison();
    }
}

// Math.random returns these in turn, then the real thing (the damage roll needs a Math.random that varies)
function withRandom(values, fn) {
    const real = Math.random;
    let i = 0;
    Math.random = () => (i < values.length ? values[i++] : real());
    try {
        return fn();
    } finally {
        Math.random = real;
    }
}

test('the weapon poison plugin is registered and exports only its hooks', () => {
    assert.equal(pluginIndex['items.weapon-poison'], weaponPoison);
    assert.deepEqual(Object.keys(weaponPoison).sort(), ['POISONED_VERSIONS', 'onUseWithInventory']);
});

test('poison hurts every 32 ticks for power / 10, losing 2 power per run, and ends silently below 10', () => {
    const world = makeWorld();
    const player = makePlayer(world);

    assert.equal(player.poisoned, false);
    assert.equal(player.poison(38), true);
    assert.equal(player.poisoned, true);

    run(player, world, 31);
    assert.deepEqual(player.hitsplats, []);
    run(player, world, 1);
    assert.deepEqual(player.hitsplats, [3]);
    assert.equal(player.messages[0], '@gr3@You @gr2@are @gr1@poisioned! @gr2@You @gr3@lose @gr2@3 @gr1@health.');

    run(player, world, 32 * 20);
    // 38, 36, 34, 32, 30 -> 3; 28..20 -> 2; 18..10 -> 1; then 8 is below 10
    assert.deepEqual(player.hitsplats, [3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1]);
    assert.equal(player.skills.hits.current, 50 - 30);
    assert.equal(player.poisoned, false);
    assert.equal(player.messages.length, 15);
});

test('power below 10 never starts a damage run', () => {
    const world = makeWorld();
    const player = makePlayer(world);
    player.poison(9);
    run(player, world, 64);
    assert.deepEqual(player.hitsplats, []);
    assert.equal(player.poisoned, false);
});

test('dying of poison takes the normal death path and clears the poison', () => {
    const world = makeWorld();
    const player = makePlayer(world, 2);
    player.poison(38);
    run(player, world, 32);
    assert.equal(player.deaths, 1);
    assert.equal(player.poisoned, false);
});

test('Player#die clears poison', () => {
    const world = makeWorld();
    const player = makePlayer(world);
    player.poison(38);
    player.inventory.removeMostValuable = () => [];
    player.inventory.sendAll = () => {};
    player.inventory.clear = () => player.inventory.items.splice(0);
    player.teleport = () => {};
    player.sendDeath = () => {};
    Player.prototype.die.call(player);
    assert.equal(player.poisoned, false);
});

test('cure clears poison; a new poison restarts the timer and power', () => {
    const world = makeWorld();
    const player = makePlayer(world);
    player.poison(38);
    run(player, world, 20);
    player.curePoison();
    assert.equal(player.poisoned, false);
    run(player, world, 100);
    assert.deepEqual(player.hitsplats, []);

    player.poison(38);
    run(player, world, 20);
    player.poison(68);
    run(player, world, 31);
    assert.deepEqual(player.hitsplats, []);
    run(player, world, 1);
    assert.deepEqual(player.hitsplats, [6]);
});

test('an NPC can be poisoned too, and the poisoner gets the kill', () => {
    const world = makeWorld();
    const poisoner = { id: 9 };
    const npc = makeNPC(world, CHICKEN);
    npc.skills.hits.current = 1;
    npc.poison(38, poisoner);
    run(npc, world, 32);
    assert.equal(npc.playerDamage.get(9), 3);
    assert.equal(npc.poisoned, false);
});

test('cure poison potion and antidote cure, then protect for 3 and 6 minutes', async () => {
    for (const [doseID, ticks] of [[566, 281], [569, 562]]) {
        const world = makeWorld();
        const player = makePlayer(world);
        give(player, doseID);
        player.sendBubble = () => {};
        player.poison(38);

        assert.equal(await potions.onInventoryCommand(player, { id: doseID, definition: items[doseID] }), true);
        assert.equal(player.poisoned, false);
        assert.equal(player.poison(38), false, 'protected');
        assert.equal(player.poisoned, false);

        world.ticks += ticks - 1;
        assert.equal(player.isPoisonProtected(), true);
        world.ticks += 1;
        assert.equal(player.isPoisonProtected(), false);
        assert.equal(player.poison(38), true);
    }
});

test('a cure potion does not shorten antidote protection', () => {
    const world = makeWorld();
    const player = makePlayer(world);
    player.setAntidoteProtection();
    player.setCurePoisonProtection();
    world.ticks = 400;
    assert.equal(player.isPoisonProtected(), true);
});

test('poisonous NPCs poison on 1 round in 10 with their own power', () => {
    const world = makeWorld();

    for (const [id, power] of poisonRules.NPC_POISON_POWER) {
        const npc = makeNPC(world, id);
        assert.match(npc.definition.name, /poison|dungeon spider|tribesman|jungle savage/i);

        const player = makePlayer(world);
        withRandom([0.89], () => poisonRules.npcRound(npc, player));
        assert.equal(player.poisoned, false, 'miss');
        withRandom([0.9], () => poisonRules.npcRound(npc, player));
        assert.equal(player.poisonPower, power);
    }
});

test('NPC#fight poisons its player opponent; ordinary NPCs and protected players do not', () => {
    const world = makeWorld();
    const scorpion = makeNPC(world, POISON_SCORPION);
    const chicken = makeNPC(world, CHICKEN);
    const player = makePlayer(world);

    for (const npc of [scorpion, chicken]) {
        npc.opponent = player;
        npc.fightStage = 0;
        npc.combatRounds = 0;
    }

    withRandom([0.95], () => chicken.fight());
    assert.equal(player.poisoned, false);

    withRandom([0.95], () => scorpion.fight());
    assert.equal(player.poisonPower, 38);

    player.curePoison();
    player.setAntidoteProtection();
    scorpion.fightStage = 0;
    withRandom([0.95], () => scorpion.fight());
    assert.equal(player.poisoned, false);
});

test('a wielded poisoned weapon poisons a player 1 round in 4 for 48', () => {
    const world = makeWorld();
    const attacker = makePlayer(world);
    const victim = makePlayer(world);

    give(attacker, POISONED_BRONZE_DAGGER, 1, true);
    withRandom([0.3], () => poisonRules.playerRound(attacker, victim));
    assert.equal(victim.poisoned, false);
    withRandom([0.1], () => poisonRules.playerRound(attacker, victim));
    assert.equal(victim.poisonPower, 48);

    const plain = makePlayer(world);
    give(plain, BRONZE_DAGGER, 1, true);
    const other = makePlayer(world);
    withRandom([0.1], () => poisonRules.playerRound(plain, other));
    assert.equal(other.poisoned, false);

    // carried but not wielded
    const carrying = makePlayer(world);
    give(carrying, POISONED_BRONZE_DAGGER);
    withRandom([0.1], () => poisonRules.playerRound(carrying, other));
    assert.equal(other.poisoned, false);
});

test('a wielded poisoned dagger poisons an NPC 1 round in 50 for 60 and says so', () => {
    const world = makeWorld();
    const player = makePlayer(world);
    give(player, POISONED_BRONZE_DAGGER, 1, true);
    const npc = makeNPC(world, CHICKEN);

    withRandom([0.03], () => poisonRules.playerRound(player, npc));
    assert.equal(npc.poisoned, false);
    withRandom([0.01], () => poisonRules.playerRound(player, npc));
    assert.equal(npc.poisonPower, 60);
    assert.equal(npc.poisonedBy, player);
    assert.deepEqual(player.messages, ['@gr3@You @gr2@have @gr1@poisioned @gr2@the Chicken!']);

    // already strongly poisoned: no restart
    npc.poisonPower = 40;
    withRandom([0.01], () => poisonRules.playerRound(player, npc));
    assert.equal(npc.poisonPower, 40);
});

test('poisoned ammunition poisons players 1 in 8 for 20 and NPCs 1 in 50 for 60; plain ammunition never does', () => {
    const world = makeWorld();
    const player = makePlayer(world);
    const victim = makePlayer(world);
    const npc = makeNPC(world, CHICKEN);

    withRandom([0.2], () => poisonRules.rangedHit(player, victim, POISON_BRONZE_ARROWS));
    assert.equal(victim.poisoned, false);
    withRandom([0.1], () => poisonRules.rangedHit(player, victim, POISON_BRONZE_ARROWS));
    assert.equal(victim.poisonPower, 20);

    withRandom([0.01], () => poisonRules.rangedHit(player, npc, POISON_RUNE_ARROWS));
    assert.equal(npc.poisonPower, 60);

    const clean = makeNPC(world, CHICKEN);
    assert.equal(withRandom([0], () => poisonRules.rangedHit(player, clean, BRONZE_ARROWS)), false);
    assert.equal(clean.poisoned, false);
});

test('weapon poison turns a dagger into its poisoned version, either way round', async () => {
    assert.match(items[WEAPON_POISON].name, /weapon poison/i);
    assert.equal(items[BRONZE_DAGGER].name.toLowerCase(), 'bronze dagger');

    for (const swap of [false, true]) {
        const player = makePlayer();
        give(player, WEAPON_POISON);
        give(player, BRONZE_DAGGER);
        const poison = { id: WEAPON_POISON };
        const dagger = { id: BRONZE_DAGGER };
        const [a, b] = swap ? [dagger, poison] : [poison, dagger];

        assert.equal(await weaponPoison.onUseWithInventory(player, a, b), true);
        assert.deepEqual(player.bag.map((i) => i.id), [POISONED_BRONZE_DAGGER]);
        assert.deepEqual(player.messages, ['You poison a bronze dagger.']);
    }
});

test('weapon poison does 6 darts or 5 arrows at a time, or all you hold', async () => {
    const darts = makePlayer();
    give(darts, WEAPON_POISON);
    give(darts, BRONZE_DART, 10);
    await weaponPoison.onUseWithInventory(darts, { id: WEAPON_POISON }, { id: BRONZE_DART });
    assert.deepEqual(darts.bag.map((i) => [i.id, i.amount]).sort(), [[BRONZE_DART, 4], [POISONED_BRONZE_DART, 6]]);
    assert.deepEqual(darts.messages, ['You poison some darts!']);

    const arrows = makePlayer();
    give(arrows, WEAPON_POISON);
    give(arrows, BRONZE_ARROWS, 3);
    await weaponPoison.onUseWithInventory(arrows, { id: BRONZE_ARROWS }, { id: WEAPON_POISON });
    assert.deepEqual(arrows.bag.map((i) => [i.id, i.amount]), [[POISON_BRONZE_ARROWS, 3]]);
    assert.deepEqual(arrows.messages, ['You poison some arrows!']);
});

test('weapon poison on something with no poisoned version does nothing', async () => {
    const player = makePlayer();
    give(player, WEAPON_POISON);
    give(player, COINS);
    assert.equal(await weaponPoison.onUseWithInventory(player, { id: WEAPON_POISON }, { id: COINS }), true);
    assert.deepEqual(player.bag.map((i) => i.id), [WEAPON_POISON, COINS]);
    assert.deepEqual(player.messages, ['Nothing interesting happens']);
});

test('non-poison item combinations are left alone', async () => {
    const player = makePlayer();
    assert.equal(await weaponPoison.onUseWithInventory(player, { id: COINS }, { id: BRONZE_DAGGER }), false);
    assert.deepEqual(player.messages, []);
});

test('a character that is not poisoned takes no damage from ticking', () => {
    const world = makeWorld();
    const player = makePlayer(world);
    run(player, world, 200);
    assert.deepEqual(player.hitsplats, []);
    assert.equal(player.skills.hits.current, 50);
});
