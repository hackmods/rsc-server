// Ported from Open-RSC Core-Framework authentic/quests/members/undergroundpass/npcs/UndergroundPassDwarfs.java (AGPL-3.0): the
// three dwarves of the miners' camp (755-764,657-667): Kamen (657) with his home brew, Niloof (642), who sends the player to the
// witch (stage 5 -> 6) and hands the doll back, and Klank (648), the blacksmith with the gauntlets. Stage map: shared.js.

const { ITEM, NPC, stageOf, setStage, cacheHas, give, take, holds, hurt } = require('./shared');

async function kamen(player, npc) {
    if (![5, 6, 7, 8, -1].includes(stageOf(player))) {
        return;
    }

    player.message('the dwarf is leaning on a barrel of home made brew');
    await player.world.sleepTicks(3);
    player.message('he looks a little drunk');
    await player.say('hi there, you ok?');
    await npc.say('ooooh, my head ...im gone');
    await player.say("what's wrong?");
    await npc.say(
        'to much of this home brew my friend',
        'we make from plant roots',
        'but it blows your head off',
        "you don't wanna put it near any naked flames",
        'want some?'
    );

    const menu = await player.ask(['ok then', 'no thanks'], true);

    if (menu === 0) {
        await npc.say('here you go');
        player.message('you take a sip of brew from kamens glass');
        hurt(player, 5);
        await player.say('aaarrgghh');
        player.message('it tastse horrific and burns your throat');
        await npc.say('ha ha', 'i warned you that it\'s strong stuff');
    } else if (menu === 1) {
        await npc.say('your losh');
    }
}

async function niloof(player, npc) {
    switch (stageOf(player)) {
        case 5:
            await npc.say("back away..back away..wait..", "..you're human!");
            await player.say("that's right, i'm on a quest for king lathas", 'we need to find a way through these caverns');
            await npc.say(
                'ha ha, listen up, we came here as miners decades ago',
                'completely unaware of the evil that lurked in the caverns',
                "there's no way through, not while iban still rules",
                'he controls the gateway,the only way to the other side'
            );
            await player.say('what gateway?');
            await npc.say(
                "it once stood as the the 'well of voyage'",
                'a gateway to west runescape',
                'now ibans moulded it into a pit of the damned',
                'a portal to zamoraks darkest realms',
                'he sends his followers there, never to return',
                'only once iban is destroyed can the well be restored'
            );
            await player.say('but how?');
            await npc.say(
                'if i knew, i would have slain him already',
                'seek out the witch, his guide , his only confidante',
                'only she knows how to rid us of iban',
                'she lives on the platforms above, we dare not go there',
                'here, take some food to aid your journey'
            );
            player.message('Niloof give you some food');
            give(player, ITEM.MEAT_PIE, 2);
            give(player, ITEM.CHOCOLATE_BOMB, 1);
            give(player, ITEM.MEAT_PIZZA, 1);
            await player.say('thanks niloof, take care');
            await npc.say('you too');
            setStage(player, 6);
            break;
        case 6:
            if (cacheHas(player, 'doll_of_iban')) {
                await player.say("niloof, i found the witch's house");
                await npc.say('and...?');

                const hasDoll = holds(player, ITEM.A_DOLL_OF_IBAN);
                const hasJournal = holds(player, ITEM.OLD_JOURNAL);

                if (hasDoll && !hasJournal) {
                    await npc.say('i found this old book', "i'm not sure if it's of any use to you traveller");
                    give(player, ITEM.OLD_JOURNAL);
                    return;
                } else if (!hasDoll) {
                    await player.say('i found a strange doll and a book', "but i've lost the doll");
                    await npc.say("well it's a good job i found it");
                    give(player, ITEM.A_DOLL_OF_IBAN);
                    await npc.say(
                        'the witches rag doll, this here be black magic traveller',
                        'mixed with the right ingredients the doll can inflict serious harm',
                        'these four elements of being are guarded somewhere in this cave',
                        'his shadow, his flesh, his conscience and his blood',
                        'if you can retrieve these,combined with the doll...',
                        'you will be able destroy iban...',
                        "and ressurect the 'well of voyage'"
                    );

                    if (!holds(player, ITEM.OLD_JOURNAL)) {
                        await npc.say('i found this old book', "i'm not sure if it's of any use to you traveller");
                        give(player, ITEM.OLD_JOURNAL);
                    }

                    return;
                }

                await player.say('i found a strange book and this..');
                player.message('you show niloof the strange doll');
                await npc.say('the witches rag doll, this here be black magic traveller');
                await npc.say('iban was magically conjured in that very item');
                await npc.say('his four elements of bieng are guarded somewhere in this cave');
                await npc.say('his shadow, his flesh, his conscience and his blood');
                await npc.say('if you can retrieve these, with the flask...');
                await npc.say('you will be able destroy iban...');
                await npc.say("and ressurect the 'well of voyage'");
            } else {
                await player.say('hello niloof');
                await npc.say('so you still live, not many survive down here');
                await player.say('as i can see');
                await npc.say(
                    "don't stay too long traveller",
                    'ibans calls will soon penetrate your delicate human mind',
                    "and you'll also become one of his minions",
                    'you must go above and find the witch kardia',
                    'she holds the secret to ibans destruction'
                );
            }

            break;
        case 7:
            await player.say('hi niloof');
            await npc.say('traveller, thank the stars you\'re still around', 'i thought your time had come');
            await player.say("i've still a few years in me yet");

            if (!holds(player, ITEM.A_DOLL_OF_IBAN)) {
                await npc.say("i found something i think you need traveller");
                await player.say('the doll?');
                await npc.say('i found it while slaying some of the souless, here');
                player.message('niloof gives you the doll of iban');
                give(player, ITEM.A_DOLL_OF_IBAN);
            }

            await player.say("it's about time i delt with iban");
            await npc.say("good luck to you, you'll need it", 'may the strength of the elders be with you');
            await player.say('take care niloof');
            break;
        case 8:
        case -1:
            player.message('the dwarf seems to be busy');
            break;
        default:
    }
}

