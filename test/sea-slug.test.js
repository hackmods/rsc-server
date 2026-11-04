// Sea Slug (quests/members/sea-slug.js, port of SeaSlug.java and InvAction.handleDrySticks): every stage driven with
// fake objects, from Caroline's request to the oyster pearls. The swamp paste and the dried sticks are made in
// items/item-on-item.js and skills/cooking/cooking.js (their own tests).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const seaSlug = require('../src/plugins/quests/members/sea-slug');
const climbable = require('../src/plugins/game-objects/climbable');
const { fakeNpc, fakePlayer, gameObject, wallObject } = require('./quest-fakes-3b');

const CAROLINE = 455;
const HOLGART_LAND = 456;
const HOLGART_PLATFORM = 457;
const HOLGART_ISLAND = 458;
const KENT = 459;
const BAILEY = 460;
const KENNITH = 461;

const SEASLUG = 769;
const UNLIT_TORCH = 773;
const LIT_TORCH = 774;
const DRY_STICKS = 777;
const PEARLS = 779;
const SWAMP_PASTE = 785;

const SHORE = { x: 516, y: 613 };
const PLATFORM = { x: 495, y: 618 };
const ISLAND = { x: 512, y: 639 };

const PLUGIN_TYPES = [
    .../const PLUGIN_TYPES = \[([\s\S]*?)\]/
        .exec(fs.readFileSync(require.resolve('../src/model/world.js'), 'utf8'))[1]
        .matchAll(/'(\w+)'/g)
].map((m) => m[1]);

function player(opts = {}) {
    return fakePlayer({ quest: 'seaSlug', ...opts });
}

test('every exported hook is a plugin type', () => {
    for (const name of Object.keys(seaSlug)) {
        assert.ok(PLUGIN_TYPES.includes(name), name);
    }
});

test('stage 0: Caroline asks after Kent and Kennith; "i suppose so" starts the quest (1)', async () => {
    const busy = player({ answers: [1] });
    const caroline = fakeNpc(CAROLINE);
    assert.equal(await seaSlug.onTalkToNPC(busy, caroline), true);
    assert.equal(busy.questStages.seaSlug, 0);
    assert.ok(caroline.said.includes('thats a shame'));
    assert.equal(busy.interlocutor, null);

    const p = player({ answers: [0] });
    const c = fakeNpc(CAROLINE);
    await seaSlug.onTalkToNPC(p, c);
    assert.equal(p.questStages.seaSlug, 1);
    assert.ok(c.said.includes('my friend holgart will take you there'));

    const later = player({ stage: 3 });
    await seaSlug.onTalkToNPC(later, fakeNpc(CAROLINE));
    assert.ok(later.said.includes("i'm working on it now caroline"));
});

test('stages 1-2: Holgart wants swamp paste (2), takes it (3) and rows out to the platform', async () => {
    const before = player({ ...SHORE });
    const h = fakeNpc(HOLGART_LAND);
    await seaSlug.onTalkToNPC(before, h);
    assert.equal(before.questStages.seaSlug, 0);
    assert.ok(h.said.includes('just smell that sea air... beautiful'));

    const p = player({ stage: 1, ...SHORE });
    await seaSlug.onTalkToNPC(p, fakeNpc(HOLGART_LAND));
    assert.equal(p.questStages.seaSlug, 2);

    // no paste: no change
    const empty = player({ stage: 2, ...SHORE });
    const h2 = fakeNpc(HOLGART_LAND);
    await seaSlug.onTalkToNPC(empty, h2);
    assert.equal(empty.questStages.seaSlug, 2);
    assert.ok(h2.said.includes("i can't fix the row boat without it"));

    // one of the stack goes; "i'll come back later" stays ashore
    const later = player({ stage: 2, items: [[SWAMP_PASTE, 2]], answers: [0], ...SHORE });
    await seaSlug.onTalkToNPC(later, fakeNpc(HOLGART_LAND));
    assert.equal(later.questStages.seaSlug, 3);
    assert.equal(later.inventory.count(SWAMP_PASTE), 1);
    assert.ok(later.messages.includes('you give holgart the swamp paste'));
    assert.deepEqual(later.teleports, []);

    const go = player({ stage: 2, items: [SWAMP_PASTE], answers: [1], ...SHORE });
    await seaSlug.onTalkToNPC(go, fakeNpc(HOLGART_LAND));
    assert.equal(go.questStages.seaSlug, 3);
    assert.deepEqual(go.teleports, [[495, 618]]);
    assert.ok(go.messages.includes('@que@you arrive at the fishing platform'));
});

