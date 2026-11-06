// Biohazard (quests/members/biohazard.js, port of BioHazard.java with the doors of DoorAction.java, the mourners of
// Mourner.java and the messenger pigeons of InvAction.java): every stage driven with fake objects, from Elena's request to
// King Lathas's amulet. The east Varrock gate's search is game-objects/members-gates.js (its own test).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const bio = require('../src/plugins/quests/members/biohazard');
const { fakeNpc, fakeWorld, fakePlayer, gameObject, wallObject } = require('./quest-fakes-3b');

const ELENA = 483;
const OMART = 484;
const JERICO = 486;
const KILRON = 487;
const GUIDORS_WIFE = 488;
const MOURNER_ENTRANCE2 = 491;
const MOURNER_DOOR = 492;
const MOURNER_ILL = 495;
const NURSE_SARAH = 500;
const MOURNER_ATTACK = 502;
const CHEMIST = 504;
const CHANCY = 505;
const HOPS = 506;
const DEVINCI = 507;
const GUIDOR = 508;
const CHANCY_BAR = 509;
const HOPS_BAR = 510;
const DEVINCI_BAR = 511;
const LATHAS = 512;

const PIGEON_CAGE = 798;
const PIGEONS = 799;
const BIRD_FEED = 800;
const ROTTEN_APPLES = 801;
const DOCTORS_GOWN = 802;
const BRONZE_KEY = 803;
const DISTILLATOR = 804;
const PRIEST_ROBE = 807;
const PRIEST_GOWN = 808;
const HONEY = 809;
const ETHENEA = 810;
const BROLINE = 811;
const SAMPLE = 812;
const TOUCH_PAPER = 813;
const AMULET = 826;

const PLUGIN_TYPES = [
    .../const PLUGIN_TYPES = \[([\s\S]*?)\]/
        .exec(fs.readFileSync(require.resolve('../src/model/world.js'), 'utf8'))[1]
        .matchAll(/'(\w+)'/g)
].map((m) => m[1]);

function player(opts = {}) {
    return fakePlayer({ quest: 'biohazard', ...opts });
}

async function talk(p, id) {
    const npc = fakeNpc(id);
    assert.equal(await bio.onTalkToNPC(p, npc), true);
    assert.equal(p.interlocutor, null);
    return npc;
}

test('every exported hook is a plugin type', () => {
    for (const name of Object.keys(bio)) {
        assert.ok(PLUGIN_TYPES.includes(name), name);
    }
});

test('stage 0: Elena asks for her distillator; "i\'ll try to retrieve it for you" starts the quest (1)', async () => {
    const no = player({ answers: [1] });
    const e = await talk(no, ELENA);
    assert.equal(no.questStages.biohazard, 0);
    assert.ok(e.said.includes('thanks traveller'));

    const p = player({ answers: [0] });
    const n = await talk(p, ELENA);
    assert.equal(p.questStages.biohazard, 1);
    assert.ok(n.said.includes('he lives next to the chapel'));
});

test('stages 1-4: Elena\'s reminders', async () => {
    for (const [stage, line] of [
        [1, 'speak to jerico, he will help you to cross the wall'],
        [2, 'hmmm, could be tricky'],
        [3, 'before the pigeons fly off'],
        [4, 'please don\'t give up until you find it'],
        [9, 'you must go to king lathas immediately']
    ]) {
        const p = player({ stage });
        const n = await talk(p, ELENA);
        assert.ok(n.said.includes(line), `${stage}`);
        assert.equal(p.questStages.biohazard, stage);
    }
});

test('stage 5: Elena takes the distillator and hands over the vials and the sample (6)', async () => {
    const none = player({ stage: 5 });
    const n = await talk(none, ELENA);
    assert.ok(n.said.includes('People may be dying even as we speak'));
    assert.equal(none.questStages.biohazard, 5);

    const p = player({ stage: 5, items: [DISTILLATOR] });
    const e = await talk(p, ELENA);
    assert.equal(p.questStages.biohazard, 6);
    assert.equal(p.inventory.has(DISTILLATOR), false);
    for (const id of [HONEY, ETHENEA, BROLINE, SAMPLE]) {
        assert.equal(p.inventory.count(id), 1, `${id}`);
    }
    assert.ok(e.said.includes('Go and see the chemist in Rimmington') || e.said.some((l) => /chemist in Rimmington/.test(l)));
});

test('stages 6-7: Elena replaces lost vials without duplicating the ones held', async () => {
    const p = player({ stage: 6, items: [HONEY], answers: [1] });
    await talk(p, ELENA);
    for (const id of [HONEY, ETHENEA, BROLINE, SAMPLE]) {
        assert.equal(p.inventory.count(id), 1, `${id}`);
    }
    assert.equal(p.messages.at(-1), '@que@Elena replaces your items');

    const bye = player({ stage: 7, answers: [0] });
    const e = await talk(bye, ELENA);
    assert.ok(e.said.includes('Now get to work!'));

    const forgot = player({ stage: 6, answers: [2] });
    const f = await talk(forgot, ELENA);
    assert.ok(f.said.includes('then go to varrock and take the sample to guidor, my old mentor'));
});

