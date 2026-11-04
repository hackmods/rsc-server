// Family Crest (members), ported from Open-RSC FamilyCrest.java, Chef.java, Boot.java, the Al Kharid shopkeepers,
// InvUseOnItem, Mining, Smelting, Crafting, Formulae.burnFood, SpellHandler and Inventory.dropOnDeath.
// Steps every stage 0 -> 1 -> ... -> 8 -> -1, then the dungeon levers and doors, Chronozon, the gauntlets.

const test = require('node:test');
const assert = require('node:assert');

const { fakeNpc, fakeWorld, fakePlayer, gameObject, wallObject } = require('./quest-fakes-3a');

const shared = require('../src/plugins/quests/members/family-crest/shared');
const dimintheis = require('../src/plugins/quests/members/family-crest/dimintheis');
const caleb = require('../src/plugins/quests/members/family-crest/caleb');
const avan = require('../src/plugins/quests/members/family-crest/avan');
const boot = require('../src/plugins/quests/members/family-crest/boot');
const johnathon = require('../src/plugins/quests/members/family-crest/johnathon');
const dungeon = require('../src/plugins/quests/members/family-crest/dungeon');
const chronozon = require('../src/plugins/quests/members/family-crest/chronozon');
const crest = require('../src/plugins/quests/members/family-crest/crest');
const kebabSeller = require('../src/plugins/npcs/al-kharid/kebab-seller');
const gemTrader = require('../src/plugins/npcs/al-kharid/gem-trader');
const louie = require('../src/plugins/npcs/al-kharid/louie-legs');
const ranael = require('../src/plugins/npcs/al-kharid/ranael');
const zeke = require('../src/plugins/npcs/al-kharid/zeke');
const silkTrader = require('../src/plugins/npcs/al-kharid/silk-trader');
const mining = require('../src/plugins/skills/mining');
const smelting = require('../src/plugins/skills/smithing/smelting');
const jewellery = require('../src/plugins/skills/crafting/jewellery');
const items = require('@2003scape/rsc-data/config/items');

const QUEST = 'familyCrest';
const FISH = [370, 555, 367, 357, 350];
const FURNACE_ID = 118;

function player(stage, opts = {}) {
    const p = fakePlayer({ quest: QUEST, stage, ...opts });
    p.sendBubble = () => {};
    p.sendSound = () => {};
    p.isTired = () => false;
    p.xp = [];
    p.addExperience = (skill, amount) => p.xp.push([skill, amount]);
    for (const skill of ['mining', 'smithing', 'crafting']) {
        const level = (opts.levels && opts.levels[skill]) || 60;
        p.skills[skill] = { base: level, current: level };
    }
    return p;
}

function has(p, id) {
    return p.inventory.has(id);
}

const item = (id) => ({ id, amount: 1, definition: items[id] });

test('stage 0 -> 1: Dimintheis sends the player to Caleb', async () => {
    const npc = fakeNpc(309);
    const p = player(0, { answers: [2, 1, 0] }); // bold adventurer, where is the crest, ok I will help
    assert.strictEqual(await dimintheis.onTalkToNPC(p, npc), true);
    assert.strictEqual(p.questStages.familyCrest, 1);
    assert.ok(npc.said.includes('If you find Caleb send him my love'));
    assert.ok(p.said.includes('Ok, I will help you'));

    // the tradition branch also reaches the three sons
    const q = player(undefined, { answers: [0, 0, 1] }); // why a hut, why would he, not interested
    q.questStages = {};
    await dimintheis.onTalkToNPC(q, fakeNpc(309));
    assert.strictEqual(q.questStages.familyCrest, undefined);
    assert.ok(q.said.includes('so where is this crest?'));

    const other = player(1);
    assert.strictEqual(await dimintheis.onTalkToNPC(other, fakeNpc(310)), false);
});

