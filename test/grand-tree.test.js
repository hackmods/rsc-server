// The Grand Tree (quests/members/grand-tree/*.js, port of GrandTree.java and GnomeGlider.java): every stage driven with
// fakes, 0 to -1. The stronghold gate's Femi barrel (stage 0) and the guards (8, 10) are game-objects/members-gates.js
// (test/stronghold-gate.test.js); the tree ladders 585/586 are game-objects/object-tele-points.js.

const test = require('node:test');
const assert = require('node:assert/strict');

const narnode = require('../src/plugins/quests/members/grand-tree/narnode');
const glough = require('../src/plugins/quests/members/grand-tree/glough');
const shipyard = require('../src/plugins/quests/members/grand-tree/shipyard');
const glider = require('../src/plugins/quests/members/grand-tree/gnome-glider');
const roots = require('../src/plugins/quests/members/grand-tree/roots');
const stronghold = require('../src/plugins/quests/members/grand-tree/stronghold');
const { fakeNpc, fakeWorld, fakePlayer, gameObject } = require('./quest-fakes-2a');

const NARNODE = 541;
const NARNODE_UNDER = 545;
const HAZELMERE = 546;
const GLOUGH = 547;
const CHARLIE = 550;
const PILOT = 552;
const BROKEN_PILOT = 556;
const GATE_WORKER = 557;
const WORKER = 558;
const FOREMAN = 560;
const HUT_FOREMAN = 561;
const FEMI = 563;
const FEMI_INSIDE = 564;
const ANITA = 565;
const GLOUGH_UNDER = 566;
const DEMON = 568;
const JOGRE = 523;

const BOOK = 918;
const BARK = 919;
const JOURNAL = 921;
const INVOICE = 922;
const KEY = 925;
const NOTES = 926;
const PEBBLES = [927, 928, 929, 930];
const DACONIA = 931;

// the shared fakes plus what these plugins also call
function world(npcs = []) {
    const w = fakeWorld({ npcs });
    const spawn = w.spawnTimedNPC.bind(w);
    w.spawnTimedNPC = (opts) => withChat(spawn(opts));
    w.replaceTimed = (type, entity, id, ticks) => {
        w.replaced.push([entity.id, id, ticks]);
        return { ...entity, id };
    };
    return w;
}

function withChat(npc) {
    npc.shouted = [];
    npc.broadcastChat = (m) => npc.shouted.push(m);
    return npc;
}

function npc(id, opts) {
    return withChat(fakeNpc(id, opts));
}

function player(opts = {}) {
    const p = fakePlayer({ quest: 'grandTree', world: world(opts.npcs || []), ...opts });
    p.sent = [];
    p.experience = [];
    p.send = (m) => p.sent.push(m);
    p.sendSound = () => {};
    p.sendBubble = () => {};
    p.isTired = () => false;
    p.addExperience = (skill, amount) => p.experience.push([skill, amount]);
    return p;
}

test('stage 0: Narnode takes you under the tree; "i\'d be happy to help" gives the book and bark (stage 1)', async () => {
    const under = npc(NARNODE_UNDER);
    const p = player({ npcs: [under], answers: [0, 1] });
    assert.equal(await narnode.onTalkToNPC(p, npc(NARNODE)), true);
    assert.equal(p.questStages.grandTree, 1);
    assert.ok(p.inventory.has(BOOK) && p.inventory.has(BARK));
    assert.deepEqual(p.teleports, [[703, 3284], [415, 163]]);
    assert.ok(under.said.includes('take this bark sample to him, he should be able to help'));

    const no = player({ npcs: [npc(NARNODE_UNDER)], answers: [0, 0] });
    await narnode.onTalkToNPC(no, npc(NARNODE));
    assert.equal(no.questStages.grandTree, 0);
    assert.ok(!no.inventory.has(BOOK));
});

