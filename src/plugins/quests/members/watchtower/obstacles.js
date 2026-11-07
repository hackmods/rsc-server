// The Watchtower quest's objects (the stage map is in shared.js), from authentic/quests/members/watchtower/WatchTowerObstacles.java
// (AGPL-3.0): the tower ladders 659, 1021 and 1017, the lever 1014 that ends the quest, the clue bushes, Toban's chest 978 and
// the two booby-trapped chests 1003 and 1001. The Gu'Tanoth side of the same file (rock jump, enclave, skavid caves, tunnel
// cave, dark place) was ported earlier in game-objects/watchtower-obstacles.js and object-tele-points.js.

const { NPC, ITEM, CRYSTALS, stageOf, give, carries, findNpc, chase, rng, ticksOf, completeQuest } = require('./shared');
const { openTobanChest } = require('./mechanism');

const TOWER_FIRST_FLOOR_LADDER = 659;
const COMPLETED_QUEST_LADDER = 1017;
const TOWER_SECOND_FLOOR_LADDER = 1021;
const WATCHTOWER_LEVER = 1014;
const WATCHTOWER_LEVER_DOWNPOSITION = 1015;
const WRONG_BUSH = 960;
const CORRECT_BUSHES = [993, 961, 992, 991, 990];
const TOBAN_CHEST_CLOSED = 978;
const CHEST_WEST = 1003;
const CHEST_EAST = 1001;
const CHEST_OPEN = 1002;

const LEVER_TICKS = ticksOf(2000);

// ---------------------------------------------------------------- the lever

async function pullLever(player, gameObject) {
    // changeloc to the down position, the lever comes back 2 seconds later
    player.world.replaceTimed('gameObjects', gameObject, WATCHTOWER_LEVER_DOWNPOSITION, LEVER_TICKS);
    player.message('You pull the lever');

    if (stageOf(player) !== 10) {
        player.message('It had no effect');
        return;
    }

    player.message('The magic forcefield activates');
    player.teleport(492, 3521);

    for (const id of CRYSTALS) {
        player.inventory.remove(id);
    }

    const wizard = findNpc(player, NPC.WATCHTOWER_WIZARD, 6);

    if (!wizard) {
        player.message('Seems like the wizards were busy, please go back and complete again');
        return;
    }

    await wizard.say(
        'Marvellous! it works!',
        'The town will now be safe',
        'Your help was invaluable',
        'Take this payment as a token of my gratitude...'
    );
    player.message('The wizard gives you 5000 pieces of gold');
    give(player, ITEM.COINS, 5000);
    await wizard.say('Also, let me improve your magic level for you');
    player.message('The wizard lays his hands on you...');
    player.message('You feel magic power increasing');
    await wizard.say('Here is a special item for you...');
    give(player, ITEM.SPELL_SCROLL, 1);
    await wizard.say("It's a new spell", 'Read the scroll and you will be able', 'To teleport yourself to here magically...');
    completeQuest(player);
}

// ---------------------------------------------------------------- the clue bushes

async function searchBush(player, gameObject) {
    if (stageOf(player) === 0) {
        await player.say('I am not sure why I am searching this bush...');
        return;
    }

    const [armour, fingernails, eyePatch, robe, dagger] = CORRECT_BUSHES;

    if (gameObject.id === WRONG_BUSH) {
        await player.say('Hmmm, nothing here');
    } else if (gameObject.id === armour) {
        await player.say("Here's Some armour, it could be evidence...");
        give(player, ITEM.ARMOUR, 1);
    } else if (gameObject.id === fingernails) {
        if (!carries(player, ITEM.FINGERNAILS)) {
            await player.say("What's this ?", 'Disgusting! some fingernails', "They may be a clue though... I'd better take them");
            give(player, ITEM.FINGERNAILS, 1);
        } else {
            await player.say('I have already searched this place');
        }
    } else if (gameObject.id === eyePatch) {
        if (!carries(player, ITEM.WATCH_TOWER_EYE_PATCH)) {
            await player.say("I've found an eyepatch, I better show this to the wizards");
            give(player, ITEM.WATCH_TOWER_EYE_PATCH, 1);
        } else {
            await player.say('I have already searched this place');
        }
    } else if (gameObject.id === robe) {
        if (!carries(player, ITEM.ROBE)) {
            await player.say('Aha! a robe');
            give(player, ITEM.ROBE, 1);
            await player.say('This could be a clue...');
        } else {
            await player.say('I have already searched this place');
        }
    } else if (gameObject.id === dagger) {
        await player.say('Aha a dagger');
        give(player, ITEM.DAGGER, 1);
        await player.say('I wonder if this is evidence...');
    }
}

