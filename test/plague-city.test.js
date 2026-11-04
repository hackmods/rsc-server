// Plague City (quests/members/plague-city/*.js, port of PlagueCity.java with its DoorAction, Mourner, InvAction and
// InvUseOnItem parts): every stage driven with fakes, in quest order.

const test = require('node:test');
const assert = require('node:assert/strict');

const east = require('../src/plugins/quests/members/plague-city/east-ardougne');
const west = require('../src/plugins/quests/members/plague-city/west-ardougne');
const house = require('../src/plugins/quests/members/plague-city/plague-house');
const items = require('../src/plugins/quests/members/plague-city/items');
const { fakeNpc, fakeWorld, fakePlayer, gameObject, wallObject } = require('./quest-fakes-2a');

const EDMOND = 437;
const JETHICK = 443;
const MOURNER_EAST = 444;
const MOURNER_WEST = 445;
const TED = 446;
const MILLI = 449;
const ALRENA = 450;
const MOURNER_ENTRANCE = 451;
const CLERK = 452;
const BRAVEK = 454;
const ELENA = 465;
const HEAD_MOURNER = 469;

const BUCKET = 21;
const MILK = 22;
const BUCKET_OF_WATER = 50;
const SPADE = 211;
const ROPE = 237;
const SNAPE_GRASS = 469;
const MAGIC_SCROLL = 752;
const DWELLBERRIES = 765;
const GASMASK = 766;
const PICTURE = 767;
const BOOK = 768;
const CHOCOLATY_MILK = 770;
const HANGOVER_CURE = 771;
const CHOCOLATE_DUST = 772;
const WARRANT = 775;
const LITTLE_KEY = 780;
const SCRUFFY_NOTE = 781;

// the shared fakes plus what these plugins also call
function player(opts = {}) {
    const p = fakePlayer({ quest: 'plagueCity', ...opts });
    p.isMale = () => opts.male !== false;
    p.world.replaceTimed = (type, entity, id, ticks) => {
        p.world.replaced.push([entity.id, id, ticks]);
        return { ...entity, id };
    };
    return p;
}

test('stage 0: Edmond asks for help (stage 1) by either menu road', async () => {
    // "What's happened to her?" -> "Can i help find her?"
    const p = player({ answers: [0, 1] });
    assert.equal(await east.onTalkToNPC(p, fakeNpc(EDMOND)), true);
    assert.equal(p.questStages.plagueCity, 1);
    assert.ok(p.said.includes("ok I'll go get some"));

    // "What's happened to her?" -> "Tell me more about the plague" -> "Can I help find her?"
    const q = player({ answers: [0, 0, 0] });
    await east.onTalkToNPC(q, fakeNpc(EDMOND));
    assert.equal(q.questStages.plagueCity, 1);

    const r = player({ answers: [1] });
    await east.onTalkToNPC(r, fakeNpc(EDMOND));
    assert.equal(r.questStages.plagueCity, 0);
});

test('stage 1: Alrena turns the dwellberries into the gasmask (stage 2); the cupboard keeps a spare', async () => {
    const without = player({ stage: 1 });
    await east.onTalkToNPC(without, fakeNpc(ALRENA));
    assert.equal(without.questStages.plagueCity, 1);
    assert.ok(without.said.includes("I'll try to get some"));

    // nothing in the cupboard before stage 2
    const cupboard = gameObject(452, 614, 579);
    await east.onGameObjectCommandOne(without, cupboard);
    assert.ok(!without.inventory.has(GASMASK));

    const p = player({ stage: 1, items: [DWELLBERRIES] });
    await east.onTalkToNPC(p, fakeNpc(ALRENA));
    assert.equal(p.questStages.plagueCity, 2);
    assert.ok(p.inventory.has(GASMASK));
    assert.ok(!p.inventory.has(DWELLBERRIES));
    assert.ok(p.messages.includes('alrena gives you the mask'));

    // the spare: only when no mask is carried; also after the quest (Biohazard)
    await east.onGameObjectCommandOne(p, cupboard);
    assert.equal(p.messages.at(-1), "it's an old dusty cupboard");
    const done = player({ stage: -1 });
    await east.onGameObjectCommandOne(done, cupboard);
    assert.ok(done.inventory.has(GASMASK));
    assert.equal(done.messages.at(-1), 'you find a protective mask');

    // close and open swap the cupboard
    await east.onGameObjectCommandTwo(done, cupboard);
    await east.onGameObjectCommandOne(done, gameObject(451, 614, 579));
    assert.deepEqual(done.world.replaced, [
        [452, 451],
        [451, 452]
    ]);
});

