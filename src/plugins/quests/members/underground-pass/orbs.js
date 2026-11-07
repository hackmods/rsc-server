// Ported from Open-RSC Core-Framework authentic/quests/members/undergroundpass/obstacles/UndergroundPassOrbs.java (AGPL-3.0): the
// three passages that guard the four orbs of light (north 825/828/829 with planks, west 819-824 with trip wires, south west
// 815-818 with a rope), the orbs thrown into the furnace (813) for the well, and the orbs that cannot be carried twice. The
// orbs lie at 728,3434 (white), 755,3442 (blue), 752,3440 (pink) and 708,3473 / 715,3482 (yellow). Stage map: shared.js.

const {
    ITEM,
    OBJECT,
    ORB_KEYS,
    atStages,
    cacheHas,
    cacheSet,
    cacheDel,
    mes,
    delay,
    hurt,
    hitsCurrent,
    give,
    take,
    holds,
    nextInt,
    commandOf,
    objectAt,
    swapObject,
    addTimedObject
} = require('./shared');

const NORTH_PASSAGE = [825, 828, 829];
const WEST_PASSAGE = [819, 820, 821, 822, 823, 824];
const ORBS = [ITEM.ORB_OF_LIGHT_WHITE, ITEM.ORB_OF_LIGHT_BLUE, ITEM.ORB_OF_LIGHT_PINK, ITEM.ORB_OF_LIGHT_YELLOW];

// the passage rocks stand at 736, 739, ... 751 on y 3446; the player is put back on 735 + 3 (rock - 1)
const rockX = (index) => 736 + 3 * index;
const landing = (index) => 735 + 3 * (index - 1);

// damageOfTrap: a hit of a sixteenth of the hits level, the rock looks like the trap for a moment
async function trapDamage(player, rock) {
    hurt(player, Math.floor(hitsCurrent(player) / 16) + 2);
    swapObject(player, rock, OBJECT.CLEAR_ROCKS_TRAP, 5);
    await player.say('aaarrghhh');
}

async function firstFallbackTrap(player) {
    await delay(player, 3);
    player.message('you hear a strange mechanical sound');
    await trapDamage(player, objectAt(player.world, WEST_PASSAGE[0], rockX(0), 3446));
    await delay(player, 3);
    player.message("You've triggered a trap");
}

// the trip wire sprung: the player is thrown back along the passage, hit by each rock he had passed, to the start
async function fallBack(player, rock) {
    const index = WEST_PASSAGE.indexOf(rock.id);

    if (index === 0) {
        await delay(player);
        player.message('you hear a strange mechanical sound');
        player.teleport(735, 3446);
        await trapDamage(player, rock);
        await delay(player, 3);
        player.message("You've triggered a trap");

        return;
    }

    await trapDamage(player, rock);
    player.teleport(landing(index), 3446);

    for (let step = index - 1; step >= 1; step -= 1) {
        await delay(player, 3);
        await trapDamage(player, objectAt(player.world, WEST_PASSAGE[step], rockX(step), 3446));
        player.teleport(landing(step), 3446);
    }

    await firstFallbackTrap(player);
}

async function northPassage(player, rock, index) {
    if (commandOf(rock, index) === 'walk here') {
        await mes(player, 'you walk down the passage way');
        player.message('you step on a pressure trigger');
        player.message("it's a trap");

        if (rock.id === 825) {
            player.teleport(728, 3440);
        } else if (rock.id === 828) {
            player.teleport(728, 3438);
        } else if (rock.id === 829) {
            player.teleport(728, 3436);
        }

        swapObject(player, rock, OBJECT.SNAP_TRAP, 8);
        hurt(player, Math.floor(hitsCurrent(player) / 5) + 5);
        await player.say('aaarghh');
    } else {
        await mes(player, 'you search the rocks');
        await mes(player, 'there seems to be some sort of spring activated trap');
        await mes(player, 'you may be able to wedge it open with something?');
    }
}

async function westPassage(player, rock, index) {
    if (commandOf(rock, index) === 'clear') {
        player.message('you move the rocks from your path');

        if (rock.x === player.x - 1) {
            player.teleport(player.x - 2, 3446);
        } else if (rock.x === player.x - 2) {
            player.teleport(player.x - 3, 3446);
        } else {
            await fallBack(player, rock);
        }

        return;
    }

    await mes(player, 'you search the rocks');
    player.message('you find a trip wire');

    const menu = await player.ask(['step over trip wire', 'back away']);

    if (menu !== 0) {
        return;
    }

    await mes(player, 'you carefully step over the trip wire');

    if (nextInt(20) <= 2) {
        player.message('...but you brush against it');

        if (rock.x === player.x - 1) {
            player.teleport(player.x - 2, 3446);
            await delay(player, 2);
        } else if (rock.x === player.x - 2) {
            player.teleport(player.x - 3, 3446);
            await delay(player, 2);
        }

        await fallBack(player, rock);
    } else if (rock.x === player.x + 1) {
        player.teleport(player.x + 2, 3446);
    } else if (rock.x === player.x - 1) {
        player.teleport(player.x - 2, 3446);
    } else if (rock.x === player.x - 2) {
        player.teleport(player.x - 3, 3446);
    }
}

