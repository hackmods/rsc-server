'use strict';

/**
 * ARSC world-admin: live, file-backed world configuration for rsc-server.
 * Installed into src/world-admin.js by patches/world-admin.js. See
 * docs/WORLD_ADMIN.md for the overlay schema and API.
 *
 * What it does
 *  - loads an overlay document (world.json) and applies it to the running
 *    world: shop stock / multipliers / new shops, "vendor" dialogue offers with
 *    exact coin prices, scheduled events, a first-login starter kit
 *  - re-applies the file when it changes (mtime poll, not fs.watch: Docker
 *    Desktop bind mounts on Windows do not deliver reliable change events)
 *  - exposes a small JSON API on an internal port (never publish it)
 *  - drives shop restocking (upstream never scheduled it)
 *
 * Env: ARSC_WORLD_FILE (default /config/world/world.json), ARSC_ADMIN_PORT
 * (43600), ARSC_ADMIN_TOKEN (mutations disabled while empty), ARSC_CMD_POLICY
 * (open | rank | prefix:a,b).
 */

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const log = require('bole')('world-admin');

const shopsData = require('@2003scape/rsc-data/shops');
const items = require('@2003scape/rsc-data/config/items');
const npcDefs = require('@2003scape/rsc-data/config/npcs');
const Shop = require('./model/shop');
const Item = require('./model/item');
const NPC = require('./model/npc');

const WORLD_FILE = process.env.ARSC_WORLD_FILE || '/config/world/world.json';
const ADMIN_PORT = +(process.env.ARSC_ADMIN_PORT || 43600);
const ADMIN_TOKEN = process.env.ARSC_ADMIN_TOKEN || '';
const POLL_MS = 5000;
const MAX_BODY = 512 * 1024;

const COINS = 10;
const SHOP_ITEM_CAP = 40;
const STACK_CAP = 65535;
const MAX_OFFERS = 4;
const INVENTORY_CAP = 30;
const KEY_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;

const SHOP_FIELDS = [
    'general',
    'buyMultiplier',
    'sellMultiplier',
    'delta',
    'restock'
];

const NEW_SHOP_DEFAULTS = {
    general: false,
    buyMultiplier: 40,
    sellMultiplier: 130,
    delta: 3,
    restock: 12000
};

const DEFAULT_DOC = {
    version: 1,
    shops: {},
    vendors: [
        {
            key: 'lumbridge-keeper',
            npcIds: [55, 83],
            greeting: 'Can I help you at all?',
            shop: 'lumbridge-general',
            shopLabel: 'Yes please. What are you selling?',
            menu: 'Do you have any special offers?',
            offers: [
                { id: 28, price: 1, label: 'Iron dagger - 1 coin' },
                {
                    id: 575,
                    price: 1000000,
                    label: 'Christmas cracker - 1,000,000 coins'
                }
            ]
        }
    ],
    events: [],
    starterKit: {
        enabled: false,
        grantTo: 'new',
        items: [],
        message: 'You find a few supplies waiting for you.',
        skipPrefixes: ['bot']
    }
};

const state = {
    world: null,
    builtin: null,
    doc: null,
    applied: new Set(),
    nextRestock: new Map(),
    eventHandles: [],
    eventNpcs: new Map(),
    lastMtime: 0,
    persistError: null
};

const clone = (value) => JSON.parse(JSON.stringify(value));
const isInt = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;

function itemUsable(world, id) {
    const def = items[id];
    return !!def && (world.members || !def.members);
}

// ---------------------------------------------------------------------------
// validation: returns { doc, errors }. doc contains only known fields.
// ---------------------------------------------------------------------------

function normalizeItemList(world, list, where, errors, cap, minAmount = 1) {
    const out = [];

    if (!Array.isArray(list)) {
        errors.push(`${where}: items must be an array`);
        return out;
    }

    if (list.length > cap) {
        errors.push(`${where}: at most ${cap} items`);
    }

    const seen = new Set();

    list.forEach((entry, i) => {
        const at = `${where}.items[${i}]`;

        if (!entry || !isInt(entry.id, 0, items.length - 1)) {
            errors.push(`${at}: invalid item id`);
            return;
        }

        if (!itemUsable(world, entry.id)) {
            errors.push(`${at}: item ${entry.id} is members-only`);
            return;
        }

        if (seen.has(entry.id)) {
            errors.push(`${at}: duplicate item ${entry.id}`);
            return;
        }

        const amount = entry.amount === undefined ? 1 : entry.amount;

        if (!isInt(amount, minAmount, STACK_CAP)) {
            errors.push(`${at}: amount must be ${minAmount}-${STACK_CAP}`);
            return;
        }

        seen.add(entry.id);
        out.push({ id: entry.id, amount });
    });

    return out;
}