test('stage 2: four buckets soften the soil, the spade drops you into the sewer (stage 3)', async () => {
    const soil = gameObject(447, 620, 581);
    const early = player({ stage: 1, items: [BUCKET_OF_WATER, SPADE] });
    await east.onUseWithGameObject(early, soil, { id: BUCKET_OF_WATER });
    assert.deepEqual(early.messages, ['You see no reason to do that at the moment']);
    await east.onUseWithGameObject(early, soil, { id: SPADE });
    assert.deepEqual(early.messages.slice(1), ['you dig the soil', 'The ground is rather hard']);
    assert.deepEqual(early.teleports, []);

    const p = player({ stage: 2, items: [BUCKET_OF_WATER, BUCKET_OF_WATER, BUCKET_OF_WATER, BUCKET_OF_WATER, SPADE] });

    for (let i = 0; i < 3; i += 1) {
        assert.equal(await east.onUseWithGameObject(p, soil, { id: BUCKET_OF_WATER }), true);
        assert.ok(!p.cache.soilSoften);
    }

    await east.onUseWithGameObject(p, soil, { id: BUCKET_OF_WATER });
    assert.equal(p.cache.soilSoften, true);
    assert.equal(p.inventory.count(BUCKET), 4);
    assert.equal(p.inventory.count(BUCKET_OF_WATER), 0);
    assert.ok(p.messages.includes('the soil is soft enough to dig into'));

    // Edmond and Alrena notice
    const edmond = player({ stage: 2, cache: { soilSoften: true } });
    await east.onTalkToNPC(edmond, fakeNpc(EDMOND));
    assert.ok(edmond.said.includes("I've soaked the soil with water"));

    await east.onUseWithGameObject(p, soil, { id: SPADE });
    assert.equal(p.questStages.plagueCity, 3);
    assert.deepEqual(p.teleports, [[621, 3414]]);
    assert.ok(p.messages.includes('Edmond follows you down the hole'));
    assert.ok(!p.cache.soilSoften);

    // and the mud pile climbs back to the garden
    await east.onGameObjectCommandOne(p, gameObject(448, 620, 3414));
    assert.deepEqual(p.teleports.at(-1), [620, 578]);
});

test('stages 3-4: the grill needs the rope and Edmond (stage 5); then the pipe needs the worn gasmask', async () => {
    const pipe = gameObject(449, 636, 3422);
    const p = player({ stage: 3, items: [ROPE, GASMASK] });

    await east.onGameObjectCommandOne(p, pipe);
    assert.deepEqual(p.messages, ['the grill is too secure', "you can't pull it off alone"]);

    await east.onUseWithGameObject(p, pipe, { id: ROPE });
    assert.equal(p.questStages.plagueCity, 4);
    await east.onUseWithGameObject(p, pipe, { id: ROPE });
    assert.equal(p.messages.at(-1), 'nothing interesting happens');

    await east.onTalkToNPC(p, fakeNpc(EDMOND));
    assert.equal(p.questStages.plagueCity, 5);
    assert.ok(p.messages.includes('you hear a clunk as you both fly backwards'));

    await east.onGameObjectCommandOne(p, pipe);
    assert.deepEqual(p.messages.slice(-2), ['You should wear your gasmask', 'Before entering west Ardougne']);
    assert.deepEqual(p.teleports, []);

    const masked = player({ stage: 5, items: [GASMASK], equipped: [GASMASK] });
    await east.onGameObjectCommandOne(masked, pipe);
    assert.deepEqual(masked.teleports, [[632, 589]]);

    // after Plague City and Biohazard the mask is not needed
    const free = player({ stage: -1 });
    free.questStages.biohazard = -1;
    await east.onGameObjectCommandOne(free, pipe);
    assert.deepEqual(free.teleports, [[632, 589]]);
});

