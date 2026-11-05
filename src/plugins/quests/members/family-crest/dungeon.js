// Ported from Open-RSC Core-Framework authentic/quests/members/FamilyCrest.java onOpLoc/onOpBound (AGPL-3.0).
// The hellhound dungeon east of Ardougne (Witchaven), where the perfect gold rocks are: three levers and four doors.
//   levers: 316 north lever in front of the door (511,3415) "north_leverA", 318 north lever inside (511,3410)
//           "north_leverB", 317 south lever inside (508,3443) "south_lever". Pull toggles up/down, Inspect reads it.
//   doors:  91 front door (508,3427), 88 south left (509,3441), 90 south right (512,3441), 92 north (510,3415).
// The levers live in player.cache (northLeverA, southLever, northLeverB), created all three at the first pull and
// deleted when the crest is handed in. After the quest the levers do nothing and door 91 is always open.

const { stage } = require('./shared');

const LEVERS = {
    316: 'northLeverA',
    317: 'southLever',
    318: 'northLeverB'
};

// door 88 and 90 ids are reused on Tutorial Island: only these two are the quest's
const SOUTH_LEFT_DOOR = { id: 88, x: 509, y: 3441 };
const SOUTH_RIGHT_DOOR = { id: 90, x: 512, y: 3441 };
const FRONT_DOOR_ID = 91;
const NORTH_DOOR_ID = 92;

function isQuestDoor(wallObject) {
    const { id, x, y } = wallObject;

    return (
        (id === SOUTH_LEFT_DOOR.id && x === SOUTH_LEFT_DOOR.x && y === SOUTH_LEFT_DOOR.y) ||
        (id === SOUTH_RIGHT_DOOR.id && x === SOUTH_RIGHT_DOOR.x && y === SOUTH_RIGHT_DOOR.y) ||
        id === FRONT_DOOR_ID ||
        id === NORTH_DOOR_ID
    );
}

// the lever positions, or null before the first pull (Java hasKey)
function getLevers(player) {
    if (typeof player.cache.northLeverA === 'undefined') {
        return null;
    }

    return {
        a: !!player.cache.northLeverA,
        b: !!player.cache.northLeverB,
        south: !!player.cache.southLever
    };
}

function doorOpens(player, id) {
    const levers = getLevers(player);

    switch (id) {
        case SOUTH_LEFT_DOOR.id:
            return !!levers && levers.a && levers.south;
        case SOUTH_RIGHT_DOOR.id:
            return !!levers && levers.a && !levers.south;
        case FRONT_DOOR_ID:
            return (!!levers && levers.a && levers.b && !levers.south) || stage(player) === -1;
        case NORTH_DOOR_ID:
            return !!levers && !levers.a && (levers.south || levers.b);
    }

    return false;
}

async function onWallObjectCommandOne(player, wallObject) {
    if (!isQuestDoor(wallObject)) {
        return false;
    }

    if (doorOpens(player, wallObject.id)) {
        player.message('The door swings open', 'You go through the door');
        await player.enterDoor(wallObject);
    } else {
        player.message('The door is locked');
    }

    return true;
}

function pullLever(player, name) {
    if (typeof player.cache.northLeverA === 'undefined') {
        player.cache.northLeverA = false;
        player.cache.southLever = false;
        player.cache.northLeverB = false;
    }

    player.cache[name] = !player.cache[name];
    player.message(`You pull the lever ${player.cache[name] ? 'down' : 'up'}`, 'you hear a clunk');
}

function inspectLever(player, name) {
    player.message(`The lever is ${player.cache[name] ? 'down' : 'up'}`);
}

async function lever(player, gameObject, pull) {
    const name = LEVERS[gameObject.id];

    if (!name) {
        return false;
    }

    if (stage(player) === -1) {
        player.message('nothing interesting happens');
    } else if (pull) {
        pullLever(player, name);
    } else {
        inspectLever(player, name);
    }

    return true;
}

async function onGameObjectCommandOne(player, gameObject) {
    return await lever(player, gameObject, true);
}

async function onGameObjectCommandTwo(player, gameObject) {
    return await lever(player, gameObject, false);
}

module.exports = { onWallObjectCommandOne, onGameObjectCommandOne, onGameObjectCommandTwo };
