// Ported from Open-RSC Core-Framework authentic/defaults/DoorAction.java (AGPL-3.0)
// DOOR / DOORFRAME (1, 2), DOOR_GRAY_BRICKS / DOORFRAME_GRAY_BRICKS (8, 9): Open swaps the door for its doorframe,
// Close swaps it back. DOOR_KHAZARD_BATTLE_FIELD (115) and DOOR_TRAINING_OGRES_AND_PRACTICE_ZOMBIES (150) are doDoor
// with no condition: the player walks through and the door closes behind them.

// { doorID: doorframeID }
const DOOR_IDS = {
    2: 1,
    8: 9
};

const DOORFRAME_IDS = {};

for (const [doorID, doorframeID] of Object.entries(DOOR_IDS)) {
    DOORFRAME_IDS[doorframeID] = Number(doorID);
}

const WALK_THROUGH_IDS = new Set([115, 150]);

async function onWallObjectCommandOne(player, wallObject) {
    if (WALK_THROUGH_IDS.has(wallObject.id)) {
        await player.enterDoor(wallObject);
        return true;
    }

    if (!DOOR_IDS.hasOwnProperty(wallObject.id)) {
        return false;
    }

    const { world } = player;

    world.replaceEntity('wallObjects', wallObject, DOOR_IDS[wallObject.id]);
    player.message('The door swings open');
    player.sendSound('opendoor');

    return true;
}

async function onWallObjectCommandTwo(player, wallObject) {
    if (!DOORFRAME_IDS.hasOwnProperty(wallObject.id)) {
        return false;
    }

    const { world } = player;

    player.lock();
    world.replaceEntity('wallObjects', wallObject, DOORFRAME_IDS[wallObject.id]);
    player.message('The door creaks shut');
    player.sendSound('closedoor');
    await world.sleepTicks(1);
    player.unlock();

    return true;
}

module.exports = { onWallObjectCommandOne, onWallObjectCommandTwo };
