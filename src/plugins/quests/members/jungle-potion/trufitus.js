// Ported from Open-RSC Core-Framework authentic/quests/members/Jungle_Potion.java (AGPL-3.0): Trufitus (517)
// https://classic.runescape.wiki/w/Jungle_Potion
//
// questStages.junglePotion (the Java stages): Trufitus Shakaya in Tai Bwo Wannai sends you for five jungle herbs, one
// at a time. Each herb is found grimy (herbs.js), identified with Herblaw (Identify, level 3, after Druidic Ritual)
// and handed to him clean:
//   0  the proposition -> 1                            1  Snake Weed 816 (vine 564, south west)          -> 2
//   2  Ardrigal 818 (palm tree 553, east)          -> 3  3  Sito Foil 820 (scorched earth 554)              -> 4
//   4  Volencia Moss 822 (rock 555)                -> 5  5  Rogues Purse 824 (cavern wall 151, underground) -> -1
// Reward (QuestRewardRegistrar 38): 1 quest point and herblaw 1600 + 500 per herblaw level, in quarter points.
// Cache: got_snake_weed, got_ardigal (sic), got_sito_foil, got_volencia_moss, got_rogues_purse (a herb was already
// given out for this stage; reset each time Trufitus asks for it, which is how a lost herb is found again) and
// jungle_completed (his one-off thanks after the quest). After the quest he talks about Shilo Village
// (trufitus-shilo.js).

const { trufitusAfterQuest } = require('./trufitus-shilo');

const TRUFITUS_ID = 517;

const SNAKE_WEED_ID = 816;
const ARDRIGAL_ID = 818;
const SITO_FOIL_ID = 820;
const VOLENCIA_MOSS_ID = 822;
const ROGUES_PURSE_ID = 824;

function stageOf(player) {
    return player.questStages.junglePotion || 0;
}

async function farewell(npc) {
    await npc.say(
        'Very well then',
        'may your journeys bring you much joy',
        'maybe you will pass this way again',
        'and you will then take up my proposal,',
        'but for now',
        'fare thee well'
    );
}

async function trufitusDialogue(player, npc, path) {
    let choice = -1;

    if (path === 0) {
        await npc.say(
            'My people are afraid to stay in the village.',
            'They have returned to the jungle',
            'I need to commune with the gods',
            'to see what fate befalls us',
            'you could help me by collecting',
            'some herbs that I need.'
        );

        choice = await player.ask(
            ['Me, how can I help?', "I am very sorry, but I don't have time for that at the moment."],
            false
        );
    } else if (path === 1) {
        await npc.say(
            'My people are afraid to stay in the village',
            'They have returned to the jungle',
            'I need to commune with my gods',
            'to see what fate befalls us',
            'You may be able to help with this'
        );

        choice = await player.ask(['Me! How can I help?', "I am sorry, but I don't have time for that."], false);
    }

    if (choice === 0) {
        await player.say('Me, how can I help?');
        await npc.say(
            'I need to make a special brew',
            'A potion that helps me to commune with the gods.',
            'For this potion, I need very',
            'special herbs that are only found in',
            'deep jungle',
            'I can guide you only so far as the',
            'herbs are not easy to find',
            'With some luck, you will find each herb in turn',
            'and bring it to me. I will give you',
            'details of where to find the next herb. ',
            'In return I will give you training in Herblaw'
        );

        const ready = await player.ask(
            [
                "Hmm, sounds difficult, I don't know if I am ready for the challenge",
                'It sounds like just the challenge for me!'
            ],
            false
        );

        if (ready === 0) {
            await player.say("Hmm, sounds difficult, I don't know if I am ready for the challenge");
            await npc.say(
                'Very well then Bwana',
                'maybe you will return to me invigorated',
                'and ready to take up the challenge one day ?'
            );
        } else if (ready === 1) {
            await player.say(
                'It sounds like just the challenge for me.',
                'And it would make a nice break from killing things !'
            );
            await npc.say(
                'That is excellent then Bwana!',
                'The first herb you need to gather is called',
                "'Snake Weed'",
                'It grows near vines in an area to the south west',
                'where the ground turns soft and water kisses your feet.'
            );
            player.questStages.junglePotion = 1;
            player.cache.got_snake_weed = false;
        }
    } else if (choice === 1) {
        await player.say("I am very sorry, but I don't have time for that.");
        await npc.say(
            'Very well then Bwana',
            'may your journeys bring you much joy',
            'maybe you will pass this way again and',
            'you will then take up my proposal',
            'but for now, farewell !'
        );
    }
}

