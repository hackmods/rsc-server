// Item mechanics (Wave 4): items/item-on-item.js (Open-RSC InvUseOnItem.java), the crystal chest, the Herblaw vial
// mixes and the Gujuo potion, crushed gemstones, oyster pearl bolt tips, and Shantay's Ugthanki kebab recipe.

const test = require('node:test');
const assert = require('node:assert/strict');

const { fakePlayer, ids, item, npc, withRandom } = require('./wave4-fake');
const itemOnItem = require('../src/plugins/items/item-on-item');
const crystalChest = require('../src/plugins/game-objects/crystal-chest');
const herblaw = require('../src/plugins/skills/herblaw');
const gemCutting = require('../src/plugins/skills/crafting/gem-cutting');
const fletching = require('../src/plugins/skills/fletching');
const shantay = require('../src/plugins/npcs/al-kharid/shantay');
const paper = require('../src/plugins/items/scrumpled-piece-of-paper');
const pluginIndex = require('../src/plugins');

const VIAL_OF_WATER = 464;

test('the new item plugins are registered', () => {
    assert.equal(pluginIndex['items.item-on-item'], itemOnItem);
    assert.equal(pluginIndex['game-objects.crystal-chest'], crystalChest);
    assert.equal(pluginIndex['items.scrumpled-piece-of-paper'], paper);
});

test('the two key halves join into the crystal key, either way round', async () => {
    for (const [a, b] of [[526, 527], [527, 526]]) {
        const player = fakePlayer({ inventory: [526, 527] });
        assert.equal(await itemOnItem.onUseWithInventory(player, item(a), item(b)), true);
        assert.deepEqual(ids(player), [525]);
        assert.deepEqual(player.xp, []);
    }
});

test('swamp paste, candles, dry sticks, chocolaty milk and the hangover cure', async () => {
    const cases = [
        [[136, 783], [135, 784]], // pot of flour + swamp tar -> pot + uncooked swamp paste
        [[166, 599], [166, 601]], // tinderbox lights a candle
        [[166, 600], [166, 602]], // and a black candle
        [[778, 776], [778, 777]], // broken glass dries damp sticks
        [[22, 772], [770]], // milk + chocolate dust
        [[770, 469], [771]] // chocolaty milk + snape grass
    ];
    for (const [[a, b], after] of cases) {
        const player = fakePlayer({ inventory: [a, b] });
        assert.equal(await itemOnItem.onUseWithInventory(player, item(a), item(b)), true, `${a} on ${b}`);
        assert.deepEqual(player.bag.map((e) => e.id).sort(), after.slice().sort(), `${a} on ${b}`);
    }
    assert.equal(await itemOnItem.onUseWithInventory(fakePlayer(), item(10), item(20)), false);
});

test('the crystal chest takes the key and always gives an uncut dragonstone', async () => {
    const chest = { id: 248 };
    const player = fakePlayer({ inventory: [525] });
    assert.equal(await withRandom([0.0001], () => crystalChest.onUseWithGameObject(player, chest, item(525))), true);
    assert.deepEqual(ids(player), [542, 402]); // roll 1: rune plate mail legs
    assert.deepEqual(player.world.replaced, [{ type: 'gameObjects', id: 247, ticks: 2 }]);

    const runes = fakePlayer({ inventory: [525] });
    await withRandom([0.3], () => crystalChest.onUseWithGameObject(runes, chest, item(525)));
    assert.equal(runes.inventory.count(31), 50);
    assert.equal(runes.inventory.count(46), 10);

    const nothing = fakePlayer({ inventory: [525] });
    await withRandom([0.99], () => crystalChest.onUseWithGameObject(nothing, chest, item(525)));
    assert.deepEqual(ids(nothing), [542]);

    const rubies = fakePlayer({ inventory: [525] });
    await withRandom([0.16], () => crystalChest.onUseWithGameObject(rubies, chest, item(525)));
    assert.deepEqual(ids(rubies), [542, 162, 162, 161, 161]);

    const locked = fakePlayer();
    assert.equal(await crystalChest.onGameObjectCommandOne(locked, chest), true);
    assert.deepEqual(locked.messages, ['the chest is locked']);
    assert.equal(await crystalChest.onUseWithGameObject(fakePlayer({ inventory: [526] }), chest, item(526)), false);
});

test('the loot bands are the Java ones', () => {
    assert.deepEqual(crystalChest.rollLoot(25), [[542, 1], [402, 1]]);
    assert.deepEqual(crystalChest.rollLoot(26), [[542, 1], [127, 1]]);
    assert.deepEqual(crystalChest.rollLoot(8327), [[542, 1], [179, 1], [10, 2000]]);
    assert.deepEqual(crystalChest.rollLoot(8328), [[542, 1]]);
});

