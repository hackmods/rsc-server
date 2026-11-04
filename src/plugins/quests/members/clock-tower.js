// Ported from Open-RSC Core-Framework authentic/quests/members/ClockTower.java (AGPL-3.0)
// https://classic.runescape.wiki/w/Clock_Tower
//
// questStages.clockTower (the Java stages):
//   0  Brother Kojo (366) in the clock tower south of East Ardougne (580,637): "Ok old monk what can I do?" -> 1
//   1  four Large cogs (727-730) lie in the cellar (y 3456-3484); each goes on its own clock pole, one per floor. Using
//      the right cog on the right pole stores a cache flag (wrong pole: "The cog doesn't fit"):
//        1st_cog  purple cog (730, ground spawn 579,3474, behind the rat cage) on the purple pole (364) at (581,2525),
//                 the top floor
//        2nd_cog  black cog (728, 609,3465, red hot) on the black pole (365) at (581,639), the ground floor
//        3rd_cog  blue cog (727, 583,3456, behind the odd looking wall 22 at 584,3457) on the blue pole (362) at
//                 (580,3470), the cellar
//        4th_cog  red cog (729, 616,3484) on the red pole (363) at (582,1582), the first floor
//      with all four flags Kojo hears the clock tick -> -1: 1 quest point, no experience, 500 coins; the four cog flags
//      and rats_dead are cleared
// The cogs are heavy: only one is carried at a time (onGroundItemTake). The black cog is too hot to pick up: wielded Ice
// gloves (556) or a bucket of water (50, used up) cool it, and the cog stays on the ground for the next player.
// The rat cage: Rat Poison (731, ground spawn 592,3483) in the Foodtrough (375) at (591,3474) stores foodtrough. The
// levers drive the two cage gates (371 closed, 372 open; both open in rsc-data): the outer lever (373, 594,3478) toggles
// the gate at (594,3475), the inner lever (374, 590,3478) the gate at (590,3475). Pulling the outer lever with both gates
// open, or pushing the inner one with both shut, while the trough is poisoned kills the Dungeon rats (367) in view
// (they respawn as usual) -> rats_dead, and the rat cage (wall 111, 583,3476) can be crawled through to the purple cog.
// The odd looking wall (22) at (584,3457) is a secret door; quests/free/black-knights-fortress/other-doors.js handles
// every odd looking wall the same way (it is earlier in index.js and claims it first).

const BROTHER_KOJO_ID = 366;
const DUNGEON_RAT_ID = 367;

const COINS_ID = 10;
const BUCKET_OF_WATER_ID = 50;
const ICE_GLOVES_ID = 556;
const LARGE_COG_BLUE_ID = 727;
const LARGE_COG_BLACK_ID = 728;
const LARGE_COG_RED_ID = 729;
const LARGE_COG_PURPLE_ID = 730;
const RAT_POISON_ID = 731;
const COG_IDS = [LARGE_COG_BLUE_ID, LARGE_COG_BLACK_ID, LARGE_COG_RED_ID, LARGE_COG_PURPLE_ID];

const CLOCK_POLE_BLUE_ID = 362;
const CLOCK_POLE_RED_ID = 363;
const CLOCK_POLE_PURPLE_ID = 364;
const CLOCK_POLE_BLACK_ID = 365;
const POLE_IDS = new Set([CLOCK_POLE_BLUE_ID, CLOCK_POLE_RED_ID, CLOCK_POLE_PURPLE_ID, CLOCK_POLE_BLACK_ID]);

const GATE_CLOSED_ID = 371;
const GATE_OPEN_ID = 372;
const LEVER_OUTER_ID = 373;
const LEVER_INNER_ID = 374;
const FOODTROUGH_ID = 375;
const OUTER_GATE = { x: 594, y: 3475 };
const INNER_GATE = { x: 590, y: 3475 };

const RAT_CAGE_ID = 111;
const ODD_WALL_ID = 22;
const ODD_WALL = { x: 584, y: 3457 };
const NOTHING_BOUNDARY_ID = 16;

