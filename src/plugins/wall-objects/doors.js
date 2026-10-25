// Ported from Open-RSC Core-Framework authentic/defaults/DoorAction.java (AGPL-3.0)
// DOOR / DOORFRAME (1, 2), DOOR_GRAY_BRICKS / DOORFRAME_GRAY_BRICKS (8, 9): Open swaps the door for its doorframe,
// Close swaps it back. DOOR_KHAZARD_BATTLE_FIELD (115) and DOOR_TRAINING_OGRES_AND_PRACTICE_ZOMBIES (150) are doDoor
// with no condition: the player walks through and the door closes behind them.
// Also: plague door 120, Temple of Ikov doors 104 (pendant) and 105 (boots) and their locked answers.

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

// DOOR_PLAGUE_UNOPENABLE (120): Java only answers when the player is east of x 624, otherwise nothing happens
const PLAGUE_DOOR_ID = 120;
const MOURNER_WESTARDOUGNE = 445;

// DOOR_TEMPLE_IKOV_FEAR_ROOM (104) and DOOR_TEMPLE_IKOV_LEVER_PIECE (105): Temple of Ikov, no quest check in the Java
const IKOV_FEAR_ROOM_DOOR_ID = 104;
const IKOV_BRIDGE_DOOR_ID = 105;
const PENDANT_OF_LUCIEN = 721;
const BOOTS_OF_LIGHTFOOTEDNESS = 722;

async function ikovFearRoom(player, wallObject) {
    const { world } = player;

    if (
        player.inventory.isEquipped(PENDANT_OF_LUCIEN) ||
        (player.y >= 3335 && player.y <= 3341)
    ) {
        player.message('You go through the door');
        await player.enterDoor(wallObject);
        return;
    }

    player.message('As you reach to open the door');
    await world.sleepTicks(3);
    player.message('A great terror comes over you');
    await world.sleepTicks(3);
    player.message("You decide you'll not open this door today");
    await world.sleepTicks(3);
}

async function ikovBridge(player, wallObject) {
    const { world } = player;

    if (
        player.inventory.isEquipped(BOOTS_OF_LIGHTFOOTEDNESS) ||
        player.x >= 546
    ) {
        player.message('You go through the door');
        await player.enterDoor(wallObject);
        return;
    }

    player.message('Your weight is too much for the bridge to hold');
    player.teleport(544, 3330);
    await world.sleepTicks(1);
    player.message('You fall through the bridge');
    await world.sleepTicks(2);
    player.message('The lava singes you');
    player.damage(Math.ceil(player.skills.hits.current / 5));
}

async function onWallObjectCommandOne(player, wallObject) {
    if (wallObject.id === IKOV_FEAR_ROOM_DOOR_ID) {
        await ikovFearRoom(player, wallObject);
        return true;
    }

    if (wallObject.id === IKOV_BRIDGE_DOOR_ID) {
        await ikovBridge(player, wallObject);
        return true;
    }

    if (wallObject.id === PLAGUE_DOOR_ID) {
        if (player.x > 624) {
            const mourner = player
                .getNearbyEntitiesByID('npcs', MOURNER_WESTARDOUGNE, 8)
                .find((npc) => !npc.locked);

            player.message("The door won't open");
            player.message('You notice a black cross on the door');

            if (mourner && !mourner.interlocutor) {
                player.engage(mourner);
                await mourner.say(
                    "I'd stand away from there",
                    'That black cross means that house has been touched by the plague'
                );
                player.disengage();
            }
        }

        return true;
    }

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
