// ARSC Grand Exchange: the game-server side of the order book. The data server
// owns offers, matching and the collection box; this module holds escrow,
// clerks, ::ge, the panel packets and the admin routes. The contract is
// docs/GRAND_EXCHANGE.md in Autonomous-RSC.
//
// Every write that moves items carries the player's save snapshot, so the
// data server commits the inventory and the offer in one transaction, and it
// runs through player.serialWrite, so no other save of that player can land
// in between. A write the data server does not answer is never rolled back
// blind: exchangeVoid settles it first.

const crypto = require('crypto');
const items = require('@2003scape/rsc-data/config/items');
const log = require('bole')('exchange');
const R = require('./rules');
const { clerkNear } = require('./clerks');

// timings (tests shorten them)
const config = { requestMs: 15000, voidRetryMs: 5000, voidRetryMaxMs: 30000 };
const CLOSE_CHECK_MS = 2000;
const INVENTORY_SLOTS = 30;
const STAKE_MAX = 1000000;

const EXCHANGE_OPTION = "I'd like to use the Exchange";
const CHOSEN = -1;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// one data-server call: its reply, { down } when it was never sent (the data
// client is disconnected), { timeout } when no reply came in time
async function request(world, message, ms = config.requestMs) {
    const sent = world.server.dataClient.sendAndReceive(message);

    if (!sent) {
        return { down: true };
    }

    let timer;

    const timeout = new Promise((resolve) => {
        timer = setTimeout(() => resolve({ timeout: true }), ms);
    });

    const reply = await Promise.race([sent, timeout]);
    clearTimeout(timer);

    return reply || { timeout: true };
}

// a write; on no reply, settles the opId with exchangeVoid (retrying until the
// data server answers) and returns the outcome that stands
async function write(world, playerId, message) {
    const opId = crypto.randomUUID();
    const reply = await request(world, { ...message, opId });

    if (reply.down) {
        return { success: false, code: 'DOWN' };
    }

    if (!reply.timeout) {
        return reply;
    }

    log.warn(`no reply to ${message.handler} ${opId}, settling it`);

    for (let wait = config.voidRetryMs; ; wait = Math.min(wait * 2, config.voidRetryMaxMs)) {
        const settled = await request(world, {
            handler: 'exchangeVoid',
            opId,
            playerId,
            refund: []
        });

        if (settled.success) {
            return settled.voided
                ? { success: false, code: 'VOID' }
                : settled.result;
        }

        await sleep(wait);
    }
}

function saveFields(player) {
    const { handler, ...save } = player.getSaveMessage();
    return save;
}

// ---------------------------------------------------------------------------
// inventory helpers (equipped items are never escrowed)
// ---------------------------------------------------------------------------

function isStackable(id) {
    return !!(items[id] && items[id].stackable);
}

function held(player, id) {
    if (isStackable(id)) {
        return player.inventory.count(id);
    }

    return player.inventory.items.filter(
        (item) => item.id === id && !item.equipped
    ).length;
}

function take(player, id, amount) {
    const { inventory } = player;

    if (isStackable(id)) {
        inventory.remove(id, amount);
        return;
    }

    for (let i = inventory.items.length - 1; i >= 0 && amount > 0; i -= 1) {
        const item = inventory.items[i];

        if (item.id === id && !item.equipped) {
            inventory.items.splice(i, 1);
            inventory.updateEquipmentIndexes(i);
            inventory.sendRemove(i);
            amount -= 1;
        }
    }
}

// how many of { id, amount } the inventory takes, given `slots` free slots
function fitsInventory(player, id, amount, slots) {
    if (isStackable(id)) {
        const hasStack = player.inventory.items.some((item) => item.id === id);
        return hasStack || slots > 0 ? amount : 0;
    }

    return Math.min(amount, slots);
}

function freeSlots(player) {
    return Math.max(0, INVENTORY_SLOTS - player.inventory.items.length);
}

