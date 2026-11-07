// Ported from Open-RSC Core-Framework authentic/quests/members/Observatory.java (AGPL-3.0), plus the lens crafting of
// authentic/skills/crafting/Crafting.java (molten glass in the lens mould). https://classic.runescape.wiki/w/Observatory_Quest
//
// questStages.observatoryQuest (the Java stages; done at -1):
//   0  the Observatory Professor (652) at the reception (715,682), north-east of Yanille: "Sounds interesting, what can I do
//      for you ?" -> 1 (three planks 410)
//   1  three planks to him -> 2 (a bronze bar 169)  -> 3 (molten glass 623) -> 4 (the lens mould 1017)
//   4  the lens mould: sacks 927 at (692,3515) inside the goblin keep of the cavern below (ladder 928 at (712,679) down to
//      (712,3512)). The keep gate 926 at (689,3513) is opened with the keep key 1012: chest 930 at (717,3542) (open it, search
//      the opened one 919). Chests 929 hold a dungeon spider (656), chests 937 nothing, chest 935 at (705,3520) a poison cure.
//      Giving him the mould -> 5
//   5  molten glass used on the lens mould (Crafting) makes a lens 1018; give it to the Professor -> 6 ("Meet me at the
//      Observatory later...")
//   6  the telescope 925 at (713,699) in the dome (south of the reception; the ladder 933 at (713,695) leads down to the cavern
//      and its ladder at (713,3527)) with the Professor (662) near: a random constellation and its reward -> -1
// Reward: 2 quest points, crafting 1000 + 400 x level quarter points, the constellation's gift (an optional skill is
// 500 + 100 x level) and an uncut sapphire. The Spirit of Scorpius (npcs/ardougne/spirit-of-scorpius.js) speaks to those who
// finished the quest.
// Differences: the Java keeps the chosen constellation in a field shared by every player; it is kept per player here. The
// opened chests (the Java leaves them open until searched) close again after a minute so the next visitor finds them shut.

// the star maps of the telescope's box (ActionSender.sendBox of Observatory.constellation): the length of the text and the
// positions of the asterisks in it, the rest is spaces. 0: the scorpion shown after the quest, 1: a blank sky, 2-13: the
// twelve constellations (Virgo to Cancer)
const STAR_MAPS = [
    { length: 1558, stars: [305, 433, 536, 654, 675, 921, 1011, 1236, 1251, 1352, 1373, 1473, 1482] },
    { length: 1430, stars: [] },
    { length: 1430, stars: [292, 388, 514, 550, 662, 681, 751, 761, 907, 913, 996, 1023, 1140, 1241, 1371] },
    { length: 1551, stars: [304, 397, 521, 535, 796, 1276, 1498] },
    { length: 1551, stars: [289, 419, 524, 766, 791, 919, 1136, 1263, 1378, 1513] },
    { length: 1913, stars: [286, 403, 645, 882, 1118, 1354, 1365, 1385, 1521, 1535, 1651, 1783, 1877, 1886] },
    { length: 1792, stars: [279, 519, 786, 903, 1030, 1169, 1281, 1293, 1521, 1755] },
    { length: 1306, stars: [294, 413, 552, 649, 686, 781, 997, 1110, 1235] },
    { length: 1558, stars: [305, 433, 536, 654, 675, 921, 1011, 1236, 1251, 1352, 1373, 1473, 1482] },
    { length: 1188, stars: [541, 675, 801, 894, 1007, 1159] },
    { length: 1545, stars: [296, 299, 437, 553, 663, 919, 1022, 1167, 1400, 1482] },
    { length: 1432, stars: [307, 417, 522, 553, 664, 755, 892, 906, 1130, 1270, 1398] },
    { length: 1316, stars: [319, 435, 525, 640, 657, 916, 1014, 1260, 1268] },
    { length: 1671, stars: [299, 783, 1023, 1379, 1637] }
];

