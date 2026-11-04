// The Holy Grail (quests/members/holy-grail.js, npcs/entrana/high-priest-of-entrana.js, port of TheHolyGrail.java and
// HighPriestOfEntrana.java): every stage driven with fake objects, from Merlin's advice to the second island. King Arthur
// (merlins-crystal/camelot.js) and Brother Galahad have their own tests.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const grail = require('../src/plugins/quests/members/holy-grail');
const priest = require('../src/plugins/npcs/entrana/high-priest-of-entrana');
const { fakeNpc, fakeWorld, fakePlayer, gameObject, wallObject } = require('./quest-fakes-3b');

const MERLIN = 393;
const CRONE = 394;
const HIGH_PRIEST = 395;
const TITAN = 401;
const PERCIVAL = 411;
const FISHER_KING = 412;
const MAIDEN = 413;
const FISHERMAN = 414;
const KING_PERCIVAL = 415;
const UNHAPPY_PEASANT = 416;
const HAPPY_PEASANT = 417;

const BELL = 743;
const WHISTLE = 738;
const FEATHER = 745;
const GRAIL = 746;
const BIG_BONES = 413;
const EXCALIBUR = 606;

const PLUGIN_TYPES = [
    .../const PLUGIN_TYPES = \[([\s\S]*?)\]/
        .exec(fs.readFileSync(require.resolve('../src/model/world.js'), 'utf8'))[1]
        .matchAll(/'(\w+)'/g)
].map((m) => m[1]);

function player(opts = {}) {
    const p = fakePlayer({ quest: 'theHolyGrail', ...opts });
    p.getDistance = (e) => Math.max(Math.abs(e.x - p.x), Math.abs(e.y - p.y));
    return p;
}

test('every exported hook is a plugin type', () => {
    for (const mod of [grail, priest]) {
        for (const name of Object.keys(mod)) {
            assert.ok(PLUGIN_TYPES.includes(name), name);
        }
    }
});

test('stage 1: Merlin gives the advice (2); stages 2-3 repeat it; Sir Galahad question', async () => {
    const p = player({ stage: 1, answers: [1] });
    const merlin = fakeNpc(MERLIN);
    assert.equal(await grail.onTalkToNPC(p, merlin), true);
    assert.equal(p.questStages.theHolyGrail, 2);
    assert.ok(merlin.said.includes('I believe there is a holy island somewhere not far away'));
    assert.ok(merlin.said.includes('He lives somewhere west of McGrubors Wood'));
    assert.equal(p.interlocutor, null);

    for (const stage of [2, 3]) {
        const q = player({ stage, answers: [0] });
        await grail.onTalkToNPC(q, fakeNpc(MERLIN));
        assert.equal(q.questStages.theHolyGrail, stage);
        assert.ok(q.said.includes('Thankyou for the advice'));
    }

    // stages 0, 4 and 5: the Java claims Merlin but says nothing
    for (const stage of [0, 4, 5]) {
        const q = player({ stage });
        const n = fakeNpc(MERLIN);
        assert.equal(await grail.onTalkToNPC(q, n), true);
        assert.deepEqual(n.said, []);
    }

    const done = player({ stage: -1 });
    const n = fakeNpc(MERLIN);
    await grail.onTalkToNPC(done, n);
    assert.ok(n.said.includes('To turn people into hedgehogs'));
});

test('the High priest of Entrana: the Crone sends the knight on (2 -> 3) and the follow-ups', async () => {
    const world = fakeWorld({ npcs: [fakeNpc(CRONE)] });
    const crone = world.npcList[0];

    const before = player({ world, stage: 1 });
    const n = fakeNpc(HIGH_PRIEST);
    assert.equal(await priest.onTalkToNPC(before, n), true);
    assert.deepEqual(n.said, ['Many greetings welcome to our fair island', 'enjoy your stay hear', 'May it be spiritually uplifting']);
    assert.equal(before.questStages.theHolyGrail, 1);

    const p = player({ world, stage: 2, answers: [2] });
    const pr = fakeNpc(HIGH_PRIEST);
    await priest.onTalkToNPC(p, pr);
    assert.equal(p.questStages.theHolyGrail, 3);
    assert.ok(pr.said.includes('Nor do I really care'));
    assert.ok(crone.said.includes('Go to where the six heads face'));
    assert.equal(p.interlocutor, null);

    // six heads -> whistle -> fisher king -> back, spoken by the Crone from then on
    crone.said.length = 0;
    const deep = player({ world, stage: 3, answers: [0, 0] });
    await priest.onTalkToNPC(deep, fakeNpc(HIGH_PRIEST));
    assert.equal(deep.questStages.theHolyGrail, 3);
    assert.ok(crone.said.includes('Find where two of the heads face'));
    assert.ok(crone.said.includes('The fisher king is the owner and slave of the grail'));
    assert.ok(deep.said.includes('What are the four heads?'));

    // the whistle, then "Ok I will go searching"
    crone.said.length = 0;
    const whistle = player({ world, stage: 3, answers: [3, 2] });
    await priest.onTalkToNPC(whistle, fakeNpc(HIGH_PRIEST));
    assert.ok(crone.said.includes('the whistles are easy'));
    assert.ok(whistle.said.includes('Ok I will go searching'));

    // the point of realm crossing
    crone.said.length = 0;
    const realm = player({ world, stage: 3, answers: [0, 3] });
    await priest.onTalkToNPC(realm, fakeNpc(HIGH_PRIEST));
    assert.ok(crone.said.includes("Where it's easiest to cross that is a point of realm crossing"));

    // no Crone near: the priest says his part and nothing else
    const alone = player({ stage: 2 });
    const pr2 = fakeNpc(HIGH_PRIEST);
    await priest.onTalkToNPC(alone, pr2);
    assert.equal(alone.questStages.theHolyGrail, 2);
    assert.ok(pr2.said.includes('Nor do I really care'));

    assert.equal(await priest.onTalkToNPC(player(), fakeNpc(1)), false);
});

