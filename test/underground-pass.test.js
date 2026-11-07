// Underground Pass (quests/members/underground-pass/*, ports of the undergroundpass/*.java files of Open-RSC, InvAction.java, DarkMage.java
// and SpellHandler's Iban blast): every stage of the quest and the success and failure branch of each obstacle driven with fake
// players, objects and npcs. Math.random is pinned where a roll decides the path (0 = every roll succeeds, 0.999 = every roll fails).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const shared = require('../src/plugins/quests/members/underground-pass/shared');
const koftik = require('../src/plugins/quests/members/underground-pass/koftik');
const dwarves = require('../src/plugins/quests/members/underground-pass/dwarves');
const creatures = require('../src/plugins/quests/members/underground-pass/creatures');
const kardia = require('../src/plugins/quests/members/underground-pass/kardia');
const map1 = require('../src/plugins/quests/members/underground-pass/cave-map1');
const agility = require('../src/plugins/quests/members/underground-pass/agility');
const map2 = require('../src/plugins/quests/members/underground-pass/cave-map2');
const orbs = require('../src/plugins/quests/members/underground-pass/orbs');
const floor = require('../src/plugins/quests/members/underground-pass/dungeon-floor');
const temple = require('../src/plugins/quests/members/underground-pass/temple');
const itemsPlugin = require('../src/plugins/quests/members/underground-pass/items');
const { fakeNpc, fakeWorld, fakePlayer, gameObject, wallObject } = require('./quest-fakes-3b');

const ITEMS = require('@2003scape/rsc-data/config/items');
const { ITEM, NPC } = shared;

const PLUGIN_TYPES = [
    ...fs
        .readFileSync(require.resolve('../src/model/world.js'), 'utf8')
        .match(/const PLUGIN_TYPES = \[([\s\S]*?)\]/)[1]
        .matchAll(/'(\w+)'/g)
].map((m) => m[1]);

const GOOD = 0; // every roll succeeds
const BAD = 0.999; // every roll fails

function npc(id, opts) {
    const n = fakeNpc(id, opts);

    n.opponent = null;
    n.index = 500 + id;
    n.skills = { hits: { current: 90, base: 90 } };

    return n;
}

function player(opts = {}) {
    const world = opts.world || fakeWorld();

    world.addTimedObject = (o) => {
        world.timedObjects = world.timedObjects || [];
        world.timedObjects.push(o);

        return { ...o, index: 1 };
    };
    world.replaceEntity = (type, entity, id) => {
        world.replaced.push([entity.id, id]);

        return { ...entity, id };
    };
    world.removeEntity = ((remove) => (type, entity) => {
        world.removedObjects = world.removedObjects || [];

        if (type === 'gameObjects') {
            world.removedObjects.push(entity.id);
        }

        return remove(type, entity);
    })(world.removeEntity);

    const p = fakePlayer({ quest: 'undergroundPass', ...opts, world });

    p.sent = [];
    p.send = (message) => p.sent.push(message);
    p.cache = opts.cache || {};
    p.opponent = null;
    p.loggedIn = true;
    p.questPoints = 0;
    p.completeQuest = (key, o) => {
        p.completed.push([key, o]);
        p.questStages[key] = -1;
    };

    const add = p.inventory.add;

    p.inventory.add = (id, amount = 1) => {
        add(id, amount);
        p.inventory.items.filter((it) => it.id === id).forEach((it) => (it.definition = ITEMS[id]));
    };
    p.inventory.items.forEach((it) => (it.definition = ITEMS[it.id]));
    p.sendTeleportBubble = (x, y, type) => (p.bubbles = p.bubbles || []).push([x, y, type]);
    p.skills.hits = { base: opts.hits || 50, current: opts.hits || 50 };
    p.skills.attack = { base: 40, current: 40 };
    p.skills.agility = { base: (opts.levels && opts.levels.agility) || 30, current: (opts.levels && opts.levels.agility) || 30 };

    return p;
}

function obj(id, x, y, direction = 0, commands) {
    const o = gameObject(id, x, y, commands);

    o.direction = direction;
    o.index = x * 10000 + y;

    return o;
}

const count = (p, id) => p.inventory.count(id);
const stage = (p) => p.questStages.undergroundPass;

async function withRandom(value, fn) {
    const real = Math.random;

    Math.random = () => value;

    try {
        return await fn();
    } finally {
        Math.random = real;
    }
}

test('every exported hook is a plugin type', () => {
    for (const plugin of [koftik, dwarves, creatures, kardia, map1, agility, map2, orbs, floor, temple, itemsPlugin]) {
        for (const name of Object.keys(plugin)) {
            if (name.startsWith('on')) {
                assert.ok(PLUGIN_TYPES.includes(name), name);
            }
        }
    }
});

test('every object, npc and item id the port uses exists in rsc-data', () => {
    const objects = require('@2003scape/rsc-data/config/objects');
    const npcs = require('@2003scape/rsc-data/config/npcs');

    for (const id of Object.values(shared.OBJECT)) {
        assert.ok(objects[id] || require('@2003scape/rsc-data/config/wall-objects')[id], `object ${id}`);
    }

    for (const id of Object.values(shared.NPC)) {
        assert.ok(npcs[id], `npc ${id}`);
    }

    for (const id of Object.values(shared.ITEM)) {
        assert.ok(ITEMS[id], `item ${id}`);
    }
});

// ---- stage 1 -> 2: Koftik, the cave entrance --------------------------------------------------------------------------------------

test('stage 1: Koftik in Ardougne tells of the pass and moves the quest to 2; the menu answers differ', async () => {
    const p = player({ stage: 1, answers: [0] });
    const k = npc(NPC.KOFTIK_ARDOUGNE);

    assert.equal(await koftik.onTalkToNPC(p, k), true);
    assert.equal(stage(p), 2);
    assert.ok(k.said.includes("ok traveller, i'll catch up with you by the bridge"));
    assert.equal(p.interlocutor, null);

    const more = player({ stage: 1, answers: [1] });
    const k2 = npc(NPC.KOFTIK_ARDOUGNE);
    await koftik.onTalkToNPC(more, k2);
    assert.ok(k2.said.includes('no one knows'));

    const early = player({ stage: 0 });
    await koftik.onTalkToNPC(early, npc(NPC.KOFTIK_ARDOUGNE));
    assert.ok(early.messages.includes("koftik doesn't seem interested in talking"));
});

test('Koftik in Ardougne at stages 2 to -1', async () => {
    const two = player({ stage: 2 });
    const k = npc(NPC.KOFTIK_ARDOUGNE);
    await koftik.onTalkToNPC(two, k);
    assert.ok(k.said.includes("but you'll have to go in alone"));

    const three = player({ stage: 3 });
    const k3 = npc(NPC.KOFTIK_ARDOUGNE);
    await koftik.onTalkToNPC(three, k3);
    assert.ok(k3.said.includes("..straight ahead, i'll meet you further up"));

    const four = player({ stage: 4 });
    const k4 = npc(NPC.KOFTIK_ARDOUGNE);
    await koftik.onTalkToNPC(four, k4);
    assert.ok(k4.said.includes('it scares me in there'));

    const eight = player({ stage: 8, answers: [1] });
    const k8 = npc(NPC.KOFTIK_ARDOUGNE);
    await koftik.onTalkToNPC(eight, k8);
    assert.ok(k8.said.includes('good to hear, the sooner we find king Tyras..'));

    const eightNot = player({ stage: 8, answers: [0] });
    const k8b = npc(NPC.KOFTIK_ARDOUGNE);
    await koftik.onTalkToNPC(eightNot, k8b);
    assert.ok(k8b.said.includes('the king must know that ibans dead'));

    const done = player({ stage: -1 });
    const kd = npc(NPC.KOFTIK_ARDOUGNE);
    await koftik.onTalkToNPC(done, kd);
    assert.ok(kd.said.includes('im good, just keeping an eye out'));

    const idle = player({ stage: 6 });
    await koftik.onTalkToNPC(idle, npc(NPC.KOFTIK_ARDOUGNE));
    assert.ok(idle.messages.includes("koftik doesn't seem interested in talking"));
});

test('the cave entrance: refused before the king, Koftik at stage 1, in at stage 2 and later; the rock pile leads out', async () => {
    const cave = obj(725, 715, 580);

    const none = player({ stage: 0 });
    none.questStages.biohazard = 3;
    await koftik.onGameObjectCommandOne(none, cave);
    assert.ok(none.messages.includes('You must first complete the biohazard quest...'));

    const king = player({ stage: 0 });
    king.questStages.biohazard = -1;
    await koftik.onGameObjectCommandOne(king, cave);
    assert.ok(king.messages.includes('you must talk to king lathas before you can enter'));

    const one = player({ stage: 1, answers: [0] });
    const k = npc(NPC.KOFTIK_ARDOUGNE, { x: 713, y: 582 });
    one.world.npcList.push(k);
    await koftik.onGameObjectCommandOne(one, cave);
    assert.equal(stage(one), 2);

    const alone = player({ stage: 1 });
    await koftik.onGameObjectCommandOne(alone, cave);
    assert.equal(stage(alone), 1);

    for (const s of [2, 5, 8, -1]) {
        const p = player({ stage: s });
        await koftik.onGameObjectCommandOne(p, cave);
        assert.deepEqual(p.teleports, [[673, 3420]]);
    }

    const back = player({ stage: 3 });
    await koftik.onGameObjectCommandOne(back, obj(728, 672, 3420));
    assert.deepEqual(back.teleports, [[713, 581]]);
    assert.equal(await koftik.onGameObjectCommandOne(back, obj(100, 1, 1)), false);
});

test('Koftik in the cave: the damp cloth, his diary and what he says at each stage', async () => {
    const p = player({ stage: 2, answers: [1] });
    const k = npc(NPC.KOFTIK_CAVE1);
    await koftik.onTalkToNPC(p, k);
    assert.equal(count(p, ITEM.DAMP_CLOTH), 1);
    assert.ok(p.messages.includes('@que@@red@..these forces and continued on my way'));
    assert.ok(p.said.includes('it sounds like randas was losing it'));

    const litter = player({ stage: 2, answers: [0] });
    await koftik.onTalkToNPC(litter, npc(NPC.KOFTIK_CAVE1));
    assert.ok(litter.said.includes('not to worry, probably just litter'));

    const again = player({ stage: 5 });
    await koftik.onTalkToNPC(again, npc(NPC.KOFTIK_CAVE1));
    assert.equal(count(again, ITEM.DAMP_CLOTH), 1);
    assert.ok(again.messages.includes('koftik gives you a damp cloth'));

    const holder = player({ stage: 8, items: [ITEM.DAMP_CLOTH] });
    await koftik.onTalkToNPC(holder, npc(NPC.KOFTIK_CAVE1));
    assert.equal(count(holder, ITEM.DAMP_CLOTH), 1);

    const two = player({ stage: 3 });
    const k2 = npc(NPC.KOFTIK_CAVE2);
    await koftik.onTalkToNPC(two, k2);
    assert.ok(k2.said.includes('cold, i can feel it in my blood, so cold'));

    const three = player({ stage: 4 });
    const k3 = npc(NPC.KOFTIK_CAVE3);
    await koftik.onTalkToNPC(three, k3);
    assert.ok(k3.said.includes('are you ok?, i heard a rumble further down the cavern'));

    const three3 = player({ stage: 3 });
    const k33 = npc(NPC.KOFTIK_CAVE3);
    await koftik.onTalkToNPC(three3, k33);
    assert.ok(k33.said.includes("keep back foul beast of the nigh.. ,wait, it's you!"));

    const four = player({ stage: 5 });
    assert.equal(await koftik.onTalkToNPC(four, npc(NPC.KOFTIK_CAVE4)), true);
    assert.ok(four.messages.includes('The Koftik does not appear interested in talking'));

    assert.equal(await koftik.onTalkToNPC(four, npc(100)), false);
});

