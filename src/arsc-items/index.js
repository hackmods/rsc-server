// ARSC custom item rows: Iron Man armour (1293-1298, 1306-1314; src/ironman.js), geodes and agility pouches.
// Ids continue after treasure-trail caskets (1290-1292).

const itemDefs = require('@2003scape/rsc-data/config/items.json');
const wieldableDefs = require('@2003scape/rsc-data/wieldable.json');

const newItems = require('./items.json').items;
const { wieldable } = require('./wieldable.json');

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

for (const item of newItems) {
    appendDefinition(item);
}

// wearable stats and worn looks, keyed by id like rsc-data's table (model/item.js reads it)
for (const [id, definition] of Object.entries(wieldable)) {
    if (!wieldableDefs[id]) {
        wieldableDefs[id] = definition;
    }
}

module.exports = {
    items: Object.fromEntries(newItems.filter((i) => i.id >= 1299).map((item) => [item.id, item]))
};
