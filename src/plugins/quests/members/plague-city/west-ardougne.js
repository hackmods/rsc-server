// Ported from Open-RSC Core-Framework authentic/quests/members/PlagueCity.java (Jethick, the Rehnisons, the clerk,
// Bravek), authentic/defaults/DoorAction.java (DOOR_REHNISON_FAMILY 122, DOOR_TO_BRAVEK 121) and
// authentic/npcs/ardougne/west/Mourner.java (the West Ardougne mourner 445 and the head mourner 469) (AGPL-3.0).
// https://classic.runescape.wiki/w/Plague_City
//
// questStages.plagueCity, the West Ardougne part (stages 0-4 and 11 are east-ardougne.js and plague-house.js):
//   5  Jethick (443, roaming 629-639 x 584-594) recognises Elena from the picture (767, a ground spawn in Edmond's
//      house at 615,577) and lends you the Book (768) for the Rehnisons
//   5  the Rehnisons' door (122 at 645,569) opens for the book (taken from the south side, y >= 569) -> 6
//   6  Ted (446) or Martha (447) send you upstairs; Milli (449, 645,1511) names the mossy windowless house -> 7
//   7  the mourner (445) at the plague house door (123, plague-house.js) says you need clearance -> 8
//   8  the clerk (452, civic office 651,585) lets you through Bravek's door (121 at 648,585) into his office
//      (647,585); Bravek (454) gives the Scruffy note (781) -> 9
//   9  the hangover cure (771: milk 22 + chocolate dust 772 = chocolaty milk 770, + snape grass 469; items.js) to
//      Bravek -> 10, and his menu gives the warrant (775). From 10 he hands out another warrant if you lost it
//   From stage 9 Bravek's door opens either way.

const JETHICK_ID = 443;
const MOURNER_WEST_ARDOUGNE_ID = 445;
const TED_ID = 446;
const MARTHA_ID = 447;
const BILLY_ID = 448;
const MILLI_ID = 449;
const CLERK_ID = 452;
const BRAVEK_ID = 454;
const HEAD_MOURNER_ID = 469;

const PICTURE_ID = 767;
const BOOK_ID = 768;
const HANGOVER_CURE_ID = 771;
const WARRANT_ID = 775;
const SCRUFFY_NOTE_ID = 781;

const BRAVEK_DOOR_ID = 121;
const REHNISON_DOOR_ID = 122;

const BRAVEK_OFFICE = { x: 647, y: 585 };

function stageOf(player) {
    return player.questStages.plagueCity || 0;
}

function setStage(player, stage) {
    player.questStages.plagueCity = stage;
}

async function mes(player, ...lines) {
    for (const line of lines) {
        player.message(line);
        await player.world.sleepTicks(3);
    }
}

// Open-RSC ifnearvisnpc: the nearest of that id in range that is not busy
function nearNpc(player, id, range) {
    return player.getNearbyEntitiesByID('npcs', id, range).find((npc) => !npc.locked && !npc.interlocutor);
}

async function jethickDialogue(player, npc) {
    const stage = stageOf(player);

    if (stage === 5) {
        await npc.say("Hello I don't recognise you", "We don't get many newcomers around here");

        const first = await player.ask(
            ["Hi I'm looking for a woman from east Ardougne", "So who's in charge here?"],
            true
        );

        if (first === 0) {
            await npc.say(
                'East Ardougnian women are easier to find in east Ardougne',
                'Not many would come to west ardougne to find one',
                'Any particular woman you have in mind?'
            );
            await player.say('Yes a lady called Elena');
            await npc.say('What does she look like?');

            if (player.inventory.has(PICTURE_ID)) {
                player.message('You show the picture to Jethick');
                await npc.say(
                    'Ah yes I recognise her',
                    'She was over here to help aid plague victims',
                    'I think she is staying over with the Rehnison family',
                    'They live in the small timbered building at the far north side of town',
                    "I've not seen her around here in a while mind you"
                );

                if (!player.inventory.has(BOOK_ID)) {
                    await npc.say(
                        "I don't suppose you could run me a little errand?",
                        'While you are over there',
                        'I borrowed this book from them',
                        'can you return it?'
                    );
                    player.message('Jethick gives you a book');
                    player.inventory.add(BOOK_ID);
                }
            } else {
                await player.say('Um brown hair, in her twenties');
                await npc.say('Hmm that doesn\'t narrow it down a huge amount', "I'll need to know more than that");
            }
        } else if (first === 1) {
            await npc.say(
                'Well King tyras has wandered off in to the west kingdom',
                "He doesn't care about the mess he's left here",
                'The city warder Bravek is in charge at the moment',
                "He's not much better"
            );
        }
    } else if ((stage >= 6 && stage <= 10) || stage === -1) {
        await npc.say("Hello I don't recognise you", "We don't get many newcomers around here");
    }
}

