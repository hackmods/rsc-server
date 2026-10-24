// ARSC Tutorial Island: shared state and hooks. Stage numbers follow
// OpenRSC's authentic tutorial plugins; see docs/TUTORIAL_ISLAND_SPEC.md in
// Autonomous-RSC for the full stage table.
//
// This file is not a plugin (it is left out of plugins/index.js); the hook
// files beside it and the upstream call sites require it directly.

const log = require('bole')('tutorial');
const regions = require('@2003scape/rsc-data/regions');

const NPC = {
    GUIDE: 476,
    CONTROLS_GUIDE: 499,
    COMBAT: 474,
    COOKING: 478,
    FINANCE: 480,
    FISHING: 479,
    MINING: 482,
    BANK: 485,
    QUEST: 489,
    WILDERNESS: 493,
    MAGIC: 494,
    FATIGUE: 774,
    COMMUNITY: 496,
    BOATMAN: 497,
    RAT: 473,
    CHICKEN: 3
};

const ITEM = {
    BRONZE_LONG_SWORD: 70,
    WOODEN_SHIELD: 4,
    RAW_RAT_MEAT: 503,
    COOKED_MEAT: 132,
    BURNT_MEAT: 134,
    NET: 376,
    RAW_SHRIMP: 349,
    BRONZE_PICKAXE: 156,
    TIN_ORE: 202,
    AIR_RUNE: 33,
    MIND_RUNE: 35,
    SLEEPING_BAG: 1263,
    COINS: 10
};

// items that only exist for the tutorial; complete() takes them back
const TUTORIAL_ITEMS = [
    ITEM.RAW_RAT_MEAT,
    ITEM.COOKED_MEAT,
    ITEM.BURNT_MEAT,
    ITEM.RAW_SHRIMP,
    ITEM.TIN_ORE,
    ITEM.AIR_RUNE,
    ITEM.MIND_RUNE,
    ITEM.SLEEPING_BAG
];

const BOUNDS = { minX: 190, maxX: 240, minY: 715, maxY: 770 };
const START = { x: 216, y: 744 };

// gated doors: wall object id, tile, stage needed, refusal (OpenRSC
// DoorAction.java)
const DOORS = [
    [75, 222, 743, 10, 'You should speak to a guide before going through this door'],
    [76, 224, 737, 15, 'Speak to the controls guide before going through this door'],
    [77, 220, 727, 25, 'Speak to the combat instructor before going through this door'],
    [78, 212, 729, 35, 'You should speak to a cooking instructor before going through this door'],
    [80, 206, 730, 40, 'You should speak to a finance advisor before going through this door'],
    [81, 201, 734, 45, 'You should speak to the fishing instructor before going through this door'],
    [82, 198, 746, 55, 'You should speak to the mining instructor before going through this door'],
    [83, 204, 752, 60, 'You should speak to a bank assistant before going through this door'],
    [84, 209, 754, 65, 'You should speak to the quest advisor before going through this door'],
    [85, 217, 760, 70, 'You should speak to the wilderness guide before going through this door'],
    [88, 222, 760, 80, 'You should speak to a magic instructor before going through this door'],
    [89, 226, 760, 90, 'You should speak to a fatigue expert before going through this door'],
    [90, 230, 759, 100, 'You should speak to the community instructor before going through this door']
].map(([id, x, y, stage, refusal]) => ({ id, x, y, stage, refusal }));

const ISLAND_NPCS = new Set(
    Object.values(NPC).filter((id) => id !== NPC.RAT && id !== NPC.CHICKEN)
);

function inBounds(x, y) {
    return (
        x >= BOUNDS.minX && x <= BOUNDS.maxX && y >= BOUNDS.minY && y <= BOUNDS.maxY
    );
}

function onTutorial(player) {
    return Number.isInteger(player.cache.tutorial);
}

function stage(player) {
    return onTutorial(player) ? player.cache.tutorial : -1;
}

// stages only move forward, and only for players on the tutorial
function setStage(player, n) {
    if (!onTutorial(player) || n <= player.cache.tutorial) {
        return;
    }

    log.info(`${player} tutorial ${player.cache.tutorial} -> ${n}`);
    player.cache.tutorial = n;
}

