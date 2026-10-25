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
    assert.deepEqual(player.messages[0], '@que@You walk carefully across the slippery log...');
    assert.equal(player.teleports.length, 1);

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