const OBSERVATORY_PROFESSOR_ID = 652;
const OBSERVATORY_ASSISTANT_ID = 654;
const PROFESSOR_ID = 662;
const GOBLIN_GUARD_ID = 651;
const DUNGEON_SPIDER_ID = 656;

const TALK_IDS = new Set([OBSERVATORY_ASSISTANT_ID, OBSERVATORY_PROFESSOR_ID, PROFESSOR_ID, GOBLIN_GUARD_ID]);

const WINE_ID = 142;
const PLANK_ID = 410;
const BRONZE_BAR_ID = 169;
const MOLTEN_GLASS_ID = 623;
const LENS_MOULD_ID = 1017;
const LENS_ID = 1018;
const KEEP_KEY_ID = 1012;
const CURE_POISON_1_ID = 568;
const LAW_RUNE_ID = 42;
const BLACK_2H_SWORD_ID = 426;
const TUNA_ID = 367;
const SUPER_STRENGTH_3_ID = 492;
const WATER_RUNE_ID = 32;
const WEAPON_POISON_ID = 572;
const MAPLE_LONGBOW_ID = 652;
const EMERALD_AMULET_OF_PROTECTION_ID = 315;
const UNCUT_SAPPHIRE_ID = 160;

const LADDER_ID = 928;
const TELESCOPE_ID = 925;
const GATE_ID = 926;
const SACKS_ID = 927;
// chest pairs [closed, opened]: the opened chest is searched
const EMPTY_CHEST = [937, 936];
const SPIDER_CHEST = [929, 917];
const KEY_CHEST = [930, 919];
const CURE_CHEST = [935, 934];
const CHEST_IDS = new Set([...EMPTY_CHEST, ...SPIDER_CHEST, ...KEY_CHEST, ...CURE_CHEST]);

// the gate in the cavern: (689, 3513); the keep is north of it
const GATE_X = 689;
const GATE_Y = 3513;

// addnpc(..., 120000) and the 60 s an opened chest stays open, in 640 ms ticks
const SPIDER_TICKS = Math.ceil(120000 / 640);
const CHEST_OPEN_TICKS = Math.ceil(60000 / 640);

// the constellation each player saw last (the Java field selectedNumber)
const seen = new WeakMap();

function stageOf(player) {
    return player.questStages.observatoryQuest || 0;
}

function setStage(player, stage) {
    player.questStages.observatoryQuest = stage;
}

// Java ifnearvisnpc(player, id, radius)
function nearNpc(player, id, radius) {
    return player.getNearbyEntitiesWithinRadius('npcs', id, radius).find((npc) => !npc.interlocutor) || null;
}

// Java mes(...) followed by delay(3)
async function mes(player, message) {
    player.message(`@que@${message}`);
    await player.world.sleepTicks(3);
}

// the box with a star map: spaces with the stars as asterisks
function sendStarMap(player, index) {
    const { length, stars } = STAR_MAPS[index];
    const chars = new Array(length).fill(' ');

    for (const position of stars) {
        chars[position] = '*';
    }

    player.send({ type: 'serverMessage', message: chars.join('') });
}

// Observatory.constellation: what the telescope shows at each stage
function constellation(player, stage) {
    seen.set(player, 0);

    // quest completed: always the scorpion
    if (stage === -1) {
        sendStarMap(player, 0);
        return;
    }

    // no image on the telescope yet
    if (stage < 6) {
        sendStarMap(player, 1);
        return;
    }

    const random = Math.floor(Math.random() * 12);

    sendStarMap(player, 2 + random);
    seen.set(player, random);
}

// Observatory.giveOptionalReward: 500 + 100 x level in the chosen skill
function giveOptionalReward(player, skill) {
    player.addExperience(skill, 500 + 100 * player.skills[skill].base, false);
}

