// Pirate's Treasure: digging the flower bed with a spade (quests/free/pirates-treasure/flower.js) at stage 3 finds the
// treasure. The guard used to be `stage !== 3 || stage !== 4`, always true, so nothing ever happened.

const test = require('node:test');
const assert = require('node:assert/strict');

const flower = require('../src/plugins/quests/free/pirates-treasure/flower');

function fakePlayer(stage) {
    const added = [];
    return {
        added,
        questStages: { piratesTreasure: stage },
        cache: { deliveredRum: true },
        world: { npcs: { getByID: () => null }, async sleepTicks() {} },
        localEntities: { known: { npcs: new Set() } },
        inventory: { add: (id) => added.push(id), remove() {} },
        message() {},
        addQuestPoints() {},
        addExperience() {},
        sendQuestList() {},
        sendStats() {}
    };
}

test('digging the flower bed at stage 3 finds the treasure', async () => {
    const player = fakePlayer(3);
    assert.equal(await flower.onUseWithGameObject(player, { id: 188 }, { id: 211 }), true);
    assert.ok(player.added.includes(283));
    assert.equal(player.questStages.piratesTreasure, -1);
});

test('digging before stage 3 does nothing', async () => {
    const player = fakePlayer(2);
    assert.equal(await flower.onUseWithGameObject(player, { id: 188 }, { id: 211 }), false);
});
