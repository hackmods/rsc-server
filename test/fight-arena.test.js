// quests/members/fight-arena.js (Open-RSC FightArena.java), npcs/khazard/khazard-bartender.js and the arena lobby
// door in wall-objects/level-doors.js: every stage transition, driven by fakes.

const test = require('node:test');
const assert = require('node:assert/strict');

const arena = require('../src/plugins/quests/members/fight-arena');
const bartender = require('../src/plugins/npcs/khazard/khazard-bartender');
const levelDoors = require('../src/plugins/wall-objects/level-doors');
const { fakeNpc, fakeWorld, fakePlayer, gameObject, wallObject } = require('./quest-fakes-3a');

const COINS = 10;
const BEER = 193;
const KHAZARD_HELMET = 733;
const KHAZARD_CHAINMAIL = 734;
const KHALI_BREW = 735;
const CELL_KEYS = 736;

const LADY_SERVIL = 372;
const PRISON_GUARD = 373;
const BRIBABLE_GUARD = 374;
const JEREMY = 377;
const JUSTIN = 378;
const JOE = 379;
const KELVIN = 380;
const LOCAL = 381;
const BARTENDER = 382;
const GENERAL = 383;
const OGRE = 384;
const ARENA_GUARD = 385;
const SCORPION = 386;
const HENGRAD = 387;
const BOUNCER = 388;

const ARMOUR = [KHAZARD_HELMET, KHAZARD_CHAINMAIL];

function player(opts = {}) {
    return fakePlayer({ quest: 'fightArena', ...opts });
}

// run the kill hook, then the follow-up it schedules one tick later
async function kill(p, npc) {
    assert.equal(await arena.onNPCDeath(p, npc), false, 'the default death (drops, removal, kill xp) still runs');
    const pending = p.world.timeouts.length;
    p.world.runTimeouts();
    // the scheduled follow-up runs asynchronously: let it finish
    for (let i = 0; i < 50; i += 1) await new Promise((r) => setImmediate(r));
    return pending;
}

test('Lady Servil starts the quest: stage 0 -> 1', async () => {
    const no = player({ answers: [0] });
    const servil = fakeNpc(LADY_SERVIL);
    assert.equal(await arena.onTalkToNPC(no, servil), true);
    assert.deepEqual(servil.said.slice(-1), [' sob..sob']);
    assert.equal(no.questStages.fightArena, 0);

    const p = player({ answers: [1] });
    await arena.onTalkToNPC(p, fakeNpc(LADY_SERVIL));
    assert.equal(p.questStages.fightArena, 1);
    assert.deepEqual(p.said.slice(-1), ["I'll try my best to return your family"]);
    assert.equal(p.interlocutor, null);
});

test('the guards cupboard: open, search for the armour from stage 1, close', async () => {
    const p = player({ stage: 0 });
    assert.equal(await arena.onGameObjectCommandOne(p, gameObject(381, 607, 683)), true);
    assert.deepEqual(p.world.replaced, [[381, 382]]);
    assert.deepEqual(p.messages, ['You open the cupboard']);

    const open = gameObject(382, 607, 683);
    p.messages.length = 0;
    await arena.onGameObjectCommandOne(p, open);
    assert.deepEqual(p.messages, ['You search the cupboard, but find nothing'], 'not before the quest');

    const started = player({ stage: 1 });
    await arena.onGameObjectCommandOne(started, open);
    assert.deepEqual(started.messages, ['You search the cupboard...', 'You find a khazard helmet', 'You find a khazard chainmail']);
    assert.ok(started.inventory.has(KHAZARD_HELMET) && started.inventory.has(KHAZARD_CHAINMAIL));
    started.messages.length = 0;
    await arena.onGameObjectCommandOne(started, gameObject(382, 600, 1623));
    assert.deepEqual(started.messages, ['You search the cupboard, but find nothing']);

    const done = player({ stage: -1 });
    await arena.onGameObjectCommandOne(done, open);
    assert.deepEqual(done.messages, ['You search the cupboard, but find nothing'], 'Java: stage >= 1, so not after the quest');

    assert.equal(await arena.onGameObjectCommandTwo(p, open), true);
    assert.deepEqual(p.world.replaced.at(-1), [382, 381]);
    assert.equal(await arena.onGameObjectCommandOne(p, gameObject(382, 1, 1)), false);
});