// ---------------------------------------------------------------- the chests

// the Java spawns these with addnpc(..., 60000 * 5) and, for a few, startCombat(player)
function spawnBeside(player, gameObject, id, fight) {
    const npc = player.world.spawnTimedNPC({ id, x: gameObject.x - 1, y: gameObject.y, ticks: ticksOf(60000 * 5) });

    if (fight) {
        chase(player, npc);
    }
}

async function randomizedChest(player, gameObject) {
    player.message('You open the chest');
    player.world.replaceTimed('gameObjects', gameObject, CHEST_OPEN, ticksOf(2500));

    const roll = rng.int(0, 7);

    if (roll === 0) {
        await player.say('Hey! a scorpion is in here!');
        spawnBeside(player, gameObject, NPC.POISON_SCORPION, true);
    } else if (roll === 1) {
        await player.say('Oh no, not one of these spider things!');
        spawnBeside(player, gameObject, NPC.POISON_SPIDER, true);
    } else if (roll === 2) {
        await player.say('How on earth did this dwarf get in here ?');
        spawnBeside(player, gameObject, NPC.CHAOS_DWARF, true);
    } else if (roll === 3) {
        await player.say('Ugh! a dirty rat!');
        spawnBeside(player, gameObject, NPC.RAT_LVL8, false);
    } else if (roll === 4) {
        await player.say('Oh dear, I bet these apples taste disgusting');
        give(player, ITEM.ROTTEN_APPLES, 1);
    } else if (roll === 5) {
        await player.say('Oh great, some bones!');
        give(player, ITEM.BONES, 1);
    } else if (roll === 6) {
        await player.say('Wow, look at the size of this emerald!');
        give(player, ITEM.EMERALD, 1);
    } else if (roll === 7) {
        await player.say('Burnt fish - why did I bother ?');
        give(player, ITEM.BURNT_PIKE, 1);
    }

    player.message('The chest snaps shut');
}

async function poisonSpiderChest(player, gameObject) {
    player.message('You open the chest');
    player.world.replaceTimed('gameObjects', gameObject, CHEST_OPEN, LEVER_TICKS);
    player.message('Ahh! there is a poison spider inside');
    player.message("Someone's idea of a joke...");

    const spider = player.world.spawnTimedNPC({
        id: NPC.POISON_SPIDER,
        x: gameObject.x,
        y: gameObject.y + 1,
        ticks: ticksOf(60000 * 5)
    });

    chase(player, spider);
    await player.world.sleepTicks(3);
    player.message('The chest snaps shut');
}

// ---------------------------------------------------------------- hooks

async function onGameObjectCommandOne(player, gameObject) {
    const { id } = gameObject;

    if (id === COMPLETED_QUEST_LADDER) {
        player.teleport(636, 1684);
        return true;
    }

    if (id === TOWER_SECOND_FLOOR_LADDER) {
        if (stageOf(player) === -1) {
            player.teleport(492, 3524);
        } else {
            player.teleport(636, 2628);
        }

        return true;
    }

    if (id === TOWER_FIRST_FLOOR_LADDER) {
        const guard = findNpc(player, NPC.TOWER_GUARD, 5);

        if (stageOf(player) === 0) {
            if (guard) {
                player.engage(guard);
                await guard.say("You can't go up there", "That's private that is");
                player.disengage();
            }

            return true;
        }

        if (guard) {
            player.engage(guard);
            await guard.say('It is the wizards helping hand', "Let 'em up");
            player.disengage();
        }

        player.climb(gameObject, true);

        return true;
    }

    if (id === WATCHTOWER_LEVER_DOWNPOSITION) {
        player.message('The lever is stuck in the down position');
        return true;
    }

    if (id === WATCHTOWER_LEVER) {
        await pullLever(player, gameObject);
        return true;
    }

    if (id === WRONG_BUSH || CORRECT_BUSHES.includes(id)) {
        await searchBush(player, gameObject);
        return true;
    }

    if (id === TOBAN_CHEST_CLOSED) {
        if (carries(player, ITEM.KEY)) {
            await openTobanChest(player, gameObject, true);
        } else {
            player.message('The chest is locked');
            await player.say('I think I need a key of some sort...');
        }

        return true;
    }

    if (id === CHEST_WEST) {
        await randomizedChest(player, gameObject);
        return true;
    }

    if (id === CHEST_EAST) {
        await poisonSpiderChest(player, gameObject);
        return true;
    }

    return false;
}

module.exports = { onGameObjectCommandOne };