async function constellationNameAndReward(player, npc) {
    const selected = seen.get(player) || 0;

    if (selected === 0) {
        await npc.say('Virgo the virtuous', 'The strong and peaceful nature of virgo boosts your defence');
        giveOptionalReward(player, 'defense');
    } else if (selected === 1) {
        await npc.say('Libra the scales', 'The scales of justice award you with Law Runes');
        player.inventory.add(LAW_RUNE_ID, 3);
    } else if (selected === 2) {
        await npc.say('Gemini the twins', 'The double nature of Gemini awards you a two-handed weapon');
        player.inventory.add(BLACK_2H_SWORD_ID, 1);
    } else if (selected === 3) {
        await npc.say('Pisces the fish', 'The gods rain food from the sea on you');
        player.inventory.add(TUNA_ID, 3);
    } else if (selected === 4) {
        await npc.say('Taurus the bull', 'You are given the strength of a bull');
        player.inventory.add(SUPER_STRENGTH_3_ID, 1);
    } else if (selected === 5) {
        await npc.say('Aquarius the water-bearer', 'the Gods of water award you with water runes');
        player.inventory.add(WATER_RUNE_ID, 25);
    } else if (selected === 6) {
        await npc.say('Scorpio the scorpion', "The scorpion gives you poison from it's sting");
        player.inventory.add(WEAPON_POISON_ID, 1);
    } else if (selected === 7) {
        await npc.say('Aries the ram', "The ram's strength improves your attack abilites");
        giveOptionalReward(player, 'attack');
    } else if (selected === 8) {
        await npc.say('Sagittarius the Centaur', 'The Gods award you a maple longbow');
        player.inventory.add(MAPLE_LONGBOW_ID, 1);
    } else if (selected === 9) {
        await npc.say('Leo the lion', 'The power of the lion has increased your hitpoints');
        giveOptionalReward(player, 'hits');
    } else if (selected === 10) {
        await npc.say('Capricorn the goat', 'you are granted an increase in strength');
        giveOptionalReward(player, 'strength');
    } else if (selected === 11) {
        await npc.say('Cancer the crab', 'The armoured crab gives you an amulet of protection');
        player.inventory.add(EMERALD_AMULET_OF_PROTECTION_ID, 1);
    }

    // all constellations give an uncut sapphire
    player.inventory.add(UNCUT_SAPPHIRE_ID, 1);
}

// Observatory.handleReward: 2 quest points and crafting 1000 + 400 x level quarter points
function completeQuest(player) {
    delete player.cache.keep_key_gate;

    player.completeQuest('observatoryQuest', {
        questPoints: 2,
        experience: { crafting: 1000 + 400 * player.skills.crafting.base }
    });
}

// ---- talk ------------------------------------------------------------------------------------------------------------------

async function professorOfTheDome(player, n) {
    const stage = stageOf(player);

    if (stage === 0) {
        await n.say(
            'Hello friend',
            'This is my poorly telescope',
            "It's been tampered with and is not working",
            'If your good at crafting',
            'I would appreciate your help!',
            'Come to the reception if you can'
        );
    } else if (stage >= 1 && stage <= 5) {
        await n.say(
            'Hello friend',
            'I hope you get all the parts soon',
            'Return to the reception',
            'When you have the things I need'
        );
    } else if (stage === 6) {
        await n.say('Hello friend', "It's time to use the telescope");
    } else if (stage === -1) {
        await n.say('Hello friend', 'The stars hold many secrets', 'The moon rises in Scorpio...');
    }
}

// "How can I help you ?" with one problem to ask about, the same shape at stages 1, 2, 3 and 5
async function assistantHelp(player, n, first, helpLines) {
    await n.say('How can I help you ?');

    const menu = await player.ask([first, 'I dont need any help thanks'], true);

    if (menu === 0) {
        await n.say(...helpLines);
    } else if (menu === 1) {
        await n.say('Oh, okay then if you are sure');
        player.message('The assistant continues with his work');
    }
}

