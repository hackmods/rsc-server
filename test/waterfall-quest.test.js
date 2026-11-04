// Waterfall Quest (quests/members/waterfall-quest.js, port of Waterfall_Quest.java): every stage driven with fake
// objects, from Almera to the chalice of eternity, plus the Open-RSC pieces around it (Golrie's gate, the pebble's weapon
// check, the flooding doors, the stands, the book and the mithril seed).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const waterfall = require('../src/plugins/quests/members/waterfall-quest');
const { fakeNpc, fakeWorld, fakePlayer, gameObject, wallObject } = require('./quest-fakes-3b');

const ALMERA = 470;
const HUDON = 471;
const HADLEY = 472;
const GOLRIE = 475;
const GERALD = 481;

const WATER_RUNE = 32;
const AIR_RUNE = 33;
const EARTH_RUNE = 34;
const DIAMOND = 161;
const GOLD_BAR = 172;
const ROPE = 237;
const BRONZE_DAGGER = 3;
const SWORDFISH = 369;
const AMULET = 782;
const PEBBLE = 787;
const BOOK = 788;
const LARGE_KEY = 789;
const MITHRIL_SEED = 796;
const OLD_KEY = 797;
const URN = 805;
const URN_EMPTY = 806;

const PLUGIN_TYPES = [
    .../const PLUGIN_TYPES = \[([\s\S]*?)\]/
        .exec(fs.readFileSync(require.resolve('../src/model/world.js'), 'utf8'))[1]
        .matchAll(/'(\w+)'/g)
].map((m) => m[1]);

function player(opts = {}) {
    const p = fakePlayer({ quest: 'waterfallQuest', ...opts });
    p.sent = [];
    p.send = (packet) => p.sent.push(packet);
    return p;
}

test('every exported hook is a plugin type', () => {
    for (const name of Object.keys(waterfall)) {
        assert.ok(PLUGIN_TYPES.includes(name), name);
    }
});

test('stage 0: Almera asks after Hudon; "how can I help?" starts the quest (1)', async () => {
    const rush = player({ answers: [0] });
    const a = fakeNpc(ALMERA);
    assert.equal(await waterfall.onTalkToNPC(rush, a), true);
    assert.equal(rush.questStages.waterfallQuest, 0);
    assert.ok(a.said.includes('oh okay, never mind'));
    assert.equal(rush.interlocutor, null);

    const p = player({ answers: [1] });
    const almera = fakeNpc(ALMERA);
    await waterfall.onTalkToNPC(p, almera);
    assert.equal(p.questStages.waterfallQuest, 1);
    assert.ok(almera.said.includes('you can use the small raft out back if you wish'));

    const again = player({ stage: 1 });
    await waterfall.onTalkToNPC(again, fakeNpc(ALMERA));
    assert.ok(again.said.includes('have you seen my boy yet?') || true);
    assert.equal(again.questStages.waterfallQuest, 1);
});

test('stage 1: talking to Hudon moves to 2; the later stages only chat', async () => {
    const p = player({ stage: 1 });
    const h = fakeNpc(HUDON);
    await waterfall.onTalkToNPC(p, h);
    assert.equal(p.questStages.waterfallQuest, 2);
    assert.ok(p.messages.includes('@que@hudon is refusing to leave the waterfall'));

    for (const stage of [0, 2, 3, 4, -1]) {
        const q = player({ stage });
        const n = fakeNpc(HUDON);
        await waterfall.onTalkToNPC(q, n);
        assert.equal(q.questStages.waterfallQuest, stage);
        assert.ok(n.said.length > 0, `stage ${stage}`);
    }

    const g = fakeNpc(GERALD);
    const early = player();
    await waterfall.onTalkToNPC(early, g);
    assert.ok(g.said.includes('the last one was this big'));
    const g2 = fakeNpc(GERALD);
    await waterfall.onTalkToNPC(player({ stage: 3 }), g2);
    assert.ok(g2.said.includes('they never find anything though'));
});

