// Clock Tower (quests/members/clock-tower.js, port of ClockTower.java): every stage driven with fake objects, the four
// cogs and their poles, the hot black cog, the one-cog limit, the rat cage levers and gates, and the reward.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const clockTower = require('../src/plugins/quests/members/clock-tower');
const { fakeNpc, fakeWorld, fakePlayer, gameObject, wallObject } = require('./quest-fakes-3b');

const KOJO = 366;
const RAT = 367;
const COINS = 10;
const BUCKET_OF_WATER = 50;
const ICE_GLOVES = 556;
const BLUE = 727;
const BLACK = 728;
const RED = 729;
const PURPLE = 730;
const RAT_POISON = 731;

const PLUGIN_TYPES = [
    .../const PLUGIN_TYPES = \[([\s\S]*?)\]/
        .exec(fs.readFileSync(require.resolve('../src/model/world.js'), 'utf8'))[1]
        .matchAll(/'(\w+)'/g)
].map((m) => m[1]);

function player(opts = {}) {
    return fakePlayer({ quest: 'clockTower', ...opts });
}

// the fake world's replaceEntity does not touch its object list; the gates need it to
function cageWorld({ outer = 372, inner = 372, rats = 3 } = {}) {
    const world = fakeWorld({ npcs: Array.from({ length: rats }, (_, i) => fakeNpc(RAT, { x: 584 + i, y: 3475 })) });
    world.addEntity('gameObjects', gameObject(outer, 594, 3475));
    world.addEntity('gameObjects', gameObject(inner, 590, 3475));
    const replace = world.replaceEntity;
    world.replaceEntity = (type, entity, id) => {
        const next = replace(type, entity, id);
        if (type === 'gameObjects') {
            world.removeEntity(type, entity);
            world.addEntity(type, next);
        }
        return next;
    };
    return world;
}

const gateIds = (world) => [594, 590].map((x) => world.gameObjects.getAtPoint(x, 3475)[0].id);
const item = (id) => ({ id, amount: 1 });
const ground = (id, x = 600, y = 3470) => ({ id, x, y, amount: 1 });

test('every exported hook is a PLUGIN_TYPES hook', () => {
    for (const name of Object.keys(clockTower)) {
        assert.ok(PLUGIN_TYPES.includes(name), name);
    }
});

test('stage 0: Brother Kojo asks for help; "Ok old monk" starts the quest (stage 1), "Not now" does not', async () => {
    const no = player({ answers: [1] });
    const kojo = fakeNpc(KOJO, { x: 580, y: 637 });
    assert.equal(await clockTower.onTalkToNPC(no, kojo), true);
    assert.equal(no.questStages.clockTower, 0);
    assert.equal(kojo.said.at(-1), 'Ok then');
    assert.equal(no.interlocutor, null);

    const p = player({ answers: [0] });
    const k = fakeNpc(KOJO);
    await clockTower.onTalkToNPC(p, k);
    assert.equal(p.questStages.clockTower, 1);
    assert.deepEqual(p.said, ['Hello Monk', 'No... Sorry', 'Ok old monk what can I do?', "I'll do my best"]);
    assert.ok(k.said.includes('Oh thank you kind sir'));
    assert.equal(k.said.at(-1), 'Be careful, strange beasts dwell in the cellars');

    assert.equal(await clockTower.onTalkToNPC(p, fakeNpc(368)), false);
});

test('stage 1 without all four cogs: Kojo repeats where they go', async () => {
    const p = player({ stage: 1, cache: { '1st_cog': true, '2nd_cog': true, '3rd_cog': true } });
    const kojo = fakeNpc(KOJO);
    await clockTower.onTalkToNPC(p, kojo);
    assert.equal(p.questStages.clockTower, 1);
    assert.deepEqual(p.said, ['Hello again']);
    assert.equal(kojo.said.at(-1), 'Of the four tower levels');
});

test('the poles: inspect shows a missing cog, a placed cog, and a working clock after the quest', async () => {
    const purpleTop = gameObject(364, 581, 2525);
    const purpleGround = gameObject(364, 581, 637);
    const p = player({ stage: 1, cache: { '1st_cog': true } });
    assert.equal(await clockTower.onGameObjectCommandOne(p, purpleTop), true);
    assert.equal(await clockTower.onGameObjectCommandOne(p, purpleGround), true);
    assert.deepEqual(p.messages, ["There's a large cog on this pole", 'A large pole, a cog is missing']);

    const zero = player();
    await clockTower.onGameObjectCommandOne(zero, gameObject(362, 580, 3470));
    assert.deepEqual(zero.messages, ['A large pole, a cog is missing']);

    const done = player({ stage: -1 });
    await clockTower.onGameObjectCommandOne(done, gameObject(363, 582, 1582));
    assert.deepEqual(done.messages, ['The clock is now working']);
});