test('Koftik recovered leads the player out at stage 8 only', async () => {
    const p = player({ stage: 8 });
    await koftik.onTalkToNPC(p, npc(NPC.KOFTIK_RECOVERED));
    assert.deepEqual(p.teleports, [[714, 581]]);

    const before = player({ stage: 6 });
    await koftik.onTalkToNPC(before, npc(NPC.KOFTIK_RECOVERED));
    assert.deepEqual(before.teleports, []);
});

// ---- stage 2 -> 3: the lit arrow ----------------------------------------------------------------------------------------------------

test('the damp cloth wraps an arrow head, a fire lights it, the lit arrow shoots the bridge (ranged 25, a bow)', async () => {
    const p = player({ stage: 2, items: [ITEM.DAMP_CLOTH, 11] });
    const cloth = p.inventory.items[0];
    const arrows = p.inventory.items[1];

    assert.equal(await map1.onUseWithInventory(p, cloth, arrows), true);
    assert.equal(count(p, ITEM.DAMP_CLOTH), 0);
    assert.equal(count(p, 11), 0);
    assert.equal(count(p, ITEM.ARROW), 1);

    const notArrows = player({ items: [ITEM.DAMP_CLOTH, ITEM.ROPE] });
    assert.equal(await map1.onUseWithInventory(notArrows, notArrows.inventory.items[0], notArrows.inventory.items[1]), false);

    await map1.onUseWithGameObject(p, obj(97, 701, 3420), { id: ITEM.ARROW });
    assert.equal(count(p, ITEM.LIT_ARROW), 1);
    assert.equal(count(p, ITEM.ARROW), 0);

    const bridge = obj(726, 704, 3417, 2);
    const bow = 189;

    // no bow
    const nobow = player({ stage: 2, items: [ITEM.LIT_ARROW], levels: { ranged: 30 } });
    await map1.onUseWithGameObject(nobow, bridge, { id: ITEM.LIT_ARROW });
    assert.ok(nobow.messages.includes("first you'll need a bow"));
    assert.equal(count(nobow, ITEM.LIT_ARROW), 1);

    // ranged 24
    const low = player({ stage: 2, items: [ITEM.LIT_ARROW, bow], levels: { ranged: 24 } });
    low.x = 702;
    low.y = 3417;
    await map1.onUseWithGameObject(low, bridge, { id: ITEM.LIT_ARROW });
    assert.ok(low.messages.includes('@que@it burns out and has little effect'));
    assert.equal(stage(low), 2);
    assert.equal(count(low, ITEM.LIT_ARROW), 0);

    // the wrong tile
    const wrong = player({ stage: 2, items: [ITEM.LIT_ARROW, bow], levels: { ranged: 30 } });
    wrong.x = 690;
    wrong.y = 3420;
    await map1.onUseWithGameObject(wrong, bridge, { id: ITEM.LIT_ARROW });
    assert.equal(stage(wrong), 2);

    // a miss (1 in 5)
    const miss = player({ stage: 2, items: [ITEM.LIT_ARROW, bow], levels: { ranged: 30 } });
    miss.x = 702;
    miss.y = 3417;
    await withRandom(0.2, () => map1.onUseWithGameObject(miss, bridge, { id: ITEM.LIT_ARROW }));
    assert.ok(miss.messages.includes('the arrow just misses the rope'));
    assert.equal(stage(miss), 2);

    // a hit: stage 3 and the bridge swings down for 16 ticks
    const hit = player({ stage: 2, items: [ITEM.LIT_ARROW, bow], levels: { ranged: 30 } });
    hit.x = 702;
    hit.y = 3417;
    await withRandom(0.9, () => map1.onUseWithGameObject(hit, bridge, { id: ITEM.LIT_ARROW }));
    assert.equal(stage(hit), 3);
    assert.deepEqual(hit.world.timed, [[726, 727, 16]]);
    assert.deepEqual(hit.teleports, [[702, 3420], [706, 3420], [709, 3420]]);

    // a later stage keeps its stage
    const later = player({ stage: 6, items: [ITEM.LIT_ARROW, bow], levels: { ranged: 30 } });
    later.x = 702;
    later.y = 3417;
    await withRandom(0.9, () => map1.onUseWithGameObject(later, bridge, { id: ITEM.LIT_ARROW }));
    assert.equal(stage(later), 6);
});

// ---- the first cave -------------------------------------------------------------------------------------------------------------------

test('the carved rocks of the first cave are read', async () => {
    const p = player({ stage: 3 });

    await map1.onGameObjectCommandOne(p, obj(832, 675, 3422));
    assert.equal(p.sent.length, 1);
    assert.match(p.sent[0].message, /All those who thirst for knowledge/);

    await map1.onGameObjectCommandOne(p, obj(881, 730, 650, 3));
    assert.match(p.sent[1].message, /Leave this battered corpse be/);
});

test('rocks: a climber lands past the rock (agility), a slip hurts and keeps him; ledges drop down', async () => {
    const rock = obj(743, 692, 3412);
    const ok = player({ stage: 3, hits: 84 });
    ok.x = 691;
    ok.y = 3412;
    await withRandom(GOOD, () => map1.onGameObjectCommandOne(ok, rock));
    assert.deepEqual(ok.teleports, [[693, 3412]]);
    assert.deepEqual(ok.damaged, []);

    const slip = player({ stage: 3, hits: 84 });
    slip.x = 691;
    slip.y = 3412;
    await withRandom(BAD, () => map1.onGameObjectCommandOne(slip, rock));
    assert.deepEqual(slip.teleports, []);
    assert.deepEqual(slip.damaged, [3]);
    assert.ok(slip.said.includes('aargh'));

    // a rock of direction 0 from the north
    const north = player({ stage: 3 });
    north.x = 677;
    north.y = 3413;
    await withRandom(GOOD, () => map1.onGameObjectCommandOne(north, obj(739, 677, 3414, 0)));
    assert.deepEqual(north.teleports, [[677, 3415]]);

    const ledge = obj(732, 700, 3415, 2);
    const down = player({ stage: 3 });
    down.x = 699;
    down.y = 3415;
    await withRandom(GOOD, () => map1.onGameObjectCommandOne(down, ledge));
    assert.deepEqual(down.teleports, [[701, 3415]]);
    assert.ok(down.messages.includes('and drop down to the cave floor'));

    const wide = player({ stage: 3 });
    wide.x = 683;
    wide.y = 3430;
    await withRandom(GOOD, () => map1.onGameObjectCommandOne(wide, obj(753, 684, 3430, 2)));
    assert.deepEqual(wide.teleports, [[686, 3430]]);

    const fall = player({ stage: 3, hits: 84 });
    fall.x = 699;
    fall.y = 3415;
    await withRandom(BAD, () => map1.onGameObjectCommandOne(fall, ledge));
    assert.deepEqual(fall.damaged, [3]);
    assert.ok(fall.messages.includes('but you slip'));
});

test('the first swamp drags the player down to the crevasse; the spider swamp holds him', async () => {
    const p = player({ stage: 3, hits: 84 });
    await map1.onGameObjectCommandOne(p, obj(754, 688, 3420));
    assert.deepEqual(p.teleports.at(0), [674, 3462]);
    assert.deepEqual(p.teleports.at(-1), [690, 3461]);
    assert.equal(p.teleports.length, 8);
    assert.deepEqual(p.damaged, [3, 3]);

    const spider = player({ stage: 3 });
    await map1.onGameObjectCommandOne(spider, obj(795, 714, 3418));
    assert.ok(spider.messages.includes('@que@it clings to your feet, you cannot cross'));
    assert.deepEqual(spider.teleports, []);
});

test('rocks thrown onto the swamps cross them; the stalactites climb with a rope', async () => {
    const swamp = obj(754, 697, 3441, 2);
    const west = player({ stage: 3, items: [ITEM.ROCKS] });
    west.x = 695;
    west.y = 3441;
    await map1.onUseWithGameObject(west, swamp, { id: ITEM.ROCKS });
    assert.deepEqual(west.teleports, [[698, 3441], [700, 3441]]);
    assert.equal(count(west, ITEM.ROCKS), 0);
    assert.deepEqual(west.world.timedObjects, [{ id: 774, x: 697, y: 3441, direction: 2, ticks: 16 }]);

    const east = player({ stage: 3, items: [ITEM.ROCKS] });
    east.x = 700;
    east.y = 3441;
    await map1.onUseWithGameObject(east, swamp, { id: ITEM.ROCKS });
    assert.deepEqual(east.teleports, [[698, 3441], [695, 3441]]);

    const spider = obj(795, 714, 3418);
    const north = player({ stage: 3, items: [ITEM.ROCKS] });
    north.x = 714;
    north.y = 3419;
    await map1.onUseWithGameObject(north, spider, { id: ITEM.ROCKS });
    assert.deepEqual(north.teleports, [[715, 3416]]);

    const south = player({ stage: 3, items: [ITEM.ROCKS] });
    south.x = 714;
    south.y = 3417;
    await map1.onUseWithGameObject(south, spider, { id: ITEM.ROCKS });
    assert.deepEqual(south.teleports, [[713, 3420]]);

    for (const [id, to] of [[771, [695, 3435]], [798, [677, 3435]], [799, [682, 3436]]]) {
        const p = player({ stage: 3, items: [ITEM.ROPE] });
        await map1.onUseWithGameObject(p, obj(id, 697, 3436), { id: ITEM.ROPE });
        assert.deepEqual(p.teleports, [to]);
        assert.equal(count(p, ITEM.ROPE), 1);
    }

    assert.equal(await map1.onUseWithGameObject(west, swamp, { id: 100 }), false);
});

