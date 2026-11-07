// Observatory Quest (quests/members/observatory-quest.js, port of Observatory.java and the lens crafting of Crafting.java) and
// the Spirit of Scorpius (npcs/ardougne/spirit-of-scorpius.js, SpiritOfScorpius.java): every stage driven with fake objects,
// from the Professor's request to the telescope's reward.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const observatory = require('../src/plugins/quests/members/observatory-quest');
const scorpius = require('../src/plugins/npcs/ardougne/spirit-of-scorpius');
const climbable = require('../src/plugins/game-objects/climbable');
const { fakeNpc, fakeWorld, fakePlayer, gameObject } = require('./quest-fakes-3b');

const PROFESSOR = 652;
const ASSISTANT = 654;
const DOME_PROFESSOR = 662;
const GOBLIN_GUARD = 651;
const SPIRIT = 665;
const GHOST = 664;

const PLANK = 410;
const BRONZE_BAR = 169;
const MOLTEN_GLASS = 623;
const LENS_MOULD = 1017;
const LENS = 1018;
const KEEP_KEY = 1012;
const WINE = 142;
const SAPPHIRE = 160;

const PLUGIN_TYPES = [
    .../const PLUGIN_TYPES = \[([\s\S]*?)\]/
        .exec(fs.readFileSync(require.resolve('../src/model/world.js'), 'utf8'))[1]
        .matchAll(/'(\w+)'/g)
].map((m) => m[1]);

function player(opts = {}) {
    const p = fakePlayer({ quest: 'observatoryQuest', ...opts });

    p.sent = [];
    p.send = (message) => p.sent.push(message);
    p.addExperience = (skill, amount) => p.experience.push([skill, amount]);

    return p;
}

function count(p, id) {
    return p.inventory.count(id);
}

test('every exported hook is a plugin type', () => {
    for (const plugin of [observatory, scorpius]) {
        for (const name of Object.keys(plugin)) {
            assert.ok(PLUGIN_TYPES.includes(name), name);
        }
    }
});

test('stage 0: the Professor asks for help and the first part is the planks (1)', async () => {
    const no = player({ answers: [3] });
    const professor = fakeNpc(PROFESSOR);
    assert.equal(await observatory.onTalkToNPC(no, professor), true);
    assert.equal(no.questStages.observatoryQuest, 0);

    // the telescope, then "Oh sorry, I don't have time for that"
    const busy = player({ answers: [1, 1] });
    await observatory.onTalkToNPC(busy, fakeNpc(PROFESSOR));
    assert.equal(busy.questStages.observatoryQuest, 0);

    const yes = player({ answers: [1, 0] });
    const p = fakeNpc(PROFESSOR);
    await observatory.onTalkToNPC(yes, p);
    assert.equal(yes.questStages.observatoryQuest, 1);
    assert.ok(p.said.includes('First I need three planks of wood for the tripod'));
    assert.equal(yes.interlocutor, null);
});

