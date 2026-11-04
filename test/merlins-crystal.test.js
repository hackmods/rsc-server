// Merlin's Crystal (quests/members/merlins-crystal/*.js, port of MerlinsCrystal.java, Lady.java, CandleMakerShop.java,
// ArheinGeneralShop.java and InvUseOnItem.java's candles): every stage driven with fakes.

const test = require('node:test');
const assert = require('node:assert/strict');

const camelot = require('../src/plugins/quests/members/merlins-crystal/camelot');
const keep = require('../src/plugins/quests/members/merlins-crystal/keep-le-faye');
const excalibur = require('../src/plugins/quests/members/merlins-crystal/excalibur');
const thrantax = require('../src/plugins/quests/members/merlins-crystal/thrantax');
const candleMaker = require('../src/plugins/npcs/catherby/candle-maker-shop');
const arhein = require('../src/plugins/npcs/catherby/arhein-general-shop');
const grum = require('../src/plugins/npcs/port-sarim/grum');
const { fakeNpc, fakeWorld, fakePlayer, gameObject, wallObject } = require('./quest-fakes-2a');

const KING_ARTHUR = 275;
const GAWAIN = 274;
const LANCELOT = 273;
const MORDRED = 276;
const LE_FAYE = 281;
const CANDLEMAKER = 282;
const LADY = 283;
const BEGGAR = 286;
const MERLIN = 287;
const THRANTAX = 288;

function player(opts = {}) {
    const p = fakePlayer({ quest: 'merlinsCrystal', ...opts });
    p.isMale = () => true;
    p.sendTeleportBubble = () => {};
    p.openShop = (name) => p.messages.push(`shop:${name}`);
    return p;
}

test('stage 0 -> 2: King Arthur, then Gawain names Morgan Le Faye and Lancelot names the sea entrance', async () => {
    const p = player({ answers: [0] });
    assert.equal(await camelot.onTalkToNPC(p, fakeNpc(KING_ARTHUR)), true);
    assert.equal(p.questStages.merlinsCrystal, 1);

    // Lancelot before Gawain has nothing to say about the stronghold
    const lancelotFirst = player({ stage: 1, answers: [0] });
    await camelot.onTalkToNPC(lancelotFirst, fakeNpc(LANCELOT));
    assert.equal(lancelotFirst.asked[0].length, 2);
    assert.equal(lancelotFirst.questStages.merlinsCrystal, 1);

    // Gawain: "Do you know how Merlin got trapped" -> "Thankyou for the information"
    const g = player({ stage: 1, answers: [2, 1] });
    await camelot.onTalkToNPC(g, fakeNpc(GAWAIN));
    assert.equal(g.cache.talkedToGawain, true);

    g.asked.length = 0;
    const answers = [2];
    g.ask = async (options, repeat) => {
        g.asked.push(options);
        const choice = answers.shift();
        if (repeat) g.said.push(options[choice]);
        return choice;
    };
    await camelot.onTalkToNPC(g, fakeNpc(LANCELOT));
    assert.equal(g.questStages.merlinsCrystal, 2);
    assert.equal(g.cache.talkedToGawain, undefined);
});

test('stage 2: Arhein mentions the fort; stowing away needs stage 2 and Arhein out of sight', async () => {
    const a = player({ stage: 2, answers: [2, 0, 0] });
    await arhein.onTalkToNPC(a, fakeNpc(280));
    assert.ok(a.said.includes('can you drop me off on the way down please'));

    const ship = gameObject(292, 436, 509);
    const early = player({ stage: 1 });
    await keep.onGameObjectCommandOne(early, ship);
    assert.deepEqual(early.messages, ['I have no reason to do that']);

    const watched = player({ stage: 2, world: fakeWorld({ npcs: [fakeNpc(280, { x: 440, y: 502 })] }), x: 436, y: 506 });
    const shouting = watched.world.npcList[0];
    await keep.onGameObjectCommandOne(watched, ship);
    assert.deepEqual(shouting.said, ['Oi get away from there!']);
    assert.deepEqual(watched.teleports, []);

    // a busy Arhein (in a conversation) does not see you (Functions.ifnearvisnpc: !isBusy)
    shouting.locked = true;
    await keep.onGameObjectCommandOne(watched, ship);
    assert.deepEqual(watched.teleports.at(-1), [456, 520]);
    assert.deepEqual(shouting.said, ['Oi get away from there!']);

    const p = player({ stage: 2 });
    assert.equal(await keep.onGameObjectCommandOne(p, ship), true);
    assert.deepEqual(p.teleports, [
        [456, 3352],
        [456, 520]
    ]);
    assert.equal(p.messages.at(-1), 'You sneak out of the ship');
});

