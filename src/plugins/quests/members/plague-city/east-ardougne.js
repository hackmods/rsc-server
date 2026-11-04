// Ported from Open-RSC Core-Framework authentic/quests/members/PlagueCity.java (Edmond, Alrena, the dug soil, the mud
// pile, the sewer pipe, Alrena's cupboard) and authentic/npcs/ardougne/west/Mourner.java (the two east-side mourners 444
// and 451) (AGPL-3.0). https://classic.runescape.wiki/w/Plague_City
//
// questStages.plagueCity (the Java stages; the other areas are west-ardougne.js and plague-house.js):
//   0  Edmond (437, his house in East Ardougne 615-625 x 576-586) asks for help -> 1
//   1  dwellberries (765, ground spawns in McGrubor's wood 544,453 / 544,460 / 564,443 / 566,457) to Alrena (450), who
//      makes the gasmask (766) -> 2. She hides a spare in her cupboard (452 at 614,579; Search gives one from stage 2 on,
//      also after the quest, which is how Biohazard gets its mask back)
//   2  four buckets of water (50) on the dug up soil (447 at 620,581) set cache.soilSoften; the spade (211) on it drops
//      you into the sewer (621,3414) -> 3
//   3  the rope (237) on the large sewer pipe (449 at 636,3422) -> 4
//   4  Edmond (his sewer spawn at 625,3417) pulls the grill off with you -> 5. From 5 on the pipe takes you to West
//      Ardougne (632,589) while the gasmask is worn (after Plague City and Biohazard, without it)
//   5-10  West Ardougne (west-ardougne.js), the plague house (plague-house.js)
//   11 Edmond ends the quest -> -1: 1 quest point, mining 700 + 300 per mining level (quarter points), the magic scroll
//      (752; reading it learns the Ardougne teleport, items.js). After the quest he gives another scroll if you have none
//      and never read one.
// The pile of mud (448 at 620,3414) climbs back up to the garden (620,578).
// Cache flags (Java names): soilBuckets (soil_buckets), soilSoften (soil_soften), ardougneScroll (ardougne_scroll).

const EDMOND_ID = 437;
const ALRENA_ID = 450;
const MOURNER_BY_ALRENA_ID = 444;
const MOURNER_BY_ENTRANCE_ID = 451;

const BUCKET_ID = 21;
const BUCKET_OF_WATER_ID = 50;
const SPADE_ID = 211;
const ROPE_ID = 237;
const MAGIC_SCROLL_ID = 752;
const DWELLBERRIES_ID = 765;
const GASMASK_ID = 766;

const DUG_SOIL_ID = 447;
const MUD_PILE_ID = 448;
const SEWER_PIPE_ID = 449;
const CUPBOARD_CLOSED_ID = 451;
const CUPBOARD_OPEN_ID = 452;

const SEWER_LANDING = { x: 621, y: 3414 };
const GARDEN_LANDING = { x: 620, y: 578 };
const WEST_ARDOUGNE_LANDING = { x: 632, y: 589 };

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

async function canIHelp(player, npc) {
    await player.say('can i help find her?');
    await npc.say(
        'really, would you?',
        "I've been working on a plan to get over the wall",
        "but I'm too old and tired to carry it through",
        "if you're going over the first thing you'll need is protection from the plague",
        'My wife made a special gasmask  for elena',
        'with dwellberries rubbed into it',
        'Dwellberries help repel the virus',
        'We need some more though'
    );
    await player.say('Where can I find these Dwellberries?');
    await npc.say("the only place i know is mcgrubor's wood to the north");
    await player.say("ok I'll go get some");
    setStage(player, 1);
}

async function sorryIHaveToGo(player, npc) {
    await player.say("I'm sorry i have to go");
    await npc.say('ok then goodbye');
}

// PlagueCity.handleReward: 1 quest point, mining 700 + 300 per mining level (quarter points)
function completeQuest(player) {
    player.completeQuest('plagueCity', {
        questPoints: 1,
        experience: { mining: 700 + 300 * player.skills.mining.base },
        message: 'Well done you have completed the plague city quest'
    });
}