// cog -> the one pole (id and tile) it fits, and the cache flag it stores
const COG_POLES = {
    [LARGE_COG_PURPLE_ID]: { pole: CLOCK_POLE_PURPLE_ID, x: 581, y: 2525, key: '1st_cog' },
    [LARGE_COG_BLACK_ID]: { pole: CLOCK_POLE_BLACK_ID, x: 581, y: 639, key: '2nd_cog' },
    [LARGE_COG_BLUE_ID]: { pole: CLOCK_POLE_BLUE_ID, x: 580, y: 3470, key: '3rd_cog' },
    [LARGE_COG_RED_ID]: { pole: CLOCK_POLE_RED_ID, x: 582, y: 1582, key: '4th_cog' }
};

const COG_KEYS = ['1st_cog', '2nd_cog', '3rd_cog', '4th_cog'];

function stageOf(player) {
    return player.questStages.clockTower || 0;
}

function hasKey(player, key) {
    return player.cache[key] != null;
}

function carriesCog(player) {
    return COG_IDS.some((id) => player.inventory.has(id));
}

function isPoleFor(cogId, obj) {
    const target = COG_POLES[cogId];
    return obj.id === target.pole && obj.x === target.x && obj.y === target.y;
}

// ClockTower.handleReward: 1 quest point, no experience; the cog and rat flags go, then 500 coins
function completeQuest(player) {
    player.completeQuest('clockTower', { questPoints: 1 });

    delete player.cache.rats_dead;

    for (const key of COG_KEYS) {
        delete player.cache[key];
    }

    player.inventory.add(COINS_ID, 500);
}

async function brotherKojo(player, npc) {
    const stage = stageOf(player);

    if (stage === 0) {
        await player.say('Hello Monk');
        await npc.say("Hello traveller, I'm Brother Kojo", 'Do you know the time?');
        await player.say('No... Sorry');
        await npc.say(
            'Oh dear, oh dear, I must fix the clock',
            'The town people are becoming angry',
            'Please could you help?'
        );

        const menu = await player.ask(['Ok old monk what can I do?', 'Not now old monk'], true);

        if (menu === 0) {
            // player.getText("ClockTowerKojoOhThankYou"): "Oh thank you kind sir" in the authentic message files
            await npc.say(
                'Oh thank you kind sir',
                "In the cellar below you'll find four cogs",
                "They're too heavy for me, but you should",
                'Be able to carry them one at a time',
                'One goes on each floor',
                "But I can't remember which goes where"
            );
            await player.say("I'll do my best");
            await npc.say('Be careful, strange beasts dwell in the cellars');
            player.questStages.clockTower = 1;
        } else if (menu === 1) {
            await npc.say('Ok then');
        }
    } else if (stage === 1) {
        if (COG_KEYS.every((key) => hasKey(player, key))) {
            await player.say('I have replaced all the cogs');
            await npc.say('Really..? wait, listen');
            player.message('Tick Tock, Tick Tock');
            await npc.say('Well done, well done');
            player.message('Tick Tock, Tick Tock');
            await npc.say("Yes yes yes, you've done it", 'You are clever');
            player.message('You have completed the clock tower quest');
            await npc.say('That will please the village folk', 'Please take these coins as a reward');
            completeQuest(player);
            return;
        }

        await player.say('Hello again');
        await npc.say(
            'Oh hello, are you having trouble?',
            'The cogs are in four rooms below us',
            'Place one cog on a pole on each',
            'Of the four tower levels'
        );
    } else if (stage === -1) {
        await player.say('Hello again Brother Kojo');
        await npc.say('Oh hello there traveller', "You've done a grand job with the clock", "It's just like new");
    }
}

async function onTalkToNPC(player, npc) {
    if (npc.id !== BROTHER_KOJO_ID) {
        return false;
    }

    player.engage(npc);

    try {
        await brotherKojo(player, npc);
    } finally {
        player.disengage();
    }

    return true;
}

