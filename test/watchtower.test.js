// The Watchtower quest (quests/members/watchtower/*, port of authentic/quests/members/watchtower/*.java with the Watchtower
// parts of InvAction and Herblaw): every stage from the wizard's worry to the lever, driven with fake objects. The Gu'Tanoth
// rock jump, the enclave and the skavid caves have their own tests (object-tele-points.test.js and friends).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const shared = require('../src/plugins/quests/members/watchtower/shared');
const dialogue = require('../src/plugins/quests/members/watchtower/dialogue');
const mechanism = require('../src/plugins/quests/members/watchtower/mechanism');
const gates = require('../src/plugins/quests/members/watchtower/gates');
const obstacles = require('../src/plugins/quests/members/watchtower/obstacles');
const herblaw = require('../src/plugins/quests/members/watchtower/herblaw');
const { fakeNpc, fakeWorld, fakePlayer, gameObject, wallObject } = require('./quest-fakes-3b');

const { NPC, ITEM } = shared;

const PLUGIN_TYPES = [
    ...(/const PLUGIN_TYPES = \[([\s\S]*?)\]/
        .exec(fs.readFileSync(require.resolve('../src/model/world.js'), 'utf8'))[1]
        .matchAll(/'(\w+)'/g))
].map((m) => m[1]);

function player(opts = {}) {
    const p = fakePlayer({ quest: 'watchtower', ...opts });
    p.bank = { has: (id) => (opts.banked || []).includes(id) };
    p.sendBubble = () => {};
    return p;
}

async function talk(p, id) {
    const npc = fakeNpc(id);
    assert.equal(await dialogue.onTalkToNPC(p, npc), true);
    assert.equal(p.interlocutor, null);
    return npc;
}

async function useOn(p, id, itemId) {
    const npc = fakeNpc(id);
    const item = { id: itemId };
    const hit =
        (await dialogue.onUseWithNPC(p, npc, item)) ||
        (await mechanism.onUseWithNPC(p, npc, item)) ||
        (await gates.onUseWithNPC(p, npc, item));
    assert.equal(hit, true);
    assert.equal(p.interlocutor, null);
    return npc;
}

const stage = (p) => p.questStages.watchtower;

test.afterEach(() => {
    shared.rng.int = (low, high) => low + Math.floor(Math.random() * (high - low + 1));
});

test('every exported hook is a plugin type', () => {
    for (const plugin of [dialogue, mechanism, gates, obstacles, herblaw]) {
        for (const name of Object.keys(plugin)) {
            if (/^on[A-Z]/.test(name)) {
                assert.ok(PLUGIN_TYPES.includes(name), name);
            }
        }
    }
});

test('hooks leave other npcs, objects and items alone', async () => {
    const p = player();
    assert.equal(await dialogue.onTalkToNPC(p, fakeNpc(1)), false);
    assert.equal(await dialogue.onUseWithNPC(p, fakeNpc(1), { id: ITEM.FINGERNAILS }), false);
    assert.equal(await dialogue.onNPCAttack(p, fakeNpc(1)), false);
    assert.equal(await dialogue.onNPCDeath(p, fakeNpc(1)), false);
    assert.equal(await mechanism.onUseWithNPC(p, fakeNpc(1), { id: 1 }), false);
    assert.equal(await mechanism.onUseWithNPC(p, fakeNpc(NPC.WATCHTOWER_WIZARD), { id: ITEM.FINGERNAILS }), false);
    assert.equal(await mechanism.onUseWithGameObject(p, gameObject(2, 0, 0), { id: 1 }), false);
    assert.equal(await mechanism.onUseWithInventory(p, { id: 1 }, { id: 2 }), false);
    assert.equal(await mechanism.onGroundItemTake(p, { id: 1 }), false);
    assert.equal(await mechanism.onInventoryCommand(p, { id: 1 }), false);
    assert.equal(await gates.onGameObjectCommandOne(p, gameObject(2, 0, 0)), false);
    assert.equal(await gates.onWallObjectCommandOne(p, wallObject(2, 0, 0)), false);
    assert.equal(await gates.onUseWithNPC(p, fakeNpc(1), { id: 1 }), false);
    assert.equal(await obstacles.onGameObjectCommandOne(p, gameObject(2, 0, 0)), false);
    assert.equal(await herblaw.onUseWithInventory(p, { id: 1 }, { id: 2 }), false);
});

// ---------------------------------------------------------------- stage 0 -> 1

test('stage 0: "Can I be of help ?" starts the quest (1)', async () => {
    const p = player({ answers: [0, 0, 0] });
    const w = await talk(p, NPC.WATCHTOWER_WIZARD);
    assert.equal(stage(p), 1);
    assert.ok(w.said.includes('Try searching the surrounding area'));
});

test('stage 0: every refusal leaves the quest at 0', async () => {
    for (const answers of [[1], [0, 1], [0, 0, 1], [0, 0, 2], [0, 0, 0].slice(0, 2).concat([1])]) {
        const p = player({ answers: [...answers] });
        await talk(p, NPC.WATCHTOWER_WIZARD);
        assert.equal(stage(p), 0, JSON.stringify(answers));
    }
});

test('the tower guard keeps you off the ladder until the quest is started', async () => {
    const ladder = gameObject(659, 638, 741);
    const p = player({ world: fakeWorld({ npcs: [fakeNpc(NPC.TOWER_GUARD)] }) });
    assert.equal(await obstacles.onGameObjectCommandOne(p, ladder), true);
    assert.deepEqual(p.climbs, []);

    const started = player({ stage: 1, world: fakeWorld({ npcs: [fakeNpc(NPC.TOWER_GUARD)] }) });
    assert.equal(await obstacles.onGameObjectCommandOne(started, ladder), true);
    assert.deepEqual(started.climbs, [[659, true]]);
});

test('the tower ladders: 1021 up (or to the basement once done), 1017 down', async () => {
    const p = player({ stage: 3 });
    await obstacles.onGameObjectCommandOne(p, gameObject(1021, 636, 1685));
    assert.deepEqual(p.teleports.pop(), [636, 2628]);
    await obstacles.onGameObjectCommandOne(p, gameObject(1017, 636, 2629));
    assert.deepEqual(p.teleports.pop(), [636, 1684]);
    const done = player({ stage: -1 });
    await obstacles.onGameObjectCommandOne(done, gameObject(1021, 636, 1685));
    assert.deepEqual(done.teleports.pop(), [492, 3524]);
});

// ---------------------------------------------------------------- stage 1 -> 2

test('stage 1: the bushes give the clues; at stage 0 they give nothing', async () => {
    const early = player();
    await obstacles.onGameObjectCommandOne(early, gameObject(961, 638, 722));
    assert.equal(early.inventory.has(ITEM.FINGERNAILS), false);

    const p = player({ stage: 1 });
    await obstacles.onGameObjectCommandOne(p, gameObject(961, 638, 722));
    assert.equal(p.inventory.count(ITEM.FINGERNAILS), 1);
    await obstacles.onGameObjectCommandOne(p, gameObject(961, 638, 722));
    assert.equal(p.inventory.count(ITEM.FINGERNAILS), 1);
    assert.ok(p.said.includes('I have already searched this place'));

    for (const [id, item] of [[993, ITEM.ARMOUR], [992, ITEM.WATCH_TOWER_EYE_PATCH], [991, ITEM.ROBE], [990, ITEM.DAGGER]]) {
        await obstacles.onGameObjectCommandOne(p, gameObject(id, 0, 0));
        assert.equal(p.inventory.count(item), 1, String(id));
    }

    await obstacles.onGameObjectCommandOne(p, gameObject(960, 0, 0));
    assert.ok(p.said.includes('Hmmm, nothing here'));
});

