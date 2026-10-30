const test = require('node:test');
const assert = require('node:assert/strict');

require('../src/clues');
require('../src/arsc-items');

const agilityPouch = require('../src/plugins/items/agility-pouch');
const agility = require('../src/plugins/skills/agility');

const { completedObstacle, COURSES, progress } = agility.__test;

function fakePlayer({ held = [], slots = 30 } = {}) {
    const items = held.map((id) => ({ id }));

    while (items.length < slots) {
        items.push({ id: 1 });
    }

    const heldSet = new Set(held);

    const player = {
        held: [...held],
        bag: [],
        messages: [],
        xp: [],
        message(...m) {
            player.messages.push(...m);
        },
        addExperience(skill, amount) {
            player.xp.push([skill, amount]);
        },
        inventory: {
            items,
            has: (id) => heldSet.has(id),
            add(id, amount = 1) {
                for (let i = 0; i < amount; i += 1) {
                    heldSet.add(id);
                    player.held.push(id);
                    player.inventory.items.push({ id });
                    player.bag.push([id, 1]);
                }
            },
            remove(id) {
                const index = player.inventory.items.findIndex((entry) => entry.id === id);

                if (index > -1) {
                    player.inventory.items.splice(index, 1);
                }

                heldSet.delete(id);
                const heldIndex = player.held.indexOf(id);

                if (heldIndex > -1) {
                    player.held.splice(heldIndex, 1);
                }
            }
        }
    };

    return player;
}

function withRandom(values, fn) {
    const real = Math.random;
    let index = 0;
    Math.random = () => values[Math.min(index++, values.length - 1)];

    try {
        return fn();
    } finally {
        Math.random = real;
    }
}

test('agility pouches are registered at 1303-1305', () => {
    const items = require('@2003scape/rsc-data/config/items');

    assert.equal(items[1303].name, 'Agility pouch (gnome)');
    assert.equal(items[1305].name, 'Agility pouch (wilderness)');
});

test('openPouch removes the pouch and adds loot', () => {
    const player = fakePlayer({ held: [1303], slots: 1 });

    withRandom([0], () => {
        assert.equal(agilityPouch.openPouch(player, 1303), true);
    });

    assert.ok(!player.held.includes(1303));
    assert.ok(player.bag.length >= 1);
});

test('tryGrantLapPouch respects inventory space', () => {
    const full = fakePlayer({ held: [], slots: 30 });
    assert.equal(agilityPouch.tryGrantLapPouch(full, 'gnome'), false);
    assert.ok(full.messages.some((line) => /too full/i.test(line)));

    const player = fakePlayer({ held: [], slots: 0 });
    assert.equal(agilityPouch.tryGrantLapPouch(player, 'barbarian'), true);
    assert.ok(player.held.includes(agilityPouch.POUCH_BY_COURSE.barbarian));
});

test('completedObstacle grants the course pouch on a lap', () => {
    const player = fakePlayer({ held: [], slots: 0 });
    const course = COURSES.gnome;

    for (const obstacle of course.obstacles) {
        completedObstacle(player, obstacle, 'gnome');
    }

    completedObstacle(player, course.last, 'gnome');

    assert.deepEqual(player.xp, [['agility', course.lap]]);
    assert.ok(player.held.includes(agilityPouch.POUCH_BY_COURSE.gnome));
    assert.equal(progress.get(player).size, 0);
});

test('onInventoryCommand ignores non-pouch items', async () => {
    const player = fakePlayer({ held: [549], slots: 1 });
    assert.equal(await agilityPouch.onInventoryCommand(player, { id: 549 }), false);
});
