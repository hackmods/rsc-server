// Legends' Quest (quests/members/legends-quest/*, ports of the legendsquest/*.java files of Open-RSC and the Jungle Forester /
// gold bowl parts of JungleForester.java and Smithing.java): every stage of the quest and each obstacle's success and failure,
// driven with fake players, objects and npcs. Scripted menus follow the Java; Math.random is pinned where a roll decides the path.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const radimus = require('../src/plugins/quests/members/legends-quest/radimus');
const gujuo = require('../src/plugins/quests/members/legends-quest/gujuo');
const ungadulu = require('../src/plugins/quests/members/legends-quest/ungadulu');
const demon = require('../src/plugins/quests/members/legends-quest/demon');
const objects = require('../src/plugins/quests/members/legends-quest/objects');
const bound = require('../src/plugins/quests/members/legends-quest/bound');
const items = require('../src/plugins/quests/members/legends-quest/items');
const forester = require('../src/plugins/quests/members/legends-quest/forester');
const { fakeNpc, fakeWorld, fakePlayer, gameObject, wallObject } = require('./quest-fakes-3b');

// a menu nobody answers ends the hook, as World#callPlugin does when the player walks away (the Java menus that loop have no exit)
for (const plugin of [radimus, gujuo, ungadulu, demon, objects, bound, items, forester]) {
    for (const name of Object.keys(plugin)) {
        const fn = plugin[name];

        if (typeof fn === 'function' && (name.startsWith('on') || name === 'echnedTalk')) {
            plugin[name] = async (...args) => {
                try {
                    return await fn(...args);
                } catch (e) {
                    if (e.message === 'interrupted ask') {
                        return true;
                    }

                    throw e;
                }
            };
        }
    }
}

const PLUGIN_TYPES = [
    .../const PLUGIN_TYPES = \[([\s\S]*?)\]/
        .exec(fs.readFileSync(require.resolve('../src/model/world.js'), 'utf8'))[1]
        .matchAll(/'(\w+)'/g)
].map((m) => m[1]);

const RADIMUS = 735;
const RADIMUS_GUILD = 785;
const GUARD = 736;
const ECHNED = 740;
const SAN = 663;
const IRVIG = 761;
const RANALPH = 762;
const GUJUO = 764;
const FORESTER = 765;
const UNGADULU = 766;
const EVIL_UNGADULU = 767;
const NEZI = 769;
const VIYELDI = 772;

const I = {
    COINS: 10,
    ROPE: 237,
    LOGS: 14,
    PICKAXE: 156,
    HAMMER: 168,
    GOLD_BAR: 172,
    RUNE_AXE: 405,
    BOOK: 1238,
    MACHETTE: 1172,
    REED: 1249,
    BOWL: 1188,
    BOWL_PURE: 1189,
    BLESSED: 1266,
    BLESSED_PURE: 1267,
    SEED: 1182,
    GERMINATED: 1254,
    TOTEM: 1183,
    GILDED: 1265,
    CHUNK: 1219,
    LUMP: 1220,
    HUNK: 1221,
    RED: 1222,
    GLOWING: 1231,
    FIRE_PASS: 1250,
    EMPTY_VIAL: 465,
    VIAL: 464,
    ENCHANTED_VIAL: 1240,
    HOLY_WATER: 1239,
    SPELL: 1257,
    DAGGER: 1255,
    GLOW_DAGGER: 1256,
    POTION: 1253,
    ROARER: 1177,
    SCROLLS: 1163,
    MAP: 1233,
    PAPYRUS: 982,
    CHARCOAL: 983,
    SOUL: 825,
    MIND: 35,
    EARTH: 34,
    LAW: 42,
    AIR: 33,
    OPAL: 894,
    EMERALD: 163,
    RUBY: 162,
    DIAMOND: 161,
    SAPPHIRE: 164,
    TOPAZ: 892,
    JADE: 893,
    HAT: 1264,
    ASHES: 181
};

function npc(id, opts = {}) {
    const n = fakeNpc(id, opts);

    n.opponent = null;
    n.index = 500 + id;
    n.skills = {
        attack: { current: 100, base: 100 },
        defense: { current: 100, base: 100 },
        strength: { current: 100, base: 100 },
        hits: { current: 90, base: 90 }
    };
    n.abandonFight = () => {};
    n.definition = { name: 'Oomlie Bird' };

    return n;
}

function world() {
    const w = fakeWorld();

    w.clearTickTimeout = () => {};
    w.added = [];
    const spawn = w.spawnTimedNPC;

    w.spawnTimedNPC = (opts) => {
        const n = spawn(opts);

        n.opponent = null;
        n.skills = {
            attack: { current: 100, base: 100 },
            defense: { current: 100, base: 100 },
            strength: { current: 100, base: 100 },
            hits: { current: 90, base: 90 }
        };
        n.abandonFight = () => {};
        n.definition = { name: 'x' };
        w.added.push(n);

        return n;
    };
    w.replaceEntity = (type, entity, id) => {
        w.replaced.push([entity.id, id]);

        if (type === 'npcs') {
            const next = npc(id, entity);

            w.npcList = w.npcList.filter((n) => n !== entity).concat(next);
            return next;
        }

        const next = { ...entity, id };

        w.objectList = w.objectList.filter((o) => o !== entity).concat(next);
        return next;
    };

    return w;
}

function player(opts = {}) {
    const answers = opts.answers || [];
    const p = fakePlayer({ quest: 'legendsQuest', world: world(), ...opts, answers });

    p.answers = answers;

    p.sent = [];
    p.send = (message) => p.sent.push(message);
    p.opponent = null;
    p.username = 'tester';
    p.questPoints = opts.questPoints || 0;
    p.retreat = () => Promise.resolve();
    p.sendTeleportBubble = () => {};
    p.statChanges = [];
    const change = p.changeStat;

    p.changeStat = (skill, delta) => {
        p.statChanges.push([skill, delta]);
        return change(skill, delta);
    };
    p.getNearbyEntitiesWithinRadius = (type, id) => p.world.npcList.filter((n) => n.id === id);
    const ask = p.ask;

    p.ask = async (options, repeat) => {
        if (!answers.length) {
            p.asked.push(options);
            throw new Error('interrupted ask');
        }

        return ask(options, repeat);
    };

    return p;
}

const count = (p, id) => p.inventory.count(id);
const stage = (p) => p.questStages.legendsQuest;

async function withRandom(value, fn) {
    const real = Math.random;

    Math.random = () => value;

    try {
        return await fn();
    } finally {
        Math.random = real;
    }
}

function obj(id, x, y) {
    return gameObject(id, x, y);
}

const withNpc = (p, n) => {
    p.world.npcList.push(n);
    return n;
};

async function settle() {
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
}

test('every exported hook is a plugin type', () => {
    for (const plugin of [radimus, gujuo, ungadulu, demon, objects, bound, items, forester]) {
        for (const name of Object.keys(plugin)) {
            if (name.startsWith('on')) {
                assert.ok(PLUGIN_TYPES.includes(name), name);
            }
        }
    }
});

// ---- Radimus: stage 0 -> 1 and the talk of every stage ------------------------------------------------------------------------

test('stage 0: Radimus starts the quest on "Yes, it sounds great!"; declining or leaving does not', async () => {
    const p = player({ stage: 0, answers: [0, 0] });
    const r = npc(RADIMUS);

    assert.equal(await radimus.onTalkToNPC(p, r), true);
    assert.equal(stage(p), 1);
    assert.equal(count(p, I.SCROLLS), 1);
    assert.ok(p.messages.includes('Grand Vizier Erkle gives you some notes and a map.'));
    assert.equal(p.interlocutor, null);

    const no = player({ stage: 0, answers: [0, 1] });
    await radimus.onTalkToNPC(no, npc(RADIMUS));
    assert.equal(stage(no), 0);

    const who = player({ stage: 0, answers: [2, 1] });
    const w = npc(RADIMUS);
    await radimus.onTalkToNPC(who, w);
    assert.equal(stage(who), 0);
    assert.ok(w.said.includes('My name is Radimus Erkle, I am the Grand Vizier of the Legends Guild.'));

    const whoYes = player({ stage: 0, answers: [2, 0, 0] });
    await radimus.onTalkToNPC(whoYes, npc(RADIMUS));
    assert.equal(stage(whoYes), 1);

    assert.equal(await radimus.onTalkToNPC(player({}), npc(100)), false);
});

test('stages 1 to 10: Radimus answers the forgetful; the lost map costs 30 coins', async () => {
    const forgot = player({ stage: 2, items: [I.SCROLLS], answers: [0, 1] });
    const r = npc(RADIMUS);
    await radimus.onTalkToNPC(forgot, r);
    assert.ok(r.said.includes('Tut! How forgetful!'));

    const lost = player({ stage: 2, items: [[I.COINS, 40]], answers: [0, 0] });
    await radimus.onTalkToNPC(lost, npc(RADIMUS));
    assert.equal(count(lost, I.SCROLLS), 1);
    assert.equal(count(lost, I.COINS), 10);

    const broke = player({ stage: 2, items: [[I.COINS, 5]], answers: [0] });
    const b = npc(RADIMUS);
    await radimus.onTalkToNPC(broke, b);
    assert.equal(count(broke, I.SCROLLS), 0);
    assert.ok(b.said.includes('How irritating...'));

    const refuse = player({ stage: 2, items: [[I.COINS, 40]], answers: [0, 1, 1] });
    await radimus.onTalkToNPC(refuse, npc(RADIMUS));
    assert.equal(count(refuse, I.SCROLLS), 0);
    assert.equal(count(refuse, I.COINS), 40);

    const completed = player({ stage: 2, items: [I.MAP], answers: [4, 1] });
    const c = npc(RADIMUS);
    await radimus.onTalkToNPC(completed, c);
    assert.ok(c.said.includes('Also complete the map of Kharazi jungle'));

    const done = player({ stage: 11 });
    const d = npc(RADIMUS);
    await radimus.onTalkToNPC(done, d);
    assert.ok(d.said.includes('And we can discuss your reward !'));

    const after = player({ stage: -1 });
    const a = npc(RADIMUS);
    await radimus.onTalkToNPC(after, a);
    assert.ok(a.said.includes('Hello there! How are you enjoying the Legends Guild?'));
});

test('stage 10 -> 11: the gilded totem pole needs the complete map; early or late it is refused', async () => {
    const noMap = player({ stage: 10, items: [I.GILDED] });
    const r = npc(RADIMUS);
    assert.equal(await radimus.onUseWithNPC(noMap, r, { id: I.GILDED }), true);
    assert.equal(stage(noMap), 10);
    assert.ok(r.said.includes('Kharazi Jungle before your quest is complete.'));

    const p = player({ stage: 10, items: [I.GILDED, I.MAP] });
    await radimus.onUseWithNPC(p, npc(RADIMUS), { id: I.GILDED });
    assert.equal(stage(p), 11);
    assert.equal(count(p, I.GILDED), 0);

    const wait = player({ stage: 11, items: [I.GILDED] });
    const w = npc(RADIMUS);
    await radimus.onUseWithNPC(wait, w, { id: I.GILDED });
    assert.ok(w.said.includes('Go through to the main Legends Guild and I will join you.'));

    const cheat = player({ stage: 5, items: [I.GILDED] });
    await radimus.onUseWithNPC(cheat, npc(RADIMUS), { id: I.GILDED });
    assert.ok(cheat.messages.includes('You have not completed this quest - submitting bug abuse.'));

    const homemade = player({ stage: 9, items: [I.TOTEM] });
    const h = npc(RADIMUS);
    await radimus.onUseWithNPC(homemade, h, { id: I.TOTEM });
    assert.ok(h.said.includes('my guess is that you made it.'));

    const scrolls = player({ stage: 9, items: [I.MAP] });
    const s = npc(RADIMUS);
    await radimus.onUseWithNPC(scrolls, s, { id: I.MAP });
    assert.ok(s.said.includes('To place in the Legends Guild.'));
    assert.equal(await radimus.onUseWithNPC(scrolls, npc(RADIMUS), { id: I.ROPE }), false);
});