test('each cog fits only its own pole on its own floor, once', async () => {
    const poles = [
        [PURPLE, gameObject(364, 581, 2525), '1st_cog'],
        [BLACK, gameObject(365, 581, 639), '2nd_cog'],
        [BLUE, gameObject(362, 580, 3470), '3rd_cog'],
        [RED, gameObject(363, 582, 1582), '4th_cog']
    ];

    for (const [cog, pole, key] of poles) {
        // the same colour pole on another floor, and another colour pole
        const wrongFloor = { ...pole, y: pole.y > 944 ? pole.y - 944 * 1 : pole.y + 944 };
        const p = player({ stage: 1, items: [cog] });
        assert.equal(await clockTower.onUseWithGameObject(p, wrongFloor, item(cog)), true);
        assert.equal(p.messages.at(-1), "The cog doesn't fit");

        for (const [, other] of poles.filter(([c]) => c !== cog)) {
            await clockTower.onUseWithGameObject(p, other, item(cog));
            assert.equal(p.messages.at(-1), "The cog doesn't fit");
        }

        assert.ok(p.inventory.has(cog));
        assert.equal(await clockTower.onUseWithGameObject(p, pole, item(cog)), true);
        assert.equal(p.messages.at(-1), 'The cog fits perfectly');
        assert.equal(p.inventory.has(cog), false);
        assert.equal(p.cache[key], true);

        p.inventory.add(cog);
        await clockTower.onUseWithGameObject(p, pole, item(cog));
        assert.equal(p.messages.at(-1), 'You have already placed a cog here');
        assert.ok(p.inventory.has(cog));
    }

    // before the quest the right pole does nothing; after it, "already placed"
    const before = player({ items: [BLUE] });
    assert.equal(await clockTower.onUseWithGameObject(before, gameObject(362, 580, 3470), item(BLUE)), true);
    assert.deepEqual(before.messages, []);
    assert.ok(before.inventory.has(BLUE));

    const after = player({ stage: -1, items: [BLUE] });
    await clockTower.onUseWithGameObject(after, gameObject(362, 580, 3470), item(BLUE));
    assert.deepEqual(after.messages, ['You have already placed a cog here']);

    // other items on a pole are not ours
    assert.equal(await clockTower.onUseWithGameObject(player({ stage: 1 }), poles[0][1], item(COINS)), false);
});

test('the cogs are heavy: only one at a time', async () => {
    for (const cog of [BLUE, RED, PURPLE]) {
        const free = player({ stage: 1 });
        assert.equal(await clockTower.onGroundItemTake(free, ground(cog)), false);
        assert.deepEqual(free.messages, []);

        const laden = player({ stage: 1, items: [BLACK] });
        assert.equal(await clockTower.onGroundItemTake(laden, ground(cog)), true);
        assert.deepEqual(laden.messages, ['The cogs are heavy, you can only carry one']);
    }

    assert.equal(await clockTower.onGroundItemTake(player(), ground(COINS)), false);
});

