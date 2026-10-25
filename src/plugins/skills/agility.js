'use strict';

/**
 * Agility (replaces the 0-byte upstream stub). Three members courses, driven by one table:
 *
 *   gnome      Tree Gnome Stronghold   (level 1)   log, net, branch up, rope, branch down, net, pipe
 *   barbarian  Barbarian Outpost       (level 35)  pipe, rope swing, log, net, ledge, [ladder: climbable.js], handholds
 *   wilderness the gated course        (level 52)  gate, pipe, rope swing, stepping stones, ledge, vine
 *
 * Every obstacle is a short lock, a message, a teleport to the tile on the far side, agility xp and (for the last
 * obstacle of a lap done in order) a lap bonus. Failable obstacles (rope swings, logs, stones, ledges) roll against the
 * agility level, hurt the player (never lethal) and drop them back on the near side. Tiles in OBSTACLES are all
 * verified walkable against the server's own path finder (world.pathFinder.isTileBlocked) by the smoke test.
 *
 * Ladders (barbarian ladder 6) stay with climbable.js. The ids below that climbable.js would claim by its
 * "climb up/down" regex (gnome branches 648/649, barbarian net 677, wilderness vine 709) are excluded from it when
 * this file loads, because index.js runs climbable.js first and its first-true-wins dispatch would otherwise steal them.
 *
 * Course xp values are the Java incExp values (quarter points, as player.addExperience takes); the server's
 * experienceRate multiplies them as usual.
 */

const PLANE = 944;

// course -> { lap: xp bonus for finishing in order, last: step index of the final obstacle }
const COURSES = {
    gnome: { name: 'Gnome Stronghold', last: 6, lap: 150 },
    barbarian: { name: 'Barbarian Outpost', last: 5, lap: 300 },
    wilderness: { name: 'Wilderness', last: 5, lap: 1500 }
};

/**
 * ids:      game object ids handled
 * course/step: lap tracking (step 0 restarts the lap)
 * req/xp:   agility level and xp per obstacle
 * verb:     "You need an agility level of N to <verb>"
 * start/done: chat messages
 * ends:     [A, B] tiles on either side; the player goes to the end they are not nearest to. A -> B is "forward".
 * dest:     alternative to ends: (player, obj) => [x, y]; forward is decided by forward(player, obj)
 * fail:     { base, dmg: [min, max], msg } roll against level; the player lands back at the near end (or `to`)
 */