test('stage 1: the fingernails on the wizard (or in the talk) lead to stage 2; the wrong evidence does not', async () => {
    const use = player({ stage: 1, items: [ITEM.FINGERNAILS], answers: [0, 0] });
    const w = await useOn(use, NPC.WATCHTOWER_WIZARD, ITEM.FINGERNAILS);
    assert.equal(stage(use), 2);
    assert.equal(use.inventory.has(ITEM.FINGERNAILS), false);
    assert.ok(w.said.includes('Tribal ogres often hate their neighbours...'));

    const speak = player({ stage: 1, items: [ITEM.FINGERNAILS], answers: [1, 0] });
    await talk(speak, NPC.WATCHTOWER_WIZARD);
    assert.equal(stage(speak), 2);

    const nope = player({ stage: 1, items: [ITEM.FINGERNAILS], answers: [0, 1] });
    await talk(nope, NPC.WATCHTOWER_WIZARD);
    assert.equal(stage(nope), 1);
    assert.ok(nope.messages.includes('The wizard walks away'));

    for (const item of [ITEM.ARMOUR, ITEM.ROBE, ITEM.EYE_PATCH, ITEM.IRON_DAGGER]) {
        const p = player({ stage: 1, items: [item] });
        const wiz = await useOn(p, NPC.WATCHTOWER_WIZARD, item);
        assert.ok(wiz.said.includes('No, sorry this is not evidence'), String(item));
        assert.equal(stage(p), 1);
    }

    const late = player({ stage: 2, items: [ITEM.ARMOUR] });
    await useOn(late, NPC.WATCHTOWER_WIZARD, ITEM.ARMOUR);
    assert.ok(late.messages.includes('The wizard has no need for more evidence'));

    const nothing = player({ stage: 1 });
    const n = await talk(nothing, NPC.WATCHTOWER_WIZARD);
    assert.ok(n.said.includes('There must be something somewhere'));
});

// ---------------------------------------------------------------- stage 2: the ogres

test('Grew: the tooth errand, Gorad and the hand-over', async () => {
    const early = player({ stage: 1 });
    await talk(early, NPC.GREW);
    assert.ok(early.messages.includes('The ogre has nothing to say at the moment...'));

    const p = player({ stage: 2, answers: [0] });
    await talk(p, NPC.GREW);
    assert.equal(p.cache.ogre_grew, true);

    const kill = player({ stage: 2, answers: [1] });
    await talk(kill, NPC.GREW);
    assert.equal(kill.world.spawned.length, 1);
    assert.equal(kill.world.spawned[0].id, NPC.OGRE_GENERAL);
    assert.equal(kill.cache.ogre_grew, undefined);

    // Gorad: ogre_grew makes him fight, otherwise he is only rude
    const g = await talk(p, NPC.GORAD);
    assert.equal(g.attacked.length, 1);
    assert.ok(g.said.includes('You shall die quickly vermin'));

    const dead = fakeNpc(NPC.GORAD);
    assert.equal(await dialogue.onNPCDeath(p, dead), false);
    assert.equal(p.inventory.count(ITEM.OGRE_TOOTH), 1);

    // no tooth yet
    const bare = player({ stage: 2, cache: { ogre_grew: true } });
    const bg = await talk(bare, NPC.GREW);
    assert.ok(bg.said.includes('Either you are a fool, or want to be eaten!'));

    // the tooth (talk and use)
    for (const how of ['talk', 'use']) {
        const q = player({ stage: 2, cache: { ogre_grew: true }, items: [ITEM.OGRE_TOOTH] });
        if (how === 'talk') await talk(q, NPC.GREW);
        else await useOn(q, NPC.GREW, ITEM.OGRE_TOOTH);
        assert.equal(q.inventory.has(ITEM.OGRE_TOOTH), false);
        assert.equal(q.inventory.count(ITEM.OGRE_RELIC_PART_BASE), 1);
        assert.equal(q.inventory.count(ITEM.POWERING_CRYSTAL1), 1);
        assert.equal(q.cache.ogre_relic_part_2, true);
        assert.equal(q.cache.ogre_grew, undefined);
    }

    // the lost things
    const lost = player({ stage: 2, cache: { ogre_relic_part_2: true }, answers: [1, 2, 0] });
    await talk(lost, NPC.GREW);
    assert.equal(lost.inventory.count(ITEM.OGRE_RELIC_PART_BASE), 1);
    await talk(lost, NPC.GREW);
    assert.equal(lost.inventory.count(ITEM.POWERING_CRYSTAL1), 1);
    const liar = player({ stage: 2, cache: { ogre_relic_part_2: true }, items: [ITEM.OGRE_RELIC_PART_BASE, ITEM.POWERING_CRYSTAL1], answers: [1, 2] });
    await talk(liar, NPC.GREW);
    await talk(liar, NPC.GREW);
    assert.equal(liar.inventory.count(ITEM.OGRE_RELIC_PART_BASE), 1);
    assert.equal(liar.inventory.count(ITEM.POWERING_CRYSTAL1), 1);

    // a second tooth is pointless; a tooth with no errand does nothing
    const again = player({ stage: 2, cache: { ogre_relic_part_2: true }, items: [ITEM.OGRE_TOOTH] });
    await useOn(again, NPC.GREW, ITEM.OGRE_TOOTH);
    assert.ok(again.said.includes('I am not sure giving him another tooth will have any purpose'));
    const none = player({ stage: 2, items: [ITEM.OGRE_TOOTH] });
    await useOn(none, NPC.GREW, ITEM.OGRE_TOOTH);
    assert.ok(none.messages.includes('Nothing interesting happens'));
});

test('Gorad: attacking him is refused; talking without the errand is only rude; a quest-less player is turned away', async () => {
    const p = player({ stage: 2 });
    const g = fakeNpc(NPC.GORAD);
    assert.equal(await dialogue.onNPCAttack(p, g), true);
    assert.ok(g.said.includes('Ho Ho! why would I want to fight a worm ?'));

    const punch = player({ stage: 2, answers: [0] });
    await talk(punch, NPC.GORAD);
    assert.deepEqual(punch.damaged, [16]);
    const polite = player({ stage: 2, answers: [1] });
    const pg = await talk(polite, NPC.GORAD);
    assert.ok(pg.said.includes('Go now and you may live another day!'));

    const out = player({ stage: 0 });
    await talk(out, NPC.GORAD);
    assert.ok(out.messages.includes('Gorad is busy, try again later'));
});

