// Lost City (quests/members/lost-city.js, port of LostCity.java): every stage driven with fake objects. The Dramen
// tree chop and the tree spirit's arrival are skills/woodcutting.js (test/woodcut-jungle.test.js).

const test = require('node:test');
const assert = require('node:assert/strict');

const lostCity = require('../src/plugins/quests/members/lost-city');
const woodcutting = require('../src/plugins/skills/woodcutting');
const { fakeNpc, fakeWorld, fakePlayer, gameObject, wallObject } = require('./quest-fakes');

const ADVENTURER = 209;
const LEPRECHAUN = 211;
const MONK = 213;
const TREE_SPIRIT = 216;
const KNIFE = 13;
const STAFF = 509;
const BRANCH = 510;
const RUNE_AXE = 405;

function player(opts = {}) {
    return fakePlayer({ quest: 'lostCity', ...opts });
}

test('stage 0: the adventurers let slip about the leprechaun (stage 1), by either road', async () => {
    // "What are you camped out here for?" -> "Who's Zanaris?" -> "If it's hidden..." -> "looks like you don't know..."
    const p = player({ answers: [0, 0, 0, 1] });
    const adventurer = fakeNpc(ADVENTURER);
    assert.equal(await lostCity.onTalkToNPC(p, adventurer), true);
    assert.equal(p.questStages.lostCity, 1);
    assert.ok(adventurer.said.includes("We haven't worked out which tree the stupid leprechaun is in yet"));

    // "Do you know any good adventures..." -> "I don't think you've found..." -> "What makes you think..." -> "There's no such thing"
    const q = player({ answers: [1, 1, 2, 1] });
    await lostCity.onTalkToNPC(q, fakeNpc(207));
    assert.equal(q.questStages.lostCity, 1);

    // "what's Zanaris?" keeps the secret
    const r = player({ answers: [0, 1, 0] });
    await lostCity.onTalkToNPC(r, fakeNpc(208));
    assert.equal(r.questStages.lostCity, 0);
});

test('stage 1: the tree shakes out the leprechaun, who names the shed and the staff (stage 2)', async () => {
    const tree = gameObject(237, 172, 662);
    const before = player({ stage: 0 });
    await lostCity.onGameObjectCommandOne(before, tree);
    assert.deepEqual(before.messages, ['There is nothing in this tree']);
    assert.equal(before.world.spawned.length, 0);

    const p = player({ stage: 1, answers: [0] });
    assert.equal(await lostCity.onGameObjectCommandOne(p, tree), true);
    assert.deepEqual(p.messages, ['A Leprechaun jumps down from the tree and runs off']);
    assert.deepEqual(p.world.spawned.map((s) => [s.id, s.x, s.y]), [[LEPRECHAUN, 172, 661]]);

    // only one at a time
    await lostCity.onGameObjectCommandOne(p, tree);
    assert.equal(p.messages.at(-1), 'There is nothing in this tree');

    const leprechaun = p.world.npcList.find((n) => n.id === LEPRECHAUN);
    await lostCity.onTalkToNPC(p, leprechaun);
    assert.equal(p.questStages.lostCity, 2);
    assert.ok(leprechaun.said.includes('You need to be carrying a Dramenwood staff'));
    assert.ok(p.world.removed.includes(leprechaun));
});

test('the Entrana ladder: the monk warns, and only "a risk I will have to take" climbs down (prayer drained)', async () => {
    const ladder = gameObject(244, 426, 548);
    const world = fakeWorld({ npcs: [fakeNpc(MONK, { x: 427, y: 547 })] });
    const p = player({ world, stage: 2, answers: [0] });
    assert.equal(await lostCity.onGameObjectCommandOne(p, ladder), true);
    assert.deepEqual(p.climbs, []);

    const q = player({ world, stage: 2, answers: [1], levels: { prayer: 43 } });
    await lostCity.onGameObjectCommandOne(q, ladder);
    assert.deepEqual(q.climbs, [[244, false]]);
    assert.equal(q.skills.prayer.current, 3);

    const r = player({ world, answers: [1], levels: { prayer: 20 } });
    await lostCity.onGameObjectCommandOne(r, ladder);
    assert.equal(r.skills.prayer.current, 2);
});

