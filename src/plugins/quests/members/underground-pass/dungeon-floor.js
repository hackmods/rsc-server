// Ported from Open-RSC Core-Framework authentic/quests/members/undergroundpass/obstacles/UndergroundPassDungeonFloor.java,
// UndergroundPassPuzzle.java, UndergroundPassWell.java and UndergroundPassSmearDollOfIban.java (AGPL-3.0): the dwarves' side of
// the dungeon (ladder 920, the barrel of brew 880, Iban's tomb 878 burnt with brew and a tinderbox for his ashes, the mud pile
// 890, the spider nest railing 171), the grill floor puzzle (777, 782, 785-791 and the rocks 792/793; its levers 801 are in
// game-objects/object-tele-points.js), the well (814) that needs the four orbs burnt, and the three smears of the doll
// of Iban (ashes, conscience, shadow; Kalrag's blood is in creatures.js). Stage map: shared.js.

const {
    ITEM,
    OBJECT,
    stageOf,
    atStages,
    allOrbsBurnt,
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
    dropFor,
    bubble,
    swapObject,
    addTimedObject
} = require('./shared');

const WORKING_GRILLS = {
    777: [681, 3446],
    785: [683, 3446],
    786: [683, 3448],
    787: [685, 3448],
    788: [687, 3448],
    789: [687, 3450],
    790: [687, 3452],
    791: [689, 3452]
};

async function trapGrill(player, grill) {
    await mes(player, 'you step onto the metal grill');
    player.message("it's a trap");
    player.teleport(711, 3464);
    await delay(player, 3);
    await mes(player, 'you fall onto a pit of spikes');
    player.teleport(679, 3448);
    hurt(player, Math.floor(hitsCurrent(player) * 0.2));
    player.message('you crawl out of the pit');
    swapObject(player, grill, OBJECT.SPIKED_PIT, 2);
    await delay(player, 3);
    player.message('and off the metal grill');
}

async function tombOfIban(player) {
    await mes(player, 'you try to open the door of the tomb');
    player.message('but the door refuses to open');
    await mes(player, 'you hear a noise from below');
    player.message('@red@leave me be');
    // the claws of Iban reach up for a moment
    const claws = addTimedObject(player, OBJECT.CLAWS_OF_IBAN, player.x, player.y, 0, 3);

    hurt(player, Math.floor(hitsCurrent(player) / 5) + 5);
    await player.say('aaarrgghhh');
    await delay(player, 2);

    if (claws && player.world.gameObjects.getByIndex && player.world.gameObjects.getByIndex(claws.index) === claws) {
        player.world.removeEntity('gameObjects', claws);
    }
}

async function spiderNestRailing(player, railing) {
    await mes(player, 'you search the bars');

    if (cacheHas(player, 'doll_of_iban') || stageOf(player) >= 7 || stageOf(player) === -1) {
        await mes(player, "there's a gap big enough to squeeze through");
        player.message('would you like to try');

        const menu = await player.ask(['nope', 'yes, lets do it']);

        if (menu === 1) {
            player.message('you squeeze through the old railings');

            if (railing.direction === 0) {
                if (railing.y === player.y) {
                    player.teleport(railing.x, railing.y - 1);
                } else {
                    player.teleport(railing.x, railing.y);
                }
            }
        }
    } else {
        player.message("but you can't quite squeeze through");
    }
}

async function handleObject(player, obj) {
    const { id } = obj;

    if (WORKING_GRILLS[id]) {
        player.message('you step onto the metal grill');
        player.message('you tread carefully as you move forward');
        player.teleport(...WORKING_GRILLS[id]);
    } else if (id === OBJECT.FAIL_GRILL) {
        await trapGrill(player, obj);
    } else if (id === OBJECT.WALK_HERE_ROCK_EAST) {
        player.teleport(679, 3447);
    } else if (id === OBJECT.WALK_HERE_ROCK_WEST) {
        player.teleport(690, 3452);
    } else if (id === OBJECT.LADDER) {
        await mes(player, 'you climb the ladder');
        player.message('it leads to some stairs, you walk up...');
        player.teleport(782, 3549);
    } else if (id === OBJECT.TOMB_OF_IBAN) {
        await tombOfIban(player);
    } else if (id === OBJECT.DWARF_BARREL) {
        if (!holds(player, ITEM.BUCKET)) {
            player.message('you need a bucket first');
        } else {
            player.message('you poor some of the strong brew into your bucket');
            take(player, ITEM.BUCKET);
            give(player, ITEM.DWARF_BREW);
        }
    } else if (id === OBJECT.PILE_OF_MUD_FLOOR) {
        await mes(player, 'you climb the pile of mud');
        player.message('it leads to an old stair way');
        player.teleport(773, 3417);
    } else if (id === OBJECT.WELL) {
        await well(player, obj);
    } else {
        return false;
    }

    return true;
}