test('stage 8 -> 9: Elena sends you to the King; done: Elena chats', async () => {
    const p = player({ stage: 8 });
    await talk(p, ELENA);
    assert.equal(p.questStages.biohazard, 9);

    const done = player({ stage: -1 });
    const e = await talk(done, ELENA);
    assert.ok(e.said.includes('not bad, let me know when you hear from king lathas again'));
});

test('Elena\'s door (152) opens only once Plague City is done', async () => {
    const door = wallObject(152, 608, 573, 1);
    const shut = player();
    assert.equal(await bio.onWallObjectCommandOne(shut, door), true);
    assert.deepEqual(shut.doors, []);
    assert.equal(shut.messages.at(-1), 'the door is locked');

    const open = player({ quest: 'plagueCity', stage: -1 });
    open.questStages.biohazard = 0;
    await bio.onWallObjectCommandOne(open, door);
    assert.equal(open.doors.length, 1);
    assert.equal(open.messages[0], 'You go through the door');
});

test('stages 1-2: Jerico points to Omart (2), then Omart explains the watch tower', async () => {
    const p = player({ stage: 1 });
    const j = await talk(p, JERICO);
    assert.equal(p.questStages.biohazard, 2);
    assert.ok(j.said.includes('omart is waiting for you at the southend of the wall'));

    const again = player({ stage: 2 });
    const j2 = await talk(again, JERICO);
    assert.ok(j2.said.includes('sorry, try asking omart'));

    const o = await talk(again, OMART);
    assert.ok(o.said.includes("try asking jerico, if he's not too busy with his pigeons"));

    const early = player({ stage: 0 });
    const o2 = await talk(early, OMART);
    assert.ok(o2.said.includes('fine thanks'));
    const j3 = await talk(early, JERICO);
    assert.ok(j3.said.includes('can i help you?'));
});

test('stage 2: Jerico\'s cupboard holds bird feed, thrown on the watch tower (cache bird_feed)', async () => {
    const closed = gameObject(499, 581, 587);
    const open = gameObject(500, 581, 587);

    const p = player({ stage: 2 });
    assert.equal(await bio.onGameObjectCommandOne(p, closed), true);
    assert.deepEqual(p.world.replaced, [[499, 500]]);
    assert.equal(p.messages.at(-1), 'You open the cupboard');

    await bio.onGameObjectCommandOne(p, open);
    assert.equal(p.inventory.count(BIRD_FEED), 1);
    assert.deepEqual(p.messages.slice(-2), ['you search the cupboard', 'and find some pigeon feed']);
    await bio.onGameObjectCommandOne(p, open);
    assert.equal(p.inventory.count(BIRD_FEED), 1);
    assert.equal(p.messages.at(-1), 'but find nothing of interest');

    assert.equal(await bio.onGameObjectCommandTwo(p, open), true);
    assert.deepEqual(p.world.replaced.at(-1), [500, 499]);
    assert.equal(p.messages.at(-1), 'You close the cupboard');

    const tower = gameObject(494, 622, 585);
    assert.equal(await bio.onUseWithGameObject(p, tower, { id: BIRD_FEED }), true);
    assert.equal(p.inventory.has(BIRD_FEED), false);
    assert.equal(p.cache.bird_feed, true);
    assert.ok(p.messages.includes('@que@the mourners do not seem to notice'));

    const wrongStage = player({ stage: 1, items: [BIRD_FEED] });
    await bio.onUseWithGameObject(wrongStage, tower, { id: BIRD_FEED });
    assert.equal(wrongStage.messages.at(-1), 'nothing interesting happens');
    assert.equal(wrongStage.inventory.count(BIRD_FEED), 1);
    assert.equal(await bio.onUseWithGameObject(p, tower, { id: 1 }), false);
});

test('approaching the watch tower: the mourner warns you off', async () => {
    const world = fakeWorld();
    const mourner = fakeNpc(MOURNER_ENTRANCE2);
    world.npcList.push(mourner);
    const p = player({ world, stage: 2 });
    assert.equal(await bio.onGameObjectCommandOne(p, gameObject(494, 622, 585)), true);
    assert.ok(mourner.said.includes('keep away civilian'));
    assert.ok(p.said.includes("what's it to you?"));
});

