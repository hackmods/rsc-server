// The quest passages of game-objects/object-tele-points.js ported from the Open-RSC quest plugins: DwarfCannon.java,
// UndergroundPassObstaclesMap1.java / UndergroundPassPuzzle.java, LegendsQuestGameObjects.java, MagicalPool.java,
// WatchTowerObstacles.java and Waterfall_Quest.java.
const test = require('node:test');
const assert = require('node:assert/strict');

const objects = require('@2003scape/rsc-data/config/objects');
const wallObjects = require('@2003scape/rsc-data/config/wall-objects');
const placedObjects = require('@2003scape/rsc-data/locations/objects');
const placedWalls = require('@2003scape/rsc-data/locations/wall-objects');
const tele = require('../src/plugins/game-objects/object-tele-points');
const grandTree = require('../src/plugins/wall-objects/grand-tree-doors');

function fakePlayer() {
    const p = {
        x: 0,
        y: 0,
        messages: [],
        said: [],
        swaps: [],
        cache: {},
        questStages: {},
        held: new Map(),
        fatigue: 0,
        answers: [],
        world: {
            sleepTicks: async () => {},
            gameObjects: { getAtPoint: (x, y) => [{ id: x === 704 ? 726 : 802, x, y }] },
            replaceTimed: (type, entity, id, ticks) => p.swaps.push([entity.id, id, ticks])
        },
        inventory: { has: (id) => p.held.get(id) > 0 },
        async ask() {
            return this.answers.shift();
        },
        async say(...lines) {
            this.said.push(...lines);
        },
        message(m) {
            this.messages.push(m);
        },
        teleport(x, y) {
            this.x = x;
            this.y = y;
        },
        sendTeleportBubble() {}
    };
    return p;
}

async function click(player, id, x, y) {
    return tele.onGameObjectCommandOne(player, { id, x, y, direction: 0, definition: objects[id] });
}

const PORTED = [
    [982, 576, 523], [983, 577, 3355], [812, 706, 3440], [733, 711, 3418], [801, 689, 3444], [801, 689, 3453],
    [1158, 462, 3699], [1159, 446, 3698], [1155, 446, 3374], [1166, 471, 3383], [970, 649, 770], [970, 640, 786],
    [972, 628, 778], [950, 625, 807], [971, 638, 779], [949, 630, 788], [975, 647, 812], [998, 668, 825],
    [1024, 648, 3604], [969, 651, 3592], [464, 660, 449], [1008, 654, 3580]
];
const PORTED_WALLS = [[187, 626, 3591], [188, 649, 3554], [189, 638, 3563], [190, 627, 3563], [191, 629, 3573], [192, 646, 3596]];
const SKAVID_ROWS = tele.TELE_POINTS.filter((r) => r.custom && r.custom.name === 'enterSkavidCave');

test('every ported quest passage is a row on a placed object', () => {
    for (const [id, x, y] of PORTED) {
        assert.ok(tele.TELE_POINTS.find((r) => !r.wall && r.id === id && r.x === x && r.y === y), `${id}@${x},${y}`);
        assert.ok(placedObjects.some((o) => o.id === id && o.x === x && o.y === y), `${id}@${x},${y} placed`);
    }
    for (const [id, x, y] of PORTED_WALLS) {
        assert.ok(tele.TELE_POINTS.find((r) => r.wall && r.id === id && r.x === x && r.y === y), `wall ${id}`);
        assert.ok(placedWalls.some((o) => o.id === id && o.x === x && o.y === y), `wall ${id} placed`);
    }
});

