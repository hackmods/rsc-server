// ARSC Grand Exchange house account (src/exchange/house.js): the system stock
// under Zezima (the supplies tier of system-stock.json, a floor that tapers
// with active players, 15-minute steps, the yield rule), the player sampler
// (src/exchange/activity.js) and the admin routes. The order book side is
// tested in rsc-data-server.

const test = require('node:test');
const assert = require('node:assert');

const items = require('@2003scape/rsc-data/config/items');
const shops = require('@2003scape/rsc-data/shops');
const house = require('../src/exchange/house');
const exchange = require('../src/exchange');
const R = require('../src/exchange/rules');
const activity = require('../src/exchange/activity');
const STOCK = require('../src/exchange/system-stock.json');

const SUPPLIES = new Set(STOCK.items.filter((i) => i.tier === 'supplies').map((i) => i.id));

exchange._config.requestMs = 30;

const FIRE = 31;
const DEATH = 38;
const BRONZE_ARROWS = 11;
const RUNE_ARROWS = 646;
const BRONZE_AXE = 87;

const byId = (list) => new Map(list.map((l) => [l.itemId, l]));

test('every supplies shop good is listed 10% over its cheapest shop, 10x stock at an empty world', () => {
    const list = byId(house.houseListings(true));

    for (const [name, shop] of Object.entries(shops)) {
        for (const { id, amount } of shop.items) {
            if (R.listable(id, true) || !(items[id].price > 0) || !SUPPLIES.has(id)) {
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

test('restock sends chunks with per-pass opIds and sums the replies', async () => {
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
    const bucket = Math.floor(at / house.houseIntervalMs());
    assert.deepStrictEqual(sent.map((m) => m.opId), sent.map((m, i) => `house:zezima:${bucket}:${i}`));
    assert.ok(sent.every((m) => m.listings.every((l) => l.step >= 1 && l.yieldAt === 2 * l.price)));
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
    assert.strictEqual(got.body.floor, 100, 'no players sampled: the empty-world floor');
    assert.ok(got.body.players);

    const ran = await exchange.handleHttp(world, 'POST', '/exchange/house', url, async () => '');
    assert.strictEqual(ran.status, 200);
    assert.strictEqual(ran.body.listed, got.body.count);
    assert.ok(sent.length >= 2);
});

test('only the supplies tier is stocked: never a market good, a quest item, a rare or a certificate', () => {
    const list = house.houseListings(true);
    const tiers = new Map(STOCK.items.map((i) => [i.id, i.tier]));
    assert.ok(list.length > 300, `${list.length} supplies listed`);
    for (const l of list) assert.strictEqual(tiers.get(l.itemId), 'supplies', items[l.itemId].name);
    assert.ok(STOCK.items.some((i) => i.tier === 'market'), 'a market tier exists for the market makers');
    // ids past rsc-data (the ARSC items, appended at boot) are checked by name only
    for (const i of STOCK.items) {
        assert.ok(!/certificate$/i.test(i.name), i.name);
        if (!items[i.id]) continue;
        assert.strictEqual(R.listable(i.id, true), null, items[i.id].name);
    }
    // a good no shop sells is priced 1.25x its base value (logs, cow hide)
    for (const id of [14, 147]) {
        const l = byId(list).get(id);
        assert.ok(l, items[id].name);
        assert.strictEqual(l.price, Math.max(items[id].price + 1, Math.ceil(items[id].price * 1.25)));
    }
});

test('the floor tapers with active players: 100 at none, 50 at 10, never under 10', () => {
    const table = [[0, 100], [1, 91], [3, 77], [5, 67], [10, 50], [20, 33], [40, 20], [90, 10], [500, 10]];
    for (const [h, f] of table) assert.strictEqual(house.floorFor(h), f, `h ${h}`);
    const empty = byId(house.houseListings(true, { h: 0 }));
    const busy = byId(house.houseListings(true, { h: 10 }));
    const ore = 151;
    assert.strictEqual(empty.get(ore).qty, 100);
    assert.strictEqual(busy.get(ore).qty, 50);
    assert.strictEqual(empty.get(ore).step, 10, 'a pass moves 10% of the target');
    // stackables hold 10x; a deep good never less than its old depth scaled by the floor
    assert.strictEqual(empty.get(FIRE).qty, 1000);
    assert.strictEqual(busy.get(FIRE).qty, 500);
});

test('the sampler: fleet accounts weigh 0.05, humans 1, idle players do not count, the hour is averaged', () => {
    process.env.ARSC_FLEET_ACCOUNTS = 'prefix:bot;list:tull,fugger';
    try {
        assert.strictEqual(activity.isFleetAccount('botalpha'), true);
        assert.strictEqual(activity.isFleetAccount('Tull'), true);
        assert.strictEqual(activity.isFleetAccount('ryan'), false);
        const a = new activity.Activity();
        const t0 = 1e12;
        const players = [{ username: 'ryan', x: 1, y: 1 }, { username: 'botalpha', x: 5, y: 5 }, { username: 'tull', x: 9, y: 9 }];
        assert.deepStrictEqual(a.sample(players, t0), { humans: 1, bots: 2 });
        assert.strictEqual(a.effective(), 1.1);
        // twenty minutes later, nobody moved: nobody is active, and the hour average halves
        assert.deepStrictEqual(a.sample(players, t0 + 20 * 60 * 1000), { humans: 0, bots: 0 });
        assert.strictEqual(a.effective(), 0.55);
        // an Exchange action counts as activity
        const traded = [{ username: 'ryan', x: 1, y: 1, exchangeLast: t0 + 39 * 60 * 1000 }];
        assert.deepStrictEqual(a.sample(traded, t0 + 40 * 60 * 1000), { humans: 1, bots: 0 });
    } finally {
        delete process.env.ARSC_FLEET_ACCOUNTS;
    }
});

test('a restock plans for the active players of the world and reports yielding and empty listings', async () => {
    const world = { members: true, exchangeActivity: { effective: () => 10 } };
    const write = async (w, playerId, message) => ({
        success: true,
        listed: message.listings.length,
        seeded: 0,
        results: message.listings.map((l, i) => ({ itemId: l.itemId, open: i === 0 ? 0 : l.qty, added: 0, removed: 0, yielded: i === 1 })),
        fills: [],
        notify: []
    });
    const out = await house.restock(world, { write, at: 1e12 });
    assert.strictEqual(out.h, 10);
    assert.strictEqual(out.floor, 50);
    assert.ok(out.yielded >= 1);
    assert.ok(out.empty >= 1);
    assert.ok(world.exchangeHouseResults.size > 0);
});
