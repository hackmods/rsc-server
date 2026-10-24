// Captain Barnaby runs the ferry from the Ardougne docks to Brimhaven.
// https://classic.runescape.wiki/w/Transcript:Captain_Barnaby

const CAPTAIN_BARNABY_ID = 316;

// the Ardougne dock ships reuse the Karamja ship object ids (155 and 157),
// which port-sarim/seamen.js also answers to
const SHIP_IDS = new Set([155, 157]);

const FARE = 30;
const COINS_ID = 10;

// walkable dock tile on Brimhaven's pier
const BRIMHAVEN_LANDING = { x: 467, y: 652 };

function isArdougneDock(gameObject) {
    return (
        gameObject.x >= 520 &&
        gameObject.x <= 545 &&
        gameObject.y >= 610 &&
        gameObject.y <= 625
    );
}

async function talkToBarnaby(player, npc) {
    const { world } = player;

    await npc.say(
        'Do you want to go on a trip to Brimhaven?',
        `The trip will cost you ${FARE} gold`
    );

    const choice = await player.ask(['Yes please', 'No thankyou'], true);

    if (choice !== 0) {
        return;
    }

    if (player.inventory.has(COINS_ID, FARE)) {
        player.inventory.remove(COINS_ID, FARE);
        player.lock();
        player.message(`@que@You pay ${FARE} gold`);
        await world.sleepTicks(2);
        player.message('@que@You board the ship');
        await world.sleepTicks(2);
        player.teleport(BRIMHAVEN_LANDING.x, BRIMHAVEN_LANDING.y);
        await world.sleepTicks(2);
        player.message('@que@The ship arrives at Brimhaven');
    } else {
        await player.say("Oh dear I don't seem to have enough money");
    }
}

async function onTalkToNPC(player, npc) {
    if (npc.id !== CAPTAIN_BARNABY_ID) {
        return false;
    }

    player.engage(npc);

    try {
        await talkToBarnaby(player, npc);
    } finally {
        player.disengage();
    }

    return true;
}

async function onGameObjectCommandOne(player, gameObject) {
    if (!SHIP_IDS.has(gameObject.id) || !isArdougneDock(gameObject)) {
        return false;
    }

    const { world } = player;

    const barnaby = world.npcs.getByID(CAPTAIN_BARNABY_ID);

    if (
        barnaby &&
        !barnaby.interlocutor &&
        player.localEntities.known.npcs.has(barnaby)
    ) {
        player.engage(barnaby);

        try {
            await talkToBarnaby(player, barnaby);
        } finally {
            player.disengage();
        }
    } else {
        player.message(
            '@que@I need to speak to the captain before boarding the ship.'
        );
    }

    return true;
}

// seamen.js is registered first and swallows every ship 155/157 click (telling
// Ardougne players to find Captain Tobias). Make it pass on the Ardougne dock
// ships so they reach Barnaby. world.loadPlugins() reads the exported function
// after every plugin has been required, so the wrapped version is the one used.
const seamen = require('../port-sarim/seamen.js');

if (!seamen.ardougneDockPatched) {
    const original = seamen.onGameObjectCommandOne;

    seamen.onGameObjectCommandOne = async function onGameObjectCommandOne(
        player,
        gameObject
    ) {
        if (SHIP_IDS.has(gameObject.id) && isArdougneDock(gameObject)) {
            return false;
        }

        return original.call(this, player, gameObject);
    };

    seamen.ardougneDockPatched = true;
}

module.exports = { onTalkToNPC, onGameObjectCommandOne };
