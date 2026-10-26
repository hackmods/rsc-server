const exchange = require('../../exchange'); // ARSC Grand Exchange

async function canIHelpYou(player, npc, shop) {
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
        player.openShop(shop);
        return true;
    }

    player.disengage();
    return true;
}

module.exports = { canIHelpYou };
