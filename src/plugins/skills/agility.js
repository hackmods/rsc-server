'use strict';

/**
 * Agility (replaces the 0-byte upstream stub): the three members courses and the shortcuts.
 *
 *   gnome      Tree Gnome Stronghold   log, net, tree up, rope, tree down, net, pipe
 *   barbarian  Barbarian Outpost       pipe, rope swing, log, net, ledge, handholds (side climb), two low walls
 *   wilderness the gated course        gate, pipe, rope swing, stepping stones, ledge, vine
 *
 * Ported from Open-RSC Core-Framework authentic/skills/agility/{Gnome,Barbarian,Wilderness}AgilityCourse.java and
 * AgilityShortcuts.java (AGPL-3.0). Each obstacle is its Java body (messages, delays, tiles, failure rolls and damage),
 * the lap bonus follows AgilityUtils.completedObstacle, and xp is the Java incExp quarter-point value.
 *
 * Ladders (barbarian ladder 6) stay with climbable.js. The ids below that climbable.js would claim by its
 * "climb up/down" regex (gnome branches 648/649, barbarian net 677, wilderness vine 709, and shortcut climbs) are
 * excluded from it when this file loads, because index.js runs climbable.js first and its first-true-wins dispatch
 * would otherwise steal them.
 */

const PLANE = 944;

/**
 * The three courses, ported line for line from Open-RSC Core-Framework authentic/skills/agility/
 * GnomeAgilityCourse.java, BarbarianAgilityCourse.java and WildernessAgilityCourse.java (AGPL-3.0).
 *
 * obstacles: ids that count towards the lap bonus; last: the id that pays it (AgilityUtils.completedObstacle)
 * lap:       bonus agility xp, quarter points as in Java incExp
 */
const COURSES = {
    gnome: {
        name: 'Gnome Stronghold',
        obstacles: [655, 647, 648, 650, 649, 653],
        last: 654,
        lap: 150
    },
    barbarian: {
        name: 'Barbarian Outpost',
        obstacles: [675, 676, 677, 678, 163],
        last: 164,
        lap: 300
    },
    wilderness: {
        name: 'Wilderness',
        obstacles: [705, 706, 707, 708],
        last: 709,
        lap: 1500
    }
};

// Java gnome trainers (NpcId.GNOME_TRAINER_*)
const TRAINER_ENTRANCE = 576;
const TRAINER_STARTING_NET = 577;
const TRAINER_PLATFORM = 578;
const TRAINER_ENDING_NET = 579;

// player -> Set of obstacle ids done: Java attribute "obstaclesDone", shared by every course. Absent is Java null.
const progress = new WeakMap();

// swappable by the smoke test
const rng = { random: () => Math.random() };

// Java AgilityUtils.completedObstacle
function completedObstacle(player, id, courseKey) {
    const course = COURSES[courseKey];
    const done = progress.get(player);

    if (!done) {
        progress.set(player, id === course.last ? new Set() : new Set([id]));
        return;
    }

    if (course.obstacles.includes(id)) {
        done.add(id);
    } else if (
        id === course.last &&
        course.obstacles.every((obstacle) => done.has(obstacle))
    ) {
        player.addExperience('agility', course.lap);
        progress.set(player, new Set());
    }
}

// Java AgilityUtils.hasDoneObstacle
function hasDoneObstacle(player, id) {
    const done = progress.get(player);

    return !!done && done.has(id);
}

// pays an obstacle's xp and records it for the lap
function finishObstacle(player, id) {
    const obstacle = BY_ID.get(id) || WALL_BY_ID.get(id);

    player.addExperience('agility', obstacle.xp);
    completedObstacle(player, id, obstacle.course);
}

// the gnome trainer nearby shouts at a player who has not done this obstacle this lap
async function trainerSays(player, trainerId, obstacleId, line) {
    if (hasDoneObstacle(player, obstacleId)) {
        return;
    }

    const trainer = player
        .getNearbyEntitiesByID('npcs', trainerId, 10)
        .find((npc) => !npc.locked);

    if (trainer) {
        await trainer.say(line);
    }
}

function roundedHits(player, fraction) {
    return Math.round(player.skills.hits.current * fraction);
}

// ---- Tree Gnome Stronghold ----

async function gnomeLog(player) {
    const { world } = player;

    player.message('you stand on the slippery log');

    for (const y of [494, 495, 496, 497, 498, 499]) {
        player.teleport(692, y);
        await world.sleepTicks(1);
    }

    player.message('and walk across');
    finishObstacle(player, 655);
}

async function gnomeNet(player) {
    await trainerSays(
        player,
        TRAINER_STARTING_NET,
        647,
        'move it, move it, move it'
    );
    player.message('you climb the net');
    await player.world.sleepTicks(3);
    player.teleport(692, 1448);
    player.message('and pull yourself onto the platform');
    finishObstacle(player, 647);
}