async function edmondDialogue(player, npc) {
    switch (stageOf(player)) {
        case 0: {
            await player.say('hello old man');
            player.message('the man looks upset');
            await player.say("what's wrong?");
            await npc.say("I've got to find my daughter", "i pray that she's still alive");

            const first = await player.ask(["What's happened to her?", 'Well, good luck with finding her'], false);

            if (first === 0) {
                await player.say("what's happened to her?");
                await npc.say(
                    "elena's a missionary and a healer",
                    'three weeks ago she managed to cross the ardougne wall',
                    "no one's allowed to cross the wall in case they spread the plague",
                    'but after hearing the screams of suffering she felt she had to help',
                    "she said she'd be gone for a few days but we've heard nothing since"
                );

                const second = await player.ask(
                    ['Tell me more about the plague', 'Can i help find her?', "I'm sorry i have to go"],
                    false
                );

                if (second === 0) {
                    await player.say('Tell me more about the plague');
                    await npc.say(
                        'The mourners can tell you more than me',
                        "they're the only ones allowed to cross the border",
                        'I do know the plague is a horrible way to go',
                        "that's why elena felt she had to go help"
                    );

                    const third = await player.ask(['Can I help find her?', "I'm sorry i have to go"], false);

                    if (third === 0) {
                        await canIHelp(player, npc);
                    } else if (third === 1) {
                        await sorryIHaveToGo(player, npc);
                    }
                } else if (second === 1) {
                    await canIHelp(player, npc);
                } else if (second === 2) {
                    await sorryIHaveToGo(player, npc);
                }
            } else if (first === 1) {
                await player.say('Well, good luck with finding her');
            }

            break;
        }
        case 1:
            await player.say('hello Edmond');
            await npc.say('have you got the dwellberries?');

            if (player.inventory.has(DWELLBERRIES_ID)) {
                await player.say('yes i have some here');
                await npc.say('take them to my wife alrena');
            } else {
                await player.say("sorry I'm afraid not");
                await npc.say("you'll probably find them in mcgrubor's wood to the north");
            }

            break;
        case 2:
            if (player.cache.soilSoften) {
                await player.say("I've soaked the soil with water");
                await npc.say("that's great it should be soft enough to dig through now");
                break;
            }

            await player.say("hi Edmond, I've got the gasmask now");
            await npc.say(
                'good stuff now for the digging',
                'beneath are the ardougne sewers',
                "there you'll find access to west ardougne",
                'the problem is the soil is rock hard',
                "you'll need to pour on some  buckets of water to soften it up",
                "I'll keep an eye out for the mourners"
            );
            break;
        case 3:
            await player.say(
                "Edmond, I can't get through to west ardougne",
                "there's an iron grill blocking my way",
                "i can't pull it off alone"
            );
            await npc.say('if you get some rope you could tie it to the grill', 'then we could both pull it from here');
            break;
        case 4:
            await player.say("I've tied the other end of this rope to the grill");
            await mes(
                player,
                'Edmond gets a good grip on the rope',
                'together you tug the rope',
                'you hear a clunk as you both fly backwards'
            );
            await npc.say(
                "that's done the job",
                'Remember always wear the gasmask',
                "otherwise you'll die over there for certain",
                'and please bring my elena back safe and sound'
            );
            setStage(player, 5);
            break;
        case 5:
        case 6:
        case 7:
        case 8:
        case 9:
        case 10:
            await player.say('hello');
            await npc.say('Have you found Elena yet?');
            await player.say("Not yet, it's big city over there");
            await npc.say("I hope it's not to late"); // sic
            break;
        case 11:
            await npc.say('Thank you thank you', 'Elena beat you back by minutes', "now I said I'd give you a reward");
            completeQuest(player);
            await npc.say(
                'What can I give you as a reward I wonder?',
                'Here take this magic scroll',
                'I have little use for it, but it may help you'
            );
            player.inventory.add(MAGIC_SCROLL_ID);
            player.message('This story is to be continued');
            break;
        case -1:
            if (
                player.bank.has(MAGIC_SCROLL_ID) ||
                player.inventory.has(MAGIC_SCROLL_ID) ||
                player.cache.ardougneScroll
            ) {
                await npc.say('Ah hello again', 'And thank you again');
                await player.say('No problem');
            } else {
                const menu = await player.ask(['Do you have any more of those scrolls?', 'no problem'], false);

                if (menu === 0) {
                    await player.say('Do you have any more of those scrolls?');
                    await npc.say('yes here you go');
                    player.inventory.add(MAGIC_SCROLL_ID);
                } else if (menu === 1) {
                    await player.say('No problem');
                }
            }

            break;
    }

}