test('clearing the rocks springs a trap: damage a fifth of the hits level and a trap look for 5 ticks', async () => {
    const p = player({ stage: 3, hits: 50 });
    p.x = 678;
    p.y = 3434;
    const east = obj(797, 679, 3434);
    p.world.objectList.push(east);
    await map1.onGameObjectCommandOne(p, east);
    assert.deepEqual(p.teleports, [[680, 3434]]);
    assert.deepEqual(p.damaged, [10]);
    assert.deepEqual(p.world.replaced, [[797, 772]]);
    assert.ok(p.messages.includes("@que@You've triggered a trap"));

    const stalactite = player({ stage: 3 });
    stalactite.x = 695;
    stalactite.y = 3436;
    await map1.onGameObjectCommandOne(stalactite, obj(772, 696, 3435));
    assert.deepEqual(stalactite.teleports, [[695, 3435]]);
    assert.deepEqual(stalactite.damaged, []);
});

test('trip wire rocks: stepping over springs the spear trap; a search disarms with a thieving check', async () => {
    const rock = obj(806, 695, 3449, 2);

    const step = player({ stage: 3, hits: 60 });
    step.x = 694;
    step.y = 3449;
    await map1.onGameObjectCommandOne(step, rock);
    assert.deepEqual(step.teleports, [[695, 3449]]);
    assert.deepEqual(step.damaged, [11]);
    assert.deepEqual(step.world.timed, [[806, 805, 8]]);

    const disarm = player({ stage: 3, answers: [0] });
    disarm.x = 694;
    disarm.y = 3449;
    await withRandom(GOOD, () => map1.onGameObjectCommandTwo(disarm, rock));
    assert.deepEqual(disarm.teleports, [[696, 3449]]);
    assert.deepEqual(disarm.damaged, []);

    const reverse = player({ stage: 3, answers: [0] });
    reverse.x = 696;
    reverse.y = 3449;
    await withRandom(GOOD, () => map1.onGameObjectCommandTwo(reverse, rock));
    assert.deepEqual(reverse.teleports, [[694, 3449]]);

    const fail = player({ stage: 3, answers: [0], levels: { thieving: 30 }, hits: 60 });
    fail.x = 694;
    fail.y = 3449;
    await withRandom(BAD, () => map1.onGameObjectCommandTwo(fail, rock));
    assert.deepEqual(fail.teleports, [[695, 3449]]);
    assert.deepEqual(fail.damaged, [11]);
    assert.ok(fail.messages.includes('but the trap activates'));

    const away = player({ stage: 3, answers: [1] });
    await map1.onGameObjectCommandTwo(away, rock);
    assert.ok(away.messages.includes('you back away from the trap'));
});

test('the mud pile of the first cave leads up by the swamp', async () => {
    const p = player({ stage: 3 });
    await map1.onGameObjectCommandOne(p, obj(767, 672, 3462, 6));
    assert.deepEqual(p.teleports, [[685, 3420]]);
});

// ---- the black area -------------------------------------------------------------------------------------------------------------------

test('ledges link the pockets of the cave; the destination depends on the stage', async () => {
    const cases = [
        [862, 3, [730, 3494]],
        [864, 3, [734, 3496]],
        [864, 4, [751, 3496]],
        [864, -1, [751, 3496]],
        [863, 3, [763, 3442]],
        [872, 3, [748, 3497]],
        [872, 6, [765, 3497]],
        [865, 3, [728, 3499]],
        [866, 3, [738, 3501]],
        [866, 5, [755, 3501]]
    ];

    for (const [id, s, to] of cases) {
        const p = player({ stage: s });
        await withRandom(GOOD, () => agility.onGameObjectCommandOne(p, obj(id, 732, 3494, 2)));
        assert.deepEqual(p.teleports, [to], `${id} at ${s}`);
    }

    const slip = player({ stage: 3 });
    await withRandom(BAD, () => agility.onGameObjectCommandOne(slip, obj(862, 750, 3496, 6)));
    assert.deepEqual(slip.teleports, []);
    assert.deepEqual(slip.damaged, [2]);
    assert.ok(slip.messages.includes('but you loose your footing'));
});

test('stage 4: the north stone step drops the player into the black area (stage 5); later it is a stair', async () => {
    const step = obj(889, 773, 3418);

    const p = player({ stage: 4, hits: 50 });
    await agility.onGameObjectCommandOne(p, step);
    assert.equal(stage(p), 5);
    assert.deepEqual(p.teleports, [[738, 584]]);
    assert.deepEqual(p.damaged, [15]);
    assert.ok(p.said.includes('ouch!'));

    const walk = player({ stage: 3 });
    await agility.onGameObjectCommandOne(walk, step);
    assert.deepEqual(walk.teleports, [[766, 585]]);
    assert.equal(stage(walk), 3);

    const south = player({ stage: 6 });
    await agility.onGameObjectCommandOne(south, obj(921, 783, 3549, 2));
    assert.deepEqual(south.teleports, [[739, 667]]);
});

test('the first remaining bridge: success crosses (776 or 773), a fall lands at 738,584; Koftik warns once', async () => {
    const bridge = obj(891, 774, 3417, 6);

    const east = player({ stage: 6 });
    east.x = 773;
    east.y = 3417;
    await withRandom(GOOD, () => agility.onGameObjectCommandOne(east, bridge));
    assert.deepEqual(east.teleports, [[776, 3417]]);

    const west = player({ stage: 6 });
    west.x = 777;
    west.y = 3417;
    await withRandom(GOOD, () => agility.onGameObjectCommandOne(west, bridge));
    assert.deepEqual(west.teleports, [[773, 3417]]);

    const koftikNear = npc(NPC.KOFTIK_RECOVERED, { x: 738, y: 584 });
    const fall = player({ stage: 6, hits: 50 });
    fall.world.npcList.push(koftikNear);
    await withRandom(BAD, () => agility.onGameObjectCommandOne(fall, bridge));
    assert.deepEqual(fall.teleports, [[738, 584]]);
    assert.deepEqual(fall.damaged, [15]);
    assert.equal(stage(fall), 6);
    assert.ok(koftikNear.said.includes('leave?...leave?..this is my home now'));
    assert.equal(fall.cache.advised_koftik, true);

    // not twice
    const second = player({ stage: 6, cache: { advised_koftik: true } });
    const k2 = npc(NPC.KOFTIK_RECOVERED);
    second.world.npcList.push(k2);
    await withRandom(BAD, () => agility.onGameObjectCommandOne(second, bridge));
    assert.deepEqual(k2.said, []);
});

test('the stone bridges jump or cross by direction; a fall lands where the table says', async () => {
    const jump = obj(898, 804, 3426, 6);

    const p = player({ stage: 6 });
    p.x = 803;
    p.y = 3426;
    await withRandom(GOOD, () => agility.onGameObjectCommandOne(p, jump));
    assert.deepEqual(p.teleports, [[807, 3426]]);

    const back = player({ stage: 6 });
    back.x = 807;
    back.y = 3426;
    await withRandom(GOOD, () => agility.onGameObjectCommandOne(back, jump));
    assert.deepEqual(back.teleports, [[803, 3426]]);

    const south = player({ stage: 6 });
    south.x = 782;
    south.y = 3424;
    await withRandom(GOOD, () => agility.onGameObjectCommandOne(south, obj(892, 782, 3425, 0)));
    assert.deepEqual(south.teleports, [[782, 3428]]);

    const north = player({ stage: 6 });
    north.x = 782;
    north.y = 3428;
    await withRandom(GOOD, () => agility.onGameObjectCommandOne(north, obj(892, 782, 3425, 0)));
    assert.deepEqual(north.teleports, [[782, 3424]]);

    const fall = player({ stage: 6, hits: 50 });
    await withRandom(BAD, () => agility.onGameObjectCommandOne(fall, obj(898, 804, 3426, 6)));
    assert.deepEqual(fall.teleports, [[756, 591]]);

    const walk = player({ stage: 6 });
    walk.x = 800;
    walk.y = 3438;
    await withRandom(GOOD, () => agility.onGameObjectCommandOne(walk, obj(893, 801, 3438, 0)));
    assert.deepEqual(walk.teleports, [[804, 3438]]);
    assert.ok(walk.messages.includes('@que@you attempt to walk over the remaining bridge..'));

    // every bridge has a fall landing
    for (const id of [898, 893, 892, 896, 910, 907, 906, 905, 904, 908, 909, 902, 903, 901, 895, 899, 900, 894, 897]) {
        const f = player({ stage: 6 });
        await withRandom(BAD, () => agility.onGameObjectCommandOne(f, obj(id, 800, 3500)));
        assert.equal(f.teleports.length, 1, `${id}`);
    }
});

// ---- 3 -> 4: the second cave -------------------------------------------------------------------------------------------------------

test('stage 3: the railing from the unicorn cage tips the boulder (stage 4)', async () => {
    const boulder = obj(867, 761, 3500);
    const p = player({ stage: 3, items: [ITEM.RAILING] });

    await map2.onUseWithGameObject(p, boulder, { id: ITEM.RAILING });
    assert.equal(stage(p), 4);
    assert.ok(p.messages.includes('it tumbles down the slope'));
    assert.deepEqual(p.world.removedObjects, [867]);

    const early = player({ stage: 2, items: [ITEM.RAILING] });
    await map2.onUseWithGameObject(early, boulder, { id: ITEM.RAILING });
    assert.equal(stage(early), 2);

    const done = player({ stage: 6, items: [ITEM.RAILING] });
    await map2.onUseWithGameObject(done, boulder, { id: ITEM.RAILING });
    assert.equal(stage(done), 6);
});

test('the cage remains give the horn before stage 5; the crate gives food once', async () => {
    const remains = obj(871, 761, 3499);

    const p = player({ stage: 3 });
    await map2.onGameObjectCommandOne(p, remains);
    assert.equal(count(p, ITEM.UNICORN_HORN), 1);
    await map2.onGameObjectCommandOne(p, remains);
    assert.equal(count(p, ITEM.UNICORN_HORN), 1);
    assert.ok(p.messages.includes('nothing remains'));

    const late = player({ stage: 5 });
    await map2.onGameObjectCommandOne(late, remains);
    assert.equal(count(late, ITEM.UNICORN_HORN), 0);

    const crate = obj(868, 725, 3463);
    const c = player({ stage: 3 });
    await map2.onGameObjectCommandTwo(c, crate);
    assert.equal(count(c, ITEM.SALMON), 2);
    assert.equal(count(c, ITEM.MEAT_PIE), 2);
    assert.equal(c.cache.crate_food, true);
    await map2.onGameObjectCommandTwo(c, crate);
    assert.equal(count(c, ITEM.SALMON), 2);
});

