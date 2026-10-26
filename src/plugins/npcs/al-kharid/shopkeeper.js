const exchange = require('../../../exchange'); // ARSC Grand Exchange
const SHOPKEEPER_IDS = new Set([87, 88]);

async function onTalkToNPC(player, npc) {
    if (!SHOPKEEPER_IDS.has(npc.id)) {
        return false;
    }

    player.engage(npc);

    await npc.say('Can I help you at all?');

    const choice = await exchange.ask(player, npc,
        ['Yes please. What are you selling?', 'No thanks'],
        true
    );

    if (choice === exchange.CHOSEN) {
        return true; // ARSC Grand Exchange
    }

    if (choice === 0) {
        await npc.say('Take a look');
        player.disengage();
        player.openShop('al-kharid-general');
        return true;
    }

    player.disengage();

    return true;
}

module.exports = { onTalkToNPC };
