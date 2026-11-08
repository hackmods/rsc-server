// Ported from Open-RSC Core-Framework authentic/quests/members/undergroundpass/npcs/UndergroundPassKoftik.java and the cave
// entrance (725) and crumbled rock (728) of obstacles/UndergroundPassObstaclesMap1.java (AGPL-3.0): Koftik, the king's scout, in
// his six places (Ardougne 626, bridge 627, 628, 629, black area 650, recovered 659), and the way into the cave. Stage map:
// shared.js.

const { ITEM, NPC, OBJECT, stageOf, setStage, cacheHas, mes, give, holds, nearNpc } = require('./shared');

async function koftikEnterCaveDialogue(player, npc) {
    await player.say('hello there, are you the kings scout?');
    await npc.say(
        'that i am brave adventurer',
        'King lathas informed me that you need to cross these mountains',
        "i'm afraid you'll have to go through the ancient underground pass"
    );
    await player.say("That's ok, i've travelled through many a cave in my time");
    await npc.say(
        "these caves are different..they're filled with the spirit of Zamorak",
        'You can feel it as you wind your way round the stalactites..',
        "an icy chill that penetrate's the very fabric of your being",
        'not so many travellers come down here these days...',
        '...but there are some who are still foolhardy enough'
    );
    setStage(player, 2);

    const menu = await player.ask(["i'll take my chances", 'tell me more'], true);

    if (menu === 0) {
        await npc.say("ok traveller, i'll catch up with you by the bridge");
    } else if (menu === 1) {
        await npc.say(
            'I remember seeing one such warrior. Going by the name of Randas...',
            '..he stood tall and proud like an elven king...',
            "..that same pride made him vulnerable to Zamorak's calls...",
            "..Randas' worthy desire to be a great and mighty warrior...",
            "..also made him corruptible to Zamorak's promises of glory",
            '..Zamorak showed him a way to achieve his goals, by appealing...',
            '..to that most base and dark nature that resides in all of us'
        );
        await player.say('what happened to him?');
        await npc.say('no one knows');
    }
}

function giveCloth(player) {
    if (!holds(player, ITEM.DAMP_CLOTH)) {
        give(player, ITEM.DAMP_CLOTH);
        player.message('koftik gives you a damp cloth');
    }
}

async function idleChat(player, npc) {
    await player.say('hello koftik');
    await npc.say("hello adventurer, how's things?");
    await player.say('not bad, yourself?');
    await npc.say('im good, just keeping an eye out');
}

async function koftikArdougne(player, npc) {
    switch (stageOf(player)) {
        case 0:
            player.message("koftik doesn't seem interested in talking");
            break;
        case 1:
            await koftikEnterCaveDialogue(player, npc);
            break;
        case 2:
            await npc.say("i know it's scary in there", "but you'll have to go in alone", "i'll catch up as soon as i can");
            break;
        case 3:
        case 4:
            await player.say('hello koftik');

            if (
                (cacheHas(player, 'orb_of_light1') &&
                    cacheHas(player, 'orb_of_light2') &&
                    cacheHas(player, 'orb_of_light3') &&
                    cacheHas(player, 'orb_of_light4')) ||
                stageOf(player) === 4
            ) {
                await npc.say('it scares me in there', "the voices, don't you hear them?");
                await player.say("you'll be ok koftik");
                return;
            }

            await npc.say('once your over the bridge keep going...', "..straight ahead, i'll meet you further up");
            break;
        case 5:
        case 6:
        case 7:
            player.message("koftik doesn't seem interested in talking");
            break;
        case 8: {
            await player.say('thanks for getting me out koftik');
            await npc.say('always a pleasure squire', 'have you informed the king about iban?');

            const menu = await player.ask(['no, not yet', "yes, i've told him"], true);

            if (menu === 0) {
                await npc.say(
                    'traveller this is no time to linger',
                    'the king must know that ibans dead',
                    'this is a truly historical moment for ardounge'
                );
            } else if (menu === 1) {
                await npc.say('good to hear, the sooner we find king Tyras..', 'the better');
            }

            break;
        }
        case -1:
            await idleChat(player, npc);
            break;
        default:
    }
}

async function koftikCave1(player, npc) {
    switch (stageOf(player)) {
        case 2: {
            await player.say('koftik, how can we cross the bridge?');
            await npc.say("i'm not sure, seems as if others were here before us though");

            if (!holds(player, ITEM.DAMP_CLOTH)) {
                await npc.say('i found this cloth amongst the charred remains of arrows');
                await player.say('charred arrows?');
                await npc.say('they must have been trying to burn something');
                await player.say('or someone!');
                give(player, ITEM.DAMP_CLOTH);
            }

            await player.say('interesting, we better keep our eyes open');
            await npc.say('There also seems to the remains of a diary');

            const menu = await player.ask(['not to worry, probably just kid litter', 'what does it say?']);

            if (menu === 0) {
                await player.say('not to worry, probably just litter');
                await npc.say('well..maybe?');
            } else if (menu === 1) {
                await player.say('what does it say?');
                await mes(player, '@red@it seems to be written by the adventurer Randas, it reads...');
                await mes(player, '@red@It began as a whisper in my ears. Dismissing the sounds...');
                await mes(player, '@red@..as the whistling of the wind, I steeled myself against...');
                await mes(player, '@red@..these forces and continued on my way');
                await mes(player, '@red@But the whispers became moans...');
                await mes(player, '@red@at once fearsome and enticing like the call of some beautiful siren');
                await mes(player, '@red@Join us! The voices cried, Join us!');
                await mes(player, '@red@Your greatness lies within you, but only Zamorak can unlock your potential..');
                await player.say('it sounds like randas was losing it');
            }

            break;
        }
        case 3:
        case 4:
        case 5:
        case 6:
        case 7:
        case -1:
            await player.say('hi koftik');
            giveCloth(player);
            break;
        case 8:
            await player.say('thanks for getting me out koftik');
            await npc.say('always a pleasure squire');
            giveCloth(player);
            break;
        default:
    }
}

