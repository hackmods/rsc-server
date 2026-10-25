// Charge orbs, telekinetic grab and Charge (plugins/skills/magic.js and the
// charge branch of castSelf in packet-handlers/magic.js).

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    castSelf,
    castObject,
    castGroundItem
} = require('../src/packet-handlers/magic');
const magic = require('../src/plugins/skills/magic');

const WATER_OBELISK = 300;
const FIRE_OBELISK = 301;
const UNPOWERED_ORB = 611;
const WATER_ORB = 613;
const CHARGE_WATER_ORB = 29;
const TELEKINETIC_GRAB = 16;
const CHARGE = 47;
const WATER_RUNE = 32;
const COSMIC_RUNE = 46;
const LAW_RUNE = 42;
const AIR_RUNE = 33;
const FIRE_RUNE = 31;
const BLOOD_RUNE = 619;

function setup({
    have = {},
    magicLevel = 99,
    groundItems = [],
    gameObjects = [],
    cache = {},
    x = 220,
    y = 130
} = {}) {
    const messages = [];
    const added = [];
    const addedEntities = [];
    const timeouts = [];
    const exp = [];
    const counts = new Map(Object.entries(have).map(([id, n]) => [+id, n]));

    const world = {
        members: true,
        ticks: 100,
        gameObjects: {
            getAtPoint: () => gameObjects,
            getByIndex: () => null
        },
        groundItems: {
            getAtPoint: () => groundItems,
            getByIndex: (index) =>
                groundItems.find((i) => i.index === index) || null
        },
        async callPlugin(name, ...args) {
            return magic[name] ? (await magic[name](...args)) === true : false;
        },
        removeEntity(type, entity) {
            if (type === 'groundItems') {
                const at = groundItems.indexOf(entity);

                if (at >= 0) {
                    groundItems.splice(at, 1);
                }
            }
        },
        addEntity(type, entity) {
            addedEntities.push([type, entity]);
        },
        setTickTimeout(func, ticks) {
            timeouts.push({ func, ticks });
        },
        sleepTicks: async () => {}
    };

    const player = {
        id: 1,
        x,
        y,
        world,
        cache,
        locked: false,
        skills: { magic: { current: magicLevel } },
        walkQueue: [],
        localEntities: { known: { players: [] } },
        hasInterfaceOpen: () => false,
        withinRange: () => true,
        withinLineOfSight: () => true,
        sendSound() {},
        sendTeleportBubble() {},
        addExperience: (skill, xp) => exp.push([skill, xp]),
        message: (...m) => messages.push(...m),
        inventory: {
            has: (id, n = 1) => (counts.get(id) || 0) >= n,
            isEquipped: () => false,
            remove: (id, n = 1) => counts.set(id, (counts.get(id) || 0) - n),
            add: (id, n = 1) => added.push([id, n])
        }
    };

    return {
        player,
        world,
        messages,
        added,
        counts,
        exp,
        addedEntities,
        timeouts,
        groundItems
    };
}

const orbRunes = { [WATER_RUNE]: 30, [COSMIC_RUNE]: 3, [UNPOWERED_ORB]: 1 };

test('charge water orb on the water obelisk gives a water orb and takes the runes', async () => {
    const t = setup({ have: orbRunes });
    t.world.gameObjects.getAtPoint = () => [{ id: WATER_OBELISK }];

    await castObject(
        { player: t.player },
        { x: 10, y: 10, id: CHARGE_WATER_ORB }
    );

    assert.deepEqual(t.added, [[WATER_ORB, 1]]);
    assert.equal(t.counts.get(WATER_RUNE), 0);
    assert.equal(t.counts.get(COSMIC_RUNE), 0);
    assert.equal(t.counts.get(UNPOWERED_ORB), 0);
    assert.equal(t.exp.length, 1);
    assert.equal(t.exp[0][0], 'magic');
    assert.ok(t.exp[0][1] > 0);
    assert.ok(t.messages.includes('You succesfully charge the orb'));
});

test('charge water orb on the wrong obelisk costs nothing', async () => {
    const t = setup({ have: orbRunes });
    t.world.gameObjects.getAtPoint = () => [{ id: FIRE_OBELISK }];

    await castObject(
        { player: t.player },
        { x: 10, y: 10, id: CHARGE_WATER_ORB }
    );

    assert.deepEqual(t.messages, [
        'This spell can only be used on water obelisks'
    ]);
    assert.deepEqual(t.added, []);
    assert.equal(t.counts.get(WATER_RUNE), 30);
    assert.equal(t.exp.length, 0);
});

test('charge orb without the runes is refused and still claimed', async () => {
    const t = setup({ have: { [WATER_RUNE]: 30 } });

    const claimed = await magic.onCastOnGameObject(
        t.player,
        { id: WATER_OBELISK },
        {
            name: 'Charge Water Orb',
            level: 56,
            runes: [{ id: COSMIC_RUNE, amount: 3 }]
        },
        CHARGE_WATER_ORB
    );

    assert.equal(claimed, true);
    assert.deepEqual(t.added, []);
    assert.deepEqual(t.messages, [
        "You don't have all the reagents you need for this spell"
    ]);
});

