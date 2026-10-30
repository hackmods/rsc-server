// ARSC mining geodes (1299-1302): crack for gems and coins; also rolled on ore mines.

const items = require('@2003scape/rsc-data/config/items');

const COINS_ID = 10;
const UNCUT_SAPPHIRE_ID = 160;
const UNCUT_EMERALD_ID = 159;
const UNCUT_RUBY_ID = 158;
const UNCUT_DIAMOND_ID = 157;
const TOOTH_KEY_HALF_ID = 526;
const LOOP_KEY_HALF_ID = 527;

const GEODE_IDS = [1299, 1300, 1301, 1302];
const GEODE_ID_SET = new Set(GEODE_IDS);

const GEODE_CHANCE = 1 / 128;

const MINING_GEODE_TABLE = [
    { id: 1299, weight: 64 },
    { id: 1300, weight: 32 },
    { id: 1301, weight: 16 },
    { id: 1302, weight: 8 }
];

const COIN_AMOUNTS = [10, 20, 40, 80, 160, 320, 640];

function randomInt(low, high, random = Math.random) {
    return low + Math.floor(random() * (high - low + 1));
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
            return entry.id;
        }
    }

    return table[table.length - 1].id;
}

function rollMiningGeode(random = Math.random) {
    return rollWeighted(MINING_GEODE_TABLE, random);
}

function geodeName(id) {
    return items[id].name.toLowerCase();
}

// Open-RSC casket table (plugins/items/casket.js); small geodes never give key halves.
function rollGeodeLoot(geodeId, random = Math.random) {
    const chance = randomInt(0, 1081, random);
    const allowKeys = geodeId >= 1300;
    const coinBias = geodeId - 1299;

    if (chance <= 585) {
        const maxIndex = Math.min(COIN_AMOUNTS.length - 1, 3 + coinBias * 2);
        const minIndex = Math.min(coinBias, maxIndex);
        return { id: COINS_ID, amount: COIN_AMOUNTS[randomInt(minIndex, maxIndex, random)] };
    }

    if (chance <= 859) {
        return { id: UNCUT_SAPPHIRE_ID, amount: 1 };
    }

    if (chance <= 990) {
        return { id: UNCUT_EMERALD_ID, amount: 1 };
    }

    if (chance <= 1047) {
        return { id: UNCUT_RUBY_ID, amount: 1 };
    }

    if (chance <= 1064) {
        return { id: UNCUT_DIAMOND_ID, amount: 1 };
    }

    if (allowKeys) {
        return {
            id: randomInt(0, 1, random) === 0 ? TOOTH_KEY_HALF_ID : LOOP_KEY_HALF_ID,
            amount: 1
        };
    }

    return { id: COINS_ID, amount: COIN_AMOUNTS[randomInt(4, 6, random)] };
}

async function crackGeode(player, geodeId, random = Math.random) {
    if (!GEODE_ID_SET.has(geodeId) || !player.inventory.has(geodeId)) {
        return false;
    }

    player.message(`you crack the ${geodeName(geodeId)}`);
    await player.world.sleepTicks(2);

    if (!player.inventory.has(geodeId)) {
        return true;
    }

    player.inventory.remove(geodeId);
    player.message('you find some treasure inside!');

    const loot = rollGeodeLoot(geodeId, random);
    player.inventory.add(loot.id, loot.amount);

    return true;
}

async function onInventoryCommand(player, item) {
    if (!GEODE_ID_SET.has(item.id)) {
        return false;
    }

    return crackGeode(player, item.id);
}

module.exports = {
    onInventoryCommand,
    GEODE_CHANCE,
    GEODE_IDS,
    GEODE_ID_SET,
    rollMiningGeode,
    rollGeodeLoot,
    crackGeode
};
