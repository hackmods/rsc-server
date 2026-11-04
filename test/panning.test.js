// Panning for gold (game-objects/panning.js, Open-RSC misc/Panning.java), driven by fake player, world, guide and
// panning point objects.

const test = require('node:test');
const assert = require('node:assert/strict');

const items = require('@2003scape/rsc-data/config/items.json');
const objects = require('@2003scape/rsc-data/config/objects.json');
const npcs = require('@2003scape/rsc-data/config/npcs.json');
const panning = require('../src/plugins/game-objects/panning');

const POINT = { id: 1058, x: 9, y: 550 };

function fakePlayer({ bag = [], guide = true, unlocked = false, answers = [] } = {}) {
    const log = { messages: [], said: [], guideSaid: [], experience: [] };
    const guideNpc = guide ? { id: 726, say: async (...l) => log.guideSaid.push(...l) } : undefined;
    const player = {
        bag: [...bag],
        cache: unlocked ? { unlocked_panning: true } : {},
        world: { sleepTicks: async () => {} },
        inventory: {
            add: (id, amount = 1) => player.bag.push(amount === 1 ? id : [id, amount]),
            has: (id) => player.bag.includes(id),
            remove: (id) => {
                const i = player.bag.lastIndexOf(id);
                if (i >= 0) player.bag.splice(i, 1);
            }
        },
        message: (...m) => log.messages.push(...m),
        say: async (...l) => log.said.push(...l),
        ask: async (options) => {
            const choice = answers.length ? answers.shift() : 0;
            log.said.push(options[choice]);
            return choice;
        },
        engage: () => {},
        disengage: () => {},
        sendBubble: () => {},
        sendSound: () => {},
        addExperience: (skill, xp) => log.experience.push([skill, xp]),
        getNearestEntityByID: (type, id) => (type === 'npcs' && id === 726 ? guideNpc : undefined)
    };
    return { player, log, guideNpc };
}

test('the data: panning point 1058, guide 726, the three trays and the finds', () => {
    assert.equal(objects[1058].name, 'panning point');
    assert.equal(npcs[726].name, 'Guide');
    assert.equal(items[1111].command, 'search');
    assert.equal(items[1113].command, 'search');
    assert.equal(items[1112].command, 'take gold');
    assert.equal(items[1118].name, 'gold Nuggets');
    assert.equal(items[739].name, 'Cup of tea');
});

test('looking at the panning point', async () => {
    const { player, log } = fakePlayer();
    assert.equal(await panning.onGameObjectCommandOne(player, POINT), true);
    assert.deepEqual(log.messages, ['If I had a panning tray I could pan here']);
    assert.equal(await panning.onGameObjectCommandOne(player, { id: 1057 }), false);
});

test('without the tea the guide turns you away, and tells you about the tea', async () => {
    const { player, log } = fakePlayer({ bag: [1111], answers: [1] });
    assert.equal(await panning.onUseWithGameObject(player, POINT, { id: 1111 }), true);
    assert.deepEqual(player.bag, [1111]);
    assert.equal(log.guideSaid[0], "Hey! you can't pan yet!");
    assert.ok(log.guideSaid.includes('Is a nice cup of tea !'));
});

test('a cup of tea for the guide unlocks panning, once', async () => {
    const { player, log, guideNpc } = fakePlayer({ bag: [739, 739] });
    assert.equal(await panning.onUseWithNPC(player, guideNpc, { id: 739 }), true);
    assert.equal(player.cache.unlocked_panning, true);
    assert.deepEqual(player.bag, [739]);
    assert.deepEqual(log.guideSaid, ['Ah! Lovely!', "You can't beat a good cuppa...", "You're free to pan all you want"]);

    await panning.onUseWithNPC(player, guideNpc, { id: 739 });
    assert.deepEqual(player.bag, [739], 'the second cup is kept');
    assert.equal(log.guideSaid.at(-1), "No thanks, I've had enough!");
});

test('panning fills the tray and gives 20 mining experience', async () => {
    const { player, log } = fakePlayer({ bag: [1111], unlocked: true });
    await panning.onUseWithGameObject(player, POINT, { id: 1111 });
    assert.deepEqual(player.bag, [1113]);
    assert.deepEqual(log.experience, [['mining', 20]]);
    assert.ok(log.messages.includes('@que@You lift the full tray from the water'));
});

test('no guide in sight: the Java does nothing', async () => {
    const { player, log } = fakePlayer({ bag: [1111], guide: false, unlocked: true });
    assert.equal(await panning.onUseWithGameObject(player, POINT, { id: 1111 }), true);
    assert.deepEqual(player.bag, [1111]);
    assert.deepEqual(log.messages, []);
});

test('a full tray on the water already contains something', async () => {
    const { player, log } = fakePlayer({ bag: [1113], unlocked: true });
    await panning.onUseWithGameObject(player, POINT, { id: 1113 });
    assert.deepEqual(log.messages, ['@que@This panning tray already contains something']);
    assert.deepEqual(player.bag, [1113]);
});

test('the tray odds: 40 of 101 mud, then opal, jade, coins, rock sample, gold, sapphire by tens', () => {
    const at = (roll) => panning.rollTray(roll);
    assert.equal(at(0), null);
    assert.equal(at(39), null);
    assert.equal(at(40).id, 891);
    assert.equal(at(55).id, 890);
    assert.ok([1, 2, 5, 10].includes(at(65).amount) && at(65).id === 10);
    assert.equal(at(75).id, 1148);
    assert.equal(at(85).id, 1118);
    assert.equal(at(100).id, 160);
});

test('searching a full tray empties it and gives the find', async (t) => {
    const { player, log } = fakePlayer({ bag: [1113] });
    t.mock.method(Math, 'random', () => 85 / 101); // random(0, 100) = 85: gold nuggets
    assert.equal(await panning.onInventoryCommand(player, { id: 1113 }), true);
    assert.deepEqual(player.bag, [1111, 1118]);
    assert.ok(log.messages.includes('@que@You find some gold nuggets within the mud!'));
});

test('searching a full tray of plain mud', async (t) => {
    const { player, log } = fakePlayer({ bag: [1113] });
    t.mock.method(Math, 'random', () => 0);
    await panning.onInventoryCommand(player, { id: 1113 });
    assert.deepEqual(player.bag, [1111]);
    assert.ok(log.messages.includes('@que@The tray contains only plain mud'));
});

test('taking the gold from a gold tray; searching an empty tray', async () => {
    const { player, log } = fakePlayer({ bag: [1112] });
    await panning.onInventoryCommand(player, { id: 1112 });
    assert.deepEqual(player.bag, [1111, 1118]);

    await panning.onInventoryCommand(player, { id: 1111 });
    assert.deepEqual(log.said, ['Err, why am I searching an empty tray ?']);
    assert.equal(await panning.onInventoryCommand(player, { id: 1114 }), false);
});