async function gnomeTower(player) {
    await trainerSays(
        player,
        TRAINER_PLATFORM,
        648,
        "that's it, straight up, no messing around"
    );
    player.message('you pull yourself up the tree');
    await player.world.sleepTicks(2);
    player.teleport(693, 2394);
    player.message('to the platform above');
    finishObstacle(player, 648);
}

async function gnomeRope(player) {
    const { world } = player;

    player.message('you reach out and grab the rope swing');
    await world.sleepTicks(2);
    player.message('you hold on tight');
    await world.sleepTicks(4);
    player.teleport(685, 2396);
    player.message('and swing to the oppisite platform');
    finishObstacle(player, 650);
}

async function gnomeLanding(player) {
    player.message('you hang down from the tower');
    await player.world.sleepTicks(2);
    player.teleport(683, 506);
    player.message('and drop to the floor');
    await player.say('ooof');
    finishObstacle(player, 649);
}

async function gnomeSecondNet(player) {
    const { world } = player;

    await trainerSays(
        player,
        TRAINER_ENDING_NET,
        653,
        'my granny can move faster than you'
    );
    player.message('you take a few steps back');
    await world.sleepTicks(1);
    player.teleport(683, 505);
    player.message('and run towards the net');
    await world.sleepTicks(1);
    player.teleport(683, 501);
    finishObstacle(player, 653);
}

async function gnomePipe(player) {
    const { world } = player;

    player.message('you squeeze into the pipe');
    await world.sleepTicks(3);
    player.message('and shuffle down into it');
    await world.sleepTicks(3);
    player.teleport(683, 494);
    await trainerSays(
        player,
        TRAINER_ENTRANCE,
        654,
        "that's the way, well done"
    );
    finishObstacle(player, 654);
}

// ---- Barbarian Outpost ----

// Java Formulae.calcProductionSuccessfulLegacy(35, level, false, 50, 4)
function barbarianSucceeds(player) {
    return productionSucceeds(35, agilityLevel(player), false, 50, 4);
}

async function barbarianPipe(player) {
    if (agilityLevel(player) < 35) {
        player.message(
            'You need an agility level of 35 to attempt to squeeze through the pipe'
        );
        return;
    }

    if (player.fatigue >= MAX_FATIGUE) {
        player.message('You are too tired to squeeze through the pipe');
        return;
    }

    player.message('You squeeze through the pipe');
    await player.world.sleepTicks(3);

    if (player.y <= 551) {
        player.teleport(487, 554);
    } else {
        player.teleport(487, 551);
    }

    player.addExperience('agility', 20);
}

async function barbarianSwing(player) {
    const { world } = player;
    const pass = barbarianSucceeds(player);

    player.message('You grab the rope and try and swing across');
    await world.sleepTicks(3);

    if (pass) {
        player.message('You skillfully swing across the hole');
        await world.sleepTicks(3);
        player.teleport(486, 559);
        finishObstacle(player, 675);

        return;
    }

    player.message('Your hands slip and you fall to the level below');
    await world.sleepTicks(3);
    player.teleport(486, 3389);
    player.message('You land painfully on the spikes');
    await world.sleepTicks(3);
    const damage = roundedHits(player, 0.15);
    player.damage(damage);
    await player.say('ouch');
}

async function barbarianLog(player) {
    const { world } = player;
    const pass = barbarianSucceeds(player);

    player.message('you stand on the slippery log');
    await world.sleepTicks(3);

    if (pass) {
        player.teleport(489, 563);
        await world.sleepTicks(1);
        player.teleport(490, 563);
        await world.sleepTicks(1);
        player.message('and walk across');
        player.teleport(492, 563);
        finishObstacle(player, 676);

        return;
    }

    const damage = roundedHits(player, 0.1);

    player.message('Your lose your footing and land in the water');
    player.teleport(490, 561);
    player.message('Something in the water bites you');
    player.damage(damage);
}

async function barbarianNet(player) {
    player.message('You climb up the netting');
    // Java lands on (496,1507); on this map that tile is boxed in and the ledge (498,1506) is out of reach from it,
    // so land next to the ledge as the pre-port code did (proven live).
    player.teleport(497, 1506);
    finishObstacle(player, 677);
}

async function barbarianLedge(player, gameObject) {
    // Java ignores the second ledge object
    if (gameObject.x !== 498) {
        return;
    }

    const pass = barbarianSucceeds(player);

    player.message('You put your foot on the ledge and try to edge across');
    await player.world.sleepTicks(2);

    if (pass) {
        player.teleport(501, 1506);
        player.message('You skillfully balance across the hole');
        finishObstacle(player, 678);

        return;
    }

    const damage = roundedHits(player, 0.15);

    player.message('you lose your footing and fall to the level below');
    player.teleport(499, 563);
    player.message('You land painfully on the spikes');
    player.damage(damage);
    await player.say('ouch');
}

