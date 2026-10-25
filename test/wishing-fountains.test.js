// Wishing fountains: a coin on a fountain or well offers a free random fountain, a visited town for 1 coin and (at a
// fountain) a 100 coin deep wish to a random well; any wish starts a 10 minute wait; quest items follow the teleport
// stone rules.

const test = require('node:test');
const assert = require('node:assert');

const plugins = require('../src/plugins');
const arscLocations = require('../src/arsc-locations');
const wishing = require('../src/plugins/game-objects/wishing-fountains');
const objectLocations = require('@2003scape/rsc-data/locations/objects');

const { FOUNTAINS, WELLS, TOWNS, COOLDOWN_MS, STEAL_RESPAWN_MS, getLanding, stolenUntil } = wishing.fountains;

const COINS_ID = 10;
const COINS = { id: COINS_ID };
const FOUNTAIN_ID = 26;
const WELL_ID = 2;

// first menu: random fountain, then (if any) visited towns, then (at a fountain) the deep wish, then never mind
const RANDOM = 0;

function town(key) {
    return TOWNS.find((t) => t.key === key);
}

function fountainOf(key) {
    const [x, y] = town(key).fountain;
    return { id: town(key).well ? WELL_ID : FOUNTAIN_ID, x, y };
}

function makePlayer({ items = [[COINS_ID, 5]], choices = [], cache = {}, members = true, opponent = null } = {}) {
    const bag = items.map(([id, amount = 1]) => ({ id, amount }));
    const queue = [...choices];

    return {
        world: { members, async sleepTicks() {} },
        skills: { thieving: { current: 1 } },
        experience: [],
        addExperience(skill, amount) {
            this.experience.push([skill, amount]);
        },
        cache,
        opponent,
        messages: [],
        menus: [],
        teleports: [],
        inventory: {
            items: bag,
            add(id, amount = 1) {
                bag.push({ id, amount });
            },
            has(id, amount = 1) {
                return this.count(id) >= amount;
            },
            remove(id, amount = 1) {
                const item = bag.find((i) => i.id === id);
                item.amount -= amount;
                if (item.amount <= 0) bag.splice(bag.indexOf(item), 1);
            },
            count(id) {
                return bag.filter((i) => i.id === id).reduce((n, i) => n + i.amount, 0);
            }
        },
        message(...lines) {
            this.messages.push(...lines);
        },
        async ask(options) {
            this.menus.push(options);
            return queue.length ? queue.shift() : options.length - 1;
        },
        teleport(x, y, bubble) {
            this.teleports.push({ x, y, bubble });
        }
    };
}

test('listed in plugins/index.js; every spot is a placed fountain or well with a landing tile beside it', () => {
    assert.ok(Object.values(plugins).includes(wishing));

    const placed = objectLocations.concat(arscLocations.gameObjects);

    for (const [list, id] of [
        [FOUNTAINS, FOUNTAIN_ID],
        [WELLS, WELL_ID]
    ]) {
        for (const [x, y, lx, ly] of list) {
            assert.ok(
                placed.some((o) => o.id === id && o.x === x && o.y === y),
                `no object ${id} at ${x},${y}`
            );
            assert.ok(!(lx >= x && lx <= x + 1 && ly >= y && ly <= y + 1), `${x},${y} lands on itself`);
            assert.ok(Math.abs(lx - x) <= 3 && Math.abs(ly - y) <= 3, `${x},${y} lands too far away`);
        }
    }

    for (const { name, fountain } of TOWNS) {
        assert.ok(getLanding(...fountain), `${name} fountain is not a wishing spot`);
    }
});

test('ignores other items, other objects and Tutorial Island', async () => {
    const player = makePlayer();

    assert.strictEqual(await wishing.onUseWithGameObject(player, fountainOf('varrock'), { id: 21 }), false);
    assert.strictEqual(await wishing.onUseWithGameObject(player, { id: 86, x: 226, y: 565 }, COINS), false);
    assert.strictEqual(await wishing.onUseWithGameObject(player, { id: WELL_ID, x: 215, y: 735 }, COINS), false);
});

test('a random fountain is free, needs no visit and starts the wait', async () => {
    const player = makePlayer({ choices: [RANDOM] });
    const before = Date.now();

    assert.strictEqual(await wishing.onUseWithGameObject(player, fountainOf('varrock'), COINS), true);

    assert.deepStrictEqual(player.menus[0], [
        'A random fountain (free)',
        'A deep wish: a random well (100 coins)',
        'Never mind'
    ]);
    assert.strictEqual(player.teleports.length, 1);
    const { x, y, bubble } = player.teleports[0];
    assert.ok(bubble);
    assert.ok(FOUNTAINS.some(([fx, fy, lx, ly]) => lx === x && ly === y && !(fx === 121 && fy === 508)));
    assert.strictEqual(player.inventory.count(COINS_ID), 5);
    assert.ok(player.cache.wishingFountainAt >= before);
});