test('the doors: Merlin\'s workshop needs Merlin\'s Crystal; the whistle door drops two whistles', async () => {
    const door117 = wallObject(117, 463, 1384, 1);

    const shut = player({ stage: 1 });
    await grail.onWallObjectCommandOne(shut, door117);
    assert.deepEqual(shut.messages, ["The door won't open"]);

    const open = player({ stage: 1 });
    open.questStages.merlinsCrystal = -1;
    await grail.onWallObjectCommandOne(open, door117);
    assert.deepEqual(open.doors, [[117, undefined]]);

    const finished = player({ stage: -1 });
    await grail.onWallObjectCommandOne(finished, door117);
    assert.equal(finished.doors.length, 1);

    const notStarted = player({ stage: 0 });
    notStarted.questStages.merlinsCrystal = -1;
    await grail.onWallObjectCommandOne(notStarted, door117);
    assert.deepEqual(notStarted.doors, []);

    const door116 = wallObject(116, 202, 2438, 0);
    const early = player({ stage: 2 });
    await grail.onWallObjectCommandOne(early, door116);
    assert.deepEqual(early.doors, [[116, undefined]]);
    assert.deepEqual(early.world.drops, []);

    const quester = player({ stage: 3 });
    assert.equal(await grail.onWallObjectCommandOne(quester, door116), true);
    assert.deepEqual(
        quester.world.drops.map((d) => [d.id, d.x, d.y]),
        [
            [WHISTLE, 204, 2440],
            [WHISTLE, 204, 2440]
        ]
    );
    assert.ok(quester.messages.includes('You go through the door'));

    const rich = player({ stage: 4, items: [[WHISTLE, 2]] });
    await grail.onWallObjectCommandOne(rich, door116);
    assert.deepEqual(rich.world.drops, []);

    const after = player({ stage: -1 });
    await grail.onWallObjectCommandOne(after, door116);
    assert.equal(after.world.drops.length, 2);

    assert.equal(await grail.onWallObjectCommandOne(player(), wallObject(1, 1, 1)), false);
});

test('the whistle: the plot, the first island, the second island and nowhere else', async () => {
    const whistle = { id: WHISTLE };

    const plot = player({ stage: 3, x: 490, y: 652 });
    await grail.onInventoryCommand(plot, whistle);
    assert.deepEqual(plot.teleports, [[396, 18]]);

    const later = player({ stage: 5, x: 491, y: 653 });
    await grail.onInventoryCommand(later, whistle);
    assert.deepEqual(later.teleports, [[492, 18]]);

    const done = player({ stage: -1, x: 490, y: 653 });
    await grail.onInventoryCommand(done, whistle);
    assert.deepEqual(done.teleports, [[492, 18]]);

    for (const [x, y] of [
        [400, 20],
        [500, 30],
        [515, 980],
        [515, 1922]
    ]) {
        const p = player({ stage: 3, x, y });
        await grail.onInventoryCommand(p, whistle);
        assert.deepEqual(p.teleports, [[490, 651]], `${x},${y}`);
    }

    const nowhere = player({ stage: 3, x: 100, y: 100 });
    await grail.onInventoryCommand(nowhere, whistle);
    assert.deepEqual(nowhere.teleports, []);
    assert.deepEqual(nowhere.messages, ['@que@The whistle makes no noise', '@que@It will not work in this location']);
});

