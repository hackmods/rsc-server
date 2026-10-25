// ARSC wishing fountains: "Make a wish" on a fountain or well (or use coins on it). The menu offers
//   - a random fountain, free (any fountain in the world, visited or not)
//   - a town you have visited, 1 coin (a town is remembered the first time you use a coin on its fountain or well,
//     or when a random wish lands you in it)
//   - at a fountain, a deep wish to a random well, 100 coins
// After any wish the water stays still for 10 minutes. "Steal coin" (right-click, level 1 thieving) takes
// one coin, once a minute per fountain or well. Towns without a fountain in rsc-data get one in
// arsc-locations.js. Quest-item rules follow Open-RSC custom/misc/TeleportStone.java (Ana stops you, the plague sample
// disintegrates, Karamja rum stays on Karamja). No fountain or well is in the wilderness, so there is no level check.

const tutorial = require('../tutorial/core');

const COINS_ID = 10;
const KARAMJA_RUM_ID = 318;
const PLAGUE_SAMPLE_ID = 812;
const ANA_IN_A_BARREL_ID = 1039;

const FOUNTAIN_ID = 26;
const WELL_ID = 2;

const TOWN_COST = 1;
const DEEP_WISH_COST = 100;
const COOLDOWN_MS = 10 * 60 * 1000;

// stealing a wished coin back out
const STEAL_LEVEL = 1;
const STEAL_COINS = 1;
const STEAL_EXPERIENCE = 8; // quarter points: 2 xp
const STEAL_RESPAWN_MS = 60 * 1000;
const stolenUntil = new Map();

// a fountain or well this close to a town's fountain counts as that town's
const TOWN_RADIUS = 30;

// the native client's option menu holds 5 entries: 4 towns and "More" or "Never mind"
const PAGE_SIZE = 4;

// the free-to-play map (World FREE_BOUNDS): wishes on a free world stay inside it
const FREE_BOUNDS = { minX: 48, maxX: 450, minY: 128, maxY: 766 };

// every surface fountain and well a wish can land at: [x, y] of the object (south-west corner of the 2x2) and the
// walkable tile beside it the wish lands on. Each landing tile was checked open to the town round it on the
// landscape; fountains and wells left out have no such tile (509,544 and the well at 637,727) or are on
// Tutorial Island.
const FOUNTAINS = [
    [124, 652, 124, 654], // Lumbridge
    [121, 508, 121, 510], // Varrock square
    [147, 473, 148, 472], // Varrock
    [147, 476, 148, 475], // Varrock
    [71, 687, 70, 686], // Al Kharid
    [72, 689, 72, 691], // Al Kharid
    [211, 628, 211, 630], // Draynor
    [219, 688, 218, 687],
    [269, 656, 269, 658], // Port Sarim
    [313, 539, 313, 541], // Falador
    [327, 545, 326, 547], // Falador
    [225, 511, 225, 513], // Barbarian Village
    [255, 458, 257, 457],
    [255, 462, 257, 462],
    [255, 466, 257, 468],
    [371, 705, 371, 707], // Karamja, Musa Point
    [372, 500, 372, 502], // Taverley
    [428, 563, 427, 562],
    [445, 500, 445, 502], // Catherby
    [456, 434, 458, 435],
    [461, 454, 461, 456], // Camelot
    [461, 457, 463, 459], // Camelot
    [473, 454, 475, 456],
    [473, 457, 474, 459],
    [495, 455, 495, 457], // Seers' Village
    [470, 658, 470, 660], // Brimhaven
    [568, 589, 570, 592], // Ardougne
    [571, 589, 570, 592], // Ardougne
    [579, 743, 579, 745], // Yanille
    [627, 739, 626, 738],
    [653, 717, 654, 716],
    [702, 479, 702, 481] // Gnome Stronghold
];

const WELLS = [
    [117, 650, 119, 649], // Lumbridge
    [71, 679, 70, 678], // Al Kharid
    [53, 513, 52, 515],
    [89, 521, 88, 520],
    [183, 660, 182, 661],
    [222, 445, 222, 447], // Edgeville
    [323, 662, 323, 664], // Rimmington
    [503, 502, 505, 501],
    [560, 545, 559, 547],
    [600, 633, 602, 635],
    [713, 686, 712, 685]
];

// fountain: the town's fountain or well (one of FOUNTAINS or WELLS)
const TOWNS = [
    { key: 'lumbridge', name: 'Lumbridge', fountain: [124, 652] },
    { key: 'varrock', name: 'Varrock', fountain: [121, 508] },
    { key: 'al-kharid', name: 'Al Kharid', fountain: [72, 689] },
    { key: 'draynor', name: 'Draynor', fountain: [211, 628] },
    { key: 'port-sarim', name: 'Port Sarim', fountain: [269, 656] },
    { key: 'rimmington', name: 'Rimmington', fountain: [323, 662], well: true },
    { key: 'falador', name: 'Falador', fountain: [313, 539] },
    { key: 'barbarian-village', name: 'Barbarian Village', fountain: [225, 511] },
    { key: 'edgeville', name: 'Edgeville', fountain: [222, 445], well: true },
    { key: 'karamja', name: 'Karamja', fountain: [371, 705], karamja: true },
    { key: 'taverley', name: 'Taverley', fountain: [372, 500], members: true },
    { key: 'catherby', name: 'Catherby', fountain: [445, 500], members: true },
    { key: 'camelot', name: 'Camelot', fountain: [461, 454], members: true },
    { key: 'seers-village', name: "Seers' Village", fountain: [495, 455], members: true },
    { key: 'ardougne', name: 'Ardougne', fountain: [571, 589], members: true },
    { key: 'brimhaven', name: 'Brimhaven', fountain: [470, 658], members: true, karamja: true },
    { key: 'yanille', name: 'Yanille', fountain: [579, 743], members: true },
    { key: 'gnome-stronghold', name: 'Gnome Stronghold', fountain: [702, 479], members: true }
];

