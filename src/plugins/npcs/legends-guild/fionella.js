// Ported from Open-RSC authentic/quests/members/legendsquest/npcs/shop/Fionella.java (AGPL-3.0)
// Fionella: Legends Guild general store. Her Java dialogue is the stock general-store dialogue, so it reuses canIHelpYou.

const { canIHelpYou } = require('../general-shopkeeper');

const FIONELLA_ID = 788;

async function onTalkToNPC(player, npc) {
    if (npc.id !== FIONELLA_ID) {
        return false;
    }

    return await canIHelpYou(player, npc, 'legends-guild-general');
}

module.exports = { onTalkToNPC };