test('other spells are passed on by both hooks', async () => {
    const t = setup();

    assert.equal(
        await magic.onCastOnGameObject(t.player, { id: WATER_OBELISK }, {}, 0),
        false
    );

    assert.equal(
        await magic.onCastOnGroundItem(t.player, { id: 1 }, {}, 0),
        false
    );

    assert.deepEqual(t.messages, []);
});

test('telekinetic grab moves the item into the inventory', async () => {
    const item = { index: 5, id: 1, amount: 1, x: 223, y: 130 };

    const t = setup({
        have: { [AIR_RUNE]: 1, [LAW_RUNE]: 1 },
        groundItems: [item]
    });

    await castGroundItem(
        { player: t.player },
        { x: 223, y: 130, id: TELEKINETIC_GRAB, itemID: 1 }
    );

    assert.deepEqual(t.added, [[1, 1]]);
    assert.equal(t.groundItems.length, 0);
    assert.equal(t.counts.get(AIR_RUNE), 0);
    assert.equal(t.counts.get(LAW_RUNE), 0);
    assert.ok(t.messages.includes('Spell successful'));
    assert.equal(t.exp[0][0], 'magic');
});

test('telekinetic grab refuses an ungrabbable item and keeps the runes', async () => {
    const scythe = { index: 6, id: 1289, amount: 1, x: 223, y: 130 };

    const t = setup({
        have: { [AIR_RUNE]: 1, [LAW_RUNE]: 1 },
        groundItems: [scythe]
    });

    await castGroundItem(
        { player: t.player },
        { x: 223, y: 130, id: TELEKINETIC_GRAB, itemID: 1289 }
    );

    assert.deepEqual(t.messages, [
        "I can't use telekinetic grab on this object"
    ]);

    assert.equal(t.groundItems.length, 1);
    assert.deepEqual(t.added, []);
    assert.equal(t.counts.get(AIR_RUNE), 1);
});

test('telekinetic grab out of line of sight', async () => {
    const item = { index: 5, id: 1, amount: 1, x: 223, y: 130 };

    const t = setup({
        have: { [AIR_RUNE]: 1, [LAW_RUNE]: 1 },
        groundItems: [item]
    });

    t.player.withinLineOfSight = () => false;

    await castGroundItem(
        { player: t.player },
        { x: 223, y: 130, id: TELEKINETIC_GRAB, itemID: 1 }
    );

    assert.deepEqual(t.messages, ["I can't see the object from here"]);
    assert.equal(t.groundItems.length, 1);
});

const chargeRunes = { [FIRE_RUNE]: 3, [AIR_RUNE]: 3, [BLOOD_RUNE]: 3 };

test('Charge in the Mage Arena sets the charge flag, spawns the effect and fades', async () => {
    const t = setup({ have: chargeRunes, x: 225, y: 130 });

    await castSelf({ player: t.player }, { id: CHARGE });

    assert.equal(typeof t.player.chargeExpiresTick, 'number');
    assert.ok(t.player.chargeExpiresTick > t.world.ticks);
    assert.ok(t.messages.includes('@gre@You feel charged with magic power'));
    assert.equal(t.counts.get(FIRE_RUNE), 0);
    assert.equal(t.addedEntities.length, 1);
    assert.equal(t.addedEntities[0][1].id, 1147);

    // the longest timeout is the 6 minute fade
    const fade = t.timeouts.reduce((a, b) => (b.ticks > a.ticks ? b : a));
    t.world.ticks = t.player.chargeExpiresTick;
    fade.func();
    assert.equal(t.player.chargeExpiresTick, undefined);
    assert.ok(t.messages.includes('@red@Your magic charge fades'));
});

test('Charge outside the Mage Arena needs 100 casts of the god spells', async () => {
    const t = setup({ have: chargeRunes, x: 100, y: 100 });
    await castSelf({ player: t.player }, { id: CHARGE });

    assert.deepEqual(t.messages, [
        'this spell can only be used in the mage arena'
    ]);

    assert.equal(t.player.chargeExpiresTick, undefined);

    const done = setup({
        have: chargeRunes,
        x: 100,
        y: 100,
        cache: { 'Saradomin strike_casts': 100 }
    });

    await castSelf({ player: done.player }, { id: CHARGE });
    assert.equal(typeof done.player.chargeExpiresTick, 'number');

    const partial = setup({
        have: chargeRunes,
        x: 100,
        y: 100,
        cache: { 'Saradomin strike_casts': 99 }
    });

    await castSelf({ player: partial.player }, { id: CHARGE });
    assert.equal(partial.player.chargeExpiresTick, undefined);
});

test('Charge on a tile with an object is refused', async () => {
    const t = setup({
        have: chargeRunes,
        x: 225,
        y: 130,
        gameObjects: [{ id: 5 }]
    });

    await castSelf({ player: t.player }, { id: CHARGE });

    assert.deepEqual(t.messages, [
        "You can't charge power here, please move to a different area"
    ]);

    assert.equal(t.counts.get(FIRE_RUNE), 3);
});