// give items back (a refused escrow): inventory, then bank, then the ground
function giveBack(player, id, amount) {
    const fit = fitsInventory(player, id, amount, freeSlots(player));

    if (fit > 0) {
        player.inventory.add(id, fit);
        amount -= fit;
    }

    if (amount > 0 && player.bank.add(id, amount)) {
        player.message(`Your ${R.itemName(id)} went to your bank`);
        amount = 0;
    }

    if (amount > 0) {
        player.inventory.add(id, amount); // drops what does not fit
    }
}

// ---------------------------------------------------------------------------
// state and messages
// ---------------------------------------------------------------------------

function isBarred(player) {
    return !!(player.cache && player.cache.minted);
}

function findOnline(world, playerId) {
    for (const player of world.players.getAll()) {
        if (player.id === playerId && player.loggedIn) {
            return player;
        }
    }

    return null;
}

async function fetchState(player) {
    const reply = await request(player.world, {
        handler: 'exchangeState',
        playerId: player.id
    });

    return reply && reply.success ? reply : null;
}

async function sendState(player, open = false) {
    const state = await fetchState(player);

    if (!state) {
        return null;
    }

    const inRange = !!clerkNear(player, R.CLERK_RANGE);

    player.send({
        type: 'exchangeState',
        flags: (open ? 1 : 0) | (isBarred(player) ? 2 : 0) | (inRange ? 4 : 0),
        coins: player.inventory.count(R.COINS),
        slots: R.slotsFrom(state.offers),
        collect: state.collect.slice(0, R.COLLECT_SENT)
    });

    return state;
}

async function refreshPanel(player) {
    if (player.exchangeOpen) {
        await sendState(player);
    }
}

function describeOffer(offer) {
    const verb = offer.side === 'buy' ? 'buy' : 'sell';
    return (
        `${verb} ${offer.qty} ${R.itemName(offer.itemId)} at ${offer.price} ` +
        `each: ${offer.filled}/${offer.qty} done`
    );
}

// tell the owner of a counterparty offer a fill touched (when online)
function notifyCounterparties(world, notify) {
    for (const entry of notify || []) {
        const player = findOnline(world, entry.playerId);

        if (!player) {
            continue;
        }

        player.message(
            R.line(
                'filled',
                entry.slot + 1,
                entry.itemId,
                `${entry.filled}/${entry.qty}`,
                entry.price
            )
        );

        if (entry.state === 'done') {
            player.message(R.line('done', entry.slot + 1, entry.itemId));
            player.message(
                `Exchange: your offer to ${describeOffer(entry)}. ` +
                    'Collect it from any general store clerk.'
            );
        } else {
            player.message(`Exchange: your offer to ${describeOffer(entry)}`);
        }

        refreshPanel(player).catch((e) => log.error(e));
    }
}

function refuse(player, code, extra) {
    player.message(R.refusal(code, extra));
    return { success: false, code };
}

// null when the player may act now, else a refusal code
function blocked(player) {
    if (player.exchangeBusy) {
        return 'BUSY';
    }

    if (Date.now() - (player.exchangeLast || 0) < R.ACTION_MS) {
        return 'BUSY';
    }

    if (!clerkNear(player, R.CLERK_RANGE)) {
        return 'FAR';
    }

    return null;
}

async function busy(player, fn) {
    player.exchangeBusy = true;

    try {
        return await fn();
    } finally {
        player.exchangeBusy = false;
        player.exchangeLast = Date.now();
    }
}

async function quoteFor(player, itemId) {
    const reply = await request(player.world, {
        handler: 'exchangePrices',
        itemIds: [itemId],
        playerId: player.id,
        stackable: { [itemId]: isStackable(itemId) }
    });

    if (!reply || !reply.success) {
        return null;
    }

    const quote = (reply.items || {})[itemId] || {};
    const base = Math.max(1, (items[itemId] && items[itemId].price) || 1);

    return {
        itemId,
        guide: quote.guide || base,
        traded: quote.guide != null,
        bid: quote.bid || 0,
        ask: quote.ask || 0,
        vol24: quote.vol24 || 0,
        limitLeft: quote.limitLeft == null ? 0 : quote.limitLeft
    };
}

// ---------------------------------------------------------------------------
// actions
// ---------------------------------------------------------------------------