test('stage 1 -> 2 -> 3: Caleb wants five cooked fish for crest fragment 695', async () => {
    const npc = fakeNpc(310);
    const p = player(1, { answers: [0, 1, 0] }); // are you Caleb, can I have your bit, ok I will get those
    assert.strictEqual(await caleb.onTalkToNPC(p, npc), true);
    assert.strictEqual(p.questStages.familyCrest, 2);
    assert.ok(npc.said.includes('I need cooked swordfish,bass,tuna,salmon and shrimp'));

    // missing a fish: nothing changes
    const short = player(2, { items: FISH.slice(1) });
    await caleb.onTalkToNPC(short, fakeNpc(310));
    assert.strictEqual(short.questStages.familyCrest, 2);
    assert.ok(short.said.includes("I haven't got all the fish yet"));

    const full = player(2, { items: FISH, answers: [1] }); // thankyou very much
    await caleb.onTalkToNPC(full, fakeNpc(310));
    assert.strictEqual(full.questStages.familyCrest, 3);
    assert.ok(has(full, 695));
    assert.ok(FISH.every((id) => !has(full, id)));
    assert.strictEqual(full.cache.skippedMenu, true);

    // stage 3 with the skipped menu: he tells where Avan is and forgets the flag
    const again = player(3, { cache: { skippedMenu: true }, answers: [0] });
    await caleb.onTalkToNPC(again, fakeNpc(310));
    assert.strictEqual(again.cache.skippedMenu, undefined);

    // stage 0: no "Are you Caleb" option
    const fresh = player(0, { answers: [0] });
    await caleb.onTalkToNPC(fresh, fakeNpc(310));
    assert.deepStrictEqual(fresh.asked[0], ['Nothing, I will be on my way', 'I see you are a chef, will you cook me anything?']);
    assert.ok(fresh.said.includes('Nothing I will be on my way'));

    // a lost fragment is replaced at stages 4-8
    const lost = player(5, { answers: [1] });
    await caleb.onTalkToNPC(lost, fakeNpc(310));
    assert.ok(has(lost, 695));
});

test('stages 3-4: the Al Kharid shopkeepers are asked about Adam Fitzharmon', async () => {
    for (const [plugin, id] of [
        [kebabSeller, 90],
        [louie, 85],
        [ranael, 103],
        [zeke, 84],
        [silkTrader, 71]
    ]) {
        const before = player(2, { answers: [1] });
        before.inventory.add(10, 5);
        await plugin.onTalkToNPC(before, fakeNpc(id));
        assert.strictEqual(before.asked[0].length, 2, `npc ${id} at stage 2`);

        const npc = fakeNpc(id);
        const p = player(3, { answers: [2] });
        await plugin.onTalkToNPC(p, npc);
        assert.strictEqual(p.asked[0].length, 3, `npc ${id} at stage 3`);
        assert.strictEqual(p.asked[0][2], shared.ASK_FOR_AVAN);
        assert.ok(npc.said.includes("I haven't seen him"), `npc ${id} answers`);

        const done = player(-1, { answers: [1] });
        await plugin.onTalkToNPC(done, fakeNpc(id));
        assert.strictEqual(done.asked[0].length, 2, `npc ${id} after the quest`);
    }
});

test('stage 3 -> 4: the gem trader saw Avan', async () => {
    const npc = fakeNpc(308);
    const p = player(3, { answers: [2] });
    assert.strictEqual(await gemTrader.onTalkToNPC(p, npc), true);
    assert.strictEqual(p.questStages.familyCrest, 4);
    assert.ok(p.said.includes("I'm in search of a man named Adam Fitzharmon"));
    assert.ok(npc.said.includes('He might even be desperate enough to brave the scorpions'));

    const shop = player(0, { answers: [0] });
    await gemTrader.onTalkToNPC(shop, fakeNpc(308));
    assert.deepStrictEqual(shop.shops, ['al-kharid-gem-stall']);
});

test('stage 4 -> 5: Avan wants perfect gold jewellery', async () => {
    const busy = player(3);
    const busyNpc = fakeNpc(307);
    await avan.onTalkToNPC(busy, busyNpc);
    assert.deepStrictEqual(busyNpc.said, ["Can't you see I'm busy?"]);

    const npc = fakeNpc(307);
    const p = player(4, { answers: [1] });
    assert.strictEqual(await avan.onTalkToNPC(p, npc), true);
    assert.strictEqual(p.questStages.familyCrest, 5);
    assert.ok(npc.said.includes('My latest lead was a dwarf named Boot'));
});

