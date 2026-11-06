// Tourist Trap (quests/members/tourist-trap/*, ports of TouristTrap.java and Tourist_Trap_Mechanism.java): every stage of
// the quest driven with fake players, objects and npcs, plus the Shantay line, the dart tips gate in the anvil menu and the
// refusals. Scripted menus follow the Java; Math.random is pinned where a roll decides the path.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const dialogue = require('../src/plugins/quests/members/tourist-trap/dialogue');
const touristTrap = require('../src/plugins/quests/members/tourist-trap/tourist-trap');
const mechanism = require('../src/plugins/quests/members/tourist-trap/mechanism');
const shantay = require('../src/plugins/npcs/al-kharid/shantay');
const levelDoors = require('../src/plugins/wall-objects/level-doors');
const forging = require('../src/plugins/skills/smithing/forging');
const { fakeNpc, fakeWorld, fakePlayer, gameObject, wallObject } = require('./quest-fakes-3b');

const IRENA = 538;
const ANA = 554;
const MERCENARY = 668;
const CAPTAIN = 669;
const MERC_INSIDE = 670;
const SLAVE = 671;
const LIFT_GUARD = 690;
const JAIL_GUARD = 692;
const AL_SHABIM = 700;
const NOMAD = 701;
const SIAD = 702;
const NOMAD_GUARD = 703;
const ESCAPING_SLAVE = 737;

const COINS = 10;
const BRONZE_BAR = 169;
const HAMMER = 168;
const FEATHER = 381;
const DESERT_BOOTS = 990;
const DESERT_ROBE = 1019;
const DESERT_SHIRT = 1020;
const METAL_KEY = 1021;
const SLAVE_BOTTOM = 1022;
const SLAVE_TOP = 1023;
const MINING_BARREL = 1038;
const ANA_BARREL = 1039;
const TENTI_PINEAPPLE = 1058;
const COPY_KEY = 1059;
const PLANS = 1060;
const PROTO_TIP = 1071;
const PROTO_DART = 1014;
const BRONZE_DART = 1013;
const WROUGHT_KEY = 1097;
const CELL_KEY = 1098;
const ROCKS = 986;

const PLUGIN_TYPES = [
    .../const PLUGIN_TYPES = \[([\s\S]*?)\]/
        .exec(fs.readFileSync(require.resolve('../src/model/world.js'), 'utf8'))[1]
        .matchAll(/'(\w+)'/g)
].map((m) => m[1]);

function npc(id, opts) {
    const n = fakeNpc(id, opts);

    n.opponent = null;
    n.index = 500 + id;

    return n;
}

function player(opts = {}) {
    const p = fakePlayer({ quest: 'touristTrap', ...opts });

    p.sent = [];
    p.send = (message) => p.sent.push(message);
    p.addExperience = (skill, amount) => p.experience.push([skill, amount]);
    p.unequipped = [];
    p.inventory.unequip = (index) => p.unequipped.push(index);
    p.opponent = null;

    return p;
}

function count(p, id) {
    return p.inventory.count(id);
}

// pin Math.random for the duration of `fn`
async function withRandom(value, fn) {
    const real = Math.random;

    Math.random = typeof value === 'function' ? value : () => value;

    try {
        return await fn();
    } finally {
        Math.random = real;
    }
}

// the Desert Clothes of the exchange with the slave
const CLOTHES = [DESERT_SHIRT, DESERT_ROBE, DESERT_BOOTS];
// in the mine, wearing the slaves' robes
const SLAVE_OUTFIT = { items: [SLAVE_BOTTOM, SLAVE_TOP], equipped: [SLAVE_BOTTOM, SLAVE_TOP], x: 60, y: 3610 };

test('every exported hook is a plugin type', () => {
    for (const plugin of [touristTrap, mechanism]) {
        for (const name of Object.keys(plugin)) {
            if (name.startsWith('on')) {
                assert.ok(PLUGIN_TYPES.includes(name), name);
            }
        }
    }
});

test('stage 0: Irena asks for Ana; agreeing starts the quest (1), refusing does not', async () => {
    const irena = npc(IRENA);
    const yes = player({ answers: [0, 2, 0] });
    assert.equal(await touristTrap.onTalkToNPC(yes, irena), true);
    assert.equal(yes.questStages.touristTrap, 1);
    assert.ok(irena.said.includes('She was wearing a red silk scarf when she left.'));
    assert.equal(yes.interlocutor, null);

    // "Cheer up", "When did she go...", "I'll look for your daughter", then "Oh, Ok, ..."
    const long = player({ answers: [1, 0, 2, 0] });
    await touristTrap.onTalkToNPC(long, npc(IRENA));
    assert.equal(long.questStages.touristTrap, 1);

    const busy = player({ answers: [0, 2, 1] });
    const i = npc(IRENA);
    await touristTrap.onTalkToNPC(busy, i);
    assert.equal(busy.questStages.touristTrap, 0);
    assert.ok(i.said.includes("Oh really, can't I persuade you in anyway?"));

    // the gender-neutral line of the language file
    assert.ok(i.said.includes("Well, yes, you'll have my gratitude young one."));
});

test('Shantay points at Irena before the quest, not after, and the disclaimer line', async () => {
    const s = npc(549);
    const p = player({ stage: 0, answers: [2] });
    p.inventory.has = () => false;
    p.world.addPlayerDrop = () => {};
    await shantay.onTalkToNPC(p, s);
    assert.ok(s.said.includes("I see you're new!"));
    assert.ok(s.said.includes('Her name is Irena and she mourns her lost Daughter. Such a shame.'));

    const later = player({ stage: 1, answers: [2], items: [1099] });
    later.world.addPlayerDrop = () => {};
    const s2 = npc(549);
    await shantay.onTalkToNPC(later, s2);
    assert.ok(!s2.said.includes("I see you're new!"));
    assert.ok(!s2.said.some((line) => /Irena/.test(line)));
});

test('Stone Gate from the desert side is the quest\'s; from the Al Kharid side it is level-doors', async () => {
    const gate = gameObject(916, 62, 733);
    const outside = player({ stage: 1, y: 730 });
    assert.equal(await touristTrap.onGameObjectCommandOne(outside, gate), false);

    const inside = player({ stage: 1, y: 740 });
    assert.equal(await levelDoors.onGameObjectCommandOne(inside, gate), false);
    assert.equal(await levelDoors.onGameObjectCommandTwo(inside, gate), false);
    assert.equal(await touristTrap.onGameObjectCommandOne(inside, gate), true);
    assert.deepEqual(inside.teleports, [[62, 732]]);
    assert.ok(inside.messages.includes('you go through the gate'));

    // look reads the poster
    const look = player({ stage: 1, y: 740 });
    assert.equal(await touristTrap.onGameObjectCommandTwo(look, gate), true);
    assert.ok(look.messages.some((m) => /VERY Dangerous/.test(m)));

    // a barrel outside stage 9 is lost
    const wrong = player({ stage: 3, y: 740, items: [ANA_BARREL] });
    await touristTrap.onGameObjectCommandOne(wrong, gate);
    assert.equal(count(wrong, ANA_BARREL), 0);
});

