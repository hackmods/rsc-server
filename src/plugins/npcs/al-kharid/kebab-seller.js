// https://classic.runescape.wiki/w/Transcript:Kebab_Seller
// Family Crest branch ported from Open-RSC Core-Framework authentic/npcs/alkharid/KebabSeller.java (AGPL-3.0)

const {
    ASK_FOR_AVAN,
    canAskForAvan,
    kebabSellerAdamFitzharmon
} = require('../../quests/members/family-crest/shared');

const KEBAB_ID = 210;
const KEBAB_SELLER_ID = 90;

async function onTalkToNPC(player, npc) {
    if (npc.id !== KEBAB_SELLER_ID) {
        return false;
    }

    player.engage(npc);

    await npc.say('Would you like to buy a nice kebab?', 'Only 1 gold');

    const choices = ["I think I'll give it a miss", 'Yes please'];

    if (canAskForAvan(player)) {
        choices.push(ASK_FOR_AVAN);
    }

    const choice = await player.ask(choices, true);

    switch (choice) {
        case 0: // nothing
            break;
        case 1: // yes
            if (player.inventory.has(10, 1)) {
                player.inventory.remove(10, 1);
                player.inventory.add(KEBAB_ID, 1);
                player.message('You buy a kebab');
            } else {
                await player.say('Oops I forgot to bring any money with me');
                await npc.say('Come back when you have some');
            }
            break;
        case 2: // family crest
            await kebabSellerAdamFitzharmon(npc);
            break;
    }

    player.disengage();

    return true;
}

module.exports = { onTalkToNPC };
