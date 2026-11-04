// Ported from Open-RSC Core-Framework authentic/misc/DragonstoneAmulet.java (AGPL-3.0): the amulet of glory.
// - Use a dragonstone amulet (522) on the Fountain of Heroes (282, Heroes' Guild) to charge it (597).
// - "rub" a charged amulet (carried or worn) to teleport to Edgeville, Karamja, Draynor Village or Al Kharid. Not from
//   level 30 Wilderness and up (Constants.GLORY_TELEPORT_LIMIT), the Fisher King's realm, the Grand Tree's ground
//   floor or the mod room; not while holding Ana in a barrel. Karamja rum stays on Karamja, a plague sample
//   disintegrates. The 4th rub (Java cache key charged_ds_amulet, here player.cache.charged_ds_amulet) uses the last
//   charge: the amulet turns back into a dragonstone amulet, still worn if it was.
// The custom IMPROVED_ITEM_OBJECT_NAMES charge messages are not ported (an Open-RSC option, off in authentic play).
// The charged amulet's better gem odds while mining (GemMining.java line 143) are mining's, not this plugin's.

const Item = require('../../model/item');
const { wildernessLevel } = require('../../wilderness');

const FOUNTAIN_OF_HEROES_ID = 282;
const DRAGONSTONE_AMULET_ID = 522;
const CHARGED_DRAGONSTONE_AMULET_ID = 597;
const KARAMJA_RUM_ID = 318;
const PLAGUE_SAMPLE_ID = 812;
const ANA_IN_A_BARREL_ID = 1039;

const GLORY_TELEPORT_LIMIT = 30;
const CHARGES = 4;

const DESTINATIONS = [
    { name: 'Edgeville', x: 226, y: 447 },
    { name: 'Karamja', x: 360, y: 696 },
    { name: 'Draynor village', x: 214, y: 632 },
    { name: 'Al Kharid', x: 72, y: 696 }
];

const inBounds = ({ x, y }, x1, y1, x2, y2) => x >= x1 && x <= x2 && y >= y1 && y <= y2;

// Point.isInFisherKingRealm, isInsideGrandTreeGround, inModRoom
function teleportBlocked(player) {
    return (
        wildernessLevel(player) >= GLORY_TELEPORT_LIMIT ||
        inBounds(player, 388, 4, 427, 40) ||
        inBounds(player, 484, 4, 523, 40) ||
        inBounds(player, 411, 976, 519, 984) ||
        inBounds(player, 411, 1920, 518, 1925) ||
        inBounds(player, 511, 976, 519, 984) ||
        inBounds(player, 511, 1920, 518, 1925) ||
        inBounds(player, 410, 158, 422, 170) ||
        inBounds(player, 64, 1639, 80, 1643)
    );
}

// Point.inKaramja
const inKaramja = (player) => inBounds(player, 323, 644, 679, 908);

async function onUseWithGameObject(player, gameObject, item) {
    if (gameObject.id !== FOUNTAIN_OF_HEROES_ID || item.id !== DRAGONSTONE_AMULET_ID) {
        return false;
    }

    const { world } = player;

    player.message('You dip the amulet in the fountain');
    await world.sleepTicks(2);

    if (player.inventory.has(DRAGONSTONE_AMULET_ID)) {
        player.inventory.remove(DRAGONSTONE_AMULET_ID);
        player.inventory.add(CHARGED_DRAGONSTONE_AMULET_ID);
    }

    player.message('You feel more power emanating from it than before');
    await world.sleepTicks(3);
    player.message('you can now rub this amulet to teleport');
    await world.sleepTicks(3);
    player.message('Though using it to much means you will need to recharge it');
    await world.sleepTicks(3);
    player.message('It now also means you can find more gems when mining');

    return true;
}

// the last charge: a worn amulet stays worn, as an uncharged one
function uncharge(player) {
    const { inventory } = player;
    const index = inventory.items.findIndex((item) => item.id === CHARGED_DRAGONSTONE_AMULET_ID);

    if (index < 0) {
        return;
    }

    if (!inventory.items[index].equipped) {
        inventory.remove(CHARGED_DRAGONSTONE_AMULET_ID);
        inventory.add(DRAGONSTONE_AMULET_ID);
        return;
    }

    const uncharged = new Item({ id: DRAGONSTONE_AMULET_ID, equipped: true });

    inventory.items[index] = uncharged;
    inventory.sendUpdate(index, uncharged);
    inventory.updateEquipmentBonuses();
}

async function onInventoryCommand(player, item) {
    if (item.id !== CHARGED_DRAGONSTONE_AMULET_ID) {
        return false;
    }

    const { world, inventory } = player;

    player.message('You rub the amulet');
    await world.sleepTicks(1);
    player.message('Where would you like to teleport to?');

    const choice = await player.ask([...DESTINATIONS.map(({ name }) => name), 'Nowhere'], false);

    if (teleportBlocked(player)) {
        player.message('A mysterious force blocks your teleport!', "You can't use this teleport after level 30 wilderness");
        return true;
    }

    if (inventory.has(ANA_IN_A_BARREL_ID)) {
        player.message("You can't teleport while holding Ana,");
        await world.sleepTicks(3);
        player.message("It's just too difficult to concentrate.");
        await world.sleepTicks(3);
        return true;
    }

    const destination = DESTINATIONS[choice];

    if (!destination) {
        player.message('Nothing interesting happens');
        return true;
    }

    if (inKaramja(player)) {
        while (inventory.has(KARAMJA_RUM_ID)) {
            inventory.remove(KARAMJA_RUM_ID);
        }
    }

    if (inventory.has(PLAGUE_SAMPLE_ID)) {
        player.message('the plague sample is too delicate...', 'it disintegrates in the crossing');

        while (inventory.has(PLAGUE_SAMPLE_ID)) {
            inventory.remove(PLAGUE_SAMPLE_ID);
        }
    }

    player.teleport(destination.x, destination.y, true);

    const rubs = (Number(player.cache.charged_ds_amulet) || 0) + 1;

    if (rubs < CHARGES) {
        player.cache.charged_ds_amulet = rubs;
    } else {
        delete player.cache.charged_ds_amulet;
        uncharge(player);
    }

    return true;
}

module.exports = { onUseWithGameObject, onInventoryCommand };