test('the Flames of Zamorak take the horn, the red arms and two blue arms; the Gate of Iban then opens', async () => {
    const flames = obj(830, 760, 3416, 6);
    const p = player({ stage: 4, items: [ITEM.UNICORN_HORN, ITEM.COAT_OF_ARMS_RED, ITEM.COAT_OF_ARMS_BLUE, ITEM.COAT_OF_ARMS_BLUE] });
    const gate = obj(722, 764, 3417);

    await map2.onGameObjectCommandOne(p, gate);
    assert.ok(p.messages.includes('the door refuses to open'));

    await map2.onUseWithGameObject(p, flames, { id: ITEM.UNICORN_HORN, definition: ITEMS[ITEM.UNICORN_HORN] });
    assert.equal(p.cache.flames_of_zamorak1, true);
    assert.ok(p.messages.includes('@que@you throw the unicorn horn into the flames'));
    await map2.onUseWithGameObject(p, flames, { id: ITEM.COAT_OF_ARMS_RED, definition: ITEMS[ITEM.COAT_OF_ARMS_RED] });
    assert.equal(p.cache.flames_of_zamorak2, true);
    await map2.onUseWithGameObject(p, flames, { id: ITEM.COAT_OF_ARMS_BLUE, definition: ITEMS[ITEM.COAT_OF_ARMS_BLUE] });
    assert.equal(p.cache.flames_of_zamorak3, 1);
    p.messages.length = 0;
    await map2.onGameObjectCommandOne(p, gate);
    assert.ok(p.messages.includes('the door refuses to open'));
    await map2.onUseWithGameObject(p, flames, { id: ITEM.COAT_OF_ARMS_BLUE, definition: ITEMS[ITEM.COAT_OF_ARMS_BLUE] });
    assert.equal(p.cache.flames_of_zamorak3, 2);
    assert.equal(count(p, ITEM.UNICORN_HORN) + count(p, ITEM.COAT_OF_ARMS_RED) + count(p, ITEM.COAT_OF_ARMS_BLUE), 0);

    p.messages.length = 0;
    p.teleports.length = 0;
    await map2.onGameObjectCommandOne(p, gate);
    assert.ok(p.messages.includes('the door slowly creeks open'));
    assert.deepEqual(p.teleports, [[766, 3417], [770, 3417]]);
    assert.deepEqual(p.world.timed, [[722, 723, 5]]);

    // the stages after the doll let anyone in
    const later = player({ stage: 7 });
    await map2.onGameObjectCommandOne(later, gate);
    assert.deepEqual(later.teleports, [[766, 3417], [770, 3417]]);

    // the flames inscription
    await map2.onGameObjectCommandOne(p, flames);
    assert.match(p.sent.at(-1).message, /Feed me three crests/);

    const out = player({ stage: 7 });
    await map2.onGameObjectCommandOne(out, obj(875, 768, 3416, 4));
    assert.deepEqual(out.teleports, [[766, 3417], [763, 3417]]);
});

test('after Iban the flames only burn the item; the staff of Iban is recharged at them', async () => {
    const flames = obj(830, 760, 3416, 6);
    const done = player({ stage: 8, items: [ITEM.UNICORN_HORN] });

    await map2.onUseWithGameObject(done, flames, { id: ITEM.UNICORN_HORN, definition: ITEMS[ITEM.UNICORN_HORN] });
    assert.equal(done.cache.flames_of_zamorak1, undefined);
    assert.equal(count(done, ITEM.UNICORN_HORN), 0);

    const staff = player({ stage: -1, items: [ITEM.STAFF_OF_IBAN], cache: { 'Iban blast_casts': 0 } });
    await map2.onUseWithGameObject(staff, flames, { id: ITEM.STAFF_OF_IBAN });
    assert.equal(staff.cache['Iban blast_casts'], 25);
    assert.equal(staff.bubbles.length, 1);
});

test('second cave climbing: mud piles, dug-up soil, the ledge, the grills, the hijack rock, the spiked rocks', async () => {
    const piles = [[841, [727, 3448]], [843, [753, 3481]], [844, [753, 3475]], [845, [743, 3483]], [846, [740, 3476]], [847, [735, 3478]]];

    for (const [id, to] of piles) {
        const p = player({ stage: 3 });
        await map2.onGameObjectCommandOne(p, obj(id, 722, 3461, 6));
        assert.deepEqual(p.teleports, [to], `${id}`);
    }

    const soil = player({ stage: 3, answers: [1] });
    await map2.onGameObjectCommandOne(soil, obj(840, 746, 3470));
    assert.deepEqual(soil.teleports, [[745, 3457]]);

    const soil2 = player({ stage: 3, answers: [1] });
    await map2.onGameObjectCommandOne(soil2, obj(839, 743, 3457, 2));
    assert.deepEqual(soil2.teleports, [[747, 3470]]);

    const scared = player({ stage: 3, answers: [0] });
    await map2.onGameObjectCommandOne(scared, obj(839, 743, 3457, 2));
    assert.deepEqual(scared.teleports, []);

    const ledge = obj(837, 764, 3464, 4);
    const up = player({ stage: 3 });
    await withRandom(0.9, () => map2.onGameObjectCommandTwo(up, ledge));
    assert.deepEqual(up.teleports, [[764, 3463]]);

    const slip = player({ stage: 3, hits: 84 });
    await withRandom(0, () => map2.onGameObjectCommandTwo(slip, ledge));
    assert.deepEqual(slip.teleports, []);
    assert.deepEqual(slip.damaged, [3]);

    const jump = player({ stage: 3, hits: 50 });
    await map2.onGameObjectCommandOne(jump, ledge);
    assert.deepEqual(jump.teleports, [[764, 3461], [764, 3467]]);
    assert.deepEqual(jump.damaged, [15]);

    const grill = obj(836, 762, 3463, 4);
    const high = player({ stage: 3 });
    await map2.onGameObjectCommandOne(high, grill);
    assert.ok(high.messages.includes('@que@the wall grill is too high'));

    const rope = player({ stage: 3, items: [ITEM.ROPE] });
    rope.x = 763;
    rope.y = 3463;
    await map2.onUseWithGameObject(rope, grill, { id: ITEM.ROPE });
    assert.ok(rope.messages.includes("you can't reach the grill from here"));
    assert.equal(rope.cache.rope_wall_grill, undefined);
    rope.x = 762;
    rope.y = 3464;
    await map2.onUseWithGameObject(rope, grill, { id: ITEM.ROPE });
    assert.equal(rope.cache.rope_wall_grill, true);
    assert.equal(count(rope, ITEM.ROPE), 1);
    await map2.onGameObjectCommandOne(rope, grill);
    assert.deepEqual(rope.teleports, [[762, 3472]]);

    const west = player({ stage: 3 });
    await map2.onGameObjectCommandOne(west, obj(838, 766, 3472));
    assert.deepEqual(west.teleports, [[766, 3463]]);

    const hijack = player({ stage: 3 });
    hijack.x = 734;
    hijack.y = 3478;
    await withRandom(0.1, () => map2.onGameObjectCommandOne(hijack, obj(856, 734, 3479)));
    assert.deepEqual(hijack.teleports, [[735, 3479]]);

    const hijackSlip = player({ stage: 3, hits: 50 });
    await withRandom(0.9, () => map2.onGameObjectCommandOne(hijackSlip, obj(856, 734, 3479)));
    assert.deepEqual(hijackSlip.teleports, [[734, 3483]]);
    assert.deepEqual(hijackSlip.damaged, [15]);

    // spiked rocks: a fall lands in the pit of that rock
    for (const [id, pit] of [[851, [748, 3482]], [852, [738, 3483]], [853, [736, 3475]], [859, [730, 3478]], [849, [743, 3475]]]) {
        const p = player({ stage: 3, hits: 50 });
        await withRandom(BAD, () => map2.onGameObjectCommandOne(p, obj(id, 745, 3480)));
        assert.deepEqual(p.teleports, [pit], `${id}`);
        assert.deepEqual(p.damaged, [15]);
    }
});

test('pressure passages spring a snap trap; planks cross them', async () => {
    const passage = obj(873, 737, 3489, 2);
    const p = player({ stage: 3, hits: 50 });

    await map2.onGameObjectCommandOne(p, passage);
    assert.deepEqual(p.teleports, [[737, 3489]]);
    assert.deepEqual(p.damaged, [15]);
    assert.deepEqual(p.world.timed, [[873, 826, 8]]);

    const plank = player({ stage: 3, items: [ITEM.PLANK] });
    await map2.onUseWithGameObject(plank, passage, { id: ITEM.PLANK });
    assert.deepEqual(plank.teleports, [[735, 3489], [732, 3489]]);
    assert.equal(count(plank, ITEM.PLANK), 0);
});

// ---- 4 -> 5 -> 6: the dwarves ----------------------------------------------------------------------------------------------------

test('stage 5: Niloof sends the player to the witch with food (stage 6)', async () => {
    const p = player({ stage: 5 });
    const n = npc(NPC.NILOOF);

    await dwarves.onTalkToNPC(p, n);
    assert.equal(stage(p), 6);
    assert.equal(count(p, ITEM.MEAT_PIE), 2);
    assert.equal(count(p, ITEM.CHOCOLATE_BOMB), 1);
    assert.equal(count(p, ITEM.MEAT_PIZZA), 1);
    assert.ok(n.said.includes('seek out the witch, his guide , his only confidante'));
});

test('stage 6: Niloof before and after the witch chest; stage 7 returns a lost doll; later he is busy', async () => {
    const before = player({ stage: 6 });
    const n = npc(NPC.NILOOF);
    await dwarves.onTalkToNPC(before, n);
    assert.ok(n.said.includes('you must go above and find the witch kardia'));

    // the doll and no book
    const noBook = player({ stage: 6, cache: { doll_of_iban: true }, items: [ITEM.A_DOLL_OF_IBAN] });
    await dwarves.onTalkToNPC(noBook, npc(NPC.NILOOF));
    assert.equal(count(noBook, ITEM.OLD_JOURNAL), 1);

    // the doll is lost
    const lost = player({ stage: 6, cache: { doll_of_iban: true }, items: [ITEM.OLD_JOURNAL] });
    const n2 = npc(NPC.NILOOF);
    await dwarves.onTalkToNPC(lost, n2);
    assert.equal(count(lost, ITEM.A_DOLL_OF_IBAN), 1);
    assert.ok(n2.said.includes('his shadow, his flesh, his conscience and his blood'));

    // both
    const both = player({ stage: 6, cache: { doll_of_iban: true }, items: [ITEM.OLD_JOURNAL, ITEM.A_DOLL_OF_IBAN] });
    const n3 = npc(NPC.NILOOF);
    await dwarves.onTalkToNPC(both, n3);
    assert.ok(n3.said.includes('iban was magically conjured in that very item'));

    const seven = player({ stage: 7 });
    await dwarves.onTalkToNPC(seven, npc(NPC.NILOOF));
    assert.equal(count(seven, ITEM.A_DOLL_OF_IBAN), 1);

    const eight = player({ stage: 8 });
    await dwarves.onTalkToNPC(eight, npc(NPC.NILOOF));
    assert.ok(eight.messages.includes('the dwarf seems to be busy'));
});

