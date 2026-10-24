// Core fixes found by the server gap audit: stat prayers next to non-stat prayers (combat.js), the region x bound
// (entity.js) and the beer stat drain floor (items/quaffable.js).

const test = require('node:test');
const assert = require('node:assert/strict');

const { getPrayerBonuses } = require('../src/combat');
const Entity = require('../src/model/entity');
const quaffable = require('../src/plugins/items/quaffable');

const RAPID_RESTORE = 6;
const ULTIMATE_STRENGTH = 10;

test('a stat prayer still counts when an earlier non-stat prayer is on', () => {
    const prayers = new Array(14).fill(false);
    prayers[RAPID_RESTORE] = true;
    prayers[ULTIMATE_STRENGTH] = true;

    assert.equal(getPrayerBonuses({ prayers }).strength, 1.15);
});

test('withinRegion checks x against maxX', () => {
    const entity = new Entity({ planeElevation: 944 });

    // lumbridge is x 100-180: x 600 used to pass because it was compared with maxY (670)
    Object.assign(entity, { x: 600, y: 650 });
    assert.equal(entity.withinRegion('lumbridge'), false);

    Object.assign(entity, { x: 120, y: 650 });
    assert.equal(entity.withinRegion('lumbridge'), true);
});

test('dwarven stout lowers combat stats by 2, not to 0', async () => {
    const skills = {};
    for (const name of ['attack', 'strength', 'defense', 'mining', 'smithing', 'hits']) {
        skills[name] = { current: 30, base: 30 };
    }
    const player = {
        world: { async sleepTicks() {} },
        skills,
        inventory: { add() {}, remove() {} },
        sendBubble() {},
        sendStats() {},
        message() {}
    };

    assert.equal(await quaffable.onInventoryCommand(player, { id: 269 }), true);
    assert.equal(skills.attack.current, 28);
    assert.equal(skills.defense.current, 28);
});
