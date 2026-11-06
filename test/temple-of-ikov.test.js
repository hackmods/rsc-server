// Temple of Ikov (quests/members/temple-of-ikov.js, port of TempleOfIkov.java and the Temple of Ikov doors of
// DoorAction.java): every stage driven with fake objects, from Lucien's request to both endings. The fear room and bridge
// doors (104, 105) are wall-objects/doors.js.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const ikov = require('../src/plugins/quests/members/temple-of-ikov');
const climbable = require('../src/plugins/game-objects/climbable');
const { fakeNpc, fakeWorld, fakePlayer, gameObject, wallObject } = require('./quest-fakes-3b');

const LUCIEN = 360;
const FIRE_WARRIOR = 361;
const GUARDIAN_MALE = 362;
const GUARDIAN_FEMALE = 363;
const LUCIEN_EDGE = 364;
const WINELDA = 365;

const LIMPWURT = 220;
const LIT_CANDLE = 601;
const LIT_TORCH = 774;
const PENDANT_OF_LUCIEN = 721;
const ICE_ARROWS = 723;
const LEVER = 724;
const STAFF = 725;
const PENDANT_OF_ARMADYL = 726;
const YEW_LONGBOW = 654;
const RUNE_2H = 81;

const PLUGIN_TYPES = [
    .../const PLUGIN_TYPES = \[([\s\S]*?)\]/
        .exec(fs.readFileSync(require.resolve('../src/model/world.js'), 'utf8'))[1]
        .matchAll(/'(\w+)'/g)
].map((m) => m[1]);

function player(opts = {}) {
    return fakePlayer({ quest: 'templeOfIkov', ...opts });
}

test('every exported hook is a plugin type', () => {
    for (const name of Object.keys(ikov)) {
        assert.ok(PLUGIN_TYPES.includes(name), name);
    }
});

test('stage 0: Lucien in East Ardougne; "That sounds like fun" gives the pendant of Lucien (1)', async () => {
    // not a hero: nothing
    const no = player({ answers: [1] });
    await ikov.onTalkToNPC(no, fakeNpc(LUCIEN));
    assert.equal(no.questStages.templeOfIkov, 0);

    // straight to "That sounds too dangerous for me" and "How much will you pay me?": no pendant
    const scared = player({ answers: [0, 2] });
    const s = fakeNpc(LUCIEN);
    await ikov.onTalkToNPC(scared, s);
    assert.ok(s.said.includes('Fortune favours the bold'));
    assert.equal(scared.questStages.templeOfIkov, 0);

    const pay = player({ answers: [0, 3] });
    const pn = fakeNpc(LUCIEN);
    await ikov.onTalkToNPC(pay, pn);
    assert.ok(pn.said.includes('I shall adequately reward you'));
    assert.equal(pay.questStages.templeOfIkov, 0);

    // "Why can't you do it yourself?" and its menu
    const why = player({ answers: [0, 0, 2] });
    const wn = fakeNpc(LUCIEN);
    await ikov.onTalkToNPC(why, wn);
    assert.ok(wn.said.includes('An ancient and powerful race'));
    assert.equal(why.questStages.templeOfIkov, 0);

    for (const [answers, line] of [
        [[0, 0, 0], 'I shall adequately reward you'],
        [[0, 0, 3], 'Fortune favours the bold']
    ]) {
        const p = player({ answers });
        const n = fakeNpc(LUCIEN);
        await ikov.onTalkToNPC(p, n);
        assert.ok(n.said.includes(line));
        assert.equal(p.questStages.templeOfIkov, 0);
    }

    // both routes to "That sounds like fun"
    for (const answers of [[0, 1], [0, 0, 1]]) {
        const p = player({ answers });
        const n = fakeNpc(LUCIEN);
        assert.equal(await ikov.onTalkToNPC(p, n), true);
        assert.equal(p.questStages.templeOfIkov, 1);
        assert.equal(p.inventory.count(PENDANT_OF_LUCIEN), 1);
        assert.ok(n.said.includes('Take this pendant you will need it to get through the chamber of fear'));
        assert.equal(p.interlocutor, null);
    }
});