test('the mercenary captain: watched, killed for the key (first_kill_captn), the bet and the 20 gold', async () => {
    const watch = player({ stage: 1 });
    assert.equal(await touristTrap.onNPCCommand(watch, npc(CAPTAIN)), true);
    assert.ok(watch.messages.some((m) => /large metal key/.test(m)));
    assert.equal(await touristTrap.onNPCCommand(watch, npc(MERCENARY)), false);

    const killer = player({ stage: 1 });
    assert.equal(await touristTrap.onNPCDeath(killer, npc(CAPTAIN)), false);
    assert.equal(count(killer, METAL_KEY), 1);
    assert.equal(killer.cache.first_kill_captn, true);

    // a second kill does not give a second key
    await touristTrap.onNPCDeath(killer, npc(CAPTAIN));
    assert.equal(count(killer, METAL_KEY), 1);

    // after the kill the mercenary asks 20 gold: paid, the flag drops
    const payer = player({ stage: 1, cache: { first_kill_captn: true }, items: [[COINS, 20]], answers: [0] });
    const merc = npc(MERCENARY);
    await touristTrap.onTalkToNPC(payer, merc);
    assert.equal(count(payer, COINS), 0);
    assert.equal(payer.cache.first_kill_captn, false);
    assert.ok(merc.said.includes('Good! Seeya, we have some cleaning to do.'));

    // the bet: "Does the Captain order you to kill..." is deep; 5 gold bet wins 1 coin back
    const winner = player({ stage: 1, cache: { first_kill_captn: true, mercenary_bet: 5 } });
    await touristTrap.onTalkToNPC(winner, npc(MERCENARY));
    assert.equal(count(winner, COINS), 1);
    assert.equal(winner.cache.first_kill_captn, false);

    // no gold, no mercy: sent into the desert
    await withRandom(0, async () => {
        const broke = player({ stage: 1, cache: { first_kill_captn: true }, answers: [0] });
        await touristTrap.onTalkToNPC(broke, npc(MERCENARY));
        const [x, y] = broke.teleports.at(-1);
        assert.ok([[121, 743], [135, 775], [121, 803], [102, 775], [93, 765]].some(([a, b]) => a === x && b === y));
    });
});

test('guards cannot be attacked during the quest: a menu, then the desert, a cell, or nothing', async () => {
    // the captain without his key is protected; with his key (the player has it) he can be fought
    const guarded = player({ stage: 2, answers: [1] });
    assert.equal(await touristTrap.onNPCAttack(guarded, npc(CAPTAIN)), true);
    assert.ok(guarded.messages.includes('You decide not to attack the guard.'));
    const armed = player({ stage: 2, items: [METAL_KEY] });
    assert.equal(await touristTrap.onNPCAttack(armed, npc(CAPTAIN)), false);

    // done: not protected
    assert.equal(await touristTrap.onNPCAttack(player({ stage: -1 }), npc(MERCENARY)), false);

    // yes: "Guards! Guards!" and the desert (a captain asks the nearest mercenary to fight)
    await withRandom(0, async () => {
        const helper = npc(MERCENARY);
        const p = player({ stage: 2, answers: [0], world: fakeWorld({ npcs: [helper] }), items: [[COINS, 1]] });
        const c = npc(CAPTAIN);
        assert.equal(await touristTrap.onNPCAttack(p, c), true);
        assert.deepEqual(p.teleports.at(-1), [121, 743]);
        assert.deepEqual(helper.attacked, [p]);
    });

    // the inside guards send the player to the cell at 89,801 (the gates' guard)
    const gates = player({ stage: 5, answers: [0] });
    await touristTrap.onNPCAttack(gates, npc(MERC_INSIDE));
    assert.deepEqual(gates.teleports, [[89, 801]]);

    // the lift and jail guards: the cell under the mine, and Ana in her barrel is taken away
    const lift = player({ stage: 9, answers: [0], items: [ANA_BARREL] });
    await touristTrap.onNPCAttack(lift, npc(LIFT_GUARD));
    assert.deepEqual(lift.teleports, [[74, 3626]]);
    assert.equal(count(lift, ANA_BARREL), 0);

    // spells and arrows meet the same menu; a spell at the guard already fighting is fine
    const spell = player({ stage: 3, answers: [1] });
    assert.equal(await touristTrap.onCastOnNPC(spell, npc(JAIL_GUARD)), true);
    const fighter = player({ stage: 3 });
    const g = npc(JAIL_GUARD);
    fighter.opponent = g;
    assert.equal(await touristTrap.onCastOnNPC(fighter, g), false);
    const shot = player({ stage: 3, answers: [1] });
    assert.equal(await touristTrap.onNPCRangedAttack(shot, npc(MERC_INSIDE)), true);

    // Captain Siad: yes sends the player to a cell, hurt
    const siad = player({ stage: 3, answers: [0] });
    const s = npc(SIAD);
    await touristTrap.onNPCAttack(siad, s);
    assert.deepEqual(siad.teleports, [[89, 801]]);
    assert.deepEqual(siad.damaged, [7]);
    assert.deepEqual(s.attacked, [siad]);
});

test('stage 1 -> 2: the slave and the lock; the Desert Clothes -> the rags (4); without them (3)', async () => {
    await withRandom(0.9, async () => {
        const slave = npc(SLAVE);
        const world = fakeWorld({ npcs: [slave] });
        const p = player({ stage: 1, world, items: CLOTHES, answers: [0, 1, 0, 0, 0, 0] });
        await touristTrap.onTalkToNPC(p, slave);

        // the lock picked, the clothes swapped, and the slave runs off (a changed npc that returns later)
        assert.equal(p.questStages.touristTrap, 4);
        assert.equal(count(p, SLAVE_BOTTOM), 1);
        assert.equal(count(p, SLAVE_TOP), 1);
        assert.equal(count(p, DESERT_SHIRT), 0);
        assert.equal(count(p, DESERT_ROBE), 0);
        assert.equal(count(p, DESERT_BOOTS), 0);
        assert.deepEqual(world.replaced.at(0), [SLAVE, ESCAPING_SLAVE]);
        assert.equal(world.timeouts.at(-1).ticks, 50);
        assert.equal(p.cache.first_kill_captn, undefined);

        // without the clothes the slave waits (2 -> 3)
        const none = player({ stage: 1, world: fakeWorld({ npcs: [npc(SLAVE)] }), answers: [0, 1, 0, 0, 0, 0] });
        await touristTrap.onTalkToNPC(none, none.world.npcList[0]);
        assert.equal(none.questStages.touristTrap, 3);
        assert.equal(count(none, SLAVE_TOP), 0);
    });

    // a failed first try, a failed second: a nearby guard locks the player up
    await withRandom(0, async () => {
        const slave = npc(SLAVE);
        const guard = npc(MERCENARY);
        const p = player({ stage: 2, world: fakeWorld({ npcs: [slave, guard] }), answers: [0, 0] });
        await touristTrap.onTalkToNPC(p, slave);
        assert.deepEqual(p.teleports, [[89, 801]]);
        assert.equal(p.questStages.touristTrap, 2);
    });

    // stage 3: "Do you have the Desert Clothes yet?"
    const later = player({ stage: 3, items: CLOTHES });
    const s = npc(SLAVE);
    later.world.npcList.push(s);
    await touristTrap.onTalkToNPC(later, s);
    assert.equal(later.questStages.touristTrap, 4);
});

