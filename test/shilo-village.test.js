// Shilo Village (quests/members/shilo-village/*, ports of the shilovillage/*.java files of Open-RSC, Yanni.java, CartDriver.java and
// the Shilo gates of DoorAction.java): every stage of the quest driven with fake players, objects and npcs. Trufitus's own talk is
// jungle-potion/trufitus-shilo.js (test/trufitus-shilo.test.js). Scripted menus follow the Java; Math.random is pinned where a roll
// decides the path.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const mosol = require('../src/plugins/quests/members/shilo-village/mosol-rei');
const items = require('../src/plugins/quests/members/shilo-village/items');
const objects = require('../src/plugins/quests/members/shilo-village/objects');
const nazastarool = require('../src/plugins/quests/members/shilo-village/nazastarool');
const tombDolmen = require('../src/plugins/quests/members/shilo-village/tomb-dolmen');
const trufitusItems = require('../src/plugins/quests/members/shilo-village/trufitus-items');
const village = require('../src/plugins/quests/members/shilo-village/village');
const { fakeNpc, fakeWorld, fakePlayer, gameObject } = require('./quest-fakes-3b');

const MOSOL = 539;
const TRUFITUS = 517;
const YANNI = 624;
const ZADIMUS = 589;
const ZOMBIE = 613;
const SKELETON = 614;
const GHOST = 615;

const COINS = 10;
const BONES = 20;
const CHISEL = 167;
const SPADE = 211;
const ROPE = 237;
const LIT_CANDLE = 601;
const BEADS = 852;
const BONE_KEY = 835;
const PLAQUE = 958;
const TATTERED = 959;
const CRUMPLED = 960;
const NOTES = 961;
const ZADIMUS_CORPSE = 962;
const CRYSTAL = 972;
const POMMEL = 973;
const BONE_SHARD = 974;
const BONE_BEADS = 976;
const RASHILIYA_CORPSE = 977;
const BRONZE_WIRE = 979;
const PAPYRUS = 982;
const CHARCOAL = 983;

const PLUGIN_TYPES = [
    .../const PLUGIN_TYPES = \[([\s\S]*?)\]/
        .exec(fs.readFileSync(require.resolve('../src/model/world.js'), 'utf8'))[1]
        .matchAll(/'(\w+)'/g)
].map((m) => m[1]);

function npc(id, opts) {
    const n = fakeNpc(id, opts);

    n.opponent = null;
    n.index = 500 + id;
    n.skills = { hits: { current: 90, base: 90 } };

    return n;
}

function player(opts = {}) {
    const p = fakePlayer({ quest: 'shiloVillage', ...opts });

    p.sent = [];
    p.send = (message) => p.sent.push(message);
    p.opponent = null;
    p.statChanges = [];
    const change = p.changeStat;
    p.changeStat = (skill, delta) => {
        p.statChanges.push([skill, delta]);
        return change(skill, delta);
    };

    return p;
}

const count = (p, id) => p.inventory.count(id);
const stage = (p) => p.questStages.shiloVillage;

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
    for (const plugin of [mosol, items, objects, nazastarool, tombDolmen, trufitusItems, village]) {
        for (const name of Object.keys(plugin)) {
            if (name.startsWith('on')) {
                assert.ok(PLUGIN_TYPES.includes(name), name);
            }
        }
    }
});

// ---- stage 0 -> 1: Mosol Rei ---------------------------------------------------------------------------------------------------

test('stage 0: Mosol Rei starts the quest on "What can we do?"; refusing or leaving does not', async () => {
    const p = player({ stage: 0, answers: [0, 0, 0] });
    const m = npc(MOSOL);

    assert.equal(await mosol.onTalkToNPC(p, m), true);
    assert.equal(stage(p), 1);
    assert.ok(m.said.includes('The village is covered in a deadly green mist.'));
    assert.equal(p.interlocutor, null);

    const nope = player({ stage: 0, answers: [0, 0, 1] });
    await mosol.onTalkToNPC(nope, npc(MOSOL));
    assert.equal(stage(nope), 0);

    const who = player({ stage: 0, answers: [2, 1] });
    const m2 = npc(MOSOL);
    await mosol.onTalkToNPC(who, m2);
    assert.equal(stage(who), 0);
    assert.ok(m2.said.includes('This whole area is infested with the Living dead.'));

    assert.equal(await mosol.onTalkToNPC(player({}), npc(100)), false);
});

test('stages 1 to 8: Mosol points at the Witch Doctor; after the quest he leads the player into the village', async () => {
    const p = player({ stage: 3, answers: [0, 0, 2] });
    const m = npc(MOSOL);
    await mosol.onTalkToNPC(p, m);
    assert.equal(stage(p), 3);
    assert.ok(m.said.includes("But you need to speak to the Witch Doctor in 'Tai Bwo Wannai' village."));

    const done = player({ stage: -1, answers: [0] });
    await mosol.onTalkToNPC(done, npc(MOSOL));
    assert.deepEqual(done.teleports, [[395, 851]]);
    assert.ok(done.messages.includes('@yel@Mosol: Have a nice time!'));

    const stay = player({ stage: -1, answers: [1] });
    await mosol.onTalkToNPC(stay, npc(MOSOL));
    assert.deepEqual(stay.teleports, []);
});

// ---- stage 2 -> 3: the bumpy dirt ---------------------------------------------------------------------------------------------------

