// ARSC Grand Exchange, game-server side: ::ge parsing, item and price words,
// escrow taken with the save snapshot and given back on a refusal, the void
// path when the data server does not answer, collect, the minting gate, and
// the clerk dialogue at every general store. The order book itself is tested
// in rsc-data-server.

const test = require('node:test');
const assert = require('node:assert');

const items = require('@2003scape/rsc-data/config/items');
const shops = require('@2003scape/rsc-data/shops');
const Inventory = require('../src/model/inventory');
const Bank = require('../src/model/bank');
const exchange = require('../src/exchange');
const R = require('../src/exchange/rules');
const { CLERKS, CLERK_IDS } = require('../src/exchange/clerks');
const plugins = require('../src/plugins');

exchange._config.requestMs = 30;
exchange._config.voidRetryMs = 5;
exchange._config.voidRetryMaxMs = 10;

const COAL = 155;
const LOBSTER = 373;
const BRONZE_AXE = 87;
const CLERK = 51; // Varrock shopkeeper

// a data client stub: handlers maps a handler name to a reply (or a function
// of the message); 'never' leaves the request unanswered
function makeDataClient(handlers) {
    const sent = [];

    return {
        sent,
        connected: true,
        sendAndReceive(message) {
            sent.push(JSON.parse(JSON.stringify(message)));

            if (!this.connected) {
                return undefined;
            }

            const handler = handlers[message.handler];
            const reply =
                typeof handler === 'function' ? handler(message) : handler;

            if (reply === 'never') {
                return new Promise(() => {});
            }

            return Promise.resolve(reply || { success: false, code: 'DOWN' });
        }
    };
}

function makePlayer({ handlers = {}, inventory = [], clerk = true, cache = {} } = {}) {
    const messages = [];
    const packets = [];
    const dataClient = makeDataClient(handlers);
    const npcs = clerk ? [{ id: CLERK, x: 130, y: 510 }] : [];

    const world = {
        members: true,
        server: { dataClient },
        npcs: { getInArea: () => npcs },
        players: { getAll: () => [player] },
        getPlayerByUsername: () => null,
        addPlayerDrop() {}
    };

    const player = {
        id: 7,
        username: 'merchant1',
        x: 131,
        y: 511,
        loggedIn: true,
        cache,
        world,
        interfaceOpen: {},
        messages,
        packets,
        message(...lines) {
            messages.push(...lines);
        },
        send(packet) {
            packets.push(packet);
        },
        sendSound() {},
        serialWrite(fn) {
            const run = (this.writeChain || Promise.resolve()).then(fn, fn);
            this.writeChain = run.catch(() => {});
            return run;
        },
        getSaveMessage() {
            return {
                handler: 'playerUpdate',
                id: this.id,
                inventory: JSON.parse(JSON.stringify(this.inventory.items)),
                bank: JSON.parse(JSON.stringify(this.bank.items))
            };
        }
    };

    player.inventory = new Inventory(player, inventory);
    player.inventory.sendUpdate = () => {};
    player.inventory.sendRemove = () => {};
    player.bank = new Bank(player, []);

    return { player, dataClient, messages };
}

function geLines(messages) {
    return messages.filter((line) => line.startsWith('[GE] '));
}

const offerReply = (message, extra = {}) => ({
    success: true,
    offer: {
        id: 1,
        slot: 0,
        side: message.offer.side,
        itemId: message.offer.itemId,
        qty: message.offer.qty,
        filled: 0,
        price: message.offer.price,
        state: 'open',
        ...extra
    },
    fills: [],
    notify: []
});

const STATE = { success: true, offers: [], collect: [] };