test('a player without the slaves\' robes is caught by the slave\'s guard; in robes he is left alone', async () => {
    const slave = npc(SLAVE);
    const guard = npc(MERCENARY);
    const caught = player({ stage: 4, world: fakeWorld({ npcs: [slave, guard] }), x: 60, y: 3610, items: [CELL_KEY] });
    await touristTrap.onTalkToNPC(caught, slave);
    // stage 4: below stage 9 the cell is on the surface
    assert.deepEqual(caught.teleports, [[89, 801]]);
    assert.equal(count(caught, CELL_KEY), 0);

    const robed = player({ stage: 4, x: 60, y: 3610, ...SLAVE_OUTFIT });
    const s = npc(SLAVE);
    await touristTrap.onTalkToNPC(robed, s);
    assert.deepEqual(s.said, ["Can't you see I'm busy?"]);
    assert.deepEqual(robed.teleports, []);

    // later at the surface: the slave asks for a trade
    const surface = player({ stage: 6, answers: [1] });
    const t = npc(SLAVE);
    await touristTrap.onTalkToNPC(surface, t);
    assert.ok(t.said.includes('Ok, fair enough, let me know if you change your mind though.'));
});

test('taking the slaves\' robes off in the mine brings a guard; outside the cave or after the quest, not', async () => {
    const top = { id: SLAVE_TOP, equipped: true };
    const robed = player({ stage: 4, ...SLAVE_OUTFIT });
    robed.inventory.items = [top];
    assert.equal(await mechanism.onRemoveItem(robed, top), true);
    assert.deepEqual(robed.unequipped, [0]);
    const spawned = robed.world.spawned.at(-1);
    assert.equal(spawned.id, MERCENARY);
    assert.deepEqual(robed.world.npcList.find((n) => n.id === MERCENARY).attacked, [robed]);

    // a guard in view is brought over instead
    const near = npc(MERCENARY, { x: 70, y: 3610 });
    const p = player({ stage: 4, world: fakeWorld({ npcs: [near] }), ...SLAVE_OUTFIT });
    const bottom = { id: SLAVE_BOTTOM, equipped: true };
    p.inventory.items = [bottom];
    await mechanism.onRemoveItem(p, bottom);
    assert.deepEqual([near.x, near.y], [60, 3610]);
    assert.deepEqual(near.attacked, [p]);

    // outside the cave or finished: the default unequip carries on
    const outside = player({ stage: 4, x: 100, y: 800 });
    assert.equal(await mechanism.onRemoveItem(outside, top), false);
    const done = player({ stage: -1, x: 60, y: 3610 });
    assert.equal(await mechanism.onRemoveItem(done, top), false);
    assert.equal(await mechanism.onRemoveItem(robed, { id: 1 }), false);
});

test('the iron gate: locked without the key; a robed unarmed player is thrown out; an armed one jailed; clean -> in', async () => {
    const gate = gameObject(932, 92, 807);

    const locked = player({ stage: 4, x: 95, y: 807 });
    await touristTrap.onGameObjectCommandOne(locked, gate);
    assert.ok(locked.messages.includes("This gate is locked, you'll need a key to open it."));

    // Ana in a barrel cannot be taken out: the guards find her
    const barrel = player({ stage: 9, x: 91, y: 807, items: [ANA_BARREL, METAL_KEY] });
    await touristTrap.onGameObjectCommandOne(barrel, gate);
    assert.equal(count(barrel, ANA_BARREL), 0);
    assert.deepEqual(barrel.teleports.at(-1), [75, 3626]);

    // slaves' robes, no weapon: a guard notices; east of 91 the desert, west a cell
    const guard = npc(MERCENARY);
    const robed = player({
        stage: 4,
        world: fakeWorld({ npcs: [guard] }),
        x: 95,
        y: 807,
        items: [METAL_KEY, SLAVE_BOTTOM, SLAVE_TOP],
        equipped: [SLAVE_BOTTOM, SLAVE_TOP]
    });
    await withRandom(0, async () => {
        await touristTrap.onGameObjectCommandOne(robed, gate);
        assert.deepEqual(robed.teleports.at(-1), [121, 743]);
        assert.deepEqual(guard.attacked, [robed]);
    });

    // no robes: the gate opens (the key is used), the gate guard inside wants an explanation only when armed
    const clean = player({ stage: 4, world: fakeWorld({ npcs: [npc(MERC_INSIDE)] }), x: 95, y: 807, items: [METAL_KEY] });
    await touristTrap.onGameObjectCommandOne(clean, gate);
    assert.deepEqual(clean.gates.at(-1), [932, undefined]);
    assert.deepEqual(clean.teleports, []);

    // finished: no guard fuss at all
    const done = player({ stage: -1, world: fakeWorld({ npcs: [npc(MERC_INSIDE)] }), x: 95, y: 807, items: [METAL_KEY] });
    await touristTrap.onGameObjectCommandOne(done, gate);
    assert.equal(done.gates.length, 1);

    // the second command searches the gate
    const search = player({ stage: 4 });
    await touristTrap.onGameObjectCommandTwo(search, gate);
    assert.ok(search.messages.some((m) => /lots of slaves mining away/.test(m)));
});

test('an armed player is sent to a cell by the gate guard after slipping through', async () => {
    const weapon = { id: 1, equipped: true, definition: { name: 'Iron Mace', equip: ['right-hand'] } };
    assert.equal(touristTrap.playerArmed({ inventory: { items: [weapon] } }), 'weapon');
    const shield = { id: 2, equipped: true, definition: { name: 'Wooden Shield', equip: ['left-hand'] } };
    assert.equal(touristTrap.playerArmed({ inventory: { items: [shield] } }), 'armour');
    assert.equal(touristTrap.playerArmed({ inventory: { items: [weapon, shield] } }), 'both');
    const robe = { id: SLAVE_TOP, equipped: true, definition: { name: 'Slaves Robe Top', equip: ['body'] } };
    const legs = { id: 3, equipped: true, definition: { name: 'Plate Mail Legs', equip: ['feet', 'legs'] } };
    assert.equal(touristTrap.playerArmed({ inventory: { items: [robe, legs] } }), 'none');
    const loose = { id: 4, equipped: false, definition: { name: 'Iron Mace', equip: ['right-hand'] } };
    assert.equal(touristTrap.playerArmed({ inventory: { items: [loose] } }), 'none');

    const gate = gameObject(932, 92, 807);
    const inner = npc(MERC_INSIDE);
    const p = player({ stage: 4, world: fakeWorld({ npcs: [inner] }), x: 95, y: 807, items: [METAL_KEY] });
    p.inventory.items = [weapon];
    await touristTrap.onGameObjectCommandOne(p, gate);
    assert.ok(inner.said.includes('Oi You with the weapon, what are you doing?'));
    assert.deepEqual(p.teleports.at(-1), [89, 801]);
});

