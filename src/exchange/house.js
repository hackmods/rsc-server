// ARSC Grand Exchange house account: the system stock. Every 15 minutes the
// house (ARSC_EXCHANGE_HOUSE, Zezima by default; "off" turns it off) moves one
// standing sell offer per supplies good toward a floor that thins as people
// play. Contract: docs/GRAND_EXCHANGE.md "House listings" and
// docs/PLAN_GE_SCALING.md in Autonomous-RSC.
//
// - Goods: the `supplies` tier of system-stock.json (scripts/gen-ge-system-
//   stock.js: shop goods, runes and arrows, tools, raw materials, food,
//   potions, intermediates; never quest items, rares or certificates). The
//   `market` tier is left to players and the merchant house's market makers.
// - Floor per item: F(h) = max(FLOOR_MIN, round(FLOOR * K / (K + h))), h the
//   hour's active players (activity.js: humans 1, fleet bots 0.05). Stackable
//   goods hold 10x; a shop good never less than its old depth (10x the
//   largest shop stock, runes and arrows 1000) scaled by F(h)/FLOOR.
// - Price, fixed: 10% over the cheapest shop's full-stock price for shop
//   goods (a rune or arrow no shop sells: 130% of base, as a general store
//   would); everything else 1.25x base. It never follows the guide.
// - Restock: each pass adds or withdraws at most 10% of the target (data
//   server house() `step`): an emptied item refills in about 2.5 hours.
// - Yield: no units are added while anyone else asks at or under twice the
//   house price, so a player selling the good is never undercut by new house
//   stock. Units already listed stay, so a buyer is never stranded.
// The data server seeds the units (ledger kind 'seed', 'unseed' when
// withdrawn) and creates the account with a password nobody knows.

const items = require('@2003scape/rsc-data/config/items');
const shops = require('@2003scape/rsc-data/shops');
const log = require('bole')('exchange-house');
const R = require('./rules');
const STOCK = require('./system-stock.json');

const env = (name, fallback) =>
    process.env[name] === undefined ? fallback : process.env[name];

const num = (name, fallback, min) => {
    const n = Number(env(name, fallback));
    return Number.isFinite(n) && n >= min ? n : fallback;
};

const HOUSE = {
    // shop stock multiple and price markup over the shop
    stockTimes: 10,
    markup: 1.1,
    // runes and arrows: this deep at an empty world, whatever the shops hold
    deep: 1000,
    // a rune or arrow no shop sells is priced as a general store would
    generalSell: 130,
    // everything no shop sells: this times its base value
    baseMarkup: 1.25,
    // stackable goods hold this many times the floor
    stackTimes: 10,
    // share of the target a pass may add or withdraw
    stepShare: 0.1,
    // no new units while another ask is at or under this times the price
    yieldTimes: 2,
    // listings per data-server request
    chunk: 100,
    firstRunMs: 30 * 1000
};

function floorConfig() {
    return {
        floor: num('ARSC_EXCHANGE_FLOOR', 100, 1),
        taperK: num('ARSC_EXCHANGE_TAPER_K', 10, 0.1),
        floorMin: num('ARSC_EXCHANGE_FLOOR_MIN', 10, 1)
    };
}

// the floor per item at h active players
function floorFor(h, cfg = floorConfig()) {
    const people = Math.max(0, Number(h) || 0);
    return Math.max(
        cfg.floorMin,
        Math.round((cfg.floor * cfg.taperK) / (cfg.taperK + people))
    );
}

function houseName() {
    const name = String(env('ARSC_EXCHANGE_HOUSE', 'Zezima')).trim();
    return /^(off|false|0|none)?$/i.test(name) ? null : name.slice(0, 12);
}

function houseIntervalMs() {
    const ms = Number(env('ARSC_EXCHANGE_HOUSE_MS', 15 * 60 * 1000));
    return Number.isFinite(ms) && ms >= 60 * 1000 ? ms : 15 * 60 * 1000;
}

// the price a shop sells an item for at full stock (model/shop.js
// getItemPrice with the delta at 0)
function shopPrice(shop, base) {
    return Math.floor((Math.max(10, shop.sellMultiplier) * base) / 100);
}

function isDeep(def) {
    return / rune$|-rune$| arrows$/i.test(def.name);
}