async function place(player, { side, itemId, qty, all, price }) {
    const { world } = player;

    if (isBarred(player)) {
        return refuse(player, 'BARRED');
    }

    const unlisted = R.listable(itemId, world.members);

    if (unlisted) {
        return refuse(player, unlisted);
    }

    if (all) {
        qty = held(player, itemId);

        if (!qty) {
            return refuse(player, 'NO_ITEM');
        }
    }

    if (price < 1 || qty < 1 || qty * price > R.MAX_INT) {
        return refuse(player, 'PRICE_BAND');
    }

    const escrow =
        side === 'sell'
            ? { id: itemId, amount: qty }
            : { id: R.COINS, amount: qty * price };

    const reply = await player.serialWrite(async () => {
        // checked now: the chain may have waited behind another write
        if (side === 'sell' && held(player, itemId) < qty) {
            return { success: false, code: 'NO_ITEM' };
        }

        if (side === 'buy' && player.inventory.count(R.COINS) < escrow.amount) {
            return { success: false, code: 'NO_COINS' };
        }

        take(player, escrow.id, escrow.amount);

        const result = await write(world, player.id, {
            handler: 'exchangePlace',
            save: saveFields(player),
            offer: {
                playerId: player.id,
                username: player.username,
                side,
                itemId,
                qty,
                price,
                basePrice: Math.max(1, items[itemId].price || 1),
                stackable: isStackable(itemId)
            }
        });

        if (!result || !result.success) {
            giveBack(player, escrow.id, escrow.amount);
        }

        return result || { success: false, code: 'DOWN' };
    });

    if (!reply.success) {
        return refuse(player, reply.code);
    }

    const { offer } = reply;
    const fills = reply.fills || [];

    player.message(R.line('placed', offer.slot + 1, side, itemId, qty, price));

    if (offer.filled > 0) {
        const last = fills[fills.length - 1];

        player.message(
            R.line(
                'filled',
                offer.slot + 1,
                itemId,
                `${offer.filled}/${offer.qty}`,
                last ? last.price : price
            )
        );
    }

    if (offer.state === 'done') {
        player.message(R.line('done', offer.slot + 1, itemId));
    }

    player.message(`Exchange: offer to ${describeOffer(offer)}`);

    notifyCounterparties(world, reply.notify);
    await refreshPanel(player);

    return reply;
}

async function cancel(player, slot) {
    const reply = await write(player.world, player.id, {
        handler: 'exchangeCancel',
        playerId: player.id,
        slot
    });

    if (!reply.success) {
        return refuse(player, reply.code);
    }

    player.message(R.line('cancelled', slot + 1, reply.offer.itemId));
    player.message(
        `Exchange: cancelled your offer to ${describeOffer(reply.offer)}. ` +
            'What was left waits in your collection box.'
    );

    await refreshPanel(player);
    return reply;
}

async function collect(player, toBank = false) {
    const { world } = player;

    const outcome = await player.serialWrite(async () => {
        const state = await fetchState(player);

        if (!state) {
            return { reply: { success: false, code: 'DOWN' } };
        }

        if (!state.collect.length) {
            return { reply: { success: true }, claim: [] };
        }

        const claim = [];
        let slots = freeSlots(player);

        for (const { itemId, amount } of state.collect) {
            let fit;

            if (toBank) {
                fit = player.bank.room(itemId) ? amount : 0;
            } else {
                fit = fitsInventory(player, itemId, amount, slots);

                const newStack =
                    isStackable(itemId) &&
                    !player.inventory.items.some((item) => item.id === itemId);

                slots -= isStackable(itemId) ? (newStack && fit ? 1 : 0) : fit;
            }

            if (fit > 0) {
                claim.push({ itemId, amount: fit });
            }
        }

        if (!claim.length) {
            return { reply: { success: false, code: 'INV_FULL' } };
        }

        for (const { itemId, amount } of claim) {
            if (toBank) {
                player.bank.add(itemId, amount);
            } else {
                player.inventory.add(itemId, amount);
            }
        }

        const reply = await write(world, player.id, {
            handler: 'exchangeCollect',
            save: saveFields(player),
            playerId: player.id,
            claim
        });

        if (!reply || !reply.success) {
            for (const { itemId, amount } of claim) {
                if (toBank) {
                    player.bank.take(itemId, amount);
                } else {
                    take(player, itemId, amount);
                }
            }
        }

        return { reply: reply || { success: false, code: 'DOWN' }, claim };
    });

    if (!outcome.reply.success) {
        return refuse(player, outcome.reply.code);
    }

    if (!outcome.claim.length) {
        player.message('Exchange: there is nothing waiting for you.');
        return outcome.reply;
    }

    player.message(
        R.line(
            'collected',
            ...outcome.claim.flatMap(({ itemId, amount }) => [itemId, amount])
        )
    );

    const left = (outcome.reply.collect || []).length;

    player.message(
        `Exchange: collected ${outcome.claim
            .map(({ itemId, amount }) => `${amount} ${R.itemName(itemId)}`)
            .join(', ')}${toBank ? ' into your bank' : ''}` +
            (left ? '. More is waiting when you have room.' : '')
    );

    await refreshPanel(player);
    return outcome.reply;
}

