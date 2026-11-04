// Ported from Open-RSC Core-Framework authentic/quests/members/HazeelCult.java (AGPL-3.0), with the poison-on-range
// branch of authentic/skills/cooking/ObjectCooking.java
// https://classic.runescape.wiki/w/The_Hazeel_Cult
//
// questStages.theHazeelCult (the Java stages); the side is player.cache.good_side or player.cache.evil_side:
//   0  Ceril Carnillean (418) in the Carnillean house in Ardougne (619,620): "yes, off course,i'd be happy to help" -> 1
//   1  Clivet (424) in the cave south of the house (cave entrance 417 at (619,649) leads to (617,3479), see
//      game-objects/object-tele-points.js) tells the Carnillean story -> 2, then the side is chosen
//   2  Clivet again: "You're crazy, i'd never help you" (or refusing the murder) -> 3 good_side, and Clivet rafts off;
//      "So what would i have to do?" + "Ok i'll do it" -> 3 evil_side and a Poison (177)
//   good side:
//   3  the hideout is reached by the 5 sewer valves (412-416) and the log raft (432), object-tele-points.js
//      (SewerValve.java): right, left, right, right, left. Killing Alomone (427) there gives the carnillean armour
//      (755) -> 4
//   4  Ceril takes the armour, pays 5 coins and gives Jones the rest -> 5
//   5  searching the butler's cupboard (441, open 441 / closed 440, at (614,1562)) with Ceril near: poison and the
//      amulet unmask Jones -> -1, 1 quest point, thieving 2000 + 200 * level (quarter points), 2000 coins
//   evil side:
//   3  the Poison on the range (435) at (618,3453) in the house kitchen (ObjectCooking.java) -> 4
//   4  Clivet hands over the Mark of Hazeel (753, stage stays 4); Alomone in the hideout sends you for the script -> 5
//   5  the crate (439) at (611,3451) in the kitchen gives the Carnillean Key (756); the bookcase (436) at (617,1559)
//      upstairs slides to a hidden room (614,2504); the key on the Carnillean Chest (438) at (620,2506) gives the
//      Script of Hazeel (747) -> 6
//   6  Alomone reads the script at the tomb, Lord Hazeel (426) rises -> -1, 1 quest point, the same experience, 2000 coins
// The butler (419) at (613,1562) is "Jones"; Claus (429) the cook, Henryeta (422), Philipe (423) and the guards (420)
// only comment on the story. The cult members (425) in the hideout chase an intruder from the good side.

const CERIL_ID = 418;
const BUTLER_ID = 419;
const CARNILLEAN_GUARD_ID = 420;
const HENRYETA_ID = 422;
const PHILIPE_ID = 423;
const CLIVET_ID = 424;
const CULT_MEMBER_ID = 425;
const LORD_HAZEEL_ID = 426;
const ALOMONE_ID = 427;
const CLAUS_ID = 429;

const TALK_IDS = new Set([
    CLAUS_ID,
    CERIL_ID,
    BUTLER_ID,
    HENRYETA_ID,
    PHILIPE_ID,
    CARNILLEAN_GUARD_ID,
    CLIVET_ID,
    CULT_MEMBER_ID,
    ALOMONE_ID
]);

const COINS_ID = 10;
const POISON_ID = 177;
const SCRIPT_OF_HAZEEL_ID = 747;
const MARK_OF_HAZEEL_ID = 753;
const CARNILLEAN_ARMOUR_ID = 755;
const CARNILLEAN_KEY_ID = 756;

const RANGE_CARNILLEAN_ID = 435;
const RANGE_CARNILLEAN = { x: 618, y: 3453 };
const TOP_LEVEL_BOOKCASE_ID = 436;
const CARNILLEAN_CHEST_OPEN_ID = 437;
const CARNILLEAN_CHEST_CLOSED_ID = 438;
const BASEMENT_CRATE_ID = 439;
const BUTLERS_CUPBOARD_CLOSED_ID = 440;
const BUTLERS_CUPBOARD_OPEN_ID = 441;

const BUTLERS_ROOM = { x: 613, y: 1562 };
const SECRET_ROOM = { x: 614, y: 2504 };
const SHRINE = { x: 580, y: 3419 };
const HAZEEL_SPAWN = { x: 580, y: 3420 };

// addnpc(..., 120 seconds) as 640 ms ticks
const LORD_HAZEEL_TICKS = Math.ceil(120000 / 640);

function stageOf(player) {
    return player.questStages.theHazeelCult || 0;
}

function setStage(player, stage) {
    player.questStages.theHazeelCult = stage;
}

function goodSide(player) {
    return player.cache.good_side != null;
}

function evilSide(player) {
    return player.cache.evil_side != null;
}

// Open-RSC mes + delay(3)
async function mes(player, ...lines) {
    for (const line of lines) {
        player.message(`@que@${line}`);
        await player.world.sleepTicks(3);
    }
}

// Open-RSC ifnearvisnpc: the nearest one within `radius` tiles
function nearNpc(player, id, radius) {
    return player
        .getNearbyEntitiesByID('npcs', id, radius * 2 + 1)
        .sort((a, b) => player.getDistance(a) - player.getDistance(b))[0];
}

// a scene moves from one speaker to another (Ceril upstairs, Lord Hazeel)
function turnTo(player, npc) {
    if (player.interlocutor === npc) {
        return;
    }

    if (player.interlocutor) {
        player.disengage();
    }

    player.engage(npc);
}

// Open-RSC setChasing: the npc goes for the player once the talk is over
function chase(player, npc) {
    if (npc && typeof npc.attack === 'function') {
        Promise.resolve(npc.attack(player)).catch(() => {});
    }
}

function teleBubble(player, x, y) {
    if (typeof player.sendTeleportBubble !== 'function') {
        return;
    }

    player.sendTeleportBubble(x, y);

    for (const other of player.localEntities ? player.localEntities.known.players : []) {
        other.sendTeleportBubble(x, y);
    }
}