test('Og, Toban\'s chest and the gold', async () => {
    const p = player({ stage: 2, answers: [0] });
    await talk(p, NPC.OG);
    assert.equal(p.inventory.count(ITEM.KEY), 1);
    assert.equal(p.cache.ogre_og, true);

    const kill = player({ stage: 2, answers: [1] });
    await talk(kill, NPC.OG);
    assert.equal(kill.world.spawned[0].id, NPC.OGRE_GENERAL);

    // the chest: a click with the key spends it, a use does not
    const chest = gameObject(978, 606, 804);
    const click = player({ stage: 2, items: [ITEM.KEY] });
    await obstacles.onGameObjectCommandOne(click, chest);
    assert.equal(click.inventory.has(ITEM.KEY), false);
    assert.equal(click.inventory.count(ITEM.STOLEN_GOLD), 1);
    assert.deepEqual(click.world.timed[0].slice(0, 2), [978, 979]);

    const use = player({ stage: 2, items: [ITEM.KEY] });
    assert.equal(await mechanism.onUseWithGameObject(use, chest, { id: ITEM.KEY }), true);
    assert.equal(use.inventory.count(ITEM.KEY), 1);
    assert.equal(use.inventory.count(ITEM.STOLEN_GOLD), 1);
    assert.equal(await mechanism.onUseWithGameObject(use, chest, { id: ITEM.KEY }), true);
    assert.equal(use.inventory.count(ITEM.STOLEN_GOLD), 1);
    assert.ok(use.messages.includes('@que@You have already got the stolen gold'));

    const locked = player({ stage: 2 });
    await obstacles.onGameObjectCommandOne(locked, chest);
    assert.ok(locked.messages.includes('The chest is locked'));

    // the gold back to Og
    for (const how of ['talk', 'use']) {
        const q = player({ stage: 2, cache: { ogre_og: true }, items: [ITEM.STOLEN_GOLD], answers: [0] });
        if (how === 'talk') await talk(q, NPC.OG);
        else {
            q.answers = undefined;
            await useOn(q, NPC.OG, ITEM.STOLEN_GOLD);
        }
        assert.equal(q.inventory.count(ITEM.OGRE_RELIC_PART_HEAD), 1);
        assert.equal(q.cache.ogre_relic_part_3, true);
        assert.equal(q.cache.ogre_og, undefined);
    }

    const noGold = player({ stage: 2, cache: { ogre_og: true }, answers: [0, 1] });
    const ng = await talk(noGold, NPC.OG);
    assert.ok(ng.said.includes('Then get the gold I asked for!'));
    const waiting = player({ stage: 2, cache: { ogre_og: true }, answers: [1] });
    await talk(waiting, NPC.OG);

    const lostKey = player({ stage: 2, cache: { ogre_og: true }, answers: [2] });
    await talk(lostKey, NPC.OG);
    assert.equal(lostKey.inventory.count(ITEM.KEY), 1);
    const hasKey = player({ stage: 2, cache: { ogre_og: true }, items: [ITEM.KEY], answers: [2] });
    await talk(hasKey, NPC.OG);
    assert.equal(hasKey.inventory.count(ITEM.KEY), 1);
    assert.ok(hasKey.messages.includes('It seems you still have the key...'));

    const lostPart = player({ stage: 2, cache: { ogre_relic_part_3: true }, answers: [1] });
    await talk(lostPart, NPC.OG);
    assert.equal(lostPart.inventory.count(ITEM.OGRE_RELIC_PART_HEAD), 1);
    const holding = player({ stage: 2, cache: { ogre_relic_part_3: true }, items: [ITEM.OGRE_RELIC_PART_HEAD], answers: [1] });
    await talk(holding, NPC.OG);
    assert.equal(holding.inventory.count(ITEM.OGRE_RELIC_PART_HEAD), 1);
    const more = player({ stage: 2, cache: { ogre_relic_part_3: true }, answers: [0] });
    await talk(more, NPC.OG);

    const busy = player({ stage: 1 });
    await talk(busy, NPC.OG);
    assert.ok(busy.messages.includes("He's busy, try him later"));
    const done = player({ stage: -1 });
    await talk(done, NPC.OG);
    assert.ok(done.messages.includes('The ogre is not interested in you anymore'));
});

test('Toban: the dragon bone errand', async () => {
    const p = player({ stage: 2, answers: [0, 0] });
    await talk(p, NPC.TOBAN);
    assert.equal(p.cache.ogre_toban, true);

    for (const answers of [[0, 1], [1]]) {
        const q = player({ stage: 2, answers: [...answers] });
        const t = await talk(q, NPC.TOBAN);
        assert.equal(t.attacked.length, 1);
        assert.equal(q.cache.ogre_toban, undefined);
    }

    for (const how of ['talk', 'use']) {
        const q = player({ stage: 2, cache: { ogre_toban: true }, items: [ITEM.DRAGON_BONES] });
        if (how === 'talk') await talk(q, NPC.TOBAN);
        else await useOn(q, NPC.TOBAN, ITEM.DRAGON_BONES);
        assert.equal(q.inventory.has(ITEM.DRAGON_BONES), false);
        assert.equal(q.inventory.count(ITEM.OGRE_RELIC_PART_BODY), 1);
        assert.equal(q.cache.ogre_relic_part_1, true);
        assert.equal(q.cache.ogre_toban, undefined);
    }

    const empty = player({ stage: 2, cache: { ogre_toban: true } });
    const e = await talk(empty, NPC.TOBAN);
    assert.ok(e.said.includes('Then you shall get nothing from me!'));

    const lost = player({ stage: 2, cache: { ogre_relic_part_1: true }, answers: [1, 1, 0] });
    await talk(lost, NPC.TOBAN);
    assert.equal(lost.inventory.count(ITEM.OGRE_RELIC_PART_BODY), 1);
    await talk(lost, NPC.TOBAN);
    assert.equal(lost.inventory.count(ITEM.OGRE_RELIC_PART_BODY), 1);
    await talk(lost, NPC.TOBAN);

    const none = player({ stage: 2 });
    await useOn(none, NPC.TOBAN, ITEM.DRAGON_BONES);
    assert.ok(none.messages.includes('Nothing interesting happens'));
});

test('stage 2 -> 3: the three relic parts to the wizard make the ogre relic', async () => {
    const p = player({ stage: 2, items: ITEM_PARTS() });
    await useOn(p, NPC.WATCHTOWER_WIZARD, ITEM.OGRE_RELIC_PART_BODY);
    assert.equal(stage(p), 2);
    assert.equal(p.cache.wizard_relic_part_1, true);
    await useOn(p, NPC.WATCHTOWER_WIZARD, ITEM.OGRE_RELIC_PART_BASE);
    await useOn(p, NPC.WATCHTOWER_WIZARD, ITEM.OGRE_RELIC_PART_HEAD);
    assert.equal(stage(p), 3);
    assert.equal(p.inventory.count(ITEM.OGRE_RELIC), 1);
    assert.equal(p.inventory.has(ITEM.OGRE_RELIC_PART_BODY), false);

    // the same part twice is refused
    const dup = player({ stage: 2, cache: { wizard_relic_part_1: true }, items: [ITEM.OGRE_RELIC_PART_BODY] });
    const w = await useOn(dup, NPC.WATCHTOWER_WIZARD, ITEM.OGRE_RELIC_PART_BODY);
    assert.ok(w.said.includes('I already have that part...'));
    assert.equal(dup.inventory.count(ITEM.OGRE_RELIC_PART_BODY), 1);

    // two parts in the pack do not fit
    const fit = player({ stage: 2, items: ITEM_PARTS() });
    assert.equal(await mechanism.onUseWithInventory(fit, { id: ITEM.OGRE_RELIC_PART_BODY }, { id: ITEM.OGRE_RELIC_PART_HEAD }), true);
    assert.ok(fit.messages.includes("I think these fit together, but I can't seem to make it fit"));

    const relic = player({ stage: 3, items: [ITEM.OGRE_RELIC] });
    const r = await useOn(relic, NPC.WATCHTOWER_WIZARD, ITEM.OGRE_RELIC);
    assert.ok(r.said.includes('It is the ogre statue I finished for you...'));

    const bats = player({ items: [ITEM.BAT_BONES, ITEM.VIAL] });
    assert.equal(await mechanism.onUseWithInventory(bats, { id: ITEM.BAT_BONES }, { id: ITEM.VIAL }), true);
    assert.ok(bats.messages.includes('The bat bones are to bulky to fit in the vial'));
});

