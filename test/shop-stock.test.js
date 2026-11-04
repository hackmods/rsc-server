// Shop stock corrected to the authentic Open-RSC shops (src/data-fixes.json, file "shops"): rsc-data's shops.json picked
// wrong item ids by name (lobsters for lobster pots, leather for feathers, cooked for raw fish, a heap of flour for a pot of
// flour), so lobster pots and feathers were sold nowhere. The sweep re-runs scripts/audit/shops-vs-openrsc.js (Autonomous-
// RSC) against the corrected tables and fails on any new difference.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

require('../src/data-fixes');
const shops = require('@2003scape/rsc-data/shops');
const items = require('@2003scape/rsc-data/config/items');
const { fixes } = require('../src/data-fixes');
const Shop = require('../src/model/shop');

const LOBSTER_POT = 375;
const FEATHER = 381;
const amountIn = (key, id) => {
    const row = shops[key].items.find((i) => i.id === id);
    return row ? row.amount : undefined;
};

test('Gerrant (Port Sarim) and Harry (Catherby) sell lobster pots', () => {
    assert.strictEqual(amountIn('gerrants-fishy-business', LOBSTER_POT), 2);
    assert.strictEqual(amountIn('harrys-fishing-shack', LOBSTER_POT), 2);
    // the rsc-data slot held cooked lobsters (373)
    assert.strictEqual(amountIn('gerrants-fishy-business', 373), undefined);
    assert.strictEqual(amountIn('harrys-fishing-shack', 373), undefined);
});

test('the fishing shops sell feathers for fly fishing, and buy raw fish', () => {
    for (const key of ['gerrants-fishy-business', 'fishing-guild', 'fernaheis-fishing', 'shantay-pass']) {
        assert.strictEqual(amountIn(key, FEATHER), 200, key);
        assert.strictEqual(amountIn(key, 148), undefined, `${key} no longer sells leather`);
    }
    assert.strictEqual(amountIn('gerrants-fishy-business', 351), 0); // raw anchovies, not cooked
    assert.strictEqual(amountIn('gerrants-fishy-business', 349), 0); // raw shrimp: bought, not stocked
});

test('grocers sell pots of flour, herblaw keeps vials of water', () => {
    for (const key of ['wydins-food', 'frenitas-cooking', 'grand-tree-groceries', 'fishing-trawler-general']) {
        assert.ok(amountIn(key, 136) > 0, `${key} sells a pot of flour (136)`);
        assert.strictEqual(amountIn(key, 23), undefined, `${key} no longer sells the flour heap (23)`);
    }
    // deliberate deviation (ACCEPTED in the audit): the bots buy vials of water at the herblaw shops
    assert.strictEqual(amountIn('jatixs-herblaw', 464), 50);
});

test('a Shop built from the corrected table stocks the lobster pot', () => {
    const shop = new Shop({ members: true }, 'gerrants-fishy-business');
    const pot = shop.items.find((i) => i.id === LOBSTER_POT);
    assert.ok(pot, 'lobster pot in the live shop');
    assert.strictEqual(pot.amount, 2);
});

test('every shop fix names a real shop and real items', () => {
    const shopFixes = fixes.filter((f) => f.file === 'shops');
    assert.ok(shopFixes.length >= 20);
    for (const fix of shopFixes) {
        const [key, field] = fix.path.split('.');
        assert.ok(shops[key], `${fix.id}: no shop ${key}`);
        assert.ok(fix.source && /Open-RSC/.test(fix.source), `${fix.id}: needs the Open-RSC source`);
        if (field === 'items') {
            const seen = new Set();
            for (const row of fix.value) {
                assert.ok(items[row.id], `${fix.id}: item ${row.id} does not exist`);
                assert.ok(Number.isInteger(row.amount) && row.amount >= 0, `${fix.id}: amount ${row.amount}`);
                assert.ok(!seen.has(row.id), `${fix.id}: item ${row.id} listed twice`);
                seen.add(row.id);
            }
        }
    }
});

// ---- the sweep: re-run the audit -------------------------------------------------------------------------------------
const AUDIT = path.join(__dirname, '..', '..', '..', 'scripts', 'audit', 'shops-vs-openrsc.js');
const HAVE_AUDIT = fs.existsSync(AUDIT);

// Authentic items (stock > 0) that may stay missing from every shop of ours, each with its reason. Empty: every one is
// sold somewhere once src/data-fixes.json is applied.
const ALLOW_MISSING_EVERYWHERE = {
    // id: 'reason'
};

function report() {
    const audit = require(AUDIT);
    return audit.run({ fork: path.join(__dirname, '..') });
}

test('sweep: no authentic shop item is missing from every shop', { skip: !HAVE_AUDIT && 'scripts/audit not in this tree' }, () => {
    const r = report();
    assert.deepStrictEqual(r.problems, [], 'the Open-RSC shop parse had problems');
    assert.ok(r.summary.authenticShops >= 80, `parsed ${r.summary.authenticShops} authentic shops`);
    const unexpected = r.missingEverywhere.filter((m) => !ALLOW_MISSING_EVERYWHERE[m.id]).map((m) => `${m.id} ${m.name} (${m.shops.join(', ')})`);
    assert.deepStrictEqual(unexpected, [], 'authentic items no shop of ours sells: fix them in src/data-fixes.json or allow them with a reason');
    for (const id of Object.keys(ALLOW_MISSING_EVERYWHERE)) {
        assert.ok(r.missingEverywhere.some((m) => String(m.id) === id), `allowlisted item ${id} is sold now: drop it from the allowlist`);
    }
});

test('sweep: matched shops stock what the authentic shops stock', { skip: !HAVE_AUDIT && 'scripts/audit not in this tree' }, () => {
    const r = report();
    assert.deepStrictEqual(r.unmatched, [], 'authentic shops with no shop of ours');
    const diffs = [];
    for (const e of r.shops) {
        for (const kind of ['missing', 'extra', 'stock']) for (const i of e[kind]) diffs.push(`${e.key} ${kind} ${i.name}(${i.id})`);
        for (const m of e.modifier) diffs.push(`${e.key} ${m.field} ${m.ours} != ${m.authentic}`);
    }
    // restock deltas (12000 vs 12400 ms) are reported by the audit, not asserted
    assert.deepStrictEqual(diffs, [], 'shop stock differs from Open-RSC: fix it in src/data-fixes.json or add it to ACCEPTED in the audit');
});

test('sweep: the committed Open-RSC shop snapshot is fresh', { skip: !HAVE_AUDIT && 'scripts/audit not in this tree' }, (t) => {
    const audit = require(AUDIT);
    let parsed;
    try {
        parsed = audit.parseAuthenticShops();
    } catch (e) {
        t.skip(`full OpenRSC-Core-Framework clone not available (${e.message.split(':')[0]})`);
        return;
    }
    // line endings follow the checkout (core.autocrlf on Windows), the content must not
    const eol = (text) => text.replace(/\r\n/g, '\n');
    assert.strictEqual(eol(fs.readFileSync(audit.SNAPSHOT, 'utf8')), eol(audit.renderSnapshot(parsed)), 'run node scripts/audit/shops-vs-openrsc.js --write-snapshot');
});
