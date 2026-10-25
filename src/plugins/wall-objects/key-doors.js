// Ported from Open-RSC Core-Framework authentic/defaults/DoorAction.java (AGPL-3.0):
//   blockInvUseOnWallObject / onInvUseOnWallObject  -> onUseWithWallObject (use the key on the door)
//   handleObjectDoor, "if (blockInvUseOnWallObject(...)) the door is locked" -> onWallObjectCommandOne (Open)
// Brass key door (Varrock to Edgeville dungeon): the former wall-objects/brass-key-door.js, now row 23 of the table.
// https://classic.runescape.wiki/w/Brass_key
//
// Not in this table, because another plugin already owns the door and its tests (one door, one owner):
//   20  Phoenix weapons store      quests/free/shield-of-arrav/weapons-store-door.js
//   35  Ernest closet (y 545)      quests/free/ernest-the-chicken/closet-door.js
//   48-53 Melzar's maze, 60 maze entrance   quests/free/dragon-slayer/melzars-maze-doors.js (keys 390-395 consumed,
//        maze key 421 kept, black door sets melzarsChestMapPiece)
//
// Java behaviour for every door listed here (blockInvUseOnWallObject is true for it):
//   Open:            "the door is locked" (a key in the pack does not help)
//   key on the door: "you unlock the door", walk through, "you go through the door"; the key is kept unless `consume`
//   anything else:   "Nothing interesting happens" (wrong item)
// Doors Java only blocks at certain tiles carry x and y; the same wall id elsewhere is not a key door, so it passes.

const WITCHS_HOUSE_FRONT_DOOR_ID = 69;

// wallId: wall object id; x, y: the only tile Java blocks (omit = every instance)
// key: item id; consume: the key is removed after use (with a "Your <key> has gone!" message)
// bubble: Java thinkbubble(item); before(player): extra Java check, return true to stop (message already said)
const KEY_DOORS = [
    // DOOR_BRASS_KEY (202,485): Brass key (99)
    { wallId: 23, key: 99, consume: false, bubble: true },
    // DOOR_WITCHS_FRONT_KEY (363,494): Front door key (538). Java: no bubble, drops the witch_spawned cache flag, and
    // before the quest is started the player refuses to break in
    {
        wallId: WITCHS_HOUSE_FRONT_DOOR_ID,
        key: 538,
        consume: false,
        bubble: false,
        async before(player) {
            if (player.questStages.witchsHouse === 0) {
                await player.say("It'd be rude to break into this house");
                return true;
            }

            delete player.cache.witchSpawned;
            return false;
        }
    },
    // DOOR_JAIL_KEY: the two Taverley dungeon jail doors only: Jail keys (595)
    { wallId: 83, x: 360, y: 3428, key: 595, consume: false, bubble: true },
    { wallId: 83, x: 360, y: 3425, key: 595, consume: false, bubble: true },
    // DOOR_DUSTY_KEY: the blue dragon door only: Dusty Key (596)
    { wallId: 84, x: 355, y: 3353, key: 596, consume: false, bubble: true },
    // DOOR_SHINY_KEY (Temple of Ikov): shiny Key (732)
    { wallId: 110, key: 732, consume: false, bubble: true }
];

const items = require('@2003scape/rsc-data/config/items.json');

function makeHandlers(table) {
    function find(wallObject) {
        return table.find(
            (door) =>
                door.wallId === wallObject.id &&
                (door.x === undefined || door.x === wallObject.x) &&
                (door.y === undefined || door.y === wallObject.y)
        );
    }

    async function onWallObjectCommandOne(player, wallObject) {
        if (!find(wallObject)) {
            return false;
        }

        player.message('the door is locked');

        return true;
    }

    async function onUseWithWallObject(player, wallObject, item) {
        const door = find(wallObject);

        if (!door) {
            return false;
        }

        if (item.id !== door.key || !player.inventory.has(door.key)) {
            player.message('Nothing interesting happens');
            return true;
        }

        if (door.before && (await door.before(player))) {
            return true;
        }

        if (door.bubble) {
            player.sendBubble(item.id);
        }

        player.message('you unlock the door');
        await player.enterDoor(wallObject);
        player.message('you go through the door');

        if (door.consume) {
            player.message(`Your ${items[door.key].name.toLowerCase()} has gone!`);
            player.inventory.remove(door.key);
        }

        return true;
    }

    return { onWallObjectCommandOne, onUseWithWallObject };
}

module.exports = { ...makeHandlers(KEY_DOORS), makeHandlers, KEY_DOORS };
