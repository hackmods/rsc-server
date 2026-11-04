// Witch's House (quests/members/witchs-house.js, port of WitchesHouse.java): every stage driven with fake objects,
// plus the door mat shared with treasure trails and the front door key (wall-objects/key-doors.js).

const test = require('node:test');
const assert = require('node:assert/strict');

const witch = require('../src/plugins/quests/members/witchs-house');
const keyDoors = require('../src/plugins/wall-objects/key-doors');
const treasureTrails = require('../src/plugins/items/treasure-trails');
const clues = require('../src/clues');
const { fakeNpc, fakeWorld, fakePlayer, gameObject, wallObject } = require('./quest-fakes');

const BOY = 240;
const RAT = 241;
const NORA = 242;
const BALL = 539;
const KEY = 538;
const MAGNET = 540;
const CHEESE = 319;
const LEATHER_GLOVES = 16;
const BRONZE_PLATE = 117;

function player(opts = {}) {
    return fakePlayer({ quest: 'witchsHouse', ...opts });
}

test('stage 0: the boy asks for his ball (stage 1); turning him down leaves stage 0', async () => {
    const p = player({ answers: [0, 0] });
    assert.equal(await witch.onTalkToNPC(p, fakeNpc(BOY)), true);
    assert.equal(p.questStages.witchsHouse, 1);
    assert.ok(p.said.includes("Ok I'll see what I can do"));

    const q = player({ answers: [0, 1] });
    await witch.onTalkToNPC(q, fakeNpc(BOY));
    assert.equal(q.questStages.witchsHouse, 0);
    assert.ok(q.said.includes('Get it back yourself'));
});

test('the door mat gives the front door key once; the key opens the front door only after the quest started', async () => {
    const mat = gameObject(255, 363, 494);
    const p = player({ stage: 1 });
    assert.equal(await witch.onGameObjectCommandOne(p, mat), true);
    assert.ok(p.inventory.has(KEY));
    assert.deepEqual(p.messages, ['You find a key under the mat']);
    await witch.onGameObjectCommandOne(p, mat);
    assert.equal(p.messages[1], 'You find nothing interesting');
    assert.equal(p.inventory.count(KEY), 1);

    const door = wallObject(69, 363, 494, 1);
    const early = player({ stage: 0, items: [KEY] });
    assert.equal(await keyDoors.onUseWithWallObject(early, door, { id: KEY }), true);
    assert.deepEqual(early.said, ["It'd be rude to break into this house"]);
    assert.equal(early.doors.length, 0);

    p.cache.witchSpawned = true;
    await keyDoors.onUseWithWallObject(p, door, { id: KEY });
    assert.deepEqual(p.doors, [[69, undefined]]);
    assert.equal(p.cache.witchSpawned, undefined);
});

test('a medium clue at the door mat is solved and the key still comes out', async () => {
    const mat = gameObject(255, 363, 494);
    const p = player({ stage: 1 });
    const step = { id: 'medium-search-taverley-doormat', type: 'search', object: 255, command: 'search' };
    const realSolve = clues.solveIfMatched;
    const realAdvance = clues.advance;
    clues.solveIfMatched = (pl, kind, id) => (kind === 'search' && id === 255 ? { tier: 'medium', step } : null);
    clues.advance = () => {};

    try {
        // treasure trails runs first (plugins/index.js) and lets the search go on
        assert.equal(await treasureTrails.onGameObjectCommandOne(p, mat), false);
        assert.ok(p.messages.some((m) => /find the next clue/.test(m)));
        assert.equal(await witch.onGameObjectCommandOne(p, mat), true);
        assert.ok(p.inventory.has(KEY));
    } finally {
        clues.solveIfMatched = realSolve;
        clues.advance = realAdvance;
    }
});

test('the basement gate shocks bare hands and metal armour, gloves let you through', async () => {
    const gate = gameObject(256, 363, 3325);

    const bare = player({ stage: 1 });
    assert.equal(await witch.onGameObjectCommandOne(bare, gate), true);
    assert.equal(bare.messages[0], 'As your bare hands touch the gate you feel a shock');
    assert.equal(bare.damaged.length, 1);
    assert.ok(bare.damaged[0] >= 1 && bare.damaged[0] <= 14);

    const metal = player({ stage: 1, items: [BRONZE_PLATE], equipped: [BRONZE_PLATE] });
    await witch.onGameObjectCommandOne(metal, gate);
    assert.equal(metal.messages[0], 'As your metal armour touches the gate you feel a shock');

    const gloved = player({ stage: 1, items: [LEATHER_GLOVES, BRONZE_PLATE], equipped: [LEATHER_GLOVES, BRONZE_PLATE] });
    await witch.onGameObjectCommandOne(gloved, gate);
    assert.deepEqual(gloved.gates, [[256, undefined]]);
    assert.equal(gloved.damaged.length, 0);
    assert.ok(witch.METAL_ARMOUR_IDS.has(BRONZE_PLATE) && witch.METAL_ARMOUR_IDS.has(401) && !witch.METAL_ARMOUR_IDS.has(16));
});