test('stage 2 -> 3: sparing Mordred gets Morgan Le Faye to tell how to free Merlin', async () => {
    const p = player({ stage: 2, answers: [0, 1] });
    const mordred = fakeNpc(MORDRED);
    mordred.skills = { hits: { base: 40, current: 0 } };
    mordred.abandonFight = () => {};
    assert.equal(await keep.onNPCDeath(p, mordred), true);
    assert.equal(p.questStages.merlinsCrystal, 3);
    assert.equal(mordred.skills.hits.current, 40);
    assert.deepEqual(p.world.spawned.map((s) => s.id), [LE_FAYE]);
    const leFaye = p.world.npcList.find((n) => n.id === LE_FAYE);
    assert.ok(leFaye.said.includes('This will summon the demon Thrantax'));
    assert.ok(p.messages.includes('Morgan Le Faye vanishes'));

    // "No he deserves to die"
    const k = player({ stage: 2, answers: [1] });
    const m2 = fakeNpc(MORDRED);
    m2.skills = { hits: { base: 40, current: 0 } };
    m2.abandonFight = () => {};
    await keep.onNPCDeath(k, m2);
    assert.equal(k.questStages.merlinsCrystal, 2);
    assert.deepEqual(k.world.removed, [m2]);

    // the bucket crate
    const b = player({ answers: [0] });
    await keep.onGameObjectCommandTwo(b, gameObject(291, 441, 507));
    assert.ok(b.inventory.has(21));
});

test('stage 3: wax, the black candle, lighting it, the magic words and Thrantax (stage 4)', async () => {
    const p = player({ stage: 3, items: [21, 603, 166, 604, 604], x: 448, y: 435 });

    // no repellant yet: stung
    const stung = player({ stage: 3, items: [21] });
    await camelot.onUseWithGameObject(stung, gameObject(294, 471, 489), { id: 21 });
    assert.deepEqual(stung.damaged, [2]);

    await camelot.onUseWithGameObject(p, gameObject(294, 471, 489), { id: 603 });
    await camelot.onUseWithGameObject(p, gameObject(294, 471, 489), { id: 21 });
    assert.ok(p.inventory.has(605));
    assert.equal(p.cache.squirt, undefined);

    p.answers = [0];
    const answers = [0];
    p.ask = async (options, repeat) => {
        p.asked.push(options);
        const choice = answers.shift();
        if (repeat) p.said.push(options[choice]);
        return choice;
    };
    await candleMaker.onTalkToNPC(p, fakeNpc(CANDLEMAKER));
    assert.equal(p.cache.candlemaker, true);
    await candleMaker.onTalkToNPC(p, fakeNpc(CANDLEMAKER));
    assert.ok(p.inventory.has(600));
    assert.ok(!p.inventory.has(605));

    await thrantax.onUseWithInventory(p, { id: 166 }, { id: 600 });
    assert.ok(p.inventory.has(602));

    // without the magic words the bones just drop
    assert.equal(await thrantax.onDropItem(p, { id: 604 }), false);

    await thrantax.onGameObjectCommandTwo(p, gameObject(296, 116, 366));
    assert.equal(p.cache.magicWords, true);

    // wrong words: the candle is lost and Thrantax attacks
    answers.push(0);
    await thrantax.onDropItem(p, { id: 604 });
    const angry = p.world.npcList.find((n) => n.id === THRANTAX);
    assert.deepEqual(angry.attacked, [p]);
    assert.ok(!p.inventory.has(602));
    assert.equal(p.questStages.merlinsCrystal, 3);

    p.inventory.add(602);
    answers.push(1);
    assert.equal(await thrantax.onDropItem(p, { id: 604 }), true);
    assert.equal(p.questStages.merlinsCrystal, 4);
    assert.ok(p.said.includes('I wish to free Merlin from his giant crystal'));
});

