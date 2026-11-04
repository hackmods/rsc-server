// Ported from Open-RSC Core-Framework authentic/minigames/kittencare/ (KittenToCat.java, KittenState.java,
// KittenIndicator.java, KittenMessageSolver.java) and the activity counter of model/entity/player/Player.java
// (incrementActivity, KITTEN_ACTIVITY_THRESHOLD) (AGPL-3.0)
//
// Kitten Care: a kitten (1096, the Gertrude's Cat reward) carried in the inventory gets hungrier and lonelier as its
// owner plays. Every 50 points of activity (2 per step walked, 5 per 30 s logged in: src/model/player.js) fires
// onCatGrowth: hunger and loneliness each rise by 4-6; crossing a multiple of 16 is an "event" with a message. At 64 the
// kitten runs off; after 32 events it grows into a cat (1119), which West Ardougne's civilians buy for 25 death runes
// (npcs/ardougne/civilians.js).
//   - stroke the kitten, or use wool / a ball of wool on it: loneliness -16
//   - use milk (gives the bucket back) or one of the listed fish on it: hunger -16
//   - use the kitten on a rat (npc 29): 1 in 10 it eats the rat (loneliness -16); a grown cat always catches it
//   - drop the kitten: it runs away
// The Java keeps the gauges in player attributes and writes them to the cache on save; here they live in player.cache
// (kittenEvents, kittenHunger, kittenLoneliness, kittensReleased, kittensRaised), which is saved with the player.
// The cat's own "stroke" (WANT_EXTENDED_CATS_BEHAVIOR) is off in the authentic config and not ported.

const items = require('@2003scape/rsc-data/config/items');

const KITTEN_ID = 1096;
const CAT_ID = 1119;
const BUCKET_ID = 21;
const MILK_ID = 22;
const WOOL_ID = 145;
const BALL_OF_WOOL_ID = 207;
const RAT_ID = 29; // NpcId.RAT_WITCHES_POTION

const BASE_FACTOR = 16;
const GROWN_EVENTS = 32;
const ACTIVITY_THRESHOLD = 50;

// raw shrimp, raw anchovies, raw sardine, sardine, raw salmon, salmon, raw trout, trout, raw tuna, tuna, seasoned
// sardine
const FISH_IDS = new Set([349, 351, 354, 355, 356, 357, 358, 359, 366, 367, 1094]);

// KittenIndicator: [signal, ...interpretation] for gauge levels 1-4 (below 16 says nothing)
const LONELINESS = [
    ['@yel@kitten: miaow!'],
    ['@yel@kitten: miaow!', 'your kitten wants some attention'],
    ['@yel@kitten: miaaaaow!', 'your kitten is feeling lonely'],
    ['your kitten has ran off', 'your kitten was feeling lonely']
];
const HUNGER = [
    ['you hear a purring'],
    ['you hear a purring', 'your kitten is hungry'],
    ['you hear a loud meow', 'your kitten is really hungry'],
    ['your kitten has ran off to look for food', 'to find some food']
];

function randomInclusive(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
}

function indicator(table, gauge) {
    const level = Math.min(Math.floor(gauge / BASE_FACTOR), 4);
    return level === 0 ? [] : table[level - 1];
}

// KittenMessageSolver.messagesCombined: a run-off message wins outright, otherwise the hunger signal, then the
// loneliness lines, then the rest of the hunger lines
function combinedMessages(hunger, loneliness) {
    const hungerLines = indicator(HUNGER, hunger);
    const lonelinessLines = indicator(LONELINESS, loneliness);

    if (hunger >= 4 * BASE_FACTOR) {
        return hungerLines;
    }

    if (loneliness >= 4 * BASE_FACTOR) {
        return lonelinessLines;
    }

    return [hungerLines[0], ...lonelinessLines, ...hungerLines.slice(1)];
}

function getState(player) {
    const { cache } = player;

    return {
        events: cache.kittenEvents || 0,
        hunger: cache.kittenHunger || 0,
        loneliness: cache.kittenLoneliness || 0
    };
}

function saveState(player, { events, hunger, loneliness }) {
    player.cache.kittenEvents = events;
    player.cache.kittenHunger = hunger;
    player.cache.kittenLoneliness = loneliness;
}

function reduce(player, gauge) {
    const state = getState(player);

    if (state[gauge] >= BASE_FACTOR) {
        state[gauge] -= BASE_FACTOR;
        saveState(player, state);
    }
}

function release(player) {
    player.cache.kittensReleased = (player.cache.kittensReleased || 0) + 1;
    player.inventory.remove(KITTEN_ID);
}

async function mes(player, ...steps) {
    for (const step of steps) {
        if (typeof step === 'number') {
            await player.world.sleepTicks(step);
        } else {
            player.message(step);
        }
    }
}

