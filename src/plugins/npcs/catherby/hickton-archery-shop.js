// Ported from Open-RSC authentic/npcs/catherby/HicktonArcheryShop.java (AGPL-3.0)
// Hickton (Catherby archery): greeting that opens the archery shop. Skipped: the custom Fletching Skillcape option (WANT_CUSTOM_QUESTS / WANT_CUSTOM_SPRITES).

const HICKTON_ID = 289;

async function onTalkToNPC(player, npc) {
    if (npc.id !== HICKTON_ID) {
        return false;
    }

    player.engage(npc);

    await npc.say('Welcome to Hickton\'s Archery Store', 'Do you want to see my wares?');

    const choice = await player.ask(
        ['Yes please', 'No, I prefer to bash things close up'],
        false
    );

    if (choice === 0) {
        await player.say('Yes Please');
        player.disengage();
        player.openShop('hicktons-archery');
        return true;
    }

    await player.say('No, I prefer to bash things close up');
    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
