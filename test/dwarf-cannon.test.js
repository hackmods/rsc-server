// Dwarf Cannon (quests/members/dwarf-cannon/*.js), ported from Open-RSC DwarfCannon.java: every stage with the Dwarf
// commander and the Cannon engineer, the railings, the watch tower, Lollk, the broken multicannon, the reward,
// Nulodion's shop and cannon sale, and the replacement of a lost cannon.

const test = require('node:test');
const assert = require('node:assert/strict');

const commander = require('../src/plugins/quests/members/dwarf-cannon/dwarf-commander');
const engineer = require('../src/plugins/quests/members/dwarf-cannon/cannon-engineer');
const objects = require('../src/plugins/quests/members/dwarf-cannon/objects');
const { fakeNpc, fakePlayer, gameObject, wallObject } = require('./wave2b-fakes');

const COMMANDER = 771;
const ENGINEER = 770;

function answer(p, ...choices) {
    p.ask = async (options, repeat) => {
        p.asked.push(options);
        const choice = choices.shift();
        if (choice === undefined) throw new Error('no answer scripted for ' + JSON.stringify(options));
        if (repeat) p.said.push(options[choice]);
        return choice;
    };
}

function withRandom(value, fn) {
    const real = Math.random;
    Math.random = () => value;
    return Promise.resolve(fn()).finally(() => {
        Math.random = real;
    });
}

test('hooks pass on unrelated ids', async () => {
    const p = fakePlayer();
    assert.equal(await commander.onTalkToNPC(p, fakeNpc(1)), false);
    assert.equal(await engineer.onTalkToNPC(p, fakeNpc(1)), false);
    assert.equal(await objects.onGameObjectCommandOne(p, gameObject(1, 0, 0)), false);
    assert.equal(await objects.onWallObjectCommandOne(p, wallObject(1, 0, 0)), false);
    assert.equal(await objects.onWallObjectCommandOne(p, wallObject(197, 100, 0)), false);
    assert.equal(await objects.onGroundItemTake(p, { id: 10 }), false);
});

