// Ported from Open-RSC authentic/quests/members/legendsquest/npcs/shop/SiegfriedErkel.java (AGPL-3.0)
// Siegfried Erkle: Legends Guild shop. Only players who have completed Legends Quest (questStages.legendsQuest === -1) are served.

const SIEGFRIED_ERKLE_ID = 779;

async function onTalkToNPC(player, npc) {
    if (npc.id !== SIEGFRIED_ERKLE_ID) {
        return false;
    }

    player.engage(npc);

    if (player.questStages.legendsQuest !== -1) {
        await npc.say(
            "I'm sorry but the services of this shop are only for ",
            'the pleasure of those who are rightfull members of the ',
            'Legends Guild. I would get into serious trouble if I sold ',
            'a non-member an item from this store.'
        );
        player.disengage();
        return true;
    }

    await npc.say(
        'Hello there and welcome to the shop of useful items.',
        'Can I help you at all?'
    );

    const choice = await player.ask(
        ['Yes please. What are you selling?', 'No thanks'],
        true
    );

    if (choice === 0) {
        await npc.say('Take a look');
        player.disengage();
        player.openShop('legends-guild');
        return true;
    }

    await npc.say('Ok, well, if you change your mind, do pop back.');
    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