test('stages 1, 2 and done: Lucien does not want to be met here; a lost pendant is replaced', async () => {
    for (const stage of [1, 2, -1, -2]) {
        const keeps = player({ stage, items: [PENDANT_OF_LUCIEN] });
        const n = fakeNpc(LUCIEN);
        await ikov.onTalkToNPC(keeps, n);
        assert.ok(n.said.includes('I thought I told you not to meet me here again'));
        assert.equal(keeps.inventory.count(PENDANT_OF_LUCIEN), 1);

        const lost = player({ stage, answers: [0] });
        await ikov.onTalkToNPC(lost, fakeNpc(LUCIEN));
        assert.equal(lost.inventory.count(PENDANT_OF_LUCIEN), 1);
        assert.ok(lost.messages.includes('Lucien gives you another pendant'));

        const sorry = player({ stage, answers: [1] });
        await ikov.onTalkToNPC(sorry, fakeNpc(LUCIEN));
        assert.equal(sorry.inventory.has(PENDANT_OF_LUCIEN), false);
    }
});

test('Winelda carries you over the lava for 20 limpwurt roots', async () => {
    const poor = player({ stage: 1, items: [[LIMPWURT, 19]], answers: [1] });
    const w = fakeNpc(WINELDA);
    await ikov.onTalkToNPC(poor, w);
    assert.ok(w.said.includes("Yes yes that's good, bring me 20 limpwurt roots and over you go"));
    assert.deepEqual(poor.teleports, []);
    assert.equal(poor.inventory.count(LIMPWURT), 19);

    for (const [answers, line] of [
        [[0], "Hehe ye'll come back later"],
        [[2], 'Okay brace yourself']
    ]) {
        const p = player({ stage: 1, answers });
        const n = fakeNpc(WINELDA);
        await ikov.onTalkToNPC(p, n);
        assert.ok(n.said.includes(line));
    }

    const rich = player({ stage: 1, items: [[LIMPWURT, 23]] });
    const n = fakeNpc(WINELDA);
    await ikov.onTalkToNPC(rich, n);
    assert.deepEqual(rich.teleports, [[557, 3290]]);
    assert.equal(rich.inventory.count(LIMPWURT), 3);
    assert.ok(n.said.includes('Oh marverlous'));
});

test('stage 1: a guardian of Armadyl; Lucien\'s pendant worn or the staff carried makes it attack', async () => {
    const worn = player({ stage: 1, items: [PENDANT_OF_LUCIEN], equipped: [PENDANT_OF_LUCIEN] });
    const g = fakeNpc(GUARDIAN_MALE);
    await ikov.onTalkToNPC(worn, g);
    assert.ok(g.said.includes('Ahh tis a foul agent of Lucien'));
    assert.equal(g.attacked.length, 1);

    // worn pendant but already holding the staff: the other branch
    const staff = player({ stage: 1, items: [PENDANT_OF_LUCIEN, STAFF], equipped: [PENDANT_OF_LUCIEN] });
    const g2 = fakeNpc(GUARDIAN_FEMALE);
    await ikov.onTalkToNPC(staff, g2);
    assert.ok(g2.said.includes('You cannot take the staff of Armadyl'));
    assert.equal(g2.attacked.length, 1);

    // the stage-0 player gets no dialogue
    const early = player({ stage: 0 });
    const g3 = fakeNpc(GUARDIAN_MALE);
    assert.equal(await ikov.onTalkToNPC(early, g3), true);
    assert.deepEqual(g3.said, []);
});

