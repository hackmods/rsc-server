const test = require('node:test');
const assert = require('node:assert/strict');

const { fakePlayer, fakeNpc, fakeWorld, gameObject, wallObject } = require('./wave2b-fakes');
const murderMystery = require('../src/plugins/quests/members/murder-mystery');

const GUARD = 747;
const POISON_SALESMAN = 763;
const DAVID = 754;
const ANNA = 751;
const FRANK = 756;
const BOB = 752;
const ELIZABETH = 755;
const CAROL = 753;
const HOBBES = 743;
const MAN = 750;

const THREAD_RED = 1200;
const THREAD_GREEN = 1201;
const THREAD_BLUE = 1202;
const FLYPAPER = 1203;
const MURDER_SCENE_POT = 1204;
const DAGGER = 1205;
const DAGGER_FLOUR = 1230;
const MURDERERS_FINGERPRINT = 1206;
const UNIDENTIFIED_FINGERPRINT = 1223;
const POT = 135;
const POT_OF_FLOUR = 136;
const COINS = 10;

const MURDER_KEYS = ['murder_david', 'murder_anna', 'murder_carol', 'murder_bob', 'murder_frank', 'murder_eliz'];

// [family name, murder key, poison p key, p2 key, thread, plain item, floury item, fingerprint]
const FAMILY = [
    ['david', 'murder_david', 'p_david', 'p_david2', THREAD_GREEN, 1197, 1227, 1210],
    ['anna', 'murder_anna', 'p_anna', 'p_anna2', THREAD_GREEN, 1194, 1224, 1207],
    ['carol', 'murder_carol', 'p_carol', 'p_carol2', THREAD_RED, 1196, 1226, 1209],
    ['bob', 'murder_bob', 'p_bob', 'p_bob2', THREAD_RED, 1195, 1225, 1208],
    ['frank', 'murder_frank', 'p_frank', 'p_frank2', THREAD_BLUE, 1199, 1229, 1212],
    ['eliz', 'murder_eliz', 'p_eliza', 'p_eliza2', THREAD_BLUE, 1198, 1228, 1211]
];

function started(opts = {}) {
    return fakePlayer({ quests: { murderMystery: 1 }, ...opts });
}

function ids(player) {
    return player.inventory.items.map((it) => it.id);
}

function withRandom(value, fn) {
    const original = Math.random;
    Math.random = () => value;

    return fn().finally(() => {
        Math.random = original;
    });
}

test('every exported hook passes on an unrelated target', async () => {
    const player = started();
    const npc = fakeNpc(1);

    assert.equal(await murderMystery.onTalkToNPC(player, npc), false);
    assert.equal(await murderMystery.onGroundItemTake(player, { id: 1 }), false);
    assert.equal(await murderMystery.onWallObjectCommandOne(player, wallObject(1, 0, 0)), false);
    assert.equal(await murderMystery.onGameObjectCommandTwo(player, { id: 1 }), false);
    assert.equal(await murderMystery.onUseWithGameObject(player, { id: 1138 }, { id: 1 }), false);
    assert.equal(await murderMystery.onUseWithGameObject(player, { id: 1 }, { id: POT }), false);
    assert.equal(await murderMystery.onUseWithInventory(player, { id: 1 }, { id: 2 }), false);
    assert.equal(await murderMystery.onUseWithInventory(player, { id: POT_OF_FLOUR }, { id: FLYPAPER }), false);
    assert.equal(player.messages.length + player.said.length + npc.said.length, 0);
});

test('the guard starts the quest and picks exactly one murderer', async () => {
    const player = fakePlayer({ quests: { murderMystery: 0 }, answers: [0] });
    const guard = fakeNpc(GUARD);

    const result = await withRandom(0.5, () => murderMystery.onTalkToNPC(player, guard));

    assert.equal(result, true);
    assert.equal(player.questStages.murderMystery, 1);
    // random(1, 6) with 0.5 is 4: Bob
    assert.deepEqual(Object.keys(player.cache).filter((k) => MURDER_KEYS.includes(k)), ['murder_bob']);
    assert.ok(guard.said.includes('thanks a lot!'));
});