test('the bartender: a free khali brew, a beer for a coin', async () => {
    const p = player({ items: [[COINS, 5]], answers: [1] });
    const npc = fakeNpc(BARTENDER);
    assert.equal(await bartender.onTalkToNPC(p, npc), true);
    assert.ok(p.inventory.has(KHALI_BREW));
    assert.deepEqual(npc.said.slice(-2), ['There you go', 'No charge']);

    const beer = player({ items: [[COINS, 5]], answers: [0] });
    await bartender.onTalkToNPC(beer, fakeNpc(BARTENDER));
    assert.ok(beer.inventory.has(BEER));
    assert.equal(beer.inventory.count(COINS), 4);
    assert.equal(await bartender.onTalkToNPC(beer, fakeNpc(1)), false);
});

test('Jeremy speaks from his cell: stage 1 -> 2', async () => {
    const jeremy = fakeNpc(JEREMY, { x: 605, y: 716 });
    const p = player({ stage: 1, world: fakeWorld({ npcs: [jeremy] }) });
    const gate = gameObject(371, 604, 716);
    assert.equal(await arena.onGameObjectCommandOne(p, gate), true);
    assert.equal(p.questStages.fightArena, 2);
    assert.deepEqual(jeremy.said.slice(-1), ['The guard keeps them.. always']);

    // nobody behind the bars: the gate is still claimed, nothing happens
    const empty = player({ stage: 1 });
    assert.equal(await arena.onGameObjectCommandOne(empty, gate), true);
    assert.equal(empty.questStages.fightArena, 1);

    const keys = player({ stage: 2 });
    assert.equal(await arena.onUseWithGameObject(keys, gate, { id: CELL_KEYS }), true);
    assert.deepEqual(keys.messages, ['To unlock the gate, left click on it']);
    assert.equal(await arena.onUseWithGameObject(keys, gameObject(371, 621, 700), { id: CELL_KEYS }), false);
});

test('the bribable guard drinks the khali brew and hands over the cell keys', async () => {
    const plain = player({ stage: 2 });
    const guard = fakeNpc(BRIBABLE_GUARD);
    await arena.onTalkToNPC(plain, guard);
    assert.deepEqual(guard.said.slice(-1), ["selfish.. the lot of 'em"]);
    assert.equal('guard_sleeping' in plain.cache, false);

    const p = player({ stage: 2, items: [KHALI_BREW] });
    await arena.onTalkToNPC(p, fakeNpc(BRIBABLE_GUARD));
    assert.equal(p.cache.guard_sleeping, true);
    assert.ok(p.inventory.has(CELL_KEYS));
    assert.equal(p.inventory.has(KHALI_BREW), false);
    assert.equal(p.messages.at(-1), 'the guard is asleep');

    // lost the keys: another set
    const lost = player({ stage: 2, cache: { guard_sleeping: true } });
    await arena.onTalkToNPC(lost, fakeNpc(BRIBABLE_GUARD));
    assert.ok(lost.inventory.has(CELL_KEYS));
    const resting = fakeNpc(BRIBABLE_GUARD);
    await arena.onTalkToNPC(lost, resting);
    assert.deepEqual(resting.said, ['please, let me rest']);

    const before = fakeNpc(BRIBABLE_GUARD);
    await arena.onTalkToNPC(player({ stage: 1 }), before);
    assert.equal(before.said.at(-1), "mind you, too much khali brew and i'll fall asleep");

    const after = player({ stage: 3 });
    await arena.onTalkToNPC(after, fakeNpc(BRIBABLE_GUARD));
    assert.deepEqual(after.teleports, [[621, 698]]);
    const disguised = player({ stage: -1, items: ARMOUR, equipped: ARMOUR });
    await arena.onTalkToNPC(disguised, fakeNpc(BRIBABLE_GUARD));
    assert.deepEqual(disguised.teleports, []);
});

test('the cell keys free Jeremy (cache freed_servil) and the prison guard gives chase', async () => {
    const jeremy = fakeNpc(JEREMY, { x: 605, y: 716 });
    const guard = fakeNpc(PRISON_GUARD, { x: 604, y: 717 });
    const world = fakeWorld({ npcs: [jeremy, guard] });
    const p = player({ world, stage: 2, items: [CELL_KEYS], cache: { guard_sleeping: true } });
    const gate = gameObject(371, 604, 716);
    await arena.onGameObjectCommandOne(p, gate);
    assert.equal(p.cache.freed_servil, true);
    assert.equal('guard_sleeping' in p.cache, false);
    assert.deepEqual(world.timed, [[371, 181, 5]]);
    assert.deepEqual(p.sounds, ['opendoor']);
    assert.ok(world.removed.includes(jeremy), 'Jeremy runs ahead');
    assert.deepEqual(guard.said, ['What are you doing?', "It's an imposter!"]);
    assert.deepEqual(guard.attacked, [p]);
    assert.equal(p.questStages.fightArena, 2);

    p.messages.length = 0;
    await arena.onGameObjectCommandOne(p, gate);
    assert.deepEqual(p.messages, ['You have already freed jeremy']);
});