test('the whole quest, stage by stage', async () => {
    const p = fakePlayer({ levels: { crafting: 20 } });
    const npc = fakeNpc(COMMANDER);

    // 0 -> 1: six railings
    answer(p, 1);
    await commander.onTalkToNPC(p, npc);
    assert.equal(p.questStages.dwarfCannon, 1);
    assert.equal(p.inventory.count(1042), 6);

    // the railings: one failed attempt hurts, then all six fixed
    answer(p, 0);
    await withRandom(0.9, () => objects.onWallObjectCommandTwo(p, wallObject(181, 603, 473)));
    assert.equal(p.damaged.length, 1);
    assert.equal(p.cache.railone, undefined);

    for (const id of [181, 182, 183, 184, 185, 186]) {
        answer(p, 0);
        await withRandom(0.1, () => objects.onWallObjectCommandTwo(p, wallObject(id, 600, 470)));
    }
    assert.equal(p.inventory.count(1042), 0);
    await objects.onWallObjectCommandTwo(p, wallObject(181, 603, 473));
    assert.equal(p.messages.at(-1), 'you have already fixed this railing');

    // 1 -> 2
    await commander.onTalkToNPC(p, npc);
    assert.equal(p.questStages.dwarfCannon, 2);
    assert.equal(p.cache.railone, undefined);

    // the watch tower and the remains
    await objects.onGameObjectCommandOne(p, gameObject(981, 616, 492));
    assert.deepEqual(p.teleports.at(-1), [616, 1435]);
    const remains = { id: 1046, x: 617, y: 1435 };
    assert.equal(await objects.onGroundItemTake(p, remains), true);
    assert.equal(p.cache.grabed_dwarf_remains, true);
    assert.equal(p.inventory.has(1046), true);
    assert.equal(await objects.onGroundItemTake(p, remains), true);
    assert.equal(p.inventory.count(1046), 1);
    await objects.onGameObjectCommandOne(p, gameObject(985, 616, 1436));
    assert.deepEqual(p.teleports.at(-1), [616, 493]);

    // 2 -> 3
    await commander.onTalkToNPC(p, npc);
    assert.equal(p.questStages.dwarfCannon, 3);
    assert.equal(p.inventory.has(1046), false);

    // Lollk in the crate
    await objects.onGameObjectCommandOne(p, gameObject(987, 620, 3313));
    assert.equal(p.cache.savedlollk, true);
    assert.equal(p.world.npcList.length, 0, 'lollk runs off');

    // 3 -> 4: the tool kit
    answer(p, 0);
    await commander.onTalkToNPC(p, npc);
    assert.equal(p.questStages.dwarfCannon, 4);
    assert.equal(p.inventory.has(1055), true);

    // the shed door opens at stage 4
    await objects.onWallObjectCommandOne(p, wallObject(194, 605, 468));
    assert.deepEqual(p.doors, [194]);

    // fix the four parts
    const parts = ['pipe', 'barrel', 'axle', 'shaft'];
    for (let i = 0; i < parts.length; i += 1) {
        answer(p, i);
        await withRandom(0.1, () => objects.onGameObjectCommandOne(p, gameObject(994, 271, 491)));
        assert.equal(p.cache[parts[i]], true);
    }
    assert.equal(p.experience.length, 4);
    assert.deepEqual(p.experience[0], ['crafting', 5, true]);
    await objects.onGameObjectCommandOne(p, gameObject(994, 271, 491));
    assert.equal(p.cache.cannon_complete, true);
    assert.equal(p.cache.pipe, undefined);

    // 4 -> 5
    answer(p, 1);
    await commander.onTalkToNPC(p, npc);
    assert.equal(p.questStages.dwarfCannon, 5);
    assert.equal(p.cache.cannon_complete, undefined);

    // the black guard base door opens from stage 5
    await objects.onWallObjectCommandOne(p, wallObject(197, 278, 493));
    assert.deepEqual(p.doors, [194, 197]);

    // 5 -> 6: Nulodion
    await engineer.onTalkToNPC(p, fakeNpc(ENGINEER));
    assert.equal(p.questStages.dwarfCannon, 6);
    assert.equal(p.inventory.has(1056) && p.inventory.has(1057), true);
    assert.equal(p.cache.spoken_nulodion, true);

    // lose the mould: he gives another
    p.inventory.remove(1057);
    await engineer.onTalkToNPC(p, fakeNpc(ENGINEER));
    assert.equal(p.inventory.has(1057), true);

    // 6 -> -1
    p.experience.length = 0;
    await commander.onTalkToNPC(p, npc);
    assert.equal(p.questStages.dwarfCannon, -1);
    assert.equal(p.questPoints, 1);
    assert.deepEqual(p.experience, [['crafting', 1000 + 200 * 20, false]]);
    assert.equal(p.inventory.has(1056) || p.inventory.has(1057), false);
    assert.deepEqual(p.messages.slice(-2), ['well done', 'you have completed the dwarf cannon quest']);
    assert.equal(p.cache.spoken_nulodion, undefined);
});

test('locked before their stage: watch tower trap door, shed door, base door', async () => {
    const p = fakePlayer({ quests: { dwarfCannon: 0 } });
    await objects.onGameObjectCommandOne(p, gameObject(981, 616, 492));
    await objects.onWallObjectCommandOne(p, wallObject(194, 605, 468));
    await objects.onWallObjectCommandOne(p, wallObject(197, 278, 493));
    assert.deepEqual(p.messages, [
        'you climb up the ladder',
        'but the trap door will not open',
        'the door is locked',
        'the door is locked'
    ]);
    assert.deepEqual(p.teleports, []);
    assert.deepEqual(p.doors, []);
});

