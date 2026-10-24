// The customs official on Brimhaven's pier sells the ferry back to Ardougne.
// https://classic.runescape.wiki/w/Transcript:Customs_Official

const CUSTOMS_OFFICIAL_ID = 317;

// the Brimhaven pier ships
const SHIP_IDS = new Set([320, 321]);

const FARE = 30;
const COINS_ID = 10;

// walkable dock tile on the Ardougne harbour
const ARDOUGNE_LANDING = { x: 535, y: 615 };

async function talkToOfficial(player, npc) {
    const { world } = player;

    await npc.say(
        'Do you want to go back to Ardougne?',
        `The boarding charge is ${FARE} gold`
    );

    const choice = await player.ask(['Ok', "Oh, I'll not bother then"], true);

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
        player.teleport(ARDOUGNE_LANDING.x, ARDOUGNE_LANDING.y);
        await world.sleepTicks(2);
        player.message('@que@The ship arrives at Ardougne');
    } else {
        await player.say("Oh dear I don't seem to have enough money");
    }
}

async function onTalkToNPC(player, npc) {
    if (npc.id !== CUSTOMS_OFFICIAL_ID) {
        return false;
    }

    player.engage(npc);

    try {
        await talkToOfficial(player, npc);
    } finally {
        player.disengage();
    }

    return true;
}

async function onGameObjectCommandOne(player, gameObject) {
    if (!SHIP_IDS.has(gameObject.id)) {
        return false;
    }

    const { world } = player;

    const [official] = Array.from(world.npcs.getAllByID(CUSTOMS_OFFICIAL_ID))
        .filter((npc) => {
            return (
                !npc.interlocutor && player.localEntities.known.npcs.has(npc)
            );
        })
        .sort((a, b) => a.getDistance(player) - b.getDistance(player));

    if (official) {
        player.engage(official);

        try {
            await talkToOfficial(player, official);
        } finally {
            player.disengage();
        }
    } else {
        player.message(
            '@que@I need to speak to the customs official before boarding ' +
                'the ship.'
        );
    }

    return true;
}

module.exports = { onTalkToNPC, onGameObjectCommandOne };