test('every roll of the die maps to its murderer', async () => {
    const rolls = [
        [0, 'murder_david'],
        [0.2, 'murder_anna'],
        [0.4, 'murder_carol'],
        [0.5, 'murder_bob'],
        [0.7, 'murder_frank'],
        [0.99, 'murder_eliz']
    ];

    for (const [roll, key] of rolls) {
        const player = fakePlayer({ quests: { murderMystery: 0 }, answers: [0] });

        await withRandom(roll, () => murderMystery.onTalkToNPC(player, fakeNpc(GUARD)));

        assert.deepEqual(Object.keys(player.cache), [key]);
    }
});

test('declining leaves the quest unstarted', async () => {
    const player = fakePlayer({ quests: { murderMystery: 0 }, answers: [1] });
    const guard = fakeNpc(GUARD);

    assert.equal(await murderMystery.onTalkToNPC(player, guard), true);
    assert.equal(player.questStages.murderMystery, 0);
    assert.deepEqual(player.cache, {});
    assert.ok(guard.said.includes('get lost then, this is private property.'));
});

test('the guard after the quest only congratulates', async () => {
    const player = fakePlayer({ quests: { murderMystery: -1 } });
    const guard = fakeNpc(GUARD);

    assert.equal(await murderMystery.onTalkToNPC(player, guard), true);
    assert.ok(guard.said.includes('Excellent work on solving the murder'));
});

test('the poison salesman gives the buyers and sets poison_opt', async () => {
    const player = started({ answers: [1] });
    const npc = fakeNpc(POISON_SALESMAN);

    assert.equal(await murderMystery.onTalkToNPC(player, npc), true);
    assert.equal(player.cache.poison_opt, true);
    assert.ok(npc.said.includes('Sinclairs - Anna, Bob, Carol, David, Elizabeth and Frank'));
});

test('the poison salesman offers the pot only to a player carrying it', async () => {
    const without = started({ answers: [0] });
    await murderMystery.onTalkToNPC(without, fakeNpc(POISON_SALESMAN));
    assert.equal(without.asked[0].length, 3);

    const withPot = started({ items: [MURDER_SCENE_POT], answers: [3] });
    const npc = fakeNpc(POISON_SALESMAN);
    await murderMystery.onTalkToNPC(withPot, npc);
    assert.equal(withPot.asked[0].length, 4);
    assert.ok(withPot.messages.includes('The murder scene with the unusual smell'));
    assert.ok(npc.said.includes('yes... I suppose that could have happened...'));
});

test('the poison salesman before and after the quest', async () => {
    const before = fakePlayer({ quests: { murderMystery: 0 } });
    const npc = fakeNpc(POISON_SALESMAN);
    assert.equal(await murderMystery.onTalkToNPC(before, npc), true);
    assert.ok(npc.said.includes('People know a bargain when they see it!'));

    const after = fakePlayer({ quests: { murderMystery: -1 } });
    const quiet = fakeNpc(POISON_SALESMAN);
    assert.equal(await murderMystery.onTalkToNPC(after, quiet), true);
    assert.deepEqual(quiet.said, []);
    assert.deepEqual(after.said, []);
});

test('a suspect gives the poison answer: only the murderer sets p_X', async () => {
    for (const [name, murderKey, pKey] of FAMILY) {
        const npcId = {
            david: DAVID,
            anna: ANNA,
            carol: CAROL,
            bob: BOB,
            frank: FRANK,
            eliz: ELIZABETH
        }[name];

        // poison_opt without thread: who / where / poison
        const guilty = started({ cache: { poison_opt: true, [murderKey]: true }, answers: [2] });

        assert.equal(await murderMystery.onTalkToNPC(guilty, fakeNpc(npcId)), true);
        assert.equal(guilty.cache[pKey], true, `${name} guilty sets ${pKey}`);
        assert.equal(guilty.cache.poison_opt2, true);

        const other = FAMILY.find((f) => f[1] !== murderKey);
        const innocent = started({ cache: { poison_opt: true, [other[1]]: true }, answers: [2] });

        assert.equal(await murderMystery.onTalkToNPC(innocent, fakeNpc(npcId)), true);
        assert.equal(innocent.cache[pKey], undefined, `${name} innocent leaves ${pKey} unset`);
        assert.equal(innocent.cache.poison_opt2, undefined);
    }
});

