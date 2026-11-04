// The Hazeel Cult (quests/members/hazeel-cult.js, port of HazeelCult.java and the poison branch of ObjectCooking.java):
// both sides driven stage by stage with fake objects, from Ceril's request to Ceril's gratitude or Hazeel's return.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const hazeel = require('../src/plugins/quests/members/hazeel-cult');
const { fakeNpc, fakeWorld, fakePlayer, gameObject } = require('./quest-fakes-3b');

const CERIL = 418;
const BUTLER = 419;
const GUARD = 420;
const HENRYETA = 422;
const PHILIPE = 423;
const CLIVET = 424;
const CULT_MEMBER = 425;
const LORD_HAZEEL = 426;
const ALOMONE = 427;
const CLAUS = 429;

const COINS = 10;
const POISON = 177;
const SCRIPT = 747;
const MARK = 753;
const ARMOUR = 755;
const KEY = 756;

const PLUGIN_TYPES = [
    .../const PLUGIN_TYPES = \[([\s\S]*?)\]/
        .exec(fs.readFileSync(require.resolve('../src/model/world.js'), 'utf8'))[1]
        .matchAll(/'(\w+)'/g)
].map((m) => m[1]);

function world(npcs = []) {
    const w = fakeWorld({ npcs });
    w.planeElevation = 944;
    return w;
}

function player(opts = {}) {
    const p = fakePlayer({ quest: 'theHazeelCult', ...opts });
    p.getDistance = (e) => Math.max(Math.abs(e.x - p.x), Math.abs(e.y - p.y));
    return p;
}

const good = { good_side: true };
const evil = { evil_side: true };

test('every exported hook is a plugin type', () => {
    for (const name of Object.keys(hazeel)) {
        assert.ok(PLUGIN_TYPES.includes(name), name);
    }
});

test('stage 0: Ceril asks for help with the armour; "yes, off course" starts the quest (1)', async () => {
    for (const [answer, line] of [
        [1, "who are you to judge me?"],
        [2, 'yes, i doubt you could help']
    ]) {
        const p = player({ answers: [answer] });
        const ceril = fakeNpc(CERIL);
        assert.equal(await hazeel.onTalkToNPC(p, ceril), true);
        assert.equal(p.questStages.theHazeelCult, 0);
        assert.ok(ceril.said.includes(line));
        assert.equal(p.interlocutor, null);
    }

    const plans = player({ answers: [0, 0] });
    const c = fakeNpc(CERIL);
    await hazeel.onTalkToNPC(plans, c);
    assert.equal(plans.questStages.theHazeelCult, 0);
    assert.ok(c.said.includes("no wonder i'm the one with the big house and you're on the streets"));

    const p = player({ answers: [0, 1] });
    const ceril = fakeNpc(CERIL);
    await hazeel.onTalkToNPC(p, ceril);
    assert.equal(p.questStages.theHazeelCult, 1);
    assert.ok(ceril.said.includes('to a cave entrance in the forest south of here'));

    const later = player({ stage: 2 });
    const c2 = fakeNpc(CERIL);
    await hazeel.onTalkToNPC(later, c2);
    assert.ok(c2.said.includes("it's sir ceril to you"));
});

test('stage 1-2: Clivet tells the story (2); refusing the cult sends him down the sewer (3, good side)', async () => {
    const w = world();
    const clivet = fakeNpc(CLIVET);
    w.npcList.push(clivet);

    // "I've heard enough of your rubbish" leaves stage 2 behind
    const rude = player({ world: w, stage: 1, answers: [1] });
    await hazeel.onTalkToNPC(rude, fakeNpc(CLIVET));
    assert.equal(rude.questStages.theHazeelCult, 2);
    assert.equal(rude.cache.good_side, undefined);

    // stage 2 again: "What do you mean?" then "You're crazy, i'd never help you"
    const p = player({ world: w, stage: 2, answers: [0, 0] });
    assert.equal(await hazeel.onTalkToNPC(p, clivet), true);
    assert.equal(p.questStages.theHazeelCult, 3);
    assert.equal(p.cache.good_side, true);
    assert.equal(p.cache.evil_side, undefined);
    assert.ok(w.removed.includes(clivet));
    assert.ok(p.messages.includes('@que@the man jumps onto a small raft'));
    assert.ok(p.messages.includes("@que@@yel@clivet:you'll never find us..."));

    // stage 1 refusing the murder: the same ending with the other raft line
    const w2 = world();
    const c2 = fakeNpc(CLIVET);
    w2.npcList.push(c2);
    const q = player({ world: w2, stage: 1, answers: [0, 1, 0] });
    await hazeel.onTalkToNPC(q, c2);
    assert.equal(q.questStages.theHazeelCult, 3);
    assert.equal(q.cache.good_side, true);
    assert.ok(q.messages.includes('@que@clivet boards the raft and pushes of down the sewer system'));

    // stage 0 and the later chat
    const idle = fakeNpc(CLIVET);
    await hazeel.onTalkToNPC(player(), idle);
    assert.ok(idle.said.includes('leave...now'));
});