test('stage 1: the guardian talks - refusals, history, and the fights', async () => {
    const run = async (answers, id = GUARDIAN_MALE) => {
        const p = player({ stage: 1, answers });
        const g = fakeNpc(id);
        await ikov.onTalkToNPC(p, g);
        return { p, g };
    };

    let r = await run([0, 1]);
    assert.ok(r.g.said.includes('The staff is a sacred object'));
    assert.equal(r.g.attacked.length, 0);

    r = await run([0, 2]);
    assert.ok(r.g.said.includes('The staff is not yours to collect'));

    r = await run([1, 0]);
    assert.ok(r.g.said.includes('Only members of our order are allowed further'));
    r = await run([1, 1]);
    assert.equal(r.g.attacked.length, 1);
    r = await run([1, 2]);
    assert.equal(r.g.attacked.length, 0);

    r = await run([2, 0, 0]);
    assert.ok(r.g.said.includes('Armadyl is our God'));
    r = await run([2, 0, 1]);
    assert.ok(r.g.said.includes('We are aware of at least twenty'));
    r = await run([2, 1, 1]);
    assert.ok(r.g.said.includes("Don't fret, for we shall"));
    r = await run([2, 2]);
    assert.ok(r.g.said.includes('Many generations of my family have though'));

    // "A guy named Lucien is paying me": the fights and the bath
    r = await run([0, 0, 0]);
    assert.equal(r.g.attacked.length, 1);
    r = await run([0, 0, 1]);
    assert.ok(r.g.said.includes('We cannot allow an agent of Lucien to roam free'));
    assert.equal(r.g.attacked.length, 1);
    r = await run([2, 1, 0, 1], GUARDIAN_FEMALE); // "Did you say Lucien?" then "Erm I think I'll be leaving"
    assert.equal(r.g.attacked.length, 1);

    // the bath, then the last menu
    r = await run([0, 0, 2, 1]);
    assert.equal(r.g.attacked.length, 1);
    assert.equal(r.p.questStages.templeOfIkov, 1);
    r = await run([0, 0, 2, 2]);
    assert.ok(r.g.said.includes('Come back when you have made your choice'));
    assert.equal(r.p.questStages.templeOfIkov, 1);
    assert.equal(r.g.attacked.length, 0);
});

test('stage 1 -> 2: cleansed, the guardian gives the pendant of Armadyl', async () => {
    const p = player({ stage: 1, answers: [0, 0, 2, 0] });
    const g = fakeNpc(GUARDIAN_MALE);
    await ikov.onTalkToNPC(p, g);
    assert.equal(p.questStages.templeOfIkov, 2);
    assert.equal(p.inventory.count(PENDANT_OF_ARMADYL), 1);
    assert.ok(p.messages.includes('The guardian splashes holy water over you'));
    assert.ok(g.said.includes('You will need to use this pendant to even be able to attack him'));
    assert.equal(g.attacked.length, 0);

    // the same road through "Who are the Mahjarrat?"
    const q = player({ stage: 1, answers: [2, 1, 0, 2, 0] });
    await ikov.onTalkToNPC(q, fakeNpc(GUARDIAN_FEMALE));
    assert.equal(q.questStages.templeOfIkov, 2);
});

test('stage 2 and done: the guardian asks after Lucien', async () => {
    const lost = player({ stage: 2, answers: [1] });
    const g = fakeNpc(GUARDIAN_MALE);
    await ikov.onTalkToNPC(lost, g);
    assert.ok(g.said.includes('Thou art a careless buffoon'));
    assert.equal(lost.inventory.count(PENDANT_OF_ARMADYL), 1);

    const notYet = player({ stage: 2, answers: [0] });
    const g2 = fakeNpc(GUARDIAN_MALE);
    await ikov.onTalkToNPC(notYet, g2);
    assert.ok(g2.said.includes('Well good luck on your quest'));
    assert.equal(notYet.inventory.has(PENDANT_OF_ARMADYL), false);

    const has = player({ stage: 2, items: [PENDANT_OF_ARMADYL] });
    const g3 = fakeNpc(GUARDIAN_MALE);
    await ikov.onTalkToNPC(has, g3);
    assert.ok(has.said.includes('Not yet'));

    const done = player({ stage: -1 });
    const g4 = fakeNpc(GUARDIAN_MALE);
    await ikov.onTalkToNPC(done, g4);
    assert.ok(g4.said.includes('We can only hope that will keep him quiet for a while'));

    const evil = player({ stage: -2 });
    const g5 = fakeNpc(GUARDIAN_MALE);
    await ikov.onTalkToNPC(evil, g5);
    assert.ok(g5.said.includes('Thou evil agent of Lucien'));
});