test('with thread and poison_opt the poison question is the fourth option', async () => {
    const player = started({ cache: { poison_opt: true, thread: true, murder_anna: true }, answers: [3] });

    await murderMystery.onTalkToNPC(player, fakeNpc(ANNA));

    assert.deepEqual(player.asked[0], [
        'Who do you think was responsible?',
        'Where were you when the murder happened?',
        'Do you recognise this thread?',
        'Why did you buy poison the other day?'
    ]);
    assert.equal(player.cache.p_anna, true);
});

test('showing the thread: the matching colour changes the reply', async () => {
    const red = started({ cache: { thread: true }, items: [THREAD_RED], answers: [2] });
    const carol = fakeNpc(CAROL);
    await murderMystery.onTalkToNPC(red, carol);
    assert.ok(red.messages.includes('You show her the thread from the study window'));
    assert.ok(carol.said.includes('Its some red thread... it kind of looks like the'));

    const none = started({ cache: { thread: true }, answers: [2] });
    const plain = fakeNpc(CAROL);
    await murderMystery.onTalkToNPC(none, plain);
    assert.ok(none.messages.includes('you show Carol the thread found at the crime scene'));
    assert.ok(plain.said.includes('Its some thread. Sorry, do you have a point here?'));
});

test('suspects ignore a player who has not started and thank one who finished', async () => {
    const before = fakePlayer({ quests: { murderMystery: 0 } });
    await murderMystery.onTalkToNPC(before, fakeNpc(BOB));
    await murderMystery.onTalkToNPC(before, fakeNpc(CAROL));
    assert.deepEqual(before.messages, ['he is ignoring you', 'she is ignoring you']);

    const after = fakePlayer({ quests: { murderMystery: -1 } });
    const frank = fakeNpc(FRANK);
    await murderMystery.onTalkToNPC(after, frank);
    assert.deepEqual(frank.said, ["Apparently you aren't as stupid as you look"]);
});

test('a servant takes the poison question only when poison_opt is set', async () => {
    const player = started({ cache: { poison_opt: true }, answers: [3] });
    const hobbes = fakeNpc(HOBBES);

    assert.equal(await murderMystery.onTalkToNPC(player, hobbes), true);
    assert.equal(player.asked[0].length, 4);
    assert.ok(hobbes.said.includes("you'd really have to ask her though."));

    const without = started({ answers: [0] });
    await murderMystery.onTalkToNPC(without, fakeNpc(HOBBES));
    assert.equal(without.asked[0].length, 3);
});

test('Mary ignores a player who has not started', async () => {
    const player = fakePlayer({ quests: { murderMystery: 0 } });

    assert.equal(await murderMystery.onTalkToNPC(player, fakeNpc(745)), true);
    assert.deepEqual(player.messages, ['she is ignoring you']);
});

test('the man gives a random hint', async () => {
    const player = started({ answers: [4] });
    const man = fakeNpc(MAN);

    await withRandom(0.99, () => murderMystery.onTalkToNPC(player, man));

    assert.ok(man.said.includes('My father used to be in the guard.'));

    const first = started({ answers: [4] });
    const other = fakeNpc(MAN);
    await withRandom(0, () => murderMystery.onTalkToNPC(first, other));
    assert.ok(other.said.includes('well, I dont know if its related'));
});

test('the man talks about the family', async () => {
    const player = started({ answers: [0, 2, 1] });
    const man = fakeNpc(MAN);

    assert.equal(await murderMystery.onTalkToNPC(player, man), true);
    assert.ok(man.said.includes('Oh Carol... she is such a fool'));
});