async function assistant(player, n) {
    const stage = stageOf(player);

    if (stage === 0) {
        await n.say('Hello wanderer', 'Do you require any assistance ?');

        const first = await player.ask(
            ['Yes, what do you two do here ?', 'No, just looking around thanks', 'Can I have a look through that telescope ?'],
            true
        );

        if (first === 0) {
            await n.say(
                'This is the observatory reception',
                'Up on the cliff is the observatory dome',
                'From here we view the heavens',
                'That is before the telescope was damaged',
                'By those monsters outside...'
            );
        } else if (first === 1) {
            await n.say('Okay, be my guest', 'If you need any help let me know...');
        } else if (first === 2) {
            await n.say("I'm sorry but it's broken!", 'The Professor will explain if you speak to him');
        }
    } else if (stage === 1) {
        await assistantHelp(player, n, "I can't find any planks!", [
            'I understand planks can be found at the barbarian outpost',
            'To the north east of ardougne',
            'You will probably have to trek over there to find some...'
        ]);
    } else if (stage === 2) {
        await assistantHelp(player, n, "I can't see any bronze around", [
            "You'll need to mix purified copper and tin together",
            'To produce this metal'
        ]);
    } else if (stage === 3) {
        await assistantHelp(player, n, "I'm having problems getting glass", [
            "Don't you know how to make glass ?",
            'Unfortunately we dont have those skills',
            'I remember reading about that somewhere...'
        ]);
    } else if (stage === 4) {
        await n.say(' How can I help you ?');

        const mould = await player.ask(['I cant find the lens mould', "I don't need any help thanks"], true);

        if (mould === 0) {
            await n.say(
                "Can't you find the mould ?",
                "I'm sure I heard one of those goblins talking about it...",
                'I bet they have hidden it somewhere'
            );
        } else if (mould === 1) {
            await n.say('Oh, okay then if you are sure');
            player.message('The assistant continues with his work');
        }
    } else if (stage === 5) {
        await assistantHelp(player, n, "I can't make the lens!", [
            'Crafting objects like this requires skill',
            'You may need to practice more first...'
        ]);
    } else if (stage === 6) {
        await n.say('Well hello again', 'thanks for helping out the professor', "You've made my life much easier!", 'Have a drink on me!');
        player.message('The assistant gives you some wine');
        await player.say('Thanks very much');
        player.inventory.add(WINE_ID, 1);
    } else if (stage === -1) {
        if (!player.cache.observatory_assistant_drink) {
            await n.say(
                'Well hello again',
                'thanks for helping out the professor',
                "You've made my life much easier!",
                'Have a drink on me!'
            );
            player.message('The assistant gives you some wine');
            player.inventory.add(WINE_ID, 1);
            await player.say('Thanks very much');
            player.cache.observatory_assistant_drink = true;
            return;
        }

        await n.say('Thanks again');
    }
}