const OBSTACLES = [
    // ---- Tree Gnome Stronghold ----
    {
        ids: [655],
        course: 'gnome',
        step: 0,
        req: 1,
        xp: 30,
        verb: 'balance across this log',
        start: 'You walk carefully across the slippery log...',
        done: '...and make it safely to the other side',
        ends: [
            [692, 494],
            [692, 500]
        ],
        delay: 3
    },
    {
        ids: [647],
        course: 'gnome',
        step: 1,
        req: 1,
        xp: 30,
        verb: 'climb this net',
        start: 'You climb up the netting...',
        done: '...and reach the platform',
        dest: (player, obj) => [obj.x + 1, 1448],
        forward: (player, obj) => player.y < obj.y
    },
    {
        ids: [648],
        course: 'gnome',
        step: 2,
        req: 1,
        xp: 30,
        verb: 'climb this tree',
        start: 'You climb up the tree...',
        done: '...and reach the branch',
        dest: () => [692, 2395],
        forward: () => true
    },
    {
        ids: [650],
        course: 'gnome',
        step: 3,
        req: 1,
        xp: 30,
        verb: 'swing on this rope',
        start: 'You grab hold of the rope and swing across...',
        done: '...and land on the other side',
        ends: [
            [692, 2395],
            [684, 2396]
        ],
        delay: 3
    },
    {
        ids: [649],
        course: 'gnome',
        step: 4,
        req: 1,
        xp: 30,
        verb: 'climb down this tree',
        start: 'You climb down the tree...',
        done: '...and reach the ground',
        dest: () => [683, 507],
        forward: () => true
    },
    {
        ids: [653],
        course: 'gnome',
        step: 5,
        req: 1,
        xp: 30,
        verb: 'climb this net',
        start: 'You climb the netting...',
        done: '...and clamber over it',
        dest: (player, obj) => [obj.x + 1, player.y > obj.y ? 501 : 503],
        forward: (player, obj) => player.y > obj.y
    },
    {
        ids: [654],
        course: 'gnome',
        step: 6,
        req: 1,
        xp: 30,
        verb: 'squeeze through this pipe',
        start: 'You squeeze through the pipe...',
        done: '...and come out the other end',
        ends: [
            [683, 498],
            [683, 494]
        ],
        delay: 3
    },

    // ---- Barbarian Outpost ----
    {
        ids: [671, 672],
        course: 'barbarian',
        step: 0,
        req: 35,
        xp: 20,
        verb: 'squeeze through this pipe',
        start: 'You squeeze through the pipe...',
        done: '...and come out the other end',
        ends: [
            [487, 551],
            [487, 554]
        ],
        delay: 3
    },
    {
        ids: [675],
        course: 'barbarian',
        step: 1,
        req: 35,
        xp: 80,
        verb: 'swing on this rope',
        start: 'You grab hold of the rope and swing across...',
        done: '...and land safely on the far side',
        ends: [
            [487, 555],
            [487, 559]
        ],
        fail: {
            base: 0.3,
            dmg: [1, 3],
            msg: 'You miss the rope and fall into the spiked pit'
        },
        delay: 3
    },
    {
        ids: [676],
        course: 'barbarian',
        step: 2,
        req: 35,
        xp: 50,
        verb: 'balance across this log',
        start: 'You walk carefully across the slippery log...',
        done: '...and make it safely to the other side',
        ends: [
            [487, 563],
            [493, 563]
        ],
        fail: {
            base: 0.3,
            dmg: [1, 3],
            msg: 'You slip off the log and fall into the pit'
        },
        delay: 4
    },
    {
        ids: [677],
        course: 'barbarian',
        step: 3,
        req: 35,
        xp: 50,
        verb: 'climb this net',
        start: 'You climb up the netting...',
        done: '...and reach the ledge',
        dest: () => [497, 1506],
        forward: () => true
    },
    {
        ids: [678],
        course: 'barbarian',
        step: 4,
        req: 35,
        xp: 80,
        verb: 'balance along this ledge',
        start: 'You walk carefully along the ledge...',
        done: '...and make it safely to the other side',
        ends: [
            [497, 1506],
            [501, 1506]
        ],
        fail: {
            base: 0.3,
            dmg: [2, 4],
            msg: 'You slip off the ledge and fall to the ground',
            to: [
                [497, 562],
                [501, 562]
            ]
        },
        delay: 4
    },
    {
        ids: [679],
        course: 'barbarian',
        step: 5,
        req: 35,
        xp: 20,
        verb: 'climb these handholds',
        start: 'You climb the handholds...',
        done: '...and pull yourself over the top',
        ends: [
            [496, 557],
            [496, 555]
        ],
        delay: 3
    },

    // ---- Wilderness course ----
    {
        ids: [703],
        course: 'wilderness',
        step: 0,
        req: 52,
        xp: 50,
        verb: 'enter this agility area',
        start: 'You open the gate and walk through...',
        done: '...and enter the agility area',
        ends: [
            [298, 135],
            [298, 133]
        ],
        delay: 2
    },
    {
        ids: [704],
        course: 'wilderness',
        step: 0,
        req: 52,
        xp: 50,
        verb: 'enter this agility area',
        start: 'You open the gate and walk through...',
        done: '...and enter the agility area',
        ends: [
            [298, 126],
            [298, 124]
        ],
        delay: 2
    },
    {
        ids: [705],
        course: 'wilderness',
        step: 1,
        req: 52,
        xp: 50,
        verb: 'squeeze through this pipe',
        start: 'You squeeze through the pipe...',
        done: '...and come out the other end',
        ends: [
            [294, 120],
            [294, 112]
        ],
        delay: 4
    },
    {
        ids: [706],
        course: 'wilderness',
        step: 2,
        req: 52,
        xp: 100,
        verb: 'swing on this rope',
        start: 'You grab hold of the rope and swing across...',
        done: '...and land safely on the far side',
        ends: [
            [292, 112],
            [292, 108]
        ],
        fail: {
            base: 0.35,
            dmg: [2, 6],
            msg: 'You miss the rope and fall into the spiked pit'
        },
        delay: 3
    },
    {
        ids: [707],
        course: 'wilderness',
        step: 3,
        req: 52,
        xp: 80,
        verb: 'balance across these stones',
        start: 'You carefully hop across the stepping stones...',
        done: '...and reach the other side',
        ends: [
            [292, 105],
            [297, 105]
        ],
        fail: {
            base: 0.35,
            dmg: [2, 6],
            msg: 'You slip off the stone and fall into the lava'
        },
        delay: 4
    },
    {
        ids: [708],
        course: 'wilderness',
        step: 4,
        req: 52,
        xp: 80,
        verb: 'balance along this ledge',
        start: 'You walk carefully along the ledge...',
        done: '...and make it safely to the other side',
        ends: [
            [295, 111],
            [302, 111]
        ],
        fail: {
            base: 0.35,
            dmg: [2, 6],
            msg: 'You slip off the ledge and fall into the spiked pit'
        },
        delay: 4
    },
    {
        ids: [709],
        course: 'wilderness',
        step: 5,
        req: 52,
        xp: 80,
        verb: 'climb this vine',
        start: 'You climb up the vine...',
        done: '...and reach the top',
        ends: [
            [305, 117],
            [305, 120]
        ],
        delay: 3
    }
];

