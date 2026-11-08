// Ported from Open-RSC Core-Framework authentic/quests/members/legendsquest/obstacles/LegendsQuestWallObjects.java (AGPL-3.0): the
// wall objects of the Shaman's cave and the pool cavern: the flame octagram 210 (450-456 x 3704-3712), the ancient wall 212 whose
// five runes spell SMELL, the ruined wall 211 and the rut 206. Stage map: shared.js.

const {
    ITEM,
    NPC,
    OBJECT,
    stageOf,
    cacheHas,
    cacheSet,
    cacheDel,
    cacheInt,
    mes,
    holds,
    give,
    take,
    level,
    hurt,
    random,
    succeed,
    spawnNpc,
    nearNpc,
    sendBox,
    dropFor,
    commandOf
} = require('./shared');
const { ungaduluWallDialogue } = require('./ungadulu');

const RUNES_SOLVED = 5;
const POEM =
    'Place the five in order to pass % %or your life will dwindle until the last% %All five are stones of magical power% %Place them wrong and your fate will sour% %First is of the spirit of man or beast% %Second is the place where thoughts are born% %Third is the soil from which good things grow% %Four and five are the rules all men should know% %All put together make the word of a basic sense% %And from perspective help make maps from indifference.';
const WRONG_RUNES = new Set([
    ITEM.AIR_RUNE,
    ITEM.FIRE_RUNE,
    ITEM.BLOOD_RUNE,
    ITEM.WATER_RUNE,
    ITEM.COSMIC_RUNE,
    ITEM.NATURE_RUNE,
    ITEM.DEATH_RUNE,
    ITEM.BODY_RUNE,
    ITEM.LIFE_RUNE,
    ITEM.CHAOS_RUNE
]);
const BOWL_WATER_ITEMS = new Set([ITEM.BUCKET_OF_WATER, ITEM.JUG_OF_WATER, ITEM.BOWL_OF_WATER, ITEM.VIAL, ITEM.GOLDEN_BOWL_WITH_PURE_WATER]);

// Functions.doWallMovePlayer(obj, player, ..., removeObject = false): the player steps through the wall object to its other side
function wallMove(player, obj) {
    const { x, y } = obj;
    const px = player.x;
    const py = player.y;
    const here = x === px && y === py;

    if (obj.direction === 0) {
        player.teleport(x, here ? y - 1 : y);
    }

    if (obj.direction === 1) {
        player.teleport(here ? x - 1 : x, y);
    }

    if (obj.direction === 2) {
        if (x === px && y === py + 1) {
            player.teleport(x, y + 1);
        } else if (x === px - 1 && y === py) {
            player.teleport(x - 1, y);
        } else if (x === px && y === py - 1) {
            player.teleport(x, y - 1);
        } else if (x === px + 1 && y === py) {
            player.teleport(x + 1, y);
        } else if (x === px + 1 && y === py + 1) {
            player.teleport(x + 1, y + 1);
        } else if (x === px - 1 && y === py - 1) {
            player.teleport(x - 1, y - 1);
        }
    }

    if (obj.direction === 3) {
        if (x === px && y === py - 1) {
            player.teleport(x, y - 1);
        } else if (x === px + 1 && y === py) {
            player.teleport(x + 1, y);
        } else if (x === px && y === py + 1) {
            player.teleport(x, y + 1);
        } else if (x === px - 1 && y === py) {
            player.teleport(x - 1, y);
        } else if (x === px - 1 && y === py + 1) {
            player.teleport(x - 1, y + 1);
        } else if (x === px + 1 && y === py - 1) {
            player.teleport(x + 1, y - 1);
        }
    }
}

function solved(player) {
    return cacheInt(player, 'ancient_wall_runes') === RUNES_SOLVED || stageOf(player) === -1;
}

async function ancientDoorWalkThrough(player, obj) {
    await mes(player, 'You see a small door outline starting to form in the wall.', 2);
    await mes(player, 'And then a well formed door handle emerges, suddenly the door cracks open.', 2);
    player.message('Would you like to go through?');

    if ((await player.ask(["Yes, I'll go through.", "No, I'll stay here."])) === 1) {
        player.message('You decide to stay where you are.');
        return;
    }

    await mes(player, 'You walk into the darkness of the magical doorway.', 2);
    await mes(player, 'You walk for a short way before pushing open another door.', 2);

    if (obj.x === 464 && obj.y === 3721) {
        player.message('You appear in a large cavern like room filled with pools of water.');
        player.teleport(467, 3724);
    } else {
        await mes(player, 'You appear in a small walled cavern ', 2);
        player.message('There seems to be an exit to the south east.');
        player.teleport(463, 3720);
    }
}