// HazeelCult.handleReward, QuestRewardRegistrar: 1 quest point, thieving 2000 + 200 * level (quarter points)
function completeQuest(player) {
    const experience = { thieving: 2000 + 200 * player.skills.thieving.base };

    if (goodSide(player)) {
        player.completeQuest('theHazeelCult', {
            questPoints: 1,
            experience,
            message: 'Well done you have completed the Hazeel cult quest'
        });
        player.message('ceril gives you 2000 gold coins');
        player.inventory.add(COINS_ID, 2000);
    } else if (evilSide(player)) {
        player.message('Hazeel gives you some coins');
        player.inventory.add(COINS_ID, 2000);
        player.completeQuest('theHazeelCult', { questPoints: 1, experience });
        player.message('you have completed the hazeel cult quest');
    }
}

async function cerilArmour(player, npc) {
    await player.say('ceril, how are you?', "Look, I've found the armour");
    await npc.say('well done i must say i am impressed');
    await mes(player, 'you give ceril the family armour');
    player.inventory.remove(CARNILLEAN_ARMOUR_ID);
    await npc.say(
        'before we send you on your way',
        "i'll get our butler jones",
        'to whip you up some of his special broth'
    );
    await player.say(
        "i'd rather not",
        'i overheard the cult members talking',
        'the buttler is really working for them' // sic
    );

    let ceril;

    if (Math.floor(npc.y / player.world.planeElevation) === 0) {
        // ceril of ground floor
        await npc.say('that\'s it, come with me', "we'll sort this out once and for all");
        await mes(player, "you follow ceril up to butler Jones' room");
        player.teleport(BUTLERS_ROOM.x, BUTLERS_ROOM.y);
        ceril = nearNpc(player, CERIL_ID, 10);
    } else {
        // ceril of 1st floor: unknown from OG RSC, he stays put (Open-RSC note)
        await npc.say("that's it", "we'll sort this out once and for all");
        ceril = npc;
    }

    if (!ceril) {
        return;
    }

    turnTo(player, ceril);
    await mes(player, 'ceril speaks briefly with Jones');
    await ceril.say(
        "Well, he assures me that he's a loyal hard working man",
        'I cannot fathom, why you would believe he is a spy'
    );
    await player.say("surely you won't take his word for it?");
    await ceril.say(
        'we have also decided that due to the humilliation you have caused', // sic
        'it is only fair that Jones shall recieve your reward', // sic
        'you shall recieve payment more suited to your low life personality' // sic
    );
    await mes(player, 'ceril gives you 5 gold coins');
    player.inventory.add(COINS_ID, 5);
    await mes(player, 'ceril gives jones 695 gold coins');
    await ceril.say('now take it and leave');
    await mes(
        player,
        'butler Jones has a slight grin',
        "You're going to need more than just your word",
        "To prove Jones' treachary" // sic
    );
    setStage(player, 5);
}

async function ceril(player, npc) {
    const stage = stageOf(player);

    if (stage === 0) {
        await player.say('hello there');
        await npc.say('blooming, thieving, wierdos', "why don't they leave me alone?"); // sic
        const menu = await player.ask(
            ["What's wrong?", 'You probably deserve it', "You seem uptight, I'll leave you alone"],
            false
        );

        if (menu === 0) {
            await player.say("What's wrong?");
            await npc.say("it's those strange folk from the forest", 'those freaks keep breaking into my house');
            await player.say('have they taken much?');
            await npc.say(
                'they first broke in months ago and stole a suit of armour',
                "the strange thing is that they've broken in four times since",
                'but took nothing'
            );
            await player.say('and you are...?');
            await npc.say(
                "why, i'm ceril carnillean",
                'we really are quite a famous bloodline',
                "we've played a large part in ardounge pollitics for generations", // sic
                'maybe you could help retrieve the armour?',
                'of course there would be a handsom cash reward for yourself' // sic
            );
            const option = await player.ask(
                ["No thanks i've got plans", "yes, off course,i'd be happy to help"], // sic
                false
            );

            if (option === 0) {
                await player.say("no thanks i've got plans");
                await npc.say("no wonder i'm the one with the big house and you're on the streets");
            } else if (option === 1) {
                await player.say("yes of course, i'd be happy to help");
                await npc.say(
                    "that's very kind of you",
                    'I caught a glimpse of the thieves leaving',
                    'but due to ermm... my cold... I was unable to give chase',
                    'they were dressed all in black',
                    'I think they may have belonged to some sort of cult'
                );
                await player.say('do you know where they are?');
                await npc.say(
                    'my old butler once followed them',
                    'to a cave entrance in the forest south of here',
                    'unfortunately the next night he died in his sleep'
                );
                await player.say("that's awful");
                await npc.say(
                    "it's ok, a replacement arrived the next day",
                    "he's been great, cooks an excellent broth"
                );
                await player.say("ok ceril, i'll see what i can do");
                setStage(player, 1);
            }
        } else if (menu === 1) {
            await player.say('you probably deserve it');
            await npc.say(
                'who are you to judge me?',
                'hmmm, you look like a peasant',
                "i'm wasting my time talking to you"
            );
        } else if (menu === 2) {
            await player.say("you seem uptight,i'll leave you alone");
            await npc.say('yes, i doubt you could help');
        }
    } else if (stage === 1 || stage === 2) {
        await player.say('hello ceril');
        await npc.say("it's sir ceril to you", "and shouldn't you be out recovering my suit of armour?");
    } else if (stage === 3) {
        await npc.say('have you had any luck yet?');

        if (goodSide(player)) {
            await player.say("hello ceril, i've discovered the hideout");
            await npc.say('well done... and the armour?');
            await player.say(
                "i'm afraid not",
                'i spoke to a cult member in the entrance of the cave',
                'but he escaped into the sewer systems',
                'seems they have a grievance with your family',
                'something to do with some bloke called hazeel'
            );
            await npc.say(
                'err errmm... no',
                "They're obviously all mad",
                'just find them and bring back the armour'
            );
        } else if (evilSide(player)) {
            await player.say("i'm afraid not ceril");
            await npc.say("well that's strange", 'the butler seemed quite sure about their location');
        }
    } else if (stage === 4) {
        if (goodSide(player)) {
            if (player.inventory.has(CARNILLEAN_ARMOUR_ID)) {
                await cerilArmour(player, npc);
            } else {
                await player.say('ceril, how are you?');
                await npc.say('Im ok. Have you found the armour');
                await player.say("i'm afraid not");
                await npc.say("well i'm not paying you to see the sights");
                await player.say("okay, i'll go and try and retrieve it for you");
            }
        } else if (evilSide(player)) {
            await player.say('hello again');
            await npc.say(
                'oh my, the misery, the pain',
                'my son is a good boy but stupid as well',
                "i can't believe he gave his dinner to scruffy",
                'without having the servents check it for poison first', // sic
                'how could he be so careless?'
            );
            await player.say('scruffy?');
            await npc.say(
                "he's been in the family for twenty years the poor dog",
                'what did he ever do to hurt anyone?'
            );
        }
    } else if (stage === 5) {
        if (goodSide(player)) {
            await player.say('you owe me money');
            await npc.say('i owe you nothing now go away', 'before i have jones throw you out');
        } else if (evilSide(player)) {
            await player.say('ceril, how are you?');
            await npc.say("I'm devestated", "i don't know what to do with myself since i lost scruffy"); // sic
            await mes(player, 'ceril bursts into tears');
        }
    } else if (stage === 6) {
        await player.say('hello ceril, how are you?');
        await npc.say('I think the thieves may have been back in the house');
        await player.say('why?');
        await npc.say(
            "i'm not sure but it seem's as if some of my books",
            'have been re-arranged in my study',
            "it's either that or i'm losing my marbles"
        );
    } else if (stage === -1) {
        if (goodSide(player)) {
            await player.say('hello ceril');
            await npc.say(
                'well hello there',
                "brave adventurer, it's good to see you again",
                "if it wasn't for you",
                'that butler jones would have poisoned me by now'
            );
        } else if (evilSide(player)) {
            await player.say('hello ceril');
            await npc.say(
                'i maybe wrong',
                'but ever since i asked for your help',
                "thing's have gone from bad to worse",
                'i think from now on you better keep out of my way'
            );
        }
    }
}