test('::ge parsing: names with spaces, all, price words', () => {
    assert.deepStrictEqual(R.parseCommand(['sell', 'raw', 'lobster', '20', '-5%']), {
        op: 'sell',
        item: 'raw lobster',
        qty: 20,
        all: false,
        price: '-5%'
    });
    assert.strictEqual(R.parseCommand(['sell', 'coal', 'all', 'guide']).all, true);
    assert.ok(R.parseCommand(['buy', 'coal', 'all', '5']).error);
    assert.ok(R.parseCommand(['buy', 'coal', '5']).error);
    assert.deepStrictEqual(R.parseCommand(['cancel', '3']), { op: 'cancel', slot: 2 });
    assert.ok(R.parseCommand(['cancel', '9']).error);
    assert.deepStrictEqual(R.parseCommand(['collect', 'bank']), { op: 'collect', bank: true });
    assert.ok(R.parseCommand(['frobnicate']).error);

    const quote = { guide: 100, bid: 90, ask: 110 };
    assert.strictEqual(R.resolvePrice('42', quote), 42);
    assert.strictEqual(R.resolvePrice('guide', quote), 100);
    assert.strictEqual(R.resolvePrice('bid', quote), 90);
    assert.strictEqual(R.resolvePrice('ask', quote), 110);
    assert.strictEqual(R.resolvePrice('+5%', quote), 105);
    assert.strictEqual(R.resolvePrice('-5%', quote), 95);
    assert.strictEqual(R.resolvePrice('bid', { guide: 100 }), 100);
    assert.strictEqual(R.resolvePrice('cheap', quote), null);
});

test('items resolve by id or name; coins and untradeables never list', () => {
    assert.deepStrictEqual(R.resolveItem('155'), { id: COAL });
    assert.deepStrictEqual(R.resolveItem('coal'), { id: COAL });
    assert.deepStrictEqual(R.resolveItem('Coal'), { id: COAL });
    assert.strictEqual(R.resolveItem('nothing like this').error, 'NOT_FOUND');
    assert.strictEqual(R.resolveItem('bar').error, 'AMBIGUOUS');
    assert.ok(R.resolveItem('bar').matches.length <= 3);
    assert.strictEqual(R.listable(10, true), 'UNTRADEABLE');
    assert.strictEqual(R.listable(1263, true), 'UNTRADEABLE'); // sleeping bag: the assist may conjure it

    const untradeable = items.findIndex((def) => def && def.untradeable);
    assert.strictEqual(R.listable(untradeable, true), 'UNTRADEABLE');

    const members = items.findIndex((def) => def && def.members && !def.untradeable);
    assert.strictEqual(R.listable(members, false), 'UNTRADEABLE');
    assert.strictEqual(R.listable(members, true), null);
});

test('slots: open offers go to their slot, the rest are empty', () => {
    const slots = R.slotsFrom([
        { slot: 2, side: 'sell', itemId: COAL, qty: 10, filled: 4, price: 40, state: 'open' },
        { slot: 0, side: 'buy', itemId: LOBSTER, qty: 5, filled: 0, price: 150, state: 'done' }
    ]);

    assert.strictEqual(slots.length, 8);
    assert.deepStrictEqual(slots[2], { state: 2, itemId: COAL, qty: 10, filled: 4, price: 40 });
    assert.strictEqual(slots[0].state, 0);
});

test('a sell takes the items, and the save sent with it already lacks them', async () => {
    const { player, dataClient, messages } = makePlayer({
        inventory: [{ id: COAL, amount: 1 }, { id: COAL, amount: 1 }, { id: COAL, amount: 1 }, { id: BRONZE_AXE, amount: 1 }],
        handlers: { exchangePlace: (m) => offerReply(m), exchangeState: STATE }
    });

    await exchange.command(player, ['sell', 'coal', '2', '40']);

    assert.strictEqual(player.inventory.count(COAL), 1);

    const place = dataClient.sent.find((m) => m.handler === 'exchangePlace');
    assert.ok(place.opId);
    assert.deepStrictEqual(place.offer.side, 'sell');
    assert.strictEqual(place.offer.qty, 2);
    assert.strictEqual(place.offer.price, 40);
    assert.strictEqual(place.offer.basePrice, items[COAL].price);
    assert.strictEqual(place.save.inventory.filter((item) => item.id === COAL).length, 1);
    assert.strictEqual(place.save.handler, undefined);
    assert.deepStrictEqual(geLines(messages), [`[GE] placed 1 sell ${COAL} 2 40`]);
});

