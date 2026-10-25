// Agility shortcuts (skills/agility.js), ported from Open-RSC AgilityShortcuts.java: driven by fake player and world.

const test = require('node:test');
const assert = require('node:assert/strict');

const objects = require('@2003scape/rsc-data/config/objects.json');
const objectLocations = require('@2003scape/rsc-data/locations/objects.json');
const agility = require('../src/plugins/skills/agility');

const { SHORTCUTS, SHORTCUT_BY_ID, BY_ID, rng } = agility.__test;

function fakePlayer({
    level = 99,
    hits = 50,
    x = 0,
    y = 0,
    fatigue = 0,
    answers = []
} = {}) {
    const player = {
        x,
        y,
        fatigue,
        messages: [],
        teleports: [],
        xp: [],
        damages: [],
        said: [],
        bag: [{ id: 237 }],
        skills: { agility: { current: level }, hits: { current: hits } },
        message(...m) {
            player.messages.push(...m);
        },
        teleport(tx, ty) {
            player.teleports.push([tx, ty]);
            player.x = tx;
            player.y = ty;
        },
        addExperience(skill, xp) {
            player.xp.push([skill, xp]);
        },
        damage(n) {
            player.damages.push(n);
        },
        getNearbyEntitiesByID: () => [],
        lock() {},
        unlock() {},
        async say(...m) {
            player.said.push(...m);
        },
        async ask() {
            return answers.shift();
        },
        inventory: {
            removed: [],
            remove: (id) => player.inventory.removed.push(id)
        },
        world: {
            members: true,
            timed: [],
            sleeps: [],
            async sleepTicks(n) {
                player.world.sleeps.push(n);
            },
            replaceTimed: (...args) => player.world.timed.push(args)
        }
    };

    return player;
}

function withRoll(value, fn) {
    const original = rng.random;
    rng.random = () => value;

    return fn().finally(() => {
        rng.random = original;
    });
}

const obj = (id, x = 0, y = 0) => ({ id, x, y });

test('every shortcut id is a real object whose location exists in rsc-data', () => {
    for (const shortcut of SHORTCUTS) {
        for (const id of shortcut.ids) {
            assert.ok(objects[id], `object ${id} exists`);

            // 663 (tied rope) only exists once a player ties it
            if (id !== 663) {
                assert.ok(
                    objectLocations.some((location) => location.id === id),
                    `object ${id} (${objects[id].name}) is placed in the world`
                );
            }
        }
    }
});

test('no shortcut id is also a course obstacle id', () => {
    for (const id of SHORTCUT_BY_ID.keys()) {
        assert.equal(BY_ID.has(id), false, `id ${id}`);
    }
});

test('below the level: Java message, no teleport, no xp, returns true', async () => {
    const cases = [
        [693, 5, 'You need an agility level of 5 to climb the wall'],
        [
            694,
            10,
            'You need an agility level of 10 to attempt to swing on this vine'
        ],
        [
            628,
            57,
            'You need an agility level of 57 to attempt to swing on this rope'
        ],
        [1029, 15, 'You need an agility level of 15 to climb the wall'],
        [710, 32, 'You need an agility level of 32 to climb the rocks'],
        [
            656,
            49,
            'You need an agility level of 49 to attempt to squeeze through the pipe'
        ]
    ];

    for (const [id, req, message] of cases) {
        const player = fakePlayer({ level: req - 1 });

        assert.equal(
            await agility.onGameObjectCommandOne(player, obj(id)),
            true,
            `id ${id}`
        );
        assert.deepEqual(player.messages, [message]);
        assert.deepEqual(player.teleports, []);
        assert.deepEqual(player.xp, []);
    }
});

test('Falador handholds at level 5: message, teleport, 50 xp', async () => {
    const player = fakePlayer({ level: 5 });

    assert.equal(await agility.onGameObjectCommandOne(player, obj(693)), true);
    assert.deepEqual(player.messages, ['You climb over the wall']);
    assert.deepEqual(player.teleports, [[338, 555]]);
    assert.deepEqual(player.xp, [['agility', 50]]);
});

test('Brimhaven vine swings across, says its line and gives 20 xp', async () => {
    const player = fakePlayer({ level: 10 });

    await agility.onGameObjectCommandOne(player, obj(694));
    assert.deepEqual(player.teleports, [[511, 669]]);
    assert.deepEqual(player.said, ['Aaaaahahah']);
    assert.deepEqual(player.world.sleeps, [2]);
    assert.deepEqual(player.xp, [['agility', 20]]);
    assert.equal(player.messages.at(-1), 'You skillfully swing across the stream');
});