function ITEM_PARTS() {
    return [ITEM.OGRE_RELIC_PART_BODY, ITEM.OGRE_RELIC_PART_BASE, ITEM.OGRE_RELIC_PART_HEAD];
}

test('wizard at stage 2: the three menu answers', async () => {
    for (const a of [0, 1, 2]) {
        const p = player({ stage: 2, answers: [a] });
        await talk(p, NPC.WATCHTOWER_WIZARD);
        assert.equal(stage(p), 2);
    }
});

// ---------------------------------------------------------------- stage 3 -> 4: Gu'Tanoth

test('stage 3: the north-west gate guard asks for the relic', async () => {
    const gate = gameObject(989, 666, 772);
    const guardNpc = () => fakeNpc(NPC.OGRE_GUARD_WESTGATE);

    // first time: pushed back, flag set
    const p = player({ stage: 3, x: 665, y: 773, world: fakeWorld({ npcs: [guardNpc()] }) });
    assert.equal(await gates.onGameObjectCommandOne(p, gate), true);
    assert.equal(p.cache.get_ogre_companionship, true);
    assert.deepEqual(p.teleports.pop(), [635, 774]);

    // no relic: back again
    assert.equal(await gates.onGameObjectCommandOne(p, gate), true);
    assert.deepEqual(p.teleports.pop(), [635, 774]);
    assert.equal(p.cache.has_ogre_companionship, undefined);

    // the relic in the pack: let in
    p.inventory.add(ITEM.OGRE_RELIC);
    await gates.onGameObjectCommandOne(p, gate);
    assert.deepEqual(p.teleports.pop(), [667, 773]);
    assert.equal(p.cache.has_ogre_companionship, true);
    assert.equal(p.cache.get_ogre_companionship, undefined);

    // from then on: through (and back out from inside)
    p.x = 665;
    await gates.onGameObjectCommandOne(p, gate);
    assert.deepEqual(p.teleports.pop(), [667, 773]);
    p.x = 667;
    await gates.onGameObjectCommandOne(p, gate);
    assert.deepEqual(p.teleports.pop(), [665, 773]);

    // the guard is away
    const away = player({ stage: 3, x: 665, y: 773 });
    await gates.onGameObjectCommandOne(away, gate);
    assert.ok(away.messages.includes('The ogre guard is currently busy'));

    // using the relic on the guard works too; a part resets the friendship
    const use = player({ stage: 3, cache: { get_ogre_companionship: true }, items: [ITEM.OGRE_RELIC], world: fakeWorld({ npcs: [guardNpc()] }) });
    await gates.onUseWithNPC(use, use.world.npcList[0], { id: ITEM.OGRE_RELIC });
    assert.equal(use.cache.has_ogre_companionship, true);
    const part = player({ stage: 3, cache: { has_ogre_companionship: true }, items: [ITEM.OGRE_RELIC_PART_BODY], world: fakeWorld({ npcs: [guardNpc()] }) });
    await gates.onUseWithNPC(part, part.world.npcList[0], { id: ITEM.OGRE_RELIC_PART_BODY });
    assert.equal(part.cache.has_ogre_companionship, undefined);
    assert.equal(part.cache.get_ogre_companionship, true);

    const done = player({ stage: -1, x: 665, y: 773, world: fakeWorld({ npcs: [guardNpc()] }) });
    await gates.onGameObjectCommandOne(done, gate);
    assert.deepEqual(done.teleports.pop(), [667, 773]);
});

test('the east gate wants a gold bar, the enclave gate is shut', async () => {
    const gate = gameObject(988, 630, 793);
    const eastGuard = () => fakeNpc(NPC.OGRE_GUARD_EASTGATE);
    const p = player({ stage: 3, x: 630, y: 792, world: fakeWorld({ npcs: [eastGuard()] }) });
    await gates.onGameObjectCommandOne(p, gate);
    assert.equal(p.cache.get_gold_ogre, true);
    assert.deepEqual(p.teleports.pop(), [635, 774]);

    await gates.onGameObjectCommandOne(p, gate);
    assert.deepEqual(p.teleports.pop(), [635, 774]);
    p.inventory.add(ITEM.GOLD_BAR);
    await gates.onGameObjectCommandOne(p, gate);
    assert.deepEqual(p.teleports.pop(), [630, 795]);
    assert.equal(p.cache.has_gold_ogre, true);
    assert.equal(p.inventory.has(ITEM.GOLD_BAR), false);

    p.y = 795;
    await gates.onGameObjectCommandOne(p, gate);
    assert.deepEqual(p.teleports.pop(), [630, 792]);

    const shut = player();
    await gates.onGameObjectCommandOne(shut, gameObject(1068, 647, 3645));
    assert.ok(shut.messages.includes('The gate is locked tight'));
});

test('the south-west battlement wants a rock cake', async () => {
    const wall = wallObject(195, 665, 811);
    const guardNpc = () => fakeNpc(NPC.OGRE_GUARD_BATTLEMENT);
    const p = player({ stage: 3, x: 664, y: 811, world: fakeWorld({ npcs: [guardNpc()] }), answers: [0] });
    await gates.onWallObjectCommandOne(p, wall);
    assert.deepEqual(p.teleports.pop(), [665, 811]);

    p.x = 666;
    await gates.onWallObjectCommandOne(p, wall);
    assert.equal(p.cache.get_ogre_gift, true);

    p.x = 666;
    await gates.onWallObjectCommandOne(p, wall);
    assert.deepEqual(p.teleports.pop(), [635, 774]);
    p.inventory.add(ITEM.ROCK_CAKE);
    p.x = 666;
    await gates.onWallObjectCommandOne(p, wall);
    assert.deepEqual(p.teleports.pop(), [663, 812]);
    assert.equal(p.cache.has_ogre_gift, true);
    assert.equal(p.inventory.has(ITEM.ROCK_CAKE), false);

    p.x = 666;
    await gates.onWallObjectCommandOne(p, wall);
    assert.deepEqual(p.teleports.pop(), [665, 812]);

    const fight = player({ x: 666, y: 811, world: fakeWorld({ npcs: [guardNpc()] }), answers: [1, 1] });
    await gates.onWallObjectCommandOne(fight, wall);
    assert.equal(fight.world.npcList[0].attacked.length, 1);
    const leave = player({ x: 666, y: 811, world: fakeWorld({ npcs: [guardNpc()] }), answers: [1, 0] });
    await gates.onWallObjectCommandOne(leave, wall);
    assert.deepEqual(leave.teleports.pop(), [635, 774]);

    const use = player({ cache: { get_ogre_gift: true }, items: [ITEM.ROCK_CAKE], world: fakeWorld({ npcs: [guardNpc()] }) });
    await gates.onUseWithNPC(use, use.world.npcList[0], { id: ITEM.ROCK_CAKE });
    assert.equal(use.cache.has_ogre_gift, true);
    const smack = player({ items: [ITEM.OGRE_RELIC] });
    await gates.onUseWithNPC(smack, fakeNpc(NPC.OGRE_GUARD_BATTLEMENT), { id: ITEM.OGRE_RELIC });
    assert.ok(smack.messages.includes('The guard gives you a smack around the head'));

    const battlement = player();
    assert.equal(await gates.onWallObjectCommandOne(battlement, wallObject(201, 614, 800)), true);
});