test('no plugin listed before the table claims a ported passage', async () => {
    const plugins = require('../src/plugins/index.js');
    const lenient = (fields) =>
        new Proxy(fields, {
            get: (t, k) => (k in t ? t[k] : k === 'then' ? undefined : () => undefined)
        });
    const check = async (hookName, owner, entity) => {
        for (const [name, plugin] of Object.entries(plugins)) {
            if (name === owner) {
                return;
            }
            if (typeof plugin[hookName] !== 'function') {
                continue;
            }
            const world = lenient({
                sleepTicks: async () => {},
                gameObjects: { getAtPoint: () => [entity] },
                npcs: { getByID: () => undefined }
            });
            const player = lenient({
                x: entity.x,
                y: entity.y + 1,
                world,
                cache: {},
                questStages: {},
                skills: new Proxy({}, { get: () => ({ current: 1, base: 1 }) }),
                inventory: lenient({ has: () => false, items: [] }),
                bank: lenient({ has: () => false }),
                message: () => {},
                say: async () => {},
                ask: async () => 0
            });
            assert.equal(await plugin[hookName](player, entity), false, `${name} claims ${entity.id}@${entity.x},${entity.y}`);
        }
        assert.fail(`${owner} is not in index.js`);
    };
    for (const [id, x, y] of PORTED) {
        await check('onGameObjectCommandOne', 'game-objects.object-tele-points', { id, x, y, direction: 0, definition: objects[id] });
    }
    for (const [id, x, y] of PORTED_WALLS) {
        await check('onWallObjectCommandOne', 'wall-objects.grand-tree-doors', { id, x, y, direction: 0, definition: wallObjects[id] });
    }
});

test('plain passages: goblin cave and mudpile, ledge, cavern exit, pool back, enclave exit, with the Java messages', async () => {
    const p = fakePlayer();
    await click(p, 982, 576, 523);
    assert.deepEqual([p.x, p.y], [578, 3356]);
    await click(p, 983, 577, 3355);
    assert.deepEqual([p.x, p.y], [578, 521]);
    await click(p, 812, 706, 3440);
    assert.deepEqual([p.x, p.y], [706, 3439]);
    await click(p, 1158, 462, 3699);
    assert.deepEqual([p.x, p.y], [452, 874]);
    await click(p, 1166, 471, 3383);
    assert.deepEqual([p.x, p.y], [447, 3373]);
    await click(p, 1024, 648, 3604);
    assert.deepEqual([p.x, p.y], [662, 788]);
    assert.deepEqual(p.messages, [
        'you cautiously enter the cave',
        'you climb the mudpile',
        'you drop down to the cave floor',
        'You crawl back out from the cavern...',
        'you step into the sparkling water',
        'you feel energy rush through your veins',
        'you are teleported to kolodions cave'
    ]);
    // DwarfCannon.java only answers the cave at y 523
    assert.equal(await click(fakePlayer(), 982, 576, 524), false);
});

test('Skavid cave exits (walls 187-192) leave without a word', async () => {
    for (const [id, x, y] of PORTED_WALLS) {
        const p = fakePlayer();
        assert.equal(await grandTree.onWallObjectCommandOne(p, { id, x, y, direction: 0, definition: wallObjects[id] }), true);
        assert.deepEqual([p.x, p.y], tele.TELE_POINTS.find((r) => r.wall && r.id === id).to);
        assert.deepEqual(p.messages, []);
    }
});

test('Skavid caves: no map, a map in the dark, a map and a light', async () => {
    assert.equal(SKAVID_ROWS.length, 7);
    for (const r of SKAVID_ROWS) {
        const p = fakePlayer();
        await click(p, r.id, r.x, r.y);
        assert.deepEqual([p.x, p.y], r.alt[0].to, `${r.id} no map`);
        assert.deepEqual(p.messages, ["There's no way I can find my way through without a map of some kind"]);
        p.held.set(1045, 1);
        await click(p, r.id, r.x, r.y);
        assert.deepEqual([p.x, p.y], [629, 3558], `${r.id} dark`);
        assert.equal(p.said[0], "Oh my! It's dark!");
        for (const light of [601, 602, 774]) {
            const q = fakePlayer();
            q.held.set(1045, 1);
            q.held.set(light, 1);
            await click(q, r.id, r.x, r.y);
            assert.deepEqual([q.x, q.y], r.to, `${r.id} lit ${light}`);
            assert.deepEqual(q.messages, ['You enter the cave']);
        }
        // an unlit black candle (600) is no light
        const u = fakePlayer();
        u.held.set(1045, 1);
        u.held.set(600, 1);
        await click(u, r.id, r.x, r.y);
        assert.deepEqual([u.x, u.y], [629, 3558]);
    }
});