test('stage 2: a lit candle, a rope and a spade on the bumpy dirt; the crawl drops into the cave (3)', async () => {
    const dirt = gameObject(651, 353, 816);
    const p = player({ stage: 2, items: [SPADE, ROPE, LIT_CANDLE], answers: [0] });

    // the rope needs the light first
    await objects.onUseWithGameObject(p, dirt, { id: ROPE });
    assert.ok(p.messages.includes("It's too dark to see where to attach it."));
    assert.equal(count(p, ROPE), 1);

    await objects.onUseWithGameObject(p, dirt, { id: LIT_CANDLE });
    assert.equal(p.cache.SV_DIG_LIT, true);
    assert.equal(count(p, LIT_CANDLE), 0);
    assert.ok(p.messages.includes('Some rope might help here'));

    await objects.onUseWithGameObject(p, dirt, { id: ROPE });
    assert.equal(p.cache.SV_DIG_ROPE, true);
    assert.equal(count(p, ROPE), 0);

    await objects.onUseWithGameObject(p, dirt, { id: SPADE });
    assert.equal(p.cache.SV_DIG_BUMP, true);
    assert.deepEqual(p.teleports, [[352, 3650]]);
    assert.deepEqual(p.damaged, []);
    assert.equal(stage(p), 3);
    assert.deepEqual(p.experience.at(-1), ['agility', 30]);
    assert.ok(p.said.includes('Yay!'));

    // a second crawl once dug: the dirt's own command
    const again = player({ stage: 3, cache: { SV_DIG_BUMP: true, SV_DIG_ROPE: true }, answers: [1] });
    await objects.onGameObjectCommandOne(again, dirt);
    assert.ok(again.messages.includes('You think better of attempting to squeeze your body into the fissure.'));
});

test('stage 2: without the rope the fall hurts, and before stage 2 the spade finds nothing', async () => {
    const dirt = gameObject(651, 353, 816);
    const p = player({ stage: 2, items: [SPADE], answers: [0], levels: { hits: 50 } });
    await objects.onUseWithGameObject(p, dirt, { id: SPADE });
    assert.deepEqual(p.teleports, [[380, 3692], [352, 3650]]);
    assert.deepEqual(p.damaged, [1, 1, 20]);
    assert.equal(stage(p), 3);

    const early = player({ stage: 1, items: [SPADE] });
    await objects.onUseWithGameObject(early, dirt, { id: SPADE });
    assert.ok(early.messages.includes('you decide to give up.'));
    assert.equal(early.cache.SV_DIG_BUMP, undefined);
    await objects.onGameObjectCommandOne(early, dirt);
    assert.ok(early.messages.includes('It just looks like some bumpy ground'));

    const done = player({ stage: -1, items: [SPADE] });
    await objects.onUseWithGameObject(done, dirt, { id: SPADE });
    assert.ok(done.messages.includes('The entrance seems to have caved in.'));

    // dug already, searched: the look and search of a dug-out hole
    const dug = player({ stage: 2, answers: [1] });
    await objects.onGameObjectCommandTwo(dug, dirt);
    assert.ok(dug.messages.includes('It looks quite big, you may need some tools to excavate further.'));
});

// ---- the Ah Za Rhoon cave ---------------------------------------------------------------------------------------------------------

test('the cave: the gallows give Zadimus, the sacks and the rubble the scrolls, the stone a plaque', async () => {
    const gallows = gameObject(682, 359, 3722);
    const p = player({ stage: 3, answers: [1] });
    await objects.onGameObjectCommandTwo(p, gallows);
    assert.equal(count(p, ZADIMUS_CORPSE), 1);
    assert.equal(p.cache.obtained_shilo_info, true);

    // already carrying him: nothing more
    const again = player({ stage: 3, items: [ZADIMUS_CORPSE] });
    await objects.onGameObjectCommandTwo(again, gallows);
    assert.equal(count(again, ZADIMUS_CORPSE), 1);
    assert.ok(again.messages.includes('The gallows look pretty eerie. You search but find nothing.'));

    const declined = player({ stage: 3, answers: [0] });
    await objects.onGameObjectCommandTwo(declined, gallows);
    assert.equal(count(declined, ZADIMUS_CORPSE), 0);

    const sacks = player({ stage: 3 });
    await objects.onGameObjectCommandTwo(sacks, gameObject(783, 358, 3709));
    assert.equal(count(sacks, CRUMPLED), 1);
    await objects.onGameObjectCommandTwo(sacks, gameObject(783, 358, 3709));
    assert.equal(count(sacks, CRUMPLED), 1);

    const rubble = player({ stage: 3, answers: [0] });
    await objects.onGameObjectCommandTwo(rubble, gameObject(683, 342, 3710));
    assert.equal(count(rubble, TATTERED), 1);
    assert.deepEqual(rubble.experience.at(-1), ['agility', 15]);

    const stone = player({ stage: 3, items: [CHISEL] });
    await objects.onUseWithGameObject(stone, gameObject(674, 359, 3665), { id: CHISEL });
    assert.equal(count(stone, PLAQUE), 1);
    assert.deepEqual(stone.experience.at(-1), ['crafting', 10]);
});

test('the cave: the rubble wriggles between the two halves, the table makes a raft out, the wet rocks wash you out', async () => {
    const north = player({ stage: 3, answers: [0] });
    await objects.onGameObjectCommandTwo(north, gameObject(670, 357, 3668));
    assert.deepEqual(north.teleports, [[347, 3709]]);

    const south = player({ stage: 3, answers: [0] });
    await objects.onGameObjectCommandTwo(south, gameObject(670, 348, 3708));
    assert.deepEqual(south.teleports, [[356, 3667]]);

    const raft = player({ stage: 3, answers: [1] });
    await objects.onGameObjectCommandTwo(raft, gameObject(697, 355, 3668));
    assert.deepEqual(raft.teleports.map((t) => t.join(',')), [
        '353,3669', '357,3673', '356,3678', '353,3682', '349,3685', '345,3686', '341,3686', '341,810'
    ]);
    assert.equal(raft.world.objectList.length, 0, 'every raft is taken away again');

    // sic: the Java's succeed() is the fall
    const fall = player({ stage: 3, answers: [0] });
    await objects.onGameObjectCommandOne(fall, gameObject(696, 343, 3684));
    assert.deepEqual(fall.teleports, [[342, 3684], [339, 808]]);
    assert.deepEqual(fall.experience.at(-1), ['agility', 5]);

    await withRandom(0.999, async () => {
        const high = player({ stage: 3, answers: [0], levels: { agility: 60 } });
        await objects.onGameObjectCommandOne(high, gameObject(696, 343, 3684));
        assert.deepEqual(high.teleports, [[342, 3684], [344, 808]]);
        assert.deepEqual(high.experience.at(-1), ['agility', 100]);
    });
});