test('Lucien in the forest: the staff ends the quest on his side (-2); nothing without it', async () => {
    const none = player({ stage: 1, x: 162, y: 466 });
    const l = fakeNpc(LUCIEN_EDGE);
    await ikov.onTalkToNPC(none, l);
    assert.ok(l.said.includes('Have you got the staff of Armadyl yet?'));
    assert.ok(none.said.includes('No not yet'));
    assert.equal(none.questStages.templeOfIkov, 1);

    const keep = player({ stage: 1, items: [STAFF], answers: [1] });
    await ikov.onTalkToNPC(keep, fakeNpc(LUCIEN_EDGE));
    assert.equal(keep.questStages.templeOfIkov, 1);
    assert.ok(keep.inventory.has(STAFF));

    const p = player({ stage: 1, items: [STAFF], answers: [0], levels: { ranged: 50, fletching: 40 }, cache: { completeLever: true, openSpiderDoor: true, killedLesarkus: true } });
    const world = p.world;
    const lucien = fakeNpc(LUCIEN_EDGE);
    world.npcList.push(lucien);
    await ikov.onTalkToNPC(p, lucien);
    assert.equal(p.questStages.templeOfIkov, -2);
    assert.equal(p.inventory.has(STAFF), false);
    assert.deepEqual(p.completed, [
        [
            'templeOfIkov',
            {
                questPoints: 1,
                experience: { ranged: 2000 + 1000 * 50, fletching: 2000 + 1000 * 40 },
                message: 'Well done you have completed the temple of Ikov quest'
            }
        ]
    ]);
    assert.deepEqual(p.cache, {});
    assert.ok(p.messages.includes("A glow eminates from Lucien's helmet"));
    assert.deepEqual(world.removed, [lucien]);

    for (const stage of [-1, -2]) {
        const done = player({ stage });
        await ikov.onTalkToNPC(done, fakeNpc(LUCIEN_EDGE));
        assert.equal(done.messages.at(-1), 'You have already completed this quest');
    }
});

test('the doors: Lucien\'s hideout, the fire warrior, the lever and the ice spiders', async () => {
    const door = (id, x, y) => wallObject(id, x, y, 0);

    // 109 Lucien's hideout: from stage 1
    const early = player();
    await ikov.onWallObjectCommandOne(early, door(109, 161, 465));
    assert.deepEqual(early.doors, []);
    assert.deepEqual(early.messages, ["@que@The door doesn't open", '@que@No one seems to be in']);
    for (const stage of [1, 2, -1, -2]) {
        const p = player({ stage });
        await ikov.onWallObjectCommandOne(p, door(109, 161, 465));
        assert.deepEqual(p.doors, [[109, undefined]]);
        assert.equal(p.messages[0], 'You go through the door');
    }

    // 108 jail door by the fire warrior: killedLesarkus or done
    const shut = player({ stage: 1 });
    await ikov.onWallObjectCommandOne(shut, door(108, 546, 3302));
    assert.deepEqual(shut.doors, []);
    assert.ok(shut.messages.includes('@que@The door handle is too hot to handle'));
    const killed = player({ stage: 1, cache: { killedLesarkus: true } });
    await ikov.onWallObjectCommandOne(killed, door(108, 546, 3302));
    assert.equal(killed.doors.length, 1);
    const done = player({ stage: -2 });
    await ikov.onWallObjectCommandOne(done, door(108, 546, 3302));
    assert.equal(done.doors.length, 1);

    // 107 the door the lever opens
    const stuck = player({ stage: 1 });
    await ikov.onWallObjectCommandOne(stuck, door(107, 545, 3307));
    assert.deepEqual(stuck.messages, ["The door won't open"]);
    const pulled = player({ stage: 1, cache: { completeLever: true } });
    await ikov.onWallObjectCommandOne(pulled, door(107, 545, 3307));
    assert.equal(pulled.doors.length, 1);

    // 106 the ice spider door: openSpiderDoor, or already past it (x >= 536)
    const outside = player({ stage: 1, x: 535, y: 3349 });
    await ikov.onWallObjectCommandOne(outside, door(106, 536, 3349));
    assert.deepEqual(outside.messages, ["The door won't open"]);
    const inside = player({ stage: 1, x: 536, y: 3349 });
    await ikov.onWallObjectCommandOne(inside, door(106, 536, 3349));
    assert.equal(inside.doors.length, 1);
    const lever = player({ stage: 1, x: 535, y: 3349, cache: { openSpiderDoor: true } });
    await ikov.onWallObjectCommandOne(lever, door(106, 536, 3349));
    assert.equal(lever.doors.length, 1);

    assert.equal(await ikov.onWallObjectCommandOne(player(), door(104, 533, 3342)), false);
});

