// Jungle woodcutting and the Dramen tree (skills/woodcutting.js), driven by fake player and world objects.

const test = require('node:test');
const assert = require('node:assert/strict');

const woodcutting = require('../src/plugins/skills/woodcutting');

const MACHETE = 1172;
const BRONZE_AXE = 87;
const RUNE_AXE = 405;

function fakeWorld() {
    const world = {
        replaced: [],
        removed: [],
        spawned: [],
        gameObjectsAt: [],
        wallObjectsAt: [],
        sleepTicks: async () => {},
        gameObjects: {
            getAtPoint: (x, y) =>
                world.gameObjectsAt.filter((o) => o.x === x && o.y === y)
        },
        wallObjects: {
            getAtPoint: (x, y) =>
                world.wallObjectsAt.filter((o) => o.x === x && o.y === y)
        },
        replaceTimed(type, entity, newID, ticks) {
            world.replaced.push({ type, id: entity.id, newID, ticks });
        },
        removeEntity(type, entity) {
            world.removed.push({ type, entity, respawn: entity.respawn });
        },
        spawnTimedNPC(opts) {
            const npc = {
                ...opts,
                said: null,
                say: async (...lines) => {
                    npc.said = lines;
                }
            };
            world.spawned.push(npc);
            return npc;
        }
    };

    return world;
}

function fakePlayer({ level = 50, items = [], stage = 0, y = 500, nearby = [] } = {}) {
    const world = fakeWorld();

    const player = {
        world,
        x: 100,
        y,
        messages: [],
        bubbles: [],
        xp: [],
        added: [],
        teleports: [],
        skills: { woodcutting: { current: level } },
        questStages: { lostCity: stage },
        inventory: {
            has: (id) => items.includes(id),
            add: (id, amount = 1) => player.added.push([id, amount])
        },
        message: (text) => player.messages.push(text),
        sendBubble: (id) => player.bubbles.push(id),
        addExperience: (skill, amount) => player.xp.push([skill, amount]),
        teleport: (x, y) => {
            player.x = x;
            player.y = y;
            player.teleports.push([x, y]);
        },
        isTired: () => false,
        getNearbyEntitiesByID: () => nearby
    };

    return player;
}

// Math.random forced to a value for one call, restored afterwards
async function withRandom(value, fn) {
    const original = Math.random;
    Math.random = () => value;

    try {
        return await fn();
    } finally {
        Math.random = original;
    }
}

function gameObject(id, x = 300, y = 500, commands = ['Chop', 'Examine']) {
    return { id, x, y, definition: { commands } };
}

test('jungle tree with machete and axe at level 50 is cut to a stump for 60 seconds', async () => {
    const tree = gameObject(1086);
    const player = fakePlayer({ items: [MACHETE, BRONZE_AXE] });
    player.world.gameObjectsAt.push(tree);

    const claimed = await withRandom(0, () =>
        woodcutting.onGameObjectCommandOne(player, tree)
    );

    assert.equal(claimed, true);
    assert.deepEqual(player.world.replaced, [
        { type: 'gameObjects', id: 1086, newID: 1087, ticks: 94 }
    ]);
    assert.deepEqual(player.xp, [['woodcutting', 20]]);
    assert.deepEqual(player.bubbles, [BRONZE_AXE]);
    assert.ok(player.messages.includes('@que@You swing your bronze axe at the tree...'));
    assert.deepEqual(player.teleports, [[300, 500]]);
});

test('jungle tree without a machete gets the thick jungle message and nothing else', async () => {
    const tree = gameObject(1099);
    const player = fakePlayer({ items: [BRONZE_AXE] });
    player.world.gameObjectsAt.push(tree);

    const claimed = await withRandom(0, () =>
        woodcutting.onGameObjectCommandOne(player, tree)
    );

    assert.equal(claimed, true);
    assert.deepEqual(player.messages, [
        "@que@This jungle is very thick, you'll need a machette to cut through."
    ]);
    assert.equal(player.world.replaced.length, 0);
    assert.equal(player.xp.length, 0);
});

test('jungle tree with a machete but no axe needs an axe', async () => {
    const tree = gameObject(1091);
    const player = fakePlayer({ items: [MACHETE] });
    player.world.gameObjectsAt.push(tree);

    assert.equal(
        await withRandom(0, () => woodcutting.onGameObjectCommandOne(player, tree)),
        true
    );
    assert.deepEqual(player.messages, ['@que@You need an axe to chop this tree down']);
    assert.equal(player.world.replaced.length, 0);
});

test('jungle tree below woodcutting level 50 is refused with the Java message', async () => {
    const tree = gameObject(1100);
    const player = fakePlayer({ level: 49, items: [MACHETE, RUNE_AXE] });
    player.world.gameObjectsAt.push(tree);

    assert.equal(await woodcutting.onGameObjectCommandOne(player, tree), true);
    assert.deepEqual(player.messages, [
        'You need a woodcutting level of 50 to axe this tree'
    ]);
});