test('stage 3 -> 4: the city guard riddle and the death rune', async () => {
    const p = player({ stage: 3, answers: [1] });
    const g = await talk(p, NPC.CITY_GUARD);
    assert.equal(p.cache.city_guard_riddle, false);
    assert.ok(g.said.includes('Now how long I wonder, will this riddle take ?'));

    const rune = player({ stage: 3, cache: { city_guard_riddle: false }, items: [ITEM.DEATH_RUNE] });
    await useOn(rune, NPC.CITY_GUARD, ITEM.DEATH_RUNE);
    assert.equal(stage(rune), 4);
    assert.equal(rune.inventory.count(ITEM.SKAVID_MAP), 1);
    assert.equal(rune.inventory.has(ITEM.DEATH_RUNE), false);
    assert.equal(rune.cache.city_guard_riddle, true);

    // the rune again: not listening
    rune.inventory.add(ITEM.DEATH_RUNE);
    await useOn(rune, NPC.CITY_GUARD, ITEM.DEATH_RUNE);
    assert.ok(rune.messages.includes('The guard is not listening to you'));

    // the solved guard: more riddles, a lost map
    for (const [answers, check] of [[[0, 0], 'You!!!'], [[0, 1], 'Get lost!']]) {
        const q = player({ stage: 4, cache: { city_guard_riddle: true }, answers });
        const cg = await talk(q, NPC.CITY_GUARD);
        assert.ok(cg.said.includes(check));
    }

    const lost = player({ stage: 4, cache: { city_guard_riddle: true }, answers: [1] });
    await talk(lost, NPC.CITY_GUARD);
    assert.equal(lost.inventory.count(ITEM.SKAVID_MAP), 1);
    const has = player({ stage: 4, cache: { city_guard_riddle: true }, items: [ITEM.SKAVID_MAP], answers: [1] });
    await talk(has, NPC.CITY_GUARD);
    assert.equal(has.inventory.count(ITEM.SKAVID_MAP), 1);

    const fight = player({ stage: 3, answers: [0] });
    const f = await talk(fight, NPC.CITY_GUARD);
    assert.equal(f.attacked.length, 1);
});

test('the wizard at stages 3 and 4', async () => {
    const lostRelic = player({ stage: 3, answers: [0] });
    await talk(lostRelic, NPC.WATCHTOWER_WIZARD);
    assert.equal(lostRelic.inventory.count(ITEM.OGRE_RELIC), 1);

    const fine = player({ stage: 3, items: [ITEM.OGRE_RELIC], cache: { has_ogre_companionship: true } });
    const w = await talk(fine, NPC.WATCHTOWER_WIZARD);
    assert.ok(w.said.includes('I bet one of the ogres has one'));

    const riddle = player({ stage: 3, cache: { has_ogre_companionship: true, city_guard_riddle: false }, answers: [1, 1] });
    await talk(riddle, NPC.WATCHTOWER_WIZARD);
    const puzzle = player({ stage: 3, cache: { city_guard_riddle: false }, answers: [0] });
    await talk(puzzle, NPC.WATCHTOWER_WIZARD);
    const scared = player({ stage: 3, cache: { city_guard_riddle: false }, answers: [1, 0] });
    await talk(scared, NPC.WATCHTOWER_WIZARD);

    for (const a of [0, 1, 2]) {
        const p = player({ stage: 4, answers: [a] });
        await talk(p, NPC.WATCHTOWER_WIZARD);
        assert.equal(stage(p), 4);
    }
});

// ---------------------------------------------------------------- stage 4 -> 5: the skavids

test('stage 4 -> 5: the initial skavid teaches the first words; scaring it away does not', async () => {
    const p = player({ stage: 4, answers: [1] });
    const s = await talk(p, NPC.SKAVID_INITIAL);
    assert.equal(stage(p), 5);
    assert.equal(p.cache.skavid_started_language, true);
    assert.ok(s.said.includes('Cur'));

    const scare = player({ stage: 4, answers: [0] });
    const sk = fakeNpc(NPC.SKAVID_INITIAL);
    await dialogue.onTalkToNPC(scare, sk);
    assert.equal(stage(scare), 4);
    assert.equal(scare.world.removed.length, 1);

    const again = player({ stage: 5, cache: { skavid_started_language: true } });
    const a = await talk(again, NPC.SKAVID_INITIAL);
    assert.ok(a.said.includes('Master, how are you doing learning our language ?'));
    const known = player({ stage: 5, cache: { language_cur: true, language_ar: true, language_ig: true, language_nod: true } });
    const k = await talk(known, NPC.SKAVID_INITIAL);
    assert.ok(k.said.includes('You should speak to the mad ones in their cave...'));
    const done = player({ stage: -1 });
    const d = await talk(done, NPC.SKAVID_INITIAL);
    assert.ok(d.said.includes('Ah master...'));
});

test('the four word skavids, the final quiz and the crystal', async () => {
    // before any words are learned
    const dumb = player({ stage: 4 });
    await talk(dumb, NPC.SKAVID_IG);
    assert.ok(dumb.messages.includes("You don't know any skavid words yet!"));

    const words = [
        [NPC.SKAVID_CUR, 'language_cur', 0],
        [NPC.SKAVID_AR, 'language_ar', 1],
        [NPC.SKAVID_IG, 'language_ig', 2],
        [NPC.SKAVID_NOD, 'language_nod', 3]
    ];
    const p = player({ stage: 5, cache: { skavid_started_language: true }, answers: [] });

    for (const [id, key, menu] of words) {
        // a wrong word first
        p.answers = undefined;
        const wrong = player({ stage: 5, cache: { skavid_started_language: true }, answers: [(menu + 1) % 4] });
        await talk(wrong, id);
        assert.equal(wrong.cache[key], undefined);
        assert.ok(wrong.messages.includes('It seems that was the wrong reply'));
        // the right one (the player object keeps its own answer queue through fresh fakes)
        const right = player({ stage: 5, cache: p.cache, answers: [menu] });
        await talk(right, id);
        assert.equal(p.cache[key], true);
        const again = player({ stage: 5, cache: p.cache });
        await talk(again, id);
        assert.ok(again.messages.includes('You have already talked to this skavid'));
    }

    // the quiz: Cur<->Bidith, Ar<->Gor, Tanath<->Ig-ish: [said index, correct menu line]
    for (const [chat, menu] of [[0, 2], [1, 4], [2, 0], [3, 3]]) {
        const q = player({ stage: 5, cache: { ...p.cache }, answers: [menu] });
        shared.rng.int = () => chat;
        await talk(q, NPC.SKAVID_FINALQUIZ);
        assert.equal(q.inventory.count(ITEM.POWERING_CRYSTAL2), 1, String(chat));
        assert.equal(q.cache.skavid_completed_language, true);
        assert.equal(q.cache.language_cur, undefined);
    }

    // the wrong answers: "Ar" upsets it, anything else is just wrong
    const upset = player({ stage: 5, cache: { ...p.cache }, answers: [1] });
    shared.rng.int = () => 0;
    await talk(upset, NPC.SKAVID_FINALQUIZ);
    assert.ok(upset.messages.includes('It seems your response has upset the skavid'));
    assert.equal(upset.inventory.has(ITEM.POWERING_CRYSTAL2), false);
    const wrong = player({ stage: 5, cache: { ...p.cache }, answers: [0] });
    shared.rng.int = () => 0;
    await talk(wrong, NPC.SKAVID_FINALQUIZ);
    assert.ok(wrong.messages.includes('The response was wrong'));

    const nothing = player({ stage: 5 });
    await talk(nothing, NPC.SKAVID_FINALQUIZ);
    assert.ok(nothing.messages.includes('You cannot communicate with the skavid'));

    // after the quiz: a lost crystal is replaced
    const lost = player({ stage: 5, cache: { skavid_completed_language: true }, answers: [0] });
    await talk(lost, NPC.SKAVID_FINALQUIZ);
    assert.equal(lost.inventory.count(ITEM.POWERING_CRYSTAL2), 1);
    const holding = player({ stage: 5, cache: { skavid_completed_language: true }, items: [ITEM.POWERING_CRYSTAL2], answers: [0] });
    await talk(holding, NPC.SKAVID_FINALQUIZ);
    assert.equal(holding.inventory.count(ITEM.POWERING_CRYSTAL2), 1);

    const learned = player({ stage: 5, cache: { skavid_completed_language: true } });
    await talk(learned, NPC.SKAVID_AR);
    assert.ok(learned.messages.includes('You have already learned the skavid language'));
});