test('stage 11 -> done: the Guild hall offers four skills (600 + 600 per level), then 4 quest points', async () => {
    const p = player({ stage: 11, answers: [0, 0, 1, 0, 2, 3, 0, 0], levels: { attack: 40, defense: 50, strength: 60 } });
    const r = npc(RADIMUS_GUILD);

    // yes; attack; then defence; then strength; then menu 2 (hits... next), menu 3 (woodcutting)
    p.answers.length = 0;
    p.answers.push(0, 0, 1, 2, 3, 0, 0);
    await radimus.onTalkToNPC(p, r);

    assert.deepEqual(p.experience.map((e) => e[0]), ['attack', 'defense', 'strength', 'hits']);
    assert.equal(p.experience[0][1], 600 + 600 * 40);
    assert.equal(p.experience[1][1], 600 + 600 * 50);
    assert.equal(p.completed.length, 1);
    assert.equal(p.completed[0][0], 'legendsQuest');
    assert.equal(p.completed[0][1].questPoints, 4);
    assert.equal(stage(p), -1);
    assert.equal(p.cache.legends_choose_reward, undefined);

    const later = player({ stage: 11, cache: { legends_choose_reward: true }, answers: [1] });
    const l = npc(RADIMUS_GUILD);
    await radimus.onTalkToNPC(later, l);
    assert.ok(l.said.includes('Hello again...'));
    assert.equal(stage(later), 11);
});

test('the Mithril gates: the guard admits only 107 quest points and the five quests; members walk in', async () => {
    const quests = { herosQuest: -1, familyCrest: -1, shiloVillage: -1, undergroundPass: -1, waterfallQuest: -1 };
    const ready = player({ stage: 0, questPoints: 107, answers: [0, 0, 2] });

    Object.assign(ready.questStages, quests);
    assert.equal(radimus.eligible(ready), true);

    const g = npc(GUARD);

    const eligible = player({ stage: 0, questPoints: 107, answers: [0, 0, 2] });

    Object.assign(eligible.questStages, quests);
    const guard = npc(GUARD);
    await radimus.onTalkToNPC(eligible, guard);
    assert.ok(guard.said.includes('Well, it looks as if you are eligable for the quest.'));

    const lacking = player({ stage: 0, questPoints: 100, answers: [0, 0, 0] });

    Object.assign(lacking.questStages, quests, { waterfallQuest: 3 });
    const g2 = npc(GUARD);
    await radimus.onTalkToNPC(lacking, g2);
    assert.ok(g2.said.includes('Waterfall Quest.'));
    assert.ok(g2.said.includes('You also need to have 107 Quest Points as well!'));
    assert.equal(radimus.eligible(lacking), false);

    const gates = obj(1079, 512, 550);
    const inside = player({ stage: 0, x: 512, y: 551 });
    inside.world.npcList.push(npc(GUARD));
    // the guard is not the gate's: stage 0 -> a guard approaches and the talk starts
    inside.ask = async () => 3;
    assert.equal(await radimus.onGameObjectCommandOne(inside, gates), true);
    assert.deepEqual(inside.teleports, []);

    const member = player({ stage: 11, x: 512, y: 551 });
    member.world.npcList.push(npc(GUARD));
    await radimus.onGameObjectCommandOne(member, gates);
    assert.deepEqual(member.teleports, [[513, 549]]);

    const going = player({ stage: 3, x: 512, y: 550 });
    await radimus.onGameObjectCommandOne(going, gates);
    assert.deepEqual(going.teleports, [[513, 552]]);

    const search = player({ stage: 0 });
    await radimus.onGameObjectCommandTwo(search, gates);
    assert.ok(search.messages.includes('Two well dressed guards seem to be guarding the gate.'));
});

test('the Legends Hall doors need the quest done', async () => {
    const door = obj(1080, 512, 540);
    const no = player({ stage: 10, y: 539 });
    await radimus.onGameObjectCommandOne(no, door);
    assert.ok(no.messages.includes('@que@You need to complete the Legends Guild Quest'));
    assert.deepEqual(no.teleports, []);

    const yes = player({ stage: 11, y: 539 });
    await radimus.onGameObjectCommandOne(yes, door);
    assert.deepEqual(yes.teleports, [[513, 541]]);

    const out = player({ stage: -1, y: 541 });
    await radimus.onGameObjectCommandOne(out, door);
    assert.deepEqual(out.teleports, [[513, 539]]);
});

// ---- Gujuo -------------------------------------------------------------------------------------------------------------------

test('stage 1: Gujuo asks for Ungadulu to be freed and sets the cavern flag; he then leaves', async () => {
    const p = player({ stage: 1, answers: [0, 0, 0, 0, 0, 0] });
    const g = npc(GUJUO);

    await gujuo.onTalkToNPC(p, g);
    assert.equal(p.cache.legends_cavern, true);
    p.world.runTimeouts();
    assert.ok(p.world.removed.includes(g));
    assert.ok(p.messages.includes('Gujuo disapears into the Kharazi jungle as swiftly as he appeared...'));

    // "I'm lost" takes the player out of the jungle
    const lost = player({ stage: 1, answers: [1, 1, 0] });
    const l = npc(GUJUO);
    await gujuo.onTalkToNPC(lost, l);
    assert.deepEqual(lost.teleports, [[397, 865]]);
    assert.ok(lost.world.removed.includes(l));
});

test('stage 2 and 6: Gujuo points at the caves; the dried pool and the source of the spring (6 -> 7)', async () => {
    const two = player({ stage: 2, answers: [0] });
    const g = npc(GUJUO);
    await gujuo.onTalkToNPC(two, g);
    assert.ok(g.said.includes('Search the caves and try to talk to Ungadulu, there may be some'));

    const six = player({ stage: 6, answers: [0, 1, 0] });
    await gujuo.onTalkToNPC(six, npc(GUJUO));
    assert.equal(stage(six), 7);

    const treeDied = player({ stage: 6, answers: [1, 0] });
    const t = npc(GUJUO);
    await gujuo.onTalkToNPC(treeDied, t);
    assert.ok(t.said.includes('I suspect that some evil is at work here.'));
    assert.equal(stage(treeDied), 6);
});

test('stage 3: Gujuo blesses the bowl at prayer 42 and loses 5 prayer on a failed trance', async () => {
    const p = player({ stage: 3, items: [I.BOWL], levels: { prayer: 60 }, answers: [0, 1] });
    await withRandom(0.5, () => gujuo.onTalkToNPC(p, npc(GUJUO)));
    assert.equal(count(p, I.BLESSED), 1);
    assert.equal(count(p, I.BOWL), 0);

    const low = player({ stage: 3, items: [I.BOWL], levels: { prayer: 30 }, answers: [0, 0] });
    await gujuo.onTalkToNPC(low, npc(GUJUO));
    assert.ok(low.messages.includes('You need a prayer ability of 42 to complete this task.'));
    assert.equal(count(low, I.BOWL), 1);

    // exactly 42: roll 0 is the one failure (random(0, 1) = 0)
    const fail = player({ stage: 3, items: [I.BOWL], levels: { prayer: 42 }, answers: [0, 1] });
    await withRandom(0, () => gujuo.onTalkToNPC(fail, npc(GUJUO)));
    assert.equal(count(fail, I.BLESSED), 0);
    assert.equal(fail.skills.prayer.current, 37);

    // using the bowl on him asks the same
    const used = player({ stage: 3, items: [I.BOWL_PURE], levels: { prayer: 60 }, answers: [0, 1] });
    await withRandom(0.5, () => gujuo.onUseWithNPC(used, npc(GUJUO), { id: I.BOWL_PURE }));
    assert.equal(count(used, I.BLESSED_PURE), 1);
    assert.equal(await gujuo.onUseWithNPC(used, npc(GUJUO), { id: I.ROPE }), false);
});

test('stage 10: Gujuo gives the gilded totem pole once, takes the germinated seeds, and gives another if it is lost', async () => {
    const p = player({ stage: 10, items: [[I.GERMINATED, 2]] });
    const g = npc(GUJUO);
    await gujuo.onTalkToNPC(p, g);
    assert.equal(count(p, I.GILDED), 1);
    assert.equal(count(p, I.GERMINATED), 0);
    assert.equal(p.cache.rewarded_totem, true);

    const lost = player({ stage: 11, cache: { rewarded_totem: true }, answers: [2] });
    await gujuo.onTalkToNPC(lost, npc(GUJUO));
    assert.equal(count(lost, I.GILDED), 1);

    const news = player({ stage: -1, cache: { rewarded_totem: true }, answers: [0] });
    const n = npc(GUJUO);
    await gujuo.onTalkToNPC(news, n);
    assert.ok(n.said.includes('And that we are gratefull to you for your help.'));
});

test('stage 7 to 9: Gujuo explains the potion, the source and the totem pole', async () => {
    const potion = player({ stage: 7, answers: [3, 3] });
    const g = npc(GUJUO);
    await gujuo.onTalkToNPC(potion, g);
    assert.equal(potion.cache.gujuo_potion, true);
    assert.ok(g.said.includes('Add them both to a vial of water,'));

    const late = player({ stage: 8, answers: [2, 3] });
    const l = npc(GUJUO);
    await gujuo.onTalkToNPC(late, l);
    assert.ok(l.said.includes('You will need to grow the Yommi tree to full height.'));

    const seeds = player({ stage: 4, items: [I.SEED], answers: [1, 2] });
    const s = npc(GUJUO);
    await gujuo.onTalkToNPC(seeds, s);
    assert.ok(s.said.includes("That's great Bwana. Now you just need to germinate "));

    const noSeeds = player({ stage: 4, answers: [1] });
    const ns = npc(GUJUO);
    await gujuo.onTalkToNPC(noSeeds, ns);
    assert.ok(ns.said.includes("Hmmm, well I don't see them..."));

    const five = player({ stage: 5, answers: [2] });
    await gujuo.onTalkToNPC(five, npc(GUJUO));
    assert.ok(five.world.timeouts.length > 0);
});

// ---- Ungadulu ------------------------------------------------------------------------------------------------------------------

test('stage 2 -> 3: through the flames Ungadulu says where to find pure water', async () => {
    const p = player({ stage: 2, answers: [1, 1, 1] });
    const u = withNpc(p, npc(UNGADULU));

    await ungadulu.ungaduluWallDialogue(p, u);
    // who are you -> (changes form) -> extinguish... the third pick asks where the pure water is
    assert.ok(stage(p) === 2 || stage(p) === 3);

    const direct = player({ stage: 2, answers: [0, 0] });
    const d = withNpc(direct, npc(UNGADULU));
    await ungadulu.ungaduluWallDialogue(direct, d);
    assert.equal(stage(direct), 3);
    assert.ok(direct.messages.includes('The Shaman throws himself down on the floor and starts shaking.'));

    const later = player({ stage: 4, answers: [2] });
    const l = withNpc(later, npc(UNGADULU));
    await ungadulu.ungaduluWallDialogue(later, l);
    assert.ok(l.said.includes('Greetings bwana...many thanks for defeating the demon...'));
});