test('the platform ladder: climbable.js steps aside; free climbing before stage 5 and after the quest', async () => {
    const ladder = gameObject(458, 494, 618);
    assert.equal(await climbable.onGameObjectCommandOne(player(), ladder), false);

    for (const stage of [3, 4, -1]) {
        const p = player({ stage, ...PLATFORM });
        assert.equal(await seaSlug.onGameObjectCommandOne(p, ladder), true);
        assert.deepEqual(p.teleports, [[494, 1561]]);
        assert.deepEqual(p.messages, ['@que@You climb up the ladder']);
    }
});

test('stage 3: Kennith upstairs tells of the fishermen (4); Bailey talks about the slugs', async () => {
    const p = player({ stage: 3, x: 485, y: 1560 });
    const k = fakeNpc(KENNITH);
    await seaSlug.onTalkToNPC(p, k);
    assert.equal(p.questStages.seaSlug, 4);
    assert.ok(k.said.includes('so he told me to hide in here'));

    await seaSlug.onTalkToNPC(p, fakeNpc(KENNITH));
    assert.ok(p.said.includes("i'm working on it"));

    const b = fakeNpc(BAILEY);
    const q = player({ stage: 3 });
    await seaSlug.onTalkToNPC(q, b);
    assert.ok(b.said.includes('if i put them near the stove they squirm and jump away'));

    // before stage 3 Kennith, Bailey and Kent say nothing (the Java still claims them)
    const early = player({ stage: 1 });
    assert.equal(await seaSlug.onTalkToNPC(early, fakeNpc(KENNITH)), true);
    assert.equal(await seaSlug.onTalkToNPC(early, fakeNpc(BAILEY)), true);
    assert.equal(await seaSlug.onTalkToNPC(early, fakeNpc(KENT)), true);
    assert.deepEqual(early.said, []);
});

test('stage 4: Holgart rows to the island, Kent pulls off a sea slug (5)', async () => {
    const p = player({ stage: 4, x: 493, y: 616 });
    await seaSlug.onTalkToNPC(p, fakeNpc(HOLGART_PLATFORM));
    assert.deepEqual(p.teleports, [[ISLAND.x, ISLAND.y]]);
    assert.ok(p.messages.includes('@que@you arrive on a small island'));

    const kent = fakeNpc(KENT);
    await seaSlug.onTalkToNPC(p, kent);
    assert.equal(p.questStages.seaSlug, 5);
    assert.ok(p.messages.includes('@que@he pulls a sea slug from under your top'));
    assert.deepEqual(p.world.groundItems, [
        { id: SEASLUG, amount: 1, x: 511, y: 636, ticks: Math.ceil(12000 / 640), owner: p }
    ]);
    assert.ok(kent.said.includes('a few more minutes and that thing would have full control you body'));

    await seaSlug.onTalkToNPC(p, fakeNpc(KENT));
    assert.equal(p.said.at(-1), 'hello');
});

test("stage 5: the island lies in Open-RSC's Ardougne box, so Holgart rows straight to the platform", async () => {
    const p = player({ stage: 5, ...ISLAND, answers: [0] });
    await seaSlug.onTalkToNPC(p, fakeNpc(HOLGART_ISLAND));
    assert.deepEqual(p.teleports, [[PLATFORM.x, PLATFORM.y]]);

    // off the Ardougne box and the platform: the island lines
    const off = player({ stage: 5, x: 499, y: 640 });
    await seaSlug.onTalkToNPC(off, fakeNpc(HOLGART_ISLAND));
    assert.ok(off.said.includes('we had better get back to the platform'));
    assert.deepEqual(off.teleports, [[PLATFORM.x, PLATFORM.y]]);

    const offStage4 = player({ stage: 4, x: 499, y: 640 });
    await seaSlug.onTalkToNPC(offStage4, fakeNpc(HOLGART_ISLAND));
    assert.ok(offStage4.said.includes('where are we?'));

    // a lit torch goes out on the crossing from the shore
    const lit = player({ stage: 5, ...SHORE, items: [LIT_TORCH], answers: [0] });
    await seaSlug.onTalkToNPC(lit, fakeNpc(HOLGART_LAND));
    assert.ok(lit.inventory.has(UNLIT_TORCH));
    assert.equal(lit.inventory.has(LIT_TORCH), false);
    assert.ok(lit.messages.includes('@que@your torch goes out on the crossing'));

    // and back ashore from the platform
    const back = player({ stage: 5, ...PLATFORM, answers: [1] });
    await seaSlug.onTalkToNPC(back, fakeNpc(HOLGART_PLATFORM));
    assert.deepEqual(back.teleports, [[515, 613]]);
});

