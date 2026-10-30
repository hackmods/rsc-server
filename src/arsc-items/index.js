// ARSC custom item rows (geodes, agility pouches + ironman reserve placeholders).
// Ids continue after treasure-trail caskets (1290-1292).

const itemDefs = require('@2003scape/rsc-data/config/items.json');

const newItems = require('./items.json').items;

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

module.exports = {
    items: Object.fromEntries(newItems.filter((i) => i.id >= 1299).map((item) => [item.id, item]))
};