async function professor(player, n) {
    const stage = stageOf(player);

    if (stage === 0) {
        await n.say('Hello adventurer', 'What brings you to these parts ?');

        const first = await player.ask(
            [
                'I am lost!!!',
                "I'd like to have a look through that telescope",
                'Whats the ladder over there for ?',
                'It is of no concern of yours...'
            ],
            false
        );

        if (first === 0) {
            await player.say('I am lost!!!');
            await n.say(
                'Lost ? it must have been those gnomes that have lead you astray',
                'Head North-East to find the land Ardougne'
            );
            await player.say("I'm sure I'll find the way", 'Thanks for your help');
            await n.say('No problem at all, come and visit again');
        } else if (first === 1) {
            await player.say("I'd like to have a look through that telescope");
            await n.say('So would I !!', 'The trouble is, its not working');
            await player.say('What do you mean ?');
            await n.say('Did you see those houses outside ?');
            await player.say("Yes, I've seen them");
            await n.say(
                "Well it's a family of goblins",
                'Since they moved here they cause me nothing but trouble',
                'Last week my telescope was tampered with',
                'And now parts need replacing before it can be used again',
                "Err, I don't suppose you would be willing to help?"
            );

            const second = await player.ask(
                ['Sounds interesting, what can I do for you ?', "Oh sorry, I don't have time for that"],
                true
            );

            if (second === 0) {
                await n.say(
                    'Oh thanks so much!',
                    'I need three new parts for the telescope so it can be used again',
                    'I need wood to make a new tripod',
                    'Bronze to make a new tube',
                    'And glass for a replacement lens',
                    'My assistant will help you obtaining these',
                    'Ask him if you need any help'
                );
                await player.say('Okay what do I need to do ?');
                await n.say('First I need three planks of wood for the tripod');
                setStage(player, 1);
            } else if (second === 1) {
                await n.say('Oh dear, I really do need some help', 'If you see anyone who can help please send them my way');
                player.message('The Professor carries on with his duties');
            }
        } else if (first === 2) {
            await player.say("What's the ladder there for ?");
            await n.say('The ladder leads to the entrance of the cavern', 'That leads from here to the observatory');
        } else if (first === 3) {
            await player.say('It is of no concern of yours...');
            await n.say("Okay Okay, there's no need to be insulting!");
            player.message('The professor carries on with his studies');
        }
    } else if (stage === 1) {
        await n.say("I'ts my helping hand back again!", 'Do you have the planks yet ?');

        const planks = await player.ask(["Yes I've got them", 'No, sorry not yet'], true);

        if (planks === 0) {
            if (player.inventory.count(PLANK_ID) >= 3) {
                await n.say('Well done, I can start the tripod construction now', 'Now for the bronze');
                player.inventory.remove(PLANK_ID, 3);
                setStage(player, 2);
            } else {
                await n.say("You don't seem to have enough planks!", 'I need three in total');
            }
        } else if (planks === 1) {
            await n.say('Oh dear, well please bring them soon');
        }
    } else if (stage === 2) {
        await n.say(' Hello again, do you have the bronze yet ?');

        const bronze = await player.ask(['Yes I have it', "I'm still looking"], true);

        if (bronze === 0) {
            if (player.inventory.has(BRONZE_BAR_ID)) {
                await n.say('Great, now all I need is the lens made', 'Next on the list is molten glass');
                player.inventory.remove(BRONZE_BAR_ID, 1);
                setStage(player, 3);
            } else {
                await n.say("That's not bronze!", 'Please bring me some');
            }
        } else if (bronze === 1) {
            await n.say('Please carry on trying to find some');
        }
    } else if (stage === 3) {
        await n.say('How are you getting on finding me some glass ?');

        const molten = await player.ask(['Here it is!', "No luck yet I'm afraid"], true);

        if (molten === 0) {
            if (player.inventory.has(MOLTEN_GLASS_ID)) {
                await n.say(
                    'Excellent! now all I need is to make the lens',
                    "Oh no, I can't use this glass!",
                    'Until I find the lens mould used to cast it'
                );
                await player.say('What do you mean, lens mould');
                await n.say(
                    'I need my lens mould',
                    "Without it I'll never get the correct shape",
                    "I'll have to ask you to try and find it"
                );
                setStage(player, 4);
            } else {
                await n.say("Sorry, you don't have any glass with you", "Please don't tease me, I really need this part!");
            }
        } else if (molten === 1) {
            await n.say('I hope you find some soon');
        }
    } else if (stage === 4) {
        await n.say('Did you bring me the mould ?');

        const mould = await player.ask(["Yes, I've managed to find it", "I haven't found it yet", 'I had it then lost it'], true);

        if (mould === 0) {
            if (player.inventory.has(LENS_MOULD_ID)) {
                await n.say("At last you've brought all the items I need", 'To repair the telescope', "Oh no! I can't do this");
                await player.say('What do you mean ?');
                await n.say('My crafting skill is not good enough', 'To finish this off', 'Are you skilled at crafting ?');

                const craft = await player.ask(['Yes I have much experience in crafting', "No sorry I'm not good at that"], true);

                if (craft === 0) {
                    await n.say(
                        'Thank goodness for that!',
                        'You can use the mould with molten glass',
                        'To make a new lens',
                        'As long as you have practised your crafting skills'
                    );
                    setStage(player, 5);
                } else if (craft === 1) {
                    await n.say(
                        'Oh dear, without the lens its useless',
                        "Maybe you'll find someone who can Finish the job for you ?"
                    );
                    setStage(player, 5);
                }
            } else {
                await n.say('Where is the mould! You dont even have it on you', 'Please try and find it');
            }
        } else if (mould === 1) {
            await n.say('Perhaps the goblins have stolen it ?');
        } else if (mould === 2) {
            await n.say(
                "Well, I wouldn't worry",
                'No doubt the goblins copied the design',
                "I'm sure if you checked again",
                "You'll find another one"
            );
        }
    } else if (stage === 5) {
        await n.say('Is the lens finished ?');

        const finished = await player.ask(['Yes here it is', "I haven't finished it yet"], true);

        if (finished === 0) {
            if (player.inventory.has(LENS_ID)) {
                player.inventory.remove(LENS_ID, 1);
                await n.say('Wonderful, at last I can fix the telescope');

                if (player.inventory.has(LENS_MOULD_ID)) {
                    await n.say("I'll take back that mould for use again");
                    player.inventory.remove(LENS_MOULD_ID, 1);
                }

                await n.say('Meet me at the Observatory later...');
                setStage(player, 6);
            } else {
                await n.say('Why do you tell lies ?', 'Please come back when the lens is made');
            }
        } else if (finished === 1) {
            await n.say('Oh, okay please hurry');
        }
    } else if (stage === 6) {
        await n.say('The telescope is now repaired', "Let's go to the Observatory");
    } else if (stage === -1) {
        await n.say('Aha, my friend returns', 'Thanks for all your help with the telescope', 'What can I do for you ?');

        const done = await player.ask(['Do you have any more quests', 'Nothing, thanks'], false);

        if (done === 0) {
            await player.say('Do you have any more quests ?');
            await n.say("No I'm all out of quests now", 'But the stars may hold a secret for you...');
        } else if (done === 1) {
            await player.say('Nothing, thanks');
            await n.say('Okay no problem');
        }
    }
}