function inspectPole(player, pole) {
    const stage = stageOf(player);

    if (stage === -1) {
        player.message('The clock is now working');
        return;
    }

    if (stage !== 0 && stage !== 1) {
        return;
    }

    for (const cogId of [LARGE_COG_PURPLE_ID, LARGE_COG_BLACK_ID, LARGE_COG_BLUE_ID, LARGE_COG_RED_ID]) {
        if (hasKey(player, COG_POLES[cogId].key) && isPoleFor(cogId, pole)) {
            player.message("There's a large cog on this pole");
            return;
        }
    }

    player.message('A large pole, a cog is missing');
}

function gateAt(world, { x, y }) {
    return world.gameObjects
        .getAtPoint(x, y)
        .find((object) => object.id === GATE_CLOSED_ID || object.id === GATE_OPEN_ID);
}

async function pullLever(player, lever) {
    const { world } = player;
    let dynGate;
    let statGate;
    let correctSetup;

    if (lever.id === LEVER_OUTER_ID) {
        dynGate = gateAt(world, OUTER_GATE);
        statGate = gateAt(world, INNER_GATE);
        // outer gate was open + inner gate is open
        correctSetup = dynGate && statGate && dynGate.id === GATE_OPEN_ID && statGate.id === GATE_OPEN_ID;
    } else {
        dynGate = gateAt(world, INNER_GATE);
        statGate = gateAt(world, OUTER_GATE);
        // inner gate was closed + outer gate is closed
        correctSetup = dynGate && statGate && dynGate.id === GATE_CLOSED_ID && statGate.id === GATE_CLOSED_ID;
    }

    if (!dynGate) {
        return;
    }

    if (dynGate.id === GATE_CLOSED_ID) {
        player.message('The gate swings open');
        world.replaceEntity('gameObjects', dynGate, GATE_OPEN_ID);
    } else {
        player.message('The gate creaks shut');
        world.replaceEntity('gameObjects', dynGate, GATE_CLOSED_ID);
    }

    if (hasKey(player, 'foodtrough') && correctSetup) {
        for (const line of [
            'In their panic the rats bend and twist',
            'The cage bars with their teeth',
            "They're becoming weak, some have collapsed",
            'The rats are eating the poison',
            "They're becoming weak, some have collapsed",
            'The rats are slowly dying'
        ]) {
            player.message(`@que@${line}`);
            await world.sleepTicks(3);
        }

        // Open-RSC Npc#remove: the rats in view go and respawn as usual
        for (const rat of player.getNearbyEntitiesByID('npcs', DUNGEON_RAT_ID, 16)) {
            if (rat.opponent && typeof rat.abandonFight === 'function') {
                rat.abandonFight();
            }

            world.removeEntity('npcs', rat);
        }

        delete player.cache.foodtrough;
        player.cache.rats_dead = true;
    }
}

async function onGameObjectCommandOne(player, gameObject) {
    if (POLE_IDS.has(gameObject.id)) {
        inspectPole(player, gameObject);
        return true;
    }

    if (gameObject.id === LEVER_OUTER_ID || gameObject.id === LEVER_INNER_ID) {
        await pullLever(player, gameObject);
        return true;
    }

    if (gameObject.id === GATE_CLOSED_ID && gameObject.y === OUTER_GATE.y) {
        // the authentic branch: Open-RSC's WANT_FIXED_BROKEN_MECHANICS climb over the gate is custom
        player.message('The gate is locked');
        player.message('The gate will not open from here');
        return true;
    }

    return false;
}

