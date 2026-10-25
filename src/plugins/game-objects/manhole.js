// https://classic.runescape.wiki/w/Manhole
// Ported from Open-RSC Core-Framework authentic/defaults/DoorAction.java (MANHOLE_CLOSED / MANHOLE_OPEN) (AGPL-3.0):
// the swap plays the open or close door sound

const MANHOLE_CLOSED_ID = 78;
const MANHOLE_OPEN_ID = 79;

async function onGameObjectCommandOne(player, gameObject) {
    if (gameObject.id !== MANHOLE_CLOSED_ID) {
        return false;
    }

    const { world } = player;

    player.message('@que@You slide open the manhole cover');
    world.replaceEntity('gameObjects', gameObject, MANHOLE_OPEN_ID);
    player.sendSound('opendoor');

    return true;
}

async function onGameObjectCommandTwo(player, gameObject) {
    if (gameObject.id !== MANHOLE_OPEN_ID) {
        return false;
    }

    const { world } = player;

    player.message('@que@You slide the cover back over the manhole');
    world.replaceEntity('gameObjects', gameObject, MANHOLE_CLOSED_ID);
    player.sendSound('closedoor');

    return true;
}

module.exports = { onGameObjectCommandOne, onGameObjectCommandTwo };