test('Ungadulu in the cave: stages 2-3 possess him; stage 4 gives seeds and the fire pass; later stages talk', async () => {
    const p = player({ stage: 3 });
    const u = withNpc(p, npc(UNGADULU));
    await ungadulu.onTalkToNPC(p, u);
    assert.deepEqual(p.damaged, [5]);
    assert.equal(p.skills.attack.current, 25);
    assert.ok(p.messages.includes('@que@You feel a strange power coming over you...'));

    const four = player({ stage: 4, answers: [0, 0, 2] });
    const u4 = withNpc(four, npc(UNGADULU));
    await ungadulu.onTalkToNPC(four, u4);
    assert.equal(count(four, I.SEED), 3);

    const out = player({ stage: 4, answers: [1, 2] });
    await ungadulu.onTalkToNPC(out, withNpc(out, npc(UNGADULU)));
    assert.equal(count(out, I.FIRE_PASS), 1);

    const more = player({ stage: 5, answers: [2] });
    await ungadulu.onTalkToNPC(more, withNpc(more, npc(UNGADULU)));
    assert.equal(count(more, I.GERMINATED), 3);

    const have = player({ stage: 6, items: [I.SEED], answers: [2] });
    const h = withNpc(have, npc(UNGADULU));
    await ungadulu.onTalkToNPC(have, h);
    assert.equal(count(have, I.GERMINATED), 0);
    assert.ok(h.said.includes('Use those first and then come back to me if you need any more.'));

    for (const [st, cache, answers] of [
        [7, { met_spirit: true, killed_viyeldi: true }, [0, 1]],
        [7, { met_spirit: true }, [1, 1]],
        [7, {}, [1, 0]],
        [8, {}, [0, 2]],
        [8, { crafted_totem_pole: true }, [0, 2]],
        [9, {}, [1, 1]]
    ]) {
        const q = player({ stage: st, cache, answers });
        await ungadulu.onTalkToNPC(q, withNpc(q, npc(UNGADULU)));
        assert.equal(q.interlocutor, null);
    }

    const done = player({ stage: -1 });
    const dn = withNpc(done, npc(UNGADULU));
    await ungadulu.onTalkToNPC(done, dn);
    assert.ok(dn.said.includes('look after it well.'));

    const evil = player({ stage: 2 });
    const e = withNpc(evil, npc(EVIL_UNGADULU));
    await ungadulu.onTalkToNPC(evil, e);
    assert.deepEqual(evil.damaged, [5]);
});

test('Ungadulu and the daggers: the spell for the dark dagger (before and after Viyeldi) and the Booking of Binding', async () => {
    const before = player({ stage: 7, items: [I.DAGGER] });
    const b = withNpc(before, npc(UNGADULU));
    await ungadulu.onUseWithNPC(before, b, { id: I.DAGGER });
    assert.equal(count(before, I.SPELL), 1);
    assert.equal(count(before, I.DAGGER), 0);

    const killed = player({ stage: 7, items: [I.DAGGER], cache: { killed_viyeldi: true }, answers: [0] });
    await ungadulu.onUseWithNPC(killed, withNpc(killed, npc(UNGADULU)), { id: I.DAGGER });
    assert.equal(count(killed, I.SPELL), 1);
    assert.equal(count(killed, I.DAGGER), 1);

    const nothing = player({ stage: 7, items: [I.DAGGER], cache: { killed_viyeldi: true }, answers: [1] });
    await ungadulu.onUseWithNPC(nothing, withNpc(nothing, npc(UNGADULU)), { id: I.DAGGER });
    assert.equal(count(nothing, I.SPELL), 0);

    const glowing = player({ stage: 7, items: [I.GLOW_DAGGER] });
    await ungadulu.onUseWithNPC(glowing, withNpc(glowing, npc(UNGADULU)), { id: I.GLOW_DAGGER });
    assert.equal(count(glowing, I.SPELL), 1);
    assert.equal(count(glowing, I.GLOW_DAGGER), 0);

    // the book on him at stage 3 summons Nezikchened (prayer quartered, holy water weakens him)
    const book = player({ stage: 3, items: [I.BOOK], levels: { prayer: 40 }, cache: { holy_water_neiz: true } });
    const u = withNpc(book, npc(UNGADULU, { x: 453, y: 3707 }));
    await ungadulu.onUseWithNPC(book, u, { id: I.BOOK });
    const nezi = book.world.added.find((n) => n.id === NEZI);
    assert.ok(nezi);
    assert.equal(nezi.spawnedFor, book);
    assert.deepEqual(nezi.attacked, [book]);
    assert.equal(book.skills.prayer.current, 10);
    assert.equal(nezi.skills.attack.current, 85);

    const cured = player({ stage: 4, items: [I.BOOK] });
    const c = withNpc(cured, npc(UNGADULU));
    await ungadulu.onUseWithNPC(cured, c, { id: I.BOOK });
    assert.ok(c.said.includes("I'm cured now, remember..."));
    assert.equal(await ungadulu.onUseWithNPC(cured, c, { id: I.ROPE }), false);
});

test('attacking Ungadulu weakens the player; after the quest the Shaman throws him out; running restores', async () => {
    const p = player({ stage: 5 });
    const u = withNpc(p, npc(UNGADULU));
    assert.equal(await ungadulu.onNPCAttack(p, u), true);
    assert.equal(p.skills.attack.current, 0);
    assert.equal(p.skills.strength.current, 0);
    assert.deepEqual(u.attacked, [p]);

    const spell = player({ stage: 5 });
    await ungadulu.onCastOnNPC(spell, withNpc(spell, npc(UNGADULU)));
    assert.ok(spell.messages.includes('The spell fizzles and dies...'));

    const after = player({ stage: -1 });
    await ungadulu.onNPCAttack(after, withNpc(after, npc(UNGADULU)));
    assert.deepEqual(after.teleports, [[454, 3702]]);
    assert.deepEqual(after.damaged, [5]);

    const evil = player({ stage: 3 });
    await ungadulu.onNPCAttack(evil, withNpc(evil, npc(EVIL_UNGADULU)));
    assert.ok(evil.messages.includes('A strange power stops you from attacking the Shaman.'));
    assert.deepEqual(evil.damaged, [5]);

    const run = player({ stage: 5 });
    run.skills.attack.current = 0;
    assert.equal(await ungadulu.onNPCEscape(run, withNpc(run, npc(UNGADULU))), true);
    assert.equal(run.skills.attack.current, 11);
    assert.equal(await ungadulu.onNPCEscape(run, npc(100)), false);
    assert.equal(await ungadulu.onNPCAttack(run, npc(100)), false);
});

// ---- the flames, the runes and the wall -----------------------------------------------------------------------------------------

test('the flame wall: touch burns on a roll, the investigate calls Ungadulu, the fire pass walks through, 5 splashes of pure water douse it', async () => {
    const flame = wallObject(210, 456, 3709, 1);
    flame.definition = { commands: ['Touch', 'Investigate'] };

    const hit = player({ stage: 2, levels: { hits: 30 } });
    await withRandom(0, () => bound.onWallObjectCommandOne(hit, flame));
    assert.deepEqual(hit.damaged, [4]);

    const miss = player({ stage: 2 });
    await withRandom(0.99, () => bound.onWallObjectCommandOne(miss, flame));
    assert.deepEqual(miss.damaged, []);
    assert.ok(miss.said.includes('Whew!'));

    const pass = player({ stage: 4, items: [I.FIRE_PASS], x: 457, y: 3709 });
    await bound.onWallObjectCommandOne(pass, flame);
    assert.deepEqual(pass.teleports, [[456, 3709]]);

    const peek = player({ stage: 2, answers: [0], x: 458, y: 3709 });
    await bound.onWallObjectCommandTwo(peek, flame);
    assert.ok(peek.world.spawned.some((s) => s.id === UNGADULU));

    const inside = player({ stage: 2, x: 452, y: 3706, answers: [0] });
    await withRandom(0, () => bound.onWallObjectCommandTwo(inside, flame));
    assert.deepEqual(inside.teleports, [[453, 3705], [455, 3702]]);
    assert.deepEqual(inside.damaged, [3]);

    const early = player({ stage: 1, x: 458, y: 3709 });
    assert.equal(await bound.onWallObjectCommandTwo(early, flame), true);
    assert.deepEqual(early.world.spawned, []);

    const dowse = player({ stage: 3, items: [I.BLESSED_PURE], x: 457, y: 3709 });

    for (let i = 0; i < 5; i += 1) {
        assert.equal(await bound.onUseWithWallObject(dowse, flame, { id: I.BLESSED_PURE }), true);
        dowse.x = 457;
    }

    assert.equal(count(dowse, I.BLESSED_PURE), 0);
    assert.equal(count(dowse, I.BLESSED), 1);
    assert.equal(dowse.cache.douse_flames, undefined);
    assert.equal(dowse.world.timed.filter((t) => t[1] === 206).length, 5);

    const plain = player({ stage: 3, items: [I.BOWL_PURE] });
    await bound.onUseWithWallObject(plain, flame, { id: I.BOWL_PURE });
    assert.deepEqual(plain.teleports, []);
    assert.ok(plain.messages.includes('@que@before it gets anywhere near the flames.'));
    await bound.onUseWithWallObject(plain, flame, { id: I.ROPE });
    assert.ok(plain.messages.includes('Nothing interesting happens'));

    const rut = player({});
    await bound.onWallObjectCommandOne(rut, wallObject(206, 456, 3709, 1));
    assert.ok(rut.messages.includes('This looks like a rut has been etched into the ground.'));
});

test('the ancient wall: the runes must go in S-M-E-L-L order; a wrong rune burns; five open the door', async () => {
    const wall = wallObject(212, 464, 3721, 2);
    const p = player({ stage: 3, items: [I.SOUL, [I.MIND, 2], I.EARTH, [I.LAW, 2], I.AIR], answers: [0] });

    await bound.onUseWithWallObject(p, wall, { id: I.MIND });
    assert.equal(count(p, I.MIND), 1);
    assert.deepEqual(p.damaged.length, 1);
    assert.equal(count(p, I.AIR), 1);

    await bound.onUseWithWallObject(p, wall, { id: I.AIR });
    assert.equal(count(p, I.AIR), 0);
    assert.equal(p.world.drops.length, 2);

    await bound.onUseWithWallObject(p, wall, { id: I.SOUL });
    assert.equal(p.cache.ancient_wall_runes, 1);
    await bound.onUseWithWallObject(p, wall, { id: I.MIND });
    await bound.onUseWithWallObject(p, wall, { id: I.EARTH });
    await bound.onUseWithWallObject(p, wall, { id: I.LAW });
    assert.equal(p.cache.ancient_wall_runes, 4);
    await bound.onUseWithWallObject(p, wall, { id: I.LAW });
    assert.equal(p.cache.ancient_wall_runes, 5);
    assert.deepEqual(p.teleports.at(-1), [467, 3724]);

    // solved: click (use) walks through, search reads the poem
    const again = player({ stage: 3, cache: { ancient_wall_runes: 5 }, answers: [0] });
    wall.definition = { commands: ['Use', 'Search'] };
    await bound.onWallObjectCommandOne(again, wall);
    assert.deepEqual(again.teleports, [[467, 3724]]);
    const other = wallObject(212, 466, 3723, 2);
    await bound.onWallObjectCommandOne(player({ stage: -1 }), other);

    const read = player({ stage: 3, cache: { ancient_wall_runes: 5 }, answers: [0] });
    await bound.onWallObjectCommandTwo(read, wall);
    assert.equal(read.sent.length, 1);

    const unsolved = player({ stage: 3, answers: [0] });
    await bound.onWallObjectCommandOne(unsolved, wall);
    assert.ok(unsolved.messages.includes('Perhaps you should search it?'));
    await bound.onWallObjectCommandTwo(unsolved, wall);
    assert.equal(unsolved.sent.length, 1);
    assert.equal(await bound.onUseWithWallObject(unsolved, wall, { id: I.ROPE }), true);
});

