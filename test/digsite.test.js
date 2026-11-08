// The Dig Site (quests/members/digsite/*, port of authentic/quests/members/digsite/*.java with the Curator's use-on, the
// Herblaw explosive compound and the InvAction readings): every stage from the Examiner's letter to the stone tablet, driven
// with fake objects. The panning (game-objects/panning.js) and the workman pickpocket (skills/thieving.js) have their own tests.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const shared = require('../src/plugins/quests/members/digsite/shared');
const dialogue = require('../src/plugins/quests/members/digsite/dialogue');
const mechanism = require('../src/plugins/quests/members/digsite/mechanism');
const digAreas = require('../src/plugins/quests/members/digsite/dig-areas');
const items = require('../src/plugins/quests/members/digsite/items');
const herblaw = require('../src/plugins/quests/members/digsite/herblaw');
const curator = require('../src/plugins/quests/members/digsite/curator');
const { fakeNpc, fakeWorld, fakePlayer, gameObject } = require('./quest-fakes-3b');

const { NPC, ITEM } = shared;

const PLUGIN_TYPES = [
    ...(/const PLUGIN_TYPES = \[([\s\S]*?)\]/
        .exec(fs.readFileSync(require.resolve('../src/model/world.js'), 'utf8'))[1]
        .matchAll(/'(\w+)'/g))
].map((m) => m[1]);

function player(opts = {}) {
    const p = fakePlayer({ quest: 'digsite', ...opts });
    p.sent = [];
    p.send = (m) => p.sent.push(m);
    p.isTired = () => Boolean(opts.tired);
    p.equippedIds = opts.equipped || [];
    return p;
}

async function talk(p, id) {
    const npc = fakeNpc(id);
    assert.equal(await dialogue.onTalkToNPC(p, npc), true);
    assert.equal(p.interlocutor, null);
    return npc;
}

async function useOn(p, id, itemId) {
    const npc = fakeNpc(id);
    assert.equal(await dialogue.onUseWithNPC(p, npc, { id: itemId }), true);
    assert.equal(p.interlocutor, null);
    return npc;
}

const stage = (p) => p.questStages.digsite;
const rolls = (...values) => {
    const queue = [...values];
    shared.rng.int = () => queue.shift();
};

test.afterEach(() => {
    shared.rng.int = (low, high) => low + Math.floor(Math.random() * (high - low + 1));
});

test('every exported hook is a plugin type', () => {
    for (const plugin of [dialogue, mechanism, digAreas, items, herblaw, curator]) {
        for (const name of Object.keys(plugin)) {
            if (/^on[A-Z]/.test(name)) {
                assert.ok(PLUGIN_TYPES.includes(name), name);
            }
        }
    }
});

test('hooks leave other npcs and objects alone', async () => {
    const p = player();
    assert.equal(await dialogue.onTalkToNPC(p, fakeNpc(1)), false);
    assert.equal(await dialogue.onUseWithNPC(p, fakeNpc(1), { id: ITEM.TROWEL }), false);
    assert.equal(await curator.onUseWithNPC(p, fakeNpc(1), { id: ITEM.UNSTAMPED_LETTER }), false);
    assert.equal(await curator.onUseWithNPC(p, fakeNpc(NPC.CURATOR), { id: 1 }), false);
    assert.equal(await mechanism.onGameObjectCommandOne(p, gameObject(2, 0, 0)), false);
    assert.equal(await mechanism.onUseWithGameObject(p, gameObject(2, 0, 0), { id: 1 }), false);
    assert.equal(await digAreas.onUseWithGameObject(p, gameObject(2, 0, 0), { id: 1 }), false);
    assert.equal(await items.onInventoryCommand(p, { id: 1 }), false);
    assert.equal(await items.onDropItem(p, { id: 1 }), false);
    assert.equal(await herblaw.onUseWithInventory(p, { id: 1 }, { id: 2 }), false);
});

// ---------------------------------------------------------------- stage 0 -> 1 -> 2: the letter

test('stage 0: the Examiner offers the exam; "Can I take an exam ?" gives the unstamped letter (1)', async () => {
    const no = player({ answers: [1] });
    const e = await talk(no, NPC.EXAMINER);
    assert.equal(stage(no), 0);
    assert.ok(e.said.includes('You could gain much with an understanding of the world below'));
    assert.equal(no.inventory.has(ITEM.UNSTAMPED_LETTER), false);

    const p = player({ answers: [0] });
    const n = await talk(p, NPC.EXAMINER);
    assert.equal(stage(p), 1);
    assert.equal(p.inventory.count(ITEM.UNSTAMPED_LETTER), 1);
    assert.ok(n.said.includes('By the curator of varrock museum'));
});

test('stage 1: no stamped letter yet: a lost letter is replaced once, the one carried is not', async () => {
    const lost = player({ stage: 1, answers: [0] });
    const n = await talk(lost, NPC.EXAMINER);
    assert.ok(n.said.includes('I am still waiting for your stamped letter of recommendation'));
    assert.equal(lost.inventory.count(ITEM.UNSTAMPED_LETTER), 1);
    assert.ok(n.said.includes('That was foolish!'));

    const has = player({ stage: 1, items: [ITEM.UNSTAMPED_LETTER], answers: [0] });
    const h = await talk(has, NPC.EXAMINER);
    assert.equal(has.inventory.count(ITEM.UNSTAMPED_LETTER), 1);
    assert.ok(h.said.includes('Oh now come on'));

    const leave = player({ stage: 1, answers: [1] });
    const l = await talk(leave, NPC.EXAMINER);
    assert.ok(l.said.includes('I am sure you wont get any problems'));
    assert.equal(stage(leave), 1);
});

test('the Curator stamps the letter; a stamped letter is not wanted back', async () => {
    const p = player({ stage: 1, items: [ITEM.UNSTAMPED_LETTER] });
    const c = await (async () => {
        const npc = fakeNpc(NPC.CURATOR);
        assert.equal(await curator.onUseWithNPC(p, npc, { id: ITEM.UNSTAMPED_LETTER }), true);
        return npc;
    })();
    assert.equal(p.inventory.has(ITEM.UNSTAMPED_LETTER), false);
    assert.equal(p.inventory.count(ITEM.STAMPED_LETTER), 1);
    assert.ok(c.said.includes('There you go, good luck student...'));

    const back = fakeNpc(NPC.CURATOR);
    await curator.onUseWithNPC(p, back, { id: ITEM.STAMPED_LETTER });
    assert.deepEqual(back.said, ["No, I don't want it back, thankyou"]);
    assert.equal(p.inventory.count(ITEM.STAMPED_LETTER), 1);
});

test('the Curator keeps the certificates; the level 3 one earns a cake or a Fruit Blast', async () => {
    for (const [cert, said] of [
        [ITEM.LEVEL_1_CERTIFICATE, 'Come and tell me when you are the next level'],
        [ITEM.LEVEL_2_CERTIFICATE, 'Remember to come and see me when you have graduated']
    ]) {
        const p = player({ items: [cert] });
        const c = fakeNpc(NPC.CURATOR);
        await curator.onUseWithNPC(p, c, { id: cert });
        assert.equal(p.inventory.has(cert), false);
        assert.ok(c.said.includes(said));
    }

    for (const [answer, reward] of [
        [0, ITEM.CHOCOLATE_CAKE],
        [1, ITEM.FRUIT_BLAST]
    ]) {
        const p = player({ items: [ITEM.LEVEL_3_CERTIFICATE], answers: [answer] });
        await curator.onUseWithNPC(p, fakeNpc(NPC.CURATOR), { id: ITEM.LEVEL_3_CERTIFICATE });
        assert.equal(p.inventory.has(ITEM.LEVEL_3_CERTIFICATE), false);
        assert.equal(p.inventory.count(reward), 1);
    }
});

test('stage 1 -> 2: the stamped letter starts the level 1 exam; an uninformed try fails whatever is answered', async () => {
    const p = player({ stage: 1, items: [ITEM.STAMPED_LETTER], answers: [0, 0, 0] });
    const n = await talk(p, NPC.EXAMINER);
    assert.equal(stage(p), 2);
    assert.equal(p.inventory.has(ITEM.STAMPED_LETTER), false);
    assert.ok(n.said.includes('Good good, we will begin the exam...'));
    assert.ok(n.said.includes('Oh deary me!'));
    assert.equal(p.inventory.has(ITEM.LEVEL_1_CERTIFICATE), false);
    // the options are the uninformed ones: the right answer is not offered
    assert.ok(!p.asked[0].includes("The study of the earth, It's contents and It's history"));
    assert.ok(p.asked[0].includes('The study of gardening, planting and fruiting vegetation'));
});

// ---------------------------------------------------------------- stage 2: the students