test('stage 5 -> 6: Boot points to the perfect gold', async () => {
    const npc = fakeNpc(313);
    const p = player(5, { answers: [0] });
    assert.strictEqual(await boot.onTalkToNPC(p, npc), true);
    assert.strictEqual(p.questStages.familyCrest, 6);
    assert.strictEqual(p.asked[0].length, 3);

    const plain = player(0, { answers: [1] });
    const plainNpc = fakeNpc(313);
    await boot.onTalkToNPC(plain, plainNpc);
    assert.strictEqual(plain.asked[0].length, 2);
    assert.ok(plainNpc.said.includes('I used to sleep in a large boot'));
});

test('the perfect gold rock (315) has no ore before stage 6', async () => {
    assert.strictEqual(shared.canMinePerfectGold(player(5), 315), false);
    assert.strictEqual(shared.canMinePerfectGold(player(6), 315), true);
    assert.strictEqual(shared.canMinePerfectGold(player(8), 315), true);
    assert.strictEqual(shared.canMinePerfectGold(player(-1), 315), false);
    assert.strictEqual(shared.canMinePerfectGold(player(0), 100), true);

    const p = player(5, { items: [156] });
    const rock = gameObject(315, 504, 3424);
    assert.strictEqual(await mining.onGameObjectCommandOne(p, rock), true);
    assert.strictEqual(p.messages[p.messages.length - 1], '@que@There is currently no ore available in this rock');
    assert.deepStrictEqual(p.xp, []);
});

test('perfect gold smelts into a perfect gold bar; goldsmithing gauntlets add 45', async () => {
    const furnace = { id: FURNACE_ID };

    const p = player(6, { items: [690] });
    assert.strictEqual(await smelting.onUseWithGameObject(p, furnace, item(690)), true);
    assert.ok(has(p, 691));
    assert.ok(!has(p, 690));
    assert.deepStrictEqual(p.xp, [['smithing', 90]]);

    const gloved = player(-1, { items: [152, 699], equipped: [699], cache: { famcrestGauntlets: 1 } });
    await smelting.onUseWithGameObject(gloved, furnace, item(152));
    assert.ok(has(gloved, 172));
    assert.deepStrictEqual(gloved.xp, [['smithing', 135]]);

    // the worn pair without the matching enchantment does nothing
    const wrong = player(-1, { items: [152, 699], equipped: [699], cache: { famcrestGauntlets: 0 } });
    await smelting.onUseWithGameObject(wrong, furnace, item(152));
    assert.deepStrictEqual(wrong.xp, [['smithing', 90]]);
});

test('a perfect gold bar makes the perfect ruby ring and necklace', async () => {
    const furnace = { id: FURNACE_ID };

    const ring = player(6, { items: [691, 162, 293], answers: [0, 3] });
    assert.strictEqual(await jewellery.onUseWithGameObject(ring, furnace, item(691)), true);
    assert.ok(has(ring, 692));
    assert.ok(!has(ring, 691) && !has(ring, 162));

    const necklace = player(6, { items: [691, 162, 295], answers: [1, 3] });
    await jewellery.onUseWithGameObject(necklace, furnace, item(691));
    assert.ok(has(necklace, 693));

    // an ordinary gold bar still makes an ordinary ruby ring
    const plain = player(6, { items: [172, 162, 293], answers: [0, 3] });
    await jewellery.onUseWithGameObject(plain, furnace, item(172));
    assert.ok(has(plain, 286));
});

test('stage 6 -> 7: Avan swaps the jewellery for crest fragment 696', async () => {
    const without = player(6);
    await avan.onTalkToNPC(without, fakeNpc(307));
    assert.strictEqual(without.questStages.familyCrest, 6);

    const p = player(6, { items: [692, 693] });
    const npc = fakeNpc(307);
    await avan.onTalkToNPC(p, npc);
    assert.strictEqual(p.questStages.familyCrest, 7);
    assert.ok(has(p, 696));
    assert.ok(!has(p, 692) && !has(p, 693));
    assert.ok(npc.said.includes('on the edge of the wilderness'));
});

