// Ported from Open-RSC Core-Framework authentic/quests/members/Jungle_Potion.java (AGPL-3.0): the herb spots
//
// Each spot drops one grimy herb (owner-only ground item) at the stage Trufitus asked for it, unless one is carried
// (grimy or clean) or one was already given out for this stage (cache got_*, cleared when Trufitus asks again):
//   Jungle Vine 564 (Search)            -> unidentified Snake Weed 815      stage 1 (and Legends' Quest past stage 6)
//   PalmTree 553 (Search)               -> unidentified Ardrigal 817        stage 2 (and Legends' Quest past stage 6)
//   Scorched Earth 554 (Search)         -> unidentified Sito Foil 819       stage 3
//   Rocks 555 (Mine or Search)          -> unidentified Volencia Moss 821   stage 4
//   Cavern wall 151 (wall object, search) -> unidentified Rogues Purse 823  stage 5, under the player
// The grimy herbs are identified with Herblaw (skills/herblaw.js, level 3).

const SNAKE_JUNGLE_VINE_ID = 564;
const ARDRIGAL_PALM_TREE_ID = 553;
const SITO_SCORCHED_EARTH_ID = 554;
const VOLENCIA_ROCKS_ID = 555;
const ROGUES_PURSE_WALL_ID = 151;

const UNIDENTIFIED_SNAKE_WEED_ID = 815;
const SNAKE_WEED_ID = 816;
const UNIDENTIFIED_ARDRIGAL_ID = 817;
const ARDRIGAL_ID = 818;
const UNIDENTIFIED_SITO_FOIL_ID = 819;
const SITO_FOIL_ID = 820;
const UNIDENTIFIED_VOLENCIA_MOSS_ID = 821;
const VOLENCIA_MOSS_ID = 822;
const UNIDENTIFIED_ROGUES_PURSE_ID = 823;
const ROGUES_PURSE_ID = 824;

function stageOf(player) {
    return player.questStages.junglePotion || 0;
}

function legendsStage(player) {
    return player.questStages.legendsQuest || 0;
}

function cacheTrue(player, key) {
    return player.cache[key] === true;
}

function carriesEither(player, grimy, clean) {
    return player.inventory.has(grimy) || player.inventory.has(clean);
}

async function mes(player, line) {
    player.message(line);
    await player.world.sleepTicks(3);
}

async function snakeVine(player, gameObject) {
    const stage = stageOf(player);
    const legends = legendsStage(player);

    if (stage !== 1 && legends === 0) {
        player.message('Yep, it looks like a vine...');
        return;
    }

    if (legends >= 1 && legends <= 6) {
        player.message('Yep, it looks like a vine...');
        return;
    }

    if (
        !carriesEither(player, UNIDENTIFIED_SNAKE_WEED_ID, SNAKE_WEED_ID) &&
        (legends >= 6 || (!cacheTrue(player, 'got_snake_weed') && stage === 1))
    ) {
        await mes(player, 'Small amounts of a herb are growing near this vine');
        player.world.addPlayerDrop(player, UNIDENTIFIED_SNAKE_WEED_ID, gameObject.x, gameObject.y);

        if (stage === 1) {
            player.cache.got_snake_weed = true;
        }
    } else {
        player.message('Yep, it looks like a vine...');
    }
}

async function ardrigalPalm(player, gameObject) {
    const stage = stageOf(player);
    const legends = legendsStage(player);

    // sic: a finished quest (-1) is below 1 too
    if (stage < 1 && legends === 0) {
        player.message('You find nothing of interest this time, sorry!');
        return;
    }

    if (legends >= 1 && legends <= 6) {
        player.message('You find nothing of interest this time, sorry!');
        return;
    }

    if (
        !carriesEither(player, UNIDENTIFIED_ARDRIGAL_ID, ARDRIGAL_ID) &&
        (legends >= 6 || (!cacheTrue(player, 'got_ardigal') && stage === 2))
    ) {
        await mes(player, 'You find a herb plant growing at the base of the palm');
        player.world.addPlayerDrop(player, UNIDENTIFIED_ARDRIGAL_ID, gameObject.x, gameObject.y);

        if (stage === 2) {
            player.cache.got_ardigal = true;
        }
    } else {
        player.message('You find nothing of interest this time, sorry!');
    }
}

async function sitoEarth(player, gameObject) {
    if (
        !carriesEither(player, UNIDENTIFIED_SITO_FOIL_ID, SITO_FOIL_ID) &&
        !cacheTrue(player, 'got_sito_foil') &&
        stageOf(player) === 3
    ) {
        await mes(player, 'A small herb plant is growing in the scorched soil.');
        player.world.addPlayerDrop(player, UNIDENTIFIED_SITO_FOIL_ID, gameObject.x, gameObject.y);
        player.cache.got_sito_foil = true;
    } else {
        player.message('You just find scorched earth.');
    }
}

async function volenciaRocks(player, gameObject) {
    if (
        !carriesEither(player, UNIDENTIFIED_VOLENCIA_MOSS_ID, VOLENCIA_MOSS_ID) &&
        !cacheTrue(player, 'got_volencia_moss') &&
        stageOf(player) === 4
    ) {
        await mes(player, 'Small amounts of herb moss are growing at the base of this rock');
        player.world.addPlayerDrop(player, UNIDENTIFIED_VOLENCIA_MOSS_ID, gameObject.x, gameObject.y);
        player.cache.got_volencia_moss = true;
    } else {
        player.message('You find nothing of interest.');
    }
}

// OpLocTrigger: every command of these objects (Rocks 555 "Mine" too)
async function onGameObject(player, gameObject) {
    switch (gameObject.id) {
        case SNAKE_JUNGLE_VINE_ID:
            await snakeVine(player, gameObject);
            return true;
        case ARDRIGAL_PALM_TREE_ID:
            await ardrigalPalm(player, gameObject);
            return true;
        case SITO_SCORCHED_EARTH_ID:
            await sitoEarth(player, gameObject);
            return true;
        case VOLENCIA_ROCKS_ID:
            await volenciaRocks(player, gameObject);
            return true;
    }

    return false;
}

// OpBoundTrigger: the cavern wall under the island (any command)
async function onWallObject(player, wallObject) {
    if (wallObject.id !== ROGUES_PURSE_WALL_ID) {
        return false;
    }

    if (
        !carriesEither(player, UNIDENTIFIED_ROGUES_PURSE_ID, ROGUES_PURSE_ID) &&
        !cacheTrue(player, 'got_rogues_purse') &&
        stageOf(player) === 5
    ) {
        await mes(player, 'Small amounts of herb fungus are growing at the base of this cavern wall');
        player.world.addPlayerDrop(player, UNIDENTIFIED_ROGUES_PURSE_ID, player.x, player.y);
        player.cache.got_rogues_purse = true;
    } else {
        player.message('You find nothing of interest.');
    }

    return true;
}

async function onGameObjectCommandOne(player, gameObject) {
    return onGameObject(player, gameObject);
}

async function onGameObjectCommandTwo(player, gameObject) {
    return onGameObject(player, gameObject);
}

async function onWallObjectCommandOne(player, wallObject) {
    return onWallObject(player, wallObject);
}

async function onWallObjectCommandTwo(player, wallObject) {
    return onWallObject(player, wallObject);
}

module.exports = {
    onGameObjectCommandOne,
    onGameObjectCommandTwo,
    onWallObjectCommandOne,
    onWallObjectCommandTwo
};