test('coal truck log walks the tiles one at a time', async () => {
    const player = fakePlayer({ level: 20 });

    await agility.onGameObjectCommandOne(player, obj(681, 597, 458));
    assert.deepEqual(player.teleports, [
        [595, 458],
        [594, 458],
        [593, 458],
        [592, 458]
    ]);
    assert.deepEqual(player.world.sleeps, [1, 1, 1, 1]);
    assert.deepEqual(player.xp, [['agility', 34]]);
});

test('Yanille rope swing (fail chance): a bad roll drops to the level below', async () => {
    const player = fakePlayer({ level: 57 });

    // roll 256 is above the threshold at the required level
    await withRoll(0.999, () =>
        agility.onGameObjectCommandOne(player, obj(628))
    );
    assert.deepEqual(player.teleports, [[596, 3534]]);
    assert.deepEqual(player.xp, []);
    assert.deepEqual(player.damages, []);
    assert.ok(
        player.messages.includes(
            'You miss the opposite side and fall to the level below'
        )
    );
});

test('Yanille rope swing: a good roll crosses for 110 xp', async () => {
    const player = fakePlayer({ level: 99 });

    await withRoll(0, () => agility.onGameObjectCommandOne(player, obj(628)));
    assert.deepEqual(player.teleports, [[596, 3581]]);
    assert.deepEqual(player.xp, [['agility', 110]]);
});

test('Yanille ledge: failing hurts for 20% of current hits', async () => {
    const player = fakePlayer({ level: 40, hits: 47 });

    await withRoll(0.999, () =>
        agility.onGameObjectCommandOne(player, obj(615))
    );
    assert.deepEqual(player.teleports, [[603, 3520]]);
    assert.deepEqual(player.damages, [9]);
    assert.deepEqual(player.xp, []);
});

test('tired player is refused before anything moves', async () => {
    const player = fakePlayer({ level: 70, fatigue: 75000 });

    await agility.onGameObjectCommandOne(player, obj(656));
    assert.deepEqual(player.messages, [
        'You are too tired to squeeze through the pipe'
    ]);
    assert.deepEqual(player.teleports, []);
});

test('Grew Island: the tile gate, the rope item and the tied tree', async () => {
    const stuck = fakePlayer({ level: 99, x: 664, y: 755 });

    await agility.onGameObjectCommandOne(stuck, obj(663));
    assert.deepEqual(stuck.messages, ["You can't reach the tree from here"]);
    assert.deepEqual(stuck.teleports, []);

    const low = fakePlayer({ level: 29, x: 666, y: 755 });

    await agility.onGameObjectCommandOne(low, obj(663));
    assert.deepEqual(low.messages, [
        'You need an agility level of 30 to attempt to swing across the stream'
    ]);

    const tier = fakePlayer({ level: 30, x: 666, y: 755 });
    const tree = obj(662, 665, 754);

    assert.equal(
        await agility.onUseWithGameObject(tier, tree, { id: 237 }),
        true
    );
    assert.deepEqual(tier.inventory.removed, [237]);
    assert.equal(tier.world.timed[0][2], 663);
    assert.equal(
        await agility.onUseWithGameObject(tier, tree, { id: 14 }),
        false
    );

    await agility.onGameObjectCommandOne(tier, obj(663));
    assert.deepEqual(tier.teleports, [[664, 755]]);
    assert.deepEqual(tier.xp, [['agility', 50]]);
});

test('Shilo rocks: a level gate, then the menu; success climbs, failure hurts', async () => {
    const player = fakePlayer({ level: 99, hits: 40, answers: [0] });

    await withRoll(0, () =>
        agility.onGameObjectCommandOne(player, obj(710, 450, 828))
    );
    assert.deepEqual(player.teleports, [[452, 829]]);

    const falls = fakePlayer({ level: 99, hits: 40, answers: [0] });

    await withRoll(0.999, () =>
        agility.onGameObjectCommandTwo(falls, obj(710, 451, 828))
    );
    assert.deepEqual(falls.teleports, [
        [450, 828],
        [449, 828]
    ]);
    assert.deepEqual(falls.damages, [4]);

    const declines = fakePlayer({ level: 99, answers: [1] });

    await agility.onGameObjectCommandOne(declines, obj(710, 450, 828));
    assert.equal(declines.messages.at(-1), 'You decide not to climb the rocks.');
    assert.deepEqual(declines.teleports, []);
});

