// Drinks and the NPCs that sell or give them (Wave 4): items/quaffable.js (Open-RSC Drinkables.java), Stankers, the
// Brimhaven and Dragon Inn bartenders, Kaleb and Serevel in Shilo Village and Brother Galahad.

const test = require('node:test');
const assert = require('node:assert/strict');

const { fakePlayer, ids, item, npc, withRandom } = require('./wave4-fake');
const quaffable = require('../src/plugins/items/quaffable');
const stankers = require('../src/plugins/npcs/seers-village/stankers');
const brimhaven = require('../src/plugins/npcs/brimhaven/bartender');
const dragonInn = require('../src/plugins/npcs/yanille/bartender');
const kaleb = require('../src/plugins/npcs/shilo-village/kaleb');
const serevel = require('../src/plugins/npcs/shilo-village/serevel');
const galahad = require('../src/plugins/npcs/seers-village/brother-galahad');
const pluginIndex = require('../src/plugins');

const COINS = 10;
const BEER_GLASS = 620;
const BUCKET = 21;
const JUG = 140;

test('the new NPC plugins are registered', () => {
    assert.equal(pluginIndex['npcs.seers-village.stankers'], stankers);
    assert.equal(pluginIndex['npcs.brimhaven.bartender'], brimhaven);
    assert.equal(pluginIndex['npcs.yanille.bartender'], dragonInn);
    assert.equal(pluginIndex['npcs.shilo-village.kaleb'], kaleb);
    assert.equal(pluginIndex['npcs.shilo-village.serevel'], serevel);
    assert.equal(pluginIndex['npcs.seers-village.brother-galahad'], galahad);
});

test('drinking leaves the container: grog, dragon bitter and Greenmans ale a beer glass, chocolaty milk a bucket', async () => {
    for (const [drink, container] of [[598, BEER_GLASS], [829, BEER_GLASS], [830, BEER_GLASS], [770, BUCKET], [142, JUG]]) {
        const player = fakePlayer({ level: 40, inventory: [drink] });
        assert.equal(await withRandom([0.5], () => quaffable.onInventoryCommand(player, item(drink))), true, `${drink}`);
        assert.deepEqual(ids(player), [container], `${drink}`);
    }
});

test('grog: -6 attack, +3 strength, heals 3 (Drinkables.handleGrog)', async () => {
    const player = fakePlayer({ level: 40, inventory: [598] });
    player.skills.hits.current = 30;
    await quaffable.onInventoryCommand(player, item(598));
    assert.equal(player.skills.attack.current, 34);
    assert.equal(player.skills.strength.current, 43);
    assert.equal(player.skills.hits.current, 33);
    assert.match(player.messages.join('|'), /You drink the Grog/);
});

test('greenmans ale: -5% attack and defense, +1 herblaw', async () => {
    const player = fakePlayer({ level: 40, inventory: [830] });
    await quaffable.onInventoryCommand(player, item(830));
    assert.equal(player.skills.attack.current, 38);
    assert.equal(player.skills.defense.current, 38);
    assert.equal(player.skills.herblaw.current, 41);
});

test('poison chalice: each of the six outcomes, and no container', async () => {
    const outcomes = [
        [0 / 6, /tasted a bit dodgy/],
        [1 / 6, /heals some health/],
        [2 / 6, /a little strange/],
        [3 / 6, /a lot better/],
        [4 / 6, /really invigorated/],
        [5 / 6, /taste of apricot/]
    ];
    for (const [roll, message] of outcomes) {
        const player = fakePlayer({ level: 40, inventory: [737] });
        player.skills.hits.current = 20;
        await withRandom([roll + 0.01, 0.9], () => quaffable.onInventoryCommand(player, item(737)));
        assert.match(player.messages.join('|'), message);
        assert.deepEqual(ids(player), []);
    }
    const strong = fakePlayer({ level: 40, inventory: [737] });
    await withRandom([4 / 6 + 0.01], () => quaffable.onInventoryCommand(strong, item(737)));
    assert.equal(strong.skills.attack.current, 44);
});