const BY_ID = new Map();
for (const obstacle of OBSTACLES) {
    for (const id of obstacle.ids) {
        BY_ID.set(id, obstacle);
    }
}

// player -> { course, step }: the furthest obstacle of the current lap done in order
const progress = new WeakMap();

// swappable by the smoke test
const rng = { random: () => Math.random() };

function distance(player, [x, y]) {
    return Math.max(Math.abs(player.x - x), Math.abs(player.y - y));
}

function failChance(obstacle, level) {
    const chance = obstacle.fail.base - (level - obstacle.req) * 0.01;
    return Math.min(0.5, Math.max(0.05, chance));
}

// which tile to go to, and whether that is the course's forward direction
function route(player, obstacle, gameObject) {
    if (obstacle.ends) {
        const [a, b] = obstacle.ends;
        const nearA = distance(player, a) <= distance(player, b);

        return {
            dest: nearA ? b : a,
            origin: nearA ? 0 : 1,
            forward: nearA
        };
    }

    return {
        dest: obstacle.dest(player, gameObject),
        origin: 0,
        forward: obstacle.forward(player, gameObject)
    };
}

function failOrigin(obstacle, route) {
    if (obstacle.fail.to) {
        return obstacle.fail.to[route.origin];
    }

    return obstacle.ends[route.origin];
}

function hurt(player, [min, max]) {
    let damage = min + Math.floor(rng.random() * (max - min + 1));

    // a slip hurts but never kills
    damage = Math.min(damage, Math.max(0, player.skills.hits.current - 1));

    if (damage > 0) {
        player.damage(damage);
    }
}

function trackProgress(player, obstacle, forward) {
    const course = COURSES[obstacle.course];
    const state = progress.get(player);

    if (!forward) {
        progress.delete(player);
        return false;
    }

    if (obstacle.step === 0) {
        progress.set(player, { course: obstacle.course, step: 0 });
        return false;
    }

    if (
        !state ||
        state.course !== obstacle.course ||
        state.step !== obstacle.step - 1
    ) {
        progress.delete(player);
        return false;
    }

    if (obstacle.step === course.last) {
        progress.delete(player);
        return true;
    }

    state.step = obstacle.step;
    return false;
}

async function attempt(player, gameObject, obstacle) {
    const { world } = player;

    const level = player.skills.agility ? player.skills.agility.current : 1;

    if (level < obstacle.req) {
        player.message(
            `@que@You need an agility level of ${obstacle.req} to ${obstacle.verb}`
        );

        return;
    }

    const way = route(player, obstacle, gameObject);

    player.lock();
    player.message(`@que@${obstacle.start}`);

    await world.sleepTicks(obstacle.delay || 2);

    if (obstacle.fail && rng.random() < failChance(obstacle, level)) {
        player.message(`@que@${obstacle.fail.msg}`);
        player.teleport(...failOrigin(obstacle, way));
        progress.delete(player);

        await world.sleepTicks(3);
        hurt(player, obstacle.fail.dmg);
        player.unlock();

        return;
    }

    player.teleport(...way.dest);
    await world.sleepTicks(3);

    player.message(`@que@${obstacle.done}`);

    if (obstacle.xp > 0) {
        player.addExperience('agility', obstacle.xp);
    }

    if (trackProgress(player, obstacle, way.forward)) {
        const course = COURSES[obstacle.course];

        player.message(
            `@que@You have completed the ${course.name} agility course`
        );
        player.addExperience('agility', course.lap);
    }

    player.unlock();
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
    onUseWithGameObject
};

Object.defineProperty(module.exports, '__test', {
    enumerable: false,
    value: {
        OBSTACLES,
        COURSES,
        BY_ID,
        SHORTCUTS,
        SHORTCUT_BY_ID,
        progress,
        rng,
        PLANE
    }
});