test('the cupboard opens, closes and hides the magnet (found_magnet only once the quest started)', async () => {
    const p = player({ stage: 1 });
    await witch.onGameObjectCommandOne(p, gameObject(258, 362, 3328));
    assert.deepEqual(p.world.replaced, [[258, 259]]);
    await witch.onGameObjectCommandTwo(p, gameObject(259, 362, 3328));
    assert.deepEqual(p.world.replaced[1], [259, 258]);
    await witch.onGameObjectCommandOne(p, gameObject(259, 362, 3328));
    assert.ok(p.inventory.has(MAGNET));
    assert.equal(p.cache.foundMagnet, true);
    await witch.onGameObjectCommandOne(p, gameObject(259, 362, 3328));
    assert.equal(p.messages.at(-1), 'You search the cupboard, but find nothing');

    const early = player({ stage: 0 });
    await witch.onGameObjectCommandOne(early, gameObject(259, 362, 3328));
    assert.equal(early.cache.foundMagnet, undefined);
});

test('cheese in the rat room brings the rat; the magnet on it opens the garden door (stage 2)', async () => {
    const p = player({ stage: 1, items: [CHEESE, MAGNET], x: 356, y: 495 });
    assert.equal(await witch.onDropItem(p, { id: CHEESE }), true);
    assert.equal(p.inventory.has(CHEESE), false);
    assert.deepEqual(p.world.spawned.map((s) => [s.id, s.x, s.y]), [[RAT, 356, 494]]);

    // outside the room the cheese drops normally
    const outside = player({ stage: 1, items: [CHEESE], x: 355, y: 495 });
    assert.equal(await witch.onDropItem(outside, { id: CHEESE }), false);

    const rat = p.world.npcList.find((n) => n.id === RAT);
    assert.equal(await witch.onUseWithNPC(p, rat, { id: MAGNET }), true);
    assert.equal(p.messages.at(-1), 'You need to get the magnet yourself to do this quest');
    assert.equal(p.questStages.witchsHouse, 1);

    p.cache.foundMagnet = true;
    await witch.onUseWithNPC(p, rat, { id: MAGNET });
    assert.equal(p.questStages.witchsHouse, 2);
    assert.equal(p.inventory.has(MAGNET), false);
    assert.ok(p.world.removed.includes(rat));

    const done = player({ stage: -1, items: [CHEESE], x: 357, y: 494 });
    assert.equal(await witch.onDropItem(done, { id: CHEESE }), true);
    assert.deepEqual(done.said, ['I would rather eat it to be honest']);
    assert.ok(done.inventory.has(CHEESE));
});

test('the garden door stays shut before the magnet, opens after', async () => {
    const door = wallObject(71, 356, 495, 1);
    const p = player({ stage: 1, x: 356, y: 495 });
    await witch.onWallObjectCommandOne(p, door);
    assert.deepEqual(p.messages, ["The door won't open"]);

    const q = player({ stage: 2, x: 356, y: 495 });
    await witch.onWallObjectCommandOne(q, door);
    assert.deepEqual(q.doors, [[71, undefined]]);

    const main = player({ stage: 0 });
    assert.equal(await witch.onWallObjectCommandOne(main, wallObject(70, 358, 495, 1)), true);
    assert.deepEqual(main.doors, [[70, undefined]]);
});

test('stage 2: the shed door brings the witch out; slipping into the house sends her to the shed (stage 3)', async () => {
    const shed = wallObject(73, 351, 492, 0);
    const p = player({ stage: 2, x: 351, y: 493 });

    await witch.onWallObjectCommandOne(p, shed);
    assert.equal(p.cache.witchSpawned, true);
    assert.deepEqual(p.world.spawned.map((s) => [s.id, s.x, s.y]), [[NORA, 356, 495]]);
    assert.equal(p.doors.length, 0);

    // from the garden into the house through door 72 while she is near
    p.x = 355;
    p.y = 492;
    await witch.onWallObjectCommandOne(p, wallObject(72, 356, 492, 1));
    assert.deepEqual(p.doors, [[72, undefined]]);
    assert.ok(p.messages.includes('The witch disappears into the shed'));
    assert.equal(p.questStages.witchsHouse, 3);
    assert.equal(p.cache.witchSpawned, undefined);
    assert.equal(p.world.npcList.filter((n) => n.id === NORA).length, 0);

    // stage 3: the shed opens
    await witch.onWallObjectCommandOne(p, shed);
    assert.deepEqual(p.doors[1], [73, undefined]);
});