test('stage 2 -> 3: the messenger pigeons, released near the tower, fly at the feed', async () => {
    const far = player({ stage: 2, items: [PIGEONS], cache: { bird_feed: true }, x: 580, y: 586 });
    assert.equal(await bio.onInventoryCommand(far, { id: PIGEONS }), true);
    assert.equal(far.messages.at(-1), "the pigeons don't want to leave");
    assert.equal(far.questStages.biohazard, 2);

    const noFeed = player({ stage: 2, items: [PIGEONS], x: 620, y: 586 });
    await bio.onInventoryCommand(noFeed, { id: PIGEONS });
    assert.equal(noFeed.messages.at(-1), "the pigeons don't want to leave");

    const p = player({ stage: 2, items: [PIGEONS], cache: { bird_feed: true }, x: 620, y: 586 });
    await bio.onInventoryCommand(p, { id: PIGEONS });
    assert.equal(p.questStages.biohazard, 3);
    assert.equal(p.cache.bird_feed, undefined);
    assert.equal(p.inventory.has(PIGEONS), false);
    assert.equal(p.inventory.count(PIGEON_CAGE), 1);
    assert.ok(p.messages.includes('@que@the mourners are frantically trying to scare the pigeons away'));

    // at stage 3 the feed flag is not needed, and the stage stays
    const three = player({ stage: 3, items: [PIGEONS], x: 618, y: 583 });
    await bio.onInventoryCommand(three, { id: PIGEONS });
    assert.equal(three.questStages.biohazard, 3);
    assert.equal(three.inventory.count(PIGEON_CAGE), 1);

    assert.equal(await bio.onInventoryCommand(p, { id: 1 }), false);
});

test('stage 3: Omart throws the rope ladder over the wall (4); Kilron takes you back', async () => {
    const stay = player({ stage: 3, answers: [1] });
    const n = await talk(stay, OMART);
    assert.deepEqual(stay.teleports, []);
    assert.ok(n.said.includes("don't take long"));

    const p = player({ stage: 3, answers: [0] });
    await talk(p, OMART);
    assert.equal(p.questStages.biohazard, 4);
    assert.deepEqual(p.teleports, [[624, 606]]);
    assert.equal(p.world.objectList.length, 0); // the visual rope ladder (498) is taken down again
    assert.deepEqual(p.messages.slice(-2), ['@que@you climb up the rope ladder', '@que@and drop down on the other side']);

    // stage 4 or 5 again: the menu text is said by the plugin
    const again = player({ stage: 5, answers: [0] });
    await talk(again, OMART);
    assert.deepEqual(again.teleports, [[624, 606]]);
    assert.equal(again.questStages.biohazard, 5);
    const later = player({ stage: 4, answers: [1] });
    const o = await talk(later, OMART);
    assert.ok(o.said.includes('the mourners will soon be rid of those birds'));

    // Kilron, back over
    const k = player({ stage: 4, answers: [1] });
    await talk(k, KILRON);
    assert.deepEqual(k.teleports, [[622, 611]]);
    const wait = player({ stage: 6, answers: [0] });
    const kn = await talk(wait, KILRON);
    assert.ok(kn.said.includes('okay, just give me the word'));
    const busy = player({ stage: 2 });
    const kb = await talk(busy, KILRON);
    assert.ok(kb.said.includes('busy'));

    // the ladder is not used again
    for (const stage of [6, 9, -1]) {
        const d = player({ stage });
        const o2 = await talk(d, OMART);
        assert.ok(o2.said.includes("but I believe that edmond's working on another tunnel"));
    }

    for (const stage of [5, 7, -1]) {
        const j = player({ stage });
        await talk(j, JERICO);
        assert.equal(j.messages.at(-1), 'jerico is busy looking for his bird feed');
    }
    const jf = player({ stage: 3 });
    assert.ok((await talk(jf, JERICO)).said.includes('quickly traveller'));
    const j4 = player({ stage: 4 });
    assert.ok((await talk(j4, JERICO)).said.includes('In case you need to cross again'));
});

test('West Ardougne: Nurse Sarah, her cupboard and the doctor\'s gown (stage 4-5 only)', async () => {
    const n = player({ stage: 4 });
    const sarah = await talk(n, NURSE_SARAH);
    assert.ok(sarah.said.includes("me too, but it doesn't seem to be the case"));

    const fed = player({ stage: 4, cache: { rotten_apples: true } });
    const s2 = await talk(fed, NURSE_SARAH);
    assert.ok(s2.said.includes('i need to go over and see what i can do'));

    const none = player({ stage: 6 });
    await talk(none, NURSE_SARAH);
    assert.equal(none.messages.at(-1), "nurse sarah doesn't feel like talking");

    const open = gameObject(510, 648, 602);
    const closed = gameObject(509, 648, 602);
    const p = player({ stage: 4 });
    await bio.onGameObjectCommandOne(p, closed);
    assert.deepEqual(p.world.replaced, [[509, 510]]);
    await bio.onGameObjectCommandOne(p, open);
    assert.equal(p.inventory.count(DOCTORS_GOWN), 1);
    assert.ok(p.messages.includes("inside you find a doctor's gown"));
    await bio.onGameObjectCommandOne(p, open);
    assert.equal(p.inventory.count(DOCTORS_GOWN), 1);
    assert.equal(p.messages.at(-1), 'but find nothing of interest');

    const late = player({ stage: -1 });
    await bio.onGameObjectCommandOne(late, open);
    assert.equal(late.inventory.has(DOCTORS_GOWN), false);
    assert.equal(await bio.onGameObjectCommandTwo(late, open), true);
    assert.deepEqual(late.world.replaced, [[510, 509]]);
});