test('the fisherman points at the bells; ringing one at the gate goes inside', async () => {
    const p = player({ stage: 3, answers: [1] });
    const fisherman = fakeNpc(FISHERMAN);
    await grail.onTalkToNPC(p, fisherman);
    assert.ok(fisherman.said.includes('just ring one of the bells outside'));
    assert.deepEqual(
        p.world.drops.map((d) => [d.id, d.x, d.y]),
        [[BELL, 421, 30]]
    );

    for (const [answer, line] of [
        [0, 'Not many fish can live in this gungey stuff'],
        [2, 'the land seems to be dying too']
    ]) {
        const q = player({ stage: 3, answers: [answer] });
        const f = fakeNpc(FISHERMAN);
        await grail.onTalkToNPC(q, f);
        assert.ok(f.said.includes(line));
        assert.deepEqual(q.world.drops, []);
    }

    const outside = player({ stage: 3, x: 420, y: 29, world: fakeWorld({ npcs: [fakeNpc(MAIDEN)] }) });
    const rng = Math.random;
    Math.random = () => 0.1;
    try {
        await grail.onInventoryCommand(outside, { id: BELL });
    } finally {
        Math.random = rng;
    }
    assert.deepEqual(outside.teleports, [[420, 35]]);
    assert.ok(outside.world.npcList[0].said.includes('welcome to the grail castle'));
    assert.deepEqual(outside.messages, ['Ting a ling a ling', 'Somehow you are now inside the castle']);

    const far = player({ stage: 3, x: 300, y: 300 });
    await grail.onInventoryCommand(far, { id: BELL });
    assert.deepEqual(far.teleports, []);
    assert.deepEqual(far.messages, ['Ting a ling a ling']);
});

test('the Fisher King: stage 3 -> 4; the menus end where the Java ends them', async () => {
    const p = player({ stage: 3, answers: [1, 0] });
    const king = fakeNpc(FISHER_KING);
    assert.equal(await grail.onTalkToNPC(p, king), true);
    assert.equal(p.questStages.theHolyGrail, 4);
    assert.ok(king.said.includes('At the moment the grail cannot be removed from the castle'));
    assert.ok(king.said.includes('He is known as Percival'));
    assert.ok(p.said.includes('Who is your son?'));
    assert.deepEqual(p.asked[1], ["You don't look to well", 'Do you mind if I have a look around?']);

    // already past stage 3: no stage change; the clue path ends with a look around
    const q = player({ stage: 5, answers: [0, 2] });
    const k2 = fakeNpc(FISHER_KING);
    await grail.onTalkToNPC(q, k2);
    assert.equal(q.questStages.theHolyGrail, 5);
    assert.ok(k2.said.includes('And the crone'));
    assert.ok(k2.said.includes('No not at all, be my guest'));

    const clue = player({ stage: 4, answers: [0, 0, 1] });
    const k3 = fakeNpc(FISHER_KING);
    await grail.onTalkToNPC(clue, k3);
    assert.ok(k3.said.includes('None at all'));
    assert.ok(k3.said.includes('No not at all, be my guest'));

    const well = player({ stage: 4, answers: [2] });
    const k4 = fakeNpc(FISHER_KING);
    await grail.onTalkToNPC(well, k4);
    assert.ok(k4.said.includes("Nope I don't feel so good either"));

    const sick = player({ stage: 4, answers: [0, 1] });
    const k5 = fakeNpc(FISHER_KING);
    await grail.onTalkToNPC(sick, k5);
    assert.ok(k5.said.includes('I am waiting for my son to return to this castle'));
});

test('the peasants, the new king and the titan\'s challenge', async () => {
    for (const [id, line] of [
        [UNHAPPY_PEASANT, 'Woe is me'],
        [HAPPY_PEASANT, 'Oh happy day'],
        [KING_PERCIVAL, 'You missed all the excitement']
    ]) {
        const n = fakeNpc(id);
        assert.equal(await grail.onTalkToNPC(player({ stage: 5 }), n), true);
        assert.equal(n.said[0], line);
    }

    const titan = fakeNpc(TITAN);
    const fight = player({ stage: 4, answers: [0] });
    await grail.onTalkToNPC(fight, titan);
    assert.ok(titan.said.includes('I am the black knight titan'));
    assert.deepEqual(titan.attacked, [fight]);

    const run = fakeNpc(TITAN);
    const coward = player({ stage: 4, answers: [1] });
    await grail.onTalkToNPC(coward, run);
    assert.deepEqual(run.attacked, []);

    assert.equal(await grail.onTalkToNPC(player(), fakeNpc(1)), false);
});