async function butler(player, npc) {
    const stage = stageOf(player);

    if (stage === 0 || stage === 2) {
        await player.say('hello there');
        await npc.say('hello,how are you today?');
        await player.say('good thanks and yourself');
        await npc.say('fine and dandy');
    } else if (stage === 1) {
        await player.say('hello, what is this building?');
        await npc.say(
            'this is the property of Sir Ceril Carnillean',
            'of the noble carnillean family',
            "you're welcome to look around",
            "but i'm afraid i'll have to keep an eye on you",
            "we've been having a real problem with thieves",
            'strange cult folk coming out the forest'
        );
        await player.say("that's a shame");
        await npc.say(
            'yes well these things are bound to happen',
            "when you're as wealthy as the Varnilleans" // sic
        );
        const menu = await player.ask(
            ['Have you any more info on the carnilleans?', 'How long have you worked here?', 'Ok then take care'],
            false
        );

        if (menu === 0) {
            await player.say('Have you any more info on the carnilleans?');
            await npc.say(
                "there's a lot i could tell you",
                'about the carnillean family history',
                "i'm afraid if did speak about such matter's",
                'i would lose my job and that i cannot risk'
            );
        } else if (menu === 1) {
            await player.say('how long have you worked here?');
            await npc.say('long enough to know the carnilleans', 'are not as innocent or noble as they seem');
        } else if (menu === 2) {
            await player.say('ok then take care');
            await npc.say('you to');
        }
    } else if (stage === 3) {
        await player.say('how long have you worked here?');
        await npc.say("long enough to know the carnillean's", 'are not as innocent or noble as they seem');
    } else if (stage === 4) {
        if (goodSide(player)) {
            await player.say('jones i need to talk to you');
            await npc.say('do you need some help with your quest?');
            await player.say('you can stop the act jones', "i know you're working for the cult");
            await npc.say("what? don't be so silly");
            await player.say('I overheard the cult leader talking about you');
            await npc.say('look here,you may think you know something', 'but really you have no idea');
            await player.say('i know once i reveal the truth', "you'll be locked up");
            await npc.say('you think that old fool ceril', 'will take your word over mine', "he completely trust's me");
            await player.say('we will have to see about that');
            await npc.say("i'll warn you once more traveller", "don't get involved");
        } else if (evilSide(player)) {
            await player.say('hello there');
            await npc.say(
                'hello friend,i heard about your handy work',
                'quite amusing really',
                "I'm sure hazeel will be pleased with you anyway",
                'keep up the good work'
            );
        }
    } else if (stage === 5) {
        if (goodSide(player)) {
            await player.say('hello');
            await npc.say(
                'you fool',
                'did you think you could simply accuse me and save the day?',
                "we've been working on this for years",
                'your interference is only a minor set back to our plans',
                'and when the mighty hazeel does return',
                'the likes of you and the carnilleans will be the first of many to suffer'
            );
        } else if (evilSide(player)) {
            await npc.say('hello again friend', 'I see you you have the mark', 'you should keep that covered up'); // sic
            await player.say("oh that's just an old family pass down");
            await npc.say(
                "you don't have to pretend to me friend",
                'our cause is one and the same',
                "the sooner lord hazeel is avenged",
                'the better for us and this city'
            );
            await player.say('have you any idea where the sacred script is');
            await npc.say(
                "no idea i'm afraid",
                'it must be somewhere in the house',
                "but i can't find it for the life of me",
                "i've searched high and low"
            );
            await player.say("doesn't ceril get suspisous"); // sic
            await npc.say('that old fool', "he can't can't see the forest for the tree's"); // sic
        }
    } else if (stage === 6) {
        await player.say('hello jones');
        await npc.say('have you managed to find the script?');

        if (player.inventory.has(SCRIPT_OF_HAZEEL_ID)) {
            await player.say('I have it here');
            await npc.say(
                'incredible, we owe you a lot',
                'you better get it back to our hideout as quick as you can',
                'these our exciting times traveller', // sic
                'once the great hazeel returns',
                'things are going to really change around here'
            );
        } else {
            await player.say("i'm afraid i've lost it");
            await npc.say(
                'how could you be so foolish',
                'the future of our people completly relys on that script', // sic
                'you better find it again quickly'
            );
        }
    } else if (stage === -1) {
        if (goodSide(player)) {
            await player.say('hello stranger');
            await npc.say('why hello there');
            await player.say("i take it you're the new butler");
            await npc.say("that's right", 'i think they had some problems with the last one');
            await player.say('you could say that');
        } else if (evilSide(player)) {
            await player.say('hello jones');
            await npc.say("it's an honour to be in your presence again traveller", 'I hope things are well');
            await player.say('not bad, yourself');
            await npc.say("i'm good thanks");
        }
    }
}

