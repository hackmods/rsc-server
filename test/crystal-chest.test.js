// The crystal chest (Open-RSC CrystalChest.java) and the crystal key join (InvUseOnItem.java): the halves join, the key
// opens the Taverley chest once, and every roll gives the uncut dragonstone plus the Java table's row.

const test = require('node:test');
const assert = require('node:assert/strict');

const plugins = require('../src/plugins');
const chest = require('../src/plugins/game-objects/crystal-chest');
const items = require('@2003scape/rsc-data/config/items');
const objects = require('@2003scape/rsc-data/config/objects');
const objectSpawns = require('@2003scape/rsc-data/locations/objects');

const KEY = 525;
const TOOTH = 526;
const LOOP = 527;
const DRAGONSTONE = 542;

function makePlayer(bagIds = []) {
    const bag = bagIds.map((id) => ({ id, amount: 1 }));
    const replaced = [];

    return {
        messages: [],
        replaced,
        world: {
            replaceTimed(type, entity, id, ticks) {
                replaced.push({ type, from: entity.id, id, ticks });
            }
        },
        inventory: {
            items: bag,
            has(id, amount = 1) {
                return bag.filter((i) => i.id === id).reduce((n, i) => n + i.amount, 0) >= amount;
            },
            count(id) {
                return bag.filter((i) => i.id === id).reduce((n, i) => n + i.amount, 0);
            },
            add(id, amount = 1) {
                const stack = items[id].stackable && bag.find((i) => i.id === id);
                if (stack) stack.amount += amount;
                else if (items[id].stackable) bag.push({ id, amount });
                else for (let i = 0; i < amount; i += 1) bag.push({ id, amount: 1 });
            },
            remove(id) {
                const i = bag.findIndex((item) => item.id === id);
                if (i > -1) bag.splice(i, 1);
            }
        },
        message(...lines) {
            this.messages.push(...lines);
        }
    };
}

test('listed in plugins/index.js; chest 248 is placed in Taverley and 247 is its open twin', () => {
    assert.ok(Object.values(plugins).includes(chest));
    assert.ok(objectSpawns.some((o) => o.id === 248 && o.x === 367 && o.y === 497));
    assert.equal(objects[247].name, 'Chest');
});

test('the two halves join into a crystal key, either way round', async () => {
    const player = makePlayer([TOOTH, LOOP]);

    assert.equal(await chest.onUseWithInventory(player, { id: LOOP }, { id: TOOTH }), true);
    assert.deepEqual(player.inventory.items.map((i) => i.id), [KEY]);
    assert.deepEqual(player.messages, ['You join the two halves of the key together']);

    const other = makePlayer([TOOTH, 10]);
    assert.equal(await chest.onUseWithInventory(other, { id: TOOTH }, { id: 10 }), false, 'a half on something else');
});

test('the chest is locked without a key, and other items on it are not claimed', async () => {
    const player = makePlayer();

    assert.equal(await chest.onGameObjectCommandOne(player, { id: 248 }), true);
    assert.deepEqual(player.messages, ['the chest is locked']);
    assert.equal(await chest.onGameObjectCommandOne(player, { id: 249 }), false);
    assert.equal(await chest.onUseWithGameObject(player, { id: 248 }, { id: TOOTH }), false);
});

test('the key opens the chest: key used up, chest open for 2 ticks, uncut dragonstone and a roll', async () => {
    const player = makePlayer([KEY]);

    assert.equal(await chest.onUseWithGameObject(player, { id: 248 }, { id: KEY }), true);
    assert.ok(!player.inventory.has(KEY));
    assert.deepEqual(player.replaced, [{ type: 'gameObjects', from: 248, id: 247, ticks: 2 }]);
    assert.deepEqual(player.messages, ['you unlock the chest with your key', 'You find some treasure in the chest']);
    assert.ok(player.inventory.has(DRAGONSTONE));
});

test('the Java table row by row (DataConversions.random(0, 10000))', () => {
    assert.equal(chest.ROLL_SIZE, 10001);
    assert.deepEqual(chest.rollLoot(0), [[DRAGONSTONE, 1], [402, 1]]);
    assert.deepEqual(chest.rollLoot(25), [[DRAGONSTONE, 1], [402, 1]]);
    assert.deepEqual(chest.rollLoot(26), [[DRAGONSTONE, 1], [127, 1]]);
    assert.deepEqual(chest.rollLoot(500), [[DRAGONSTONE, 1], [TOOTH, 1], [10, 750]]);
    assert.deepEqual(chest.rollLoot(1100), [[DRAGONSTONE, 1], [LOOP, 1], [10, 750]]);
    assert.equal(chest.rollLoot(3000).length, 12, 'the rune pack: 11 kinds');
    assert.deepEqual(chest.rollLoot(4000), [[DRAGONSTONE, 1], [536, 1], [10, 1000]]);
    assert.deepEqual(chest.rollLoot(8327), [[DRAGONSTONE, 1], [179, 1], [10, 2000]]);
    assert.deepEqual(chest.rollLoot(8328), [[DRAGONSTONE, 1]], 'the top 1673 rolls give only the dragonstone');
    assert.deepEqual(chest.rollLoot(10000), [[DRAGONSTONE, 1]]);

    for (const [, loot] of chest.TABLE) {
        for (const [id] of loot) assert.ok(items[id], `item ${id} exists`);
    }
});

test('non-stackable multiples arrive one per slot (2 rubies, 2 diamonds, 3 runite bars)', async () => {
    const player = makePlayer();

    for (const [id, amount] of chest.rollLoot(1500)) player.inventory.add(id, amount);
    assert.equal(player.inventory.count(162), 2);
    assert.equal(player.inventory.items.filter((i) => i.id === 162).length, 2);
});