test('Klank gives the gauntlets with the doll, sells them for 5000 afterwards; Kamen sells a strong sip', async () => {
    const gift = player({ stage: 6, cache: { doll_of_iban: true } });
    await dwarves.onTalkToNPC(gift, npc(NPC.KLANK));
    assert.equal(count(gift, ITEM.KLANKS_GAUNTLETS), 1);
    assert.equal(count(gift, ITEM.TINDERBOX), 1);

    const talk = player({ stage: 5, answers: [0] });
    await dwarves.onTalkToNPC(talk, npc(NPC.KLANK));
    assert.equal(count(talk, ITEM.TINDERBOX), 1);
    const joke = player({ stage: 5, answers: [1] });
    await dwarves.onTalkToNPC(joke, npc(NPC.KLANK));
    assert.equal(count(joke, ITEM.TINDERBOX), 1);

    const buy = player({ stage: 8, items: [[ITEM.COINS, 5000]], answers: [0, 1] });
    await dwarves.onTalkToNPC(buy, npc(NPC.KLANK));
    assert.equal(count(buy, ITEM.KLANKS_GAUNTLETS), 1);
    assert.equal(count(buy, ITEM.COINS), 0);

    const poor = player({ stage: -1, answers: [0, 1] });
    await dwarves.onTalkToNPC(poor, npc(NPC.KLANK));
    assert.equal(count(poor, ITEM.KLANKS_GAUNTLETS), 0);

    const joking = player({ stage: -1, answers: [0, 0] });
    const k = npc(NPC.KLANK);
    await dwarves.onTalkToNPC(joking, k);
    assert.ok(k.said.includes("we don't joke down here, friend"));

    const bye = player({ stage: 7, answers: [1] });
    await dwarves.onTalkToNPC(bye, npc(NPC.KLANK));

    const sip = player({ stage: 6, answers: [0], hits: 50 });
    await dwarves.onTalkToNPC(sip, npc(NPC.KAMEN));
    assert.deepEqual(sip.damaged, [5]);

    const no = player({ stage: 6, answers: [1] });
    const kamen = npc(NPC.KAMEN);
    await dwarves.onTalkToNPC(no, kamen);
    assert.ok(kamen.said.includes('your losh'));
    assert.equal(await dwarves.onTalkToNPC(no, npc(100)), false);
});

// ---- Kardia's house ---------------------------------------------------------------------------------------------------------------------

test("Kardia's door blasts the player, takes the cat, then lets him in; the chest gives the doll at stage 6", async () => {
    const door = wallObject(173, 773, 3536, 0);
    const witch = npc(NPC.KARDIA, { x: 773, y: 3537 });

    const blast = player({ stage: 6, hits: 50 });
    blast.world.npcList.push(witch);
    await kardia.onWallObjectCommandOne(blast, door);
    assert.deepEqual(blast.damaged, [15]);
    assert.ok(witch.said.includes('haa haa.. die mortal'));
    assert.equal(blast.bubbles.length, 1);

    const alone = player({ stage: 6 });
    await kardia.onWallObjectCommandOne(alone, door);
    assert.ok(alone.messages.includes('but nothing seems to happen'));

    const knock = player({ stage: 6 });
    await kardia.onWallObjectCommandTwo(knock, door);
    assert.ok(knock.messages.includes('there is no reply'));

    const cat = player({ stage: 6, items: [ITEM.KARDIA_CAT] });
    await kardia.onWallObjectCommandTwo(cat, door);
    assert.equal(count(cat, ITEM.KARDIA_CAT), 0);
    assert.deepEqual(cat.teleports, [[776, 3535]]);
    assert.equal(cat.cache.kardia_cat, true);

    await kardia.onWallObjectCommandTwo(cat, door);
    assert.ok(cat.messages.includes('inside you can hear the witch talking to her cat'));

    cat.messages.length = 0;
    await kardia.onWallObjectCommandOne(cat, door);
    assert.deepEqual(cat.doors, [[173, undefined]]);
    assert.ok(cat.messages.includes('the witch is busy talking to the cat'));

    const used = player({ stage: 6, items: [ITEM.KARDIA_CAT] });
    await kardia.onUseWithWallObject(used, door, { id: ITEM.KARDIA_CAT });
    assert.equal(used.cache.kardia_cat, true);
    used.inventory.add(ITEM.KARDIA_CAT);
    await kardia.onUseWithWallObject(used, door, { id: ITEM.KARDIA_CAT });
    assert.ok(used.messages.includes('with her other cat'));
    assert.equal(await kardia.onUseWithWallObject(used, door, { id: 100 }), false);

    const railing = player({ stage: 6 });
    assert.equal(await kardia.onWallObjectCommandOne(railing, wallObject(172, 776, 3537, 1)), true);
    assert.ok(railing.messages.includes("her appearence make's you feel quite ill"));

    const chest = obj(885, 773, 3538);
    const c = player({ stage: 6 });
    await kardia.onGameObjectCommandTwo(c, chest);
    assert.equal(count(c, ITEM.A_DOLL_OF_IBAN), 1);
    assert.equal(count(c, ITEM.OLD_JOURNAL), 1);
    assert.equal(count(c, ITEM.FULL_SUPER_ATTACK_POTION), 1);
    assert.equal(count(c, ITEM.FULL_STAT_RESTORATION_POTION), 1);
    assert.equal(c.cache.doll_of_iban, true);
    await kardia.onGameObjectCommandTwo(c, chest);
    assert.equal(count(c, ITEM.A_DOLL_OF_IBAN), 1);

    const early = player({ stage: 5 });
    await kardia.onGameObjectCommandTwo(early, chest);
    assert.equal(count(early, ITEM.A_DOLL_OF_IBAN), 0);
});

test('the cat cannot be picked up twice; an orb cannot either', async () => {
    const twice = player({ stage: 6, items: [ITEM.KARDIA_CAT] });
    assert.equal(await kardia.onGroundItemTake(twice, { id: ITEM.KARDIA_CAT }), true);
    assert.ok(twice.messages.includes("...two's just plain cruel!"));
    const once = player({ stage: 6 });
    assert.equal(await kardia.onGroundItemTake(once, { id: ITEM.KARDIA_CAT }), false);

    const orb = player({ stage: 6, items: [ITEM.ORB_OF_LIGHT_BLUE] });
    assert.equal(await orbs.onGroundItemTake(orb, { id: ITEM.ORB_OF_LIGHT_BLUE }), true);
    assert.ok(orb.messages.includes('you are already carrying this orb'));
    assert.equal(await orbs.onGroundItemTake(orb, { id: ITEM.ORB_OF_LIGHT_WHITE }), false);
});

// ---- the orbs and the well --------------------------------------------------------------------------------------------------------

test('orbs thrown into the furnace set their flag (not after the doll); the well needs all four', async () => {
    const furnace = obj(813, 706, 3453);
    const pairs = [
        [ITEM.ORB_OF_LIGHT_WHITE, 'orb_of_light1'],
        [ITEM.ORB_OF_LIGHT_BLUE, 'orb_of_light2'],
        [ITEM.ORB_OF_LIGHT_PINK, 'orb_of_light3'],
        [ITEM.ORB_OF_LIGHT_YELLOW, 'orb_of_light4']
    ];
    const p = player({ stage: 3, items: pairs.map(([id]) => id) });
    const well = obj(814, 727, 3447);

    for (const [id, key] of pairs) {
        await floor.onGameObjectCommandOne(p, well);
        await orbs.onUseWithGameObject(p, furnace, { id });
        assert.equal(p.cache[key], true);
        assert.equal(count(p, id), 0);
    }

    // three burnt: the well blasts him out (a fifth of 50 hits)
    const three = player({ stage: 3, hits: 50, cache: { orb_of_light1: true, orb_of_light2: true, orb_of_light3: true } });
    await floor.onGameObjectCommandOne(three, well);
    assert.deepEqual(three.damaged, [10]);
    assert.deepEqual(three.teleports, []);

    p.teleports.length = 0;
    await floor.onGameObjectCommandOne(p, well);
    assert.deepEqual(p.teleports, [[722, 3461]]);

    const after = player({ stage: 8, items: [ITEM.ORB_OF_LIGHT_WHITE] });
    await orbs.onUseWithGameObject(after, furnace, { id: ITEM.ORB_OF_LIGHT_WHITE });
    assert.equal(after.cache.orb_of_light1, undefined);
    await floor.onGameObjectCommandOne(after, well);
    assert.deepEqual(after.teleports, [[722, 3461]]);
});

test('the north passage: pressure triggers hurt, planks cross, a search hints', async () => {
    const p = player({ stage: 3, hits: 50 });
    await orbs.onGameObjectCommandOne(p, obj(825, 728, 3440));
    assert.deepEqual(p.teleports, [[728, 3440]]);
    assert.deepEqual(p.damaged, [15]);

    const mid = player({ stage: 3 });
    await orbs.onGameObjectCommandOne(mid, obj(828, 728, 3438));
    assert.deepEqual(mid.teleports, [[728, 3438]]);
    const top = player({ stage: 3 });
    await orbs.onGameObjectCommandOne(top, obj(829, 728, 3436));
    assert.deepEqual(top.teleports, [[728, 3436]]);

    const search = player({ stage: 3 });
    await orbs.onGameObjectCommandTwo(search, obj(825, 728, 3440));
    assert.ok(search.messages.includes('@que@you may be able to wedge it open with something?'));

    const plank = player({ stage: 3, items: [ITEM.PLANK, ITEM.PLANK] });
    await orbs.onUseWithGameObject(plank, obj(825, 728, 3440), { id: ITEM.PLANK });
    assert.deepEqual(plank.teleports, [[728, 3438], [728, 3435]]);
    assert.equal(count(plank, ITEM.PLANK), 1);
    assert.equal(plank.world.timedObjects[0].id, 827);

    const planks2 = player({ stage: 3, items: [ITEM.PLANK] });
    await orbs.onUseWithGameObject(planks2, obj(829, 728, 3436), { id: ITEM.PLANK });
    assert.deepEqual(planks2.teleports, [[728, 3438], [728, 3441]]);
});