test('stage 5: Jethick knows Elena from the picture and lends the book; the Rehnisons let you in for it (stage 6)', async () => {
    const blind = player({ stage: 5, answers: [0] });
    await west.onTalkToNPC(blind, fakeNpc(JETHICK));
    assert.ok(blind.said.includes('Um brown hair, in her twenties'));
    assert.ok(!blind.inventory.has(BOOK));

    const ted = fakeNpc(TED);
    const p = player({ stage: 5, items: [PICTURE], answers: [0], world: fakeWorld({ npcs: [ted] }), y: 569 });
    await west.onTalkToNPC(p, fakeNpc(JETHICK));
    assert.ok(p.inventory.has(BOOK));
    assert.ok(p.messages.includes('Jethick gives you a book'));

    const door = wallObject(122, 645, 569);
    assert.equal(await west.onWallObjectCommandOne(p, door), true);
    assert.equal(p.questStages.plagueCity, 6);
    assert.ok(!p.inventory.has(BOOK));
    assert.ok(ted.said.includes('Ok I guess you can come in then'));
    assert.deepEqual(p.doors, [[122, undefined]]);

    // without the book Ted only sends you away
    const q = player({ stage: 5, world: fakeWorld({ npcs: [fakeNpc(TED)] }), y: 569 });
    await west.onWallObjectCommandOne(q, door);
    assert.deepEqual(q.messages, ["The door won't open"]);
    assert.deepEqual(q.doors, []);
});

test('stage 6: Ted points upstairs, Milli names the building (stage 7)', async () => {
    const p = player({ stage: 6 });
    const ted = fakeNpc(TED);
    await west.onTalkToNPC(p, ted);
    assert.ok(ted.said.includes('Milli is upstairs if you wish to speak to her'));
    assert.equal(p.questStages.plagueCity, 6);

    await west.onTalkToNPC(p, fakeNpc(MILLI));
    assert.equal(p.questStages.plagueCity, 7);
});

test('stage 7: the mourner at the plague house says you need clearance (stage 8)', async () => {
    const door = wallObject(123, 637, 606);
    const mourner = fakeNpc(MOURNER_WEST);
    // "but I think a kidnap victim is in here" -> "I want to check anyway"
    const p = player({ stage: 7, y: 605, answers: [0, 1], world: fakeWorld({ npcs: [mourner] }) });
    assert.equal(await house.onWallObjectCommandOne(p, door), true);
    assert.equal(p.questStages.plagueCity, 8);
    assert.deepEqual(p.doors, []);
    assert.ok(mourner.said.includes('Or I suppose Bravek the city warder'));

    // "I fear not a mere plague" says the same
    const q = player({ stage: 7, y: 605, answers: [1], world: fakeWorld({ npcs: [fakeNpc(MOURNER_WEST)] }) });
    await house.onWallObjectCommandOne(q, door);
    assert.equal(q.questStages.plagueCity, 8);

    // from inside the house the door just opens
    const inside = player({ stage: 7, y: 606 });
    await house.onWallObjectCommandOne(inside, door);
    assert.deepEqual(inside.doors, [[123, undefined]]);
});

test('stage 8: the clerk lets you in to Bravek; his door stays shut from outside', async () => {
    const bravek = fakeNpc(BRAVEK);
    // "I need permission..." -> "This is urgent though"
    const p = player({ stage: 8, answers: [0, 2], world: fakeWorld({ npcs: [bravek] }), male: false });
    const clerk = fakeNpc(CLERK);
    await west.onTalkToNPC(p, clerk);
    assert.ok(clerk.said.includes("Mr Bravek there's a lady here who really needs to speak to you"));
    assert.deepEqual(p.teleports, [[647, 585]]);
    assert.ok(bravek.said.includes('If they keep it short'));

    // his door stays shut from outside until stage 9
    const door = wallObject(121, 648, 585);
    const outside = player({ stage: 8, x: 648 });
    await west.onWallObjectCommandOne(outside, door);
    assert.deepEqual(outside.messages, ["The door won't open"]);
    const inside = player({ stage: 8, x: 647 });
    await west.onWallObjectCommandOne(inside, door);
    assert.deepEqual(inside.doors, [[121, undefined]]);
});