test('stage 4: rotten apples in the pot, the mourners\' door and the door mourner', async () => {
    const pot = gameObject(502, 635, 564);
    const p = player({ stage: 4, items: [[ROTTEN_APPLES, 2]] });
    assert.equal(await bio.onUseWithGameObject(p, pot, { id: ROTTEN_APPLES }), true);
    assert.equal(p.cache.rotten_apples, true);
    assert.equal(p.inventory.count(ROTTEN_APPLES), 1);
    assert.ok(p.messages.includes('@que@they quickly dissolve into the stew'));

    // wrong stage: the apples are wasted without the flag
    const wasted = player({ stage: 6, items: [ROTTEN_APPLES] });
    await bio.onUseWithGameObject(wasted, pot, { id: ROTTEN_APPLES });
    assert.equal(wasted.cache.rotten_apples, undefined);
    assert.equal(wasted.inventory.has(ROTTEN_APPLES), false);
    assert.equal(wasted.messages.at(-1), "@que@that wasn't very nice");

    const door = wallObject(138, 633, 573, 0);

    // stage 4 without the apples: locked
    const locked = player({ stage: 4, x: 633, y: 574 });
    await bio.onWallObjectCommandOne(locked, door);
    assert.deepEqual(locked.doors, []);
    assert.ok(locked.messages.includes('@que@you need to distract them from their stew'));

    // with the apples: a gown gets you in
    const world = fakeWorld();
    const mourner = fakeNpc(MOURNER_DOOR);
    world.npcList.push(mourner);
    const bare = player({ world, stage: 4, x: 633, y: 574, cache: { rotten_apples: true } });
    await bio.onWallObjectCommandOne(bare, door);
    assert.deepEqual(bare.doors, []);
    assert.ok(mourner.said.includes('keep away from there'));
    assert.ok(mourner.said.includes("we're waiting for a doctor"));

    const doc = player({ world, stage: 4, x: 633, y: 574, cache: { rotten_apples: true }, items: [DOCTORS_GOWN], equipped: [DOCTORS_GOWN] });
    await bio.onWallObjectCommandOne(doc, door);
    assert.equal(doc.doors.length, 1);
    assert.ok(mourner.said.includes('in you go doc'));

    // from inside (y <= 572) the door just opens
    const inside = player({ world, stage: 5, x: 633, y: 572 });
    await bio.onWallObjectCommandOne(inside, door);
    assert.equal(inside.doors.length, 1);

    // later stages need the gown; without it the door is locked
    const later = player({ stage: 6, items: [DOCTORS_GOWN], equipped: [DOCTORS_GOWN] });
    await bio.onWallObjectCommandOne(later, door);
    assert.equal(later.doors.length, 1);
    const noGown = player({ stage: 6 });
    await bio.onWallObjectCommandOne(noGown, door);
    assert.equal(noGown.messages.at(-1), 'the door is locked');

    // the door mourner's talk
    const fed = player({ cache: { rotten_apples: true } });
    assert.ok((await talk(fed, MOURNER_DOOR)).said.includes('go now and bring us a doctor, that\'s an order'));
    const gown = player({ cache: { rotten_apples: true }, items: [DOCTORS_GOWN], equipped: [DOCTORS_GOWN] });
    assert.ok((await talk(gown, MOURNER_DOOR)).said.includes('you should see to him first'));
    for (const [answer, line] of [[0, "because i don't like your face"], [1, 'that sounds like a lot of hard work'], [2, '..there are some rotten apples around the corner - help yourself!']]) {
        const q = player({ stage: 4, answers: [answer] });
        assert.ok((await talk(q, MOURNER_DOOR)).said.includes(line));
    }
    const zero = player({ stage: 0 });
    await talk(zero, MOURNER_DOOR);
    assert.equal(zero.messages.at(-1), "the mourner doesn't feel like talking");
});