test('stages 1-5: planks, bronze, molten glass, the mould and the lens move the quest on and are taken', async () => {
    // planks: three needed
    const planks = player({ stage: 1, items: [[PLANK, 2]], answers: [0] });
    await observatory.onTalkToNPC(planks, fakeNpc(PROFESSOR));
    assert.equal(planks.questStages.observatoryQuest, 1);
    assert.equal(count(planks, PLANK), 2);

    const three = player({ stage: 1, items: [[PLANK, 3]], answers: [0] });
    await observatory.onTalkToNPC(three, fakeNpc(PROFESSOR));
    assert.equal(three.questStages.observatoryQuest, 2);
    assert.equal(count(three, PLANK), 0);

    // bronze
    const noBronze = player({ stage: 2, answers: [0] });
    await observatory.onTalkToNPC(noBronze, fakeNpc(PROFESSOR));
    assert.equal(noBronze.questStages.observatoryQuest, 2);
    const bronze = player({ stage: 2, items: [BRONZE_BAR], answers: [0] });
    await observatory.onTalkToNPC(bronze, fakeNpc(PROFESSOR));
    assert.equal(bronze.questStages.observatoryQuest, 3);
    assert.equal(count(bronze, BRONZE_BAR), 0);

    // molten glass is kept, the mould is asked for
    const glass = player({ stage: 3, items: [MOLTEN_GLASS], answers: [0] });
    await observatory.onTalkToNPC(glass, fakeNpc(PROFESSOR));
    assert.equal(glass.questStages.observatoryQuest, 4);
    assert.equal(count(glass, MOLTEN_GLASS), 1);

    // the mould: asked for at 4, he does not take it until the lens is made
    const mould = player({ stage: 4, items: [LENS_MOULD], answers: [0, 0] });
    await observatory.onTalkToNPC(mould, fakeNpc(PROFESSOR));
    assert.equal(mould.questStages.observatoryQuest, 5);
    assert.equal(count(mould, LENS_MOULD), 1);

    // the answer "No sorry I'm not good at that" goes on as well
    const noCraft = player({ stage: 4, items: [LENS_MOULD], answers: [0, 1] });
    await observatory.onTalkToNPC(noCraft, fakeNpc(PROFESSOR));
    assert.equal(noCraft.questStages.observatoryQuest, 5);

    const lost = player({ stage: 4, answers: [0] });
    await observatory.onTalkToNPC(lost, fakeNpc(PROFESSOR));
    assert.equal(lost.questStages.observatoryQuest, 4);

    // the lens: taken with the mould -> 6
    const lens = player({ stage: 5, items: [LENS, LENS_MOULD], answers: [0] });
    const professor = fakeNpc(PROFESSOR);
    await observatory.onTalkToNPC(lens, professor);
    assert.equal(lens.questStages.observatoryQuest, 6);
    assert.equal(count(lens, LENS), 0);
    assert.equal(count(lens, LENS_MOULD), 0);
    assert.ok(professor.said.includes('Meet me at the Observatory later...'));

    const noLens = player({ stage: 5, answers: [0] });
    await observatory.onTalkToNPC(noLens, fakeNpc(PROFESSOR));
    assert.equal(noLens.questStages.observatoryQuest, 5);
});

test('the assistant helps at every stage and gives wine at 6 and once after the quest', async () => {
    for (const stage of [1, 2, 3, 4, 5]) {
        const p = player({ stage, answers: [0] });
        const a = fakeNpc(ASSISTANT);
        await observatory.onTalkToNPC(p, a);
        assert.ok(a.said.length > 1, `stage ${stage}`);
    }

    const waiting = player({ stage: 6 });
    await observatory.onTalkToNPC(waiting, fakeNpc(ASSISTANT));
    assert.equal(count(waiting, WINE), 1);

    const done = player({ stage: -1 });
    await observatory.onTalkToNPC(done, fakeNpc(ASSISTANT));
    assert.equal(count(done, WINE), 1);
    assert.equal(done.cache.observatory_assistant_drink, true);
    const again = fakeNpc(ASSISTANT);
    await observatory.onTalkToNPC(done, again);
    assert.equal(count(done, WINE), 1);
    assert.deepEqual(again.said, ['Thanks again']);
});

test('the lens mould is under the sacks, once', async () => {
    const p = player({ stage: 4 });
    assert.equal(await observatory.onGameObjectCommandOne(p, gameObject(927, 692, 3515)), true);
    assert.equal(count(p, LENS_MOULD), 1);
    await observatory.onGameObjectCommandOne(p, gameObject(927, 692, 3515));
    assert.equal(count(p, LENS_MOULD), 1);
    assert.ok(p.messages.includes('You already have this lens mould'));
});

