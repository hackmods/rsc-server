// https://classic.runescape.wiki/w/Louie_Legs
// Family Crest branch ported from Open-RSC Core-Framework authentic/npcs/alkharid/LouieLegs.java (AGPL-3.0)

const {
    ASK_FOR_AVAN,
    canAskForAvan,
    kebabSellerAdamFitzharmon
} = require('../../quests/members/family-crest/shared');

const LOUIE_ID = 85;

async function onTalkToNPC(player, npc) {
    if (npc.id !== LOUIE_ID) {
        return false;
    }

    player.engage(npc);

    await npc.say('Hey, wanna buy some armour?');

    const choices = ['What have you got?', 'No, thank you'];

    if (canAskForAvan(player)) {
        choices.push(ASK_FOR_AVAN);
    }

    const choice = await player.ask(choices, true);

    if (choice === 0) {
        await npc.say('Take a look, see');
        player.disengage();
        player.openShop('louies-legs');
        return true;
    }

    if (choice === 2) {
        await kebabSellerAdamFitzharmon(npc);
    }

    player.disengage();

    return true;
}

module.exports = { onTalkToNPC };
