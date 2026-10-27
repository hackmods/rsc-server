// ARSC: emptying the inventory empties the equipment slots too. A shortbow's slot left pointing at a gone item made a
// ranged shot in flight read items[index].id of undefined, and the whole server exited (live scenario, 2026-10-27:
// ::clearinventory during a chicken kill; a death empties the pack the same way).

const test = require('node:test');
const assert = require('node:assert');

const Inventory = require('../src/model/inventory');

const SHORTBOW = 189;
const BRONZE_ARROWS = 11;

function inv() {
    const player = { world: { members: true }, equipmentBonuses: {}, animations: [], sendEquipmentBonuses() {}, message() {} };
    const i = new Inventory(player, [
        { id: SHORTBOW, equipped: true },
        { id: BRONZE_ARROWS, amount: 50 }
    ]);
    i.updateEquipmentSlots();
    return i;
}

test('a wielded shortbow is the ranged weapon, with its arrows', () => {
    const i = inv();
    assert.strictEqual(i.getRangedWeapon().id, SHORTBOW);
    assert.strictEqual(i.getAmmunitionID(false), BRONZE_ARROWS);
});

test('clear() empties the items and every equipment slot', () => {
    const i = inv();
    i.clear();
    assert.strictEqual(i.items.length, 0);
    for (const slot of Object.values(i.equipmentSlots)) assert.strictEqual(slot, -1);
    assert.strictEqual(i.getRangedWeapon(), undefined);
});

test('a stale slot (items emptied behind its back) is no bow and no crash', () => {
    const i = inv();
    i.items.length = 0; // what the old ::clearinventory and death did
    assert.doesNotThrow(() => i.getRangedWeapon());
    assert.strictEqual(i.getRangedWeapon(), undefined);
    assert.doesNotThrow(() => i.getAmmunitionID(false));
});
