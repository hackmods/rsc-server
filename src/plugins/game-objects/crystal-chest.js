// Ported from Open-RSC Core-Framework authentic/misc/CrystalChest.java (AGPL-3.0)
// The crystal chest in Taverley (248, at 367,497) opens with a crystal key (525, the two key halves joined:
// items/item-on-item.js). The key is used up. Every opening gives an uncut dragonstone, then one roll of 0-10000 against
// the LOOT bands below (8328 and up: nothing more). The Java changeloc delay is 1000 ms, 2 ticks.

const items = require('@2003scape/rsc-data/config/items');

const CRYSTAL_CHEST_ID = 248;
const CRYSTAL_CHEST_OPEN_ID = 247;
const CRYSTAL_KEY_ID = 525;
const UNCUT_DRAGONSTONE_ID = 542;
const RESPAWN_TICKS = 2;

// [upper bound of the roll (exclusive), [[item id, amount], ...]]
const LOOT = [
    [26, [[402, 1]]], // rune plate mail legs
    [132, [[127, 1]]], // adamantite square shield
    [407, [[517, 30]]], // iron ore certificates
    [733, [[526, 1], [10, 750]]], // tooth half of the key, coins
    [1084, [[408, 3]]], // runite bars
    [1451, [[527, 1], [10, 750]]], // loop half of the key, coins
    [1874, [[162, 2], [161, 2]]], // rubies, diamonds
    [2529, [[518, 20]]], // coal certificates
    [3302, [[31, 50], [32, 50], [33, 50], [34, 50], [35, 50], [36, 50], [38, 10], [40, 10], [41, 10], [42, 10], [46, 10]]], // runes
    [4359, [[536, 1], [10, 1000]]], // raw swordfish certificate, coins
    [8328, [[179, 1], [10, 2000]]] // spinach roll, coins
];

// DataConversions.random(0, 10000) is inclusive
function rollLoot(roll = Math.floor(Math.random() * 10001)) {
    const band = LOOT.find(([upper]) => roll < upper);

    return [[UNCUT_DRAGONSTONE_ID, 1], ...(band ? band[1] : [])];
}

async function onGameObjectCommandOne(player, gameObject) {
    if (gameObject.id !== CRYSTAL_CHEST_ID) {
        return false;
    }

    player.message('the chest is locked');

    return true;
}

async function onUseWithGameObject(player, gameObject, item) {
    if (gameObject.id !== CRYSTAL_CHEST_ID || item.id !== CRYSTAL_KEY_ID) {
        return false;
    }

    if (!player.inventory.has(CRYSTAL_KEY_ID)) {
        return true;
    }

    player.inventory.remove(CRYSTAL_KEY_ID);
    player.message('you unlock the chest with your key');
    player.world.replaceTimed('gameObjects', gameObject, CRYSTAL_CHEST_OPEN_ID, RESPAWN_TICKS);
    player.message('You find some treasure in the chest');

    // the Java adds an unstackable item one at a time
    for (const [id, amount] of rollLoot()) {
        if (amount > 1 && !items[id].stackable) {
            for (let i = 0; i < amount; i += 1) {
                player.inventory.add(id);
            }
        } else {
            player.inventory.add(id, amount);
        }
    }

    return true;
}

module.exports = { onGameObjectCommandOne, onUseWithGameObject, rollLoot, LOOT };
