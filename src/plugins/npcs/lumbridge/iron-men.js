// ARSC: the Iron Man tutors (Ironman, Ultimate Ironman, Hardcore Ironman), ported from Open-RSC
// plugins/authentic/npcs/tutorial/IronMan.java and InterfaceOptionHandler.handleIronmanMode. Spawns: arsc-locations.js
// (Open-RSC NpcLocsIronman.json: three by the Lumbridge spawn, an Ironman on Tutorial Island); NPC rows: src/arsc-npcs.
//
// Open-RSC opens its own Iron Man interface to pick the mode; the classic clients have none, so the same choice is a
// menu here with the same rules: on Tutorial Island any mode, freely; after it no upgrade ("You cannot become ... after
// leaving Tutorial Island"), and a standard downgrade only with a Bank PIN, which this server has not got, so the status
// is permanent. Admins set any mode with ::ironman <user> <mode> (packet-handlers/command.js).

const ironman = require('../../../ironman');
const { inBounds: onTutorialIsland } = require('../../tutorial/core');

const { MODES, ARMOUR } = ironman;

const TUTOR_IDS = new Set([794, 795, 796]);

const ABOUT = [
    'When you play as an Ironman, you do everything',
    "for yourself. You don't trade with other players, or take",
    'their items, or accept their help.',
    'As an Ironman, you choose to have these restrictions',
    "imposed on you, so everyone knows you're doing it",
    'properly.',
    'If you think you have what it takes, you can choose to',
    'become a Hardcore Ironman',
    'In addition to the standard restrictions,',
    'Hardcore Iron Men only have one life.',
    'In the event of a dangerious death, your Hardcore Iron Men status',
    'will be downgraded to that of a standard Ironman, and your',
    'stats will be frozen on the Hardcore Ironman hiscores.',
    'For the ultimate challenge, you can choose to become',
    'an Ultimate Ironman.',
    'In addition to the standard restrictions, Ultimate Iron',
    'Men are blocked from using the bank, and they drop all',
    'their items when they die.',
    "While you're on Tutorial Island, you can switch freely",
    'between being a standard Ironman, an Ultimate Ironman,',
    'a Hardcore Ironman or a normal player.',
    "Once you've left this island, you'll be able to find us in",
    "Lumbridge, but we'll only let you switch your",
    'restrictions downwards, not upwards.',
    'So we will let Hardcore Iron Men or Ultimate Iron Men',
    'downgrade to a standard Iron Men,',
    "and we'll let either Ironman types of Ironman become normal players."
];

// the mode menu (Open-RSC's interface rows), in mode order
const MODE_OPTIONS = ['None', 'Ironman', 'Ultimate Ironman', 'Hardcore Ironman'];

function itemName(id) {
    const items = require('@2003scape/rsc-data/config/items');
    return items[id] ? items[id].name : `item ${id}`;
}

// Functions.ifbankorheld
function bankOrHeld(player, id) {
    return (
        player.inventory.items.some((item) => item.id === id) ||
        (player.bank && player.bank.items.some((item) => item.id === id))
    );
}

function missing(player, part) {
    const set = ARMOUR[ironman.modeOf(player)];

    if (part === 'helm') {
        return !bankOrHeld(player, set.helm);
    }

    if (part === 'body') {
        return !bankOrHeld(player, set.body) && !bankOrHeld(player, set.top);
    }

    return !bankOrHeld(player, set.legs) && !bankOrHeld(player, set.skirt);
}

async function give(player, npc, id) {
    player.inventory.add(id);
    player.message(`${npc.definition.name} gives you a ${itemName(id)}`);
    await player.world.sleepTicks(3);
}

