// quests/members/heros-quest.js (Open-RSC HerosQuest.java, DoorAction.java, ArravInvUseOnPlayer.java) and the gang
// halves in Katrine, Straven, Alfonse and Charlie: every stage transition and both players' flags, driven by fakes.

const test = require('node:test');
const assert = require('node:assert/strict');

const heros = require('../src/plugins/quests/members/heros-quest');
const katrine = require('../src/plugins/quests/free/shield-of-arrav/katrine');
const straven = require('../src/plugins/quests/free/shield-of-arrav/straven');
const alfonse = require('../src/plugins/npcs/brimhaven/alfonse-the-waiter');
const charlie = require('../src/plugins/npcs/brimhaven/charlie-the-cook');
const { fakeNpc, fakeWorld, fakePlayer, gameObject, wallObject } = require('./quest-fakes-3a');

const ACHETTIES = 253;
const GRUBOR = 255;
const TROBERT = 256;
const GARV = 257;
const PIRATE_GUARD = 258;
const GRIP = 259;
const ALFONSE = 260;
const CHARLIE = 261;
const KATRINE = 27;
const STRAVEN = 24;

const BLACK_ARMOUR = [230, 196, 248];
const ICE_GLOVES = 556;
const FEATHER = 557;
const ID_PAPER = 573;
const MISC_KEY = 582;
const KEYS = 583;
const WHISKY = 584;
const CANDLESTICK = 585;
const ARMBAND = 586;
const LAVA_EEL = 590;

const DONE = { lostCity: -1, shieldOfArrav: -1, merlinsCrystal: -1, dragonSlayer: -1 };

function hero(opts = {}) {
    const p = fakePlayer({ quest: 'herosQuest', ...opts });
    Object.assign(p.questStages, opts.quests || {});
    return p;
}

function blackArm(opts = {}) {
    const p = hero({ stage: 1, ...opts });
    p.cache.blackArmStage = -1;
    return p;
}

function phoenix(opts = {}) {
    const p = hero({ stage: 1, ...opts });
    p.cache.phoenixStage = -1;
    return p;
}

test('Achetties refuses an applicant without the quests and 55 quest points', async () => {
    const p = hero({ answers: [0] });
    const npc = fakeNpc(ACHETTIES);
    assert.equal(await heros.onTalkToNPC(p, npc), true);
    assert.equal(p.questStages.herosQuest, 0);
    assert.ok(npc.said.includes("You're a hero?, I've never heard of you"));
    assert.ok(p.messages.includes('You need to have 55 quest points to file for an application'));
});

test('Achetties starts the quest (stage 0 -> 1) for a qualified hero', async () => {
    const p = hero({ answers: [0, 1], quests: DONE });
    p.questPoints = 55;
    const npc = fakeNpc(ACHETTIES);
    await heros.onTalkToNPC(p, npc);
    assert.equal(p.questStages.herosQuest, 1);
    assert.ok(npc.said.includes('And a cooked lava eel'));
    assert.ok(npc.said.includes('Not really - Entrana firebirds live on Entrana'));
    assert.equal(p.interlocutor, null);
});

test('Achetties at stage 1 without the items reminds and hints; with them completes (-1) with the reward', async () => {
    const p = hero({ stage: 1, answers: [2] });
    const npc = fakeNpc(ACHETTIES);
    await heros.onTalkToNPC(p, npc);
    assert.equal(p.questStages.herosQuest, 1);
    assert.ok(p.said.includes("It's tough, I've not done it yet"));
    assert.ok(npc.said.includes('Maybe go and find someone who knows a lot about fishing?'));

    const done = hero({ stage: 2, items: [ARMBAND, LAVA_EEL, FEATHER], cache: { armband: true, talked_grip: true } });
    await heros.onTalkToNPC(done, fakeNpc(ACHETTIES));
    assert.equal(done.questStages.herosQuest, -1);
    assert.equal(done.inventory.items.length, 0);
    const [[key, opts]] = done.completed;
    assert.equal(key, 'herosQuest');
    assert.equal(opts.questPoints, 1);
    assert.equal(Object.keys(opts.experience).length, 12);
    assert.equal(opts.experience.smithing, 30 * 200 + 300);
    assert.equal(opts.message, 'Well done you have completed the hero guild entry quest');
    assert.equal(done.cache.armband, undefined);
    assert.equal(done.cache.talked_grip, undefined);
});

