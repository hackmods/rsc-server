// ARSC Iron Man mode (src/ironman.js), ported from Open-RSC: the persisted mode, ::ironman, every restriction
// (trade, other players' drops and PvP loot, the Grand Exchange, over-stocked shop goods, the bank and Protect Item for
// an Ultimate, the armour), Hardcore death, and the Iron Man tutors' dialogue (plugins/npcs/lumbridge/iron-men.js).

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const realLoad = Module._load;
Module._load = function load(request, ...rest) {
    if (request === '@2003scape/rsc-landscape') return { Landscape: class {} }; // World without its map (needs canvas)
    return request === '@2003scape/rsc-captcha' ? class {} : realLoad.call(this, request, ...rest);
};
const Player = require('../src/model/player');
const World = require('../src/model/world');

require('../src/arsc-items');
require('../src/arsc-npcs');

const items = require('@2003scape/rsc-data/config/items');
const npcs = require('@2003scape/rsc-data/config/npcs');
const ironman = require('../src/ironman');
const Trade = require('../src/model/trade');
const Bank = require('../src/model/bank');
const Shop = require('../src/model/shop');
const Item = require('../src/model/item');
const GroundItem = require('../src/model/ground-item');
const exchange = require('../src/exchange');
const plugins = require('../src/plugins');
const tutors = require('../src/plugins/npcs/lumbridge/iron-men');
const arscLocations = require('../src/arsc-locations');
const { equipmentRefusal } = require('../src/equipment-eligibility');
const { groundItemTake } = require('../src/packet-handlers/inventory');
const { prayerOn } = require('../src/packet-handlers/prayer');
const { command } = require('../src/packet-handlers/command');
const { MODES, MESSAGES, ARMOUR } = ironman;
Module._load = realLoad;

const COINS = 10;
const BRONZE_SWORD = 70;
const RUNE_2H = 81;
const RUNE_AXE = 93;
const RUNE_BODY = 400;

let nextId = 1;

function makePlayer(extra = {}) {
    const id = nextId++;
    const p = Object.create(Player.prototype);
    Object.assign(p, {
        id,
        index: id,
        username: `user${id}`,
        x: 120,
        y: 650,
        ironMan: 0,
        hcIronmanDeath: 0,
        cache: {},
        prayers: [],
        messages: [],
        sent: [],
        interfaceOpen: { bank: false, shop: false, trade: false },
        appearance: { gender: 0 },
        skills: { defense: { base: 1 }, prayer: { base: 99, current: 99 } },
        loggedIn: true
    }, extra);
    p.message = (...lines) => p.messages.push(...lines);
    p.send = (m) => p.sent.push(m);
    p.sendSound = () => {};
    p.lock = () => {};
    p.unlock = () => {};
    p.faceEntity = () => {};
    p.sendPrayerStatus = () => {};
    p.save = async () => {
        p.saved = (p.saved || 0) + 1;
    };
    p.isMale = () => !extra.female;
    p.hasInterfaceOpen = () => false;
    p.trade = new Trade(p);
    return p;
}

const lastMessages = (p) => p.messages.join(' | ');

// ---------------------------------------------------------------------------

test('modes parse from names and numbers; labels read right', () => {
    assert.equal(ironman.parseMode('none'), 0);
    assert.equal(ironman.parseMode('Ironman'), 1);
    assert.equal(ironman.parseMode('ultimate'), 2);
    assert.equal(ironman.parseMode('HCIM'), 3);
    assert.equal(ironman.parseMode('3'), 3);
    assert.equal(ironman.parseMode('gold'), undefined);
    assert.equal(ironman.parseMode('9'), undefined);
    assert.equal(ironman.describe(0), 'a normal player');
    assert.equal(ironman.describe(1), 'an Ironman');
    assert.equal(ironman.describe(2), 'an Ultimate Ironman');
    assert.equal(ironman.describe(3), 'a Hardcore Ironman');
});

test('the mode is part of the player save', () => {
    const p = makePlayer({ ironMan: MODES.hardcore, hcIronmanDeath: 0, appearance: {}, skills: { hits: { current: 10, experience: 4616, base: 10 } } });
    const save = Player.prototype.getSaveMessage.call(p);
    assert.equal(save.ironMan, 3);
    assert.equal(save.hcIronmanDeath, 0);
});