test('first coin at a town fountain remembers the town, and a nearby well counts as the town', async () => {
    const player = makePlayer();

    await wishing.onUseWithGameObject(player, fountainOf('varrock'), COINS);
    await wishing.onUseWithGameObject(player, { id: WELL_ID, x: 117, y: 650 }, COINS);

    assert.deepStrictEqual(player.cache.wishingFountains, ['varrock', 'lumbridge']);
    assert.ok(player.messages.some((m) => /Varrock fountain will remember you/.test(m)));
});

test('a random wish that lands in a town remembers it', async () => {
    const random = Math.random;
    // the first fountain that is not the one wished at: Lumbridge
    Math.random = () => 0;

    try {
        const player = makePlayer({ choices: [RANDOM] });

        await wishing.onUseWithGameObject(player, { id: FOUNTAIN_ID, x: 255, y: 458 }, COINS);

        assert.deepStrictEqual(player.teleports[0], { x: 124, y: 654, bubble: true });
        assert.deepStrictEqual(player.cache.wishingFountains, ['lumbridge']);
        assert.ok(player.messages.includes('You will remember the way back to Lumbridge'));
    } finally {
        Math.random = random;
    }
});

test('a well offers a random fountain and visited towns, but no deep wish', async () => {
    const player = makePlayer({ cache: { wishingFountains: ['varrock'] } });

    await wishing.onUseWithGameObject(player, { id: WELL_ID, x: 117, y: 650 }, COINS);
    assert.deepStrictEqual(player.menus[0], [
        'A random fountain (free)',
        'A town I have visited (1 coin)',
        'Never mind'
    ]);
});

test('a visited town takes one coin and lands beside its fountain', async () => {
    const player = makePlayer({ cache: { wishingFountains: ['varrock', 'lumbridge'] }, choices: [1, 0] });

    await wishing.onUseWithGameObject(player, fountainOf('varrock'), COINS);

    assert.deepStrictEqual(player.menus[1], ['Lumbridge', 'Never mind']);
    assert.deepStrictEqual(player.teleports, [{ x: 124, y: 654, bubble: true }]);
    assert.strictEqual(player.inventory.count(COINS_ID), 4);
    assert.ok(player.messages.includes('You arrive by a fountain in Lumbridge'));
});

test('a deep wish takes 100 coins and lands by a random well', async () => {
    const player = makePlayer({ items: [[COINS_ID, 150]], choices: [1] });

    await wishing.onUseWithGameObject(player, fountainOf('varrock'), COINS);

    const { x, y } = player.teleports[0];
    assert.ok(WELLS.some(([, , lx, ly]) => lx === x && ly === y));
    assert.strictEqual(player.inventory.count(COINS_ID), 50);
});

test('a deep wish without 100 coins is refused and starts no wait', async () => {
    const player = makePlayer({ items: [[COINS_ID, 99]], choices: [1] });

    await wishing.onUseWithGameObject(player, fountainOf('varrock'), COINS);

    assert.strictEqual(player.teleports.length, 0);
    assert.strictEqual(player.inventory.count(COINS_ID), 99);
    assert.strictEqual(player.cache.wishingFountainAt, undefined);
});

test('the 10 minute wait refuses every wish', async () => {
    const player = makePlayer({ cache: { wishingFountainAt: Date.now() - COOLDOWN_MS + 90 * 1000 } });

    await wishing.onUseWithGameObject(player, fountainOf('varrock'), COINS);

    assert.strictEqual(player.menus.length, 0);
    assert.ok(player.messages.includes('The water is still. Try again in 2 minutes'));
});

test('the wait is over after 10 minutes', async () => {
    const player = makePlayer({ cache: { wishingFountainAt: Date.now() - COOLDOWN_MS - 1 }, choices: [RANDOM] });

    await wishing.onUseWithGameObject(player, fountainOf('varrock'), COINS);
    assert.strictEqual(player.teleports.length, 1);
});

test('the town menu pages 4 towns at a time for the 5-entry native client menu', async () => {
    const all = TOWNS.map((t) => t.key);
    // town list, page 1 "More...", page 2 the second town
    const player = makePlayer({ cache: { wishingFountains: all }, choices: [1, 4, 1] });

    await wishing.onUseWithGameObject(player, fountainOf('lumbridge'), COINS);

    assert.ok(player.menus.every((m) => m.length <= 5));
    assert.deepStrictEqual(player.menus[1], ['Varrock', 'Al Kharid', 'Draynor', 'Port Sarim', 'More...']);
    assert.strictEqual(player.menus[2][1], 'Falador');
    assert.deepStrictEqual(player.teleports[0], { x: 313, y: 541, bubble: true });
});

test('never mind keeps the coin and starts no wait', async () => {
    const player = makePlayer({ cache: { wishingFountains: ['varrock', 'lumbridge'] }, choices: [1, 1] });

    await wishing.onUseWithGameObject(player, fountainOf('varrock'), COINS);
    assert.strictEqual(player.teleports.length, 0);
    assert.strictEqual(player.inventory.count(COINS_ID), 5);
    assert.strictEqual(player.cache.wishingFountainAt, undefined);
});

