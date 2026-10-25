// Ported from Open-RSC Core-Framework authentic/defaults/DoorAction.java (DOOR_ENTER_GRAND_TREE, DOOR_EXIT_GRAND_TREE)
// and conf/server/defs/extras/ObjectTelePoints.xml (AGPL-3.0)
//
// The Grand Tree's wall doors (153-160) are invisible blocked doors that teleport to a fixed tile. The table is in
// game-objects/object-tele-points.js.
const { findTelePoint, travel } = require('../game-objects/object-tele-points');

async function onWallObjectCommandOne(player, wallObject) {
    const row = findTelePoint(wallObject, { wall: true });

    if (!row) {
        return false;
    }

    return travel(player, row);
}

module.exports = { onWallObjectCommandOne };