test('stages 0-1: the students only chat', async () => {
    for (const id of [NPC.STUDENT_ORANGE, NPC.STUDENT_GREEN, NPC.STUDENT_PURPLE]) {
        const p = player({ stage: 1 });
        const n = await talk(p, id);
        assert.ok(n.said.length > 0);
        assert.deepEqual(Object.keys(p.cache), []);
    }
});

test('stage 2: each student asks for a rock sample (cache student_<colour>_s), reminds, and thanks for the sample', async () => {
    const CASES = [
        [NPC.STUDENT_ORANGE, 'orange', ITEM.ROCK_SAMPLE_ORANGE, 'All that have passed the appropriate earth sciences exams'],
        [NPC.STUDENT_GREEN, 'green', ITEM.ROCK_SAMPLE_GREEN, "The study of the earth, It's contents and It's history"],
        [NPC.STUDENT_PURPLE, 'purple', ITEM.ROCK_SAMPLE_PURPLE, 'Gloves and boots to be worn at all times, proper tools must be used']
    ];

    for (const [id, colour, sample, answer] of CASES) {
        const p = player({ stage: 2 });
        await talk(p, id);
        assert.equal(p.cache[`student_${colour}_s`], true, colour);

        // still without the sample
        const again = await talk(p, id);
        assert.ok(again.said.some((l) => /rock sample yet|Have you found/.test(l)), colour);
        assert.equal(p.cache[`student_${colour}_c`], undefined);

        // with the sample: the talk hands it over
        p.inventory.add(sample);
        const done = await talk(p, id);
        assert.equal(p.cache[`student_${colour}_c`], true, colour);
        assert.equal(p.cache[`student_${colour}_s`], undefined);
        assert.equal(p.inventory.has(sample), false);
        assert.ok(done.said.includes(answer), colour);

        // afterwards the student repeats the answer
        const repeat = await talk(p, id);
        assert.ok(repeat.said.includes(answer), colour);
    }
});

test('stage 2: using the right sample on the student hands it over; the wrong, a cracked and a spare one are refused', async () => {
    const p = player({ stage: 2 });
    await talk(p, NPC.STUDENT_ORANGE);
    p.inventory.add(ITEM.ROCK_SAMPLE_ORANGE);
    p.inventory.add(ITEM.ROCK_SAMPLE_GREEN);
    p.inventory.add(ITEM.CRACKED_ROCK_SAMPLE);

    const wrong = await useOn(p, NPC.STUDENT_ORANGE, ITEM.ROCK_SAMPLE_GREEN);
    assert.ok(wrong.said.includes("It looks a bit like this, but not the same..."));
    assert.equal(p.inventory.count(ITEM.ROCK_SAMPLE_GREEN), 1);

    const cracked = await useOn(p, NPC.STUDENT_ORANGE, ITEM.CRACKED_ROCK_SAMPLE);
    assert.ok(cracked.said.includes('I hope not!'));
    assert.equal(p.inventory.count(ITEM.CRACKED_ROCK_SAMPLE), 1);

    await useOn(p, NPC.STUDENT_ORANGE, ITEM.ROCK_SAMPLE_ORANGE);
    assert.equal(p.cache.student_orange_c, true);
    assert.equal(p.inventory.has(ITEM.ROCK_SAMPLE_ORANGE), false);

    p.inventory.add(ITEM.ROCK_SAMPLE_ORANGE);
    const spare = await useOn(p, NPC.STUDENT_ORANGE, ITEM.ROCK_SAMPLE_ORANGE);
    assert.deepEqual(spare.said, ["Uh? you've already given me my rock sample back!"]);
    assert.equal(p.inventory.count(ITEM.ROCK_SAMPLE_ORANGE), 1);

    for (const [id, line] of [
        [NPC.STUDENT_GREEN, "mine wasn't in two pieces"],
        [NPC.STUDENT_PURPLE, "don't think so."]
    ]) {
        const n = await useOn(player({ stage: 2 }), id, ITEM.CRACKED_ROCK_SAMPLE);
        assert.ok(n.said.includes(line));
    }
});

test('a sample used before the student was spoken to is not handed over', async () => {
    const p = player({ stage: 2, items: [ITEM.ROCK_SAMPLE_PURPLE] });
    await useOn(p, NPC.STUDENT_PURPLE, ITEM.ROCK_SAMPLE_PURPLE);
    assert.equal(p.inventory.has(ITEM.ROCK_SAMPLE_PURPLE), true);
    assert.equal(p.cache.student_purple_c, undefined);
    assert.ok(p.messages.includes('@que@I am not sure why I am giving this rock to the student...'));

    const q = player({ stage: 2, items: [ITEM.ROCK_SAMPLE_PURPLE] });
    await useOn(q, NPC.STUDENT_GREEN, ITEM.ROCK_SAMPLE_PURPLE);
    assert.ok(q.messages.includes('@que@Perhaps I should speak to him first'));
    assert.ok(player().messages.length === 0);
});

// ---------------------------------------------------------------- the exams

const ALL_C = { student_orange_c: true, student_green_c: true, student_purple_c: true };

test('stage 2 -> 3: the level 1 exam with the three answers gives the trowel and certificate and clears the caches', async () => {
    // "Yes I certainly am" (index 0), then the three questions
    const p = player({ stage: 2, cache: { ...ALL_C }, answers: [0, 0, 2, 1] });
    const n = await talk(p, NPC.EXAMINER);
    assert.equal(stage(p), 3);
    assert.equal(p.inventory.count(ITEM.TROWEL), 1);
    assert.equal(p.inventory.count(ITEM.LEVEL_1_CERTIFICATE), 1);
    assert.ok(n.said.includes('You got all the questions correct, well done'));
    assert.deepEqual(Object.keys(p.cache), []);
    assert.ok(p.messages.includes('The examiner hands you a trowel'));
    // informed options include the right text
    assert.ok(p.asked[1].includes("The study of the earth, It's contents and It's history"));
});

test('the level 1 exam: each wrong answer is counted; a missing student leaves the right answer out', async () => {
    for (const [answers, line] of [
        [[0, 0, 0, 0], 'You got 1 question correct'], // right, wrong, wrong
        [[0, 1, 0, 0], 'Oh deary me!'],
        [[0, 0, 2, 0], 'You got 2 questions correct']
    ]) {
        const p = player({ stage: 2, cache: { ...ALL_C }, answers });
        const n = await talk(p, NPC.EXAMINER);
        assert.equal(stage(p), 2);
        assert.ok(n.said.includes(line), line);
        assert.equal(p.inventory.has(ITEM.LEVEL_1_CERTIFICATE), false);
        assert.deepEqual(Object.keys(p.cache).sort(), Object.keys(ALL_C).sort());
    }

    // one student missing: the right answer is not offered and the exam cannot pass
    const p = player({ stage: 2, cache: { student_orange_c: true, student_green_c: true }, answers: [0, 0, 2, 1] });
    const n = await talk(p, NPC.EXAMINER);
    assert.equal(stage(p), 2);
    assert.ok(n.said.includes('Oh deary me!'));
    assert.ok(!p.asked[1].includes('All that have passed the appropriate earth sciences exam'));

    // declining the retry
    const q = player({ stage: 2, answers: [1] });
    const m = await talk(q, NPC.EXAMINER);
    assert.ok(m.said.includes('Oh, no problem at all'));
});

test('stage 3: the students tell the level 2 answers; the exam passes (4) and fails', async () => {
    const CASES = [
        [NPC.STUDENT_ORANGE, 'student_orange_exam2'],
        [NPC.STUDENT_GREEN, 'student_green_exam2'],
        [NPC.STUDENT_PURPLE, 'student_purple_exam2']
    ];
    const p = player({ stage: 3 });

    for (const [id, key] of CASES) {
        await talk(p, id);
        assert.equal(p.cache[key], true, key);
    }

    // stuck / disturb / trowel menus
    const stuck = player({ stage: 3, answers: [1] });
    assert.ok((await talk(stuck, NPC.EXAMINER)).said.includes('I am not going to give you the answers'));
    const sorry = player({ stage: 3, answers: [2] });
    assert.ok((await talk(sorry, NPC.EXAMINER)).said.includes('Oh, no problem at all'));

    const wrong = player({ stage: 3, cache: { ...p.cache }, answers: [0, 2, 1, 0] });
    const w = await talk(wrong, NPC.EXAMINER);
    assert.ok(w.said.includes('You got 1 question correct'));
    assert.equal(stage(wrong), 3);

    const pass = player({ stage: 3, cache: { ...p.cache }, answers: [0, 2, 0, 1] });
    const n = await talk(pass, NPC.EXAMINER);
    assert.equal(stage(pass), 4);
    assert.equal(pass.inventory.count(ITEM.LEVEL_2_CERTIFICATE), 1);
    assert.ok(n.said.includes('You got all the questions correct, well done!'));
    assert.deepEqual(Object.keys(pass.cache), []);

    const none = player({ stage: 3, answers: [0, 0, 1, 0] });
    assert.ok((await talk(none, NPC.EXAMINER)).said.includes('No no no!'));
});