// itemId -> { price, shop, stock }: the cheapest shop and the largest stock
function cheapestShops() {
    const best = new Map();

    for (const [name, shop] of Object.entries(shops)) {
        for (const { id, amount } of shop.items) {
            const def = items[id];

            if (!def || !(def.price > 0)) {
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

    return best;
}

let shopMemo = null;

// [{ itemId, qty, price, step, yieldAt, shopPrice, shop, depth }] by item id:
// the supplies tier at h active players
function houseListings(members = true, { h = 0 } = {}) {
    if (!shopMemo) {
        shopMemo = cheapestShops();
    }

    const cfg = floorConfig();
    const floor = floorFor(h, cfg);
    const out = [];

    for (const entry of STOCK.items) {
        const def = items[entry.id];

        if (entry.tier !== 'supplies' || !def || R.listable(entry.id, members)) {
            continue;
        }

        const sold = shopMemo.get(entry.id);
        const deep = isDeep(def);
        let base;
        let price;

        if (sold) {
            base = sold.price;
            price = Math.max(base + 1, Math.ceil(base * HOUSE.markup));
        } else if (deep) {
            base = Math.max(1, Math.floor((HOUSE.generalSell * def.price) / 100));
            price = Math.max(base + 1, Math.ceil(base * HOUSE.markup));
        } else {
            base = Math.max(1, def.price);
            price = Math.max(base + 1, Math.ceil(base * HOUSE.baseMarkup));
        }

        // the old hourly depth, scaled down as people arrive
        const depth = deep
            ? HOUSE.deep
            : sold
              ? HOUSE.stockTimes * Math.max(1, sold.stock)
              : 0;
        const target = Math.max(
            def.stackable ? floor * HOUSE.stackTimes : floor,
            Math.round((depth * floor) / cfg.floor)
        );

        out.push({
            itemId: entry.id,
            qty: target,
            price,
            step: Math.max(1, Math.ceil(target * HOUSE.stepShare)),
            yieldAt: price * HOUSE.yieldTimes,
            shopPrice: base,
            shop: sold ? sold.shop : null
        });
    }

    return out.sort((a, b) => a.itemId - b.itemId);
}

// the hour's active players the house plans for
function activeOf(world) {
    const a = world && world.exchangeActivity;
    return a && typeof a.effective === 'function' ? a.effective() : 0;
}

// one restock pass; write is exchange/index.js write (opId-idempotent),
// notify tells online counterparties about fills. Returns a summary.
async function restock(world, { write, notify, at = Date.now() } = {}) {
    const user = houseName();

    if (!user) {
        return { success: false, error: 'house off' };
    }

    const h = activeOf(world);
    const listings = houseListings(world.members !== false, { h });
    const bucket = Math.floor(at / houseIntervalMs());
    const out = {
        success: true,
        user,
        h,
        floor: floorFor(h),
        listed: 0,
        seeded: 0,
        unseeded: 0,
        yielded: 0,
        empty: 0,
        fills: 0,
        errors: []
    };
    const results = [];

    for (let i = 0; i < listings.length; i += HOUSE.chunk) {
        const part = listings.slice(i, i + HOUSE.chunk);

        const reply = await write(world, 0, {
            handler: 'exchangeHouse',
            opId: `house:${user.toLowerCase()}:${bucket}:${i / HOUSE.chunk}`,
            username: user,
            listings: part.map(({ itemId, qty, price, step, yieldAt }) => ({
                itemId,
                qty,
                price,
                step,
                yieldAt
            })),
            note: `house pass ${bucket} (h ${h})`
        });

        if (!reply || !reply.success) {
            out.success = false;
            out.errors.push((reply && reply.code) || 'DOWN');
            continue;
        }

        out.listed += reply.listed || 0;
        out.seeded += reply.seeded || 0;
        out.unseeded += reply.unseeded || 0;
        out.fills += (reply.fills || []).length;
        results.push(...(reply.results || []));

        if (notify) {
            notify(world, reply.notify);
        }
    }

    out.yielded = results.filter((r) => r.yielded).length;
    out.empty = results.filter((r) => r.open === 0).length;

    if (out.success) {
        log.info(
            `${user}: ${out.listed} listings at h ${h} (floor ${out.floor}), ` +
                `${out.seeded} seeded, ${out.unseeded} withdrawn, ` +
                `${out.yielded} yielding, ${out.fills} fills`
        );
    } else {
        log.warn(`${user}: restock incomplete (${out.errors.join(', ')})`);
    }

    world.exchangeHouse = { at, ...out };
    world.exchangeHouseResults = new Map(results.map((r) => [r.itemId, r]));
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

module.exports = {
    HOUSE,
    STOCK,
    floorConfig,
    floorFor,
    houseName,
    houseIntervalMs,
    houseListings,
    restock,
    shopPrice,
    start
};
