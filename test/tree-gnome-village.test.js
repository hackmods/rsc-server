// Tree Gnome Village (quests/members/tree-gnome-village.js, port of Open-RSC TreeGnomeVillage.java): every stage driven
// with fake player and world objects, from King Bolren to the ceremony at the spirit tree.

const test = require('node:test');
const assert = require('node:assert/strict');

const { makePlayer, makeWorld, fakeNpc, addNpc, addObject, wallObject } = require('./quest-port-fakes');
const tgv = require('../src/plugins/quests/members/tree-gnome-village');

const ELKOY = 396;
const REMSAI = 397;
const LOCAL_GNOME = 399;
const BOLREN = 400;
const KALRON = 402;
const TRACKER_1 = 404;
const TRACKER_2 = 405;
const TRACKER_3 = 406;
const MONTAI = 408;
const GNOME_TROOP = 409;
const WARLORD = 410;
const KHAZARD_COMMANDER = 428;
const LOGS = 14;
const ORB = 740;
const ORBS = 741;
const AMULET = 744;

test('Bolren sends you for the orb (stage 0 -> 1) and a gnome guides you out', async () => {
    const player = makePlayer({ answers: [1, 0] });
    assert.equal(await tgv.onTalkToNPC(player, fakeNpc(BOLREN)), true);
    assert.equal(player.questStages.treeGnomeVillage, 1);
    assert.deepEqual(player.teleported.slice(0, 2), [624, 675]);
    assert.ok(player.messages.includes('A gnome guides you out of the maze'));

    const no = makePlayer({ answers: [1, 1] });
    await tgv.onTalkToNPC(no, fakeNpc(BOLREN));
    assert.equal(no.questStages.treeGnomeVillage, undefined);
    assert.equal(no.teleported, null);
});

test('Montai wants six logs (1 -> 2 -> 3), then the coordinates (3 -> 4)', async () => {
    const player = makePlayer({ stages: { treeGnomeVillage: 1 }, answers: [0] });
    await tgv.onTalkToNPC(player, fakeNpc(MONTAI));
    assert.equal(player.questStages.treeGnomeVillage, 2);

    // five logs are not enough
    for (let i = 0; i < 5; i += 1) player.inventory.add(LOGS);
    await tgv.onTalkToNPC(player, fakeNpc(MONTAI));
    assert.equal(player.questStages.treeGnomeVillage, 2);
    assert.equal(player.inventory.count(LOGS), 5);

    player.inventory.add(LOGS);
    player.inventory.add(LOGS);
    await tgv.onTalkToNPC(player, fakeNpc(MONTAI));
    assert.equal(player.questStages.treeGnomeVillage, 3);
    assert.equal(player.inventory.count(LOGS), 1);
    assert.ok(player.messages.includes('you give some wood to the commander'));

});

test('Montai at stage 3: "I\'ll try my best" (3 -> 4)', async () => {
    const player = makePlayer({ stages: { treeGnomeVillage: 3 }, answers: [1] });
    await tgv.onTalkToNPC(player, fakeNpc(MONTAI));
    assert.equal(player.questStages.treeGnomeVillage, 4);
});

test('the trackers give height 4, y 5 and a riddle for x', async () => {
    const one = fakeNpc(TRACKER_1);
    await tgv.onTalkToNPC(makePlayer({ stages: { treeGnomeVillage: 4 } }), one);
    assert.ok(one.lines.includes('the height coordinate is 4'));

    const three = fakeNpc(TRACKER_3);
    await tgv.onTalkToNPC(makePlayer({ stages: { treeGnomeVillage: 4 } }), three);
    assert.ok(three.lines.includes('less than our feet'));

    // tracker 2 is talked to through the gate
    const world = makeWorld();
    const tracker = addNpc(world, { id: TRACKER_2, x: 649, y: 629 });
    const lines = [];
    tracker.say = async (...m) => lines.push(...m);
    const player = makePlayer({ world, x: 648, y: 630, stages: { treeGnomeVillage: 4 } });
    assert.equal(await tgv.onGameObjectCommandOne(player, { id: 392, x: 648, y: 629 }), true);
    assert.ok(lines.includes('the y coordinate is 5'));
});

test('the ballista: damaged before stage 4, a miss, then the hit with 4/3/5 (4 -> 5)', async () => {
    const early = makePlayer({ stages: { treeGnomeVillage: 3 } });
    await tgv.onGameObjectCommandOne(early, { id: 388 });
    assert.ok(early.messages.includes('@que@The ballista is damaged'));

    const miss = makePlayer({ stages: { treeGnomeVillage: 4 }, answers: [0, 0, 0] });
    await tgv.onGameObjectCommandOne(miss, { id: 388 });
    assert.equal(miss.questStages.treeGnomeVillage, 4);
    assert.ok(miss.messages.includes("@que@You've missed the target"));
    assert.deepEqual(miss.said, ['coord 1', 'coord 1', 'coord 1']);

    const hit = makePlayer({ stages: { treeGnomeVillage: 4 }, answers: [3, 2, 4] });
    await tgv.onGameObjectCommandOne(hit, { id: 388 });
    assert.equal(hit.questStages.treeGnomeVillage, 5);
    assert.ok(hit.messages.includes('@que@The front entrance is reduced to rubble'));

    const after = makePlayer({ stages: { treeGnomeVillage: 5 } });
    await tgv.onGameObjectCommandOne(after, { id: 388 });
    assert.deepEqual(after.messages, ['The ballista has been damaged, it is out of use']);
});