test('stage 4: orange and green tell the level 3 answers; purple wants an uncut opal first', async () => {
    const p = player({ stage: 4 });
    await talk(p, NPC.STUDENT_ORANGE);
    await talk(p, NPC.STUDENT_GREEN);
    assert.equal(p.cache.student_orange_exam3, true);
    assert.equal(p.cache.student_green_exam3, true);

    // purple: asks for the opal, then waits, then takes it
    const ask = await talk(p, NPC.STUDENT_PURPLE);
    assert.equal(p.cache.student_purple_opal, true);
    assert.ok(ask.said.includes('My favourite is an opal, they are beautiful'));

    const wait = await talk(p, NPC.STUDENT_PURPLE);
    assert.ok(wait.said.includes('Oh well, tell me when you do'));
    assert.equal(p.cache.student_purple_exam3, undefined);

    p.inventory.add(ITEM.UNCUT_OPAL);
    const done = await talk(p, NPC.STUDENT_PURPLE);
    assert.equal(p.cache.student_purple_exam3, true);
    assert.equal(p.cache.student_purple_opal, undefined);
    assert.equal(p.inventory.has(ITEM.UNCUT_OPAL), false);
    assert.ok(done.said.includes('Samples cleaned and carried only in specimen jars'));

    const after = await talk(p, NPC.STUDENT_PURPLE);
    assert.ok(after.said.includes('Hi, the opal looks magnificent'));

    // a cut opal is not the stone she wants
    const cut = player({ stage: 4, cache: { student_purple_opal: true }, items: [ITEM.OPAL] });
    await talk(cut, NPC.STUDENT_PURPLE);
    assert.equal(cut.cache.student_purple_exam3, undefined);
    assert.equal(cut.inventory.has(ITEM.OPAL), true);
});

test('stage 4 -> 5: the level 3 exam passes with the three answers, fails otherwise', async () => {
    const informed = { student_orange_exam3: true, student_green_exam3: true, student_purple_exam3: true };
    const pass = player({ stage: 4, cache: { ...informed }, answers: [0, 0, 0, 2] });
    const n = await talk(pass, NPC.EXAMINER);
    assert.equal(stage(pass), 5);
    assert.equal(pass.inventory.count(ITEM.LEVEL_3_CERTIFICATE), 1);
    assert.ok(n.said.includes('Here is your level 3 certificate'));
    assert.ok(pass.said.includes('I can dig wherever I want now...'));
    assert.deepEqual(Object.keys(pass.cache), []);

    for (const [answers, line] of [
        [[0, 0, 0, 0], 'You got 2 questions correct'],
        [[0, 0, 1, 0], 'You got 1 question correct'],
        [[0, 1, 1, 0], 'Absolutely none right at all']
    ]) {
        const p = player({ stage: 4, cache: { ...informed }, answers });
        const f = await talk(p, NPC.EXAMINER);
        assert.equal(stage(p), 4);
        assert.ok(f.said.includes(line), line);
    }

    const stuck = player({ stage: 4, answers: [1] });
    assert.ok((await talk(stuck, NPC.EXAMINER)).said.includes('Talk to the other students and remember the answers'));
});

test('lost trowel: refused while one is carried, replaced otherwise (stages 3-6 and after the quest)', async () => {
    for (const [st, answers] of [
        [3, [3]],
        [4, [3]],
        [5, [1]],
        [6, [1]],
        [-1, [1]]
    ]) {
        const has = player({ stage: st, answers: [...answers], items: [ITEM.TROWEL] });
        assert.ok((await talk(has, NPC.EXAMINER)).said.includes('Look in your backpack and make sure first'), `${st}`);
        assert.equal(has.inventory.count(ITEM.TROWEL), 1);

        const lost = player({ stage: st, answers: [...answers] });
        await talk(lost, NPC.EXAMINER);
        assert.equal(lost.inventory.count(ITEM.TROWEL), 1, `${st}`);
    }
});

// ---------------------------------------------------------------- the other talkers

test('the panning guide, the workman and the expert chat', async () => {
    assert.ok((await talk(player(), NPC.GUIDE)).said.includes('First You need a panning tray'));

    const menus = [
        [[0], 'From the initial investigation to the installation of the mine shafts'],
        [[1], 'Well, let me know when you are'],
        [[2, 0], 'Yes, only persons with the correct certificate of earth sciences can dig here'],
        [[2, 1], "You can't dig around here without a certificate though"]
    ];

    for (const [answers, line] of menus) {
        assert.ok((await talk(player({ answers }), NPC.WORKMAN)).said.includes(line), line);
    }

    assert.ok((await talk(player({ stage: -1 }), NPC.WORKMAN)).said.includes('Congratulations on your discovery'));

    for (const [answers, line] of [
        [[0], "Okay, give it to me and I'll have a look for you"],
        [[1], 'Good, let me know if you find anything unusual'],
        [[2], 'I suspect nobody has lived here for over a millenium!']
    ]) {
        assert.ok((await talk(player({ answers }), NPC.EXPERT)).said.includes(line), line);
    }

    assert.ok((await talk(player({ stage: -1 }), NPC.EXPERT)).said.includes('Lie buried beneath the surface of our land...'));
    assert.ok(
        (await talk(player({ stage: -1, answers: [0] }), NPC.EXAMINER)).said.includes('Good health and prosperity to you')
    );
});

test('the underground workman gives the chest key only to a persistent beggar', async () => {
    // jar question and the three flavours of refusal
    assert.ok((await talk(player({ answers: [0, 0] }), NPC.WORKMAN_UNDERGROUND)).said.includes("Nope, can't help you there i'm afraid"));
    assert.ok((await talk(player({ answers: [1] }), NPC.WORKMAN_UNDERGROUND)).said.includes('A miner without a clue - how funny'));
    assert.ok(
        (await talk(player({ answers: [2] }), NPC.WORKMAN_UNDERGROUND)).said.includes(
            "Oh, well don't forget that wealth and riches isn't everything..."
        )
    );

    // every step: buying and "my key" end it with no key
    for (let depth = 0; depth < 5; depth += 1) {
        const begs = Array(depth).fill(0);
        const buy = player({ answers: [0, 1, ...begs, 1] });
        const b = await talk(buy, NPC.WORKMAN_UNDERGROUND);
        assert.ok(b.said.includes('Ooo no, I need it!'), `${depth}`);
        assert.equal(buy.inventory.has(ITEM.CHEST_KEY), false);

        const mine = player({ answers: [0, 1, ...begs, 2] });
        const m = await talk(mine, NPC.WORKMAN_UNDERGROUND);
        assert.ok(m.said.includes('Get lost!'), `${depth}`);
        assert.equal(mine.inventory.has(ITEM.CHEST_KEY), false);
    }

    // five pleases in order
    const p = player({ answers: [0, 1, 0, 0, 0, 0, 0] });
    const n = await talk(p, NPC.WORKMAN_UNDERGROUND);
    assert.equal(p.inventory.count(ITEM.CHEST_KEY), 1);
    assert.ok(n.said.includes("Here's the key...take care of it"));
    assert.deepEqual(p.asked.map((a) => a[0]).slice(2), [
        "I don't suppose I could use it ?",
        'Please',
        'Aww...go on',
        'Pretty please!',
        'Pretty please with sugar on top!'
    ]);
});

// ---------------------------------------------------------------- the expert

test('the expert swaps the Talisman of Zaros for the scroll, the liquid for nitroglycerin and the powder for ammonium nitrate', async () => {
    const p = player({ stage: 5, items: [ITEM.TALISMAN_OF_ZAROS, ITEM.UNIDENTIFIED_LIQUID, ITEM.UNIDENTIFIED_POWDER] });
    await useOn(p, NPC.EXPERT, ITEM.TALISMAN_OF_ZAROS);
    assert.equal(p.inventory.has(ITEM.TALISMAN_OF_ZAROS), false);
    assert.equal(p.inventory.count(ITEM.DIGSITE_SCROLL), 1);
    assert.ok(p.messages.includes('The expert hands you a letter'));

    await useOn(p, NPC.EXPERT, ITEM.UNIDENTIFIED_LIQUID);
    assert.equal(p.inventory.count(ITEM.NITROGLYCERIN), 1);
    assert.equal(p.inventory.has(ITEM.UNIDENTIFIED_LIQUID), false);

    await useOn(p, NPC.EXPERT, ITEM.UNIDENTIFIED_POWDER);
    assert.equal(p.inventory.count(ITEM.AMMONIUM_NITRATE), 1);
    assert.equal(p.inventory.has(ITEM.UNIDENTIFIED_POWDER), false);

    // the scroll back, the nitroglycerin and a junk item
    assert.deepEqual((await useOn(p, NPC.EXPERT, ITEM.DIGSITE_SCROLL)).said, ["There's no point in giving me this back!"]);
    assert.ok((await useOn(p, NPC.EXPERT, ITEM.NITROGLYCERIN)).said.includes('Be sure not to drop it!'));
    const q = player();
    await dialogue.onUseWithNPC(q, fakeNpc(NPC.EXPERT), { id: ITEM.COINS });
    assert.deepEqual(q.messages, ['Nothing interesting happens']);
});