test('stage 7 -> 8: a cure poison potion on Johnathon', async () => {
    const tired = fakeNpc(314);
    await johnathon.onTalkToNPC(player(6), tired);
    assert.deepStrictEqual(tired.said, ['I am so very tired, leave me to rest']);

    const p = player(7, { items: [567] });
    const npc = fakeNpc(314);
    await johnathon.onTalkToNPC(p, npc);
    assert.strictEqual(p.cache.johnathonIll, true);
    assert.ok(p.messages.includes("Sweat is pouring down Johnathon's face"));

    // not the quest stage: nothing interesting happens, the potion stays
    const early = player(6, { items: [567] });
    assert.strictEqual(await johnathon.onUseWithNPC(early, fakeNpc(314), item(567)), true);
    assert.ok(early.messages.includes('nothing interesting happens'));
    assert.ok(has(early, 567));

    // other items are not his
    assert.strictEqual(await johnathon.onUseWithNPC(p, npc, item(350)), false);

    const answers = [2, 2]; // how did you get poisoned, on my way
    p.ask = async (options, repeat) => {
        p.asked.push(options);
        const choice = answers.shift();
        if (repeat) p.said.push(options[choice]);
        return choice;
    };
    assert.strictEqual(await johnathon.onUseWithNPC(p, npc, item(567)), true);
    assert.strictEqual(p.questStages.familyCrest, 8);
    assert.strictEqual(p.cache.johnathonIll, undefined);
    assert.ok(!has(p, 567));
    assert.ok(npc.said.includes("There are spiders towards the entrance to Chronozon's cave"));
});

test('stage 8: Chronozon regenerates unless hit by all four blasts, then drops fragment 697', async () => {
    const world = fakeWorld();
    const p = player(8, { world });
    const npc = fakeNpc(315, { x: 232, y: 3248 });
    npc.skills = { hits: { base: 182, current: 0 } };

    for (const name of ['Wind blast', 'Water blast', 'Earth blast']) {
        assert.strictEqual(await chronozon.onCastOnNPC(p, npc, { name }), false);
    }
    // bolts do not count
    await chronozon.onCastOnNPC(p, npc, { name: 'Fire bolt' });
    assert.strictEqual(p.messages.filter((m) => m === 'chronozon weakens').length, 3);

    assert.strictEqual(await chronozon.onNPCDeath(p, npc), true);
    assert.strictEqual(npc.skills.hits.current, 182);
    assert.ok(p.messages.includes('Chronozon regenerates'));
    assert.deepStrictEqual(world.drops, []);

    await chronozon.onCastOnNPC(p, npc, { name: 'Fire blast' });
    npc.skills.hits.current = 0;
    assert.strictEqual(await chronozon.onNPCDeath(p, npc), false); // default death: ashes, removal, kill xp
    assert.deepStrictEqual(world.drops, [{ owner: p, id: 697, x: 232, y: 3248 }]);

    // after the quest he still dies but drops no fragment
    const doneWorld = fakeWorld();
    const done = player(-1, { world: doneWorld });
    done.chronozonBlasts = new Set(['wind', 'water', 'earth', 'fire']);
    assert.strictEqual(await chronozon.onNPCDeath(done, npc), false);
    assert.deepStrictEqual(doneWorld.drops, []);

    assert.strictEqual(await chronozon.onNPCDeath(p, fakeNpc(35)), false);
    assert.strictEqual(await chronozon.onCastOnNPC(p, fakeNpc(35), { name: 'Wind blast' }), false);
});

test('the three crest fragments join into the family crest', async () => {
    const two = player(8, { items: [695, 696] });
    assert.strictEqual(await crest.onUseWithInventory(two, item(695), item(696)), true);
    assert.ok(two.messages.includes('You still need one more piece of the crest'));
    assert.ok(!has(two, 694));

    const all = player(8, { items: [695, 696, 697] });
    assert.strictEqual(await crest.onUseWithInventory(all, item(697), item(695)), true);
    assert.ok(has(all, 694));
    assert.ok([695, 696, 697].every((id) => !has(all, id)));

    assert.strictEqual(await crest.onUseWithInventory(all, item(695), item(350)), false);
});