async function onTalkToNPC(player, npc) {
    if (!TALK_IDS.has(npc.id)) {
        return false;
    }

    player.engage(npc);

    let fight = null;

    try {
        if (npc.id === PROFESSOR_ID) {
            await professorOfTheDome(player, npc);
        } else if (npc.id === OBSERVATORY_ASSISTANT_ID) {
            await assistant(player, npc);
        } else if (npc.id === OBSERVATORY_PROFESSOR_ID) {
            await professor(player, npc);
        } else if (npc.id === GOBLIN_GUARD_ID) {
            await npc.say('What are you doing here ?', 'This is our domain now', 'Begone foul human!');
            fight = npc;
        }
    } finally {
        if (player.interlocutor) {
            player.disengage();
        }
    }

    if (fight) {
        Promise.resolve(fight.attack(player)).catch(() => {});
    }

    return true;
}

// ---- objects -----------------------------------------------------------------------------------------------------------------

// an opened chest closes again after a minute if nobody searches it
function openChest(player, chest, pair) {
    player.world.replaceTimed('gameObjects', chest, pair[1], CHEST_OPEN_TICKS);
}

function closeChest(player, chest, pair) {
    player.world.replaceEntity('gameObjects', chest, pair[0]);
}

async function chestAction(player, chest) {
    const { id } = chest;

    if (id === EMPTY_CHEST[0]) {
        player.message('You open the chest');
        openChest(player, chest, EMPTY_CHEST);
    } else if (id === EMPTY_CHEST[1]) {
        player.message('You search the chest');
        player.message('The chest contains nothing');
        closeChest(player, chest, EMPTY_CHEST);
    } else if (id === SPIDER_CHEST[0]) {
        player.message('You open the chest');
        openChest(player, chest, SPIDER_CHEST);
    } else if (id === SPIDER_CHEST[1]) {
        player.message('You search the chest');
        player.message('The chest contains a poisonous spider!');

        const spider = player.world.spawnTimedNPC({ id: DUNGEON_SPIDER_ID, x: chest.x, y: chest.y, ticks: SPIDER_TICKS });

        closeChest(player, chest, SPIDER_CHEST);
        Promise.resolve(spider.attack(player)).catch(() => {});
    } else if (id === KEY_CHEST[0]) {
        player.message('You open the chest');
        openChest(player, chest, KEY_CHEST);
    } else if (id === KEY_CHEST[1]) {
        player.message('You search the chest');
        player.message('You find a small key inside');

        if (player.inventory.has(KEEP_KEY_ID)) {
            await mes(player, 'You already have a keep key');
            await mes(player, 'Another one will have no use');
        } else {
            player.inventory.add(KEEP_KEY_ID, 1);
        }

        closeChest(player, chest, KEY_CHEST);
    } else if (id === CURE_CHEST[0]) {
        player.message('You open the chest');
        openChest(player, chest, CURE_CHEST);
    } else if (id === CURE_CHEST[1]) {
        player.message('You search the chest');
        player.message('The chest contains some poison cure');
        player.inventory.add(CURE_POISON_1_ID, 1);
        closeChest(player, chest, CURE_CHEST);
    }
}

