// Ported from Open-RSC authentic/npcs/catherby/CandleMakerShop.java (AGPL-3.0)
// Candle maker (Catherby): greeting that opens the candle shop. Skipped: the Merlin's Crystal black-candle/wax quest branch, the wax-pending state, and the custom firemaking cape (WANT_CUSTOM_SPRITES).

const CANDLEMAKER_ID = 282;

async function onTalkToNPC(player, npc) {
    if (npc.id !== CANDLEMAKER_ID) {
        return false;
    }

    player.engage(npc);

    await npc.say('Hi would you be interested in some of my fine candles');

    const choice = await player.ask(['Yes please', 'No thankyou'], true);

    if (choice === 0) {
        player.disengage();
        player.openShop('candle');
        return true;
    }

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