test('the wooden doors: robes open the way down (stage 4) and out; without robes a guard jails the player', async () => {
    const doors = gameObject(958, 81, 801);

    const robed = player({ stage: 4, x: 82, y: 802, ...SLAVE_OUTFIT });
    await touristTrap.onGameObjectCommandOne(robed, doors);
    assert.deepEqual(robed.teleports, [[82, 3630]]);

    const up = player({ stage: 4, ...SLAVE_OUTFIT });
    await touristTrap.onGameObjectCommandOne(up, gameObject(958, 81, 3633));
    assert.deepEqual(up.teleports, [[82, 802]]);

    // no robes: the draft mercenary appears, fights, and the cell
    const bare = player({ stage: 4, x: 82, y: 802 });
    await touristTrap.onGameObjectCommandOne(bare, doors);
    assert.equal(bare.world.spawned.at(-1).id, 710);
    assert.deepEqual(bare.teleports.at(-1), [89, 801]);
    // he leaves after a while
    assert.equal(bare.world.timeouts.at(-1).ticks, 50);

    // after the quest: "No other guards come to the rescue."
    const done = player({ stage: -1, x: 82, y: 802 });
    await touristTrap.onGameObjectCommandOne(done, doors);
    assert.ok(done.messages.includes('No other guards come to the rescue.'));
    assert.deepEqual(done.teleports, []);

    // watch
    const watch = player({ stage: 4 });
    await touristTrap.onGameObjectCommandTwo(watch, doors);
    assert.ok(watch.messages.some((m) => /only slaves seem to go down there/.test(m)));
});

test('the guard in the mine wants Tenti pineapples: 4 -> 5; the pineapple at stage 8 -> 9', async () => {
    const guard = npc(MERC_INSIDE);
    const p = player({ stage: 4, answers: [1, 1, 0], ...SLAVE_OUTFIT });
    await touristTrap.onTalkToNPC(p, guard);
    assert.equal(p.questStages.touristTrap, 5);

    // no robes in the mine: the cell
    const bare = player({ stage: 4, x: 60, y: 3610 });
    await touristTrap.onTalkToNPC(bare, npc(MERC_INSIDE));
    assert.deepEqual(bare.teleports, [[89, 801]]);

    // the pineapple
    const eater = player({ stage: 8, items: [TENTI_PINEAPPLE] });
    const g = npc(MERC_INSIDE);
    assert.equal(await mechanism.onUseWithNPC(eater, g, { id: TENTI_PINEAPPLE }), true);
    assert.equal(eater.questStages.touristTrap, 9);
    assert.equal(count(eater, TENTI_PINEAPPLE), 0);

    // an ordinary pineapple is spat out
    const plain = player({ stage: 8, items: [748] });
    const g2 = npc(MERC_INSIDE);
    await mechanism.onUseWithNPC(plain, g2, { id: 748 });
    assert.equal(plain.questStages.touristTrap, 8);
    assert.ok(g2.said.includes('Yeuch!'));

    // from stage 9 he is grateful and the cave opens
    const cave = gameObject(963, 82, 3639);
    const open = player({ stage: 9, world: fakeWorld({ npcs: [npc(MERC_INSIDE)] }), ...SLAVE_OUTFIT });
    await mechanism.onGameObjectCommandOne(open, cave);
    assert.deepEqual(open.teleports, [[76, 3640]]);

    const shut = player({ stage: 8, world: fakeWorld({ npcs: [npc(MERC_INSIDE)] }), ...SLAVE_OUTFIT });
    await mechanism.onGameObjectCommandOne(shut, cave);
    assert.deepEqual(shut.teleports, []);
    assert.ok(shut.messages.includes('Two guards block your way further into the caves'));

    // without robes the guards take him away
    const bare2 = player({ stage: 9, world: fakeWorld({ npcs: [npc(MERC_INSIDE)] }), x: 80, y: 3639 });
    await mechanism.onGameObjectCommandOne(bare2, cave);
    assert.deepEqual(bare2.teleports, [[89, 801]]);
});

test('Al Shabim: the copy key (5 -> 6); the plans and the materials (6 -> 7); the dart (7 -> 8) with the six darts', async () => {
    const shabim = npc(AL_SHABIM);
    const p = player({ stage: 5, answers: [0, 0] });
    await touristTrap.onTalkToNPC(p, shabim);
    assert.equal(p.questStages.touristTrap, 6);
    assert.equal(count(p, COPY_KEY), 1);

    // plans + bronze bar + feathers: "I'm kind of curious" -> 7
    const planned = player({ stage: 6, items: [PLANS, BRONZE_BAR, [FEATHER, 10]], answers: [0, 0] });
    await touristTrap.onTalkToNPC(planned, npc(AL_SHABIM));
    assert.equal(planned.questStages.touristTrap, 7);

    // plans but nothing to make it with: the shopping list, no stage
    const empty = player({ stage: 6, items: [PLANS], answers: [0] });
    const s = npc(AL_SHABIM);
    await touristTrap.onTalkToNPC(empty, s);
    assert.equal(empty.questStages.touristTrap, 6);
    assert.ok(s.said.includes('A bar of pure bronze and 10 feathers.'));

    // the plans used on him
    const used = player({ stage: 6, items: [PLANS, BRONZE_BAR, [FEATHER, 10]], answers: [0, 0] });
    await mechanism.onUseWithNPC(used, npc(AL_SHABIM), { id: PLANS });
    assert.equal(used.questStages.touristTrap, 7);

    // the finished dart: stage 8, pineapple, darts, the key and the plans taken
    const dart = player({ stage: 7, items: [PROTO_DART, PLANS, COPY_KEY] });
    const sh = npc(AL_SHABIM);
    assert.equal(await touristTrap.onUseWithNPC(dart, sh, { id: PROTO_DART }), true);
    assert.equal(dart.questStages.touristTrap, 8);
    assert.equal(count(dart, PROTO_DART), 0);
    assert.equal(count(dart, PLANS), 0);
    assert.equal(count(dart, COPY_KEY), 0);
    assert.equal(count(dart, TENTI_PINEAPPLE), 1);
    assert.equal(count(dart, BRONZE_DART), 6);

    // later the dart is confiscated and a lost pineapple is replaced
    const later = player({ stage: 9, items: [PROTO_DART] });
    await touristTrap.onUseWithNPC(later, npc(AL_SHABIM), { id: PROTO_DART });
    assert.equal(count(later, PROTO_DART), 0);
    const pineapple = player({ stage: 8, answers: [0] });
    await touristTrap.onTalkToNPC(pineapple, npc(AL_SHABIM));
    assert.equal(count(pineapple, TENTI_PINEAPPLE), 1);
});

test('the tent guard and the plans: in at 6-7, kept out before, the plans taken after', async () => {
    const guard = npc(NOMAD_GUARD);
    const inside = player({ stage: 6 });
    await mechanism.onUseWithNPC(inside, guard, { id: PLANS });
    assert.deepEqual(inside.teleports, [[171, 792]]);

    const early = player({ stage: 5 });
    await mechanism.onUseWithNPC(early, npc(NOMAD_GUARD), { id: PLANS });
    assert.deepEqual(early.teleports, []);

    const talk = player({ stage: 3 });
    const g = npc(NOMAD_GUARD);
    await touristTrap.onTalkToNPC(talk, g);
    assert.deepEqual(g.said, ['Sorry, this is a private tent, no one is allowed in.', 'Orders of Al Shabim...']);

    const done = player({ stage: 8, items: [PLANS] });
    await touristTrap.onTalkToNPC(done, npc(NOMAD_GUARD));
    assert.equal(count(done, PLANS), 0);

    // the tent door 198: from inside out; from outside the guard answers
    const out = player({ stage: 3, y: 793, x: 171 });
    await touristTrap.onWallObjectCommandOne(out, wallObject(198, 171, 794, 0));
    assert.deepEqual(out.teleports, [[171, 795]]);

    const world = fakeWorld();
    const blocked = player({ stage: 3, world, y: 796, x: 171 });
    await touristTrap.onWallObjectCommandOne(blocked, wallObject(198, 171, 794, 0));
    assert.deepEqual(blocked.teleports, []);
    assert.equal(world.spawned.at(-1).id, NOMAD_GUARD);

    // the Bedabin sell water
    // (the nomad's menu repeats until the player walks away: the fake runs out of answers)
    const buyer = player({ stage: 0, items: [[COINS, 5]], answers: [2] });
    const nomad = npc(NOMAD);
    await touristTrap.onTalkToNPC(buyer, nomad).catch(() => {});
    assert.equal(count(buyer, 141), 1);
    assert.equal(count(buyer, COINS), 0);
});