test('stage 1: Hazelmere takes the bark and speaks in the old tongue (stage 2); Narnode replaces a lost book', async () => {
    const early = player({ stage: 0 });
    await narnode.onTalkToNPC(early, npc(HAZELMERE));
    assert.deepEqual(early.messages, ['the mage mumbles in an ancient tounge', "you can't understand a word"]);

    const lost = player({ stage: 1, items: [BARK] });
    await narnode.onTalkToNPC(lost, npc(NARNODE));
    assert.ok(lost.inventory.has(BOOK));

    const p = player({ stage: 1, items: [BOOK, BARK] });
    await narnode.onTalkToNPC(p, npc(HAZELMERE));
    assert.equal(p.questStages.grandTree, 2);
    assert.ok(!p.inventory.has(BARK));
    assert.equal(p.sent[0].type, 'serverMessageOnTop');
    assert.equal(p.sent[0].message, narnode.HAZELMERE_WORDS);
});

test('stage 2: only the exact translation moves the quest (stage 3)', async () => {
    const right = [0, 4, 4, 4, 3, 1, 3];
    const p = player({ stage: 2, items: [BOOK], answers: [...right] });
    const king = npc(NARNODE);
    await narnode.onTalkToNPC(p, king);
    assert.equal(p.questStages.grandTree, 3);
    assert.ok(king.said.includes('please, could you tell the chief tree guardian glough'));
    assert.deepEqual(p.cache, {});

    // one wrong word anywhere and it is no good, and the flags are cleared
    for (const wrong of [
        [0, 3, 4, 4],
        [0, 4, 0, 4],
        [0, 4, 4, 4, 0],
        [0, 4, 4, 4, 3, 1, 0]
    ]) {
        const q = player({ stage: 2, answers: [...wrong] });
        const k = npc(NARNODE);
        await narnode.onTalkToNPC(q, k);
        assert.equal(q.questStages.grandTree, 2, JSON.stringify(wrong));
        assert.ok(k.said.includes("wait a minute, that doesn't sound like hazelmere"));
        assert.deepEqual(q.cache, {});
    }
});

test('stages 3-6: Glough hears of the theft, Narnode sends you to the prisoner, Charlie blames Glough, the journal', async () => {
    const p = player({ stage: 3 });
    await glough.onTalkToNPC(p, npc(GLOUGH));
    assert.equal(p.questStages.grandTree, 4);

    await narnode.onTalkToNPC(p, npc(NARNODE));
    assert.equal(p.questStages.grandTree, 5);

    await glough.onTalkToNPC(p, npc(CHARLIE));
    assert.equal(p.questStages.grandTree, 6);
    assert.equal(await glough.onNPCAttack(p, npc(CHARLIE)), true);
    assert.equal(p.messages.at(-1), "you can't attack through the bars");

    const shut = gameObject(619, 716, 1419);
    await glough.onGameObjectCommandOne(p, shut);
    assert.deepEqual(p.world.replaced.at(-1), [619, 620]);
    const open = gameObject(620, 716, 1419);
    await glough.onGameObjectCommandOne(p, open);
    assert.equal(p.questStages.grandTree, 7);
    assert.ok(p.inventory.has(JOURNAL));
    await glough.onGameObjectCommandOne(p, open);
    assert.equal(p.messages.at(-1), 'but find nothing of interest');
    await glough.onGameObjectCommandTwo(p, open);
    assert.deepEqual(p.world.replaced.at(-1), [620, 619]);
});

test('stage 7: Glough has you caged; Charlie tells of the foreman; Narnode lets you out (stage 8)', async () => {
    const charlie = npc(CHARLIE);
    const p = player({ stage: 7, npcs: [charlie] });
    await glough.onTalkToNPC(p, npc(GLOUGH));
    assert.equal(p.questStages.grandTree, 8);
    assert.deepEqual(p.teleports, [[419, 2992], [418, 2993]]);
    assert.ok(charlie.said.includes('the sea men use the pass word ka-lu-min'));
    assert.deepEqual(
        p.world.spawned.map((s) => s.id),
        [551, NARNODE]
    );
});