function normalizeShops(world, shops, errors) {
    const out = {};

    if (shops === undefined) {
        return out;
    }

    if (!shops || typeof shops !== 'object' || Array.isArray(shops)) {
        errors.push('shops: must be an object');
        return out;
    }

    for (const [name, raw] of Object.entries(shops)) {
        const where = `shops.${name}`;

        if (!KEY_RE.test(name)) {
            errors.push(`${where}: name must match ${KEY_RE}`);
            continue;
        }

        if (!raw || typeof raw !== 'object') {
            errors.push(`${where}: must be an object`);
            continue;
        }

        const builtin = !!state.builtin[name];
        const shop = {};

        if (raw.general !== undefined) {
            if (typeof raw.general !== 'boolean') {
                errors.push(`${where}.general: must be true or false`);
            } else {
                shop.general = raw.general;
            }
        }

        for (const field of ['buyMultiplier', 'sellMultiplier', 'delta']) {
            if (raw[field] === undefined) {
                continue;
            }

            if (!isInt(raw[field], 0, 255)) {
                errors.push(`${where}.${field}: integer 0-255`);
            } else {
                shop[field] = raw[field];
            }
        }

        if (raw.restock !== undefined) {
            if (!isInt(raw.restock, 1000, 86400000)) {
                errors.push(`${where}.restock: integer ms 1000-86400000`);
            } else {
                shop.restock = raw.restock;
            }
        }

        if (raw.items !== undefined) {
            shop.items = normalizeItemList(
                world,
                raw.items,
                where,
                errors,
                SHOP_ITEM_CAP,
                0
            );
        } else if (!builtin) {
            errors.push(`${where}: new shops need an items array`);
        }

        out[name] = shop;
    }

    return out;
}

function normalizeVendors(world, vendors, shopNames, errors) {
    const out = [];

    if (vendors === undefined) {
        return out;
    }

    if (!Array.isArray(vendors)) {
        errors.push('vendors: must be an array');
        return out;
    }

    const keys = new Set();

    vendors.forEach((raw, i) => {
        const where = `vendors[${i}]`;

        if (!raw || typeof raw !== 'object') {
            errors.push(`${where}: must be an object`);
            return;
        }

        if (!KEY_RE.test(raw.key || '')) {
            errors.push(`${where}.key: must match ${KEY_RE}`);
            return;
        }

        if (keys.has(raw.key)) {
            errors.push(`${where}.key: duplicate "${raw.key}"`);
            return;
        }

        keys.add(raw.key);

        const vendor = { key: raw.key };

        if (
            !Array.isArray(raw.npcIds) ||
            !raw.npcIds.length ||
            !raw.npcIds.every((id) => isInt(id, 0, npcDefs.length - 1))
        ) {
            errors.push(`${where}.npcIds: non-empty array of valid npc ids`);
        } else {
            vendor.npcIds = raw.npcIds.slice();
        }

        if (raw.at !== undefined) {
            if (
                !Array.isArray(raw.at) ||
                raw.at.length !== 2 ||
                !raw.at.every((n) => isInt(n, 0, 5000))
            ) {
                errors.push(`${where}.at: [x, y]`);
            } else {
                vendor.at = raw.at.slice();
            }
        }

        for (const [field, max] of [
            ['greeting', 80],
            ['shopLabel', 45],
            ['menu', 45]
        ]) {
            if (raw[field] === undefined) {
                continue;
            }

            if (typeof raw[field] !== 'string' || raw[field].length > max) {
                errors.push(`${where}.${field}: string up to ${max} chars`);
            } else {
                vendor[field] = raw[field];
            }
        }

        if (raw.shop !== undefined) {
            if (!shopNames.has(raw.shop)) {
                errors.push(`${where}.shop: unknown shop "${raw.shop}"`);
            } else {
                vendor.shop = raw.shop;
            }
        }

        vendor.offers = [];

        if (raw.offers !== undefined) {
            if (!Array.isArray(raw.offers) || raw.offers.length > MAX_OFFERS) {
                errors.push(`${where}.offers: array of at most ${MAX_OFFERS}`);
            } else {
                raw.offers.forEach((offer, j) => {
                    const at = `${where}.offers[${j}]`;

                    if (
                        !offer ||
                        !isInt(offer.id, 0, items.length - 1) ||
                        !itemUsable(world, offer.id)
                    ) {
                        errors.push(`${at}.id: invalid or members-only item`);
                        return;
                    }

                    if (!isInt(offer.price, 1, 2000000000)) {
                        errors.push(`${at}.price: integer 1-2000000000`);
                        return;
                    }

                    if (
                        typeof offer.label !== 'string' ||
                        !offer.label ||
                        offer.label.length > 50
                    ) {
                        errors.push(`${at}.label: string up to 50 chars`);
                        return;
                    }

                    const clean = {
                        id: offer.id,
                        price: offer.price,
                        label: offer.label
                    };

                    if (offer.limitPerPlayer !== undefined) {
                        if (!isInt(offer.limitPerPlayer, 1, 1000000)) {
                            errors.push(`${at}.limitPerPlayer: integer >= 1`);
                            return;
                        }

                        clean.limitPerPlayer = offer.limitPerPlayer;
                    }

                    vendor.offers.push(clean);
                });
            }
        }

        if (!vendor.shop && !vendor.offers.length) {
            errors.push(`${where}: needs a shop or at least one offer`);
        }

        out.push(vendor);
    });

    return out;
}

