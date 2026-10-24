// https://classic.runescape.wiki/w/Fletching
//
// ARSC overlay (the upstream file is an empty stub). All recipes are driven by use-item-on-item:
//   knife + logs              -> menu: arrow shafts (normal logs only) / unstrung shortbow / unstrung longbow
//   bow string + unstrung bow -> strung bow
//   feather + arrow shafts    -> headless arrows (up to 10 per use)
//   arrow heads + headless    -> arrows by metal (up to 10 per use)
//   feather + dart tips       -> throwing darts (up to 10 per use)
// One product (or batch) per use, like the leather and gem plugins: the player (or bot) clicks again to repeat.
// XP values are quarter points (rsc-data convention). Arrow shafts, headless arrows and darts are not in
// fletching.json: shafts are level 1 / 5 xp for the batch of 10, headless is 1 xp per batch, darts are scaled by
// tier (approximate).

const items = require('@2003scape/rsc-data/config/items');
const { bows, arrows, darts } = require('@2003scape/rsc-data/skills/fletching');

const KNIFE_ID = 13;
const NORMAL_LOGS_ID = 14;
const FEATHER_ID = 381;
const BOW_STRING_ID = 676;
const ARROW_SHAFTS_ID = 280;
const HEADLESS_ARROWS_ID = 637;

const BATCH = 10;
const SHAFTS = { level: 1, experience: 20 };
const HEADLESS_LEVEL = 1;
const HEADLESS_EXPERIENCE = 4;

// dart tips id -> [finished dart id, experience per batch of 10]
const DART_PRODUCTS = {
    1062: [1013, 8],
    1063: [1015, 15],
    1064: [1024, 30],
    1065: [1068, 45],
    1066: [1069, 60],
    1067: [1070, 75]
};

const LOG_IDS = new Set(Object.keys(bows).map(Number));
const UNSTRUNG = new Map(); // unstrung id -> { strung, level, experience }

for (const pair of Object.values(bows)) {
    for (const { level, experience, unstrung, strung } of pair) {
        UNSTRUNG.set(unstrung, { strung, level, experience });
    }
}

const ARROW_HEAD_IDS = new Set(Object.keys(arrows).map(Number));

const name = (id) => items[id].name.toLowerCase();
const article = (s) => (/^[aeiou]/.test(s) ? 'an' : 'a');
const aName = (id) => `${article(name(id))} ${name(id)}`;

// the id of the other item when one of the two is `id`, otherwise -1
function other(item, target, id) {
    if (item.id === id) {
        return target.id;
    }

    if (target.id === id) {
        return item.id;
    }

    return -1;
}

function levelRefusal(player, level, product) {
    if (player.skills.fletching.current >= level) {
        return false;
    }

    player.message(
        `You need a fletching level of ${level} to make ${product}`
    );

    return true;
}

async function cutLogs(player, logID) {
    const [short, long] = bows[logID];
    const choices = [];
    const recipes = [];

    if (logID === NORMAL_LOGS_ID) {
        choices.push('Make arrow shafts');
        recipes.push({ id: ARROW_SHAFTS_ID, amount: BATCH, ...SHAFTS });
    }

    choices.push('Make shortbow', 'Make longbow');
    recipes.push(
        { id: short.unstrung, amount: 1, ...short },
        { id: long.unstrung, amount: 1, ...long }
    );

    let choice;

    try {
        choice = await player.ask(choices, false);
    } catch (e) {
        return;
    }

    const recipe = recipes[choice];

    if (!recipe) {
        return;
    }

    if (player.isTired()) {
        player.message('You are too tired to fletch');
        return;
    }

    const product = recipe.amount > 1 ? name(recipe.id) : aName(recipe.id);

    if (levelRefusal(player, recipe.level, product)) {
        return;
    }

    if (!player.inventory.has(KNIFE_ID) || !player.inventory.has(logID)) {
        return;
    }

    await player.world.sleepTicks(2);

    if (!player.inventory.has(logID)) {
        return;
    }

    player.inventory.remove(logID);
    player.inventory.add(recipe.id, recipe.amount);
    player.addExperience('fletching', recipe.experience);
    player.message(
        'You carefully cut the wood into ' +
            (recipe.amount > 1 ? `${recipe.amount} ${product}` : product)
    );
}