test('the other tent door (196) is a teleport door', async () => {
    const door = wallObject(196, 170, 805, 2);
    const north = player({ stage: 0, x: 170, y: 804 });
    await touristTrap.onWallObjectCommandOne(north, door);
    assert.deepEqual(north.teleports, [[170, 806]]);

    const south = player({ stage: 0, x: 170, y: 806 });
    await touristTrap.onWallObjectCommandOne(south, door);
    assert.deepEqual(south.teleports, [[170, 804]]);
});

test('Captain Siad: distracted by "Fire!Fire!" (tourist_chest), then the chest gives the plans', async () => {
    const siad = npc(SIAD, { x: 85, y: 1747 });
    const chest = gameObject(1005, 85, 1746);

    // the chest without any distraction: Siad appears and speaks; "Fire!Fire!" (index 4) -> 60% success
    await withRandom(0.1, async () => {
        const p = player({ stage: 6, world: fakeWorld({ npcs: [siad] }), items: [COPY_KEY], answers: [4] });
        await touristTrap.onGameObjectCommandOne(p, chest);
        assert.equal(p.cache.tourist_chest, true);
        assert.equal(count(p, PLANS), 0);

        // now the chest opens
        await touristTrap.onGameObjectCommandOne(p, chest);
        assert.equal(count(p, PLANS), 1);
        assert.equal(p.cache.tech_plans, true);
        assert.equal(p.cache.tourist_chest, undefined);

        // empty the second time (no distraction needed after the plans? the chest is empty only with the plans held)
        p.cache.tourist_chest = true;
        await touristTrap.onGameObjectCommandOne(p, chest);
        assert.ok(p.messages.includes('The chest is empty.'));
    });

    // without the key the chest needs one
    await withRandom(0.1, async () => {
        const p = player({ stage: 6, world: fakeWorld({ npcs: [npc(SIAD)] }), cache: { tourist_chest: true } });
        await touristTrap.onGameObjectCommandOne(p, chest);
        assert.ok(p.messages.includes('This chest needs a key!'));
    });

    // failed distraction: "Prepare to die!" sends the player to a cell, hurt, possibly without a key
    await withRandom(0, async () => {
        const p = player({ stage: 6, world: fakeWorld({ npcs: [npc(SIAD)] }), items: [CELL_KEY], answers: [2] });
        await touristTrap.onGameObjectCommandOne(p, chest);
        assert.deepEqual(p.teleports, [[89, 801]]);
        assert.deepEqual(p.damaged, [7]);
        assert.equal(count(p, CELL_KEY), 0);
    });

    // Siad appears when nobody is near the chest, for a while
    await withRandom(0.1, async () => {
        const world = fakeWorld();
        const p = player({ stage: 6, world, answers: [4] });
        await touristTrap.onGameObjectCommandOne(p, chest);
        const spawned = world.spawned.at(-1);
        assert.deepEqual([spawned.id, spawned.x, spawned.y], [SIAD, 85, 1745]);
        assert.equal(world.timeouts.at(-1).ticks, 490);
    });

    // with the plans (or at stage 8) he has no time for you
    const late = player({ stage: 8, world: fakeWorld({ npcs: [npc(SIAD)] }) });
    const s = late.world.npcList[0];
    await touristTrap.onGameObjectCommandOne(late, chest);
    assert.deepEqual(s.said, ["I don't have time to talk to you.", 'Move along please!']);
});

test('the desk gives the cell door key, the metal key and (after stage 9) the wrought iron key; the bookcase the sailing hint', async () => {
    const desk = gameObject(1023, 86, 1746);
    const p = player({ stage: 6 });
    await touristTrap.onGameObjectCommandTwo(p, desk);
    assert.equal(count(p, CELL_KEY), 1);
    assert.equal(count(p, METAL_KEY), 1);
    assert.equal(count(p, WROUGHT_KEY), 0);
    await touristTrap.onGameObjectCommandTwo(p, desk);
    assert.ok(p.messages.some((m) => /nothing of interest/.test(m)));

    const late = player({ stage: 10 });
    await touristTrap.onGameObjectCommandTwo(late, desk);
    assert.equal(count(late, WROUGHT_KEY), 1);

    const book = player({ stage: 6 });
    await touristTrap.onGameObjectCommandTwo(book, gameObject(1004, 89, 1744));
    assert.equal(book.cache.sailing, true);
    await touristTrap.onGameObjectCommandOne(book, gameObject(1004, 89, 1744));
    assert.ok(book.messages.includes('The captain seems to collect lots of books!'));
});

test('the experimental anvil: plans, hammer, smithing 20 -> the prototype dart tip; feathers -> the dart', async () => {
    const anvil = gameObject(1006, 170, 792);

    const noPlans = player({ stage: 7, items: [BRONZE_BAR] });
    await mechanism.onUseWithGameObject(noPlans, anvil, { id: BRONZE_BAR });
    assert.equal(count(noPlans, PROTO_TIP), 0);
    assert.ok(noPlans.messages.some((m) => /experimental/.test(m)));

    await withRandom(0, async () => {
        const p = player({ stage: 7, items: [PLANS, BRONZE_BAR, HAMMER], answers: [0], levels: { smithing: 30 } });
        await mechanism.onUseWithGameObject(p, anvil, { id: BRONZE_BAR });
        assert.equal(count(p, PROTO_TIP), 1);
        assert.equal(count(p, BRONZE_BAR), 0);

        // a second tip is not made
        const again = player({ stage: 7, items: [PLANS, BRONZE_BAR, HAMMER, PROTO_TIP], answers: [0] });
        await mechanism.onUseWithGameObject(again, anvil, { id: BRONZE_BAR });
        assert.equal(count(again, BRONZE_BAR), 1);
        assert.ok(again.messages.includes('You have already made the prototype dart tip.'));

        // feathers on the tip: ten, fletching 10; xp = level x 50
        const dart = player({ stage: 7, items: [PROTO_TIP, [FEATHER, 10]], levels: { fletching: 30 } });
        assert.equal(await mechanism.onUseWithInventory(dart, { id: FEATHER }, { id: PROTO_TIP }), true);
        assert.equal(count(dart, PROTO_DART), 1);
        assert.equal(count(dart, PROTO_TIP), 0);
        assert.equal(count(dart, FEATHER), 0);
        assert.deepEqual(dart.experience.at(-1), ['fletching', 30 * 50]);

        // too few feathers, too low a level
        const few = player({ stage: 7, items: [PROTO_TIP, [FEATHER, 9]] });
        await mechanism.onUseWithInventory(few, { id: PROTO_TIP }, { id: FEATHER });
        assert.ok(few.messages.includes('You need at least ten feathers to make this item.'));
        const low = player({ stage: 7, items: [PROTO_TIP, [FEATHER, 10]], levels: { fletching: 5 } });
        await mechanism.onUseWithInventory(low, { id: PROTO_TIP }, { id: FEATHER });
        assert.equal(count(low, PROTO_DART), 0);
    });

    // missing hammer and low smithing
    await withRandom(0, async () => {
        const noHammer = player({ stage: 7, items: [PLANS, BRONZE_BAR], answers: [0] });
        await mechanism.onGameObjectCommandOne(noHammer, anvil);
        assert.ok(noHammer.messages.includes('You need a hammer to work anything on the anvil.'));
        const low = player({ stage: 7, items: [PLANS, BRONZE_BAR, HAMMER], answers: [0], levels: { smithing: 10 } });
        await mechanism.onGameObjectCommandOne(low, anvil);
        assert.equal(count(low, BRONZE_BAR), 1);
        assert.ok(low.messages.includes('You need level 20 in smithing before you can attempt this.'));
    });

    // an unlucky roll wastes the bar
    await withRandom(0.999999, async () => {
        const unlucky = player({ stage: 7, items: [PLANS, BRONZE_BAR, HAMMER], answers: [0], levels: { smithing: 20 } });
        await mechanism.onGameObjectCommandOne(unlucky, anvil);
        assert.equal(count(unlucky, BRONZE_BAR), 0);
        assert.equal(count(unlucky, PROTO_TIP), 0);
    });

    // the success rates follow Formulae.interp
    assert.equal(mechanism.protoDartSmithSuccessful(19), false);
    await withRandom(0.1, async () => assert.equal(mechanism.protoDartSmithSuccessful(20), true));
});

