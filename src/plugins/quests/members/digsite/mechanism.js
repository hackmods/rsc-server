// The objects of the Dig Site (quests/members/digsite/shared.js has the stage map), from Open-RSC Core-Framework
// authentic/quests/members/digsite/DigsiteObjects.java and DigsiteWinch.java (AGPL-3.0): the winches and the ropes down the
// shafts, the barrel of nitroglycerin, the tent chest, the museum storage chests and cupboard, the specimen trays, the sacks
// with the specimen jar, the bush with the purple student's rock sample and the bricks the explosive compound blows open.

const { SOIL_IDS, NPC, ITEM, NOTHING, stageOf, setStage, mes, give, commandOf, withWorkman, rng, findMessage } = require('./shared');

const SIGNPOSTS = [1060, 1061, 1062, 1063];
const SACKS = [1075, 1076];
const BUSHES = [1072, 1073];
const BURIED_SKELETONS = [1057, 1049];
const WINCHES = [1095, 1053];

const HOUSE_EAST_CHEST_CLOSED = 1104;
const HOUSE_EAST_CHEST_OPEN = 1105;
const HOUSE_EAST_CUPBOARD_CLOSED = 1074;
const HOUSE_EAST_CUPBOARD_OPEN = 1078;
const HOUSE_WEST_CHESTS_OPEN = 17;
const HOUSE_WEST_CHESTS_CLOSED = 18;
const TENT_CHEST_OPEN = 1084;
const TENT_CHEST_LOCKED = 1085;
const HOUSE_BOOKCASE = 1090;
const SPECIMEN_TRAY = 1052;
const CLIMB_UP_ROPE_SMALL_CAVE = 1097;
const CLIMB_UP_ROPE_BIG_CAVE = 1098;
const BRICK = 1096;
const X_BARREL = 1082;
const X_BARREL_OPEN = 1083;

const TRAY_ITEMS = [
    NOTHING,
    ITEM.BONES,
    ITEM.CRACKED_ROCK_SAMPLE,
    ITEM.IRON_DAGGER,
    ITEM.BROKEN_ARROW,
    ITEM.BROKEN_GLASS,
    ITEM.CERAMIC_REMAINS,
    ITEM.COINS,
    ITEM.CHARCOAL
];

function replace(player, gameObject, id) {
    player.world.replaceEntity('gameObjects', gameObject, id);
}

// ---------------------------------------------------------------- the winches (DigsiteWinch.java)

async function cantUseWinch(player, winch) {
    await withWorkman(player, async (workman) => {
        // deviation: the Java teleports the workman beside the player and walks him one tile; he is spawned on the player's tile
        await workman.say('Sorry, this area is private');
        await workman.say(
            "The only way you'll get to use these",
            'Is by impressing the expert',
            'Up at the centre',
            'Find something worthwhile...',
            'And he might let you use the winches',
            'Until then, get lost !'
        );
    });

    void winch;
}

async function operateWinch(player, winch) {
    const stage = stageOf(player);

    if (stage === -1) {
        player.message('You find yourself in a cavern...');
        player.teleport(19, 3385);
        return;
    }

    if (stage > 6) {
        return;
    }

    const first = winch.id === WINCHES[0];
    const ropeKey = first ? 'winch_rope_1' : 'winch_rope_2';

    if (!player.cache.digsite_winshaft) {
        await cantUseWinch(player, winch);
    } else if (!player.cache[ropeKey]) {
        player.message('You operate the winch');
        player.message('The bucket descends, but does not reach the bottom');
        await player.say('Hey I think I could fit down here...', 'I need something to help me get all the way down');
    } else {
        if (player.skills.agility.current < 10) {
            player.message('You need an agility level of 10 to do this');
            return;
        }

        await mes(player, 'You try to climb down the rope');
        await mes(player, 'You lower yourself into the shaft');
        player.addExperience('agility', 20);

        if (first) {
            player.teleport(26, 3346);
        } else if (stage >= 6) {
            player.teleport(19, 3385);
        } else {
            player.teleport(19, 3337);
        }

        player.message('You find yourself in a cavern...');
    }
}

async function ropeOnWinch(player, winch) {
    const first = winch.id === WINCHES[0];
    const ropeKey = first ? 'winch_rope_1' : 'winch_rope_2';

    if (!player.cache.digsite_winshaft) {
        await player.say('Err... I have no idea why I am doing this !');
    } else if (!player.cache[ropeKey]) {
        player.message('You tie the rope to the bucket');
        player.cache[ropeKey] = true;
        player.inventory.remove(ITEM.ROPE);
    } else {
        player.message('There is already a rope tied to this bucket');
    }
}