test('stage 8 -> -1: the crest to Dimintheis gives 1 quest point and steel gauntlets', async () => {
    const waiting = player(8);
    await dimintheis.onTalkToNPC(waiting, fakeNpc(309));
    assert.ok(waiting.said.includes("I don't have it yet"));

    const p = player(8, { items: [694], cache: { northLeverA: true, southLever: false, northLeverB: true } });
    const npc = fakeNpc(309);
    await dimintheis.onTalkToNPC(p, npc);
    assert.strictEqual(p.questStages.familyCrest, -1);
    assert.deepStrictEqual(p.completed, [
        [QUEST, { questPoints: 1, message: 'Well done you have completed the family crest quest' }]
    ]);
    assert.ok(!has(p, 694));
    assert.ok(has(p, 698));
    assert.strictEqual(p.cache.famcrestGauntlets, 0);
    assert.strictEqual(p.cache.northLeverA, undefined);
    assert.strictEqual(p.cache.northLeverB, undefined);
    assert.strictEqual(p.cache.southLever, undefined);

    // the three loose fragments are accepted too
    const loose = player(8, { items: [695, 696, 697] });
    await dimintheis.onTalkToNPC(loose, fakeNpc(309));
    assert.strictEqual(loose.questStages.familyCrest, -1);
    assert.ok(has(loose, 698));
});

test('dungeon levers and doors', async () => {
    const lever = (id) => gameObject(id, 0, 0);
    const p = player(6);

    // before any pull every lever door is locked
    for (const door of [wallObject(88, 509, 3441), wallObject(90, 512, 3441), wallObject(91, 508, 3427, 1), wallObject(92, 510, 3415)]) {
        assert.strictEqual(await dungeon.onWallObjectCommandOne(p, door), true);
    }
    assert.strictEqual(p.messages.filter((m) => m === 'The door is locked').length, 4);
    assert.deepStrictEqual(p.doors, []);

    // the tutorial island doors 88 and 90 are not the quest's
    assert.strictEqual(await dungeon.onWallObjectCommandOne(p, wallObject(88, 222, 760)), false);

    assert.strictEqual(await dungeon.onGameObjectCommandTwo(p, lever(316)), true);
    assert.strictEqual(p.messages.pop(), 'The lever is up');

    // A down: south right door (90) opens, north door (92) stays locked
    await dungeon.onGameObjectCommandOne(p, lever(316));
    assert.deepStrictEqual(p.messages.slice(-2), ['You pull the lever down', 'you hear a clunk']);
    assert.deepStrictEqual(p.cache, { northLeverA: true, southLever: false, northLeverB: false });
    await dungeon.onWallObjectCommandOne(p, wallObject(90, 512, 3441));
    await dungeon.onWallObjectCommandOne(p, wallObject(92, 510, 3415));
    assert.deepStrictEqual(p.doors, [[90, undefined]]);

    // A and south down: south left door (88)
    await dungeon.onGameObjectCommandOne(p, lever(317));
    await dungeon.onWallObjectCommandOne(p, wallObject(88, 509, 3441));
    assert.deepStrictEqual(p.doors.pop(), [88, undefined]);

    // A and B down, south up: the front door (91)
    await dungeon.onGameObjectCommandOne(p, lever(317));
    await dungeon.onGameObjectCommandOne(p, lever(318));
    await dungeon.onWallObjectCommandOne(p, wallObject(91, 508, 3427, 1));
    assert.deepStrictEqual(p.doors.pop(), [91, undefined]);

    // A up, B down: the north door (92)
    await dungeon.onGameObjectCommandOne(p, lever(316));
    assert.deepStrictEqual(p.messages.slice(-2), ['You pull the lever up', 'you hear a clunk']);
    await dungeon.onWallObjectCommandOne(p, wallObject(92, 510, 3415));
    assert.deepStrictEqual(p.doors.pop(), [92, undefined]);

    // after the quest: the levers do nothing, the front door is open
    const done = player(-1);
    await dungeon.onGameObjectCommandOne(done, lever(316));
    assert.deepStrictEqual(done.messages, ['nothing interesting happens']);
    await dungeon.onWallObjectCommandOne(done, wallObject(91, 508, 3427, 1));
    assert.deepStrictEqual(done.doors, [[91, undefined]]);

    assert.strictEqual(await dungeon.onGameObjectCommandOne(p, lever(100)), false);
});