async function southWestPassage(player) {
    player.teleport(742, 3453);
    await delay(player, 2);
    await mes(player, 'you walk down the passage way');
    await mes(player, 'the floor seems unstable');
    player.message('suddenly with a huge creek the whole passage way swings down');

    if (cacheHas(player, 'stalagmite')) {
        player.teleport(716, 3481);
        player.message('your rope saves you, slowly you lower yourself to the floor');
    } else {
        player.teleport(709, 3472);
        player.message('throwing you onto a pit of spikes');
        hurt(player, Math.floor(hitsCurrent(player) / 5) + 5);
        await player.say('aaarrrgh');
    }
}

async function climbUpGrill(player) {
    await mes(player, 'you begin to climb up the grill');

    if (nextInt(10) <= 2) {
        await mes(player, 'but you fall back to the floor');
        player.message("impailing yourself on the spike's once more");
        hurt(player, Math.floor(hitsCurrent(player) / 5) + 5);
        await player.say('aaarrrgh');
    } else {
        player.teleport(737, 3453);
        await mes(player, 'as you pull yourself up you hear a mechanical churning');
        player.message("as the passage raises back to it's original position");
    }
}

async function handleObject(player, obj, index) {
    const { id } = obj;

    if (NORTH_PASSAGE.includes(id)) {
        await northPassage(player, obj, index);
    } else if (WEST_PASSAGE.includes(id)) {
        await westPassage(player, obj, index);
    } else if (id === OBJECT.SOUTH_WEST_PASSAGE) {
        await southWestPassage(player);
    } else if (id === OBJECT.SOUTH_WEST_PASSAGE_CLIMB_UP) {
        await climbUpGrill(player);
    } else if (id === OBJECT.SOUTH_WEST_PASSAGE_CLIMB_UP_ROPE) {
        player.message('you pull your self up the rope');
        await mes(player, 'and climb back into the cavern', 1);
        player.teleport(737, 3453);
        await mes(player, 'as you pull yourself up you hear a mechanical churning');
        player.message("as the passage raises back to it's original position");
    } else if (id === OBJECT.SOUTH_WEST_STALAGMITE) {
        await mes(player, 'you search the stalagmite');

        if (cacheHas(player, 'stalagmite')) {
            player.message('you untie your rope and place it in your satchel');
            give(player, ITEM.ROPE);
            cacheDel(player, 'stalagmite');
        } else {
            player.message('but find nothing');
        }
    } else {
        return false;
    }

    return true;
}

async function onGameObjectCommandOne(player, gameObject) {
    return handleObject(player, gameObject, 0);
}

async function onGameObjectCommandTwo(player, gameObject) {
    return handleObject(player, gameObject, 1);
}

async function onUseWithGameObject(player, gameObject, item) {
    const { id } = gameObject;

    if (item.id === ITEM.PLANK && (id === NORTH_PASSAGE[0] || id === NORTH_PASSAGE[2])) {
        player.message('you carefully place the planks over the pressure triggers');
        player.message('you walk across the wooden planks');
        take(player, ITEM.PLANK);
        addTimedObject(player, OBJECT.WOODEN_PLANKS, 728, 3435, 0, 8);
        player.teleport(728, 3438);
        await delay(player, 2);
        player.teleport(728, id === NORTH_PASSAGE[0] ? 3435 : 3441);

        return true;
    }

    if (item.id === ITEM.ROPE && id === OBJECT.SOUTH_WEST_STALAGMITE) {
        await mes(player, 'you tie one end of the rope to the stalagmite');
        await mes(player, 'and the other around your waist');
        take(player, ITEM.ROPE);
        cacheSet(player, 'stalagmite');

        return true;
    }

    const orbIndex = ORBS.indexOf(item.id);

    if (orbIndex >= 0 && id === OBJECT.FURNACE) {
        player.message('you throw the glowing orb into the furnace');
        await mes(player, 'its light quickly dims and then dies');
        player.message('you feel a cold shudder run down your spine');
        take(player, item.id);

        if (!atStages(player, 7, 8, -1)) {
            cacheSet(player, ORB_KEYS[orbIndex]);
        }

        return true;
    }

    return false;
}

// an orb that is already carried cannot be picked up again
async function onGroundItemTake(player, groundItem) {
    if (ORBS.includes(groundItem.id) && holds(player, groundItem.id)) {
        player.message('you are already carrying this orb');

        return true;
    }

    return false;
}

module.exports = { onGameObjectCommandOne, onGameObjectCommandTwo, onUseWithGameObject, onGroundItemTake };
