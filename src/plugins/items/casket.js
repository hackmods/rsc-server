// Ported from Open-RSC Core-Framework authentic/misc/Casket.java (AGPL-3.0)
// The odds are Open-RSC's (replay-derived); rsc-data's rolls/casket.json
// has different weights, so it is not used.

const CASKET_ID = 549;
const COINS_ID = 10;
const UNCUT_SAPPHIRE_ID = 160;
const UNCUT_EMERALD_ID = 159;
const UNCUT_RUBY_ID = 158;
const UNCUT_DIAMOND_ID = 157;
const TOOTH_KEY_HALF_ID = 526;
const LOOP_KEY_HALF_ID = 527;

const COIN_AMOUNTS = [10, 20, 40, 80, 160, 320, 640];

// DataConversions.random(low, high): inclusive
function random(low, high) {
    return low + Math.floor(Math.random() * (high - low + 1));
}

async function onInventoryCommand(player, item) {
    if (item.id !== CASKET_ID) {
        return false;
    }

    const chance = random(0, 1081);

    player.message('you open the casket');
    await player.world.sleepTicks(2);

    if (!player.inventory.has(CASKET_ID)) {
        return true;
    }

    player.inventory.remove(CASKET_ID);
    player.message('you find some treasure inside!');

    if (chance <= 585) {
        player.inventory.add(COINS_ID, COIN_AMOUNTS[random(0, 6)]);
    } else if (chance <= 859) {
        player.inventory.add(UNCUT_SAPPHIRE_ID);
    } else if (chance <= 990) {
        player.inventory.add(UNCUT_EMERALD_ID);
    } else if (chance <= 1047) {
        player.inventory.add(UNCUT_RUBY_ID);
    } else if (chance <= 1064) {
        player.inventory.add(UNCUT_DIAMOND_ID);
    } else {
        player.inventory.add(
            random(0, 1) === 0 ? TOOTH_KEY_HALF_ID : LOOP_KEY_HALF_ID
        );
    }

    return true;
}

module.exports = { onInventoryCommand };