function inFreeBounds(x, y) {
    return x >= FREE_BOUNDS.minX && x <= FREE_BOUNDS.maxX && y >= FREE_BOUNDS.minY && y <= FREE_BOUNDS.maxY;
}

function getTowns(world) {
    return TOWNS.filter((town) => world.members || !town.members);
}

function getLanding(x, y) {
    const spot = FOUNTAINS.concat(WELLS).find(([sx, sy]) => sx === x && sy === y);
    return spot ? [spot[2], spot[3]] : null;
}

// the town whose fountain is nearest this point, if any is close enough
function getTownAt(world, { x, y }) {
    let nearest = null;
    let nearestDistance = Infinity;

    for (const town of getTowns(world)) {
        const [fx, fy] = town.fountain;
        const distance = Math.max(Math.abs(fx - x), Math.abs(fy - y));

        if (distance <= TOWN_RADIUS && distance < nearestDistance) {
            nearest = town;
            nearestDistance = distance;
        }
    }

    return nearest;
}

function getUnlocked(player) {
    return Array.isArray(player.cache.wishingFountains) ? player.cache.wishingFountains : [];
}

function getCooldownLeft(player) {
    const last = player.cache.wishingFountainAt || 0;
    return Math.max(0, last + COOLDOWN_MS - Date.now());
}

// a random spot from the list, never the one being wished at
function pickRandom(world, spots, gameObject) {
    const choices = spots.filter(
        ([x, y]) => !(x === gameObject.x && y === gameObject.y) && (world.members || inFreeBounds(x, y))
    );

    const [x, y, landX, landY] = choices[Math.floor(Math.random() * choices.length)];

    return { x, y, landing: [landX, landY] };
}

// 4 towns a page; the last entry turns the page or, on the last page, closes the menu
async function chooseTown(player, towns) {
    for (let start = 0; start < towns.length; start += PAGE_SIZE) {
        const page = towns.slice(start, start + PAGE_SIZE);
        const more = start + PAGE_SIZE < towns.length;
        const choice = await player.ask([...page.map(({ name }) => name), more ? 'More...' : 'Never mind'], false);

        if (choice < page.length) {
            return page[choice];
        }

        if (!more) {
            return null;
        }
    }

    return null;
}

// leave quest items behind the way the teleport stone does; false when the wish cannot happen at all
function checkCarried(player, from, to) {
    const { inventory } = player;

    if (inventory.has(ANA_IN_A_BARREL_ID)) {
        player.message("You can't make a wish while holding Ana,", "It's just too difficult to concentrate.");
        return false;
    }

    if (inventory.has(PLAGUE_SAMPLE_ID)) {
        player.message('the plague sample is too delicate...', 'it disintegrates in the crossing');

        while (inventory.has(PLAGUE_SAMPLE_ID)) {
            inventory.remove(PLAGUE_SAMPLE_ID);
        }
    }

    if (from && from.karamja && !(to && to.karamja) && inventory.has(KARAMJA_RUM_ID)) {
        player.message('Your Karamja rum stays behind in the water');

        while (inventory.has(KARAMJA_RUM_ID)) {
            inventory.remove(KARAMJA_RUM_ID);
        }
    }

    return true;
}

function isWishingSpot(gameObject) {
    return (
        (gameObject.id === FOUNTAIN_ID || gameObject.id === WELL_ID) &&
        !tutorial.inBounds(gameObject.x, gameObject.y)
    );
}