async function alrenaDialogue(player, npc) {
    switch (stageOf(player)) {
        case 0:
            await player.say('hello madam');
            await npc.say('oh hello there');
            await player.say('are you ok?');
            await npc.say('not too bad', "I've just got some troubles on my mind");
            break;
        case 1:
            await player.say('hello, Edmond has asked me to help find your daughter');
            await npc.say(
                'yes he told me',
                "I've begun making your special gas mask",
                'but i need some dwellberries to finish it'
            );

            if (player.inventory.has(DWELLBERRIES_ID)) {
                await player.say("yes I've got some here");
                await mes(
                    player,
                    'you give the dwellberries to alrena',
                    'alrena crushes the berries into a smooth paste',
                    'she then smears the paste over a strange mask'
                );
                player.inventory.remove(DWELLBERRIES_ID);
                player.inventory.add(GASMASK_ID);
                await npc.say(
                    'there we go all done',
                    'while in west ardougne you must wear this at all times',
                    "or you'll never make it back"
                );
                player.message('alrena gives you the mask');
                await npc.say(
                    "while you two are digging I'll make a spare mask",
                    "I'll hide it in the cupboard incase the mourners come in"
                );
                setStage(player, 2);
            } else {
                await player.say("I'll try to get some");
                await npc.say("the best place to look is in mcgrubor's wood to the north");
            }

            break;
        case 2:
            if (player.cache.soilSoften) {
                await player.say('hello again alrena');
                await npc.say("how's the tunnel going?");
                await player.say("I'm getting there");
                await npc.say(
                    'one of the mourners has been sniffing around',
                    'asking questions about you and Edmond',
                    'you should keep an eye out for him'
                );
                await player.say('ok, thanks alrena');
                break;
            }

            await player.say('hello alrena');
            await npc.say('hello darling', "how's that tunnel coming along?");
            await player.say("we're getting there");
            await npc.say("well I'm sure you're quicker than Edmond");
            await player.say("i just need to soften the soil and then we'll start digging");
            await npc.say(
                "if you lose your protective clothing I've made a spare set",
                "they're hidden in the cupboard incase the mourners come in"
            );
            break;
        case 3:
            await player.say('hello alrena');
            await npc.say('Hi, have you managed to get through to west ardougne?');
            await player.say('not yet, but i should be going through soon');
            await npc.say(
                'make sure you wear your mask while you are over there',
                "i can't think of a worse way to die"
            );
            break;
        case 4:
        case 5:
        case 6:
        case 7:
        case 8:
        case 9:
        case 10:
            await player.say('hello alrena');
            await npc.say('hello, any word on elena?');
            await player.say("not yet I'm afraid");
            break;
        case 11:
        case -1:
            await npc.say(
                'Thank you for rescuing my daughter',
                'Elena has told me of your bravery',
                'In entering a house that could have been plague infected',
                "I can't thank you enough"
            );
            break;
    }
}

const PLAGUE_ORIGIN = [
    "it's all down to king tyras of west ardougne",
    'rather than protecting his people',
    'he spends his time in the lands to the west',
    'when he returned last he brought the plague with him',
    'then left before the problem became serious'
];

const PLAGUE_SYMPTOMS = [
    'the first signs are typical flu symptoms',
    'these tend to be followed by severe nightmares',
    'horrifying hallucinations which drive many to madness'
];

const PLAGUE_WORSE = [
    'it gets worse',
    'next the victims blood supply changes into a thick black tar like liquid',
    "at this point they're past help",
    'their skin is cold to the touch',
    'the victim is now brain dead',
    'their body however lives on driven by the virus',
    'roaming like a zombie',
    'spreading itself further wherever possible'
];

