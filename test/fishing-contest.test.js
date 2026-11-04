// Fishing Contest (quests/members/fishing-contest.js, port of FishingContest.java): every stage driven with fake
// objects, plus the loose fence into McGrubor's wood (wall-objects/loose-fence.js) and the stairs climbable.js leaves alone.

const test = require('node:test');
const assert = require('node:assert/strict');

const contest = require('../src/plugins/quests/members/fishing-contest');
const looseFence = require('../src/plugins/wall-objects/loose-fence');
const climbable = require('../src/plugins/game-objects/climbable');
const { fakeNpc, fakeWorld, fakePlayer, gameObject, wallObject } = require('./quest-fakes');

const GRANDPA_JACK = 345;
const SINISTER = 346;
const BONZO = 347;
const MORRIS = 349;
const DWARF = 355;

const COINS = 10;
const SPADE = 211;
const GARLIC = 218;
const ROD = 377;
const BAIT = 380;
const WORMS = 715;
const CARP = 717;
const SARDINE = 354;
const SHRIMP = 349;
const PASS = 719;
const TROPHY = 720;

// the contest grounds: Bonzo, Morris and the stranger in view
function contestWorld() {
    return fakeWorld({
        npcs: [
            fakeNpc(BONZO, { x: 566, y: 491 }),
            fakeNpc(MORRIS, { x: 563, y: 493 }),
            fakeNpc(SINISTER, { x: 568, y: 489, minX: 563, maxX: 573, minY: 484, maxY: 494 })
        ]
    });
}

function player(opts = {}) {
    return fakePlayer({ quest: 'fishingContest', ...opts });
}

test('stage 0: the dwarf is talked round and hands over the competition pass (stage 1)', async () => {
    const p = player({ answers: [0, 1, 2, 0, 0, 0] });
    const dwarf = fakeNpc(DWARF);
    assert.equal(await contest.onTalkToNPC(p, dwarf), true);
    assert.equal(p.questStages.fishingContest, 1);
    assert.ok(p.inventory.has(PASS));
    assert.ok(dwarf.said.includes('go to Hemenster and do us proud'));

    // "I'm not much of a fisherman either": no pass
    const q = player({ answers: [0, 1, 2, 0, 0, 1] });
    await contest.onTalkToNPC(q, fakeNpc(DWARF));
    assert.equal(q.questStages.fishingContest, 0);
    assert.equal(q.inventory.has(PASS), false);
});

test('the stairs: the dwarf halts you before the quest, lets you down after it', async () => {
    const world = fakeWorld({ npcs: [fakeNpc(DWARF, { x: 427, y: 456 })] });
    const stairs = gameObject(359, 426, 458);
    const p = player({ world, answers: [1] });
    assert.equal(await contest.onGameObjectCommandOne(p, stairs), true);
    assert.deepEqual(world.npcList[0].said, ['Hoi there, halt', "You can't come in here"]);
    assert.deepEqual(p.teleports, []);

    const done = player({ stage: -1 });
    await contest.onGameObjectCommandOne(done, stairs);
    assert.deepEqual(done.teleports, [[426, 3294]]);
    await contest.onGameObjectCommandOne(done, gameObject(359, 385, 466));
    assert.deepEqual(done.teleports[1], [385, 3301]);

    // the generic climb no longer claims these stairs (nor the Entrana ladder)
    assert.equal(await climbable.onGameObjectCommandOne(done, stairs), false);
    assert.equal(await climbable.onGameObjectCommandOne(done, gameObject(244, 426, 548)), false);
});

test('a lost pass: the dwarf hands out a spare unless it is carried or banked', async () => {
    const p = player({ stage: 1, answers: [0] });
    await contest.onTalkToNPC(p, fakeNpc(DWARF));
    assert.ok(p.inventory.has(PASS));

    const banked = player({ stage: 2, banked: [PASS] });
    await contest.onTalkToNPC(banked, fakeNpc(DWARF));
    assert.deepEqual(banked.said, ['No not yet']);
});

