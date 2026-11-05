// https://classic.runescape.wiki/w/Transcript:Gem_trader
// Family Crest branch ported from Open-RSC Core-Framework authentic/npcs/alkharid/GemTrader.java (AGPL-3.0):
// at stages 3 and 4 he knows where Avan is (stage 4)

const { ASK_FOR_AVAN, canAskForAvan } = require('../../quests/members/family-crest/shared');

const GEM_TRADER_ID = 308;

async function onTalkToNPC(player, npc) {
    if (npc.id !== GEM_TRADER_ID) {
        return false;
    }

    player.engage(npc);

    await npc.say(
        `good day to you ${player.isMale() ? 'sir' : 'madam'}`,
        'Would you be interested in buying some gems?'
    );

    const choices = ['Yes please', 'No thankyou'];

    if (canAskForAvan(player)) {
        choices.push(ASK_FOR_AVAN);
    }

    const choice = await player.ask(choices, false);

    if (choice === 0) {
        await player.say('Yes please');
        player.disengage();
        player.openShop('al-kharid-gem-stall');
        return true;
    }

    if (choice === 1) {
        await player.say('No thankyou');
    } else if (choice === 2) {
        await player.say("I'm in search of a man named Adam Fitzharmon");
        await npc.say(
            'Fitzharmon eh?',
            "Thats the name of a Varrocian noble family if I'm not mistaken",
            'I have seen a man of that persuasion about the place as of late',
            'Wearing a poncey yellow cape',
            'Came to my store, said he was after jewelry made from the perfect gold',
            'Whatever that means',
            "He's round about the desert still, looking for the perfect gold",
            "He'll be somewhere where he might get some gold I'd wager",
            'He might even be desperate enough to brave the scorpions'
        );
        player.questStages.familyCrest = 4;
    }

    player.disengage();

    return true;
}

module.exports = { onTalkToNPC };