test('the stairs: a lit light shows the way down, the dark sends you back', async () => {
    const down = gameObject(370, 537, 3337);
    const up = gameObject(369, 534, 3371);

    assert.equal(await climbable.onGameObjectCommandOne(player(), down), false);
    assert.equal(await climbable.onGameObjectCommandOne(player(), up), false);

    for (const light of [LIT_CANDLE, 602, LIT_TORCH]) {
        const p = player({ items: [light] });
        assert.equal(await ikov.onGameObjectCommandOne(p, down), true);
        assert.deepEqual(p.teleports, [[537, 3372]]);
        assert.deepEqual(p.messages, ['Your flame lights up the room']);
    }

    const dark = player({ items: [[600, 1]] });
    await ikov.onGameObjectCommandOne(dark, down);
    assert.deepEqual(dark.teleports, [[537, 3394]]);
    assert.deepEqual(dark.messages, ['You cannot see any further into the room', 'It is too dark']);

    const back = player();
    await ikov.onGameObjectCommandOne(back, up);
    assert.deepEqual(back.teleports, [[536, 3338]]);
});

test('the trapped lever: search for traps (thieving 42), then pull; a wrong pull hurts', async () => {
    const lever = gameObject(361, 533, 3305);

    // pulling with the trap armed: hits / 5 damage
    const hurt = player({ levels: { hits: 30 } });
    await ikov.onGameObjectCommandOne(hurt, lever);
    assert.deepEqual(hurt.damaged, [6]);
    assert.equal(hurt.messages[0], 'You have activated a trap on the lever');
    assert.equal(hurt.cache.openSpiderDoor, undefined);

    const weak = player({ levels: { thieving: 41 } });
    assert.equal(await ikov.onGameObjectCommandTwo(weak, lever), true);
    assert.deepEqual(weak.messages, ['You search the lever for traps', 'You have not high thieving enough to disable this trap']);
    assert.equal(weak.cache.ikovLever, undefined);

    const p = player({ levels: { thieving: 42 } });
    await ikov.onGameObjectCommandTwo(p, lever);
    assert.equal(p.cache.ikovLever, true);
    assert.ok(p.messages.includes('@que@You disable the trap'));

    await ikov.onGameObjectCommandOne(p, lever);
    assert.equal(p.cache.ikovLever, undefined);
    assert.equal(p.cache.openSpiderDoor, true);
    assert.ok(p.messages.includes('@que@The trap on the lever resets'));
    assert.deepEqual(p.damaged, []);

    // the trap is armed again
    await ikov.onGameObjectCommandOne(p, lever);
    assert.equal(p.damaged.length, 1);

    assert.equal(await ikov.onGameObjectCommandTwo(p, gameObject(368, 544, 3307)), false);
});

test('the lever bracket: a Lever fitted to it gives a pullable lever for a while', async () => {
    const world = fakeWorld();
    const bracket = gameObject(367, 544, 3307);
    bracket.index = 1;
    const p = player({ world, items: [LEVER] });

    assert.equal(await ikov.onUseWithGameObject(p, bracket, { id: RUNE_2H }), false);
    assert.equal(await ikov.onUseWithGameObject(p, gameObject(361, 533, 3305), { id: LEVER }), false);
    assert.equal(await ikov.onUseWithGameObject(p, bracket, { id: LEVER }), true);
    assert.equal(p.inventory.has(LEVER), false);
    assert.equal(p.messages[0], 'You fit the lever into the bracket');
    assert.deepEqual(world.timed, [[367, 368, Math.ceil(15000 / 640)]]);

    const pull = player({ stage: 1 });
    assert.equal(await ikov.onGameObjectCommandOne(pull, gameObject(368, 544, 3307)), true);
    assert.equal(pull.cache.completeLever, true);
    assert.ok(pull.messages.includes('@que@You hear the door next to you make a clunking noise'));
});

