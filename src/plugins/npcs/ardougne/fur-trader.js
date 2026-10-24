// Ported from Open-RSC authentic/npcs/ardougne/east/FurMerchant.java (AGPL-3.0)
// East Ardougne fur trader: talk, then open the fur-stall shop. The Java's stolen-fur guard call-out (furStolen cache) is skipped (thieving side feature).

const FUR_TRADER_ID = 327;

async function onTalkToNPC(player, npc) {
    if (npc.id !== FUR_TRADER_ID) {
        return false;
    }

    player.engage(npc);

    await npc.say('would you like to do some fur trading?');

    const choice = await player.ask(['yes please', 'No thank you'], false);

    if (choice === 0) {
        await player.say('Yes please');
        player.disengage();
        player.openShop('fur-stall');
        return true;
    }

    await player.say('No thank you');
    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