test('the stronghold wall: rubble from stage 5, the Khazard commander jumps you the first time', async () => {
    const shut = makePlayer({ stages: { treeGnomeVillage: 4 }, x: 659, y: 633 });
    await tgv.onGameObjectCommandOne(shut, { id: 393 });
    assert.equal(shut.teleported, null);
    assert.ok(shut.messages.includes('@que@But not enough to climb through'));

    const world = makeWorld();
    const commander = addNpc(world, { id: KHAZARD_COMMANDER, x: 660, y: 630 });
    commander.say = async () => {};
    commander.attack = async (target) => {
        commander.attacked = target;
    };
    const player = makePlayer({ world, stages: { treeGnomeVillage: 5 }, x: 659, y: 633 });
    await tgv.onGameObjectCommandOne(player, { id: 393 });
    assert.deepEqual(player.teleported.slice(0, 2), [659, 632]);
    assert.equal(commander.attacked, player);
    assert.equal(player.cache.over_gnomefield_wall, true);

    // and back out
    await tgv.onGameObjectCommandOne(player, { id: 393 });
    assert.deepEqual(player.teleported.slice(0, 2), [659, 633]);
});

test('the Khazard chest upstairs holds the orb', async () => {
    const player = makePlayer({ stages: { treeGnomeVillage: 5 } });
    const chest = addObject(player.world, { id: 409, x: 662, y: 1578 });
    assert.equal(await tgv.onGameObjectCommandOne(player, chest), true);
    assert.equal(player.inventory.count(ORB), 1);
    await tgv.onGameObjectCommandOne(player, chest);
    assert.equal(player.inventory.count(ORB), 1);
    assert.ok(player.messages.includes('You search the chest, but find nothing'));
    assert.equal(await tgv.onGameObjectCommandTwo(player, chest), true);
});

test('Elkoy leads you to the village with the orb; Bolren takes it and sends you for the warlord (5 -> 6)', async () => {
    const player = makePlayer({ stages: { treeGnomeVillage: 5 }, items: [ORB], answers: [0, 0] });
    await tgv.onTalkToNPC(player, fakeNpc(ELKOY));
    assert.deepEqual(player.teleported.slice(0, 2), [644, 697]);

    await tgv.onTalkToNPC(player, fakeNpc(BOLREN));
    assert.equal(player.questStages.treeGnomeVillage, 6);
    assert.equal(player.inventory.count(ORB), 0);
    assert.deepEqual(player.teleported.slice(0, 2), [624, 675]);
});

test('the warlord: talk starts the fight, his death drops the orbs at stage 6', async () => {
    const warlord = fakeNpc(WARLORD);
    const player = makePlayer({ stages: { treeGnomeVillage: 6 } });
    await tgv.onTalkToNPC(player, warlord);
    assert.equal(warlord.attacked, player);
    assert.equal(player.interlocutor, null);

    // never claims, so his own drops still fall
    assert.equal(await tgv.onNPCDeath(player, warlord), false);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(player.inventory.count(ORBS), 1);
    assert.equal(player.cache.looted_orbs_protect, true);
    assert.ok(player.messages.includes('You search his satchel and find the orbs of protection'));

    const early = makePlayer({ stages: { treeGnomeVillage: 5 } });
    await tgv.onNPCDeath(early, warlord);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(early.inventory.count(ORBS), 0);
});

test('the ceremony: Bolren places the orbs, the amulet and the reward (6 -> -1)', async () => {
    const player = makePlayer({ stages: { treeGnomeVillage: 6 }, cache: { looted_orbs_protect: true }, items: [ORBS] });
    player.skills.attack.base = 30;
    await tgv.onTalkToNPC(player, fakeNpc(BOLREN));

    assert.equal(player.questStages.treeGnomeVillage, -1);
    assert.equal(player.inventory.count(ORBS), 0);
    assert.equal(player.inventory.count(AMULET), 1);
    assert.equal(player.questPoints, 2);
    // 800 + 900 per attack level, in quarter points
    assert.equal(player.skills.attack.experience, 800 + 30 * 900);
    assert.equal(player.cache.looted_orbs_protect, undefined);
    assert.deepEqual(player.teleported, [658, 696, true]);
    assert.ok(player.messages.includes('Well done you have completed the treequest'));

    // a lost amulet is replaced
    player.inventory.remove(AMULET);
    await tgv.onTalkToNPC(player, fakeNpc(BOLREN));
    assert.equal(player.inventory.count(AMULET), 1);
});

test('the village gnomes talk at every stage', async () => {
    for (const id of [REMSAI, LOCAL_GNOME, KALRON, GNOME_TROOP, ELKOY, TRACKER_1, TRACKER_3, MONTAI]) {
        for (const stage of [0, 1, 2, 3, 4, 5, 6]) {
            const npc = fakeNpc(id);
            // menus are refused with an empty answer list only where the stage offers one
            const player = makePlayer({ stages: { treeGnomeVillage: stage }, answers: [1, 1, 1] });
            assert.equal(await tgv.onTalkToNPC(player, npc), true, `${id} at ${stage}`);
            assert.ok(npc.lines.length > 0, `${id} says something at ${stage}`);
        }
    }

    const player = makePlayer({ stages: { treeGnomeVillage: -1 }, answers: [1] });
    const elkoy = fakeNpc(ELKOY);
    await tgv.onTalkToNPC(player, elkoy);
    assert.ok(elkoy.lines.includes('ok then take care'));
});

test('the loose fence panels into the maze', async () => {
    const player = makePlayer({ x: 633, y: 706 });
    assert.equal(await tgv.onWallObjectCommandOne(player, wallObject({ id: 101, x: 633, y: 705 })), true);
    assert.deepEqual(player.enteredDoor, [101, 633, 705, 16]);
    assert.ok(player.messages.includes('You push your way through the fence'));
    assert.equal(await tgv.onWallObjectCommandOne(player, wallObject({ id: 101, x: 100, y: 100 })), false);
});
