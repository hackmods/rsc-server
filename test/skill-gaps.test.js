// ARSC skill gaps from the 2026-10-28 server-gap audit: scenery rocks say they are empty, and a dragonstone amulet strings
// into the unenchanted one that Enchant upgrades. (Pickpocket marks by npc name: test/thieving-plugin.test.js.)
const test = require('node:test');
const assert = require('node:assert/strict');

const items = require('@2003scape/rsc-data/config/items.json');
const objects = require('@2003scape/rsc-data/config/objects.json');
const mining = require('../src/plugins/skills/mining');

const rock = (id) => ({ id, definition: objects[id] });

function player() {
    const p = { messages: [], skills: { mining: { current: 99 } }, message: (...m) => p.messages.push(...m), inventory: { has: () => true } };
    return p;
}

test('scenery rocks (99, 164, 547) say there is no ore instead of doing nothing', async () => {
    for (const id of [99, 164, 547]) {
        const p = player();
        assert.equal(await mining.onGameObjectCommandOne(p, rock(id)), true, `rock ${id} was not claimed`);
        assert.match(p.messages.join(' '), /no ore available/, `rock ${id}`);
    }
});

test('quest rocks (Daconia 699, Dalgroth 1026) are left to their quests', async () => {
    for (const id of [699, 1026]) assert.equal(await mining.onGameObjectCommandOne(player(), rock(id)), false, `rock ${id} was claimed`);
});

test('stringing a dragonstone amulet gives the unenchanted one', () => {
    require('../src/data-fixes');
    const { stringing } = require('@2003scape/rsc-data/skills/crafting');
    assert.equal(items[stringing[524]].name, 'Unenchanted Dragonstone Amulet');
    assert.equal(items[stringing[299]].name, 'Ruby Amulet'); // the others are untouched
});