async function koftikCave2(player, npc) {
    switch (stageOf(player)) {
        case 3:
        case 4:
            await player.say('hello koftik');
            await npc.say('how are you bearing adventurer?');
            await player.say("i'm still alive, and you?");
            await npc.say('cold, i can feel it in my blood, so cold');
            player.message('koftik seems to be poorly');
            await player.say('where do we go now koftik?');
            await npc.say(
                'straight on again, more winding passages',
                'more lethal traps, more blood and more pain',
                'blood..pain.. hee hee,  more blood.. hee hee'
            );
            await player.say("are you sure you're ok?");
            await npc.say("erm..yes..i'll be fine, just go ahead i'll catch up");
            break;
        case 5:
        case 6:
        case 7:
            player.message("koftik doesn't seem interested in talking");
            break;
        case 8:
            await player.say('thanks for getting me out koftik');
            await npc.say('always a pleasure squire');
            break;
        case -1:
            await idleChat(player, npc);
            break;
        default:
    }
}

async function koftikCave3(player, npc) {
    switch (stageOf(player)) {
        case 3:
        case 4:
            await player.say('hello koftik');

            if (stageOf(player) === 4) {
                await npc.say(
                    'are you ok?, i heard a rumble further down the cavern',
                    'i thought the whole place was going to cave in'
                );
                await player.say('im fine');
                await npc.say('i assumed you were dead, or worse');
                await player.say("i've managed to survive so far");
                await npc.say(
                    "the passsage ahead's blocked ,but you should be able to get through",
                    "i'll follow behind",
                    'aaaaaarrgghhh'
                );
                await player.say("what's wrong?");
                await npc.say("it's the voices, can't you hear them", 'they wont leave me be', 'i feel him calling to me');
            } else {
                await npc.say("keep back foul beast of the nigh.. ,wait, it's you!");
                await player.say('as far as i know');
                await npc.say('i assumed you were dead, or worse');
                await player.say("i've managed to survive so far");
                await npc.say(
                    "the passsage ahead's blocked ,but you should be able to get through",
                    "i'll follow behind",
                    'aaaaaarrgghhh'
                );
                await player.say("what's wrong?");
                await npc.say("it's the voices, can't you hear them?", 'they wont leave be', 'i feel him calling to me');
            }

            break;
        case 5:
        case 6:
        case 7:
            player.message("koftik doesn't seem interested in talking");
            break;
        case 8:
            await player.say('thanks for getting me out koftik');
            await npc.say('always a pleasure squire');
            break;
        case -1:
            await idleChat(player, npc);
            break;
        default:
    }
}

async function koftikRecovered(player, npc) {
    if (stageOf(player) !== 8) {
        return;
    }

    await npc.say("traveller, where am i?, i can't remeber a thing");
    await player.say('we were losing you to ibans influence');
    await npc.say('what?..of corse, the voices', "but they've stopped, what happened?");
    await player.say('ibans dead, i destroyed him');
    await npc.say(
        "you've done well, now we must inform the king",
        "he'll have to send in some high mages to...",
        'reserrect the well of voyage',
        "follow me, i'll lead you out"
    );
    await player.say("at last!, i've had enough of caves");
    await mes(player, 'koftik leads you back up through the winding caverns');
    player.teleport(714, 581);
    player.message('and back to the cave entrance');
}

const TALK = {
    [NPC.KOFTIK_ARDOUGNE]: koftikArdougne,
    [NPC.KOFTIK_CAVE1]: koftikCave1,
    [NPC.KOFTIK_CAVE2]: koftikCave2,
    [NPC.KOFTIK_CAVE3]: koftikCave3,
    [NPC.KOFTIK_RECOVERED]: koftikRecovered
};

async function onTalkToNPC(player, npc) {
    if (npc.id === NPC.KOFTIK_CAVE4) {
        player.message('The Koftik does not appear interested in talking');
        return true;
    }

    const handler = TALK[npc.id];

    if (!handler) {
        return false;
    }

    player.engage(npc);

    try {
        await handler(player, npc);
    } finally {
        if (player.interlocutor) {
            player.disengage();
        }
    }

    return true;
}

// the cave entrance (725) and the crumbled rock (728) back out
async function onGameObjectCommandOne(player, gameObject) {
    if (gameObject.id === OBJECT.UNDERGROUND_CAVE) {
        switch (stageOf(player)) {
            case 0:
                if (player.questStages.biohazard !== -1) {
                    player.message('You must first complete the biohazard quest...');
                    player.message('...before you can enter');
                } else {
                    player.message('you must talk to king lathas before you can enter');
                }

                break;
            case 1: {
                const koftik = nearNpc(player, NPC.KOFTIK_ARDOUGNE, 10);

                if (koftik) {
                    player.engage(koftik);

                    try {
                        await koftikEnterCaveDialogue(player, koftik);
                    } finally {
                        if (player.interlocutor) {
                            player.disengage();
                        }
                    }
                }

                break;
            }
            default:
                await mes(player, 'you cautiously enter the cave');
                player.teleport(673, 3420);
        }

        return true;
    }

    if (gameObject.id === OBJECT.CRUMBLED_ROCK) {
        await mes(player, 'you climb the rock pile');
        player.teleport(713, 581);

        return true;
    }

    return false;
}

module.exports = { onTalkToNPC, onGameObjectCommandOne, koftikEnterCaveDialogue };
