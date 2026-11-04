// quests/members/tribal-totem.js (Open-RSC TribalTotem.java): every stage transition, driven by fakes.

const test = require('node:test');
const assert = require('node:assert/strict');

const totem = require('../src/plugins/quests/members/tribal-totem');
const climbable = require('../src/plugins/game-objects/climbable');
const { fakeNpc, fakeWorld, fakePlayer, gameObject, wallObject } = require('./quest-fakes-3a');

const KANGAI_MAU = 332;
const CROMPERTY = 333;
const RPDT_EMPLOYEE = 334;
const HORACIO = 335;
const ADDRESS_LABEL = 704;
const TRIBAL_TOTEM = 705;
const SWORDFISH = 370;

function player(opts = {}) {
    return fakePlayer({ quest: 'tribalTotem', ...opts });
}

test('Kangai Mau starts the quest (adventure path) and stage 0 talk passes nothing else', async () => {
    const p = player({ answers: [1, 0] });
    const npc = fakeNpc(KANGAI_MAU);
    assert.equal(await totem.onTalkToNPC(p, npc), true);
    assert.equal(p.questStages.tribalTotem, 1);
    assert.ok(npc.said.includes('Adventure is something I may be able to give'));
    assert.deepEqual(p.said, ["I'm in search of adventure", 'Ok I will get it back']);
    assert.equal(p.interlocutor, null);
});

test('Kangai Mau: the Brimhaven path, then why does he have it, then yes', async () => {
    const p = player({ answers: [0, 0, 1, 0] });
    await totem.onTalkToNPC(p, fakeNpc(KANGAI_MAU));
    assert.equal(p.questStages.tribalTotem, 1);
    assert.ok(p.said.includes('I may be able to help'));
    assert.ok(p.said.includes('Why does he have it?'));
});

test('Kangai Mau: asking the way or about the tribe does not start it', async () => {
    const lost = player({ answers: [1, 2] });
    const npc = fakeNpc(KANGAI_MAU);
    await totem.onTalkToNPC(lost, npc);
    assert.equal(lost.questStages.tribalTotem, 0);
    assert.deepEqual(npc.said.slice(-1), ["I don't know Ardougne"]);
    const tribe = player({ answers: [2] });
    await totem.onTalkToNPC(tribe, fakeNpc(KANGAI_MAU));
    assert.equal(tribe.questStages.tribalTotem, 0);
});

test('the empty crates and the Handelmort crate label', async () => {
    const p = player({ stage: 1 });
    assert.equal(await totem.onGameObjectCommandTwo(p, gameObject(290, 557, 615)), true);
    assert.deepEqual(p.messages, ['The crate is empty']);
    // another crate 290 elsewhere is not ours
    assert.equal(await totem.onGameObjectCommandTwo(p, gameObject(290, 599, 468)), false);

    p.messages.length = 0;
    assert.equal(await totem.onGameObjectCommandTwo(p, gameObject(329, 559, 617)), true);
    assert.deepEqual(p.messages, ['There is a label on this crate', 'It says', 'to Lord Handelmort', 'Handelmort Mansion', 'Ardougne', 'You take the label']);
    assert.ok(p.inventory.has(ADDRESS_LABEL));

    p.messages.length = 0;
    await totem.onGameObjectCommandTwo(p, gameObject(329, 559, 617));
    assert.equal(p.messages.at(-1), "It doesn't seem possible to open the crate");
    assert.equal(p.inventory.count(ADDRESS_LABEL), 1);
});

test('the label goes on the wizards tower crate (cache "label")', async () => {
    const p = player({ stage: 1, items: [ADDRESS_LABEL] });
    const crate = gameObject(328, 558, 617);
    p.messages.length = 0;
    await totem.onGameObjectCommandTwo(p, crate);
    assert.deepEqual(p.messages, ['Its ready to be delivered', "To the wizard's tower in Misthalin", "It doesn't seem possible to open the crate"]);

    assert.equal(await totem.onUseWithGameObject(p, crate, { id: 1 }), false);
    assert.equal(await totem.onUseWithGameObject(p, crate, { id: ADDRESS_LABEL }), true);
    assert.equal(p.cache.label, true);
    assert.equal(p.inventory.has(ADDRESS_LABEL), false);
    assert.deepEqual(p.said, ['Now I just need someone to deliver it for me']);

    p.messages.length = 0;
    await totem.onGameObjectCommandTwo(p, crate);
    assert.equal(p.messages[2], 'to Lord Handelmort');

    const done = player({ stage: -1, items: [ADDRESS_LABEL] });
    await totem.onUseWithGameObject(done, crate, { id: ADDRESS_LABEL });
    assert.deepEqual(done.messages, ["You've already done this!"]);
    assert.ok(done.inventory.has(ADDRESS_LABEL));
});