// ---------------------------------------------------------------- the specimen tray

async function searchTray(player) {
    if (!player.inventory.has(ITEM.SPECIMEN_JAR)) {
        await withWorkman(player, async (workman) => {
            await workman.say('Oi! what are you doing ?');

            const option = await player.ask(['I am on an errand', 'I am searching this tray'], true);

            if (option === 0) {
                await workman.say('Oh yeah? and whose errand is that then...', 'Where is your specimen jar then?');
                await player.say('Oh I dont have one');
                await workman.say(
                    'And you reckon you have been sent on an errand...',
                    "Without a specimen jar - no sorry I can't let you do that!"
                );
            } else if (option === 1) {
                await workman.say('Oh you are, are you ?', "Well, where's your specimen jar?");
                await player.say("Ah, I don't have one...");
                await workman.say(
                    'In that case how can you handle the specimens without it?',
                    'As you should know, specimens are to be kept in sealed specimen jars',
                    'To keep them safe and preserved...',
                    'Next time bring it along!'
                );
            }
        });

        return;
    }

    player.addExperience('mining', 4);
    await mes(player, 'You sift through the earth in the tray');

    const chosen = TRAY_ITEMS[rng.int(0, TRAY_ITEMS.length - 1)];
    const message = findMessage(chosen, false);

    if (message) {
        player.message(message);
    }

    if (chosen !== NOTHING) {
        give(player, chosen, 1);
    }
}

// ---------------------------------------------------------------- object commands

async function onObjectCommand(player, gameObject, index) {
    const { id } = gameObject;
    const command = commandOf(gameObject, index);

    if (id === X_BARREL_OPEN) {
        player.message('You search the barrel');
        player.message('The barrel has a foul-smelling liquid inside...');
        await player.say("I can't pick this up with my bare hands!", "I'll need something to put it in");
    } else if (id === BRICK) {
        await player.say(
            "Hmmm, There's a room past these bricks",
            'If I could move them out of the way',
            "Then I could find out what's inside..."
        );
    } else if (id === CLIMB_UP_ROPE_SMALL_CAVE || id === CLIMB_UP_ROPE_BIG_CAVE) {
        player.message('You climb the ladder');

        if (id === CLIMB_UP_ROPE_BIG_CAVE) {
            player.teleport(25, 515);
        } else {
            player.teleport(14, 506);
        }
    } else if (id === TENT_CHEST_LOCKED) {
        player.message('The chest is locked');
    } else if (id === TENT_CHEST_OPEN) {
        if (command === 'search') {
            await mes(player, 'You search the chest');
            player.message('You find some unusual powder inside...');
            give(player, ITEM.UNIDENTIFIED_POWDER, 1);
            replace(player, gameObject, TENT_CHEST_LOCKED);
        } else {
            // the Java's "kosher special case": the chest does not close on that command, the player must search it
            player.message('Nothing interesting happens');
        }
    } else if (BUSHES.includes(id)) {
        player.message('You search the bush');

        if (id === BUSHES[1]) {
            await player.say('Hey, something has been dropped here...');
            player.message('You find a rock sample!');
            give(player, ITEM.ROCK_SAMPLE_PURPLE, 1);
        } else {
            player.message('You find nothing of interest');
        }
    } else if (id === SPECIMEN_TRAY) {
        await searchTray(player);
    } else if (SIGNPOSTS.includes(id)) {
        player.message(
            [
                'This site is for training purposes only',
                'Level 1 digs only',
                'Level 2 digs only',
                'Level 3 digs only'
            ][SIGNPOSTS.indexOf(id)]
        );
    } else if (SACKS.includes(id)) {
        // Formulae.getHeight(location) == 3: the plane of the shaft caverns
        if (id === SACKS[0] && Math.floor(gameObject.y / 944) === 3) {
            await player.say('There is nothing under the sack!');
            return true;
        }

        player.message('You search the sacks');

        if (id === SACKS[0] || player.inventory.has(ITEM.SPECIMEN_JAR)) {
            player.message('You find nothing of interest');
        } else {
            await player.say("Hey there's something under here");
            player.message('You find a specimen jar!');
            give(player, ITEM.SPECIMEN_JAR, 1);
        }
    } else if (BURIED_SKELETONS.includes(id)) {
        player.message('You search the skeleton');
        player.message('You find nothing of interest');
    } else if (id === HOUSE_EAST_CHEST_CLOSED) {
        player.message('You open the chest');
        replace(player, gameObject, HOUSE_EAST_CHEST_OPEN);
    } else if (id === HOUSE_EAST_CHEST_OPEN) {
        if (command === 'search') {
            player.message('You search the chest');
            player.message('You find a rock sample');
            give(player, ITEM.CRACKED_ROCK_SAMPLE, 1);
            replace(player, gameObject, HOUSE_EAST_CHEST_CLOSED);
        }
    } else if (id === HOUSE_BOOKCASE) {
        player.message('You search through the bookcase');
        player.message('You find a book on chemicals');
        give(player, ITEM.BOOK_OF_EXPERIMENTAL_CHEMISTRY, 1);
    } else if (id === HOUSE_EAST_CUPBOARD_CLOSED) {
        replace(player, gameObject, HOUSE_EAST_CUPBOARD_OPEN);
        player.message('You open the cupboard');
    } else if (id === HOUSE_EAST_CUPBOARD_OPEN) {
        if (command === 'search') {
            if (!player.inventory.has(ITEM.ROCK_PICK)) {
                player.message('You find a rock pick');
                give(player, ITEM.ROCK_PICK, 1);
            } else {
                player.message('You find nothing of interest');
            }

            replace(player, gameObject, HOUSE_EAST_CUPBOARD_CLOSED);
            player.message('You close the cupboard');
        }
    } else if (id === HOUSE_WEST_CHESTS_OPEN || id === HOUSE_WEST_CHESTS_CLOSED) {
        if (command === 'open') {
            player.message('You open the chest');
            replace(player, gameObject, HOUSE_WEST_CHESTS_OPEN);
        } else if (command === 'close') {
            player.message('You close the chest');
            replace(player, gameObject, HOUSE_WEST_CHESTS_CLOSED);
        } else if (command === 'search') {
            player.message('You search the chest, but find nothing');
        }
    } else if (SOIL_IDS.includes(id)) {
        player.message('You examine the patch of soil');
        player.message('You see nothing on the surface');
        await player.say('I think I need something to dig with');
    } else if (WINCHES.includes(id)) {
        await operateWinch(player, gameObject);
    } else {
        return false;
    }

    return true;
}