async function listOffers(player) {
    const state = await fetchState(player);

    if (!state) {
        return refuse(player, 'DOWN');
    }

    const open = state.offers.filter((offer) => offer.state === 'open');

    if (!open.length) {
        player.message('Exchange: you have no open offers.');
    }

    for (const offer of open) {
        player.message(`Exchange slot ${offer.slot + 1}: ${describeOffer(offer)}`);
    }

    if (state.collect.length) {
        player.message(
            'Exchange: waiting to collect: ' +
                state.collect
                    .map(({ itemId, amount }) => `${amount} ${R.itemName(itemId)}`)
                    .join(', ')
        );
    }

    return state;
}

function quoteText(quote) {
    const name = R.itemName(quote.itemId);

    if (!quote.traded && !quote.bid && !quote.ask) {
        return `${name}: not traded yet (shop value ${quote.guide})`;
    }

    return (
        `${name}: guide ${quote.guide}, buyers at ${quote.bid || '-'}, ` +
        `sellers at ${quote.ask || '-'}, ${quote.vol24} traded today`
    );
}

async function priceCheck(player, itemId) {
    const quote = await quoteFor(player, itemId);

    if (!quote) {
        return refuse(player, 'DOWN');
    }

    player.send({ type: 'exchangeQuote', ...quote });
    player.message(
        R.line('quote', itemId, quote.guide, quote.bid, quote.ask, quote.vol24)
    );
    player.message(`Exchange: ${quoteText(quote)}`);

    return quote;
}

async function open(player) {
    player.exchangeOpen = true;

    const state = await sendState(player, true);

    if (!state) {
        player.exchangeOpen = false;
        return refuse(player, 'DOWN');
    }

    return state;
}

function close(player) {
    if (player.exchangeOpen) {
        player.exchangeOpen = false;
        player.send({ type: 'exchangeClose' });
    }
}

const HELP = [
    'Exchange: ::ge buy <item> <quantity> <price>, ::ge sell <item> <quantity|all> <price>',
    'price: a number, guide, bid, ask, +5% or -5%. Also ::ge offers, ::ge cancel <slot>,',
    '::ge collect [bank], ::ge price <item>, ::ge open. Only near a general store clerk.'
];

// ::ge <args>
async function command(player, args) {
    const parsed = R.parseCommand(args || []);

    if (parsed.error) {
        player.message(R.line('refused', 'USAGE', parsed.error));
        return;
    }

    if (parsed.op === 'help') {
        player.message(...HELP);
        return;
    }

    if (parsed.op === 'close') {
        close(player);
        return;
    }

    const why = blocked(player);

    if (why) {
        refuse(player, why);
        return;
    }

    try {
        await busy(player, () => run(player, parsed));
    } catch (e) {
        log.error(e);
        refuse(player, 'DOWN');
    }
}

