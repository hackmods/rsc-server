// Ported from Open-RSC authentic/npcs/ardougne/east/BakerMerchant.java (AGPL-3.0)
// East Ardougne baker: talk, then open the bakers-stall shop. The Java's "Hey thats mine" stealing follow-up is skipped (thieving side feature).

const BAKER_ID = 325;

async function onTalkToNPC(player, npc) {
    if (npc.id !== BAKER_ID) {
        return false;
    }

    player.engage(npc);

    // the Java reads its first line from player.getText("BakerMerchantGoodDay"),
    // which is "Good day Monsieur" in server/conf/server/languages/AuthenticMessages_en_UK.properties
    await npc.say(
        'Good day Monsieur',
        'Would you like ze nice freshly baked bread',
        'Or perhaps a nice piece of cake'
    );

    const choice = await player.ask(
        ['Lets see what you have', 'No thankyou'],
        true
    );

    player.disengage();

    if (choice === 0) {
        player.openShop('bakers-stall');
    }

    return true;
}

module.exports = { onTalkToNPC };