async function notStarted(player, npc) {
    await npc.say(
        'Greetings Bwana,',
        'I am Trufitus Shakaya of the',
        'Taie Bwo Wannai Village. ',
        'Welcome to our humble settlement.'
    );

    const choice = await player.ask(
        [
            'What does Bwana mean?',
            'Taie Bwo Wannai? What does that mean?',
            "It's a nice village, where is everyone?"
        ],
        false
    );

    if (choice === 0) {
        await player.say('What does Bwana mean?');
        await npc.say("Gracious sir, it means 'friend'", 'And friends come in peace', 'I assume that you come in peace?');

        const peace = await player.ask(
            ['Yes, of course I do.', 'What does a warrior like me know about peace?'],
            false
        );

        if (peace === 0) {
            await player.say('Yes, of course I do!');
            await npc.say('Well, that is good news', 'as I may have a proposition for you');

            const proposition = await player.ask(
                ['A proposition eh, sounds interesting!', 'I am sorry, but I am very busy'],
                true
            );

            if (proposition === 0) {
                await npc.say('I hoped that you would think so.');
                await trufitusDialogue(player, npc, 0);
            } else if (proposition === 1) {
                await farewell(npc);
            }
        } else if (peace === 1) {
            await player.say('What does a warrior like me know about peace?');
            await npc.say(
                'When you grow weary of violence',
                'and seek a more enlightened path',
                'please pay me a visit',
                'as I may have a proposal for you',
                'Now I need to attend to the plight',
                'of my people, please excuse me'
            );
        }
    } else if (choice === 1) {
        await player.say('Taie Bwo Wannai? What does that mean?');
        await npc.say("It means 'small clearing in the jungle'", 'But now it is the name of our village.');

        const next = await player.ask(
            ["It's a nice village, where is everyone?", 'I am sorry, but I am very busy'],
            false
        );

        if (next === 0) {
            await player.say('It seems like a nice village, where is everyone?');
            await trufitusDialogue(player, npc, 1);
        } else if (next === 1) {
            await player.say('I am sorry, but I am very busy');
            await farewell(npc);
        }
    } else if (choice === 2) {
        await player.say('It seems like a nice village, where is everyone?');
        await trufitusDialogue(player, npc, 1);
    }
}

async function snakeWeed(player, npc) {
    player.cache.got_snake_weed = false;
    await npc.say('Hello Bwana, do you have the Snake Weed?');

    const choice = await player.ask(['Of course!', "Not yet, sorry, what's the clue again?"], false);

    if (choice === 0) {
        await player.say('Of Course!');

        if (!player.inventory.has(SNAKE_WEED_ID)) {
            await npc.say(
                "Please don't try to deceive me!",
                'I really need that Snake Weed if I am to make this potion'
            );
        } else {
            await npc.say(
                "Great, you have the 'Snake Weed'",
                "Ok, the next herb is called, 'Ardrigal'",
                'it is related to the palm and grows',
                "to the East in its brother's shady profusion."
            );
            player.message('You give the Snake Weed to Trufitus');
            player.inventory.remove(SNAKE_WEED_ID);
            await npc.say("Many thanks for the 'Snake Weed'");
            player.questStages.junglePotion = 2;
            player.cache.got_ardigal = false;
            delete player.cache.got_snake_weed;
        }
    } else if (choice === 1) {
        await player.say("Not yet, sorry, what's the clue again?");
        // sic: the Java repeats the Ardrigal clue here
        await npc.say(
            'It is related to the palm and grows',
            "well to the north in its brother's shady profusion.",
            'I really need that Snake Weed if I am to make this potion'
        );
    }
}

async function ardrigal(player, npc) {
    player.cache.got_ardigal = false;
    await npc.say('Hello again, have you been able to get the Ardrigal ?');

    const choice = await player.ask(['Of course!', 'Not yet, sorry.'], false);

    if (choice === 0) {
        await player.say('Of Course!');

        if (player.inventory.has(ARDRIGAL_ID)) {
            await npc.say(
                "Ah, I see you have found the 'Ardrigal'",
                'you are doing well Bwana, the next',
                "herb is called, 'Sito Foil' and grows best",
                'where the ground has been blackened',
                'by the living flame.'
            );
            player.message('You give the Ardrigal to Trufitus');
            await player.world.sleepTicks(3);
            player.inventory.remove(ARDRIGAL_ID);
            player.questStages.junglePotion = 3;
            player.cache.got_sito_foil = false;
            delete player.cache.got_ardigal;
        } else {
            await npc.say(
                "Please don't try to deceive me!",
                'I still require Ardrigal,',
                'this potion will remain incomplete without it.'
            );
        }
    } else if (choice === 1) {
        await player.say('Not yet, sorry.');
        await npc.say('I still require Ardrigal,', 'this potion will remain incomplete without it.');
    }
}

async function sitoFoil(player, npc) {
    player.cache.got_sito_foil = false;
    await npc.say('Greetings Bwana', 'have you been successful in getting Sito Foil?');

    const choice = await player.ask(['Of course!', 'Not yet, sorry.'], false);

    if (choice === 0) {
        await player.say('Of Course!');

        if (player.inventory.has(SITO_FOIL_ID)) {
            await npc.say(
                'Well done Bwana, just two more herbs',
                "to collect. The next herb is called, 'Volencia Moss'",
                "And it clings to rocks for it's existence",
                'It is difficult to see, so you must search for it well.'
            );
            player.message('You give the Sito Foil to Trufitus');
            await player.world.sleepTicks(3);
            player.inventory.remove(SITO_FOIL_ID);
            player.questStages.junglePotion = 4;
            player.cache.got_volencia_moss = false;
            delete player.cache.got_sito_foil;
        } else {
            await npc.say("Please don't try to deceive me!", 'I still require Sito Foil, every herb is vital.');
        }
    } else if (choice === 1) {
        await player.say('Not yet, sorry.');
        await npc.say('I still require Sito Foil, every herb is vital.');
    }
}