test('each son enchants the steel gauntlets once', async () => {
    for (const [plugin, npcID, answer, enchanted, cacheValue] of [
        [caleb, 310, 0, 700, 2],
        [avan, 307, 0, 699, 1],
        [johnathon, 314, 0, 701, 3]
    ]) {
        const p = player(-1, { items: [698], cache: { famcrestGauntlets: 0 }, answers: [answer] });
        assert.strictEqual(await plugin.onTalkToNPC(p, fakeNpc(npcID)), true);
        assert.ok(has(p, enchanted), `npc ${npcID} gives ${enchanted}`);
        assert.ok(!has(p, 698));
        assert.strictEqual(p.cache.famcrestGauntlets, cacheValue);

        // already enchanted: no second offer
        const again = player(-1, { items: [enchanted], cache: { famcrestGauntlets: cacheValue } });
        await plugin.onTalkToNPC(again, fakeNpc(npcID));
        assert.deepStrictEqual(again.asked, []);
    }

    const calebNpc = fakeNpc(310);
    await caleb.onTalkToNPC(player(-1, { cache: { famcrestGauntlets: 1 } }), calebNpc);
    assert.ok(calebNpc.said.includes('I hear you have bought the completed crest to my father'));

    const declined = player(-1, { items: [698], cache: { famcrestGauntlets: 0 }, answers: [1] });
    const avanNpc = fakeNpc(307);
    await avan.onTalkToNPC(declined, avanNpc);
    assert.ok(has(declined, 698));
    assert.ok(avanNpc.said.includes('Ok if you insist on getting help from the likes of them'));
});

test('gauntlet bonuses need the worn pair and the matching famcrest_gauntlets', () => {
    const chaos = player(-1, { items: [701], equipped: [701], cache: { famcrestGauntlets: 3 } });
    assert.strictEqual(shared.boltBonus(chaos, 'Fire bolt'), 1);
    assert.strictEqual(shared.boltBonus(chaos, 'Wind blast'), 0);
    assert.strictEqual(shared.boltBonus(player(-1, { items: [701], cache: { famcrestGauntlets: 3 } }), 'Fire bolt'), 0);
    assert.strictEqual(shared.boltBonus(player(-1, { items: [701], equipped: [701] }), 'Fire bolt'), 0);

    const cook = player(-1, { items: [700], equipped: [700], cache: { famcrestGauntlets: 2 } });
    assert.strictEqual(shared.cookingGauntlets(cook), true);
    assert.strictEqual(shared.cookingGauntlets(player(-1, { items: [700], equipped: [700] })), false);

    const smith = player(-1, { items: [699], equipped: [699], cache: { famcrestGauntlets: 1 } });
    assert.strictEqual(shared.goldsmithingBonus(smith, 172), 45);
    assert.strictEqual(shared.goldsmithingBonus(smith, 384), 0);
});

test('after the quest the gauntlets come back on death unless banked or carried', () => {
    const lost = player(-1, { cache: { famcrestGauntlets: 2 } });
    assert.strictEqual(shared.returnGauntletsOnDeath(lost), true);
    assert.ok(has(lost, 700));

    const kept = player(-1, { items: [700], cache: { famcrestGauntlets: 2 } });
    assert.strictEqual(shared.returnGauntletsOnDeath(kept), false);
    assert.strictEqual(kept.inventory.count(700), 1);

    const banked = player(-1, { banked: [699], cache: { famcrestGauntlets: 1 } });
    assert.strictEqual(shared.returnGauntletsOnDeath(banked), false);

    const unfinished = player(8, { cache: {} });
    assert.strictEqual(shared.returnGauntletsOnDeath(unfinished), false);
});