test('vial mixes: jangerberries -> unfinished potion, jungle herbs -> solutions, bat bones fizz away', async () => {
    for (const [herb, out] of [[936, 1074], [818, 1252], [816, 1251], [1051, 465]]) {
        const player = fakePlayer({ inventory: [VIAL_OF_WATER, herb], quests: { druidicRitual: 0 } });
        assert.equal(await herblaw.onUseWithInventory(player, item(herb), item(VIAL_OF_WATER)), true, `${herb}`);
        assert.deepEqual(ids(player), [out], `${herb}`);
    }
});

test('the Gujuo potion needs herblaw 45, the Druidic Ritual and Legends Quest stage 7', async () => {
    const fresh = fakePlayer({ level: 45, inventory: [1251, 818] });
    await herblaw.onUseWithInventory(fresh, item(1251), item(818));
    assert.deepEqual(ids(fresh), [1251, 818]);
    assert.match(fresh.messages.join('|'), /decide against experimenting/);

    const ready = fakePlayer({ level: 45, inventory: [1252, 816], quests: { legendsQuest: 7 } });
    await herblaw.onUseWithInventory(ready, item(816), item(1252));
    assert.deepEqual(ids(ready), [1253]);

    const low = fakePlayer({ level: 44, inventory: [1251, 818], quests: { legendsQuest: -1 } });
    await herblaw.onUseWithInventory(low, item(1251), item(818));
    assert.deepEqual(ids(low), [1251, 818]);
});

test('semi-precious gems can smash into a crushed gemstone; precious ones never do', async () => {
    const smash = fakePlayer({ levels: { crafting: 10 }, inventory: [167, 891] });
    await withRandom([0.99], () => gemCutting.onUseWithInventory(smash, item(167), item(891)));
    assert.deepEqual(ids(smash), [167, 915]);
    assert.deepEqual(smash.xp, [{ skill: 'crafting', experience: 15 }]);

    const cut = fakePlayer({ levels: { crafting: 10 }, inventory: [167, 891] });
    await withRandom([0], () => gemCutting.onUseWithInventory(cut, item(891), item(167)));
    assert.deepEqual(ids(cut), [167, 894]);

    const sapphire = fakePlayer({ levels: { crafting: 20 }, inventory: [167, 160] });
    await withRandom([0.99], () => gemCutting.onUseWithInventory(sapphire, item(167), item(160)));
    assert.deepEqual(ids(sapphire), [167, 164]);

    // calcProductionSuccessfulLegacy: level 10 opal at crafting 10, threshold 64 + 9 * 19200 / (99 * 98) = 81
    assert.equal(gemCutting.productionSuccessLegacy(10, 10, 99, 81), true);
    assert.equal(gemCutting.productionSuccessLegacy(10, 10, 99, 82), false);
});

test('oyster pearls chisel into 2 bolt tips at fletching 34; tips on crossbow bolts make pearl bolts', async () => {
    const low = fakePlayer({ levels: { fletching: 33 }, inventory: [167, 792] });
    await fletching.onUseWithInventory(low, item(167), item(792));
    assert.deepEqual(ids(low), [167, 792]);

    const player = fakePlayer({ levels: { fletching: 34 }, inventory: [167, 792, [190, 15]] });
    assert.equal(await fletching.onUseWithInventory(player, item(792), item(167)), true);
    assert.equal(player.inventory.count(790), 2);
    assert.deepEqual(player.xp, [{ skill: 'fletching', experience: 100 }]);

    assert.equal(await fletching.onUseWithInventory(player, item(790), item(190)), true);
    assert.equal(player.inventory.count(786), 2);
    assert.equal(player.inventory.count(190), 13);
    assert.equal(player.inventory.count(790), 0);
});

test('Shantay drops the kebab recipe 1 time in 26, and it reads as the recipe box', async () => {
    const lucky = fakePlayer({ answers: [2] });
    await withRandom([0], () => shantay.onTalkToNPC(lucky, npc(549)));
    assert.deepEqual(lucky.world.drops, [{ id: 1120, x: 50, y: 60 }]);

    const usual = fakePlayer({ answers: [2] });
    await withRandom([0.5], () => shantay.onTalkToNPC(usual, npc(549)));
    assert.deepEqual(usual.world.drops, []);

    const reader = fakePlayer({ inventory: [1120] });
    assert.equal(await paper.onInventoryCommand(reader, item(1120)), true);
    assert.equal(reader.sent[0].type, 'serverMessageOnTop');
    assert.match(reader.sent[0].message, /Delicious Ugthanki Kebab/);
});