function normalizeEvents(world, events, shopNames, errors) {
    const out = [];

    if (events === undefined) {
        return out;
    }

    if (!Array.isArray(events)) {
        errors.push('events: must be an array');
        return out;
    }

    const ids = new Set();

    events.forEach((raw, i) => {
        const where = `events[${i}]`;

        if (!raw || typeof raw !== 'object') {
            errors.push(`${where}: must be an object`);
            return;
        }

        if (!KEY_RE.test(raw.id || '') || ids.has(raw.id)) {
            errors.push(`${where}.id: unique key matching ${KEY_RE}`);
            return;
        }

        ids.add(raw.id);

        if (!isInt(raw.everyMinutes, 1, 10080)) {
            errors.push(`${where}.everyMinutes: integer 1-10080`);
            return;
        }

        const ev = {
            id: raw.id,
            type: raw.type,
            everyMinutes: raw.everyMinutes,
            enabled: raw.enabled !== false
        };

        if (raw.message !== undefined) {
            if (typeof raw.message !== 'string' || raw.message.length > 100) {
                errors.push(`${where}.message: string up to 100 chars`);
                return;
            }

            ev.message = raw.message;
        }

        if (raw.type === 'broadcast') {
            if (!ev.message) {
                errors.push(`${where}.message: required for broadcast`);
                return;
            }
        } else if (raw.type === 'stockDeal') {
            if (!shopNames.has(raw.shop)) {
                errors.push(`${where}.shop: unknown shop`);
                return;
            }

            if (
                !isInt(raw.itemId, 0, items.length - 1) ||
                !itemUsable(world, raw.itemId)
            ) {
                errors.push(`${where}.itemId: invalid or members-only item`);
                return;
            }

            if (!isInt(raw.amount, 1, STACK_CAP)) {
                errors.push(`${where}.amount: integer 1-${STACK_CAP}`);
                return;
            }

            ev.shop = raw.shop;
            ev.itemId = raw.itemId;
            ev.amount = raw.amount;
        } else if (raw.type === 'roamingNpc') {
            if (!isInt(raw.npcId, 0, npcDefs.length - 1)) {
                errors.push(`${where}.npcId: invalid npc id`);
                return;
            }

            if (!isInt(raw.x, 0, 5000) || !isInt(raw.y, 0, 5000)) {
                errors.push(`${where}.x/y: integers`);
                return;
            }

            if (
                !world.members &&
                (raw.x < 48 ||
                    raw.x > 450 ||
                    raw.y % 944 < 128 ||
                    raw.y % 944 > 766)
            ) {
                errors.push(`${where}.x/y: outside the free-to-play area`);
                return;
            }

            const duration =
                raw.durationMinutes === undefined ? 10 : raw.durationMinutes;

            if (!isInt(duration, 1, 1440)) {
                errors.push(`${where}.durationMinutes: integer 1-1440`);
                return;
            }

            const radius = raw.radius === undefined ? 3 : raw.radius;

            if (!isInt(radius, 0, 10)) {
                errors.push(`${where}.radius: integer 0-10`);
                return;
            }

            ev.npcId = raw.npcId;
            ev.x = raw.x;
            ev.y = raw.y;
            ev.durationMinutes = duration;
            ev.radius = radius;
        } else {
            errors.push(
                `${where}.type: broadcast, stockDeal or roamingNpc expected`
            );
            return;
        }

        out.push(ev);
    });

    return out;
}

function normalizeStarterKit(world, raw, errors) {
    const out = clone(DEFAULT_DOC.starterKit);

    if (raw === undefined) {
        return out;
    }

    if (!raw || typeof raw !== 'object') {
        errors.push('starterKit: must be an object');
        return out;
    }

    if (raw.enabled !== undefined) {
        if (typeof raw.enabled !== 'boolean') {
            errors.push('starterKit.enabled: true or false');
        } else {
            out.enabled = raw.enabled;
        }
    }

    if (raw.grantTo !== undefined) {
        if (raw.grantTo !== 'new' && raw.grantTo !== 'all') {
            errors.push('starterKit.grantTo: "new" or "all"');
        } else {
            out.grantTo = raw.grantTo;
        }
    }

    if (raw.message !== undefined) {
        if (typeof raw.message !== 'string' || raw.message.length > 80) {
            errors.push('starterKit.message: string up to 80 chars');
        } else {
            out.message = raw.message;
        }
    }

    if (raw.skipPrefixes !== undefined) {
        if (
            !Array.isArray(raw.skipPrefixes) ||
            raw.skipPrefixes.length > 10 ||
            !raw.skipPrefixes.every(
                (p) => typeof p === 'string' && p.length > 0 && p.length <= 20
            )
        ) {
            errors.push('starterKit.skipPrefixes: up to 10 short strings');
        } else {
            out.skipPrefixes = raw.skipPrefixes.slice();
        }
    }

    if (raw.items !== undefined) {
        out.items = normalizeItemList(
            world,
            raw.items,
            'starterKit',
            errors,
            12
        );
    }

    return out;
}