test('the black cog is red hot: ice gloves or a bucket of water cool it, and it stays on the ground', async () => {
    const bare = player({ stage: 1 });
    assert.equal(await clockTower.onGroundItemTake(bare, ground(BLACK, 609, 3465)), true);
    assert.deepEqual(bare.messages, [
        '@que@The cog is red hot from the flames, too hot to carry',
        '@que@The cogs are heavy'
    ]);
    assert.equal(bare.inventory.has(BLACK), false);

    const bareLaden = player({ stage: 1, items: [RED] });
    await clockTower.onGroundItemTake(bareLaden, ground(BLACK));
    assert.equal(bareLaden.messages.at(-1), 'You can only carry one');

    // carried but not worn gloves do nothing
    const gloves = player({ stage: 1, items: [ICE_GLOVES], equipped: [ICE_GLOVES] });
    await clockTower.onGroundItemTake(gloves, ground(BLACK));
    assert.deepEqual(gloves.messages, ['@que@The ice gloves cool down the cog', '@que@You can carry it now', 'You take the cog']);
    assert.ok(gloves.inventory.has(BLACK));
    assert.ok(gloves.inventory.has(ICE_GLOVES));

    const unworn = player({ stage: 1, items: [ICE_GLOVES] });
    await clockTower.onGroundItemTake(unworn, ground(BLACK));
    assert.equal(unworn.inventory.has(BLACK), false);

    const bucket = player({ stage: 1, items: [BUCKET_OF_WATER] });
    await clockTower.onGroundItemTake(bucket, ground(BLACK));
    assert.deepEqual(bucket.messages, ['@que@You pour water over the cog', '@que@The cog quickly cools down', 'You take the cog']);
    assert.ok(bucket.inventory.has(BLACK));
    assert.equal(bucket.inventory.has(BUCKET_OF_WATER), false);

    const bucketLaden = player({ stage: 1, items: [BUCKET_OF_WATER, PURPLE] });
    await clockTower.onGroundItemTake(bucketLaden, ground(BLACK));
    assert.equal(bucketLaden.messages.at(-1), 'You can only carry one');
    assert.ok(bucketLaden.inventory.has(BUCKET_OF_WATER));
    assert.equal(bucketLaden.inventory.has(BLACK), false);

    // the bucket used on the cog does the same
    const used = player({ stage: 1, items: [BUCKET_OF_WATER] });
    assert.equal(await clockTower.onUseWithGroundItem(used, ground(BLACK), item(BUCKET_OF_WATER)), true);
    assert.ok(used.inventory.has(BLACK));
    assert.equal(used.inventory.has(BUCKET_OF_WATER), false);

    const usedLaden = player({ stage: 1, items: [BUCKET_OF_WATER, BLUE] });
    await clockTower.onUseWithGroundItem(usedLaden, ground(BLACK), item(BUCKET_OF_WATER));
    assert.equal(usedLaden.messages.at(-1), 'You can only carry one');
    assert.ok(usedLaden.inventory.has(BUCKET_OF_WATER));

    assert.equal(await clockTower.onUseWithGroundItem(used, ground(BLUE), item(BUCKET_OF_WATER)), false);
    assert.equal(await clockTower.onUseWithGroundItem(used, ground(BLACK), item(COINS)), false);
});

test('the rat cage: poison in the trough, then the outer lever with both gates open kills the rats', async () => {
    const world = cageWorld();
    const p = player({ world, stage: 1, items: [RAT_POISON] });

    // the cage bars hold while the rats live
    const cage = wallObject(111, 583, 3476, 1);
    assert.equal(await clockTower.onWallObjectCommandOne(p, cage), true);
    assert.deepEqual(p.messages, []);
    assert.deepEqual(p.teleports, []);

    assert.equal(await clockTower.onUseWithGameObject(p, gameObject(375, 591, 3474), item(RAT_POISON)), true);
    assert.equal(p.messages.at(-1), 'You pour the rat poison into the feeding trough');
    assert.equal(p.inventory.has(RAT_POISON), false);
    assert.equal(p.cache.foodtrough, true);

    assert.equal(await clockTower.onGameObjectCommandOne(p, gameObject(373, 594, 3478)), true);
    assert.deepEqual(gateIds(world), [371, 372]);
    assert.equal(p.messages[1], 'The gate creaks shut');
    assert.equal(p.messages.at(-1), '@que@The rats are slowly dying');
    assert.equal(world.npcList.filter((n) => n.id === RAT).length, 0);
    assert.equal(world.removed.filter((n) => n.id === RAT).length, 3);
    assert.equal(p.cache.foodtrough, undefined);
    assert.equal(p.cache.rats_dead, true);

    // the outer lever opens the outer gate again
    await clockTower.onGameObjectCommandOne(p, gameObject(373, 594, 3478));
    assert.deepEqual(gateIds(world), [372, 372]);
    assert.equal(p.messages.at(-1), 'The gate swings open');

    // the bent bars: crawl through either way
    p.x = 584;
    p.y = 3476;
    await clockTower.onWallObjectCommandOne(p, cage);
    assert.deepEqual(p.messages.slice(-2), ['In a panic to escape, the rats have..', '..bent the bars, you can just crawl through']);
    assert.deepEqual(p.teleports.at(-1), [582, 3476]);
    await clockTower.onWallObjectCommandOne(p, cage);
    assert.deepEqual(p.teleports.at(-1), [583, 3476]);

    // after the quest the bars stay bent
    const done = player({ stage: -1, x: 580, y: 3476 });
    await clockTower.onWallObjectCommandOne(done, cage);
    assert.deepEqual(done.teleports, [[583, 3476]]);
});

