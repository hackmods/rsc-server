// Ported from Open-RSC authentic/npcs/grandtree/Rometti.java (AGPL-3.0)
// Rometti the fashion seller (Grand Tree): fashion sales talk, then opens the gnome fashion shop.

const ROMETTI_ID = 532;

async function onTalkToNPC(player, npc) {
    if (npc.id !== ROMETTI_ID) {
        return false;
    }

    player.engage(npc);

    await player.say('hello');
    await npc.say(
        'hello traveller',
        'have a look at my latest range of gnome fashion',
        'rometti is the ultimate label in gnome high society'
    );
    await player.say('really');
    await npc.say('pastels are all the rage this season');

    const choice = await player.ask(
        ["i've no time for fashion", "ok then let's have a look"],
        false
    );

    if (choice === 0) {
        await player.say("i've no time for fashion");
        await npc.say('hmm...i did wonder');
        player.disengage();
        return true;
    }

    await player.say("ok then, let's have a look");
    player.disengage();
    player.openShop('fine-fashions');
    return true;
}

module.exports = { onTalkToNPC };