test('the window gives the murderer thread colour and sets thread', async () => {
    for (const [name, murderKey, , , thread] of FAMILY) {
        const player = started({ cache: { [murderKey]: true } });

        assert.equal(await murderMystery.onWallObjectCommandOne(player, wallObject(205, 484, 389)), true);
        assert.deepEqual(ids(player), [thread], `${name} thread colour`);
        assert.equal(player.cache.thread, true);
        assert.ok(player.messages.includes('You take the thread'));
    }
});

test('the window: a second visit does not duplicate the thread, a lost one is replaced', async () => {
    const player = started({ cache: { murder_carol: true } });
    const window = wallObject(205, 484, 389);

    await murderMystery.onWallObjectCommandOne(player, window);
    await murderMystery.onWallObjectCommandOne(player, window);
    assert.deepEqual(ids(player), [THREAD_RED]);
    assert.equal(player.messages.at(-1), 'You have already taken the thread');

    const lost = started({ cache: { murder_carol: true, thread: true } });
    await murderMystery.onWallObjectCommandOne(lost, window);
    assert.deepEqual(ids(lost), [THREAD_RED]);
    assert.ok(lost.messages.includes('Lucky for you theres some thread left'));
});

test('the window needs the guards permission', async () => {
    for (const stage of [0, -1]) {
        const player = fakePlayer({ quests: { murderMystery: stage } });

        assert.equal(await murderMystery.onWallObjectCommandOne(player, wallObject(205, 484, 389)), true);
        assert.deepEqual(player.messages, ['You need the guards permission to do that']);
        assert.deepEqual(ids(player), []);
    }
});

test('the dagger and pot are copied, never taken off the floor', async () => {
    const world = fakeWorld();
    const player = started({ world });
    const dagger = { id: DAGGER, x: 485, y: 389 };
    const pot = { id: MURDER_SCENE_POT, x: 484, y: 388 };

    assert.equal(await murderMystery.onGroundItemTake(player, dagger), true);
    assert.equal(await murderMystery.onGroundItemTake(player, pot), true);
    assert.deepEqual(ids(player), [DAGGER, MURDER_SCENE_POT]);
    assert.deepEqual(world.removed, []);

    await murderMystery.onGroundItemTake(player, dagger);
    assert.deepEqual(ids(player), [DAGGER, MURDER_SCENE_POT]);
    assert.equal(player.messages.at(-1), 'You already have the murderweapon');
});

test('after the quest the dagger cannot be taken, before it nothing is given at an odd stage', async () => {
    const done = fakePlayer({ quests: { murderMystery: -1 } });

    assert.equal(await murderMystery.onGroundItemTake(done, { id: MURDER_SCENE_POT }), true);
    assert.deepEqual(ids(done), []);
    assert.deepEqual(done.messages, ['you cannot take the strange smelling pot.', 'The guards will need it as Evidence.']);

    const odd = fakePlayer({ quests: { murderMystery: 2 } });
    assert.equal(await murderMystery.onGroundItemTake(odd, { id: DAGGER }), true);
    assert.deepEqual(ids(odd), []);
    assert.deepEqual(odd.messages, []);
});

test('barrels give the silver items once', async () => {
    const barrels = [
        [1132, 1194],
        [1133, 1195],
        [1134, 1196],
        [1135, 1197],
        [1136, 1198],
        [1137, 1199]
    ];

    for (const [barrel, item] of barrels) {
        const player = started();

        assert.equal(await murderMystery.onGameObjectCommandTwo(player, gameObject(barrel, 490, 390)), true);
        assert.deepEqual(ids(player), [item]);

        await murderMystery.onGameObjectCommandTwo(player, gameObject(barrel, 490, 390));
        assert.deepEqual(ids(player), [item]);
    }
});

test('the sacks give flypaper on a yes only', async () => {
    const yes = started({ answers: [0] });
    assert.equal(await murderMystery.onGameObjectCommandTwo(yes, gameObject(1139, 490, 390)), true);
    assert.deepEqual(ids(yes), [FLYPAPER]);

    const no = started({ answers: [1] });
    await murderMystery.onGameObjectCommandTwo(no, gameObject(1139, 490, 390));
    assert.deepEqual(ids(no), []);
    assert.equal(no.messages.at(-1), 'you leave the paper in the sack');
});