async function klank(player, npc) {
    switch (stageOf(player)) {
        case 5:
        case 6:
            if (cacheHas(player, 'doll_of_iban')) {
                await player.say('hi klank');
                await npc.say('traveller,I hear you plan to destroy iban');
                await player.say("that's right");
                await npc.say(
                    'i have a gift for you, they may help',
                    'i crafted these long ago to protect myself...',
                    'from the teeth of the souless, their bite is vicous',
                    "i haven't seen a another pair which can with stand their jaws"
                );
                player.message('klank gives you a pair of gaunlets');
                give(player, ITEM.KLANKS_GAUNTLETS);
                player.message('and a tinderbox');
                give(player, ITEM.TINDERBOX);
                await player.say('thanks klank');
                await npc.say('good luck traveller, give iban a slap for me');
            } else {
                await player.say('hello my good man');
                await npc.say(
                    'Good day to you outsider',
                    "i'm klank, i'm the only blacksmith still alive down here",
                    "infact we're the only ones that haven't yet turned",
                    "if you're not carefull you'll become one of them too"
                );
                await player.say('who?.. ibans followers');
                await npc.say("they're not followers, they're slaves, they're the souless");

                const menu = await player.ask(['what happened to them?', 'no wonder their breath was soo bad']);

                if (menu === 0) {
                    await player.say('what happened to them?');
                    await npc.say(
                        'they were normal once, adventurers, treasure hunters',
                        "but men are weak, they couldn't ignore the vocies",
                        'now they all seem to think with one conscience..',
                        "as if they're being controlled by one being"
                    );
                    await player.say('iban?');
                    await npc.say(
                        'maybe?... maybe zamorak himself',
                        'those who try and fight it...',
                        'iban locks in cages, until their minds are too weak to resist',
                        'eventually they all fall to his control',
                        "here take this, i don't need it"
                    );
                    player.message('klank gives you a tinderbox');
                    give(player, ITEM.TINDERBOX);
                } else if (menu === 1) {
                    await player.say("no wonder they're breath was soo bad");
                    await npc.say('you think this is funny.. eh');
                    await player.say('not really, just trying to lighten up the conversation');
                    await npc.say("here take this, i don't need it");
                    player.message('klank gives you a tinderbox');
                    give(player, ITEM.TINDERBOX);
                }
            }

            break;
        case 7:
        case 8:
        case -1: {
            await player.say('hello klank');
            await npc.say('hello again adventurer, so you\'re still around');
            await player.say('still here!');

            const menu = await player.ask(['have you anymore gauntlets?', 'take care klank'], true);

            if (menu === 0) {
                await npc.say("well..yes, but they're not cheap to make", "i'll have to sell you a pair");
                await player.say('how much?');
                await npc.say('5000 coins');

                const menu2 = await player.ask(['5000, you must be joking', "ok then, i'll take a pair"], true);

                if (menu2 === 0) {
                    await npc.say("we don't joke down here, friend");
                } else if (menu2 === 1) {
                    if (holds(player, ITEM.COINS, 5000)) {
                        player.message('you give klank 5000 coins...');
                        take(player, ITEM.COINS, 5000);
                        player.message('...and klank gives you a pair of guanletts');
                        give(player, ITEM.KLANKS_GAUNTLETS);
                        await npc.say('there you go..i hope they help');
                        await player.say("i'll see you around klank");
                    } else {
                        await player.say("oh dear, i haven't enough money");
                        await npc.say("sorry, i can't sell them any cheaper than that");
                    }
                }
            } else if (menu === 1) {
                await npc.say('you too adventurer');
            }

            break;
        }
        default:
    }
}

const TALK = {
    [NPC.KAMEN]: kamen,
    [NPC.NILOOF]: niloof,
    [NPC.KLANK]: klank
};

async function onTalkToNPC(player, npc) {
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

module.exports = { onTalkToNPC };