async function rehnisonDialogue(player, npc) {
    switch (stageOf(player)) {
        case 6:
            await player.say('Hi I hear a woman called Elena is staying here');
            await npc.say(
                'Yes she was staying here',
                'but slightly over a week ago she was getting ready to go back',
                'However she never managed to leave',
                'My daughter Milli was playing near the west wall',
                'When she saw some shadowy figures jump out and grab her',
                'Milli is upstairs if you wish to speak to her'
            );
            break;
        case 7:
            await npc.say('Any luck with finding Elena yet?');
            await player.say('Not yet');
            await npc.say('I wish you luck she did a lot for us');
            break;
        case 11:
        case -1:
            await npc.say('Any luck with finding Elena yet?');
            await player.say('Yes she is safe at home now');
            await npc.say("That's good to hear she helped us a lot");
            break;
    }
}

async function milliDialogue(player, npc) {
    switch (stageOf(player)) {
        case 6:
            await player.say('Hello', 'Your parents say you saw what happened to Elena');
            await npc.say(
                'sniff',
                'Yes I was near the south east corner',
                'When I saw Elena walking by',
                'I was about to run to greet her',
                'when some men jumped out',
                'Shoved a sack over her head',
                'and dragged her into a building'
            );
            await player.say('Which building?');
            await npc.say('It was the mossy windowless building', 'In that south east corner of west Ardougne');
            setStage(player, 7);
            break;
        case 7:
        case 8:
        case 9:
        case 10:
            await npc.say('Have you found Elena yet?');
            await player.say('No I am still looking');
            await npc.say('I hope you find her', 'She was nice');
            break;
        case -1:
            await npc.say('Have you found Elena yet?');
            await player.say("Yes she's safe at home");
            await npc.say('I hope she comes and visits sometime');
            await player.say('Maybe');
            break;
    }
}

async function billyDialogue(player) {
    player.message('Billy is not interested in talking');
}

// the clerk calls Bravek, who lets you into his office
async function clerkFetchesBravek(player, npc) {
    await player.say("Someone's been kidnapped", 'and is being held in a plague house');
    await npc.say(
        "I'll see what I can do I suppose",
        `Mr Bravek there's a ${player.isMale() ? 'man' : 'lady'} here who really needs to speak to you`
    );

    const bravek = nearNpc(player, BRAVEK_ID, 15);

    if (bravek) {
        await bravek.say('I suppose they can come in then', 'If they keep it short');
        player.message('You go into the office');
        player.teleport(BRAVEK_OFFICE.x, BRAVEK_OFFICE.y);
    }
}

