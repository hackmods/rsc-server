// ARSC mining plugin (installed by services/rsc-server/patches/mining-plugin.js)
// https://classic.runescape.wiki/w/Mining
// Modelled on skills/woodcutting.js: one attempt per click, 3 tick delay.

require('../../data-fixes'); // corrects the Shilo gem rock (588) and Witchaven gold rock (315) rows before DEPLETED_IDS is built
const items = require('@2003scape/rsc-data/config/items');
const objects = require('@2003scape/rsc-data/config/objects');
const { pickaxes, gem, rocks } = require('@2003scape/rsc-data/skills/mining');
const { rollSkillSuccess } = require('../../rolls');

// rocks without a roll in rsc-data (copper, tin, clay)
const DEFAULT_ROLL = [100, 350];

// "rocks1" depleted rock object. rsc-data's per-rock "depleted" ids point at
// unrelated objects (tables, beds...), so they are only used when the object
// really is a rock model.
const FALLBACK_DEPLETED_ID = 98;

// 1 in 256 successful swings turns up a gem instead of the ore
const GEM_CHANCE = 1 / 256;

const ROCK_IDS = new Set(Object.keys(rocks).map(Number));

function getDefinition(id) {
    const rock = rocks[id];

    if (typeof rock.reference !== 'undefined') {
        return getDefinition(rock.reference);
    }

    return rock;
}

function getDepletedID(rock) {
    const definition = objects[rock.depleted];

    if (
        definition &&
        definition.model &&
        /^rocks[0-9]*$/i.test(definition.model.name)
    ) {
        return rock.depleted;
    }

    return FALLBACK_DEPLETED_ID;
}

const DEPLETED_IDS = new Set([FALLBACK_DEPLETED_ID]);

for (const id of ROCK_IDS) {
    DEPLETED_IDS.add(getDepletedID(getDefinition(id)));
}

// ARSC: plain "Rock"/"Rocks" with a Mine option and no row in rsc-data (the scenery rocks around mines, 99, 164-172,
// 497, 515-523, 532-552 ...) are empty: they say so instead of "Nothing interesting happens". Named ones (Daconia rock,
// Rock of Dalgroth, Rockslide) and other models (mossy rock 555) belong to their quests.
objects.forEach((definition, id) => {
    if (
        definition &&
        /^rocks?$/i.test(definition.name) &&
        /^rocks[0-9]*$/i.test((definition.model && definition.model.name) || '') &&
        (definition.commands || []).some((command) => /^mine$/i.test(command)) &&
        !ROCK_IDS.has(id)
    ) {
        DEPLETED_IDS.add(id);
    }
});

// pick from a [{ id, weight }] table
function rollWeighted(table) {
    let total = 0;

    for (const { weight } of table) {
        total += weight;
    }

    let roll = Math.random() * total;

    for (const { id, weight } of table) {
        if (roll < weight) {
            return id;
        }

        roll -= weight;
    }

    return table[table.length - 1].id;
}

function rollOre(rock) {
    return Array.isArray(rock.ore) ? rollWeighted(rock.ore) : rock.ore;
}

function getRespawn(rock) {
    const { respawn } = rock;

    if (typeof respawn === 'number') {
        return respawn;
    }

    const min = respawn.min;
    const max = respawn.max;

    return Math.floor(min + Math.random() * (max - min + 1));
}

function itemName(id) {
    return items[id].name.toLowerCase();
}

// best usable pickaxe is the one with the most attempts at our mining level.
// returns { id, attempts } or { lowest } (level of the lowest owned pickaxe
// we are too low to use) or null if we carry no pickaxe at all
function getBestPickaxe(player, miningLevel) {
    let best = null;
    let lowestLevel = -1;

    for (const [key, { level, attempts }] of Object.entries(pickaxes)) {
        const id = Number(key);

        if (!player.inventory.has(id)) {
            continue;
        }

        if (level > miningLevel) {
            if (lowestLevel === -1 || level < lowestLevel) {
                lowestLevel = level;
            }

            continue;
        }

        if (!best || attempts > best.attempts) {
            best = { id, attempts };
        }
    }

    if (best) {
        return best;
    }

    return lowestLevel === -1 ? null : { lowest: lowestLevel };
}