test('the matching object sets evidence and p_X2 only with poison_opt2 and for the murderer', async () => {
    const sites = [
        [1126, 'anna'],
        [1127, 'bob'],
        [1128, 'carol'],
        [1129, 'david'],
        [1130, 'eliz'],
        [1131, 'frank']
    ];

    for (const [objectId, name] of sites) {
        const family = FAMILY.find((f) => f[0] === name);

        const proven = started({ cache: { poison_opt2: true, [family[1]]: true } });
        assert.equal(await murderMystery.onGameObjectCommandTwo(proven, gameObject(objectId, 490, 390)), true);
        assert.equal(proven.cache.evidence, true, `${name} evidence`);
        assert.equal(proven.cache[family[3]], true, `${name} ${family[3]}`);

        // poison_opt2 but somebody else is the murderer: only a smell
        const other = FAMILY.find((f) => f[0] !== name);
        const clear = started({ cache: { poison_opt2: true, [other[1]]: true } });
        await murderMystery.onGameObjectCommandTwo(clear, gameObject(objectId, 490, 390));
        assert.equal(clear.cache.evidence, undefined);
        assert.equal(clear.cache[family[3]], undefined);

        // no poison_opt2 at all: just an examine line
        const blind = started({ cache: { [family[1]]: true } });
        await murderMystery.onGameObjectCommandTwo(blind, gameObject(objectId, 490, 390));
        assert.equal(blind.cache.evidence, undefined);
        assert.equal(blind.messages.length, 1);
    }
});

test('the fountain has the player speak mid scene', async () => {
    const player = started({ cache: { poison_opt2: true, murder_eliz: true } });

    await murderMystery.onGameObjectCommandTwo(player, gameObject(1130, 490, 390));

    assert.deepEqual(player.said, ["I hate mosquitos, they're so annoying"]);
    assert.equal(player.messages.at(-1), 'Its certainly clear nobodies used poison here.');
});

test('the dog gate and the objects need permission outside the investigation', async () => {
    const gate = started();
    assert.equal(await murderMystery.onGameObjectCommandTwo(gate, gameObject(1140, 490, 390)), true);
    assert.equal(gate.messages.length, 3);

    for (const stage of [0, -1]) {
        const player = fakePlayer({ quests: { murderMystery: stage } });

        assert.equal(await murderMystery.onGameObjectCommandTwo(player, gameObject(1126, 490, 390)), true);
        assert.deepEqual(player.messages, ['You need the guards permission to do that']);
    }

    const odd = fakePlayer({ quests: { murderMystery: 3 } });
    assert.equal(await murderMystery.onGameObjectCommandTwo(odd, gameObject(1126, 490, 390)), true);
    assert.deepEqual(odd.messages, []);
});

test('the flour barrel fills a pot but refuses the evidence pot', async () => {
    const player = started({ items: [POT] });

    assert.equal(await murderMystery.onGameObjectCommandTwo(player, gameObject(1138, 490, 390)), true);
    assert.deepEqual(ids(player), [POT_OF_FLOUR]);

    const empty = started();
    await murderMystery.onGameObjectCommandTwo(empty, gameObject(1138, 490, 390));
    assert.equal(empty.messages.at(-1), 'You need something to put the flour in');

    const evidence = started({ items: [MURDER_SCENE_POT] });
    await murderMystery.onGameObjectCommandTwo(evidence, gameObject(1138, 490, 390));
    assert.deepEqual(ids(evidence), [MURDER_SCENE_POT]);
    assert.equal(evidence.messages.at(-1), 'scene to keep flour in...');
});

