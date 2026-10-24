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
 * Course xp values are the classic/OSRS-shaped numbers; the server's experienceRate multiplies them as usual.
 */

const PLANE = 944;

// course -> { lap: xp bonus for finishing in order, last: step index of the final obstacle }
const COURSES = {
    gnome: { name: 'Gnome Stronghold', last: 6, lap: 30 },
    barbarian: { name: 'Barbarian Outpost', last: 5, lap: 46 },
    wilderness: { name: 'Wilderness', last: 5, lap: 100 }
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
        xp: 7.5,
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
        xp: 7.5,
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
        xp: 5,
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
        xp: 7.5,
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
        xp: 5,
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
        xp: 7.5,
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
        xp: 7.5,
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
        xp: 8,
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
        xp: 22,
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
        xp: 13.5,
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
        xp: 8,
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
        xp: 22,
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
        xp: 13.5,
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
        xp: 0,
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
        xp: 0,
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
        xp: 12.5,
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
        xp: 20,
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
        xp: 20,
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
        xp: 20,
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
        xp: 25,
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

async function onGameObjectCommandOne(player, gameObject) {
    const obstacle = BY_ID.get(gameObject.id);

    if (!obstacle) {
        return false;
    }

    await attempt(player, gameObject, obstacle);

    return true;
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
            if (BY_ID.has(gameObject.id)) {
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

module.exports = { onGameObjectCommandOne };

Object.defineProperty(module.exports, '__test', {
    enumerable: false,
    value: { OBSTACLES, COURSES, BY_ID, progress, rng, PLANE }
});
