// Ported from Open-RSC authentic/npcs/yanille/Frenita.java (AGPL-3.0)
// Frenita (Yanille): greeting that opens the cooking equipment shop.

const FRENITA_ID = 530;

async function onTalkToNPC(player, npc) {
    if (npc.id !== FRENITA_ID) {
        return false;
    }

    player.engage(npc);

    await npc.say('Would you like to buy some cooking equipment');

    const choice = await player.ask(['Yes please', 'No thankyou'], true);

    if (choice === 0) {
        player.disengage();
        player.openShop('frenitas-cooking');
        return true;
    }

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