test('only drinks it knows, and only with the drink command', async () => {
    const player = fakePlayer({ inventory: [221] });
    assert.equal(await quaffable.onInventoryCommand(player, item(221)), false); // a strength potion: items/potions.js
    assert.equal(await quaffable.onInventoryCommand(player, item(132)), false);
});

test('Stankers gives a poison chalice', async () => {
    const player = fakePlayer({ answers: [1, 0] });
    assert.equal(await stankers.onTalkToNPC(player, npc(389)), true);
    assert.deepEqual(ids(player), [737]);
    assert.match(player.messages.join('|'), /strangely coloured liquid/);
    assert.equal(await stankers.onTalkToNPC(player, npc(390)), false);
});

test('the Brimhaven bartender sells grog for 3 and rum for 27, and refuses without coins', async () => {
    const player = fakePlayer({ inventory: [[COINS, 30]], answers: [1, 2] });
    await brimhaven.onTalkToNPC(player, npc(279));
    await brimhaven.onTalkToNPC(player, npc(279));
    assert.deepEqual(ids(player), [598, 318]);
    const broke = fakePlayer({ answers: [1] });
    await brimhaven.onTalkToNPC(broke, npc(279));
    assert.deepEqual(ids(broke), []);
    assert.match(broke.said.join('|'), /enough money/);
});

test('the Brimhaven bartender signs the barcrawl card with supergrog', async () => {
    const player = fakePlayer({ level: 30, inventory: [668, [COINS, 15]], answers: [3], cache: { barcrawl: {} } });
    await brimhaven.onTalkToNPC(player, npc(279));
    assert.equal(player.asked[0].length, 4);
    assert.equal(player.cache.barcrawl.deadMansChest, true);
    assert.equal(player.skills.attack.current, 24);
    assert.equal(player.inventory.count(COINS), 0);
});

test('the Dragon Inn bartender sells dragon bitter (2) and Greenmans ale (10)', async () => {
    const player = fakePlayer({ inventory: [[COINS, 12]], answers: [1, 2] });
    await dragonInn.onTalkToNPC(player, npc(529));
    await dragonInn.onTalkToNPC(player, npc(529));
    assert.deepEqual(ids(player), [829, 830]);
});

test('Kaleb sells a Paramaya Rest ticket for 35 and a pack of 5 for 175', async () => {
    const player = fakePlayer({ inventory: [[COINS, 210]], answers: [3, 4] });
    await kaleb.onTalkToNPC(player, npc(621));
    await kaleb.onTalkToNPC(player, npc(621));
    assert.equal(player.inventory.count(987), 6);
    assert.equal(player.inventory.count(COINS), 0);
});

test('Serevel sells a Lady of the Waves ticket for 100', async () => {
    const player = fakePlayer({ inventory: [[COINS, 100]], answers: [0] });
    await serevel.onTalkToNPC(player, npc(623));
    assert.deepEqual(ids(player), [988]);
    const broke = fakePlayer({ answers: [0] });
    await serevel.onTalkToNPC(broke, npc(623));
    assert.deepEqual(ids(broke), []);
});

test('Brother Galahad: a cup of tea for anyone, the napkin only from Holy Grail stage 3', async () => {
    const visitor = fakePlayer({ answers: [0] });
    await galahad.onTalkToNPC(visitor, npc(403));
    assert.deepEqual(ids(visitor), [739]);
    assert.equal(visitor.asked[0].length, 2);

    const quester = fakePlayer({ quests: { theHolyGrail: 3 }, answers: [3] });
    await galahad.onTalkToNPC(quester, npc(403));
    assert.equal(quester.asked[0].length, 4);
    assert.deepEqual(ids(quester), [742]);

    const done = fakePlayer({ quests: { theHolyGrail: -1 } });
    await galahad.onTalkToNPC(done, npc(403));
    assert.deepEqual(ids(done), [739]);
    assert.deepEqual(done.asked, []);
});
