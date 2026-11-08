// Market data routes (docs/MARKET_API.md): GET /exchange/tape, candles,
// movers, index. The data server is a canned fake.

const test = require('node:test');
const assert = require('node:assert');
const exchange = require('../src/exchange');
const STOCK = require('../src/exchange/system-stock.json');

const supply = STOCK.items.find((i) => i.tier === 'supplies');
const market = STOCK.items.find((i) => i.tier === 'market');

function fakeWorld(replies, sent = []) {
    return {
        members: true,
        server: {
            dataClient: {
                sendAndReceive(message) {
                    sent.push(message);
                    return Promise.resolve({ success: true, ...replies[message.handler] });
                }
            }
        },
        players: { getAll: () => [] }
    };
}

function get(world, path) {
    const url = new URL(`http://x${path}`);
    return exchange.handleHttp(world, 'GET', url.pathname, url, null);
}

test('GET /exchange/tape passes since and a capped limit', async () => {
    const sent = [];
    const fills = [{ id: 1, itemId: 5, qty: 2, price: 9, at: 100, house: true }];
    const world = fakeWorld({ exchangeTape: { fills } }, sent);

    const got = await get(world, '/exchange/tape?since=50&limit=9999');
    assert.strictEqual(got.status, 200);
    assert.deepStrictEqual(got.body, { success: true, fills });
    assert.strictEqual(sent[0].since, 50);
    assert.strictEqual(sent[0].limit, 200);

    await get(world, '/exchange/tape');
    assert.strictEqual(sent[1].limit, 50);
});

test('GET /exchange/candles/:item resolves an id, 404s an unknown item', async () => {
    const sent = [];
    const candles = [{ t: 0, open: 1, high: 2, low: 1, close: 2, volume: 3, trades: 1 }];
    const world = fakeWorld({ exchangeCandles: { bucketMs: 900000, candles } }, sent);

    const got = await get(world, `/exchange/candles/${supply.id}?bucket=900000&hours=5000`);
    assert.strictEqual(got.status, 200);
    assert.deepStrictEqual(got.body, { itemId: supply.id, success: true, bucketMs: 900000, candles });
    assert.strictEqual(sent[0].itemId, supply.id);
    assert.strictEqual(sent[0].bucketMs, 900000);
    assert.strictEqual(sent[0].hours, 720);

    const byName = await get(world, '/exchange/candles/iron%20mace');
    assert.strictEqual(byName.status, 200);
    assert.strictEqual(byName.body.itemId, 0);

    const none = await get(world, '/exchange/candles/no-such-item-xyz');
    assert.strictEqual(none.status, 404);
    assert.strictEqual(sent.length, 2, 'the data server was not asked');
});

test('GET /exchange/movers adds the tier, other for unstocked items', async () => {
    const sent = [];
    const rows = [
        { itemId: supply.id, open: 10, last: 12, change: 0.2, volume: 5, trades: 2, houseShare: 1 },
        { itemId: market.id, open: 10, last: 9, change: -0.1, volume: 1, trades: 1, houseShare: 0 },
        { itemId: 99999, open: 1, last: 1, change: 0, volume: 1, trades: 1, houseShare: 0 }
    ];
    const world = fakeWorld({ exchangeMovers: { hours: 24, items: rows } }, sent);

    const got = await get(world, '/exchange/movers?hours=1000');
    assert.strictEqual(got.status, 200);
    assert.strictEqual(sent[0].hours, 168);
    assert.deepStrictEqual(
        got.body.items.map((i) => i.tier),
        ['supplies', 'market', 'other']
    );
});

test('GET /exchange/index: 100 * coins / (qty * base) per tier and bucket', async () => {
    const H = 3600000;
    const rows = [
        // supplies at exactly base value: 100
        { t: 0, itemId: supply.id, qty: 10, notional: 10 * supply.base },
        // a second supplies item at double base in the same bucket
        { t: 0, itemId: supply.id, qty: 10, notional: 20 * supply.base },
        { t: H, itemId: market.id, qty: 2, notional: Math.round(1.5 * 2 * market.base) },
        // neither tier: ignored
        { t: H, itemId: 99999, qty: 5, notional: 500 }
    ];
    const world = fakeWorld({ exchangeIndexRows: { bucketMs: H, rows } });

    const got = await get(world, '/exchange/index?hours=24');
    assert.strictEqual(got.status, 200);
    assert.strictEqual(got.body.base, 100);
    assert.strictEqual(got.body.bucketMs, H);
    assert.deepStrictEqual(got.body.series.supplies, [{ t: 0, value: 150, volume: 20 }]);
    assert.strictEqual(got.body.series.market.length, 1);
    assert.strictEqual(got.body.series.market[0].t, H);
    assert.ok(Math.abs(got.body.series.market[0].value - 150) < 0.5);
    assert.strictEqual(got.body.series.market[0].volume, 2);
});

test('market routes: 503 when the data server is down', async () => {
    const world = {
        members: true,
        server: { dataClient: { sendAndReceive: () => Promise.resolve({ down: true }) } },
        players: { getAll: () => [] }
    };
    const got = await get(world, '/exchange/tape');
    assert.strictEqual(got.status, 503);
});