test('caught in the garden by the witch: teleported away, back to stage 1, the magnet forgotten', async () => {
    const shed = wallObject(73, 351, 492, 0);
    const world = fakeWorld();
    const p = player({ world, stage: 2, x: 351, y: 493, cache: { witchSpawned: true, foundMagnet: true } });
    world.npcList.push(fakeNpc(NORA, { x: 356, y: 495 }));

    await witch.onWallObjectCommandOne(p, shed);
    assert.deepEqual(p.teleports, [[347, 616]]);
    assert.equal(p.questStages.witchsHouse, 1);
    assert.equal(p.cache.foundMagnet, undefined);
    const nora = world.spawned.find((s) => s.id === NORA);
    assert.deepEqual([nora.x, nora.y], [355, 494]);

    // the shed is locked before stage 2
    const q = player({ stage: 1 });
    await witch.onWallObjectCommandOne(q, shed);
    assert.deepEqual(q.messages, ['@que@The shed door is locked']);
});

test('the shapeshifter guards the ball, takes four forms, then the ball is yours and the boy ends the quest', async () => {
    const world = fakeWorld();
    const human = fakeNpc(244, { x: 351, y: 490 });
    world.npcList.push(human);
    const p = player({ world, stage: 3, x: 351, y: 491 });
    const ball = { id: BALL, x: 351, y: 491 };

    // the ball is guarded
    assert.equal(await witch.onGroundItemTake(p, ball), true);
    assert.deepEqual(human.attacked, [p]);

    // each form gives way to the next, which attacks once the kill is done
    for (const [id, name] of [[244, 'spider'], [245, 'bear'], [246, 'wolf']]) {
        const form = id === 244 ? human : world.npcList.find((n) => n.id === id);
        assert.equal(await witch.onNPCDeath(p, form), false);
        const next = world.npcList.find((n) => n.id === id + 1);
        assert.ok(next, `form ${id + 1} spawned`);
        assert.equal(next.retreats, false);
        assert.equal(p.messages.at(-1), `The shapeshifer turns into a ${name}!`);
        world.runTimeouts();
        assert.deepEqual(next.attacked, [p]);
    }

    const wolf = world.npcList.find((n) => n.id === 247);
    assert.equal(await witch.onNPCDeath(p, wolf), false);
    assert.equal(p.cache.shapeshifter, true);
    assert.equal(p.messages.at(-1), 'You finally kill the shapeshifter once and for all');

    // now the ball can be taken (the default pick-up)
    assert.equal(await witch.onGroundItemTake(p, ball), false);
    p.inventory.add(BALL);

    p.answers = [];
    assert.equal(await witch.onTalkToNPC(p, fakeNpc(BOY)), true);
    assert.equal(p.inventory.has(BALL), false);
    assert.equal(p.completed.length, 1);
    const [key, reward] = p.completed[0];
    assert.equal(key, 'witchsHouse');
    assert.equal(reward.questPoints, 4);
    assert.deepEqual(reward.experience, { hits: 1300 + 600 * p.skills.hits.base });
    assert.equal(reward.message, 'Well done you have completed the Witches house quest');
    assert.equal(p.cache.shapeshifter, undefined);
});

test('after the quest: the ball stays, the boy thanks you, the shapeshifter will not fight', async () => {
    const p = player({ stage: -1, cache: { shapeshifter: true } });
    assert.equal(await witch.onGroundItemTake(p, { id: BALL, x: 351, y: 491 }), true);
    assert.deepEqual(p.said, ["I'd better not take it, its not mine"]);

    const boy = fakeNpc(BOY);
    await witch.onTalkToNPC(p, boy);
    assert.deepEqual(boy.said, ['Thankyou for getting my ball back']);

    assert.equal(await witch.onNPCAttack(p, fakeNpc(244)), true);
    assert.equal(p.messages.at(-1), 'I have already done that quest');
    assert.equal(await witch.onNPCAttack(player({ stage: 3 }), fakeNpc(244)), false);
});

test('a ball returned before stage 3 is taken without finishing the quest', async () => {
    const p = player({ stage: 2, items: [BALL] });
    await witch.onTalkToNPC(p, fakeNpc(BOY));
    assert.equal(p.inventory.has(BALL), false);
    assert.equal(p.completed.length, 0);
    assert.equal(p.questStages.witchsHouse, 2);
});