test('stages 2-4: chopping brings the spirit (3), killing it (4), then a branch and a carved staff', async () => {
    const tree = gameObject(245, 412, 3402);
    const p = player({ stage: 2, items: [RUNE_AXE, KNIFE], levels: { woodcutting: 40, crafting: 31 } });
    p.isTired = () => false;
    p.sendBubble = () => {};

    await woodcutting.onGameObjectCommandOne(p, tree);
    assert.equal(p.questStages.lostCity, 3);
    const spirit = p.world.spawned.find((s) => s.id === TREE_SPIRIT);
    assert.ok(spirit);

    // the spirit only fights a player at stage 3
    assert.equal(await lostCity.onNPCAttack(p, fakeNpc(TREE_SPIRIT)), false);
    assert.equal(await lostCity.onNPCAttack(player({ stage: 2 }), fakeNpc(TREE_SPIRIT)), true);
    assert.equal(await lostCity.onNPCAttack(player({ stage: -1 }), fakeNpc(TREE_SPIRIT)), true);

    assert.equal(await lostCity.onNPCDeath(p, fakeNpc(TREE_SPIRIT)), false);
    assert.equal(p.questStages.lostCity, 4);

    await woodcutting.onGameObjectCommandOne(p, tree);
    assert.ok(p.inventory.has(BRANCH));

    assert.equal(await lostCity.onUseWithInventory(p, { id: KNIFE }, { id: BRANCH }), true);
    assert.ok(p.inventory.has(STAFF));
    assert.equal(p.inventory.has(BRANCH), false);
    assert.ok(p.messages.includes('@que@you carve the branch into a staff'));
});

test('carving the staff needs crafting 31', async () => {
    const p = player({ stage: 4, items: [KNIFE, BRANCH], levels: { crafting: 30 } });
    assert.equal(await lostCity.onUseWithInventory(p, { id: BRANCH }, { id: KNIFE }), true);
    assert.ok(p.inventory.has(BRANCH));
    assert.equal(p.messages.at(-1), '@que@You need a crafting level of 31');
    assert.equal(await lostCity.onUseWithInventory(p, { id: KNIFE }, { id: 14 }), false);
});

test('the shed door: with the staff wielded at stage 4 it opens on Zanaris and ends the quest; otherwise a shed', async () => {
    const door = wallObject(66, 126, 686, 1);

    const shed = player({ stage: 4, items: [STAFF] });
    await lostCity.onWallObjectCommandOne(shed, door);
    assert.deepEqual(shed.doors, [[66, undefined]]);
    assert.equal(shed.messages.at(-1), 'you go through the door and find yourself in a shed.');

    const p = player({ stage: 4, items: [STAFF], equipped: [STAFF] });
    assert.equal(await lostCity.onWallObjectCommandOne(p, door), true);
    assert.deepEqual(p.teleports, [[126, 3518]]);
    const [key, reward] = p.completed[0];
    assert.equal(key, 'lostCity');
    assert.equal(reward.questPoints, 3);
    assert.equal(reward.message, 'Well done you have completed the Lost City of Zanaris quest');

    // done: Zanaris again, no second reward
    const again = player({ stage: -1, items: [STAFF], equipped: [STAFF] });
    await lostCity.onWallObjectCommandOne(again, door);
    assert.deepEqual(again.teleports, [[126, 3518]]);
    assert.equal(again.completed.length, 0);
});

test('the magic door leads deep into the wilderness', async () => {
    const p = player({ stage: 3 });
    assert.equal(await lostCity.onWallObjectCommandOne(p, wallObject(65, 406, 3392, 1)), true);
    assert.deepEqual(p.teleports, [[109, 245]]);
    assert.equal(p.messages.at(-1), 'you go through the door and find yourself somewhere else');
});

test('the leprechaun after stage 2 repeats the way, and the adventurers ask what you found', async () => {
    const p = player({ stage: 4, answers: [1] });
    const leprechaun = fakeNpc(LEPRECHAUN);
    await lostCity.onTalkToNPC(p, leprechaun);
    assert.ok(leprechaun.said.includes('While holding a dramenwood staff'));

    const q = player({ stage: -1 });
    await lostCity.onTalkToNPC(q, fakeNpc(ADVENTURER));
    assert.ok(q.said.includes('I think I will keep that to myself'));
});