async function henryeta(player, npc) {
    const stage = stageOf(player);

    if (stage >= 0 && stage <= 2) {
        await player.say('hello');
        await npc.say(
            'oh hello',
            'if you wish to look around the carnillean family home',
            'please refraine from touching anything', // sic
            'with those grubby hands of yours'
        );
    } else if (stage === 3) {
        await player.say('hello madam');

        if (goodSide(player)) {
            await npc.say("i hope you've found those awful holigans", "I can't sleep at night"); // sic
            await player.say("i'm working on it madam");
            await npc.say("i don't know", 'there really are some strange folk around these parts');
        } else if (evilSide(player)) {
            await npc.say('i hope you found those awful hooligans', "I can't sleep at night");
            await player.say("I'm afraid not");
            await npc.say('you really are useless');
            await player.say('thanks a lot');
        }
    } else if (stage === 4) {
        if (goodSide(player)) {
            await player.say('hello');
            await npc.say('oh, hello there adventurer', 'i hope you were careful dealing with those nasty men');
            await player.say('i was fine, thanks');
        } else if (evilSide(player)) {
            await player.say('hello are you ok?');
            await npc.say(
                "no i'm not ok",
                'those animals slaughtered my precious scruffy',
                "i'll never recover",
                "i'm emotionaly scarred for life" // sic
            );
            await player.say("i'm sorry to hear that");
            await npc.say(
                "don't be sorry it's not your fault",
                'just find those animals and punish them severely',
                'before i get to them first'
            );
        }
    } else if (stage === 5 || stage === 6) {
        if (goodSide(player)) {
            await player.say('hello henyeta'); // sic
            await npc.say("don't think you can accuse my trusted staff", 'then be friends with me');
            await player.say('what i said about jones is true');
            await npc.say("don't be so ridiculous", "next you'll tell me he murdered our old butler");
        } else if (evilSide(player)) {
            await player.say('hello');
            await npc.say("i'm sorry i'm too depressed to talk to you", 'poor scruffy...');
            await player.say('yeah, poor scruffy!');
        }
    } else if (stage === -1) {
        if (goodSide(player)) {
            await player.say('hello');
            await npc.say(
                'hello again adventurer"', // sic
                'things really have picked up around here',
                'since you dealt with those nasty cult members',
                'good to hear'
            );
        } else if (evilSide(player)) {
            await player.say('hello');
            await npc.say("i've been instructed by my husband not to talk to you", 'so go away and leave me alone');
            await player.say('charming');
        }
    }
}

async function philipe(player, npc) {
    const stage = stageOf(player);

    const toys = async (hello) => {
        await player.say(hello);
        await npc.say('i want more toys');
        await player.say("sorry i don't have any");
        await npc.say('i want sweets, gimme sweets');
    };

    const watch = async () => {
        await player.say('hello');
        await npc.say('mommy said your here to', 'kill all the nasty men', 'that come into our house'); // sic
        await player.say('something like that');
        await npc.say('can i watch?');
        await player.say('no');
    };

    if (stage >= 0 && stage <= 2) {
        await player.say('hello there');
        await npc.say('what have you brought me?', 'I want some more toys');
        await player.say("I'm afraid i don't have any");
        await npc.say('toys, i want toys');
    } else if (stage === 3) {
        if (goodSide(player) || evilSide(player)) {
            await toys('hello');
            await player.say("no sorrry i don't have sweets either"); // sic
            await npc.say('i hate you, i want my mum');
        }
    } else if (stage === 4) {
        if (goodSide(player)) {
            await watch();
        } else if (evilSide(player)) {
            await player.say('hello youngster');
            await mes(player, 'the boy looks very upset');
            await npc.say('someone killed scruffy', 'i liked scruffy', 'he never told me off');
            await player.say("that's unfortunate");
            await npc.say('i want my mommy');
        }
    } else if (stage === 5) {
        if (goodSide(player)) {
            await player.say('hello youngster');
            await npc.say("daddy say's you dont like Jones", 'Jones is nice', 'he brings me toys and sweets');
            await player.say('jones is a bad person philipe');
            await npc.say("you're a bad person", "i don't like you");
            await player.say('ok');
        } else if (evilSide(player)) {
            await watch();
        }
    } else if (stage === 6) {
        await player.say('hello youngster');
        await npc.say('why are you still here?');
        await player.say('just looking around');
        await npc.say('have you got me some toys?');
        await player.say('no');
        await npc.say("then i don't like you");
        await player.say("that's a shame");
    } else if (stage === -1) {
        if (goodSide(player) || evilSide(player)) {
            await toys('hello philipe');
            await player.say('no sorrry', "I don't have any sweets either"); // sic
            await npc.say('i hate you,i want my mum');
        }
    }
}