async function ladder(player) {
    const stage = stageOf(player);

    if (stage === 0) {
        player.teleport(712, 3512);
        player.message('You climb down the ladder');
        return;
    }

    if (stage === 6 || stage === -1) {
        player.teleport(712, 3512);
        return;
    }

    // stages 1-5: the assistant warns first
    const assistantNpc = nearNpc(player, OBSERVATORY_ASSISTANT_ID, 6);

    if (assistantNpc !== null) {
        await assistantNpc.say('Take great care down there', 'Remember the goblins have taken over the cavern');
        await player.say('Oh, okay thanks for the warning');
        player.teleport(712, 3512);
    }
}

async function gate(player) {
    if (player.cache.keep_key_gate || stageOf(player) === -1) {
        if (player.y <= GATE_Y) {
            player.teleport(690, 3514);
            await player.say("I'd better be quick", 'There may be more guards about');
        } else {
            player.message('you go through the gate');
            player.teleport(690, 3513);
        }
    } else {
        player.message('The gate is locked');
    }
}

async function sacks(player) {
    if (!player.inventory.has(LENS_MOULD_ID)) {
        player.message('Underneath you find a peculiar mould');
        player.inventory.add(LENS_MOULD_ID, 1);
    } else {
        player.message('You already have this lens mould');
        player.message('Another one will be of no use');
    }
}

async function telescope(player) {
    const stage = stageOf(player);

    if (stage === -1) {
        const professorNpc = nearNpc(player, PROFESSOR_ID, 10);

        if (professorNpc !== null) {
            player.message('You look through the telescope');
            constellation(player, stage);

            const menu = await player.ask(
                ['I can see a constellation through the telescope', "I see something, but I don't know what it is"],
                true
            );

            if (menu === 0) {
                await professorNpc.say('Yes, I feel the stars have a message for you...');
            } else if (menu === 1) {
                await professorNpc.say('With time you may come to learn', 'The secrets of the stars');
            }
        }
    } else if (stage === 6) {
        const professorNpc = nearNpc(player, PROFESSOR_ID, 10);

        if (professorNpc !== null) {
            await professorNpc.say('Well done, well done!!', "Let's see what the stars have in store for us today");
            player.message('You look through the telescope');
            constellation(player, stage);

            const menu = await player.ask(['I can see a constellation', 'What am I looking at ?'], true);

            if (menu === 0) {
                await professorNpc.say('Yes, with this device', 'The heavens are opened to us...', 'The constellation you saw was');
            } else if (menu === 1) {
                await professorNpc.say('This is the revealed sky', 'The constellation you saw was');
            }

            await constellationNameAndReward(player, professorNpc);
            completeQuest(player);
            await professorNpc.say("By Saradomin's earlobes!", 'You must be a friend of the gods indeed');
            player.message('Well done, you have completed the Observatory quest');
            await professorNpc.say('Look in your backpack for your reward', 'In payment for your work');
            player.message('After repairing the telescope you feel more knowledgable in the skill of crafting');
            await professorNpc.say('Now I have work to do...');
            player.message('The professor goes about his business');
        }
    } else {
        player.message('It seems that the telescope is not operational');
        constellation(player, stage);
    }
}