test('using a pot on the flour barrel', async () => {
    const barrel = gameObject(1138, 490, 390);

    const player = started({ items: [POT] });
    assert.equal(await murderMystery.onUseWithGameObject(player, barrel, { id: POT }), true);
    assert.deepEqual(ids(player), [POT_OF_FLOUR]);
    assert.equal(player.messages.at(-1), 'Theres still plenty of flour left');

    const evidence = started({ items: [MURDER_SCENE_POT] });
    assert.equal(await murderMystery.onUseWithGameObject(evidence, barrel, { id: MURDER_SCENE_POT }), true);
    assert.deepEqual(ids(evidence), [MURDER_SCENE_POT]);
    assert.deepEqual(evidence.messages, [
        "You probably shouldn't use evidence from a crime",
        'scene to keep flour in...'
    ]);
});

test('flour on the dagger and flypaper on the floury dagger, either order', async () => {
    const player = started({ items: [POT_OF_FLOUR, DAGGER, FLYPAPER] });

    assert.equal(await murderMystery.onUseWithInventory(player, { id: POT_OF_FLOUR }, { id: DAGGER }), true);
    assert.ok(ids(player).includes(DAGGER_FLOUR));
    assert.ok(ids(player).includes(POT));
    assert.ok(!ids(player).includes(DAGGER));
    assert.ok(!ids(player).includes(POT_OF_FLOUR));

    assert.equal(await murderMystery.onUseWithInventory(player, { id: DAGGER_FLOUR }, { id: FLYPAPER }), true);
    assert.deepEqual(ids(player).sort(), [POT, DAGGER, UNIDENTIFIED_FINGERPRINT].sort());

    const reversed = started({ items: [DAGGER, POT_OF_FLOUR] });
    assert.equal(await murderMystery.onUseWithInventory(reversed, { id: DAGGER }, { id: POT_OF_FLOUR }), true);
    assert.ok(ids(reversed).includes(DAGGER_FLOUR));
});

test('flour and flypaper turn each silver item into a named fingerprint', async () => {
    for (const [name, , , , , plain, floury, print] of FAMILY) {
        const player = started({ items: [POT_OF_FLOUR, plain, FLYPAPER] });

        assert.equal(await murderMystery.onUseWithInventory(player, { id: plain }, { id: POT_OF_FLOUR }), true);
        assert.ok(ids(player).includes(floury), `${name} floury`);
        assert.ok(!ids(player).includes(plain));

        assert.equal(await murderMystery.onUseWithInventory(player, { id: FLYPAPER }, { id: floury }), true);
        assert.deepEqual(ids(player).sort(), [POT, plain, print].sort(), `${name} print`);
    }
});

test('flour on the evidence pot only empties the flour', async () => {
    const player = started({ items: [POT_OF_FLOUR, MURDER_SCENE_POT] });

    assert.equal(await murderMystery.onUseWithInventory(player, { id: POT_OF_FLOUR }, { id: MURDER_SCENE_POT }), true);
    assert.deepEqual(ids(player).sort(), [POT, MURDER_SCENE_POT].sort());
    assert.ok(player.messages.includes("The surface isn't shiny enough to take a fingerprint from"));
});

test('the unidentified print matches the murderer, either order', async () => {
    const player = started({ items: [UNIDENTIFIED_FINGERPRINT, 1210], cache: { murder_david: true } });

    assert.equal(
        await murderMystery.onUseWithInventory(player, { id: UNIDENTIFIED_FINGERPRINT }, { id: 1210 }),
        true
    );
    assert.ok(player.messages.includes('The fingerprints are an exact match to Davids'));
    assert.ok(ids(player).includes(MURDERERS_FINGERPRINT));
    assert.ok(ids(player).includes(1210));
    assert.ok(!ids(player).includes(UNIDENTIFIED_FINGERPRINT));
    assert.equal(player.cache.culprit, true);

    const reversed = started({ items: [1207, UNIDENTIFIED_FINGERPRINT], cache: { murder_anna: true } });
    assert.equal(await murderMystery.onUseWithInventory(reversed, { id: 1207 }, { id: UNIDENTIFIED_FINGERPRINT }), true);
    assert.equal(reversed.cache.culprit, true);
});