test('the ruined wall: Agility 50 to jump, a fall hurts', async () => {
    const wall = wallObject(211, 456, 3728, 3);
    const low = player({ stage: 3, levels: { agility: 49 } });
    await bound.onWallObjectCommandOne(low, wall);
    assert.deepEqual(low.teleports, []);

    const ok = player({ stage: 3, levels: { agility: 80 }, y: 3730 });
    await withRandom(0, () => bound.onWallObjectCommandOne(ok, wall));
    assert.deepEqual(ok.teleports, [[457, 3727]]);
    assert.deepEqual(ok.damaged, []);

    const fall = player({ stage: 3, levels: { agility: 50 }, y: 3727 });
    await withRandom(0.99, () => bound.onWallObjectCommandOne(fall, wall));
    assert.deepEqual(fall.teleports, [[455, 3729]]);
    assert.deepEqual(fall.damaged, [6]);
});

// ---- objects ---------------------------------------------------------------------------------------------------------------------

test('the cupboard, desk, table, bed and crate give their items once', async () => {
    const cupboard = obj(1149, 515, 543);
    const no = player({ stage: 0 });
    await objects.onGameObjectCommandOne(no, cupboard);
    assert.equal(count(no, I.MACHETTE), 0);
    const yes = player({ stage: 1 });
    await objects.onGameObjectCommandOne(yes, cupboard);
    await objects.onGameObjectCommandOne(yes, cupboard);
    assert.equal(count(yes, I.MACHETTE), 1);

    const p = player({ stage: 2 });

    for (const [id, item] of [[1032, 1244], [1161, 1242], [1144, 1241]]) {
        await objects.onGameObjectCommandTwo(p, obj(id, 450, 3700));
        await objects.onGameObjectCommandTwo(p, obj(id, 450, 3700));
        assert.equal(count(p, item), 1);
    }

    const bed = obj(1162, 460, 3705);
    await objects.onGameObjectCommandTwo(p, bed);
    await objects.onGameObjectCommandTwo(p, bed);
    assert.equal(count(p, 1243), 1);
    assert.equal(await objects.onGameObjectCommandOne(p, bed), false);

    const desk = obj(1177, 517, 546);
    const rad = withNpc(p, npc(RADIMUS));
    assert.equal(await objects.onGameObjectCommandTwo(p, desk), true);
    assert.ok(rad.said.length > 0);
    assert.equal(rad.x, 517);
});

test('the crevice (rock 1151): Agility 50, stage 1 needs the flag; success is stage 2, failure hurts', async () => {
    const rock = obj(1151, 452, 872);
    const nothing = player({ stage: 1 });
    await objects.onGameObjectCommandTwo(nothing, rock);
    assert.ok(nothing.messages.includes('You see nothing significant.'));

    const low = player({ stage: 1, cache: { legends_cavern: true }, levels: { agility: 40 }, answers: [0] });
    await objects.onGameObjectCommandTwo(low, rock);
    assert.ok(low.messages.includes('You need an agility of 50 to even attempt this.'));

    const scared = player({ stage: 1, cache: { legends_cavern: true }, levels: { agility: 60 }, answers: [1] });
    await objects.onGameObjectCommandTwo(scared, rock);
    assert.deepEqual(scared.teleports, []);

    const ok = player({ stage: 1, cache: { legends_cavern: true }, levels: { agility: 70 }, answers: [0] });
    await withRandom(0.5, () => objects.onGameObjectCommandTwo(ok, rock));
    assert.deepEqual(ok.teleports, [[461, 3700]]);
    assert.equal(stage(ok), 2);
    assert.equal(ok.cache.legends_cavern, undefined);

    // agility exactly 50: random(0, 1) = 0 fails
    const fail = player({ stage: 1, cache: { legends_cavern: true }, levels: { agility: 50 }, answers: [0] });
    await withRandom(0, () => objects.onGameObjectCommandTwo(fail, rock));
    assert.deepEqual(fail.teleports, []);
    assert.deepEqual(fail.damaged, [5]);
    assert.equal(stage(fail), 1);

    const redo = player({ stage: 4, levels: { agility: 70 }, answers: [0] });
    await withRandom(0.5, () => objects.onGameObjectCommandTwo(redo, rock));
    assert.deepEqual(redo.teleports, [[461, 3700]]);
    assert.equal(stage(redo), 4);
});

test('the reed, the pool and the golden bowl: stage 3 fills the bowl, stage 5 finds the sludge (5 -> 6)', async () => {
    const reeds = obj(1163, 418, 891);
    const water = obj(582, 417, 889);
    const p = player({ stage: 3, items: [I.MACHETTE, I.BOWL] });

    await objects.onUseWithGameObject(p, reeds, { id: I.MACHETTE });
    assert.equal(count(p, I.REED), 1);
    await objects.onUseWithGameObject(p, water, { id: I.REED });
    assert.equal(count(p, I.BOWL_PURE), 1);
    assert.equal(count(p, I.BOWL), 0);
    assert.equal(count(p, I.REED), 0);

    const blessed = player({ stage: 3, items: [I.REED, I.BLESSED] });
    await objects.onUseWithGameObject(blessed, water, { id: I.REED });
    assert.equal(count(blessed, I.BLESSED_PURE), 1);

    const bucket = player({ stage: 3, items: [I.REED, 21] });
    await objects.onUseWithGameObject(bucket, water, { id: I.REED });
    assert.equal(count(bucket, 50), 1);

    const nothing = player({ stage: 3, items: [I.REED] });
    await objects.onUseWithGameObject(nothing, water, { id: I.REED });
    assert.ok(nothing.messages.includes('@que@But you have nothing to put the water in.'));
    assert.equal(count(nothing, I.REED), 1);

    const dried = player({ stage: 5, items: [I.REED] });
    await objects.onUseWithGameObject(dried, water, { id: I.REED });
    assert.equal(stage(dried), 6);
    const seven = player({ stage: 7, items: [I.REED] });
    await objects.onUseWithGameObject(seven, water, { id: I.REED });
    assert.equal(stage(seven), 7);

    const done = player({ stage: 9, items: [I.REED, I.BOWL] });
    await objects.onUseWithGameObject(done, water, { id: I.REED });
    assert.equal(count(done, I.BOWL_PURE), 0);

    // looking at the water and the reeds
    await objects.onGameObjectCommandTwo(p, water);
    assert.ok(p.messages.includes('@que@A bubbling brook with effervescent water...'));
    await objects.onGameObjectCommandTwo(dried, water);
    assert.ok(dried.messages.includes('A disgusting sess pit of filth and stench...'));
    const pool = player({ stage: 8, y: 3730 });
    await objects.onGameObjectCommandTwo(pool, water);
    assert.ok(pool.messages.includes('A magical looking pool.'));
    await objects.onGameObjectCommandTwo(p, reeds);

    const fill = player({ stage: 8, items: [I.BLESSED], y: 3730 });
    await objects.onUseWithGameObject(fill, water, { id: I.BLESSED });
    assert.equal(count(fill, I.BLESSED_PURE), 1);
    const tight = player({ stage: 8, items: [I.BLESSED], y: 3700 });
    await objects.onUseWithGameObject(tight, water, { id: I.BLESSED });
    assert.equal(count(tight, I.BLESSED_PURE), 0);
});

test('the gems: seven placed on the carved rocks make the Booking of Binding; each gem can be taken back once', async () => {
    const rocks = [
        [I.OPAL, 471, 3722],
        [I.EMERALD, 474, 3730],
        [I.RUBY, 471, 3734],
        [I.DIAMOND, 466, 3739],
        [I.SAPPHIRE, 460, 3737],
        [I.TOPAZ, 464, 3730],
        [I.JADE, 469, 3728]
    ];
    const p = player({ stage: 3, items: rocks.map(([id]) => id) });

    // a wrong rock does nothing
    await objects.onUseWithGameObject(p, obj(1037, 474, 3730), { id: I.OPAL });
    assert.ok(p.messages.includes('but nothing happens...'));

    await objects.onUseWithGameObject(p, obj(1037, 471, 3722), { id: I.OPAL });
    assert.equal(p.cache.legends_attach_1, 1);
    assert.equal(count(p, I.OPAL), 0);

    // searching the rock hides the gem from taking
    await objects.onGameObjectCommandTwo(p, obj(1037, 471, 3722));
    assert.equal(p.cache.legends_attach_1, 2);

    // taking: only while the slot is 1
    const gem = { id: I.OPAL, x: 471, y: 3722 };
    p.world.removeEntity = () => {};
    assert.equal(await objects.onGroundItemTake(p, gem), true);
    assert.equal(count(p, I.OPAL), 0);
    p.cache.legends_attach_1 = 1;
    assert.equal(await objects.onGroundItemTake(p, gem), true);
    assert.equal(count(p, I.OPAL), 1);
    assert.equal(p.cache.legends_attach_1, undefined);
    assert.equal(await objects.onGroundItemTake(p, { id: I.OPAL, x: 1, y: 1 }), false);

    for (const [id, x, y] of rocks) {
        await objects.onUseWithGameObject(p, obj(1037, x, y), { id });
    }

    assert.equal(count(p, I.BOOK), 1);
    assert.deepEqual(Object.keys(p.cache).filter((k) => k.startsWith('legends_attach')), []);

    // placing the same gem twice returns it
    const twice = player({ stage: 3, items: [I.RUBY, I.RUBY] });
    await objects.onUseWithGameObject(twice, obj(1037, 471, 3734), { id: I.RUBY });
    await objects.onUseWithGameObject(twice, obj(1037, 471, 3734), { id: I.RUBY });
    assert.ok(twice.messages.includes('You have already placed an ruby above this rock.'));
    assert.equal(await objects.onUseWithGameObject(twice, obj(1037, 471, 3734), { id: I.ROPE }), true);
});

test('the furnace fuses the three crystals (Crafting 50) into the dragon crystal; the eye rock and the cavern take it', async () => {
    const furnace = obj(1146, 388, 3701);
    const p = player({ stage: 7, items: [I.CHUNK, I.LUMP, I.HUNK], levels: { crafting: 50 } });

    await objects.onUseWithGameObject(p, furnace, { id: I.CHUNK });
    await objects.onUseWithGameObject(p, furnace, { id: I.LUMP });
    assert.equal(count(p, I.RED), 0);
    await objects.onUseWithGameObject(p, furnace, { id: I.HUNK });
    assert.equal(count(p, I.RED), 1);
    assert.deepEqual(Object.keys(p.cache), []);

    const low = player({ stage: 7, items: [I.CHUNK], levels: { crafting: 49 } });
    await objects.onUseWithGameObject(low, furnace, { id: I.CHUNK });
    assert.equal(count(low, I.CHUNK), 1);
    await objects.onUseWithGameObject(low, furnace, { id: I.ROPE });
    await objects.onGameObjectCommandOne(low, furnace);
    await objects.onGameObjectCommandTwo(low, furnace);

    await objects.onUseWithGameObject(p, obj(1148, 399, 3710), { id: I.RED });
    assert.equal(count(p, I.GLOWING), 1);
    await objects.onGameObjectCommandOne(p, obj(1148, 399, 3710));

    const cavern = obj(1145, 394, 3726);
    await objects.onGameObjectCommandOne(p, cavern);
    assert.ok(p.messages.includes('@que@Somekind of magical force will not allow you to pass into the cavern.'));
    await objects.onUseWithGameObject(p, cavern, { id: I.GLOWING });
    assert.equal(p.cache.cavernous_opening, true);
    p.y = 3726;
    await objects.onGameObjectCommandOne(p, cavern);
    assert.deepEqual(p.teleports.at(-1), [395, 3733]);
    p.y = 3733;
    await objects.onGameObjectCommandOne(p, cavern);
    assert.deepEqual(p.teleports.at(-1), [395, 3725]);
    await objects.onGameObjectCommandTwo(p, cavern);
    assert.ok(p.messages.includes('@que@it allows access to the cavern.'));
    const sealed = player({ stage: 7 });
    await objects.onGameObjectCommandTwo(sealed, cavern);
    assert.ok(sealed.messages.includes('@que@You see a heart shaped depression in the wall next to the cavern.'));
});