function normalize(world, raw) {
    const errors = [];

    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return { doc: null, errors: ['document must be a JSON object'] };
    }

    if (raw.version !== undefined && raw.version !== 1) {
        errors.push('version: only 1 is supported');
    }

    const shops = normalizeShops(world, raw.shops, errors);

    const shopNames = new Set([
        ...Object.keys(state.builtin),
        ...Object.keys(shops)
    ]);

    const doc = {
        version: 1,
        shops,
        vendors: normalizeVendors(world, raw.vendors, shopNames, errors),
        events: normalizeEvents(world, raw.events, shopNames, errors),
        starterKit: normalizeStarterKit(world, raw.starterKit, errors)
    };

    return { doc: errors.length ? null : doc, errors };
}

// ---------------------------------------------------------------------------
// shops
// ---------------------------------------------------------------------------

function rebuildItems(world, shop) {
    const previous = new Map(shop.items.map((i) => [i.id, i.amount]));

    shop.items = shop.definition.items
        .filter((d) => itemUsable(world, d.id))
        .map(
            (d) =>
                new Item({
                    id: d.id,
                    amount: previous.has(d.id)
                        ? Math.min(previous.get(d.id), STACK_CAP)
                        : d.amount
                })
        );
}

function setDefinition(world, name, def) {
    const current = shopsData[name];

    if (current) {
        if (JSON.stringify(current) === JSON.stringify(def)) {
            return false;
        }

        for (const key of Object.keys(current)) {
            delete current[key];
        }

        Object.assign(current, def);
    } else {
        shopsData[name] = def;
    }

    let shop = world.shops.get(name);

    if (!shop) {
        shop = new Shop(world, name);
        world.shops.set(name, shop);

        if (!Shop.names.includes(name)) {
            Shop.names.push(name);
        }
    } else {
        rebuildItems(world, shop);
    }

    state.nextRestock.set(name, Date.now() + def.restock);
    shop.updateOccupants();
    return true;
}

function removeShop(world, name) {
    const shop = world.shops.get(name);

    if (shop) {
        for (const occupant of Array.from(shop.occupants)) {
            occupant.exitShop(true);
        }

        world.shops.delete(name);
    }

    delete shopsData[name];
    state.nextRestock.delete(name);

    const at = Shop.names.indexOf(name);

    if (at !== -1) {
        Shop.names.splice(at, 1);
    }
}

function applyShops(world, overlay) {
    const changed = [];

    // revert or remove shops that left the overlay
    for (const name of Array.from(state.applied)) {
        if (name in overlay) {
            continue;
        }

        if (state.builtin[name]) {
            if (setDefinition(world, name, clone(state.builtin[name]))) {
                changed.push(name);
            }
        } else {
            removeShop(world, name);
            changed.push(name);
        }
    }

    for (const [name, o] of Object.entries(overlay)) {
        const base = state.builtin[name]
            ? clone(state.builtin[name])
            : { ...NEW_SHOP_DEFAULTS, items: [] };

        const def = { ...base };

        for (const field of SHOP_FIELDS) {
            if (o[field] !== undefined) {
                def[field] = o[field];
            }
        }

        if (o.items) {
            def.items = o.items.map((i) => ({ id: i.id, amount: i.amount }));
        }

        if (setDefinition(world, name, def)) {
            changed.push(name);
        }
    }

    state.applied = new Set(Object.keys(overlay));
    return changed;
}

function restockTick() {
    const { world } = state;

    if (!world) {
        return;
    }

    const now = Date.now();

    for (const [name, shop] of world.shops) {
        const due = state.nextRestock.get(name) || 0;

        if (now < due) {
            continue;
        }

        state.nextRestock.set(name, now + shop.definition.restock);

        try {
            shop.restock();
        } catch (e) {
            log.error(e);
        }
    }
}

// ---------------------------------------------------------------------------
// vendors (exact-price dialogue offers)
// ---------------------------------------------------------------------------

function findVendor(npc) {
    if (!state.doc) {
        return null;
    }

    return (
        state.doc.vendors.find(
            (v) =>
                v.npcIds.includes(npc.id) &&
                (!v.at || (npc.spawnX === v.at[0] && npc.spawnY === v.at[1]))
        ) || null
    );
}