async function claus(player, npc) {
    const stage = stageOf(player);

    const goodDay = async () => {
        await player.say('hello there');
        await npc.say('hello, how are you today');
        await player.say('not bad thanks');
        await npc.say('good good');
    };

    if (stage === 0 || stage === 1) {
        await player.say('hello');
        await npc.say("sorry i can't talk now", 'you would be amazed how many', 'meals this family can go through');
    } else if (stage === 3) {
        await player.say('hello');
        await npc.say("you're that chap they've asked to help get those nasty folk", 'that keep breaking in');
        await player.say("yep, that's me");
        await npc.say('well i wish the best of luck');
    } else if (stage === 4) {
        if (goodSide(player)) {
            await goodDay();
        } else if (evilSide(player)) {
            await npc.say('hello there', 'caught any thieves yet?');
            await player.say('afraid not');
            await npc.say('keep at it');
        }
    } else if (stage === 5) {
        if (evilSide(player)) {
            await player.say('hello there');
            await npc.say(
                "i don't understand it",
                'how could someone slip poison in my cooking',
                'without me even noticing',
                "I'll be lucky if the carnilleans don't fire me",
                'those animals how could they do it',
                'poor scruffy'
            );
        } else if (goodSide(player)) {
            await goodDay();
        }
    } else if (stage === 6) {
        await player.say('hello there');
        await npc.say('those animals how could they do it', 'poor scruffy');
    } else if (stage === -1) {
        if (goodSide(player)) {
            await player.say('hello cook');
            await npc.say('well hello there traveller', 'are we fit and well');
            await player.say("yes i'm fine");
            await npc.say('good to hear');
        } else if (evilSide(player)) {
            await player.say('hello cook');
            await npc.say('get out of my kitchen', "can't you tell your not welcome around here"); // sic
        }
    }

    // stage 2: Claus says nothing (Java case 2: break)
}

async function carnilleanGuard(player, npc) {
    const stage = stageOf(player);

    if (stage >= 0 && stage <= 2) {
        await player.say('hello');
        await npc.say(
            "hello,i haven't seen you before",
            "if you've come to look at the carnillean family home",
            'just make sure you behave yourself',
            "we've had enough wierdos causing trouble", // sic
            'round here of late'
        );
    } else if (stage === 3) {
        await player.say('hello');
        await npc.say("hi i heard you're after the cult", 'who broke in the other night', "blooming wierdo's"); // sic
    } else if (stage === 4) {
        if (goodSide(player)) {
            await player.say('hello');
            await npc.say('hello brave adventurer', 'keep up the good work');
        } else if (evilSide(player)) {
            await player.say('hello there');
            await npc.say(
                'oh hello, did you hear?',
                'the cult members have been back',
                "I don't know what they've done",
                'but ceril is really upset'
            );
        }
    } else if (stage === 5) {
        if (goodSide(player)) {
            await player.say('hello');
            await npc.say(
                'hello adventurer',
                "i heard you've accused butler jones",
                'of being involved with the cult',
                "that's right",
                "to be honest i haven't",
                'trusted him since he turned up here',
                'a day after the old butler died',
                'it seems too much of a coincidence to me'
            );
        } else if (evilSide(player)) {
            await player.say('hello');
            await npc.say('hello adventurer', "you're still hanging around then");
        }
    } else if (stage === 6) {
        await player.say('hello guard');
        await npc.say(
            'hello there',
            'i hope you find the cult soon',
            'we think there may have been another burglary'
        );
        await player.say("that's worrying");
        await npc.say("i just don't know how they do it", "it seems like they're right under our noses");
    } else if (stage === -1) {
        if (goodSide(player)) {
            await player.say('hello');
            await npc.say("well if it isn't our own local hero", "it's good to see you in these parts again");
        } else if (evilSide(player)) {
            await player.say('hello');
            await npc.say(
                'you again',
                "didn't i tell you you're not welcome around here",
                'now leave before we have to get rough with you'
            );
        }
    }
}

// Clivet pushes off down the sewer; the good side is chosen
async function clivetLeaves(player, npc, raftLines) {
    await npc.say('then you\'re a fool', 'go back to your adventures traveller');
    await mes(player, ...raftLines);
    player.disengage();
    player.world.removeEntity('npcs', npc);
    await mes(player, 'you hear him call out', "@yel@clivet:you'll never find us...");
    setStage(player, 3);
    player.cache.good_side = true;
}

const RAFT_LINES = ['clivet boards the raft and pushes of down the sewer system']; // sic

// the Carnillean story and the choice of side (Java stages 1 and 2 share it)
async function clivetStory(player, npc, goodRaftLines) {
    const menu = await player.ask(['What do you mean?', "I've heard enough of your rubbish"], false);

    if (menu === 1) {
        await player.say("I've heard enough of your rubbish");
        await npc.say('then leave, fool');
        return;
    }

    if (menu !== 0) {
        return;
    }

    await player.say('what do you mean?');
    await npc.say(
        'the carnillean family house does not belong to them',
        "it's original owner was lord hazeel",
        'hazeel was one of the mahjarrat followers of zamorak',
        'The carnilleans harassed hazeel and his family for decades',
        "then one night they stormed hazeel's home",
        'one by one they tortured and then butchered him and his family',
        'the next day the carnillean forefathers moved into the property',
        "they've lived there on hazeel's wealth ever since"
    );
    await player.say(
        'ardounge history and pollitics are not my concern', // sic
        "i've been asked to do a job and i plan to carry it through"
    );
    await npc.say(
        "well now i'm asking you to do a job",
        'hazeel is going to return my friend',
        'those who aid his journey will gain rewards',
        "help us avenge hazeel's spirit so he may return"
    );

    const side = await player.ask(["You're crazy, i'd never help you", 'So what would i have to do?'], false);

    if (side === 0) {
        // GOOD SIDE
        await player.say("You're crazy, i'd never help you");
        await clivetLeaves(player, npc, goodRaftLines);
    } else if (side === 1) {
        // EVIL SIDE
        await player.say('so what would i have to do?');
        await npc.say(
            'first you must prove your loyalty to the cause',
            'you must kill one of the carnillean family members',
            "then we will know who's side you're really on",
            'so will you do it?'
        );

        const deed = await player.ask(["No i won't do it", "Ok i'll do it"], false);

        if (deed === 0) {
            await player.say("no i won't do it");
            await clivetLeaves(player, npc, RAFT_LINES);
        } else if (deed === 1) {
            await player.say("ok, i'll do it");
            await npc.say(
                'good, few see through the carnillean lies',
                'but i guessed you were of stronger character',
                'here take this poison, pour it into one of their meals',
                'once the deed is done return here'
            );
            player.inventory.add(POISON_ID, 1);
            setStage(player, 3);
            player.cache.evil_side = true;
        }
    }
}