test('Excalibur: the Lady sets her test, the beggar takes bread at the jeweller door', async () => {
    const l = player({ stage: 3, answers: [2] });
    await excalibur.onTalkToNPC(l, fakeNpc(LADY));
    assert.equal(l.cache.ladyTest, true);

    const before = player({ stage: 3, answers: [] });
    await excalibur.onTalkToNPC(before, fakeNpc(LADY)).catch(() => {});
    assert.equal(before.asked[0].length, 3);

    const door = wallObject(85, 277, 632);
    // without the test the door is Grum's
    const plain = player({ stage: 2 });
    assert.equal(await excalibur.onWallObjectCommandOne(plain, door), false);
    assert.equal(await grum.onWallObjectCommandOne(plain, door), true);
    assert.deepEqual(plain.doors, [[85, 11]]);
    const tested = player({ stage: 3, cache: { ladyTest: true } });
    assert.equal(await grum.onWallObjectCommandOne(tested, door), false);

    const p = player({ stage: 3, cache: { ladyTest: true }, items: [138], answers: [0] });
    assert.equal(await excalibur.onWallObjectCommandOne(p, door), true);
    assert.deepEqual(p.world.spawned.map((s) => s.id), [BEGGAR]);
    assert.ok(p.inventory.has(606));
    assert.ok(!p.inventory.has(138));
    assert.equal(p.cache.ladyTest, undefined);
    assert.deepEqual(p.world.replaced, [[BEGGAR, 284]]);
    assert.deepEqual(p.doors, []);

    // upstairs is the wrong place
    const up = player({ stage: 3, cache: { ladyTest: true }, x: 280, y: 634 });
    await excalibur.onGameObjectCommandOne(up, gameObject(295, 280, 634));
    assert.deepEqual(up.teleports, [[280, 1578]]);
    assert.ok(up.said.includes('Hello I am here, can I have Excalibur yet?'));
});

test('stage 4 -> 5 -> done: Excalibur shatters the crystal, King Arthur knights you', async () => {
    const world = fakeWorld({ npcs: [fakeNpc(MERLIN, { x: 462, y: 2336 })] });
    const crystal = gameObject(287, 461, 2335);

    const early = player({ stage: 3 });
    await camelot.onUseWithGameObject(early, crystal, { id: 606 });
    assert.deepEqual(early.messages, ['Nothing interesting happens']);
    assert.equal(await camelot.onUseWithGameObject(early, crystal, { id: 10 }), false);

    const p = player({ stage: 4, world, x: 461, y: 2337 });
    await camelot.onUseWithGameObject(p, crystal, { id: 606 });
    assert.equal(p.questStages.merlinsCrystal, 5);
    assert.deepEqual(world.removed, [crystal]);
    assert.equal(world.timeouts.length, 1);
    assert.ok(world.npcList[0].said.includes('Thankyou thankyou'));

    p.cache.magicWords = true;
    await camelot.onTalkToNPC(p, fakeNpc(KING_ARTHUR));
    assert.deepEqual(p.completed, [
        ['merlinsCrystal', { questPoints: 6, message: "Well done you have completed the Merlin's crystal quest" }]
    ]);
    assert.equal(p.cache.magicWords, undefined);

    // then The Holy Grail starts here
    const h = player({ stage: -1, answers: [0, 0] });
    await camelot.onTalkToNPC(h, fakeNpc(KING_ARTHUR));
    assert.equal(h.questStages.theHolyGrail, 1);
});