async function onUseWithGameObject(player, gameObject, item) {
    if (gameObject.id === FOODTROUGH_ID && item.id === RAT_POISON_ID) {
        player.message('You pour the rat poison into the feeding trough');
        player.inventory.remove(RAT_POISON_ID, 1);
        player.cache.foodtrough = true;
        return true;
    }

    if (!POLE_IDS.has(gameObject.id) || !COG_POLES[item.id]) {
        return false;
    }

    const { key } = COG_POLES[item.id];

    if (!isPoleFor(item.id, gameObject)) {
        player.message("The cog doesn't fit");
        return true;
    }

    const stage = stageOf(player);

    if (stage === 1 && !hasKey(player, key)) {
        player.message('The cog fits perfectly');
        player.inventory.remove(item.id, 1);
        player.cache[key] = true;
    } else if (stage === -1 || hasKey(player, key)) {
        player.message('You have already placed a cog here');
    }

    return true;
}

async function onWallObjectCommandOne(player, wallObject) {
    const { world } = player;

    if (wallObject.id === RAT_CAGE_ID) {
        if (hasKey(player, 'rats_dead') || stageOf(player) === -1) {
            player.message('In a panic to escape, the rats have..');
            await world.sleepTicks(1);
            player.message('..bent the bars, you can just crawl through');

            if (player.x >= 583) {
                player.teleport(582, 3476);
            } else {
                player.teleport(583, 3476);
            }
        }

        return true;
    }

    if (wallObject.id === ODD_WALL_ID && wallObject.x === ODD_WALL.x && wallObject.y === ODD_WALL.y) {
        player.sendSound('secretdoor');
        player.message('You just went through a secret door');
        await player.enterDoor(wallObject, NOTHING_BOUNDARY_ID);
        return true;
    }

    return false;
}

// cooling the black cog takes the cog but leaves the spawn on the ground
function coolBlackCog(player, { removeBucket }) {
    if (carriesCog(player)) {
        player.message('You can only carry one');
        return;
    }

    player.message('You take the cog');
    player.inventory.add(LARGE_COG_BLACK_ID, 1);

    if (removeBucket) {
        player.inventory.remove(BUCKET_OF_WATER_ID, 1);
    }
}

async function onGroundItemTake(player, groundItem) {
    const { world } = player;

    if (
        groundItem.id === LARGE_COG_PURPLE_ID ||
        groundItem.id === LARGE_COG_BLUE_ID ||
        groundItem.id === LARGE_COG_RED_ID
    ) {
        if (carriesCog(player)) {
            player.message('The cogs are heavy, you can only carry one');
            return true;
        }

        return false;
    }

    if (groundItem.id !== LARGE_COG_BLACK_ID) {
        return false;
    }

    if (player.inventory.has(ICE_GLOVES_ID) && player.inventory.isEquipped(ICE_GLOVES_ID)) {
        player.message('@que@The ice gloves cool down the cog');
        await world.sleepTicks(3);
        player.message('@que@You can carry it now');
        await world.sleepTicks(3);
        coolBlackCog(player, { removeBucket: false });
    } else if (player.inventory.has(BUCKET_OF_WATER_ID)) {
        player.message('@que@You pour water over the cog');
        await world.sleepTicks(3);
        player.message('@que@The cog quickly cools down');
        await world.sleepTicks(3);
        coolBlackCog(player, { removeBucket: true });
    } else {
        player.message('@que@The cog is red hot from the flames, too hot to carry');
        await world.sleepTicks(3);
        player.message('@que@The cogs are heavy');
        await world.sleepTicks(3);

        if (carriesCog(player)) {
            player.message('You can only carry one');
        }
    }

    return true;
}

async function onUseWithGroundItem(player, groundItem, item) {
    if (item.id !== BUCKET_OF_WATER_ID || groundItem.id !== LARGE_COG_BLACK_ID) {
        return false;
    }

    const { world } = player;

    player.message('@que@You pour water over the cog');
    await world.sleepTicks(3);
    player.message('@que@The cog quickly cools down');
    await world.sleepTicks(3);
    coolBlackCog(player, { removeBucket: true });

    return true;
}

module.exports = {
    onTalkToNPC,
    onGameObjectCommandOne,
    onUseWithGameObject,
    onWallObjectCommandOne,
    onGroundItemTake,
    onUseWithGroundItem
};
