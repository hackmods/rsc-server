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

// Drinkables.java handleDwarvenStout: substat 5% of the current level from attack, defense and strength (not to 0),
// +1 mining and smithing
test('dwarven stout lowers combat stats by 5%, not to 0', async () => {
    const skills = {};
    for (const name of ['attack', 'strength', 'defense', 'mining', 'smithing', 'hits']) {
        skills[name] = { current: 40, base: 40 };
    }
    const added = [];
    const player = {
        world: { async sleepTicks() {} },
        skills,
        inventory: { add: (id) => added.push(id), remove() {}, has: () => true },
        changeStat(skill, delta) {
            skills[skill].current = Math.max(0, skills[skill].current + delta);
        },
        damage() {},
        sendBubble() {},
        message() {}
    };

    assert.equal(await quaffable.onInventoryCommand(player, { id: 269, definition: { command: 'drink', name: 'Dwarven Stout' } }), true);
    assert.equal(skills.attack.current, 38);
    assert.equal(skills.defense.current, 38);
    assert.equal(skills.mining.current, 41);
    assert.equal(skills.smithing.current, 41);
    assert.deepEqual(added, [620]); // the beer glass
});