async function clivet(player, npc) {
    const stage = stageOf(player);

    if (stage === 0) {
        await player.say('hello there');
        await npc.say('what do you want traveller');
        await player.say('just passing by');
        await npc.say('you have no business here', 'leave...now');
    } else if (stage === 1) {
        await player.say('do you know the carnilleans?');
        await npc.say("i'll mind my business you mind yours");
        await player.say("look i know you're hiding something", "i've heard there's a cult hideout down here");
        await npc.say("if you know what's best for you you'll leave now");
        await player.say('i have my orders');
        await npc.say('so that two faced cold hearted snob has got to you too has he?');
        await player.say('ceril carnillean is a decent man');
        await npc.say("there's a lot more than meets the eye to the carnilleans", "and none of it's decent");
        setStage(player, 2);
        await clivetStory(player, npc, RAFT_LINES);
    } else if (stage === 2) {
        await player.say('hello');
        await npc.say('so you\'ve returned"', 'now do you want to know the truth about the carnilleans?'); // sic
        await clivetStory(player, npc, ['the man jumps onto a small raft', 'and pushes off down the sewer system']);
    } else if (stage === 3) {
        if (goodSide(player)) {
            await player.say('hello there');
            await npc.say('oh not you again');
            await player.say('where is the cult hideout?');
            await npc.say(
                "you're a fool if you think you'll ever find it",
                "soon hazeel will return and you'll be punished"
            );
        } else if (evilSide(player)) {
            await player.say('hello there');
            await npc.say('traveller you have a mission', 'go to the carnillean house and poison their meal');
        }
    } else if (stage === 4) {
        if (goodSide(player)) {
            await player.say('hello');
            await npc.say('You again! I warned you to keep away', 'hazeel will punish you for your interference');
        } else if (evilSide(player)) {
            if (!player.inventory.has(MARK_OF_HAZEEL_ID)) {
                await player.say('hello', "I poured the poison into the carnillean's meal as requested");
                await npc.say(
                    'yes we have people on the inside who informed me of your deed',
                    'hazeel will reward you for your loyalty'
                );
                await player.say("ok, so what's next?");
                await npc.say('first you must wear the sign of hazeel');
                await mes(player, 'clivet hands you a small metal amulet');
                player.inventory.add(MARK_OF_HAZEEL_ID, 1);
                await npc.say(
                    "the amulet is proof to other cult members that you're one of us",
                    'it is also the key to finding the cult hideout'
                );
                await player.say('in what way?');
                await npc.say(
                    "the flow of the sewer's are controlled by 5 sewer valves above",
                    'turn them correctly and the sewer will carry you to the hideout',
                    'the sign of hazeel is your guide - you must begin at the tail',
                    'The cult leader alomone shall be expecting you'
                );
            } else {
                await player.say('hello');
                await npc.say('hello traveller', 'have you found the cult hideout yet?');
                await player.say('not yet im afraid');
                await npc.say('hurry! soon hazeel will return');
            }
        }
    } else if (stage === 5) {
        if (goodSide(player)) {
            await player.say('hello');
            await npc.say('You again! I warned you to keep away', 'hazeel will punish you for your interference');
        } else if (evilSide(player)) {
            await player.say('hello');
            await npc.say(
                'hello traveller',
                'all we need now is the sacred script of hazeel',
                'once we have that Hazeel can return'
            );
        }
    } else if (stage === 6) {
        await player.say('hello again');
        await npc.say('have you managed to find the script of hazeel?');

        if (player.inventory.has(SCRIPT_OF_HAZEEL_ID)) {
            await player.say('yes, i found it in the house');
            await npc.say(
                'amazing, the last piece',
                'now the time has come to change history and avenge lord hazeel',
                'take the script to alomone as quick as you can'
            );
        } else {
            await player.say('errm, no, i misplaced it');
            await npc.say("go to the house and don't return until you have the script");
        }
    } else if (stage === -1) {
        if (goodSide(player)) {
            await player.say('hello');
            await npc.say('You again! I warned you to keep away', 'bother someone else', 'go find some goblins to hack up');
        } else if (evilSide(player)) {
            await player.say('hello');
            await npc.say("It's good to see you again", 'i am patiently waiting for for hazeel to call upon me'); // sic
        }
    }
}

// returns the npc that gives chase once the talk is over
async function cultMember(player, npc) {
    const stage = stageOf(player);

    if (stage >= 0 && stage <= 2) {
        await player.say('hello');
        await npc.say('what how did you get in here?', 'leave now traveller');
    } else if (stage === 3) {
        if (goodSide(player)) {
            await player.say('hello there');
            await npc.say('what, how did you get in here', 'leave now traveller');
            return npc;
        } else if (evilSide(player)) {
            await player.say('hello there');
            await npc.say("can't you see i'm busy", 'the great hazeel shall return soon');
        }
    } else if (stage === 4 || stage === 5) {
        if (goodSide(player)) {
            await player.say('hello');
            await npc.say('what, an outsider', 'how did you get in here', 'you must leave, now');
            return npc;
        } else if (evilSide(player) && stage === 4) {
            await player.say('hi');
            await npc.say('hello, oh, are you new');
            await player.say("that's right");
            await npc.say(
                "well it's good to have you on board",
                'soon we should retrieved the sacred hazeel script', // sic
                'then at last we can bring are lord back from the dead' // sic
            );
        } else if (evilSide(player)) {
            await player.say('hello');
            await npc.say('hello there', 'untill we have the hazeel script', 'we cannot summon our master'); // sic
        }
    } else if (stage === 6) {
        await player.say('hello');
        await npc.say('you truly are our savior', 'you found the script of hazeel', 'now his injustice can be resolved');
    } else if (stage === -1) {
        if (goodSide(player)) {
            await player.say('hello');
            await npc.say('An outsider!', 'how did you get in here?', 'leave now fool or die');
            return npc;
        } else if (evilSide(player)) {
            await player.say('hello');
            await npc.say(
                'the traveller returns',
                'we are forever in your dept brave adventurer', // sic
                'i bow before you'
            );
        }
    }

    return null;
}