test('dart tips are forged only from stage 8 on: before it the missile menu offers arrow heads and Cancel', async () => {
    async function missileMenu(questStages) {
        const asked = [];
        const answers = [2, 0]; // Make Missile Heads (third entry), then the first entry of its menu
        const p = {
            world: { members: true },
            questStages,
            skills: { smithing: { current: 99, base: 99 } },
            inventory: { has: () => true, add() {}, remove() {} },
            isTired: () => false,
            ask: async (options) => {
                asked.push(options);
                return answers.shift();
            },
            message() {},
            sendBubble() {},
            sendSound() {},
            addExperience() {}
        };
        await forging.onUseWithGameObject(p, { id: 50 }, { id: BRONZE_BAR, definition: { name: 'bronze bar' } });
        return asked.at(1);
    }

    assert.deepEqual(await missileMenu({}), ['Make Arrow Heads', 'Cancel']);
    assert.deepEqual(await missileMenu({ touristTrap: 7 }), ['Make Arrow Heads', 'Cancel']);
    assert.deepEqual((await missileMenu({ touristTrap: -1 })).map((o) => o.replace(/ \(.*\)$/, '')), ['Make Arrow Heads', 'Forge Dart Tips']);
});

test('Ana in the mine: the barrel, Ana into it, the lift, the cart and the barrels', async () => {
    const ana = npc(ANA, { x: 68, y: 3605 });
    const world = fakeWorld({ npcs: [ana] });

    // take a barrel from the stack: one at a time
    const p = player({ stage: 9, world, answers: [0, 0] });
    await mechanism.onGameObjectCommandTwo(p, gameObject(967, 71, 3635));
    assert.equal(count(p, MINING_BARREL), 1);
    await mechanism.onGameObjectCommandTwo(p, gameObject(967, 71, 3635));
    assert.equal(count(p, MINING_BARREL), 1);
    assert.ok(p.messages.includes('You can only manage one of these at a time.'));

    // the barrel on Ana: she is in it
    await mechanism.onUseWithNPC(p, ana, { id: MINING_BARREL });
    assert.equal(count(p, MINING_BARREL), 0);
    assert.equal(count(p, ANA_BARREL), 1);
    assert.equal(p.cache.tried_ana_barrel, true);
    assert.deepEqual(world.removed, [ana]);

    // the barrel on the lift (the guard offers a hand), then the winch up top
    const guard = npc(LIFT_GUARD);
    p.world.npcList.push(guard);
    p.inventory.add(ANA_BARREL);
    p.inventory.remove(ANA_BARREL, 1);
    const lift = player({ stage: 9, world: fakeWorld({ npcs: [guard] }), items: [ANA_BARREL], answers: [0, 0] });
    await mechanism.onUseWithGameObject(lift, gameObject(977, 72, 3636), { id: ANA_BARREL });
    assert.equal(count(lift, ANA_BARREL), 0);
    assert.equal(lift.cache.ana_lift, true);

    await mechanism.onGameObjectCommandOne(lift, gameObject(966, 89, 810));
    assert.equal(lift.cache.ana_lift, undefined);
    assert.equal(lift.cache.ana_is_up, true);

    // the barrels on the surface: the one with Ana in it
    await mechanism.onGameObjectCommandTwo(lift, gameObject(967, 90, 811));
    assert.equal(count(lift, ANA_BARREL), 1);
    assert.equal(lift.cache.ana_is_up, undefined);

    // the cart below
    const cart = player({ stage: 9, items: [ANA_BARREL] });
    await mechanism.onUseWithGameObject(cart, gameObject(976, 56, 3631), { id: ANA_BARREL });
    assert.equal(cart.cache.ana_cart, true);
    assert.equal(count(cart, ANA_BARREL), 0);
    await mechanism.onGameObjectCommandTwo(cart, gameObject(967, 90, 811));
    assert.equal(count(cart, ANA_BARREL), 1);
    assert.equal(cart.cache.ana_cart, undefined);

    // the lift guard stops a player without a barrel to send
    const talk = player({ stage: 9, world: fakeWorld({ npcs: [npc(LIFT_GUARD)] }), answers: [0, 1] });
    await mechanism.onGameObjectCommandTwo(talk, gameObject(977, 72, 3636));
    assert.equal(talk.world.npcList[0].said.includes('Hey there, what do you want?'), true);
});

test('the surface cart: Ana left in it and the driver; "Pssst..." and the bribe; the rescue ride', async () => {
    const above = gameObject(1025, 84, 807);
    const driver = npc(711);

    // using the barrel on the cart loads Ana
    const p = player({ stage: 9, items: [ANA_BARREL], world: fakeWorld({ npcs: [driver] }) });
    await mechanism.onUseWithGameObject(p, above, { id: ANA_BARREL });
    assert.equal(p.cache.ana_in_cart, true);
    assert.equal(count(p, ANA_BARREL), 0);

    // talking to the driver with Ana on board: Nice cart -> "I wonder if you could help me?" ...
    // (hello, then the cart: "Can you get me the heck out of here" ends it)
    const chat = player({ stage: 9, cache: { ana_in_cart: true }, world: fakeWorld({ npcs: [driver] }), answers: [1, 0, 1] });
    assert.equal(await mechanism.onTalkToNPC(chat, driver), true);
    assert.ok(driver.said.includes('Tut !'));

    // the 100 gold route: WAGON -> menu 0 -> menu2 2 -> menu3 2 -> menu4 2 -> menu5 1 -> menu6 0 -> 100 coins -> rescue
    const bribe = player({
        stage: 9,
        cache: { ana_in_cart: true },
        items: [[COINS, 100]],
        world: fakeWorld({ npcs: [driver] }),
        answers: [1, 1, 0, 2, 2, 2, 1, 0]
    });
    await mechanism.onTalkToNPC(bribe, driver);
    assert.equal(bribe.cache.rescue, true);
    assert.equal(bribe.cache.ana_in_cart, undefined);
    assert.equal(count(bribe, COINS), 0);

    // climbing on the cart with the rescue flag: past the gates, with Ana
    const ride = player({ stage: 9, cache: { rescue: true }, world: fakeWorld({ npcs: [driver] }), answers: [0] });
    await mechanism.onGameObjectCommandTwo(ride, above);
    assert.deepEqual(ride.teleports, [[86, 808], [106, 806]]);
    assert.equal(count(ride, ANA_BARREL), 1);
    assert.equal(ride.cache.rescue, undefined);

    // the driver's lines
    const busy = player({ stage: 9 });
    const d = npc(711);
    await mechanism.onTalkToNPC(busy, d);
    assert.ok(busy.messages.includes('The cart driver is busy loading the cart up ...'));
    const finished = player({ stage: -1 });
    const d2 = npc(711);
    await mechanism.onTalkToNPC(finished, d2);
    assert.deepEqual(d2.said, ["Don't trouble me, can't you see I'm busy?"]);
});