test('the west passage: clearing a rock moves on; a sprung trip wire throws the player back through the traps', async () => {
    const rock = obj(820, 739, 3446, 2);
    const clear = player({ stage: 3 });
    clear.x = 740;
    clear.y = 3446;
    // the rock to the west (x - 1 of the player)
    await orbs.onGameObjectCommandOne(clear, obj(820, 739, 3446, 2));
    assert.deepEqual(clear.teleports, [[738, 3446]]);

    // wire, success: steps over (to the west rock x == player.x - 1 -> x - 2)
    const over = player({ stage: 3, answers: [0] });
    over.x = 740;
    over.y = 3446;
    await withRandom(0.9, () => orbs.onGameObjectCommandTwo(over, rock));
    assert.deepEqual(over.teleports, [[738, 3446]]);

    const east = player({ stage: 3, answers: [0] });
    east.x = 738;
    east.y = 3446;
    await withRandom(0.9, () => orbs.onGameObjectCommandTwo(east, rock));
    assert.deepEqual(east.teleports, [[740, 3446]]);

    const back = player({ stage: 3, answers: [1] });
    await orbs.onGameObjectCommandTwo(back, rock);
    assert.deepEqual(back.teleports, []);

    // wire, brushed: thrown back, hit once per rock passed and by the first
    const brushed = player({ stage: 3, answers: [0], hits: 64 });
    brushed.x = 740;
    brushed.y = 3446;
    await withRandom(0, () => orbs.onGameObjectCommandTwo(brushed, rock));
    assert.ok(brushed.messages.includes('...but you brush against it'));
    assert.deepEqual(brushed.teleports.at(-1), [735, 3446]);
    assert.equal(brushed.damaged.length, 2);
    assert.ok(brushed.damaged.every((d) => d === 6));

    // from the far rock (824 is out of the list's reach of a plain clear: x not beside the player)
    const far = player({ stage: 3, hits: 64 });
    far.x = 760;
    far.y = 3446;
    await orbs.onGameObjectCommandOne(far, obj(824, 751, 3446, 2));
    assert.deepEqual(far.teleports.at(-1), [735, 3446]);
    assert.equal(far.damaged.length, 6);
    assert.deepEqual(far.teleports.slice(0, 5), [[747, 3446], [744, 3446], [741, 3446], [738, 3446], [735, 3446]]);

    const first = player({ stage: 3, hits: 64 });
    first.x = 740;
    first.y = 3446;
    await orbs.onGameObjectCommandOne(first, obj(819, 736, 3446, 2));
    assert.deepEqual(first.teleports, [[735, 3446]]);
    assert.deepEqual(first.damaged, [6]);
});

test('the south west passage: a rope on the stalagmite saves the fall; the grill climbs back', async () => {
    const stalagmite = obj(818, 738, 3452);

    const roped = player({ stage: 3, items: [ITEM.ROPE] });
    await orbs.onUseWithGameObject(roped, stalagmite, { id: ITEM.ROPE });
    assert.equal(roped.cache.stalagmite, true);
    assert.equal(count(roped, ITEM.ROPE), 0);
    await orbs.onGameObjectCommandOne(roped, obj(815, 740, 3452, 2));
    assert.deepEqual(roped.teleports, [[742, 3453], [716, 3481]]);
    assert.deepEqual(roped.damaged, []);

    await orbs.onGameObjectCommandOne(roped, stalagmite);
    assert.equal(count(roped, ITEM.ROPE), 1);
    assert.equal(roped.cache.stalagmite, undefined);

    const bare = player({ stage: 3, hits: 50 });
    await orbs.onGameObjectCommandOne(bare, obj(815, 740, 3452, 2));
    assert.deepEqual(bare.teleports, [[742, 3453], [709, 3472]]);
    assert.deepEqual(bare.damaged, [15]);

    await orbs.onGameObjectCommandOne(bare, stalagmite);
    assert.ok(bare.messages.includes('but find nothing'));

    const climb = player({ stage: 3 });
    await withRandom(0.9, () => orbs.onGameObjectCommandOne(climb, obj(816, 708, 3472, 4)));
    assert.deepEqual(climb.teleports, [[737, 3453]]);

    const fall = player({ stage: 3, hits: 50 });
    await withRandom(0, () => orbs.onGameObjectCommandOne(fall, obj(816, 708, 3472, 4)));
    assert.deepEqual(fall.teleports, []);
    assert.deepEqual(fall.damaged, [15]);

    const rope = player({ stage: 3 });
    await orbs.onGameObjectCommandOne(rope, obj(817, 715, 3481, 4));
    assert.deepEqual(rope.teleports, [[737, 3453]]);
});

// ---- the floor, the puzzle and the smears -------------------------------------------------------------------------------------------

test('the grill puzzle: each good grill steps forward, the bad one drops the player in the pit', async () => {
    const forward = [[777, [681, 3446]], [785, [683, 3446]], [786, [683, 3448]], [787, [685, 3448]], [788, [687, 3448]], [789, [687, 3450]], [790, [687, 3452]], [791, [689, 3452]]];

    for (const [id, to] of forward) {
        const p = player({ stage: 3 });
        await floor.onGameObjectCommandOne(p, obj(id, 680, 3447));
        assert.deepEqual(p.teleports, [to], `${id}`);
    }

    const bad = player({ stage: 3, hits: 50 });
    await floor.onGameObjectCommandOne(bad, obj(782, 688, 3445));
    assert.deepEqual(bad.teleports, [[711, 3464], [679, 3448]]);
    assert.deepEqual(bad.damaged, [10]);
    assert.deepEqual(bad.world.timed, [[782, 778, 2]]);

    const east = player({ stage: 3 });
    await floor.onGameObjectCommandOne(east, obj(792, 679, 3446));
    assert.deepEqual(east.teleports, [[679, 3447]]);
    const west = player({ stage: 3 });
    await floor.onGameObjectCommandOne(west, obj(793, 690, 3452));
    assert.deepEqual(west.teleports, [[690, 3452]]);
});

test("Iban's tomb: brew from the barrel, poured over the tomb, burnt with a tinderbox for the ashes (stage 6)", async () => {
    const tomb = obj(878, 724, 654, 6);
    const barrel = obj(880, 764, 665, 3);
    const p = player({ stage: 6, cache: { doll_of_iban: true }, items: [ITEM.TINDERBOX] });

    await floor.onGameObjectCommandOne(p, barrel);
    assert.ok(p.messages.includes('you need a bucket first'));
    p.inventory.add(ITEM.BUCKET);
    await floor.onGameObjectCommandOne(p, barrel);
    assert.equal(count(p, ITEM.DWARF_BREW), 1);
    assert.equal(count(p, ITEM.BUCKET), 0);

    await floor.onUseWithGameObject(p, tomb, { id: ITEM.TINDERBOX });
    assert.ok(p.messages.includes('but it will not light'));

    await floor.onUseWithGameObject(p, tomb, { id: ITEM.DWARF_BREW });
    assert.equal(p.cache.brew_on_tomb, true);
    assert.equal(count(p, ITEM.BUCKET), 1);

    await floor.onUseWithGameObject(p, tomb, { id: ITEM.TINDERBOX });
    assert.deepEqual(p.world.timed, [[878, 97, 16]]);
    assert.deepEqual(p.world.drops, [{ owner: p, id: ITEM.IBANS_ASHES, x: 726, y: 654 }]);
    assert.equal(p.cache.brew_on_tomb, undefined);

    const waste = player({ stage: 4, items: [ITEM.DWARF_BREW] });
    await floor.onUseWithGameObject(waste, tomb, { id: ITEM.DWARF_BREW });
    assert.ok(waste.messages.includes('but it seems such a waste'));
    assert.equal(count(waste, ITEM.DWARF_BREW), 1);

    const claws = player({ stage: 6, hits: 50 });
    await floor.onGameObjectCommandOne(claws, tomb);
    assert.deepEqual(claws.damaged, [15]);
    assert.equal(claws.world.timedObjects[0].id, 879);
});

test('the doll of Iban: ashes, the dove, the shadow (only at stage 6); searching it lists the smears', async () => {
    const p = player({ stage: 6, items: [ITEM.A_DOLL_OF_IBAN, ITEM.IBANS_ASHES, ITEM.IBANS_CONSCIENCE, ITEM.IBANS_SHADOW] });
    const doll = p.inventory.items[0];

    for (const [index, key] of [[1, 'ash_on_doll'], [2, 'cons_on_doll'], [3, 'shadow_on_doll']]) {
        const other = p.inventory.items.find((it) => it.id === [0, ITEM.IBANS_ASHES, ITEM.IBANS_CONSCIENCE, ITEM.IBANS_SHADOW][index]);
        assert.equal(await floor.onUseWithInventory(p, doll, other), true);
        assert.equal(p.cache[key], true);
    }

    assert.equal(count(p, ITEM.IBANS_ASHES) + count(p, ITEM.IBANS_CONSCIENCE) + count(p, ITEM.IBANS_SHADOW), 0);

    const late = player({ stage: 7, items: [ITEM.A_DOLL_OF_IBAN, ITEM.IBANS_ASHES] });
    await floor.onUseWithInventory(late, late.inventory.items[1], late.inventory.items[0]);
    assert.equal(late.cache.ash_on_doll, undefined);
    assert.equal(count(late, ITEM.IBANS_ASHES), 0);

    const unrelated = player({ stage: 6, items: [ITEM.A_DOLL_OF_IBAN, ITEM.ROPE] });
    assert.equal(await floor.onUseWithInventory(unrelated, unrelated.inventory.items[0], unrelated.inventory.items[1]), false);

    await itemsPlugin.onInventoryCommand(p, doll);
    assert.ok(p.messages.includes('@que@Blood has been smeared onto the doll') === false);
    assert.ok(p.messages.includes('@que@Burnt ash has been smeared onto the doll'));
    assert.ok(p.messages.includes('@que@Crushed bones have been smeared onto the doll'));
    assert.ok(p.messages.includes('@que@A dark liquid has been poured over the doll'));
    assert.ok(p.messages.includes('the doll is made from old wood and cloth'));
});

test('the ladder, the mud pile and the spider nest railing', async () => {
    const ladder = player({ stage: 3 });
    await floor.onGameObjectCommandOne(ladder, obj(920, 739, 668));
    assert.deepEqual(ladder.teleports, [[782, 3549]]);

    const mud = player({ stage: 3 });
    await floor.onGameObjectCommandOne(mud, obj(890, 766, 585, 2));
    assert.deepEqual(mud.teleports, [[773, 3417]]);

    const railing = wallObject(171, 727, 607, 0);

    const tight = player({ stage: 5 });
    await floor.onWallObjectCommandOne(tight, railing);
    assert.ok(tight.messages.includes("but you can't quite squeeze through"));

    const squeeze = player({ stage: 6, cache: { doll_of_iban: true }, answers: [1] });
    squeeze.y = 606;
    await floor.onWallObjectCommandTwo(squeeze, railing);
    assert.deepEqual(squeeze.teleports, [[727, 607]]);

    const back = player({ stage: -1, answers: [1] });
    back.y = 607;
    await floor.onWallObjectCommandOne(back, railing);
    assert.deepEqual(back.teleports, [[727, 606]]);

    const nope = player({ stage: 7, answers: [0] });
    await floor.onWallObjectCommandOne(nope, railing);
    assert.deepEqual(nope.teleports, []);
});