test('east Karamja log: the fall costs 1 hit; success walks to the far bank', async () => {
    const falls = fakePlayer({ level: 32, x: 366, y: 781 });

    await withRoll(0.999, () =>
        agility.onGameObjectCommandOne(falls, obj(692, 368, 781))
    );
    assert.deepEqual(falls.teleports, [
        [368, 781],
        [370, 776]
    ]);
    assert.deepEqual(falls.damages, [1]);

    const crosses = fakePlayer({ level: 99, x: 366, y: 781 });

    await withRoll(0, () =>
        agility.onGameObjectCommandOne(crosses, obj(692, 368, 781))
    );
    assert.deepEqual(crosses.teleports, [
        [368, 781],
        [370, 781]
    ]);
    assert.deepEqual(crosses.xp, [['agility', 10]]);
});

test('an existing course obstacle still runs the course path', async () => {
    const player = fakePlayer({ level: 99, x: 692, y: 496 });
    const log = obj(655, 692, 495);

    assert.ok(BY_ID.has(655));
    assert.equal(await agility.onGameObjectCommandOne(player, log), true);
    assert.deepEqual(player.messages[0], 'you stand on the slippery log');
    assert.equal(player.teleports.length, 6);

    // the second command never reaches a course obstacle
    assert.equal(await agility.onGameObjectCommandTwo(fakePlayer(), log), false);
});

test('unrelated objects are not claimed', async () => {
    const player = fakePlayer();

    for (const id of [0, 4, 72, 1000, 1236, 1295]) {
        assert.equal(await agility.onGameObjectCommandOne(player, obj(id)), false);
        assert.equal(await agility.onGameObjectCommandTwo(player, obj(id)), false);
    }

    assert.deepEqual(player.messages, []);
    assert.deepEqual(player.teleports, []);
});

test('course xp is the Java incExp quarter-point value', async () => {
    const { OBSTACLES, COURSES } = agility.__test;
    const xp = (id) => OBSTACLES.find((o) => o.ids.includes(id)).xp;

    assert.equal(COURSES.gnome.lap, 150);
    assert.equal(COURSES.barbarian.lap, 300);
    assert.equal(COURSES.wilderness.lap, 1500);
    assert.deepEqual([655, 647, 648, 650, 649, 653, 654].map(xp), Array(7).fill(30));
    assert.deepEqual([671, 675, 676, 677, 678, 679].map(xp), [20, 80, 50, 50, 80, 20]);
    assert.deepEqual([703, 704, 705, 706, 707, 708, 709].map(xp), [50, 50, 50, 100, 80, 80, 80]);

    const player = fakePlayer({ level: 99, x: 692, y: 496 });

    await agility.onGameObjectCommandOne(player, obj(655, 692, 495));
    assert.deepEqual(player.xp, [['agility', 30]]);
});

// ---- Barbarian Outpost, ported exactly from BarbarianAgilityCourse.java ----

const wallObjects = require('@2003scape/rsc-data/config/wall-objects.json');
const wallLocations = require('@2003scape/rsc-data/locations/wall-objects.json');

test('low walls 163 and 164 are wall objects placed at x 497 and x 495, y 556-559', () => {
    for (const [id, x] of [
        [163, 497],
        [164, 495]
    ]) {
        assert.equal(wallObjects[id].name, 'Low wall');

        const ys = wallLocations
            .filter((w) => w.id === id)
            .map((w) => {
                assert.equal(w.x, x);
                return w.y;
            })
            .sort();

        assert.deepEqual(ys, [556, 557, 558, 559]);
    }
});

