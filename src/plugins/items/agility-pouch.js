// ARSC agility course pouches (1303-1305): lap rewards and classic-safe loot.

const items = require('@2003scape/rsc-data/config/items');

const COINS_ID = 10;
const INVENTORY_SIZE = 30;

const POUCH_BY_COURSE = {
    gnome: 1303,
    barbarian: 1304,
    wilderness: 1305
};

const POUCH_ID_SET = new Set(Object.values(POUCH_BY_COURSE));

const LOOT_TABLE = [
    { id: COINS_ID, weight: 45, amount: [25, 150] },
    { id: 138, weight: 18, amount: 1 },
    { id: 132, weight: 15, amount: 1 },
    { id: 373, weight: 8, amount: 1 },
    { id: 444, weight: 6, amount: 1 },
    { id: 445, weight: 5, amount: 1 },
    { id: 446, weight: 4, amount: 1 }
];

function randomInt(min, max, random = Math.random) {
    return min + Math.floor(random() * (max - min + 1));
}

function rollWeighted(table, random = Math.random) {
    let total = 0;

    for (const { weight } of table) {
        total += weight;
    }

    let roll = random() * total;

    for (const entry of table) {
        roll -= entry.weight;

        if (roll < 0) {
            return entry;
        }
    }

    return table[table.length - 1];
}

function amountOf(entry, random) {
    return Array.isArray(entry.amount)
        ? randomInt(entry.amount[0], entry.amount[1], random)
        : entry.amount || 1;
}

function pouchName(id) {
    return items[id].name.toLowerCase();
}

function hasInventorySpace(player, id, amount = 1) {
    const definition = items[id];
    const free = INVENTORY_SIZE - player.inventory.items.length;

    if (definition.stackable) {
        return player.inventory.has(id) || free > 0;
    }

    return free >= amount;
}

function tryGrantLapPouch(player, courseKey) {
    const pouchId = POUCH_BY_COURSE[courseKey];

    if (!pouchId) {
        return false;
    }

    if (!hasInventorySpace(player, pouchId)) {
        player.message(
            '@yel@You complete the lap but your inventory is too full for an agility pouch'
        );
        return false;
    }

    player.inventory.add(pouchId);
    player.message(`@gre@You receive ${pouchName(pouchId)}!`);
    return true;
}

function openPouch(player, pouchId, random = Math.random) {
    if (!POUCH_ID_SET.has(pouchId) || !player.inventory.has(pouchId)) {
        return false;
    }

    player.inventory.remove(pouchId);
    player.message(`You open the ${pouchName(pouchId)}...`);

    const entry = rollWeighted(LOOT_TABLE, random);
    const amount = amountOf(entry, random);
    player.inventory.add(entry.id, amount);

    const definition = items[entry.id];
    player.message(`You find ${amount} x ${definition.name.toLowerCase()}`);

    return true;
}

async function onInventoryCommand(player, item) {
    if (!POUCH_ID_SET.has(item.id)) {
        return false;
    }

    return openPouch(player, item.id);
}

module.exports = {
    onInventoryCommand,
    POUCH_BY_COURSE,
    POUCH_ID_SET,
    tryGrantLapPouch,
    openPouch,
    hasInventorySpace
};