test('the cursed coins: the first touch raises the dead, the second takes ten coins', async () => {
    const ground = { id: COINS, x: 358, y: 3626 };
    const p = player({ stage: 3, x: 358, y: 3626 });
    assert.equal(await items.onGroundItemTake(p, ground), true);
    assert.equal(p.cache.coins_shilo_cave, true);
    assert.deepEqual(p.world.spawned.map((s) => s.id), [40, 40, 542, 542]);
    assert.equal(count(p, COINS), 0);

    await items.onGroundItemTake(p, ground);
    assert.equal(count(p, COINS), 10);

    assert.equal(await items.onGroundItemTake(p, { id: COINS, x: 1, y: 1 }), false);
});

// ---- stage 3 -> 4: Zadimus's corpse ---------------------------------------------------------------------------------------------

test('stage 3: buried on the sacred ground the corpse leaves the bone shard (4); elsewhere it only wails', async () => {
    const p = player({ stage: 3, items: [ZADIMUS_CORPSE], x: 447, y: 751 });
    assert.equal(await items.onInventoryCommand(p, { id: ZADIMUS_CORPSE }), true);
    assert.equal(count(p, BONE_SHARD), 1);
    assert.equal(count(p, ZADIMUS_CORPSE), 0);
    assert.equal(stage(p), 4);
    assert.ok(p.world.spawned.some((s) => s.id === ZADIMUS));
    assert.equal(p.world.removed.length, 1);

    const dropped = player({ stage: 3, items: [ZADIMUS_CORPSE], x: 446, y: 750 });
    assert.equal(await items.onDropItem(dropped, { id: ZADIMUS_CORPSE }), true);
    assert.equal(count(dropped, BONE_SHARD), 1);

    const wrong = player({ stage: 3, items: [ZADIMUS_CORPSE], x: 300, y: 600 });
    await items.onDropItem(wrong, { id: ZADIMUS_CORPSE });
    assert.equal(count(wrong, ZADIMUS_CORPSE), 1);
    assert.equal(stage(wrong), 3);
    assert.ok(wrong.messages.some((m) => /Zadimus: Let me rest/.test(m)));

    // a stage other than 3 still gives the shard but moves nothing
    const late = player({ stage: 5, items: [ZADIMUS_CORPSE], x: 447, y: 751 });
    await items.onInventoryCommand(late, { id: ZADIMUS_CORPSE });
    assert.equal(stage(late), 5);
});

test('the quest items cannot be dropped like other things, and reading them opens the boxes', async () => {
    for (const id of [PLAQUE, CRUMPLED, TATTERED, BONE_KEY, BONE_SHARD, CRYSTAL, NOTES, POMMEL, RASHILIYA_CORPSE, BEADS, BONE_BEADS]) {
        const p = player({ stage: 5, items: [id], answers: [0, 0] });
        assert.equal(await items.onDropItem(p, { id }), true, String(id));
    }

    // yes removes the scroll, no keeps it
    const yes = player({ stage: 5, items: [CRUMPLED], answers: [0] });
    await items.onDropItem(yes, { id: CRUMPLED });
    assert.equal(count(yes, CRUMPLED), 0);
    const no = player({ stage: 5, items: [TATTERED], answers: [1] });
    await items.onDropItem(no, { id: TATTERED });
    assert.equal(count(no, TATTERED), 1);

    const notes = player({ stage: 6, items: [NOTES], answers: [1] });
    await items.onDropItem(notes, { id: NOTES });
    assert.equal(notes.cache.dropped_writing, true);
    assert.equal(count(notes, NOTES), 0);

    const read = player({ stage: 6, items: [NOTES], answers: [0] });
    await items.onInventoryCommand(read, { id: NOTES });
    assert.equal(read.cache.read_tomb_notes, true);
    assert.equal(read.sent.length, 1);

    const scroll = player({ stage: 6, items: [CRUMPLED], answers: [0] });
    await items.onInventoryCommand(scroll, { id: CRUMPLED });
    assert.equal(scroll.sent[0].type, 'serverMessageOnTop');

    assert.equal(await items.onInventoryCommand(player({}), { id: 1 }), false);
    assert.equal(await items.onDropItem(player({}), { id: 1 }), false);
});

test('the locating crystal draws prayer by the distance in x from 351', async () => {
    const near = player({ stage: 7, items: [CRYSTAL], answers: [0], x: 352 });
    await items.onInventoryCommand(near, { id: CRYSTAL });
    assert.ok(near.messages.includes('The crystal blazes brilliantly.'));
    assert.deepEqual(near.statChanges, [['prayer', -1]]);

    const far = player({ stage: 7, items: [CRYSTAL], answers: [0], x: 500 });
    await items.onInventoryCommand(far, { id: CRYSTAL });
    assert.deepEqual(far.statChanges, [['prayer', -2]]);

    const weak = player({ stage: 7, items: [CRYSTAL], answers: [0], levels: { prayer: 5 } });
    await items.onInventoryCommand(weak, { id: CRYSTAL });
    assert.ok(weak.messages.includes('You need to have at least 10 prayer points for it to work.'));
    assert.deepEqual(weak.statChanges, []);
});

// ---- Trufitus: items used on him -----------------------------------------------------------------------------------------------

