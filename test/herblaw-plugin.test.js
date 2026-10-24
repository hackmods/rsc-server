// Herblaw: skills/herblaw.js (identify, unfinished potions, potions) and items/potions.js (drinking), driven by fake player
// and world objects.

const test = require('node:test');
const assert = require('node:assert/strict');

const items = require('@2003scape/rsc-data/config/items.json');
const herblawData = require('@2003scape/rsc-data/skills/herblaw.json');
const herblaw = require('../src/plugins/skills/herblaw');
const potions = require('../src/plugins/items/potions');
const pluginIndex = require('../src/plugins');

const VIAL_OF_WATER = 464;
const EMPTY_VIAL = 465;

const SKILLS = [
    'attack', 'defense', 'strength', 'hits', 'ranged', 'prayer', 'magic', 'cooking', 'woodcutting', 'fletching',
    'fishing', 'firemaking', 'crafting', 'smithing', 'mining', 'herblaw', 'agility', 'thieving'
];

function fakePlayer({ level = 1, quest = -1, inventory = [] } = {}) {
    const bag = inventory.slice();
    const player = {
        world: { async sleepTicks() {} },
        questStages: quest === null ? {} : { druidicRitual: quest },
        skills: Object.fromEntries(SKILLS.map((name) => [name, { current: 1, base: 1, experience: 0 }])),
        messages: [],
        xp: [],
        stats: 0,
        message(...m) {
            player.messages.push(...m.map((s) => s.replace('@que@', '')));
        },
        addExperience(skill, experience) {
            player.xp.push({ skill, experience });
        },
        sendStats() {
            player.stats += 1;
        },
        sendBubble() {},
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
    return player;
}

const item = (id) => ({ id, definition: items[id] });

test('both plugins are registered in the plugin index', () => {
    assert.equal(pluginIndex['skills.herblaw'], herblaw);
    assert.equal(pluginIndex['items.potions'], potions);
});

test('each plugin exports only its hooks', () => {
    assert.deepEqual(Object.keys(herblaw).sort(), ['onInventoryCommand', 'onUseWithInventory']);
    assert.deepEqual(Object.keys(potions), ['onInventoryCommand']);
});

test('identify: swaps the herb, gives xp, needs the level', async () => {
    const player = fakePlayer({ level: 3, inventory: [165] });
    assert.equal(await herblaw.onInventoryCommand(player, item(165)), true);
    assert.deepEqual(player.bag, [444]);
    assert.deepEqual(player.xp, [{ skill: 'herblaw', experience: 10 }]);
    assert.match(player.messages.join('|'), /This herb is guam leaf/);

    const low = fakePlayer({ level: 4, inventory: [435] });
    assert.equal(await herblaw.onInventoryCommand(low, item(435)), true);
    assert.deepEqual(low.bag, [435]);
    assert.deepEqual(low.xp, []);
    assert.match(low.messages.join('|'), /not high enough/);
});

test('identify: refused until the Druidic Ritual quest is done', async () => {
    for (const quest of [null, 0, 1, 3]) {
        const player = fakePlayer({ level: 99, quest, inventory: [165] });
        assert.equal(await herblaw.onInventoryCommand(player, item(165)), true);
        assert.deepEqual(player.bag, [165]);
        assert.deepEqual(player.xp, []);
        assert.match(player.messages.join('|'), /Druidic Ritual/);
    }
});

test('identify covers every unidentified herb in the data, and leaves other items alone', async () => {
    for (const [id, def] of Object.entries(herblawData.herbs)) {
        const player = fakePlayer({ level: def.level, inventory: [Number(id)] });
        assert.equal(await herblaw.onInventoryCommand(player, item(Number(id))), true, `herb ${id}`);
        assert.deepEqual(player.bag, [def.id]);
        assert.equal(player.xp[0].experience, def.experience);
    }
    const player = fakePlayer({ inventory: [444] });
    assert.equal(await herblaw.onInventoryCommand(player, item(444)), false);
    assert.equal(await herblaw.onInventoryCommand(player, item(10)), false);
});

test('herb on a vial of water: unfinished potion, no xp, either order', async () => {
    const a = fakePlayer({ level: 3, inventory: [444, VIAL_OF_WATER] });
    assert.equal(await herblaw.onUseWithInventory(a, item(444), item(VIAL_OF_WATER)), true);
    assert.deepEqual(a.bag, [454]);
    assert.deepEqual(a.xp, []);

    const b = fakePlayer({ level: 3, inventory: [VIAL_OF_WATER, 444] });
    assert.equal(await herblaw.onUseWithInventory(b, item(VIAL_OF_WATER), item(444)), true);
    assert.deepEqual(b.bag, [454]);
});

test('herb on a vial of water: level and quest gates', async () => {
    const low = fakePlayer({ level: 11, inventory: [446, VIAL_OF_WATER] });
    assert.equal(await herblaw.onUseWithInventory(low, item(446), item(VIAL_OF_WATER)), true);
    assert.deepEqual(low.bag, [446, VIAL_OF_WATER]);
    assert.match(low.messages.join('|'), /level 12 herblaw/);

    const noQuest = fakePlayer({ level: 99, quest: 2, inventory: [444, VIAL_OF_WATER] });
    assert.equal(await herblaw.onUseWithInventory(noQuest, item(444), item(VIAL_OF_WATER)), true);
    assert.deepEqual(noQuest.bag, [444, VIAL_OF_WATER]);
});

test('unfinished potion + secondary: potion with xp', async () => {
    const player = fakePlayer({ level: 3, inventory: [454, 270] });
    assert.equal(await herblaw.onUseWithInventory(player, item(454), item(270)), true);
    assert.deepEqual(player.bag, [474]);
    assert.deepEqual(player.xp, [{ skill: 'herblaw', experience: 100 }]);

    const reversed = fakePlayer({ level: 3, inventory: [270, 454] });
    assert.equal(await herblaw.onUseWithInventory(reversed, item(270), item(454)), true);
    assert.deepEqual(reversed.bag, [474]);
});

test('every recipe in the data works at its level and not one below', async () => {
    for (const [unfinished, secondaries] of Object.entries(herblawData.potions)) {
        for (const [secondary, def] of Object.entries(secondaries)) {
            if (def.id === Number(secondary)) continue;
            const ok = fakePlayer({ level: def.level, inventory: [Number(unfinished), Number(secondary)] });
            assert.equal(await herblaw.onUseWithInventory(ok, item(Number(unfinished)), item(Number(secondary))), true);
            assert.deepEqual(ok.bag, [def.id], `${unfinished} + ${secondary}`);
            assert.equal(ok.xp[0].experience, def.experience);

            const low = fakePlayer({ level: def.level - 1, inventory: [Number(unfinished), Number(secondary)] });
            await herblaw.onUseWithInventory(low, item(Number(unfinished)), item(Number(secondary)));
            assert.deepEqual(low.bag, [Number(unfinished), Number(secondary)]);
        }
    }
});

test('cure poison is marrentill + ashes (rsc-data lists the potion as its own ingredient)', async () => {
    const player = fakePlayer({ level: 5, inventory: [455, 181] });
    assert.equal(await herblaw.onUseWithInventory(player, item(455), item(181)), true);
    assert.deepEqual(player.bag, [566]);
    assert.equal(player.xp[0].experience, 150);
});

test('unrelated item pairs are not claimed', async () => {
    const player = fakePlayer({ inventory: [454, 444] });
    assert.equal(await herblaw.onUseWithInventory(player, item(454), item(444)), false);
    assert.equal(await herblaw.onUseWithInventory(player, item(10), item(VIAL_OF_WATER)), false);
});

test('a missing ingredient after the pause does not duplicate or lose items', async () => {
    const player = fakePlayer({ level: 3, inventory: [454, 270] });
    player.world.sleepTicks = async () => {
        player.bag.splice(player.bag.indexOf(270), 1);
    };
    await herblaw.onUseWithInventory(player, item(454), item(270));
    assert.deepEqual(player.bag, [454]);
});

test('pestle and mortar grinds unicorn horn, blue dragon scale and bat bones, either order', async () => {
    const cases = [[466, 473], [467, 472], [604, 1051]];
    for (const [ingredient, ground] of cases) {
        const a = fakePlayer({ inventory: [468, ingredient] });
        assert.equal(await herblaw.onUseWithInventory(a, item(468), item(ingredient)), true);
        assert.deepEqual(a.bag, [468, ground], `pestle on ${ingredient}`);
        assert.deepEqual(a.xp, []);

        const b = fakePlayer({ inventory: [ingredient, 468] });
        assert.equal(await herblaw.onUseWithInventory(b, item(ingredient), item(468)), true);
        assert.deepEqual(b.bag, [468, ground], `${ingredient} on pestle`);
    }
});

test('grinding needs no level and no quest, and says what it ground', async () => {
    const player = fakePlayer({ level: 1, quest: null, inventory: [468, 466] });
    assert.equal(await herblaw.onUseWithInventory(player, item(468), item(466)), true);
    assert.deepEqual(player.bag, [468, 473]);
    assert.match(player.messages.join('|'), /You grind the Unicorn horn to dust/);
});

test('grinding bat bones shows the pestle bubble; the others do not', async () => {
    const bubbles = [];
    const bones = fakePlayer({ inventory: [468, 604] });
    bones.sendBubble = (id) => bubbles.push(id);
    await herblaw.onUseWithInventory(bones, item(468), item(604));
    assert.deepEqual(bubbles, [468]);

    const horn = fakePlayer({ inventory: [468, 466] });
    horn.sendBubble = (id) => bubbles.push(id);
    await herblaw.onUseWithInventory(horn, item(468), item(466));
    assert.deepEqual(bubbles, [468]);
});

test('grinding leaves unrelated items on the pestle alone', async () => {
    const player = fakePlayer({ inventory: [468, 10] });
    assert.equal(await herblaw.onUseWithInventory(player, item(468), item(10)), false);
    assert.equal(await herblaw.onUseWithInventory(player, item(10), item(468)), false);
    assert.deepEqual(player.bag, [468, 10]);
});

/* ---------- drinking ---------- */

async function drink(player, id) {
    return potions.onInventoryCommand(player, item(id));
}

test('drinking walks the doses down to an empty vial', async () => {
    const player = fakePlayer({ inventory: [474] });
    assert.equal(await drink(player, 474), true);
    assert.deepEqual(player.bag, [475]);
    assert.match(player.messages.join('|'), /2 doses of potion left/);
    await drink(player, 475);
    assert.deepEqual(player.bag, [476]);
    assert.match(player.messages.join('|'), /1 dose of potion left/);
    await drink(player, 476);
    assert.deepEqual(player.bag, [EMPTY_VIAL]);
    assert.match(player.messages.join('|'), /finished your potion/);
});

test('strength potions have four doses', async () => {
    const player = fakePlayer({ inventory: [221] });
    for (const next of [222, 223, 224, EMPTY_VIAL]) {
        await drink(player, player.bag[0]);
        assert.deepEqual(player.bag, [next]);
    }
});

test('combat potions boost by their flat amount plus a share of the base level and do not stack', async () => {
    const cases = [
        [474, 'attack', 40, 3 + 4],
        [221, 'strength', 40, 3 + 4],
        [480, 'defense', 40, 3 + 4],
        [486, 'attack', 40, 5 + 6],
        [492, 'strength', 40, 5 + 6],
        [495, 'defense', 40, 5 + 6],
        [489, 'fishing', 40, 3],
        [498, 'ranged', 40, 4]
    ];
    for (const [id, skill, base, boost] of cases) {
        const player = fakePlayer({ inventory: [id] });
        player.skills[skill].base = base;
        player.skills[skill].current = base - 5;
        await drink(player, id);
        assert.equal(player.skills[skill].current, base + boost, `${id} ${skill}`);
        assert.ok(player.stats > 0);

        await drink(player, player.bag[0]);
        assert.equal(player.skills[skill].current, base + boost, `${id} does not stack`);
    }
});

test('restore prayer tops up prayer points', async () => {
    const player = fakePlayer({ inventory: [483] });
    Object.assign(player.skills.prayer, { base: 40, current: 5 });
    await drink(player, 483);
    assert.equal(player.skills.prayer.current, 5 + 7 + 10);
    Object.assign(player.skills.prayer, { current: 38 });
    await drink(player, player.bag[0]);
    assert.equal(player.skills.prayer.current, 40);
});

test('stat restoration lifts drained stats toward base but never hits or past base', async () => {
    const player = fakePlayer({ inventory: [477] });
    Object.assign(player.skills.attack, { base: 50, current: 20 });
    Object.assign(player.skills.mining, { base: 10, current: 9 });
    Object.assign(player.skills.hits, { base: 30, current: 5 });
    await drink(player, 477);
    assert.equal(player.skills.attack.current, 20 + 8 + 12);
    assert.equal(player.skills.mining.current, 10);
    assert.equal(player.skills.hits.current, 5);
});

test('cure poison and antidote are used up', async () => {
    for (const id of [566, 569]) {
        const player = fakePlayer({ inventory: [id] });
        let cured = 0;
        player.curePoison = () => (cured += 1);
        player.setCurePoisonProtection = player.setAntidoteProtection = () => {};
        assert.equal(await drink(player, id), true);
        assert.deepEqual(player.bag, [id + 1]);
        assert.equal(cured, 1);
    }
});

test('potions in the data: every dose is a Drink item with matching description', () => {
    const chains = [[474, 3], [221, 4], [480, 3], [483, 3], [477, 3], [486, 3], [489, 3], [492, 3], [495, 3], [498, 3], [566, 3], [569, 3]];
    for (const [first, n] of chains) {
        for (let i = 0; i < n; i += 1) {
            const def = items[first + i];
            assert.match(def.command, /drink/i, `item ${first + i}`);
            const doses = n - i;
            assert.match(def.description, new RegExp(`^${doses} doses? of `), `item ${first + i}: ${def.description}`);
        }
    }
});

test('non-potions are not claimed', async () => {
    const player = fakePlayer({ inventory: [10] });
    assert.equal(await drink(player, 10), false);
    assert.equal(await drink(player, EMPTY_VIAL), false);
});
