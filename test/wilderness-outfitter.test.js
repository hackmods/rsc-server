// The Wilderness outfitter: an Edgeville shopkeeper south of the border (arsc-locations.js npc, arsc-shops.js stock,
// plugins/npcs/edgeville/wilderness-outfitter.js).

const test = require('node:test');
const assert = require('node:assert');

const plugin = require('../src/plugins/npcs/edgeville/wilderness-outfitter');
const plugins = require('../src/plugins');
const arscLocations = require('../src/arsc-locations');
const arscShops = require('../src/arsc-shops');
const Shop = require('../src/model/shop');
const shops = require('@2003scape/rsc-data/shops');
const items = require('@2003scape/rsc-data/config/items');
const npcs = require('@2003scape/rsc-data/config/npcs');
const npcLocations = require('@2003scape/rsc-data/locations/npcs');
const { wildernessLevel } = require('../src/wilderness');

const KEY = 'wilderness-outfitter';
const OUTFITTER = 720;

function makePlayer(choices) {
    const queue = [...choices];

    return {
        opened: [],
        engage() {},
        disengage() {},
        message() {},
        async say() {},
        async ask(options) {
            return queue.length ? queue.shift() : options.length - 1;
        },
        openShop(key) {
            this.opened.push(key);
        }
    };
}

function makeNpc(id, x = 214, y = 446) {
    return { id, x, y, definition: npcs[id], async say() {} };
}

test('choosing yes opens the shop, no thanks does not', async () => {
    assert.ok(Object.values(plugins).includes(plugin), 'listed in src/plugins/index.js');

    const yes = makePlayer([0]);
    assert.strictEqual(await plugin.onTalkToNPC(yes, makeNpc(OUTFITTER)), true);
    assert.deepStrictEqual(yes.opened, [KEY]);

    const no = makePlayer([1]);
    assert.strictEqual(await plugin.onTalkToNPC(no, makeNpc(OUTFITTER)), true);
    assert.deepStrictEqual(no.opened, []);
});

test('other npcs and the Shantay Pass assistant are left alone', async () => {
    assert.strictEqual(await plugin.onTalkToNPC(makePlayer([0]), makeNpc(185)), false);

    const shantay = npcLocations.find((l) => l.id === OUTFITTER);
    const far = makePlayer([0]);
    assert.strictEqual(await plugin.onTalkToNPC(far, makeNpc(OUTFITTER, shantay.x, shantay.y)), false);
    assert.deepStrictEqual(far.opened, []);
});

test('the shop is in the merged shop table with real items', () => {
    assert.strictEqual(shops[KEY], arscShops[KEY]);
    assert.ok(Shop.names.includes(KEY));

    const def = shops[KEY];
    assert.strictEqual(def.general, false);
    assert.ok(def.items.length > 0 && def.items.length <= 40, 'fits the 40 slot shop window');

    const seen = new Set();

    for (const { id, amount } of def.items) {
        assert.ok(items[id], 'item ' + id + ' is defined');
        assert.ok(amount > 0);
        assert.ok(!seen.has(id), 'item ' + id + ' listed twice');
        seen.add(id);
    }

    // upstream shops stay untouched
    assert.ok(shops['varrock-swords'] && !arscShops['varrock-swords']);
});

test('the outfitter spawns south of the Wilderness', () => {
    const spawn = arscLocations.npcs.find((n) => n.id === OUTFITTER);

    assert.ok(spawn, 'spawn in arsc-locations.js');
    assert.strictEqual(wildernessLevel(spawn), 0);

    for (const [x, y] of [
        [spawn.minX, spawn.minY],
        [spawn.maxX, spawn.maxY]
    ]) {
        assert.strictEqual(wildernessLevel({ x, y }), 0);
    }

    assert.ok(spawn.y > 427, 'south of the border (y 427)');
});
