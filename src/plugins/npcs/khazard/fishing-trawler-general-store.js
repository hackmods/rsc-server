// Ported from Open-RSC authentic/npcs/khazard/FishingTrawlerGeneralStore.java (AGPL-3.0)
// Port Khazard general store shopkeeper: uses the stock general-store dialogue (canIHelpYou) to open the trawler general store.

const { canIHelpYou } = require('../general-shopkeeper');

const PORT_KHAZARD_SHOPKEEPER_ID = 391;

async function onTalkToNPC(player, npc) {
    if (npc.id !== PORT_KHAZARD_SHOPKEEPER_ID) {
        return false;
    }

    return await canIHelpYou(player, npc, 'fishing-trawler-general');
}

module.exports = { onTalkToNPC };
