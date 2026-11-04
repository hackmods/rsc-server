// Scorpion Catcher (quests/members/scorpion-catcher.js, port of ScorpionCatcher.java): every stage driven with fakes.
// The jail and dusty-key doors on the way are wall-objects/key-doors.js (test/key-doors.test.js).

const test = require('node:test');
const assert = require('node:assert/strict');

const scorpionCatcher = require('../src/plugins/quests/members/scorpion-catcher');
const { fakeNpc, fakePlayer, wallObject } = require('./quest-fakes-2a');

const { CAGE } = scorpionCatcher;
const THORMAC = 300;
const SEER = 301;
const VELRAK = 272;
const TAVERLEY = 302;
const BARBARIAN = 303;
const MONASTERY = 304;

function player(opts = {}) {
    return fakePlayer({ quest: 'scorpionCatcher', ...opts });
}

test('stage 0: Thormac hands over the cage and sends you to the seers (stage 1)', async () => {
    // "What do you need assistance with?" -> "So how would I go about catching them then?" -> "Ok I will do it then"
    const p = player({ answers: [0, 0, 1] });
    assert.equal(await scorpionCatcher.onTalkToNPC(p, fakeNpc(THORMAC)), true);
    assert.equal(p.questStages.scorpionCatcher, 1);
    assert.ok(p.inventory.has(CAGE.none));
    assert.ok(p.messages.includes('Thormac gives you a cage'));

    // "I'm a little busy" starts nothing
    const q = player({ answers: [1] });
    await scorpionCatcher.onTalkToNPC(q, fakeNpc(THORMAC));
    assert.equal(q.questStages.scorpionCatcher, 0);
    assert.ok(!q.inventory.has(CAGE.none));

    // "What's in it for me?" then "So how would I go..." also starts it
    const r = player({ answers: [0, 1, 0, 1] });
    await scorpionCatcher.onTalkToNPC(r, fakeNpc(THORMAC));
    assert.equal(r.questStages.scorpionCatcher, 1);
});

test('stage 1: the seer looks into his mirror (stage 2); scorpions cannot be caught before', async () => {
    const early = player({ stage: 1, items: [CAGE.none] });
    const scorpion = fakeNpc(TAVERLEY);
    assert.equal(await scorpionCatcher.onUseWithNPC(early, scorpion, { id: CAGE.none }), true);
    assert.deepEqual(early.messages, ['Talk to Seer before you attempt catching this scorpion']);
    assert.ok(early.inventory.has(CAGE.none));

    const p = player({ stage: 1, items: [CAGE.none], answers: [1] });
    const seer = fakeNpc(SEER);
    await scorpionCatcher.onTalkToNPC(p, seer);
    assert.equal(p.questStages.scorpionCatcher, 2);
    assert.ok(p.messages.includes('The seer produces a small mirror'));
    assert.ok(seer.said.includes("He's gone into some sort of secret room"));
});

test('stage 2: the secret wall opens only now, and the cage fills one scorpion at a time in any order', async () => {
    const wall = wallObject(87, 383, 3353);
    const before = player({ stage: 1 });
    assert.equal(await scorpionCatcher.onWallObjectCommandOne(before, wall), true);
    assert.deepEqual(before.doors, []);

    const p = player({ stage: 2, items: [CAGE.none] });
    await scorpionCatcher.onWallObjectCommandOne(p, wall);
    assert.deepEqual(p.doors, [[87, undefined]]);
    assert.ok(p.messages.includes('You just went through a secret door'));
    assert.equal(await scorpionCatcher.onWallObjectCommandOne(p, wallObject(87, 383, 3000)), false);

    // monastery first, then taverley, then barbarian
    await scorpionCatcher.onUseWithNPC(p, fakeNpc(MONASTERY), { id: CAGE.none });
    assert.ok(p.inventory.has(CAGE.three));
    assert.equal(p.world.removed.length, 1);

    // the same scorpion again is not claimed (the cage already holds it)
    assert.equal(await scorpionCatcher.onUseWithNPC(p, fakeNpc(MONASTERY), { id: CAGE.three }), false);

    await scorpionCatcher.onUseWithNPC(p, fakeNpc(TAVERLEY), { id: CAGE.three });
    assert.ok(p.inventory.has(CAGE.oneThree));
    await scorpionCatcher.onUseWithNPC(p, fakeNpc(BARBARIAN), { id: CAGE.oneThree });
    assert.ok(p.inventory.has(CAGE.oneTwoThree));
    assert.equal(p.inventory.items.length, 1);
    assert.equal(p.messages.filter((m) => m === 'You catch a scorpion').length, 3);

    // anything else on a scorpion
    const q = player({ stage: 2 });
    await scorpionCatcher.onUseWithNPC(q, fakeNpc(BARBARIAN), { id: 10 });
    assert.deepEqual(q.messages, ['Nothing interesting happens']);
});

test('stage 2: the seer gives the next hint for what the cage still lacks', async () => {
    const hints = [
        [CAGE.none, 'Where did you say that scorpion was again?'],
        [CAGE.one, 'Hi I have retrieved the scorpion from near the spiders'],
        [CAGE.oneTwo, 'I have retrieved a second scoprion']
    ];

    for (const [cage, line] of hints) {
        const p = player({ stage: 2, items: [cage] });
        await scorpionCatcher.onTalkToNPC(p, fakeNpc(SEER));
        assert.ok(p.said.includes(line), line);
    }
});

test('Velrak gives the dusty key once', async () => {
    const p = player({ answers: [0, 0] });
    await scorpionCatcher.onTalkToNPC(p, fakeNpc(VELRAK));
    assert.ok(p.inventory.has(596));
    assert.ok(p.messages.includes('Velrak reaches inside his boot and passes you a key'));

    await scorpionCatcher.onTalkToNPC(p, fakeNpc(VELRAK));
    assert.ok(p.said.includes('Are you still here?'));
    assert.equal(p.inventory.count(596), 1);
});

test('Thormac: a lost cage is replaced; the full cage completes the quest; then the staff enchanting', async () => {
    const lost = player({ stage: 2, answers: [0] });
    await scorpionCatcher.onTalkToNPC(lost, fakeNpc(THORMAC));
    assert.ok(lost.inventory.has(CAGE.none));

    const p = player({ stage: 2, items: [CAGE.oneTwoThree], levels: { strength: 40 } });
    await scorpionCatcher.onTalkToNPC(p, fakeNpc(THORMAC));
    assert.equal(p.questStages.scorpionCatcher, -1);
    assert.deepEqual(p.completed, [
        [
            'scorpionCatcher',
            {
                questPoints: 1,
                experience: { strength: 1500 + 500 * 40 },
                message: 'Well done you have completed the scorpion catcher quest'
            }
        ]
    ]);
    assert.ok(!p.inventory.has(CAGE.oneTwoThree));

    const rich = player({ stage: -1, items: [[10, 50000], 616], answers: [1, 1] });
    await scorpionCatcher.onTalkToNPC(rich, fakeNpc(THORMAC));
    assert.ok(rich.inventory.has(683));
    assert.equal(rich.inventory.count(10), 10000);
    assert.ok(rich.messages.includes('Thormac enchants your staff'));

    const poor = player({ stage: -1, items: [[10, 100], 615], answers: [1, 0] });
    await scorpionCatcher.onTalkToNPC(poor, fakeNpc(THORMAC));
    assert.ok(poor.inventory.has(615));
    assert.ok(poor.said.includes("I'll just get the money for you"));
});
