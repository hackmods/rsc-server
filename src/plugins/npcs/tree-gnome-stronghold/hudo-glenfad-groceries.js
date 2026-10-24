// Ported from Open-RSC authentic/npcs/grandtree/HudoGlenfadGroceries.java (AGPL-3.0)
// Hudo Glenfad (Grand Tree): grocery sales talk, then opens the Grand Tree groceries shop.

const HUDO_GLENFAD_ID = 537;

async function onTalkToNPC(player, npc) {
    if (npc.id !== HUDO_GLENFAD_ID) {
        return false;
    }

    player.engage(npc);

    await player.say('hello there');
    await npc.say(
        'good day ..and a beautiful one at that',
        'would you like some groceries? i have a large selection'
    );

    const choice = await player.ask(['no thankyou', "i'll have a look"], true);

    // the shop is option 1: services/rsc-agents/scripts/gen-shop-openers.js reads the
    // option path from the `if (choice === N)` around openShop
    if (choice === 1) {
        await npc.say('great stuff');
        player.disengage();
        player.openShop('grand-tree-groceries');
        return true;
    }

    await npc.say('ahh well, all the best to you');
    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