test('the guild door: Achetties at the door hands in the items, then it opens', async () => {
    const npc = fakeNpc(ACHETTIES, { x: 372, y: 443 });
    const world = fakeWorld({ npcs: [npc] });
    const p = hero({ world, stage: 1, items: [ARMBAND, LAVA_EEL, FEATHER], x: 372, y: 442 });
    const door = wallObject(74, 372, 441);
    assert.equal(await heros.onWallObjectCommandOne(p, door), true);
    assert.equal(p.questStages.herosQuest, -1);
    assert.equal(p.doors.length, 0);
    assert.equal(await heros.onWallObjectCommandOne(p, door), true);
    assert.deepEqual(p.doors, [[74, undefined]]);
});

test('Katrine (Black Arm) sends a hero to Brimhaven (blackarm_mission), then swaps a candlestick for the armband', async () => {
    const p = blackArm({ answers: [1] });
    const npc = fakeNpc(KATRINE);
    await katrine.onTalkToNPC(p, npc);
    assert.equal(p.cache.blackarm_mission, true);
    assert.ok(npc.said.includes('To get in you will need to tell them the word four leafed clover'));

    const swap = blackArm({ answers: [1], items: [CANDLESTICK], cache: { looted_grip: true } });
    await katrine.onTalkToNPC(swap, fakeNpc(KATRINE));
    assert.equal(swap.cache.armband, true);
    assert.deepEqual(swap.inventory.items.map((i) => i.id), [ARMBAND]);

    const lost = blackArm({ cache: { armband: true } });
    await katrine.onTalkToNPC(lost, fakeNpc(KATRINE));
    assert.ok(lost.inventory.has(ARMBAND));
});

test('Straven (Phoenix) gives the mission (pheonix_mission, pheonix_alf), then the armband for a candlestick', async () => {
    const p = phoenix();
    const npc = fakeNpc(STRAVEN);
    await straven.onTalkToNPC(p, npc);
    assert.equal(p.cache.pheonix_mission, true);
    assert.equal(p.cache.pheonix_alf, true);
    assert.ok(npc.said.includes("Use the secret word gherkin to show you're one of us"));

    // a candlestick without having killed Grip earns nothing
    const early = phoenix({ items: [CANDLESTICK] });
    await straven.onTalkToNPC(early, fakeNpc(STRAVEN));
    assert.ok(early.inventory.has(CANDLESTICK));

    const swap = phoenix({ items: [CANDLESTICK], cache: { killed_grip: true } });
    await straven.onTalkToNPC(swap, fakeNpc(STRAVEN));
    assert.equal(swap.cache.armband, true);
    assert.deepEqual(swap.inventory.items.map((i) => i.id), [ARMBAND]);
});

test('Alfonse offers gherkins only to a non-Black-Arm hero; the answer opens the kitchen door', async () => {
    const plain = hero({ stage: 0, answers: [1] });
    await alfonse.onTalkToNPC(plain, fakeNpc(ALFONSE));
    assert.equal(plain.asked[0].length, 2);

    const black = blackArm({ answers: [1] });
    await alfonse.onTalkToNPC(black, fakeNpc(ALFONSE));
    assert.equal(black.asked[0].length, 2);

    const p = phoenix({ answers: [2], cache: { pheonix_alf: true } });
    await alfonse.onTalkToNPC(p, fakeNpc(ALFONSE));
    assert.equal(p.cache.talked_alf, true);
    assert.equal(p.cache.pheonix_alf, undefined);
    assert.ok(p.messages.includes('Alfonse winks'));

    const door = wallObject(78, 448, 682);
    assert.equal(await heros.onWallObjectCommandOne(p, door), true);
    assert.deepEqual(p.doors, [[78, undefined]]);

    const shut = hero({ stage: 1, world: fakeWorld({ npcs: [fakeNpc(ALFONSE)] }) });
    await heros.onWallObjectCommandOne(shut, door);
    assert.equal(shut.doors.length, 0);
});

test('Charlie the cook tells a phoenix about the secret door', async () => {
    const p = phoenix({ answers: [0, 1] });
    const npc = fakeNpc(CHARLIE);
    assert.equal(await charlie.onTalkToNPC(p, npc), true);
    assert.ok(npc.said.includes('We have a secret door out of the back of here'));
});

