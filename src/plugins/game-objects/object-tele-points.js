// Ported from Open-RSC Core-Framework conf/server/defs/extras/ObjectTelePoints.xml and the fixed-tile branches of
// authentic/defaults/Ladders.java, authentic/defaults/DoorAction.java (DOOR_ENTER/EXIT_GRAND_TREE),
// authentic/misc/RandomObjects.java (417) and authentic/npcs/grandtree/Brimstail.java (667) (AGPL-3.0)
//
// One table of objects (and wall objects) whose action only moves the player to a fixed tile. Row fields:
//   id, x, y      the object and the tile it stands on (Java keys the XML by tile and command, never id)
//   command       the object's first command, compared case-insensitively
//   to            [x, y] the player lands on
//   wall          true for a wall object (served by wall-objects/grand-tree-doors.js)
//   before/after  messages sent before / after the teleport; a number is a pause of that many ticks
//   bubble        true for the levers: the teleport bubble is shown on arrival
// climbable.js asks findTelePoint so its plane shift does not claim these first. Gated cases (a ticket, a skill level,
// a cache key, a menu) are not here: 776 ticket, 198 prayer guild, 223 mining guild, 199 black hole disk, 249 Zanaris
// ladder menu, 348 wilderness lever menu, 342 paladin guard, 79 manhole menu, 1027 Mage Arena barrier.
//
// Note: in Ladders.java the XML lookup runs before the special 1187 branch, so the Mage Arena ladder at (446,3367)
// lands on the XML tile (223,109); the branch's teleport(222,110) is dead code.
const LEVER = 'You pull the lever';
const STAIRS_UP = 'You go up the stairs';
const CAVE_667 = ['you enter the cave', 3, 'it leads to a ladder', 3, 'you climb down'];
const GRAND_TREE_BEFORE = ['you open the door', 3];

const TELE_POINTS = [
    // ObjectTelePoints.xml (18 entries)
    { id: 1188, x: 223, y: 110, command: 'Climb-Down', to: [446, 3368] },
    { id: 1187, x: 446, y: 3367, command: 'Climb-Up', to: [223, 109] },
    { id: 156, x: 414, y: 1107, command: 'walk through', to: [700, 1395], wall: true },
    { id: 156, x: 701, y: 1395, command: 'walk through', to: [414, 1107], wall: true },
    { id: 155, x: 419, y: 1107, command: 'walk through', to: [708, 1395], wall: true },
    { id: 155, x: 707, y: 1395, command: 'walk through', to: [418, 1107], wall: true },
    { id: 630, x: 576, y: 3577, command: 'Go down', to: [576, 3528] },
    { id: 160, x: 702, y: 2338, command: 'walk through', to: [415, 2051], wall: true },
    { id: 158, x: 705, y: 2338, command: 'walk through', to: [417, 2051], wall: true },
    { id: 159, x: 703, y: 2340, command: 'walk through', to: [416, 2052], wall: true },
    { id: 157, x: 703, y: 2337, command: 'walk through', to: [416, 2050], wall: true },
    { id: 157, x: 416, y: 2050, command: 'walk through', to: [703, 2336], wall: true },
    { id: 159, x: 416, y: 2053, command: 'walk through', to: [703, 2340], wall: true },
    { id: 160, x: 415, y: 2051, command: 'walk through', to: [701, 2338], wall: true },
    { id: 158, x: 418, y: 2051, command: 'walk through', to: [705, 2338], wall: true },
    { id: 585, x: 416, y: 2051, command: 'climb-up', to: [417, 2994] },
    { id: 586, x: 417, y: 2993, command: 'Climb-down', to: [415, 2051] },
    { id: 616, x: 703, y: 3283, command: 'climb-up', to: [416, 162] },
    // Ladders.java fixed-tile branches
    { id: 629, x: 576, y: 3529, command: 'Go up', to: [576, 3580], after: [STAIRS_UP] },
    { id: 621, x: 605, y: 3509, command: 'Go up', to: [606, 3556], after: [STAIRS_UP] },
    { id: 5, x: 98, y: 2930, command: 'Climb-Up', to: [243, 96], after: ['You climb up the ladder'] },
    { id: 5, x: 137, y: 2932, command: 'Climb-Up', to: [243, 96], after: ['You climb up the ladder'] },
    { id: 41, x: 516, y: 1479, command: 'Go up', to: [516, 2426], before: [STAIRS_UP] },
    { id: 41, x: 316, y: 546, command: 'Go up', to: [316, 1493], before: [STAIRS_UP] },
    { id: 487, x: 282, y: 3020, command: 'pull', to: [567, 3330], before: [LEVER], bubble: true },
    { id: 488, x: 567, y: 3331, command: 'pull', to: [282, 3019], before: [LEVER], bubble: true },
    { id: 349, x: 180, y: 129, command: 'pull', to: [621, 596], before: [LEVER], bubble: true },
    // RandomObjects.java 417 (Hazeel cult cave) and Brimstail.java 667
    { id: 417, x: 619, y: 649, command: 'enter', to: [617, 3479], before: ['you enter the cave'], after: ['it leads downwards to the sewer'] },
    { id: 667, x: 731, y: 501, command: 'enter', to: [730, 3334], before: CAVE_667 },
    { id: 667, x: 694, y: 632, command: 'enter', to: [730, 3334], before: CAVE_667 },
    // DoorAction.java DOOR_EXIT_GRAND_TREE (154) and DOOR_ENTER_GRAND_TREE (153)
    { id: 154, x: 416, y: 166, command: 'walk through', to: [703, 455], before: GRAND_TREE_BEFORE, after: ['and walk through'], wall: true },
    { id: 153, x: 703, y: 455, command: 'walk through', to: [416, 165], before: GRAND_TREE_BEFORE, after: ['and walk through'], wall: true }
];

// the row for this object's click, or undefined. commandIndex 0 is the first command, 1 the second.
function findTelePoint(entity, { wall = false, commandIndex = 0 } = {}) {
    const command = entity.definition && entity.definition.commands && entity.definition.commands[commandIndex];

    if (!command) {
        return undefined;
    }

    return TELE_POINTS.find(
        (row) =>
            Boolean(row.wall) === wall &&
            row.id === entity.id &&
            row.x === entity.x &&
            row.y === entity.y &&
            row.command.toLowerCase() === command.toLowerCase()
    );
}

async function runSteps(player, steps = []) {
    for (const step of steps) {
        if (typeof step === 'number') {
            await player.world.sleepTicks(step);
        } else {
            player.message(step);
        }
    }
}

async function travel(player, row) {
    const [x, y] = row.to;

    await runSteps(player, row.before);
    player.teleport(x, y);
    await runSteps(player, row.after);

    if (row.bubble) {
        // Ladders.java: delay(), then the bubble on arrival
        await player.world.sleepTicks(2);

        if (player.x === x && player.y === y) {
            player.sendTeleportBubble(x, y);
        }
    }

    return true;
}

async function onGameObjectCommandOne(player, gameObject) {
    const row = findTelePoint(gameObject);

    if (!row) {
        return false;
    }

    return travel(player, row);
}

module.exports = { TELE_POINTS, findTelePoint, travel, onGameObjectCommandOne };