test('stage 8: the pilot crashes you in Karamja and a Jogre attacks', async () => {
    const broken = npc(BROKEN_PILOT);
    const jogre = npc(JOGRE);
    const p = player({ stage: 8, npcs: [broken, jogre], answers: [0] });
    await glider.onTalkToNPC(p, npc(PILOT));
    assert.deepEqual(p.teleports, [[221, 3567], [425, 764]]);
    assert.ok(p.messages.includes('you crash in south karamja'));
    assert.deepEqual(jogre.attacked, [p]);

    const before = player({ stage: 3 });
    await glider.onTalkToNPC(before, npc(PILOT));
    assert.deepEqual(before.teleports, []);

    const glide = player();
    assert.equal(await glider.onGameObjectCommandOne(glide, gameObject(618, 413, 2999)), true);
    assert.deepEqual(glide.messages, ['only the gnomes can fly these']);
});

test('stage 8: the shipyard gate wants ka-lu-min; a wrong syllable sets the worker on you', async () => {
    const gate = gameObject(624, 401, 762);
    const worker = npc(GATE_WORKER);
    const p = player({ stage: 8, npcs: [worker], y: 763, answers: [1, 0, 1, 1] });
    assert.equal(await shipyard.onGameObjectCommandOne(p, gate), true);
    assert.deepEqual(p.teleports, [[402, 760]]);
    assert.ok(p.said.includes('ka lu min'));
    assert.deepEqual(p.cache, {});

    const wrong = npc(GATE_WORKER);
    const q = player({ stage: 8, npcs: [wrong], y: 763, answers: [1, 0, 1, 0] });
    await shipyard.onGameObjectCommandOne(q, gate);
    assert.deepEqual(q.teleports, []);
    assert.deepEqual(wrong.attacked, [q]);

    // a wrong first or second syllable with the right last one: the worker just waits (as in the Java)
    const unsure = npc(GATE_WORKER);
    const r = player({ stage: 8, npcs: [unsure], y: 763, answers: [1, 0, 0, 1] });
    await shipyard.onGameObjectCommandOne(r, gate);
    assert.deepEqual(r.teleports, []);
    assert.deepEqual(unsure.attacked, []);

    // before the quest reaches Karamja the gate is just locked; from inside it opens
    const early = player({ stage: 3, npcs: [npc(GATE_WORKER)], y: 763 });
    await shipyard.onGameObjectCommandOne(early, gate);
    assert.deepEqual(early.messages, ['the gate is locked']);
    const inside = player({ stage: 3, y: 760 });
    await shipyard.onGameObjectCommandOne(inside, gate);
    assert.deepEqual(inside.teleports, [[401, 763]]);

    const chatty = player();
    assert.equal(await shipyard.onTalkToNPC(chatty, npc(WORKER)), true);
    assert.equal(chatty.said[0], 'hello');
});

test('stage 8: the foreman quiz gives the invoice (stage 10); a wrong answer (9) means killing him for it', async () => {
    const hut = npc(HUT_FOREMAN);
    const p = player({ stage: 8, npcs: [hut], answers: [2, 1, 1] });
    await shipyard.onTalkToNPC(p, npc(FOREMAN));
    assert.equal(p.questStages.grandTree, 10);
    assert.ok(p.inventory.has(INVOICE));
    assert.deepEqual(p.teleports, [[408, 753]]);
    assert.equal(await shipyard.onNPCAttack(p, hut), true);
    await shipyard.onTalkToNPC(p, npc(FOREMAN));
    assert.equal(p.messages.at(-1), 'the forman is too busy to talk');

    const angry = npc(HUT_FOREMAN);
    const q = player({ stage: 8, npcs: [angry], answers: [2, 1, 2] });
    await shipyard.onTalkToNPC(q, npc(FOREMAN));
    assert.equal(q.questStages.grandTree, 9);
    assert.deepEqual(angry.attacked, [q]);
    assert.equal(await shipyard.onNPCDeath(q, angry), false);
    assert.equal(q.questStages.grandTree, 10);
    assert.ok(q.inventory.has(INVOICE));
});

