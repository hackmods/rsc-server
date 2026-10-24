// Ported from Open-RSC authentic/npcs/lostcity/Jakut.java (AGPL-3.0)
// Jakut (Zanaris): talk that opens the members dragon sword shop. No quest gate in the Java.

const JAKUT_ID = 220;

async function onTalkToNPC(player, npc) {
    if (npc.id !== JAKUT_ID) {
        return false;
    }

    player.engage(npc);

    await npc.say(
        'Dragon swords, get your Dragon swords',
        'Straight from the plane of frenaskrae'
    );

    const choice = await player.ask(
        ['Yes please', "No thankyou, I'm just browsing the marketplace"],
        false
    );

    if (choice === 0) {
        await player.say('Yes Please');
        player.disengage();
        player.openShop('dragon-sword');
        return true;
    }

    await player.say("No thankyou, I'm just browsing the marketplace");
    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
