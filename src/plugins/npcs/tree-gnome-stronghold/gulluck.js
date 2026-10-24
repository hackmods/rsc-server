// Ported from Open-RSC authentic/npcs/grandtree/Gulluck.java (AGPL-3.0)
// Gulluck (Grand Tree weapons seller): weapons sales talk, then opens the weapons shop.

const GULLUCK_ID = 587;

async function onTalkToNPC(player, npc) {
    if (npc.id !== GULLUCK_ID) {
        return false;
    }

    player.engage(npc);

    await player.say('hello');
    await npc.say(
        'good day brave adventurer',
        'could i interest you in my fine selection of weapons?'
    );

    const choice = await player.ask(["i'll take a look", 'no thanks'], true);

    if (choice === 0) {
        player.disengage();
        player.openShop('gulluck-and-sons');
        return true;
    }

    await npc.say('grrrr');
    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
