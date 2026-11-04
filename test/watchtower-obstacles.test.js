// Watchtower-area objects (Open-RSC WatchTowerObstacles.java, Mining.java 1026) and the island ladder row (997).

const test = require('node:test');
const assert = require('node:assert/strict');

const objects = require('@2003scape/rsc-data/config/objects');
const plugin = require('../src/plugins/game-objects/watchtower-obstacles');
const tele = require('../src/plugins/game-objects/object-tele-points');
const climbable = require('../src/plugins/game-objects/climbable');

function fakeNPC(id) {
    return {
        id,
        said: [],
        attacked: null,
        skills: { hits: { current: 10 } },
        async say(...lines) {
            this.said.push(...lines);
        },
        unlock() {},
        attack(player) {
            this.attacked = player;
        }
    };
}

function fakePlayer({ agility = 99, mining = 99, coins = 0, answers = [], stage, held = [] } = {}) {
    const timeouts = [];
    const inv = new Map([[10, coins], ...held.map((id) => [id, 1])]);
    const p = {
        x: 0,
        y: 0,
        messages: [],
        said: [],
        sounds: [],
        bubbles: [],
        experience: [],
        fatigue: 0,
        questStages: stage === undefined ? {} : { watchtower: stage },
        skills: { agility: { current: agility }, mining: { current: mining } },
        nearby: [],
        timeouts,
        world: {
            sleepTicks: async () => {},
            setTickTimeout: (fn) => timeouts.push(fn)
        },
        inventory: {
            has: (id, n = 1) => (inv.get(id) || 0) >= n,
            remove: (id, n = 1) => inv.set(id, inv.get(id) - n),
            add: (id) => inv.set(id, (inv.get(id) || 0) + 1),
            count: (id) => inv.get(id) || 0
        },
        getNearbyEntitiesByID(type, id) {
            return this.nearby.filter((n) => n.id === id);
        },
        async ask(options, repeat) {
            const choice = answers.shift();
            if (repeat) this.said.push(options[choice]);
            return choice;
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
        addExperience(skill, xp) {
            this.experience.push([skill, xp]);
        },
        isTired() {
            return this.fatigue >= 75000;
        },
        sendSound(s) {
            this.sounds.push(s);
        },
        sendBubble(id) {
            this.bubbles.push(id);
        }
    };
    return p;
}

const obj = (id, x, y) => ({ id, x, y, direction: 0, definition: objects[id] });
const ROCK_OVER = obj(995, 647, 802);
const ROCK_BACK = obj(996, 648, 799);

test('rock jump needs agility 30', async () => {
    const player = fakePlayer({ agility: 29 });
    assert.equal(await plugin.onGameObjectCommandOne(player, ROCK_OVER), true);
    assert.deepEqual(player.messages, ['You need agility level of 30 to attempt this jump']);
    assert.deepEqual([player.x, player.y], [0, 0]);
});

test('rock jump with no guard crosses for 50 agility experience', async () => {
    const player = fakePlayer({ agility: 30 });
    await plugin.onGameObjectCommandOne(player, ROCK_OVER);
    assert.deepEqual([player.x, player.y], [647, 799]);
    assert.deepEqual(player.experience, [['agility', 50]]);
    assert.deepEqual(player.messages, ['You daringly jump across the chasm']);
    assert.deepEqual(player.said, ['Phew! I just made it']);
});

test('the bridge ogre takes 20 coins for the jump', async () => {
    const guard = fakeNPC(697);
    const player = fakePlayer({ agility: 40, coins: 25, answers: [0] });
    player.nearby.push(guard);
    await plugin.onGameObjectCommandOne(player, ROCK_OVER);
    assert.equal(player.inventory.count(10), 5);
    assert.deepEqual([player.x, player.y], [647, 799]);
    assert.ok(guard.said.includes('You can pay me first - 20 gold pieces!'));
});

test('the bridge ogre turns away a player without the fee or who refuses', async () => {
    const guard = fakeNPC(697);
    const broke = fakePlayer({ agility: 40, coins: 19, answers: [0] });
    broke.nearby.push(guard);
    await plugin.onGameObjectCommandOne(broke, ROCK_OVER);
    assert.deepEqual([broke.x, broke.y], [0, 0]);
    assert.equal(broke.inventory.count(10), 19);

    const refuse = fakePlayer({ agility: 40, coins: 100, answers: [1] });
    refuse.nearby.push(fakeNPC(697));
    await plugin.onGameObjectCommandOne(refuse, ROCK_OVER);
    assert.deepEqual([refuse.x, refuse.y], [0, 0]);
    assert.deepEqual(refuse.messages, ['The guard blocks your path']);
});

test('a fatigued player does not jump', async () => {
    const player = fakePlayer({ agility: 40 });
    player.fatigue = 75000;
    await plugin.onGameObjectCommandOne(player, ROCK_OVER);
    assert.deepEqual(player.messages, ['You are too tired to attempt this jump']);
    assert.deepEqual([player.x, player.y], [0, 0]);
});

test('the way back is free and lands on 646,805', async () => {
    const player = fakePlayer({ agility: 30 });
    player.nearby.push(fakeNPC(697));
    await plugin.onGameObjectCommandOne(player, ROCK_BACK);
    assert.deepEqual([player.x, player.y], [646, 805]);
    assert.deepEqual(player.said, ["I'm glad that was easier on the way back!"]);
});

test('look at describes the collapsed bridge', async () => {
    const player = fakePlayer();
    assert.equal(await plugin.onGameObjectCommandTwo(player, ROCK_OVER), true);
    assert.deepEqual(player.messages, ['The bridge has collapsed', 'It seems this rock is placed here to jump from']);
});

test('ogre enclave: the guard attacks, no guard is nothing, after the quest it is blocked', async () => {
    const enclave = obj(955, 664, 788);
    const guard = fakeNPC(684);
    const player = fakePlayer();
    player.nearby.push(guard);
    assert.equal(await plugin.onGameObjectCommandOne(player, enclave), true);
    assert.deepEqual(guard.said, ["No you don't!"]);
    player.timeouts.forEach((fn) => fn());
    assert.equal(guard.attacked, player);

    const alone = fakePlayer();
    await plugin.onGameObjectCommandOne(alone, enclave);
    assert.deepEqual(alone.messages, ['Nothing interesting happens']);

    const done = fakePlayer({ stage: -1 });
    done.nearby.push(fakeNPC(684));
    await plugin.onGameObjectCommandOne(done, enclave);
    assert.deepEqual(done.messages, ['The ogres have blocked this entrance now']);
});

test('Yanille hole and the wrong counter', async () => {
    const player = fakePlayer();
    assert.equal(await plugin.onGameObjectCommandOne(player, obj(968, 607, 742)), true);
    assert.deepEqual(player.said, ["I can't get through this way", 'This hole must lead to somewhere...']);
    assert.equal(await plugin.onGameObjectCommandOne(player, obj(973, 650, 788)), true);
    assert.deepEqual(player.messages, ['You find nothing to steal']);
});

test('Rock of Dalgroth gives the crystal only at Watchtower stage 9', async () => {
    const rock = obj(1026, 646, 3615);
    const early = fakePlayer({ held: [156] });
    assert.equal(await plugin.onGameObjectCommandOne(early, rock), true);
    assert.equal(early.inventory.has(1154), false);
    assert.deepEqual(early.said, ["I can't touch it...", 'Perhaps it is linked with the shaman some way ?']);

    const noPick = fakePlayer({ stage: 9 });
    await plugin.onGameObjectCommandOne(noPick, rock);
    assert.deepEqual(noPick.messages, ['@que@You need a pickaxe to mine the rock']);

    const low = fakePlayer({ stage: 9, mining: 39, held: [156] });
    await plugin.onGameObjectCommandOne(low, rock);
    assert.deepEqual(low.messages, ['@que@You need a mining level of 40 to mine this crystal out']);

    const ok = fakePlayer({ stage: 9, mining: 40, held: [1262] });
    await plugin.onGameObjectCommandOne(ok, rock);
    assert.equal(ok.inventory.has(1154), true);
    assert.deepEqual(ok.bubbles, [156]);

    await plugin.onGameObjectCommandOne(ok, rock);
    assert.deepEqual(ok.said, ['I already have this crystal', 'There is no benefit to getting another']);

    const prospector = fakePlayer();
    assert.equal(await plugin.onGameObjectCommandTwo(prospector, rock), true);
    assert.deepEqual(prospector.messages, ['@que@You examine the rock for ores...', '@que@This rock contains a crystal!']);
});

test('other objects are not claimed', async () => {
    const player = fakePlayer();
    assert.equal(await plugin.onGameObjectCommandOne(player, obj(5, 0, 0)), false);
});

test('island ladder 997 climbs down to 669,826 and climbable leaves it alone', async () => {
    const ladder = obj(997, 604, 803);
    const player = fakePlayer();
    assert.equal(await climbable.onGameObjectCommandOne(player, ladder), false);
    assert.equal(await tele.onGameObjectCommandOne(player, ladder), true);
    assert.deepEqual([player.x, player.y], [669, 826]);
    assert.deepEqual(player.messages, ['You climb down the ladder']);
});