// Mourner.java: the three-option plague menu the entrance mourner ends with. `options` are the menu lines as each stage
// words them; `last` is what the player says for the third, then the mourner's reply
async function plagueMenu(player, npc, options, last) {
    const menu = await player.ask(options, false);

    if (menu === 0) {
        await player.say('what brought the plague to ardougne?');
        await npc.say(...PLAGUE_ORIGIN);
        await player.say('does he know how bad the situation is now?');
        await npc.say("if he did he wouldn't care", 'i believe he wants his people to suffer', "he's an evil man");
        await player.say("isn't that treason?");
        await npc.say("he's not my king");
    } else if (menu === 1) {
        await player.say('what are the symptoms of the plague?');
        await npc.say(...PLAGUE_SYMPTOMS);
        await player.say('sounds nasty');
        await npc.say(...PLAGUE_WORSE);
        await player.say("I think I've heard enough");
    } else if (menu === 2) {
        await player.say(last[0]);

        if (last.length > 1) {
            await npc.say(...last.slice(1));
        }
    }
}

async function mournerByAlrena(player, npc) {
    switch (stageOf(player)) {
        case 0:
            await player.say('hello there');
            await npc.say('Do you a have problem traveller?'); // sic
            await player.say('no i just wondered why your wearing that outfit', 'is it fancy dress?');
            await npc.say("no it's for protection");
            await player.say('protection from what');
            await npc.say('the plague of course');
            break;
        case 1: {
            await player.say('hello');
            await npc.say('what do you want?');

            const menu = await player.ask(['who are you?', 'nothing just being polite'], true);

            if (menu === 0) {
                await npc.say(
                    "I'm a mourner",
                    "it's my job to help heal the plague victims of west ardougne",
                    'and to make sure the disease is contained'
                );
                await player.say('who pays you?');
                await npc.say("we feel as the kings henchmen it's our duty to help the people of ardougne");
                await player.say('very noble of you');
                await npc.say(
                    'if you come down with any symptoms such as a flu or nightmares',
                    'let me know immediately'
                );
            } else if (menu === 1) {
                await npc.say('hmm ok then', 'be on your way');
            }

            break;
        }
        case 2: {
            if (player.cache.soilSoften) {
                await player.say('hello');
                await npc.say('what are you up to with old man Edmond?');
                await player.say("nothing, we've just been chatting");
                await npc.say('what about, his daughter?');
                await player.say('oh, you know about that then');
                await npc.say(
                    'we know about everything that goes on in ardougne',
                    'we have to if we are to contain the plague'
                );
                await player.say('have you seen his daughter recently');
                await npc.say(
                    "i imagine she's caught the plague",
                    "either way she won't be allowed out of west Ardougne",
                    'The risk is to great' // sic
                );
                break;
            }

            await player.say('hello');
            await npc.say('are you ok');
            await player.say("yes I'm fine thanks");
            await npc.say('have you experienced any plague symptoms?');

            const menu = await player.ask(
                ['What are the symptoms?', 'No i feel fine', 'No, but tell me where did the plague come from?'],
                false
            );

            if (menu === 0) {
                await player.say('What are the symptoms?');
                await npc.say(
                    "firstly you'll come down with a heavy flu",
                    'this is usually followed by horrifying nightmares'
                );
                await player.say('i used to have nightmares when i was younger');
                await npc.say(
                    'not like these i assure you',
                    'soon after a thick black liquid will seep from your nose and eyes'
                );
                await player.say('yuck!');
                await npc.say("when it get's to this stage there's nothing we can do for you");
            } else if (menu === 1) {
                await player.say('no i feel fine');
                await npc.say('well if you take a turn for the worse let me know straight away');
                await player.say('can you cure it then?');
                await npc.say('no', 'but you will have to be treated');
                await player.say('treated?');
                await npc.say(
                    'we have to take measures to contain the disease',
                    "that's why you must let us know immediately if you take a turn for the worst"
                );
            } else if (menu === 2) {
                await player.say('no, but tell me where did the plague come from');
                await npc.say(
                    'many put it down to the low living standards of the west ardougnians',
                    'however this is not the case',
                    'the truth is the king Tyras of west ardougne',
                    'unknowingly brought the plague into his kingdom',
                    'when returning from one of his visits to the darklands in the north west'
                );
            }

            break;
        }
        case 3:
            await player.say('hello there');
            await npc.say('been digging have we?');
            await player.say('what do you mean!');
            await npc.say('your hands are covered in mud');
            await player.say('oh that', "I've just been helping Edmond with his allotment");
            await npc.say("funny, you don't look like the gardening type");
            await player.say('oh no, i love gardening', "it's my favourite pass time");
            break;
        case 4:
            await player.say('hello there');
            await npc.say('what are you up to?');
            await player.say('what do you mean?');
            await npc.say('you and that Edmond fella', "you're looking very suspicious");
            await player.say("we're just gardening", 'have you heard any news about west ardougne?');
            await npc.say(
                'just the usual',
                "everyone's sick or dying",
                "I'm furious at king tyras for bringing this plague to our lands"
            );
            break;
        default:
            await player.say('hello');
            await npc.say('what are you up to?');
            await player.say('nothing');
            await npc.say("i don't trust you");
            await player.say("you don't have to");
            await npc.say('if i find that you attempting to cross the wall', "I'll make sure you never return");
            break;
    }
}