async function well(player, obj) {
    await mes(player, 'you climb into the well');

    if (allOrbsBurnt(player) || atStages(player, 7, 8, -1)) {
        await mes(player, 'you feel the grip of icy hands all around you...');
        player.teleport(722, 3461);
        await delay(player);
        bubble(player, 722, 3461, true);
        player.message('..slowly dragging you futher down into the caverns');
    } else {
        hurt(player, Math.floor(hitsCurrent(player) * 0.2));
        bubble(player, obj.x, obj.y, false);
        await mes(player, 'from below an icy blast of air chills you to your bones');
        await mes(player, 'a mystical force seems to blast you back out of the well');
        player.message('there must be a positive force near by!');
    }
}

async function onGameObjectCommandOne(player, gameObject) {
    return handleObject(player, gameObject);
}

async function onGameObjectCommandTwo(player, gameObject) {
    return handleObject(player, gameObject);
}

async function onWallObjectCommandOne(player, wallObject) {
    if (wallObject.id !== OBJECT.SPIDER_NEST_RAILING) {
        return false;
    }

    await spiderNestRailing(player, wallObject);

    return true;
}

async function onWallObjectCommandTwo(player, wallObject) {
    return onWallObjectCommandOne(player, wallObject);
}

async function onUseWithGameObject(player, gameObject, item) {
    if (gameObject.id !== OBJECT.TOMB_OF_IBAN) {
        return false;
    }

    if (item.id === ITEM.DWARF_BREW) {
        if (cacheHas(player, 'doll_of_iban') && stageOf(player) === 6) {
            player.message('you pour the strong alcohol over the tomb');

            if (!cacheHas(player, 'brew_on_tomb') && !cacheHas(player, 'ash_on_doll')) {
                cacheSet(player, 'brew_on_tomb');
            }

            take(player, ITEM.DWARF_BREW);
            give(player, ITEM.BUCKET);
        } else {
            await mes(player, 'you consider pouring the brew over the grave');
            player.message('but it seems such a waste');
        }

        return true;
    }

    if (item.id === ITEM.TINDERBOX) {
        await mes(player, 'you try to set alight to the tomb');

        if (cacheHas(player, 'brew_on_tomb') && !cacheHas(player, 'ash_on_doll')) {
            await mes(player, 'it bursts into flames');
            swapObject(player, gameObject, OBJECT.FIRE, 16);
            await mes(player, 'you search through the remains');

            if (!holds(player, ITEM.IBANS_ASHES)) {
                player.message('and find the ashes of ibans corpse');
                dropFor(player, ITEM.IBANS_ASHES, 726, 654);
            } else {
                player.message('but find nothing');
            }

            cacheDel(player, 'brew_on_tomb');
        } else {
            player.message('but it will not light');
        }

        return true;
    }

    return false;
}

// smearing the doll of Iban: ashes, the conscience (a dove's bones) and the shadow
async function onUseWithInventory(player, item, target) {
    const doll = item.id === ITEM.A_DOLL_OF_IBAN ? item : target.id === ITEM.A_DOLL_OF_IBAN ? target : null;
    const other = doll === item ? target : item;

    if (!doll || !other) {
        return false;
    }

    const six = stageOf(player) === 6;

    if (other.id === ITEM.IBANS_ASHES) {
        player.message('you rub the ashes into the doll');
        take(player, ITEM.IBANS_ASHES);

        if (!cacheHas(player, 'ash_on_doll') && six) {
            cacheSet(player, 'ash_on_doll');
        }

        return true;
    }

    if (other.id === ITEM.IBANS_CONSCIENCE) {
        await mes(player, 'you crumble the doves skeleton into dust');
        player.message('and rub it into the doll');
        take(player, ITEM.IBANS_CONSCIENCE);

        if (!cacheHas(player, 'cons_on_doll') && six) {
            cacheSet(player, 'cons_on_doll');
        }

        return true;
    }

    if (other.id === ITEM.IBANS_SHADOW) {
        await mes(player, 'you pour the strange liquid over the doll');
        player.message('it seeps into the cotton');
        take(player, ITEM.IBANS_SHADOW);

        if (!cacheHas(player, 'shadow_on_doll') && six) {
            cacheSet(player, 'shadow_on_doll');
        }

        return true;
    }

    return false;
}

module.exports = {
    onGameObjectCommandOne,
    onGameObjectCommandTwo,
    onWallObjectCommandOne,
    onWallObjectCommandTwo,
    onUseWithGameObject,
    onUseWithInventory
};