test('chests: the key chest, the cure chest, the empty chest and the spider chest', async () => {
    const world = fakeWorld();
    const p = player({ stage: 4, world });

    // key chest 930: open (a timed open one), search 919 -> the keep key; searching again gives none
    await observatory.onGameObjectCommandOne(p, gameObject(930, 717, 3542));
    assert.deepEqual(world.timed.pop().slice(0, 2), [930, 919]);
    await observatory.onGameObjectCommandOne(p, gameObject(919, 717, 3542));
    assert.equal(count(p, KEEP_KEY), 1);
    assert.deepEqual(world.replaced.pop(), [919, 930]);
    await observatory.onGameObjectCommandOne(p, gameObject(919, 717, 3542));
    assert.equal(count(p, KEEP_KEY), 1);
    assert.ok(p.messages.some((m) => /already have a keep key/.test(m)));

    // the "Close" command searches too (Open-RSC ignores the command)
    const second = player({ stage: 4, world });
    await observatory.onGameObjectCommandTwo(second, gameObject(919, 717, 3542));
    assert.equal(count(second, KEEP_KEY), 1);

    // cure chest 935 -> 934 -> a dose of cure poison
    await observatory.onGameObjectCommandOne(p, gameObject(935, 705, 3520));
    assert.deepEqual(world.timed.pop().slice(0, 2), [935, 934]);
    await observatory.onGameObjectCommandOne(p, gameObject(934, 705, 3520));
    assert.equal(count(p, 568), 1);

    // empty chests
    await observatory.onGameObjectCommandOne(p, gameObject(937, 677, 3526));
    assert.deepEqual(world.timed.pop().slice(0, 2), [937, 936]);
    await observatory.onGameObjectCommandOne(p, gameObject(936, 677, 3526));
    assert.ok(p.messages.includes('The chest contains nothing'));

    // spider chest 929 -> 917 -> a dungeon spider that attacks
    await observatory.onGameObjectCommandOne(p, gameObject(929, 711, 3522));
    assert.deepEqual(world.timed.pop().slice(0, 2), [929, 917]);
    await observatory.onGameObjectCommandOne(p, gameObject(917, 711, 3522));
    assert.equal(world.spawned.length, 1);
    assert.equal(world.spawned[0].id, 656);
    assert.deepEqual([world.spawned[0].x, world.spawned[0].y], [711, 3522]);
    assert.equal(world.npcList.find((n) => n.id === 656).attacked[0], p);

    // "Examine" is not a click on a chest
    assert.equal(await observatory.onGameObjectCommandTwo(p, gameObject(929, 711, 3522)), false);
});

test('the keep gate: locked, the keep key unlocks it for good, then it is passed both ways', async () => {
    const gate = gameObject(926, 689, 3513);
    const p = player({ stage: 4, y: 3513, x: 690 });

    await observatory.onGameObjectCommandOne(p, gate);
    assert.ok(p.messages.includes('The gate is locked'));
    assert.deepEqual(p.teleports, []);

    const guard = fakeNpc(GOBLIN_GUARD, { x: 690, y: 3512 });
    const world = fakeWorld({ npcs: [guard] });
    const withKey = player({ stage: 4, world, items: [KEEP_KEY], y: 3513, x: 690 });
    assert.equal(await observatory.onUseWithGameObject(withKey, gate, { id: KEEP_KEY }), true);
    assert.equal(count(withKey, KEEP_KEY), 0);
    assert.equal(withKey.cache.keep_key_gate, true);
    assert.deepEqual(guard.attacked, [withKey]);

    // in (y <= 3513 goes to 690,3514), then back out
    await observatory.onGameObjectCommandOne(withKey, gate);
    assert.deepEqual(withKey.teleports, [[690, 3514]]);
    assert.ok(withKey.said.includes("I'd better be quick"));
    await observatory.onGameObjectCommandOne(withKey, gate);
    assert.deepEqual(withKey.teleports.at(-1), [690, 3513]);

    // another item on the gate is not ours
    assert.equal(await observatory.onUseWithGameObject(p, gate, { id: 1 }), false);
    // other gates 926 are not ours
    assert.equal(await observatory.onGameObjectCommandOne(p, gameObject(926, 100, 100)), false);
});

test('the ladder: free at 0, 6 and -1, the assistant must be near at 1-5; the default climb leaves it alone', async () => {
    const ladder = gameObject(928, 712, 679);

    const start = player({ stage: 0 });
    await observatory.onGameObjectCommandOne(start, ladder);
    assert.deepEqual(start.teleports, [[712, 3512]]);

    for (const stage of [6, -1]) {
        const p = player({ stage });
        await observatory.onGameObjectCommandOne(p, ladder);
        assert.deepEqual(p.teleports, [[712, 3512]], `stage ${stage}`);
    }

    // the assistant is in the room: he warns, then the ladder works
    const assistant = fakeNpc(ASSISTANT);
    const world = fakeWorld({ npcs: [assistant] });
    const p = player({ stage: 2, world });
    await observatory.onGameObjectCommandOne(p, ladder);
    assert.deepEqual(p.teleports, [[712, 3512]]);
    assert.ok(assistant.said.includes('Take great care down there'));

    // nobody near: nothing happens
    const alone = player({ stage: 2 });
    await observatory.onGameObjectCommandOne(alone, ladder);
    assert.deepEqual(alone.teleports, []);

    // climbable.js leaves 928 to this plugin
    const climbing = player({ stage: 0 });
    assert.equal(await climbable.onGameObjectCommandOne(climbing, gameObject(928, 712, 679)), false);
});