test('stage 8 -> 9: Bravek by both menu roads', async () => {
    const p = player({ stage: 8, answers: [0, 2] });
    await west.onTalkToNPC(p, fakeNpc(BRAVEK));
    assert.equal(p.questStages.plagueCity, 9);
    assert.ok(p.inventory.has(SCRUFFY_NOTE));

    // "You shouldn't drink so much then" -> "Do you know what is in the cure?""
    const q = player({ stage: 8, answers: [0, 1, 1] });
    await west.onTalkToNPC(q, fakeNpc(BRAVEK));
    assert.equal(q.questStages.plagueCity, 9);
    assert.ok(q.said.includes('Do you know what is in the cure?'));

    // the note reads the recipe
    await items.onInventoryCommand(q, { id: SCRUFFY_NOTE });
    assert.ok(q.messages.includes('fnales add 5cme snape gras5'));
});

test('stage 9: the hangover cure is mixed and given to Bravek (stage 10), who writes the warrant', async () => {
    const p = player({ stage: 9, items: [MILK, CHOCOLATE_DUST, SNAPE_GRASS], answers: [2] });
    assert.equal(await items.onUseWithInventory(p, { id: CHOCOLATE_DUST }, { id: MILK }), true);
    assert.ok(p.inventory.has(CHOCOLATY_MILK));
    await items.onUseWithInventory(p, { id: CHOCOLATY_MILK }, { id: SNAPE_GRASS });
    assert.deepEqual(p.inventory.items.map((it) => it.id), [HANGOVER_CURE]);

    await west.onTalkToNPC(p, fakeNpc(BRAVEK));
    assert.equal(p.questStages.plagueCity, 10);
    assert.ok(p.inventory.has(WARRANT));
    assert.ok(!p.inventory.has(HANGOVER_CURE));

    // a lost warrant: he writes another
    const q = player({ stage: 10, answers: [2] });
    await west.onTalkToNPC(q, fakeNpc(BRAVEK));
    assert.ok(q.inventory.has(WARRANT));

    // without the cure he only groans
    const r = player({ stage: 9 });
    await west.onTalkToNPC(r, fakeNpc(BRAVEK));
    assert.equal(r.questStages.plagueCity, 9);
});

test('stage 10: the warrant gets you past the mourner; the barrel key opens the cell; Elena is freed (stage 11)', async () => {
    const mourner = fakeNpc(MOURNER_WEST);
    const p = player({ stage: 10, y: 605, items: [WARRANT], world: fakeWorld({ npcs: [mourner] }) });
    await house.onWallObjectCommandOne(p, wallObject(123, 637, 606));
    assert.deepEqual(p.doors, [[123, undefined]]);
    assert.ok(p.messages.includes("You wait until the mourner's back is turned and sneak into the building"));

    const gate = gameObject(457, 637, 3447);
    const elena = fakeNpc(ELENA);
    p.y = 3446;
    // no key: Elena asks for help
    const q = player({ stage: 10, y: 3446, answers: [1], world: fakeWorld({ npcs: [elena] }) });
    await house.onGameObjectCommandOne(q, gate);
    assert.ok(elena.said.includes('Hey get me out of here please'));

    const barrel = gameObject(456, 639, 3440);
    await house.onGameObjectCommandTwo(p, barrel);
    assert.ok(p.inventory.has(LITTLE_KEY));
    await house.onGameObjectCommandTwo(p, barrel);
    assert.equal(p.messages.at(-1), 'the barrel is empty');
    assert.equal(p.inventory.count(LITTLE_KEY), 1);

    await house.onGameObjectCommandOne(p, gate);
    assert.deepEqual(p.messages.slice(-2), ['The gate is locked', "Why don't you use your key on the gate?"]);

    assert.equal(await house.onUseWithGameObject(p, gate, { id: LITTLE_KEY }), true);
    assert.deepEqual(p.gates, [[457, 181]]);

    await house.onTalkToNPC(p, elena);
    assert.equal(p.questStages.plagueCity, 11);
    await house.onTalkToNPC(p, elena);
    assert.equal(p.messages.at(-1), 'You have already rescued Elena');

    // the gate opens freely now
    await house.onGameObjectCommandOne(p, gate);
    assert.deepEqual(p.gates.at(-1), [457, 181]);

    // before stage 11, Open inside the cell lets you out
    const cell = player({ stage: 10, y: 3449 });
    await house.onGameObjectCommandOne(cell, gate);
    assert.deepEqual(cell.teleports, [[637, 3447]]);
    assert.deepEqual(cell.world.replaced, [[457, 181, 3]]);
});