test('RPDT employee delivers the relabelled crate: stage 1 -> 2', async () => {
    const world = fakeWorld();
    const crate = gameObject(328, 558, 617);
    world.addEntity('gameObjects', crate);
    const p = player({ world, stage: 1, cache: { label: true }, answers: [0] });
    const npc = fakeNpc(RPDT_EMPLOYEE, { x: 559, y: 615 });
    assert.equal(await totem.onTalkToNPC(p, npc), true);
    assert.equal(p.questStages.tribalTotem, 2);
    assert.equal('label' in p.cache, false);
    assert.deepEqual(p.messages, ['The employee picks up the crate', 'And takes it out to be delivered']);
    assert.deepEqual([npc.x, npc.y], [559, 612]);
    assert.equal(world.gameObjects.getAtPoint(558, 617).length, 0, 'the crate is gone');
    assert.equal(world.timeouts.length, 1);
    world.runTimeouts();
    assert.equal(world.gameObjects.getAtPoint(558, 617)[0].id, 328, 'and comes back');

    // no label (or not stage 1): only the greeting
    const plain = player({ stage: 1 });
    await totem.onTalkToNPC(plain, fakeNpc(RPDT_EMPLOYEE));
    assert.deepEqual(plain.said, ['Thank you very much']);
    assert.equal(plain.questStages.tribalTotem, 1);
});

test('Wizard Cromperty teleports to the depot before delivery, into the mansion after', async () => {
    const before = player({ stage: 1, answers: [1, 1, 0] });
    assert.equal(await totem.onTalkToNPC(before, fakeNpc(CROMPERTY)), true);
    assert.deepEqual(before.teleports, [[545, 577], [558, 617]]);
    assert.deepEqual(before.messages, ['Cromperty takes out a small box', 'Cromperty presses a switch on the box']);

    const after = player({ stage: 2, answers: [0, 0, 0, 0, 0] });
    await totem.onTalkToNPC(after, fakeNpc(CROMPERTY));
    assert.deepEqual(after.teleports, [[545, 577], [560, 588]]);

    const done = player({ stage: -1, answers: [1, 1, 0] });
    await totem.onTalkToNPC(done, fakeNpc(CROMPERTY));
    assert.deepEqual(done.teleports.at(-1), [560, 588]);

    const stay = player({ stage: 1, answers: [1, 1, 1] });
    await totem.onTalkToNPC(stay, fakeNpc(CROMPERTY));
    assert.deepEqual(stay.teleports, []);
});

test('Horacio gives the middle-name hint only once the quest is started', async () => {
    const started = player({ stage: 1, answers: [1, 0] });
    const npc = fakeNpc(HORACIO);
    await totem.onTalkToNPC(started, npc);
    assert.ok(npc.said.includes("It's rather easy, it's his middle name"));

    const fresh = player({ answers: [1] });
    const other = fakeNpc(HORACIO);
    await totem.onTalkToNPC(fresh, other);
    assert.equal(fresh.asked.length, 1);
    assert.equal(other.said.includes("It's rather easy, it's his middle name"), false);
});

test('combination door: B R A D opens it, anything else fails, and dials never carry over', async () => {
    const door = wallObject(98, 561, 586);
    const right = player({ stage: 2, answers: [1, 0, 0, 3] });
    assert.equal(await totem.onWallObjectCommandOne(right, door), true);
    assert.deepEqual(right.doors, [[98, undefined]]);
    assert.deepEqual(right.messages.slice(-2), ['You here a satisfying click', 'You go through the door']);
    assert.deepEqual(right.said, ['position B', 'position R', 'postition A', 'Position D']);

    // the Java's instance fields would keep dials 1-3 from the first try; per attempt here
    const p = player({ stage: 2, answers: [1, 0, 0, 2, 0, 1, 1, 3] });
    await totem.onWallObjectCommandOne(p, door);
    await totem.onWallObjectCommandOne(p, door);
    assert.deepEqual(p.doors, []);
    assert.equal(p.messages.filter((m) => m === 'The door fails to open').length, 2);

    assert.equal(await totem.onWallObjectCommandOne(p, wallObject(98, 1, 1)), false);
});

