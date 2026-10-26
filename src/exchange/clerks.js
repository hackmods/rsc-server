// ARSC Grand Exchange clerks: the keepers of every general store (shops.json
// `general: true`). test/exchange-clerks.test.js fails if a general store is
// missing here or its plugin does not offer the Exchange.

const CLERKS = {
    'al-kharid-general': [87, 88],
    'arheins-general': [280],
    'bandit-camp-general': [233],
    'dwarven-mine-general': [143],
    'east-ardougne-adventurers': [336, 337],
    'edgeville-general': [185, 186],
    'falador-general': [105, 106],
    'fishing-trawler-general': [391],
    'karamja-general': [168, 169],
    'legends-guild-general': [788],
    'lumbridge-general': [55, 83],
    'ogre-trader-general': [687],
    'rimmington-general': [145, 146],
    'shilo-village-general': [620],
    'tai-bwo-wannai-general': [522],
    'tree-gnome-village-general': [398],
    'varrock-general': [51, 82],
    'west-ardougne-general': [661],
    'zanaris-general': [222, 223]
};

const CLERK_IDS = new Set(Object.values(CLERKS).flat());

// a clerk NPC within `range` tiles (Chebyshev) of the player, or null
function clerkNear(player, range) {
    const nearby = player.world.npcs.getInArea(
        player.x,
        player.y,
        range * 2 + 1
    );

    for (const npc of nearby) {
        if (
            CLERK_IDS.has(npc.id) &&
            Math.max(Math.abs(npc.x - player.x), Math.abs(npc.y - player.y)) <=
                range
        ) {
            return npc;
        }
    }

    return null;
}

module.exports = { CLERKS, CLERK_IDS, clerkNear };