test('stage 4: the attack mourner and the ill mourner upstairs (the bronze key)', async () => {
    const bare = player({ stage: 4 });
    const m = await talk(bare, MOURNER_ATTACK);
    assert.ok(m.said.includes('this is a restricted area'));
    assert.equal(m.attacked.length, 1);

    const doc = player({ stage: 4, items: [DOCTORS_GOWN], equipped: [DOCTORS_GOWN] });
    const m2 = await talk(doc, MOURNER_ATTACK);
    assert.ok(m2.said.includes('hello doc, i feel terrible'));
    assert.equal(m2.attacked.length, 0);

    for (const answer of [0, 1, 2]) {
        const p = player({ stage: 4, answers: [answer] });
        const ill = await talk(p, MOURNER_ILL);
        assert.ok(ill.said.includes("you're no doctor"));
        assert.equal(ill.attacked.length, 1);
    }

    const past = player({ stage: 5 });
    await talk(past, MOURNER_ILL);
    assert.deepEqual(past.messages, ['@que@the mourner is sick', "@que@he doesn't feel like talking"]);

    // killed: he is searched for the key and removed
    const world = fakeWorld();
    const ill = fakeNpc(MOURNER_ILL);
    ill.abandonFight = () => {};
    world.npcList.push(ill);
    const killer = player({ world, stage: 4 });
    assert.equal(await bio.onNPCDeath(killer, ill), true);
    assert.equal(killer.inventory.count(BRONZE_KEY), 1);
    assert.deepEqual(world.removed, [ill]);
    assert.ok(killer.messages.includes('@que@and find a key'));

    // no second key
    const world2 = fakeWorld();
    const again = player({ world: world2, stage: 4, items: [BRONZE_KEY] });
    assert.equal(await bio.onNPCDeath(again, ill), true);
    assert.equal(again.inventory.count(BRONZE_KEY), 1);

    assert.equal(await bio.onNPCDeath(killer, fakeNpc(5)), false);
    assert.equal(await bio.onNPCDeath(null, ill), false);
});

test('stage 4 -> 5: the sick mourner door, the crates\' gate and the distillator crate', async () => {
    const sick = wallObject(141, 633, 1513, 0);
    const outside = player({ stage: 4, y: 1512 });
    await bio.onWallObjectCommandOne(outside, sick);
    assert.deepEqual(outside.doors, []);
    assert.equal(outside.messages.at(-1), 'the mourner is refusing to open the door');
    const gown = player({ stage: 4, y: 1512, items: [DOCTORS_GOWN], equipped: [DOCTORS_GOWN] });
    await bio.onWallObjectCommandOne(gown, sick);
    assert.equal(gown.doors.length, 1);
    const inside = player({ stage: 4, y: 1513 });
    await bio.onWallObjectCommandOne(inside, sick);
    assert.equal(inside.doors.length, 1);

    const gate = gameObject(504, 631, 1514);
    const noKey = player({ x: 632, y: 1514 });
    await bio.onGameObjectCommandOne(noKey, gate);
    assert.deepEqual(noKey.gates, []);
    assert.equal(noKey.messages.at(-1), 'you need a key');
    const west = player({ x: 630, y: 1514 });
    await bio.onGameObjectCommandOne(west, gate);
    assert.equal(west.gates.length, 1);
    const keyed = player({ x: 632, y: 1514, items: [BRONZE_KEY] });
    assert.equal(await bio.onUseWithGameObject(keyed, gate, { id: BRONZE_KEY }), true);
    assert.equal(keyed.gates.length, 1);
    assert.equal(keyed.inventory.count(BRONZE_KEY), 1); // the key is kept

    const crate = gameObject(505, 627, 1514);
    const p = player({ stage: 4, cache: { rotten_apples: true } });
    assert.equal(await bio.onGameObjectCommandTwo(p, crate), true);
    assert.equal(p.inventory.count(DISTILLATOR), 1);
    assert.equal(p.questStages.biohazard, 5);
    assert.equal(p.cache.rotten_apples, undefined);
    await bio.onGameObjectCommandTwo(p, crate);
    assert.equal(p.inventory.count(DISTILLATOR), 1);
    assert.equal(p.messages.at(-1), "@que@it's empty");

    // without the apples: the distillator, but the stage stays
    const unfed = player({ stage: 4 });
    await bio.onGameObjectCommandOne(unfed, crate);
    assert.equal(unfed.inventory.count(DISTILLATOR), 1);
    assert.equal(unfed.questStages.biohazard, 4);
});