async function barbarianHandholds(player) {
    player.message('You climb up the wall');
    player.teleport(497, 555);
    player.addExperience('agility', 20);
}

// the two low walls (wall objects 163 and 164, Java onOpBound)
async function barbarianWall(player, wall) {
    if (player.fatigue >= MAX_FATIGUE) {
        player.message('you are too tired to jump the wall');
        return;
    }

    player.message('You jump over the wall');
    await player.world.sleepTicks(1);
    player.teleport(player.x === wall.x ? player.x - 1 : player.x + 1, player.y);
    finishObstacle(player, wall.id);
}

// ---- Wilderness course ----

// Java Formulae.calcProductionSuccessfulLegacy(52, level, false, 77, 4)
function wildernessSucceeds(player) {
    return productionSucceeds(52, agilityLevel(player), false, 77, 4);
}

// the gates: Java random(1, 5) drops the player into the wolf pit on 1 and 2
async function wildernessGate(player, gameObject) {
    const { world } = player;

    if (gameObject.id === 703 && agilityLevel(player) < 52) {
        player.message(
            'You need an agility level of 52 to attempt balancing along the ridge'
        );
        return;
    }

    const failRate = Math.floor(rng.random() * 5) + 1;

    player.message('You go through the gate and try to edge over the ridge');
    await world.sleepTicks(2);
    player.teleport(298, 130);
    await world.sleepTicks(2);

    if (failRate === 1 || failRate === 2) {
        player.message('you lose your footing and fall into the wolf pit');
        await world.sleepTicks(3);
        player.teleport(failRate === 1 ? 300 : 296, 129);

        return;
    }

    player.message('You skillfully balance across the ridge');
    await world.sleepTicks(3);
    player.teleport(298, gameObject.id === 703 ? 125 : 134);
    player.addExperience('agility', 50);
}

async function wildernessPipe(player) {
    player.message('You squeeze through the pipe');
    await player.world.sleepTicks(2);
    player.teleport(294, 112);
    finishObstacle(player, 705);
}

async function wildernessRope(player) {
    const { world } = player;
    const pass = wildernessSucceeds(player);

    player.message('You grab the rope and try and swing across');
    await world.sleepTicks(2);

    if (pass) {
        player.message('You skillfully swing across the hole');
        await world.sleepTicks(3);
        player.teleport(292, 108);
        finishObstacle(player, 706);

        return;
    }

    player.message('Your hands slip and you fall to the level below');
    await world.sleepTicks(2);

    const damage = roundedHits(player, 0.15);

    player.teleport(293, 2942);
    player.message('You land painfully on the spikes');
    await player.say('ouch');
    player.damage(damage);
}

async function wildernessStones(player) {
    const { world } = player;
    const pass = wildernessSucceeds(player);

    player.message('you stand on the stepping stones');
    await world.sleepTicks(2);

    if (!pass) {
        player.message('Your lose your footing and land in the lava');
        player.teleport(292, 104);
        player.damage(roundedHits(player, 0.21));

        return;
    }

    player.teleport(293, 105);
    await world.sleepTicks(1);
    player.teleport(294, 104);
    await world.sleepTicks(1);
    player.teleport(295, 104);
    player.message('and walk across');
    await world.sleepTicks(1);
    player.teleport(296, 105);
    await world.sleepTicks(1);
    player.teleport(297, 106);
    finishObstacle(player, 707);
}

async function wildernessLedge(player) {
    const { world } = player;
    const pass = wildernessSucceeds(player);

    player.message('you stand on the ledge');
    await world.sleepTicks(2);

    if (pass) {
        player.teleport(296, 112);
        await world.sleepTicks(1);
        player.message('and walk across');
        player.teleport(297, 112);
        await world.sleepTicks(1);
        player.teleport(298, 112);
        await world.sleepTicks(1);
        player.teleport(299, 111);
        await world.sleepTicks(1);
        player.teleport(300, 111);
        await world.sleepTicks(1);
        player.teleport(301, 111);
        finishObstacle(player, 708);

        return;
    }

    player.message('you lose your footing and fall to the level below');
    await world.sleepTicks(2);

    const damage = roundedHits(player, 0.25);

    player.teleport(298, 2945);
    player.message('You land painfully on the spikes');
    await player.say('ouch');
    player.damage(damage);
}

async function wildernessVine(player) {
    const { world } = player;

    player.message('You climb up the cliff');
    await world.sleepTicks(2);
    player.teleport(305, 118);
    await world.sleepTicks(1);
    player.teleport(304, 119);
    await world.sleepTicks(1);
    player.teleport(304, 120);
    finishObstacle(player, 709);
}

/**
 * ids:    game object ids handled
 * course: which COURSES entry the xp and lap bookkeeping belong to
 * xp:     agility xp per obstacle (Java incExp, quarter points)
 * tired:  Java refuses with "you are too tired to train" at full fatigue unless `tiredExempt`; a run that has its own
 *         fatigue message sets `tiredExempt` too
 * run:    the Java onOpLoc body for the obstacle
 */
