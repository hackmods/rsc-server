// Ported from Open-RSC authentic/npcs/grandtree/BlurberryBarman.java (AGPL-3.0)
// Blurberry the barman (Grand Tree): opens the cocktail shop. Cocktail/minigame side features are not ported.

const BLURBERRY_BARMAN_ID = 580;

async function onTalkToNPC(player, npc) {
    if (npc.id !== BLURBERRY_BARMAN_ID) {
        return false;
    }

    player.engage(npc);

    await npc.say('good day to you', 'can i get you drink?');

    const choice = await player.ask(['what do you have?', 'no thanks'], false);

    if (choice === 0) {
        await player.say('what do you have');
        await npc.say('take a look');
        player.disengage();
        player.openShop('blurberrys-bar');
        return true;
    }

    await player.say('no thanks');
    await npc.say('ok, take it easy');
    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