test('stage 6: the chemist hands over touch paper only to Elena\'s friend (7)', async () => {
    const all = [SAMPLE, HONEY, BROLINE, ETHENEA];

    const light = player({ stage: 6, items: [SAMPLE] });
    await talk(light, CHEMIST);
    assert.equal(light.messages.at(-1), 'The chemist is busy at the moment');

    // "This can't wait" - he takes the sample
    const blunt = player({ stage: 6, items: all, answers: [0] });
    await talk(blunt, CHEMIST);
    assert.equal(blunt.inventory.has(SAMPLE), false);
    assert.equal(blunt.questStages.biohazard, 6);
    assert.equal(blunt.messages.at(-1), 'He takes the plague sample from you');

    // "I'm Elena's friend", then the touch paper for the plague sample - also takes it
    const friend = player({ stage: 6, items: all, answers: [1, 0] });
    await talk(friend, CHEMIST);
    assert.equal(friend.inventory.has(SAMPLE), false);

    const p = player({ stage: 6, items: all, answers: [1, 1] });
    const c = await talk(p, CHEMIST);
    assert.equal(p.questStages.biohazard, 7);
    assert.equal(p.inventory.count(TOUCH_PAPER), 1);
    assert.equal(p.inventory.count(SAMPLE), 1);
    assert.ok(c.said.includes("You'd better hurry if you want to see Guidor"));

    // stage 7: more touch paper only if none is carried
    const refill = player({ stage: 7 });
    await talk(refill, CHEMIST);
    assert.equal(refill.inventory.count(TOUCH_PAPER), 1);
    const have = player({ stage: 7, items: [TOUCH_PAPER] });
    await talk(have, CHEMIST);
    assert.equal(have.inventory.count(TOUCH_PAPER), 1);
    assert.ok(have.said.includes('hi'));
});

test('stage 7: each errand boy carries one vial; the right one comes back from the inn', async () => {
    const vials = [ETHENEA, HONEY, BROLINE];

    // Hops: the broline is his to carry (menu 2), the others are drunk
    const hops = player({ stage: 7, items: vials, answers: [2] });
    await talk(hops, HOPS);
    assert.equal(hops.cache.vial_hops, true);
    assert.equal(hops.inventory.has(BROLINE), false);
    assert.equal(hops.inventory.count(ETHENEA), 1);
    const hopsAgain = player({ stage: 7, cache: { vial_hops: true } });
    assert.ok((await talk(hopsAgain, HOPS)).said.includes("I'll meet you at the The dancing donkey inn"));

    const hopsWrong = player({ stage: 7, items: vials, answers: [0] });
    await talk(hopsWrong, HOPS);
    assert.equal(hopsWrong.cache.wrong_vial_hops, true);

    const noVial = player({ stage: 7, answers: [1] });
    await talk(noVial, HOPS);
    assert.equal(noVial.messages.at(-1), 'You have no liquid honey to give');
    assert.equal(noVial.cache.wrong_vial_hops, undefined);

    // Chancy: the honey is his
    const chancy = player({ stage: 7, items: vials, answers: [1] });
    await talk(chancy, CHANCY);
    assert.equal(chancy.cache.vial_chancy, true);
    assert.equal(chancy.inventory.has(HONEY), false);
    const chancyWrong = player({ stage: 7, items: vials, answers: [2] });
    await talk(chancyWrong, CHANCY);
    assert.equal(chancyWrong.cache.wrong_vial_chancy, true);
    const chancyNone = player({ stage: 7, answers: [0] });
    await talk(chancyNone, CHANCY);
    assert.equal(chancyNone.messages.at(-1), "You can't give him what you don't have");
    const chancyAgain = player({ stage: 7, cache: { wrong_vial_chancy: true } });
    assert.ok((await talk(chancyAgain, CHANCY)).said.includes('I always like to play the percentages'));

    // DeVinci: the ethenea is his
    const vinci = player({ stage: 7, items: vials, answers: [0] });
    await talk(vinci, DEVINCI);
    assert.equal(vinci.cache.vial_vinci, true);
    const vinciWrong = player({ stage: 7, items: vials, answers: [1] });
    await talk(vinciWrong, DEVINCI);
    assert.equal(vinciWrong.cache.wrong_vial_vinci, true);
    const vinciAgain = player({ stage: 7, cache: { vial_vinci: true } });
    assert.ok((await talk(vinciAgain, DEVINCI)).said.includes("Please don't distract me now, I'm contemplating the sublime"));

    // anything but stage 7: they will not talk
    for (const [id, line] of [
        [HOPS, 'He is not in a fit state to talk'],
        [CHANCY, "Chancy doesn't feel like talking"],
        [DEVINCI, 'Devinci does not feel sufficiently moved to talk'],
        [HOPS_BAR, "Hops doesn't feel like talking"],
        [DEVINCI_BAR, "devinci doesn't feel like talking"],
        [CHANCY_BAR, "chancy doesn't feel like talking"]
    ]) {
        const p = player({ stage: 6 });
        await talk(p, id);
        assert.equal(p.messages.at(-1), line);
    }
});