test('the expert and gold nuggets: 3 make a gold, fewer are refused', async () => {
    const few = player({ items: [[ITEM.GOLD_NUGGETS, 2]] });
    const f = await useOn(few, NPC.EXPERT, ITEM.GOLD_NUGGETS);
    assert.ok(f.said.includes("I can't do much with these nuggets yet"));
    assert.equal(few.inventory.count(ITEM.GOLD_NUGGETS), 2);
    assert.equal(few.inventory.has(ITEM.GOLD), false);

    const three = player({ items: [[ITEM.GOLD_NUGGETS, 3]] });
    await useOn(three, NPC.EXPERT, ITEM.GOLD_NUGGETS);
    assert.equal(three.inventory.has(ITEM.GOLD_NUGGETS), false);
    assert.equal(three.inventory.count(ITEM.GOLD), 1);
});

test('the expert examines finds: panning trays are handed back, every find has an answer', async () => {
    const tray = player();
    await useOn(tray, NPC.EXPERT, ITEM.PANNING_TRAY_FULL);
    assert.ok(tray.messages.includes('The expert hands the tray back to you'));
    const nugget = player();
    await useOn(nugget, NPC.EXPERT, ITEM.PANNING_TRAY_GOLD_NUGGET);
    assert.ok(nugget.messages.includes('The expert hands you back the tray'));
    const empty = player();
    assert.ok((await useOn(empty, NPC.EXPERT, ITEM.PANNING_TRAY)).said.includes('I have no need for panning trays'));

    for (const id of [
        ITEM.CRACKED_ROCK_SAMPLE,
        ITEM.MIXED_CHEMICALS_1,
        ITEM.EXPLOSIVE_COMPOUND,
        ITEM.MIXED_CHEMICALS_2,
        ITEM.BELT_BUCKLE,
        ITEM.BONES,
        ITEM.BROKEN_ARROW,
        ITEM.BROKEN_GLASS_LVL_2,
        ITEM.BROKEN_STAFF,
        ITEM.BUTTONS,
        ITEM.CERAMIC_REMAINS,
        ITEM.DAMAGED_ARMOUR_1,
        ITEM.DAMAGED_ARMOUR_2,
        ITEM.NEEDLE,
        ITEM.OLD_BOOT,
        ITEM.OLD_TOOTH,
        ITEM.ROCK_SAMPLE_GREEN,
        ITEM.ROCK_SAMPLE_ORANGE,
        ITEM.ROCK_SAMPLE_PURPLE,
        ITEM.ROTTEN_APPLES,
        ITEM.RUSTY_SWORD,
        ITEM.VASE
    ]) {
        const p = player();
        const n = await useOn(p, NPC.EXPERT, id);
        assert.ok(n.said.length > 0, `${id}`);
        assert.deepEqual(p.messages, [], `${id}`);
    }
});

test('stage 6 -> -1: the stone tablet earns 2 gold bars, 2 quest points, mining and herblaw experience', async () => {
    const early = player({ stage: 5, items: [ITEM.STONE_TABLET] });
    await useOn(early, NPC.EXPERT, ITEM.STONE_TABLET);
    assert.equal(stage(early), 5);
    assert.equal(early.inventory.count(ITEM.STONE_TABLET), 1);
    assert.deepEqual(early.completed, []);

    const p = player({
        stage: 6,
        items: [ITEM.STONE_TABLET],
        cache: { winch_rope_1: true, winch_rope_2: true, digsite_winshaft: true },
        levels: { mining: 40, herblaw: 20 }
    });
    const n = await useOn(p, NPC.EXPERT, ITEM.STONE_TABLET);
    assert.equal(stage(p), -1);
    assert.equal(p.inventory.has(ITEM.STONE_TABLET), false);
    assert.equal(p.inventory.count(ITEM.GOLD_BAR), 2);
    assert.ok(n.said.includes('Here, take this as your reward'));
    assert.ok(p.messages.includes('The expert gives you 2 gold bars as payment'));
    assert.deepEqual(p.cache, {});
    assert.equal(p.completed.length, 1);
    const [key, reward] = p.completed[0];
    assert.equal(key, 'digsite');
    assert.equal(reward.questPoints, 2);
    assert.deepEqual(reward.experience, { mining: 1200 + 1200 * 40, herblaw: 500 + 500 * 20 });
    assert.equal(reward.message, 'Congratulations, you have finished the digsite quest');

    const done = player({ stage: -1, items: [ITEM.STONE_TABLET] });
    const d = await useOn(done, NPC.EXPERT, ITEM.STONE_TABLET);
    assert.deepEqual(d.said, ["I don't need another tablet", 'One is enough thank you!']);
    assert.equal(done.inventory.count(ITEM.STONE_TABLET), 1);
});

test('after the quest the students, the workman and the examiner congratulate', async () => {
    for (const [id, line] of [
        [NPC.STUDENT_ORANGE, 'Well done for finding the altar'],
        [NPC.STUDENT_GREEN, 'You are quite famous around here now'],
        [NPC.STUDENT_PURPLE, "It seems you are something of an expert now !"]
    ]) {
        for (const st of [6, -1]) {
            assert.ok((await talk(player({ stage: st }), id)).said.includes(line), `${id} ${st}`);
        }
    }

    assert.ok((await talk(player({ stage: 5 }), NPC.STUDENT_ORANGE)).said.includes('See you again'));
    assert.ok((await talk(player({ stage: 5 }), NPC.STUDENT_GREEN)).said.includes('See you later'));
    assert.ok((await talk(player({ stage: 5 }), NPC.STUDENT_PURPLE)).said.includes('See you later'));
});

test('the digsite scroll on a workman grants the winch permission only at stage 5', async () => {
    const p = player({ stage: 5, items: [ITEM.DIGSITE_SCROLL] });
    const n = await useOn(p, NPC.WORKMAN, ITEM.DIGSITE_SCROLL);
    assert.equal(p.cache.digsite_winshaft, true);
    assert.equal(p.inventory.has(ITEM.DIGSITE_SCROLL), false);
    assert.ok(n.said.includes("I'll hang onto this scroll shall I ?"));

    const early = player({ stage: 4, items: [ITEM.DIGSITE_SCROLL] });
    await useOn(early, NPC.WORKMAN, ITEM.DIGSITE_SCROLL);
    assert.equal(early.cache.digsite_winshaft, undefined);
    assert.equal(early.inventory.has(ITEM.DIGSITE_SCROLL), false);

    // another item on the workman is not ours
    assert.equal(await dialogue.onUseWithNPC(p, fakeNpc(NPC.WORKMAN), { id: ITEM.COINS }), false);
});

// ---------------------------------------------------------------- the winches

test('the winch is refused without the scroll; with it the bucket needs a rope', async () => {
    const p = player({ stage: 5 });
    const winch = gameObject(1095, 14, 504);
    assert.equal(await mechanism.onGameObjectCommandOne(p, winch), true);
    assert.equal(p.world.spawned.length, 1);
    assert.equal(p.world.spawned[0].id, NPC.WORKMAN);
    assert.equal(p.world.removed.length, 1);
    assert.deepEqual(p.teleports, []);

    // a rope with no permission
    const q = player({ stage: 5, items: [ITEM.ROPE] });
    await mechanism.onUseWithGameObject(q, winch, { id: ITEM.ROPE });
    assert.ok(q.said.includes('Err... I have no idea why I am doing this !'));
    assert.equal(q.inventory.has(ITEM.ROPE), true);
    assert.equal(q.cache.winch_rope_1, undefined);

    // permission, no rope
    const r = player({ stage: 5, cache: { digsite_winshaft: true } });
    await mechanism.onGameObjectCommandOne(r, winch);
    assert.ok(r.messages.includes('The bucket descends, but does not reach the bottom'));
    assert.ok(r.said.includes('I need something to help me get all the way down'));
    assert.deepEqual(r.teleports, []);
});