// KittenToCat.onCatGrowth (the CatGrowthTrigger). `roll` (tests) replaces the two random(4, 6) rolls
async function onCatGrowth(player, roll = () => randomInclusive(4, 6)) {
    if (!player.inventory.has(KITTEN_ID)) {
        return false;
    }

    let { events, hunger, loneliness } = getState(player);

    const changeHunger = roll();
    const changeLoneliness = roll();

    // only crossing into the next multiple of 16 is an event
    const hungerEvent = Math.floor((hunger + changeHunger) / BASE_FACTOR) > Math.floor(hunger / BASE_FACTOR);
    const lonelinessEvent =
        Math.floor((loneliness + changeLoneliness) / BASE_FACTOR) > Math.floor(loneliness / BASE_FACTOR);

    hunger += changeHunger;
    loneliness += changeLoneliness;

    let messages = [];

    if (hungerEvent && lonelinessEvent) {
        messages = combinedMessages(hunger, loneliness);
        events += 1;
    } else if (hungerEvent) {
        messages = indicator(HUNGER, hunger);
        events += 1;
    } else if (lonelinessEvent) {
        messages = indicator(LONELINESS, loneliness);
        events += 1;
    }

    for (const message of messages) {
        player.message(message);
    }

    if (hunger >= 4 * BASE_FACTOR || loneliness >= 4 * BASE_FACTOR) {
        // the kitten runs off
        release(player);
        events = hunger = loneliness = 0;
        saveState(player, { events, hunger, loneliness });
    } else if (events >= GROWN_EVENTS) {
        player.inventory.remove(KITTEN_ID);
        player.inventory.add(CAT_ID);
        player.cache.kittensRaised = (player.cache.kittensRaised || 0) + 1;
        events = hunger = loneliness = 0;
        saveState(player, { events, hunger, loneliness });
        await mes(player, "you're kitten has grown into a healthy cat", 2, 'it can hunt for its self now', 2);
    } else {
        saveState(player, { events, hunger, loneliness });
    }

    return true;
}

// Player.incrementActivity: src/model/player.js adds 2 per step and 5 per 30 s; every 50 points grows the kitten
function addActivity(player, amount) {
    player.kittenActivity = (player.kittenActivity || 0) + amount;

    if (player.kittenActivity < ACTIVITY_THRESHOLD) {
        return false;
    }

    player.kittenActivity -= ACTIVITY_THRESHOLD;

    if (player.inventory && player.inventory.has(KITTEN_ID) && player.world && player.world.callPlugin) {
        player.world.callPlugin('onCatGrowth', player).catch(() => {});
    }

    return true;
}

async function onInventoryCommand(player, item) {
    if (item.id !== KITTEN_ID) {
        return false;
    }

    await mes(
        player,
        'you softly stroke the kitten',
        3,
        '@yel@kitten:..purr..purr..',
        3,
        'the kitten appreciates the attention',
        1
    );

    reduce(player, 'loneliness');
    return true;
}

async function onDropItem(player, item) {
    if (!item || item.id !== KITTEN_ID) {
        return false;
    }

    release(player);
    await mes(player, 'you drop the kitten', 2, "it's upset and runs away", 1);
    return true;
}

async function entertain(player, item, grown) {
    const pet = grown ? 'cat' : 'kitten';

    if (item.id === BALL_OF_WOOL_ID) {
        await mes(player, `your ${pet} plays around with the ball of wool`, 3, 'it seems to love pouncing on it', 3);
    } else {
        await mes(player, `your ${pet} plays around with the wool`, 3, 'it seems to be enjoying itself', 3);
    }

    if (!grown) {
        reduce(player, 'loneliness');
    }
}

async function feed(player, item, grown) {
    if (!player.inventory.has(item.id)) {
        return;
    }

    player.inventory.remove(item.id);

    if (item.id === MILK_ID) {
        player.inventory.add(BUCKET_ID);
        // the Java says "kitten" in the cat's second line too
        await mes(
            player,
            grown ? 'you give the cat the milk' : 'you give the kitten the milk',
            3,
            'the kitten quickly laps it up then licks his paws',
            3
        );
    } else {
        const name = items[item.id].name;

        if (grown) {
            await mes(player, `you give the cat the ${name}`, 'it quickly eat\'s them up and licks its paws');
        } else {
            await mes(player, `you give the kitten the ${name}`, 'the kitten quickly eats it up then licks his paws');
        }
    }

    if (!grown) {
        reduce(player, 'hunger');
    }
}

async function onUseWithInventory(player, item, target) {
    const pets = [item, target].filter((i) => i.id === KITTEN_ID || i.id === CAT_ID);

    if (pets.length !== 1) {
        return false;
    }

    const pet = pets[0];
    const other = pet === item ? target : item;
    const grown = pet.id === CAT_ID;

    if (other.id === WOOL_ID || other.id === BALL_OF_WOOL_ID) {
        await entertain(player, other, grown);
        return true;
    }

    if (other.id === MILK_ID || FISH_IDS.has(other.id)) {
        await feed(player, other, grown);
        return true;
    }

    return false;
}

// `chance` (tests) replaces the kitten's 1 in 10 (DataConversions.random(0, 9) == 0)
async function onUseWithNPC(player, npc, item, chance = () => Math.floor(Math.random() * 10) === 0) {
    if (npc.id !== RAT_ID || (item.id !== KITTEN_ID && item.id !== CAT_ID)) {
        return false;
    }

    const { world } = player;
    const kitten = item.id === KITTEN_ID;

    player.message(kitten ? 'it pounces on the rat...' : 'the cat pounces on the rat...');

    if (kitten && !chance()) {
        return true;
    }

    if (npc.faceEntity) {
        npc.faceEntity(player);
    }

    await world.sleepTicks(1);
    world.removeEntity('npcs', npc);
    await world.sleepTicks(2);
    await mes(player, '...and quickly gobbles it up', 3, "it returns to your satchel licking it's paws", 3);

    if (kitten) {
        reduce(player, 'loneliness');
    }

    return true;
}

module.exports = {
    onCatGrowth,
    onInventoryCommand,
    onDropItem,
    onUseWithInventory,
    onUseWithNPC,
    addActivity,
    combinedMessages,
    BASE_FACTOR,
    ACTIVITY_THRESHOLD
};
