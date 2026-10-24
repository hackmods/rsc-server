// Ported from Open-RSC authentic/npcs/ardougne/east/Zenesha.java (AGPL-3.0)
// Zenesha, East Ardougne plate mail seller: talk, then open the zeneshas-plate-mail shop.

const ZENESHA_ID = 331;

async function onTalkToNPC(player, npc) {
    if (npc.id !== ZENESHA_ID) {
        return false;
    }

    player.engage(npc);

    await npc.say('hello I sell plate mail tops');

    const choice = await player.ask(
        ["I'm not intersted", 'I may be intersted'],
        false
    );

    if (choice === 0) {
        await player.say("I'm not interested");
        player.disengage();
        return true;
    }

    await player.say('I may be interested');
    await npc.say('Look at these fine samples then');
    player.disengage();
    player.openShop('zeneshas-plate-mail');
    return true;
}

module.exports = { onTalkToNPC };
