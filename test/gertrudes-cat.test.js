// Gertrude's Cat (quests/members/gertrudes-cat.js, port of Open-RSC GertrudesCat.java): every stage driven with fake
// player and world objects, from Gertrude's plea to the kitten.

const test = require('node:test');
const assert = require('node:assert/strict');

const { makePlayer, fakeNpc, wallObject, groundItem, addObject } = require('./quest-port-fakes');
const cat = require('../src/plugins/quests/members/gertrudes-cat');

const GERTRUDE = 714;
const SHILOP = 715;
const WILOUGH = 781;
const KANEL = 783;
const COINS = 10;
const MILK = 22;
const RAW_SARDINE = 354;
const FLUFFS = 1093;
const SEASONED_SARDINE = 1094;
const KITTENS = 1095;
const KITTEN = 1096;
const DOOGLE_LEAVES = 1100;

function inv(player, id) {
    return player.inventory.count(id);
}

test('Gertrude asks for help (stage 0 -> 1), also after "what\'s in it for me"', async () => {
    const player = makePlayer({ answers: [0] });
    assert.equal(await cat.onTalkToNPC(player, fakeNpc(GERTRUDE)), true);
    assert.equal(player.questStages.gertrudesCat, 1);
    assert.ok(player.said.includes('well, i suppose i could'));

    const haggler = makePlayer({ answers: [1, 0] });
    await cat.onTalkToNPC(haggler, fakeNpc(GERTRUDE));
    assert.equal(haggler.questStages.gertrudesCat, 1);

    const busy = makePlayer({ answers: [2] });
    const npc = fakeNpc(GERTRUDE);
    await cat.onTalkToNPC(busy, npc);
    assert.equal(busy.questStages.gertrudesCat, undefined);
    assert.ok(npc.lines.includes(" well, ok then, i'll have to find someone else"));
});

test('Shilop and Wilough want 100 coins for the play area (stage 1 -> 2)', async () => {
    const poor = makePlayer({ stages: { gertrudesCat: 1 }, answers: [1, 1] });
    const shilop = fakeNpc(SHILOP);
    await cat.onTalkToNPC(poor, shilop);
    assert.equal(poor.questStages.gertrudesCat, 1);
    assert.ok(poor.said.includes("but i'll have to get some money first"));

    const player = makePlayer({ stages: { gertrudesCat: 1 }, answers: [1, 1], items: [[COINS, 150]] });
    const wilough = fakeNpc(WILOUGH);
    await cat.onTalkToNPC(player, wilough);
    assert.equal(player.questStages.gertrudesCat, 2);
    assert.equal(inv(player, COINS), 50);
    assert.ok(wilough.lines.includes('i play at an abandoned lumber mill to the north..'));

    const threat = makePlayer({ stages: { gertrudesCat: 1 }, answers: [0] });
    await cat.onTalkToNPC(threat, fakeNpc(SHILOP));
    assert.equal(threat.questStages.gertrudesCat, 1);
    assert.ok(threat.messages.includes("@que@you decide it's best not to hurt the boy"));
});

test('the boys play: Kanel says nothing', async () => {
    const player = makePlayer();
    assert.equal(await cat.onTalkToNPC(player, fakeNpc(KANEL, { unlock() {} })), true);
    assert.deepEqual(player.messages, ["The boy's busy playing"]);
    assert.equal(await cat.onTalkToNPC(player, fakeNpc(1)), false);
});

test('the lumber mill fence: a crack once Shilop told you', async () => {
    const fence = wallObject({ id: 199, x: 51, y: 438, direction: 1 });
    const early = makePlayer({ stages: { gertrudesCat: 1 }, x: 52, y: 438 });
    assert.equal(await cat.onWallObjectCommandOne(early, fence), true);
    assert.equal(early.teleported, null);
    assert.ok(early.messages.includes("but can't see a way through"));

    const outside = makePlayer({ stages: { gertrudesCat: 2 }, x: 51, y: 438 });
    await cat.onWallObjectCommandOne(outside, fence);
    assert.deepEqual(outside.teleported.slice(0, 2), [50, 438]);

    const inside = makePlayer({ stages: { gertrudesCat: -1 }, x: 50, y: 438 });
    await cat.onWallObjectCommandOne(inside, fence);
    assert.deepEqual(inside.teleported.slice(0, 2), [51, 438]);

    assert.equal(await cat.onWallObjectCommandOne(inside, wallObject({ id: 199, x: 51, y: 500 })), false);
});

