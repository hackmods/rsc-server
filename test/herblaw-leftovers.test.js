// Herblaw leftovers: potion of Zamorak, blamish oil on a fishing rod, Jungle Potion herb identification.

const test = require('node:test');
const assert = require('node:assert/strict');

const items = require('@2003scape/rsc-data/config/items.json');
const herblaw = require('../src/plugins/skills/herblaw');
const potions = require('../src/plugins/items/potions');

const SKILLS = [
    'attack', 'defense', 'strength', 'hits', 'ranged', 'prayer', 'magic', 'cooking', 'woodcutting', 'fletching',
    'fishing', 'firemaking', 'crafting', 'smithing', 'mining', 'herblaw', 'agility', 'thieving'
];

function fakePlayer({ level = 1, quest = -1, inventory = [], stats = {} } = {}) {
    const bag = inventory.slice();
    const player = {
        world: { async sleepTicks() {} },
        questStages: { druidicRitual: quest },
        skills: Object.fromEntries(SKILLS.map((name) => [name, { current: 1, base: 1, experience: 0 }])),
        messages: [],
        xp: [],
        damageTaken: [],
        message(...m) {
            player.messages.push(...m.map((s) => s.replace('@que@', '')));
        },
        addExperience(skill, experience) {
            player.xp.push({ skill, experience });
        },
        sendStats() {},
        sendBubble() {},
        changeStat(skill, delta, { cap } = {}) {
            const stat = player.skills[skill];
            let next = stat.current + delta;

            if (delta > 0 && typeof cap === 'number') {
                next = Math.min(next, Math.max(cap, stat.current));
            }

            stat.current = Math.max(0, next);
            return stat.current;
        },
        damage(n) {
            player.damageTaken.push(n);
            player.skills.hits.current -= n;
        },
        bag,
        inventory: {
            has: (id) => bag.includes(id),
            add: (id) => bag.push(id),
            remove(id) {
                const i = bag.lastIndexOf(id);
                if (i >= 0) bag.splice(i, 1);
            }
        }
    };

    player.skills.herblaw.current = player.skills.herblaw.base = level;

    for (const [name, [current, base]] of Object.entries(stats)) {
        Object.assign(player.skills[name], { current, base });
    }

    return player;
}

const item = (id) => ({ id, definition: items[id] });

test('potion of Zamorak: names', () => {
    assert.equal(items[963].name, 'Potion of Zamorak');
    assert.equal(items[589].name, 'Oily Fishing Rod');
    assert.equal(items[588].name, 'Blamish oil');
});

test('potion of Zamorak, full dose, follows Drinkables.useZamorakPotion', async () => {
    const player = fakePlayer({
        inventory: [963],
        stats: { attack: [40, 40], strength: [50, 50], defense: [30, 30], hits: [50, 50], prayer: [20, 20] }
    });

    assert.equal(await potions.onInventoryCommand(player, item(963)), true);
    assert.deepEqual(player.bag, [964]);
    // attack: 40 + 4 + floor(8) = 52, cap 52; strength: 50 + 2 + 6 = 58
    assert.equal(player.skills.attack.current, 52);
    assert.equal(player.skills.strength.current, 58);
    // defense: 30 - (4 + 3) = 23; hits: damage floor(50 * .1) = 5
    assert.equal(player.skills.defense.current, 23);
    assert.deepEqual(player.damageTaken, [5]);
    assert.equal(player.skills.hits.current, 45);
    // prayer: +10% of current, may exceed base up to base + 10%
    assert.equal(player.skills.prayer.current, 22);
    assert.equal(player.messages[0], 'You drink some of the foul liquid');
    assert.equal(player.messages.at(-1), 'You have 2 doses of potion left');
});

test('potion of Zamorak, last dose uses the smaller modifiers and leaves an empty vial', async () => {
    const player = fakePlayer({
        inventory: [965],
        stats: { attack: [40, 40], strength: [50, 50], defense: [30, 30], hits: [50, 50], prayer: [20, 20] }
    });

    assert.equal(await potions.onInventoryCommand(player, item(965)), true);
    assert.deepEqual(player.bag, [465]);
    assert.equal(player.skills.attack.current, 50); // 40 + 2 + 8
    assert.equal(player.skills.defense.current, 25); // 30 - (2 + 3)
    assert.equal(player.messages.at(-1), 'You have finished your potion');
});

test('potion of Zamorak does not stack above the boost cap', async () => {
    const player = fakePlayer({ inventory: [964], stats: { attack: [52, 40] } });

    await potions.onInventoryCommand(player, item(964));
    assert.equal(player.skills.attack.current, 52);
    assert.deepEqual(player.bag, [965]);
});

test('blamish oil on a fishing rod makes an oily fishing rod, either order', async () => {
    for (const [a, b] of [[588, 377], [377, 588]]) {
        const player = fakePlayer({ inventory: [588, 377] });

        assert.equal(await herblaw.onUseWithInventory(player, item(a), item(b)), true);
        assert.deepEqual(player.bag, [589]);
        assert.deepEqual(player.messages, ['You rub the oil onto the fishing rod']);
        assert.deepEqual(player.xp, []);
    }
});

