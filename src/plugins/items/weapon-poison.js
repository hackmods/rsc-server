// Dipping a weapon in weapon poison. Ported from Open-RSC (AGPL-3.0)
// server/plugins/com/openrsc/server/plugins/authentic/itemactions/InvItemPoisoning.java:
// the poisoned version is the item whose name is "Poisoned <name>" or "Poison <name>" (daggers, spears, throwing
// knives and darts, arrows, bolts). Stacks poison 6 darts or 5 arrows/bolts at a time, using up one bottle.

const items = require('@2003scape/rsc-data/config/items.json');

const WEAPON_POISON_ID = 572;

// { itemID: poisonedItemID }, first match in id order like the Open-RSC lookup
const POISONED_VERSIONS = new Map();

const idsByName = new Map();

items.forEach(({ name }, id) => {
    const lower = name.toLowerCase();

    if (!idsByName.has(lower)) {
        idsByName.set(lower, id);
    }
});

items.forEach(({ name }, id) => {
    const lower = name.toLowerCase();
    const poisoned =
        idsByName.get(`poisoned ${lower}`) ?? idsByName.get(`poison ${lower}`);

    if (poisoned !== undefined) {
        POISONED_VERSIONS.set(id, poisoned);
    }
});

function countOf(player, id) {
    return player.inventory.items.reduce(
        (total, item) => (item.id === id ? total + item.amount : total),
        0
    );
}

function applyPoison(player, id) {
    const poisonedID = POISONED_VERSIONS.get(id);

    if (poisonedID === undefined) {
        player.message('Nothing interesting happens');
        return;
    }

    const { name, stackable } = items[id];
    const lower = name.toLowerCase();

    let amount = 1;
    let described = `a ${lower}.`;

    if (stackable) {
        const maximum = lower.includes('dart') ? 6 : 5;

        amount = Math.min(maximum, countOf(player, id));

        if (lower.includes('dart')) {
            described = 'some darts!';
        } else if (lower.includes('bolt')) {
            described = 'some bolts!';
        } else if (lower.includes('arrow')) {
            described = 'some arrows!';
        } else {
            described = `some ${lower}${lower.endsWith('s') ? '' : 's'}!`;
        }
    }

    if (!player.inventory.has(WEAPON_POISON_ID) || amount < 1) {
        return;
    }

    player.inventory.remove(WEAPON_POISON_ID);
    player.inventory.remove(id, amount);
    player.inventory.add(poisonedID, amount);
    player.message(`You poison ${described}`);
}

async function onUseWithInventory(player, item, target) {
    if (item.id === WEAPON_POISON_ID) {
        applyPoison(player, target.id);
        return true;
    }

    if (target.id === WEAPON_POISON_ID) {
        applyPoison(player, item.id);
        return true;
    }

    return false;
}

module.exports = { onUseWithInventory, POISONED_VERSIONS };
