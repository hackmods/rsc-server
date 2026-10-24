// castNPC must offer the cast to onCastOnNPC plugins (Tutorial Island's
// chicken lesson) after the rune check and before any rune is used.

const test = require('node:test');
const assert = require('node:assert/strict');

const { castNPC } = require('../src/packet-handlers/magic');

const WIND_STRIKE = 0;

function setup(pluginResult) {
    const calls = [];
    const removed = [];

    const npc = {
        index: 7,
        id: 3,
        x: 220,
        y: 756,
        locked: false,
        definition: { name: 'Chicken', hostility: 'retreats' },
        skills: { hits: { current: 3, base: 3 } }
    };

    const world = {
        members: true,
        npcs: { getByIndex: (index) => (index === npc.index ? npc : null) },
        async callPlugin(name, ...args) {
            calls.push([name, ...args]);
            return pluginResult;
        },
        sleepTicks: async () => {}
    };

    const player = {
        world,
        locked: false,
        // already fighting it: castNPC skips the walk-in
        opponent: npc,
        skills: { magic: { current: 1 } },
        equipmentBonuses: {},
        hasInterfaceOpen: () => false,
        inventory: {
            has: () => true,
            isEquipped: () => false,
            remove(id, amount) {
                removed.push([id, amount]);
            }
        },
        message() {}
    };

    return { player, npc, calls, removed };
}

test('castNPC offers the cast to onCastOnNPC with the spell and its index', async () => {
    const { player, npc, calls, removed } = setup(true);

    await castNPC({ player }, { index: npc.index, id: WIND_STRIKE });

    const hook = calls.find(([name]) => name === 'onCastOnNPC');
    assert.ok(hook, 'onCastOnNPC was never called');

    const [, hookPlayer, hookNpc, spell, spellIndex] = hook;
    assert.equal(hookPlayer, player);
    assert.equal(hookNpc, npc);
    assert.equal(spellIndex, WIND_STRIKE);
    assert.ok(Array.isArray(spell.runes), 'spell is the spells.json entry');

    assert.deepEqual(removed, [], 'a plugin that takes over the cast costs no runes');
});