async function run(player, parsed) {
    switch (parsed.op) {
        case 'open':
            return open(player);
        case 'offers':
            return listOffers(player);
        case 'collect':
            return collect(player, parsed.bank);
        case 'cancel':
            return cancel(player, parsed.slot);
        case 'price': {
            const found = R.resolveItem(parsed.item, player.world.members);

            if (found.error) {
                return refuse(player, found.error, matchList(found.matches));
            }

            return priceCheck(player, found.id);
        }
        case 'buy':
        case 'sell': {
            const found = R.resolveItem(parsed.item, player.world.members);

            if (found.error) {
                return refuse(player, found.error, matchList(found.matches));
            }

            let price = R.resolvePrice(parsed.price, {});

            if (!/^\d+$/.test(parsed.price)) {
                const quote = await quoteFor(player, found.id);

                if (!quote) {
                    return refuse(player, 'DOWN');
                }

                price = R.resolvePrice(parsed.price, quote);
            }

            if (price == null) {
                player.message(
                    R.line(
                        'refused',
                        'USAGE',
                        'price: a number, guide, bid, ask, +N% or -N%'
                    )
                );
                return null;
            }

            return place(player, {
                side: parsed.op,
                itemId: found.id,
                qty: parsed.qty,
                all: parsed.all,
                price
            });
        }
    }

    return null;
}

function matchList(matches) {
    return matches && matches.length
        ? ` (${matches.map((id) => `${R.itemName(id)} = ${id}`).join(', ')})`
        : '';
}

// ---------------------------------------------------------------------------
// clerk dialogue: the general store plugins call ask() for their first menu
// ---------------------------------------------------------------------------

// player.ask with "I'd like to use the Exchange" added last; CHOSEN when the
// player picked it (the Exchange talk ran and disengaged)
async function ask(player, npc, options, repeat) {
    const choice = await player.ask([...options, EXCHANGE_OPTION], repeat);

    if (choice !== options.length) {
        return choice;
    }

    await talk(player, npc);
    return CHOSEN;
}

async function talk(player, npc) {
    await npc.say(
        'Of course. Any clerk can take your offers to the Exchange',
        'for a cut of 2 coins in every 100 on a sale'
    );

    const choice = await player.ask(
        [
            'Open the Exchange',
            'What are my offers?',
            'I want to collect my items',
            'What would my things fetch?',
            'Never mind'
        ],
        false
    );

    player.disengage();

    const action = {
        0: () => open(player),
        1: () => listOffers(player),
        2: () => collect(player, false),
        3: () => priceCarried(player)
    }[choice];

    if (!action) {
        return;
    }

    const why = blocked(player);

    if (why) {
        refuse(player, why);
        return;
    }

    try {
        await busy(player, action);
    } catch (e) {
        log.error(e);
        refuse(player, 'DOWN');
    }
}

async function priceCarried(player) {
    const ids = [
        ...new Set(player.inventory.items.map((item) => item.id))
    ].filter((id) => !R.listable(id, player.world.members));

    if (!ids.length) {
        player.message("Exchange: you're not carrying anything it trades.");
        return null;
    }

    for (const id of ids.slice(0, 8)) {
        const quote = await quoteFor(player, id);

        if (!quote) {
            return refuse(player, 'DOWN');
        }

        player.message(`Exchange: ${quoteText(quote)}`);
    }

    return ids;
}

// ---------------------------------------------------------------------------
// hooks
// ---------------------------------------------------------------------------

async function onLogin(player) {
    try {
        const state = await fetchState(player);

        if (state && state.collect.length) {
            player.message(
                'You have items waiting at the Exchange: ask any general ' +
                    'store clerk.'
            );
        }
    } catch (e) {
        log.error(e);
    }
}

// a completed trade between a minted and an unminted account (logged only)
function onTrade(playerA, playerB, offerA, offerB) {
    if (isBarred(playerA) === isBarred(playerB)) {
        return;
    }

    const [from, to, goods] = isBarred(playerA)
        ? [playerA, playerB, offerA]
        : [playerB, playerA, offerB];

    for (const { id, amount } of goods) {
        request(from.world, {
            handler: 'exchangeLog',
            kind: 'taint_trade',
            playerId: to.id,
            itemId: id,
            amount,
            note: `from ${from.username}`
        }).catch((e) => log.error(e));
    }
}