// ---- the creatures ---------------------------------------------------------------------------------------------------------------------

test('Kalrag: his blood smears the doll at stage 6 (not without it)', async () => {
    const kalrag = npc(NPC.KALRAG);

    const p = player({ stage: 6, items: [ITEM.A_DOLL_OF_IBAN] });
    assert.equal(await creatures.onNPCDeath(p, kalrag), false);
    await creatures.settle();
    assert.equal(p.cache.poison_on_doll, true);

    const noDoll = player({ stage: 6 });
    await creatures.onNPCDeath(noDoll, kalrag);
    await creatures.settle();
    assert.equal(noDoll.cache.poison_on_doll, undefined);
    assert.ok(noDoll.messages.includes('you dare not collect any without ibans doll'));

    const early = player({ stage: 4, items: [ITEM.A_DOLL_OF_IBAN] });
    await creatures.onNPCDeath(early, kalrag);
    await creatures.settle();
    assert.equal(early.cache.poison_on_doll, undefined);
});

test('the paladins give food at stage 4 once, then fight; their arms come off their bodies', async () => {
    const pal = npc(NPC.PALADIN_UNDERGROUND_BEARD);

    const fed = player({ stage: 4 });
    await withRandom(0, () => creatures.onTalkToNPC(fed, pal));
    assert.equal(count(fed, ITEM.MEAT_PIE), 2);
    assert.equal(count(fed, ITEM.STEW), 1);
    assert.equal(count(fed, ITEM.BREAD), 2);
    assert.equal(count(fed, ITEM.TWO_ATTACK_POTION), 1);
    assert.equal(count(fed, ITEM.TWO_RESTORE_PRAYER_POTION), 1);
    assert.equal(fed.cache.paladin_food, true);

    const second = player({ stage: 4 });
    await withRandom(0.9, () => creatures.onTalkToNPC(second, pal));
    assert.equal(count(second, ITEM.MEAT_PIE), 2);
    assert.ok(pal.said.includes("There's no doubt Iban still controls these caverns.."));

    const again = player({ stage: 4, cache: { paladin_food: true } });
    await withRandom(0, () => creatures.onTalkToNPC(again, pal));
    assert.equal(count(again, ITEM.MEAT_PIE), 0);

    const hostile = player({ stage: 5 });
    const pal2 = npc(NPC.PALADIN_UNDERGROUND_BEARD);
    await creatures.onTalkToNPC(hostile, pal2);
    assert.ok(pal2.said.includes('you again, die zamorakian scum'));
    hostile.world.runTimeouts();
    assert.equal(pal2.attacked.length, 1);

    const red = player({ stage: 4 });
    await creatures.onNPCDeath(red, pal);
    await creatures.settle();
    assert.equal(count(red, ITEM.COAT_OF_ARMS_RED), 1);
    await creatures.onNPCDeath(red, pal);
    await creatures.settle();
    assert.equal(count(red, ITEM.COAT_OF_ARMS_RED), 1);

    const blue = player({ stage: 4 });
    const palBlue = npc(NPC.PALADIN_UNDERGROUND);
    for (let i = 0; i < 3; i += 1) {
        await creatures.onNPCDeath(blue, palBlue);
        await creatures.settle();
    }
    assert.equal(count(blue, ITEM.COAT_OF_ARMS_BLUE), 2);
});

test('the demons: each drops its amulet with the doll and puts the player outside the circle', async () => {
    for (const [id, amulet, exit] of [[645, 1009, [796, 3541]], [646, 1010, [807, 3541]], [647, 1011, [807, 3528]]]) {
        const p = player({ stage: 6, cache: { doll_of_iban: true } });
        await creatures.onNPCDeath(p, npc(id));
        await creatures.settle();
        assert.equal(count(p, amulet), 1);
        assert.deepEqual(p.teleports, [exit]);
        await creatures.onNPCDeath(p, npc(id));
        await creatures.settle();
        assert.equal(count(p, amulet), 1);
    }

    const without = player({ stage: 4 });
    await creatures.onNPCDeath(without, npc(646));
    await creatures.settle();
    assert.equal(count(without, 1010), 0);
    assert.deepEqual(without.teleports, [[807, 3541]]);
});

test('the disciples: robes drop in the quest, the broken staff once after it; imposters are attacked', async () => {
    const disciple = npc(NPC.IBAN_DISCIPLE);

    const during = player({ stage: 6 });
    during.x = 790;
    during.y = 3460;
    await creatures.onNPCDeath(during, disciple);
    await creatures.settle();
    assert.deepEqual(
        during.world.drops.map((d) => [d.id, d.x, d.y]),
        [[702, 790, 3460], [703, 790, 3460]]
    );

    const after = player({ stage: -1 });
    await creatures.onNPCDeath(after, disciple);
    await creatures.settle();
    assert.equal(count(after, ITEM.STAFF_OF_IBAN_BROKEN), 1);
    await creatures.onNPCDeath(after, disciple);
    await creatures.settle();
    assert.equal(count(after, ITEM.STAFF_OF_IBAN_BROKEN), 1);

    const imposter = player({ stage: 6 });
    const d2 = npc(NPC.IBAN_DISCIPLE);
    await creatures.onTalkToNPC(imposter, d2);
    assert.ok(d2.said.includes('an imposter....die scum'));
    imposter.world.runTimeouts();
    assert.equal(d2.attacked.length, 1);

    const robed = player({ stage: 6, items: [ITEM.ROBE_OF_ZAMORAK_TOP, ITEM.ROBE_OF_ZAMORAK_BOTTOM], equipped: [ITEM.ROBE_OF_ZAMORAK_TOP, ITEM.ROBE_OF_ZAMORAK_BOTTOM] });
    const d3 = npc(NPC.IBAN_DISCIPLE);
    await withRandom(0.3, () => creatures.onTalkToNPC(robed, d3));
    assert.ok(d3.said.includes('hail the great one, my lord iban'));
    robed.world.runTimeouts();
    assert.equal(d3.attacked.length, 0);
});

test('the slaves ramble; four of them attack', async () => {
    const attackers = [];

    for (let id = 634; id <= 640; id += 1) {
        const p = player({ stage: 5 });
        const slave = npc(id);

        await creatures.onTalkToNPC(p, slave);
        assert.ok(p.messages.includes('the man seems to be in a weak state of mind'));
        assert.ok(slave.said.length > 0);
        p.world.runTimeouts();

        if (slave.attacked.length) {
            attackers.push(id);
        }
    }

    assert.deepEqual(attackers, [634, 636, 637, 638]);
    assert.equal(await creatures.onTalkToNPC(player({}), npc(100)), false);
    assert.equal(await creatures.onNPCDeath(player({}), npc(100)), false);
});

// ---- the temple -----------------------------------------------------------------------------------------------------------------------

test('the cages of the souless: bitten without gauntlets; the dove of the conscience cage; the chest of amulets', async () => {
    const cage = obj(888, 790, 3420);
    const conscience = obj(887, 807, 3434);
    const souless = npc(NPC.SOULESS_HUMAN);

    const bitten = player({ stage: 6, hits: 50 });
    bitten.world.npcList.push(souless);
    await temple.onGameObjectCommandOne(bitten, cage);
    assert.deepEqual(bitten.damaged, [10]);
    assert.ok(souless.said.includes('kuluf ali monopiate'));
    assert.ok(bitten.messages.includes('you find nothing'));

    const gauntlets = player({ stage: 6, items: [ITEM.KLANKS_GAUNTLETS], equipped: [ITEM.KLANKS_GAUNTLETS] });
    await temple.onGameObjectCommandOne(gauntlets, cage);
    assert.deepEqual(gauntlets.damaged, []);
    assert.ok(gauntlets.messages.includes('klanks gaunlett protects you'));

    const dove = player({ stage: 6, hits: 50 });
    await temple.onGameObjectCommandOne(dove, conscience);
    assert.equal(count(dove, ITEM.IBANS_CONSCIENCE), 1);
    assert.deepEqual(dove.damaged, [10]);
    await temple.onGameObjectCommandOne(dove, conscience);
    assert.equal(count(dove, ITEM.IBANS_CONSCIENCE), 1);

    const smeared = player({ stage: 6, cache: { cons_on_doll: true } });
    await temple.onGameObjectCommandOne(smeared, conscience);
    assert.equal(count(smeared, ITEM.IBANS_CONSCIENCE), 0);
    assert.deepEqual(smeared.damaged, []);

    const chest = obj(912, 799, 3533, 4);
    const sealed = player({ stage: 6, items: [ITEM.AMULET_OF_OTHAINIAN, ITEM.AMULET_OF_DOOMION] });
    await temple.onGameObjectCommandOne(sealed, chest);
    assert.ok(sealed.messages.includes("but it's magically sealed"));

    const open = player({ stage: 6, items: [ITEM.AMULET_OF_OTHAINIAN, ITEM.AMULET_OF_DOOMION, ITEM.AMULET_OF_HOLTHION] });
    await temple.onGameObjectCommandOne(open, chest);
    assert.equal(count(open, ITEM.IBANS_SHADOW), 1);
    assert.equal(count(open, ITEM.AMULET_OF_HOLTHION), 0);
    assert.deepEqual(open.world.timed, [[912, 911, 3]]);
});

