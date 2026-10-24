// Ported from Open-RSC authentic/npcs/shilo/Obli.java (AGPL-3.0)
// Obli (Shilo Village): general store talk that opens 'shilo-village-general'. No quest gate in the Java.

const OBLI_ID = 620;

async function onTalkToNPC(player, npc) {
    if (npc.id !== OBLI_ID) {
        return false;
    }

    player.engage(npc);

    await npc.say(
        "Welcome to Obli's General Store Bwana!",
        'Would you like to see my items?'
    );

    const choice = await player.ask(['Yes please!', 'No, but thanks for the offer.'], true);

    if (choice === 0) {
        player.disengage();
        player.openShop('shilo-village-general');
        return true;
    }

    await npc.say("That's fine and thanks for your interest.");
    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