// ---------------------------------------------------------------- stage 5 -> 6: nightshade and the robe

test('the cave guard: nightshade runs you past him from stage 5; before that he is busy', async () => {
    const guardNpc = () => fakeNpc(NPC.OGRE_GUARD_CAVE_ENTRANCE);
    const p = player({ stage: 5, items: [ITEM.NIGHTSHADE] });
    await useOn(p, NPC.OGRE_GUARD_CAVE_ENTRANCE, ITEM.NIGHTSHADE);
    assert.deepEqual(p.teleports.pop(), [647, 3644]);
    assert.equal(p.inventory.has(ITEM.NIGHTSHADE), false);

    for (const st of [2, 4, -1]) {
        const early = player({ stage: st, items: [ITEM.NIGHTSHADE] });
        await useOn(early, NPC.OGRE_GUARD_CAVE_ENTRANCE, ITEM.NIGHTSHADE);
        assert.ok(early.messages.includes('The guard is occupied at the moment'), String(st));
        assert.equal(early.inventory.count(ITEM.NIGHTSHADE), 1);
    }

    const talkEarly = player({ stage: 3 });
    const g = await talk(talkEarly, NPC.OGRE_GUARD_CAVE_ENTRANCE);
    assert.ok(g.said.includes('Stop bothering me minion!'));
    for (const a of [0, 1]) {
        const q = player({ stage: 5, answers: [a] });
        const t = await talk(q, NPC.OGRE_GUARD_CAVE_ENTRANCE);
        assert.equal(t.attacked.length, 1);
    }
    const done = player({ stage: -1 });
    await talk(done, NPC.OGRE_GUARD_CAVE_ENTRANCE);
    assert.ok(done.messages.includes('The guard is occupied at the moment'));
    void guardNpc;
});

test('stage 5 -> 6: taking the shaman robe from the ground', async () => {
    const p = player({ stage: 5 });
    assert.equal(await mechanism.onGroundItemTake(p, { id: ITEM.SHAMAN_ROBE, x: 664, y: 3614 }), false);
    assert.equal(stage(p), 6);

    const early = player({ stage: 4 });
    await mechanism.onGroundItemTake(early, { id: ITEM.SHAMAN_ROBE, x: 664, y: 3614 });
    assert.equal(stage(early), 4);
});

test('eating nightshade hurts; the stage 5 wizard answers', async () => {
    const p = player({ items: [ITEM.NIGHTSHADE] });
    assert.equal(await mechanism.onInventoryCommand(p, { id: ITEM.NIGHTSHADE }), true);
    assert.equal(p.inventory.has(ITEM.NIGHTSHADE), false);
    assert.deepEqual(p.damaged, [Math.floor(30 * 0.166666666 + 14)]);

    for (const a of [0, 1, 2]) {
        const q = player({ stage: 5, answers: [a] });
        await talk(q, NPC.WATCHTOWER_WIZARD);
        assert.equal(stage(q), 5);
    }
});

// ---------------------------------------------------------------- stage 6 -> 7 -> 8: the potion

test('stage 6 -> 7: the wizard explains the potion', async () => {
    const p = player({ stage: 6 });
    const w = await talk(p, NPC.WATCHTOWER_WIZARD);
    assert.equal(stage(p), 7);
    assert.ok(w.said.includes('It is too dangerous in the hands of the unskilled...'));
});

test('the ogre potion: Herblaw 14, Druidic Ritual, stage 6+; wrong orders explode', async () => {
    const mix = (p) => herblaw.onUseWithInventory(p, { id: ITEM.UNFINISHED_OGRE_POTION }, { id: ITEM.GROUND_BAT_BONES });
    const items = [ITEM.UNFINISHED_OGRE_POTION, ITEM.GROUND_BAT_BONES];

    const ok = player({ stage: 6, items, levels: { herblaw: 14 } });
    ok.questStages.druidicRitual = -1;
    assert.equal(await mix(ok), true);
    assert.equal(ok.inventory.count(ITEM.OGRE_POTION), 1);
    assert.equal(ok.inventory.has(ITEM.GROUND_BAT_BONES), false);
    assert.deepEqual(ok.experience, [['herblaw', 100]]);

    // the other way round
    const rev = player({ stage: 7, items, levels: { herblaw: 14 } });
    rev.questStages.druidicRitual = -1;
    await herblaw.onUseWithInventory(rev, { id: ITEM.GROUND_BAT_BONES }, { id: ITEM.UNFINISHED_OGRE_POTION });
    assert.equal(rev.inventory.count(ITEM.OGRE_POTION), 1);

    const low = player({ stage: 6, items, levels: { herblaw: 13 } });
    low.questStages.druidicRitual = -1;
    await mix(low);
    assert.equal(low.inventory.count(ITEM.OGRE_POTION), 0);
    assert.ok(low.messages.some((m) => /herblaw level of 14/.test(m)));

    const noDruid = player({ stage: 6, items, levels: { herblaw: 14 } });
    await mix(noDruid);
    assert.ok(noDruid.messages.includes('You need to complete Druidic ritual quest first'));

    const early = player({ stage: 3, items, levels: { herblaw: 14 } });
    early.questStages.druidicRitual = -1;
    await mix(early);
    assert.equal(early.inventory.count(ITEM.OGRE_POTION), 0);
    assert.ok(early.said.includes('It might have unpredictable results...'));

    // the explosions
    for (const ingredient of [ITEM.GUAM_LEAF, ITEM.GROUND_BAT_BONES]) {
        const boom = player({ items: [ITEM.UNFINISHED_POTION, ingredient] });
        assert.equal(await herblaw.onUseWithInventory(boom, { id: ITEM.UNFINISHED_POTION }, { id: ingredient }), true);
        assert.deepEqual(boom.damaged, [8]);
        assert.equal(boom.inventory.count(ITEM.EMPTY_VIAL), 1);
        assert.equal(boom.inventory.has(ITEM.UNFINISHED_POTION), false);
        assert.equal(boom.inventory.has(ingredient), false);
    }
});

