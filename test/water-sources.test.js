'use strict';

// game-objects/water-sources.js: Open-RSC Refill.blockUseLoc. A refillable item fills at a source (fountain, sink, pump), a
// bucket at a well; nothing else. The old guard let every object through: an empty vial on the Dig Site's barrel of
// unidentified liquid (1083) came back full of water and the quest's next step had nothing to use (live).

const test = require('node:test');
const assert = require('node:assert/strict');
const { onUseWithGameObject } = require('../src/plugins/game-objects/water-sources');

function player(itemId) {
    const inv = [itemId];
    return {
        world: { sleepTicks: async () => {} },
        messages: [],
        inventory: { remove: (id) => inv.splice(inv.indexOf(id), 1), add: (id) => inv.push(id), list: inv },
        sendBubble() {},
        sendSound() {},
        message(m) { this.messages.push(m); },
    };
}
const obj = (id, name) => ({ id, definition: { name } });
const vial = { id: 465, definition: { name: 'Vial' } };
const bucket = { id: 21, definition: { name: 'Bucket' } };

test('a vial fills at a fountain or a sink, a bucket at a well', async () => {
    for (const source of [obj(26, 'Fountain'), obj(48, 'Sink')]) {
        const p = player(465);
        assert.equal(await onUseWithGameObject(p, source, vial), true);
        assert.deepEqual(p.inventory.list, [464]);
    }
    const p = player(21);
    assert.equal(await onUseWithGameObject(p, obj(2, 'Well'), bucket), true);
    assert.notDeepEqual(p.inventory.list, [21]);
});

test('anything else is left to the plugin that owns it (the Dig Site barrel, a well with a vial)', async () => {
    const p = player(465);
    assert.equal(await onUseWithGameObject(p, obj(1083, 'Barrel'), vial), false);
    assert.deepEqual(p.inventory.list, [465]);
    assert.equal(await onUseWithGameObject(player(465), obj(2, 'Well'), vial), false);
});
