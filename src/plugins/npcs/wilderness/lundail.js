// Ported from Open-RSC authentic/minigames/mage_arena/Lundail.java (AGPL-3.0)
// Lundail: Mage Arena rune shop, plus his description of the arena building. The Java only blocks the default talk handler when WANT_OPENPK_POINTS is off; the fork has no such config, so this always runs.

const LUNDAIL_ID = 793;

async function onTalkToNPC(player, npc) {
    if (npc.id !== LUNDAIL_ID) {
        return false;
    }

    player.engage(npc);

    await player.say('well hello sir');
    await npc.say('hello brave adventurer', 'how can i help you?');

    const choice = await player.ask(
        ["what are you selling?", "what's that big old building behind us?"],
        true
    );

    if (choice === 0) {
        await npc.say(
            'why, i sell rune stones',
            "i've got some good stuff, real powerful little rocks",
            'take a look'
        );
        player.disengage();
        player.openShop('mage-arena-rune');
        return true;
    }

    await npc.say(
        'why that my friend...',
        '...is the mage battle arena',
        'top mages come from all over to compete in the arena',
        'few return back, most get fried...hence the smell'
    );
    await npc.say('hmmm.. i did notice');

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