test('the arena lobby doors need Jeremy freed (or stage 3 / done)', async () => {
    const door = wallObject(114, 615, 715);
    const arenaGuard = fakeNpc(ARENA_GUARD, { x: 616, y: 713 });
    const blocked = player({ stage: 2, world: fakeWorld({ npcs: [arenaGuard] }) });
    assert.equal(await levelDoors.onWallObjectCommandOne(blocked, door), true);
    assert.deepEqual(blocked.doors, []);
    assert.deepEqual(arenaGuard.said, ["and where do you think you're going?", 'only General Khazard decides who fights in the arena', 'so get out of here']);

    for (const [stage, cache] of [[2, { freed_servil: true }], [3, {}], [-1, {}]]) {
        const p = player({ stage, cache });
        assert.equal(await levelDoors.onWallObjectCommandOne(p, door), true);
        assert.deepEqual(p.doors, [[114, undefined]], `stage ${stage}`);
    }
});

test('Lady Servil while you work: freed son or not', async () => {
    const servil = fakeNpc(LADY_SERVIL);
    await arena.onTalkToNPC(player({ stage: 2 }), servil);
    assert.deepEqual(servil.said, ['Brave traveller, please..bring back my family']);
    const freed = fakeNpc(LADY_SERVIL);
    await arena.onTalkToNPC(player({ stage: 2, cache: { freed_servil: true } }), freed);
    assert.deepEqual(freed.said, ["oh no, they won't stand a chance", 'please go back and help']);
});

test('Jeremy in the arena: the ogre attacks; its death brings the general and the jail (killed_ogre)', async () => {
    const world = fakeWorld({ npcs: [fakeNpc(JUSTIN, { x: 613, y: 707 })] });
    const p = player({ world, stage: 2, cache: { freed_servil: true } });

    const notYet = player({ stage: 2 });
    assert.equal(await arena.onTalkToNPC(notYet, fakeNpc(JEREMY)), true);
    assert.deepEqual(notYet.said, []);

    await arena.onTalkToNPC(p, fakeNpc(JEREMY, { x: 613, y: 709 }));
    assert.deepEqual(world.spawned.map((s) => [s.id, s.x, s.y]), [[OGRE, 611, 706]]);
    const ogre = world.npcList.find((n) => n.id === OGRE);
    assert.deepEqual(ogre.attacked, [p]);
    assert.equal(p.interlocutor, null);

    p.messages.length = 0;
    await kill(p, ogre);
    assert.equal(p.cache.killed_ogre, true);
    assert.deepEqual(p.messages.slice(0, 2), ['You kill the ogre', "Jeremy's father survives"]);
    assert.ok(world.npcList.find((n) => n.id === JUSTIN).said.includes("You saved my life and my son's"));
    const general = world.removed.find((n) => n.id === GENERAL);
    assert.ok(general, 'the general appears and leaves');
    assert.equal(general.said.at(-1), 'Guards! take him away!');
    assert.deepEqual(p.teleports, [[609, 715]]);
    assert.equal(p.messages.at(-1), "Khazard's men have locked you in a cell");

    const done = player({ stage: 3 });
    await arena.onTalkToNPC(done, fakeNpc(JEREMY));
    assert.deepEqual(done.messages, ['You need to kill the creatures in the arena']);
});