test('stage 6: the tomb notes shown to Trufitus move the quest to 7 (and are kept)', async () => {
    const p = player({ stage: 6, items: [NOTES] });
    const t = npc(TRUFITUS);
    assert.equal(await trufitusItems.onUseWithNPC(p, t, { id: NOTES }), true);
    assert.equal(stage(p), 7);
    assert.equal(count(p, NOTES), 1);
    assert.ok(t.said.includes('The information is quite specific, North of Ah Za Rhoon!'));
    assert.equal(p.interlocutor, null);

    // at another stage the stage stays
    const other = player({ stage: 8, items: [NOTES] });
    await trufitusItems.onUseWithNPC(other, npc(TRUFITUS), { id: NOTES });
    assert.equal(stage(other), 8);

    // after the quest he points at Yanni's shop
    const done = player({ stage: -1, items: [NOTES] });
    const t2 = npc(TRUFITUS);
    await trufitusItems.onUseWithNPC(done, t2, { id: NOTES });
    assert.ok(t2.said.includes('Why not see if you can sell it in Shilo Village.'));

    assert.equal(await trufitusItems.onUseWithNPC(p, npc(MOSOL), { id: NOTES }), false);
    assert.equal(await trufitusItems.onUseWithNPC(p, npc(TRUFITUS), { id: 1 }), false);
});

test('Trufitus looks at the shard (4 -> 5 by the keys and kin talk), the pommel, the key and the remains', async () => {
    const shard = player({ stage: 4, items: [BONE_SHARD], answers: [0, 0, 0] });
    await trufitusItems.onUseWithNPC(shard, npc(TRUFITUS), { id: BONE_SHARD });
    assert.equal(stage(shard), 5);

    const pommel = player({ stage: 6, items: [POMMEL], answers: [0, 0, 1] });
    const t = npc(TRUFITUS);
    await trufitusItems.onUseWithNPC(pommel, t, { id: POMMEL });
    assert.ok(t.said.includes('Rashiliyia would spare the lives of those who wore bronze necklaces.'));

    const key = player({ stage: 8, items: [BONE_KEY], answers: [0, 1, 1] });
    await trufitusItems.onUseWithNPC(key, npc(TRUFITUS), { id: BONE_KEY });

    const corpse = player({ stage: 8, items: [RASHILIYA_CORPSE], answers: [1, 1] });
    const t2 = npc(TRUFITUS);
    await trufitusItems.onUseWithNPC(corpse, t2, { id: RASHILIYA_CORPSE });
    assert.ok(t2.said.includes('I dare not take them, I may be taken'));

    for (const id of [PLAQUE, TATTERED, CRYSTAL]) {
        const p = player({ stage: 4, items: [id] });
        await trufitusItems.onUseWithNPC(p, npc(TRUFITUS), { id });
        assert.equal(count(p, id), 1);
    }

    const zad = player({ stage: 3, items: [ZADIMUS_CORPSE], answers: [0] });
    const t3 = npc(TRUFITUS);
    await trufitusItems.onUseWithNPC(zad, t3, { id: ZADIMUS_CORPSE });
    assert.ok(t3.said.includes('The ground in the centre of the village is very sacred to us'));

    const scroll = player({ stage: 3, items: [CRUMPLED, ZADIMUS_CORPSE], answers: [0] });
    const t4 = npc(TRUFITUS);
    await trufitusItems.onUseWithNPC(scroll, t4, { id: CRUMPLED });
    assert.ok(t4.said.includes('Now...what was it that Zadimus said...'));
});

// ---- stage 5 -> 6: Bervirius's tomb --------------------------------------------------------------------------------------------

test('stage 5: searching the well stacked rocks crawls into the tomb (6); earlier it finds nothing', async () => {
    const rocks = gameObject(688, 473, 825);
    const p = player({ stage: 5, answers: [0] });
    await objects.onGameObjectCommandTwo(p, rocks);
    assert.deepEqual(p.teleports, [[471, 3658]]);
    assert.equal(stage(p), 6);

    const early = player({ stage: 4 });
    await objects.onGameObjectCommandTwo(early, rocks);
    assert.deepEqual(early.teleports, []);
    assert.ok(early.messages.includes('You find nothing of significance.'));

    const done = player({ stage: -1 });
    await objects.onGameObjectCommandTwo(done, rocks);
    assert.ok(done.messages.includes('This tomb entrance seems to be completely flooded.'));

    const refuse = player({ stage: 5, answers: [1] });
    await objects.onGameObjectCommandTwo(refuse, rocks);
    assert.deepEqual(refuse.teleports, []);

    const look = player({ stage: 5 });
    await objects.onGameObjectCommandOne(look, rocks);
    assert.ok(look.messages.includes('Rocks that have been stacked uniformly.'));

    // the quirk of succeed(): below agility 32 the crawl always works; far above it, one roll in ten fails
    await withRandom(0.999, async () => {
        const stuck = player({ stage: 5, answers: [0], levels: { agility: 60 } });
        await objects.onGameObjectCommandTwo(stuck, rocks);
        assert.deepEqual(stuck.teleports, []);
        assert.deepEqual(stuck.damaged, [3]);
        assert.equal(stage(stuck), 5);
    });
});

