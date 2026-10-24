// Ported from Open-RSC authentic/npcs/ardougne/east/SilverMerchant.java (AGPL-3.0)
// East Ardougne silver merchant: talk, then open the silver-stall shop. The Java's stolen-silver guard call-out (silverStolen cache) is skipped (thieving side feature).

const SILVER_MERCHANT_ID = 328;

async function onTalkToNPC(player, npc) {
    if (npc.id !== SILVER_MERCHANT_ID) {
        return false;
    }

    player.engage(npc);

    await npc.say(
        'Silver! Silver!',
        'Best prices for buying and selling in all Kandarin!'
    );

    const choice = await player.ask(['Yes please', 'No thankyou'], true);

    player.disengage();

    if (choice === 0) {
        player.openShop('silver-stall');
    }

    return true;
}

module.exports = { onTalkToNPC };