const OBSTACLES = [
    // ---- Tree Gnome Stronghold ----
    { ids: [655], course: 'gnome', xp: 30, run: gnomeLog },
    { ids: [647], course: 'gnome', xp: 30, run: gnomeNet },
    { ids: [648], course: 'gnome', xp: 30, tiredExempt: true, run: gnomeTower },
    { ids: [650], course: 'gnome', xp: 30, tiredExempt: true, run: gnomeRope },
    {
        ids: [649],
        course: 'gnome',
        xp: 30,
        tiredExempt: true,
        run: gnomeLanding
    },
    { ids: [653], course: 'gnome', xp: 30, run: gnomeSecondNet },
    { ids: [654], course: 'gnome', xp: 30, run: gnomePipe },

    // ---- Barbarian Outpost ----
    {
        ids: [671, 672],
        course: 'barbarian',
        xp: 20,
        tiredExempt: true,
        run: barbarianPipe
    },
    { ids: [675], course: 'barbarian', xp: 80, run: barbarianSwing },
    { ids: [676], course: 'barbarian', xp: 50, run: barbarianLog },
    { ids: [677], course: 'barbarian', xp: 50, run: barbarianNet },
    {
        ids: [678],
        course: 'barbarian',
        xp: 80,
        tiredExempt: true,
        run: barbarianLedge
    },
    {
        ids: [679],
        course: 'barbarian',
        xp: 20,
        tiredExempt: true,
        run: barbarianHandholds
    },

    // ---- Wilderness course ----
    {
        ids: [703, 704],
        course: 'wilderness',
        xp: 50,
        tiredExempt: true,
        run: wildernessGate
    },
    { ids: [705], course: 'wilderness', xp: 50, run: wildernessPipe },
    { ids: [706], course: 'wilderness', xp: 100, run: wildernessRope },
    { ids: [707], course: 'wilderness', xp: 80, run: wildernessStones },
    { ids: [708], course: 'wilderness', xp: 80, run: wildernessLedge },
    {
        ids: [709],
        course: 'wilderness',
        xp: 80,
        tiredExempt: true,
        run: wildernessVine
    }
];

// wall objects (a separate id space from game objects): the barbarian low walls, Java onOpBound
const WALL_OBSTACLES = [
    { ids: [163], course: 'barbarian', xp: 20, run: barbarianWall },
    { ids: [164], course: 'barbarian', xp: 20, run: barbarianWall }
];

const BY_ID = new Map();
for (const obstacle of OBSTACLES) {
    for (const id of obstacle.ids) {
        BY_ID.set(id, obstacle);
    }
}

const WALL_BY_ID = new Map();
for (const obstacle of WALL_OBSTACLES) {
    for (const id of obstacle.ids) {
        WALL_BY_ID.set(id, obstacle);
    }
}

async function attempt(player, gameObject, obstacle) {
    if (!obstacle.tiredExempt && player.fatigue >= MAX_FATIGUE) {
        player.message('you are too tired to train');
        return;
    }

    await obstacle.run(player, gameObject);
}

// the low walls are wall objects: ids 163 and 164 are other things as game objects
async function onWallObjectCommandOne(player, wallObject) {
    const obstacle = WALL_BY_ID.get(wallObject.id);

    if (!obstacle) {
        return false;
    }

    await obstacle.run(player, wallObject);

    return true;
}

// ---------------------------------------------------------------------------------------------------------------------
// Agility shortcuts. Ported from Open-RSC Core-Framework authentic/skills/agility/AgilityShortcuts.java (AGPL-3.0)
// (AgilityUtils.java is only the course lap bookkeeping, which the course code above already covers).
//
// One generic handler drives the SHORTCUTS table. A row is:
//   ids        object ids (a different id per direction)
//   req/reqMsg agility level and the refusal message below it
//   tired      refusal when fatigue is full (Java WANT_FATIGUE branch; authentic RSC has fatigue)
//   tiredFirst the Java checks fatigue before the level
//   blockedFrom { x, y, msg } refuses from one tile
//   start      message, then startDelay ticks (Java delay(n))
//   fail       { req, stopFail, msg, to, damage(player) } Java succeed(): a failure drops the player at `to`
//   dest | path  teleport tile, or a list of tiles each followed by one tick (the coal truck logs)
//   done/say/xp  message after arriving, a spoken line, agility xp (Java incExp, quarter points, used as is)
//   custom     async (player, gameObject): the case's own logic once the guards above passed
// Skipped: the agility cape auto-success (no agility cape in rsc-data) and every case whose scenery id is an Open-RSC
// custom id (1236 and up) missing from rsc-data and from the map: Taverly pipe, Entrana rubble, Taverly and Catherby
// stepping stones, Falador members exit handholds, KBD and lava dungeon stepping stones, Shilo nature stone.
// ---------------------------------------------------------------------------------------------------------------------