async function prospect(player, gameObject, rock) {
    const { world } = player;
    const { x, y } = gameObject;

    player.message('@que@You examine the rock for ores...');

    await world.sleepTicks(3);

    if (world.gameObjects.getAtPoint(x, y)[0] !== gameObject) {
        player.message(
            '@que@There is currently no ore available in this rock'
        );

        return true;
    }

    let oreID;

    if (Array.isArray(rock.ore)) {
        // the most common drop of a mixed rock
        oreID = rock.ore.reduce((a, b) => (b.weight > a.weight ? b : a)).id;
    } else {
        oreID = rock.ore;
    }

    player.message('@que@This rock contains ' + itemName(oreID));

    return true;
}

async function mine(player, gameObject, rockID, rock) {
    const miningLevel = player.skills.mining.current;

    if (rock.level > miningLevel) {
        player.message(
            '@que@You need a mining level of ' +
                rock.level +
                ' to mine this rock'
        );

        return true;
    }

    const pickaxe = getBestPickaxe(player, miningLevel);

    if (!pickaxe) {
        player.message('@que@You need a pickaxe to mine this rock');
        return true;
    }

    if (pickaxe.lowest) {
        player.message(
            '@que@You need a mining level of ' +
                pickaxe.lowest +
                ' to use this pickaxe'
        );

        return true;
    }

    if (player.isTired()) {
        player.message('@que@You are too tired to mine this rock');
        return true;
    }

    const { world } = player;
    const { x, y } = gameObject;

    player.message('@que@You swing your pick at the rock...');
    player.sendBubble(pickaxe.id);

    await world.sleepTicks(3);

    if (world.gameObjects.getAtPoint(x, y)[0] !== gameObject) {
        player.message(
            '@que@There is currently no ore available in this rock'
        );

        return true;
    }

    const roll = rock.roll || DEFAULT_ROLL;

    // attempts is how many times the pickaxe rolls before giving up
    let success = false;

    for (let i = 0; i < pickaxe.attempts && !success; i += 1) {
        success = rollSkillSuccess(roll[0], roll[1], miningLevel);
    }

    if (!success) {
        player.message('@que@You only succeed in scratching the rock');
        return true;
    }

    const isGem = Math.random() < GEM_CHANCE;
    const oreID = isGem ? rollWeighted(gem) : rollOre(rock);

    const depleted = world.replaceEntity(
        'gameObjects',
        gameObject,
        getDepletedID(rock)
    );

    world.setTimeout(() => {
        world.replaceEntity('gameObjects', depleted, rockID);
    }, getRespawn(rock));

    player.addExperience('mining', rock.experience);

    if (isGem) {
        player.message(
            '@que@You just found a ' + itemName(oreID).replace('uncut ', '') + '!'
        );
    } else {
        player.message('@que@You manage to obtain some ' + itemName(oreID));
    }

    player.inventory.add(oreID);

    return true;
}

// object 770 "Rocks": not a mining rock. Any pickaxe breaks off an item
// (Open-RSC Mining.java), no level check, no experience, no depletion.
const ROCKS_OBJECT_ID = 770;
const ROCKS_ITEM_ID = 986;

async function mineLargeRocks(player) {
    const hasPickaxe = Object.keys(pickaxes).some((id) =>
        player.inventory.has(Number(id))
    );

    if (!hasPickaxe) {
        player.message('@que@You need a pickaxe to mine this rock');
        return true;
    }

    const { world } = player;

    player.message('@que@You mine the rock');
    await world.sleepTicks(3);
    player.message('@que@and break of several large chunks');
    await world.sleepTicks(3);
    player.inventory.add(ROCKS_ITEM_ID);

    return true;
}

async function doMining(player, gameObject, index) {
    const command = String(
        gameObject.definition.commands[index] || ''
    ).toLowerCase();

    if (command !== 'mine' && command !== 'prospect') {
        return false;
    }

    const rockID = gameObject.id;

    if (rockID === ROCKS_OBJECT_ID) {
        return command === 'mine' ? await mineLargeRocks(player) : false;
    }

    if (!ROCK_IDS.has(rockID)) {
        if (DEPLETED_IDS.has(rockID)) {
            player.message(
                '@que@There is currently no ore available in this rock'
            );

            return true;
        }

        return false;
    }

    const rock = getDefinition(rockID);

    if (command === 'prospect') {
        return await prospect(player, gameObject, rock);
    }

    return await mine(player, gameObject, rockID, rock);
}

async function onGameObjectCommandOne(player, gameObject) {
    return await doMining(player, gameObject, 0);
}

async function onGameObjectCommandTwo(player, gameObject) {
    return await doMining(player, gameObject, 1);
}

module.exports = { onGameObjectCommandOne, onGameObjectCommandTwo };