test('ropes: tied once per bucket, then the winch lowers the player (agility 10) into the shaft', async () => {
    const winch1 = gameObject(1095, 14, 504);
    const winch2 = gameObject(1053, 26, 515);
    const p = player({ stage: 5, cache: { digsite_winshaft: true }, items: [[ITEM.ROPE, 1], ITEM.ROPE, ITEM.ROPE] });

    await mechanism.onUseWithGameObject(p, winch1, { id: ITEM.ROPE });
    assert.equal(p.cache.winch_rope_1, true);
    assert.equal(p.inventory.count(ITEM.ROPE), 2);
    assert.ok(p.messages.includes('You tie the rope to the bucket'));

    await mechanism.onUseWithGameObject(p, winch1, { id: ITEM.ROPE });
    assert.ok(p.messages.includes('There is already a rope tied to this bucket'));
    assert.equal(p.inventory.count(ITEM.ROPE), 2);

    await mechanism.onUseWithGameObject(p, winch2, { id: ITEM.ROPE });
    assert.equal(p.cache.winch_rope_2, true);

    await mechanism.onGameObjectCommandOne(p, winch1);
    assert.deepEqual(p.teleports.at(-1), [26, 3346]);
    assert.ok(p.messages.includes('You find yourself in a cavern...'));
    assert.deepEqual(p.experience.at(-1), ['agility', 20]);

    await mechanism.onGameObjectCommandOne(p, winch2);
    assert.deepEqual(p.teleports.at(-1), [19, 3337]);

    // after the explosion the second shaft opens on the altar cavern
    p.questStages.digsite = 6;
    await mechanism.onGameObjectCommandOne(p, winch2);
    assert.deepEqual(p.teleports.at(-1), [19, 3385]);

    // a winch with no rope while the other has one
    const half = player({ stage: 5, cache: { digsite_winshaft: true, winch_rope_1: true } });
    await mechanism.onGameObjectCommandOne(half, winch2);
    assert.deepEqual(half.teleports, []);
});

test('the winch needs Agility 10; after the quest both winches lead to the altar cavern', async () => {
    const low = player({
        stage: 5,
        cache: { digsite_winshaft: true, winch_rope_1: true },
        levels: { agility: 9 }
    });
    await mechanism.onGameObjectCommandOne(low, gameObject(1095, 14, 504));
    assert.ok(low.messages.includes('You need an agility level of 10 to do this'));
    assert.deepEqual(low.teleports, []);
    assert.deepEqual(low.experience, []);

    for (const winch of [gameObject(1095, 14, 504), gameObject(1053, 26, 515)]) {
        const done = player({ stage: -1 });
        await mechanism.onGameObjectCommandOne(done, winch);
        assert.deepEqual(done.teleports, [[19, 3385]]);
    }
});

test('the ropes up the shafts lead to their winches', async () => {
    const small = player({ stage: 5 });
    await mechanism.onGameObjectCommandOne(small, gameObject(1097, 26, 3347));
    assert.deepEqual(small.teleports, [[14, 506]]);
    const big = player({ stage: 6 });
    await mechanism.onGameObjectCommandOne(big, gameObject(1098, 19, 3386));
    assert.deepEqual(big.teleports, [[25, 515]]);
});

// ---------------------------------------------------------------- the chemicals

test('a trowel opens the barrel; an empty vial fills with the liquid and the barrel closes', async () => {
    const p = player({ stage: 5, items: [ITEM.TROWEL, ITEM.EMPTY_VIAL, ITEM.SPECIMEN_JAR] });
    const shut = gameObject(1082, 18, 540);

    for (const [id, line] of [
        [ITEM.BRONZE_PICKAXE, 'I better not - it might break it to pieces!'],
        [ITEM.ROCK_PICK, 'The rockpick is too fat to fit in the gap...'],
        [ITEM.SPADE, 'The spade is far too big to fit'],
        [ITEM.IRON_DAGGER, "The dagger's blade might break, I need something stronger"],
        [ITEM.BROKEN_ARROW, 'It nearly fits, just a little too thin']
    ]) {
        const q = player();
        assert.equal(await mechanism.onUseWithGameObject(q, shut, { id }), true);
        assert.ok(q.said.includes(line), line);
        assert.deepEqual(q.world.replaced, []);
    }

    assert.equal(await mechanism.onUseWithGameObject(p, shut, { id: ITEM.TROWEL }), true);
    assert.deepEqual(p.world.replaced, [[1082, 1083]]);
    assert.ok(p.said.includes("Great, it's opened it!"));

    const open = gameObject(1083, 19, 539);
    await mechanism.onGameObjectCommandOne(p, open);
    assert.ok(p.messages.includes('The barrel has a foul-smelling liquid inside...'));

    for (const [id, line] of [
        [ITEM.PANNING_TRAY, "It's likely to spill everywhere in that!"],
        [ITEM.SPECIMEN_JAR, 'Perhaps not, it might contaminate the samples'],
        [ITEM.JUG, 'I had better not, someone might want to drink from this!'],
        [ITEM.VASE, "I'm not sure it's good for growing flowers!"]
    ]) {
        const q = player();
        await mechanism.onUseWithGameObject(q, open, { id });
        assert.ok(q.said.includes(line), line);
    }

    await mechanism.onUseWithGameObject(p, open, { id: ITEM.EMPTY_VIAL });
    assert.equal(p.inventory.has(ITEM.EMPTY_VIAL), false);
    assert.equal(p.inventory.count(ITEM.UNIDENTIFIED_LIQUID), 1);
    assert.deepEqual(p.world.replaced.at(-1), [1083, 1082]);

    const other = player();
    await mechanism.onUseWithGameObject(other, shut, { id: ITEM.COINS });
    assert.deepEqual(other.messages, ['Nothing interesting happens']);
    await mechanism.onUseWithGameObject(other, open, { id: ITEM.COINS });
    assert.equal(other.messages.length, 2);
});

test('the tent chest: locked, opened by the key, searched for the powder, then locked again', async () => {
    const locked = gameObject(1085, 10, 541);
    const p = player({ stage: 5, items: [ITEM.CHEST_KEY] });

    await mechanism.onGameObjectCommandOne(p, locked);
    assert.ok(p.messages.includes('The chest is locked'));

    await mechanism.onUseWithGameObject(p, locked, { id: ITEM.CHEST_KEY });
    assert.equal(p.inventory.has(ITEM.CHEST_KEY), false);
    assert.deepEqual(p.world.replaced, [[1085, 1084]]);
    assert.ok(p.said.includes("Never mind it's open now..."));

    const open = gameObject(1084, 10, 541);
    await mechanism.onGameObjectCommandTwo(p, open);
    assert.equal(p.inventory.has(ITEM.UNIDENTIFIED_POWDER), false);
    assert.ok(p.messages.includes('Nothing interesting happens'));

    await mechanism.onGameObjectCommandOne(p, open);
    assert.equal(p.inventory.count(ITEM.UNIDENTIFIED_POWDER), 1);
    assert.deepEqual(p.world.replaced.at(-1), [1084, 1085]);
});

test('herblaw: nitroglycerin + ammonium nitrate + ground charcoal + arcenia root make the explosive compound', async () => {
    const p = player({
        quest: 'digsite',
        items: [ITEM.NITROGLYCERIN, ITEM.AMMONIUM_NITRATE, ITEM.GROUND_CHARCOAL, ITEM.ARCENIA_ROOT],
        levels: { herblaw: 10 }
    });
    p.questStages.druidicRitual = -1;

    assert.equal(await herblaw.onUseWithInventory(p, { id: ITEM.NITROGLYCERIN }, { id: ITEM.AMMONIUM_NITRATE }), true);
    assert.equal(p.inventory.count(ITEM.MIXED_CHEMICALS_1), 1);
    assert.ok(p.messages.includes('It has produced a foul mixture'));

    // either order
    assert.equal(await herblaw.onUseWithInventory(p, { id: ITEM.MIXED_CHEMICALS_1 }, { id: ITEM.GROUND_CHARCOAL }), true);
    assert.equal(p.inventory.count(ITEM.MIXED_CHEMICALS_2), 1);
    assert.ok(p.messages.includes('It has produced an even fouler mixture'));

    assert.equal(await herblaw.onUseWithInventory(p, { id: ITEM.ARCENIA_ROOT }, { id: ITEM.MIXED_CHEMICALS_2 }), true);
    assert.equal(p.inventory.count(ITEM.EXPLOSIVE_COMPOUND), 1);
    assert.deepEqual(
        p.inventory.items.map((i) => i.id),
        [ITEM.EXPLOSIVE_COMPOUND]
    );
    assert.deepEqual(p.experience, [
        ['herblaw', 20],
        ['herblaw', 25],
        ['herblaw', 30]
    ]);
    assert.ok(p.said.includes('Excellent this looks just right'));
});

