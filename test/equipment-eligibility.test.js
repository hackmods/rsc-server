const test = require('node:test');
const assert = require('node:assert/strict');
const { equipmentRefusal, validateEquipmentSet, getEquipmentAnimationIndex } = require('../src/equipment-eligibility');
const Inventory = require('../src/model/inventory');
const Item = require('../src/model/item');
const definitions = require('@2003scape/rsc-data/config/items');
const wieldable = require('@2003scape/rsc-data/wieldable');
function player(level = 99, male = true) {
    const sent = [], messages = [];
    return {
        world: { members: true }, skills: Object.fromEntries(['attack', 'defense', 'strength', 'ranged', 'magic', 'prayer'].map(name => [name, { base: level, current: 99 }])),
        isMale: () => male, appearance: { headSprite: 1, bodySprite: male ? 2 : 5 },
        animations: [1, male ? 2 : 5, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0], equipmentBonuses: {},
        send: message => sent.push(message), message: (...text) => messages.push(text),
        sendEquipmentBonuses() {}, broadcastPlayerAppearance() {}, sent, messages
    };
}
const row = id => ({ id, amount: 1, equipped: true });
test('skill checks use base level, preserve messages, and accept exact boundary', () => {
    const p = player(39); const item = new Item({ id: 401 });
    assert.deepEqual(equipmentRefusal(p, item), ['You are not a high enough level to use this item', 'You need to have a Defence level of 40']);
    p.skills.defense.base = 40; assert.equal(equipmentRefusal(p, item), null);
    assert.equal(p.messages.length, 0); assert.equal(p.sent.length, 0);
});
test('female-only equipment retains gender refusal and requirement precedence', () => {
    const p = player(); const item = new Item({ id: 407 });
    assert.deepEqual(equipmentRefusal(p, item), ["It doesn't fit!", 'Perhaps I should get someone to adjust it for me']);
    assert.equal(equipmentRefusal(player(99, false), item), null);
    p.skills.defense.base = 39; assert.match(equipmentRefusal(p, item)[0], /high enough level/);
});
test('Inventory.equip preserves original error strings, refusal messages and no state changes', () => {
    const p = player(39); const inv = new Inventory(p, [{ id: 401 }, { id: 10 }, { id: 407 }]);
    const before = JSON.stringify(inv.items); const animations = [...p.animations];
    assert.throws(() => inv.equip(10), { name: 'RangeError', message: 'invalid item index 10' });
    assert.throws(() => inv.equip(1), { name: 'RangeError', message: 'equipping unequipable item index 1' });
    inv.equip(0);
    assert.deepEqual(p.messages[0], ['You are not a high enough level to use this item', 'You need to have a Defence level of 40']);
    p.skills.defense.base = 40; inv.equip(2);
    assert.deepEqual(p.messages[1], ["It doesn't fit!", 'Perhaps I should get someone to adjust it for me']);
    assert.equal(JSON.stringify(inv.items), before); assert.deepEqual(p.animations, animations);
    assert.equal(p.sent.length, 0); assert.ok(Object.values(inv.equipmentSlots).every(index => index === -1));
    inv.equip(0); assert.equal(inv.items[0].equipped, true);
    assert.equal(inv.equipmentSlots.body, 0); assert.equal(p.animations[1], wieldable[401].animation);
});
test('equipment sets reject duplicate slots including both hands of two-handed gear', () => {
    const p = player();
    assert.throws(() => validateEquipmentSet(p, [row(76), row(0)]), /conflicting equipment slot: right-hand/);
    assert.throws(() => validateEquipmentSet(p, [row(76), row(4)]), /conflicting equipment slot: left-hand/);
    assert.throws(() => validateEquipmentSet(p, [row(0), row(0)]), /conflicting equipment slot/);
    assert.equal(validateEquipmentSet(p, [row(0), row(4), row(401), row(402)]), null);
});
test('pure validation rejects invalid definitions, unknown slots and invalid animations', () => {
    const p = player();
    assert.throws(() => equipmentRefusal(p, { definition: {} }), RangeError);
    assert.throws(() => validateEquipmentSet(p, [row(999999)]), /invalid item id/);
    assert.throws(() => validateEquipmentSet(p, [row(10)]), /unequipable/);
    const originalEquip = definitions[0].equip;
    const originalAnimation = wieldable[0].animation;
    try {
        definitions[0].equip = ['nonsense'];
        assert.throws(() => validateEquipmentSet(p, [row(0)]), /invalid equipment slots/);
        definitions[0].equip = originalEquip; wieldable[0].animation = NaN;
        assert.throws(() => validateEquipmentSet(p, [row(0)]), /invalid equipment animation/);
    } finally { definitions[0].equip = originalEquip; wieldable[0].animation = originalAnimation; }
    assert.throws(() => getEquipmentAnimationIndex(['nonsense']), /unable to find animation index/);
});
test('preflight does not mutate input, player, or shared definitions and validates equipped rows only', () => {
    const p = player(); const rows = [row(0), { id: 10, amount: 4, equipped: false }];
    const before = JSON.stringify(rows), animations = [...p.animations];
    const had = Object.hasOwn(definitions[0], 'wieldable'); const previous = definitions[0].wieldable;
    delete definitions[0].wieldable;
    try {
        assert.equal(validateEquipmentSet(p, rows), null);
        assert.equal(Object.hasOwn(definitions[0], 'wieldable'), false);
    } finally { if (had) definitions[0].wieldable = previous; }
    assert.equal(JSON.stringify(rows), before); assert.deepEqual(p.animations, animations);
    assert.equal(p.sent.length, 0); assert.equal(p.messages.length, 0);
});
