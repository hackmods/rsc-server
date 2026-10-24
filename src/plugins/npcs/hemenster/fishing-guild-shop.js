// Ported from Open-RSC authentic/npcs/hemenster/FishingGuildShop.java (AGPL-3.0)
// Fishing guild shopkeeper: greeting that opens the fishing equipment shop.

const FISHING_GUILD_SHOPKEEPER_ID = 371;

async function onTalkToNPC(player, npc) {
    if (npc.id !== FISHING_GUILD_SHOPKEEPER_ID) {
        return false;
    }

    player.engage(npc);

    await npc.say('Would you like to buy some fishing equipment', 'Or sell some fish');

    const choice = await player.ask(['Yes please', 'No thankyou'], true);

    if (choice === 0) {
        player.disengage();
        player.openShop('fishing-guild');
        return true;
    }

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