const COMMAND_IDS = new Set([
    X_BARREL_OPEN,
    BRICK,
    CLIMB_UP_ROPE_SMALL_CAVE,
    CLIMB_UP_ROPE_BIG_CAVE,
    TENT_CHEST_LOCKED,
    TENT_CHEST_OPEN,
    SPECIMEN_TRAY,
    HOUSE_EAST_CHEST_CLOSED,
    HOUSE_EAST_CHEST_OPEN,
    HOUSE_BOOKCASE,
    HOUSE_EAST_CUPBOARD_CLOSED,
    HOUSE_EAST_CUPBOARD_OPEN,
    HOUSE_WEST_CHESTS_OPEN,
    HOUSE_WEST_CHESTS_CLOSED,
    ...SIGNPOSTS,
    ...SACKS,
    ...BUSHES,
    ...BURIED_SKELETONS,
    ...SOIL_IDS,
    ...WINCHES
]);

async function onGameObjectCommandOne(player, gameObject) {
    if (!COMMAND_IDS.has(gameObject.id)) {
        return false;
    }

    return onObjectCommand(player, gameObject, 0);
}

// the tray's "Search" is its second command (the first is WalkTo); the others only react to the commands they list
async function onGameObjectCommandTwo(player, gameObject) {
    if (!COMMAND_IDS.has(gameObject.id)) {
        return false;
    }

    return onObjectCommand(player, gameObject, 1);
}

// ---------------------------------------------------------------- items used on objects