test('stage 1: Grandpa Jack tells of the carp and the red vine worms (stage 2)', async () => {
    const p = player({ stage: 1, answers: [1, 0] });
    const jack = fakeNpc(GRANDPA_JACK);
    await contest.onTalkToNPC(p, jack);
    assert.equal(p.questStages.fishingContest, 2);
    assert.ok(jack.said.includes('The best sort of bait for them is red vine worms'));

    // before the quest he only has his story
    const q = player({ stage: 0, answers: [1] });
    const jack2 = fakeNpc(GRANDPA_JACK);
    await contest.onTalkToNPC(q, jack2);
    assert.deepEqual(q.asked[0], ['Tell me a story then', "Sorry I don't have time now"]);
});

test('red vine worms: a spade on the vines; the loose fence lets you into the wood', async () => {
    const p = player({ stage: 2, items: [SPADE] });
    const vine = gameObject(355, 567, 451);
    assert.equal(await contest.onUseWithGameObject(p, vine, { id: SPADE }), true);
    assert.equal(p.inventory.count(WORMS), 1);
    // anything else on the vines does nothing at all
    assert.equal(await contest.onUseWithGameObject(p, vine, { id: COINS }), true);
    assert.equal(p.inventory.count(WORMS), 1);

    const fence = wallObject(101, 540, 445, 1);
    assert.equal(await looseFence.onWallObjectCommandOne(p, fence), true);
    assert.deepEqual(p.doors, [[101, 16]]);
    assert.deepEqual(p.messages.slice(-1), ['You push your way through the fence']);
    assert.equal(await looseFence.onWallObjectCommandOne(p, wallObject(101, 634, 705, 0)), true);
    assert.equal(await looseFence.onWallObjectCommandOne(p, wallObject(101, 100, 100, 0)), false);
});

test('the gate: Morris wants the pass, then lets you through', async () => {
    const gate = gameObject(358, 564, 492);
    const world = contestWorld();
    const p = player({ world, stage: 1, x: 563, y: 492, answers: [1] });
    await contest.onGameObjectCommandOne(p, gate);
    assert.deepEqual(p.gates, []);
    assert.ok(world.npcList.find((n) => n.id === MORRIS).said.includes('Invitation only'));

    p.inventory.add(PASS);
    await contest.onGameObjectCommandOne(p, gate);
    assert.deepEqual(p.gates, [[358, 357]]);
});

test('the contest: Bonzo takes 5 coins, garlic moves the stranger, three casts with worms win the trophy (stage 3)', async () => {
    const world = contestWorld();
    const p = player({
        world,
        stage: 2,
        x: 566,
        y: 492,
        items: [ROD, GARLIC, [COINS, 7], [WORMS, 1], [WORMS, 1], [WORMS, 1]],
        levels: { fishing: 30 },
        answers: [0]
    });
    const bonzo = world.npcList.find((n) => n.id === BONZO);

    // the pipe spot belongs to the stranger until the garlic
    const carpSpot = gameObject(352, 570, 489);
    await contest.onGameObjectCommandOne(p, carpSpot); // not paid: Bonzo asks for the fee (answer 0)
    assert.equal(p.cache.paidContestFee, true);
    assert.equal(p.inventory.count(COINS), 2);
    assert.ok(p.messages.includes('Your fishing competition spot is beside the oak tree'));

    p.answers = [];
    await contest.onGameObjectCommandOne(p, carpSpot);
    const stranger = world.npcList.find((n) => n.id === SINISTER);
    assert.ok(stranger.said.includes('I like to savour the aroma coming from these pipes'));
    assert.equal(p.inventory.has(CARP), false);

    await contest.onUseWithGameObject(p, gameObject(350, 570, 488), { id: GARLIC });
    assert.equal(p.cache.garlicActivated, true);
    assert.equal(p.inventory.has(GARLIC), false);
    assert.ok(p.messages.includes('Your fishing competition spot has been moved to beside the pipes'));
    const moved = world.npcList.find((n) => n.id === SINISTER);
    assert.deepEqual([moved.x, moved.y], [570, 495]);

    // with garlic down, the oak tree spot is the stranger's
    await contest.onGameObjectCommandOne(p, gameObject(351, 571, 495));
    assert.equal(p.inventory.has(SARDINE), false);

    for (let i = 0; i < 3; i += 1) {
        await contest.onGameObjectCommandOne(p, carpSpot);
    }

    assert.ok(bonzo.said.includes('We have a new winner'));
    assert.equal(p.questStages.fishingContest, 3);
    assert.ok(p.inventory.has(TROPHY));
    assert.equal(p.inventory.has(CARP), false, 'the catch is handed over');
    assert.equal(p.inventory.has(WORMS), false);
    assert.equal(p.cache.paidContestFee, undefined);
    assert.equal(p.cache.contestCatches, undefined);

    // back out through the gate at stage 3, and the dwarf takes the trophy
    p.x = 565;
    await contest.onGameObjectCommandOne(p, gameObject(358, 564, 492));
    assert.deepEqual(p.gates, [[358, 357]]);

    await contest.onTalkToNPC(p, fakeNpc(DWARF));
    assert.equal(p.inventory.has(TROPHY), false);
    const [key, reward] = p.completed[0];
    assert.equal(key, 'fishingContest');
    assert.equal(reward.questPoints, 1);
    assert.deepEqual(reward.experience, { fishing: 900 + 800 + 300 * 30 });
    assert.equal(reward.message, 'Well done you have completed the fishing competition quest');
});

