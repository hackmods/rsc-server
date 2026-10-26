// Ported from Open-RSC authentic/npcs/ardougne/west/Chadwell.java (AGPL-3.0)
// West Ardougne general store owner Chadwell (NPC 661): talk, then open the west-ardougne-general shop.
const exchange = require('../../../exchange'); // ARSC Grand Exchange

const CHADWELL_ID = 661;

async function onTalkToNPC(player, npc) {
    if (npc.id !== CHADWELL_ID) {
        return false;
    }

    player.engage(npc);

    await player.say('hello there');
    await npc.say('good day, what can i get you?');

    const choice = await exchange.ask(player, npc,
        ['nothing thanks, just browsing', "lets see what you've got"],
        false
    );

    if (choice === exchange.CHOSEN) {
        return true; // ARSC Grand Exchange
    }

    // the shop is option 1: services/rsc-agents/scripts/gen-shop-openers.js reads the
    // option path from the `if (choice === N)` around openShop
    if (choice === 1) {
        await player.say("let's see what you've got then");
        player.disengage();
        player.openShop('west-ardougne-general');
        return true;
    }

    await player.say('nothing thanks');
    await npc.say('ok then');
    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