function init(world) {
    setInterval(() => {
        for (const player of world.players.getAll()) {
            if (player.exchangeOpen && !clerkNear(player, R.CLERK_RANGE)) {
                close(player);
            }
        }
    }, CLOSE_CHECK_MS);
}

// ---------------------------------------------------------------------------
// admin API (world-admin.js): { status, body } or null when not ours
// ---------------------------------------------------------------------------

function strip(reply) {
    const { token, handler, ...body } = reply;
    return body;
}

async function handleHttp(world, method, route, url, readBody) {
    const parts = route.split('/').filter(Boolean); // exchange, what, arg

    if (parts[0] !== 'exchange') {
        return null;
    }

    const read = async (message) => {
        const reply = await request(world, message);

        if (reply.down || reply.timeout) {
            return { status: 503, body: { error: 'data server unavailable' } };
        }

        return { status: reply.success ? 200 : 400, body: strip(reply) };
    };

    const itemArg = () => {
        const found = R.resolveItem(decodeURIComponent(parts[2] || ''), world.members);
        return found.error ? null : found.id;
    };

    if (method === 'GET' && parts[1] === 'prices' && parts.length === 2) {
        const ids = (url.searchParams.get('ids') || '')
            .split(',')
            .filter((id) => /^\d+$/.test(id))
            .map(Number);

        return read(
            ids.length
                ? { handler: 'exchangePrices', itemIds: ids }
                : { handler: 'exchangePrices' }
        );
    }

    if (method === 'GET' && parts[1] === 'book' && parts.length === 3) {
        const itemId = itemArg();

        if (itemId == null) {
            return { status: 404, body: { error: 'unknown item' } };
        }

        return read({
            handler: 'exchangeBook',
            itemId,
            depth: Math.min(50, +url.searchParams.get('depth') || 10)
        });
    }

    if (method === 'GET' && parts[1] === 'history' && parts.length === 3) {
        const itemId = itemArg();

        if (itemId == null) {
            return { status: 404, body: { error: 'unknown item' } };
        }

        return read({
            handler: 'exchangeHistory',
            itemId,
            hours: Math.min(24 * 30, +url.searchParams.get('hours') || 24)
        });
    }

    if (method === 'GET' && parts[1] === 'offers' && parts.length === 3) {
        return read({
            handler: 'exchangeState',
            username: decodeURIComponent(parts[2])
        });
    }

    if (method === 'GET' && parts[1] === 'ledger' && parts.length === 2) {
        return read({
            handler: 'exchangeLedger',
            since: +url.searchParams.get('since') || 0
        });
    }

    if (method === 'POST' && parts[1] === 'stake' && parts.length === 2) {
        let body;

        try {
            body = JSON.parse(await readBody());
        } catch (e) {
            return { status: 400, body: { error: 'invalid JSON' } };
        }

        const coins = body && body.coins;

        if (
            !body ||
            typeof body.user !== 'string' ||
            !Number.isInteger(coins) ||
            coins < 1 ||
            coins > STAKE_MAX
        ) {
            return {
                status: 400,
                body: { error: `user: string, coins: 1..${STAKE_MAX}` }
            };
        }

        const reply = await write(world, 0, {
            handler: 'exchangeStake',
            username: body.user,
            coins,
            note: String(body.note || '').slice(0, 100)
        });

        if (reply.success) {
            const online = world.getPlayerByUsername(body.user);

            if (online) {
                online.message(
                    `Exchange: ${coins} coins wait for you in your collection box.`
                );
            }
        }

        return {
            status: reply.success ? 200 : reply.code === 'NOT_FOUND' ? 404 : 400,
            body: strip(reply)
        };
    }

    return { status: 404, body: { error: 'not found' } };
}

module.exports = {
    CHOSEN,
    EXCHANGE_OPTION,
    ask,
    talk,
    command,
    onLogin,
    onTrade,
    init,
    handleHttp,
    // tests
    _config: config,
    _request: request,
    _write: write,
    _place: place,
    _collect: collect,
    _held: held
};
