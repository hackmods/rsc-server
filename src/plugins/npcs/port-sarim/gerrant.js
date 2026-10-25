// https://classic.runescape.wiki/w/Transcript:Gerrant

// Lava eel branch ported from Open-RSC Core-Framework authentic/npcs/portsarim/GerrantsFishingGear.java (AGPL-3.0)
const GERRANT_ID = 167;
const BLAMISH_SNAIL_SLIME_ID = 587;
const BLAMISH_OIL_ID = 588;
const OILY_FISHING_ROD_ID = 589;

async function onTalkToNPC(player, npc) {
    if (npc.id !== GERRANT_ID) {
        return false;
    }

    player.engage(npc);

    await npc.say(
        'Welcome you can buy fishing equipment at my store',
        "We'll also buy anything you catch off you"
    );

    const options = ["Let's see what you've got then", "Sorry, I'm not interested"];

    // the members world always has this option once Hero's Quest is started (Java: stage >= 1)
    if (player.questStages.herosQuest >= 1) {
        options.push('I want to find out how to catch a lava eel');
    }

    const choice = await player.ask(options, false);

    switch (choice) {
        case 0:
            await player.say("Let's see what you've got then");
            player.disengage();
            player.openShop('gerrants-fishy-business');
            return true;
        case 1:
            await player.say("Sorry,I'm not interested");
            break;
        case 2:
            await player.say('I want to find out how to catch a lava eel');
            await npc.say(
                'Lava eels eh?',
                "That's a tricky one that is",
                "I wouldn't even know where find them myself",
                'Probably in some lava somewhere',
                "You'll also need a lava proof fishing line",
                'The method for this would be take an ordinary fishing rod',
                'And cover it with fire proof blamish oil'
            );

            if (
                !player.inventory.has(BLAMISH_SNAIL_SLIME_ID) &&
                !player.inventory.has(BLAMISH_OIL_ID) &&
                !player.inventory.has(OILY_FISHING_ROD_ID)
            ) {
                await npc.say(
                    'Now I may have a jar of Blamish snail slime',
                    'I wonder where I put it'
                );
                player.message('Gerrant searches about a bit');
                await npc.say('Aha here it is');
                player.message('Gerrant passes you a small jar');
                player.inventory.add(BLAMISH_SNAIL_SLIME_ID);
                await npc.say(
                    "You'll need to mix this with some of the Harralander herb and water"
                );
            }

            break;
    }

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