test('the heavy metal gate: Strength 50 pushes it open on a roll, a failure costs a strength point', async () => {
    const gate = obj(1033, 440, 3718);
    const look = player({ stage: 7 });
    await objects.onGameObjectCommandOne(look, gate);
    const weak = player({ stage: 7, levels: { strength: 40 }, answers: [0] });
    await objects.onGameObjectCommandTwo(weak, gate);
    assert.ok(weak.messages.includes('You need a Strength of at least 50 to affect these gates.'));
    const doubt = player({ stage: 7, answers: [1] });
    await objects.onGameObjectCommandTwo(doubt, gate);

    const ok = player({ stage: 7, levels: { strength: 80 }, answers: [0], y: 3717 });
    await withRandom(0.5, () => objects.onGameObjectCommandTwo(ok, gate));
    assert.deepEqual(ok.teleports, [[441, 3719]]);
    const back = player({ stage: 7, levels: { strength: 80 }, answers: [0], y: 3719 });
    await withRandom(0.5, () => objects.onGameObjectCommandTwo(back, gate));
    assert.deepEqual(back.teleports, [[441, 3717]]);

    const fail = player({ stage: 7, levels: { strength: 50 }, answers: [0] });
    await withRandom(0, () => objects.onGameObjectCommandTwo(fail, gate));
    assert.deepEqual(fail.teleports, []);
    assert.equal(fail.skills.strength.current, 49);
});

test('the boulders: a pickaxe and Mining 52; a failure costs a mining point; low mining below can climb out', async () => {
    const rock = obj(1117, 441, 3705);
    const none = player({ stage: 7 });
    await objects.onGameObjectCommandTwo(none, rock);
    assert.ok(none.messages.includes("@que@You'll need a pickaxe to smash your way through these boulders."));

    const low = player({ stage: 7, items: [I.PICKAXE], levels: { mining: 40 }, y: 3700 });
    await objects.onGameObjectCommandTwo(low, rock);
    assert.ok(low.messages.includes('You need a mining ability of at least 52 to affect these boulders.'));

    const stuck = player({ stage: 7, items: [I.PICKAXE], levels: { mining: 40 }, y: 3712, x: 441, answers: [0] });
    stuck.teleport = (x, y) => { stuck.teleports.push([x, y]); stuck.x = x; stuck.y = y; };
    await objects.onGameObjectCommandTwo(stuck, rock);
    assert.deepEqual(stuck.teleports.at(-1), [442, 3703]);

    const ok = player({ stage: 7, items: [I.PICKAXE], levels: { mining: 80 }, y: 3704 });
    await withRandom(0.5, () => objects.onGameObjectCommandTwo(ok, rock));
    assert.deepEqual(ok.teleports, [[441, 3707]]);
    assert.deepEqual(ok.world.timed[0].slice(0, 2), [1117, 1143]);

    const second = obj(1185, 440, 3713);
    const back = player({ stage: 7, items: [I.PICKAXE], levels: { mining: 80 }, y: 3715 });
    await withRandom(0.5, () => objects.onGameObjectCommandTwo(back, second));
    assert.deepEqual(back.teleports, [[441, 3712]]);

    const fail = player({ stage: 7, items: [I.PICKAXE], levels: { mining: 52 }, y: 3704 });
    await withRandom(0, () => objects.onGameObjectCommandTwo(fail, rock));
    assert.deepEqual(fail.teleports, []);
    assert.equal(fail.skills.mining.current, 51);
});

test('the rope down (beam 1156): the rope hangs, the Gujuo potion lets the player climb down; the rope up leads out', async () => {
    const beam = obj(1156, 471, 3708);
    const p = player({ stage: 7, items: [I.ROPE], cache: { gujuo_potion: true }, answers: [0] });

    await objects.onGameObjectCommandTwo(player({ stage: 7 }), beam);
    await objects.onUseWithGameObject(p, beam, { id: I.ROPE });
    assert.equal(p.cache.legends_wooden_beam, true);
    assert.equal(count(p, I.ROPE), 0);
    await objects.onGameObjectCommandTwo(p, beam);

    const down = obj(1157, 471, 3708);
    down.definition = { commands: ['WalkTo', 'Use'] };
    await withRandom(0.99, () => objects.onGameObjectCommandTwo(p, down));
    assert.deepEqual(p.teleports, [[426, 3707]]);

    const slip = player({ stage: 7, cache: { gujuo_potion: true }, answers: [0] });
    await withRandom(0, () => objects.onGameObjectCommandTwo(slip, down));
    assert.deepEqual(slip.teleports, [[426, 3707]]);
    assert.equal(slip.damaged.length, 1);

    const afraid = player({ stage: 7, answers: [0] });
    await objects.onGameObjectCommandTwo(afraid, down);
    assert.deepEqual(afraid.teleports, []);
    assert.ok(afraid.messages.includes('And you can go no further.'));

    const no = player({ stage: 7, cache: { gujuo_potion: true }, answers: [1] });
    await objects.onGameObjectCommandTwo(no, down);
    assert.deepEqual(no.teleports, []);

    const snapped = player({ stage: 9 });
    await objects.onGameObjectCommandTwo(snapped, down);
    assert.ok(snapped.messages.includes('@que@Perhaps you need a new rope.'));

    const up = obj(1167, 427, 3707);
    const u = player({ stage: 7 });
    await objects.onGameObjectCommandOne(u, up);
    assert.deepEqual(u.teleports, [[471, 3707]]);
});

test('the walkways and stairs of the cave need Agility 50; a fall drops the player back', async () => {
    const walkway = obj(558, 422, 3702);
    const ok = player({ stage: 7, levels: { agility: 70 } });
    await withRandom(0.5, () => objects.onGameObjectCommandOne(ok, walkway));
    assert.deepEqual(ok.teleports, [[422, 3702]]);
    assert.deepEqual(ok.experience, [['agility', 20]]);
    await objects.onGameObjectCommandOne(ok, walkway);
    assert.ok(ok.messages.includes("You're standing there already!"));

    const fall = player({ stage: 7, levels: { agility: 50 } });
    await withRandom(0.99, () => objects.onGameObjectCommandOne(fall, walkway));
    assert.deepEqual(fall.teleports, [[421, 3699]]);
    assert.ok(fall.damaged[0] >= 24);
    assert.deepEqual(fall.experience, [['agility', 5]]);

    const stairs = obj(1114, 426, 3703);
    const low = player({ stage: 7, levels: { agility: 49 } });
    await objects.onGameObjectCommandOne(low, stairs);
    assert.ok(low.messages.includes('You need an agility level of 50 to step these stairs'));

    const down = player({ stage: 7, levels: { agility: 70 }, x: 426, y: 3706 });
    await withRandom(0.5, () => objects.onGameObjectCommandOne(down, stairs));
    assert.deepEqual(down.teleports, [[426, 3704], [426, 3702]]);
    const up = player({ stage: 7, levels: { agility: 70 }, x: 426, y: 3702 });
    await withRandom(0.5, () => objects.onGameObjectCommandOne(up, stairs));
    assert.deepEqual(up.teleports, [[426, 3704], [426, 3706]]);

    const slip = player({ stage: 7, levels: { agility: 50 }, x: 426, y: 3706 });
    await withRandom(0.99, () => objects.onGameObjectCommandOne(slip, stairs));
    assert.deepEqual(slip.teleports, [[426, 3704], [426, 3702]]);
    assert.ok(slip.damaged[0] >= 2 && slip.damaged[0] <= 3);

    for (const id of [1123, 1124, 1125]) {
        const q = player({ stage: 7, levels: { agility: 70 }, x: 419, y: 3702 });
        await withRandom(0.5, () => objects.onGameObjectCommandOne(q, obj(id, 420, 3703)));
        assert.equal(q.teleports.length, 2);
    }
});

test('the dark metal gate: open from the south, spells charge the orb through it, the riddle can be read', async () => {
    const gate = obj(1165, 474, 3715);
    const north = player({ stage: 7, y: 3714 });
    await objects.onGameObjectCommandOne(north, gate);
    assert.deepEqual(north.teleports, [[474, 3720]]);
    const south = player({ stage: 7, y: 3718 });
    await objects.onGameObjectCommandOne(south, gate);
    assert.deepEqual(south.teleports, []);

    const read = player({ stage: 7, answers: [0] });
    await objects.onGameObjectCommandTwo(read, gate);
    assert.equal(read.sent.length, 1);
    const more = player({ stage: 7, answers: [2] });
    await objects.onGameObjectCommandTwo(more, gate);
    assert.ok(more.said.includes('Hmmm, I wonder what they could mean?'));
    const no = player({ stage: 7, answers: [1] });
    await objects.onGameObjectCommandTwo(no, gate);
    assert.ok(no.messages.includes('You decide not to read the message.'));

    assert.equal(await objects.onCastOnGameObject(player({}), obj(1000, 1, 1), {}, 29), false);
    const other = player({ stage: 7 });
    assert.equal(await objects.onCastOnGameObject(other, gate, {}, 5), true);
    assert.ok(other.messages.includes('Nothing interesting happens'));
});

