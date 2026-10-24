// Ported from Open-RSC authentic/npcs/varrock/TeaSeller.java (AGPL-3.0)
// Tea seller (Varrock tea stall): refreshment greeting that opens the tea shop, or gives the Java's sales pitch.
// Skipped: the Java's members-world gate (this fork always runs members) and the TakeObj reprimand for the display tea (not talk dialogue).

const TEA_SELLER_ID = 780;

async function onTalkToNPC(player, npc) {
    if (npc.id !== TEA_SELLER_ID) {
        return false;
    }

    player.engage(npc);

    await npc.say('Greetings!', 'Are you in need of refreshment ?');

    const choice = await player.ask(['Yes please', 'No thanks', 'What are you selling ?'], true);

    if (choice === 0) {
        player.disengage();
        player.openShop('tea-stall');
        return true;
    }

    if (choice === 1) {
        await npc.say("Well, if you're sure", 'You know where to come if you do !');
    } else if (choice === 2) {
        await npc.say(
            'Only the most delicious infusion',
            'Of the leaves of the tea plant',
            'Grown in the exotic regions of this world...',
            'Buy yourself a cup !'
        );
    }

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