test('stage 10: Femi smuggles you in (free after the barrel, else 1000 coins); Charlie names Anita (stage 11)', async () => {
    const inside = npc(FEMI_INSIDE);
    const helped = player({ stage: 10, cache: { helpedFemi: true }, npcs: [inside] });
    await stronghold.onTalkToNPC(helped, npc(FEMI));
    assert.deepEqual(helped.teleports, [[708, 510]]);
    assert.ok(helped.said.includes('thanks again femi'));

    const paid = player({ stage: 10, cache: { helpedFemi: false }, items: [[10, 1500]], answers: [1] });
    await stronghold.onTalkToNPC(paid, npc(FEMI));
    assert.deepEqual(paid.teleports, [[708, 510]]);
    assert.equal(paid.inventory.count(10), 500);

    const broke = player({ stage: 10, answers: [1] });
    await stronghold.onTalkToNPC(broke, npc(FEMI));
    assert.deepEqual(broke.teleports, []);

    const busy = player({ stage: 3 });
    await stronghold.onTalkToNPC(busy, npc(FEMI));
    assert.deepEqual(busy.messages, ['the little gnome is too busy to talk']);

    await glough.onTalkToNPC(paid, npc(CHARLIE));
    assert.equal(paid.questStages.grandTree, 11);
});

test("stage 11: Anita's key opens Glough's chest: his notes (stage 12)", async () => {
    const p = player({ stage: 11, cache: { helpedFemi: true } });
    const chest = gameObject(632, 715, 1418);
    await glough.onGameObjectCommandOne(p, chest);
    assert.equal(p.messages.at(-1), '...you need a key');

    await glough.onTalkToNPC(p, npc(ANITA));
    assert.ok(p.inventory.has(KEY));
    assert.equal(await glough.onUseWithGameObject(p, chest, { id: KEY }), true);
    assert.equal(p.questStages.grandTree, 12);
    assert.ok(p.inventory.has(NOTES) && p.inventory.has(BOOK));
    assert.deepEqual(p.world.replaced, [[632, 631, 5]]);
    assert.equal('helpedFemi' in p.cache, false);
});

test('stage 12: Narnode takes the notes and gives the four pebbles (stage 13), and replaces lost ones', async () => {
    const p = player({ stage: 12, items: [NOTES] });
    await narnode.onTalkToNPC(p, npc(NARNODE));
    assert.equal(p.questStages.grandTree, 13);
    assert.ok(PEBBLES.every((id) => p.inventory.has(id)));

    p.inventory.remove(927);
    p.cache.pebble2 = true;
    await narnode.onTalkToNPC(p, npc(NARNODE));
    assert.ok(PEBBLES.every((id) => p.inventory.has(id)));
    assert.equal(p.cache.pebble2, undefined);
});

test('stage 13: the watch tower (agility 25), the pebbles in order and the stand opens the trunk (stage 14)', async () => {
    const weak = player({ stage: 13, levels: { agility: 10 } });
    await roots.onGameObjectCommandOne(weak, gameObject(635, 710, 1420));
    assert.deepEqual(weak.teleports, []);

    const p = player({ stage: 13, items: [...PEBBLES], levels: { agility: 30 }, answers: [0, 1, 2, 3] });
    await roots.onGameObjectCommandOne(p, gameObject(635, 710, 1420));
    assert.deepEqual(p.teleports, [[710, 2364]]);
    assert.deepEqual(p.experience, [['agility', 30]]);

    const stand = gameObject(634, 709, 2364);
    await roots.onGameObjectCommandTwo(p, stand);
    assert.ok(p.messages.includes('...but nothing seems to happen'));

    // a pebble in the wrong indent crumbles for nothing
    const q = player({ stage: 13, items: [927], answers: [3] });
    await roots.onUseWithGameObject(q, stand, { id: 927 });
    assert.ok(!q.inventory.has(927));
    assert.deepEqual(q.cache, {});

    for (const id of PEBBLES) {
        await roots.onUseWithGameObject(p, stand, { id });
    }
    assert.deepEqual(p.cache, { pebble1: true, pebble2: true, pebble3: true, pebble4: true });

    // "come back later" keeps stage 14; the stand opens again without pebbles
    const later = player({ stage: 13, cache: { ...p.cache }, answers: [1] });
    await roots.onGameObjectCommandTwo(later, stand);
    assert.equal(later.questStages.grandTree, 14);
    assert.deepEqual(later.cache, {});
    assert.equal(later.messages.at(-1), 'you decide to come back later');
});

