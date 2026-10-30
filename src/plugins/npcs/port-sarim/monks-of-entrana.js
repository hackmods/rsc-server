// Monks of Entrana: the free ferry between Port Sarim and Entrana. Nobody may
// carry weapons or armour onto the holy island, so the monk searches you first.
// https://classic.runescape.wiki/w/Transcript:Monk_of_Entrana

const MONK_IDS = new Set([212, 213, 215]);

// ships at the Port Sarim docks (238-240) and on Entrana (241-243)
const PORT_SARIM_SHIP_IDS = new Set([238, 239, 240]);
const ENTRANA_SHIP_IDS = new Set([241, 242, 243]);

// walkable dock tiles beside the ships
const ENTRANA_LANDING = { x: 418, y: 570 };
const PORT_SARIM_LANDING = { x: 264, y: 659 };

// Entrana's region starts at x=395; the mainland docks are far to the west
function isOnEntrana(player) {
    return player.x >= 395 && player.x <= 525 && player.y >= 441;
}

// weapons and armour: anything wieldable that adds to a combat bonus
function isForbiddenItem(item) {
    const wieldable = item.definition && item.definition.wieldable;

    return (
        wieldable &&
        (wieldable.armour > 0 ||
            wieldable.weaponAim > 0 ||
            wieldable.weaponPower > 0)
    );
}

function carriesForbidden(player) {
    for (const item of player.inventory.items) {
        if (isForbiddenItem(item)) {
            return true;
        }
    }

    return false;
}

async function sail(player, destination, name) {
    const { world } = player;

    player.lock();
    player.message('@que@You board the ship');
    await world.sleepTicks(2);
    player.teleport(destination.x, destination.y);
    await world.sleepTicks(2);
    player.message(`@que@The ship arrives at ${name}`);
}

async function talkToMonk(player, npc) {
    if (isOnEntrana(player)) {
        await npc.say('Are you looking to take passage back to the mainland?');

        const choice = await player.ask(["No I'm not", 'Yes please'], true);

        if (choice === 1) {
            await npc.say('Okay, hold tight');
            await sail(player, PORT_SARIM_LANDING, 'Port Sarim');
        }

        return;
    }

    await npc.say('Do you seek passage to holy Entrana?');

    const choice = await player.ask(["No I'm not", 'Yes please'], true);

    if (choice !== 1) {
        return;
    }

    await npc.say(
        'Very well, but first I must search you',
        'NO WEAPONS OR ARMOUR are permitted on holy Entrana'
    );

    if (carriesForbidden(player)) {
        await npc.say(
            'I am afraid you are carrying weapons or armour',
            'You may not board until you have left them behind'
        );
        player.message('@que@The monk refuses to let you board');
        return;
    }

    await npc.say('Okay, you seem to be clean', 'Please board the ship');
    await sail(player, ENTRANA_LANDING, 'Entrana');
}

async function onTalkToNPC(player, npc) {
    if (!MONK_IDS.has(npc.id)) {
        return false;
    }

    player.engage(npc);

    try {
        await talkToMonk(player, npc);
    } finally {
        player.disengage();
    }

    return true;
}

async function onGameObjectCommandOne(player, gameObject) {
    if (
        !PORT_SARIM_SHIP_IDS.has(gameObject.id) &&
        !ENTRANA_SHIP_IDS.has(gameObject.id)
    ) {
        return false;
    }

    const { world } = player;

    const [monk] = [...MONK_IDS]
        .flatMap((id) => Array.from(world.npcs.getAllByID(id)))
        .filter((npc) => {
            return (
                !npc.interlocutor && player.localEntities.known.npcs.has(npc)
            );
        })
        .sort((a, b) => a.getDistance(player) - b.getDistance(player));

    if (!monk) {
        player.message('@que@I need to speak to a monk before boarding.');
        return true;
    }

    player.engage(monk);

    try {
        await talkToMonk(player, monk);
    } finally {
        player.disengage();
    }

    return true;
}

module.exports = {
    onTalkToNPC,
    onGameObjectCommandOne,
    carriesForbidden,
    isForbiddenItem
};