test('molten glass on the lens mould makes the lens from stage 5 on, not before', async () => {
    for (const stage of [0, 1, 2, 3, 4]) {
        const p = player({ stage, items: [MOLTEN_GLASS, LENS_MOULD] });
        assert.equal(await observatory.onUseWithInventory(p, { id: MOLTEN_GLASS }, { id: LENS_MOULD }), true);
        assert.equal(count(p, LENS), 0);
        assert.ok(p.said.includes('Perhaps I should speak to the professor first'));
    }

    for (const stage of [5, 6, -1]) {
        const p = player({ stage, items: [MOLTEN_GLASS, LENS_MOULD] });
        assert.equal(await observatory.onUseWithInventory(p, { id: LENS_MOULD }, { id: MOLTEN_GLASS }), true);
        assert.equal(count(p, LENS), 1);
        assert.equal(count(p, MOLTEN_GLASS), 0);
        assert.equal(count(p, LENS_MOULD), 1);
    }

    // a low crafting level is told off and still makes it ("authentically bugged")
    const low = player({ stage: 5, items: [MOLTEN_GLASS, LENS_MOULD], levels: { crafting: 5 } });
    await observatory.onUseWithInventory(low, { id: MOLTEN_GLASS }, { id: LENS_MOULD });
    assert.ok(low.messages.includes('Sorry, you need a crafting level'));
    assert.equal(count(low, LENS), 1);

    assert.equal(await observatory.onUseWithInventory(player({ stage: 5 }), { id: MOLTEN_GLASS }, { id: 1 }), false);
});

test('the telescope: not operational before 6; at 6 a constellation, its gift, the rewards and -1', async () => {
    const scope = gameObject(925, 713, 699);

    const early = player({ stage: 3 });
    await observatory.onGameObjectCommandOne(early, scope);
    assert.ok(early.messages.includes('It seems that the telescope is not operational'));
    assert.equal(early.sent.length, 1);
    assert.equal(early.sent[0].message.trim(), '');

    // nobody to talk to with the dome's Professor away
    const alone = player({ stage: 6 });
    await observatory.onGameObjectCommandOne(alone, scope);
    assert.equal(alone.questStages.observatoryQuest, 6);

    // random 0.5 -> 6: Scorpio, weapon poison
    const dome = fakeNpc(DOME_PROFESSOR);
    const world = fakeWorld({ npcs: [dome] });
    const real = Math.random;
    Math.random = () => 0.5;

    try {
        const p = player({ stage: 6, world, answers: [0], levels: { crafting: 20 } });
        await observatory.onGameObjectCommandOne(p, scope);
        assert.equal(p.questStages.observatoryQuest, -1);
        assert.equal(count(p, 572), 1);
        assert.equal(count(p, SAPPHIRE), 1);
        assert.ok(dome.said.includes('Scorpio the scorpion'));
        assert.equal(p.completed.length, 1);
        assert.deepEqual(p.completed[0], [
            'observatoryQuest',
            { questPoints: 2, experience: { crafting: 1000 + 400 * 20 } }
        ]);
        // the box showed a sky with stars
        assert.ok(p.sent[0].message.includes('*'));
    } finally {
        Math.random = real;
    }
});

test('each constellation gives its gift; the optional skills get 500 + 100 x level', async () => {
    const scope = gameObject(925, 713, 699);
    const gifts = [
        { selected: 0, xp: ['defense', 500 + 100 * 30] },
        { selected: 1, item: [42, 3] },
        { selected: 2, item: [426, 1] },
        { selected: 3, item: [367, 3] },
        { selected: 4, item: [492, 1] },
        { selected: 5, item: [32, 25] },
        { selected: 6, item: [572, 1] },
        { selected: 7, xp: ['attack', 500 + 100 * 30] },
        { selected: 8, item: [652, 1] },
        { selected: 9, xp: ['hits', 500 + 100 * 30] },
        { selected: 10, xp: ['strength', 500 + 100 * 30] },
        { selected: 11, item: [315, 1] }
    ];
    const real = Math.random;

    try {
        for (const gift of gifts) {
            // floor(random * 12) = selected
            Math.random = () => (gift.selected + 0.5) / 12;

            const dome = fakeNpc(DOME_PROFESSOR);
            const p = player({ stage: 6, world: fakeWorld({ npcs: [dome] }), answers: [1] });
            await observatory.onGameObjectCommandOne(p, scope);

            assert.equal(p.questStages.observatoryQuest, -1, `constellation ${gift.selected}`);
            assert.equal(count(p, SAPPHIRE), 1);

            if (gift.item) {
                assert.equal(count(p, gift.item[0]), gift.item[1], `constellation ${gift.selected}`);
            } else {
                assert.deepEqual(p.experience.at(-1), gift.xp, `constellation ${gift.selected}`);
            }
        }
    } finally {
        Math.random = real;
    }
});