test('stage 7 -> 8: the wizard enchants the ogre potion (talk and use)', async () => {
    for (const how of ['talk', 'use']) {
        const p = player({ stage: 7, items: [ITEM.OGRE_POTION] });
        if (how === 'talk') await talk(p, NPC.WATCHTOWER_WIZARD);
        else await useOn(p, NPC.WATCHTOWER_WIZARD, ITEM.OGRE_POTION);
        assert.equal(stage(p), 8);
        assert.equal(p.inventory.count(ITEM.MAGIC_OGRE_POTION), 1);
        assert.equal(p.inventory.has(ITEM.OGRE_POTION), false);
    }

    const none = player({ stage: 7 });
    const w = await talk(none, NPC.WATCHTOWER_WIZARD);
    assert.ok(w.said.includes('Jangerberries and ground bat bones'));
    assert.equal(stage(none), 7);

    const unfinished = player({ stage: 7, items: [ITEM.UNFINISHED_OGRE_POTION] });
    const u = await useOn(unfinished, NPC.WATCHTOWER_WIZARD, ITEM.UNFINISHED_OGRE_POTION);
    assert.ok(u.said.includes('No no, the potion is not complete yet...'));

    const done = player({ stage: -1, items: [ITEM.OGRE_POTION] });
    await useOn(done, NPC.WATCHTOWER_WIZARD, ITEM.OGRE_POTION);
    assert.equal(done.inventory.has(ITEM.OGRE_POTION), false);
    assert.equal(done.inventory.has(ITEM.MAGIC_OGRE_POTION), false);

    const again = player({ stage: 8, items: [ITEM.MAGIC_OGRE_POTION] });
    const a = await useOn(again, NPC.WATCHTOWER_WIZARD, ITEM.MAGIC_OGRE_POTION);
    assert.ok(a.said.includes('Go and use it now...'));

    const vial = player({ items: [ITEM.VIAL] });
    await useOn(vial, NPC.WATCHTOWER_WIZARD, ITEM.VIAL);
    assert.equal(vial.inventory.count(ITEM.EMPTY_VIAL), 1);
    const map = player({ items: [ITEM.SKAVID_MAP] });
    const m = await useOn(map, NPC.WATCHTOWER_WIZARD, ITEM.SKAVID_MAP);
    assert.ok(m.said.includes('I suggest you search these now...'));
    const junk = player({ items: [1] });
    await useOn(junk, NPC.WATCHTOWER_WIZARD, 1);
    assert.ok(junk.messages.includes('Nothing interesting happens'));
});

// ---------------------------------------------------------------- stage 8 -> 9: the shaman

test('ogre shaman: talking hurts, the plain potion fizzles, the magic potion needs Magic 14', async () => {
    const p = player({ stage: 8 });
    const s = await talk(p, NPC.OGRE_SHAMAN);
    assert.deepEqual(p.damaged, [Math.floor(30 * 0.2 + 10)]);
    assert.ok(s.said.includes('We will destroy you!'));

    const plain = player({ stage: 8, items: [ITEM.OGRE_POTION] });
    await useOn(plain, NPC.OGRE_SHAMAN, ITEM.OGRE_POTION);
    assert.ok(plain.messages.includes('But the potion was ineffective'));
    assert.equal(plain.inventory.count(ITEM.OGRE_POTION), 1);

    const weak = player({ stage: 8, items: [ITEM.MAGIC_OGRE_POTION], levels: { magic: 13 } });
    await useOn(weak, NPC.OGRE_SHAMAN, ITEM.MAGIC_OGRE_POTION);
    assert.ok(weak.messages.includes('You need a level of 14 magic first'));
    assert.equal(weak.world.removed.length, 0);
});

test('stage 8 -> 9: six shaman and the crystal', async () => {
    const p = player({ stage: 8, items: [ITEM.MAGIC_OGRE_POTION], levels: { magic: 20 } });

    for (let i = 1; i <= 5; i++) {
        await useOn(p, NPC.OGRE_SHAMAN, ITEM.MAGIC_OGRE_POTION);
        assert.equal(p.cache.shaman_count, i);
        assert.equal(stage(p), 8);
        assert.equal(p.inventory.count(ITEM.MAGIC_OGRE_POTION), 1);
    }

    assert.ok(['Thats one destroyed...', 'Thats the second one gone...', 'Thats the next one dealt with...', 'There goes another one...', 'Thats five, only one more left now...'].every((l) => p.said.includes(l)));
    await useOn(p, NPC.OGRE_SHAMAN, ITEM.MAGIC_OGRE_POTION);
    assert.equal(stage(p), 9);
    assert.equal(p.cache.shaman_count, 6);
    assert.equal(p.inventory.count(ITEM.POWERING_CRYSTAL3), 1);
    assert.equal(p.inventory.count(ITEM.EMPTY_VIAL), 1);
    assert.equal(p.inventory.has(ITEM.MAGIC_OGRE_POTION), false);
    assert.equal(p.world.removed.length, 6);
});

test('the shaman robe holds the lost crystal at stages 8 and 9', async () => {
    const p = player({ stage: 8 });
    await mechanism.onInventoryCommand(p, { id: ITEM.SHAMAN_ROBE });
    assert.equal(p.inventory.count(ITEM.POWERING_CRYSTAL3), 1);
    await mechanism.onInventoryCommand(p, { id: ITEM.SHAMAN_ROBE });
    assert.equal(p.inventory.count(ITEM.POWERING_CRYSTAL3), 1);

    const banked = player({ stage: 9, banked: [ITEM.POWERING_CRYSTAL3] });
    await mechanism.onInventoryCommand(banked, { id: ITEM.SHAMAN_ROBE });
    assert.equal(banked.inventory.has(ITEM.POWERING_CRYSTAL3), false);
    assert.ok(banked.said.includes('I already have this in my bank'));

    const early = player({ stage: 6 });
    await mechanism.onInventoryCommand(early, { id: ITEM.SHAMAN_ROBE });
    assert.equal(early.inventory.has(ITEM.POWERING_CRYSTAL3), false);
});

// ---------------------------------------------------------------- stage 9 -> 10 -> done

