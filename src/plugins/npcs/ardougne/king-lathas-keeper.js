// Ported from Open-RSC authentic/npcs/ardougne/east/KingLathasKeeper.java (AGPL-3.0)
// King Lathas' shopkeeper (Training Camp shop keeper, NPC 528): talk, then open the king-lathas-weaponry shop.

const KING_LATHAS_KEEPER_ID = 528;

async function onTalkToNPC(player, npc) {
    if (npc.id !== KING_LATHAS_KEEPER_ID) {
        return false;
    }

    player.engage(npc);

    await player.say('hello');
    await npc.say(
        'so are you looking to buy some weapons?',
        'king lathas keeps us very well stocked'
    );

    const choice = await player.ask(['what do you have?', 'no thanks'], true);

    if (choice === 0) {
        await npc.say('take a look');
        player.disengage();
        player.openShop('king-lathas-weaponry');
        return true;
    }

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
