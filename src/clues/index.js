// ARSC treasure trails: clue scrolls in three tiers (easy, medium, hard).
// Everything tunable is data: steps.json (where each clue points),
// config.json (items, step counts, drop and skilling rates) and rewards.json
// (casket tables). Progress lives in player.cache.clues[tier] as
// { step, remaining, done }, never on the item, so it survives logout and
// is cleared when the scroll is dropped or lost.
// Bot-facing write-up: source/knowledge/rsc-treasure-trails.md in Autonomous-RSC.

const itemDefs = require('@2003scape/rsc-data/config/items.json');
const npcDefs = require('@2003scape/rsc-data/config/npcs.json');

const newItems = require('./items.json').items;
const config = require('./config.json');
const rewards = require('./rewards.json');
const { steps } = require('./steps.json');

const TIERS = ['easy', 'medium', 'hard'];
const COINS_ID = 10;

// the casket rows are not in rsc-data: append them once, so every
// require('@2003scape/rsc-data/config/items') sees them (it is a singleton)
for (const item of newItems) {
    if (!itemDefs[item.id]) {
        const { id, ...definition } = item;

        if (itemDefs.length !== id) {
            throw new Error(`clues: item ${id} expected at index ${itemDefs.length}`);
        }

        itemDefs.push(definition);
    }
}

const ITEMS = Object.fromEntries(newItems.map((item) => [item.id, item]));

const SCROLL_TIERS = new Map(TIERS.map((tier) => [config.scrolls[tier], tier]));
const CASKET_TIERS = new Map(TIERS.map((tier) => [config.caskets[tier], tier]));
const STEPS = new Map(steps.map((step) => [step.id, step]));
const PLANE_HEIGHT = 944;

function randomInt(min, max, random = Math.random) {
    return min + Math.floor(random() * (max - min + 1));
}

function amountOf(entry, random) {
    return Array.isArray(entry.amount)
        ? randomInt(entry.amount[0], entry.amount[1], random)
        : entry.amount || 1;
}

function weighted(table, random = Math.random) {
    const total = table.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = random() * total;

    for (const entry of table) {
        roll -= entry.weight;

        if (roll < 0) {
            return entry;
        }
    }

    return table[table.length - 1];
}

function tierOfScroll(id) {
    return SCROLL_TIERS.get(id);
}

function tierOfCasket(id) {
    return CASKET_TIERS.get(id);
}

function scrollName(tier) {
    return `${tier} clue scroll`;
}

function withArticle(text) {
    return `${/^[aeiou]/i.test(text) ? 'an' : 'a'} ${text}`;
}

// in the inventory or the bank: a banked scroll keeps its progress
function owns(player, id) {
    return (
        player.inventory.has(id) || !!(player.bank && player.bank.has(id))
    );
}

function clueCache(player) {
    if (!player.cache.clues) {
        player.cache.clues = {};
    }

    return player.cache.clues;
}

// the tier's state, cleared when the scroll is gone (dropped, died, sold)
function getState(player, tier) {
    const clues = player.cache.clues;
    const state = clues && clues[tier];

    if (!state) {
        return null;
    }

    if (!owns(player, config.scrolls[tier]) || !STEPS.has(state.step)) {
        clearState(player, tier);
        return null;
    }

    return state;
}

function clearState(player, tier) {
    if (player.cache.clues) {
        delete player.cache.clues[tier];

        if (!Object.keys(player.cache.clues).length) {
            delete player.cache.clues;
        }
    }
}

function pickStep(tier, exclude = [], random = Math.random) {
    let pool = steps.filter(
        (step) => step.tier === tier && !exclude.includes(step.id)
    );

    if (!pool.length) {
        pool = steps.filter((step) => step.tier === tier);
    }

    return pool[Math.floor(random() * pool.length)];
}

function newState(tier, random = Math.random) {
    const [min, max] = config.stepCounts[tier];

    return {
        step: pickStep(tier, [], random).id,
        remaining: randomInt(min, max, random),
        done: []
    };
}

