// Shopkeepers ported from Open-RSC (server gap audit, brief 8): talking along `path` (the menu choices) opens the shop,
// declining still claims the talk, and other NPCs are left alone. Each file names its Open-RSC source.

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const plugins = require('../src/plugins');
const shops = require('@2003scape/rsc-data/shops');
const npcs = require('@2003scape/rsc-data/config/npcs');
const npcLocations = require('@2003scape/rsc-data/locations/npcs');

const SHOPKEEPERS = [
    { key: 'shantay-pass', file: 'al-kharid/shantay.js', npcIds: [549], path: [1] },
    { key: 'east-ardougne-adventurers', file: 'ardougne/ardougne-general-shop.js', npcIds: [336, 337], path: [0] },
    { key: 'bakers-stall', file: 'ardougne/baker.js', npcIds: [325], path: [0] },
    { key: 'west-ardougne-general', file: 'ardougne/chadwell.js', npcIds: [661], path: [1] },
    { key: 'fur-stall', file: 'ardougne/fur-trader.js', npcIds: [327], path: [0] },
    { key: 'gems-stall', file: 'ardougne/gem-merchant.js', npcIds: [330], path: [0] },
    { key: 'king-lathas-weaponry', file: 'ardougne/king-lathas-keeper.js', npcIds: [528], path: [0] },
    { key: 'silver-stall', file: 'ardougne/silver-merchant.js', npcIds: [328], path: [0] },
    { key: 'spices-stall', file: 'ardougne/spice-merchant.js', npcIds: [329], path: [0] },
    { key: 'zeneshas-plate-mail', file: 'ardougne/zenesha.js', npcIds: [331], path: [1] },
    { key: 'the-shrimp-and-parrot', file: 'brimhaven/alfonse-the-waiter.js', npcIds: [260], path: [0] },
    { key: 'davons-amulet', file: 'brimhaven/davon-shop.js', npcIds: [278], path: [0] },
    { key: 'arheins-general', file: 'catherby/arhein-general-shop.js', npcIds: [280], path: [0] },
    { key: 'candle', file: 'catherby/candle-maker-shop.js', npcIds: [282], path: [0] },
    { key: 'harrys-fishing-shack', file: 'catherby/harrys-fishing-shack.js', npcIds: [250], path: [0] },
    { key: 'hicktons-archery', file: 'catherby/hickton-archery-shop.js', npcIds: [289], path: [0] },
    { key: 'entrana-herblaw', file: 'entrana/frincos-vial-shop.js', npcIds: [297], path: [0] },
    { key: 'gruds-herblaw-stall', file: 'gu-tanoth/gruds-herblaw-stall.js', npcIds: [686], path: [0] },
    { key: 'ogre-trader-general', file: 'gu-tanoth/ogre-trader.js', npcIds: [687], path: [0] },
    { key: 'fishing-guild', file: 'hemenster/fishing-guild-shop.js', npcIds: [371], path: [0] },
    { key: 'fishing-trawler-general', file: 'khazard/fishing-trawler-general-store.js', npcIds: [391], path: [0] },
    { key: 'legends-guild-general', file: 'legends-guild/fionella.js', npcIds: [788], path: [0] },
    { key: 'legends-guild', file: 'legends-guild/siegfried-erkle.js', npcIds: [779], path: [0], questStages: {legendsQuest: -1} },
    { key: 'fernaheis-fishing', file: 'shilo-village/fernahei.js', npcIds: [616], path: [0] },
    { key: 'shilo-village-general', file: 'shilo-village/obli.js', npcIds: [620], path: [0] },
    { key: 'tai-bwo-wannai-general', file: 'tai-bwo-wannai/jiminua.js', npcIds: [522], path: [0] },
    { key: 'dragon-axe', file: 'taverley/helemos.js', npcIds: [269], path: [0] },
    { key: 'blurberrys-bar', file: 'tree-gnome-stronghold/blurberry-barman.js', npcIds: [580], path: [0] },
    { key: 'gnome-restaurant', file: 'tree-gnome-stronghold/gnome-waiter.js', npcIds: [581], path: [0] },
    { key: 'gulluck-and-sons', file: 'tree-gnome-stronghold/gulluck.js', npcIds: [587], path: [0] },
    { key: 'funchs-fine-groceries', file: 'tree-gnome-stronghold/heckel-funch-groceries.js', npcIds: [535], path: [1] },
    { key: 'grand-tree-groceries', file: 'tree-gnome-stronghold/hudo-glenfad-groceries.js', npcIds: [537], path: [1] },
    { key: 'fine-fashions', file: 'tree-gnome-stronghold/rometti.js', npcIds: [532], path: [1] },
    { key: 'tree-gnome-village-general', file: 'tree-gnome-village/bolkoy-general-store.js', npcIds: [398], path: [0] },
    { key: 'fancy-clothes', file: 'varrock/tailor.js', npcIds: [501], path: [1] },
    { key: 'tea-stall', file: 'varrock/tea-seller.js', npcIds: [780], path: [0] },
    { key: 'mage-arena-staves', file: 'wilderness/chamber-guardian.js', npcIds: [784], path: [0], cache: {mageArena: 4} },
    { key: 'mage-arena-rune', file: 'wilderness/lundail.js', npcIds: [793], path: [0] },
    { key: 'frenitas-cooking', file: 'yanille/frenita.js', npcIds: [530], path: [0] },
    { key: 'magic-guild', file: 'yanille/magic-store-owner.js', npcIds: [514], path: [0] },
    { key: 'zanaris-general', file: 'zanaris/fairy-shopkeeper.js', npcIds: [222, 223], path: [0] },
    { key: 'ruby-ring', file: 'zanaris/irksol.js', npcIds: [218], path: [0] },
    { key: 'dragon-sword', file: 'zanaris/jakut.js', npcIds: [220], path: [0] }
];

