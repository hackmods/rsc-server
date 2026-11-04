// Jungle Potion (quests/members/jungle-potion/trufitus.js and herbs.js), ported from Open-RSC Jungle_Potion.java:
// every stage with Trufitus, every herb spot, the cache that lets a lost herb be found again, and the reward.

const test = require('node:test');
const assert = require('node:assert/strict');

const trufitus = require('../src/plugins/quests/members/jungle-potion/trufitus');
const herbs = require('../src/plugins/quests/members/jungle-potion/herbs');
const { fakeNpc, fakePlayer, fakeWorld, gameObject, wallObject } = require('./wave2b-fakes');

const TRUFITUS = 517;

function withDrops(world) {
    world.drops = [];
    world.addPlayerDrop = (player, id, x, y) => world.drops.push({ id, x, y, owner: player.id });
    return world;
}

// script the next menus of an existing fake player
function answer(p, ...choices) {
    p.ask = async (options, repeat) => {
        p.asked.push(options);
        const choice = choices.shift();
        if (choice === undefined) throw new Error('no answer scripted for ' + JSON.stringify(options));
        if (repeat) p.said.push(options[choice]);
        return choice;
    };
}

function player(opts) {
    return fakePlayer({ world: withDrops(fakeWorld()), ...opts });
}

test('hooks pass on unrelated ids', async () => {
    const p = player();
    assert.equal(await trufitus.onTalkToNPC(p, fakeNpc(1)), false);
    assert.equal(await herbs.onGameObjectCommandTwo(p, gameObject(1, 0, 0)), false);
    assert.equal(await herbs.onWallObjectCommandTwo(p, wallObject(1, 0, 0)), false);
    assert.deepEqual(p.messages, []);
});

test('stage 0: Bwana -> peace -> proposition -> the challenge starts the quest', async () => {
    const p = player({ answers: [0, 0, 0, 0, 1] });
    const npc = fakeNpc(TRUFITUS);

    assert.equal(await trufitus.onTalkToNPC(p, npc), true);
    assert.equal(p.questStages.junglePotion, 1);
    assert.equal(p.cache.got_snake_weed, false);
    assert.ok(npc.said.includes("'Snake Weed'"));
    assert.ok(p.said.includes('And it would make a nice break from killing things !'));
});

test('stage 0: "where is everyone" path, declining leaves the quest unstarted', async () => {
    const p = player({ answers: [2, 1] });
    await trufitus.onTalkToNPC(p, fakeNpc(TRUFITUS));
    assert.equal(p.questStages.junglePotion, undefined);
    assert.ok(p.said.includes("I am very sorry, but I don't have time for that."));
});

const HAND_INS = [
    { stage: 1, clean: 816, grimy: 815, object: 564, key: 'got_snake_weed', next: 'got_ardigal', found: 'Small amounts of a herb are growing near this vine' },
    { stage: 2, clean: 818, grimy: 817, object: 553, key: 'got_ardigal', next: 'got_sito_foil', found: 'You find a herb plant growing at the base of the palm' },
    { stage: 3, clean: 820, grimy: 819, object: 554, key: 'got_sito_foil', next: 'got_volencia_moss', found: 'A small herb plant is growing in the scorched soil.' },
    { stage: 4, clean: 822, grimy: 821, object: 555, key: 'got_volencia_moss', next: 'got_rogues_purse', found: 'Small amounts of herb moss are growing at the base of this rock' }
];

for (const h of HAND_INS) {
    test(`stage ${h.stage}: the spot drops grimy herb ${h.grimy} once, Trufitus takes the clean ${h.clean}`, async () => {
        const p = player({ quests: { junglePotion: h.stage }, cache: { [h.key]: false } });
        const object = gameObject(h.object, 400, 760);

        assert.equal(await herbs.onGameObjectCommandTwo(p, object), true);
        assert.deepEqual(p.world.drops, [{ id: h.grimy, x: 400, y: 760, owner: 1 }]);
        assert.equal(p.messages[0], h.found);
        assert.equal(p.cache[h.key], true);

        // a second search finds nothing until Trufitus asks again
        await herbs.onGameObjectCommandTwo(p, object);
        assert.equal(p.world.drops.length, 1);

        // without the herb he refuses and resets the cache, so the spot gives another
        answer(p, 0);
        await trufitus.onTalkToNPC(p, fakeNpc(TRUFITUS));
        assert.equal(p.questStages.junglePotion, h.stage);
        assert.equal(p.cache[h.key], false);
        await herbs.onGameObjectCommandTwo(p, object);
        assert.equal(p.world.drops.length, 2);

        // carrying the grimy herb blocks another
        p.inventory.add(h.grimy);
        p.cache[h.key] = false;
        await herbs.onGameObjectCommandTwo(p, object);
        assert.equal(p.world.drops.length, 2);

        // hand in the clean herb
        p.inventory.remove(h.grimy);
        p.inventory.add(h.clean);
        answer(p, 0);
        await trufitus.onTalkToNPC(p, fakeNpc(TRUFITUS));
        assert.equal(p.questStages.junglePotion, h.stage + 1);
        assert.equal(p.inventory.has(h.clean), false);
        assert.equal(p.cache[h.key], undefined);
        assert.equal(p.cache[h.next], false);
    });
}

