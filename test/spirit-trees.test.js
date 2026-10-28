// Spirit trees (390, 391, 661): game-objects/spirit-trees.js, driven by fake player and world objects.

const test = require('node:test');
const assert = require('node:assert/strict');

const objects = require('@2003scape/rsc-data/config/objects.json');
const trees = require('../src/plugins/game-objects/spirit-trees');

function fakePlayer({ quests = {}, answers = [], plague = 0 } = {}) {
    const player = {
        messages: [],
        asked: [],
        teleported: null,
        removed: [],
        questStages: quests,
        world: { sleepTicks: async () => {} },
        inventory: {
            has: (id) => id === 812 && player.plague > 0,
            count: (id) => (id === 812 ? player.plague : 0),
            remove: (id, n) => player.removed.push([id, n])
        },
        plague,
        message: (m) => player.messages.push(m),
        ask: async (options) => {
            player.asked.push(options);
            return answers.shift();
        },
        teleport: (x, y) => {
            player.teleported = [x, y];
        }
    };

    return player;
}

test('the data: 390 / 391 / 661 are the spirit trees you talk to', () => {
    for (const id of [390, 391, 661]) {
        assert.match(objects[id].name, /spirit tree/i);
        assert.match(objects[id].commands[0], /talk to/i);
    }
});

test('a stranger to the gnomes gets no answer from any of them', async () => {
    for (const id of [390, 391, 661]) {
        const player = fakePlayer();

        assert.equal(await trees.onGameObjectCommandOne(player, { id }), true);
        assert.deepEqual(player.messages, ["the tree doesn't feel like talking"]);
        assert.equal(player.teleported, null);
    }
});

test('the stronghold tree needs the Grand Tree and the village tree Tree Gnome Village', async () => {
    const wrongQuest = fakePlayer({ quests: { treeGnomeVillage: -1 } });

    await trees.onGameObjectCommandOne(wrongQuest, { id: 661 });
    assert.equal(wrongQuest.teleported, null);

    const rightQuest = fakePlayer({ quests: { grandTree: -1 }, answers: [1, 2] });

    await trees.onGameObjectCommandOne(rightQuest, { id: 661 });
    assert.deepEqual(rightQuest.asked[1], ['Battlefield of Khazard', 'Forest north of Varrock', 'the gnome tree village']);
    assert.deepEqual(rightQuest.teleported, [656, 694]);

    const village = fakePlayer({ quests: { treeGnomeVillage: -1 }, answers: [1, 2] });

    await trees.onGameObjectCommandOne(village, { id: 390 });
    assert.deepEqual(village.asked[1], ['Battlefield of Khazard', 'Forest north of Varrock', 'the gnome stronghold']);
    assert.deepEqual(village.teleported, [703, 487]);
});

test('the big trees send you to the Khazard battlefield and the forest north of Varrock', async () => {
    const khazard = fakePlayer({ quests: { grandTree: -1 }, answers: [1, 0] });
    const forest = fakePlayer({ quests: { grandTree: -1 }, answers: [1, 1] });

    await trees.onGameObjectCommandOne(khazard, { id: 661 });
    await trees.onGameObjectCommandOne(forest, { id: 661 });
    assert.deepEqual(khazard.teleported, [629, 629]);
    assert.deepEqual(forest.teleported, [161, 453]);
});

test('"No thanks old tree" leaves you where you are', async () => {
    const player = fakePlayer({ quests: { grandTree: -1 }, answers: [0] });

    await trees.onGameObjectCommandOne(player, { id: 661 });
    assert.equal(player.teleported, null);
    assert.equal(player.asked.length, 1);
});

test('a young spirit tree takes a Tree Gnome Village finisher to the village on a yes', async () => {
    const yes = fakePlayer({ quests: { treeGnomeVillage: -1 }, answers: [1] });
    const no = fakePlayer({ quests: { treeGnomeVillage: -1 }, answers: [0] });

    await trees.onGameObjectCommandOne(yes, { id: 391 });
    await trees.onGameObjectCommandOne(no, { id: 391 });
    assert.deepEqual(yes.teleported, [658, 695]);
    assert.equal(no.teleported, null);
});

test('the crossing destroys a plague sample', async () => {
    const player = fakePlayer({ quests: { treeGnomeVillage: -1 }, answers: [1], plague: 2 });

    await trees.onGameObjectCommandOne(player, { id: 391 });
    assert.deepEqual(player.removed, [[812, 2]]);
    assert.ok(player.messages.includes('it disintegrates in the crossing'));
});

test('other objects are left to other plugins', async () => {
    for (const id of [0, 392, 660, 662]) {
        assert.equal(await trees.onGameObjectCommandOne(fakePlayer(), { id }), false, `object ${id}`);
    }
});