test('herblaw: refused below level 10 and before the Druidic Ritual; unrelated items are left alone', async () => {
    const low = player({ items: [ITEM.NITROGLYCERIN, ITEM.AMMONIUM_NITRATE], levels: { herblaw: 9 } });
    low.questStages.druidicRitual = -1;
    assert.equal(await herblaw.onUseWithInventory(low, { id: ITEM.AMMONIUM_NITRATE }, { id: ITEM.NITROGLYCERIN }), true);
    assert.deepEqual(low.messages, ['You need to have a herblaw level of 10 or over to mix this liquid']);
    assert.equal(low.inventory.count(ITEM.NITROGLYCERIN), 1);

    const nodruid = player({ items: [ITEM.GROUND_CHARCOAL, ITEM.MIXED_CHEMICALS_1], levels: { herblaw: 50 } });
    nodruid.questStages.druidicRitual = 1;
    assert.equal(await herblaw.onUseWithInventory(nodruid, { id: ITEM.GROUND_CHARCOAL }, { id: ITEM.MIXED_CHEMICALS_1 }), true);
    assert.deepEqual(nodruid.messages, ['You need to complete Druidic ritual quest first']);
    assert.equal(nodruid.inventory.count(ITEM.MIXED_CHEMICALS_1), 1);
    assert.deepEqual(nodruid.experience, []);

    assert.equal(await herblaw.onUseWithInventory(low, { id: ITEM.NITROGLYCERIN }, { id: ITEM.GROUND_CHARCOAL }), false);
});

test('dropping the unstable chemicals explodes them and hurts', async () => {
    const CASES = [
        [ITEM.UNIDENTIFIED_LIQUID, 'The liquid exploded!', Math.floor(30 * 0.3 + 5)],
        [ITEM.MIXED_CHEMICALS_1, 'The chemicals exploded!', 15 + 6],
        [ITEM.MIXED_CHEMICALS_2, 'The chemicals exploded!', 15 + 6],
        [ITEM.NITROGLYCERIN, 'The nitroglycerin exploded!', 15 - 3],
        [ITEM.EXPLOSIVE_COMPOUND, 'The compound exploded!', 61]
    ];

    for (const [id, message, damage] of CASES) {
        const p = player({ items: [id] });
        assert.equal(await items.onDropItem(p, { id }), true);
        assert.equal(p.inventory.has(id), false, `${id}`);
        assert.deepEqual(p.damaged, [damage], `${id}`);
        assert.ok(p.messages.includes(message));
        assert.ok(p.said.includes('Ow!'));
    }

    const weak = player({ items: [ITEM.NITROGLYCERIN], levels: { hits: 4 } });
    await items.onDropItem(weak, { id: ITEM.NITROGLYCERIN });
    assert.deepEqual(weak.damaged, [0]);

    assert.equal(await items.onDropItem(player(), { id: ITEM.TROWEL }), false);
});

// ---------------------------------------------------------------- the bricks

test('stage 5 -> 6: the compound over the bricks, then the tinderbox sets it off and sends the player to the cavern', async () => {
    const brick = gameObject(1096, 13, 3337);
    const p = player({ stage: 5, items: [ITEM.EXPLOSIVE_COMPOUND, ITEM.TINDERBOX, ITEM.ROCK_PICK] });

    await mechanism.onGameObjectCommandOne(p, brick);
    assert.ok(p.said.includes('If I could move them out of the way'));

    // no compound poured yet
    await mechanism.onUseWithGameObject(p, brick, { id: ITEM.TINDERBOX });
    assert.ok(p.said.includes('Now what am I trying to achieve here ?'));
    assert.equal(stage(p), 5);
    assert.deepEqual(p.teleports, []);

    await mechanism.onUseWithGameObject(p, brick, { id: ITEM.ROCK_PICK });
    assert.ok(p.said.includes('It would take a year to chip away these rocks...'));

    await mechanism.onUseWithGameObject(p, brick, { id: ITEM.EXPLOSIVE_COMPOUND });
    assert.equal(p.inventory.has(ITEM.EXPLOSIVE_COMPOUND), false);
    assert.equal(p.cache.brick_ignite, true);
    assert.ok(p.messages.includes('You pour the compound over the bricks'));
    assert.equal(stage(p), 5);

    await mechanism.onUseWithGameObject(p, brick, { id: ITEM.TINDERBOX });
    assert.equal(stage(p), 6);
    assert.deepEqual(p.teleports, [[22, 3379]]);
    assert.equal(p.cache.brick_ignite, undefined);
    assert.ok(p.messages.includes('You strike the tinderbox'));
    assert.ok(p.said.includes('Wow that was a big explosion!'));

    const other = player();
    await mechanism.onUseWithGameObject(other, brick, { id: ITEM.COINS });
    assert.deepEqual(other.messages, ['Nothing interesting happens']);
});

// ---------------------------------------------------------------- the site's objects

test('the specimen tray needs a specimen jar; without one a workman turns the player away', async () => {
    const tray = gameObject(1052, 14, 534);

    for (const [answer, line] of [
        [0, "Without a specimen jar - no sorry I can't let you do that!"],
        [1, 'Next time bring it along!']
    ]) {
        const p = player({ answers: [answer] });
        const made = [];
        const spawn = p.world.spawnTimedNPC;
        p.world.spawnTimedNPC = (opts) => made.push(spawn(opts)) && made.at(-1);
        assert.equal(await mechanism.onGameObjectCommandTwo(p, tray), true);
        assert.equal(made.length, 1, 'a workman');
        assert.ok(made[0].said.includes(line), line);
        assert.equal(p.experience.length, 0);
        assert.equal(p.inventory.items.length, 0);
        assert.equal(p.world.removed.length, 1);
            }

    // with a jar: 4 xp and a roll of the tray table
    const ROLLS = [
        [0, null, 'You find nothing'],
        [1, ITEM.BONES, 'You find some bones'],
        [2, ITEM.CRACKED_ROCK_SAMPLE, 'You find a broken rock sample'],
        [3, ITEM.IRON_DAGGER, 'You find a dagger'],
        [4, ITEM.BROKEN_ARROW, 'You find a broken arrow'],
        [5, ITEM.BROKEN_GLASS, 'You find some broken glass'],
        [6, ITEM.CERAMIC_REMAINS, 'You find some old pottery'],
        [7, ITEM.COINS, 'You find a coin'],
        [8, ITEM.CHARCOAL, 'You find some charcoal']
    ];

    for (const [roll, item, message] of ROLLS) {
        rolls(roll);
        const p = player({ items: [ITEM.SPECIMEN_JAR] });
        await mechanism.onGameObjectCommandOne(p, tray);
        assert.deepEqual(p.experience, [['mining', 4]]);
        assert.ok(p.messages.includes(message), message);
        assert.equal(p.inventory.items.length, item === null ? 1 : 2, message);

        if (item !== null) {
            assert.equal(p.inventory.has(item), true);
        }
    }
});

test('the tray refuses a trowel or a spade and takes the jar as a scoop', async () => {
    const tray = gameObject(1052, 14, 534);
    const t = player();
    await mechanism.onUseWithGameObject(t, tray, { id: ITEM.TROWEL });
    assert.equal(t.world.spawned.length, 1);
    const s = player();
    await mechanism.onUseWithGameObject(s, tray, { id: ITEM.SPADE });
    assert.equal(s.world.spawned.length, 1);
    const j = player();
    await mechanism.onUseWithGameObject(j, tray, { id: ITEM.SPECIMEN_JAR });
    assert.ok(j.said.includes("I'm not sure if this will be useful or not"));
    const o = player();
    await mechanism.onUseWithGameObject(o, tray, { id: ITEM.ROCK_PICK });
    assert.deepEqual(o.messages, ['Nothing interesting happens']);
});

test('the sacks hide the specimen jar; the bush hides the purple student\'s rock sample', async () => {
    const jarSacks = gameObject(1076, 15, 502);
    const p = player();
    await mechanism.onGameObjectCommandOne(p, jarSacks);
    assert.equal(p.inventory.count(ITEM.SPECIMEN_JAR), 1);
    assert.ok(p.messages.includes('You find a specimen jar!'));

    await mechanism.onGameObjectCommandOne(p, jarSacks);
    assert.equal(p.inventory.count(ITEM.SPECIMEN_JAR), 1);
    assert.ok(p.messages.includes('You find nothing of interest'));

    const plain = player();
    await mechanism.onGameObjectCommandOne(plain, gameObject(1075, 20, 538));
    assert.equal(plain.inventory.items.length, 0);

    // the sacks in the shaft cavern (plane 3)
    const cavern = player();
    await mechanism.onGameObjectCommandOne(cavern, gameObject(1075, 28, 3345));
    assert.ok(cavern.said.includes('There is nothing under the sack!'));

    const bush = player();
    await mechanism.onGameObjectCommandOne(bush, gameObject(1073, 32, 541));
    assert.equal(bush.inventory.count(ITEM.ROCK_SAMPLE_PURPLE), 1);
    assert.ok(bush.messages.includes('You find a rock sample!'));

    const empty = player();
    await mechanism.onGameObjectCommandOne(empty, gameObject(1072, 30, 544));
    assert.equal(empty.inventory.items.length, 0);
    assert.ok(empty.messages.includes('You find nothing of interest'));
});