async function clerkDialogue(player, npc) {
    const stage = stageOf(player);

    await npc.say('Hello welcome to the civic office of west Ardougne', 'How can I help you?');

    if (stage !== 8 && stage !== 9) {
        const menu = await player.ask(['who is through that door?', "I'm just looking thanks"], false);

        if (menu === 0) {
            await player.say('Who is through that door?');
            await npc.say('The city warder Bravek is in there');
            await player.say('Can i go in?');
            await npc.say('He has asked not to be disturbed');
        } else if (menu === 1) {
            await player.say("I'm just looking thanks");
        }

        return;
    }

    const first = await player.ask(
        ['I need permission to enter a plague house', 'who is through that door?', "I'm just looking thanks"],
        false
    );

    if (first === 0) {
        await player.say('I need permission to enter a plague house');
        await npc.say(
            'Rather you than me',
            'Well the mourners normally deal with that stuff',
            'You should speak to them',
            'Their headquarters are right near the city gate'
        );

        const menu = await player.ask(
            [
                "I'll try asking them then",
                "Surely you don't let them run everything for you?",
                'This is urgent though'
            ],
            true
        );

        if (menu === 1) {
            await npc.say(
                "Well they do know what they're doing there",
                'If they did start doing something badly',
                'Bravek the city warder',
                'would have the power to override',
                "I can't see that happening though"
            );

            const second = await player.ask(["I'll try asking them then", 'Can i speak to Bravek anyway?'], false);

            if (second === 0) {
                await player.say("I'll try asking them then");
            } else if (second === 1) {
                await player.say('Can I speak to Bravek anyway?');
                await npc.say('He has asked not to be disturbed"'); // sic

                const third = await player.ask(['This is urgent though', 'Ok I will leave him alone'], true);

                if (third === 0) {
                    await clerkFetchesBravek(player, npc);
                }
            }
        } else if (menu === 2) {
            await clerkFetchesBravek(player, npc);
        }
    } else if (first === 1) {
        await player.say('Who is through that door?');
        await npc.say('The city warder Bravek is in there');
        await player.say('Can i go in?');
        await npc.say('He has asked not to be disturbed');

        const second = await player.ask(['This is urgent though', 'Ok I will leave him alone'], true);

        if (second === 0) {
            await clerkFetchesBravek(player, npc);
        }
    } else if (first === 2) {
        await player.say("I'm just looking thanks");
    }
}

const WARRANT_LINES = [
    "hmm well I guess they're not taking the issue of a kidnap seriously enough",
    'They do go a bit far sometimes',
    "I've heard of Elena, she has helped us a lot",
    "Ok I'll give you this warrant to enter the house"
];

async function giveWarrant(player, npc, ...says) {
    await player.say(...says);
    await npc.say(...WARRANT_LINES);
    player.inventory.add(WARRANT_ID);
}

async function postBravekDialogue(player, npc) {
    const finale = await player.ask(
        ["Ok I'll go speak to them", 'Is that all anyone says around here?', "They won't listen to me"],
        false
    );

    if (finale === 0) {
        await player.say("Ok I'll go speak to them");
    } else if (finale === 1) {
        await player.say('Is that all anyone says around here');
        await npc.say('Well they know best about plague issues');

        const last2 = await player.ask(
            ["Don't you want to take an interest in it at all?", "They won't listen to me"],
            true
        );

        if (last2 === 0) {
            await npc.say('Nope I don\'t wish to take a deep interest in plagues', 'That stuff is too scary for me');

            const last3 = await player.ask(
                ["I see why people say you're a weak leader", "Ok I'll talk to the mourners", "they won't listen to me"],
                false
            );

            if (last3 === 0) {
                await player.say("I see why people say you're a weak leader");
                await npc.say(
                    'bah people always criticise their leaders',
                    'But delegating is the only way to lead',
                    'I delegate all plague issues to the mourners'
                );
                await player.say('this whole city is a plague issue');
            } else if (last3 === 1) {
                await player.say("Ok I'll talk to the mourners");
            } else if (last3 === 2) {
                await giveWarrant(
                    player,
                    npc,
                    "They won't listen to me",
                    "They say I'm not properly equipped to go in the house",
                    'Though I do have a very effective gas mask'
                );
            }
        } else if (last2 === 1) {
            await giveWarrant(
                player,
                npc,
                "They say I'm not properly equipped to go in the house",
                'Though I do have a very effective gas mask'
            );
        }
    } else if (finale === 2) {
        await giveWarrant(
            player,
            npc,
            "They won't listen to me",
            "They say I'm not properly equipped to go in the house",
            'Though I do have a very effective gas mask'
        );
    }
}

async function bravekGivesNote(player, npc) {
    await npc.say('Hmm let me think', 'ouch - thinking not clever', 'Ah here, she did scribble it down for me');
    player.message('Bravek hands you a tatty piece of paper');
    player.inventory.add(SCRUFFY_NOTE_ID);
    setStage(player, 9);
}