test('Bervirius dolmen: look and search give the pommel, the crystal and the notes; papyrus and charcoal make new notes', async () => {
    const dolmen = gameObject(689, 464, 3672);
    const p = player({ stage: 6 });
    await tombDolmen.onGameObjectCommandOne(p, dolmen);
    assert.ok(p.messages.includes('You can see that there are some items on the Dolmen.'));

    await tombDolmen.onGameObjectCommandTwo(p, dolmen);
    assert.equal(count(p, POMMEL), 1);
    assert.equal(count(p, CRYSTAL), 1);
    assert.equal(count(p, NOTES), 1);

    // nothing more on a second search
    await tombDolmen.onGameObjectCommandTwo(p, dolmen);
    assert.equal(count(p, POMMEL), 1);
    assert.equal(count(p, NOTES), 1);

    // the pommel turned to beads is not given again
    const beads = player({ stage: 7, items: [BONE_BEADS, CRYSTAL, NOTES] });
    await tombDolmen.onGameObjectCommandTwo(beads, dolmen);
    assert.equal(count(beads, POMMEL), 0);

    // dropped notes: only papyrus and charcoal remake them
    const lost = player({ stage: 7, cache: { dropped_writing: true }, items: [POMMEL, CRYSTAL] });
    await tombDolmen.onGameObjectCommandTwo(lost, dolmen);
    assert.equal(count(lost, NOTES), 0);
    assert.ok(lost.messages.includes('to take more notes from this Dolmen!'));
    lost.inventory.add(PAPYRUS);
    await tombDolmen.onUseWithGameObject(lost, dolmen, { id: PAPYRUS });
    assert.ok(lost.messages.includes('You need some charcoal to make notes.'));
    lost.inventory.add(CHARCOAL);
    await tombDolmen.onUseWithGameObject(lost, dolmen, { id: PAPYRUS });
    assert.equal(count(lost, NOTES), 1);
    assert.equal(count(lost, PAPYRUS), 0);
    assert.equal(count(lost, CHARCOAL), 0);
    await tombDolmen.onUseWithGameObject(lost, dolmen, { id: PAPYRUS });

    const other = player({ stage: 6 });
    assert.equal(await tombDolmen.onUseWithGameObject(other, dolmen, { id: 1 }), true);
    assert.ok(other.messages.includes('Nothing interesting happens'));

    const done = player({ stage: -1 });
    await tombDolmen.onGameObjectCommandTwo(done, dolmen);
    assert.ok(done.messages.includes('You find nothing on the Dolmen.'));
    assert.equal(await tombDolmen.onGameObjectCommandOne(done, gameObject(5, 1, 1)), false);
});

test('the handholds climb out to the island, or fall back', async () => {
    const holds = gameObject(690, 466, 3675);
    const p = player({ stage: 7 });
    await objects.onGameObjectCommandOne(p, holds);
    assert.deepEqual(p.teleports, [[471, 836]]);

    await withRandom(0.999, async () => {
        const fall = player({ stage: 7, levels: { agility: 60, hits: 40 } });
        await objects.onGameObjectCommandOne(fall, holds);
        assert.deepEqual(fall.teleports, [[380, 3692], [467, 3674]]);
        assert.deepEqual(fall.damaged, [4, 4]);
    });
});

// ---- stage 7 -> 8: the key and the beads -----------------------------------------------------------------------------------------

test('stage 7: the trees reveal the entrance for a while; searching it allows the chisel; the key goes in (8)', async () => {
    const world = fakeWorld();
    const tree = gameObject(573, 350, 781);
    const p = player({ stage: 7, world });
    await objects.onGameObjectCommandTwo(p, tree);
    assert.equal(world.objectList.length, 1);
    assert.equal(world.objectList[0].id, 572);
    assert.deepEqual([world.objectList[0].x, world.objectList[0].y], [350, 782]);
    assert.equal(world.timeouts.length, 1);

    // a second search does not stack another
    await objects.onGameObjectCommandTwo(p, tree);
    assert.equal(world.objectList.length, 1);

    const entrance = world.objectList[0];
    entrance.definition = require('@2003scape/rsc-data/config/objects')[572];

    // it is a door with a lock of bone; before stage 7 searching it does not teach the chisel
    const early = player({ stage: 6, world });
    await objects.onGameObjectCommandTwo(early, entrance);
    assert.equal(early.cache.can_chisel_bone, undefined);

    await objects.onGameObjectCommandOne(p, entrance);
    assert.equal(p.cache.can_chisel_bone, true);
    assert.ok(p.messages.includes('perhaps it needs a key?'));

    // after 60 seconds it goes again
    world.runTimeouts();
    assert.equal(world.objectList.length, 0);

    // the bone shard does not fit the lock; the key does
    const fit = player({ stage: 7, world, items: [BONE_SHARD, BONE_KEY] });
    await objects.onUseWithGameObject(fit, entrance, { id: BONE_SHARD });
    assert.deepEqual(fit.teleports, []);
    await objects.onUseWithGameObject(fit, entrance, { id: BONE_KEY });
    assert.deepEqual(fit.teleports, [[348, 3611]]);
    assert.equal(stage(fit), 8);
    assert.equal(count(fit, BONE_KEY), 1);

    // after the quest the trees hide nothing
    const done = player({ stage: -1, world: fakeWorld() });
    await objects.onGameObjectCommandTwo(done, tree);
    assert.equal(done.world.objectList.length, 0);
    assert.ok(done.messages.includes('You find nothing significant.'));
});