// IronMan.armourOption
async function armour(player, npc) {
    if (!ironman.isIronMan(player)) {
        await npc.say("You're not an Ironman.", 'Our armour is only for them.');
        return;
    }

    if (onTutorialIsland(player.x, player.y)) {
        await npc.say(
            "We'll give you your armour once you're off this island.",
            'Come and see us in Lumbridge.'
        );
        return;
    }

    if (!missing(player, 'helm') && !missing(player, 'body') && !missing(player, 'legs')) {
        await npc.say("I think you've already got the whole set.");
        return;
    }

    const set = ARMOUR[ironman.modeOf(player)];

    if (missing(player, 'helm')) {
        await give(player, npc, set.helm);
    }

    if (missing(player, 'body')) {
        let id = set.body;

        if (!player.isMale()) {
            await npc.say('Would you prefer a platebody or a plate top?');
            const choice = await player.ask(['Platebody please', 'Plate top please'], true);
            id = choice === 1 ? set.top : set.body;
        }

        await give(player, npc, id);
    }

    if (missing(player, 'legs')) {
        await npc.say('Would you prefer platelegs or a plated skirt?');
        const choice = await player.ask(['Platelegs please', 'Plated skirt please'], true);
        await give(player, npc, choice === 1 ? set.skirt : set.legs);
    }

    await npc.say('There you go. Wear it with pride.');
}

// InterfaceOptionHandler.handleIronmanMode, value 0 (change mode)
function changeMode(player, mode) {
    const current = ironman.modeOf(player);

    if (mode === current) {
        return false;
    }

    if (onTutorialIsland(player.x, player.y)) {
        ironman.setMode(player, mode);
        player.message(`You are now ${ironman.describe(mode)}.`);
        return true;
    }

    switch (mode) {
        case MODES.none:
        case MODES.ironman:
            if (mode === MODES.ironman && current <= MODES.none) {
                player.message('You cannot become an Ironman after leaving Tutorial Island.');
                return false;
            }

            // Open-RSC: IRON_MAN_RESTRICTION is 1 unless a Bank PIN was set on the island; no PINs here
            player.message('Your Ironman status is permanent and cannot be changed.');
            return false;
        case MODES.ultimate:
            player.message('You cannot become an Ultimate Ironman after leaving Tutorial Island.');
            return false;
        default:
            player.message('You cannot become a Hardcore Ironman after leaving Tutorial Island.');
            return false;
    }
}

async function reviewMode(player) {
    const current = ironman.modeOf(player);

    player.message(
        `Ironman mode: ${MODE_OPTIONS[current]}` +
            (onTutorialIsland(player.x, player.y) ? '' : ' (only downgrades after Tutorial Island)')
    );

    const options = [...MODE_OPTIONS.map((label, mode) => (mode === current ? `${label} (current)` : label)), 'Cancel'];
    const choice = await player.ask(options, false);

    if (choice < MODE_OPTIONS.length) {
        if (changeMode(player, choice)) {
            await player.save();
        }
    }
}

async function onTalkToNPC(player, npc) {
    if (!TUTOR_IDS.has(npc.id)) {
        return false;
    }

    player.engage(npc);

    const mode = ironman.modeOf(player);
    const greeting =
        mode === MODES.ironman
            ? 'Hail, Ironman!'
            : mode === MODES.ultimate
              ? 'Hail, Ultimate Ironman!'
              : mode === MODES.hardcore
                ? 'Hail, Hardcore Ironman!'
                : `Hello, ${player.getFormattedUsername()}. We're the Ironman tutors.`;

    await npc.say(greeting);
    await npc.say('What can we do for you?');

    const choice = await player.ask(
        [
            'Tell me about Iron Men.',
            `I'd like to ${onTutorialIsland(player.x, player.y) ? 'change' : 'review'} my Ironman mode.`,
            'Have you any armour for me, please?',
            "I'm fine, thanks."
        ],
        true
    );

    switch (choice) {
        case 0:
            await npc.say(...ABOUT);
            break;
        case 1:
            player.disengage();
            await reviewMode(player);
            return true;
        case 2:
            await armour(player, npc);
            break;
    }

    player.disengage();
    return true;
}

// the "Armour" option (IronMan.onOpNpc)
async function onNPCCommand(player, npc) {
    if (!TUTOR_IDS.has(npc.id)) {
        return false;
    }

    player.engage(npc);
    await armour(player, npc);
    player.disengage();

    return true;
}

// IronMan.onTakeObj: dropped armour is not picked back up; the tutors replace it
async function onGroundItemTake(player, groundItem) {
    if (!ironman.ARMOUR_MODE.has(groundItem.id)) {
        return false;
    }

    player.message("I'd better speak to an Ironman Npc for a replacement");
    return true;
}

module.exports = { onTalkToNPC, onNPCCommand, onGroundItemTake };