test('Grubor: the four leaved clover (talked_grubor), then the Palm Street door opens', async () => {
    const grubor = fakeNpc(GRUBOR);
    const door = wallObject(76, 439, 694);
    const none = blackArm({ world: fakeWorld({ npcs: [grubor] }) });
    await heros.onWallObjectCommandOne(none, door);
    assert.deepEqual(none.messages, ["The door won't open"]);

    const wrong = blackArm({ world: fakeWorld({ npcs: [grubor] }), answers: [2], cache: { blackarm_mission: true } });
    await heros.onWallObjectCommandOne(wrong, door);
    assert.equal(wrong.cache.talked_grubor, undefined);

    const p = blackArm({ world: fakeWorld({ npcs: [fakeNpc(GRUBOR)] }), answers: [1], cache: { blackarm_mission: true } });
    await heros.onWallObjectCommandOne(p, door);
    assert.equal(p.cache.talked_grubor, true);
    assert.equal(p.doors.length, 0);
    await heros.onWallObjectCommandOne(p, door);
    assert.deepEqual(p.doors, [[76, undefined]]);
});

test('Trobert hands over the ID paper (hq_impersonate) and replaces a lost one', async () => {
    const p = blackArm({ answers: [0, 0] });
    await heros.onTalkToNPC(p, fakeNpc(TROBERT));
    assert.equal(p.cache.hq_impersonate, true);
    assert.ok(p.inventory.has(ID_PAPER));

    p.inventory.remove(ID_PAPER);
    await heros.onTalkToNPC(p, fakeNpc(TROBERT));
    assert.ok(p.inventory.has(ID_PAPER));
});

test('Garv lets Hartigen in only in black armour with the ID paper (garv_door)', async () => {
    const door = wallObject(75, 463, 681);
    const unarmoured = blackArm({ items: [ID_PAPER], cache: { hq_impersonate: true } });
    await heros.onTalkToNPC(unarmoured, fakeNpc(GARV));
    assert.equal(unarmoured.cache.garv_door, undefined);

    const p = blackArm({
        world: fakeWorld({ npcs: [fakeNpc(GARV)] }),
        items: [ID_PAPER, ...BLACK_ARMOUR],
        equipped: BLACK_ARMOUR,
        cache: { hq_impersonate: true }
    });
    await heros.onWallObjectCommandOne(p, door);
    assert.equal(p.cache.garv_door, true);
    await heros.onWallObjectCommandOne(p, door);
    assert.deepEqual(p.doors, [[75, undefined]]);
});

test('Grip takes the ID paper (talked_grip), opens his door and gives the miscellaneous key', async () => {
    const p = blackArm({ items: [ID_PAPER], answers: [1, 2] });
    await heros.onTalkToNPC(p, fakeNpc(GRIP));
    assert.equal(p.cache.talked_grip, true);
    assert.ok(!p.inventory.has(ID_PAPER));
    assert.ok(p.inventory.has(MISC_KEY));
    assert.ok(p.said.includes('Grip hands you a key'));

    await heros.onWallObjectCommandOne(p, wallObject(77, 463, 676));
    assert.deepEqual(p.doors, [[77, undefined]]);

    const stranger = hero({ stage: 1 });
    await heros.onWallObjectCommandOne(stranger, wallObject(77, 463, 676));
    assert.deepEqual(stranger.messages, ["You can't get through the door", 'You need to speak to grip first']);
});

test("Grip's drinks cabinet: the guard calls Grip into his room, who goes back later", async () => {
    const grip = fakeNpc(GRIP, { x: 463, y: 677 });
    const world = fakeWorld({ npcs: [fakeNpc(PIRATE_GUARD), grip] });
    const p = blackArm({ world, answers: [0] });
    assert.equal(await heros.onGameObjectCommandOne(p, gameObject(263, 461, 675)), true);
    assert.deepEqual([grip.x, grip.y], [463, 673]);
    assert.ok(grip.said.includes("That's my drinks cabinet get away from it"));
    assert.equal(world.timeouts.at(-1).ticks, 1000);
    world.runTimeouts();
    assert.deepEqual([grip.x, grip.y], [463, 677]);

    // with Grip gone the cupboard has whisky
    const alone = blackArm({ world: fakeWorld({ npcs: [fakeNpc(PIRATE_GUARD)] }), answers: [0] });
    await heros.onGameObjectCommandOne(alone, gameObject(264, 461, 675));
    assert.ok(alone.inventory.has(WHISKY));

    const noGuard = blackArm();
    await heros.onGameObjectCommandOne(noGuard, gameObject(263, 461, 675));
    assert.deepEqual(noGuard.messages, ['The guard is busy at the moment']);
});