test('stage 7: at the Dancing Donkey the right vials come back and the wrong ones are lost', async () => {
    const right = [
        [HOPS_BAR, 'vial_hops', BROLINE],
        [CHANCY_BAR, 'vial_chancy', HONEY],
        [DEVINCI_BAR, 'vial_vinci', ETHENEA]
    ];

    for (const [id, flag, vial] of right) {
        const p = player({ stage: 7, cache: { [flag]: true } });
        await talk(p, id);
        assert.equal(p.inventory.count(vial), 1, `${id}`);
        assert.equal(p.cache[flag], undefined);
    }

    for (const [id, flag, answers] of [
        [HOPS_BAR, 'wrong_vial_hops', []],
        [CHANCY_BAR, 'wrong_vial_chancy', [0]],
        [CHANCY_BAR, 'wrong_vial_chancy', [1]],
        [DEVINCI_BAR, 'wrong_vial_vinci', [0]],
        [DEVINCI_BAR, 'wrong_vial_vinci', [1]]
    ]) {
        const p = player({ stage: 7, cache: { [flag]: true }, answers });
        await talk(p, id);
        for (const vial of [BROLINE, HONEY, ETHENEA]) {
            assert.equal(p.inventory.has(vial), false, `${id} ${vial}`);
        }
        assert.equal(p.cache[flag], undefined);
    }
});

test('stage 7: Guidor\'s wife wants a priest; the priest robe and gown open Guidor\'s door', async () => {
    const plain = player({ stage: 7 });
    const w = await talk(plain, GUIDORS_WIFE);
    assert.ok(w.said.includes('if only i could get him to see a priest'));

    const priest = player({ stage: 7, items: [PRIEST_ROBE, PRIEST_GOWN], equipped: [PRIEST_ROBE, PRIEST_GOWN] });
    const w2 = await talk(priest, GUIDORS_WIFE);
    assert.ok(w2.said.includes('Perhaps you could go and perform his final ceremony'));

    for (const stage of [8, 9, -1]) {
        const p = player({ stage });
        assert.ok((await talk(p, GUIDORS_WIFE)).said.length > 0);
    }

    const silent = player({ stage: 3 });
    assert.deepEqual((await talk(silent, GUIDORS_WIFE)).said, []);

    const door = wallObject(145, 83, 534, 1);
    const locked = player({ stage: 6, x: 84, y: 534 });
    await bio.onWallObjectCommandOne(locked, door);
    assert.equal(locked.messages.at(-1), 'the door is locked');
    const refused = player({ stage: 7, x: 84, y: 534 });
    await bio.onWallObjectCommandOne(refused, door);
    assert.equal(refused.messages.at(-1), 'guildors wife refuses to let you enter');
    assert.deepEqual(refused.doors, []);
    const robed = player({ stage: 7, x: 84, y: 534, items: [PRIEST_ROBE, PRIEST_GOWN], equipped: [PRIEST_ROBE, PRIEST_GOWN] });
    await bio.onWallObjectCommandOne(robed, door);
    assert.equal(robed.doors.length, 1);
    assert.ok(robed.messages.includes('guidors wife allows you to go in'));
    const halfRobed = player({ stage: 7, x: 84, y: 534, items: [PRIEST_ROBE], equipped: [PRIEST_ROBE] });
    await bio.onWallObjectCommandOne(halfRobed, door);
    assert.deepEqual(halfRobed.doors, []);
    const out = player({ stage: 7, x: 82, y: 534 });
    await bio.onWallObjectCommandOne(out, door);
    assert.equal(out.doors.length, 1);
});

test('stage 7 -> 8: Guidor tests the sample - and refuses without all of it', async () => {
    const all = [SAMPLE, HONEY, BROLINE, ETHENEA, TOUCH_PAPER];

    const leave = player({ stage: 7, answers: [1] });
    await talk(leave, GUIDOR);
    assert.equal(leave.questStages.biohazard, 7);

    const noSample = player({ stage: 7, answers: [0, 0] });
    const g = await talk(noSample, GUIDOR);
    assert.ok(g.said.includes("Seems like you don't actually HAVE the plague sample"));
    assert.equal(noSample.questStages.biohazard, 7);

    const noVials = player({ stage: 7, items: [SAMPLE, TOUCH_PAPER], answers: [0, 1] });
    const g2 = await talk(noVials, GUIDOR);
    assert.ok(g2.said.includes("Come back when you've got them"));

    const noPaper = player({ stage: 7, items: [SAMPLE, HONEY, BROLINE, ETHENEA], answers: [0, 1] });
    const g3 = await talk(noPaper, GUIDOR);
    assert.ok(g3.said.includes("And so I won't be able to help you after all"));
    assert.equal(noPaper.questStages.biohazard, 7);

    for (const last of [0, 1]) {
        const p = player({ stage: 7, items: all, answers: [0, last, last] });
        const n = await talk(p, GUIDOR);
        assert.equal(p.questStages.biohazard, 8);
        for (const id of all) {
            assert.equal(p.inventory.has(id), false, `${id}`);
        }
        assert.ok(n.said.includes('Don\'t you understand, there is no plague!'));
    }

    const done = player({ stage: 8 });
    assert.ok((await talk(done, GUIDOR)).said.includes("i'm hanging in there"));
});