// `decline`: the answer used once `choices` runs out ('last' or 'first' option of the menu)
function makePlayer(choices, { questStages = {}, cache = {} } = {}, decline = 'last') {
    const queue = [...choices];
    const player = {
        opened: [],
        questStages,
        cache,
        engage() {},
        disengage() {},
        message() {},
        async say() {},
        async ask(options) {
            let choice = decline === 'last' ? options.length - 1 : 0;
            if (queue.length) choice = queue.shift();
            assert.ok(choice < options.length, 'choice ' + choice + ' of ' + options.length);
            return choice;
        },
        openShop(key) {
            this.opened.push(key);
        }
    };
    return player;
}

function makeNpc(id) {
    return { id, definition: npcs[id], async say() {} };
}

for (const shop of SHOPKEEPERS) {
    const plugin = require(path.join('../src/plugins/npcs', shop.file));

    test(shop.key + ': ' + shop.file, async () => {
        assert.ok(shops[shop.key], 'shops.json has ' + shop.key);
        assert.ok(Object.values(plugins).includes(plugin), 'listed in src/plugins/index.js');

        for (const id of shop.npcIds) {
            assert.ok(npcLocations.some((l) => l.id === id), 'npc ' + id + ' is placed');

            const player = makePlayer(shop.path, shop);
            assert.strictEqual(await plugin.onTalkToNPC(player, makeNpc(id)), true);
            assert.deepStrictEqual(player.opened, [shop.key]);

            // decline at the first menu (the answer the shop path does not take): still claimed, no shop
            const declined = makePlayer([], shop, shop.path[0] === 0 ? 'last' : 'first');
            assert.strictEqual(await plugin.onTalkToNPC(declined, makeNpc(id)), true);
            assert.deepStrictEqual(declined.opened, []);
        }

        assert.strictEqual(await plugin.onTalkToNPC(makePlayer([]), makeNpc(0)), false);
    });
}

test('quest and minigame gates keep the shop shut', async () => {
    const siegfried = require('../src/plugins/npcs/legends-guild/siegfried-erkle');
    const refused = makePlayer([0], { questStages: {} });
    assert.strictEqual(await siegfried.onTalkToNPC(refused, makeNpc(779)), true);
    assert.deepStrictEqual(refused.opened, []);

    const guardian = require('../src/plugins/npcs/wilderness/chamber-guardian');
    const closed = makePlayer([0], { cache: {} });
    assert.strictEqual(await guardian.onTalkToNPC(closed, makeNpc(784)), true);
    assert.deepStrictEqual(closed.opened, []);
});