test('crafting: the chisel on the shard (after the lock was seen), on the pommel, the beads on the wire', async () => {
    const shard = { id: BONE_SHARD };
    const chisel = { id: CHISEL };

    const unseen = player({ stage: 7, items: [CHISEL, BONE_SHARD], levels: { crafting: 30 } });
    await items.onUseWithInventory(unseen, chisel, shard);
    assert.equal(count(unseen, BONE_KEY), 0);
    assert.ok(unseen.messages.includes('Perhaps it will come to you as you discover more about Rashiliyia?'));

    const low = player({ stage: 7, cache: { can_chisel_bone: true }, items: [CHISEL, BONE_SHARD], levels: { crafting: 19 } });
    await items.onUseWithInventory(low, chisel, shard);
    assert.ok(low.messages.includes('You need a level of 20 Crafting to craft this.'));
    assert.equal(count(low, BONE_SHARD), 1);

    const p = player({ stage: 7, cache: { can_chisel_bone: true }, items: [CHISEL, BONE_SHARD, POMMEL, BRONZE_WIRE], levels: { crafting: 20 } });
    assert.equal(await items.onUseWithInventory(p, shard, chisel), true);
    assert.equal(count(p, BONE_KEY), 1);
    assert.equal(count(p, BONE_SHARD), 0);
    assert.deepEqual(p.experience.at(-1), ['crafting', 35]);

    await items.onUseWithInventory(p, chisel, { id: POMMEL });
    assert.equal(count(p, BONE_BEADS), 1);
    assert.equal(count(p, POMMEL), 0);

    await items.onUseWithInventory(p, { id: BONE_BEADS }, { id: BRONZE_WIRE });
    assert.equal(count(p, BEADS), 1);
    assert.equal(count(p, BONE_BEADS), 0);
    assert.equal(count(p, BRONZE_WIRE), 0);

    const done = player({ stage: -1, cache: { can_chisel_bone: true }, items: [CHISEL, BONE_SHARD] });
    await items.onUseWithInventory(done, chisel, shard);
    assert.ok(done.messages.includes("You're not quite sure what to make with this."));

    assert.equal(await items.onUseWithInventory(p, { id: 1 }, { id: 2 }), false);
});

// ---- stage 8: Rashiliyia's tomb -----------------------------------------------------------------------------------------------------

test('the tomb: the gate, the rocks and the exit door need the Beads of the dead worn', async () => {
    const gate = gameObject(577, 348, 3615);
    const worn = { items: [BEADS], equipped: [BEADS] };

    const choked = player({ stage: 8, y: 3611, answers: [0], levels: { hits: 40 } });
    await objects.onGameObjectCommandOne(choked, gate);
    assert.deepEqual(choked.teleports, [[348, 3616], [348, 3614]]);
    assert.deepEqual(choked.damaged, [21]);

    const through = player({ stage: 8, y: 3611, answers: [0], ...worn });
    await objects.onGameObjectCommandOne(through, gate);
    assert.deepEqual(through.teleports, [[348, 3616]]);
    assert.deepEqual(through.damaged, []);
    assert.ok(through.messages.includes('@red@The Beads of the dead start to glow...'));

    const back = player({ stage: 8, y: 3616 });
    await objects.onGameObjectCommandOne(back, gate);
    assert.deepEqual(back.teleports, [[348, 3614]]);

    const think = player({ stage: 8, y: 3611, answers: [1] });
    await objects.onGameObjectCommandOne(think, gate);
    assert.deepEqual(think.teleports, [[348, 3614]]);

    const look = player({ stage: 8, y: 3611 });
    await objects.onGameObjectCommandTwo(look, gate);
    assert.ok(look.messages.includes('It looks pretty scary.'));

    // the rocks
    const rocks = gameObject(719, 348, 3617);
    const no = player({ stage: 8, x: 348, y: 3616 });
    await objects.onGameObjectCommandOne(no, rocks);
    assert.ok(no.messages.includes('@red@You simply cannot concentrate enough to climb down the rocks.'));
    assert.deepEqual(no.teleports, []);

    const down = player({ stage: 8, x: 348, y: 3616, ...worn });
    await objects.onGameObjectCommandOne(down, rocks);
    assert.deepEqual(down.teleports, [[349, 3618], [348, 3620]]);
    assert.deepEqual(down.experience.at(-1), ['agility', 5]);

    const up = player({ stage: 8, x: 348, y: 3620, ...worn });
    await objects.onGameObjectCommandOne(up, gameObject(719, 349, 3619));
    assert.deepEqual(up.teleports, [[349, 3618], [348, 3616]]);

    await withRandom(0.999, async () => {
        const fall = player({ stage: 8, x: 348, y: 3616, levels: { agility: 60 }, ...worn });
        await objects.onGameObjectCommandOne(fall, rocks);
        assert.deepEqual(fall.teleports, [[349, 3618], [348, 3620]]);
        assert.deepEqual(fall.damaged, [3]);
    });

    // the exit door: the key opens it, the beads or not
    const door = gameObject(583, 348, 3608);
    const out = player({ stage: 8, items: [BONE_KEY], cache: { tomb_door_shilo: true }, ...worn });
    out.inventory.add(BONE_KEY);
    await objects.onUseWithGameObject(out, door, { id: BONE_KEY });
    assert.deepEqual(out.teleports, [[350, 782]]);
    assert.equal(out.cache.tomb_door_shilo, undefined);

    const stuck = player({ stage: 8, items: [BONE_KEY], levels: { hits: 40 } });
    await objects.onGameObjectCommandOne(stuck, door);
    assert.deepEqual(stuck.damaged, [18]);
    assert.ok(stuck.said.includes("I'm too young to die!"));
});

test('the tomb doors: three bones open them for good; without the bones they stay sealed', async () => {
    const doors = gameObject(794, 377, 3632);
    const none = player({ stage: 8, y: 3633, items: [[BONES, 2]] });
    await objects.onUseWithGameObject(none, doors, { id: BONES });
    assert.ok(none.messages.includes('You do not have enough bones for all the recesses.'));
    assert.equal(count(none, BONES), 2);

    const p = player({ stage: 8, y: 3633, items: [[BONES, 4]] });
    // the fake inventory stacks a [id, n] row: three removals take three bones
    await objects.onUseWithGameObject(p, doors, { id: BONES });
    assert.equal(count(p, BONES), 1);
    assert.deepEqual(p.teleports, [[377, 3631]]);
    assert.equal(p.cache.tomb_door_shilo, true);

    // open from the south, then from the north
    const south = player({ stage: 8, y: 3633, cache: { tomb_door_shilo: true } });
    await objects.onGameObjectCommandOne(south, doors);
    assert.deepEqual(south.teleports, [[377, 3631]]);
    const north = player({ stage: 8, y: 3631, cache: { tomb_door_shilo: true } });
    await objects.onGameObjectCommandOne(north, doors);
    assert.deepEqual(north.teleports, [[377, 3633]]);

    const sealed = player({ stage: 8, y: 3633 });
    await objects.onGameObjectCommandOne(sealed, doors);
    assert.ok(sealed.messages.includes('This door is completely sealed, it is very ornately carved.'));
    await objects.onGameObjectCommandTwo(sealed, doors);
    assert.ok(sealed.messages.includes('There are three recesses.'));
});