test('stage 11: Edmond ends the quest with the magic scroll; reading it learns the Ardougne teleport', async () => {
    const p = player({ stage: 11, levels: { mining: 20 } });
    await east.onTalkToNPC(p, fakeNpc(EDMOND));
    assert.equal(p.questStages.plagueCity, -1);
    assert.deepEqual(p.completed, [
        [
            'plagueCity',
            {
                questPoints: 1,
                experience: { mining: 700 + 300 * 20 },
                message: 'Well done you have completed the plague city quest'
            }
        ]
    ]);
    assert.ok(p.inventory.has(MAGIC_SCROLL));
    assert.equal(p.messages.at(-1), 'This story is to be continued');

    await items.onInventoryCommand(p, { id: MAGIC_SCROLL });
    assert.equal(p.cache.ardougneScroll, true);
    assert.ok(p.messages.includes('You can now cast the Ardougne teleport spell'));
    assert.ok(!p.inventory.has(MAGIC_SCROLL));

    // he has no more for a reader; a player who lost an unread one gets another
    await east.onTalkToNPC(p, fakeNpc(EDMOND));
    assert.ok(p.said.includes('No problem'));
    const lost = player({ stage: -1, answers: [0] });
    await east.onTalkToNPC(lost, fakeNpc(EDMOND));
    assert.ok(lost.inventory.has(MAGIC_SCROLL));

    // a second scroll after reading one just crumbles
    p.inventory.add(MAGIC_SCROLL);
    const before = p.messages.length;
    await items.onInventoryCommand(p, { id: MAGIC_SCROLL });
    assert.deepEqual(p.messages.slice(before), ['The scroll crumbles to dust']);
});

test('the mourners talk at every stage without touching the quest', async () => {
    for (const [id, stages] of [
        [MOURNER_EAST, [0, 1, 2, 3, 4, 5, -1]],
        [MOURNER_ENTRANCE, [0, 2, 3, 6, -1]],
        [MOURNER_WEST, [5, -1]],
        [HEAD_MOURNER, [5, 9]]
    ]) {
        for (const stage of stages) {
            const p = player({ stage, answers: [0, 0, 0] });
            assert.equal(await (id === MOURNER_WEST || id === HEAD_MOURNER ? west : east).onTalkToNPC(p, fakeNpc(id)), true);
            assert.equal(p.questStages.plagueCity, stage, `npc ${id} stage ${stage}`);
        }
    }

    // only the head mourner from stage 9 offers clearance, and the Elena question is gone after the quest
    const head = player({ stage: 9, answers: [0, 1] });
    await west.onTalkToNPC(head, fakeNpc(HEAD_MOURNER));
    assert.equal(head.asked[0][0], 'I need clearance to enter a plague house');
    const after = player({ stage: -1, answers: [0] });
    await west.onTalkToNPC(after, fakeNpc(MOURNER_WEST));
    assert.equal(after.asked[0].length, 2);
});
