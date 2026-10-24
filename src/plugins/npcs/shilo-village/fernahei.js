// Ported from Open-RSC authentic/npcs/shilo/Fernahei.java (AGPL-3.0)
// Fernahei (Shilo Village): fishing shop talk that opens 'fernaheis-fishing'. No quest gate in the Java.

const FERNAHEI_ID = 616;

async function onTalkToNPC(player, npc) {
    if (npc.id !== FERNAHEI_ID) {
        return false;
    }

    player.engage(npc);

    await npc.say(
        "Welcome to Fernahei's Fishing Shop Bwana!",
        'Would you like to see my items?'
    );

    const choice = await player.ask(['Yes please!', 'No, but thanks for the offer.'], true);

    if (choice === 0) {
        player.disengage();
        player.openShop('fernaheis-fishing');
        return true;
    }

    await npc.say("That's fine and thanks for your interest.");
    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