test('Fluffs: milk, then the seasoned sardine, then the kittens from the crate (stage 2 -> 3)', async () => {
    const player = makePlayer({ stages: { gertrudesCat: 2 }, items: [MILK, RAW_SARDINE, DOOGLE_LEAVES] });
    const fluffs = groundItem(player.world, { id: FLUFFS, x: 58, y: 2327, respawn: 30000 });
    const crate = addObject(player.world, { id: 1040, x: 64, y: 445 });

    // she will not leave: the hints
    assert.equal(await cat.onGroundItemTake(player, fluffs), true);
    assert.ok(player.damaged >= 1 && player.damaged <= 2);
    assert.ok(player.messages.includes('the cats seems to be thirsty'));

    // the sardine is no good before the milk
    await cat.onUseWithInventory(player, { id: RAW_SARDINE }, { id: DOOGLE_LEAVES });
    assert.equal(inv(player, SEASONED_SARDINE), 1);
    await cat.onUseWithGroundItem(player, fluffs, { id: SEASONED_SARDINE });
    assert.equal(inv(player, SEASONED_SARDINE), 1);
    assert.equal(player.cache.cat_sardine, undefined);

    await cat.onUseWithGroundItem(player, fluffs, { id: MILK });
    assert.equal(player.cache.cat_milk, true);
    assert.equal(inv(player, MILK), 0);

    // the crate is empty until she has eaten
    await cat.onGameObjectCommandOne(player, crate);
    assert.equal(inv(player, KITTENS), 0);
    assert.ok(player.messages.includes('@que@you find nothing...'));

    await cat.onUseWithGroundItem(player, fluffs, { id: SEASONED_SARDINE });
    assert.equal(player.cache.cat_sardine, true);

    // another crate and a barrel only purr
    player.messages.length = 0;
    await cat.onGameObjectCommandOne(player, { id: 1041 });
    assert.ok(player.messages.includes("@que@...you hear a cat's purring close by"));

    await cat.onGameObjectCommandOne(player, crate);
    assert.equal(inv(player, KITTENS), 1);

    // dropped kittens run back to the crate
    assert.equal(await cat.onDropItem(player, { id: KITTENS }), true);
    assert.equal(inv(player, KITTENS), 0);
    await cat.onGameObjectCommandOne(player, crate);
    assert.equal(inv(player, KITTENS), 1);

    await cat.onUseWithGroundItem(player, fluffs, { id: KITTENS });
    assert.equal(player.questStages.gertrudesCat, 3);
    assert.equal(inv(player, KITTENS), 0);
    assert.equal(player.cache.cat_milk, undefined);
    assert.equal(player.cache.cat_sardine, undefined);
    assert.equal(player.world.groundItems.getByIndex(fluffs.index), null);
});

test('outside stage 2 Fluffs wants nothing', async () => {
    const player = makePlayer({ stages: { gertrudesCat: 1 }, items: [MILK] });
    const fluffs = groundItem(player.world, { id: FLUFFS, x: 58, y: 2327 });
    await cat.onUseWithGroundItem(player, fluffs, { id: MILK });
    assert.deepEqual(player.messages, ["the cat doesn't seem to be thirsty"]);
    assert.equal(inv(player, MILK), 1);
    assert.equal(await cat.onUseWithGroundItem(player, fluffs, { id: COINS }), false);
});

test('Gertrude gives the kitten, cake and stew and the reward (stage 3 -> -1)', async () => {
    const player = makePlayer({ stages: { gertrudesCat: 3 } });
    player.skills.cooking.base = 20;
    await cat.onTalkToNPC(player, fakeNpc(GERTRUDE));

    assert.equal(player.questStages.gertrudesCat, -1);
    assert.equal(inv(player, KITTEN), 1);
    assert.equal(inv(player, 332), 1);
    assert.equal(inv(player, 346), 1);
    assert.equal(player.questPoints, 1);
    // 700 + 180 per cooking level, in quarter points
    assert.equal(player.skills.cooking.experience, 700 + 20 * 180);
    assert.equal(player.messages.at(-1), 'well done, you have completed gertrudes cat quest');
});

test('after the quest Gertrude sells another kitten for 100 coins', async () => {
    const player = makePlayer({ stages: { gertrudesCat: -1 }, answers: [0], items: [[COINS, 100]] });
    await cat.onTalkToNPC(player, fakeNpc(GERTRUDE));
    assert.equal(inv(player, KITTEN), 1);
    assert.equal(inv(player, COINS), 0);

    const keeper = makePlayer({ stages: { gertrudesCat: -1 }, items: [KITTEN] });
    await cat.onTalkToNPC(keeper, fakeNpc(GERTRUDE));
    assert.ok(keeper.said.includes('pretty good thanks, yourself?'));
});
