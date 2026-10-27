// ARSC: the Wilderness outfitter, a shopkeeper just south of the Wilderness border in Edgeville (spawn in
// arsc-locations.js, stock in arsc-shops.js). 720 is the "Assistant" NPC definition: it has no other plugin, and the
// only other spawn of it is at Shantay Pass, so the talk is also gated to Edgeville to leave that one alone.

const OUTFITTER_IDS = new Set([720]);

const EDGEVILLE = { minX: 200, maxX: 230, minY: 430, maxY: 460 };

function inEdgeville({ x, y }) {
    return (
        x >= EDGEVILLE.minX &&
        x <= EDGEVILLE.maxX &&
        y >= EDGEVILLE.minY &&
        y <= EDGEVILLE.maxY
    );
}

async function onTalkToNPC(player, npc) {
    if (!OUTFITTER_IDS.has(npc.id) || !inEdgeville(npc)) {
        return false;
    }

    player.engage(npc);

    await npc.say(
        'Heading into the Wilderness?',
        'I sell weapons, armour, runes, potions and food',
        'Everything you need to survive out there'
    );

    const choice = await player.ask(['Yes please', 'No thanks'], true);

    switch (choice) {
        case 0: // yes
            player.disengage();
            player.openShop('wilderness-outfitter');
            return true;
        case 1: // no
            await npc.say('Stay safe out there');
            break;
    }

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