async function mournerByEntrance(player, npc) {
    switch (stageOf(player)) {
        case 0:
        case 1:
            await player.say('hello there');
            await npc.say('can I help you?');
            await player.say('what are you doing?');
            await npc.say(
                "I'm guarding the border to west ardougne",
                'no one except us mourners can pass through'
            );
            await player.say('why?');
            await npc.say('the plague of course', "we can't risk cross contamination");
            await plagueMenu(
                player,
                npc,
                ['What brought the plague to ardougne?', 'What are the symptoms of the plague?', 'Ok then see you around'],
                ['ok then see you around', 'maybe']
            );
            break;
        case 2:
            await player.say('hello there');
            await npc.say('can i help you?');
            await player.say('just being polite');
            await npc.say("I'm not here to chat", 'sorry, what is it you do?', 'i protect people like you from the plague');
            await player.say('how?');
            await npc.say('by making sure no one crosses the wall');
            await player.say('what if they do');
            await npc.say('then they must be treated immediately');
            await player.say('treated?');
            await npc.say(
                'any west ardougnians which cross the wall',
                'must be detained and disposed of safely'
            );
            await player.say("sound's like nasty work");
            await npc.say('some find it hard', 'personally i quite enjoy it');
            await plagueMenu(
                player,
                npc,
                ['what brought the plague to ardougne', 'what are the symptoms of the plague', "you're a very sick man"],
                ["you're a very sick man", "What? I'm pretty sure I haven't caught the plague yet"]
            );
            break;
        case 3:
            await player.say('hello');
            await npc.say('what do you want');
            await player.say('so how did you get into this line of work?');
            await npc.say("as king lanthas's henchmen", 'it is our duty to protect his people');
            await player.say('i thought that was the job of the paladins');
            await npc.say('their swords and armour have no effect on the plague');
            await plagueMenu(
                player,
                npc,
                ['what brought the plague to ardougne?', 'what are the symptoms of the plague?', 'well keep up the good work'],
                ['well keep up the good work', 'will do']
            );
            break;
        default:
            await player.say('hi');
            await npc.say('what are you up to?');
            await player.say('just sight seeing');
            await npc.say('this is no place for sight seeing', "don't you know there's been a plague outbreak?");
            await player.say('yes i had heard');
            await npc.say('then i suggest you leave as soon as you can');
            await plagueMenu(
                player,
                npc,
                ['What brought the plague to ardougne?', 'What are the symptoms of the plague?', 'thanks for the advice'],
                ['thanks for the advice']
            );
            break;
    }
}