test('the strange panel and the range room door (miscellaneous key)', async () => {
    const p = phoenix({ items: [MISC_KEY] });
    assert.equal(await heros.onWallObjectCommandOne(p, wallObject(79, 456, 679)), true);
    assert.deepEqual(p.doors, [[79, 11]]);
    assert.equal(await heros.onWallObjectCommandOne(p, wallObject(80, 459, 674)), true);
    assert.ok(p.messages.includes('The door is locked'));
    assert.equal(await heros.onUseWithWallObject(p, wallObject(80, 459, 674), { id: MISC_KEY }), true);
    assert.deepEqual(p.doors.at(-1), [80, undefined]);
    assert.equal(await heros.onUseWithWallObject(p, wallObject(80, 459, 674), { id: 10 }), false);
    // the tutorial island copies of these doors are not ours
    assert.equal(await heros.onWallObjectCommandOne(p, wallObject(80, 206, 730)), false);
});

test('Grip can only be attacked from the range room; his death marks the killer (killed_grip)', async () => {
    const grip = fakeNpc(GRIP);
    const outside = phoenix({ x: 463, y: 678 });
    assert.equal(await heros.onNPCAttack(outside, grip), true);
    assert.ok(outside.said.includes("I can't attack the head guard here"));
    assert.equal(await heros.onNPCRangedAttack(outside, grip), true);
    assert.equal(await heros.onCastOnNPC(outside, grip), true);

    const inRoom = phoenix({ x: 459, y: 673 });
    assert.equal(await heros.onNPCRangedAttack(inRoom, grip), false);
    assert.equal(await heros.onCastOnNPC(inRoom, grip), false);
    assert.equal(await heros.onNPCAttack(inRoom, grip), true);
    assert.equal(inRoom.said.length, 0);

    assert.equal(await heros.onNPCDeath(inRoom, grip), false);
    assert.equal(inRoom.cache.killed_grip, true);
});

test("Grip's keys (grip_keys) open the treasure room; the chest gives two candlesticks (stage 1 -> 2, looted_grip)", async () => {
    const p = blackArm();
    const keys = { id: KEYS, x: 463, y: 673 };
    assert.equal(await heros.onGroundItemTake(p, keys), true);
    assert.equal(p.cache.grip_keys, true);
    assert.ok(p.inventory.has(KEYS));

    assert.equal(await heros.onWallObjectCommandOne(p, wallObject(81, 472, 674)), true);
    assert.deepEqual(p.messages, ['The door is locked']);
    assert.equal(await heros.onUseWithWallObject(p, wallObject(81, 472, 674), { id: KEYS }), true);
    assert.deepEqual(p.doors, [[81, undefined]]);

    const empty = blackArm();
    await heros.onGameObjectCommandOne(empty, gameObject(265, 469, 672));
    assert.deepEqual(empty.messages, ['The chest is empty']);

    assert.equal(await heros.onGameObjectCommandOne(p, gameObject(265, 469, 672)), true);
    assert.equal(p.inventory.count(CANDLESTICK), 2);
    assert.equal(p.questStages.herosQuest, 2);
    assert.equal(p.cache.looted_grip, true);
    assert.equal(await heros.onGameObjectCommandTwo(p, gameObject(265, 469, 672)), true);
});

test('the partners hand over the key and a candlestick by using them on each other', async () => {
    const a = blackArm({ items: [CANDLESTICK, MISC_KEY] });
    const b = phoenix();
    b.username = 'partner';
    assert.equal(await heros.onUseWithPlayer(a, b, { id: CANDLESTICK }), true);
    assert.equal(await heros.onUseWithPlayer(a, b, { id: MISC_KEY }), true);
    assert.ok(b.inventory.has(CANDLESTICK) && b.inventory.has(MISC_KEY));
    assert.ok(!a.inventory.has(CANDLESTICK));
    assert.ok(b.messages.includes('tester has given you a Candlestick'));
    assert.equal(await heros.onUseWithPlayer(a, b, { id: 10 }), false);
});

test('the firebird feather: refused before the quest, burns without ice gloves, free with them', async () => {
    const feather = { id: FEATHER };
    const before = hero({ stage: 0 });
    assert.equal(await heros.onGroundItemTake(before, feather), true);
    assert.ok(before.said.includes('And I have no reason to take it'));

    const bare = hero({ stage: 1, levels: { hits: 40 } });
    assert.equal(await heros.onGroundItemTake(bare, feather), true);
    assert.deepEqual(bare.damaged, [6]);

    const gloved = hero({ stage: 1, items: [ICE_GLOVES], equipped: [ICE_GLOVES] });
    assert.equal(await heros.onGroundItemTake(gloved, feather), false);
});