test('stage 5: Bailey gives a torch, the fishermen throw you off the ladder until it is lit', async () => {
    const ladder = gameObject(458, 494, 618);
    const p = player({ stage: 5, ...PLATFORM, items: [DRY_STICKS], levels: { firemaking: 29 } });

    const b = fakeNpc(BAILEY);
    await seaSlug.onTalkToNPC(p, b);
    assert.ok(p.inventory.has(UNLIT_TORCH));
    assert.ok(p.messages.includes('@que@bailey gives you a torch'));

    await seaSlug.onTalkToNPC(p, fakeNpc(BAILEY));
    assert.equal(p.inventory.count(UNLIT_TORCH), 1);
    assert.ok(p.said.includes('i better figure a way to light this torch'));

    await seaSlug.onGameObjectCommandOne(p, ladder);
    assert.deepEqual(p.damaged, [7]);
    assert.deepEqual(p.teleports, []);
    assert.equal(p.said.at(-1), 'ouch');

    // firemaking 29: the sticks only smoke
    p.messages.length = 0;
    assert.equal(await seaSlug.onInventoryCommand(p, { id: DRY_STICKS }), true);
    assert.deepEqual(p.messages, [
        'you rub together the dry sticks',
        'you need a firemaking level of 30 or above',
        'the sticks smoke momentarily then die out'
    ]);
    assert.ok(p.inventory.has(UNLIT_TORCH));

    p.skills.firemaking.base = 30;
    p.skills.firemaking.current = 30;
    await seaSlug.onInventoryCommand(p, { id: DRY_STICKS });
    assert.ok(p.inventory.has(LIT_TORCH));
    assert.equal(p.inventory.has(UNLIT_TORCH), false);
    assert.ok(p.inventory.has(DRY_STICKS)); // not used up
    assert.deepEqual(p.experience, [['firemaking', 310]]);
    assert.equal(p.cache.lit_torch, true);

    const b2 = fakeNpc(BAILEY);
    await seaSlug.onTalkToNPC(p, b2);
    assert.ok(b2.said.includes('well done traveler'));

    await seaSlug.onGameObjectCommandOne(p, ladder);
    assert.deepEqual(p.teleports, [[494, 1561]]);
    assert.equal(p.messages.at(-1), 'the fishermen seem afraid of your torch');

    // lost torch: another one
    const lost = player({ stage: 5, cache: { lit_torch: true } });
    await seaSlug.onTalkToNPC(lost, fakeNpc(BAILEY));
    assert.ok(lost.inventory.has(UNLIT_TORCH));
    assert.ok(lost.said.includes("i've managed to lose my torch"));

    // no unlit torch: the sticks die out; any other item is not ours
    const none = player({ stage: 5, items: [DRY_STICKS], levels: { firemaking: 40 } });
    await seaSlug.onInventoryCommand(none, { id: DRY_STICKS });
    assert.equal(none.messages.at(-1), 'the sticks smoke momentarily then die out');
    assert.equal(none.cache.lit_torch, undefined);
    assert.equal(await seaSlug.onInventoryCommand(none, { id: 776 }), false);

    // lighting a torch outside stage 5 gives the torch but no quest flag
    const after = player({ stage: -1, items: [DRY_STICKS, UNLIT_TORCH] });
    await seaSlug.onInventoryCommand(after, { id: DRY_STICKS });
    assert.ok(after.inventory.has(LIT_TORCH));
    assert.equal(after.cache.lit_torch, undefined);
});

test('stage 5: the loose panel crumbles, Kennith agrees, the crane lowers him to the boat (6)', async () => {
    const panel = wallObject(124, 487, 1558, 1);

    const early = player({ stage: 4 });
    assert.equal(await seaSlug.onWallObjectCommandOne(early, panel), true);
    assert.deepEqual(early.messages, ['@que@you kick the loose panal', '@que@nothing interesting happens']);
    assert.equal(early.cache.loose_panel, undefined);
    assert.equal(await seaSlug.onWallObjectCommandOne(early, wallObject(1, 487, 1563)), false);

    const p = player({ stage: 5, x: 488, y: 1558, cache: { lit_torch: true } });
    const k = fakeNpc(KENNITH);
    await seaSlug.onTalkToNPC(p, k);
    assert.ok(k.said.includes("i won't go near them"));

    await seaSlug.onWallObjectCommandOne(p, panel);
    assert.equal(p.cache.loose_panel, true);
    assert.ok(p.messages.includes('@que@leaving an opening big enough for kennith to climb through'));

    const k2 = fakeNpc(KENNITH);
    await seaSlug.onTalkToNPC(p, k2);
    assert.ok(k2.said.includes("okay, when you have i'll come out"));

    const world = p.world;
    const crane = gameObject(453, 493, 1558);
    crane.direction = 4;
    world.addEntity('gameObjects', crane);
    assert.equal(await seaSlug.onGameObjectCommandOne(p, crane), true);
    assert.equal(p.questStages.seaSlug, 6);
    assert.equal(p.cache.loose_panel, undefined);
    assert.equal(p.cache.lit_torch, undefined);
    assert.ok(p.said.includes('jump on kennith!'));
    assert.ok(p.messages.includes('@que@and lower kennith to the row boat waiting below'));
    // turned 5, 6, 5 and back to 4: one crane left, facing as it was
    assert.equal(world.objectList.length, 1);
    assert.deepEqual([world.objectList[0].id, world.objectList[0].direction], [453, 4]);

    const k3 = fakeNpc(KENNITH);
    await seaSlug.onTalkToNPC(p, k3);
    assert.equal(p.messages.at(-1), "@que@He doesn't seem interested in talking");

    const other = player({ stage: 2 });
    await seaSlug.onGameObjectCommandOne(other, gameObject(453, 493, 1558));
    assert.deepEqual(other.messages, ['@que@you rotate the crane around']);
    const none = player();
    await seaSlug.onGameObjectCommandOne(none, gameObject(453, 493, 1558));
    assert.deepEqual(none.messages, ['Nothing interesting happens']);
});

