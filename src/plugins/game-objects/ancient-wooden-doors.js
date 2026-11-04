// Ported from Open-RSC Core-Framework authentic/quests/members/legendsquest/obstacles/LegendsQuestGameObjects.java
// CAVE_ANCIENT_WOODEN_DOORS (1160) and authentic/skills/thieving/Thieving.java succeedPickLockThieving (AGPL-3.0).
//
// The doors deep in the Kharazi jungle caves (441,3702). The Java has no quest gate on them: from the north side
// (y >= 3703) either command lets you out to 442,3701; from the south "Open" only describes the lock and "Pick Lock"
// needs Thieving 50 and a lockpick. The doors show open (497) for 3 ticks as you pass.

const { gatheringSuccessLegacy } = require('../skills/thieving');

const ANCIENT_WOODEN_DOORS_ID = 1160;
const OPEN_DOORS_ID = 497;
const LOCKPICK_ID = 714;
const PICK_LEVEL = 50;
const PICK_EXPERIENCE = 100; // Java incExp(THIEVING, 100, true): quarter points, as rsc-data

function openBriefly(player, gameObject) {
    if (player.world.replaceTimed) {
        player.world.replaceTimed('gameObjects', gameObject, OPEN_DOORS_ID, 3);
    }
}

async function steps(player, ...lines) {
    for (const line of lines) {
        if (typeof line === 'number') {
            await player.world.sleepTicks(line);
        } else {
            player.message(line);
        }
    }
}

const onNorthSide = (player) => player.y >= 3703;

async function open(player, gameObject) {
    if (onNorthSide(player)) {
        await steps(player, 'You push the doors open and walk through.', 2);
        openBriefly(player, gameObject);
        player.teleport(442, 3701);
        await steps(player, 3, "The doors make a satisfying 'CLICK' sound as they close.");
        return;
    }

    await steps(
        player,
        "You push on the doors...they're really shut..",
        2,
        'It looks as if they have a huge lock on it...',
        2,
        'Although ancient, it looks very sophisticated...'
    );
}

async function pickLock(player, gameObject) {
    if (onNorthSide(player)) {
        await steps(player, 'You see a lever which you pull on to open the door.', 2);
        openBriefly(player, gameObject);
        player.teleport(442, 3701);
        await steps(player, 'You walk through the door.', 2, "The doors make a satisfying 'CLICK' sound as they close.");
        return;
    }

    const level = player.skills.thieving.current;

    if (level < PICK_LEVEL) {
        player.message(`You need a thieving level of at least ${PICK_LEVEL} to attempt this.`);
        return;
    }

    if (!player.inventory.has(LOCKPICK_ID)) {
        await steps(
            player,
            'The mechanism for this lock looks very sophisticated...',
            2,
            "you're unable to affect the lock without the proper tool.."
        );
        return;
    }

    await steps(player, 'You attempt to pick the lock..', 2, 'It looks very sophisticated ...');
    await player.say('Hmmm, interesting...');
    await steps(player, 2, 'You carefully insert your lockpick into the lock.');
    await player.say('This will be a challenge...');
    await steps(player, 2, 'You feel for the pins and levers in the mechanism.');
    await player.say('Easy does it....');
    await player.world.sleepTicks(2);

    // succeedPickLockThieving: the carried lockpick adds 10 levels
    if (!gatheringSuccessLegacy(PICK_LEVEL, level + 10)) {
        player.message("...but you don't manage to pick the lock.");
        return;
    }

    await steps(player, "@gre@'CLICK'", 2);
    await player.say('Easy as pie...');
    await steps(player, 2, 'You tumble the lock mechanism and the door opens easily.', 2);
    player.addExperience('thieving', PICK_EXPERIENCE);
    openBriefly(player, gameObject);
    player.teleport(441, 3703);
}

async function onGameObjectCommandOne(player, gameObject) {
    if (gameObject.id !== ANCIENT_WOODEN_DOORS_ID) {
        return false;
    }

    await open(player, gameObject);
    return true;
}

async function onGameObjectCommandTwo(player, gameObject) {
    if (gameObject.id !== ANCIENT_WOODEN_DOORS_ID) {
        return false;
    }

    await pickLock(player, gameObject);
    return true;
}

module.exports = { onGameObjectCommandOne, onGameObjectCommandTwo };
