// Ported from Open-RSC authentic/npcs/grandtree/HeckelFunchGroceries.java (AGPL-3.0)
// Heckel Funch (Grand Tree): grocery and alcohol sales talk, then opens the groceries shop.

const HECKEL_FUNCH_ID = 535;

async function onTalkToNPC(player, npc) {
    if (npc.id !== HECKEL_FUNCH_ID) {
        return false;
    }

    player.engage(npc);

    await player.say('hello there');
    await npc.say(
        'good day to you my friend ..and a beautiful one at that',
        'would you like some groceries? i have all sorts',
        'alcohol also, if your partial to a drink'
    );

    const choice = await player.ask(['no thank you', "i'll have a look"], true);

    // the shop is option 1: services/rsc-agents/scripts/gen-shop-openers.js reads the
    // option path from the `if (choice === N)` around openShop
    if (choice === 1) {
        await npc.say("there's a good human");
        player.disengage();
        player.openShop('funchs-fine-groceries');
        return true;
    }

    await npc.say('ahh well, all the best to you');
    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