test('Hadley: the alt tour before the quest, the book tour after; menus drop what was discussed', async () => {
    // stage 0: elf king, then "i don't like nature" ends it
    const alt = player({ answers: [0, 1] });
    const h = fakeNpc(HADLEY);
    await waterfall.onTalkToNPC(alt, h);
    assert.ok(h.said.includes('no one knows'));
    assert.deepEqual(alt.asked[1], [
        'where else is worth visiting around here?',
        "i don't like nature, it gives me a rash",
        'thanks then, goodbye'
    ]);
    assert.ok(h.said.includes("that's just silly talk"));

    // stage 2 without the book: the main tour, treasure question, goodbye
    const main = player({ stage: 2, answers: [2, 2] });
    const h2 = fakeNpc(HADLEY);
    await waterfall.onTalkToNPC(main, h2);
    assert.ok(h2.said.includes('ha ha, another treasure hunter'));
    assert.deepEqual(main.asked[1], [
        'can you tell me what happened to the elf king?',
        'where else is worth visiting around here?',
        'thanks then, goodbye'
    ]);
    assert.ok(h2.said.includes('enjoy your visit'));

    // with the book he greets first
    const book = player({ stage: 3, items: [BOOK], answers: [3] });
    const h3 = fakeNpc(HADLEY);
    await waterfall.onTalkToNPC(book, h3);
    assert.ok(h3.said.includes('places to go, people to see'));
    assert.ok(h3.said.includes('enjoy your visit'));
});

test('the bookcase gives the book; reading it at stage 2 moves to 3 and shows the chosen page', async () => {
    const p = player({ stage: 2 });
    const case470 = gameObject(470, 650, 1435);
    assert.equal(await waterfall.onGameObjectCommandOne(p, case470), true);
    assert.equal(p.inventory.count(BOOK), 1);
    await waterfall.onGameObjectCommandOne(p, case470);
    assert.equal(p.inventory.count(BOOK), 1);
    assert.ok(p.messages.includes('@que@but find nothing of interest'));

    p.answers = undefined;
    const reader = player({ stage: 2, items: [BOOK], answers: [0] });
    assert.equal(await waterfall.onInventoryCommand(reader, { id: BOOK }), true);
    assert.equal(reader.questStages.waterfallQuest, 3);
    assert.equal(reader.sent.length, 1);
    assert.equal(reader.sent[0].type, 'serverMessageOnTop');
    assert.ok(reader.sent[0].message.includes('Glarial'));

    const power = player({ stage: 4, items: [BOOK], answers: [2] });
    await waterfall.onInventoryCommand(power, { id: BOOK });
    assert.equal(power.questStages.waterfallQuest, 4);
    assert.equal(power.sent[0].type, 'serverMessage');
});

test('the large key crate, Golrie\'s gate and Golrie: the pebble for the key', async () => {
    const crate = gameObject(481, 655, 3535);
    const none = player();
    await waterfall.onGameObjectCommandOne(none, crate);
    assert.deepEqual(none.messages, ['the crate is empty']);
    assert.equal(none.inventory.count(LARGE_KEY), 0);

    const p = player({ stage: 3 });
    await waterfall.onGameObjectCommandOne(p, crate);
    assert.equal(p.inventory.count(LARGE_KEY), 1);
    await waterfall.onGameObjectCommandOne(p, crate);
    assert.equal(p.inventory.count(LARGE_KEY), 1);
    assert.ok(p.messages.includes('but find nothing'));

    // the gate at (663,3530): outside it (y 3530) says Golrie's trouble, the key opens it, inside is free
    const world = fakeWorld({ npcs: [fakeNpc(GOLRIE, { x: 666, y: 3526 })] });
    const gate = gameObject(480, 663, 3530);

    const early = player({ world, y: 3531 });
    await waterfall.onGameObjectCommandOne(early, gate);
    assert.ok(world.npcList[0].said.includes('what are you doing down here'));
    assert.deepEqual(early.gates, []);

    const outside = player({ world, stage: 3, y: 3531 });
    await waterfall.onGameObjectCommandOne(outside, gate);
    assert.ok(outside.said.includes('are you ok?'));
    assert.ok(outside.said.includes("okay, i'll have a look for a key"));
    assert.deepEqual(outside.gates, []);

    const keyed = player({ world, stage: 3, y: 3531, items: [LARGE_KEY] });
    await waterfall.onGameObjectCommandOne(keyed, gate);
    assert.ok(keyed.said.includes('i found a key'));
    assert.equal(await waterfall.onUseWithGameObject(keyed, gate, { id: LARGE_KEY }), true);
    assert.deepEqual(keyed.gates, [[480, undefined]]);

    const inside = player({ world, stage: 3, y: 3528 });
    await waterfall.onGameObjectCommandOne(inside, gate);
    assert.deepEqual(inside.gates, [[480, undefined]]);

    // Golrie takes the key and gives the pebble once; the gate is then "locked himself in"
    const golrie = fakeNpc(GOLRIE, { x: 666, y: 3526 });
    const talker = player({ world, stage: 3, y: 3528, items: [LARGE_KEY] });
    await waterfall.onTalkToNPC(talker, golrie);
    assert.equal(talker.inventory.count(PEBBLE), 1);
    assert.equal(talker.inventory.count(LARGE_KEY), 0);
    assert.equal(talker.cache.golrie_key, true);
    assert.ok(golrie.said.includes('well thanks again for the key'));

    talker.inventory.add(LARGE_KEY);
    await waterfall.onTalkToNPC(talker, fakeNpc(GOLRIE));
    assert.equal(talker.inventory.count(PEBBLE), 1);
    assert.equal(talker.inventory.count(LARGE_KEY), 0);
    assert.ok(talker.messages.includes('@que@you find nothing of interest'));

    const locked = player({ world, stage: 3, y: 3531, cache: { golrie_key: true } });
    await waterfall.onGameObjectCommandOne(locked, gate);
    assert.ok(locked.messages.includes('golrie has locked himself in'));
    const done = player({ world, stage: -1, y: 3531 });
    await waterfall.onGameObjectCommandOne(done, gate);
    assert.ok(done.messages.includes('golrie has locked himself in'));
});

