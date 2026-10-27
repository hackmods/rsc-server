// ARSC Grand Exchange house account (src/exchange/house.js): the hourly
// baseline listings under Zezima, worked out from shops.json, and the admin
// routes. The order book side is tested in rsc-data-server.

const test = require('node:test');
const assert = require('node:assert');

const items = require('@2003scape/rsc-data/config/items');
const shops = require('@2003scape/rsc-data/shops');
const house = require('../src/exchange/house');
const exchange = require('../src/exchange');
const R = require('../src/exchange/rules');

exchange._config.requestMs = 30;

const FIRE = 31;
const DEATH = 38;
const BRONZE_ARROWS = 11;
const RUNE_ARROWS = 646;
const BRONZE_AXE = 87;

const byId = (list) => new Map(list.map((l) => [l.itemId, l]));

test('every listable shop good is listed 10% over its cheapest shop, 10x stock', () => {
    const list = byId(house.houseListings(true));

    for (const [name, shop] of Object.entries(shops)) {
        for (const { id, amount } of shop.items) {
            if (R.listable(id, true) || !(items[id].price > 0)) {
                assert.ok(!list.has(id) || items[id].price > 0, `${id} skipped`);
                continue;
            }

            const l = list.get(id);
            assert.ok(l, `${items[id].name} (${name}) is listed`);
            assert.ok(l.shopPrice <= Math.max(1, house.shopPrice(shop, items[id].price)), 'cheapest shop');
            assert.ok(l.price > l.shopPrice, `${items[id].name} over the shop`);
            assert.ok(l.price >= Math.ceil(l.shopPrice * 1.1), '10% over');

            if (!/ rune$|-rune$| arrows$/i.test(items[id].name)) {
                assert.ok(l.qty >= 10 * Math.max(1, amount), '10x stock');
            }
        }
    }
});

test('runes and arrows stand at 1000, shop-sold or not', () => {
    const list = byId(house.houseListings(true));

    for (const id of [FIRE, DEATH, BRONZE_ARROWS, RUNE_ARROWS]) {
        assert.strictEqual(list.get(id).qty, 1000, items[id].name);
    }

    // a fire rune is 4 gp at Aubury (100%): the house asks 5
    assert.strictEqual(list.get(FIRE).shopPrice, 4);
    assert.strictEqual(list.get(FIRE).price, 5);
    // death runes: no shop, priced as a general store would (130%)
    assert.strictEqual(list.get(DEATH).shopPrice, Math.floor(1.3 * items[DEATH].price));
    // a bronze axe: 10x the biggest shop stock
    assert.ok(list.get(BRONZE_AXE).qty >= 10);

    // never coins, the sleeping bag or an untradeable item
    for (const l of list.values()) {
        assert.strictEqual(R.listable(l.itemId, true), null, items[l.itemId].name);
    }
});

test('a free world lists no members goods', () => {
    const free = house.houseListings(false);
    assert.ok(free.length > 0);
    assert.ok(free.every((l) => !items[l.itemId].members));
    assert.ok(!byId(free).has(RUNE_ARROWS));
});

test('restock sends chunks with per-hour opIds and sums the replies', async () => {
    const sent = [];
    const notified = [];
    const world = { members: true };
    const write = async (w, playerId, message) => {
        sent.push(message);
        return {
            success: true,
            listed: message.listings.length,
            seeded: 1,
            fills: [],
            notify: [{ playerId: 1 }]
        };
    };

    const at = 5 * 3600 * 1000 + 10;
    const out = await house.restock(world, { write, notify: (w, n) => notified.push(...n), at });

    const total = house.houseListings(true).length;
    assert.strictEqual(out.success, true);
    assert.strictEqual(out.user, 'Zezima');
    assert.strictEqual(out.listed, total);
    assert.strictEqual(sent.length, Math.ceil(total / house.HOUSE.chunk));
    assert.ok(sent.every((m) => m.handler === 'exchangeHouse' && m.username === 'Zezima'));
    assert.deepStrictEqual(sent.map((m) => m.opId), sent.map((m, i) => `house:zezima:5:${i}`));
    assert.strictEqual(notified.length, sent.length);
    assert.strictEqual(world.exchangeHouse.listed, total);
});

test('ARSC_EXCHANGE_HOUSE=off turns the house off', async () => {
    process.env.ARSC_EXCHANGE_HOUSE = 'off';

    try {
        assert.strictEqual(house.houseName(), null);
        assert.strictEqual(house.start({}, {}), null);
        const out = await house.restock({}, { write: () => assert.fail('no writes') });
        assert.strictEqual(out.success, false);
    } finally {
        delete process.env.ARSC_EXCHANGE_HOUSE;
    }
});

test('GET /exchange/house previews, POST runs a restock', async () => {
    const sent = [];
    const world = {
        members: true,
        server: {
            dataClient: {
                sendAndReceive(message) {
                    sent.push(message);
                    return Promise.resolve({
                        success: true,
                        listed: message.listings.length,
                        seeded: message.listings.length,
                        fills: [],
                        notify: []
                    });
                }
            }
        },
        players: { getAll: () => [] }
    };
    const url = new URL('http://x/exchange/house');

    const got = await exchange.handleHttp(world, 'GET', '/exchange/house', url, null);
    assert.strictEqual(got.status, 200);
    assert.strictEqual(got.body.user, 'Zezima');
    assert.ok(got.body.count > 100);

    const ran = await exchange.handleHttp(world, 'POST', '/exchange/house', url, async () => '');
    assert.strictEqual(ran.status, 200);
    assert.strictEqual(ran.body.listed, got.body.count);
    assert.ok(sent.length >= 2);
});