test('barbarian lap: 7 obstacle xp payments, the 300 bonus only after wall 164', async () => {
    const player = fakePlayer({ level: 99, x: 487, y: 551 });
    const go = (id, x = 0, y = 0) =>
        withRoll(0, () => agility.onGameObjectCommandOne(player, obj(id, x, y)));

    await go(675);
    assert.deepEqual(player.teleports.at(-1), [486, 559]);
    await go(676);
    assert.deepEqual(player.teleports.at(-1), [492, 563]);
    await go(677);
    assert.deepEqual(player.teleports.at(-1), [496, 1507]);
    await go(678, 498, 1506);
    assert.deepEqual(player.teleports.at(-1), [501, 1506]);

    // handholds pay 20 and are not a lap step
    await go(679);
    assert.deepEqual(player.teleports.at(-1), [497, 555]);
    assert.deepEqual(player.xp.at(-1), ['agility', 20]);

    player.x = 498;
    player.y = 557;
    assert.equal(
        await agility.onWallObjectCommandOne(player, { id: 163, x: 497, y: 557 }),
        true
    );
    assert.deepEqual(player.teleports.at(-1), [499, 557]);
    assert.equal(player.xp.filter(([, xp]) => xp === 300).length, 0);

    player.x = 496;
    player.y = 557;
    await agility.onWallObjectCommandOne(player, { id: 164, x: 495, y: 557 });
    assert.deepEqual(player.teleports.at(-1), [497, 557]);
    assert.deepEqual(
        player.xp.map(([, xp]) => xp),
        [80, 50, 50, 80, 20, 20, 20, 300]
    );
});

test('barbarian lap bonus needs all five lap obstacles, and the handholds do not count', async () => {
    const player = fakePlayer({ level: 99 });

    await withRoll(0, async () => {
        await agility.onGameObjectCommandOne(player, obj(679));
        await agility.onWallObjectCommandOne(player, { id: 163, x: 497, y: 557 });
        await agility.onWallObjectCommandOne(player, { id: 164, x: 495, y: 557 });
    });
    assert.equal(player.xp.some(([, xp]) => xp === 300), false);
});

test('low wall moves across in both directions; same y', async () => {
    const west = fakePlayer({ x: 497, y: 558 });

    await agility.onWallObjectCommandOne(west, { id: 163, x: 497, y: 558 });
    assert.deepEqual(west.teleports, [[496, 558]]);

    const east = fakePlayer({ x: 496, y: 558 });

    await agility.onWallObjectCommandOne(east, { id: 163, x: 497, y: 558 });
    assert.deepEqual(east.teleports, [[497, 558]]);

    const tired = fakePlayer({ x: 497, y: 558, fatigue: 75000 });

    await agility.onWallObjectCommandOne(tired, { id: 163, x: 497, y: 558 });
    assert.deepEqual(tired.messages, ['you are too tired to jump the wall']);
    assert.equal(
        await agility.onWallObjectCommandOne(tired, { id: 5, x: 1, y: 1 }),
        false
    );
});

test('barbarian failures use the Java tiles, messages and damage', async () => {
    const swing = fakePlayer({ level: 40, hits: 40 });

    await withRoll(0.999, () => agility.onGameObjectCommandOne(swing, obj(675)));
    assert.deepEqual(swing.teleports, [[486, 3389]]);
    assert.deepEqual(swing.damages, [6]);
    assert.deepEqual(swing.said, ['ouch']);

    const log = fakePlayer({ level: 40, hits: 40 });

    await withRoll(0.999, () => agility.onGameObjectCommandOne(log, obj(676)));
    assert.deepEqual(log.teleports, [[490, 561]]);
    assert.deepEqual(log.damages, [4]);

    const ledge = fakePlayer({ level: 40, hits: 40 });

    await withRoll(0.999, () =>
        agility.onGameObjectCommandOne(ledge, obj(678, 498, 1506))
    );
    assert.deepEqual(ledge.teleports, [[499, 563]]);
    assert.deepEqual(ledge.damages, [6]);

    // the other ledge object does nothing
    const other = fakePlayer({ level: 99 });

    assert.equal(
        await agility.onGameObjectCommandOne(other, obj(678, 499, 1506)),
        true
    );
    assert.deepEqual(other.teleports, []);
});

test('barbarian pipe: level 35 and fatigue refusals, then the Java tiles', async () => {
    const low = fakePlayer({ level: 34 });

    await agility.onGameObjectCommandOne(low, obj(671));
    assert.deepEqual(low.messages, [
        'You need an agility level of 35 to attempt to squeeze through the pipe'
    ]);

    const tired = fakePlayer({ level: 40, fatigue: 75000 });

    await agility.onGameObjectCommandOne(tired, obj(671));
    assert.deepEqual(tired.messages, [
        'You are too tired to squeeze through the pipe'
    ]);

    const inn = fakePlayer({ level: 40, x: 487, y: 551 });

    await agility.onGameObjectCommandOne(inn, obj(671));
    assert.deepEqual(inn.teleports, [[487, 554]]);

    const back = fakePlayer({ level: 40, x: 487, y: 554 });

    await agility.onGameObjectCommandOne(back, obj(672));
    assert.deepEqual(back.teleports, [[487, 551]]);
    assert.deepEqual(back.xp, [['agility', 20]]);
});