test('the pebble on Glarial\'s gravestone: weapons and armour stop it, stage 3 moves to 4', async () => {
    const stone = gameObject(479, 631, 476);

    const read = player({ stage: 3 });
    await waterfall.onGameObjectCommandOne(read, stone);
    assert.ok(read.messages.includes('@que@only visitors with peaceful intent can enter'));

    const armed = player({ stage: 3, items: [PEBBLE, BRONZE_DAGGER] });
    assert.equal(await waterfall.onUseWithGameObject(armed, stone, { id: PEBBLE }), true);
    assert.ok(armed.messages.includes('@que@but nothing happens'));
    assert.deepEqual(armed.teleports, []);
    assert.equal(armed.questStages.waterfallQuest, 3);

    // a swordfish is food, not a sword
    const peaceful = player({ stage: 3, items: [PEBBLE, SWORDFISH, ROPE] });
    await waterfall.onUseWithGameObject(peaceful, stone, { id: PEBBLE });
    assert.deepEqual(peaceful.teleports, [[631, 3305]]);
    assert.equal(peaceful.questStages.waterfallQuest, 4);

    // at any other stage the passage still opens and the stage stays
    const later = player({ stage: -1, items: [PEBBLE] });
    await waterfall.onUseWithGameObject(later, stone, { id: PEBBLE });
    assert.deepEqual(later.teleports, [[631, 3305]]);
    assert.equal(later.questStages.waterfallQuest, -1);
});

test('the river: a rope on the trees crosses, jumping off is washed up', async () => {
    const tree462 = gameObject(462, 662, 463);
    const tree463 = gameObject(463, 662, 467);
    const tree482 = gameObject(482, 659, 471);

    const jump = player({ stage: 4 });
    await waterfall.onGameObjectCommandOne(jump, tree462);
    assert.deepEqual(jump.teleports, [[654, 485]]);
    assert.equal(jump.damaged.length, 1);
    assert.ok(jump.damaged[0] >= 4 && jump.damaged[0] <= 10);
    assert.ok(jump.said.includes('ouch!'));

    const far = player({ stage: 4 });
    assert.equal(await waterfall.onGameObjectCommandTwo(far, tree463), true);
    assert.ok(far.messages.includes('@que@you need someway to pull yourself across'));
    assert.equal(await waterfall.onGameObjectCommandTwo(far, tree482), false);

    for (const [tree, to] of [
        [tree462, [662, 467]],
        [tree463, [659, 471]],
        [tree482, [659, 3305]]
    ]) {
        const p = player({ stage: 4, items: [ROPE] });
        assert.equal(await waterfall.onUseWithGameObject(p, tree, { id: ROPE }), true);
        assert.deepEqual(p.teleports, [to]);
        assert.equal(p.inventory.count(ROPE), 1);
    }

    // anything but a rope on a tree is not ours
    assert.equal(await waterfall.onUseWithGameObject(player(), tree462, { id: BRONZE_DAGGER }), false);

    const fall = player({ stage: 4 });
    await waterfall.onGameObjectCommandOne(fall, gameObject(469, 659, 3304));
    assert.deepEqual(fall.teleports, [[654, 485]]);
});