const DIALOGUES = {
    [EDMOND_ID]: edmondDialogue,
    [ALRENA_ID]: alrenaDialogue,
    [MOURNER_BY_ALRENA_ID]: mournerByAlrena,
    [MOURNER_BY_ENTRANCE_ID]: mournerByEntrance
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

async function useOnSoil(player, item) {
    const stage = stageOf(player);

    if (item.id === BUCKET_OF_WATER_ID) {
        if (stage !== 2) {
            player.message('You see no reason to do that at the moment');
            return;
        }

        const buckets = player.cache.soilBuckets || 0;

        // the fourth bucket softens it
        if (buckets >= 3) {
            await mes(
                player,
                'you poor the water onto the soil', // sic
                'the soil softens slightly',
                'the soil is soft enough to dig into'
            );
            player.cache.soilSoften = true;
        } else {
            await mes(player, 'you poor the water onto the soil', 'the soil softens slightly'); // sic
        }

        player.inventory.remove(BUCKET_OF_WATER_ID);
        player.inventory.add(BUCKET_ID);
        player.cache.soilBuckets = buckets + 1;
    } else if (item.id === SPADE_ID) {
        if (player.cache.soilSoften || stage >= 3 || stage === -1) {
            await mes(
                player,
                'you dig deep into the soft soil',
                'Suddenly it crumbles away',
                'you fall through',
                'and land in the sewer'
            );
            player.teleport(SEWER_LANDING.x, SEWER_LANDING.y);
            player.message('Edmond follows you down the hole');
            delete player.cache.soilSoften;

            if (stage === 2) {
                setStage(player, 3);
            }
        } else {
            await mes(player, 'you dig the soil', 'The ground is rather hard');
        }
    }
}

// Java blockUseLoc: any item on the soil (447) is claimed, the rope on the pipe (449) too
async function onUseWithGameObject(player, gameObject, item) {
    if (gameObject.id === DUG_SOIL_ID) {
        await useOnSoil(player, item);
        return true;
    }

    if (gameObject.id === SEWER_PIPE_ID) {
        if (item.id === ROPE_ID) {
            const stage = stageOf(player);

            if (stage >= 4 || stage === -1) {
                player.message('nothing interesting happens');
                return true;
            }

            player.message('you tie one end of the rope to the sewer pipe\'s grill', 'and hold the other end in your hand');

            if (stage === 3) {
                setStage(player, 4);
            }
        }

        return true;
    }

    return false;
}

async function enterSewerPipe(player) {
    const stage = stageOf(player);

    // the gasmask is no longer needed once Plague City and Biohazard are both done
    if (stage === -1 && player.questStages.biohazard === -1) {
        player.message('you climb through the sewer pipe');
        player.teleport(WEST_ARDOUGNE_LANDING.x, WEST_ARDOUGNE_LANDING.y);
        return;
    }

    if (stage >= 5 || stage === -1) {
        if (player.inventory.isEquipped(GASMASK_ID)) {
            player.message('you climb through the sewer pipe');
            player.teleport(WEST_ARDOUGNE_LANDING.x, WEST_ARDOUGNE_LANDING.y);
        } else {
            player.message('You should wear your gasmask', 'Before entering west Ardougne');
        }

        return;
    }

    player.message('the grill is too secure', "you can't pull it off alone");
}

function searchCupboard(player) {
    const stage = stageOf(player);

    if (stage >= 2 || stage === -1) {
        if (!player.inventory.has(GASMASK_ID)) {
            player.message('you find a protective mask');
            player.inventory.add(GASMASK_ID);
        } else {
            player.message("it's an old dusty cupboard");
        }
    }
}

async function gameObjectCommand(player, gameObject, command) {
    switch (gameObject.id) {
        case CUPBOARD_OPEN_ID:
        case CUPBOARD_CLOSED_ID:
            if (/^open$/i.test(command)) {
                player.world.replaceEntity('gameObjects', gameObject, CUPBOARD_OPEN_ID);
                player.message('You open the cupboard');
            } else if (/^close$/i.test(command)) {
                player.world.replaceEntity('gameObjects', gameObject, CUPBOARD_CLOSED_ID);
                player.message('You close the cupboard');
            } else {
                searchCupboard(player);
            }

            return true;
        case MUD_PILE_ID:
            player.message('you climb up the mud pile');
            player.teleport(GARDEN_LANDING.x, GARDEN_LANDING.y);
            return true;
        case SEWER_PIPE_ID:
            await enterSewerPipe(player);
            return true;
    }

    return false;
}

async function onGameObjectCommandOne(player, gameObject) {
    return gameObjectCommand(player, gameObject, gameObject.definition.commands[0]);
}

async function onGameObjectCommandTwo(player, gameObject) {
    return gameObjectCommand(player, gameObject, gameObject.definition.commands[1]);
}

module.exports = { onTalkToNPC, onUseWithGameObject, onGameObjectCommandOne, onGameObjectCommandTwo };