test('a buy takes the coins; a refusal gives them back', async () => {
    const { player, messages } = makePlayer({
        inventory: [{ id: 10, amount: 1000 }],
        handlers: { exchangePlace: { success: false, code: 'PRICE_BAND' } }
    });

    await exchange.command(player, ['buy', 'coal', '10', '50']);

    assert.strictEqual(player.inventory.count(10), 1000);
    assert.match(geLines(messages)[0], /^\[GE\] refused PRICE_BAND /);
});

test('equipped items are never escrowed', async () => {
    const { player, messages } = makePlayer({
        inventory: [{ id: BRONZE_AXE, amount: 1, equipped: true }],
        handlers: { exchangePlace: (m) => offerReply(m) }
    });

    await exchange.command(player, ['sell', String(BRONZE_AXE), '1', '10']);

    assert.strictEqual(player.inventory.items.length, 1);
    assert.match(geLines(messages)[0], /refused NO_ITEM/);
});

test('no reply: the void settles it; voided gives the escrow back', async () => {
    const { player, dataClient, messages } = makePlayer({
        inventory: [{ id: 10, amount: 500 }],
        handlers: {
            exchangePlace: 'never',
            exchangeVoid: { success: true, voided: true }
        }
    });

    await exchange.command(player, ['buy', 'coal', '5', '50']);

    const place = dataClient.sent.find((m) => m.handler === 'exchangePlace');
    const voided = dataClient.sent.find((m) => m.handler === 'exchangeVoid');

    assert.strictEqual(voided.opId, place.opId);
    assert.deepStrictEqual(voided.refund, []);
    assert.strictEqual(player.inventory.count(10), 500);
    assert.match(geLines(messages)[0], /refused VOID/);
});

test('no reply, but the write had happened: the escrow stays taken', async () => {
    let voids = 0;
    const { player, messages } = makePlayer({
        inventory: [{ id: 10, amount: 500 }],
        handlers: {
            exchangePlace: 'never',
            exchangeVoid: (m) => {
                voids += 1;

                if (voids < 3) {
                    return 'never'; // the data server is still away
                }

                return {
                    success: true,
                    voided: false,
                    result: offerReply({ offer: { side: 'buy', itemId: COAL, qty: 5, price: 50 } })
                };
            },
            exchangeState: STATE
        }
    });

    await exchange.command(player, ['buy', 'coal', '5', '50']);

    assert.strictEqual(voids, 3);
    assert.strictEqual(player.inventory.count(10), 250);
    assert.match(geLines(messages)[0], /^\[GE\] placed 1 buy/);
});

test('data client disconnected: refused DOWN, nothing taken', async () => {
    const { player, dataClient, messages } = makePlayer({ inventory: [{ id: 10, amount: 500 }] });
    dataClient.connected = false;

    await exchange.command(player, ['buy', 'coal', '5', '50']);

    assert.strictEqual(player.inventory.count(10), 500);
    assert.match(geLines(messages)[0], /refused DOWN/);
});

test('barred (minted) and far players are refused', async () => {
    const barred = makePlayer({ inventory: [{ id: 10, amount: 500 }], cache: { minted: 1 } });
    await exchange.command(barred.player, ['buy', 'coal', '5', '50']);
    assert.match(geLines(barred.messages)[0], /refused BARRED/);
    assert.strictEqual(barred.dataClient.sent.length, 0);

    const far = makePlayer({ inventory: [{ id: 10, amount: 500 }], clerk: false });
    await exchange.command(far.player, ['buy', 'coal', '5', '50']);
    assert.match(geLines(far.messages)[0], /refused FAR/);
});