test('stage 1 without railings: the commander gives another', async () => {
    const p = fakePlayer({ quests: { dwarfCannon: 1 }, cache: { railone: true } });
    await commander.onTalkToNPC(p, fakeNpc(COMMANDER));
    assert.equal(p.questStages.dwarfCannon, 1);
    assert.equal(p.inventory.count(1042), 1);
});

test('the empty crates and plain railings', async () => {
    const p = fakePlayer({ quests: { dwarfCannon: 3 }, cache: { savedlollk: true } });
    await objects.onGameObjectCommandOne(p, gameObject(986, 593, 3334));
    await objects.onGameObjectCommandOne(p, gameObject(987, 620, 3313));
    await objects.onWallObjectCommandTwo(p, wallObject(193, 599, 471));
    assert.deepEqual(p.messages, [
        'you search the crate',
        "but it's empty",
        'you search the crate',
        "but it's empty",
        'you search the railing',
        'but find nothing of interest'
    ]);
});

test('Nulodion after the quest: the shop, the 750 000 coin cannon, one set only', async () => {
    const shop = fakePlayer({ quests: { dwarfCannon: -1 } });
    answer(shop, 0, 1);
    await engineer.onTalkToNPC(shop, fakeNpc(ENGINEER));
    assert.deepEqual(shop.shops, ['nulodions-cannon-parts']);

    const ammo = fakePlayer({ quests: { dwarfCannon: -1 } });
    answer(ammo, 0, 3);
    await engineer.onTalkToNPC(ammo, fakeNpc(ENGINEER));
    assert.deepEqual(ammo.shops, ['nulodions-cannon-parts']);

    const poor = fakePlayer({ quests: { dwarfCannon: -1 }, items: [[10, 1000]] });
    answer(poor, 0, 0);
    await engineer.onTalkToNPC(poor, fakeNpc(ENGINEER));
    assert.ok(poor.said.includes("oops, i don't have enough money"));
    assert.equal(poor.inventory.count(10), 1000);

    const rich = fakePlayer({ quests: { dwarfCannon: -1 }, items: [[10, 800000]] });
    answer(rich, 0, 0);
    await engineer.onTalkToNPC(rich, fakeNpc(ENGINEER));
    assert.equal(rich.inventory.count(10), 50000);
    for (const id of [1032, 1033, 1034, 1035, 1057, 1073]) assert.equal(rich.inventory.has(id), true, `item ${id}`);

    answer(rich, 0, 0);
    const n = fakeNpc(ENGINEER);
    await engineer.onTalkToNPC(rich, n);
    assert.ok(n.said.includes('wait a moment, our records show you already own some cannon equipment'));
    assert.equal(rich.inventory.count(10), 50000);
});

test('Nulodion replaces a lost cannon only when it is gone from the world', async () => {
    const p = fakePlayer({
        quests: { dwarfCannon: -1 },
        cache: { has_cannon: true, cannon_stage: 3, cannon_x: 300, cannon_y: 400 }
    });

    // still standing: no
    p.world.objects.push({ id: 948, x: 300, y: 400 });
    answer(p, 3);
    await engineer.onTalkToNPC(p, fakeNpc(ENGINEER));
    assert.equal(p.inventory.has(1032), false);

    // gone: the three parts that were set up
    p.world.objects.length = 0;
    answer(p, 3);
    await engineer.onTalkToNPC(p, fakeNpc(ENGINEER));
    assert.deepEqual(p.inventory.items.map((it) => it.id), [1032, 1033, 1034]);
    assert.equal(p.cache.has_cannon, undefined);
    assert.equal(p.cache.cannon_stage, undefined);
});

test('Nulodion says nothing before stage 5 but still claims the talk', async () => {
    const p = fakePlayer({ quests: { dwarfCannon: 2 } });
    const n = fakeNpc(ENGINEER);
    assert.equal(await engineer.onTalkToNPC(p, n), true);
    assert.deepEqual(n.said, []);
});