// the ceremony at the tomb of hazeel: the evil side's end
async function hazeelReturns(player, npc) {
    const { world } = player;

    await player.say('yes I have it here');
    await npc.say('finally our lord hazeel can return');
    await mes(player, 'alomone takes the hazeel script');
    player.inventory.remove(SCRIPT_OF_HAZEEL_ID);
    await npc.say(
        'with these words our lord will return and save us all',
        'come with me adventurer and let the ceromony begin' // sic
    );
    player.teleport(SHRINE.x, SHRINE.y);

    // Open-RSC teleports alomone to the shrine too; here he walks the two tiles from his spawn
    if (typeof npc.walkToPoint === 'function') {
        Promise.resolve(npc.walkToPoint(SHRINE.x, SHRINE.y)).catch(() => {});
    }

    await npc.say('I do this for you lord hazeel and all followers of zamorak');
    await mes(player, 'alomone kneels down infront of the shrine', 'he begins to read the script');
    player.message('the language is something you have never heard');
    await mes(
        player,
        'alomone reads on',
        'Alomone finishes the script',
        'the room is silent',
        'suddenly a shrill scream comes from the coffin of hazeel',
        'A shadowy figure appears'
    );

    const lordHazeel = world.spawnTimedNPC({
        id: LORD_HAZEEL_ID,
        x: HAZEEL_SPAWN.x,
        y: HAZEEL_SPAWN.y,
        ticks: LORD_HAZEEL_TICKS
    });
    teleBubble(player, HAZEEL_SPAWN.x, HAZEEL_SPAWN.y);
    turnTo(player, lordHazeel);

    await mes(player, 'the cult begin to chant');
    await lordHazeel.say(
        'my followers i am proud of you all',
        'I never expected to retun to these lands', // sic
        'I can see I have much to attend to',
        'In due time you will all be rewarded for your part',
        'brave adventurer, i believe your contribution was the most critical',
        'i owe you much, you may not be a follower of the great zamorak',
        'but you understand injustice and anger',
        'for this I certainly shall call upon your help in the future',
        'my people gain strength day to day',
        'you would be wise to join us while you can'
    );
    await player.say('I fight for myself');
    await lordHazeel.say(
        'hmm, fair enough for now',
        'I shall reward you with money',
        "But your reward of Zamorak's approval is far greater"
    );
    completeQuest(player);
    await lordHazeel.say(
        'now i must leave you',
        'i have much business to attend to with my brothers in the north',
        'i will see you all again but be aware',
        'soon much blood will be spilt over runescape'
    );

    player.disengage();
    world.removeEntity('npcs', lordHazeel);
    teleBubble(player, HAZEEL_SPAWN.x, HAZEEL_SPAWN.y);
}

// returns the npc that gives chase once the talk is over
async function alomone(player, npc) {
    const stage = stageOf(player);

    if (stage >= 0 && stage <= 2) {
        await player.say('hello');
        await npc.say('what, an intruder', 'kill him');
        return nearNpc(player, CULT_MEMBER_ID, 20) || null;
    } else if (stage === 3) {
        if (goodSide(player)) {
            await npc.say('How did get you get in here?'); // sic
            await player.say("I've come for the carnillean family armour");
            await npc.say('I thought I told the butler to get rid of you', 'he must be going soft');
            await player.say('so the butler is working for you too?', "Why's it always the Butler? I should have guessed");
            await player.world.sleepTicks(3);
            return npc;
        } else if (evilSide(player)) {
            await player.say('hello');
            await npc.say("Can't you see I'm busy?");
        }
    } else if (stage === 4) {
        if (goodSide(player)) {
            await player.say('hello alomone');
            await npc.say('out of my way', "can't you see we're busy here?");
            return npc;
        } else if (evilSide(player)) {
            await player.say('hi there');
            await npc.say(
                'well well, we have a new recruit',
                'Clivet told me about your willingness to prove yourself',
                'we must retrieve the sacred script of hazeel',
                'From the Carnillean house',
                "an ancient spell which if read over Hazeel's grave",
                'will bring him back to this world',
                "the Carnilleans aren't aware of it's existence",
                'we have eyes in the house',
                'Butler Jones is one of us',
                'go back to the house and try to find the script'
            );
            setStage(player, 5);
        }
    } else if (stage === 5) {
        if (goodSide(player)) {
            await player.say('hello');
            await npc.say('out of my way', "can't you see we're busy here?");
        } else if (evilSide(player)) {
            await player.say('hello alomone');
            await npc.say(
                'hazeel has waited long enough traveller',
                'the sooner you find the hazeel script the better'
            );
        }
    } else if (stage === 6) {
        // COMPLETE EVIL SIDE
        await player.say('hello');
        await npc.say('Do you have the sacred script of hazeel?');

        if (player.inventory.has(SCRIPT_OF_HAZEEL_ID)) {
            await hazeelReturns(player, npc);
        } else {
            await player.say("i'm afraid not");
            await npc.say('we need the script if hazeel is to return');
        }
    } else if (stage === -1) {
        if (goodSide(player)) {
            await player.say('hello again');
            await npc.say('leave here now intruder', 'before i loose my patience'); // sic
        } else if (evilSide(player)) {
            await player.say('hello again');
            await npc.say("we wait patiently for lord hazeel's calling");
            await player.say('ok, take care');
        }
    }

    return null;
}

const TALKS = {
    [CERIL_ID]: ceril,
    [BUTLER_ID]: butler,
    [HENRYETA_ID]: henryeta,
    [PHILIPE_ID]: philipe,
    [CLAUS_ID]: claus,
    [CARNILLEAN_GUARD_ID]: carnilleanGuard,
    [CLIVET_ID]: clivet,
    [CULT_MEMBER_ID]: cultMember,
    [ALOMONE_ID]: alomone
};

async function onTalkToNPC(player, npc) {
    if (!TALK_IDS.has(npc.id)) {
        return false;
    }

    player.engage(npc);

    let chaser = null;

    try {
        chaser = await TALKS[npc.id](player, npc);
    } finally {
        if (player.interlocutor) {
            player.disengage();
        }
    }

    chase(player, chaser);
    return true;
}