const MAX_FATIGUE = 75000;
const ROPE_ITEM = 237;
const GREW_TREE = 662;
const GREW_TREE_TIED = 663;
// Java delayedSpawnObject(.., 60000): the tied rope goes away after a minute
const GREW_TIED_TICKS = Math.ceil(60000 / 640);

function agilityLevel(player) {
    return player.skills.agility ? player.skills.agility.current : 1;
}

// Java Formulae.calcProductionSuccessfulLegacy: a 1-256 roll against a threshold that grows with the level
function productionSucceeds(req, level, stopsFailing, stopFail, minFail = 1) {
    if (level < req) {
        return false;
    }

    const roll = Math.floor(rng.random() * 256) + 1;
    const max = stopsFailing ? 256 : 256 - minFail;
    const threshold = Math.min(
        max,
        Math.floor(64 + (level - 1) * (19200 / (stopFail * 98)))
    );

    return roll <= threshold;
}

// Java succeed(player, req) (never stops failing, up to req + 30) and succeed(player, req, lvlStopFail)
function succeeds(player, req, stopFail) {
    const level = agilityLevel(player);

    return stopFail === undefined
        ? productionSucceeds(req, level, false, req + 30)
        : productionSucceeds(req, level, true, stopFail);
}

function hitsLevel(player) {
    return player.skills.hits.current;
}

// Java player.damage(n) with the 0 a low level rounds to left out
function fall(player, damage) {
    if (damage > 0) {
        player.damage(damage);
    }
}

async function karamjaLog(player) {
    const { world } = player;

    player.message('You attempt to walk over the the slippery log..');
    await world.sleepTicks(3);

    if (!succeeds(player, 32)) {
        player.teleport(368, 781);
        await world.sleepTicks(1);
        player.message('@red@You fall into the stream!');
        player.message('You lose some health');
        player.teleport(370, 776);
        fall(player, 1);

        return;
    }

    const eastward = player.x <= 367;

    player.teleport(368, 781);
    await world.sleepTicks(1);
    player.teleport(eastward ? 370 : 366, 781);
    player.message('...and make it without any problems!');
    player.addExperience('agility', 10);
}

async function karamjaStones(player) {
    const { world } = player;
    const north = player.y <= 805;

    player.message('You jump onto the rock');
    player.teleport(...(north ? [347, 806] : [346, 807]));
    await world.sleepTicks(1);

    if (!succeeds(player, 32)) {
        await world.sleepTicks(2);
        player.teleport(...(north ? [341, 809] : [341, 805]));
        player.message('@red@!!! You Fall !!!');
        player.message('You get washed up on the other side of the river...');
        await world.sleepTicks(3);
        player.message('After being nearly half drowned');
        await world.sleepTicks(3);
        fall(player, Math.floor(hitsLevel(player) / 4) + 2);

        return;
    }

    player.teleport(...(north ? [346, 808] : [347, 805]));
    player.message('And cross the water without problems.');
    player.addExperience('agility', 10);
}

async function shiloRocks(player, gameObject) {
    const { world } = player;

    player.message('These rocks look quite dangerous to climb.');
    await world.sleepTicks(3);
    player.message('But you may be able to scale them.');
    await world.sleepTicks(3);
    player.message('Would you like to try?');

    const choice = await player.ask([
        'Yes, I can easily climb this!',
        "Nope, I'm sure I'll probably fall!"
    ]);

    if (choice !== 0) {
        player.message('You decide not to climb the rocks.');

        return;
    }

    if (succeeds(player, 32)) {
        player.message('You manage to climb the rocks succesfully and pick');
        await world.sleepTicks(3);

        if (gameObject.x === 450) {
            player.message(
                'a route though the trecherous embankment to the top.'
            );
            player.teleport(452, 829);
        } else {
            player.message(
                'a route though the trecherous embankment to the bottom.'
            );
            player.teleport(449, 828);
        }

        return;
    }

    player.teleport(450, 828);
    player.message('You fall and hurt yourself.');
    await world.sleepTicks(3);
    fall(player, Math.floor(hitsLevel(player) / 10));
    await world.sleepTicks(1);
    player.teleport(449, 828);
}