async function onUseWithGameObject(player, gameObject, item) {
    const { id } = gameObject;

    if (id === TENT_CHEST_LOCKED && item.id === ITEM.CHEST_KEY) {
        replace(player, gameObject, TENT_CHEST_OPEN);
        player.message('you use the key in the chest');
        player.message('you open the chest');
        player.inventory.remove(ITEM.CHEST_KEY);
        await player.say('Oops I dropped the key', "Never mind it's open now...");

        return true;
    }

    if (id === X_BARREL) {
        switch (item.id) {
            case ITEM.BRONZE_PICKAXE:
                await player.say('I better not - it might break it to pieces!');
                break;
            case ITEM.ROCK_PICK:
                await player.say('The rockpick is too fat to fit in the gap...');
                break;
            case ITEM.SPADE:
                await player.say('The spade is far too big to fit');
                break;
            case ITEM.IRON_DAGGER:
                await player.say("The dagger's blade might break, I need something stronger");
                break;
            case ITEM.BROKEN_ARROW:
                await player.say('It nearly fits, just a little too thin');
                break;
            case ITEM.TROWEL:
                replace(player, gameObject, X_BARREL_OPEN);
                await player.say("Great, it's opened it!");
                break;
            default:
                player.message('Nothing interesting happens');
        }

        return true;
    }

    if (id === X_BARREL_OPEN) {
        switch (item.id) {
            case ITEM.PANNING_TRAY:
                await player.say("Not the best idea i've had...", "It's likely to spill everywhere in that!");
                break;
            case ITEM.SPECIMEN_JAR:
                await player.say('Perhaps not, it might contaminate the samples');
                break;
            case ITEM.JUG:
                await player.say('I had better not, someone might want to drink from this!');
                break;
            case ITEM.VASE:
                await player.say("I'm not sure it's good for growing flowers!");
                break;
            case ITEM.EMPTY_VIAL:
                player.message('You fill the vial with the liquid');
                player.message('You close the barrel');
                player.inventory.remove(ITEM.EMPTY_VIAL);
                player.inventory.add(ITEM.UNIDENTIFIED_LIQUID);
                replace(player, gameObject, X_BARREL);
                await player.say(
                    "I'm not sure what this stuff is",
                    'I had better be very careful with it',
                    'I had better not spill any I think...'
                );
                break;
            default:
                player.message('Nothing interesting happens');
        }

        return true;
    }

    if (id === BRICK) {
        if (item.id === ITEM.EXPLOSIVE_COMPOUND) {
            player.message('You pour the compound over the bricks');
            player.inventory.remove(ITEM.EXPLOSIVE_COMPOUND);
            await player.say('I need some way to ignite this compound...');

            if (!player.cache.brick_ignite) {
                player.cache.brick_ignite = true;
            }
        } else if (item.id === ITEM.TINDERBOX) {
            if (player.cache.brick_ignite) {
                player.message('You strike the tinderbox');
                player.message('Fizz...');
                await player.world.sleepTicks(1);
                await player.say('Whoa! this is going to blow!"', "I'd better run!");
                await player.world.sleepTicks(3);
                player.teleport(22, 3379);
                setStage(player, 6);
                delete player.cache.brick_ignite;
                await mes(player, '"Bang!!!"');
                await player.say(
                    'Wow that was a big explosion!',
                    "...What's that noise I can hear ?",
                    '...Sounds like bones moving or something'
                );
            } else {
                await player.say('Now what am I trying to achieve here ?');
            }
        } else if (item.id === ITEM.ROCK_PICK) {
            await player.say(
                'That would be like cutting the lawn with nail scissors!',
                'It would take a year to chip away these rocks...'
            );
        } else {
            player.message('Nothing interesting happens');
        }

        return true;
    }

    if (id === SPECIMEN_TRAY) {
        switch (item.id) {
            case ITEM.TROWEL:
            case ITEM.SPADE:
                await withWorkman(player, async (workman) => {
                    if (item.id === ITEM.TROWEL) {
                        await workman.say('Excuse me...', 'No digging in the specimen trays please');
                    } else {
                        await workman.say(
                            'Oi! what do you think you are doing ?',
                            "Don't you realize there are fragile specimens around here ?"
                        );
                    }
                });
                break;
            case ITEM.SPECIMEN_JAR:
                // behavior unconfirmed on replay in the Java too
                await player.say("I'm not sure if this will be useful or not");
                await mes(player, 'You scoop some earth with the jar');
                break;
            default:
                player.message('Nothing interesting happens');
        }

        return true;
    }

    if (BURIED_SKELETONS.includes(id) && item.id === ITEM.TROWEL) {
        await withWorkman(player, async (workman) => {
            await workman.say("Hey! that's fragile!", 'Stop poking it around with that trowel!');
            await player.say('Oh okay, sorry');
        });

        return true;
    }

    if (WINCHES.includes(id) && item.id === ITEM.ROPE) {
        await ropeOnWinch(player, gameObject);

        return true;
    }

    return false;
}

module.exports = { onGameObjectCommandOne, onGameObjectCommandTwo, onUseWithGameObject };