test('::ironman sets an online player, saves them and tells both', async () => {
    const admin = makePlayer();
    const bot = makePlayer({ username: 'ferrum' });
    admin.world = bot.world = {
        getPlayerByUsername: (name) => [admin, bot].find((p) => p.username === name.toLowerCase())
    };
    admin.getFormattedUsername = () => 'Admin';
    bot.getFormattedUsername = () => 'Ferrum';

    await command({ player: admin }, { command: 'ironman', args: ['ferrum', 'ironman'] });
    assert.equal(bot.ironMan, MODES.ironman);
    assert.equal(bot.saved, 1);
    assert.match(lastMessages(bot), /You are now an Ironman\./);
    assert.match(lastMessages(admin), /Ferrum is now an Ironman\./);

    await command({ player: admin }, { command: 'ironman', args: ['ferrum', 'nonsense'] });
    assert.equal(bot.ironMan, MODES.ironman);
    assert.match(lastMessages(admin), /usage: ::ironman/);

    await command({ player: admin }, { command: 'ironman', args: ['nobody', '1'] });
    assert.match(lastMessages(admin), /unable to find player nobody/);
});

// ---------------------------------------------------------------------------
// trade (PlayerTradeHandler)

test('an Iron Man cannot send or receive a trade request', () => {
    const iron = makePlayer({ ironMan: MODES.ironman });
    const normal = makePlayer();
    normal.getFormattedUsername = () => 'Ferrum';
    iron.getFormattedUsername = () => 'Ferrum';

    iron.trade.request(normal);
    assert.match(lastMessages(iron), /You are an Ironman\. You stand alone\./);
    assert.equal(normal.trade.requests.size, 0);

    normal.trade.request(iron);
    assert.match(lastMessages(normal), /Ferrum is an Ironman\. They stand alone\./);
    assert.equal(iron.trade.requests.size, 0);
    assert.equal(normal.trade.tradingWith, null);

    // two normal players still trade
    const other = makePlayer();
    normal.trade.request(other);
    assert.ok(other.trade.requests.has(normal));
});

// ---------------------------------------------------------------------------
// ground items (GroundItemTake, GroundItem.belongsTo)

function dropWorld() {
    const world = {
        members: true,
        added: [],
        setTimeout() {},
        addEntity(type, entity) {
            this.added.push(entity);
        }
    };
    world.addPlayerDrop = World.prototype.addPlayerDrop.bind(world);
    return world;
}

test('a drop remembers its dropper after the owner times out', () => {
    const world = dropWorld();
    const dropper = makePlayer();
    const item = world.addPlayerDrop(dropper, { id: BRONZE_SWORD }, 120, 650);
    assert.equal(item.owner, dropper.id);
    assert.equal(item.droppedBy, dropper.id);
    delete item.owner; // DROP_OWNER_TIMEOUT
    assert.equal(item.droppedBy, dropper.id);
});

test('an Iron Man takes world spawns and their own drops, not other players\' drops or PvP loot', () => {
    const iron = makePlayer({ ironMan: MODES.ultimate });
    const other = makePlayer();
    const spawn = new GroundItem({}, { id: BRONZE_SWORD, x: 1, y: 1 });
    const own = Object.assign(new GroundItem({}, { id: BRONZE_SWORD, x: 1, y: 1 }), { droppedBy: iron.id });
    const theirs = Object.assign(new GroundItem({}, { id: BRONZE_SWORD, x: 1, y: 1 }), { droppedBy: other.id });
    const loot = Object.assign(new GroundItem({}, { id: BRONZE_SWORD, x: 1, y: 1 }), { droppedBy: other.id, playerKill: true });

    assert.equal(ironman.takeRefusal(iron, spawn), null);
    assert.equal(ironman.takeRefusal(iron, own), null);
    assert.equal(ironman.takeRefusal(iron, theirs), MESSAGES.takeDrop);
    assert.equal(ironman.takeRefusal(iron, loot), MESSAGES.lootPlayer);
    assert.equal(ironman.takeRefusal(other, theirs), null, 'a normal player is unaffected');
});