async function shiloBridge(player) {
    const { world } = player;

    player.message('The bridge beyond this fence looks very unsafe.');
    await world.sleepTicks(3);
    player.message(
        "However, you could try to negotiate it if you're feeling very agile."
    );
    await world.sleepTicks(3);
    player.message('Would you like to try?');

    const choice = await player.ask([
        'No thanks! It looks far too dangerous!',
        "Yes, I'm totally brave and quite agile!"
    ]);

    if (choice === 0) {
        player.message(
            'You decide that common sense is the better part of valour.'
        );
        await world.sleepTicks(3);
        player.message(
            'And stop yourself from being hurled to what must be an '
        );
        await world.sleepTicks(3);
        player.message('inevitable death.');

        return;
    }

    player.message('You prepare to negotiate the bridge fence...');
    await world.sleepTicks(3);
    player.message('You run and jump...');
    await world.sleepTicks(3);

    if (succeeds(player, 32)) {
        player.message('...and land perfectly on the other side!');
        player.teleport(player.x >= 460 ? 458 : 460, 828);

        return;
    }

    player.message('...slip and fall incompetently into the river below!');
    player.teleport(458, 832);
    await player.say('* Ahhhhhhhhhh! *');
    fall(player, Math.floor(hitsLevel(player) / 10));
    await world.sleepTicks(1);
    player.teleport(458, 836);
    fall(player, Math.floor(hitsLevel(player) / 10));
    await world.sleepTicks(2);
    await player.say('* Gulp! *');
    await world.sleepTicks(3);
    player.teleport(459, 841);
    await player.say('* Gulp! *');
    await world.sleepTicks(2);
    player.message(
        'You just manage to drag your pitiful frame onto the river bank.'
    );
    await player.say('* Gasp! *');
    fall(player, Math.floor(hitsLevel(player) / 10));
    await world.sleepTicks(2);
    player.message('Though you nearly drowned in the river!');
}

