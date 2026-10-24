const test = require('node:test');
const assert = require('node:assert');
const {
    spells,
    getMaxHit,
    hasRunes,
    getRunesToRemove,
    getSpellExperience,
    rollSpellDamage
} = require('../src/spell-helpers');

const byName = (name) => spells.find((s) => s.name === name);

function fakeInventory(items, equipped = []) {
    return {
        has: (id, amount = 1) => (items[id] || 0) >= amount,
        isEquipped: (id) => equipped.includes(id)
    };
}

test('max hit table', () => {
    const expected = {
        'Wind strike': 1, 'Water strike': 2, 'Earth strike': 3,
        'Fire strike': 4, 'Wind bolt': 5, 'Fire bolt': 8,
        'Wind blast': 9, 'Fire blast': 12, 'Wind wave': 13, 'Fire wave': 16
    };
    for (const [name, max] of Object.entries(expected)) {
        assert.strictEqual(getMaxHit(byName(name)), max, name);
    }
    assert.strictEqual(getMaxHit(byName('Confuse')), 0);
});

test('rolled damage stays within 0..max', () => {
    const spell = byName('Fire strike');
    assert.strictEqual(rollSpellDamage(spell, () => 0), 0);
    assert.strictEqual(rollSpellDamage(spell, () => 0.999), 4);
});

test('rune check without staff', () => {
    const spell = byName('Wind strike'); // air 33 x1, mind 35 x1
    assert.ok(hasRunes(fakeInventory({ 33: 1, 35: 1 }), spell));
    assert.ok(!hasRunes(fakeInventory({ 33: 1 }), spell));
});

test('staff substitutes for its rune only when equipped', () => {
    const spell = byName('Wind strike');
    const withStaff = fakeInventory({ 101: 1, 35: 1 }, [101]);
    assert.ok(hasRunes(withStaff, spell));
    assert.deepStrictEqual(getRunesToRemove(withStaff, spell), [
        { id: 35, amount: 1 }
    ]);
    assert.ok(!hasRunes(fakeInventory({ 101: 1, 35: 1 }, []), spell));
    // wrong staff does not help
    assert.ok(!hasRunes(fakeInventory({ 102: 1, 35: 1 }, [102]), spell));
});

test('experience formula', () => {
    // (2 * level + 2 * damage) * 4
    assert.strictEqual(getSpellExperience({ level: 1 }, 1), 16);
    assert.strictEqual(getSpellExperience({ level: 13 }, 0), 104);
});