test('the vine and palm say nothing useful at the wrong stage', async () => {
    const p = player({ quests: { junglePotion: 0 } });
    await herbs.onGameObjectCommandTwo(p, gameObject(564, 1, 1));
    await herbs.onGameObjectCommandTwo(p, gameObject(553, 1, 1));
    await herbs.onGameObjectCommandTwo(p, gameObject(554, 1, 1));
    await herbs.onGameObjectCommandOne(p, gameObject(555, 1, 1)); // Mine works like Search
    assert.deepEqual(p.messages, [
        'Yep, it looks like a vine...',
        'You find nothing of interest this time, sorry!',
        'You just find scorched earth.',
        'You find nothing of interest.'
    ]);
    assert.deepEqual(p.world.drops, []);
});

test("Legends' Quest past stage 6 (the Java's 1-6 guard comes first) gets snake weed and ardrigal without the quest", async () => {
    const p = player({ quests: { junglePotion: -1, legendsQuest: 7 } });
    await herbs.onGameObjectCommandTwo(p, gameObject(564, 5, 5));
    await herbs.onGameObjectCommandTwo(p, gameObject(553, 6, 6));
    assert.deepEqual(p.world.drops.map((d) => d.id), [815, 817]);

    const busy = player({ quests: { junglePotion: 1, legendsQuest: 3 } });
    await herbs.onGameObjectCommandTwo(busy, gameObject(564, 5, 5));
    assert.deepEqual(busy.world.drops, []);
});

test('stage 5: the cavern wall drops rogues purse under the player; Trufitus finishes the quest', async () => {
    const p = player({ quests: { junglePotion: 5 }, cache: { got_rogues_purse: false }, x: 410, y: 3577, levels: { herblaw: 10 } });

    assert.equal(await herbs.onWallObjectCommandTwo(p, wallObject(151, 410, 3576)), true);
    assert.deepEqual(p.world.drops, [{ id: 823, x: 410, y: 3577, owner: 1 }]);

    p.inventory.add(824);
    answer(p, 0);
    await trufitus.onTalkToNPC(p, fakeNpc(TRUFITUS));

    assert.equal(p.questStages.junglePotion, -1);
    assert.equal(p.questPoints, 1);
    assert.deepEqual(p.experience, [['herblaw', 1600 + 500 * 10, false]]);
    assert.ok(p.messages.includes('Trufitus shows you some techniques in Herblaw'));
    assert.ok(p.messages.includes('You gain experience in Herblaw !'));
    assert.equal(p.cache.jungle_completed, true);
    assert.equal(p.cache.got_rogues_purse, undefined);

    // his one-off thanks, then the Shilo Village lines
    const npc = fakeNpc(TRUFITUS);
    await trufitus.onTalkToNPC(p, npc);
    assert.equal(npc.said[0], 'My greatest respects Bwana');
    assert.equal(p.cache.jungle_completed, undefined);

    const later = fakeNpc(TRUFITUS);
    await trufitus.onTalkToNPC(p, later);
    assert.deepEqual(later.said, ['Greetings once again Bwana,', 'I have no more news since we last spoke.']);
});

test('stage 5 without the herb: he is not deceived', async () => {
    const p = player({ quests: { junglePotion: 5 }, answers: [0] });
    const npc = fakeNpc(TRUFITUS);
    await trufitus.onTalkToNPC(p, npc);
    assert.equal(p.questStages.junglePotion, 5);
    assert.ok(npc.said.includes("Please don't try to deceive me!"));
});