test('ice arrows: taking one in the spider cave puts you back outside; the pile stays', async () => {
    const inCave = player();
    assert.equal(await ikov.onGroundItemTake(inCave, { id: ICE_ARROWS, x: 560, y: 3352 }), true);
    assert.equal(inCave.inventory.count(ICE_ARROWS), 1);
    assert.deepEqual(inCave.teleports, [[538, 3348]]);
    assert.equal(inCave.messages.at(-1), 'Suddenly your surroundings change');

    const second = player();
    await ikov.onGroundItemTake(second, { id: ICE_ARROWS, x: 563, y: 3354 });
    assert.equal(second.inventory.count(ICE_ARROWS), 1);

    const elsewhere = player();
    assert.equal(await ikov.onGroundItemTake(elsewhere, { id: ICE_ARROWS, x: 100, y: 100 }), true);
    assert.equal(elsewhere.inventory.has(ICE_ARROWS), false);
    assert.deepEqual(elsewhere.messages, [
        '@que@You can only take ice arrows from the cave of ice spiders',
        '@que@In the temple of Ikov'
    ]);

    assert.equal(await ikov.onGroundItemTake(player(), { id: 1, x: 560, y: 3352 }), false);
});

test('the staff of Armadyl: free to take with no guardian near, else the guardian answers', async () => {
    const free = player({ stage: 1 });
    assert.equal(await ikov.onGroundItemTake(free, { id: STAFF, x: 540, y: 3273 }), false);

    const world = fakeWorld();
    const guard = fakeNpc(GUARDIAN_MALE, { x: 542, y: 3275 });
    world.npcList.push(guard);

    for (const stage of [2, -1, -2]) {
        const p = player({ world, stage, x: 540, y: 3274 });
        assert.equal(await ikov.onGroundItemTake(p, { id: STAFF, x: 540, y: 3273 }), true);
        assert.equal(p.messages.at(-1), "I shouldn't steal this");
    }

    const has = player({ world, stage: 1, items: [STAFF] });
    await ikov.onGroundItemTake(has, { id: STAFF, x: 540, y: 3273 });
    assert.equal(has.messages.at(-1), 'I already have one of those');

    const p = player({ world, stage: 1 });
    await ikov.onGroundItemTake(p, { id: STAFF, x: 540, y: 3273 });
    assert.ok(guard.said.includes('That is not thine to take'));
    assert.equal(guard.attacked.length, 1);
    assert.equal(p.interlocutor, null);
});

test('Lucien in a fight: only with the pendant of Armadyl worn (melee, arrows and spells)', async () => {
    const lucien = fakeNpc(LUCIEN_EDGE);
    const bare = player({ stage: 2 });
    assert.equal(await ikov.onNPCAttack(bare, lucien), true);
    assert.ok(lucien.said.includes("I'm sure you don't want to attack me really"));
    assert.ok(bare.messages.includes("@que@You decide you don't want to attack Lucien really"));
    assert.equal(await ikov.onNPCRangedAttack(bare, lucien), true);
    assert.equal(await ikov.onCastOnNPC(bare, lucien), true);

    const armed = player({ stage: 2, items: [PENDANT_OF_ARMADYL], equipped: [PENDANT_OF_ARMADYL] });
    assert.equal(await ikov.onNPCAttack(armed, lucien), false);
    assert.equal(await ikov.onNPCRangedAttack(armed, lucien), false);
    assert.equal(await ikov.onCastOnNPC(armed, lucien), false);

    for (const stage of [-1, -2]) {
        const done = player({ stage, items: [PENDANT_OF_ARMADYL], equipped: [PENDANT_OF_ARMADYL] });
        assert.equal(await ikov.onNPCAttack(done, lucien), true);
        assert.equal(done.messages.at(-1), 'You have already completed this quest');
        assert.equal(await ikov.onNPCRangedAttack(done, lucien), true);
        assert.equal(await ikov.onCastOnNPC(done, lucien), true);
    }

    assert.equal(await ikov.onNPCAttack(armed, fakeNpc(5)), false);
});

test('Lucien beaten (-1): his hit points are restored, he leaves, and the reward is paid', async () => {
    const world = fakeWorld();
    const lucien = fakeNpc(LUCIEN_EDGE);
    lucien.skills = { hits: { base: 23, current: 0 } };
    lucien.abandonFight = () => {
        lucien.abandoned = true;
    };
    world.npcList.push(lucien);

    const p = player({ world, stage: 2, levels: { ranged: 60, fletching: 30 }, cache: { killedLesarkus: true } });
    assert.equal(await ikov.onNPCDeath(p, lucien), true);
    assert.equal(lucien.skills.hits.current, 23);
    assert.equal(p.questStages.templeOfIkov, -1);
    assert.deepEqual(p.completed[0][1].experience, { ranged: 2000 + 1000 * 60, fletching: 2000 + 1000 * 30 });
    assert.ok(lucien.said.includes('But I will be back'));
    assert.deepEqual(world.removed, [lucien]);
    assert.equal(p.cache.killedLesarkus, undefined);

    // killed again after the quest: no second reward
    const again = player({ world: fakeWorld(), stage: -1 });
    lucien.skills.hits.current = 0;
    assert.equal(await ikov.onNPCDeath(again, lucien), true);
    assert.deepEqual(again.completed, []);
    assert.equal(again.messages.at(-1), 'You have already completed this quest');
});

