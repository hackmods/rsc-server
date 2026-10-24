// Ported from Open-RSC authentic/npcs/ardougne/east/GemMerchant.java (AGPL-3.0)
// East Ardougne gem merchant: talk, then open the gems-stall shop. The Java's stolen-gem guard call-out (gemStolen cache) is skipped (thieving side feature).

const GEM_MERCHANT_ID = 330;

async function onTalkToNPC(player, npc) {
    if (npc.id !== GEM_MERCHANT_ID) {
        return false;
    }

    player.engage(npc);

    await npc.say('Here, look at my lovely gems');

    const choice = await player.ask(
        ['Ok show them to me', "I'm not interested thankyou"],
        false
    );

    if (choice === 0) {
        await player.say('Ok show them to me');
        player.disengage();
        player.openShop('gems-stall');
        return true;
    }

    await player.say("I'm not intersted thankyou");
    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