const SHORTCUTS = [
    {
        name: 'Handholds (Falador, west wall)',
        ids: [693],
        req: 5,
        reqMsg: 'You need an agility level of 5 to climb the wall',
        start: 'You climb over the wall',
        dest: [338, 555],
        xp: 50
    },
    {
        name: 'Tree (Brimhaven vine)',
        ids: [694],
        req: 10,
        reqMsg:
            'You need an agility level of 10 to attempt to swing on this vine',
        start: 'You grab the vine and try and swing across',
        startDelay: 2,
        dest: [511, 669],
        done: 'You skillfully swing across the stream',
        say: 'Aaaaahahah',
        xp: 20
    },
    {
        name: 'Tree (Brimhaven vine, back)',
        ids: [695],
        req: 10,
        reqMsg:
            'You need an agility level of 10 to attempt to swing on this vine',
        start: 'You grab the vine and try and swing across',
        startDelay: 2,
        dest: [508, 668],
        done: 'You skillfully swing across the stream',
        say: 'Aaaaahahah',
        xp: 20
    },
    {
        name: 'Ropeswing (Edgeville dungeon)',
        ids: [684],
        req: 15,
        reqMsg:
            'You need an agility level of 15 to attempt to swing on this rope',
        startDelay: 2,
        dest: [207, 3221],
        done: 'You skillfully swing across the hole',
        xp: 40
    },
    {
        name: 'Ropeswing (Edgeville dungeon, back)',
        ids: [685],
        req: 15,
        reqMsg:
            'You need an agility level of 15 to attempt to swing on this rope',
        startDelay: 2,
        dest: [206, 3225],
        done: 'You skillfully swing across the hole',
        xp: 40
    },
    {
        name: 'Log (west coal trucks)',
        ids: [681],
        req: 20,
        reqMsg:
            'You need an agility level of 20 to attempt balancing along this log',
        start: 'You stand on the slippery log',
        path: [
            [595, 458],
            [594, 458],
            [593, 458],
            [592, 458]
        ],
        done: 'and you walk across',
        xp: 34
    },
    {
        name: 'Log (east coal trucks)',
        ids: [680],
        req: 20,
        reqMsg:
            'You need an agility level of 20 to attempt balancing along this log',
        start: 'You stand on the slippery log',
        path: [
            [595, 458],
            [596, 458],
            [597, 458],
            [598, 458]
        ],
        done: 'and you walk across',
        xp: 34
    },
    {
        name: 'Ropeswing (Yanille agility dungeon)',
        ids: [628],
        req: 57,
        reqMsg:
            'You need an agility level of 57 to attempt to swing on this rope',
        tired: 'You are too tired to swing on the rope',
        start: 'You grab the rope and try and swing across',
        startDelay: 2,
        fail: {
            req: 57,
            stopFail: 77,
            msg: 'You miss the opposite side and fall to the level below',
            to: [596, 3534]
        },
        dest: [596, 3581],
        done: 'You skillfully swing across the hole',
        xp: 110
    },
    {
        name: 'Ropeswing (Yanille agility dungeon, back)',
        ids: [627],
        req: 57,
        reqMsg:
            'You need an agility level of 57 to attempt to swing on this rope',
        tired: 'You are too tired to swing on the rope',
        start: 'You grab the rope and try and swing across',
        startDelay: 2,
        fail: {
            req: 57,
            stopFail: 77,
            msg: 'You miss the opposite side and fall to the level below',
            to: [598, 3536]
        },
        dest: [598, 3585],
        done: 'You skillfully swing across the hole',
        xp: 110
    },
    {
        name: 'Ledge (Yanille agility dungeon)',
        ids: [614],
        req: 40,
        reqMsg:
            'You need an agility level of 40 to attempt balancing along this log',
        tired: 'You are too tired to balance on the ledge',
        start: 'You put your foot on the ledge and try to edge across',
        startDelay: 3,
        fail: {
            req: 40,
            stopFail: 65,
            msg: 'you lose your footing and fall to the level below',
            to: [603, 3520],
            damage: (player) => Math.floor(hitsLevel(player) * 0.2)
        },
        dest: [601, 3563],
        done: 'You skillfully balance across the hole',
        xp: 90
    },
    {
        name: 'Ledge (Yanille agility dungeon, back)',
        ids: [615],
        req: 40,
        reqMsg:
            'You need an agility level of 40 to attempt balancing along this log',
        tired: 'You are too tired to balance on the ledge',
        start: 'You put your foot on the ledge and try to edge across',
        startDelay: 3,
        fail: {
            req: 40,
            stopFail: 65,
            msg: 'you lose your footing and fall to the level below',
            to: [603, 3520],
            damage: (player) => Math.floor(hitsLevel(player) * 0.2)
        },
        dest: [601, 3557],
        done: 'You skillfully balance across the hole',
        xp: 90
    },
    {
        name: 'Pile of rubble (Yanille agility dungeon, down)',
        ids: [636],
        req: 67,
        reqMsg:
            'You need an agility level of 67 to attempt to climb down the rubble',
        dest: [580, 3525],
        done: 'You climb down the pile of rubble'
    },
    {
        name: 'Pile of rubble (Yanille agility dungeon, up)',
        ids: [633],
        req: 67,
        reqMsg:
            'You need an agility level of 67 to attempt to climb up the rubble',
        tired: 'You are too tired to climb up the rubble',
        dest: [582, 3573],
        done: 'You climb up the pile of rubble',
        xp: 54
    },
    {
        name: 'Pipe (Yanille agility dungeon)',
        ids: [656],
        req: 49,
        reqMsg:
            'You need an agility level of 49 to attempt to squeeze through the pipe',
        tired: 'You are too tired to squeeze through the pipe',
        start: 'You squeeze through the pipe',
        startDelay: 2,
        dest: [608, 3568],
        xp: 30
    },
    {
        name: 'Pipe (Yanille agility dungeon, back)',
        ids: [657],
        req: 49,
        reqMsg:
            'You need an agility level of 49 to attempt to squeeze through the pipe',
        tired: 'You are too tired to squeeze through the pipe',
        start: 'You squeeze through the pipe',
        startDelay: 2,
        dest: [605, 3568],
        xp: 30
    },
    {
        // Java checks the tile, then fatigue, then the level
        name: 'Tree (Grew Island, rope tied)',
        ids: [GREW_TREE_TIED],
        blockedFrom: {
            x: 664,
            y: 755,
            msg: "You can't reach the tree from here"
        },
        tiredFirst: true,
        tired: 'You are too tired to swing on the rope',
        req: 30,
        reqMsg:
            'You need an agility level of 30 to attempt to swing across the stream',
        start: 'You grab the rope and try and swing across',
        startDelay: 2,
        dest: [664, 755],
        done: 'You skillfully swing across the stream',
        xp: 50
    },
    {
        name: 'Tree (Grew Island, swing back)',
        ids: [664],
        req: 0,
        start: 'You grab the rope and try and swing across',
        startDelay: 2,
        dest: [666, 755],
        done: 'You skillfully swing across the stream',
        xp: 50
    },
    {
        name: 'Log Bridge (east Karamja)',
        ids: [692],
        req: 32,
        reqMsg:
            'You need an agility level of 32 to attempt balancing along this log',
        custom: karamjaLog
    },
    {
        name: 'Stepping stones (east Karamja)',
        ids: [701],
        req: 32,
        reqMsg: 'You need an agility level of 32 to step on these stones',
        tired: 'You are too fatigued to continue.',
        custom: karamjaStones
    },
    {
        name: 'Climbing rocks (Yanille)',
        ids: [1029],
        tiredFirst: true,
        tired: 'You are too tired to climb up the wall',
        req: 15,
        reqMsg: 'You need an agility level of 15 to climb the wall',
        start: 'You climb over the wall',
        dest: [624, 741],
        xp: 40
    },
    {
        name: 'Handholds (Yanille watchtower)',
        ids: [658],
        tiredFirst: true,
        tired: 'You are too tired to climb up the wall',
        req: 18,
        reqMsg: 'You need an agility level of 18 to climb the wall',
        start: 'You climb up the wall',
        dest: [637, 1680],
        done: 'And climb in through the window',
        xp: 50
    },
    {
        name: 'Rocks (Shilo Village)',
        ids: [710],
        req: 32,
        reqMsg: 'You need an agility level of 32 to climb the rocks',
        custom: shiloRocks
    },
    {
        name: 'Bridge Blockade (Shilo Village)',
        ids: [691],
        req: 32,
        reqMsg: 'You need an agility level of 32 to climb the rocks',
        custom: shiloBridge
    }
];