function boughtCount(player, vendor, offer) {
    const counts = player.cache.vendorBuys || {};
    return counts[`${vendor.key}:${offer.id}`] || 0;
}

function recordBuy(player, vendor, offer) {
    if (!player.cache.vendorBuys) {
        player.cache.vendorBuys = {};
    }

    const key = `${vendor.key}:${offer.id}`;
    player.cache.vendorBuys[key] = boughtCount(player, vendor, offer) + 1;
}

async function offerMenu(player, npc, vendor) {
    for (;;) {
        const choice = await player.ask(
            vendor.offers.map((o) => o.label).concat(['No thanks'])
        );

        if (choice >= vendor.offers.length) {
            return;
        }

        const offer = vendor.offers[choice];

        if (
            offer.limitPerPlayer &&
            boughtCount(player, vendor, offer) >= offer.limitPerPlayer
        ) {
            await npc.say("I can't sell you any more of those");
            continue;
        }

        if (!player.inventory.has(COINS, offer.price)) {
            await npc.say("Sorry, you can't afford that");
            continue;
        }

        const def = items[offer.id];

        if (
            player.inventory.isFull() &&
            !(def.stackable && player.inventory.has(offer.id))
        ) {
            await npc.say("You don't have room to carry that");
            continue;
        }

        player.inventory.remove(COINS, offer.price);
        player.inventory.add(offer.id);
        recordBuy(player, vendor, offer);
        player.sendSound('coins');

        const name = def.name.toLowerCase();
        player.message(`You buy ${/^[aeiou]/.test(name) ? 'an' : 'a'} ${name}`);
    }
}

async function vendorTalk(player, npc) {
    const vendor = findVendor(npc);

    if (!vendor) {
        return false;
    }

    player.engage(npc);

    await npc.say(vendor.greeting || 'Can I help you at all?');

    const options = [];
    const actions = [];

    if (vendor.shop && state.world.shops.has(vendor.shop)) {
        options.push(vendor.shopLabel || 'Yes please. What are you selling?');
        actions.push('shop');
    }

    if (vendor.offers.length) {
        options.push(vendor.menu || 'Do you have any special offers?');
        actions.push('offers');
    }

    options.push('No thanks');

    // ARSC Grand Exchange: a vendor on a general store clerk keeps the clerk's
    // Exchange option (added last; the other indexes are unchanged)
    const exchange = require('./exchange');
    const { CLERK_IDS } = require('./exchange/clerks');
    const choice = CLERK_IDS.has(npc.id)
        ? await exchange.ask(player, npc, options, true)
        : await player.ask(options, true);

    if (choice === exchange.CHOSEN) {
        return true;
    }

    const action = actions[choice];

    if (action === 'shop') {
        await npc.say('Take a look');
        player.disengage();
        player.openShop(vendor.shop);
        return true;
    }

    if (action === 'offers') {
        await npc.say('Certainly! Take your pick');
        await offerMenu(player, npc, vendor);
    }

    player.disengage();
    return true;
}

// ---------------------------------------------------------------------------
// events
// ---------------------------------------------------------------------------

function broadcast(message) {
    let count = 0;

    for (const player of state.world.players.getAll()) {
        player.message(`@yel@${message}`);
        count += 1;
    }

    return count;
}

function despawnEventNpc(id) {
    const npc = state.eventNpcs.get(id);

    if (!npc) {
        return;
    }

    state.eventNpcs.delete(id);

    try {
        state.world.removeEntity('npcs', npc);
    } catch (e) {
        // already gone
    }
}

function runEvent(ev) {
    const { world } = state;

    if (ev.type === 'broadcast') {
        broadcast(ev.message);
    } else if (ev.type === 'stockDeal') {
        const shop = world.shops.get(ev.shop);

        if (!shop) {
            return;
        }

        const existing = shop.items.find((i) => i.id === ev.itemId);

        if (existing) {
            existing.amount = Math.min(STACK_CAP, existing.amount + ev.amount);
        } else if (shop.items.length < SHOP_ITEM_CAP) {
            shop.items.push(new Item({ id: ev.itemId, amount: ev.amount }));
        } else {
            return;
        }

        shop.updateOccupants();

        if (ev.message) {
            broadcast(ev.message);
        }
    } else if (ev.type === 'roamingNpc') {
        if (state.eventNpcs.has(ev.id)) {
            return;
        }

        const npc = new NPC(world, {
            id: ev.npcId,
            x: ev.x,
            y: ev.y,
            minX: ev.x - ev.radius,
            maxX: ev.x + ev.radius,
            minY: ev.y - ev.radius,
            maxY: ev.y + ev.radius
        });

        delete npc.respawn;
        world.addEntity('npcs', npc);
        state.eventNpcs.set(ev.id, npc);

        setTimeout(() => despawnEventNpc(ev.id), ev.durationMinutes * 60000);

        if (ev.message) {
            broadcast(ev.message);
        }
    }
}