test('Nazastarool: the dolmen raises the zombie, the skeleton and the ghost; then it gives the remains', async () => {
    const dolmen = gameObject(724, 378, 3622);
    const worn = { items: [BEADS], equipped: [BEADS] };
    const p = player({ stage: 8, ...worn, levels: { hits: 99 }, answers: [1] });

    await nazastarool.onGameObjectCommandTwo(p, dolmen);
    assert.deepEqual(p.teleports, [[380, 3625]]);
    assert.equal(p.world.spawned.length, 1);
    assert.equal(p.world.spawned[0].id, ZOMBIE);
    const zombie = p.world.npcList.find((n) => n.id === ZOMBIE);
    assert.deepEqual([zombie.x, zombie.y], [381, 3625]);
    assert.equal(zombie.retreats, false);
    assert.ok(zombie.said.includes('I am Nazastarool!'));
    // the fight starts after the hook is done
    assert.equal(zombie.attacked.length, 0);
    p.world.runTimeouts();
    assert.deepEqual(zombie.attacked, [p]);

    // the zombie falls: the skeleton rises
    assert.equal(await nazastarool.onNPCDeath(p, zombie), false);
    assert.equal(p.cache.dolmen_zombie, true);
    assert.equal(p.world.spawned.at(-1).id, SKELETON);
    const skeleton = p.world.npcList.find((n) => n.id === SKELETON);
    assert.equal(await nazastarool.onNPCDeath(p, skeleton), false);
    assert.equal(p.cache.dolmen_skeleton, true);
    assert.equal(p.world.spawned.at(-1).id, GHOST);
    const ghost = p.world.npcList.find((n) => n.id === GHOST);
    assert.equal(await nazastarool.onNPCDeath(p, ghost), false);
    assert.equal(p.cache.dolmen_ghost, true);
    assert.ok(p.messages.includes('You see something appear on the Dolmen'));
    assert.equal(p.world.spawned.length, 3);

    // the remains
    await nazastarool.onGameObjectCommandOne(p, dolmen);
    assert.equal(count(p, RASHILIYA_CORPSE), 0);
    const take = player({ stage: 8, ...worn, cache: { dolmen_zombie: true, dolmen_skeleton: true, dolmen_ghost: true }, answers: [0] });
    await nazastarool.onGameObjectCommandOne(take, dolmen);
    assert.equal(count(take, RASHILIYA_CORPSE), 1);
    assert.equal(take.cache.rashiliya_corpse, true);
    assert.deepEqual(take.damaged, []);
    await nazastarool.onGameObjectCommandOne(take, dolmen);
    assert.ok(take.messages.includes('You find nothing new on the Dolmen.'));

    // a second dolmen touch raises the stage still undone
    const second = player({ stage: 8, ...worn, cache: { dolmen_zombie: true } });
    await nazastarool.onGameObjectCommandOne(second, dolmen);
    assert.equal(second.world.spawned[0].id, SKELETON);

    assert.equal(await nazastarool.onNPCDeath(p, npc(100)), false);
    assert.equal(await nazastarool.onNPCDeath(undefined, zombie), false);
});

test('Nazastarool chokes a player without the beads, and a spell only heals him', async () => {
    const dolmen = gameObject(724, 378, 3622);
    const p = player({ stage: 8, levels: { hits: 40 } });
    await nazastarool.onGameObjectCommandOne(p, dolmen);
    assert.deepEqual(p.damaged, [20, 20]);

    const ghost = npc(GHOST);
    ghost.skills.hits.current = 10;
    const caster = player({ stage: 8, levels: { hits: 40 } });
    assert.equal(await nazastarool.onCastOnNPC(caster, ghost), true);
    assert.equal(ghost.skills.hits.current, 90);
    assert.deepEqual(caster.damaged, [20]);
    assert.equal(await nazastarool.onCastOnNPC(caster, npc(100)), false);
});

test('dropping the remains sets Rashiliyia free and the dolmen has to be fought again; the beads vanish', async () => {
    const p = player({
        stage: 8,
        items: [RASHILIYA_CORPSE],
        cache: { dolmen_zombie: true, dolmen_skeleton: true, dolmen_ghost: true },
        answers: [0]
    });
    await items.onDropItem(p, { id: RASHILIYA_CORPSE });
    assert.equal(count(p, RASHILIYA_CORPSE), 0);
    assert.equal(p.cache.dolmen_zombie, undefined);
    assert.equal(p.cache.dolmen_ghost, undefined);
    assert.ok(p.world.spawned.some((s) => s.id === 533));

    const keep = player({ stage: 8, items: [RASHILIYA_CORPSE], answers: [1] });
    await items.onDropItem(keep, { id: RASHILIYA_CORPSE });
    assert.equal(count(keep, RASHILIYA_CORPSE), 1);

    const beads = player({ stage: 8, items: [BEADS], answers: [0] });
    await items.onDropItem(beads, { id: BEADS });
    assert.equal(count(beads, BEADS), 0);
});

// ---- the end -----------------------------------------------------------------------------------------------------------------------

