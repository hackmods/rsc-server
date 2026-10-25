// Ported from Open-RSC Core-Framework authentic/misc/SinisterChest.java (AGPL-3.0)
// The sinister key (Heroes' Quest, Jailor's key room) opens the chest: 9 unidentified herbs, then poison. The Java
// changeloc delay is 3000 ms, 5 ticks.

const SINISTER_CHEST_ID = 645;
const SINISTER_CHEST_OPEN_ID = 644;
const SINISTER_KEY_ID = 932;
const RESPAWN_TICKS = 5;
const POISON_POWER = 68; // damage 6

// unidentified herb -> amount: harralander 437, ranarr 438, irit 439, avantoe 440, kwuarm 441, torstol 933
const LOOT = [
    [437, 2],
    [438, 3],
    [439, 1],
    [440, 1],
    [441, 1],
    [933, 1]
];

async function onGameObjectCommandOne(player, gameObject) {
    if (gameObject.id !== SINISTER_CHEST_ID) {
        return false;
    }

    player.message('the chest is locked');

    return true;
}

async function onUseWithGameObject(player, gameObject, item) {
    if (gameObject.id !== SINISTER_CHEST_ID || item.id !== SINISTER_KEY_ID) {
        return false;
    }

    if (!player.inventory.has(SINISTER_KEY_ID)) {
        return true;
    }

    player.inventory.remove(SINISTER_KEY_ID);
    player.message('you unlock the chest with your key');
    player.world.replaceTimed('gameObjects', gameObject, SINISTER_CHEST_OPEN_ID, RESPAWN_TICKS);
    player.message('A foul gas seeps from the chest');
    player.message('You find a lot of herbs in the chest');

    // one at a time: the herbs do not stack
    for (const [id, amount] of LOOT) {
        for (let i = 0; i < amount; i += 1) {
            player.inventory.add(id);
        }
    }

    player.poison(POISON_POWER);

    return true;
}

module.exports = { onGameObjectCommandOne, onUseWithGameObject };
