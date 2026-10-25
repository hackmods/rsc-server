// Ported from Open-RSC Core-Framework authentic/defaults/DoorAction.java (AGPL-3.0)
// GATE_METAL_GENERIC (57, 58), GATE_WOODEN_GENERIC (59, 60), DOOR_BANK (63, 64) and the Karamja glider gate (660)

// { openID: closedID }
const OPEN_IDS = {
    59: 60,
    58: 57,
    63: 64
};

const CLOSED_IDS = {};

// DOOR_BANK_CLOSED: these two bank doors never open
const LOCKED_BANK_DOORS = [
    { id: 64, x: 467, y: 518 },
    { id: 64, x: 558, y: 587 }
];

// GATE_WOODEN_KARAMJA_GLIDER_CLOSED (660), only the gate at (387, 760); GATE_WOODEN_FISHING_CONTEST_KARAMJA_GLIDER_OPEN
const GLIDER_GATE_ID = 660;
const GLIDER_GATE_OPEN_ID = 357;
const GLIDER_GATE_X = 387;
const GLIDER_GATE_Y = 760;

// GATE_BANK_VAULT (260): always locked, a QUEST-type message
const BANK_VAULT_GATE_ID = 260;

// GATE_MCGRUBORS_WOOD (356), only the gate at (560, 472). From the north (y > 472) the Forester turns you away
const MCGRUBORS_GATE_ID = 356;
const MCGRUBORS_GATE_X = 560;
const MCGRUBORS_GATE_Y = 472;
const FORESTER_ID = 348;

for (const [openID, closedID] of Object.entries(OPEN_IDS)) {
    CLOSED_IDS[closedID] = Number(openID);
}

function getMessage(gameObject, open) {
    const name = gameObject.definition.name;
    let message = 'The ';

    if (/door/i.test(name)) {
        message += 'door';

        if (/s$/.test(name)) {
            message += open ? 's swing open' : 's creak shut';
        } else {
            message += open ? ' swings open' : ' creaks shut';
        }
    } else {
        message += 'gate ' + (open ? 'swings open' : 'creaks shut');
    }

    return message;
}

async function mcGrubors(player) {
    const { world } = player;

    if (player.y <= MCGRUBORS_GATE_Y) {
        player.message('@que@the gate is locked');
        return;
    }

    const forester = player
        .getNearbyEntitiesByID('npcs', FORESTER_ID, 8)
        .find((npc) => !npc.locked);

    if (forester && !forester.interlocutor) {
        player.engage(forester);
        await forester.say(
            "Hey you can't come through here",
            'This is private land'
        );
        player.disengage();
        await world.sleepTicks(2);
        player.message('@que@You will need to find another way in');
    } else {
        player.message('@que@You will need to find another way in');
        await world.sleepTicks(2);
        player.message('@que@the gate is locked');
    }
}

async function onGameObjectCommandOne(player, gameObject) {
    if (gameObject.id === BANK_VAULT_GATE_ID) {
        player.message('@que@the gate is locked');
        return true;
    }

    if (gameObject.id === MCGRUBORS_GATE_ID) {
        if (
            gameObject.x === MCGRUBORS_GATE_X &&
            gameObject.y === MCGRUBORS_GATE_Y
        ) {
            await mcGrubors(player);
        }

        return true;
    }

    if (gameObject.id === GLIDER_GATE_ID) {
        if (
            gameObject.x === GLIDER_GATE_X &&
            gameObject.y === GLIDER_GATE_Y
        ) {
            player.message('you open the gate');
            await player.enterGate(gameObject, GLIDER_GATE_OPEN_ID);
            await player.world.sleepTicks(2);
            player.message('and walk through');
        }

        return true;
    }

    if (!CLOSED_IDS.hasOwnProperty(gameObject.id)) {
        return false;
    }

    if (
        LOCKED_BANK_DOORS.some(
            ({ id, x, y }) =>
                id === gameObject.id && x === gameObject.x && y === gameObject.y
        )
    ) {
        player.message('The doors are locked');
        return true;
    }

    const { world } = player;

    world.replaceEntity('gameObjects', gameObject, CLOSED_IDS[gameObject.id]);
    player.message(getMessage(gameObject, true));
    player.sendSound('opendoor');

    return true;
}

async function onGameObjectCommandTwo(player, gameObject) {
    if (!OPEN_IDS.hasOwnProperty(gameObject.id)) {
        return false;
    }

    const { world } = player;

    player.lock();

    world.replaceEntity('gameObjects', gameObject, OPEN_IDS[gameObject.id]);
    player.message(getMessage(gameObject, false));
    player.sendSound('closedoor');

    await world.sleepTicks(1);
    player.unlock();

    return true;
}

module.exports = { onGameObjectCommandOne, onGameObjectCommandTwo };
