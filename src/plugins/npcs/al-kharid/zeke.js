// https://classic.runescape.wiki/w/Transcript:Zeke
// Family Crest branch ported from Open-RSC Core-Framework authentic/npcs/alkharid/ZekeScimitars.java (AGPL-3.0)

const {
    ASK_FOR_AVAN,
    canAskForAvan,
    kebabSellerAdamFitzharmon
} = require('../../quests/members/family-crest/shared');

const ZEKE_ID = 84;

async function onTalkToNPC(player, npc) {
    if (npc.id !== ZEKE_ID) {
        return false;
    }

    player.engage(npc);

    await npc.say('A thousand greetings sir');

    const choices = ['Do you want to trade?', 'Nice cloak'];

    if (canAskForAvan(player)) {
        choices.push(ASK_FOR_AVAN);
    }

    const choice = await player.ask(choices, true);

    switch (choice) {
        case 0: // trade
            await npc.say('Yes certainly', 'I deal in scimitars');
            player.disengage();
            player.openShop('zekes-superior-scimitars');
            return true;
        case 1: // cloak
            await npc.say('Thank you');
            break;
        case 2: // family crest
            await kebabSellerAdamFitzharmon(npc);
            break;
    }

    player.disengage();

    return true;
}

module.exports = { onTalkToNPC };