test('the museum storage: bookcase, cupboard with the rock pick, chests', async () => {
    const book = player();
    await mechanism.onGameObjectCommandOne(book, gameObject(1090, 17, 573));
    assert.equal(book.inventory.count(ITEM.BOOK_OF_EXPERIMENTAL_CHEMISTRY), 1);

    const shut = gameObject(1074, 23, 569);
    const open = gameObject(1078, 23, 569);
    const p = player();
    await mechanism.onGameObjectCommandOne(p, shut);
    assert.deepEqual(p.world.replaced, [[1074, 1078]]);
    assert.ok(p.messages.includes('You open the cupboard'));
    await mechanism.onGameObjectCommandOne(p, open);
    assert.equal(p.inventory.count(ITEM.ROCK_PICK), 1);
    assert.deepEqual(p.world.replaced.at(-1), [1078, 1074]);
    await mechanism.onGameObjectCommandOne(p, open);
    assert.equal(p.inventory.count(ITEM.ROCK_PICK), 1);
    assert.ok(p.messages.includes('You find nothing of interest'));

    const chest = player();
    await mechanism.onGameObjectCommandOne(chest, gameObject(1104, 17, 569));
    assert.deepEqual(chest.world.replaced, [[1104, 1105]]);
    await mechanism.onGameObjectCommandOne(chest, gameObject(1105, 17, 569));
    assert.equal(chest.inventory.count(ITEM.CRACKED_ROCK_SAMPLE), 1);
    assert.deepEqual(chest.world.replaced.at(-1), [1105, 1104]);
    await mechanism.onGameObjectCommandTwo(chest, gameObject(1105, 17, 569));
    assert.equal(chest.inventory.count(ITEM.CRACKED_ROCK_SAMPLE), 1);

    const west = player();
    await mechanism.onGameObjectCommandOne(west, gameObject(18, 26, 573));
    assert.deepEqual(west.world.replaced, [[18, 17]]);
    await mechanism.onGameObjectCommandOne(west, gameObject(17, 26, 573));
    assert.ok(west.messages.includes('You search the chest, but find nothing'));
    await mechanism.onGameObjectCommandTwo(west, gameObject(17, 26, 573));
    assert.deepEqual(west.world.replaced.at(-1), [17, 18]);
});

test('signposts, buried skeletons and soil examining', async () => {
    for (const [id, line] of [
        [1060, 'This site is for training purposes only'],
        [1061, 'Level 1 digs only'],
        [1062, 'Level 2 digs only'],
        [1063, 'Level 3 digs only']
    ]) {
        const p = player();
        await mechanism.onGameObjectCommandOne(p, gameObject(id, 13, 528));
        assert.deepEqual(p.messages, [line]);
    }

    const skeleton = player();
    await mechanism.onGameObjectCommandOne(skeleton, gameObject(1049, 25, 521));
    assert.deepEqual(skeleton.messages, ['You search the skeleton', 'You find nothing of interest']);

    const trowel = player();
    await mechanism.onUseWithGameObject(trowel, gameObject(1049, 25, 521), { id: ITEM.TROWEL });
    assert.equal(trowel.world.spawned.length, 1);

    const soil = player();
    await mechanism.onGameObjectCommandOne(soil, gameObject(1065, 16, 528));
    assert.ok(soil.said.includes('I think I need something to dig with'));
});

// ---------------------------------------------------------------- digging

const SOIL = gameObject(1065, 16, 528);

test('training area: a trowel digs for 50 xp and any find, blanks give nothing', async () => {
    const TABLE = [
        [0, null, 'You find nothing'],
        [1, null, 'You find nothing of interest'],
        [2, ITEM.VASE, 'You find an old vase'],
        [3, ITEM.BROKEN_ARROW, 'You find a broken arrow'],
        [4, ITEM.COINS, 'You find a coin'],
        [5, ITEM.CRACKED_ROCK_SAMPLE, 'You find a broken rock sample'],
        [6, ITEM.CHARCOAL, 'You find some charcoal']
    ];

    for (const [roll, item, message] of TABLE) {
        rolls(roll);
        const p = player({ x: 15, y: 527, items: [ITEM.TROWEL] });
        assert.equal(await digAreas.onUseWithGameObject(p, SOIL, { id: ITEM.TROWEL }), true);
        assert.deepEqual(p.experience, [['mining', 50]]);
        assert.ok(p.messages.includes(message), message);
        assert.equal(p.inventory.items.length, item === null ? 1 : 2, message);
    }
});

test('level 1: gloves and boots must be worn; the finds are the level 1 table', async () => {
    const at = { x: 20, y: 520, items: [ITEM.TROWEL, ITEM.LEATHER_GLOVES, ITEM.BOOTS] };

    const bare = player(at);
    await digAreas.onUseWithGameObject(bare, SOIL, { id: ITEM.TROWEL });
    assert.deepEqual(bare.experience, []);
    assert.equal(bare.world.spawned.length, 1);

    const noBoots = player({ ...at });
    noBoots.inventory.isEquipped = (id) => id === ITEM.LEATHER_GLOVES;
    await digAreas.onUseWithGameObject(noBoots, SOIL, { id: ITEM.TROWEL });
    assert.deepEqual(noBoots.experience, []);
    assert.equal(noBoots.world.spawned.length, 1);

    const tired = player({ ...at, tired: true, equipped: [ITEM.LEATHER_GLOVES, ITEM.BOOTS] });
    await digAreas.onUseWithGameObject(tired, SOIL, { id: ITEM.TROWEL });
    assert.deepEqual(tired.experience, []);
    assert.ok(tired.messages.includes('You are too tired to do any more digging'));

    const TABLE = [
        [0, null, 'You find nothing'],
        [1, ITEM.BONES, 'You find some bones'],
        [2, ITEM.OPAL, 'You find an opal'],
        [3, ITEM.OLD_BOOT, 'You find an old boot'],
        [4, ITEM.OLD_TOOTH, 'You find an old tooth'],
        [5, ITEM.BROKEN_GLASS, 'You find some broken glass'],
        [6, ITEM.COPPER_ORE, 'You find some copper ore'],
        [7, ITEM.ROTTEN_APPLES, 'You find a rotten apple'],
        [8, ITEM.BUTTONS, 'You find some buttons'],
        [9, ITEM.RUSTY_SWORD, 'You find a rusty sword'],
        [10, ITEM.VASE, 'You find an old vase']
    ];

    for (const [roll, item, message] of TABLE) {
        rolls(roll);
        const p = player({ ...at, equipped: [ITEM.LEATHER_GLOVES, ITEM.BOOTS] });
        await digAreas.onUseWithGameObject(p, SOIL, { id: ITEM.TROWEL });
        assert.deepEqual(p.experience, [['mining', 60]], message);
        assert.ok(p.messages.includes(message), message);
        assert.equal(p.inventory.items.length, item === null ? 3 : 4, message);
    }
});

test('level 2: the rock pick needs the level 2 certificate (stage 4); the trowel is refused', async () => {
    const at = { x: 22, y: 507, items: [ITEM.ROCK_PICK, ITEM.TROWEL] };

    const trowel = player({ ...at, stage: 4 });
    await digAreas.onUseWithGameObject(trowel, SOIL, { id: ITEM.TROWEL });
    assert.equal(trowel.world.spawned.length, 1);
    assert.deepEqual(trowel.experience, []);

    const early = player({ ...at, stage: 3 });
    await digAreas.onUseWithGameObject(early, SOIL, { id: ITEM.ROCK_PICK });
    assert.deepEqual(early.experience, []);
    assert.equal(early.world.spawned.length, 1);

    const outside = player({ x: 20, y: 520, items: [ITEM.ROCK_PICK], stage: 5 });
    await digAreas.onUseWithGameObject(outside, SOIL, { id: ITEM.ROCK_PICK });
    assert.deepEqual(outside.experience, []);
    assert.equal(outside.world.spawned.length, 1);

    const tired = player({ ...at, stage: 4, tired: true });
    await digAreas.onUseWithGameObject(tired, SOIL, { id: ITEM.ROCK_PICK });
    assert.ok(tired.messages.includes('You are too tired to do any more digging'));

    const TABLE = [
        [0, null],
        [1, ITEM.BONES],
        [2, ITEM.PURPLEDYE],
        [3, ITEM.POT],
        [4, ITEM.CLAY],
        [5, ITEM.BROKEN_GLASS_LVL_2],
        [6, ITEM.RATS_TAIL],
        [7, ITEM.BROKEN_STAFF],
        [8, ITEM.DAMAGED_ARMOUR_2],
        [9, ITEM.JUG],
        [10, ITEM.OLD_BOOT]
    ];

    for (const [roll, item] of TABLE) {
        rolls(roll);
        const p = player({ ...at, stage: 4 });
        await digAreas.onUseWithGameObject(p, SOIL, { id: ITEM.ROCK_PICK });
        assert.deepEqual(p.experience, [['mining', 70]]);
        assert.equal(p.inventory.items.length, item === null ? 2 : 3);

        if (item !== null) {
            assert.equal(p.inventory.has(item), true, `${item}`);
        }
    }
});