test('the Yommi tree: plant, water, fell, trim, craft and lift the totem pole (checks of the planting)', async () => {
    const earth = obj(1113, 424, 878);
    const kit = [I.GERMINATED, I.BLESSED_PURE, I.RUNE_AXE];
    const levels = { woodcutting: 60, herblaw: 50 };

    const noWater = player({ stage: 8, items: [I.GERMINATED, I.RUNE_AXE], levels });
    await objects.onUseWithGameObject(noWater, earth, { id: I.GERMINATED });
    assert.ok(noWater.messages.includes('the tree when it starts growing.'));
    const noAxe = player({ stage: 8, items: [I.GERMINATED, I.BLESSED_PURE], levels });
    await objects.onUseWithGameObject(noAxe, earth, { id: I.GERMINATED });
    assert.ok(noAxe.messages.includes('fell the tree once it is grown.'));
    const lowWc = player({ stage: 8, items: kit, levels: { woodcutting: 49, herblaw: 50 } });
    await objects.onUseWithGameObject(lowWc, earth, { id: I.GERMINATED });
    assert.ok(lowWc.messages.includes('You need an woodcut level of 50 to'));
    const lowHerb = player({ stage: 8, items: kit, levels: { woodcutting: 60, herblaw: 44 } });
    await objects.onUseWithGameObject(lowHerb, earth, { id: I.GERMINATED });
    assert.ok(lowHerb.messages.includes('You need a herblaw skill of at least 45 to complete this task.'));
    assert.equal(count(lowHerb, I.GERMINATED), 1);

    const withered = player({ stage: 8, items: kit, levels });
    await withRandom(0.99, () => objects.onUseWithGameObject(withered, earth, { id: I.GERMINATED }));
    assert.ok(withered.messages.includes('You planted the seed incorrectly, it withers and dies.'));
    assert.equal(count(withered, I.GERMINATED), 0);

    const seed = player({ stage: 8, items: [I.SEED] });
    await objects.onUseWithGameObject(seed, earth, { id: I.SEED });
    assert.ok(seed.messages.includes('can be planted in the fertile soil.'));

    const p = player({ stage: 8, items: kit, levels });
    const w = p.world;

    w.objectList = [];
    await withRandom(0, () => objects.onUseWithGameObject(p, earth, { id: I.GERMINATED }));
    assert.deepEqual(w.replaced.map((r) => r[1]), [1112, 1107]);

    // the sapling dies after a time if nobody watered it
    w.objectList.push({ id: 1107, x: 424, y: 878 });
    w.runTimeouts();
    assert.ok(p.messages.includes('The Sapling dies.'));

    const tree = { id: 1107, x: 424, y: 878, direction: 2 };
    await objects.onUseWithGameObject(p, tree, { id: I.BLESSED_PURE });
    assert.equal(count(p, I.BLESSED), 1);
    assert.equal(count(p, I.BLESSED_PURE), 0);
    assert.ok(w.replaced.some((r) => r[0] === 1107 && r[1] === 1108));

    const grown = { id: 1108, x: 424, y: 878, owner: 'tester' };
    await objects.onUseWithGameObject(p, grown, { id: I.RUNE_AXE });
    await objects.onUseWithGameObject(p, { id: 1109, x: 424, y: 878, owner: 'tester' }, { id: I.RUNE_AXE });
    await objects.onUseWithGameObject(p, { id: 1110, x: 424, y: 878, owner: 'tester' }, { id: I.RUNE_AXE });
    assert.deepEqual(w.replaced.slice(-3).map((r) => r.join('>')), ['1108>1109', '1109>1110', '1110>1111']);

    const stranger = player({ stage: 8 });
    await objects.onUseWithGameObject(stranger, { id: 1108, x: 1, y: 1, owner: 'someone' }, { id: I.RUNE_AXE });
    assert.ok(stranger.messages.includes('This is not your Yommi Tree.'));

    const pole = { id: 1111, x: 424, y: 878, owner: 'tester' };
    const strong = player({ stage: 8, levels: { strength: 50 } });
    await objects.onGameObjectCommandOne(strong, pole);
    assert.equal(count(strong, I.TOTEM), 1);
    assert.equal(strong.cache.crafted_totem_pole, true);
    assert.equal(strong.skills.strength.current, 45);
    const thief = player({ stage: 8 });
    await objects.onGameObjectCommandOne(thief, { ...pole, owner: 'another' });
    assert.ok(thief.messages.includes('This is not your totem pole to carry.'));

    const dead = player({ stage: 8 });
    await objects.onUseWithGameObject(dead, { id: 1141, x: 2, y: 2 }, { id: I.RUNE_AXE });
    assert.equal(count(dead, I.LOGS), 1);
});

test('the totem poles: stage 8 begins the third fight, stage 9 replaces the pole (9 -> 10) and Gujuo appears', async () => {
    const evil = obj(1169, 395, 896);
    const early = player({ stage: 8, items: [I.TOTEM], cache: { killed_viyeldi: true } });
    await objects.onUseWithGameObject(early, evil, { id: I.TOTEM });
    assert.equal(early.cache.viyeldi_companions, 1);
    const nezi = early.world.added.find((n) => n.id === NEZI);
    assert.ok(early.world.removed.includes(nezi));
    assert.ok(early.world.added.find((n) => n.id === SAN));

    const noCompanions = player({ stage: 8, items: [I.TOTEM] });
    await objects.onUseWithGameObject(noCompanions, evil, { id: I.TOTEM });
    const fight = noCompanions.world.added.find((n) => n.id === NEZI);
    assert.deepEqual(fight.attacked, [noCompanions]);

    const wrong = player({ stage: 3, items: [I.TOTEM] });
    assert.equal(await objects.onUseWithGameObject(wrong, evil, { id: I.TOTEM }), true);
    assert.ok(wrong.messages.includes('Nothing interesting happens'));

    const replace = player({ stage: 9, items: [I.TOTEM] });
    await objects.onUseWithGameObject(replace, evil, { id: I.TOTEM });
    assert.equal(stage(replace), 10);
    assert.equal(count(replace, I.TOTEM), 0);
    assert.ok(replace.world.spawned.some((s) => s.id === GUJUO));
    assert.equal(replace.interlocutor, null);

    const without = player({ stage: 9 });
    await objects.onGameObjectCommandOne(without, evil);
    assert.ok(without.messages.includes('I shall replace it with the Totem pole'));
    const click = player({ stage: 9, items: [I.TOTEM] });
    await objects.onGameObjectCommandOne(click, evil);
    assert.equal(stage(click), 10);

    const done = player({ stage: 10, items: [I.TOTEM] });
    await objects.onUseWithGameObject(done, evil, { id: I.TOTEM });
    assert.ok(done.messages.includes('@que@You feel a great sense of accomplishment'));

    const look = player({ stage: 5 });
    await objects.onGameObjectCommandOne(look, evil);
    assert.ok(look.messages.includes('@que@You don\'t like to look at it for too long.'));
    const red = obj(1170, 512, 536);
    await objects.onGameObjectCommandOne(look, red);
    assert.ok(look.world.replaced.some((r) => r[0] === 1170 && r[1] === 1169));
    const awe = player({ stage: -1 });
    await objects.onGameObjectCommandOne(awe, evil);
    await objects.onGameObjectCommandOne(awe, red);
    assert.ok(awe.messages.includes('@que@and spiritual fullfilment to anyone who looks at it.'));
});

// ---- the demon and the dead heroes ---------------------------------------------------------------------------------------------

test('Nezikchened, first fight (3 -> 4): killed in the octagram; the third-party demon cannot be hurt', async () => {
    const p = player({ stage: 3, x: 452, y: 3706 });
    withNpc(p, npc(UNGADULU));
    const n = withNpc(p, npc(NEZI));
    n.spawnedFor = p;

    assert.equal(await demon.onNPCAttack(p, n), false);
    assert.equal(await demon.onNPCDeath(p, n), true);
    assert.equal(stage(p), 4);
    p.world.runTimeouts();
    await settle();
    assert.ok(p.world.removed.includes(n));
    assert.deepEqual(p.damaged, [7]);

    const other = player({ stage: 3 });
    const foreign = npc(NEZI);
    foreign.spawnedFor = p;
    assert.equal(await demon.onNPCAttack(other, foreign), true);
    assert.ok(other.messages.includes('@que@Your attack glides straight through the Demon.'));
    assert.equal(await demon.onCastOnNPC(other, foreign), true);
    assert.ok(other.messages.includes('Your attack passes through'));
    assert.equal(await demon.onNPCRangedAttack(other, npc(VIYELDI)), true);

    const wrongStage = player({ stage: 6 });
    assert.equal(await demon.onNPCAttack(wrongStage, npc(NEZI)), true);
});

test('Nezikchened, second and third fights: 7 -> 8 near the boulder rock, 8 -> 9 by the totem pole with ashes', async () => {
    const two = player({ stage: 7, x: 410, y: 3735 });
    const n = withNpc(two, npc(NEZI));
    await demon.onNPCDeath(two, n);
    assert.equal(stage(two), 8);

    const wrongPlace = player({ stage: 7, x: 1, y: 1 });
    await demon.onNPCDeath(wrongPlace, withNpc(wrongPlace, npc(NEZI)));
    assert.equal(stage(wrongPlace), 7);

    const three = player({ stage: 8, x: 395, y: 896 });
    await demon.onNPCDeath(three, withNpc(three, npc(NEZI)));
    assert.equal(stage(three), 9);
    assert.deepEqual(three.world.drops.map((d) => d.id), [I.ASHES]);

    assert.equal(await demon.onNPCDeath(three, npc(100)), false);
    assert.equal(await demon.onNPCDeath(undefined, npc(NEZI)), false);
});

test('running from Nezikchened: stage 3 and 8 send him off, stage 7 remembers the player ran', async () => {
    for (const st of [3, 8]) {
        const p = player({ stage: st });
        const n = withNpc(p, npc(NEZI));
        assert.equal(await demon.onNPCEscape(p, n), true);
        assert.ok(p.world.removed.includes(n));
    }

    const seven = player({ stage: 7 });
    const n = withNpc(seven, npc(NEZI));
    assert.equal(await demon.onNPCEscape(seven, n), true);
    assert.equal(seven.cache.ran_from_2nd_nezi, true);
    assert.equal(await demon.onNPCEscape(player({ stage: 5 }), npc(NEZI)), false);
});

test('the heroes: a crystal each for a win, none twice; the cavern flag stops them; companions chain 1 -> 4', async () => {
    for (const [id, crystal] of [[SAN, I.CHUNK], [IRVIG, I.LUMP], [RANALPH, I.HUNK]]) {
        const p = player({ stage: 7 });
        const h = withNpc(p, npc(id));

        // attacking asks for a duel
        assert.equal(await demon.onNPCAttack(p, h), true);
        assert.ok(h.attacked.includes(p));
        assert.equal(await demon.onNPCDeath(p, h), true);
        assert.equal(count(p, crystal), 1);

        const again = player({ stage: 7, items: [crystal] });
        const h2 = withNpc(again, npc(id));
        await demon.onNPCDeath(again, h2);
        assert.equal(count(again, crystal), 1);
        assert.ok(again.messages.includes('Your opponent is retreating'));
        assert.equal(await demon.onNPCAttack(again, h2), false);

        const open = player({ stage: 7, cache: { cavernous_opening: true } });
        assert.equal(await demon.onNPCDeath(open, npc(id)), false);
        assert.equal(await demon.onNPCAttack(open, npc(id)), false);
    }

    const p = player({ stage: 8, cache: { viyeldi_companions: 1, cavernous_opening: true } });
    const san = withNpc(p, npc(SAN));
    await demon.onNPCDeath(p, san);
    assert.equal(p.cache.viyeldi_companions, 2);
    // the next companion is called at once: Irvig Senay
    assert.ok(p.world.added.find((n) => n.id === IRVIG));
    const irvig = p.world.added.find((n) => n.id === IRVIG);
    await demon.onNPCDeath(p, irvig);
    assert.equal(p.cache.viyeldi_companions, 3);
    const ranalph = p.world.added.find((n) => n.id === RANALPH);
    await demon.onNPCDeath(p, ranalph);
    assert.equal(p.cache.viyeldi_companions, 4);
    const finalDemon = p.world.added.filter((n) => n.id === NEZI).at(-1);
    assert.deepEqual(finalDemon.attacked, [p]);
    assert.equal(p.skills.prayer.current, 8);

    const run = player({ stage: 8, cache: { viyeldi_companions: 2 } });
    const hero = withNpc(run, npc(IRVIG));
    assert.equal(await demon.onNPCEscape(run, hero), true);
    assert.ok(run.world.removed.includes(hero));
    assert.equal(await demon.onNPCEscape(player({ stage: 7 }), npc(IRVIG)), false);
});

test('Viyeldi: his hat wakes him, only the dark dagger hurts him (and turns it glowing), killed_viyeldi follows', async () => {
    const hat = { id: I.HAT, x: 426, y: 3708 };
    const p = player({ stage: 7 });

    assert.equal(await demon.onGroundItemTake(p, { id: I.HAT, x: 1, y: 1 }), false);
    assert.equal(await demon.onGroundItemTake(p, hat), true);
    assert.deepEqual(p.teleports, [[426, 3708], [426, 3707]]);
    assert.ok(p.world.spawned.some((s) => s.id === VIYELDI));

    const v = p.world.added.find((n) => n.id === VIYELDI);
    assert.equal(await demon.onNPCAttack(p, v), true);
    assert.ok(v.said.includes('Take challenge with me is useless for I am impervious to your attack'));
    assert.equal(p.cache.killed_viyeldi, undefined);

    const armed = player({ stage: 7, items: [I.DAGGER], equipped: [I.DAGGER] });
    const v2 = withNpc(armed, npc(VIYELDI));
    await demon.onNPCAttack(armed, v2);
    assert.equal(count(armed, I.GLOW_DAGGER), 1);
    assert.equal(count(armed, I.DAGGER), 0);
    assert.equal(armed.cache.killed_viyeldi, true);
    assert.ok(armed.world.removed.includes(v2));

    const late = player({ stage: 8 });
    assert.equal(await demon.onGroundItemTake(late, hat), true);
    assert.equal(late.world.spawned.length, 0);

    const talk = player({ stage: 7, cache: { killed_viyeldi: true } });
    const v3 = withNpc(talk, npc(VIYELDI));
    await demon.onTalkToNPC(talk, v3);
    assert.ok(talk.messages.includes('...and the clothes slump to the floor.'));
    assert.ok(talk.world.removed.includes(v3));
    const warn = player({ stage: 7 });
    const v4 = withNpc(warn, npc(VIYELDI));
    await demon.onTalkToNPC(warn, v4);
    assert.ok(v4.said.includes('Tojalon, Senay and Devere makes three,'));
});