async function stringBow(player, unstrungID) {
    const { strung, level, experience } = UNSTRUNG.get(unstrungID);

    if (levelRefusal(player, level, aName(strung))) {
        return;
    }

    if (player.isTired()) {
        player.message('You are too tired to fletch');
        return;
    }

    await player.world.sleepTicks(1);

    if (
        !player.inventory.has(unstrungID) ||
        !player.inventory.has(BOW_STRING_ID)
    ) {
        return;
    }

    player.inventory.remove(unstrungID);
    player.inventory.remove(BOW_STRING_ID);
    player.inventory.add(strung);
    player.addExperience('fletching', experience);
    player.message(`You add a string to the ${name(strung)}`);
}

// how many of a and b (stackable) the player holds, capped at one batch
function stackAmount(player, a, b) {
    let have = BATCH;

    for (const id of [a, b]) {
        const entry = player.inventory.items.find((item) => item.id === id);
        have = Math.min(have, entry ? entry.amount : 0);
    }

    return have;
}

async function combineStacks(player, a, b, product, experience, message) {
    if (player.isTired()) {
        player.message('You are too tired to fletch');
        return;
    }

    await player.world.sleepTicks(1);

    const amount = stackAmount(player, a, b);

    if (amount < 1) {
        return;
    }

    player.inventory.remove(a, amount);
    player.inventory.remove(b, amount);
    player.inventory.add(product, amount);
    player.addExperience('fletching', experience);
    player.message(message);
}

async function onUseWithInventory(player, item, target) {
    const { world } = player;

    // knife on logs
    const logID = other(item, target, KNIFE_ID);

    if (logID !== -1 && LOG_IDS.has(logID)) {
        // every product is a members item
        if (!world.members) {
            return false;
        }

        await cutLogs(player, logID);
        return true;
    }

    // bow string on an unstrung bow
    const bowID = other(item, target, BOW_STRING_ID);

    if (bowID !== -1 && UNSTRUNG.has(bowID)) {
        await stringBow(player, bowID);
        return true;
    }

    // feather on arrow shafts
    if (other(item, target, FEATHER_ID) === ARROW_SHAFTS_ID) {
        if (levelRefusal(player, HEADLESS_LEVEL, 'headless arrows')) {
            return true;
        }

        await combineStacks(
            player,
            FEATHER_ID,
            ARROW_SHAFTS_ID,
            HEADLESS_ARROWS_ID,
            HEADLESS_EXPERIENCE,
            'You attach feathers to some of your arrow shafts'
        );

        return true;
    }

    // arrow heads on headless arrows
    const headID = other(item, target, HEADLESS_ARROWS_ID);

    if (headID !== -1 && ARROW_HEAD_IDS.has(headID)) {
        const { level, experience, id } = arrows[headID];

        if (levelRefusal(player, level, name(id))) {
            return true;
        }

        await combineStacks(
            player,
            headID,
            HEADLESS_ARROWS_ID,
            id,
            experience,
            'You attach the arrow heads to some of your headless arrows'
        );

        return true;
    }

    // feather on dart tips
    const tipID = other(item, target, FEATHER_ID);

    if (tipID !== -1 && DART_PRODUCTS[tipID] && darts[tipID]) {
        const [dartID, experience] = DART_PRODUCTS[tipID];

        if (levelRefusal(player, darts[tipID], name(dartID))) {
            return true;
        }

        await combineStacks(
            player,
            tipID,
            FEATHER_ID,
            dartID,
            experience,
            'You attach feathers to some of your dart tips'
        );

        return true;
    }

    return false;
}

module.exports = { onUseWithInventory };