async function bravekDialogue(player, npc) {
    const stage = stageOf(player);

    switch (stage) {
        case 8: {
            await npc.say('My head hurts', "I'll speak to you another day");

            const menu = await player.ask(['This is really important though', 'Ok goodbye'], true);

            if (menu !== 0) {
                break;
            }

            await npc.say(
                "I can't possibly speak to you with my head spinning like this",
                'I went a bit heavy on the drink again last night',
                'curse my herbalist',
                'she made the best hang over cures',
                'Darn inconvenient of her catching the plague'
            );

            const menu2 = await player.ask(
                ['Ok goodbye', "You shouldn't drink so much then", 'Do you know what is in the cure?'],
                true
            );

            if (menu2 === 1) {
                await npc.say(
                    'Well positions of responsibility are hard',
                    'I need something to take my mind off things',
                    'especially with the problems this place has'
                );

                const menu3 = await player.ask(
                    ['Ok goodbye', 'Do you know what is in the cure?"', "I don't think drink is the best solution"], // sic
                    false
                );

                if (menu3 === 0) {
                    await player.say('Ok goodbye');
                } else if (menu3 === 1) {
                    await player.say('Do you know what is in the cure?');
                    await bravekGivesNote(player, npc);
                } else if (menu3 === 2) {
                    await npc.say(
                        'uurgh',
                        'My head still hurts too much to think straight',
                        "Oh for one of Trudi's hangover cures"
                    );
                }
            } else if (menu2 === 2) {
                await bravekGivesNote(player, npc);
            }

            break;
        }
        case 9:
            await npc.say('uurgh', 'My head still hurts too much to think straight', "Oh for one of Trudi's hangover cures");

            if (player.inventory.has(HANGOVER_CURE_ID)) {
                await player.say('Try this');
                await mes(player, 'You give Bravek the hangover cure', 'Bravek gulps down the foul looking liquid');
                player.inventory.remove(HANGOVER_CURE_ID);
                await npc.say(
                    'grruurgh',
                    "Ooh that's much better",
                    "thanks that's the clearest my head has felt in a month",
                    'Ah now what was it you wanted me to do for you?'
                );
                setStage(player, 10);
                await player.say(
                    'I need to rescue a kidnap victim called Elena',
                    "She's being held in a plague house I need permission to enter"
                );
                await npc.say('Well the mourners deal with that sort of thing');
                await postBravekDialogue(player, npc);
            }

            break;
        case 10:
        case 11:
        case -1:
            await npc.say('thanks again for the hangover cure');

            if (player.inventory.has(WARRANT_ID) || stage === 11 || stage === -1) {
                await player.say('Not a problem, happy to help out');
                await npc.say("I'm just having a little bit of whisky", 'then I\'ll feel really good');
            } else {
                await npc.say('Ah now what was it you wanted me to do for you?');
                await player.say(
                    'I need to rescue Elena',
                    "She's now a kidnap victim",
                    "She's being held in a plague house I need permission to enter"
                );
                await npc.say('Well the mourners deal with that sort of thing');
                await postBravekDialogue(player, npc);
            }

            break;
    }
}

// Mourner.java headMournerDialogue: option 0 only shows for the head mourner from stage 9
async function headMournerOption(player, npc, chosen) {
    if (chosen === 0) {
        await player.say('I need clearance to enter a plague house', "It's in the southeast corner of west ardougne");
        await npc.say('You must be nuts, absolutely not');

        const menu = await player.ask(
            ["There's a kidnap victim inside", "I've got a gasmask though", "Yes I'm utterly crazy"],
            true
        );

        if (menu === 0) {
            await npc.say("Well they're as good as dead already then", 'No point trying to save them');
        } else if (menu === 1) {
            await npc.say("It's not regulation", "Anyway you're not properly trained to deal with the plague");
            await player.say('How do I get trained');
            await npc.say('It requires a strict 18 months of training');
            await player.say("I don't have that sort of time");
        } else if (menu === 2) {
            await npc.say('You waste my time', 'I have much work to do');
        }
    } else if (chosen === 1) {
        await player.say("So what's a mourner?");
        await npc.say(
            "We're working for King Luthas of East ardougne",
            'Trying to contain the accursed plague sweeping west Ardougne',
            'We also do our best to ease these peoples suffering',
            "We're nicknamed mourners",
            'because we spend a lot of time at plague victims funerals',
            'no one else is allowed to risk the funerals',
            "It's a demanding job",
            'And we get little thanks from the people here'
        );
    } else if (chosen === 2) {
        await player.say("I've not got the plague though");
        await npc.say(
            "Can't risk you being a carrier",
            'that protective clothing you have',
            "isn't regulation issue",
            "It won't meet safety standards"
        );
    } else if (chosen === 3) {
        await player.say("I'm looking for a woman named Elena");
        await npc.say(
            'ah yes I\'ve heard of her',
            'A missionary I believe',
            'She must be mad coming over here voluntarily',
            'I hear rumours she has probably caught the plague now',
            'Very tragic stupid waste of life'
        );
    }
}

