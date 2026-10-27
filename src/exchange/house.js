// ARSC Grand Exchange house account: the baseline. Every hour the house
// (ARSC_EXCHANGE_HOUSE, Zezima by default; "off" turns it off) tops up one
// standing sell offer per shop good: 10x the largest shop stock, at 10% over
// the cheapest shop's full-stock price. Runes and arrows stand at 1000 each,
// shop-sold or not. The house is a ceiling, not a competitor: anyone who
// makes, imports or brokers a good can always undercut it, and a buyer far
// from a shop always has a seller. The data server seeds the units (ledger
// kind 'seed') and creates the account with a password nobody knows.
// Contract: docs/GRAND_EXCHANGE.md "House listings" in Autonomous-RSC.

const items = require('@2003scape/rsc-data/config/items');
const shops = require('@2003scape/rsc-data/shops');
const log = require('bole')('exchange-house');
const R = require('./rules');

const HOUSE = {
    // shop stock multiple and price markup over the shop
    stockTimes: 10,
    markup: 1.1,
    // runes and arrows: this many each, whatever the shops hold
    deep: 1000,
    // a rune or arrow no shop sells is priced as a general store would
    generalSell: 130,
    // listings per data-server request
    chunk: 100,
    firstRunMs: 30 * 1000
};

const env = (name, fallback) =>
    process.env[name] === undefined ? fallback : process.env[name];

function houseName() {
    const name = String(env('ARSC_EXCHANGE_HOUSE', 'Zezima')).trim();
    return /^(off|false|0|none)?$/i.test(name) ? null : name.slice(0, 12);
}

function houseIntervalMs() {
    const ms = Number(env('ARSC_EXCHANGE_HOUSE_MS', 60 * 60 * 1000));
    return Number.isFinite(ms) && ms >= 60 * 1000 ? ms : 60 * 60 * 1000;
}

// the price a shop sells an item for at full stock (model/shop.js
// getItemPrice with the delta at 0)
function shopPrice(shop, base) {
    return Math.floor((Math.max(10, shop.sellMultiplier) * base) / 100);
}

function isDeep(def) {
    return / rune$|-rune$| arrows$/i.test(def.name);
}

// [{ itemId, qty, price, shopPrice, shop }] sorted by item id
function houseListings(members = true) {
    const best = new Map();

    for (const [name, shop] of Object.entries(shops)) {
        for (const { id, amount } of shop.items) {
            const def = items[id];

            if (!def || R.listable(id, members) || !(def.price > 0)) {
                continue;
            }

            // a 1 gp item some shops price at 0 still costs the house 1
            const price = Math.max(1, shopPrice(shop, def.price));
            const seen = best.get(id);

            if (!seen) {
                best.set(id, { price, shop: name, stock: amount });
                continue;
            }

            if (price < seen.price) {
                seen.price = price;
                seen.shop = name;
            }

            seen.stock = Math.max(seen.stock, amount);
        }
    }

    items.forEach((def, id) => {
        if (best.has(id) || !isDeep(def) || R.listable(id, members)) {
            return;
        }

        if (!(def.price > 0)) {
            return;
        }

        best.set(id, {
            price: Math.max(1, Math.floor((HOUSE.generalSell * def.price) / 100)),
            shop: null,
            stock: 0
        });
    });

    return [...best]
        .map(([itemId, { price, shop, stock }]) => ({
            itemId,
            qty: isDeep(items[itemId])
                ? HOUSE.deep
                : HOUSE.stockTimes * Math.max(1, stock),
            price: Math.max(price + 1, Math.ceil(price * HOUSE.markup)),
            shopPrice: price,
            shop
        }))
        .sort((a, b) => a.itemId - b.itemId);
}

// one restock pass; write is exchange/index.js write (opId-idempotent),
// notify tells online counterparties about fills. Returns a summary.
async function restock(world, { write, notify, at = Date.now() } = {}) {
    const user = houseName();

    if (!user) {
        return { success: false, error: 'house off' };
    }

    const listings = houseListings(world.members !== false);
    const bucket = Math.floor(at / houseIntervalMs());
    const out = { success: true, user, listed: 0, seeded: 0, fills: 0, errors: [] };

    for (let i = 0; i < listings.length; i += HOUSE.chunk) {
        const part = listings.slice(i, i + HOUSE.chunk);

        const reply = await write(world, 0, {
            handler: 'exchangeHouse',
            opId: `house:${user.toLowerCase()}:${bucket}:${i / HOUSE.chunk}`,
            username: user,
            listings: part.map(({ itemId, qty, price }) => ({ itemId, qty, price })),
            note: `hourly baseline ${bucket}`
        });

        if (!reply || !reply.success) {
            out.success = false;
            out.errors.push((reply && reply.code) || 'DOWN');
            continue;
        }

        out.listed += reply.listed || 0;
        out.seeded += reply.seeded || 0;
        out.fills += (reply.fills || []).length;

        if (notify) {
            notify(world, reply.notify);
        }
    }

    if (out.success) {
        log.info(`${user}: ${out.listed} listings, ${out.seeded} units restocked, ${out.fills} fills`);
    } else {
        log.warn(`${user}: restock incomplete (${out.errors.join(', ')})`);
    }

    world.exchangeHouse = { at, ...out };
    return out;
}

function start(world, deps) {
    if (!houseName()) {
        return null;
    }

    const run = () => restock(world, deps).catch((e) => log.error(e));
    const first = setTimeout(run, HOUSE.firstRunMs);
    const every = setInterval(run, houseIntervalMs());

    first.unref();
    every.unref();

    return { first, every };
}

module.exports = { HOUSE, houseName, houseIntervalMs, houseListings, restock, shopPrice, start };
