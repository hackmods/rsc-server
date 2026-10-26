// Ported from Open-RSC authentic/npcs/gutanoth/OgreTrader.java (AGPL-3.0)
// Ogre trader (Gu Tanoth general store, rsc-data id 687): talk that opens 'ogre-trader-general'.
const exchange = require('../../../exchange'); // ARSC Grand Exchange

const OGRE_TRADER_ID = 687;

async function onTalkToNPC(player, npc) {
    if (npc.id !== OGRE_TRADER_ID) {
        return false;
    }

    player.engage(npc);

    await npc.say("What the human be wantin'");

    const choice = await exchange.ask(player, npc, ['Can I see what you are selling ?', "I don't need anything"], true);

    if (choice === exchange.CHOSEN) {
        return true; // ARSC Grand Exchange
    }

    if (choice === 0) {
        await npc.say('I suppose so...');
        player.disengage();
        player.openShop('ogre-trader-general');
        return true;
    }

    await npc.say('As you wish');
    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