test('the take packet refuses another player\'s drop with Open-RSC\'s message', async () => {
    const iron = makePlayer({ ironMan: MODES.ironman });
    const theirs = Object.assign(new GroundItem({}, { id: BRONZE_SWORD, x: 120, y: 650 }), { droppedBy: 999 });
    theirs.withinRange = () => true;
    const removed = [];
    iron.inventory = { isFull: () => false, has: () => false, add: () => assert.fail('took it') };
    iron.world = {
        groundItems: { getAtPoint: () => [theirs] },
        callPlugin: async () => false,
        removeEntity: (type, e) => removed.push(e)
    };

    await groundItemTake({ player: iron }, { x: 120, y: 650, id: BRONZE_SWORD });
    await iron.endWalkFunction();
    assert.match(lastMessages(iron), /can't take items that other players have dropped/);
    assert.equal(removed.length, 0);
});

// ---------------------------------------------------------------------------
// death (Player.killedBy, Inventory.dropOnDeath)

function deathWorld() {
    const drops = [];
    return {
        drops,
        ticks: 100,
        members: true,
        players: { getByID: () => undefined },
        nextTick: (fn) => fn(),
        addPlayerDrop(owner, item, x, y) {
            const drop = { owner, item, x, y };
            drops.push(drop);
            return drop;
        }
    };
}

function deathPlayer(world, extra) {
    const p = makePlayer(Object.assign({
        world,
        opponent: null,
        skulled: 0,
        combatLevel: 40,
        combatStyle: 1,
        playerDamage: new Map(),
        rangedDamage: new Map(),
        magicDamage: new Map(),
        skills: Object.fromEntries(['attack', 'defense', 'strength', 'hits', 'ranged', 'prayer', 'magic']
            .map((s) => [s, { current: 10, base: 10, experience: 0 }]))
    }, extra));
    const bag = [];
    p.inventory = {
        items: bag,
        unequip(i) { bag[i].equipped = false; },
        sendAll() {},
        clear() { bag.length = 0; },
        add(item) { bag.push(item); }
    };
    p.sendStats = () => {};
    p.sendDeath = () => {};
    p.curePoison = () => {};
    p.broadcastPlayerAppearance = () => {};
    p.teleport = () => {};
    p.addExperience = () => {};
    p.retreat = () => {};
    p.getFormattedUsername = () => p.username;
    return p;
}

const carry = (p, id, amount = 1) => p.inventory.items.push({ id, amount, equipped: false, definition: items[id] });

test('an Ultimate Ironman keeps nothing on death and a Hardcore one becomes a standard Ironman', () => {
    let world = deathWorld();
    const ultimate = deathPlayer(world, { ironMan: MODES.ultimate });
    ultimate.prayers[8] = true;
    carry(ultimate, RUNE_2H);
    carry(ultimate, RUNE_BODY);
    carry(ultimate, RUNE_AXE);
    Player.prototype.processDeath.call(ultimate);
    assert.equal(ultimate.inventory.items.length, 0);
    assert.equal(world.drops.length, 3);

    world = deathWorld();
    const hardcore = deathPlayer(world, { ironMan: MODES.hardcore });
    carry(hardcore, RUNE_2H);
    Player.prototype.processDeath.call(hardcore);
    assert.equal(hardcore.ironMan, MODES.ironman);
    assert.equal(hardcore.hcIronmanDeath, 1);
    assert.deepEqual(hardcore.inventory.items.map((i) => i.id), [RUNE_2H], 'a standard death keeps three');
    assert.match(lastMessages(hardcore), /no longer|standard Ironman/);
});

test('an Iron Man killer does not loot: the victim keeps ownership of the PvP drop', () => {
    const world = deathWorld();
    const victim = deathPlayer(world, { skulled: 100 });
    const killer = deathPlayer(world, { ironMan: MODES.ironman });
    world.players.getByID = (id) => (id === killer.id ? killer : undefined);
    victim.playerDamage.set(killer.id, 5);
    carry(victim, BRONZE_SWORD);
    Player.prototype.processDeath.call(victim);
    const sword = world.drops.find((d) => d.item.id === BRONZE_SWORD);
    assert.equal(sword.owner, victim);
    assert.equal(sword.playerKill, true);
});

// ---------------------------------------------------------------------------
// shops, bank, Protect Item, armour, the Exchange

test('an Iron Man buys only up to the shop\'s normal stock', () => {
    const shop = new Shop({ members: true, nextTick: () => 0, clearTickTimeout() {} }, 'lumbridge-general');
    const base = shop.definition.items[0];
    const shopItem = shop.items.find((i) => i.id === base.id);

    const iron = makePlayer({ ironMan: MODES.ironman });
    shopItem.amount = base.amount + 1; // someone sold one
    assert.equal(ironman.shopRefusal(iron, shopItem, base.amount), MESSAGES.overstock);
    shopItem.amount = base.amount;
    assert.equal(ironman.shopRefusal(iron, shopItem, base.amount), null);

    // a good the shop does not normally stock is all over-stock
    assert.equal(ironman.shopRefusal(iron, { amount: 1 }, 0), MESSAGES.overstock);
    assert.equal(ironman.shopRefusal(makePlayer(), { amount: 5 }, 0), null);

    // through Shop.buy
    shop.occupants.add(iron);
    shopItem.amount = base.amount + 3;
    iron.inventory = { has: () => true, remove: () => assert.fail('paid'), add: () => assert.fail('bought') };
    shop.buy(iron, shopItem.id, shop.getItemPrice(shopItem, false));
    assert.match(lastMessages(iron), /Iron Men may not buy items that are over-stocked in a shop\./);
    assert.equal(shopItem.amount, base.amount + 3);
});

test('an Ultimate Ironman cannot open the bank or pray Protect Item; others can', async () => {
    const ultimate = makePlayer({ ironMan: MODES.ultimate, world: { members: true } });
    const bank = new Bank(ultimate, []);
    assert.equal(bank.open(), false);
    assert.equal(ultimate.interfaceOpen.bank, false);
    assert.match(lastMessages(ultimate), /As an Ultimate Ironman, you cannot use the bank\./);

    const iron = makePlayer({ ironMan: MODES.ironman, world: { members: true } });
    new Bank(iron, []).open();
    assert.equal(iron.interfaceOpen.bank, true);

    ultimate.prayers = new Array(14).fill(false);
    await prayerOn({ player: ultimate }, { index: 8 });
    assert.equal(ultimate.prayers[8], false);
    assert.match(lastMessages(ultimate), /Ultimate Ironmen cannot protect items\./);

    iron.prayers = new Array(14).fill(false);
    await prayerOn({ player: iron }, { index: 8 });
    assert.equal(iron.prayers[8], true);
});

test('Iron Man armour is for its own kind of Iron Man', () => {
    const wear = (player, id) => equipmentRefusal(player, new Item({ id }));
    const normal = makePlayer();
    const iron = makePlayer({ ironMan: MODES.ironman });
    const ultimate = makePlayer({ ironMan: MODES.ultimate });
    const hardcore = makePlayer({ ironMan: MODES.hardcore });

    assert.deepEqual(wear(normal, ARMOUR[1].helm), ['You need to be an Ironman to wear this']);
    assert.equal(wear(iron, ARMOUR[1].body), null);
    assert.deepEqual(wear(iron, ARMOUR[2].legs), ['You need to be an Ultimate Ironman to wear this']);
    assert.equal(wear(ultimate, ARMOUR[2].helm), null);
    assert.deepEqual(wear(ultimate, ARMOUR[3].helm), ['You need to be a Hardcore Ironman to wear this']);
    assert.equal(wear(hardcore, ARMOUR[3].skirt), null);
});

test('the armour rows: 15 untradeable wearables on the reserved and new ids', () => {
    for (const set of Object.values(ARMOUR)) {
        for (const id of Object.values(set)) {
            const item = new Item({ id });
            assert.match(item.definition.name, /ironman/i, `item ${id}`);
            assert.equal(item.definition.untradeable, true);
            assert.ok(item.definition.wieldable, `item ${id} wieldable`);
        }
    }

    assert.equal(items[1293].name, 'Ultimate ironman helm');
    assert.equal(items[1298].name, 'Hardcore ironman platelegs');
    assert.equal(items[1306].name, 'Ironman helm');
    assert.equal(items[1314].name, 'Hardcore ironman plated skirt');
    assert.equal(new Item({ id: ARMOUR[2].top }).definition.wieldable.female, true);
});

test('the Grand Exchange refuses an Iron Man every way in, house listings included', async () => {
    const iron = makePlayer({ ironMan: MODES.ironman });
    iron.world = { npcs: { getInArea: () => [] }, server: { dataClient: { sendAndReceive: () => assert.fail('asked the data server') } } };

    for (const args of [['offers'], ['buy', 'coal', '10', '100'], ['price', 'coal'], ['collect'], ['open']]) {
        iron.messages.length = 0;
        await exchange.command(iron, args);
        assert.match(lastMessages(iron), /IRONMAN/);
        assert.match(lastMessages(iron), /As an Ironman, you cannot use the Exchange\./);
    }
});

// ---------------------------------------------------------------------------
// the Iron Man tutors

function tutor(id, x = 121, y = 649) {
    const said = [];
    return { id, x, y, definition: npcs[id], said, async say(...lines) { said.push(...lines); } };
}

function talker(choices, extra = {}) {
    const p = makePlayer(extra);
    const queue = [...choices];
    p.asked = [];
    p.engage = () => {};
    p.disengage = () => {};
    p.getFormattedUsername = () => 'Ferrum';
    p.ask = async (options) => {
        p.asked.push(options);
        return queue.length ? queue.shift() : options.length - 1;
    };
    const bag = [];
    p.inventory = { items: bag, add: (id) => bag.push({ id }) };
    p.bank = { items: [] };
    p.world = { sleepTicks: async () => {} };
    return p;
}

test('the tutors are registered, spawned in Lumbridge and on the island, and use the new NPC rows', () => {
    assert.ok(Object.values(plugins).includes(tutors));
    assert.equal(npcs[794].name, 'Ironman');
    assert.equal(npcs[795].name, 'Ultimate Ironman');
    assert.equal(npcs[796].name, 'Hardcore Ironman');
    assert.equal(npcs[794].command, 'Armour');
    const spawns = arscLocations.npcs.filter((n) => n.id >= 794 && n.id <= 796);
    assert.deepEqual(spawns.map((n) => n.id).sort(), [794, 794, 795, 796]);
    assert.ok(spawns.some((n) => n.x === 218 && n.y === 744), 'one on Tutorial Island');
});

test('greeting and "Tell me about Iron Men"', async () => {
    const npc = tutor(794);
    const p = talker([0]);
    assert.equal(await tutors.onTalkToNPC(p, npc), true);
    assert.equal(npc.said[0], "Hello, Ferrum. We're the Ironman tutors.");
    assert.equal(npc.said[1], 'What can we do for you?');
    assert.ok(npc.said.includes('Hardcore Iron Men only have one life.'));
    assert.equal(p.asked[0][1], "I'd like to review my Ironman mode.");

    const hc = tutor(796);
    await tutors.onTalkToNPC(talker([3], { ironMan: MODES.hardcore }), hc);
    assert.equal(hc.said[0], 'Hail, Hardcore Ironman!');

    assert.equal(await tutors.onTalkToNPC(talker([0]), tutor(5)), false, 'other npcs are left alone');
});

test('on Tutorial Island any mode is chosen freely; on the mainland nothing goes up and the status is permanent', async () => {
    // island: talk -> "change my mode" -> Hardcore, then back to none
    const islander = talker([1, 3], { x: 218, y: 744 });
    await tutors.onTalkToNPC(islander, tutor(794, 218, 744));
    assert.equal(islander.asked[0][1], "I'd like to change my Ironman mode.");
    assert.equal(islander.ironMan, MODES.hardcore);
    assert.equal(islander.saved, 1);
    assert.match(lastMessages(islander), /You are now a Hardcore Ironman\./);

    const again = talker([1, 0], { x: 218, y: 744, ironMan: MODES.ultimate });
    await tutors.onTalkToNPC(again, tutor(794, 218, 744));
    assert.equal(again.ironMan, MODES.none);

    // mainland
    const cases = [
        [MODES.none, MODES.ironman, 'You cannot become an Ironman after leaving Tutorial Island.'],
        [MODES.ironman, MODES.ultimate, 'You cannot become an Ultimate Ironman after leaving Tutorial Island.'],
        [MODES.ironman, MODES.hardcore, 'You cannot become a Hardcore Ironman after leaving Tutorial Island.'],
        [MODES.hardcore, MODES.ironman, 'Your Ironman status is permanent and cannot be changed.'],
        [MODES.ironman, MODES.none, 'Your Ironman status is permanent and cannot be changed.']
    ];

    for (const [from, to, message] of cases) {
        const p = talker([1, to], { ironMan: from });
        await tutors.onTalkToNPC(p, tutor(795));
        assert.equal(p.ironMan, from, `${from} -> ${to} stays`);
        assert.ok(p.messages.includes(message), `${from} -> ${to}: ${lastMessages(p)}`);
        assert.equal(p.saved, undefined);
    }
});

test('armour: only for Iron Men, only off the island, a full set once, platebody or plate top, legs or skirt', async () => {
    const normal = tutor(794);
    await tutors.onTalkToNPC(talker([2]), normal);
    assert.deepEqual(normal.said.slice(-2), ["You're not an Ironman.", 'Our armour is only for them.']);

    const island = tutor(794, 218, 744);
    await tutors.onTalkToNPC(talker([2], { ironMan: 1, x: 218, y: 744 }), island);
    assert.match(island.said.join(' '), /once you're off this island/);

    // a male Ironman picks a plated skirt
    const man = talker([2, 1], { ironMan: MODES.ironman });
    const npc = tutor(794);
    await tutors.onTalkToNPC(man, npc);
    assert.deepEqual(man.inventory.items.map((i) => i.id), [ARMOUR[1].helm, ARMOUR[1].body, ARMOUR[1].skirt]);
    assert.match(lastMessages(man), /Ironman gives you a Ironman helm/);
    assert.equal(npc.said[npc.said.length - 1], 'There you go. Wear it with pride.');

    // asked again: nothing more
    const again = tutor(794);
    await tutors.onNPCCommand(man, again);
    assert.deepEqual(again.said, ["I think you've already got the whole set."]);
    assert.equal(man.inventory.items.length, 3);

    // a female Ultimate picks a plate top and platelegs; banked pieces count as held
    const woman = talker([2, 1, 0], { ironMan: MODES.ultimate, female: true });
    await tutors.onTalkToNPC(woman, tutor(795));
    assert.deepEqual(woman.inventory.items.map((i) => i.id), [ARMOUR[2].helm, ARMOUR[2].top, ARMOUR[2].legs]);

    const banked = talker([0], { ironMan: MODES.hardcore });
    banked.bank.items.push({ id: ARMOUR[3].helm }, { id: ARMOUR[3].body });
    await tutors.onNPCCommand(banked, tutor(796));
    assert.deepEqual(banked.inventory.items.map((i) => i.id), [ARMOUR[3].legs]);
});

test('dropped armour is not picked back up: the tutors replace it', async () => {
    const p = makePlayer({ ironMan: MODES.ironman });
    assert.equal(await tutors.onGroundItemTake(p, { id: ARMOUR[1].helm }), true);
    assert.match(lastMessages(p), /speak to an Ironman Npc for a replacement/);
    assert.equal(await tutors.onGroundItemTake(p, { id: BRONZE_SWORD }), false);
});

test('a normal player is not affected anywhere', () => {
    const p = makePlayer();
    const other = makePlayer();
    assert.equal(ironman.tradeRefusal(p, other), null);
    assert.equal(ironman.bankRefusal(p), null);
    assert.equal(ironman.takeRefusal(p, { droppedBy: other.id, playerKill: true }), null);
    assert.equal(ironman.onDeath(p), false);
    assert.equal(COINS, 10);
});
