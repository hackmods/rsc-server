// Entrana safety deposit box at Port Sarim: same forbidden-item rules as the monk, one stored stash per player.

const test = require('node:test');
const assert = require('node:assert');

const plugins = require('../src/plugins');
const arscLocations = require('../src/arsc-locations');
const Item = require('../src/model/item');
const depositBox = require('../src/plugins/game-objects/entrana-safety-deposit');
const { isForbiddenItem } = require('../src/plugins/npcs/port-sarim/monks-of-entrana');

const COINS_ID = 10;
const BRONZE_SWORD = 70;
const RUNE_BODY = 400;
const CHISEL = 167;

const BOX = { id: 942, x: 266, y: 660 };

function invItem(id, amount = 1) {
    return new Item({ id, amount });
}

function makePlayer({ items = [], choices = [], cache = {} } = {}) {
    const bag = items.map(([id, amount = 1]) => invItem(id, amount));
    const queue = [...choices];
    let saved = 0;

    return {
        cache: { ...cache },
        messages: [],
        menus: [],
        saved,
        inventory: {
            items: bag,
            has(id, amount = 1) {
                return bag.filter((i) => i.id === id).reduce((n, i) => n + i.amount, 0) >= amount;
            },
            add(id, amount = 1) {
                const existing = bag.find((i) => i.id === id);

                if (existing && existing.definition.stackable) {
                    existing.amount += amount;
                    return;
                }

                bag.push(invItem(id, amount));
            },
            remove(id, amount = 1) {
                let left = amount;

                while (left > 0) {
                    const item = bag.find((i) => i.id === id);
                    assert.ok(item, `missing ${id} in inventory`);

                    if (item.definition.stackable && item.amount > left) {
                        item.amount -= left;
                        left = 0;
                    } else {
                        left -= item.amount;
                        bag.splice(bag.indexOf(item), 1);
                    }
                }
            }
        },
        message(text) {
            this.messages.push(text);
        },
        async ask(options) {
            this.menus.push(options);
            return queue.length ? queue.shift() : options.length - 1;
        },
        async save() {
            this.saved += 1;
        }
    };
}

function fillInventory(player, count = 30) {
    while (player.inventory.items.length < count) {
        player.inventory.add(CHISEL);
    }
}

test('listed in plugins/index.js and the chest is placed at Port Sarim', () => {
    assert.ok(Object.values(plugins).includes(depositBox));
    assert.ok(
        arscLocations.gameObjects.some(
            (o) => o.id === BOX.id && o.x === BOX.x && o.y === BOX.y
        )
    );
});

test('deposit refuses when inventory has no forbidden items', async () => {
    const player = makePlayer({ items: [[COINS_ID, 5]], choices: [0] });

    assert.strictEqual(await depositBox.onGameObjectCommandOne(player, BOX), true);
    assert.ok(!player.cache.entranaDeposit);
    assert.ok(
        player.messages.some((m) => m.includes('not carrying any weapons or armour'))
    );
});

test('deposit stores forbidden items and clears them from inventory', async () => {
    const player = makePlayer({
        items: [[COINS_ID, 3], [BRONZE_SWORD], [RUNE_BODY]],
        choices: [0]
    });

    assert.ok(isForbiddenItem(player.inventory.items.find((i) => i.id === BRONZE_SWORD)));

    assert.strictEqual(await depositBox.onGameObjectCommandOne(player, BOX), true);
    assert.deepStrictEqual(player.cache.entranaDeposit.items, [
        { id: BRONZE_SWORD, amount: 1 },
        { id: RUNE_BODY, amount: 1 }
    ]);
    assert.ok(player.inventory.has(COINS_ID, 3));
    assert.ok(!player.inventory.has(BRONZE_SWORD));
    assert.ok(!player.inventory.has(RUNE_BODY));
    assert.strictEqual(player.saved, 1);
});

test('a second deposit refuses while items remain stored', async () => {
    const player = makePlayer({
        items: [[BRONZE_SWORD]],
        cache: { entranaDeposit: { items: [{ id: RUNE_BODY, amount: 1 }] } },
        choices: [0]
    });

    assert.strictEqual(await depositBox.onGameObjectCommandOne(player, BOX), true);
    assert.ok(player.inventory.has(BRONZE_SWORD));
    assert.deepStrictEqual(player.cache.entranaDeposit.items, [
        { id: RUNE_BODY, amount: 1 }
    ]);
    assert.ok(
        player.messages.some((m) => m.includes('already have items stored'))
    );
});

test('withdraw restores stored items and clears the cache', async () => {
    const player = makePlayer({
        items: [[COINS_ID, 2]],
        cache: {
            entranaDeposit: {
                items: [
                    { id: BRONZE_SWORD, amount: 1 },
                    { id: RUNE_BODY, amount: 1 }
                ]
            }
        },
        choices: [1]
    });

    assert.strictEqual(await depositBox.onGameObjectCommandOne(player, BOX), true);
    assert.ok(player.inventory.has(BRONZE_SWORD));
    assert.ok(player.inventory.has(RUNE_BODY));
    assert.ok(!player.cache.entranaDeposit);
    assert.strictEqual(player.saved, 1);
});

test('withdraw refuses without clearing when inventory has no room', async () => {
    const player = makePlayer({
        cache: {
            entranaDeposit: {
                items: [
                    { id: BRONZE_SWORD, amount: 1 },
                    { id: RUNE_BODY, amount: 1 }
                ]
            }
        },
        choices: [1]
    });

    fillInventory(player, 30);

    assert.strictEqual(await depositBox.onGameObjectCommandOne(player, BOX), true);
    assert.deepStrictEqual(player.cache.entranaDeposit.items, [
        { id: BRONZE_SWORD, amount: 1 },
        { id: RUNE_BODY, amount: 1 }
    ]);
    assert.ok(!player.inventory.has(BRONZE_SWORD));
    assert.strictEqual(player.inventory.items.length, 30);
    assert.strictEqual(
        player.messages.at(-1),
        '@que@You do not have enough inventory space to withdraw your items'
    );
});

test('ignores bank chests outside the Port Sarim deposit area', async () => {
    const player = makePlayer();
    const elsewhere = { id: 942, x: 58, y: 731 };

    assert.strictEqual(await depositBox.onGameObjectCommandOne(player, elsewhere), false);
});