test('stage 6: Holgart takes you ashore, Caroline gives the pearls and the reward (-1)', async () => {
    const p = player({ stage: 6, ...PLATFORM, levels: { fishing: 40 } });
    const b = fakeNpc(BAILEY);
    await seaSlug.onTalkToNPC(p, b);
    assert.ok(b.said.includes('you to traveler'));

    await seaSlug.onTalkToNPC(p, fakeNpc(HOLGART_PLATFORM));
    assert.deepEqual(p.teleports, [[515, 613]]);
    assert.deepEqual(p.messages.slice(-2), ['you board the small row boat', 'you arrive back on shore']);

    const c = fakeNpc(CAROLINE);
    await seaSlug.onTalkToNPC(p, c);
    assert.equal(p.questStages.seaSlug, -1);
    assert.deepEqual(p.completed, [
        [
            'seaSlug',
            {
                questPoints: 1,
                experience: { fishing: 700 + 800 * 40 },
                message: 'well done, you have completed the sea slug quest'
            }
        ]
    ]);
    assert.ok(p.inventory.has(PEARLS));
    assert.ok(c.said.includes('take care of yourself adventurer'));

    const again = player({ stage: -1 });
    const c2 = fakeNpc(CAROLINE);
    await seaSlug.onTalkToNPC(again, c2);
    assert.ok(c2.said.includes("i'm good"));
    assert.equal(again.inventory.has(PEARLS), false);
});

test('after the quest Holgart still rows out and back; Bailey and the shore', async () => {
    const p = player({ stage: -1, ...SHORE, items: [LIT_TORCH], answers: [1] });
    await seaSlug.onTalkToNPC(p, fakeNpc(HOLGART_LAND));
    assert.deepEqual(p.teleports, [[PLATFORM.x, PLATFORM.y]]);
    assert.ok(p.inventory.has(UNLIT_TORCH));

    const back = player({ stage: -1, ...PLATFORM, answers: [1] });
    await seaSlug.onTalkToNPC(back, fakeNpc(HOLGART_PLATFORM));
    assert.deepEqual(back.teleports, [[515, 613]]);

    const b = fakeNpc(BAILEY);
    await seaSlug.onTalkToNPC(back, b);
    assert.ok(b.said.includes("well don't go touching any of those blasted slugs"));

    // stage 6 from the shore: back out to the platform
    const six = player({ stage: 6, ...SHORE, answers: [1] });
    await seaSlug.onTalkToNPC(six, fakeNpc(HOLGART_LAND));
    assert.equal(six.said.at(-1), "i'm keeping away from there");
    assert.deepEqual(six.teleports, []);
});

test('the platform fishermen, the sea slugs, and what is not ours', async () => {
    for (const id of [463, 464]) {
        const p = player();
        const f = fakeNpc(id);
        await seaSlug.onTalkToNPC(p, f);
        assert.ok(f.said.includes('deep deep under the blue'));
        assert.ok(p.messages.includes('starring at the sea'));
    }

    const g = fakeNpc(462);
    await seaSlug.onTalkToNPC(player(), g);
    assert.ok(g.said.includes('leave or face the deep blue'));

    const p = player();
    assert.equal(await seaSlug.onGroundItemTake(p, { id: SEASLUG, x: 489, y: 614 }), true);
    assert.equal(p.damaged.length, 1);
    assert.ok(p.damaged[0] >= 1 && p.damaged[0] <= 8);
    assert.equal(p.said.at(-1), 'ouch');
    assert.equal(p.messages.at(-1), 'you drop the sea slug');
    assert.equal(p.inventory.has(SEASLUG), false);

    assert.equal(await seaSlug.onGroundItemTake(p, { id: 776 }), false);
    assert.equal(await seaSlug.onTalkToNPC(p, fakeNpc(1)), false);
    assert.equal(await seaSlug.onGameObjectCommandOne(p, gameObject(6, 494, 1562)), false);
});