test('level 3: a specimen jar, a specimen brush and the level 3 exam (stage 5) are needed; the Talisman of Zaros turns up', async () => {
    const at = { x: 12, y: 497, items: [ITEM.TROWEL, ITEM.SPECIMEN_JAR, ITEM.SPECIMEN_BRUSH], stage: 5 };

    const noJar = player({ ...at, items: [ITEM.TROWEL, ITEM.SPECIMEN_BRUSH] });
    await digAreas.onUseWithGameObject(noJar, SOIL, { id: ITEM.TROWEL });
    assert.deepEqual(noJar.experience, []);
    assert.equal(noJar.world.spawned.length, 1);
    assert.ok(noJar.said.includes('Oh, okay'));

    const noBrush = player({ ...at, items: [ITEM.TROWEL, ITEM.SPECIMEN_JAR] });
    await digAreas.onUseWithGameObject(noBrush, SOIL, { id: ITEM.TROWEL });
    assert.deepEqual(noBrush.experience, []);
    assert.equal(noBrush.world.spawned.length, 1);

    const early = player({ ...at, stage: 4 });
    await digAreas.onUseWithGameObject(early, SOIL, { id: ITEM.TROWEL });
    assert.deepEqual(early.experience, []);
    assert.equal(early.world.spawned.length, 1);

    rolls(4);
    const p = player(at);
    await digAreas.onUseWithGameObject(p, SOIL, { id: ITEM.TROWEL });
    assert.deepEqual(p.experience, [['mining', 80]]);
    assert.equal(p.inventory.count(ITEM.TALISMAN_OF_ZAROS), 1);
    assert.ok(p.messages.includes('You find a strange talisman'));

    // coins: 5 or 10 depending on the second roll; the east site counts too
    rolls(10, 1);
    const coins = player({ ...at, x: 25, y: 520 });
    await digAreas.onUseWithGameObject(coins, SOIL, { id: ITEM.TROWEL });
    assert.equal(coins.inventory.count(ITEM.COINS), 5);
    assert.ok(coins.messages.includes('You find some coins'));
    rolls(10, 0);
    const ten = player(at);
    await digAreas.onUseWithGameObject(ten, SOIL, { id: ITEM.TROWEL });
    assert.equal(ten.inventory.count(ITEM.COINS), 10);

    rolls(0);
    const nothing = player(at);
    await digAreas.onUseWithGameObject(nothing, SOIL, { id: ITEM.TROWEL });
    assert.equal(nothing.inventory.items.length, 3);
});

test('the spade is refused by a workman nearby, panning trays are spared, and rocks chip off a sample', async () => {
    const w = fakeNpc(NPC.WORKMAN);
    const p = player({ items: [ITEM.SPADE], world: fakeWorld({ npcs: [w] }), x: 20, y: 520 });
    await digAreas.onUseWithGameObject(p, SOIL, { id: ITEM.SPADE });
    assert.equal(p.world.spawned.length, 1);
    assert.equal(p.world.spawned[0].id, NPC.WORKMAN);

    // the Dig command anywhere on the site
    const dig = player({ items: [ITEM.SPADE], world: fakeWorld({ npcs: [w] }), x: 20, y: 520 });
    assert.equal(await digAreas.onInventoryCommand(dig, { id: ITEM.SPADE }), true);
    assert.equal(dig.world.spawned.length, 1);

    // far from the site the spade is not ours
    const away = player({ items: [ITEM.SPADE], x: 100, y: 100 });
    assert.equal(await digAreas.onInventoryCommand(away, { id: ITEM.SPADE }), false);

    // no workman near: nothing happens (but the hook claims it, as the Java blocks the dig)
    const lonely = player({ items: [ITEM.SPADE], x: 20, y: 520 });
    assert.equal(await digAreas.onInventoryCommand(lonely, { id: ITEM.SPADE }), true);
    assert.equal(lonely.world.spawned.length, 0);

    const tray = player();
    await digAreas.onUseWithGameObject(tray, SOIL, { id: ITEM.PANNING_TRAY });
    assert.ok(tray.said.includes("No I'd better not - it may damage the tray..."));

    const other = player();
    await digAreas.onUseWithGameObject(other, SOIL, { id: ITEM.COINS });
    assert.deepEqual(other.messages, ['Nothing interesting happens']);

    const rock = player({ items: [ITEM.ROCK_PICK] });
    assert.equal(await digAreas.onUseWithGameObject(rock, gameObject(1059, 27, 515), { id: ITEM.ROCK_PICK }), true);
    assert.equal(rock.inventory.count(ITEM.CRACKED_ROCK_SAMPLE), 1);
    assert.equal(await digAreas.onUseWithGameObject(rock, gameObject(1059, 27, 515), { id: ITEM.COINS }), false);
});

// ---------------------------------------------------------------- reading

test('the book, certificates, scroll and tablet read out; the book opens the message box', async () => {
    const p = player();
    assert.equal(await items.onInventoryCommand(p, { id: ITEM.BOOK_OF_EXPERIMENTAL_CHEMISTRY }), true);
    assert.equal(p.sent.length, 1);
    assert.equal(p.sent[0].type, 'serverMessageOnTop');
    assert.ok(p.sent[0].message.includes('1 measure of ammonium nitrate powder'));

    for (const [id, line] of [
        [ITEM.LEVEL_1_CERTIFICATE, 'The holder of this certificate has passed the level 1 exam in earth sciences'],
        [ITEM.LEVEL_2_CERTIFICATE, 'The holder of this certificate has passed the level 2 exam in earth sciences'],
        [ITEM.LEVEL_3_CERTIFICATE, 'The holder of this certificate has passed the level 3 exam in earth sciences'],
        [ITEM.DIGSITE_SCROLL, 'Signed Terrance Balando, Archaeological expert, City of Varrock'],
        [ITEM.STONE_TABLET, 'Tremble mortal, before the altar of our dread lord zaros']
    ]) {
        const q = player();
        assert.equal(await items.onInventoryCommand(q, { id }), true);
        assert.ok(q.said.includes(line), line);
    }
});

// ---------------------------------------------------------------- the whole quest

test('the quest start to finish through the hooks', async () => {
    const answers = [
        0, // Can I take an exam ?
        0, 0, 0 // the first, uninformed exam: three wrong
    ];
    const p = player({ stage: 0, answers });
    await talk(p, NPC.EXAMINER);
    assert.equal(stage(p), 1);

    await curator.onUseWithNPC(p, fakeNpc(NPC.CURATOR), { id: ITEM.UNSTAMPED_LETTER });
    assert.equal(p.inventory.count(ITEM.STAMPED_LETTER), 1);

    await talk(p, NPC.EXAMINER);
    assert.equal(stage(p), 2);

    for (const [id, sample] of [
        [NPC.STUDENT_ORANGE, ITEM.ROCK_SAMPLE_ORANGE],
        [NPC.STUDENT_GREEN, ITEM.ROCK_SAMPLE_GREEN],
        [NPC.STUDENT_PURPLE, ITEM.ROCK_SAMPLE_PURPLE]
    ]) {
        await talk(p, id);
        p.inventory.add(sample);
        await talk(p, id);
    }

    answers.push(0, 0, 2, 1);
    await talk(p, NPC.EXAMINER);
    assert.equal(stage(p), 3);

    for (const id of [NPC.STUDENT_ORANGE, NPC.STUDENT_GREEN, NPC.STUDENT_PURPLE]) {
        await talk(p, id);
    }

    answers.push(0, 2, 0, 1);
    await talk(p, NPC.EXAMINER);
    assert.equal(stage(p), 4);

    await talk(p, NPC.STUDENT_ORANGE);
    await talk(p, NPC.STUDENT_GREEN);
    await talk(p, NPC.STUDENT_PURPLE);
    p.inventory.add(ITEM.UNCUT_OPAL);
    await talk(p, NPC.STUDENT_PURPLE);

    answers.push(0, 0, 0, 2);
    await talk(p, NPC.EXAMINER);
    assert.equal(stage(p), 5);
    assert.equal(p.inventory.count(ITEM.LEVEL_3_CERTIFICATE), 1);

    await useOn(p, NPC.EXPERT, ITEM.STONE_TABLET);
    assert.equal(stage(p), 5);

    p.inventory.add(ITEM.STONE_TABLET);
    p.questStages.digsite = 6;
    await useOn(p, NPC.EXPERT, ITEM.STONE_TABLET);
    assert.equal(stage(p), -1);
    assert.equal(p.inventory.count(ITEM.GOLD_BAR), 2);
});