test('the temple door: robes needed; the finished doll moves the quest to 7 and Iban starts blasting', async () => {
    const door = obj(869, 793, 3469, 2);
    const robes = [ITEM.ROBE_OF_ZAMORAK_TOP, ITEM.ROBE_OF_ZAMORAK_BOTTOM];
    const done = { poison_on_doll: true, cons_on_doll: true, ash_on_doll: true, shadow_on_doll: true };

    const naked = player({ stage: 6 });
    naked.x = 790;
    naked.y = 3469;
    await temple.onGameObjectCommandOne(naked, door);
    assert.ok(naked.messages.includes('only followers of zamorak may enter'));
    assert.deepEqual(naked.teleports, []);

    const ruins = player({ stage: -1, items: robes, equipped: robes });
    ruins.x = 790;
    ruins.y = 3469;
    await temple.onGameObjectCommandOne(ruins, door);
    assert.ok(ruins.messages.includes('...you cannot enter'));

    const preach = player({ stage: 6, items: robes, equipped: robes });
    preach.x = 790;
    preach.y = 3469;
    await temple.onGameObjectCommandOne(preach, door);
    assert.deepEqual(preach.teleports, [[792, 3469], [795, 3469]]);
    assert.ok(preach.messages.includes('inside iban stands preaching at the alter'));
    assert.equal(stage(preach), 6);

    const doll = player({ stage: 6, items: robes, equipped: robes, cache: { ...done }, hits: 50 });
    doll.x = 790;
    doll.y = 3469;
    await withRandom(0.5, () => temple.onGameObjectCommandOne(doll, door));
    assert.equal(stage(doll), 7);
    assert.ok(doll.messages.includes('Iban seems to sense danger'));
    assert.deepEqual(doll.damaged, [9]);
    assert.equal(doll.world.timeouts.length, 1);

    // a blast lands on the player: thrown back to the door (5 damage, or 4 to 6 around a tenth of 50 hits)
    doll.x = 797;
    doll.y = 3469;
    doll.teleports.length = 0;
    doll.damaged.length = 0;
    await withRandom(0, async () => {
        // random(796..799) = 796, random(3467..3471) = 3467: within one tile of 797,3468 only; stand there
        doll.x = 797;
        doll.y = 3468;
        doll.world.runTimeouts();
    });
    assert.deepEqual(doll.teleports, [[795, 3469]]);
    assert.ok(doll.messages.includes("you're blasted back to the door"));
    assert.equal(doll.damaged.length, 1);

    // the blasts stop once Iban is dead or the player has left
    doll.world.runTimeouts();
    doll.ibanBubbleShow = true;
    doll.world.runTimeouts();
    assert.equal(doll.world.timeouts.length, 0);

    // stage 7 comes in again without the cache
    const seven = player({ stage: 7, items: robes, equipped: robes, hits: 50 });
    seven.x = 790;
    seven.y = 3469;
    await temple.onGameObjectCommandOne(seven, door);
    assert.ok(seven.messages.includes('Iban seems to sense danger'));

    // the way out
    const out = player({ stage: 7 });
    out.x = 796;
    out.y = 3469;
    await temple.onGameObjectCommandOne(out, door);
    assert.deepEqual(out.teleports, [[794, 3469], [791, 3469]]);
});

test('the blasts leave the player alone when he is out of reach and drive him out after two minutes', async () => {
    const door = obj(869, 793, 3469, 2);
    const robes = [ITEM.ROBE_OF_ZAMORAK_TOP, ITEM.ROBE_OF_ZAMORAK_BOTTOM];
    const p = player({ stage: 7, items: robes, equipped: robes, hits: 50 });
    p.x = 790;
    p.y = 3469;
    await temple.onGameObjectCommandOne(p, door);
    p.teleports.length = 0;
    p.x = 800;
    p.y = 3471;
    await withRandom(0, async () => p.world.runTimeouts());
    assert.deepEqual(p.teleports, []);

    const realNow = Date.now;
    const start = realNow();

    Date.now = () => start + 1000 * 60 * 3;

    try {
        p.x = 798;
        p.y = 3469;
        p.world.runTimeouts();
    } finally {
        Date.now = realNow;
    }

    assert.deepEqual(p.teleports, [[790, 3469]]);
    assert.ok(p.messages.includes('@yel@Iban: and stay out'));
    assert.equal(p.world.timeouts.length, 0);

    const gone = player({ stage: 7, items: robes, equipped: robes });
    gone.x = 790;
    gone.y = 3469;
    await temple.onGameObjectCommandOne(gone, door);
    gone.x = 700;
    gone.world.runTimeouts();
    assert.equal(gone.world.timeouts.length, 0);
});

// ---- 7 -> 8: the Pit of the Damned ---------------------------------------------------------------------------------------------------

test('stage 7: the finished doll thrown into the pit with Iban near destroys him (stage 8)', async () => {
    const pit = obj(913, 802, 3469, 2);
    const done = () => ({
        orb_of_light1: true,
        orb_of_light2: true,
        orb_of_light3: true,
        orb_of_light4: true,
        stalagmite: true,
        crate_food: true,
        paladin_food: true,
        brew_on_tomb: true,
        rope_wall_grill: true,
        flames_of_zamorak1: true,
        flames_of_zamorak2: true,
        flames_of_zamorak3: 2,
        doll_of_iban: true,
        kardia_cat: true,
        poison_on_doll: true,
        cons_on_doll: true,
        ash_on_doll: true,
        shadow_on_doll: true
    });
    const doll = { id: ITEM.A_DOLL_OF_IBAN };

    const incomplete = player({ stage: 7, items: [ITEM.A_DOLL_OF_IBAN], cache: { poison_on_doll: true } });
    await temple.onUseWithGameObject(incomplete, pit, doll);
    assert.ok(incomplete.messages.includes('the doll is still incomplete'));
    assert.equal(stage(incomplete), 7);

    const alone = player({ stage: 7, items: [ITEM.A_DOLL_OF_IBAN], cache: done() });
    await temple.onUseWithGameObject(alone, pit, doll);
    assert.ok(alone.messages.includes('iban is still not here'));

    const p = player({ stage: 7, items: [ITEM.A_DOLL_OF_IBAN], cache: done() });
    const iban = npc(NPC.IBAN, { x: 804, y: 3469 });
    p.world.npcList.push(iban);
    assert.equal(await temple.onUseWithGameObject(p, pit, doll), true);
    assert.equal(stage(p), 8);
    assert.equal(count(p, ITEM.A_DOLL_OF_IBAN), 0);
    assert.equal(count(p, ITEM.STAFF_OF_IBAN), 1);
    assert.equal(count(p, ITEM.DEATH_RUNE), 15);
    assert.equal(count(p, ITEM.FIRE_RUNE), 30);
    assert.deepEqual(p.teleports, [[687, 3485]]);
    assert.deepEqual(p.world.removed, [iban]);
    assert.equal(p.ibanBubbleShow, true);
    assert.deepEqual(Object.keys(p.cache), ['advised_koftik']);
    assert.equal(p.cache.advised_koftik, false);

    const dead = player({ stage: 8, items: [ITEM.A_DOLL_OF_IBAN] });
    await temple.onUseWithGameObject(dead, pit, doll);
    assert.ok(dead.messages.includes('iban is already dead'));

    assert.equal(await temple.onUseWithGameObject(dead, pit, { id: ITEM.ROPE }), false);
});

// ---- 8 -> -1: King Lathas, the staff, the Dark Mage -----------------------------------------------------------------------------------

test('completing the quest pays 5 quest points, agility and attack, and charges the staff', () => {
    const p = player({ stage: 8, cache: { advised_koftik: false } });

    shared.completeUndergroundPass(p);
    assert.equal(stage(p), -1);
    assert.deepEqual(p.completed[0][1].questPoints, 5);
    assert.deepEqual(p.completed[0][1].experience, { agility: 2000 + 200 * 30, attack: 2000 + 200 * 40 });
    assert.equal(p.cache['Iban blast_casts'], 25);
    assert.equal(p.cache.advised_koftik, undefined);
    assert.equal(p.completed[0][1].message, 'you have completed the underground pass quest');
});

test('King Lathas (Biohazard) completes Underground Pass at stage 8', async () => {
    const biohazard = require('../src/plugins/quests/members/biohazard');
    const p = player({ stage: 8, quest: 'undergroundPass' });
    p.questStages.biohazard = -1;
    p.cache = {};
    const king = npc(512);

    assert.equal(await biohazard.onTalkToNPC(p, king), true);
    assert.equal(stage(p), -1);
    assert.equal(p.completed.length, 1);
});

test('the broken staff, the old journal and the Dark Mage who mends the staff', async () => {
    const p = player({ stage: -1, items: [ITEM.STAFF_OF_IBAN_BROKEN, ITEM.OLD_JOURNAL], answers: [0] });

    await itemsPlugin.onInventoryCommand(p, p.inventory.items[0]);
    assert.ok(p.messages.includes('@que@the staff is broken'));
    assert.equal(await itemsPlugin.onInventoryCommand(p, { id: 100 }), false);

    // the journal: the intro, then iban with "continue reading", then the four elements' own chapters
    p.messages.length = 0;
    await itemsPlugin.onInventoryCommand(p, p.inventory.items[1]);
    assert.ok(p.messages.includes("you turn to the page titled 'intro'"));

    const journal = player({ stage: -1, items: [ITEM.OLD_JOURNAL], answers: [1, 0] });
    await itemsPlugin.onInventoryCommand(journal, journal.inventory.items[0]);
    assert.equal(journal.sent.length, 2);

    const elements = player({ stage: -1, items: [ITEM.OLD_JOURNAL], answers: [3, 2, 0, 3, -1] });
    await itemsPlugin.onInventoryCommand(elements, elements.inventory.items[0]);
    assert.ok(elements.messages.includes("you turn to the page titled 'shadow'"));
    assert.ok(elements.messages.includes("you turn to the page titled 'flesh'"));
    assert.ok(elements.messages.includes("you turn to the page titled 'conscience'"));
});

test('the Dark Mage mends the staff for 200,000 coins after the quest only', async () => {
    const mage = () => npc(667);

    const before = player({ stage: 7, items: [ITEM.STAFF_OF_IBAN_BROKEN] });
    const m1 = mage();
    await itemsPlugin.onTalkToNPC(before, m1);
    assert.ok(m1.said.includes('just despair and death'));

    const poor = player({ stage: -1, items: [ITEM.STAFF_OF_IBAN_BROKEN], answers: [1] });
    await itemsPlugin.onTalkToNPC(poor, mage());
    assert.equal(count(poor, ITEM.STAFF_OF_IBAN), 0);
    assert.ok(poor.messages.includes("you don't have enough money"));

    const refuse = player({ stage: -1, items: [ITEM.STAFF_OF_IBAN_BROKEN], answers: [0] });
    const m2 = mage();
    await itemsPlugin.onTalkToNPC(refuse, m2);
    assert.ok(m2.said.includes('fine by me'));

    const rich = player({ stage: -1, items: [ITEM.STAFF_OF_IBAN_BROKEN, [ITEM.COINS, 200000]], answers: [1] });
    await itemsPlugin.onTalkToNPC(rich, mage());
    assert.equal(count(rich, ITEM.STAFF_OF_IBAN), 1);
    assert.equal(count(rich, ITEM.STAFF_OF_IBAN_BROKEN), 0);
    assert.equal(count(rich, ITEM.COINS), 0);

    const plain = player({ stage: -1 });
    const m3 = mage();
    await itemsPlugin.onTalkToNPC(plain, m3);
    assert.ok(m3.said.includes("it's a dangerous craft"));
    assert.equal(await itemsPlugin.onTalkToNPC(plain, npc(100)), false);
});

// ---- the Iban blast spell ---------------------------------------------------------------------------------------------------------------

test('Iban blast: needs the quest, spends a charge per cast, wants a recharge at zero', () => {
    const magic = fs.readFileSync(require.resolve('../src/packet-handlers/magic.js'), 'utf8');

    assert.match(magic, /you need to complete underground pass quest to cast this spell/);
    assert.match(magic, /you need to recharge the staff of iban/);
    assert.match(magic, /player\.cache\[key\] -= 1/);
});