test('Jungle Potion herbs identify at level 3 for no XP, behind Druidic Ritual', async () => {
    for (const [from, to] of [[815, 816], [817, 818], [819, 820], [821, 822], [823, 824]]) {
        const player = fakePlayer({ level: 3, inventory: [from] });

        assert.equal(await herblaw.onInventoryCommand(player, item(from)), true);
        assert.deepEqual(player.bag, [to]);
        assert.deepEqual(player.xp, []);
    }

    const low = fakePlayer({ level: 2, inventory: [815] });
    assert.equal(await herblaw.onInventoryCommand(low, item(815)), true);
    assert.deepEqual(low.bag, [815]);

    const noQuest = fakePlayer({ level: 3, quest: 0, inventory: [815] });
    assert.equal(await herblaw.onInventoryCommand(noQuest, item(815)), true);
    assert.deepEqual(noQuest.bag, [815]);
});

test('unrelated items return false', async () => {
    const player = fakePlayer({ inventory: [377, 464] });

    assert.equal(await herblaw.onUseWithInventory(player, item(377), item(464)), false);
    assert.equal(await herblaw.onUseWithInventory(player, item(588), item(464)), false);
    assert.equal(await herblaw.onInventoryCommand(player, item(377)), false);
    assert.equal(await potions.onInventoryCommand(player, item(377)), false);
    assert.deepEqual(player.bag, [377, 464]);
});

// ---- Gerrant (lava eel slime) and the sinister chest ----

const gerrant = require('../src/plugins/npcs/port-sarim/gerrant');
const sinisterChest = require('../src/plugins/game-objects/sinister-chest');
const pluginIndex = require('../src/plugins');

function dialoguePlayer({ heroes = 1, inventory = [], choice = 2 } = {}) {
    const bag = inventory.slice();
    const log = [];
    const player = {
        questStages: { herosQuest: heroes },
        log,
        bag,
        asked: null,
        shop: null,
        poisonPower: 0,
        engage() {},
        disengage() {},
        async say(...m) { log.push(...m); },
        async ask(options) { player.asked = options; return choice; },
        message(...m) { log.push(...m); },
        openShop(name) { player.shop = name; },
        poison(power) { player.poisonPower = power; },
        world: {
            replaced: null,
            replaceTimed(type, entity, id, ticks) { player.world.replaced = { type, id, ticks }; }
        },
        inventory: {
            has: (id) => bag.includes(id),
            add(id, amount = 1) { for (let i = 0; i < amount; i++) bag.push(id); },
            remove(id) { const i = bag.lastIndexOf(id); if (i >= 0) bag.splice(i, 1); }
        }
    };
    return player;
}

const gerrantNpc = { id: 167, async say(...m) { gerrantNpc.log.push(...m); }, log: [] };

test('Gerrant gives one blamish snail slime to a Hero\'s Quest player holding none', async () => {
    gerrantNpc.log = [];
    const player = dialoguePlayer();

    assert.equal(await gerrant.onTalkToNPC(player, gerrantNpc), true);
    assert.equal(player.asked.length, 3);
    assert.deepEqual(player.bag, [587]);
    assert.ok(player.log.includes('Gerrant passes you a small jar'));

    // asking again while holding the slime (or oil, or the oily rod) gives nothing more
    for (const held of [[587], [588], [589]]) {
        const again = dialoguePlayer({ inventory: held });
        await gerrant.onTalkToNPC(again, gerrantNpc);
        assert.deepEqual(again.bag, held);
    }
});

test('Gerrant: no lava eel option before Hero\'s Quest; shop path kept', async () => {
    const player = dialoguePlayer({ heroes: 0, choice: 0 });

    assert.equal(await gerrant.onTalkToNPC(player, gerrantNpc), true);
    assert.equal(player.asked.length, 2);
    assert.equal(player.shop, 'gerrants-fishy-business');
    assert.equal(await gerrant.onTalkToNPC(player, { id: 1 }), false);
});

test('sinister chest: key gives the herbs, removes the key, poisons and opens the chest', async () => {
    const player = dialoguePlayer({ inventory: [932] });

    assert.equal(await sinisterChest.onUseWithGameObject(player, { id: 645 }, { id: 932 }), true);
    assert.deepEqual(player.bag.slice().sort((a, b) => a - b), [437, 437, 438, 438, 438, 439, 440, 441, 933]);
    assert.equal(player.poisonPower, 68);
    assert.deepEqual(player.world.replaced, { type: 'gameObjects', id: 644, ticks: 5 });
    assert.equal(items[933].command, 'Identify');
});

test('sinister chest: locked without the key, other items and objects ignored', async () => {
    const player = dialoguePlayer();

    assert.equal(await sinisterChest.onGameObjectCommandOne(player, { id: 645 }), true);
    assert.deepEqual(player.log, ['the chest is locked']);
    assert.equal(await sinisterChest.onGameObjectCommandOne(player, { id: 644 }), false);
    assert.equal(await sinisterChest.onUseWithGameObject(player, { id: 645 }, { id: 377 }), false);
    assert.equal(await sinisterChest.onUseWithGameObject(player, { id: 12 }, { id: 932 }), false);
    // item reference without the key actually carried: claimed, nothing given
    assert.equal(await sinisterChest.onUseWithGameObject(player, { id: 645 }, { id: 932 }), true);
    assert.deepEqual(player.bag, []);
    assert.equal(pluginIndex['game-objects.sinister-chest'], sinisterChest);
});
