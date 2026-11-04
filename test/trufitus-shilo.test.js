const assert = require('assert/strict');
const test = require('node:test');

const { fakeNpc, fakeWorld, fakePlayer } = require('./wave2b-fakes');
const { trufitusAfterQuest } = require('../src/plugins/quests/members/jungle-potion/trufitus-shilo');

const TRUFITUS_ID = 517;
const ZADIMUS_ID = 589;
const STONE_PLAQUE_ID = 958;
const BONE_SHARD_ID = 974;

function setup(options = {}) {
    const world = options.world || fakeWorld();
    const player = fakePlayer({ world, ...options, quests: { junglePotion: -1, ...(options.quests || {}) } });
    const npc = fakeNpc(TRUFITUS_ID);
    // trufitus.js engages him before calling trufitusAfterQuest
    player.engage(npc);
    return { world, player, npc };
}

function withRandom(value, fn) {
    const original = Math.random;
    Math.random = () => value;

    return fn().finally(() => {
        Math.random = original;
    });
}

test('shilo village not started: the default line', async () => {
    const { player, npc } = setup({ quests: { shiloVillage: 0 } });
    await trufitusAfterQuest(player, npc);
    assert.deepEqual(npc.said, ['Greetings once again Bwana,', 'I have no more news since we last spoke.']);
    assert.deepEqual(player.said, []);
    assert.deepEqual(player.asked, []);
});

test('shilo village unset is treated as stage 0', async () => {
    const { player, npc } = setup();
    await trufitusAfterQuest(player, npc);
    assert.equal(npc.said[0], 'Greetings once again Bwana,');
});

test('shilo village complete: one of three random greetings', async () => {
    const lines = [];

    for (const [roll, playerLine, npcFirst] of [
        [0, 'Greetings', 'Hello Bwana.'],
        [0.4, 'Hello!', 'Hello again Bwana.!'],
        [0.9, 'Hello Bwana!', 'Greetings!']
    ]) {
        const { player, npc } = setup({ quests: { shiloVillage: -1 } });
        await withRandom(roll, () => trufitusAfterQuest(player, npc));
        assert.deepEqual(player.said, [playerLine]);
        assert.equal(npc.said[0], npcFirst);
        lines.push(npc.said.length);
    }

    assert.deepEqual(lines, [6, 3, 5]);
});

test('shilo village 1: Ah Za Rhoon explanation moves the stage to 2', async () => {
    // Rashiliyia -> legend -> "Why was it called Ah Za Rhoon?" -> thanks
    const { player, npc } = setup({ quests: { shiloVillage: 1 }, answers: [1, 2, 0, 0] });
    await trufitusAfterQuest(player, npc);
    assert.equal(player.questStages.shiloVillage, 2);
    assert.ok(npc.said.includes("'Magnificence floating on water'"));
    assert.equal(npc.said.at(-1), 'Hmmm, well, you are welcome bwana.');
    assert.deepEqual(player.messages, ['Trufitus looks at you blankly, then wanders off.']);
});

test('shilo village 2: the Ah Za Rhoon explanation does not change the stage', async () => {
    const { player, npc } = setup({ quests: { shiloVillage: 2 }, answers: [1, 2, 0, 1, 0] });
    await trufitusAfterQuest(player, npc);
    assert.equal(player.questStages.shiloVillage, 2);
    assert.ok(npc.said.includes('Not much'));
    assert.equal(npc.said.at(-1), "You're very demanding aren't you!");
});

test('shilo village 1: "how are you" branch reaches Mosol Rei', async () => {
    // how are you -> Mosol Rei -> Rashiliyia -> nothing we can do -> oh ok
    const { player, npc } = setup({ quests: { shiloVillage: 1 }, answers: [0, 1, 0, 0, 0] });
    await trufitusAfterQuest(player, npc);
    assert.equal(npc.said[0], 'Greetings Bwana!');
    assert.ok(npc.said.includes("I'm very well thanks."));
    assert.ok(npc.said.includes('Your journeys have taken you far!'));
    assert.equal(npc.said.at(-1), 'Well, I hope you will excuse me, but I need to get back to my studies.');
    assert.deepEqual(player.messages, ['Trufitus seems deeply touched...']);
    assert.equal(player.questStages.shiloVillage, 1);
});

test('shilo village 4: keys and kin moves the stage to 5', async () => {
    const { player, npc } = setup({ quests: { shiloVillage: 4 }, answers: [2, 0] });
    await trufitusAfterQuest(player, npc);
    assert.equal(player.questStages.shiloVillage, 5);
    assert.equal(player.asked[0].length, 3);
    assert.ok(player.said.includes(' "The spirit said something about keys and kin?"'));
    assert.equal(npc.said.at(-1), 'as it may be the only way to approach Rashiliyia.');
});

test('shilo village 5: keys and kin leaves the stage alone', async () => {
    const { player, npc } = setup({ quests: { shiloVillage: 5 }, answers: [2, 0] });
    await trufitusAfterQuest(player, npc);
    assert.equal(player.questStages.shiloVillage, 5);
});