test('the evil side: the poison (3), the range (4), the mark, Alomone (5)', async () => {
    const w = world();
    const clivet = fakeNpc(CLIVET);
    w.npcList.push(clivet);

    const p = player({ world: w, stage: 1, answers: [0, 1, 1] });
    await hazeel.onTalkToNPC(p, clivet);
    assert.equal(p.questStages.theHazeelCult, 3);
    assert.equal(p.cache.evil_side, true);
    assert.equal(p.inventory.count(POISON), 1);
    assert.ok(!w.removed.includes(clivet));

    // the poison on the Carnillean range; anywhere else nothing happens
    const range = gameObject(435, 618, 3453);
    assert.equal(await hazeel.onUseWithGameObject(p, range, { id: POISON }), true);
    assert.equal(p.questStages.theHazeelCult, 4);
    assert.equal(p.inventory.count(POISON), 0);
    assert.ok(p.messages.includes('@que@the poison desolves into the soup'));

    const wrong = player({ stage: 4, cache: { ...evil }, items: [POISON] });
    await hazeel.onUseWithGameObject(wrong, range, { id: POISON });
    assert.equal(wrong.questStages.theHazeelCult, 4);
    assert.equal(wrong.inventory.count(POISON), 1);
    const goodRange = player({ stage: 3, cache: { ...good }, items: [POISON] });
    await hazeel.onUseWithGameObject(goodRange, range, { id: POISON });
    assert.ok(goodRange.messages.includes('nothing interesting happens'));
    assert.equal(await hazeel.onUseWithGameObject(p, gameObject(435, 1, 1), { id: POISON }), false);

    // Clivet hands over the mark once, then only waits
    const c = fakeNpc(CLIVET);
    await hazeel.onTalkToNPC(p, c);
    assert.equal(p.inventory.count(MARK), 1);
    assert.equal(p.questStages.theHazeelCult, 4);
    assert.ok(c.said.includes('The cult leader alomone shall be expecting you'));
    const again = fakeNpc(CLIVET);
    await hazeel.onTalkToNPC(p, again);
    assert.equal(p.inventory.count(MARK), 1);
    assert.ok(again.said.includes('hurry! soon hazeel will return'));

    // Alomone recruits at stage 4 (5)
    const alomone = fakeNpc(ALOMONE);
    await hazeel.onTalkToNPC(p, alomone);
    assert.equal(p.questStages.theHazeelCult, 5);
    assert.ok(alomone.said.includes('go back to the house and try to find the script'));
    assert.deepEqual(alomone.attacked, []);
});

test('the evil side: the crate key, the bookcase, the chest (6) and Hazeel returns (-1)', async () => {
    const p = player({ stage: 5, cache: { ...evil } });

    const crate = gameObject(439, 611, 3451);
    await hazeel.onGameObjectCommandOne(p, crate);
    assert.equal(p.inventory.count(KEY), 1);
    await hazeel.onGameObjectCommandOne(p, crate);
    assert.equal(p.inventory.count(KEY), 1);
    assert.ok(p.messages.includes('but find nothing'));

    const bookcase = gameObject(436, 617, 1559);
    await hazeel.onGameObjectCommandOne(p, bookcase);
    assert.deepEqual(p.teleports, [[614, 2504]]);

    const chest = gameObject(438, 620, 2506);
    await hazeel.onGameObjectCommandOne(p, chest);
    assert.ok(p.messages.includes('the chest is locked'));
    assert.equal(await hazeel.onUseWithGameObject(p, chest, { id: KEY }), true);
    assert.equal(p.inventory.count(SCRIPT), 1);
    assert.equal(p.questStages.theHazeelCult, 6);
    assert.deepEqual(p.world.timed, [[438, 437, 1]]);

    // not at stage 5 and not on the good side
    for (const q of [player({ stage: 4, cache: { ...evil } }), player({ stage: 5, cache: { ...good } })]) {
        await hazeel.onGameObjectCommandOne(q, crate);
        await hazeel.onGameObjectCommandOne(q, bookcase);
        assert.equal(q.inventory.count(KEY), 0);
        assert.deepEqual(q.teleports, []);
        assert.ok(q.messages.includes('but find nothing interesting'));
    }

    // Alomone: no script, no ceremony
    const w = world();
    const alomone = fakeNpc(ALOMONE, { x: 580, y: 3418 });
    const empty = player({ world: w, stage: 6, cache: { ...evil } });
    await hazeel.onTalkToNPC(empty, alomone);
    assert.equal(empty.questStages.theHazeelCult, 6);
    assert.ok(alomone.said.includes('we need the script if hazeel is to return'));

    // the ceremony
    const done = await (async () => {
        const w2 = world();
        const a = fakeNpc(ALOMONE, { x: 580, y: 3418 });
        const q = player({ world: w2, stage: 6, cache: { ...evil }, items: [SCRIPT] });
        await hazeel.onTalkToNPC(q, a);
        return { q, w2, a };
    })();
    assert.equal(done.q.questStages.theHazeelCult, -1);
    assert.equal(done.q.inventory.count(SCRIPT), 0);
    assert.equal(done.q.inventory.count(COINS), 2000);
    assert.deepEqual(done.q.teleports, [[580, 3419]]);
    assert.equal(done.w2.spawned[0].id, LORD_HAZEEL);
    assert.equal(done.w2.spawned[0].ticks, Math.ceil(120000 / 640));
    assert.equal(done.w2.removed.length, 1);
    const [key, opts] = done.q.completed[0];
    assert.equal(key, 'theHazeelCult');
    assert.equal(opts.questPoints, 1);
    assert.deepEqual(opts.experience, { thieving: 2000 + 200 * 30 });
    assert.ok(done.q.messages.includes('Hazeel gives you some coins'));
    assert.ok(done.q.messages.includes('you have completed the hazeel cult quest'));
    assert.equal(done.q.interlocutor, null);
});

