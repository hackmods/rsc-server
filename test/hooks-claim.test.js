// Hooks that act must return true: World#callPlugin stops at the first true, and the packet handler prints
// "Nothing interesting happens" when nothing claims the click. These used to act and then fall through.

const test = require('node:test');
const assert = require('node:assert');

const woodcutting = require('../src/plugins/skills/woodcutting');
const coffin = require('../src/plugins/game-objects/coffin');
const drain = require('../src/plugins/quests/free/demon-slayer/drain');
const phoenixChest = require('../src/plugins/quests/free/shield-of-arrav/phoenix-chest');
const grill = require('../src/plugins/quests/free/black-knights-fortress/grill');
const objects = require('@2003scape/rsc-data/config/objects');

// any method the plugin calls that the test does not care about is a no-op
function lenient(fields = {}) {
    return new Proxy(fields, {
        get(target, prop) {
            if (prop in target) return target[prop];
            if (prop === 'then') return undefined;
            return () => undefined;
        }
    });
}

function makeWorld(gameObject) {
    return lenient({
        sleepTicks: async () => {},
        gameObjects: { getAtPoint: () => [gameObject] },
        replaceEntity: (type, entity, id) => ({ ...entity, id }),
        setTimeout: () => {},
        npcs: { getByID: () => lenient({ say: async () => {} }) }
    });
}

function makePlayer(world, { level = 99, items = [], questStages = {} } = {}) {
    const messages = [];
    return {
        messages,
        player: lenient({
            world,
            questStages,
            skills: { woodcutting: { current: level, base: level } },
            inventory: lenient({ has: (id) => items.includes(id), add: () => {} }),
            bank: lenient({ has: () => false }),
            isTired: () => false,
            message: (m) => messages.push(m)
        })
    };
}

function makeObject(id, x = 0, y = 0) {
    return { id, x, y, definition: objects[id] };
}

test('woodcutting claims a chop (command one and two)', async () => {
    const tree = makeObject(0);
    const { player, messages } = makePlayer(makeWorld(tree), { items: [87] });
    assert.strictEqual(await woodcutting.onGameObjectCommandOne(player, tree), true);
    assert.ok(messages.some((m) => /swing your/.test(m)));

    // tree 70's chop is its second command
    const tree70 = makeObject(70);
    assert.match(objects[70].commands[1], /chop/i);
    const two = makePlayer(makeWorld(tree70), { items: [87] });
    assert.strictEqual(await woodcutting.onGameObjectCommandTwo(two.player, tree70), true);
});

test('woodcutting claims refusals too (no axe, level too low)', async () => {
    const tree = makeObject(0);
    const noAxe = makePlayer(makeWorld(tree));
    assert.strictEqual(await woodcutting.onGameObjectCommandOne(noAxe.player, tree), true);
    assert.ok(noAxe.messages.some((m) => /need an axe/.test(m)));

    const yew = makeObject(309);
    const low = makePlayer(makeWorld(yew), { level: 1, items: [87] });
    assert.strictEqual(await woodcutting.onGameObjectCommandOne(low.player, yew), true);
});

test('woodcutting leaves other objects alone', async () => {
    const rock = makeObject(100);
    const { player } = makePlayer(makeWorld(rock), { items: [87] });
    assert.strictEqual(await woodcutting.onGameObjectCommandOne(player, rock), false);
});

test('coffin 202/203 open and search claim', async () => {
    for (const id of [202, 203]) {
        const obj = makeObject(id);
        const { player } = makePlayer(makeWorld(obj));
        assert.strictEqual(await coffin.onGameObjectCommandOne(player, obj), true, String(id));
    }
    const other = makeObject(135);
    assert.strictEqual(await coffin.onGameObjectCommandOne(makePlayer(makeWorld(other)).player, other), false);
});

test('demon slayer drain search claims at every stage', async () => {
    const obj = makeObject(77);
    for (const stage of [0, 1, 2, -1]) {
        const { player } = makePlayer(makeWorld(obj), { questStages: { demonSlayer: stage } });
        assert.strictEqual(await drain.onGameObjectCommandTwo(player, obj), true, String(stage));
    }
});

test('phoenix chest search claims', async () => {
    const obj = makeObject(81);
    const { player, messages } = makePlayer(makeWorld(obj));
    assert.strictEqual(await phoenixChest.onGameObjectCommandOne(player, obj), true);
    assert.ok(messages.some((m) => /half a shield/.test(m)));
});

test('black knights fortress grill claims after the overheard plans', async () => {
    const obj = makeObject(148);
    const stages = { blackKnightsFortress: 1 };
    const { player } = makePlayer(makeWorld(obj), { questStages: stages });
    assert.strictEqual(await grill.onGameObjectCommandOne(player, obj), true);
    assert.strictEqual(stages.blackKnightsFortress, 2);
});