async function volenciaMoss(player, npc) {
    player.cache.got_volencia_moss = false;
    await npc.say('Greetings Bwana', "Do you have the 'Volencia Moss' ?");

    const choice = await player.ask(['Of course!', 'Not yet, sorry.'], false);

    if (choice === 0) {
        await player.say('Of Course!');

        if (!player.inventory.has(VOLENCIA_MOSS_ID)) {
            await npc.say(
                "Please don't try to deceive me!",
                'I know it is difficult to find, but I do need Volencia Moss',
                'After that herb, you only have one more to find.'
            );
        } else {
            await npc.say(
                'Ah, Volencia Moss, beautiful!',
                'One final herb and the potion will',
                'be complete. This is the most difficult to',
                'find as it inhabits the darkness of the',
                "underground. It is called 'Rogues Purse'",
                'And is found in the darkest place on the Island',
                'A secret entrance to the caverns is set into',
                'The Northern cliffs of this land',
                'Take care Bwana as it may be very dangerous'
            );
            player.message('You give the Volencia Moss to Trufitus');
            await player.world.sleepTicks(3);
            player.inventory.remove(VOLENCIA_MOSS_ID);
            player.questStages.junglePotion = 5;
            player.cache.got_rogues_purse = false;
            delete player.cache.got_volencia_moss;
        }
    } else if (choice === 1) {
        await player.say('Not yet, sorry.');
        await npc.say(
            'I know it is difficult to find, but I do need Volencia Moss',
            'After that herb, you only have one more to find.'
        );
    }
}

// Jungle_Potion.handleReward: the message, 1 quest point, herblaw 1600 + 500 per level (quarter points)
function completeQuest(player) {
    player.completeQuest('junglePotion', {
        questPoints: 1,
        experience: { herblaw: 1600 + 500 * player.skills.herblaw.base },
        message: 'You gain experience in Herblaw !'
    });

    player.cache.jungle_completed = true;
}

async function roguesPurse(player, npc) {
    player.cache.got_rogues_purse = false;
    await npc.say("Have you found 'Rogues Purse' ?");

    const choice = await player.ask(['Yes Sir, indeedy I do!', 'Not yet, sorry.'], true);

    if (choice === 0) {
        if (!player.inventory.has(ROGUES_PURSE_ID)) {
            await npc.say(
                "Please don't try to deceive me!",
                'Rogues Purse is the last herb',
                'for the potion and possibly the most',
                'difficult to find but I do need it.'
            );
        } else {
            await npc.say(
                'Most excellent Bwana!',
                'You have returned all the herbs to me',
                'and I can now finish the preparations',
                'for the potion and thankfully divine with the gods.',
                'Many blessings on you!',
                'I must now prepare',
                'please excuse me while I make',
                'the arrangements'
            );
            player.message('You give the Rogues Purse to Trufitus');
            player.inventory.remove(ROGUES_PURSE_ID);
            player.message('Trufitus shows you some techniques in Herblaw');
            completeQuest(player);
            delete player.cache.got_rogues_purse;
        }
    } else if (choice === 1) {
        await npc.say(
            'Rogues Purse is the last herb',
            'for the potion and possibly the most',
            'difficult to find but I do need it.'
        );
    }
}

async function completed(player, npc) {
    // the first talk after the quest only
    if (player.cache.jungle_completed != null) {
        await npc.say(
            'My greatest respects Bwana',
            'I have communed with the gods',
            'and the future looks good for my people',
            'We are happy now that the gods are not angry with us',
            'With some blessings we will be safe here.'
        );
        delete player.cache.jungle_completed;
        return;
    }

    await trufitusAfterQuest(player, npc);
}

async function onTalkToNPC(player, npc) {
    if (npc.id !== TRUFITUS_ID) {
        return false;
    }

    player.engage(npc);

    try {
        await talk(player, npc);
    } finally {
        player.disengage();
    }

    return true;
}

async function talk(player, npc) {
    switch (stageOf(player)) {
        case 0:
            await notStarted(player, npc);
            break;
        case 1:
            await snakeWeed(player, npc);
            break;
        case 2:
            await ardrigal(player, npc);
            break;
        case 3:
            await sitoFoil(player, npc);
            break;
        case 4:
            await volenciaMoss(player, npc);
            break;
        case 5:
            await roguesPurse(player, npc);
            break;
        case -1:
            await completed(player, npc);
            break;
    }
}

module.exports = { onTalkToNPC };
