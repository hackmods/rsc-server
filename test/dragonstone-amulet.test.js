// The amulet of glory (items/dragonstone-amulet.js, Open-RSC misc/DragonstoneAmulet.java), driven by a fake player
// with a real Item list.

const test = require('node:test');
const assert = require('node:assert/strict');

const items = require('@2003scape/rsc-data/config/items.json');
const objects = require('@2003scape/rsc-data/config/objects.json');
const Item = require('../src/model/item');
const amulet = require('../src/plugins/items/dragonstone-amulet');

const FOUNTAIN = { id: 282, x: 381, y: 439 };

function fakePlayer({ bag = [], at = [120, 650], answer = 0, cache = {} } = {}) {
    const log = { messages: [], teleports: [], updates: [], bonuses: 0 };
    const player = {
        x: at[0],
        y: at[1],
        cache,
        world: { sleepTicks: async () => {} },
        message: (...m) => log.messages.push(...m),
        ask: async () => answer,
        teleport: (x, y, bubble) => log.teleports.push([x, y, bubble]),
        inventory: {
            items: bag.map((b) => new Item(typeof b === 'number' ? { id: b } : b)),
            add(id) {
                this.items.push(new Item({ id }));
            },
            has(id) {
                return this.items.some((i) => i.id === id);
            },
            remove(id) {
                const i = this.items.map((x) => x.id).lastIndexOf(id);
                if (i >= 0) this.items.splice(i, 1);
            },
            sendUpdate: (index, item) => log.updates.push([index, item.id]),
            updateEquipmentBonuses: () => {
                log.bonuses += 1;
            }
        }
    };
    const ids = () => player.inventory.items.map((i) => i.id);
    return { player, log, ids };
}

test('the data: fountain of heroes 282, dragonstone amulet 522, charged 597 with "rub"', () => {
    assert.equal(objects[282].name, 'fountain of heros');
    assert.equal(items[522].name, 'Dragonstone Amulet');
    assert.equal(items[597].command, 'rub');
});

test('dipping a dragonstone amulet in the fountain charges it', async () => {
    const { player, log, ids } = fakePlayer({ bag: [522] });
    assert.equal(await amulet.onUseWithGameObject(player, FOUNTAIN, { id: 522 }), true);
    assert.deepEqual(ids(), [597]);
    assert.equal(log.messages[0], 'You dip the amulet in the fountain');
    assert.equal(log.messages.at(-1), 'It now also means you can find more gems when mining');
    assert.equal(await amulet.onUseWithGameObject(player, FOUNTAIN, { id: 597 }), false);
    assert.equal(await amulet.onUseWithGameObject(player, { id: 26 }, { id: 522 }), false);
});

test('rubbing teleports to the chosen town and counts a charge', async () => {
    const towns = [[226, 447], [360, 696], [214, 632], [72, 696]];
    for (const [answer, to] of towns.entries()) {
        const { player, log, ids } = fakePlayer({ bag: [597], answer });
        assert.equal(await amulet.onInventoryCommand(player, { id: 597 }), true);
        assert.deepEqual(log.teleports, [[...to, true]]);
        assert.equal(player.cache.charged_ds_amulet, 1);
        assert.deepEqual(ids(), [597]);
    }
});

test('the 4th rub uses the last charge: a worn amulet stays worn, uncharged', async () => {
    const { player, log } = fakePlayer({ bag: [{ id: 597, equipped: true }], cache: { charged_ds_amulet: 3 } });
    await amulet.onInventoryCommand(player, { id: 597 });
    assert.equal(log.teleports.length, 1);
    assert.equal(player.cache.charged_ds_amulet, undefined);
    assert.equal(player.inventory.items[0].id, 522);
    assert.equal(player.inventory.items[0].equipped, true);
    assert.deepEqual(log.updates, [[0, 522]]);
    assert.equal(log.bonuses, 1);
});

test('the 4th rub of a carried amulet', async () => {
    const { player, ids } = fakePlayer({ bag: [597], cache: { charged_ds_amulet: 3 } });
    await amulet.onInventoryCommand(player, { id: 597 });
    assert.deepEqual(ids(), [522]);
});

test('level 30 Wilderness blocks it; Nowhere does nothing', async () => {
    // level 30: depth 2203 - (y + 1776) = 175 -> y = 252
    const deep = fakePlayer({ bag: [597], at: [200, 252] });
    await amulet.onInventoryCommand(deep.player, { id: 597 });
    assert.deepEqual(deep.log.teleports, []);
    assert.ok(deep.log.messages.includes('A mysterious force blocks your teleport!'));

    const nowhere = fakePlayer({ bag: [597], answer: 4 });
    await amulet.onInventoryCommand(nowhere.player, { id: 597 });
    assert.deepEqual(nowhere.log.teleports, []);
    assert.equal(nowhere.log.messages.at(-1), 'Nothing interesting happens');
    assert.equal(nowhere.player.cache.charged_ds_amulet, undefined);
});

test('Karamja rum stays on Karamja; a plague sample disintegrates; Ana stops it', async () => {
    const rum = fakePlayer({ bag: [597, 318, 318, 812], at: [400, 700] });
    await amulet.onInventoryCommand(rum.player, { id: 597 });
    assert.deepEqual(rum.ids(), [597]);
    assert.ok(rum.log.messages.includes('it disintegrates in the crossing'));

    const ana = fakePlayer({ bag: [597, 1039] });
    await amulet.onInventoryCommand(ana.player, { id: 597 });
    assert.deepEqual(ana.log.teleports, []);
    assert.ok(ana.log.messages.includes("You can't teleport while holding Ana,"));
});