test('shilo village 4: rambling spirit is brushed off and stage stays 4', async () => {
    const { player, npc } = setup({ quests: { shiloVillage: 4 }, answers: [2, 1] });
    await trufitusAfterQuest(player, npc);
    assert.equal(player.questStages.shiloVillage, 4);
    assert.equal(npc.said.at(-1), 'Oh, so it most likely was not very important then?');
});

test('shilo village 3: the buried-corpse option is not offered', async () => {
    const { player, npc } = setup({ quests: { shiloVillage: 3 }, answers: [1] });
    await trufitusAfterQuest(player, npc);
    assert.equal(player.asked[0].length, 2);
    // option 1 says the temple line, then showMeItems(0) at stage 3 (no plaque, no info), no menu
    assert.equal(npc.said.at(-1), 'And best of luck!');
    assert.equal(player.asked.length, 1);
});

test('shilo village 8: dropped remains spawn Zadimus, give the bone shard and remove him', async () => {
    const world = fakeWorld();
    const { player, npc } = setup({
        world,
        x: 10,
        y: 20,
        quests: { shiloVillage: 8 },
        cache: { rashiliya_corpse: true },
        answers: [1]
    });
    let spawned;
    const spawn = world.spawnTimedNPC;
    world.spawnTimedNPC = (opts) => {
        spawned = opts;
        return spawn(opts);
    };

    await trufitusAfterQuest(player, npc);

    assert.deepEqual(spawned, { id: ZADIMUS_ID, x: 10, y: 20, ticks: 100 });
    assert.ok(player.inventory.has(BONE_SHARD_ID));
    assert.equal(world.npcList.length, 0);
    assert.equal(world.removed.length, 1);
    assert.deepEqual(player.messages, [
        'Trufitus looks at you in amazement...',
        'The apparition fades into nothingness.',
        'A shard of bone appears on the ground in front of you.',
        'You take the bone shard and place it into your inventory.'
    ]);
    assert.equal(npc.said.at(-1), 'Wait...I hear a voice....');
});

test('shilo village 8: Zadimus speaks the key line', async () => {
    const world = fakeWorld();
    const { player, npc } = setup({
        world,
        quests: { shiloVillage: 8 },
        cache: { rashiliya_corpse: true },
        answers: [1]
    });
    const spawn = world.spawnTimedNPC;
    let zadimus;
    world.spawnTimedNPC = (opts) => {
        zadimus = spawn(opts);
        return zadimus;
    };
    await trufitusAfterQuest(player, npc);
    assert.equal(zadimus.id, ZADIMUS_ID);
    assert.equal(zadimus.said.at(-1), "Remember, 'I am the key, but only kin may approach her.'");
});

test('shilo village 8: already holding a bone shard gets no second one', async () => {
    const { player, npc } = setup({
        quests: { shiloVillage: 8 },
        cache: { rashiliya_corpse: true },
        items: [BONE_SHARD_ID],
        answers: [1]
    });
    await trufitusAfterQuest(player, npc);
    assert.equal(player.inventory.count(BONE_SHARD_ID), 1);
    assert.ok(!player.messages.includes('A shard of bone appears on the ground in front of you.'));
});

test('shilo village 8: with Zadimus already nearby nothing is spawned and no shard is given', async () => {
    const zadimus = fakeNpc(ZADIMUS_ID);
    const world = fakeWorld({ npcs: [zadimus] });
    const { player, npc } = setup({
        world,
        quests: { shiloVillage: 8 },
        cache: { rashiliya_corpse: true },
        answers: [0, 0]
    });
    await trufitusAfterQuest(player, npc);
    assert.equal(world.npcList.length, 1);
    assert.equal(zadimus.said.length, 0);
    assert.ok(!player.inventory.has(BONE_SHARD_ID));
});

test('shilo village 8: a locked Zadimus does not count as nearby', async () => {
    const zadimus = fakeNpc(ZADIMUS_ID);
    zadimus.locked = true;
    const world = fakeWorld({ npcs: [zadimus] });
    const { player, npc } = setup({
        world,
        quests: { shiloVillage: 8 },
        cache: { rashiliya_corpse: true },
        answers: [1]
    });
    await trufitusAfterQuest(player, npc);
    assert.ok(player.inventory.has(BONE_SHARD_ID));
});

test('shilo village 8: found nothing', async () => {
    const { player, npc } = setup({
        quests: { shiloVillage: 8 },
        cache: { rashiliya_corpse: true },
        answers: [2]
    });
    await trufitusAfterQuest(player, npc);
    assert.deepEqual(npc.said.slice(-2), [
        'You really should try to find the tomb.',
        'It is our only chance if we hope to defeat Rashiliyia!'
    ]);
});

test('shilo village 8: all three dolmen keys take the early return', async () => {
    const { player, npc } = setup({
        quests: { shiloVillage: 8 },
        cache: { dolmen_zombie: 1, dolmen_skeleton: 1, dolmen_ghost: 1, rashiliya_corpse: true },
        answers: [0]
    });
    await trufitusAfterQuest(player, npc);
    assert.deepEqual(player.messages, ['Trufitus scratches his head.']);
    assert.equal(npc.said.at(-1), 'you will need to find them.');
});

