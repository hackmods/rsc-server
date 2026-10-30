// ARSC custom item rows (geodes, agility pouches): appended after clues/caskets.
// Ids 1293-1298 stay empty for ironman reserve; clients mirror the same ids.

const itemDefs = require('@2003scape/rsc-data/config/items.json');

const newItems = require('./items.json').items;

const IRONMAN_RESERVE = { first: 1293, last: 1298 };

function appendDefinition(item) {
    if (itemDefs[item.id]) {
        return;
    }

    if (itemDefs.length !== item.id) {
        throw new Error(
            `arsc-items: item ${item.id} expected at index ${itemDefs.length}`
        );
    }

    const { id, ...definition } = item;
    itemDefs.push(definition);
}

for (let id = IRONMAN_RESERVE.first; id <= IRONMAN_RESERVE.last; id += 1) {
    if (itemDefs.length !== id) {
        throw new Error(
            `arsc-items: ironman reserve ${id} expected at index ${itemDefs.length}`
        );
    }

    if (!itemDefs[id]) {
        itemDefs.push({
            name: 'Reserved',
            description: 'Unused item slot',
            command: '',
            sprite: 0,
            price: 0,
            stackable: false,
            special: false,
            equip: null,
            colour: null,
            untradeable: true,
            members: true
        });
    }
}

for (const item of newItems) {
    appendDefinition(item);
}

module.exports = {
    items: Object.fromEntries(newItems.map((item) => [item.id, item]))
};