// the tier's state, started fresh when the player holds a scroll without one
// (a new drop, or a scroll whose state was cleared)
function ensureState(player, tier, random = Math.random) {
    const state = getState(player, tier);

    if (state) {
        return state;
    }

    if (!player.inventory.has(config.scrolls[tier])) {
        return null;
    }

    const fresh = newState(tier, random);
    clueCache(player)[tier] = fresh;
    return fresh;
}

// tiers whose scroll is in the inventory, with their state: a clue only
// progresses while the scroll is carried
function carriedClues(player) {
    const carried = [];

    if (!player || !player.inventory || !player.cache) {
        return carried;
    }

    for (const tier of TIERS) {
        if (player.inventory.has(config.scrolls[tier])) {
            const state = ensureState(player, tier);

            if (state) {
                carried.push({ tier, state, step: STEPS.get(state.step) });
            }
        }
    }

    return carried;
}

function currentStep(player, tier) {
    const state = getState(player, tier);
    return state ? STEPS.get(state.step) : null;
}

function clueText(tier, state) {
    const step = STEPS.get(state.step);
    const number = state.done.length + 1;
    const total = state.done.length + state.remaining;
    const title = tier[0].toUpperCase() + tier.slice(1);

    return `@yel@${title} treasure trail - clue ${number} of ${total}% %@whi@${step.text}`;
}

function showClue(player, tier, state) {
    player.send({ type: 'serverMessage', message: clueText(tier, state) });
}

