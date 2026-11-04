// Eating and cooking (Wave 4): items/edible.js (Open-RSC Eating.java leftovers and special foods), the Ugthanki meat
// cooking row and the InvCooking combinations (Oomlie meat parcel, tasty Ugthanki kebab, which rows need a knife).

const test = require('node:test');
const assert = require('node:assert/strict');

const { fakePlayer, ids, item, withRandom } = require('./wave4-fake');
require('../src/data-fixes');
const cookingData = require('@2003scape/rsc-data/skills/cooking');
const edible = require('../src/plugins/items/edible');
const combinations = require('../src/plugins/skills/cooking/combinations');
const cooking = require('../src/plugins/skills/cooking/cooking');

const KNIFE = 13;
const PIE_DISH = 251;

test('a pie is eaten in halves and leaves the dish', async () => {
    const player = fakePlayer({ level: 20, inventory: [257] });
    player.skills.hits.current = 5;
    await edible.onInventoryCommand(player, item(257));
    assert.deepEqual(ids(player), [263]); // half an apple pie
    await edible.onInventoryCommand(player, item(263));
    assert.deepEqual(ids(player), [PIE_DISH]);
    assert.equal(player.skills.hits.current, 15);
    assert.match(player.messages.join('|'), /You eat half of an apple pie\|It heals some health/);
});

test('stew and curry leave the bowl, cake leaves the partial cake', async () => {
    for (const [food, left] of [[346, 341], [709, 341], [330, 333], [326, 328]]) {
        const player = fakePlayer({ level: 20, inventory: [food] });
        await edible.onInventoryCommand(player, item(food));
        assert.deepEqual(ids(player), [left], `${food}`);
    }
});

test('no heal line at full health', async () => {
    const player = fakePlayer({ level: 20, inventory: [350] });
    await edible.onInventoryCommand(player, item(350));
    assert.deepEqual(player.messages, ['You eat the shrimp']);
});

test('the Al Kharid kebab rolls its outcome (Eating.handleKebab)', async () => {
    const good = fakePlayer({ level: 50, inventory: [210] });
    good.skills.hits.current = 10;
    await withRandom([20 / 32], () => edible.onInventoryCommand(good, item(210)));
    assert.equal(good.skills.hits.current, 15); // 10% of 50
    assert.deepEqual(ids(good), []);

    const amazing = fakePlayer({ level: 50, inventory: [210] });
    amazing.skills.hits.current = 10;
    await withRandom([1 / 32 + 0.001, 0.99], () => edible.onInventoryCommand(amazing, item(210)));
    assert.equal(amazing.skills.hits.current, 40);
    assert.equal(amazing.skills.attack.current, 53);
    assert.match(amazing.messages.join('|'), /amazing kebab/);

    const dodgy = fakePlayer({ level: 50, inventory: [210] });
    await withRandom([0, 0.99], () => edible.onInventoryCommand(dodgy, item(210)));
    assert.equal(dodgy.skills.hits.current, 46);
});

test('the tasty Ugthanki kebab heals 19 and says so itself', async () => {
    const player = fakePlayer({ level: 50, inventory: [1102] });
    player.skills.hits.current = 20;
    await withRandom([0], () => edible.onInventoryCommand(player, item(1102)));
    assert.equal(player.skills.hits.current, 39);
    assert.deepEqual(player.messages, ['You eat the Tasty Ugthanki Kebab', 'It heals some health']);
    assert.deepEqual(player.said, ['Yummmmm!']);
});

test('jangerberries: +2 attack, -1 defense, +1 strength (InvAction.handleJangerberries)', async () => {
    const player = fakePlayer({ level: 30, inventory: [936] });
    await edible.onInventoryCommand(player, item(936));
    assert.deepEqual(ids(player), []);
    assert.equal(player.skills.attack.current, 32);
    assert.equal(player.skills.defense.current, 29);
    assert.equal(player.skills.strength.current, 31);
});

test('data fix: raw Ugthanki meat cooks into cooked Ugthanki meat and never burns', async () => {
    assert.deepEqual(
        { level: cookingData.uncooked[1101].level, cooked: cookingData.uncooked[1101].cooked, experience: cookingData.uncooked[1101].experience },
        { level: 1, cooked: 1103, experience: 160 }
    );
    const player = fakePlayer({ level: 1, inventory: [1101] });
    const fire = { id: 97, definition: { name: 'Fire' } };
    assert.equal(await withRandom([0.999], () => cooking.onUseWithGameObject(player, fire, item(1101))), true);
    assert.deepEqual(ids(player), [1103]);
    assert.deepEqual(player.xp, [{ skill: 'cooking', experience: 160 }]);
});

test('the Ugthanki kebab chain: mix (no knife), then pitta bread with a knife', async () => {
    const player = fakePlayer({ level: 58, inventory: [1103, 1108, 1105, KNIFE] });
    await combinations.onUseWithInventory(player, item(1103), item(1108));
    assert.deepEqual(ids(player), [1105, KNIFE, 1109]);

    const noKnife = fakePlayer({ level: 58, inventory: [1103, 1108] });
    await combinations.onUseWithInventory(noKnife, item(1103), item(1108));
    assert.deepEqual(ids(noKnife), [1109]);

    await withRandom([0.5], () => combinations.onUseWithInventory(player, item(1109), item(1105)));
    assert.deepEqual(ids(player), [KNIFE, 1102]);
    assert.deepEqual(player.xp, [{ skill: 'cooking', experience: 480 }]);
    assert.match(player.messages.join('|'), /delicious ugthanki kebab/);
});

test('the tasty kebab comes out dodgy 1 time in 32, with no experience', async () => {
    const player = fakePlayer({ level: 58, inventory: [1109, 1105, KNIFE] });
    await withRandom([0], () => combinations.onUseWithInventory(player, item(1109), item(1105)));
    assert.deepEqual(ids(player), [KNIFE, 923]);
    assert.deepEqual(player.xp, []);
    assert.match(player.messages.join('|'), /dodgy looking ugthanki kebab/);
});

test('the kebab needs a knife', async () => {
    const player = fakePlayer({ level: 58, inventory: [1109, 1105] });
    await combinations.onUseWithInventory(player, item(1109), item(1105));
    assert.deepEqual(ids(player), [1109, 1105]);
    assert.match(player.messages.join('|'), /need a knife/);
});

test('the Oomlie meat parcel: cooking 50, three messages, 40 experience; then cooked on a fire', async () => {
    const low = fakePlayer({ level: 49, inventory: [1268, 1279] });
    await combinations.onUseWithInventory(low, item(1268), item(1279));
    assert.deepEqual(ids(low), [1268, 1279]);

    const player = fakePlayer({ level: 50, inventory: [1268, 1279] });
    await combinations.onUseWithInventory(player, item(1279), item(1268));
    assert.deepEqual(ids(player), [1280]);
    assert.equal(player.messages.length, 3);
    assert.deepEqual(player.xp, [{ skill: 'cooking', experience: 40 }]);

    const fire = { id: 97, definition: { name: 'Fire' } };
    await cooking.onUseWithGameObject(player, fire, item(1280));
    assert.deepEqual(ids(player), [1269]);
    assert.equal(player.messages[3], 'You prepare to cook the Oomlie meat parcel.');
});

test('stew rows need no knife (InvCooking.handleCombineCooking)', async () => {
    const player = fakePlayer({ level: 25, inventory: [348, 342] });
    await combinations.onUseWithInventory(player, item(348), item(342));
    assert.deepEqual(ids(player), [343]);
});