test('the inner lever kills the rats only with both gates shut; the wrong setup just moves a gate', async () => {
    const wrong = cageWorld({ outer: 371, inner: 372 });
    const w = player({ world: wrong, stage: 1, cache: { foodtrough: true } });
    await clockTower.onGameObjectCommandOne(w, gameObject(374, 590, 3478));
    assert.deepEqual(gateIds(wrong), [371, 371]);
    assert.deepEqual(w.messages, ['The gate creaks shut']);
    assert.equal(w.cache.rats_dead, undefined);
    assert.equal(wrong.removed.filter((n) => n.id === RAT).length, 0);

    // the outer lever with the inner gate shut is wrong too
    const w2 = cageWorld({ outer: 372, inner: 371 });
    const p2 = player({ world: w2, stage: 1, cache: { foodtrough: true } });
    await clockTower.onGameObjectCommandOne(p2, gameObject(373, 594, 3478));
    assert.equal(p2.cache.rats_dead, undefined);

    // both shut: the inner lever opens the inner gate and the rats die
    const right = cageWorld({ outer: 371, inner: 371 });
    const p = player({ world: right, stage: 1, cache: { foodtrough: true } });
    await clockTower.onGameObjectCommandOne(p, gameObject(374, 590, 3478));
    assert.deepEqual(gateIds(right), [371, 372]);
    assert.equal(p.messages[0], 'The gate swings open');
    assert.equal(p.messages[1], '@que@In their panic the rats bend and twist');
    assert.equal(p.cache.rats_dead, true);

    // without the poison the right setup only moves the gate
    const unpoisoned = cageWorld();
    const q = player({ world: unpoisoned, stage: 1 });
    await clockTower.onGameObjectCommandOne(q, gameObject(373, 594, 3478));
    assert.deepEqual(q.messages, ['The gate creaks shut']);
    assert.equal(q.cache.rats_dead, undefined);
});

test('the closed cage gate is locked; other gates and objects are not ours', async () => {
    const p = player({ stage: 1 });
    assert.equal(await clockTower.onGameObjectCommandOne(p, gameObject(371, 594, 3475)), true);
    assert.deepEqual(p.messages, ['The gate is locked', 'The gate will not open from here']);

    assert.equal(await clockTower.onGameObjectCommandOne(p, gameObject(371, 621, 700)), false);
    assert.equal(await clockTower.onGameObjectCommandOne(p, gameObject(372, 594, 3475)), false);
    assert.equal(await clockTower.onGameObjectCommandOne(p, gameObject(375, 591, 3474)), false);
    assert.equal(await clockTower.onUseWithGameObject(p, gameObject(375, 591, 3474), item(COINS)), false);
});

test('the odd looking wall at (584,3457) is a secret door; other odd walls are not ours', async () => {
    const p = player({ stage: 1 });
    assert.equal(await clockTower.onWallObjectCommandOne(p, wallObject(22, 584, 3457, 1)), true);
    assert.deepEqual(p.sounds, ['secretdoor']);
    assert.deepEqual(p.messages, ['You just went through a secret door']);
    assert.deepEqual(p.doors, [[22, 16]]);

    assert.equal(await clockTower.onWallObjectCommandOne(p, wallObject(22, 545, 3283, 1)), false);
    assert.equal(await clockTower.onWallObjectCommandOne(p, wallObject(2, 584, 3457, 1)), false);
});

test('all four cogs placed: Kojo hears the clock, the quest completes (-1) with 1 quest point and 500 coins', async () => {
    const p = player({
        stage: 1,
        cache: { '1st_cog': true, '2nd_cog': true, '3rd_cog': true, '4th_cog': true, rats_dead: true, other: 1 }
    });
    const kojo = fakeNpc(KOJO);
    await clockTower.onTalkToNPC(p, kojo);
    assert.equal(p.questStages.clockTower, -1);
    assert.deepEqual(p.said, ['I have replaced all the cogs']);
    assert.deepEqual(p.messages, [
        'Tick Tock, Tick Tock',
        'Tick Tock, Tick Tock',
        'You have completed the clock tower quest'
    ]);
    assert.equal(kojo.said.at(-1), 'Please take these coins as a reward');
    assert.deepEqual(p.completed, [['clockTower', { questPoints: 1 }]]);
    assert.deepEqual(p.cache, { other: 1 });
    assert.equal(p.inventory.count(COINS), 500);
    assert.deepEqual(p.experience, []);

    const again = fakeNpc(KOJO);
    await clockTower.onTalkToNPC(p, again);
    assert.deepEqual(p.said.at(-1), 'Hello again Brother Kojo');
    assert.equal(again.said.at(-1), "It's just like new");
    assert.equal(p.inventory.count(COINS), 500);
});