function startEvents(events) {
    for (const handle of state.eventHandles) {
        clearInterval(handle);
    }

    state.eventHandles = [];

    const live = new Set(events.filter((e) => e.enabled).map((e) => e.id));

    for (const id of Array.from(state.eventNpcs.keys())) {
        if (!live.has(id)) {
            despawnEventNpc(id);
        }
    }

    for (const ev of events) {
        if (!ev.enabled) {
            continue;
        }

        const handle = setInterval(() => {
            try {
                runEvent(ev);
            } catch (e) {
                log.error(e);
            }
        }, ev.everyMinutes * 60000);

        state.eventHandles.push(handle);
    }
}

// ---------------------------------------------------------------------------
// starter kit and command policy (called from patched upstream files)
// ---------------------------------------------------------------------------

function onLogin(player) {
    try {
        const kit = state.doc && state.doc.starterKit;

        if (!kit || !kit.enabled || !kit.items.length) {
            return;
        }

        if (player.cache.starterKit) {
            return;
        }

        const name = String(player.username || '').toLowerCase();

        if (kit.skipPrefixes.some((p) => name.startsWith(p.toLowerCase()))) {
            return;
        }

        // Tutorial Island: the kit waits for the boat (grantStarterKit), even
        // across logins mid-tutorial
        if (Number.isInteger(player.cache.tutorial)) {
            return;
        }

        if (kit.grantTo === 'new' && player.loginDate) {
            // existing account: never retro-grant, and remember that
            player.cache.starterKit = -1;
            return;
        }

        giveKit(player, kit);
    } catch (e) {
        log.error(e);
    }
}

// the tutorial's boatman and ::skiptutorial: grant now if it is still owed
function grantStarterKit(player) {
    try {
        const kit = state.doc && state.doc.starterKit;

        if (!kit || !kit.enabled || !kit.items.length || player.cache.starterKit) {
            return;
        }

        const name = String(player.username || '').toLowerCase();

        if (kit.skipPrefixes.some((p) => name.startsWith(p.toLowerCase()))) {
            return;
        }

        giveKit(player, kit);
    } catch (e) {
        log.error(e);
    }
}

function giveKit(player, kit) {
    const needed = kit.items.filter((i) => {
        const def = items[i.id];
        return !(def.stackable && player.inventory.has(i.id));
    }).length;

    if (player.inventory.items.length + needed > INVENTORY_CAP) {
        player.message('You have no room for your starter supplies');
        return;
    }

    for (const entry of kit.items) {
        player.inventory.add(entry.id, entry.amount);
    }

    player.cache.starterKit = Date.now();
    player.message(kit.message);
}

function canUseCommands(player) {
    return policyAllows(player, process.env.ARSC_CMD_POLICY || 'open');
}

// The item-creating commands (::item, ::give, ::droprandom) on top of
// canUseCommands: ARSC_MINT_POLICY, same syntax plus list:a,b (exact names).
// Grand Exchange: whoever receives minted goods is barred from the exchange.
function canMint(player) {
    return policyAllows(player, process.env.ARSC_MINT_POLICY || 'open');
}

// The sleep-word bypass (packet-handlers/sleep.js), on when ARSC_SLEEP_ANYWORD=1. ARSC_SLEEP_PREFIX is '*', a bare
// prefix (legacy: 'bot'), or the policy syntax above (prefix:bot;list:tks,everdred): the fleet's named accounts are not
// bot*, and with only the prefix they never woke, sat at 100% fatigue and gained no XP.
function canSkipSleepWord(player) {
    if (process.env.ARSC_SLEEP_ANYWORD !== '1') {
        return false;
    }

    const policy = (process.env.ARSC_SLEEP_PREFIX || 'bot').trim();

    if (policy === '*') {
        return true;
    }

    if (policy === 'open' || /[:;]/.test(policy)) {
        return policyAllows(player, policy);
    }

    return String(player.username || '').toLowerCase().startsWith(policy.toLowerCase());
}

function policyAllows(player, policy) {
    // clauses joined by ';' (prefix:bot;list:zasama): any one allows
    if (policy.includes(';')) {
        return policy
            .split(';')
            .some((clause) => clause.trim() && policyAllows(player, clause.trim()));
    }

    if (policy === 'open') {
        return true;
    }

    if (player.isAdministrator()) {
        return true;
    }

    if (policy.startsWith('prefix:')) {
        const name = String(player.username || '').toLowerCase();
        const prefixes = policy
            .slice(7)
            .split(',')
            .map((p) => p.trim().toLowerCase())
            .filter(Boolean);

        return prefixes.some((p) => name.startsWith(p));
    }

    if (policy.startsWith('list:')) {
        const name = String(player.username || '').toLowerCase();

        return policy
            .slice(5)
            .split(',')
            .some((p) => p.trim().toLowerCase() === name);
    }

    return false;
}