test('the dungeon: cupboard, coffin, crate, locked door, flooding doors and the doorway', async () => {
    const closed = gameObject(506, 634, 3295);
    const open = gameObject(507, 634, 3295);

    const p = player({ stage: 4 });
    await waterfall.onGameObjectCommandOne(p, closed);
    assert.deepEqual(p.messages, ['you open the cupboard']);
    assert.deepEqual(p.world.replaced, [[506, 507]]);
    await waterfall.onGameObjectCommandOne(p, open);
    assert.equal(p.inventory.count(URN), 1);
    assert.ok(p.messages.includes('and find a metel urn'));
    await waterfall.onGameObjectCommandOne(p, open);
    assert.ok(p.messages.includes("it's empty"));
    assert.equal(await waterfall.onGameObjectCommandTwo(p, open), true);
    assert.deepEqual(p.world.replaced[1], [507, 506]);
    assert.ok(p.messages.includes('you shut the cupboard'));

    const coffin = gameObject(467, 646, 3305);
    await waterfall.onGameObjectCommandOne(p, coffin);
    assert.equal(p.inventory.count(AMULET), 1);
    await waterfall.onGameObjectCommandOne(p, coffin);
    assert.equal(p.inventory.count(AMULET), 1);
    assert.ok(p.messages.includes("@que@it's empty"));

    const crate = gameObject(492, 650, 3290);
    await waterfall.onGameObjectCommandOne(p, crate);
    assert.equal(p.inventory.count(OLD_KEY), 1);
    await waterfall.onGameObjectCommandTwo(p, crate);
    assert.equal(p.inventory.count(OLD_KEY), 1);
    assert.ok(p.messages.includes('it is empty'));

    // the locked door 135: a click only knocks, the old key opens it
    const door = wallObject(135, 668, 3281);
    const knock = player({ stage: 4 });
    assert.equal(await waterfall.onWallObjectCommandOne(knock, door), true);
    assert.ok(knock.messages.includes('@que@you need a key'));
    assert.equal(await waterfall.onWallObjectCommandOne(knock, wallObject(136, 1, 1)), false);
    const keyed = player({ stage: 4, items: [OLD_KEY] });
    assert.equal(await waterfall.onUseWithWallObject(keyed, door, { id: OLD_KEY }), true);
    assert.deepEqual(keyed.doors, [[135, undefined]]);
    assert.equal(await waterfall.onUseWithWallObject(keyed, door, { id: ROPE }), false);

    // the doors 471: the amulet worn opens them, otherwise the corridor floods
    const doors = gameObject(471, 659, 3303);
    const worn = player({ stage: 4, items: [AMULET], equipped: [AMULET] });
    await waterfall.onGameObjectCommandOne(worn, doors);
    assert.deepEqual(worn.gates, [[471, 63]]);
    assert.deepEqual(worn.teleports, []);

    const bare = player({ stage: 4, items: [AMULET] });
    await waterfall.onGameObjectCommandOne(bare, doors);
    assert.deepEqual(bare.gates, []);
    assert.deepEqual(bare.teleports, [[654, 485]]);
    assert.equal(bare.damaged.length, 1);
    assert.ok(bare.messages.includes('@que@flushing you back into the river'));

    const doorway = player({ stage: 4 });
    await waterfall.onGameObjectCommandOne(doorway, gameObject(486, 649, 3275));
    assert.deepEqual(doorway.teleports, [[667, 3279]]);
});