test('Hengrad sends you to the arena; scorpion, then bouncer: stage 2 -> 3', async () => {
    const world = fakeWorld();
    const p = player({ world, stage: 2, cache: { freed_servil: true, killed_ogre: true } });

    const early = player({ stage: 2 });
    assert.equal(await arena.onTalkToNPC(early, fakeNpc(HENGRAD)), true);
    assert.deepEqual(early.teleports, []);

    await arena.onTalkToNPC(p, fakeNpc(HENGRAD, { x: 609, y: 715 }));
    assert.deepEqual(p.teleports, [[609, 705]]);
    const scorpion = world.npcList.find((n) => n.id === SCORPION);
    assert.deepEqual([scorpion.x, scorpion.y], [609, 707]);
    assert.deepEqual(scorpion.attacked, [p]);

    await kill(p, scorpion);
    assert.ok(p.messages.includes('You defeat the scorpion'));
    assert.equal(p.messages.at(-1), 'between the Outsider and bouncer');
    assert.ok(world.removed.some((n) => n.id === GENERAL && n.said.includes('Guards, guards bring on bouncer')));
    const bouncer = world.npcList.find((n) => n.id === BOUNCER);
    assert.deepEqual([bouncer.x, bouncer.y], [612, 708]);
    assert.deepEqual(bouncer.attacked, [p]);
    assert.equal(p.questStages.fightArena, 2);

    await kill(p, bouncer);
    assert.equal(p.questStages.fightArena, 3);
    assert.equal(p.messages.at(-1), 'Go back to lady servil to claim your reward');
    const general = world.npcList.find((n) => n.id === GENERAL);
    assert.deepEqual(general.attacked, [p], 'the general gives chase');

    // a bouncer killed outside stage 2 does nothing
    const other = player({ stage: 3 });
    assert.equal(await kill(other, fakeNpc(BOUNCER)), 0);
    assert.deepEqual(other.messages, []);
});

test('killing General Khazard: he shall return', async () => {
    const p = player({ stage: 3 });
    assert.equal(await arena.onNPCDeath(p, fakeNpc(GENERAL)), false);
    assert.deepEqual(p.messages, ['You kill general khazard', 'but he shall return']);
    assert.equal(await arena.onNPCDeath(undefined, fakeNpc(OGRE)), false);
    assert.equal(await arena.onNPCDeath(p, fakeNpc(1)), false);
    assert.equal(p.world.timeouts.length, 0);
});

test('Lady Servil rewards you: stage 3 -> -1, 1000 coins, 2 QP, attack and thieving xp', async () => {
    const p = player({ stage: 3, cache: { freed_servil: true, killed_ogre: true }, levels: { attack: 40, thieving: 30 } });
    await arena.onTalkToNPC(p, fakeNpc(LADY_SERVIL));
    assert.equal(p.questStages.fightArena, -1);
    assert.deepEqual(p.messages, ['you have completed the fight arena quest', 'Lady Servil gives you 1000 gold coins', 'you gain two quest points']);
    assert.equal(p.inventory.count(COINS), 1000);
    assert.deepEqual(p.completed, [['fightArena', { questPoints: 2, experience: { attack: 700 + 40 * 800, thieving: 700 + 30 * 800 } }]]);
    assert.deepEqual(p.cache, {});

    const servil = fakeNpc(LADY_SERVIL);
    await arena.onTalkToNPC(p, servil);
    assert.deepEqual(servil.said.slice(-1), ['thanks again for everything']);
});

test('the guards, the general, the locals and the fight slaves', async () => {
    const general = fakeNpc(GENERAL);
    const p = player({ stage: 1 });
    await arena.onTalkToNPC(p, general);
    assert.deepEqual(general.said.slice(-1), ['face your doom!']);
    assert.deepEqual(general.attacked, [p]);

    const thrownOut = player({ stage: 2 });
    await arena.onTalkToNPC(thrownOut, fakeNpc(PRISON_GUARD));
    assert.deepEqual(thrownOut.teleports, [[602, 717]]);
    const newbie = fakeNpc(PRISON_GUARD);
    await arena.onTalkToNPC(player(), newbie);
    assert.equal(newbie.said.at(-1), 'you got that, newbie?');

    const stages = new Map([[0, 'should be entertaining'], [1, "you won't be visiting anyone"], [2, 'should be very entertaining'], [3, "i can't wait"]]);
    for (const [stage, last] of stages) {
        const local = fakeNpc(LOCAL);
        await arena.onTalkToNPC(player({ stage }), local);
        assert.equal(local.said.at(-1), last, `stage ${stage}`);
    }

    const joe = fakeNpc(JOE);
    const kelvin = fakeNpc(KELVIN);
    const visitor = player({ world: fakeWorld({ npcs: [joe, kelvin] }), items: ARMOUR, equipped: ARMOUR });
    assert.equal(await arena.onGameObjectCommandOne(visitor, gameObject(371, 621, 700)), true);
    assert.deepEqual(visitor.said, ['are you ok?', 'hello there']);
    assert.deepEqual(joe.said, ['spare me your fake pity', "I spit on Khazard's grave and all who do his bidding"]);
    assert.equal(kelvin.said.at(-1), "and i'll have all your heads!");

    assert.equal(await arena.onTalkToNPC(p, fakeNpc(BARTENDER)), false);
});
