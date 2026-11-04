// Ported from Open-RSC Core-Framework authentic/quests/members/FamilyCrest.java dimintheisDialogue (AGPL-3.0).
// Dimintheis (309), south-east Varrock: starts the quest (stage 1) and takes the crest (-1, steel gauntlets).
// The CAN_RETRIEVE_POST_QUEST_ITEMS gauntlet recovery and the disenchant (custom) are not ported.

const { ITEMS, NPCS, GAUNTLETS, stage } = require('./shared');

async function threeSons(player, npc) {
    await npc.say(
        'Well my 3 sons took it with them many years ago',
        'When they rode out to fight in the war',
        'Against the undead necromancer and his army',
        "I didn't hear from them for many years and mourned them dead",
        'However recently I heard word that my son Caleb is alive',
        'trying to earn his fortune',
        'As a great chef, far away in the lands beyond white wolf mountain'
    );

    const choice = await player.ask(
        ['Ok I will help you', "I'm not interested in that adventure right now"],
        false
    );

    if (choice === 0) {
        await player.say('Ok, I will help you');
        await npc.say('I thank you greatly', 'If you find Caleb send him my love');
        player.questStages.familyCrest = 1;
    } else if (choice === 1) {
        await player.say("I'm not interested in that adventure right now");
    }
}

async function tradition(player, npc) {
    await npc.say(
        'We have this tradition in the Varrocian arostocracy', // sic
        'Each noble family has an ancient crest',
        'This represents the honour and lineage of the family',
        "If you are to lose this crest, the family's estate is given to the crown",
        'until the crest is returned',
        'In times past when there was much infighting between the various families',
        "Capturing a family's crest meant you captured their land"
    );
    await player.say('so where is this crest?');
    await threeSons(player, npc);
}

async function notStarted(player, npc) {
    await npc.say('Hello, my name is Dimintheis', 'Of the noble family of Fitzharmon');

    const choice = await player.ask(
        [
            'Why would a nobleman live in a little hut like this?',
            "You're rich then?, can I have some money?",
            'Hi, I am bold adventurer'
        ],
        false
    );

    if (choice === 0) {
        await player.say('Why would a nobleman live in a little hut like this?');
        await npc.say('The king has taken my estate from me', 'Until I can show him my family crest');

        const first = await player.ask(['Why would he do that?', 'So where is this crest?'], true);

        if (first === 0) {
            await tradition(player, npc);
        } else if (first === 1) {
            await threeSons(player, npc);
        }
    } else if (choice === 1) {
        await player.say("You're rich then?", 'Can I have some money?');
        await npc.say(
            'Lousy beggar',
            "There's to many of your sort about these days", // sic
            'If I gave money to each of you who asked',
            "I'd be living on the streets myself"
        );
    } else if (choice === 2) {
        await player.say('Hi, I am a bold adventurer');
        await npc.say(
            'An adventurer hmm?',
            'I may have an adventure for you',
            'I desperatly need my family crest returning to me' // sic
        );

        const second = await player.ask(
            [
                'Why are you so desperate for it?',
                'So where is this crest?',
                "I'm not interested in that adventure right now"
            ],
            false
        );

        if (second === 0) {
            await player.say('Why are you desperate for it?');
            await tradition(player, npc);
        } else if (second === 1) {
            await player.say('so where is this crest?');
            await threeSons(player, npc);
        } else if (second === 2) {
            await player.say("I'm not interested in that adventure right now");
        }
    }
}

async function handIn(player, npc) {
    const { world } = player;
    let gaveCrest = false;

    if (player.inventory.has(ITEMS.familyCrest)) {
        await player.say('I have retrieved your crest');
        player.message('You give the crest to Dimintheis');
        await world.sleepTicks(3);
        player.inventory.remove(ITEMS.familyCrest);
        gaveCrest = true;
    } else if (
        player.inventory.has(ITEMS.crestFragmentOne) &&
        player.inventory.has(ITEMS.crestFragmentTwo) &&
        player.inventory.has(ITEMS.crestFragmentThree)
    ) {
        await player.say('I have retrieved your crest');
        player.message('You give the parts of the crest to Dimintheis');
        player.inventory.remove(ITEMS.crestFragmentOne);
        player.inventory.remove(ITEMS.crestFragmentTwo);
        player.inventory.remove(ITEMS.crestFragmentThree);
        gaveCrest = true;
    }

    if (!gaveCrest) {
        await npc.say('How are you doing finding the crest');
        await player.say("I don't have it yet");
        return;
    }

    delete player.cache.northLeverA;
    delete player.cache.southLever;
    delete player.cache.northLeverB;

    await npc.say(
        'Thankyou for your kindness',
        'I cannot express my gratitude enough',
        'You truly are a great hero'
    );

    player.completeQuest('familyCrest', {
        questPoints: 1,
        message: 'Well done you have completed the family crest quest'
    });

    await npc.say(
        'How can I reward you I wonder?',
        'I suppose these gauntlets would make a good reward',
        'If you die you will always retain these gauntlets'
    );
    player.message('Dimintheis gives you a pair of gauntlets');
    player.inventory.add(ITEMS.steelGauntlets);
    player.cache.famcrest_gauntlets = GAUNTLETS.STEEL;
    await npc.say(
        'These gautlets can be granted extra powers', // sic
        'Take them to one of my boys, they can each do something to them',
        'Though they can only receive one of the three powers'
    );
}

async function onTalkToNPC(player, npc) {
    if (npc.id !== NPCS.dimintheis) {
        return false;
    }

    player.engage(npc);

    if (!player.world.members) {
        await npc.say("Hello traveller, can't talk now", 'maybe you can come back later');
        player.disengage();
        return true;
    }

    const questStage = stage(player);

    if (questStage === 0) {
        await notStarted(player, npc);
    } else if (questStage === 1) {
        await player.say('Where did you say I could find Caleb?');
        await npc.say(
            'I heard word that my son Caleb is alive trying to earn his fortune',
            'As a great chef, far away in the lands beyond white wolf mountain'
        );
    } else if (questStage >= 2) {
        await handIn(player, npc);
    } else {
        await npc.say('Thankyou for saving our family honour', 'We will never forget you');
    }

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