test('after the quest the telescope always shows the scorpion and the Professor talks of the stars', async () => {
    const dome = fakeNpc(DOME_PROFESSOR);
    const p = player({ stage: -1, world: fakeWorld({ npcs: [dome] }), answers: [0] });
    await observatory.onGameObjectCommandOne(p, gameObject(925, 713, 699));
    assert.equal(p.questStages.observatoryQuest, -1);
    assert.ok(dome.said.includes('Yes, I feel the stars have a message for you...'));
    assert.ok(p.sent[0].message.includes('*'));

    const talk = fakeNpc(DOME_PROFESSOR);
    await observatory.onTalkToNPC(player({ stage: -1 }), talk);
    assert.deepEqual(talk.said, ['Hello friend', 'The stars hold many secrets', 'The moon rises in Scorpio...']);

    const prof = fakeNpc(PROFESSOR);
    await observatory.onTalkToNPC(player({ stage: -1, answers: [0] }), prof);
    assert.ok(prof.said.includes('But the stars may hold a secret for you...'));
});

test('a goblin guard threatens and attacks', async () => {
    const guard = fakeNpc(GOBLIN_GUARD);
    const p = player({ stage: 0 });
    assert.equal(await observatory.onTalkToNPC(p, guard), true);
    assert.deepEqual(guard.said, ['What are you doing here ?', 'This is our domain now', 'Begone foul human!']);
    assert.deepEqual(guard.attacked, [p]);
    assert.equal(await observatory.onTalkToNPC(p, fakeNpc(1)), false);
});

test('Spirit of Scorpius: refuses before the quest, then gives the mould, blesses the symbol and replaces the mould', async () => {
    const SPIRIT_MOULD = 1026;
    const UNBLESSED = 1028;
    const BLESSED = 1029;

    const no = player({ stage: 4 });
    const s = fakeNpc(SPIRIT);
    assert.equal(await scorpius.onTalkToNPC(no, s), true);
    assert.deepEqual(s.said, ['How dare you disturb me!']);

    // "I seek your wisdom" -> the mould and the cache
    const first = player({ stage: -1, answers: [0] });
    await scorpius.onTalkToNPC(first, fakeNpc(SPIRIT));
    assert.equal(count(first, SPIRIT_MOULD), 1);
    assert.equal(first.cache.scorpius_mould, true);

    // the blessing needs the unblessed symbol
    const bless = player({ stage: -1, cache: { scorpius_mould: true }, items: [UNBLESSED], answers: [0] });
    await scorpius.onTalkToNPC(bless, fakeNpc(SPIRIT));
    assert.equal(count(bless, UNBLESSED), 0);
    assert.equal(count(bless, BLESSED), 1);

    const nothing = player({ stage: -1, cache: { scorpius_mould: true }, answers: [0] });
    const n = fakeNpc(SPIRIT);
    await scorpius.onTalkToNPC(nothing, n);
    assert.ok(n.said.includes('No blessings will be given to those'));

    // another mould only when there is none in the pack
    const replace = player({ stage: -1, cache: { scorpius_mould: true }, answers: [1] });
    await scorpius.onTalkToNPC(replace, fakeNpc(SPIRIT));
    assert.equal(count(replace, SPIRIT_MOULD), 1);
    const have = player({ stage: -1, cache: { scorpius_mould: true }, items: [SPIRIT_MOULD], answers: [1] });
    await scorpius.onTalkToNPC(have, fakeNpc(SPIRIT));
    assert.equal(count(have, SPIRIT_MOULD), 1);

    // the ghosts attack
    const ghost = fakeNpc(GHOST);
    const p = player({ stage: 0 });
    await scorpius.onTalkToNPC(p, ghost);
    assert.deepEqual(ghost.said, ['We are waiting for you']);
    assert.deepEqual(ghost.attacked, [p]);

    // the grave
    const grave = player({ stage: 0 });
    assert.equal(await scorpius.onGameObjectCommandOne(grave, gameObject(941, 694, 649)), true);
    assert.ok(grave.messages.includes('may seek his counsel'));
});
