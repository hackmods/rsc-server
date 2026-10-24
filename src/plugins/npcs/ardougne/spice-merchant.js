// Ported from Open-RSC authentic/npcs/ardougne/east/SpiceMerchant.java (AGPL-3.0)
// East Ardougne spice merchant: talk, then open the spices-stall shop. The Java's stolen-spice guard call-out (spiceStolen cache) is skipped (thieving side feature).

const SPICE_MERCHANT_ID = 329;

async function onTalkToNPC(player, npc) {
    if (npc.id !== SPICE_MERCHANT_ID) {
        return false;
    }

    player.engage(npc);

    await npc.say(
        'Get your exotic spices here',
        'rare very valuable spices here'
    );

    const choice = await player.ask(
        ['Lets have a look them then', "No thank you I'm not interested"],
        false
    );

    if (choice === 0) {
        await player.say('Lets have a look then');
        player.disengage();
        player.openShop('spices-stall');
        return true;
    }

    await player.say('No thank you');
    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