const SHORTCUT_BY_ID = new Map();
for (const shortcut of SHORTCUTS) {
    for (const id of shortcut.ids) {
        SHORTCUT_BY_ID.set(id, shortcut);
    }
}

// the first failed requirement's message, in the order the Java checks them
function shortcutRefusal(player, shortcut) {
    const { blockedFrom } = shortcut;

    if (
        blockedFrom &&
        player.x === blockedFrom.x &&
        player.y === blockedFrom.y
    ) {
        return blockedFrom.msg;
    }

    const tooLow = agilityLevel(player) < shortcut.req ? shortcut.reqMsg : null;
    const tired =
        shortcut.tired && player.fatigue >= MAX_FATIGUE ? shortcut.tired : null;

    return shortcut.tiredFirst ? tired || tooLow : tooLow || tired;
}

async function attemptShortcut(player, gameObject, shortcut) {
    const { world } = player;
    const refusal = shortcutRefusal(player, shortcut);

    if (refusal) {
        player.message(refusal);

        return;
    }

    if (shortcut.custom) {
        await shortcut.custom(player, gameObject);

        return;
    }

    if (shortcut.start) {
        player.message(shortcut.start);
    }

    if (shortcut.startDelay) {
        await world.sleepTicks(shortcut.startDelay);
    }

    const { fail } = shortcut;

    if (fail && !succeeds(player, fail.req, fail.stopFail)) {
        player.message(fail.msg);
        player.teleport(...fail.to);

        if (fail.damage) {
            fall(player, fail.damage(player));
        }

        return;
    }

    for (const tile of shortcut.path || [shortcut.dest]) {
        player.teleport(...tile);

        if (shortcut.path) {
            await world.sleepTicks(1);
        }
    }

    if (shortcut.done) {
        player.message(shortcut.done);
    }

    if (shortcut.say) {
        await player.say(shortcut.say);
    }

    if (shortcut.xp) {
        player.addExperience('agility', shortcut.xp);
    }
}

// Java onUseLoc: a rope on the Grew Island tree ties it, and the tied tree reverts after a minute
async function onUseWithGameObject(player, gameObject, item) {
    if (gameObject.id !== GREW_TREE || item.id !== ROPE_ITEM) {
        return false;
    }

    player.message('you tie the rope to the tree');
    player.inventory.remove(ROPE_ITEM);
    player.world.replaceTimed(
        'gameObjects',
        gameObject,
        GREW_TREE_TIED,
        GREW_TIED_TICKS
    );

    return true;
}

// a course obstacle id always keeps the course behaviour; only shortcut ids that are not course ids are ours
async function onGameObjectCommandOne(player, gameObject) {
    const obstacle = BY_ID.get(gameObject.id);

    if (obstacle) {
        await attempt(player, gameObject, obstacle);

        return true;
    }

    const shortcut = SHORTCUT_BY_ID.get(gameObject.id);

    if (!shortcut) {
        return false;
    }

    await attemptShortcut(player, gameObject, shortcut);

    return true;
}

// Java onOpLoc ignores the command: Rocks (WalkTo, Climb), Bridge Blockade (Investigate, Jump) and the stepping stones
// (Balance, Jump onto) use the second one
async function onGameObjectCommandTwo(player, gameObject) {
    if (BY_ID.has(gameObject.id) || !SHORTCUT_BY_ID.has(gameObject.id)) {
        return false;
    }

    return onGameObjectCommandOne(player, gameObject);
}

// climbable.js is registered before this file and answers any "climb up/down" first command: keep it off our ids.
try {
    const climbable = require('../game-objects/climbable');

    if (!climbable.__agilityWrapped) {
        const original = climbable.onGameObjectCommandOne;

        climbable.onGameObjectCommandOne = async function onGameObjectCommandOne(
            player,
            gameObject
        ) {
            if (BY_ID.has(gameObject.id) || SHORTCUT_BY_ID.has(gameObject.id)) {
                return false;
            }

            return original.call(this, player, gameObject);
        };

        Object.defineProperty(climbable, '__agilityWrapped', {
            value: true,
            enumerable: false
        });
    }
} catch (e) {
    // no climbable plugin: nothing to protect
}

module.exports = {
    onGameObjectCommandOne,
    onGameObjectCommandTwo,
    onWallObjectCommandOne,
    onUseWithGameObject
};

Object.defineProperty(module.exports, '__test', {
    enumerable: false,
    value: {
        OBSTACLES,
        COURSES,
        BY_ID,
        WALL_BY_ID,
        SHORTCUTS,
        SHORTCUT_BY_ID,
        progress,
        rng,
        PLANE
    }
});