test('a free world keeps wishes on the free map and hides members towns', async () => {
    for (let i = 0; i < 40; i += 1) {
        const player = makePlayer({ members: false, choices: [RANDOM], cache: { wishingFountains: ['catherby'] } });

        await wishing.onUseWithGameObject(player, fountainOf('varrock'), COINS);

        const { x, y } = player.teleports[0];
        assert.ok(x <= 450 && y <= 766, `landed at ${x},${y}`);
        assert.strictEqual(player.menus[0].length, 3);
    }
});

test('no wishing in combat', async () => {
    const player = makePlayer({ opponent: {} });

    await wishing.onUseWithGameObject(player, fountainOf('varrock'), COINS);
    assert.strictEqual(player.menus.length, 0);
    assert.ok(player.messages.includes("You can't do that whilst you are fighting"));
});

test('Ana in a barrel stops the wish', async () => {
    const player = makePlayer({ items: [[COINS_ID, 5], [1039]], choices: [RANDOM] });

    await wishing.onUseWithGameObject(player, fountainOf('varrock'), COINS);
    assert.strictEqual(player.teleports.length, 0);
    assert.strictEqual(player.cache.wishingFountainAt, undefined);
});

test('the plague sample disintegrates and Karamja rum stays on Karamja', async () => {
    const player = makePlayer({
        items: [[COINS_ID, 5], [812], [318], [318]],
        cache: { wishingFountains: ['karamja', 'brimhaven', 'falador'] },
        choices: [1, 0]
    });

    await wishing.onUseWithGameObject(player, fountainOf('karamja'), COINS);

    assert.deepStrictEqual(player.teleports[0], { x: 313, y: 541, bubble: true });
    assert.strictEqual(player.inventory.count(812), 0);
    assert.strictEqual(player.inventory.count(318), 0);
});

test('rum may travel between Karamja fountains', async () => {
    const player = makePlayer({
        items: [[COINS_ID, 5], [318]],
        cache: { wishingFountains: ['karamja', 'brimhaven'] },
        choices: [1, 0]
    });

    await wishing.onUseWithGameObject(player, fountainOf('karamja'), COINS);
    assert.strictEqual(player.teleports.length, 1);
    assert.strictEqual(player.inventory.count(318), 1);
});

test('steal coin takes 1 gp and 2 xp, then the fountain is empty for a minute', async () => {
    stolenUntil.clear();
    const player = makePlayer({ items: [] });
    const fountain = fountainOf('falador');

    assert.strictEqual(await wishing.onGameObjectCommandTwo(player, fountain), true);
    assert.strictEqual(player.inventory.count(COINS_ID), 1);
    assert.deepStrictEqual(player.experience, [['thieving', 8]]);

    await wishing.onGameObjectCommandTwo(player, fountain);
    assert.strictEqual(player.inventory.count(COINS_ID), 1);
    assert.ok(player.messages.includes('Someone has already fished the coins out of this fountain'));

    // another fountain still has its coin; this one refills after the minute
    await wishing.onGameObjectCommandTwo(player, fountainOf('edgeville'));
    assert.strictEqual(player.inventory.count(COINS_ID), 2);
    assert.ok(player.messages.includes('You steal a coin from the well'));

    stolenUntil.set(`${fountain.x}:${fountain.y}`, Date.now() - 1);
    await wishing.onGameObjectCommandTwo(player, fountain);
    assert.strictEqual(player.inventory.count(COINS_ID), 3);
    assert.ok(STEAL_RESPAWN_MS === 60 * 1000);
});

test('steal coin ignores other objects and Tutorial Island, and not in combat', async () => {
    stolenUntil.clear();
    const player = makePlayer({ items: [] });

    assert.strictEqual(await wishing.onGameObjectCommandTwo(player, { id: 86, x: 226, y: 565 }), false);
    assert.strictEqual(await wishing.onGameObjectCommandTwo(player, { id: WELL_ID, x: 215, y: 735 }), false);

    player.opponent = {};
    await wishing.onGameObjectCommandTwo(player, fountainOf('falador'));
    assert.strictEqual(player.inventory.count(COINS_ID), 0);
});

test('"Make a wish" opens the same menu, and a random wish needs no coin', async () => {
    const player = makePlayer({ items: [], choices: [RANDOM] });

    assert.strictEqual(await wishing.onGameObjectCommandOne(player, fountainOf('varrock')), true);
    assert.strictEqual(player.menus[0][0], 'A random fountain (free)');
    assert.strictEqual(player.teleports.length, 1);
    assert.strictEqual(await wishing.onGameObjectCommandOne(player, { id: 86, x: 226, y: 565 }), false);
});

test('a town wish without a coin is refused', async () => {
    const player = makePlayer({ items: [], cache: { wishingFountains: ['varrock', 'lumbridge'] }, choices: [1, 0] });

    await wishing.onGameObjectCommandOne(player, fountainOf('varrock'));
    assert.strictEqual(player.teleports.length, 0);
    assert.ok(player.messages.includes('You need 1 coin for that wish'));
});
