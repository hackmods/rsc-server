// Ported from Open-RSC authentic/npcs/brimhaven/DavonShop.java (AGPL-3.0)
// Davon (Brimhaven): amulet trader; the menu opens the amulet shop or gives his two flavour replies.

const DAVON_ID = 278;

async function onTalkToNPC(player, npc) {
    if (npc.id !== DAVON_ID) {
        return false;
    }

    player.engage(npc);

    await npc.say('Pssst come here if you want to do some amulet trading');

    const choice = await player.ask(
        [
            'What are you selling?',
            'What do you mean pssst?',
            "Why don't you ever restock some types of amulets?"
        ],
        true
    );

    if (choice === 0) {
        await player.message('Davon opens up his jacket to reveal some amulets');
        player.disengage();
        player.openShop('davons-amulet');
        return true;
    }

    if (choice === 1) {
        await npc.say('I was clearing my throat');
    } else if (choice === 2) {
        await npc.say(
            'Some of these amulets are very hard to get',
            'I have to wait until an adventurer supplies me'
        );
    }

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