test('Echned Zekin: he gives the dark dagger for the deal; a glowing dagger and the spell start the second fight', async () => {
    const rock = obj(1116, 414, 3725);
    const p = player({ stage: 7, answers: [0, 0, 0, 0, 0, 0, 0] });

    await objects.onGameObjectCommandOne(p, rock);
    const spirit = p.world.spawned.find((s) => s.id === ECHNED);
    assert.ok(spirit);
    assert.equal(count(p, I.DAGGER), 1);
    assert.equal(p.cache.met_spirit, true);

    const solved = player({ stage: 8 });
    await objects.onGameObjectCommandOne(solved, rock);
    assert.ok(solved.world.timed.some((t) => t[0] === 1116 && t[1] === 582));

    const refuse = player({ stage: 7, answers: [1, 1, 1] });
    await objects.onGameObjectCommandOne(refuse, rock);
    assert.equal(count(refuse, I.DAGGER), 0);

    // the dagger without the kill
    const e = withNpc(p, npc(ECHNED));
    p.world.spawned = [];
    p.answers.push(0, 0);
    await demon.echnedTalk(p, e);

    // glowing dagger: Echned takes it and Nezikchened attacks, prayer to 0
    const kill = player({ stage: 7, items: [I.GLOW_DAGGER], levels: { prayer: 50 } });
    const e2 = withNpc(kill, npc(ECHNED));
    await demon.echnedTalk(kill, e2);
    assert.equal(kill.cache.gave_glowing_dagger, true);
    assert.equal(kill.skills.prayer.current, 0);
    const nezi = kill.world.added.find((n) => n.id === NEZI);
    assert.deepEqual(nezi.attacked, [kill]);

    // the spell: prayer halved, the demon's defence cut, a dagger thrown at the one who ran
    const spell = player({ stage: 7, items: [I.SPELL], levels: { prayer: 50 }, cache: { gave_glowing_dagger: true, ran_from_2nd_nezi: true } });
    const e3 = withNpc(spell, npc(ECHNED));
    await withRandom(0.99, () => demon.echnedTalk(spell, e3));
    const second = spell.world.added.find((n) => n.id === NEZI);
    assert.equal(second.skills.defense.current, 95);
    assert.equal(spell.skills.prayer.current, 25);
    assert.deepEqual(spell.damaged, [14]);

    // asking with the spell but no dagger
    const questions = player({ stage: 7, items: [I.SPELL], answers: [3] });
    const e4 = withNpc(questions, npc(ECHNED));
    await demon.echnedTalk(questions, e4);
    assert.ok(questions.world.removed.includes(e4));

    // not stage 7: nothing
    const idle = player({ stage: 5 });
    await demon.echnedTalk(idle, npc(ECHNED));
    assert.equal(idle.messages.length, 0);
});

test('Echned Zekin without a dagger: the plain talk and the pain of coming back empty handed', async () => {
    const plain = player({ stage: 7, answers: [0, 0, 0, 1, 1] });
    const e = withNpc(plain, npc(ECHNED));
    await demon.echnedTalk(plain, e);
    assert.ok(e.said.includes('Who disturbs the rocks of Zekin?'));

    const who = player({ stage: 7, answers: [1, 1, 0, 0] });
    await demon.echnedTalk(who, withNpc(who, npc(ECHNED)));
    assert.ok(who.asked.length > 2);

    const dagger = player({ stage: 7, items: [I.DAGGER], answers: [0, 1, 1] });
    const e2 = withNpc(dagger, npc(ECHNED));
    await demon.echnedTalk(dagger, e2);
    assert.ok(e2.said.includes('Avenge upon me the death of Viyeldi, the cruel.'));

    const spell = player({ stage: 7, items: [I.SPELL], answers: [0, 0, 2], levels: { hits: 50 } });
    const e3 = withNpc(spell, npc(ECHNED));
    await withRandom(0, () => demon.echnedTalk(spell, e3));
    assert.equal(spell.damaged.length, 1);
    assert.ok(spell.damaged[0] >= 8 && spell.damaged[0] <= 15);

    const spirit = player({ stage: 7, answers: [0, 1, 1, 1] });
    const e4 = withNpc(spirit, npc(ECHNED));
    await demon.echnedTalk(spirit, e4);
    assert.ok(spirit.world.removed.includes(e4));
});

// ---- items ---------------------------------------------------------------------------------------------------------------------

test('stage 4 -> 5: the seeds germinate in the blessed bowl of pure water', async () => {
    const p = player({ stage: 4, items: [[I.SEED, 3], I.BLESSED_PURE] });

    assert.equal(await items.onUseWithInventory(p, { id: I.SEED }, { id: I.BLESSED_PURE }), true);
    assert.equal(count(p, I.GERMINATED), 3);
    assert.equal(count(p, I.SEED), 0);
    assert.equal(count(p, I.BLESSED), 1);
    assert.equal(stage(p), 5);

    const other = player({ stage: 7, items: [I.SEED, I.BLESSED_PURE] });
    await items.onUseWithInventory(other, { id: I.BLESSED_PURE }, { id: I.SEED });
    assert.equal(stage(other), 7);
    assert.equal(await items.onUseWithInventory(p, { id: I.ROPE }, { id: I.LOGS }), false);
});

test('the holy water: the book enchants a vial (prayer and magic 10), the bowl fills it, the bowl runs out', async () => {
    const p = player({ stage: 4, items: [I.BOOK, I.EMPTY_VIAL], answers: [3, 0] });
    await items.onInventoryCommand(p, { id: I.BOOK });
    assert.equal(count(p, I.ENCHANTED_VIAL), 1);

    const noVial = player({ stage: 4, items: [I.BOOK], answers: [3, 0] });
    await items.onInventoryCommand(noVial, { id: I.BOOK });
    assert.ok(noVial.messages.includes('This spell looks as if it needs some other components.'));
    const lowPray = player({ stage: 4, items: [I.BOOK], levels: { prayer: 5 }, answers: [3, 0] });
    await items.onInventoryCommand(lowPray, { id: I.BOOK });
    assert.ok(lowPray.messages.includes('You need at least ten prayer points to cast this spell.'));
    const lowMagic = player({ stage: 4, items: [I.BOOK], levels: { magic: 5 }, answers: [3, 1] });
    await items.onInventoryCommand(lowMagic, { id: I.BOOK });
    assert.ok(lowMagic.messages.includes('You need at least ten magic points to cast this spell.'));
    for (const page of [0, 1, 2]) {
        const q = player({ stage: 4, items: [I.BOOK], answers: [page] });
        await items.onInventoryCommand(q, { id: I.BOOK });
        assert.equal(q.sent.length, 1);
    }

    const bowl = player({ stage: 4, items: [I.BLESSED_PURE, I.ENCHANTED_VIAL, I.EMPTY_VIAL] });
    await withRandom(0, () => items.onUseWithInventory(bowl, { id: I.BLESSED_PURE }, { id: I.ENCHANTED_VIAL }));
    assert.equal(count(bowl, I.HOLY_WATER), 1);
    assert.equal(bowl.cache.remaining_blessed_bowl, 1);
    await items.onUseWithInventory(bowl, { id: I.EMPTY_VIAL }, { id: I.BLESSED_PURE });
    assert.equal(count(bowl, I.VIAL), 1);
    assert.equal(count(bowl, I.BLESSED), 1);
    assert.equal(bowl.cache.remaining_blessed_bowl, undefined);

    const many = player({ stage: 4, items: [I.BLESSED_PURE, I.ENCHANTED_VIAL], cache: { remaining_blessed_bowl: 5 } });
    await items.onUseWithInventory(many, { id: I.ENCHANTED_VIAL }, { id: I.BLESSED_PURE });
    assert.equal(many.cache.remaining_blessed_bowl, 4);
    assert.equal(count(many, I.BLESSED_PURE), 1);
});

test('throwing holy water at Ungadulu (stage <= 3): a worn vial, a flag for five minutes', async () => {
    const unworn = player({ stage: 3, items: [I.HOLY_WATER] });
    await items.onInventoryCommand(unworn, { id: I.HOLY_WATER });
    assert.ok(unworn.messages.includes('You need to equip this item to throw it.'));

    const far = player({ stage: 3, items: [I.HOLY_WATER], equipped: [I.HOLY_WATER] });
    await items.onInventoryCommand(far, { id: I.HOLY_WATER });
    assert.ok(far.messages.includes('You see no one suitable to throw it at.'));

    const p = player({ stage: 3, items: [I.HOLY_WATER], equipped: [I.HOLY_WATER] });
    const u = withNpc(p, npc(UNGADULU));
    await items.onInventoryCommand(p, { id: I.HOLY_WATER });
    assert.equal(count(p, I.HOLY_WATER), 0);
    assert.equal(p.cache.holy_water_neiz, true);
    assert.ok(p.world.replaced.some((r) => r[1] === EVIL_UNGADULU));
    p.world.runTimeouts();
    assert.equal(p.cache.holy_water_neiz, undefined);
    assert.ok(u);

    const late = player({ stage: 5, items: [I.HOLY_WATER], equipped: [I.HOLY_WATER] });
    withNpc(late, npc(UNGADULU));
    await items.onInventoryCommand(late, { id: I.HOLY_WATER });
    assert.ok(late.messages.includes('You see no one suitable to throw it at.'));
});

test('the Gujuo potion, notes, tomes and sketches read or drink as the Java says', async () => {
    const p = player({ stage: 7, items: [I.POTION], answers: [0] });
    await items.onInventoryCommand(p, { id: I.POTION });
    assert.equal(p.cache.gujuo_potion, true);
    assert.equal(count(p, I.EMPTY_VIAL), 1);
    assert.equal(count(p, I.POTION), 0);

    const no = player({ stage: 7, items: [I.POTION], answers: [1] });
    await items.onInventoryCommand(no, { id: I.POTION });
    assert.equal(count(no, I.POTION), 1);

    const q = player({ stage: 7 });

    for (const id of [1241, 1242, 1243, 1244]) {
        await items.onInventoryCommand(q, { id });
    }

    assert.equal(q.sent.length, 4);
    await items.onInventoryCommand(q, { id: 1246 });
    await items.onInventoryCommand(q, { id: I.SEED });
    await items.onInventoryCommand(q, { id: I.GERMINATED });
    await items.onInventoryCommand(q, { id: I.RED });
    await items.onInventoryCommand(q, { id: I.GILDED });
    assert.equal(await items.onInventoryCommand(q, { id: I.ROPE }), false);
});