test('a failed roll on a jungle tree says so and leaves the tree alone', async () => {
    const tree = gameObject(1092);
    const player = fakePlayer({ items: [MACHETE, BRONZE_AXE] });
    player.world.gameObjectsAt.push(tree);

    assert.equal(
        await withRandom(0.999, () => woodcutting.onGameObjectCommandOne(player, tree)),
        true
    );
    assert.ok(player.messages.includes('@que@You slip and fail to hit the tree'));
    assert.equal(player.world.replaced.length, 0);
    assert.equal(player.xp.length, 0);
});

test('the jungle stump walks the player onto its tile on its first command', async () => {
    const stump = gameObject(1087, 310, 512, ['Walk', 'Examine']);
    const player = fakePlayer();

    assert.equal(await woodcutting.onGameObjectCommandOne(player, stump), true);
    assert.deepEqual(player.teleports, [[310, 512]]);
    assert.equal(await woodcutting.onGameObjectCommandTwo(player, stump), false);
});

test('the jungle vine is a wall object: cut with a machete, removed and back after 5.5 seconds', async () => {
    const vine = { id: 204, x: 320, y: 400, definition: { commands: ['Chop', 'Examine'] } };
    const player = fakePlayer({ items: [MACHETE] });
    player.world.wallObjectsAt.push(vine);

    assert.equal(
        await withRandom(0, () => woodcutting.onWallObjectCommandOne(player, vine)),
        true
    );
    assert.equal(player.world.removed.length, 1);
    assert.equal(player.world.removed[0].type, 'wallObjects');
    assert.equal(player.world.removed[0].respawn, 5500);
    assert.deepEqual(player.xp, [['woodcutting', 20]]);
    assert.ok(player.messages.includes('@que@You hack your way through the jungle.'));
});

test('an axe on a jungle tree goes through the same cut', async () => {
    const tree = gameObject(1086);
    const player = fakePlayer({ items: [MACHETE, BRONZE_AXE] });
    player.world.gameObjectsAt.push(tree);

    assert.equal(
        await withRandom(0, () =>
            woodcutting.onUseWithGameObject(player, tree, { id: BRONZE_AXE })
        ),
        true
    );
    assert.deepEqual(player.world.replaced, [
        { type: 'gameObjects', id: 1086, newID: 1087, ticks: 94 }
    ]);
});

test('an item that is not an axe on a jungle tree is left to other plugins', async () => {
    const tree = gameObject(1086);
    const player = fakePlayer({ items: [MACHETE] });

    assert.equal(
        await woodcutting.onUseWithGameObject(player, tree, { id: 1172 }),
        false
    );
    assert.equal(player.world.replaced.length, 0);
});

test('Dramen tree at quest stage 4 gives a Dramen branch with no XP', async () => {
    const dramen = gameObject(245);
    const player = fakePlayer({ level: 36, stage: 4, items: [BRONZE_AXE] });

    assert.equal(await woodcutting.onGameObjectCommandOne(player, dramen), true);
    assert.deepEqual(player.added, [[510, 1]]);
    assert.deepEqual(player.xp, []);
    assert.ok(player.messages.includes('@que@You cut a branch from the Dramen tree'));
});

test('Dramen tree at stage 2 moves the quest to stage 3 and spawns the tree spirit', async () => {
    const dramen = gameObject(245);
    const player = fakePlayer({ level: 36, stage: 2, items: [BRONZE_AXE] });

    assert.equal(await woodcutting.onGameObjectCommandOne(player, dramen), true);
    assert.equal(player.questStages.lostCity, 3);
    assert.equal(player.world.spawned.length, 1);
    const [spirit] = player.world.spawned;
    assert.equal(spirit.id, 216);
    assert.equal(spirit.x, 412);
    assert.equal(spirit.y, 3403);
    assert.deepEqual(spirit.said, [
        'Stop',
        'I am the spirit of the Dramen Tree',
        'You must come through me before touching that tree'
    ]);
});

test('Dramen tree at a stage that cannot chop gives the ominous aura message', async () => {
    const dramen = gameObject(245);
    const player = fakePlayer({ level: 36, stage: 0, items: [BRONZE_AXE] });

    assert.equal(await woodcutting.onGameObjectCommandOne(player, dramen), true);
    assert.deepEqual(player.messages, [
        '@que@the tree seems to have a ominous aura to it',
        '@que@you do not feel like chopping it down'
    ]);
    assert.deepEqual(player.added, []);
    assert.equal(player.world.spawned.length, 0);
});

test('a normal tree goes through the existing handler, not the jungle code', async () => {
    const tree = gameObject(0, 200, 300, ['Chop', 'Examine']);
    const player = fakePlayer({ level: 1, items: [BRONZE_AXE] });

    assert.equal(
        await withRandom(0.999, () => woodcutting.onGameObjectCommandOne(player, tree)),
        true
    );
    assert.deepEqual(player.bubbles, [BRONZE_AXE]);
    assert.ok(player.messages.includes('@que@You slip and fail to hit the tree'));
    assert.equal(player.world.replaced.length, 0);
    assert.equal(player.world.spawned.length, 0);
});

test('Examine on a jungle tree is left alone', async () => {
    const tree = gameObject(1086);
    const player = fakePlayer({ items: [MACHETE, BRONZE_AXE] });

    assert.equal(await woodcutting.onGameObjectCommandTwo(player, tree), false);
    assert.equal(player.messages.length, 0);
});