test('stage 8: the remains laid on Bervirius dolmen end the quest: 2 quest points, crafting, the caches go', async () => {
    const dolmen = gameObject(689, 464, 3672);
    const cache = {
        obtained_shilo_info: true,
        coins_shilo_cave: true,
        can_chisel_bone: true,
        tomb_door_shilo: true,
        SV_DIG_LIT: true,
        SV_DIG_ROPE: true,
        SV_DIG_BUMP: true,
        dolmen_zombie: true,
        dolmen_skeleton: true,
        dolmen_ghost: true,
        rashiliya_corpse: true
    };
    const p = player({ stage: 8, items: [RASHILIYA_CORPSE], cache, levels: { crafting: 20 } });

    assert.equal(await tombDolmen.onUseWithGameObject(p, dolmen, { id: RASHILIYA_CORPSE }), true);
    assert.equal(stage(p), -1);
    assert.equal(count(p, RASHILIYA_CORPSE), 0);
    assert.equal(p.completed.length, 1);
    const [key, reward] = p.completed[0];
    assert.equal(key, 'shiloVillage');
    assert.equal(reward.questPoints, 2);
    assert.deepEqual(reward.experience, { crafting: 500 + 500 * 20 });
    assert.ok(reward.message.includes('You have completed the Shilo Village Quest.'));
    for (const k of Object.keys(cache)) {
        if (k !== 'rashiliya_corpse') {
            assert.equal(p.cache[k], undefined, k);
        }
    }

    // before stage 8 the remains do nothing
    const early = player({ stage: 7, items: [RASHILIYA_CORPSE] });
    await tombDolmen.onUseWithGameObject(early, dolmen, { id: RASHILIYA_CORPSE });
    assert.equal(early.completed.length, 0);
    assert.equal(count(early, RASHILIYA_CORPSE), 1);
});

// ---- the village ------------------------------------------------------------------------------------------------------------------

test('Yanni buys the quest curios by use, and lists what he wants', async () => {
    const p = player({ stage: -1, items: [BONE_KEY, CRYSTAL] });
    const y = npc(YANNI);
    assert.equal(await village.onUseWithNPC(p, y, { id: BONE_KEY }), true);
    assert.equal(count(p, COINS), 100);
    assert.equal(count(p, BONE_KEY), 0);
    await village.onUseWithNPC(p, y, { id: CRYSTAL });
    assert.equal(count(p, COINS), 600);
    await village.onUseWithNPC(p, y, { id: 1 });
    assert.ok(p.messages.includes('Nothing interesting happens'));
    assert.equal(await village.onUseWithNPC(p, npc(MOSOL), { id: BONE_KEY }), false);

    const quote = player({ stage: -1, items: [PLAQUE, BEADS], answers: [0] });
    const y2 = npc(YANNI);
    await village.onTalkToNPC(quote, y2);
    assert.ok(y2.said.includes('I\'ll give you 100 Gold for the Stone-Plaque.'));
    assert.ok(y2.said.includes('Those are the items I am interested in Bwana.'));

    const nothing = player({ stage: -1, answers: [0] });
    const y3 = npc(YANNI);
    await village.onTalkToNPC(nothing, y3);
    assert.ok(y3.said.includes('Sorry Bwana, you have nothing I am interested in.'));
});

test('the Shilo gates: through for the finished quest, dragged in among the zombies otherwise; the way out', async () => {
    const metal = gameObject(611, 388, 851);
    const done = player({ stage: -1, x: 387, y: 851 });
    assert.equal(await village.onGameObjectCommandOne(done, metal), true);
    assert.deepEqual(done.teleports, [[395, 851]]);

    const drag = player({ stage: 3, x: 387, y: 851, answers: [0] });
    await village.onGameObjectCommandOne(drag, metal);
    assert.deepEqual(drag.teleports, [[389, 852], [391, 852]]);

    const back = player({ stage: 3, x: 389, y: 851, answers: [0] });
    await village.onGameObjectCommandOne(back, metal);
    assert.deepEqual(back.teleports, [[387, 852]]);

    const fearful = player({ stage: 3, x: 387, y: 851, answers: [1] });
    await village.onGameObjectCommandOne(fearful, metal);
    assert.deepEqual(fearful.teleports, []);

    const wooden = gameObject(712, 394, 851);
    const out = player({ stage: -1, x: 395, y: 851 });
    await village.onGameObjectCommandOne(out, wooden);
    assert.deepEqual(out.teleports, [[381, 851]]);
    const inside = player({ stage: -1, x: 390, y: 851 });
    await village.onGameObjectCommandOne(inside, wooden);
    assert.ok(inside.messages.includes("The gate won't open"));

    // some other gate at another place is not these
    assert.equal(await village.onGameObjectCommandOne(player({}), gameObject(611, 10, 10)), false);
});

test('the cart driver sells a ride to Brimhaven for 500 coins', async () => {
    const driver = npc(619);
    const p = player({ stage: -1, items: [[COINS, 600]], answers: [0] });
    assert.equal(await village.onTalkToNPC(p, driver), true);
    assert.equal(count(p, COINS), 100);
    assert.deepEqual(p.teleports, [[468, 662]]);

    const poor = player({ stage: -1, items: [[COINS, 10]], answers: [0] });
    await village.onTalkToNPC(poor, npc(619));
    assert.deepEqual(poor.teleports, []);

    const no = player({ stage: -1, answers: [1] });
    await village.onTalkToNPC(no, npc(619));
    assert.deepEqual(no.teleports, []);
});

test('the bridge blockade: only "Investigate" is the quest, "Jump" is left to the agility shortcut', async () => {
    const blockade = gameObject(691, 459, 828);
    const p = player({ stage: 5 });
    assert.equal(await objects.onGameObjectCommandOne(p, blockade), true);
    assert.ok(p.messages.includes('The remainder of the bridge looks even more rickety..'));
    assert.equal(await objects.onGameObjectCommandTwo(p, blockade), false);
    assert.equal(await objects.onGameObjectCommandOne(p, gameObject(5, 1, 1)), false);
});