test('stage 9 -> 10: the four crystals to the wizard', async () => {
    const all = [ITEM.POWERING_CRYSTAL1, ITEM.POWERING_CRYSTAL2, ITEM.POWERING_CRYSTAL3, ITEM.POWERING_CRYSTAL4];

    const p = player({ stage: 9, items: all });
    const w = await useOn(p, NPC.WATCHTOWER_WIZARD, ITEM.POWERING_CRYSTAL1);
    assert.equal(stage(p), 10);
    assert.ok(w.said.includes('Throw the lever to activate the system...'));

    // one crystal at a time: keep searching
    const one = player({ stage: 9, items: [ITEM.POWERING_CRYSTAL2] });
    const o = await useOn(one, NPC.WATCHTOWER_WIZARD, ITEM.POWERING_CRYSTAL2);
    assert.equal(stage(one), 9);
    assert.ok(o.said.includes('Keep searching for the others'));
    await useOn(one, NPC.WATCHTOWER_WIZARD, ITEM.POWERING_CRYSTAL2);

    // the fourth shown early sets crystal_rock, which changes the stage 9 talk
    const rock = player({ stage: 9, items: [ITEM.POWERING_CRYSTAL4] });
    await useOn(rock, NPC.WATCHTOWER_WIZARD, ITEM.POWERING_CRYSTAL4);
    assert.equal(rock.cache.crystal_rock, true);
    for (const a of [0, 1, 2]) {
        const q = player({ stage: 9, cache: { crystal_rock: true }, answers: [a] });
        await talk(q, NPC.WATCHTOWER_WIZARD);
        assert.equal(stage(q), 9);
    }
    const plain = player({ stage: 9 });
    const pw = await talk(plain, NPC.WATCHTOWER_WIZARD);
    assert.ok(pw.said.includes('Look for the source of the shaman power...'));

    for (const id of [ITEM.POWERING_CRYSTAL3, ITEM.POWERING_CRYSTAL1]) {
        const q = player({ stage: 10, items: [id] });
        const r = await useOn(q, NPC.WATCHTOWER_WIZARD, id);
        assert.ok(r.said.includes("I don't need any more now..."));
    }

    const eight = player({ stage: 8, answers: [0] });
    await talk(eight, NPC.WATCHTOWER_WIZARD);
    for (const a of [0, 1, 2]) {
        const q = player({ stage: 8, answers: [a] });
        await talk(q, NPC.WATCHTOWER_WIZARD);
        assert.equal(stage(q), 8);
    }

    const ten = player({ stage: 10 });
    const t = await talk(ten, NPC.WATCHTOWER_WIZARD);
    assert.ok(t.said.includes('The system is not activated yet'));
});

test('crystals on the ground: free at stage 9, stuck on the pedestal or after the quest (and they renew magic)', async () => {
    const p = player({ stage: 9 });
    assert.equal(await mechanism.onGroundItemTake(p, { id: ITEM.POWERING_CRYSTAL4, x: 600, y: 600 }), false);

    const stuck = player({ stage: -1, levels: { magic: 30 } });
    stuck.skills.magic.current = 10;
    assert.equal(await mechanism.onGroundItemTake(stuck, { id: ITEM.POWERING_CRYSTAL4, x: 490, y: 3520 }), true);
    assert.equal(stuck.skills.magic.current, 30);

    const pedestal = player({ stage: 9, levels: { magic: 30 } });
    pedestal.skills.magic.current = 5;
    assert.equal(await mechanism.onGroundItemTake(pedestal, { id: ITEM.POWERING_CRYSTAL1, x: 495, y: 3525 }), true);
    assert.equal(pedestal.skills.magic.current, 30);
});

test('stage 10 -> done: the lever pays the reward; any other stage it has no effect', async () => {
    const lever = gameObject(1014, 636, 2624);
    const crystals = [ITEM.POWERING_CRYSTAL1, ITEM.POWERING_CRYSTAL2, ITEM.POWERING_CRYSTAL3, ITEM.POWERING_CRYSTAL4];
    const wiz = fakeNpc(NPC.WATCHTOWER_WIZARD);
    const p = player({ stage: 10, items: crystals, world: fakeWorld({ npcs: [wiz] }), levels: { magic: 40 } });
    assert.equal(await obstacles.onGameObjectCommandOne(p, lever), true);
    assert.equal(stage(p), -1);
    assert.deepEqual(p.teleports.pop(), [492, 3521]);
    assert.equal(p.inventory.count(ITEM.COINS), 5000);
    assert.equal(p.inventory.count(ITEM.SPELL_SCROLL), 1);
    for (const c of crystals) assert.equal(p.inventory.has(c), false);
    assert.equal(p.completed.length, 1);
    assert.deepEqual(p.completed[0][1].experience, { magic: 1000 + 1000 * 40 });
    assert.equal(p.completed[0][1].questPoints, 4);
    assert.deepEqual(p.world.timed[0].slice(0, 2), [1014, 1015]);

    // the wizards away
    const busy = player({ stage: 10, items: crystals });
    await obstacles.onGameObjectCommandOne(busy, lever);
    assert.equal(stage(busy), 10);
    assert.ok(busy.messages.includes('Seems like the wizards were busy, please go back and complete again'));

    for (const st of [0, 5, 9]) {
        const q = player({ stage: st });
        await obstacles.onGameObjectCommandOne(q, lever);
        assert.ok(q.messages.includes('It had no effect'));
        assert.equal(stage(q), st);
    }

    const down = player();
    await obstacles.onGameObjectCommandOne(down, gameObject(1015, 492, 3520));
    assert.ok(down.messages.includes('The lever is stuck in the down position'));
});

test('after the quest: the spell scroll teaches the Watchtower teleport; a lost scroll is replaced once', async () => {
    const p = player({ stage: -1, items: [ITEM.SPELL_SCROLL] });
    assert.equal(await mechanism.onInventoryCommand(p, { id: ITEM.SPELL_SCROLL }), true);
    assert.equal(p.cache.watchtower_scroll, true);
    assert.equal(p.inventory.has(ITEM.SPELL_SCROLL), false);

    const lost = player({ stage: -1, answers: [0] });
    await talk(lost, NPC.WATCHTOWER_WIZARD);
    assert.equal(lost.inventory.count(ITEM.SPELL_SCROLL), 1);
    const holding = player({ stage: -1, items: [ITEM.SPELL_SCROLL], answers: [0] });
    const h = await talk(holding, NPC.WATCHTOWER_WIZARD);
    assert.ok(h.said.includes('There it is, in your backpack!'));
    const banked = player({ stage: -1, banked: [ITEM.SPELL_SCROLL], answers: [0] });
    const b = await talk(banked, NPC.WATCHTOWER_WIZARD);
    assert.ok(b.said.includes('There it is, in your bank!'));
    const okay = player({ stage: -1, answers: [1] });
    await talk(okay, NPC.WATCHTOWER_WIZARD);
    const learned = player({ stage: -1, cache: { watchtower_scroll: true } });
    const l = await talk(learned, NPC.WATCHTOWER_WIZARD);
    assert.ok(l.said.includes('Yanilee is safe at last!'));
});

test('chests 1003 and 1001 are booby trapped; the odd ogres talk', async () => {
    const west = gameObject(1003, 659, 804);
    const emerald = player();
    shared.rng.int = () => 6;
    await obstacles.onGameObjectCommandOne(emerald, west);
    assert.equal(emerald.inventory.count(ITEM.EMERALD), 1);
    const scorpion = player();
    shared.rng.int = () => 0;
    await obstacles.onGameObjectCommandOne(scorpion, west);
    assert.equal(scorpion.world.spawned[0].id, NPC.POISON_SCORPION);
    assert.equal(scorpion.world.npcList[0].attacked.length, 1);

    const east = player();
    await obstacles.onGameObjectCommandOne(east, gameObject(1001, 646, 795));
    assert.equal(east.world.spawned[0].id, NPC.POISON_SPIDER);

    const citizen = await talk(player(), NPC.OGRE_CITIZEN);
    assert.deepEqual(citizen.said, ['Uh ? what are you doing here ?']);
    const trader = await talk(player(), NPC.OGRE_TRADER_FOOD);
    assert.equal(trader.attacked.length, 1);
    const cakes = await talk(player(), NPC.OGRE_TRADER_ROCKCAKE);
    assert.equal(cakes.attacked.length, 1);
});