function distance(a, b) {
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

// same plane and within the step's radius
function isNear(entity, step, radius = step.radius || 0) {
    if (Math.floor(entity.y / PLANE_HEIGHT) !== Math.floor(step.y / PLANE_HEIGHT)) {
        return false;
    }

    return distance(entity, step) <= radius;
}

function spawnOf(npc) {
    return Number.isFinite(npc.spawnX) && Number.isFinite(npc.spawnY)
        ? { x: npc.spawnX, y: npc.spawnY }
        : npc;
}

function matches(step, type, target, entity) {
    if (!step || step.type !== type) {
        return false;
    }

    switch (type) {
        case 'dig':
            return isNear(entity, step, step.radius || 1);
        case 'talk':
        case 'kill':
            // an NPC wanders its spawn box: the step names the spawn, not where it walked to
            return target === step.npc && isNear(spawnOf(entity), step);
        case 'search':
            return (
                target === step.object &&
                entity.x === step.x &&
                entity.y === step.y
            );
        default:
            return false;
    }
}

// the step is solved: the next clue, or the casket on the last one
function advance(player, tier, random = Math.random) {
    const state = getState(player, tier);

    if (!state) {
        return null;
    }

    state.done.push(state.step);
    state.remaining -= 1;

    if (state.remaining <= 0) {
        clearState(player, tier);
        player.inventory.remove(config.scrolls[tier]);
        player.inventory.add(config.caskets[tier]);
        player.message(
            `@gre@Well done, you have completed the ${tier} treasure trail!`
        );
        player.message(`You have been given ${withArticle(itemName(config.caskets[tier]).toLowerCase())}`);
        return { done: true };
    }

    state.step = pickStep(tier, state.done, random).id;
    player.message('@gre@You have found another clue!');
    showClue(player, tier, state);
    return { done: false, step: STEPS.get(state.step) };
}

// a step of the given type solved by this action, if any clue carried
function solveIfMatched(player, type, target, entity) {
    for (const { tier, step } of carriedClues(player)) {
        if (matches(step, type, target, entity)) {
            return { tier, step };
        }
    }

    return null;
}

function heldUniques(player, table) {
    return new Set(
        table
            .filter((entry) => entry.unique && owns(player, entry.id))
            .map((entry) => entry.id)
    );
}

// what one casket gives: [{ id, amount, rare }]. pure apart from `random`,
// so scripts/clue-sim.js can roll thousands
function rollCasket(tier, { random = Math.random, excluded = new Set() } = {}) {
    const table = rewards[tier];
    const loot = [];
    const rolls = randomInt(table.rolls[0], table.rolls[1], random);

    for (let i = 0; i < rolls; i += 1) {
        const entry = weighted(table.common, random);
        loot.push({ id: entry.id, amount: amountOf(entry, random), rare: false });
    }

    // runes, herbs and bones on top: more rolls and bigger piles for harder trails
    if (table.supplies) {
        const supplies = randomInt(table.supplies.rolls[0], table.supplies.rolls[1], random);

        for (let i = 0; i < supplies; i += 1) {
            const entry = weighted(table.supplies.table, random);
            loot.push({ id: entry.id, amount: amountOf(entry, random), rare: false, supply: true });
        }
    }

    if (table.rare && random() * table.rare.chance < 1) {
        const pool = table.rare.table.filter((entry) => !excluded.has(entry.id));

        if (pool.length) {
            const entry = weighted(pool, random);
            loot.push({ id: entry.id, amount: amountOf(entry, random), rare: true });
        }
    }

    return loot;
}

function itemName(id) {
    return (ITEMS[id] || itemDefs[id]).name;
}

function broadcast(world, message) {
    if (!world || !world.players || !config.broadcastRares) {
        return;
    }

    for (const other of world.players.getAll()) {
        other.message(message);
    }
}

const INVENTORY_SIZE = 30;

// into the inventory; what does not fit (herbs and bones come in piles) goes
// to the bank, and only a full bank leaves it on the ground
function deliver(player, id, amount) {
    const definition = itemDefs[id];
    const free = INVENTORY_SIZE - player.inventory.items.length;
    const fits =
        definition.stackable
            ? (player.inventory.has(id) || free > 0 ? amount : 0)
            : Math.min(amount, Math.max(free, 0));

    if (fits > 0) {
        player.inventory.add(id, fits);
    }

    const rest = amount - fits;

    if (rest > 0) {
        if (player.bank && player.bank.add(id, rest)) {
            player.message(`${rest} x ${definition.name} ${rest === 1 ? 'is' : 'are'} sent to your bank`);
        } else {
            player.inventory.add(id, rest);
        }
    }
}

function openCasket(player, tier, random = Math.random) {
    const casketID = config.caskets[tier];

    if (!player.inventory.has(casketID)) {
        return null;
    }

    player.inventory.remove(casketID);

    const table = rewards[tier];
    const excluded = table.rare ? heldUniques(player, table.rare.table) : new Set();
    const loot = rollCasket(tier, { random, excluded });

    player.message(`You open the ${itemName(casketID).toLowerCase()}...`);

    for (const { id, amount, rare } of loot) {
        deliver(player, id, amount);

        if (rare) {
            player.message(`@yel@You find something rare: ${itemName(id)}!`);
            broadcast(
                player.world,
                `@yel@${player.getFormattedUsername()} found ${withArticle(itemName(id))} ` +
                    `in ${withArticle(tier)} casket!`
            );
        }
    }

    const counts = player.cache.clueCaskets || (player.cache.clueCaskets = {});
    counts[tier] = (counts[tier] || 0) + 1;
    player.message(
        `You have completed ${counts[tier]} ${tier} treasure trail${counts[tier] === 1 ? '' : 's'}`
    );

    return loot;
}

function bandTier(bands, key, value) {
    for (const band of bands) {
        if (band[key] === undefined || value <= band[key]) {
            return band.tier;
        }
    }

    return null;
}

function npcCombatLevel(id) {
    const def = npcDefs[id];

    if (!def) {
        return 0;
    }

    return Math.floor((def.attack + def.defense + def.strength + def.hits) / 4);
}

// one clue scroll per tier (inventory or bank); an unopened casket does not
// count, so finishing a trail lets the next scroll drop
function canReceive(player, tier) {
    return !owns(player, config.scrolls[tier]);
}

function onTutorial(player) {
    try {
        return require('../plugins/tutorial/core').onTutorial(player);
    } catch (e) {
        return false;
    }
}

// the rare roll when a player kills an NPC: the scroll drops with the loot
function rollKillDrop(player, npc, random = Math.random) {
    if (!player || !player.inventory || !npc || config.kill.excludeNpcs.includes(npc.id)) {
        return null;
    }

    const def = npcDefs[npc.id];

    if (!def || !def.hostility || onTutorial(player)) {
        return null;
    }

    const tier = bandTier(config.kill.bands, 'maxCombat', npcCombatLevel(npc.id));

    if (!tier || !canReceive(player, tier) || random() * config.kill.rates[tier] >= 1) {
        return null;
    }

    return { tier, id: config.scrolls[tier] };
}

// the rare roll on each skilling action (experience gained with fatigue)
function rollSkillDrop(player, skill, random = Math.random) {
    if (!config.skilling.skills.includes(skill) || !player.skills[skill] || onTutorial(player)) {
        return null;
    }

    const tier = bandTier(config.skilling.bands, 'maxLevel', player.skills[skill].base);

    if (!tier || !canReceive(player, tier) || random() * config.skilling.rates[tier] >= 1) {
        return null;
    }

    player.inventory.add(config.scrolls[tier]);
    player.message(`@gre@While ${skill === 'prayer' ? 'praying' : 'working'} you find ${withArticle(scrollName(tier))}!`);
    return { tier, id: config.scrolls[tier] };
}

// ::clue <tier> | ::clue tp [tier] | ::clue skip [tier] | ::clue info [tier] | ::clue set <step id>
// Who may use it is the world's command policy (world-admin canUseCommands,
// ARSC_CMD_POLICY), checked by packet-handlers/command.js before this runs:
// admins only on a locked-down world, every account on an open sandbox.
function command(player, args) {
    const [action, maybeTier] = args;

    // a given step, for testing it (bots' trail-check.js --sweep): two steps left, so solving it is not the last
    if (action === 'set') {
        const step = STEPS.get(maybeTier);

        if (!step) {
            player.message(`No clue step ${maybeTier}`);
            return;
        }

        if (!player.inventory.has(config.scrolls[step.tier])) {
            player.inventory.add(config.scrolls[step.tier]);
        }

        clueCache(player)[step.tier] = { step: step.id, remaining: 2, done: [] };
        showClue(player, step.tier, player.cache.clues[step.tier]);
        return;
    }
    const pickTier = (value) =>
        TIERS.includes(value)
            ? value
            : TIERS.find((tier) => player.inventory.has(config.scrolls[tier]));

    if (TIERS.includes(action)) {
        if (!player.inventory.has(config.scrolls[action])) {
            player.inventory.add(config.scrolls[action]);
        }

        clueCache(player)[action] = newState(action);
        showClue(player, action, player.cache.clues[action]);
        return;
    }

    const tier = pickTier(maybeTier);
    const state = tier && ensureState(player, tier);

    if (!state) {
        player.message('Usage: ::clue easy|medium|hard, ::clue set <step id>, or ::clue tp|skip|info [tier] while holding a clue');
        return;
    }

    const step = STEPS.get(state.step);

    switch (action) {
        case 'tp':
            player.teleport(step.x, step.y, true);
            player.message(`${tier} step ${step.id}: ${step.type} at ${step.area || ''} (${step.x}, ${step.y})`);
            break;
        case 'skip':
            advance(player, tier);
            break;
        case 'info':
        default:
            player.message(
                `${tier}: step ${step.id} (${step.type}${step.npc !== undefined ? ` npc ${step.npc}` : ''}` +
                    `${step.object !== undefined ? ` object ${step.object}` : ''}) at ${step.x}, ${step.y}; ` +
                    `${state.remaining} left, done ${state.done.join(', ') || 'none'}`
            );
            break;
    }
}

module.exports = {
    TIERS,
    ITEMS,
    STEPS,
    config,
    rewards,
    steps,
    tierOfScroll,
    tierOfCasket,
    owns,
    getState,
    clearState,
    ensureState,
    carriedClues,
    currentStep,
    clueText,
    showClue,
    matches,
    advance,
    solveIfMatched,
    rollCasket,
    openCasket,
    deliver,
    rollKillDrop,
    rollSkillDrop,
    canReceive,
    npcCombatLevel,
    scrollName,
    withArticle,
    command
};