function isKeepGate(gameObject) {
    return gameObject.id === GATE_ID && gameObject.x === GATE_X && gameObject.y === GATE_Y;
}

function handlesObject(gameObject) {
    return (
        gameObject.id === LADDER_ID ||
        gameObject.id === TELESCOPE_ID ||
        gameObject.id === SACKS_ID ||
        CHEST_IDS.has(gameObject.id) ||
        isKeepGate(gameObject)
    );
}

async function objectAction(player, gameObject) {
    if (gameObject.id === LADDER_ID) {
        await ladder(player);
    } else if (gameObject.id === TELESCOPE_ID) {
        await telescope(player);
    } else if (gameObject.id === SACKS_ID) {
        await sacks(player);
    } else if (isKeepGate(gameObject)) {
        await gate(player);
    } else {
        await chestAction(player, gameObject);
    }
}

async function onGameObjectCommandOne(player, gameObject) {
    if (!handlesObject(gameObject)) {
        return false;
    }

    await objectAction(player, gameObject);

    return true;
}

// the chests' second command is "Close"/"Examine" in the data: Open-RSC treats every click on them alike
async function onGameObjectCommandTwo(player, gameObject) {
    if (!CHEST_IDS.has(gameObject.id)) {
        return false;
    }

    const commands = (gameObject.definition && gameObject.definition.commands) || [];

    if (/examine/i.test(commands[1] || '')) {
        return false;
    }

    await chestAction(player, gameObject);

    return true;
}

// the keep key on the gate
async function onUseWithGameObject(player, gameObject, item) {
    if (!isKeepGate(gameObject) || item.id !== KEEP_KEY_ID) {
        return false;
    }

    player.message('The gate unlocks');
    player.message("The keep key is broken - I'll discard it");
    player.inventory.remove(KEEP_KEY_ID, 1);

    if (!player.cache.keep_key_gate) {
        player.cache.keep_key_gate = true;
    }

    const guard = nearNpc(player, GOBLIN_GUARD_ID, 5);

    if (guard !== null) {
        Promise.resolve(guard.attack(player)).catch(() => {});
    }

    return true;
}

// Crafting.java: molten glass in the lens mould makes a lens (the level 10 refusal is "authentically bugged": it still works)
async function onUseWithInventory(player, item, target) {
    const pair =
        (item.id === MOLTEN_GLASS_ID && target.id === LENS_MOULD_ID) ||
        (item.id === LENS_MOULD_ID && target.id === MOLTEN_GLASS_ID);

    if (!pair) {
        return false;
    }

    const stage = stageOf(player);

    if (stage >= 0 && stage < 5) {
        await player.say('Perhaps I should speak to the professor first');
        return true;
    }

    if (player.skills.crafting.current < 10) {
        player.message('Sorry, you need a crafting level');
        player.message('Of 10 or above to use this object');
    }

    if (player.inventory.has(MOLTEN_GLASS_ID)) {
        player.inventory.remove(MOLTEN_GLASS_ID, 1);
        player.message('You pour the molten glass into the mould');
        player.message('And clasp it together');
        player.message('It produces a small convex glass disc');
        player.inventory.add(LENS_ID, 1);
    }

    return true;
}

module.exports = {
    onTalkToNPC,
    onGameObjectCommandOne,
    onGameObjectCommandTwo,
    onUseWithGameObject,
    onUseWithInventory
};
