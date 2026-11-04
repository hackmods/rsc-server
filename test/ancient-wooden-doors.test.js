// Ancient Wooden Doors 1160 (Open-RSC LegendsQuestGameObjects.java) and the civilian 732 pickpocket (Thieving.java).

const test = require('node:test');
const assert = require('node:assert/strict');

const objects = require('@2003scape/rsc-data/config/objects');
const doors = require('../src/plugins/game-objects/ancient-wooden-doors');
const thieving = require('../src/plugins/skills/thieving');

const DOOR = { id: 1160, x: 441, y: 3702, direction: 2, definition: objects[1160] };

function fakePlayer({ thievingLevel = 99, lockpick = false, y = 3700 } = {}) {
    const p = {
        x: 441,
        y,
        messages: [],
        said: [],
        experience: [],
        replaced: [],
        skills: { thieving: { current: thievingLevel } },
        world: {
            sleepTicks: async () => {},
            replaceTimed: (type, entity, id, ticks) => p.replaced.push([type, entity.id, id, ticks])
        },
        inventory: { has: (id) => lockpick && id === 714 },
        message(m) {
            this.messages.push(m);
        },
        async say(...lines) {
            this.said.push(...lines);
        },
        teleport(x, y2) {
            this.x = x;
            this.y = y2;
        },
        addExperience(skill, xp) {
            this.experience.push([skill, xp]);
        }
    };
    return p;
}

function withRandom(value, fn) {
    const real = Math.random;
    Math.random = () => value;
    return Promise.resolve(fn()).finally(() => {
        Math.random = real;
    });
}

test('Open from the south only describes the lock', async () => {
    const player = fakePlayer();
    assert.equal(await doors.onGameObjectCommandOne(player, DOOR), true);
    assert.deepEqual([player.x, player.y], [441, 3700]);
    assert.equal(player.messages[0], "You push on the doors...they're really shut..");
});

test('Open and Pick Lock from the north let you out to 442,3701', async () => {
    for (const hook of [doors.onGameObjectCommandOne, doors.onGameObjectCommandTwo]) {
        const player = fakePlayer({ y: 3703 });
        assert.equal(await hook(player, DOOR), true);
        assert.deepEqual([player.x, player.y], [442, 3701]);
        assert.deepEqual(player.replaced, [['gameObjects', 1160, 497, 3]]);
        assert.equal(player.experience.length, 0);
    }
});

test('Pick Lock needs thieving 50 and a lockpick', async () => {
    const low = fakePlayer({ thievingLevel: 49, lockpick: true });
    await doors.onGameObjectCommandTwo(low, DOOR);
    assert.deepEqual(low.messages, ['You need a thieving level of at least 50 to attempt this.']);

    const noPick = fakePlayer({ thievingLevel: 50 });
    await doors.onGameObjectCommandTwo(noPick, DOOR);
    assert.equal(noPick.messages[1], "you're unable to affect the lock without the proper tool..");
    assert.deepEqual([noPick.x, noPick.y], [441, 3700]);
});

test('a successful pick goes through for 100 thieving experience; a failed one does not', async () => {
    const lucky = fakePlayer({ thievingLevel: 50, lockpick: true });
    await withRandom(0, () => doors.onGameObjectCommandTwo(lucky, DOOR));
    assert.deepEqual([lucky.x, lucky.y], [441, 3703]);
    assert.deepEqual(lucky.experience, [['thieving', 100]]);
    assert.ok(lucky.said.includes('Easy as pie...'));

    const unlucky = fakePlayer({ thievingLevel: 50, lockpick: true });
    await withRandom(0.999, () => doors.onGameObjectCommandTwo(unlucky, DOOR));
    assert.deepEqual([unlucky.x, unlucky.y], [441, 3700]);
    assert.equal(unlucky.messages.at(-1), "...but you don't manage to pick the lock.");
});

test('other objects are not claimed', async () => {
    const other = { id: 5, x: 0, y: 0, definition: objects[5] };
    assert.equal(await doors.onGameObjectCommandTwo(fakePlayer(), other), false);
});

test('pickpocketing the civillian (732) is claimed with nothing interesting', async () => {
    const messages = [];
    const player = { message: (m) => messages.push(m) };
    assert.equal(await thieving.onNPCCommand(player, { id: 732 }), true);
    assert.deepEqual(messages, ['Nothing interesting happens']);
});