async function armourBehindAlomone(player) {
    await mes(
        player,
        'you have killed alomone',
        'lying behind his corpse',
        'you see the carnillean family armour',
        'you place it in your bag'
    );
    player.inventory.add(CARNILLEAN_ARMOUR_ID, 1);

    if (stageOf(player) === 3) {
        setStage(player, 4);
    }
}

// never claims: Alomone dies and drops like any npc; the armour scene runs alongside
async function onNPCDeath(player, npc) {
    if (npc.id !== ALOMONE_ID || !player || !player.questStages || !player.cache) {
        return false;
    }

    if (goodSide(player) && !player.inventory.has(CARNILLEAN_ARMOUR_ID)) {
        armourBehindAlomone(player).catch(() => {});
    }

    return false;
}

async function searchCupboard(player) {
    await mes(player, 'you search the cupboard');

    if (stageOf(player) !== 5 || !goodSide(player)) {
        await mes(player, 'but find nothing');
        return;
    }

    await mes(player, 'you find a bottle of poison', 'and a strange amulet');

    const ceril = nearNpc(player, CERIL_ID, 10);

    if (!ceril) {
        return;
    }

    await mes(player, 'you pass your finds to ceril');
    player.engage(ceril);

    try {
        await player.say("look what i've found?");
        await ceril.say("what's this for jones?");
        await mes(player, 'ceril takes the bottle');
        await ceril.say("i don't believe it, it's poison");

        const butler = nearNpc(player, BUTLER_ID, 10);

        if (butler) {
            await butler.say("mr carnillean, it's for the rats", "i'm just a loyal servent"); // sic
        }

        await ceril.say(
            "i've seen this amulet before",
            'the thieves that broke in',
            'one of them  was wearing exactly the same amulet', // sic
            "jones i don't believe it",
            'we trusted you'
        );

        if (butler) {
            await butler.say(
                "that's because you're an old fool ceril",
                'I should have got rid of you and your family weeks ago'
            );
        }

        await mes(player, 'ceril calls for the guards');

        if (butler) {
            await butler.say("don't worry ceril", "we'll make sure you and your family pay");
        }

        await ceril.say('looks like i owe you an apology traveller');
        await player.say("that's ok, we all make mistakes");
        await ceril.say(
            "if it wasn't for you he could have poisoned my whole family",
            "i'm sorry for the way i spoke to you",
            'the least i can do is give you a proper reward'
        );
        completeQuest(player);
        await player.say('thanks ceril');
        await ceril.say("thankyou, you're welcome here any time traveller");
    } finally {
        if (player.interlocutor) {
            player.disengage();
        }
    }
}

async function searchCrate(player) {
    await mes(player, 'you search the crate');

    if (stageOf(player) === 5 && evilSide(player) && !player.inventory.has(CARNILLEAN_KEY_ID)) {
        player.message('under the food packages');
        player.message('you find an old rusty key');
        player.inventory.add(CARNILLEAN_KEY_ID, 1);
    } else {
        player.message('but find nothing');
    }
}

async function searchBookcase(player) {
    await mes(player, 'you search the book case');

    if (stageOf(player) === 5 && evilSide(player)) {
        await mes(
            player,
            'as you pull out one of the books',
            'the shelves slide to the side',
            'revealing a secret passage',
            'you walk through'
        );
        player.teleport(SECRET_ROOM.x, SECRET_ROOM.y);
        await mes(player, 'the passage leads upwards', 'to an empty room');
    } else {
        player.message('but find nothing interesting');
    }
}

async function onGameObjectCommandOne(player, gameObject) {
    switch (gameObject.id) {
        case BUTLERS_CUPBOARD_CLOSED_ID:
            player.world.replaceEntity('gameObjects', gameObject, BUTLERS_CUPBOARD_OPEN_ID);
            player.message('You open the cupboard');
            return true;
        case BUTLERS_CUPBOARD_OPEN_ID:
            await searchCupboard(player);
            return true;
        case BASEMENT_CRATE_ID:
            await searchCrate(player);
            return true;
        case TOP_LEVEL_BOOKCASE_ID:
            await searchBookcase(player);
            return true;
        case CARNILLEAN_CHEST_CLOSED_ID:
            player.message('the chest is locked');
            return true;
        default:
            return false;
    }
}

async function onGameObjectCommandTwo(player, gameObject) {
    if (gameObject.id !== BUTLERS_CUPBOARD_OPEN_ID) {
        return false;
    }

    player.world.replaceEntity('gameObjects', gameObject, BUTLERS_CUPBOARD_CLOSED_ID);
    player.message('You close the cupboard');
    return true;
}

// ObjectCooking.java: the poison goes into the soup on the Carnillean kitchen range
async function poisonTheSoup(player) {
    if (stageOf(player) !== 3 || !evilSide(player)) {
        player.message('nothing interesting happens');
        return;
    }

    await mes(player, 'you poor the poison into the hot pot', 'the poison desolves into the soup'); // sic
    player.inventory.remove(POISON_ID);
    setStage(player, 4);
}

async function onUseWithGameObject(player, gameObject, item) {
    if (
        item.id === POISON_ID &&
        gameObject.id === RANGE_CARNILLEAN_ID &&
        gameObject.x === RANGE_CARNILLEAN.x &&
        gameObject.y === RANGE_CARNILLEAN.y
    ) {
        await poisonTheSoup(player);
        return true;
    }

    if (gameObject.id !== CARNILLEAN_CHEST_CLOSED_ID || item.id !== CARNILLEAN_KEY_ID) {
        return false;
    }

    player.message('you use the key to open');
    player.message('the chest');
    // changeloc(obj, 437 ms, open): the chest shuts again at once
    player.world.replaceTimed('gameObjects', gameObject, CARNILLEAN_CHEST_OPEN_ID, 1);
    player.message('inside the chest you find the sacred script of hazeel');
    player.inventory.add(SCRIPT_OF_HAZEEL_ID, 1);

    if (stageOf(player) === 5) {
        setStage(player, 6);
    }

    return true;
}

module.exports = {
    onTalkToNPC,
    onNPCDeath,
    onGameObjectCommandOne,
    onGameObjectCommandTwo,
    onUseWithGameObject
};
