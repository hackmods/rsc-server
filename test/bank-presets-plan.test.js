'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { planPreset } = require('../src/bank-presets-plan');

const items = [{ stackable: true }, { stackable: false }, { stackable: true },
    { stackable: false }, { stackable: false }];
function plan(overrides = {}) {
    return planPreset({ inventory: [], bank: [], preset: [], items, bankCapacity: 192, ...overrides });
}
function totals(...lists) {
    const result = {};
    for (const row of lists.flat()) result[row.id] = (result[row.id] || 0) + (row.amount || 1);
    return result;
}

test('an atomic bank-full swap succeeds and retains inventory order and worn state', () => {
    const input = { inventory: [{ id: 1, equipped: true }], bank: [{ id: 3 }],
        preset: [{ id: 3, equipped: true }], bankCapacity: 1 };
    const before = JSON.stringify(input);
    assert.deepEqual(plan(input), { inventory: [{ id: 3, amount: 1, equipped: true }],
        bank: [{ id: 1, amount: 1 }] });
    assert.equal(JSON.stringify(input), before);
});

test('existing bank order precedes deterministic new leftovers; repeated nonstackables use slots', () => {
    assert.deepEqual(plan({ inventory: [{ id: 1 }, { id: 1 }, { id: 0, amount: 100 }],
        bank: [{ id: 2, amount: 10 }, { id: 3, amount: 3 }],
        preset: [{ id: 1 }, { id: 0, amount: 90, equipped: true }] }), {
        inventory: [{ id: 1, amount: 1, equipped: false }, { id: 0, amount: 90, equipped: true }],
        bank: [{ id: 2, amount: 10 }, { id: 3, amount: 3 }, { id: 1, amount: 1 }, { id: 0, amount: 10 }]
    });
});

test('empty presets deposit everything and empty holdings are valid', () => {
    assert.deepEqual(plan(), { inventory: [], bank: [] });
    assert.deepEqual(plan({ inventory: [{ id: 1 }, { id: 1 }] }).bank, [{ id: 1, amount: 2 }]);
});

test('missing items and both slot capacity limits fail before mutation', () => {
    for (const input of [
        { preset: [{ id: 1 }] },
        { bank: [{ id: 0, amount: 2 }], preset: [{ id: 0, amount: 3 }] },
        { inventory: [{ id: 1 }], bank: [{ id: 3 }], bankCapacity: 1 },
        { bank: [{ id: 1, amount: 2 }], preset: [{ id: 1 }, { id: 1 }], capacity: 1 }
    ]) {
        const before = JSON.stringify(input);
        assert.throws(() => plan(input));
        assert.equal(JSON.stringify(input), before);
    }
});

test('rejects malformed ids, amounts, flags, duplicates and inherited item definitions', () => {
    for (const id of [-1, 1.5, NaN, Infinity, '0', '__proto__', 'constructor', 99]) {
        assert.throws(() => plan({ preset: [{ id }] }));
    }
    for (const amount of [0, -1, 0.5, NaN, Infinity, '1', 2147483648, Number.MAX_SAFE_INTEGER]) {
        assert.throws(() => plan({ inventory: [{ id: 0, amount }] }));
    }
    for (const input of [
        { inventory: [{ id: 1, amount: 2 }] },
        { preset: [{ id: 1, amount: 2 }] },
        { bank: [{ id: 1 }, { id: 1 }] },
        { inventory: [{ id: 0 }, { id: 0 }] },
        { preset: [{ id: 0 }, { id: 0 }] },
        { inventory: [{ id: 0, equipped: 1 }] },
        { bank: [{ id: 0, equipped: true }] },
        { inventory: [Object.create({ id: 0 })] },
        { inventory: [{ id: 0 }], items: Object.create({ 0: { stackable: true } }) },
        { capacity: -1 }, { bankCapacity: undefined }, { bank: null }, { preset: Array(1) }
    ]) assert.throws(() => plan(input));
});

test('combined stock may exceed a stack cap only when valid final rows split ownership', () => {
    const max = 2147483647;
    const input = { inventory: [{ id: 0, amount: max }], bank: [{ id: 0, amount: max }] };
    assert.throws(() => plan(input), /overflow/);
    const result = plan({ ...input, preset: [{ id: 0, amount: max }] });
    assert.equal(result.bank[0].amount, max);
    assert.deepEqual(totals(result.inventory, result.bank), totals(input.inventory, input.bank));
});

test('deterministic generated transfers conserve every item and never mutate inputs', () => {
    let seed = 9367;
    const random = max => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % max; };
    for (let iteration = 0; iteration < 200; iteration++) {
        const inventory = [{ id: 0, amount: random(10000) + 1 }];
        for (let i = random(10); i > 0; i--) inventory.push({ id: i % 2 ? 1 : 3 });
        const bank = [{ id: 0, amount: random(10000) + 1 }, { id: 1, amount: random(10) + 1 },
            { id: 2, amount: random(10000) + 1 }, { id: 3, amount: random(10) + 1 }];
        const owned = totals(inventory, bank);
        const preset = [{ id: 0, amount: random(owned[0]) + 1 },
            { id: 2, amount: random(owned[2]) + 1 }];
        for (const id of [1, 3]) {
            for (let n = random(owned[id] + 1); n > 0; n--) preset.push({ id });
        }
        const before = JSON.stringify({ inventory, bank, preset });
        const output = plan({ inventory, bank, preset });
        assert.deepEqual(totals(output.inventory, output.bank), owned);
        assert.equal(JSON.stringify({ inventory, bank, preset }), before);
        assert.ok(output.inventory.length <= 30);
        assert.ok(output.bank.length <= 192);
    }
});