test('the Holy Force Spell on Echned Zekin (stage 7): the demon appears weakened and the prayer is halved', async () => {
    const none = player({ stage: 7, items: [I.SPELL] });
    await items.onInventoryCommand(none, { id: I.SPELL });
    assert.ok(none.messages.includes('@que@There is no suitable candidate to cast this spell on.'));

    const p = player({ stage: 7, items: [I.SPELL], levels: { prayer: 40 } });
    const e = withNpc(p, npc(ECHNED));
    await items.onInventoryCommand(p, { id: I.SPELL });
    assert.ok(p.world.removed.includes(e));
    const nezi = p.world.added.find((n) => n.id === NEZI);
    assert.equal(nezi.skills.defense.current, 95);
    assert.equal(p.skills.prayer.current, 20);
    assert.equal(p.cache.already_cast_holy_spell, true);
    assert.ok(nezi.said.includes('Now I am revealed to you Vacu, so shall ye perish.'));

    const ran = player({ stage: 7, items: [I.SPELL], cache: { ran_from_2nd_nezi: true } });
    withNpc(ran, npc(ECHNED));
    await withRandom(0.99, () => items.onInventoryCommand(ran, { id: I.SPELL }));
    assert.deepEqual(ran.damaged, [14]);
});

test('the map of the Kharazi jungle: three areas, papyrus and charcoal, 30 per cent success', async () => {
    const outside = player({ stage: 1, items: [I.SCROLLS, I.PAPYRUS, I.CHARCOAL], answers: [1], x: 100, y: 100 });
    await items.onInventoryCommand(outside, { id: I.SCROLLS });
    assert.equal(count(outside, I.PAPYRUS), 1);

    const briefing = player({ stage: 1, items: [I.SCROLLS], answers: [0] });
    await items.onInventoryCommand(briefing, { id: I.SCROLLS });
    assert.equal(briefing.sent.length, 1);

    const make = (x, extra = {}) => player({ stage: 1, items: [I.SCROLLS, [I.PAPYRUS, 3], I.CHARCOAL], answers: [1, 1, 1], x, y: 880, levels: { crafting: 50 }, ...extra });
    const p = make(450);

    await withRandom(0, () => items.onInventoryCommand(p, { id: I.SCROLLS }));
    assert.equal(p.cache.JUNGLE_WEST, true);
    assert.equal(count(p, I.PAPYRUS), 2);
    p.x = 400;
    await withRandom(0, () => items.onInventoryCommand(p, { id: I.SCROLLS }));
    assert.equal(p.cache.JUNGLE_MIDDLE, true);

    // an area already done
    p.answers.push(1);
    await withRandom(0, () => items.onInventoryCommand(p, { id: I.SCROLLS }));
    assert.equal(count(p, I.PAPYRUS), 1);
    p.x = 350;
    p.answers.push(1);
    await withRandom(0, () => items.onInventoryCommand(p, { id: I.SCROLLS }));
    assert.equal(count(p, I.MAP), 1);
    assert.equal(count(p, I.SCROLLS), 0);
    assert.equal(p.cache.JUNGLE_EAST, undefined);

    const complete = player({ stage: 1, items: [I.MAP], answers: [0, 0, 1] });
    await items.onInventoryCommand(complete, { id: I.MAP });
    await items.onInventoryCommand(complete, { id: I.MAP });
    assert.equal(complete.sent.length, 2);

    // failures: both lost, paper lost, charcoal broken, paper rescued
    for (const [roll, papyrus, charcoal] of [[0.4, 0, 0], [0.6, 0, 1], [0.8, 1, 0], [0.99, 1, 1]]) {
        const f = player({ stage: 1, items: [I.SCROLLS, I.PAPYRUS, I.CHARCOAL], answers: [1], x: 450, y: 880, levels: { crafting: 50 } });
        await withRandom(roll, () => items.onInventoryCommand(f, { id: I.SCROLLS }));
        assert.equal(count(f, I.PAPYRUS), papyrus, `papyrus at ${roll}`);
        assert.equal(count(f, I.CHARCOAL), charcoal, `charcoal at ${roll}`);
    }

    const noCharcoal = player({ stage: 1, items: [I.SCROLLS, I.PAPYRUS], answers: [1], x: 450, y: 880, levels: { crafting: 50 } });
    await items.onInventoryCommand(noCharcoal, { id: I.SCROLLS });
    assert.ok(noCharcoal.messages.includes("@que@You'll need some charcoal to complete this map."));
    const noPapyrus = player({ stage: 1, items: [I.SCROLLS, I.CHARCOAL], answers: [1], x: 450, y: 880, levels: { crafting: 50 } });
    await items.onInventoryCommand(noPapyrus, { id: I.SCROLLS });
    assert.ok(noPapyrus.messages.includes("@que@You'll need some additional Papyrus to complete this map."));
    const lowCraft = player({ stage: 1, items: [I.SCROLLS, I.PAPYRUS, I.CHARCOAL], answers: [1], x: 450, y: 880, levels: { crafting: 49 } });
    await items.onInventoryCommand(lowCraft, { id: I.SCROLLS });
    assert.ok(lowCraft.messages.includes('You need a crafting level of 50 to perform this task.'));
});

test('the bull roarer calls Gujuo in the jungle (not outside), or an angry native', async () => {
    const outside = player({ stage: 1, items: [I.ROARER], x: 100, y: 100 });
    const f = withNpc(outside, npc(FORESTER));
    await items.onInventoryCommand(outside, { id: I.ROARER });
    assert.ok(f.said.includes('Kharazi jungle, it might attract more natives...'));

    const none = player({ stage: 1, items: [I.ROARER], x: 400, y: 880 });
    await withRandom(0, () => items.onInventoryCommand(none, { id: I.ROARER }));
    assert.ok(none.messages.includes('@que@...but nothing else much seems to happen.'));

    const call = player({ stage: 1, items: [I.ROARER], x: 400, y: 880, answers: [1, 1] });
    await withRandom(0.3, () => items.onInventoryCommand(call, { id: I.ROARER }));
    const g = call.world.spawned.find((s) => s.id === GUJUO);
    assert.ok(g);

    const bird = player({ stage: 1, items: [I.ROARER], x: 400, y: 880 });
    const b = withNpc(bird, npc(777));
    b.definition = { name: 'Oomlie Bird' };
    await withRandom(0.99, () => items.onInventoryCommand(bird, { id: I.ROARER }));
    assert.deepEqual(b.attacked, [bird]);
});

test('dropping a bowl of water spills it, dropping crystals loses them', async () => {
    const p = player({ stage: 3, items: [I.BLESSED_PURE, I.BOWL_PURE, I.CHUNK, I.LOGS] });

    assert.equal(await items.onDropItem(p, { id: I.BLESSED_PURE }), true);
    assert.equal(await items.onDropItem(p, { id: I.BOWL_PURE }), true);
    assert.equal(await items.onDropItem(p, { id: I.CHUNK }), true);
    assert.deepEqual(p.world.drops.map((d) => d.id), [I.BLESSED, I.BOWL]);
    assert.equal(count(p, I.CHUNK), 0);
    assert.equal(await items.onDropItem(p, { id: I.LOGS }), false);
});

// ---- the forester and the gold bowl ---------------------------------------------------------------------------------------------

test('the Jungle Forester: before the quest and during it; the complete map earns the bull roarer', async () => {
    const before = player({ stage: 0, answers: [2, 0, 2] });
    const f = npc(FORESTER);
    assert.equal(await forester.onTalkToNPC(before, f), true);
    assert.ok(f.said.includes("I'm a jungle forester,"));

    const during = player({ stage: 3, answers: [0, 0] });
    const f2 = npc(FORESTER);
    await forester.onTalkToNPC(during, f2);
    assert.ok(f2.said.includes('Oh, well, that sounds quite good actually...'));

    const natives = player({ stage: 3, answers: [2, 0, 0] });
    const f3 = npc(FORESTER);
    await forester.onTalkToNPC(natives, f3);
    assert.ok(f3.said.includes('Well, I wish I could give it to you.'));

    const map = player({ stage: 3, items: [I.MAP], answers: [0] });
    await forester.onUseWithNPC(map, npc(FORESTER), { id: I.MAP });
    assert.equal(count(map, I.ROARER), 1);

    const deal = player({ stage: 3, items: [I.MAP], answers: [1, 0] });
    await forester.onUseWithNPC(deal, npc(FORESTER), { id: I.MAP });
    assert.equal(count(deal, I.ROARER), 1);

    const no = player({ stage: 3, items: [I.MAP], answers: [2] });
    await forester.onUseWithNPC(no, npc(FORESTER), { id: I.MAP });
    assert.equal(count(no, I.ROARER), 0);

    const has = player({ stage: 3, items: [I.MAP, I.ROARER] });
    const h = npc(FORESTER);
    await forester.onUseWithNPC(has, h, { id: I.MAP });
    assert.ok(h.said.includes("It's a great map, thanks for letting me take a copy!"));
    assert.equal(await forester.onUseWithNPC(has, h, { id: I.ROPE }), false);
});

test('the golden bowl: two gold bars, a hammer, Smithing 50; refused before the quest has begun properly (stage 0-2)', async () => {
    const anvil = obj(50, 100, 100);
    const p = player({ stage: 3, items: [[I.GOLD_BAR, 2], I.HAMMER], levels: { smithing: 80 }, answers: [0] });

    assert.equal(await forester.onUseWithGameObject(p, anvil, { id: I.GOLD_BAR }), true);
    assert.equal(count(p, I.BOWL), 1);
    assert.equal(count(p, I.GOLD_BAR), 0);
    assert.deepEqual(p.experience.at(-1), ['smithing', 120]);

    const early = player({ stage: 1, items: [[I.GOLD_BAR, 2], I.HAMMER] });
    await forester.onUseWithGameObject(early, anvil, { id: I.GOLD_BAR });
    assert.ok(early.messages.includes("You're not quite sure what to make from the gold.."));

    const noHammer = player({ stage: 3, items: [[I.GOLD_BAR, 2]] });
    await forester.onUseWithGameObject(noHammer, anvil, { id: I.GOLD_BAR });
    assert.equal(count(noHammer, I.BOWL), 0);

    const one = player({ stage: 3, items: [I.GOLD_BAR, I.HAMMER], answers: [0] });
    await forester.onUseWithGameObject(one, anvil, { id: I.GOLD_BAR });
    assert.ok(one.messages.includes('You need two bars of gold to make this item.'));

    const mistake = player({ stage: 3, items: [[I.GOLD_BAR, 2], I.HAMMER], levels: { smithing: 49 }, answers: [0] });
    await forester.onUseWithGameObject(mistake, anvil, { id: I.GOLD_BAR });
    assert.equal(count(mistake, I.GOLD_BAR), 1);
    assert.deepEqual(mistake.experience.at(-1), ['smithing', 4]);

    const cancel = player({ stage: 3, items: [[I.GOLD_BAR, 2], I.HAMMER], answers: [1] });
    await forester.onUseWithGameObject(cancel, anvil, { id: I.GOLD_BAR });
    assert.equal(count(cancel, I.GOLD_BAR), 2);
    assert.equal(await forester.onUseWithGameObject(cancel, obj(1000, 1, 1), { id: I.GOLD_BAR }), false);
});

test('stage 9 -> 10 -> 11 -> done in a row: the quest keys are the Java stages', async () => {
    const p = player({ stage: 9, items: [I.TOTEM] });
    await objects.onUseWithGameObject(p, obj(1169, 395, 896), { id: I.TOTEM });
    assert.equal(stage(p), 10);
    // Gujuo's gift came with the replaced pole's talk
    p.inventory.add(I.GILDED);
    p.inventory.add(I.MAP);
    await radimus.onUseWithNPC(p, npc(RADIMUS), { id: I.GILDED });
    assert.equal(stage(p), 11);
    radimus.handleReward(p);
    assert.equal(stage(p), -1);
    assert.equal(p.completed[0][1].questPoints, 4);
});
