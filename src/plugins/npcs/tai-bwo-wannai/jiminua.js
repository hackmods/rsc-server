// Ported from Open-RSC authentic/npcs/shilo/Jiminua.java (AGPL-3.0)
// Jiminua (Tai Bwo Wannai): jungle store talk that opens 'tai-bwo-wannai-general'. No quest gate in the Java.
const exchange = require('../../../exchange'); // ARSC Grand Exchange

const JIMINUA_ID = 522;

async function onTalkToNPC(player, npc) {
    if (npc.id !== JIMINUA_ID) {
        return false;
    }

    player.engage(npc);

    await npc.say('Welcome to the Jungle Store, Can I help you at all?');

    const choice = await exchange.ask(player, npc, ['Yes please. What are you selling?', 'No thanks'], true);

    if (choice === exchange.CHOSEN) {
        return true; // ARSC Grand Exchange
    }

    if (choice === 0) {
        await npc.say('Take yourself a good look');
        player.disengage();
        player.openShop('tai-bwo-wannai-general');
        return true;
    }

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