test('one action at a time', async () => {
    const { player, messages } = makePlayer({
        inventory: [{ id: 10, amount: 500 }],
        handlers: { exchangePlace: (m) => offerReply(m), exchangeState: STATE }
    });

    await exchange.command(player, ['buy', 'coal', '1', '50']);
    await exchange.command(player, ['buy', 'coal', '1', '50']);

    assert.match(geLines(messages).pop(), /refused BUSY/);
});

test('price words ask the data server for the guide', async () => {
    const { player, dataClient } = makePlayer({
        inventory: [{ id: 10, amount: 5000 }],
        handlers: {
            exchangePrices: { success: true, items: { [COAL]: { guide: 60, bid: 55, ask: 70, vol24: 9, limitLeft: 900 } } },
            exchangePlace: (m) => offerReply(m),
            exchangeState: STATE
        }
    });

    await exchange.command(player, ['buy', 'coal', '10', '+10%']);

    const place = dataClient.sent.find((m) => m.handler === 'exchangePlace');
    assert.strictEqual(place.offer.price, 66);
    assert.strictEqual(player.inventory.count(10), 5000 - 660);
});

test('collect: what fits comes in with the save; a refusal takes it out again', async () => {
    const full = Array.from({ length: 29 }, () => ({ id: BRONZE_AXE, amount: 1 }));
    const collectState = {
        success: true,
        offers: [],
        collect: [{ itemId: 10, amount: 300 }, { itemId: COAL, amount: 5 }]
    };

    const ok = makePlayer({
        inventory: full,
        handlers: {
            exchangeState: collectState,
            exchangeCollect: { success: true, collect: [{ itemId: COAL, amount: 5 }] }
        }
    });

    await exchange.command(ok.player, ['collect']);

    const sent = ok.dataClient.sent.find((m) => m.handler === 'exchangeCollect');
    assert.deepStrictEqual(sent.claim, [{ itemId: 10, amount: 300 }]);
    assert.strictEqual(sent.save.inventory.find((item) => item.id === 10).amount, 300);
    assert.strictEqual(ok.player.inventory.count(10), 300);
    assert.strictEqual(geLines(ok.messages)[0], '[GE] collected 10 300');

    const refused = makePlayer({
        inventory: [],
        handlers: { exchangeState: collectState, exchangeCollect: { success: false, code: 'NO_ITEM' } }
    });

    await exchange.command(refused.player, ['collect']);
    assert.strictEqual(refused.player.inventory.items.length, 0);

    const toBank = makePlayer({
        inventory: full.concat([{ id: BRONZE_AXE, amount: 1 }]),
        handlers: { exchangeState: collectState, exchangeCollect: { success: true, collect: [] } }
    });

    await exchange.command(toBank.player, ['collect', 'bank']);
    assert.strictEqual(toBank.player.bank.getItem({ id: COAL }).amount, 5);
    assert.strictEqual(toBank.player.bank.getItem({ id: 10 }).amount, 300);
});

test('writes of one player run in order (a save cannot overtake an escrow)', async () => {
    const order = [];
    const { player } = makePlayer();

    const slow = player.serialWrite(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        order.push('escrow');
    });
    const save = player.serialWrite(async () => order.push('save'));

    await Promise.all([slow, save]);
    assert.deepStrictEqual(order, ['escrow', 'save']);
});