test('a mismatched print destroys the named print and keeps the unidentified one', async () => {
    const player = started({ items: [UNIDENTIFIED_FINGERPRINT, 1208], cache: { murder_david: true } });

    assert.equal(
        await murderMystery.onUseWithInventory(player, { id: UNIDENTIFIED_FINGERPRINT }, { id: 1208 }),
        true
    );
    assert.deepEqual(ids(player), [UNIDENTIFIED_FINGERPRINT]);
    assert.equal(player.cache.culprit, undefined);
    assert.deepEqual(player.messages, [
        "They don't seem to be the same",
        'I guess that clears Bob of the crime',
        'You destroy the useless fingerprint'
    ]);
});

test('accusing with no proof: the intruder and butler replies', async () => {
    const intruder = started({ answers: [2, 0] });
    const guard = fakeNpc(GUARD);

    assert.equal(await murderMystery.onTalkToNPC(intruder, guard), true);
    assert.ok(guard.said.includes('Thats what we were thinking too.'));

    const butler = started({ answers: [2, 1] });
    const g2 = fakeNpc(GUARD);
    await murderMystery.onTalkToNPC(butler, g2);
    assert.ok(g2.said.includes('the butler is kind of shifty looking...'));
});

test('accusing with no proof: naming a servant or a family member is not enough', async () => {
    // servants -> the men -> Donovan
    const servant = started({ answers: [2, 2, 1, 0] });
    const guard = fakeNpc(GUARD);
    await murderMystery.onTalkToNPC(servant, guard);
    assert.ok(servant.messages.includes('You tell the guard who you suspect of the crime'));
    assert.ok(servant.said.includes('uh....'));
    assert.ok(guard.said.includes('come see me when you have some proof of your accusations'));

    // servants -> the men -> the butler gets the butler reply
    const butler = started({ answers: [2, 2, 1, 2] });
    const g2 = fakeNpc(GUARD);
    await murderMystery.onTalkToNPC(butler, g2);
    assert.ok(butler.said.includes('the butler did it!'));
    assert.ok(g2.said.includes('the butler is kind of shifty looking...'));
    assert.ok(!butler.messages.includes('You tell the guard who you suspect of the crime'));

    // family -> the women -> Carol
    const family = started({ answers: [2, 3, 0, 1] });
    const g3 = fakeNpc(GUARD);
    await murderMystery.onTalkToNPC(family, g3);
    assert.ok(family.messages.includes('You tell the guard who you suspect of the crime'));
    assert.equal(family.questStages.murderMystery, 1);
});

test('accusing with one piece of proof jumps straight to it', async () => {
    const thread = started({ cache: { thread: true }, answers: [2] });
    const guard = fakeNpc(GUARD);

    await murderMystery.onTalkToNPC(thread, guard);
    assert.ok(thread.messages.includes('you show the guard the thread you found on the window'));
    assert.ok(guard.said.includes('You still havent proved who did do it though'));

    const evidence = started({ cache: { evidence: true, p_carol2: true }, answers: [2] });
    await murderMystery.onTalkToNPC(evidence, fakeNpc(GUARD));
    assert.ok(evidence.said.includes('I have proof that Carol is lying about the poison'));
    assert.ok(evidence.messages.includes('you tell the guard about the drain'));

    const culprit = started({ cache: { culprit: true, murder_frank: true }, answers: [2] });
    await murderMystery.onTalkToNPC(culprit, fakeNpc(GUARD));
    assert.ok(culprit.said.includes("I have Franks' Fingerprints here."));
    assert.ok(culprit.messages.includes('You show the guard the finger prints evidence'));
});

test('accusing with two pieces offers a menu of the two', async () => {
    const player = started({ cache: { thread: true, culprit: true, murder_bob: true }, answers: [2, 1] });
    const guard = fakeNpc(GUARD);

    await murderMystery.onTalkToNPC(player, guard);

    assert.deepEqual(player.asked[1], [
        "I have proof that it wasn't any of the servants",
        'I have the fingerprints of the culprit'
    ]);
    assert.ok(player.messages.includes('You show the guard the finger prints evidence'));
    assert.equal(player.questStages.murderMystery, 1);

    const second = started({ cache: { evidence: true, p_bob2: true, thread: true }, answers: [2, 1] });
    await murderMystery.onTalkToNPC(second, fakeNpc(GUARD));
    assert.ok(second.messages.includes('you tell the guard about the beehive'));

    const third = started({ cache: { evidence: true, p_bob2: true, culprit: true, murder_bob: true }, answers: [2, 0] });
    await murderMystery.onTalkToNPC(third, fakeNpc(GUARD));
    assert.ok(third.messages.includes('you tell the guard about the beehive'));
});