async function ancientWall(player, obj, click) {
    if (click === 0) {
        if (solved(player)) {
            await mes(player, 'You walk into the darkness of the magical doorway.', 2);
            await mes(player, 'You walk for a short way before pushing open another door.', 2);

            if (obj.x === 464 && obj.y === 3721) {
                player.message('You appear in a large cavern like room filled with pools of water.');
                player.teleport(467, 3724);
            } else {
                await mes(player, 'You appear in a small walled cavern ', 2);
                player.message('There seems to be an exit to the south east.');
                player.teleport(463, 3720);
            }
        } else {
            await mes(player, 'You see no way to use that...', 2);
            player.message('Perhaps you should search it?');
        }

        return;
    }

    await mes(player, 'You search the wall...', 2);

    if (solved(player)) {
        await mes(player, "You find the word 'SMELL' marked on the wall.", 2);
        await mes(player, 'The outline of a door appears on the wall.', 2);
        player.message('What would you like to do?.');

        const option = await player.ask(['Read the message on the wall.', 'Investigate the outline of the door.']);

        if (option === 0) {
            sendBox(player, POEM);
        } else {
            await ancientDoorWalkThrough(player, obj);
        }

        return;
    }

    await mes(player, 'You find five slightly round depressions and some strange markings..', 2);
    await mes(player, 'There is a lot of dirt and mould growing over the markings, but you clear it out.', 2);
    await mes(player, 'After a while you manage to see that it is some form of message.', 2);
    await mes(player, 'Would you like to read it.', 2);

    if ((await player.ask(["Yes, I'll read it.", "No, I won't read it."])) === 0) {
        sendBox(player, POEM);
    } else {
        player.message('You decide against reading the message.');
    }
}

function runesFail(player, item) {
    player.message('The rune stone burns red hot in your hand, you drop it to the floor.');
    hurt(player, random(1, 5));
    take(player, item.id);
    dropFor(player, item.id, player.x, player.y);
}

// the next rune of SMELL: required count of runes already in, the count after, the letter and the slot the Java names
const SMELL = {
    [ITEM.SOUL_RUNE]: { from: [0], to: 1, name: 'Soul', slot: 'first', letter: 'S' },
    [ITEM.MIND_RUNE]: { from: [1], to: 2, name: 'Mind', slot: 'second slot', letter: 'M' },
    [ITEM.EARTH_RUNE]: { from: [2], to: 3, name: 'Earth', slot: 'third', letter: 'E' },
    [ITEM.LAW_RUNE]: { from: [3, 4], name: 'Law', letter: 'L' }
};

async function useRuneOnAncientWall(player, obj, item) {
    if (!SMELL[item.id] && !WRONG_RUNES.has(item.id)) {
        player.message('Nothing interesting happens');
        return;
    }

    if (solved(player)) {
        await ancientDoorWalkThrough(player, obj);
        return;
    }

    const rune = SMELL[item.id];
    const count = cacheInt(player, 'ancient_wall_runes');

    if (!rune || !rune.from.includes(count)) {
        runesFail(player, item);
        return;
    }

    take(player, item.id);

    if (item.id === ITEM.LAW_RUNE) {
        if (count === 4) {
            cacheSet(player, 'ancient_wall_runes', 5);
            await mes(player, 'You slide the Law-Rune into the fifth depression...', 2);
            await mes(player, 'It glows slightly and merges with the wall.', 2);
            await mes(player, "The letter 'L' appears where the Law-Rune merged with the door.", 2);
            await ancientDoorWalkThrough(player, obj);
        } else {
            await mes(player, 'You slide the Law-Rune into the fourth depression...', 2);
            await mes(player, 'It glows slightly and merges with the wall.', 2);
            await mes(player, "The letter 'L' appears where the Law-Rune merged with the door.", 2);
            cacheSet(player, 'ancient_wall_runes', count + 1);
        }

        return;
    }

    await mes(player, `You slide the ${rune.name}-Rune into the ${rune.slot} depression...`, 2);
    await mes(player, 'It glows slightly and merges with the wall.', 2);
    await mes(player, `The letter '${rune.letter}' appears where the ${rune.name}-Rune merged with the door.`, 2);
    cacheSet(player, 'ancient_wall_runes', rune.to);
}

async function ruinedWall(player) {
    if (level(player, 'agility') < 50) {
        player.message('You need an agility level of 50 to jump this wall');
        return;
    }

    await mes(player, 'You take a run at the wall...', 2);

    if (succeed(player, 50)) {
        await mes(player, 'You take a good run up and sail majestically over the wall.', 2);
        await mes(player, 'You land perfectly and stand ready for action.', 2);
    } else {
        await mes(player, 'You fail to jump the wall properly and clip the wall with your leg.', 2);
        await mes(player, "You're spun around mid air and hit the floor heavily.", 2);
        await mes(player, 'The fall knocks the wind out of you.', 2);
        hurt(player, 6);
        await player.say('Ughhh!');
    }

    if (player.y >= 3729) {
        player.teleport(457, 3727);
    } else {
        player.teleport(455, 3729);
    }
}

function inOctagram(player) {
    return (
        (player.x >= 450 && player.x <= 455 && player.y >= 3704 && player.y <= 3711) ||
        (player.x === 456 && player.y >= 3707 && player.y <= 3708) ||
        (player.x === 449 && player.y >= 3707 && player.y <= 3708)
    );
}