test('the mine\'s caves and carts: back cave with Ana, the cart ride, the track, the footprints', async () => {
    const back = gameObject(964, 77, 3639);
    const p = player({ stage: 9, items: [ANA_BARREL], world: fakeWorld() });
    await mechanism.onGameObjectCommandOne(p, back);
    assert.deepEqual(p.teleports.at(-1), [75, 3626]);
    assert.equal(count(p, ANA_BARREL), 0);

    const free = player({ stage: 9 });
    await mechanism.onGameObjectCommandOne(free, back);
    assert.deepEqual(free.teleports, [[84, 3640]]);

    // the cart: 3 in 5 get in
    await withRandom(0, async () => {
        const rider = player({ stage: 9, answers: [0] });
        await mechanism.onGameObjectCommandTwo(rider, gameObject(976, 56, 3631));
        assert.deepEqual(rider.teleports, [[62, 3640]]);
        const back2 = player({ stage: 9, answers: [0] });
        await mechanism.onGameObjectCommandTwo(back2, gameObject(976, 62, 3639));
        assert.deepEqual(back2.teleports, [[55, 3632]]);
    });
    await withRandom(0.99, async () => {
        const fall = player({ stage: 9, answers: [0] });
        await mechanism.onGameObjectCommandTwo(fall, gameObject(976, 56, 3631));
        assert.deepEqual(fall.damaged, [2]);
    });

    const track = player({ stage: 9 });
    await mechanism.onGameObjectCommandOne(track, gameObject(974, 56, 3638));
    assert.ok(track.messages.includes('You see that this track is too dangerous to cross.'));

    // the footprints
    const sand = player({ stage: 1 });
    await mechanism.onGameObjectCommandTwo(sand, gameObject(945, 90, 763));
    assert.ok(sand.messages.some((m) => /red silk scarf/.test(m)));
    const before = player({ stage: 0 });
    await mechanism.onGameObjectCommandOne(before, gameObject(944, 66, 741));
    assert.ok(before.messages.some((m) => /footsteps in the sand/.test(m)));
});