// hand over a tutorial item; a single unstackable item is not duplicated
function give(player, id, amount = 1) {
    if (amount === 1 && player.inventory.has(id)) {
        return false;
    }

    player.inventory.add(id, amount);
    return true;
}

function grantStarterKit(player) {
    try {
        require('../../world-admin').grantStarterKit(player);
    } catch (e) {
        log.error(e);
    }
}

// boatman and skip: off the island, tutorial items gone, starter kit given
async function complete(player) {
    if (!onTutorial(player)) {
        return false;
    }

    for (const id of TUTORIAL_ITEMS) {
        while (player.inventory.has(id)) {
            const index = player.inventory.items.findIndex((i) => i.id === id);
            const { amount } = player.inventory.items[index];
            player.inventory.remove(id, amount);
        }
    }

    delete player.cache.tutorial;
    player.cache.tutorialDone = Date.now();

    const { spawnX, spawnY } = regions.lumbridge;
    player.teleport(spawnX, spawnY, false);
    player.message('@que@Welcome to Lumbridge! You can now explore the world');

    grantStarterKit(player);

    try {
        await player.save();
    } catch (e) {
        log.error(e);
    }

    log.info(`${player} finished the tutorial`);
    return true;
}

// player.login(): a human's first ever login starts on the island. bots
// identify themselves with the X-ARSC-Bot header (see server.js)
function onFirstLogin(player) {
    if (player.loginDate || player.cache.tutorialDone || onTutorial(player)) {
        return;
    }

    if (player.socket && player.socket.arscBot) {
        return;
    }

    player.cache.tutorial = 0;
    player.x = START.x;
    player.y = START.y;
    log.info(`${player} starts on Tutorial Island`);
}

// player.die(): nobody loses anything or leaves the island mid-tutorial.
// returns true when handled
function onDeath(player) {
    if (!onTutorial(player)) {
        return false;
    }

    player.teleport(START.x, START.y, false);
    player.message('@que@Oh dear, you have died. You keep your items on the island');
    return true;
}

// player.damage(): on the tutorial, hits never drop below 1
function safeDamage(player, damage) {
    if (!onTutorial(player)) {
        return damage;
    }

    return Math.max(0, Math.min(damage, player.skills.hits.current - 1));
}

// player.exitSleep(): the fatigue expert's lesson
function onWake(player, refreshed) {
    if (refreshed && stage(player) === 85) {
        setStage(player, 86);
        player.message('@que@Now go and speak to the fatigue expert again');
    }
}

// world load: one of each instructor (rsc-data lists three) and only the
// gated door on each door tile
function init(world) {
    const seen = new Set();

    for (const npc of [...world.npcs.entities]) {
        if (!npc || !ISLAND_NPCS.has(npc.id) || !inBounds(npc.x, npc.y)) {
            continue;
        }

        if (seen.has(npc.id)) {
            delete npc.respawn;
            world.removeEntity('npcs', npc);
        } else {
            seen.add(npc.id);
        }
    }

    for (const door of DOORS) {
        const atPoint = world.wallObjects.getAtPoint(door.x, door.y);

        if (!atPoint.some((w) => w.id === door.id)) {
            const WallObject = require('../../model/wall-object');
            const direction = atPoint.length ? atPoint[0].direction : 0;

            world.addEntity(
                'wallObjects',
                new WallObject(world, { ...door, direction })
            );
        }
    }

    log.info('tutorial island ready');
}

function getDoor(wallObject) {
    return DOORS.find(
        (d) => d.id === wallObject.id && d.x === wallObject.x && d.y === wallObject.y
    );
}

module.exports = {
    NPC,
    ITEM,
    BOUNDS,
    START,
    DOORS,
    TUTORIAL_ITEMS,
    inBounds,
    onTutorial,
    stage,
    setStage,
    give,
    complete,
    onFirstLogin,
    onDeath,
    safeDamage,
    onWake,
    init,
    getDoor
};
