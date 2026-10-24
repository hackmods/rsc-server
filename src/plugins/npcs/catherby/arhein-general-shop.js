// Ported from Open-RSC authentic/npcs/catherby/ArheinGeneralShop.java (AGPL-3.0)
// Arhein (Catherby docks): trade greeting that opens the general store. Skipped: the "Is that your ship?" tree (not shop dialogue).

const ARHEIN_ID = 280;

async function onTalkToNPC(player, npc) {
    if (npc.id !== ARHEIN_ID) {
        return false;
    }

    player.engage(npc);

    await npc.say('Hello would you like to trade');

    const choice = await player.ask(['Yes ok', 'No thankyou'], true);

    if (choice === 0) {
        player.disengage();
        player.openShop('arheins-general');
        return true;
    }

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
