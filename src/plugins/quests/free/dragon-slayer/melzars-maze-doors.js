// https://classic.runescape.wiki/w/Melzar%27s_Maze
// Ported from Open-RSC Core-Framework authentic/defaults/DoorAction.java (AGPL-3.0)

const ENTRANCE_DOOR_ID = 60;
const EXIT_DOOR_ID = 54;
const LESSER_DEMON_DOOR_ID = 52;
const MAZE_KEY_ID = 421;

// { doorWallObjectID: keyItemID }
const DOOR_KEY_IDS = {
    // ground floor: red key from rats
    48: 390,

    // first floor: orange key from ghosts
    49: 391,

    // second floor: yellow key from skeletons
    50: 392,

    // dungeon: blue key from zombie
    51: 393,

    // dungeon: magenta key from melzar
    53: 394,

    // dungeon: black key from lesser demon
    52: 395
};

// capitalization discrepencies
const KEY_NAMES = {
    390: 'red key',
    391: 'Orange key',
    392: 'Yellow key',
    393: 'blue key',
    394: 'magenta key',
    395: 'Black key'
};

async function onUseWithWallObject(player, wallObject, item) {
    // DoorAction.onInvUseOnWallObject: unlock message, the door opens, "you go through the door",
    // then (for the coloured keys only) "Your <key> has gone!" and the key is removed.
    // The maze entrance key is kept, so it has no "has gone" line.
    if (wallObject.id === ENTRANCE_DOOR_ID && item.id === MAZE_KEY_ID) {
        player.message('you unlock the door');

        await player.enterDoor(wallObject);

        player.message('you go through the door');

        return true;
    } else if (DOOR_KEY_IDS[wallObject.id] === item.id) {
        player.message('you unlock the door');

        await player.enterDoor(wallObject);

        player.message('you go through the door');
        player.message(`Your ${KEY_NAMES[item.id].toLowerCase()} has gone!`);
        player.inventory.remove(item.id);

        if (wallObject.id === LESSER_DEMON_DOOR_ID) {
            player.cache.melzarsChestMapPiece = true;
        }

        return true;
    }

    return false;
}

async function onWallObjectCommandOne(player, wallObject) {
    if (wallObject.id === EXIT_DOOR_ID) {
        // DoorAction.java DOOR_MELZAR_BASEMENT_FROM_OUTSIDE_OR_EXIT: opens (silently, doDoor) only from the tile
        // just west of the door, inside the room; locked from everywhere else
        if (player.x === wallObject.x - 1) {
            await player.enterDoor(wallObject);
        } else {
            player.message('this door is locked');
        }

        return true;
    }

    // DoorAction.blockInvUseOnWallObject: every maze key door, the entrance included, is locked to Open
    if (DOOR_KEY_IDS.hasOwnProperty(wallObject.id) || wallObject.id === ENTRANCE_DOOR_ID) {
        player.message('The door is locked');
        return true;
    }

    return false;
}

module.exports = { onUseWithWallObject, onWallObjectCommandOne };