test('killing the titan: Excalibur wielded ends it with big bones; otherwise he gets up again', async () => {
    const world = fakeWorld();
    const titan = fakeNpc(TITAN, { x: 413, y: 11 });
    titan.skills = { hits: { current: 0, base: 148 } };
    titan.abandonFight = () => {
        titan.abandoned = true;
    };

    const unarmed = player({ world, stage: 4 });
    assert.equal(await grail.onNPCDeath(unarmed, titan), true);
    assert.equal(titan.skills.hits.current, 148);
    assert.equal(titan.abandoned, true);
    assert.deepEqual(titan.said, ["You can't defeat me little man", "I'm invincible!"]);
    assert.ok(unarmed.messages.includes('Maybe you need something more to beat the titan'));
    assert.deepEqual(unarmed.teleports, []);
    assert.deepEqual(world.removed, []);

    const armed = player({ world, stage: 4, items: [EXCALIBUR], equipped: [EXCALIBUR] });
    assert.equal(await grail.onNPCDeath(armed, titan), true);
    assert.deepEqual(world.removed, [titan]);
    assert.deepEqual(
        world.drops.map((d) => [d.id, d.x, d.y]),
        [[BIG_BONES, 413, 11]]
    );
    assert.deepEqual(armed.teleports, [[414, 11]]);
    assert.ok(armed.messages.includes('Well done you have defeated the black knight titan'));

    // anything else dies as usual
    assert.equal(await grail.onNPCDeath(armed, fakeNpc(1)), false);
});

test('the first grail cannot be moved; the one on the second island can', async () => {
    const stuck = player({ stage: 4 });
    assert.equal(await grail.onGroundItemTake(stuck, { id: GRAIL, x: 418, y: 1924 }), true);
    assert.ok(stuck.messages.includes('@que@You feel that the grail shouldn\'t be moved'));

    assert.equal(await grail.onGroundItemTake(stuck, { id: GRAIL, x: 514, y: 1924 }), false);
    assert.equal(await grail.onGroundItemTake(stuck, { id: 1, x: 418, y: 1924 }), false);
});

test('the sack: Sir Percival at stage 4; a whistle sends him to the castle (5); not before', async () => {
    const sack = gameObject(408, 328, 446);

    const early = player({ stage: 3 });
    assert.equal(await grail.onGameObjectCommandOne(early, sack), true);
    assert.deepEqual(early.messages, ['nothing interesting happens']);
    assert.equal(early.world.spawned.length, 0);

    // "your father wishes to speak to you" with a whistle
    const world = fakeWorld();
    const p = player({ world, stage: 4, items: [WHISTLE], answers: [2] });
    assert.equal(await grail.onGameObjectCommandOne(p, sack), true);
    assert.equal(world.spawned.length, 1);
    assert.equal(world.spawned[0].id, PERCIVAL);
    assert.equal(world.spawned[0].ticks, Math.ceil(64000 / 640));
    assert.equal(p.questStages.theHolyGrail, 5);
    assert.equal(p.inventory.count(WHISTLE), 0);
    assert.ok(p.messages.includes('@que@You give a whistle to Sir Percival'));
    assert.ok(world.npcList[0].said.includes('Ok I will see you there then'));
    assert.equal(p.interlocutor, null);

    // the long road: how did you end up in a sack, then make him a king, no whistle
    const w2 = fakeWorld();
    const q = player({ world: w2, stage: 4, answers: [0, 0] });
    await grail.onGameObjectCommandTwo(q, sack);
    assert.equal(q.questStages.theHolyGrail, 4);
    assert.ok(w2.npcList[0].said.includes("I've been kept as a slave here for the last 3 months"));
    assert.ok(q.said.includes('I will just go and get you one'));

    const r = player({ world: fakeWorld(), stage: 4, items: [WHISTLE], answers: [1] });
    await grail.onGameObjectCommandOne(r, sack);
    assert.equal(r.questStages.theHolyGrail, 5);

    assert.equal(await grail.onGameObjectCommandOne(player(), gameObject(1, 1, 1)), false);
});

test('the golden feather points the way to the sack; done, nothing happens', async () => {
    const feather = { id: FEATHER };
    const cases = [
        [{ x: 328, y: 400 }, 'the feather points south'],
        [{ x: 380, y: 446 }, 'the feather points east'],
        [{ x: 300, y: 446 }, 'the feather points west'],
        [{ x: 328, y: 500 }, 'the feather points north']
    ];

    for (const [pos, message] of cases) {
        const p = player({ stage: 4, ...pos });
        await grail.onInventoryCommand(p, feather);
        assert.deepEqual(p.messages, [message], message);
    }

    const done = player({ stage: -1, x: 328, y: 400 });
    await grail.onInventoryCommand(done, feather);
    assert.deepEqual(done.messages, ['nothing interesting happens']);

    assert.equal(await grail.onInventoryCommand(player(), { id: 1 }), false);
});
