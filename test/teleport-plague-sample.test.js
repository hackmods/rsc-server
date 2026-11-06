// A teleport spell destroys Biohazard's plague sample (SpellHandler.java handleTeleport), as the spirit trees and the wishing
// fountains already do.

const test = require('node:test');
const assert = require('node:assert/strict');

const { castSelf } = require('../src/packet-handlers/magic');

const VARROCK_TELEPORT = 12;
const SAMPLE = 812;

function setup(items) {
    const messages = [];
    const teleports = [];
    const bag = items.map(([id, amount]) => ({ id, amount }));

    const player = {
        x: 130,
        y: 500,
        world: { members: true, ticks: 0 },
        locked: false,
        opponent: null,
        skills: { magic: { current: 99 } },
        equipmentBonuses: {},
        hasInterfaceOpen: () => false,
        sendSound() {},
        addExperience() {},
        inventory: {
            has: (id) => bag.some((item) => item.id === id),
            count: (id) => bag.filter((item) => item.id === id).reduce((n, item) => n + item.amount, 0),
            isEquipped: () => false,
            remove(id, amount) {
                const i = bag.findIndex((item) => item.id === id);
                if (i >= 0) bag[i].amount -= amount;
                if (i >= 0 && bag[i].amount <= 0) bag.splice(i, 1);
            }
        },
        message: (...lines) => messages.push(...lines),
        teleport: (x, y) => teleports.push([x, y])
    };

    return { player, messages, teleports, bag };
}

test('a teleport spell destroys the plague sample on the way', async () => {
    // law, air and fire runes enough for any teleport
    const runes = [[33, 5], [34, 5], [35, 5], [40, 5], [42, 5], [31, 5], [32, 5], [36, 5], [41, 5], [46, 5]];
    const { player, messages, teleports, bag } = setup([...runes, [SAMPLE, 2]]);

    await castSelf({ player }, { id: VARROCK_TELEPORT });

    assert.equal(teleports.length, 1, messages.join(' | '));
    assert.ok(messages.includes('it disintegrates in the crossing'));
    assert.equal(bag.some((item) => item.id === SAMPLE), false);
    assert.deepEqual(teleports, [[122, 503]]);
});

test('a teleport spell with no sample says nothing about it', async () => {
    const runes = [[33, 5], [34, 5], [35, 5], [40, 5], [42, 5], [31, 5], [32, 5], [36, 5], [41, 5], [46, 5]];
    const { player, messages, teleports } = setup(runes);

    await castSelf({ player }, { id: VARROCK_TELEPORT });

    assert.equal(teleports.length, 1);
    assert.equal(messages.some((line) => /sample/.test(line)), false);
});