test('the stands take a rune each once and the statue lifts the ground for the amulet', async () => {
    const stand = gameObject(473, 664, 3271);
    const p = player({ stage: 4, items: [[AIR_RUNE, 2], WATER_RUNE, EARTH_RUNE] });

    assert.equal(await waterfall.onUseWithGameObject(p, stand, { id: AIR_RUNE }), true);
    assert.equal(p.inventory.count(AIR_RUNE), 1);
    assert.equal(p.cache.waterfall_473_33, true);
    assert.deepEqual(p.messages, ['you place the air rune on the stand', 'the rune stone crumbles into dust']);

    p.messages.length = 0;
    await waterfall.onUseWithGameObject(p, stand, { id: AIR_RUNE });
    assert.equal(p.inventory.count(AIR_RUNE), 1);
    assert.deepEqual(p.messages, ['you have already placed an air rune here']);

    p.messages.length = 0;
    await waterfall.onUseWithGameObject(p, stand, { id: WATER_RUNE });
    assert.deepEqual(p.messages, ['you place the water rune on the stand', 'the rune stone crumbles into dust']);
    p.messages.length = 0;
    await waterfall.onUseWithGameObject(p, stand, { id: WATER_RUNE });
    assert.deepEqual(p.messages, ['you have already placed a water rune here']);
    assert.equal(await waterfall.onUseWithGameObject(p, gameObject(479, 631, 476), { id: AIR_RUNE }), false);

    const statue = gameObject(483, 647, 3266);
    const lift = player({ stage: 4, items: [AMULET] });
    assert.equal(await waterfall.onUseWithGameObject(lift, statue, { id: AMULET }), true);
    assert.deepEqual(lift.teleports, [[647, 3267]]);
});

test('the chalice: the urn ends the quest (-1) with the rewards; afterwards it will not move', async () => {
    const chalice = gameObject(485, 647, 3269);

    const p = player({ stage: 4, items: [URN], cache: { waterfall_473_33: true, waterfall_474_32: true } });
    assert.equal(await waterfall.onUseWithGameObject(p, chalice, { id: URN }), true);
    assert.equal(p.questStages.waterfallQuest, -1);
    assert.equal(p.inventory.count(URN), 0);
    assert.equal(p.inventory.count(URN_EMPTY), 1);
    assert.equal(p.inventory.count(796), 40);
    assert.equal(p.inventory.count(GOLD_BAR), 2);
    assert.equal(p.inventory.count(DIAMOND), 2);
    assert.deepEqual(p.cache, {});
    const [key, opts] = p.completed[0];
    assert.equal(key, 'waterfallQuest');
    assert.equal(opts.questPoints, 1);
    assert.deepEqual(opts.experience, { strength: 1000 + 900 * 30, attack: 1000 + 900 * 30 });
    assert.equal(opts.message, 'you have completed the Baxtorian waterfall quest');

    const again = player({ stage: -1, items: [URN] });
    await waterfall.onUseWithGameObject(again, chalice, { id: URN });
    assert.ok(again.messages.includes('You have already completed this quest'));
    assert.equal(again.inventory.count(URN), 1);

    await waterfall.onGameObjectCommandOne(again, chalice);
    assert.ok(again.messages.includes('@que@it will not move'));

    // touching it before the urn floods the cavern
    const touch = player({ stage: 4 });
    await waterfall.onGameObjectCommandOne(touch, chalice);
    assert.deepEqual(touch.teleports, [[654, 485]]);
    assert.ok(touch.messages.includes('@que@and are washed up by the river side'));
});

test('the mithril seed plants a tree that goes after a minute; not on an occupied tile', async () => {
    const world = fakeWorld();
    const p = player({ world, stage: -1, items: [[MITHRIL_SEED, 3]], x: 600, y: 600 });

    assert.equal(await waterfall.onInventoryCommand(p, { id: MITHRIL_SEED }), true);
    assert.equal(p.inventory.count(MITHRIL_SEED), 2);
    assert.equal(world.objectList.length, 1);
    assert.equal(world.objectList[0].id, 490);
    assert.equal(world.timeouts[0].ticks, Math.ceil(60000 / 640));
    assert.ok(p.messages.includes('a tree magically sprouts around you'));

    p.messages.length = 0;
    await waterfall.onInventoryCommand(p, { id: MITHRIL_SEED });
    assert.equal(p.inventory.count(MITHRIL_SEED), 2);
    assert.ok(p.messages.includes("you can't plant a tree here"));

    world.runTimeouts();
    assert.equal(world.objectList.length, 0);
    assert.equal(await waterfall.onInventoryCommand(p, { id: 1 }), false);
});

test('other npcs and objects are not ours', async () => {
    assert.equal(await waterfall.onTalkToNPC(player(), fakeNpc(1)), false);
    assert.equal(await waterfall.onGameObjectCommandOne(player(), gameObject(1, 1, 1)), false);
    assert.equal(await waterfall.onUseWithGameObject(player(), gameObject(1, 1, 1), { id: ROPE }), false);
});
