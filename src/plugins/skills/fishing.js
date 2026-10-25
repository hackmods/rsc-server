// https://classic.runescape.wiki/w/Fishing
// Big net fishing ported from Open-RSC Core-Framework
// authentic/skills/fishing/Fishing.java (AGPL-3.0)

require('../../data-fixes'); // the spot 261 seaweed row is 622 in rsc-data once corrected
const items = require('@2003scape/rsc-data/config/items');
const { rollCascadedSkillSuccess } = require('../../rolls');
const { spots } = require('@2003scape/rsc-data/skills/fishing');

const BIG_NET_ID = 548;
const FEATHER_ID = 381;

// Open-RSC defs/extras/ObjectFishing.xml spot 261 (big net). The rates are
// independent per fish (not cascaded), lowRate/highRate are x/256 at level 1
// and 99. rsc-data's rolls differ here, so Open-RSC's numbers are used. The
// seaweed id is 622 in Open-RSC (raw rsc-data lists 662, which is an
// unstrung maple longbow).
const BIG_NET_CATCHES = [
    { id: 554, level: 46, experience: 400, low: 6, high: 31, rolls: 1, message: 'a bass' },
    { id: 550, level: 23, experience: 180, low: 10, high: 41, rolls: 1, message: 'a cod' },
    { id: 552, level: 16, experience: 80, low: 14, high: 48, rolls: 2, message: 'a mackerel' },
    { id: 793, level: 16, experience: 40, low: 2, high: 5, rolls: 1, message: 'an oyster shell' },
    { id: 549, level: 16, experience: 40, low: 0, high: 1, rolls: 1, message: 'a casket' },
    { id: 17, level: 16, experience: 4, low: 8, high: 8, rolls: 1, message: 'some boots' },
    { id: 16, level: 16, experience: 4, low: 4, high: 4, rolls: 1, message: 'some gloves' },
    { id: 622, level: 16, experience: 4, low: 8, high: 8, rolls: 1, message: 'some seaweed' }
];

// Formulae.interp: chance in [0, 1] for a fish at the given level
function interpRate(low, high, level) {
    const value =
        Math.floor((low * (99 - level)) / 98) +
        Math.floor((high * (level - 1)) / 98) +
        1;

    return Math.min(Math.max(value / 256, 0), 1);
}

// returns { caught, rolls } like Fishing.doBigNetFishingRoll
function rollBigNet(level) {
    const caught = [];
    let rolls = 0;

    for (const fish of BIG_NET_CATCHES) {
        if (level < fish.level) {
            continue;
        }

        for (let i = 0; i < fish.rolls; i += 1) {
            rolls += 1;

            if (interpRate(fish.low, fish.high, level) > Math.random()) {
                caught.push(fish);
            }
        }
    }

    return { caught, rolls };
}

function getSpot(id, command) {
    let spot = spots[id];

    if (!spot) {
        return false;
    }

    if (spot.reference) {
        return getSpot(spot.reference, command);
    }

    return spot[command];
}

async function doFishing(player, gameObject, index) {
    const command = gameObject.definition.commands[index].toLowerCase();
    const spot = getSpot(gameObject.id, command);

    if (!spot) {
        return false;
    }

    if (player.isTired()) {
        player.message('You are too tired to catch this fish');
        return true;
    }

    const fishingLevel = player.skills.fishing.current;
    const { tool, bait, fish } = spot;

    let catchable = [];
    let minimumLevel = 99;

    for (const [fishID, { level, experience }] of Object.entries(fish)) {
        if (level < minimumLevel) {
            minimumLevel = level;
        }

        if (fishingLevel >= level) {
            catchable.push({ id: +fishID, level, experience });
        }
    }

    if (!catchable.length) {
        const action =
            command === 'cage' ? 'catch lobsters' : `${command} these fish`;

        player.message(
            `@que@You need at least level ${minimumLevel} fishing to ${action}`
        );

        return true;
    }

    if (!player.inventory.has(tool)) {
        let action;

        if (command === 'cage') {
            action = 'cage lobsters';
        } else if (/^(lure|bait)$/.test(command)) {
            action = `${command} these fish`;
        } else {
            action = 'catch these fish';
        }

        player.message(
            `@que@You need a ${items[tool].name.toLowerCase()} to ${action}`
        );

        return true;
    }

    if (typeof bait === 'number' && !player.inventory.has(bait)) {
        const baitName =
            bait === FEATHER_ID ? 'feathers' : items[bait].name.toLowerCase();

        player.message(`@que@You don't have any ${baitName} left`);
        return true;
    }

    const { world } = player;

    catchable = catchable.sort((a, b) => {
        if (a.level === b.level) {
            return 0;
        }

        return a.level > b.level ? -1 : 1;
    });

    player.sendSound('fish');
    player.sendBubble(tool);

    if (typeof bait === 'number') {
        player.inventory.remove(bait);
    }

    let catching;

    if (command === 'net' && tool !== BIG_NET_ID) {
        catching = 'some fish';
    } else if (command === 'cage') {
        catching = 'a lobster';
    } else {
        catching = 'a fish';
    }

    player.message(`@que@You attempt to catch ${catching}`);

    await world.sleepTicks(3);

    if (tool !== BIG_NET_ID) {
        const rolls = catchable.map(({ id }) => fish[id].roll);
        const caughtIndex = rollCascadedSkillSuccess(rolls, fishingLevel);

        if (caughtIndex > -1) {
            const { id, experience } = catchable[caughtIndex];
            player.addExperience('fishing', experience);
            player.inventory.add(id);

            const fishName =
                (command === 'net' ? 'some ' : 'a ') +
                items[id].name.toLowerCase().replace('raw ', '');

            player.message(`@que@You catch ${fishName}`);
        } else {
            player.message(`@que@You fail to catch anything`);
        }
    } else {
        const { caught, rolls } = rollBigNet(fishingLevel);

        for (const fish of caught) {
            player.message(`@que@You catch ${fish.message}`);
            player.inventory.add(fish.id);
            player.addExperience('fishing', fish.experience);
        }

        // Open-RSC: only reports a failure when every possible roll was made
        if (!caught.length && rolls === 9) {
            player.message('@que@You fail to catch anything');
        }
    }

    return true;
}

async function onGameObjectCommandOne(player, gameObject) {
    return await doFishing(player, gameObject, 0);
}

async function onGameObjectCommandTwo(player, gameObject) {
    return await doFishing(player, gameObject, 1);
}

module.exports = { onGameObjectCommandOne, onGameObjectCommandTwo };