async function westMournerDialogue(player, npc) {
    const stage = stageOf(player);
    const head = npc.id === HEAD_MOURNER_ID;

    if (head) {
        await npc.say(
            'How did you did get into West Ardougne?', // sic
            "Ah well you'll have to stay",
            "Can't risk you spreading the plague outside"
        );
    } else {
        await npc.say(
            'hmm how did you did get over here?', // sic
            "You're not one of this rabble",
            "Ah well you'll have to stay",
            "Can't risk you going back now"
        );
    }

    // Java checks stage >= 9 and >= 0, so after the quest (-1) neither the clearance nor the Elena option shows
    const clearance = head && stage >= 9;
    const options = [];

    if (clearance) {
        options.push('I need clearance to enter a plague house');
    }

    options.push("so what's a mourner?", "I've not got the plague though");

    if (stage >= 0) {
        options.push("I'm looking for a woman named Elena");
    }

    const menu = await player.ask(options, false);

    if (menu >= 0) {
        await headMournerOption(player, npc, clearance ? menu : menu + 1);
    }
}

const DIALOGUES = {
    [JETHICK_ID]: jethickDialogue,
    [TED_ID]: rehnisonDialogue,
    [MARTHA_ID]: rehnisonDialogue,
    [BILLY_ID]: billyDialogue,
    [MILLI_ID]: milliDialogue,
    [CLERK_ID]: clerkDialogue,
    [BRAVEK_ID]: bravekDialogue,
    [MOURNER_WEST_ARDOUGNE_ID]: westMournerDialogue,
    [HEAD_MOURNER_ID]: westMournerDialogue
};

async function onTalkToNPC(player, npc) {
    const dialogue = DIALOGUES[npc.id];

    if (!dialogue) {
        return false;
    }

    player.engage(npc);
    await dialogue(player, npc);
    player.disengage();

    return true;
}

async function rehnisonDoor(player, wallObject) {
    const stage = stageOf(player);

    if (stage >= 6 || stage === -1) {
        await player.enterDoor(wallObject);
        player.message('You go through the door');
        return;
    }

    const ted = nearNpc(player, TED_ID, 8);

    if (!ted) {
        return;
    }

    player.message("The door won't open");
    player.engage(ted);
    await ted.say('Go away we don\'t want any');

    if (player.y >= 569 && player.inventory.has(BOOK_ID)) {
        player.inventory.remove(BOOK_ID);
        await player.say('I have come to return a book from Jethick');
        await ted.say('Ok I guess you can come in then');
        player.disengage();
        await player.enterDoor(wallObject);
        setStage(player, 6);
        return;
    }

    player.disengage();
}

async function bravekDoor(player, wallObject) {
    const stage = stageOf(player);

    if (stage >= 9 || stage === -1) {
        await player.enterDoor(wallObject);
        return;
    }

    if (player.x >= 648) {
        const bravek = nearNpc(player, BRAVEK_ID, 8);

        if (bravek) {
            player.engage(bravek);
            await bravek.say("Go away,I'm busy", "I'm", 'um', 'In a meeting');
            player.disengage();
        }

        player.message("The door won't open");
    } else {
        await player.enterDoor(wallObject);
    }
}

async function onWallObjectCommandOne(player, wallObject) {
    if (wallObject.id === REHNISON_DOOR_ID) {
        await rehnisonDoor(player, wallObject);
        return true;
    }

    if (wallObject.id === BRAVEK_DOOR_ID) {
        await bravekDoor(player, wallObject);
        return true;
    }

    return false;
}

module.exports = { onTalkToNPC, onWallObjectCommandOne };
