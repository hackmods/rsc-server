// West Ardougne's civilians (Open-RSC Civillians.java): a grown cat sells for 25 death runes, a kitten is turned down,
// and pickpocketing civilian 732 is the Java's "Nothing interesting happens".

const test = require('node:test');
const assert = require('node:assert/strict');

const plugins = require('../src/plugins');
const civilians = require('../src/plugins/npcs/ardougne/civilians');
const thieving = require('../src/plugins/skills/thieving');
const npcSpawns = require('@2003scape/rsc-data/locations/npcs');

const CAT = 1119;
const KITTEN = 1096;
const DEATH_RUNE = 38;

function makePlayer(bagIds = [], choices = []) {
    const bag = bagIds.map((id) => ({ id, amount: 1 }));
    const queue = [...choices];

    return {
        said: [],
        messages: [],
        skills: { thieving: { current: 99, base: 99 } },
        inventory: {
            items: bag,
            has(id, amount = 1) {
                return bag.filter((i) => i.id === id).reduce((n, i) => n + i.amount, 0) >= amount;
            },
            add(id, amount = 1) {
                bag.push({ id, amount });
            },
            remove(id) {
                bag.splice(bag.findIndex((i) => i.id === id), 1);
            }
        },
        engage() {},
        disengage() {},
        message(...lines) {
            this.messages.push(...lines);
        },
        async say(...lines) {
            this.said.push(...lines);
        },
        async ask(options) {
            const choice = queue.length ? queue.shift() : options.length - 1;
            this.said.push(options[choice]);
            return choice;
        }
    };
}

function makeNPC(id) {
    return { id, said: [], async say(...lines) { this.said.push(...lines); } };
}

test('listed in plugins/index.js and the three civilians are placed', () => {
    assert.ok(Object.values(plugins).includes(civilians));
    for (const id of [729, 731, 732]) assert.ok(npcSpawns.some((n) => n.id === id), `civilian ${id}`);
});

test('a cat sells for 25 death runes', async () => {
    const player = makePlayer([CAT], [0, 1]);
    const npc = makeNPC(732);

    assert.equal(await civilians.onTalkToNPC(player, npc), true);
    assert.ok(!player.inventory.has(CAT));
    assert.ok(player.inventory.has(DEATH_RUNE, 25));
    assert.ok(player.messages.includes('you are given 25 death runes'));
    assert.equal(npc.said.at(-1), 'great, thanks for that');
});

test('refusing the deal keeps the cat', async () => {
    const player = makePlayer([CAT], [0, 0]);
    const npc = makeNPC(729);

    await civilians.onTalkToNPC(player, npc);
    assert.ok(player.inventory.has(CAT));
    assert.ok(!player.inventory.has(DEATH_RUNE));
    assert.equal(npc.said.at(-1), "well, i'm not giving you anymore");
});

test('a kitten is too small', async () => {
    const player = makePlayer([KITTEN], [0]);
    const npc = makeNPC(731);

    await civilians.onTalkToNPC(player, npc);
    assert.ok(player.inventory.has(KITTEN));
    assert.deepEqual(npc.said.slice(-2), ["hah, that little thing won't catch any mice", 'i need a fully grown cat']);
});

test('no cat: the player agrees there are not many around; other npcs are not claimed', async () => {
    const player = makePlayer();

    await civilians.onTalkToNPC(player, makeNPC(729));
    assert.equal(player.said.at(-1), "no, you're right, you don't see many around");
    assert.equal(await civilians.onTalkToNPC(player, makeNPC(730)), false);
});

test('pickpocketing civilian 732 is the thieving plugin\'s: "Nothing interesting happens"', async () => {
    const player = makePlayer();

    assert.equal(civilians.onNPCCommand, undefined);
    assert.equal(await thieving.onNPCCommand(player, { id: 732, definition: { name: 'civillian' } }), true);
    assert.deepEqual(player.messages, ['Nothing interesting happens']);
});