test('all three pieces complete the quest', async () => {
    const cache = {
        murder_david: true,
        thread: true,
        evidence: true,
        culprit: true,
        poison_opt: true,
        poison_opt2: true,
        p_david: true,
        p_david2: true
    };
    const player = started({
        cache,
        answers: [2],
        levels: { crafting: 40 },
        items: [
            THREAD_GREEN,
            DAGGER,
            MURDERERS_FINGERPRINT,
            MURDER_SCENE_POT,
            1197,
            1227,
            1210,
            UNIDENTIFIED_FINGERPRINT,
            [COINS, 5],
            POT
        ]
    });
    const guard = fakeNpc(GUARD);

    assert.equal(await murderMystery.onTalkToNPC(player, guard), true);

    assert.equal(player.questStages.murderMystery, -1);
    assert.equal(player.questPoints, 3);
    assert.deepEqual(player.experience, [['crafting', 750 + 150 * 40, false]]);
    assert.ok(player.messages.includes('You have completed the Murder Mystery Quest'));
    assert.ok(player.messages.includes('You received 2000 gold!'));
    assert.equal(player.inventory.count(COINS), 2005);
    // every piece of evidence went back to the guard; unrelated items stay
    assert.deepEqual(ids(player).sort(), [COINS, POT].sort());

    assert.ok(guard.said.includes('It must have been David who killed his father'));
    assert.ok(guard.said.includes('by ourselves. We will hold him here under house arrest'));
    assert.ok(guard.said.includes('Please accept this reward from the family!'));
    assert.ok(player.messages.includes('You prove to the guard the thread matches Davids clothes'));
    assert.ok(player.messages.includes('You prove to the guard David did not use poison on the spiders nest'));
    assert.ok(player.messages.includes('You match Davids fingerprints with those on the dagger'));

    assert.deepEqual(player.cache, {});
});

test('completion removes every copy of an item and uses the pronoun of the murderer', async () => {
    const player = started({
        cache: { murder_eliz: true, thread: true, evidence: true, culprit: true, p_eliza2: true, p_eliza: true },
        answers: [2],
        items: [THREAD_BLUE, DAGGER, DAGGER, 1198]
    });
    const guard = fakeNpc(GUARD);

    await murderMystery.onTalkToNPC(player, guard);

    assert.deepEqual(ids(player), [COINS]);
    assert.ok(guard.said.includes('It must have been Elizabeth who killed her father'));
    assert.ok(guard.said.includes('Until such time as we can bring her to trial'));
    assert.deepEqual(player.cache, {});
});

test('three pieces without a proven alibi still complete, with the Java empty pronoun', async () => {
    // evidence for somebody who is not the murderer cannot be produced in play; this pins the Java's empty pronoun
    const player = started({
        cache: { murder_bob: true, thread: true, evidence: true, culprit: true },
        answers: [2]
    });
    const guard = fakeNpc(GUARD);

    await murderMystery.onTalkToNPC(player, guard);

    assert.equal(player.questStages.murderMystery, -1);
    assert.ok(guard.said.includes('by ourselves. We will hold  here under house arrest'));
});

test('the guard answers the other two questions at stage 1', async () => {
    const player = started({ answers: [0, 1] });
    const guard = fakeNpc(GUARD);

    await murderMystery.onTalkToNPC(player, guard);
    await murderMystery.onTalkToNPC(player, guard);

    assert.ok(guard.said.includes('well its all very mysterious.'));
    assert.equal(guard.said.filter((l) => l === "but frankly we're out of our depth here").length, 1);
});