test('shilo village 8: nothing cached gives the plain tomb dialogue', async () => {
    const { player, npc } = setup({ quests: { shiloVillage: 8 }, answers: [1, 0] });
    await trufitusAfterQuest(player, npc);
    assert.deepEqual(player.said, ['Hello again..', "Yes, I've found Rashiliyia's Tomb!", 'Yes, In fact I did!']);
    assert.equal(npc.said.at(-1), 'please show them to me.');
});

test('show me items: no plaque and no shilo info', async () => {
    const { player, npc } = setup({ quests: { shiloVillage: 3 }, answers: [0] });
    await trufitusAfterQuest(player, npc);
    assert.deepEqual(npc.said.slice(-7), [
        "Well, just let me see the item and I'll help as much as I can.",
        'Look for something that can identify the place.',
        'Leave no stone unturned.',
        'Look for details of Rashiliyias Kin, these may be well hidden.',
        'There is a legend about Rashiliyia, look for it in the temple.',
        'Look for something relating to Zadimus at the temple.',
        'And best of luck!'
    ]);
});

test('show me items: a carried stone plaque and obtained_shilo_info', async () => {
    const { player, npc } = setup({
        quests: { shiloVillage: 3 },
        items: [STONE_PLAQUE_ID],
        cache: { obtained_shilo_info: 1 },
        answers: [0]
    });
    await trufitusAfterQuest(player, npc);
    assert.ok(npc.said.includes('We need to identify that the place you have found'));
    assert.ok(npc.said.includes('is indeed Ah Za Rhoon.'));
    assert.ok(!npc.said.includes('Leave no stone unturned.'));
    assert.ok(npc.said.includes('Any scrolls or information about Rashiliyias Kin would be helpful'));
    assert.ok(!npc.said.includes('Look for details of Rashiliyias Kin, these may be well hidden.'));
});

test('show me items: a banked stone plaque counts', async () => {
    const { player, npc } = setup({ quests: { shiloVillage: 3 }, banked: [STONE_PLAQUE_ID], answers: [0] });
    await trufitusAfterQuest(player, npc);
    assert.ok(npc.said.includes('is indeed Ah Za Rhoon.'));
    assert.ok(npc.said.includes('Look for details of Rashiliyias Kin, these may be well hidden.'));
});

test('show me items from stage 6 opens the help menu (options map one topic along, sic)', async () => {
    // read_tomb_notes unset: option 1 "items" -> showMeItems(0) at stage 6 -> menu: option 0 -> Bervirius -> thanks
    const { player, npc } = setup({ quests: { shiloVillage: 6 }, answers: [1, 0, 4] });
    await trufitusAfterQuest(player, npc);
    assert.equal(player.asked[1][0], 'I need help with Zadimus.');
    assert.ok(npc.said.includes('Bervirius is the Son of Rashiliyia.'));
    assert.equal(npc.said.at(-1), "You're quite welcome Bwana.");
    // the stage-6 menu never reaches the plaque lines
    assert.ok(!npc.said.includes('Leave no stone unturned.'));
});

test('stage 6 with read_tomb_notes: no tomb found then "nothing in the tomb" uses the second show-me path', async () => {
    const { player, npc } = setup({
        quests: { shiloVillage: 6 },
        cache: { read_tomb_notes: 1 },
        answers: [1, 2, 0, 3]
    });
    await trufitusAfterQuest(player, npc);
    assert.ok(npc.said.includes("Well, just show me the items and I'll help as much as I can."));
    assert.equal(npc.said.at(-1), "You're quite welcome Bwana.");
});

test('stage 7: looking for the tomb', async () => {
    const { player, npc } = setup({ quests: { shiloVillage: 7 }, answers: [0, 1] });
    await trufitusAfterQuest(player, npc);
    assert.equal(npc.said.at(-1), 'Any scrap of information might be useful.');
});

test('help topics loop through each other until the farewell', async () => {
    // stage 7 "something else" -> Rashiliyia (say) -> Rash text -> Zadimus -> sacred ground
    const { player, npc } = setup({ quests: { shiloVillage: 7 }, answers: [2, 0, 0, 0] });
    await trufitusAfterQuest(player, npc);
    assert.ok(player.said.includes('I need help with Rashliyia.'));
    assert.ok(player.said.includes('I need help with Zadimus.'));
    assert.equal(npc.said.at(-1), 'Maybe you could try there ?');
});

test('resting place: the onions joke runs through the messages', async () => {
    // stage 2: Rashiliyia -> evacuate -> pack -> resting place -> onions -> thanks
    const { player, npc } = setup({ quests: { shiloVillage: 2 }, answers: [1, 1, 1, 0, 1, 0] });
    await trufitusAfterQuest(player, npc);
    assert.deepEqual(player.messages.slice(0, 2), [
        'Trufitus looks at you blankly',
        'Trufitus frowns at you but continues about...minions...'
    ]);
    assert.ok(player.said.includes('Yes of course, I mean Minions, what made you think I said Onions?'));
    assert.equal(npc.said.at(-1), 'Hmmm, well, you are welcome bwana.');
});