test('fatigue refusals: "too tired to train" except on the exempt obstacles', async () => {
    const tired = fakePlayer({ level: 99, fatigue: 75000 });

    await agility.onGameObjectCommandOne(tired, obj(675));
    assert.deepEqual(tired.messages, ['you are too tired to train']);
    assert.deepEqual(tired.teleports, []);

    const exempt = fakePlayer({ level: 99, fatigue: 75000 });

    await agility.onGameObjectCommandOne(exempt, obj(650));
    assert.deepEqual(exempt.teleports, [[685, 2396]]);
});

// ---- Gnome and Wilderness, checked against the Java ----

test('gnome lap: 6 obstacles in any order, then the pipe pays 150', async () => {
    const player = fakePlayer({ level: 1 });

    for (const id of [653, 655, 647, 648, 650, 649]) {
        await agility.onGameObjectCommandOne(player, obj(id));
    }

    assert.equal(player.xp.some(([, xp]) => xp === 150), false);
    await agility.onGameObjectCommandOne(player, obj(654));
    assert.deepEqual(player.teleports.at(-1), [683, 494]);
    assert.deepEqual(
        player.xp.map(([, xp]) => xp),
        [30, 30, 30, 30, 30, 30, 30, 150]
    );
});

test('gnome destinations match the Java', async () => {
    const dest = {};

    for (const id of [647, 648, 650, 649, 653, 654]) {
        const player = fakePlayer({ level: 1 });

        await agility.onGameObjectCommandOne(player, obj(id));
        dest[id] = player.teleports.at(-1);
    }

    assert.deepEqual(dest, {
        647: [692, 1448],
        648: [693, 2394],
        650: [685, 2396],
        649: [683, 506],
        653: [683, 501],
        654: [683, 494]
    });
});

test('wilderness gate: level 52, wolf pit on a 1 or 2 roll, 50 xp across; the second gate has no level gate', async () => {
    const low = fakePlayer({ level: 51 });

    await agility.onGameObjectCommandOne(low, obj(703));
    assert.deepEqual(low.messages, [
        'You need an agility level of 52 to attempt balancing along the ridge'
    ]);

    const one = fakePlayer({ level: 52 });

    await withRoll(0, () => agility.onGameObjectCommandOne(one, obj(703)));
    assert.deepEqual(one.teleports, [
        [298, 130],
        [300, 129]
    ]);

    const two = fakePlayer({ level: 1 });

    await withRoll(0.2, () => agility.onGameObjectCommandOne(two, obj(704)));
    assert.deepEqual(two.teleports, [
        [298, 130],
        [296, 129]
    ]);

    const across = fakePlayer({ level: 52 });

    await withRoll(0.99, () =>
        agility.onGameObjectCommandOne(across, obj(704))
    );
    assert.deepEqual(across.teleports, [
        [298, 130],
        [298, 134]
    ]);
    assert.deepEqual(across.xp, [['agility', 50]]);
});

test('wilderness lap pays 1500 only after the vine with the four obstacles done', async () => {
    const player = fakePlayer({ level: 99 });

    await withRoll(0, async () => {
        for (const id of [705, 706, 707, 708]) {
            await agility.onGameObjectCommandOne(player, obj(id));
        }

        assert.equal(player.xp.some(([, xp]) => xp === 1500), false);
        await agility.onGameObjectCommandOne(player, obj(709));
    });
    assert.deepEqual(player.teleports.at(-1), [304, 120]);
    assert.deepEqual(
        player.xp.map(([, xp]) => xp),
        [50, 100, 80, 80, 80, 1500]
    );
});

test('wilderness failures: rope 15% and ledge 25% of hits, to the Java tiles', async () => {
    const rope = fakePlayer({ level: 52, hits: 40 });

    await withRoll(0.999, () => agility.onGameObjectCommandOne(rope, obj(706)));
    assert.deepEqual(rope.teleports, [[293, 2942]]);
    assert.deepEqual(rope.damages, [6]);

    const ledge = fakePlayer({ level: 52, hits: 40 });

    await withRoll(0.999, () => agility.onGameObjectCommandOne(ledge, obj(708)));
    assert.deepEqual(ledge.teleports, [[298, 2945]]);
    assert.deepEqual(ledge.damages, [10]);
});