test('without a carp the contest is lost: the oak tree spot gives sardines and shrimps', async () => {
    const world = contestWorld();
    const p = player({
        world,
        stage: 2,
        items: [ROD, [WORMS, 1], [BAIT, 1], [BAIT, 1]],
        levels: { fishing: 15 },
        cache: { paidContestFee: true }
    });
    const oak = gameObject(351, 571, 495);
    await contest.onGameObjectCommandOne(p, oak);
    assert.ok(p.inventory.has(SARDINE));
    await contest.onGameObjectCommandOne(p, oak);
    await contest.onGameObjectCommandOne(p, oak);
    assert.ok(world.npcList.find((n) => n.id === BONZO).said.includes('And the winner is...'));
    assert.equal(p.questStages.fishingContest, 2);
    assert.equal(p.inventory.has(TROPHY), false);
    assert.equal(p.inventory.has(SARDINE) || p.inventory.has(SHRIMP), false);
});

test('the contest spots refuse low fishing, no rod and no bait', async () => {
    const carpSpot = gameObject(352, 570, 489);
    const cache = () => ({ paidContestFee: true, garlicActivated: true });

    const low = player({ world: contestWorld(), stage: 2, items: [ROD, WORMS], levels: { fishing: 9 }, cache: cache() });
    await contest.onGameObjectCommandOne(low, carpSpot);
    assert.deepEqual(low.messages, ['You need at least level 10 fishing to lure these fish']);

    const noRod = player({ world: contestWorld(), stage: 2, items: [WORMS], levels: { fishing: 20 }, cache: cache() });
    await contest.onGameObjectCommandOne(noRod, carpSpot);
    assert.deepEqual(noRod.messages, ["I don't have the equipment to catch a fish"]);

    const noBait = player({ world: contestWorld(), stage: 2, items: [ROD], levels: { fishing: 20 }, cache: cache() });
    await contest.onGameObjectCommandOne(noBait, carpSpot);
    assert.deepEqual(noBait.messages, ['you have no bait to catch fish here']);

    const done = player({ world: contestWorld(), stage: -1, cache: {} });
    await contest.onGameObjectCommandOne(done, carpSpot);
    assert.deepEqual(done.messages, ['@que@you have already won the fishing competition']);
});

test('garlic on the stranger, and his talk only once the quest started', async () => {
    const p = player({ stage: 1, answers: [1, 0] });
    const vlad = fakeNpc(SINISTER);
    assert.equal(await contest.onUseWithNPC(p, vlad, { id: GARLIC }), true);
    assert.ok(vlad.said.includes("I can't stand even to be near it for ten seconds"));

    const talker = fakeNpc(SINISTER);
    await contest.onTalkToNPC(p, talker);
    assert.ok(talker.said.includes('My name is Vlad'));

    const before = player({ stage: 0 });
    const silent = fakeNpc(SINISTER);
    assert.equal(await contest.onTalkToNPC(before, silent), true);
    assert.deepEqual(silent.said, []);
});
