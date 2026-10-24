// Ported from Open-RSC authentic/npcs/yanille/MagicStoreOwner.java (AGPL-3.0)
// Magic guild store owner (Yanille): greeting that opens the magic supplies shop.

const MAGIC_STORE_OWNER_ID = 514;

async function onTalkToNPC(player, npc) {
    if (npc.id !== MAGIC_STORE_OWNER_ID) {
        return false;
    }

    player.engage(npc);

    await npc.say('Welcome to the magic guild store', 'would you like to buy some magic supplies?');

    const choice = await player.ask(['Yes please', 'No thankyou'], true);

    if (choice === 0) {
        player.disengage();
        player.openShop('magic-guild');
        return true;
    }

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