test('the dark place: rock 1008 leads out, the other rocks hold nothing', async () => {
    const p = fakePlayer();
    await click(p, 1008, 654, 3580);
    assert.deepEqual([p.x, p.y], [638, 776]);
    assert.deepEqual(p.messages, ['You search the rock', 'You uncover a tunnel entrance']);
    assert.deepEqual(p.said, ["Phew! At last i'm out...", 'Next time I will take some light!']);
    const q = fakePlayer();
    assert.equal(await click(q, 1007, 630, 3560), true);
    assert.deepEqual(q.messages, ['You search the rock', "There's nothing here"]);
    assert.deepEqual([q.x, q.y], [0, 0]);
});

test('998 tunnel cave, and 969 Skavid hole refused at 95% fatigue', async () => {
    const p = fakePlayer();
    await click(p, 998, 668, 825);
    assert.deepEqual([p.x, p.y], [605, 803]);
    assert.deepEqual(p.messages, ['You enter the cave']);
    assert.deepEqual(p.said, ['Wow! that tunnel went a long way']);
    const q = fakePlayer();
    q.fatigue = 0.95 * 75000;
    await click(q, 969, 651, 3592);
    assert.deepEqual([q.x, q.y], [0, 0]);
    assert.deepEqual(q.messages, ['You are too tired to enter this tunnel']);
    q.fatigue -= 1;
    q.messages = [];
    await click(q, 969, 651, 3592);
    assert.deepEqual([q.x, q.y], [609, 742]);
    assert.deepEqual(q.messages, ['You enter the tunnel', "So that's how the skavids are getting into yanille!"]);
});

test('1155 Kolodion pool needs mageArena >= 2', async () => {
    const p = fakePlayer();
    await click(p, 1155, 446, 3374);
    assert.deepEqual([p.x, p.y], [0, 0]);
    assert.deepEqual(p.messages, ['you step into the pool', 'you wet your boots']);
    p.cache.mageArena = 1;
    await click(p, 1155, 446, 3374);
    assert.deepEqual([p.x, p.y], [0, 0]);
    p.cache.mageArena = 2;
    p.messages = [];
    await click(p, 1155, 446, 3374);
    assert.deepEqual([p.x, p.y], [471, 3385]);
    assert.deepEqual(p.messages, ['you are teleported further under ground']);
});

test('1159 boulder cave asks first', async () => {
    const p = fakePlayer();
    p.answers = [1];
    await click(p, 1159, 446, 3698);
    assert.deepEqual([p.x, p.y], [0, 0]);
    assert.equal(p.messages.at(-1), 'You decide against climbing into the small, uncomfortable looking tunnel.');
    p.answers = [0];
    await click(p, 1159, 446, 3698);
    assert.deepEqual([p.x, p.y], [452, 3702]);
    assert.equal(p.messages.at(-1), 'You clamber into the small cave...');
    assert.deepEqual(p.said, []);
});

test('Underground Pass levers lower the bridge and raise the railing', async () => {
    const p = fakePlayer();
    await click(p, 733, 711, 3418);
    assert.deepEqual([p.x, p.y], [703, 3420]);
    assert.deepEqual(p.swaps, [[726, 727, 16]]);
    assert.deepEqual(p.messages, ['you pull back on the old lever', 'the bridge slowly lowers', 'you cross the bridge']);
    for (const y of [3444, 3453]) {
        const q = fakePlayer();
        await click(q, 801, 689, y);
        assert.deepEqual([q.x, q.y], [690, 3451]);
        assert.deepEqual(q.swaps, [[802, 803, 8]]);
        assert.equal(q.messages.at(-1), 'the cage lowers behind you');
    }
});

test('464 log raft lands on the mound; Hudon talks at Waterfall Quest stage 1', async () => {
    const p = fakePlayer();
    await click(p, 464, 660, 449);
    assert.deepEqual([p.x, p.y], [662, 463]);
    assert.equal(p.messages.length, 4);
    const hudonSaid = [];
    const q = fakePlayer();
    q.world.npcs = { getByID: (id) => (id === 471 ? { say: async (...l) => hudonSaid.push(...l) } : undefined) };
    await click(q, 464, 660, 449);
    assert.deepEqual(hudonSaid, []);
    q.questStages.waterfallQuest = 1;
    await click(q, 464, 660, 449);
    assert.equal(q.questStages.waterfallQuest, 2);
    assert.equal(hudonSaid.at(-1), "i'm fine alone");
    assert.equal(q.said[0], 'hello son, are you okay?');
    assert.equal(q.messages.at(-1), 'hudon is refusing to leave the waterfall');
});
