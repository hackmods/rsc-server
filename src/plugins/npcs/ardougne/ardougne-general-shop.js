// Ported from Open-RSC authentic/npcs/ardougne/east/ArdougneGeneralShop.java (AGPL-3.0)
// East Ardougne adventurers' shopkeepers (Aemad 336, Kortan 337): talk, then open the east-ardougne-adventurers shop.
const exchange = require('../../../exchange'); // ARSC Grand Exchange

const ADVENTURER_SHOP_IDS = new Set([336, 337]);

async function onTalkToNPC(player, npc) {
    if (!ADVENTURER_SHOP_IDS.has(npc.id)) {
        return false;
    }

    player.engage(npc);

    await npc.say(
        'Hello you look like a bold adventurer',
        "You've come to the right place for adventurer's equipment"
    );

    const choice = await exchange.ask(player, npc,
        ['Oh that sounds intersting', "No I've come to the wrong place"],
        false
    );

    if (choice === exchange.CHOSEN) {
        return true; // ARSC Grand Exchange
    }

    if (choice === 0) {
        await player.say('Oh that sounds interesting');
        player.disengage();
        player.openShop('east-ardougne-adventurers');
        return true;
    }

    await player.say("No I've come to the wrong place");
    await npc.say('Hmph');
    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
