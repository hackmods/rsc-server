// https://classic.runescape.wiki/w/Transcript:Ranael
// Family Crest branch ported from Open-RSC Core-Framework authentic/npcs/alkharid/RanaelSkirt.java (AGPL-3.0)

const {
    ASK_FOR_AVAN,
    canAskForAvan,
    kebabSellerAdamFitzharmon
} = require('../../quests/members/family-crest/shared');

const RANAEL_ID = 103;

async function onTalkToNPC(player, npc) {
    if (npc.id !== RANAEL_ID) {
        return false;
    }

    player.engage(npc);

    await npc.say(
        'Do you want to buy any armoured skirts?',
        'Designed especially for ladies who like to fight'
    );

    const choices = ['Yes please', "No thank you that's not my scene"];

    if (canAskForAvan(player)) {
        choices.push(ASK_FOR_AVAN);
    }

    const choice = await player.ask(choices, true);

    if (choice === 0) {
        player.disengage();
        player.openShop('ranaels-plateskirt');
        return true;
    }

    if (choice === 2) {
        await kebabSellerAdamFitzharmon(npc);
    }

    player.disengage();

    return true;
}

module.exports = { onTalkToNPC };