// ---------------------------------------------------------------------------
// document lifecycle
// ---------------------------------------------------------------------------

function applyDoc(doc) {
    const { world } = state;
    const changedShops = applyShops(world, doc.shops);

    state.doc = doc;
    startEvents(doc.events);

    return { changedShops, vendors: doc.vendors.length, events: doc.events.length };
}

function persist(doc) {
    try {
        fs.mkdirSync(path.dirname(WORLD_FILE), { recursive: true });
        const tmp = `${WORLD_FILE}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(doc, null, 2) + '\n');
        fs.renameSync(tmp, WORLD_FILE);
        state.lastMtime = fs.statSync(WORLD_FILE).mtimeMs;
        state.persistError = null;
        return true;
    } catch (e) {
        state.persistError = e.message;
        log.error(e);
        return false;
    }
}

function audit(entry) {
    try {
        fs.appendFileSync(
            path.join(path.dirname(WORLD_FILE), 'audit.log'),
            JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n'
        );
    } catch (e) {
        // audit is best effort
    }
}

function loadFile() {
    let raw;

    try {
        raw = JSON.parse(fs.readFileSync(WORLD_FILE, 'utf8'));
        state.lastMtime = fs.statSync(WORLD_FILE).mtimeMs;
    } catch (e) {
        if (e.code === 'ENOENT') {
            return { missing: true };
        }

        return { errors: [`cannot read ${WORLD_FILE}: ${e.message}`] };
    }

    return normalize(state.world, raw);
}

function pollFile() {
    try {
        const mtime = fs.statSync(WORLD_FILE).mtimeMs;

        if (mtime === state.lastMtime) {
            return;
        }

        state.lastMtime = mtime;
        const result = loadFile();

        if (result.errors && result.errors.length) {
            log.error(`ignoring invalid ${WORLD_FILE}: ${result.errors[0]}`);
            return;
        }

        if (result.doc) {
            const applied = applyDoc(result.doc);
            log.info(`reloaded ${WORLD_FILE}`, applied);
            audit({ source: 'file', ...applied });
        }
    } catch (e) {
        // file missing: keep running with the current document
    }
}

// ---------------------------------------------------------------------------
// HTTP API
// ---------------------------------------------------------------------------

function send(res, status, body) {
    const text = JSON.stringify(body);

    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(text)
    });

    res.end(text);
}

function authorized(req) {
    if (!ADMIN_TOKEN) {
        return 403;
    }

    const header = req.headers.authorization || '';
    const given = Buffer.from(header.replace(/^Bearer\s+/i, ''));
    const want = Buffer.from(ADMIN_TOKEN);

    if (given.length !== want.length) {
        return 401;
    }

    return crypto.timingSafeEqual(given, want) ? 200 : 401;
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;

        req.on('data', (chunk) => {
            size += chunk.length;

            if (size > MAX_BODY) {
                reject(new Error('body too large'));
                req.destroy();
                return;
            }

            chunks.push(chunk);
        });

        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}

function describeShop(name, shop) {
    const def = shop.definition;

    return {
        name,
        overlay: state.applied.has(name),
        builtin: !!state.builtin[name],
        general: !!def.general,
        buyMultiplier: def.buyMultiplier,
        sellMultiplier: def.sellMultiplier,
        delta: def.delta,
        restock: def.restock,
        occupants: shop.occupants.size,
        // default is null for stock that is not part of the shop's regular
        // inventory (items players sold in, or temporary deals)
        items: shop.items.map((item) => {
            const regular = shop.getShopInventory(item);

            return {
                id: item.id,
                name: item.definition.name,
                amount: item.amount,
                default: regular ? regular.amount : null,
                price: shop.getItemPrice(item, false)
            };
        })
    };
}

async function handle(req, res) {
    const url = new URL(req.url, 'http://x');
    const route = url.pathname.replace(/\/+$/, '') || '/';
    const { world } = state;

    if (req.method !== 'GET') {
        const auth = authorized(req);

        if (auth !== 200) {
            send(res, auth, {
                error:
                    auth === 403
                        ? 'admin token not configured'
                        : 'invalid token'
            });
            return;
        }
    }

    if (req.method === 'GET' && route === '/health') {
        send(res, 200, {
            ok: true,
            players: world.players.length,
            shops: world.shops.size,
            file: WORLD_FILE,
            persistError: state.persistError
        });
    } else if (req.method === 'GET' && route === '/world') {
        send(res, 200, state.doc);
    } else if (req.method === 'PUT' && route === '/world') {
        let raw;

        try {
            raw = JSON.parse(await readBody(req));
        } catch (e) {
            send(res, 400, { errors: [`invalid JSON: ${e.message}`] });
            return;
        }

        const { doc, errors } = normalize(world, raw);

        if (errors.length) {
            send(res, 400, { errors });
            return;
        }

        const applied = applyDoc(doc);
        const persisted = persist(doc);
        audit({ source: 'api', persisted, ...applied });

        send(res, 200, {
            ok: true,
            persisted,
            persistError: state.persistError,
            ...applied
        });
    } else if (req.method === 'GET' && route === '/shops') {
        send(
            res,
            200,
            Array.from(world.shops)
                .map(([name, shop]) => describeShop(name, shop))
                .sort((a, b) => a.name.localeCompare(b.name))
        );
    } else if (req.method === 'POST' && /^\/shops\/[^/]+\/restock$/.test(route)) {
        const name = route.split('/')[2];
        const shop = world.shops.get(name);

        if (!shop) {
            send(res, 404, { error: 'unknown shop' });
            return;
        }

        shop.items = [];
        rebuildItems(world, shop);
        shop.updateOccupants();
        send(res, 200, describeShop(name, shop));
    } else if (req.method === 'GET' && route === '/items') {
        const q = (url.searchParams.get('q') || '').toLowerCase();
        const out = [];

        for (let id = 0; id < items.length && out.length < 40; id += 1) {
            const def = items[id];

            if (
                def &&
                (!q || def.name.toLowerCase().includes(q) || String(id) === q)
            ) {
                out.push({
                    id,
                    name: def.name,
                    price: def.price,
                    members: !!def.members,
                    stackable: !!def.stackable
                });
            }
        }

        send(res, 200, out);
    } else if (req.method === 'GET' && route === '/players') {
        send(
            res,
            200,
            world.players
                .getAll()
                .map((p) => ({ username: p.username, x: p.x, y: p.y }))
        );
    } else if (req.method === 'POST' && route === '/broadcast') {
        let body;

        try {
            body = JSON.parse(await readBody(req));
        } catch (e) {
            send(res, 400, { error: 'invalid JSON' });
            return;
        }

        if (
            !body ||
            typeof body.message !== 'string' ||
            !body.message ||
            body.message.length > 100
        ) {
            send(res, 400, { error: 'message: string up to 100 chars' });
            return;
        }

        audit({ source: 'api', broadcast: body.message });
        send(res, 200, { ok: true, sentTo: broadcast(body.message) });
    } else if (route.startsWith('/exchange/')) {
        // ARSC Grand Exchange: GETs public, POST /exchange/stake behind the token
        const out = await require('./exchange').handleHttp(
            world,
            req.method,
            route,
            url,
            () => readBody(req)
        );

        send(res, out.status, out.body);
    } else if (req.method === 'POST' && /^\/events\/[^/]+\/run$/.test(route)) {
        const ev = state.doc.events.find((e) => e.id === route.split('/')[2]);

        if (!ev) {
            send(res, 404, { error: 'unknown event' });
            return;
        }

        runEvent(ev);
        send(res, 200, { ok: true });
    } else {
        send(res, 404, { error: 'not found' });
    }
}

function startHttp() {
    const server = http.createServer((req, res) => {
        handle(req, res).catch((e) => {
            log.error(e);

            if (!res.headersSent) {
                send(res, 500, { error: e.message });
            }
        });
    });

    server.on('error', (e) => log.error(e));
    server.listen(ADMIN_PORT, '0.0.0.0', () => {
        log.info(
            `admin api on :${ADMIN_PORT} (mutations ${
                ADMIN_TOKEN ? 'enabled' : 'disabled: set ARSC_ADMIN_TOKEN'
            })`
        );
    });
}

// ---------------------------------------------------------------------------
// entry point
// ---------------------------------------------------------------------------

function start(server) {
    const world = server.world;

    state.world = world;
    state.builtin = clone(shopsData);

    let loaded = loadFile();

    if (loaded.missing) {
        loaded = normalize(world, clone(DEFAULT_DOC));
        persist(loaded.doc);
        log.info(`wrote default ${WORLD_FILE}`);
    }

    if (!loaded.doc) {
        try {
            fs.copyFileSync(WORLD_FILE, `${WORLD_FILE}.invalid`);
        } catch (e) {
            // nothing to keep
        }

        log.error(
            `invalid ${WORLD_FILE}, using defaults: ${(loaded.errors || [])[0]}`
        );
        loaded = normalize(world, clone(DEFAULT_DOC));
    }

    const applied = applyDoc(loaded.doc);
    log.info('world-admin ready', applied);

    // run before upstream NPC plugins so overlay vendors win
    world.plugins.get('onTalkToNPC').unshift(vendorTalk);

    for (const [name, shop] of world.shops) {
        state.nextRestock.set(name, Date.now() + shop.definition.restock);
    }

    setInterval(restockTick, 1000);
    setInterval(pollFile, POLL_MS);
    startHttp();
}

module.exports = {
    start,
    onLogin,
    grantStarterKit,
    canUseCommands,
    canMint,
    canSkipSleepWord,
    normalize,
    vendorTalk,
    _state: state
};
