// Kitten Care (Open-RSC kittencare/KittenToCat.java): the activity counter fires growth every 50 points, hunger and
// loneliness rise and fall, the kitten runs off at 64, grows into a cat after 32 events, and the care actions work.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const plugins = require('../src/plugins');
const kitten = require('../src/plugins/minigames/kitten-care');

const KITTEN = 1096;
const CAT = 1119;
const MILK = 22;
const BUCKET = 21;
const RAW_TROUT = 358;
const BALL_OF_WOOL = 207;

function makePlayer(bagIds = [KITTEN], cache = {}) {
    const bag = bagIds.map((id) => ({ id, amount: 1 }));
    const removed = [];
    const growths = [];

    return {
        cache,
        messages: [],
        removed,
        growths,
        world: {
            async sleepTicks() {},
            removeEntity(type, entity) {
                removed.push(entity);
            },
            async callPlugin(name, player) {
                growths.push(name);
                return kitten.onCatGrowth(player, () => 5);
            }
        },
        inventory: {
            items: bag,
            has(id) {
                return bag.some((i) => i.id === id);
            },
            add(id) {
                bag.push({ id, amount: 1 });
            },
            remove(id) {
                const i = bag.findIndex((item) => item.id === id);
                if (i > -1) bag.splice(i, 1);
            }
        },
        message(...lines) {
            this.messages.push(...lines);
        }
    };
}

test('listed in plugins/index.js, onCatGrowth is a plugin type and player.js feeds the activity counter', () => {
    assert.ok(Object.values(plugins).includes(kitten));
    const world = fs.readFileSync(require.resolve('../src/model/world.js'), 'utf8');
    assert.match(world, /'onCatGrowth'/);
    const player = fs.readFileSync(require.resolve('../src/model/player.js'), 'utf8');
    assert.match(player, /kittenCare\.addActivity\(this, 2\)/);
    assert.match(player, /kittenCare\.addActivity\(this, 5\)/);
});

test('every 50 activity points fire onCatGrowth, only with a kitten carried', async () => {
    const player = makePlayer();

    for (let i = 0; i < 24; i += 1) assert.equal(kitten.addActivity(player, 2), false);
    assert.equal(kitten.addActivity(player, 2), true);
    assert.deepEqual(player.growths, ['onCatGrowth']);
    assert.equal(player.kittenActivity, 0);

    const nokitten = makePlayer([]);
    for (let i = 0; i < 10; i += 1) kitten.addActivity(nokitten, 5);
    assert.deepEqual(nokitten.growths, []);
});

test('growth: crossing a multiple of 16 is an event with its messages', async () => {
    const player = makePlayer([KITTEN], { kittenHunger: 12, kittenLoneliness: 0 });

    assert.equal(await kitten.onCatGrowth(player, () => 5), true);
    assert.deepEqual(player.cache, { kittenEvents: 1, kittenHunger: 17, kittenLoneliness: 5 });
    assert.deepEqual(player.messages, ['you hear a purring']);

    const both = makePlayer([KITTEN], { kittenHunger: 44, kittenLoneliness: 44 });
    await kitten.onCatGrowth(both, () => 5);
    assert.deepEqual(both.messages, [
        'you hear a loud meow',
        '@yel@kitten: miaaaaow!',
        'your kitten is feeling lonely',
        'your kitten is really hungry'
    ]);

    assert.equal(await kitten.onCatGrowth(makePlayer([]), () => 5), false);
});

test('at 64 hunger the kitten runs off; the gauges reset and the release is counted', async () => {
    const player = makePlayer([KITTEN], { kittenHunger: 60, kittenLoneliness: 0, kittenEvents: 7 });

    await kitten.onCatGrowth(player, () => 5);
    assert.ok(!player.inventory.has(KITTEN));
    assert.deepEqual(player.messages, ['your kitten has ran off to look for food', 'to find some food']);
    assert.equal(player.cache.kittensReleased, 1);
    assert.equal(player.cache.kittenHunger, 0);
});

test('after 32 events the kitten grows into a cat', async () => {
    const player = makePlayer([KITTEN], { kittenHunger: 12, kittenLoneliness: 0, kittenEvents: 31 });

    await kitten.onCatGrowth(player, () => 5);
    assert.ok(!player.inventory.has(KITTEN));
    assert.ok(player.inventory.has(CAT));
    assert.equal(player.cache.kittensRaised, 1);
    assert.equal(player.cache.kittenEvents, 0);
    assert.ok(player.messages.includes("you're kitten has grown into a healthy cat"));
});

test('stroking and wool cut loneliness by 16; milk (bucket back) and fish cut hunger by 16', async () => {
    const player = makePlayer([KITTEN, MILK, RAW_TROUT, BALL_OF_WOOL], { kittenHunger: 40, kittenLoneliness: 40 });

    assert.equal(await kitten.onInventoryCommand(player, { id: KITTEN }), true);
    assert.equal(player.cache.kittenLoneliness, 24);
    assert.equal(await kitten.onUseWithInventory(player, { id: BALL_OF_WOOL }, { id: KITTEN }), true);
    assert.equal(player.cache.kittenLoneliness, 8);
    assert.ok(player.inventory.has(BALL_OF_WOOL), 'the wool is kept');

    assert.equal(await kitten.onUseWithInventory(player, { id: KITTEN }, { id: MILK }), true);
    assert.ok(!player.inventory.has(MILK) && player.inventory.has(BUCKET));
    assert.equal(player.cache.kittenHunger, 24);
    assert.equal(await kitten.onUseWithInventory(player, { id: RAW_TROUT }, { id: KITTEN }), true);
    assert.equal(player.cache.kittenHunger, 8);
    assert.ok(player.messages.includes('you give the kitten the Raw Trout'));

    // below 16 nothing more comes off
    await kitten.onInventoryCommand(player, { id: KITTEN });
    assert.equal(player.cache.kittenLoneliness, 8);
    assert.equal(await kitten.onUseWithInventory(player, { id: KITTEN }, { id: 10 }), false);
});

test('dropping the kitten releases it', async () => {
    const player = makePlayer([KITTEN]);

    assert.equal(await kitten.onDropItem(player, { id: KITTEN }), true);
    assert.ok(!player.inventory.has(KITTEN));
    assert.deepEqual(player.messages, ['you drop the kitten', "it's upset and runs away"]);
    assert.equal(await kitten.onDropItem(player, { id: 10 }), false);
});

test('a cat always catches a rat; a kitten 1 in 10', async () => {
    const cat = makePlayer([CAT]);
    const rat = { id: 29 };

    assert.equal(await kitten.onUseWithNPC(cat, rat, { id: CAT }), true);
    assert.deepEqual(cat.removed, [rat]);

    const missed = makePlayer([KITTEN]);
    await kitten.onUseWithNPC(missed, rat, { id: KITTEN }, () => false);
    assert.deepEqual(missed.removed, []);
    assert.deepEqual(missed.messages, ['it pounces on the rat...']);

    const caught = makePlayer([KITTEN], { kittenLoneliness: 20 });
    await kitten.onUseWithNPC(caught, rat, { id: KITTEN }, () => true);
    assert.deepEqual(caught.removed, [rat]);
    assert.equal(caught.cache.kittenLoneliness, 4);

    assert.equal(await kitten.onUseWithNPC(cat, { id: 11 }, { id: CAT }), false);
});