test('the good side: Alomone dies and leaves the armour (4); Ceril takes it and shortchanges you (5)', async () => {
    const alomone = fakeNpc(ALOMONE);

    const cerilNpc = fakeNpc(CERIL, { x: 619, y: 620 });
    const w = world([cerilNpc, fakeNpc(BUTLER)]);
    const p = player({ world: w, stage: 3, cache: { ...good }, x: 619, y: 621 });
    assert.equal(await hazeel.onNPCDeath(p, alomone), false);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(p.inventory.count(ARMOUR), 1);
    assert.equal(p.questStages.theHazeelCult, 4);
    assert.ok(p.messages.includes('@que@you see the carnillean family armour'));

    // not on the evil side, not twice, not for anyone else
    const e = player({ stage: 3, cache: { ...evil } });
    await hazeel.onNPCDeath(e, alomone);
    assert.equal(e.inventory.count(ARMOUR), 0);
    await hazeel.onNPCDeath(p, alomone);
    assert.equal(p.inventory.count(ARMOUR), 1);
    assert.equal(await hazeel.onNPCDeath(p, fakeNpc(1)), false);
    assert.equal(await hazeel.onNPCDeath(undefined, alomone), false);

    await hazeel.onTalkToNPC(p, cerilNpc);
    assert.equal(p.questStages.theHazeelCult, 5);
    assert.equal(p.inventory.count(ARMOUR), 0);
    assert.equal(p.inventory.count(COINS), 5);
    assert.deepEqual(p.teleports, [[613, 1562]]);
    assert.ok(p.messages.includes('@que@ceril gives jones 695 gold coins'));
    assert.ok(cerilNpc.said.includes('now take it and leave'));
    assert.equal(p.interlocutor, null);

    // without the armour Ceril only waits
    const nothing = player({ stage: 4, cache: { ...good } });
    const c = fakeNpc(CERIL);
    await hazeel.onTalkToNPC(nothing, c);
    assert.ok(c.said.includes("well i'm not paying you to see the sights"));
    assert.equal(nothing.questStages.theHazeelCult, 4);
});

test('the good side: the butler\'s cupboard unmasks Jones (-1) with Ceril near', async () => {
    const closed = gameObject(440, 614, 1562);
    const open = gameObject(441, 614, 1562);

    const w = world([fakeNpc(CERIL), fakeNpc(BUTLER)]);
    const p = player({ world: w, stage: 5, cache: { ...good } });

    assert.equal(await hazeel.onGameObjectCommandOne(p, closed), true);
    assert.deepEqual(w.replaced, [[440, 441]]);
    assert.deepEqual(p.messages, ['You open the cupboard']);

    assert.equal(await hazeel.onGameObjectCommandOne(p, open), true);
    assert.equal(p.questStages.theHazeelCult, -1);
    assert.equal(p.inventory.count(COINS), 2000);
    assert.ok(p.messages.includes('ceril gives you 2000 gold coins'));
    assert.ok(p.messages.includes('Well done you have completed the Hazeel cult quest') || p.completed[0][1].message === 'Well done you have completed the Hazeel cult quest');
    assert.deepEqual(p.completed[0][1].experience, { thieving: 2000 + 200 * 30 });
    assert.ok(w.npcList[0].said.includes('looks like i owe you an apology traveller'));
    assert.ok(w.npcList[1].said.includes("that's because you're an old fool ceril"));
    assert.equal(p.interlocutor, null);

    // searching early, on the evil side or with nobody near finds nothing / does nothing
    for (const q of [player({ world: w, stage: 4, cache: { ...good } }), player({ world: w, stage: 5, cache: { ...evil } })]) {
        await hazeel.onGameObjectCommandOne(q, open);
        assert.ok(q.messages.includes('@que@but find nothing'));
        assert.equal(q.questStages.theHazeelCult, q.questStages.theHazeelCult);
    }

    const alone = player({ world: world(), stage: 5, cache: { ...good } });
    await hazeel.onGameObjectCommandOne(alone, open);
    assert.equal(alone.questStages.theHazeelCult, 5);

    // closing it again
    assert.equal(await hazeel.onGameObjectCommandTwo(p, open), true);
    assert.deepEqual(w.replaced[w.replaced.length - 1], [441, 440]);
    assert.equal(await hazeel.onGameObjectCommandTwo(p, closed), false);
});