test('Ana in a barrel: the items\' own commands, the ground, dropping and flying out of the mine', async () => {
    const plans = player({ stage: 7, items: [PLANS] });
    assert.equal(await mechanism.onInventoryCommand(plans, { id: PLANS }), true);
    assert.ok(plans.messages.some((m) => /a bronze bar and at least 10 feathers/.test(m)));
    const barrel = player({ stage: 9, items: [ANA_BARREL] });
    await mechanism.onInventoryCommand(barrel, { id: ANA_BARREL });
    assert.ok(barrel.messages.some((m) => /Get me out of here I say!/.test(m)));
    assert.equal(await mechanism.onInventoryCommand(barrel, { id: 1 }), false);

    // on the ground she runs off
    const ground = player({ stage: 9 });
    const world = ground.world;
    const item = { id: ANA_BARREL };
    assert.equal(await mechanism.onGroundItemTake(ground, item), true);
    assert.deepEqual(world.removed, [item]);
    assert.equal(await mechanism.onGroundItemTake(ground, { id: 1 }), false);

    // dropping: refused outside the camp, at 'Yes' in the camp the guards take Ana and the player is jailed
    const outside = player({ stage: 9, x: 100, y: 780, items: [ANA_BARREL], answers: [0] });
    assert.equal(await mechanism.onDropItem(outside, { id: ANA_BARREL }), true);
    assert.equal(count(outside, ANA_BARREL), 1);
    assert.ok(outside.messages.some((m) => /You can't drop me here/.test(m)));

    const inside = player({ stage: 9, x: 85, y: 800, items: [ANA_BARREL], answers: [0], world: fakeWorld({ npcs: [npc(MERCENARY)] }) });
    await mechanism.onDropItem(inside, { id: ANA_BARREL });
    assert.equal(count(inside, ANA_BARREL), 0);
    assert.deepEqual(inside.teleports, [[75, 3626]]);

    const second = player({ stage: 9, x: 85, y: 800, items: [ANA_BARREL], answers: [1] });
    await mechanism.onDropItem(second, { id: ANA_BARREL });
    assert.equal(count(second, ANA_BARREL), 1);

    // after the quest the barrel just goes
    const done = player({ stage: -1, items: [ANA_BARREL] });
    await mechanism.onDropItem(done, { id: ANA_BARREL });
    assert.equal(count(done, ANA_BARREL), 0);
    assert.equal(await mechanism.onDropItem(done, { id: 1 }), false);
});

test('the window and the jail: bending the bar, the cell door key, the mine cell\'s gate and the sturdy gate', async () => {
    const window = wallObject(178, 90, 802, 1);

    await withRandom(0.9, async () => {
        const cell = player({ stage: 3, x: 89, y: 802, answers: [0] });
        assert.equal(await touristTrap.onWallObjectCommandTwo(cell, window), true);
        assert.deepEqual(cell.teleports, [[90, 802]]);
        assert.deepEqual(cell.experience.at(-1), ['strength', 40]);

        const hill = player({ stage: 3, x: 90, y: 802, answers: [0] });
        await touristTrap.onWallObjectCommandTwo(hill, window);
        assert.deepEqual(hill.teleports, [[89, 802]]);

        // Ana is too big for the window
        const barrel = player({ stage: 9, x: 89, y: 802, answers: [0], items: [ANA_BARREL] });
        await touristTrap.onWallObjectCommandTwo(barrel, window);
        assert.deepEqual(barrel.teleports, []);
        assert.ok(barrel.messages.some((m) => /barrel is just too big/.test(m)));
    });

    // a failed bend asks again
    let rolls = [0, 0.9];
    await withRandom(() => rolls.shift() ?? 0.9, async () => {
        const again = player({ stage: 3, x: 89, y: 802, answers: [0, 0] });
        await touristTrap.onWallObjectCommandTwo(again, window);
        assert.deepEqual(again.teleports, [[90, 802]]);
    });

    // the rocks above the cell
    await withRandom(0, async () => {
        const climb = player({ stage: 3, x: 90, y: 802 });
        await touristTrap.onGameObjectCommandOne(climb, gameObject(953, 91, 801));
        assert.deepEqual(climb.teleports, [[93, 799]]);
    });
    await withRandom(0.99, async () => {
        const slip = player({ stage: 3, x: 90, y: 802 });
        await touristTrap.onGameObjectCommandOne(slip, gameObject(953, 91, 801));
        assert.deepEqual(slip.damaged, [7]);
    });

    // the jail door needs the cell door key
    const nokey = player({ stage: 3, x: 88, y: 801 });
    await touristTrap.onWallObjectCommandOne(nokey, wallObject(177, 88, 801, 1));
    assert.deepEqual(nokey.doors, []);
    const key = player({ stage: 3, x: 88, y: 801, items: [CELL_KEY] });
    await touristTrap.onWallObjectCommandOne(key, wallObject(177, 88, 801, 1));
    assert.equal(key.doors.length, 1);

    // the mine cell: 15 rocks in one go
    const jailer = npc(JAIL_GUARD);
    const poor = player({ stage: 9, x: 74, y: 3626, world: fakeWorld({ npcs: [jailer] }), items: [[ROCKS, 14]] });
    await touristTrap.onWallObjectCommandOne(poor, wallObject(180, 72, 3626, 1));
    assert.deepEqual(poor.teleports, []);
    assert.ok(jailer.said.includes('Hey, move away from the gate.'));

    const rich = player({ stage: 9, x: 74, y: 3626, world: fakeWorld({ npcs: [npc(JAIL_GUARD)] }), items: [[ROCKS, 15]] });
    await touristTrap.onWallObjectCommandOne(rich, wallObject(180, 72, 3626, 1));
    assert.deepEqual(rich.teleports, [[71, 3626], [69, 3625]]);
    assert.equal(count(rich, ROCKS), 0);

    // the sturdy gate: the wrought iron key from the north, free from the south
    const gate = wallObject(200, 51, 3617, 0);
    const locked = player({ stage: 10, x: 51, y: 3617 });
    await touristTrap.onWallObjectCommandOne(locked, gate);
    assert.deepEqual(locked.teleports, []);
    const unlocked = player({ stage: 10, x: 51, y: 3617, items: [WROUGHT_KEY] });
    await touristTrap.onWallObjectCommandOne(unlocked, gate);
    assert.deepEqual(unlocked.teleports, [[51, 3616]]);
    const south = player({ stage: 10, x: 51, y: 3616 });
    await touristTrap.onWallObjectCommandOne(south, gate);
    assert.deepEqual(south.teleports, [[51, 3617]]);
});

test('stage 9 -> 10 -> done: Ana at the Shantay gate, the key, and two skills of Irena\'s choice', async () => {
    const irena = npc(IRENA, { x: 64, y: 738 });
    const gate = gameObject(916, 62, 733);

    // through the gate with Ana in her barrel: Ana, the wrought iron key, then Irena's two rewards (Fletching, Thieving)
    const world = fakeWorld({ npcs: [irena] });
    const p = player({ stage: 9, world, y: 740, x: 62, items: [ANA_BARREL], answers: [0, 3], levels: { fletching: 20, thieving: 40 } });
    assert.equal(await touristTrap.onGameObjectCommandOne(p, gate), true);
    assert.equal(p.questStages.touristTrap, -1);
    assert.equal(count(p, ANA_BARREL), 0);
    assert.equal(count(p, WROUGHT_KEY), 1);
    assert.deepEqual(p.experience, [['fletching', 600 + 600 * 20], ['thieving', 600 + 600 * 40]]);
    assert.deepEqual(p.completed[0][1].questPoints, 2);
    assert.equal(p.cache.advanced1, undefined);
    assert.ok(irena.said.includes('Hi Ana!'));

    // the same by talking to Irena herself
    const talker = player({ stage: 9, items: [ANA_BARREL], answers: [1, 2] });
    const i2 = npc(IRENA);
    await touristTrap.onTalkToNPC(talker, i2);
    assert.equal(talker.questStages.touristTrap, -1);
    assert.deepEqual(talker.experience.map(([skill]) => skill), ['agility', 'smithing']);
    assert.equal(count(talker, WROUGHT_KEY), 1);

    // without the barrel she just asks
    const none = player({ stage: 9 });
    const i3 = npc(IRENA);
    await touristTrap.onTalkToNPC(none, i3);
    assert.equal(none.questStages.touristTrap, 9);
    assert.ok(i3.said.includes('Please bring my daughter back to me.'));

    // an interrupted reward: only the first choice was made, "advanced1" remembers it
    const half = player({ stage: 10, cache: { advanced1: true }, answers: [2] });
    await touristTrap.onTalkToNPC(half, npc(IRENA));
    assert.equal(half.questStages.touristTrap, -1);
    assert.equal(half.experience.length, 1);
    assert.equal(half.cache.advanced1, undefined);

    // after the quest
    const done = player({ stage: -1 });
    const i4 = npc(IRENA);
    await touristTrap.onTalkToNPC(done, i4);
    assert.ok(i4.said.includes('Thanks so much for returning my daughter to me.'));
});

test('Ana\'s own talk, the lift and jail guards\' lines, and the quest list counts the stage -1 as done', async () => {
    const ana = npc(ANA);
    const robed = player({ stage: 9, ...SLAVE_OUTFIT, answers: [1, 0] });
    await touristTrap.onTalkToNPC(robed, ana);
    assert.ok(ana.said.includes("My name? Oh, how sweet, my name is Ana,"));

    // not in the robes: the guards take you away (below the mine the cell is the mine cell at 75,3625)
    const bare = player({ stage: 9, world: fakeWorld({ npcs: [npc(MERCENARY)] }), x: 60, y: 3605 });
    await touristTrap.onTalkToNPC(bare, npc(ANA));
    assert.deepEqual(bare.teleports, [[75, 3625]]);

    const done = player({ stage: -1 });
    await touristTrap.onTalkToNPC(done, npc(ANA));
    assert.ok(done.messages.includes('This slave does not appear interested in talking to you.'));

    // the lift guard: "Your head on a stick." beats up the player and sends him to the cell
    const lift = player({ stage: 9, answers: [1] });
    const g = npc(LIFT_GUARD);
    await touristTrap.onTalkToNPC(lift, g);
    assert.deepEqual(lift.teleports, [[76, 3625]]);
    assert.deepEqual(g.attacked, [lift]);
    assert.ok(g.said.includes('Get them men!'));

    const jail = player({ stage: -1, answers: [2] });
    const j = npc(JAIL_GUARD);
    await touristTrap.onTalkToNPC(jail, j);
    assert.deepEqual(jail.teleports, []);
    assert.deepEqual(j.attacked, [jail]);

});

test('every NPC the quest owns is claimed, and others are left alone', async () => {
    const p = player({ stage: 0, answers: [0, 0, 0, 0] });
    assert.equal(await touristTrap.onTalkToNPC(p, npc(1)), false);
    assert.equal(await mechanism.onTalkToNPC(p, npc(1)), false);
    assert.equal(await touristTrap.onGameObjectCommandOne(p, gameObject(1, 1, 1)), false);
    assert.equal(await mechanism.onGameObjectCommandOne(p, gameObject(1, 1, 1)), false);
    assert.equal(await touristTrap.onWallObjectCommandOne(p, wallObject(1, 1, 1)), false);
    assert.equal(await touristTrap.onNPCAttack(p, npc(1)), false);
    assert.equal(dialogue.Mercenary.THROW_PRISON, 9);
});
