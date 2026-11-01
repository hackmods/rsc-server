'use strict';

// Amounts must fit the signed stack integer understood by the clients.
const MAX_AMOUNT = 2147483647;
const own = (object, property) => Object.prototype.hasOwnProperty.call(object, property);

function planPreset({ inventory, bank, preset, items, capacity = 30, bankCapacity }) {
    if (!items || typeof items !== 'object') {
        throw new Error('Invalid item definitions');
    }
    for (const [name, value] of [['inventory capacity', capacity], ['bank capacity', bankCapacity]]) {
        if (!Number.isSafeInteger(value) || value < 0 || value > MAX_AMOUNT) {
            throw new Error(`Invalid ${name}`);
        }
    }

    function rows(list, name, limit, isBank) {
        if (!Array.isArray(list) || list.length > limit) {
            throw new Error(`Invalid ${name} size`);
        }
        const seen = new Set();
        return Array.from(list, row => {
            if (!row || typeof row !== 'object' || !own(row, 'id') ||
                !Number.isSafeInteger(row.id) || row.id < 0 ||
                !own(items, row.id) || !items[row.id] || typeof items[row.id] !== 'object') {
                throw new Error(`Invalid ${name} item id`);
            }
            const id = row.id;
            const amount = row.amount === undefined ? 1 : row.amount;
            const equipped = row.equipped === undefined ? false : row.equipped;
            if (!Number.isSafeInteger(amount) || amount < 1 || amount > MAX_AMOUNT) {
                throw new Error(`Invalid ${name} item amount`);
            }
            if (typeof equipped !== 'boolean' || (isBank && equipped)) {
                throw new Error(`Invalid ${name} equipped flag`);
            }
            if (!isBank && !items[id].stackable && amount !== 1) {
                throw new Error(`Non-stackable ${name} items need one slot each`);
            }
            if (seen.has(id) && (isBank || items[id].stackable)) {
                throw new Error(`Duplicate ${name} item ${id}`);
            }
            seen.add(id);
            return isBank ? { id, amount } : { id, amount, equipped };
        });
    }

    const carried = rows(inventory, 'inventory', capacity, false);
    const stored = rows(bank, 'bank', bankCapacity, true);
    const requested = rows(preset, 'preset', capacity, false);
    const stock = new Map();
    // Existing bank ids retain their order. New bank ids follow inventory order.
    for (const row of [...stored, ...carried]) {
        const total = (stock.get(row.id) || 0) + row.amount;
        if (!Number.isSafeInteger(total)) {
            throw new Error('Item stock overflow');
        }
        stock.set(row.id, total);
    }
    for (const row of requested) {
        const available = stock.get(row.id) || 0;
        if (available < row.amount) {
            throw new Error(`Missing item ${row.id} for preset`);
        }
        stock.set(row.id, available - row.amount);
    }
    const remaining = [];
    for (const [id, amount] of stock) {
        if (amount > MAX_AMOUNT) {
            throw new Error(`Bank amount overflow for item ${id}`);
        }
        if (amount > 0) remaining.push({ id, amount });
    }
    if (remaining.length > bankCapacity) {
        throw new Error('Not enough bank space for preset');
    }
    return { inventory: requested, bank: remaining };
}

module.exports = { planPreset };