test('admin API: prices, stake behind validation', async () => {
    const { player, dataClient } = makePlayer({
        handlers: {
            exchangePrices: { success: true, token: 'x', items: {} },
            exchangeStake: { success: true }
        }
    });

    const url = new URL('http://x/exchange/prices?ids=155,373');
    const prices = await exchange.handleHttp(player.world, 'GET', '/exchange/prices', url, null);
    assert.strictEqual(prices.status, 200);
    assert.strictEqual(prices.body.token, undefined);
    assert.deepStrictEqual(dataClient.sent[0].itemIds, [155, 373]);

    const bad = await exchange.handleHttp(player.world, 'POST', '/exchange/stake', url, async () => '{"user":"a","coins":-5}');
    assert.strictEqual(bad.status, 400);

    const ok = await exchange.handleHttp(player.world, 'POST', '/exchange/stake', url, async () => '{"user":"merchant1","coins":5000}');
    assert.strictEqual(ok.status, 200);
    assert.ok(dataClient.sent.find((m) => m.handler === 'exchangeStake').opId);

    await exchange.handleHttp(player.world, 'POST', '/exchange/stake', url, async () => '{"user":"merchant1","coins":5000,"opId":"merchant-stake:merchant1"}');
    assert.strictEqual(dataClient.sent.filter((m) => m.handler === 'exchangeStake').pop().opId, 'merchant-stake:merchant1');

    const badOp = await exchange.handleHttp(player.world, 'POST', '/exchange/stake', url, async () => '{"user":"merchant1","coins":5,"opId":"no spaces"}');
    assert.strictEqual(badOp.status, 400);

    assert.strictEqual(await exchange.handleHttp(player.world, 'GET', '/shops', url, null), null);
});

test('every general store has clerks, and each offers the Exchange last', async () => {
    const general = Object.keys(shops).filter((key) => shops[key].general);
    assert.deepStrictEqual(Object.keys(CLERKS).sort(), general.sort());

    for (const id of CLERK_IDS) {
        const menus = [];
        let opened = null;
        const player = {
            questStages: {},
            cache: {},
            engage() {},
            disengage() {},
            message() {},
            async say() {},
            async ask(options) {
                menus.push(options);
                return options.length - 1; // the Exchange, then "Never mind"
            },
            openShop(key) {
                opened = key;
            }
        };
        const npc = { id, async say() {} };

        let claimed = false;

        for (const plugin of Object.values(plugins)) {
            if (plugin.onTalkToNPC && (await plugin.onTalkToNPC(player, npc))) {
                claimed = true;
                break;
            }
        }

        assert.ok(claimed, `clerk ${id} talk is claimed`);
        assert.strictEqual(opened, null);
        assert.strictEqual(menus[0][menus[0].length - 1], exchange.EXCHANGE_OPTION, `clerk ${id}`);
        assert.strictEqual(menus[1][0], 'Open the Exchange', `clerk ${id}`);

        for (const menu of menus) {
            assert.ok(menu.length <= 5, `clerk ${id} menu of ${menu.length}`);
        }
    }
});

test('an overlay vendor on a clerk (Lumbridge special offers) keeps the Exchange option', async () => {
    const worldAdmin = require('../src/world-admin');
    const saved = { doc: worldAdmin._state.doc, world: worldAdmin._state.world };
    worldAdmin._state.doc = {
        vendors: [{ key: 'lumbridge-keeper', npcIds: [55, 83], shop: 'lumbridge-general', offers: [{ id: 28, price: 1, label: 'Iron dagger - 1 coin' }] }]
    };
    worldAdmin._state.world = { shops: new Map([['lumbridge-general', {}]]) };

    try {
        const menus = [];
        const player = {
            cache: {},
            engage() {},
            disengage() {},
            message() {},
            async ask(options) {
                menus.push(options);
                return options.length - 1;
            },
            openShop() {
                throw new Error('no shop');
            }
        };

        assert.strictEqual(await worldAdmin.vendorTalk(player, { id: 55, async say() {} }), true);
        assert.deepStrictEqual(menus[0], ['Yes please. What are you selling?', 'Do you have any special offers?', 'No thanks', exchange.EXCHANGE_OPTION]);
        assert.strictEqual(menus[1][0], 'Open the Exchange');
    } finally {
        Object.assign(worldAdmin._state, saved);
    }
});