test('the trapped stairs: search with thieving 21 marks the trap, otherwise you fall', async () => {
    const stairs = gameObject(331, 563, 587);
    assert.equal(await climbable.onGameObjectCommandOne(player(), stairs), false, 'climbable leaves the stairs alone');

    const clumsy = player({ stage: 2, levels: { thieving: 20 } });
    assert.equal(await totem.onGameObjectCommandTwo(clumsy, stairs), true);
    assert.deepEqual(clumsy.messages, ["You don't find anything interesting"]);
    assert.equal('trapy' in clumsy.cache, false);

    assert.equal(await totem.onGameObjectCommandOne(clumsy, stairs), true);
    assert.deepEqual(clumsy.teleports, [[563, 3418]]);
    assert.deepEqual(clumsy.damaged, [7]);

    const thief = player({ stage: 2, levels: { thieving: 21 } });
    await totem.onGameObjectCommandTwo(thief, stairs);
    assert.equal(thief.cache.trapy, true);
    thief.messages.length = 0;
    await totem.onGameObjectCommandOne(thief, stairs);
    assert.deepEqual(thief.messages, ['You go up the stairs']);
    assert.deepEqual(thief.teleports, [[563, 1534]]);
    assert.deepEqual(thief.damaged, []);
    assert.equal('trapy' in thief.cache, false, 'one use');
});

test('the Handelmort chest: open, search for the totem, close', async () => {
    const p = player({ stage: 2 });
    assert.equal(await totem.onGameObjectCommandOne(p, gameObject(333, 560, 1531)), true);
    assert.deepEqual(p.world.replaced, [[333, 332]]);
    assert.deepEqual(p.messages, ['You open the chest']);

    const open = gameObject(332, 560, 1531);
    p.messages.length = 0;
    await totem.onGameObjectCommandOne(p, open);
    assert.deepEqual(p.messages, ['You search the chest', 'You find a tribal totem which you take']);
    assert.ok(p.inventory.has(TRIBAL_TOTEM));
    p.messages.length = 0;
    await totem.onGameObjectCommandOne(p, open);
    assert.deepEqual(p.messages, ['You search the chest', 'The chest is empty']);
    assert.equal(p.inventory.count(TRIBAL_TOTEM), 1);

    assert.equal(await totem.onGameObjectCommandTwo(p, open), true);
    assert.deepEqual(p.world.replaced.at(-1), [332, 333]);
});

test('Kangai Mau takes the totem: stage 2 -> -1, thieving 800 + 300/level, 5 swordfish', async () => {
    const without = player({ stage: 2 });
    const npc = fakeNpc(KANGAI_MAU);
    await totem.onTalkToNPC(without, npc);
    assert.deepEqual(npc.said.slice(-1), ['Bah, you no good']);
    assert.equal(without.questStages.tribalTotem, 2);

    const p = player({ stage: 2, items: [TRIBAL_TOTEM], levels: { thieving: 25 } });
    await totem.onTalkToNPC(p, fakeNpc(KANGAI_MAU));
    assert.equal(p.questStages.tribalTotem, -1);
    assert.deepEqual(p.completed, [
        ['tribalTotem', { questPoints: 1, experience: { thieving: 800 + 25 * 300 }, message: 'Well done you have completed the tribal totem quest' }]
    ]);
    assert.equal(p.inventory.has(TRIBAL_TOTEM), false);
    assert.equal(p.inventory.count(SWORDFISH), 5);

    const after = fakeNpc(KANGAI_MAU);
    await totem.onTalkToNPC(p, after);
    assert.deepEqual(after.said, ['greetings esteemed thief']);
});

test('other NPCs and objects are not claimed', async () => {
    const p = player();
    assert.equal(await totem.onTalkToNPC(p, fakeNpc(1)), false);
    assert.equal(await totem.onGameObjectCommandOne(p, gameObject(332, 1, 1)), false);
    assert.equal(await totem.onGameObjectCommandTwo(p, gameObject(328, 560, 588)), false);
});
