// ARSC Grand Exchange: the pure parts (no world, no data server). The contract
// is docs/GRAND_EXCHANGE.md in Autonomous-RSC.

const items = require('@2003scape/rsc-data/config/items');

const COINS = 10;
const SLOTS = 8;
const CLERK_RANGE = 6;
const COLLECT_SENT = 16;
const MAX_INT = 2147483647;
const ACTION_MS = 600;

// the [GE] chat line every reply carries, for bots (no colour codes)
function line(kind, ...fields) {
    return ['[GE]', kind, ...fields].join(' ');
}

function itemName(id) {
    return items[id] ? items[id].name : `item ${id}`;
}

// null when it can be listed, else the refusal code
function listable(id, members) {
    const def = items[id];

    if (!def || id === COINS) {
        return 'UNTRADEABLE';
    }

    if (def.untradeable) {
        return 'UNTRADEABLE';
    }

    if (def.members && !members) {
        return 'UNTRADEABLE';
    }

    return null;
}

// an id, or a name (exact first, then a substring); { id } or { error, matches }
function resolveItem(text, members = true) {
    const query = String(text || '').trim().toLowerCase().replace(/_/g, ' ');

    if (!query) {
        return { error: 'NOT_FOUND', matches: [] };
    }

    if (/^\d+$/.test(query)) {
        const id = +query;
        return items[id] ? { id } : { error: 'NOT_FOUND', matches: [] };
    }

    const usable = [];

    for (let id = 0; id < items.length; id += 1) {
        if (items[id] && !listable(id, members)) {
            usable.push(id);
        }
    }

    const exact = usable.filter((id) => items[id].name.toLowerCase() === query);

    if (exact.length) {
        return { id: exact[0] };
    }

    const partial = usable.filter((id) =>
        items[id].name.toLowerCase().includes(query)
    );

    if (partial.length === 1) {
        return { id: partial[0] };
    }

    return {
        error: partial.length ? 'AMBIGUOUS' : 'NOT_FOUND',
        matches: partial.slice(0, 3)
    };
}

// an integer, guide, bid, ask, +N% or -N% of the guide; quote: { guide, bid, ask }
function resolvePrice(text, quote) {
    const word = String(text || '').toLowerCase();
    const guide = quote.guide || 1;

    if (/^\d+$/.test(word)) {
        return +word;
    }

    if (word === 'guide') {
        return guide;
    }

    if (word === 'bid') {
        return quote.bid || guide;
    }

    if (word === 'ask') {
        return quote.ask || guide;
    }

    const percent = /^([+-])(\d{1,3})%$/.exec(word);

    if (percent) {
        const delta = (percent[1] === '-' ? -1 : 1) * +percent[2];
        return Math.max(1, Math.round((guide * (100 + delta)) / 100));
    }

    return null;
}

// ::ge args -> { op, ... } or { error }
function parseCommand(args) {
    const words = args.map((word) => String(word)).filter(Boolean);
    const op = (words.shift() || 'help').toLowerCase();

    switch (op) {
        case 'open':
        case 'close':
        case 'offers':
        case 'help':
            return { op };
        case 'collect':
            return { op, bank: (words[0] || '').toLowerCase() === 'bank' };
        case 'cancel': {
            const slot = +words[0];

            if (!Number.isInteger(slot) || slot < 1 || slot > SLOTS) {
                return { error: 'usage: ::ge cancel <slot 1-8>' };
            }

            return { op, slot: slot - 1 };
        }
        case 'price':
            if (!words.length) {
                return { error: 'usage: ::ge price <item>' };
            }

            return { op, item: words.join(' ') };
        case 'buy':
        case 'sell': {
            if (words.length < 3) {
                return {
                    error: `usage: ::ge ${op} <item> <quantity> <price>`
                };
            }

            const price = words.pop();
            const qtyWord = words.pop().toLowerCase();
            const all = op === 'sell' && qtyWord === 'all';
            const qty = all ? 0 : +qtyWord;

            if (!all && (!Number.isInteger(qty) || qty < 1 || qty > MAX_INT)) {
                return { error: 'the quantity must be a whole number' };
            }

            return { op, item: words.join(' '), qty, all, price };
        }
        default:
            return { error: `unknown ::ge command ${op}` };
    }
}

// the slots of an EXCHANGE_STATE from the data server's open offers
function slotsFrom(offers) {
    const slots = [];

    for (let i = 0; i < SLOTS; i += 1) {
        slots.push({ state: 0, itemId: 0, qty: 0, filled: 0, price: 0 });
    }

    for (const offer of offers || []) {
        if (offer.state === 'open' && offer.slot >= 0 && offer.slot < SLOTS) {
            slots[offer.slot] = {
                state: offer.side === 'buy' ? 1 : 2,
                itemId: offer.itemId,
                qty: offer.qty,
                filled: offer.filled,
                price: offer.price
            };
        }
    }

    return slots;
}

const REFUSALS = {
    FAR: 'You need to be near a general store clerk to use the Exchange.',
    BARRED: 'The Exchange does not deal with conjured goods.',
    SLOTS: 'All 8 of your Exchange slots are in use.',
    NO_ITEM: "You don't have that to sell.",
    NO_COINS: "You don't have enough coins.",
    UNTRADEABLE: "The Exchange won't take that item.",
    PRICE_BAND: 'That price is too far from the guide price.',
    LIMIT: "You've reached the Exchange buy limit for that item for now.",
    BUSY: 'One thing at a time, please.',
    INV_FULL: "You don't have room for that.",
    NOT_FOUND: "There's nothing like that on the Exchange.",
    AMBIGUOUS: 'Which one do you mean?',
    DOWN: 'The Exchange is closed for the moment. Try again soon.',
    VOID: 'The Exchange lost track of that; nothing was traded.'
};

function refusal(code, extra = '') {
    return line('refused', code, (REFUSALS[code] || code) + extra);
}

module.exports = {
    COINS,
    SLOTS,
    CLERK_RANGE,
    COLLECT_SENT,
    MAX_INT,
    ACTION_MS,
    REFUSALS,
    line,
    itemName,
    listable,
    resolveItem,
    resolvePrice,
    parseCommand,
    slotsFrom,
    refusal
};
