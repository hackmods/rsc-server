// Ported from Open-RSC Core-Framework authentic/skills/firemaking/Firemaking.java (AGPL-3.0)

// https://classic.runescape.wiki/w/Firemaking

// https://oldschool.runescape.wiki/w/Fire#cite_note-1
// > Mod Ash: "[How long do fires last roughly (or precisely if you wish to be
// > so kind)?] 60-119 secs randomly."

// Authentic path only: normal logs (14) light. Oak, willow, maple, yew and magic logs do not burn here; Open-RSC only
// lights them under CUSTOM_FIREMAKING, which is not ported. A tinderbox on one of them on the ground says
// "Nothing interesting happens", as the Java non-custom path does.

const GameObject = require('../../model/game-object');
const GroundItem = require('../../model/ground-item');

const ASHES_ID = 181;
const FIRE_ID = 97;
const LOGS_ID = 14;
const TINDERBOX_ID = 166;

// Java LOGS array: the other log types that blockUseObj claims on the ground (oak, willow, maple, yew, magic)
const CUSTOM_LOG_IDS = new Set([632, 633, 634, 635, 636]);

// Java FiremakingDef length for normal logs (90 s) and Formulae.lightLogs (stop failing at level 60)
const FIRE_LENGTH_MS = 90 * 1000;
const LEVEL_STOP_FAIL = 60;

// Java Formulae.calcProductionSuccessfulLegacy(1, level, true, 60): a 1-256 roll succeeds at or below a threshold that
// starts at 64/256 at level 1 and reaches 256 by level 60.
function lightLogs(level) {
    const threshold = Math.min(
        256,
        Math.floor(64 + (level - 1) * (19200 / (LEVEL_STOP_FAIL * 98)))
    );
    const roll = Math.floor(Math.random() * 256) + 1;

    return roll <= threshold;
}

async function onUseWithGroundItem(player, groundItem, item) {
    if (item.id !== TINDERBOX_ID) {
        return false;
    }

    if (CUSTOM_LOG_IDS.has(groundItem.id)) {
        player.message('@que@Nothing interesting happens');
        return true;
    }

    if (groundItem.id !== LOGS_ID) {
        return false;
    }

    const { world } = player;
    const { x, y } = groundItem;

    const indoors = !!world.landscape.getTileAtGameCoords(x, y).getTileDef()
        .indoors;

    if (indoors || world.gameObjects.getAtPoint(x, y).length) {
        player.message("@que@You can't light a fire here");
        return true;
    }

    player.sendBubble(TINDERBOX_ID);
    player.message('@que@You attempt to light the logs');
    await world.sleepTicks(3);

    const maxLevel = player.skills.firemaking.base;

    if (lightLogs(player.skills.firemaking.current)) {
        player.message('@que@The fire catches and the logs begin to burn');
        world.removeEntity('groundItems', groundItem);

        const fire = new GameObject(world, {
            id: FIRE_ID,
            x,
            y,
            direction: 0
        });

        world.setTimeout(() => {
            world.removeEntity('gameObjects', fire);
            const ashes = new GroundItem(world, { id: ASHES_ID, x, y });
            world.addEntity('groundItems', ashes);
        }, FIRE_LENGTH_MS);

        world.addEntity('gameObjects', fire);
        // Java Firemaking.getExp(maxStat, 25) = (25 + maxStat * 1.75) * 4, quarter points
        player.addExperience('firemaking', Math.floor((25 + maxLevel * 1.75) * 4));
    } else {
        player.message('@que@You fail to light a fire');
    }

    return true;
}

async function onUseWithInventory(player, item, targetItem) {
    if (
        !(item.id === LOGS_ID && targetItem.id === TINDERBOX_ID) &&
        !(item.id === TINDERBOX_ID && targetItem.id === LOGS_ID)
    ) {
        return false;
    }

    // who's talking to the player??
    player.message(
        '@que@I think you should put the logs down before you light them!'
    );

    return true;
}

module.exports = { onUseWithGroundItem, onUseWithInventory };
