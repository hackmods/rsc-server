// Every anvil menu path must yield an item: forging.js walks FORGING_MENUS against smithing.items[bar].items, and a
// missing or wrong row in rsc-data used to throw (iron plate legs and skirt) or hand out ore (adamantite kite shield).

const test = require('node:test');
const assert = require('node:assert');

const { onUseWithGameObject, smithing, FORGING_MENUS } = require('../src/plugins/skills/smithing/forging');
const items = require('@2003scape/rsc-data/config/items');

const ANVIL_ID = 50;
const HAMMER_ID = 168;

// every leaf of the menu tree as the list of choice indexes that reaches it
function menuPaths(menus, prefix = []) {
    return menus.flatMap((menu, i) =>
        typeof menu === 'string' ? [[...prefix, i]] : menuPaths(menu.types, [...prefix, i])
    );
}

async function forge(barID, path) {
    const choices = [...path];
    const added = [];
    const removed = [];
    const player = {
        world: { members: true },
        questStages: {},
        skills: { smithing: { current: 99, base: 99 } },
        inventory: {
            has: () => true,
            add: (id, amount = 1) => added.push({ id, amount }),
            remove: (id, amount) => removed.push({ id, amount })
        },
        isTired: () => false,
        ask: async () => choices.shift(),
        message() {},
        sendBubble() {},
        sendSound() {},
        addExperience() {}
    };
    const claimed = await onUseWithGameObject(player, { id: ANVIL_ID }, { id: barID, definition: items[barID] });
    return { claimed, added, removed };
}

test('every bar and every menu path forges a real item', async () => {
    for (const barID of Object.keys(smithing.items).map(Number)) {
        for (const path of menuPaths(FORGING_MENUS)) {
            const { claimed, added } = await forge(barID, path);
            assert.strictEqual(claimed, true, `${barID} ${path}`);
            assert.strictEqual(added.length, 1, `${items[barID].name} ${path} made nothing`);
            const made = items[added[0].id];
            assert.ok(made && !/ ore$/i.test(made.name), `${items[barID].name} ${path} made ${made && made.name}`);
        }
    }
});

test('iron plate legs and plated skirt (3 bars, level 31)', async () => {
    const legs = await forge(170, [1, 2, 2]);
    assert.deepStrictEqual(legs.added, [{ id: 9, amount: 1 }]);
    assert.deepStrictEqual(legs.removed, [{ id: 170, amount: 3 }]);
    const skirt = await forge(170, [1, 2, 3]);
    assert.strictEqual(skirt.added[0].id, 215);
    assert.strictEqual(smithing.items[170].items[1][2][2].level, 31);
});

test('adamantite kite shield is item 131, not ore', async () => {
    const { added } = await forge(174, [1, 1, 1]);
    assert.strictEqual(added[0].id, 131);
    assert.strictEqual(items[131].name, 'Adamantite Kite Shield');
});

test('throwing knives come in twos for every bar', async () => {
    for (const barID of [169, 170, 171, 173, 174, 408]) {
        const { added } = await forge(barID, [0, 1]);
        assert.strictEqual(added[0].amount, 2, items[barID].name);
    }
});

test('the rsc-data table itself is not modified', () => {
    const raw = require('@2003scape/rsc-data/skills/smithing').smithing;
    assert.strictEqual(raw.items[174].items[1][1][1].id, 154);
});
