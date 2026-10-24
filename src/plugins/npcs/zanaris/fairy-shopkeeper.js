// Ported from Open-RSC authentic/npcs/GeneralStore.java (AGPL-3.0)
// Fairy shopkeeper and shop assistant (Zanaris) use the shared general store dialogue, opening 'zanaris-general'.

const { canIHelpYou } = require('../general-shopkeeper');

const FAIRY_SHOP_IDS = new Set([222, 223]);

async function onTalkToNPC(player, npc) {
    if (!FAIRY_SHOP_IDS.has(npc.id)) {
        return false;
    }

    return await canIHelpYou(player, npc, 'zanaris-general');
}

module.exports = { onTalkToNPC };