function summonUngadulu(player) {
    let ungadulu = nearNpc(player, NPC.UNGADULU, 8);

    if (!ungadulu) {
        ungadulu = spawnNpc(player, NPC.UNGADULU, 453, 3707, 300000);
    }

    return ungadulu;
}

async function flameWall(player, obj, click) {
    if (holds(player, ITEM.MAGICAL_FIRE_PASS)) {
        wallMove(player, obj);
        player.message('You feel completely fine to walk through these flames..');
        return;
    }

    if (click === 0) {
        await mes(player, 'You walk blindly into the intense heat of the supernatural flames.', 3);

        if (random(0, 9) <= 3) {
            await mes(player, 'The heat is so intense that it burns you.', 2);
            hurt(player, Math.ceil(player.skills.hits.current / 10 + 1));
            await player.say('Owwww!');
        } else {
            await mes(player, 'The heat is intense and just before you burn yourself,', 2);
            await mes(player, 'you pull your hand out of the way of the flame.', 2);
            await player.say('Whew!');
        }

        return;
    }

    const stage = stageOf(player);

    if (stage === 0 || stage === 1) {
        return;
    }

    await mes(player, 'You look closely at the flames, they seem to form a straight wall.', 2);
    await mes(player, 'Something about them looks very strange, they look completely supernatural.', 2);
    await mes(player, 'For example, they seem to appear to come from straight out of the ground.', 2);
    await player.say('Mmmm, pretty!');

    if (inOctagram(player)) {
        player.message('What would you like to do?');

        const leave = await player.ask(['Leap out of the flaming Octagram...', "Attract Shamans's attention."]);

        if (leave === 0) {
            await mes(player, 'This is quite dangerous, but you find a suitable location to jump.', 2);
            player.teleport(453, 3705);
            await player.world.sleepTicks(2);
            await mes(player, 'You take a run up...', 2);

            const burn = random(0, 5);

            if (burn <= 2) {
                await mes(player, 'You sail over the tops of the flames, just getting slightly burnt by the flames...', 2);
                hurt(player, random(3, 7));
            } else if (burn <= 4) {
                await mes(player, 'You get severly burned as you jump across the flames...', 2);
                hurt(player, random(8, 17));
            } else {
                await mes(player, 'You get severly burned as you jump across the flames...', 2);
                await mes(player, 'You feel very un well..', 2);
                hurt(player, random(18, 37));
            }

            player.teleport(455, 3702);
        } else {
            const ungadulu = summonUngadulu(player);

            await talkThroughFlames(player, ungadulu);
        }
    } else {
        await mes(player, 'You see a white clad figure in the midst of the flames...', 2);

        const ungadulu = summonUngadulu(player);

        await talkThroughFlames(player, ungadulu);
    }
}

async function talkThroughFlames(player, ungadulu) {
    if (!ungadulu) {
        return;
    }

    player.engage(ungadulu);

    try {
        await ungaduluWallDialogue(player, ungadulu);
    } finally {
        player.disengage();
    }
}

async function onWallObjectClick(player, obj, click) {
    switch (obj.id) {
        case OBJECT.ANCIENT_WALL:
            await ancientWall(player, obj, click);
            return true;
        case OBJECT.RUINED_WALL:
            await ruinedWall(player);
            return true;
        case OBJECT.FLAME_WALL:
            await flameWall(player, obj, click);
            return true;
        case OBJECT.RUT:
            player.message('This looks like a rut has been etched into the ground.');
            return true;
        default:
            return false;
    }
}

async function onWallObjectCommandOne(player, obj) {
    return onWallObjectClick(player, obj, 0);
}

async function onWallObjectCommandTwo(player, obj) {
    return onWallObjectClick(player, obj, 1);
}

async function onUseWithWallObject(player, obj, item) {
    if (obj.id === OBJECT.FLAME_WALL) {
        if (item.id === ITEM.BLESSED_GOLDEN_BOWL_WITH_PURE_WATER) {
            player.message('You splash some pure water on the flames');

            const pours = cacheInt(player, 'douse_flames') + 1;

            cacheSet(player, 'douse_flames', pours);

            if (pours > 1 && pours - 1 >= 4) {
                cacheDel(player, 'douse_flames');
                player.message('The pure water in the golden bowl has run out...');
                take(player, item.id);
                give(player, ITEM.BLESSED_GOLDEN_BOWL);
            }

            player.message('You quickly walk over the doused flames.');
            player.world.replaceTimed('wallObjects', obj, OBJECT.RUT, 8);
            wallMove(player, obj);
        } else if (BOWL_WATER_ITEMS.has(item.id)) {
            await mes(player, 'The water seems to evaporate in a cloud of steam', 2);
            await mes(player, 'before it gets anywhere near the flames.', 2);
        } else {
            player.message('Nothing interesting happens');
        }

        return true;
    }

    if (obj.id === OBJECT.ANCIENT_WALL) {
        await useRuneOnAncientWall(player, obj, item);
        return true;
    }

    return false;
}

module.exports = { onWallObjectCommandOne, onWallObjectCommandTwo, onUseWithWallObject, wallMove, commandOf };
