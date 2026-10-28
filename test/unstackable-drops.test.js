// ARSC: a drop of "3 iron bars" was one ground item with amount 3; non-stackable items drop one by one.
const test = require('node:test');
const assert = require('node:assert');

const items = require('@2003scape/rsc-data/config/items');
const merged = require('../src/drop-table');
const { pushDrop, rollItemDrop } = require('../src/rolls');

const IRON_BAR = items.findIndex((i) => i && i.name === 'iron bar');
const COINS = 10;

test('a non-stackable amount drops that many single items', () => {
    const out = [];
    pushDrop(out, IRON_BAR, 3);
    assert.deepStrictEqual(out, [
        { id: IRON_BAR, amount: 1 },
        { id: IRON_BAR, amount: 1 },
        { id: IRON_BAR, amount: 1 }
    ]);
});

test('a stackable amount stays one stack', () => {
    const out = [];
    pushDrop(out, COINS, 30);
    assert.deepStrictEqual(out, [{ id: COINS, amount: 30 }]);
});

test('no rolled drop is a non-stackable item with an amount over 1 (every table)', () => {
    const originalRandom = Math.random;
    try {
        for (const key of Object.keys(merged)) {
            for (const roll of [0, 0.3, 0.6, 0.99]) {
                Math.random = () => roll;
                for (const d of rollItemDrop(merged, key)) {
                    assert.ok(
                        d.amount === 1 || items[d.id].stackable,
                        `${key} dropped ${d.amount} x ${items[d.id].name}`
                    );
                }
            }
        }
    } finally {
        Math.random = originalRandom;
    }
});

test('a table entry with several non-stackable items still gives them all', () => {
    const table = { x: [{ id: IRON_BAR, amount: 2, weight: 0 }] };
    assert.strictEqual(rollItemDrop(table, 'x').length, 2);
});
