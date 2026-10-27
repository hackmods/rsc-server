// The Open-RSC drop port (scripts/port-npc-drops.js -> src/arsc-drops.json) merged over rsc-data by src/drop-table.js.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

const items = require('@2003scape/rsc-data/config/items');
const npcs = require('@2003scape/rsc-data/config/npcs');
const base = require('@2003scape/rsc-data/rolls/drops');
const arsc = require('../src/arsc-drops.json');
const merged = require('../src/drop-table');
const generator = require('../scripts/port-npc-drops');
const { rollItemDrop } = require('../src/rolls');

const ids = (name) =>
    npcs.map((d, i) => (d && d.name.toLowerCase() === name.toLowerCase() ? i : -1)).filter((i) => i >= 0);

// every item a table (and its sub-tables) can give
function items_of(table, seen = new Set()) {
    const out = [];
    for (const e of table) {
        if (e.reference !== undefined) {
            if (!seen.has(e.reference)) {
                seen.add(e.reference);
                out.push(...items_of(merged[e.reference], seen));
            }
        } else {
            out.push(...[].concat(e.id));
        }
    }
    return out;
}

function seeded(seed) {
    let s = seed;
    return () => {
        s = (s * 1664525 + 1013904223) % 4294967296;
        return s / 4294967296;
    };
}

test('arsc-drops.json is fresh', (t) => {
    let result;
    try {
        result = generator.generate();
    } catch (e) {
        if (/not found/.test(e.message)) {
            t.skip('OpenRSC-Core-Framework source not available');
            return;
        }
        throw e;
    }
    assert.strictEqual(
        fs.readFileSync(generator.OUT, 'utf8'),
        generator.render(result)
    );
});

test('every ported NPC gets the ARSC table, rsc-data is kept elsewhere', () => {
    const portedIds = Object.keys(arsc.drops).filter((k) => !isNaN(k));
    assert.ok(portedIds.length >= 100);
    for (const id of portedIds) {
        assert.deepStrictEqual(merged[id], arsc.drops[id]);
        assert.ok(npcs[id], `npc ${id} exists`);
    }
    for (const id of Object.keys(base).filter((k) => !isNaN(k))) {
        if (!arsc.drops[id]) {
            assert.deepStrictEqual(merged[id], base[id]);
        }
    }
    assert.ok(merged.herb.length > 0);
});

test('chaos druid can drop a herb', () => {
    const [id] = ids('Chaos Druid');
    assert.ok(merged[id].some((e) => e.reference === 'herb'));
    const rolls = seeded(1);
    const orig = Math.random;
    Math.random = rolls;
    try {
        const herbs = new Set(merged.herb.map((e) => e.id));
        let got = 0;
        for (let i = 0; i < 3000; i += 1) {
            if (rollItemDrop(merged, id).some((d) => herbs.has(d.id))) got += 1;
        }
        assert.ok(got > 500, `herb drops: ${got}`);
    } finally {
        Math.random = orig;
    }
});

test('black demon has coins and rare entries', () => {
    const [id] = ids('Black Demon');
    const all = items_of(merged[id]);
    assert.ok(all.includes(10), 'coins');
    assert.ok(merged[id].some((e) => e.reference === 'herb' || e.reference === 'rare'));
    assert.ok(merged[id].some((e) => e.id === 181), 'ashes');
});

test('tables exist where rsc-data had none', () => {
    const spider = ids('Giant spider');
    const wolf = ids('Grey wolf');
    // Java defines no Giant spider / Ghost drops and marks them boneless: they stay empty, as in Open-RSC
    assert.ok(spider.length > 0);
    const [bk] = ids('Black Knight');
    assert.ok(merged[bk].length > 5);
    assert.ok(wolf.every((i) => merged[i] && merged[i].length >= 1));
    const [chronozon] = ids('Chronozon');
    assert.deepStrictEqual(merged[chronozon], [{ id: 181, weight: 0 }]);
});

test('all item ids and references resolve', () => {
    for (const [key, table] of Object.entries(arsc.drops)) {
        for (const e of table) {
            if (e.reference !== undefined) {
                assert.ok(merged[e.reference], `${key} -> ${e.reference}`);
            } else {
                assert.ok(items[e.id], `${key}: item ${e.id}`);
            }
            if (isNaN(key)) {
                continue;
            }
        }
        const total = table.reduce((s, e) => s + (e.weight || 0), 0);
        assert.ok(total <= 128, `${key} total ${total}`);
    }
});

test('5000 seeded rolls: valid items, weights roughly match', () => {
    const [id] = ids('Hobgoblin');
    const table = merged[id];
    const orig = Math.random;
    Math.random = seeded(42);
    const counts = new Map();
    try {
        for (let i = 0; i < 5000; i += 1) {
            for (const d of rollItemDrop(merged, id)) {
                assert.ok(d.id !== undefined && items[d.id], 'defined item');
                assert.ok(d.amount >= 1);
                counts.set(d.id, (counts.get(d.id) || 0) + 1);
            }
        }
    } finally {
        Math.random = orig;
    }
    // the first plain-item entry with the largest direct weight
    const top = table
        .filter((e) => e.id !== undefined && e.weight > 0)
        .sort((a, b) => b.weight - a.weight)[0];
    const sameId = table
        .filter((e) => e.id === top.id)
        .reduce((s, e) => s + e.weight, 0);
    const expected = (sameId / 129) * 5000;
    const got = counts.get(top.id) || 0;
    assert.ok(
        Math.abs(got - expected) < expected * 0.2 + 30,
        `item ${top.id}: got ${got}, expected ~${Math.round(expected)}`
    );
    assert.strictEqual(counts.get(20), 5000, 'bones always');
});
