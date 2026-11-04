// Ported from Open-RSC Core-Framework authentic/misc/CoalTrucks.java (AGPL-3.0): Stankers' coal trucks (383) by the
// Seers' Village coal mine. Use coal on a truck to load it, a piece at a time, up to 120 in the truck; "get coal from"
// any truck takes one piece back out. The load is the player's own (Java cache key coal_truck, here
// player.cache.coal_truck), so a truck at the mine and one at the depot over the river share it: load at one end,
// unload at the other.
// Two Java slips are not copied: the first load counted the whole stack and then each piece again (line 54), and the
// empty-truck message ended in a stray quote (line 26).

const COAL_TRUCK_ID = 383;
const COAL_ID = 155;
const TRUCK_CAPACITY = 120;

const loaded = (player) => Number(player.cache.coal_truck) || 0;

async function onGameObjectCommandOne(player, gameObject) {
    if (gameObject.id !== COAL_TRUCK_ID) {
        return false;
    }

    const coalLeft = loaded(player);

    if (coalLeft > 0) {
        player.message('@que@You remove a piece of coal from the truck');
        player.inventory.add(COAL_ID);
        player.cache.coal_truck = coalLeft - 1;
    } else {
        player.message('@que@there is no coal left in the truck');
    }

    return true;
}

async function onUseWithGameObject(player, gameObject, item) {
    if (gameObject.id !== COAL_TRUCK_ID || item.id !== COAL_ID) {
        return false;
    }

    const { world } = player;
    const coalAmount = player.inventory.count(COAL_ID);

    for (let i = 0; i < coalAmount; i += 1) {
        if (loaded(player) >= TRUCK_CAPACITY) {
            player.message('The coal truck is full');
            break;
        }

        if (!player.inventory.has(COAL_ID)) {
            break;
        }

        player.cache.coal_truck = loaded(player) + 1;
        player.message('@que@You put a piece of coal in the truck');
        player.inventory.remove(COAL_ID);
        await world.sleepTicks(1);
    }

    return true;
}

module.exports = { onGameObjectCommandOne, onUseWithGameObject };