test('stage 14: down the trunk Glough sets the Black Demon on you; killing it (stage 15)', async () => {
    const p = player({ stage: 14, answers: [0] });
    await roots.onGameObjectCommandTwo(p, gameObject(634, 709, 2364));
    assert.deepEqual(p.teleports, [[711, 3306]]);
    assert.deepEqual(
        p.world.spawned.map((s) => [s.id, s.x, s.y]),
        [
            [GLOUGH_UNDER, 709, 3306],
            [DEMON, 709, 3306]
        ]
    );
    const demon = p.world.npcList.find((n) => n.id === DEMON);
    assert.deepEqual(demon.attacked, [p]);
    assert.deepEqual(demon.shouted, ['grrrrr']);

    assert.equal(await roots.onNPCDeath(p, demon), false);
    assert.equal(p.questStages.grandTree, 15);
    assert.ok(p.world.removed.some((n) => n.id === GLOUGH_UNDER));

    // after that the stand drops you straight down
    const again = player({ stage: 15 });
    await roots.onGameObjectCommandTwo(again, gameObject(634, 709, 2364));
    assert.deepEqual(again.teleports, [[711, 3306]]);
});

test('stages 15-16: Narnode underground, the Daconia rock in the root, and the reward (-1)', async () => {
    const p = player({ stage: 15, levels: { agility: 20, attack: 40, magic: 30 } });
    await narnode.onTalkToNPC(p, npc(NARNODE_UNDER));
    assert.equal(p.questStages.grandTree, 16);

    await roots.onGameObjectCommandOne(p, gameObject(609, 708, 3296));
    assert.ok(!p.inventory.has(DACONIA));
    await roots.onGameObjectCommandOne(p, gameObject(637, 707, 3297));
    assert.ok(p.inventory.has(DACONIA));
    await roots.onGameObjectCommandOne(p, gameObject(637, 707, 3297));
    assert.equal(p.inventory.count(DACONIA), 1);

    await narnode.onTalkToNPC(p, npc(NARNODE_UNDER));
    assert.equal(p.questStages.grandTree, -1);
    assert.deepEqual(p.completed, [
        [
            'grandTree',
            {
                questPoints: 5,
                experience: { agility: 1600 + 1200 * 20, attack: 1600 + 1200 * 40, magic: 600 + 200 * 30 },
                message: 'well done you have completed the grand tree quest'
            }
        ]
    ]);
    assert.ok(!p.inventory.has(DACONIA));
});

test('after the quest: the roots to the gnome mine and the glider routes', async () => {
    const p = player({ stage: -1 });
    await roots.onGameObjectCommandOne(p, gameObject(638, 701, 3280));
    assert.deepEqual(p.teleports, [[701, 3278]]);
    await roots.onGameObjectCommandOne(p, gameObject(639, 701, 3279));
    assert.deepEqual(p.teleports.at(-1), [700, 3280]);

    const before = player({ stage: 16 });
    await roots.onGameObjectCommandOne(before, gameObject(638, 701, 3280));
    assert.deepEqual(before.teleports, []);

    const flier = player({ stage: -1, answers: [1] });
    await glider.onTalkToNPC(flier, npc(PILOT));
    assert.deepEqual(flier.teleports, [[221, 3567], [58, 504]]);

    const back = player({ stage: -1, answers: [0] });
    await glider.onTalkToNPC(back, npc(569));
    assert.deepEqual(back.teleports, [[221, 3567], [414, 2995]]);
});

test('the Daconia rocks hold no ore', async () => {
    const rock = gameObject(699, 712, 3301);
    const noPick = player();
    assert.equal(await roots.onGameObjectCommandOne(noPick, rock), true);
    assert.equal(noPick.messages[0], 'You need a pickaxe to mine this rock');

    const p = player({ items: [156] });
    await roots.onGameObjectCommandOne(p, rock);
    assert.deepEqual(p.messages, [
        '@que@You swing your pick at the rock...',
        '@que@There is currently no ore available in this rock'
    ]);
    await roots.onGameObjectCommandTwo(p, rock);
    assert.equal(p.messages.at(-1), '@que@You fail to find anything interesting');
});