test('stage 9: King Lathas confesses and gives the amulet; the reward (-1)', async () => {
    const busy = player({ stage: 3 });
    await talk(busy, LATHAS);
    assert.equal(busy.messages.at(-1), 'the king is too busy to talk');

    const leave = player({ stage: 9, answers: [1] });
    await talk(leave, LATHAS);
    assert.equal(leave.questStages.biohazard, 9);
    assert.equal(leave.inventory.has(AMULET), false);

    const p = player({ stage: 9, answers: [0], levels: { thieving: 45 } });
    const king = await talk(p, LATHAS);
    assert.equal(p.questStages.biohazard, -1);
    assert.equal(p.inventory.count(AMULET), 1);
    assert.deepEqual(p.completed, [
        [
            'biohazard',
            {
                questPoints: 3,
                experience: { thieving: 2000 + 200 * 45 },
                message: 'you have completed the biohazard quest'
            }
        ]
    ]);
    assert.ok(king.said.includes('He was my brother'));
});

test('after the quest King Lathas starts Underground Pass talk by its stage', async () => {
    const fresh = player({ stage: -1 });
    const n = await talk(fresh, LATHAS);
    assert.equal(fresh.questStages.undergroundPass, 1);
    assert.ok(n.said.includes('a crazy loon who claims to be the son of zamorok') || n.said.some((l) => /iban/.test(l)));

    for (const [stage, line] of [
        [1, 'a crazy loon who claims to be the son of zamorok'],
        [4, 'well keep up the good work'],
        [8, 'your loyalty is appreiciated traveller'],
        [-1, 'but i\'ll have word sent to you as soon as its ready']
    ]) {
        const p = player({ stage: -1 });
        p.questStages.undergroundPass = stage;
        const k = await talk(p, LATHAS);
        assert.ok(k.said.includes(line), `${stage}`);
    }
});

test('the Ardougne wall gateway and the training camp gate open after the quest', async () => {
    const world = fakeWorld();
    const mourner = fakeNpc(451);
    world.npcList.push(mourner);
    const gateway = gameObject(450, 622, 588);

    const shut = player({ world, stage: 9, x: 621, y: 589 });
    assert.equal(await bio.onGameObjectCommandOne(shut, gateway), true);
    assert.deepEqual(shut.teleports, []);
    assert.equal(shut.messages.at(-1), 'but it will not open');

    const east = player({ world, stage: -1, x: 621, y: 588 });
    await bio.onGameObjectCommandOne(east, gateway);
    assert.deepEqual(east.teleports, [[626, 588]]);
    assert.ok(mourner.said.includes('go through'));
    const west = player({ world, stage: -1, x: 625, y: 588 });
    await bio.onGameObjectCommandOne(west, gateway);
    assert.deepEqual(west.teleports, [[620, 589]]);

    const guard = fakeNpc(524);
    world.npcList.push(guard);
    const camp = gameObject(563, 660, 551);
    camp.direction = 2;
    const inside = player({ world, stage: -1, x: 660, y: 552 });
    await bio.onGameObjectCommandOne(inside, camp);
    assert.equal(inside.gates.length, 1);
    assert.ok(guard.said.includes('make good use of it, soon all you strength will be needed'));
    const away = player({ world, stage: 6, x: 660, y: 552 });
    await bio.onGameObjectCommandOne(away, camp);
    assert.deepEqual(away.gates, []);
    assert.ok(guard.said.includes('you can only enter under the authority of king lathas'));
});

test('without members the chemist, errand boys and Guidor\'s wife only say they are busy', async () => {
    for (const id of [CHEMIST, DEVINCI, DEVINCI_BAR, HOPS, HOPS_BAR, CHANCY, CHANCY_BAR, GUIDORS_WIFE]) {
        const p = player({ stage: 7, world: fakeWorld({ members: false }) });
        const n = await talk(p, id);
        assert.ok(n.said.length > 0, `${id}`);
        assert.equal(p.questStages.biohazard, 7);
    }

    const elena = player({ world: fakeWorld({ members: false }), answers: [0] });
    await talk(elena, ELENA);
    assert.equal(elena.questStages.biohazard, 0);
});

test('things that are not ours are left alone', async () => {
    const p = player();
    assert.equal(await bio.onTalkToNPC(p, fakeNpc(1)), false);
    assert.equal(await bio.onWallObjectCommandOne(p, wallObject(1, 1, 1)), false);
    assert.equal(await bio.onGameObjectCommandOne(p, gameObject(6, 494, 1562)), false);
    assert.equal(await bio.onGameObjectCommandTwo(p, gameObject(6, 494, 1562)), false);
    assert.equal(await bio.onUseWithGameObject(p, gameObject(6, 494, 1562), { id: BIRD_FEED }), false);
});