async function makeWish(player, gameObject) {
    const { world } = player;
    const isWell = gameObject.id === WELL_ID;
    const water = isWell ? 'well' : 'fountain';

    if (player.opponent) {
        player.message("You can't do that whilst you are fighting");
        return true;
    }

    const here = getTownAt(world, gameObject);

    if (here && !getUnlocked(player).includes(here.key)) {
        player.cache.wishingFountains = [...getUnlocked(player), here.key];
        player.message(`The water shimmers: the ${here.name} ${here.well ? 'well' : 'fountain'} will remember you`);
    }

    const cooldownLeft = getCooldownLeft(player);

    if (cooldownLeft > 0) {
        const minutes = Math.ceil(cooldownLeft / 60000);
        player.message(`The water is still. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}`);
        return true;
    }

    const towns = getTowns(world).filter((town) => town !== here && getUnlocked(player).includes(town.key));
    const options = [{ label: 'A random fountain (free)', kind: 'random' }];

    if (towns.length) {
        options.push({ label: `A town I have visited (${TOWN_COST} coin)`, kind: 'town' });
    }

    if (!isWell) {
        options.push({ label: `A deep wish: a random well (${DEEP_WISH_COST} coins)`, kind: 'deep' });
    }

    options.push({ label: 'Never mind', kind: null });

    player.message(`You gaze into the ${water}. What do you wish for?`);

    const { kind } = options[await player.ask(options.map(({ label }) => label), false)];
    let to = null;
    let cost = 0;

    if (kind === 'random') {
        to = pickRandom(world, FOUNTAINS, gameObject);
    } else if (kind === 'deep') {
        to = pickRandom(world, WELLS, gameObject);
        cost = DEEP_WISH_COST;
    } else if (kind === 'town') {
        const town = await chooseTown(player, towns);

        if (town) {
            to = { x: town.fountain[0], y: town.fountain[1], landing: getLanding(...town.fountain) };
            cost = TOWN_COST;
        }
    }

    if (!to) {
        return true;
    }

    // the menu waits on the player: check again before taking anything
    if (player.opponent || getCooldownLeft(player) > 0) {
        return true;
    }

    if (!player.inventory.has(COINS_ID, cost)) {
        player.message(`You need ${cost} coin${cost === 1 ? '' : 's'} for that wish`);
        return true;
    }

    if (!checkCarried(player, here, getTownAt(world, to))) {
        return true;
    }

    if (cost) {
        player.inventory.remove(COINS_ID, cost);
    }

    player.cache.wishingFountainAt = Date.now();

    if (kind === 'random') {
        player.message('You make a wish...');
    } else if (kind === 'deep') {
        player.message(`You toss ${DEEP_WISH_COST} coins into the fountain and make a deep wish`);
    } else {
        player.message(`You toss a coin into the ${water} and wish for ${getTownAt(world, to).name}`);
    }

    await world.sleepTicks(2);

    const [x, y] = to.landing;
    player.teleport(x, y, true);
    await world.sleepTicks(3);

    const arrived = getTownAt(world, to);
    const arrivedWater = kind === 'deep' || (arrived && arrived.well && kind === 'town') ? 'a well' : 'a fountain';
    player.message(arrived ? `You arrive by ${arrivedWater} in ${arrived.name}` : `You arrive by ${arrivedWater}`);

    // a gamble that lands in a new town adds it to the towns you can wish for
    if (arrived && !getUnlocked(player).includes(arrived.key)) {
        player.cache.wishingFountains = [...getUnlocked(player), arrived.key];
        player.message(`You will remember the way back to ${arrived.name}`);
    }

    return true;
}

// "Make a wish" (the clients relabel the fountain's and well's first command) or coins used on it
async function onGameObjectCommandOne(player, gameObject) {
    if (!isWishingSpot(gameObject)) {
        return false;
    }

    await makeWish(player, gameObject);
    return true;
}

async function onUseWithGameObject(player, gameObject, item) {
    if (item.id !== COINS_ID || !isWishingSpot(gameObject)) {
        return false;
    }

    await makeWish(player, gameObject);
    return true;
}

// "Steal coin" (the relabelled second command): level 1 thieving takes one wished coin, then that fountain or well
// is empty for a minute
async function onGameObjectCommandTwo(player, gameObject) {
    if (!isWishingSpot(gameObject)) {
        return false;
    }

    const { world } = player;
    const water = gameObject.id === WELL_ID ? 'well' : 'fountain';
    const spot = `${gameObject.x}:${gameObject.y}`;

    if (player.opponent) {
        player.message("You can't do that whilst you are fighting");
        return true;
    }

    if (player.skills.thieving.current < STEAL_LEVEL) {
        player.message(`You need a thieving level of ${STEAL_LEVEL} to steal from this ${water}`);
        return true;
    }

    if (stolenUntil.has(spot) && stolenUntil.get(spot) > Date.now()) {
        player.message(`Someone has already fished the coins out of this ${water}`);
        return true;
    }

    player.message(`You reach into the ${water} for a wished coin`);
    await world.sleepTicks(2);

    if (stolenUntil.has(spot) && stolenUntil.get(spot) > Date.now()) {
        player.message(`Someone has already fished the coins out of this ${water}`);
        return true;
    }

    stolenUntil.set(spot, Date.now() + STEAL_RESPAWN_MS);
    player.inventory.add(COINS_ID, STEAL_COINS);
    player.addExperience('thieving', STEAL_EXPERIENCE);
    player.message(`You steal a coin from the ${water}`);

    return true;
}

module.exports = { onUseWithGameObject, onGameObjectCommandOne, onGameObjectCommandTwo };

Object.defineProperty(module.exports, 'fountains', {
    value: {
        FOUNTAINS,
        WELLS,
        TOWNS,
        COOLDOWN_MS,
        DEEP_WISH_COST,
        TOWN_RADIUS,
        STEAL_RESPAWN_MS,
        getTownAt,
        getLanding,
        stolenUntil
    },
    enumerable: false
});