test('Alomone and the cult members chase an intruder from the good side', async () => {
    const w = world();
    const cult = fakeNpc(CULT_MEMBER);
    w.npcList.push(cult);

    // stage 0-2: Alomone sets the nearest cult member on you
    const p = player({ world: w, stage: 1 });
    const alomone = fakeNpc(ALOMONE);
    await hazeel.onTalkToNPC(p, alomone);
    assert.ok(alomone.said.includes('kill him'));
    assert.deepEqual(cult.attacked, [p]);

    // stage 3 good side: Alomone himself
    const g = player({ stage: 3, cache: { ...good } });
    const a2 = fakeNpc(ALOMONE);
    await hazeel.onTalkToNPC(g, a2);
    assert.deepEqual(a2.attacked, [g]);

    for (const stage of [3, 4, 5, -1]) {
        const q = player({ stage, cache: { ...good } });
        const c = fakeNpc(CULT_MEMBER);
        await hazeel.onTalkToNPC(q, c);
        assert.deepEqual(c.attacked, [q], `cult member, stage ${stage}`);
    }

    // the evil side is welcome
    const e = player({ stage: 4, cache: { ...evil } });
    const c = fakeNpc(CULT_MEMBER);
    await hazeel.onTalkToNPC(e, c);
    assert.deepEqual(c.attacked, []);
    assert.ok(c.said.includes('hello, oh, are you new'));
});

test('the household comments by stage and side; Claus has nothing to say at stage 2', async () => {
    const lines = [];

    for (const id of [BUTLER, HENRYETA, PHILIPE, CLAUS, GUARD, CERIL, CLIVET, CULT_MEMBER, ALOMONE]) {
        for (const stage of [0, 1, 2, 3, 4, 5, 6, -1]) {
            for (const side of [{}, good, evil]) {
                const p = player({ stage, cache: { ...side }, answers: [2, 2, 2, 2] });
                const n = fakeNpc(id);
                assert.equal(await hazeel.onTalkToNPC(p, n), true);
                assert.equal(p.interlocutor, null, `npc ${id} stage ${stage}`);
                lines.push(n.said.length + p.said.length);
            }
        }
    }

    assert.ok(lines.some((n) => n > 0));

    const claus = fakeNpc(CLAUS);
    const p = player({ stage: 2 });
    await hazeel.onTalkToNPC(p, claus);
    assert.deepEqual(claus.said, []);
    assert.deepEqual(p.said, []);

    // the butler's first menu (stage 1)
    const b = fakeNpc(BUTLER);
    const q = player({ stage: 1, answers: [1] });
    await hazeel.onTalkToNPC(q, b);
    assert.ok(b.said.includes('are not as innocent or noble as they seem'));

    // other npcs are not ours
    assert.equal(await hazeel.onTalkToNPC(player(), fakeNpc(1)), false);
});

test('Jones and Alomone at the script stage know whether you hold it', async () => {
    const butler = fakeNpc(BUTLER);
    const has = player({ stage: 6, cache: { ...evil }, items: [SCRIPT] });
    await hazeel.onTalkToNPC(has, butler);
    assert.ok(butler.said.includes('incredible, we owe you a lot'));

    const lost = player({ stage: 6, cache: { ...evil } });
    const b2 = fakeNpc(BUTLER);
    await hazeel.onTalkToNPC(lost, b2);
    assert.ok(b2.said.includes('how could you be so foolish'));

    const clivet = fakeNpc(CLIVET);
    await hazeel.onTalkToNPC(player({ stage: 6, cache: { ...evil }, items: [SCRIPT] }), clivet);
    assert.ok(clivet.said.includes('take the script to alomone as quick as you can'));
});