test('the fire warrior of Lesarkus: ice arrows from a yew or magic bow only; his death sets killedLesarkus', async () => {
    const warrior = fakeNpc(FIRE_WARRIOR);

    // no arrows: no shot, and spells are refused
    const bare = player({ stage: 1 });
    assert.equal(await ikov.onNPCRangedAttack(bare, warrior), true);
    assert.equal(bare.messages.at(-1), 'You need to kill the fire warrior with ice arrows');
    assert.equal(bare.cache.shot_ice, undefined);

    // arrows but a short bow of oak, or none
    const oak = player({ stage: 1, items: [ICE_ARROWS, 649], equipped: [649] });
    assert.equal(await ikov.onNPCRangedAttack(oak, warrior), true);
    const nobow = player({ stage: 1, items: [ICE_ARROWS] });
    assert.equal(await ikov.onNPCRangedAttack(nobow, warrior), true);

    for (const bow of [654, 655, 656, 657]) {
        const p = player({ stage: 1, items: [[ICE_ARROWS, 10], bow], equipped: [bow] });
        assert.equal(await ikov.onNPCRangedAttack(p, warrior), false);
        assert.equal(p.cache.shot_ice, true);
    }

    // once an ice arrow has hit, the flag lets any later shot through
    const hit = player({ stage: 1, cache: { shot_ice: true } });
    assert.equal(await ikov.onNPCRangedAttack(hit, warrior), false);

    assert.equal(await ikov.onCastOnNPC(bare, warrior), true);
    assert.equal(bare.messages.at(-1), 'You need to kill the fire warrior with ice arrows');
    // melee is not stopped (the Java has no hook for it)
    assert.equal(await ikov.onNPCAttack(bare, warrior), false);

    // dead: the cache flag opens the jail door; later shots are refused
    assert.equal(await ikov.onNPCDeath(bare, warrior), false);
    assert.equal(bare.cache.killedLesarkus, true);
    assert.equal(await ikov.onNPCRangedAttack(bare, warrior), true);
    assert.equal(bare.messages.at(-1), 'You have already killed the fire warrior');
    assert.equal(await ikov.onCastOnNPC(bare, warrior), true);
    assert.equal(bare.messages.at(-1), 'You have already killed the fire warrior');

    const done = player({ stage: -2 });
    assert.equal(await ikov.onNPCRangedAttack(done, warrior), true);

    // npcs that are not ours; a death with no killer
    assert.equal(await ikov.onNPCDeath(bare, fakeNpc(5)), false);
    assert.equal(await ikov.onNPCDeath(null, warrior), false);
    assert.equal(await ikov.onTalkToNPC(bare, fakeNpc(5)), false);
    assert.equal(await ikov.onNPCRangedAttack(bare, fakeNpc(5)), false);
    assert.equal(await ikov.onCastOnNPC(bare, fakeNpc(5)), false);
});

test('the quest list shows Temple of Ikov done at both -1 and -2', () => {
    const src = fs.readFileSync(require.resolve('../src/model/player.js'), 'utf8');
    assert.match(src, /this\.questStages\[name\] === -1 \|\| this\.questStages\[name\] === -2/);
});

test('ice arrows are fired from yew and magic bows, ahead of the other arrows', () => {
    require('../src/data-fixes');
    const ranged = require('@2003scape/rsc-data/ranged');
    for (const bow of [654, 655, 656, 657]) {
        assert.equal(ranged.weapons[bow].ammunition[0], ICE_ARROWS);
    }
    for (const bow of [189, 649, 651, 653]) {
        assert.equal(ranged.weapons[bow].ammunition.includes(ICE_ARROWS), false);
    }
    assert.ok(ranged.ammunition[ICE_ARROWS] > 0);
    assert.ok(YEW_LONGBOW === 654);
});
