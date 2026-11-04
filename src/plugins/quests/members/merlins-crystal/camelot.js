// Ported from Open-RSC Core-Framework authentic/quests/members/MerlinsCrystal.java (AGPL-3.0): King Arthur, Sir Gawain,
// Sir Lancelot, the Catherby beehives and Merlin's giant crystal.
// https://classic.runescape.wiki/w/Merlin%27s_Crystal
//
// questStages.merlinsCrystal (the Java stages):
//   0  King Arthur (275, Camelot) "I want to become a knight of the round table" -> 1
//   1  Sir Gawain (274) "Do you know how Merlin got trapped" names Morgan Le Faye (cache talkedToGawain)
//      Sir Lancelot (273), once Gawain talked: "Any ideas on how to get into Morgan Le Faye's stronghold?" -> 2
//   2  stow away in Arhein's ship (292/293, Catherby, Arhein out of sight) into Keep Le Faye: keep-le-faye.js.
//      Beating Sir Mordred (276) brings Morgan Le Faye (281): "Tell me how to untrap Merlin and I might" -> 3
//   3  the black candle (candle maker 282, wax from the beehive 294 after insect repellant 603), the magic words on the
//      chaos altar (296), bat bones dropped on the pentagram (448,435) with the lit black candle: thrantax.js -> 4.
//      Excalibur from the Lady of the Lake (283) after the beggar test: excalibur.js
//   4  Excalibur on the giant crystal (287, top of Camelot) frees Merlin -> 5
//   5  King Arthur knights you -> -1: 6 quest points, no experience
// King Arthur also starts The Holy Grail (questStages.theHolyGrail) after this quest and finishes it with the grail
// (746): both branches are in this Java file, so they are here. The rest of The Holy Grail is its own quest.

const KING_ARTHUR_ID = 275;
const SIR_GAWAIN_ID = 274;
const SIR_LANCELOT_ID = 273;
const MERLIN_ID = 287;

const GIANT_CRYSTAL_ID = 287;
const BEEHIVE_ID = 294;

const BUCKET_ID = 21;
const INSECT_REPELLANT_ID = 603;
const WAX_BUCKET_ID = 605;
const EXCALIBUR_ID = 606;
const MAGIC_GOLDEN_FEATHER_ID = 745;
const HOLY_GRAIL_ID = 746;

// delayedSpawnObject(obj, 32 seconds), in 640 ms ticks
const CRYSTAL_RESPAWN_TICKS = Math.ceil(32000 / 640);

function stageOf(player) {
    return player.questStages.merlinsCrystal || 0;
}

function setStage(player, stage) {
    player.questStages.merlinsCrystal = stage;
}

// MerlinsCrystal.handleReward: 6 quest points, no experience
function completeQuest(player) {
    delete player.cache.magicWords;

    player.completeQuest('merlinsCrystal', {
        questPoints: 6,
        message: "Well done you have completed the Merlin's crystal quest"
    });
}

// TheHolyGrail.handleReward: 2 quest points, prayer 1000 + 1000 and defense 1200 + 1200 per level (quarter points)
function completeHolyGrail(player) {
    player.completeQuest('theHolyGrail', {
        questPoints: 2,
        experience: {
            prayer: 1000 + 1000 * player.skills.prayer.base,
            defense: 1200 + 1200 * player.skills.defense.base
        },
        message: 'Well done you have completed the holy grail quest'
    });
}

// the Holy Grail half of King Arthur; true when it answered
async function arthurHolyGrail(player, npc) {
    const grail = player.questStages.theHolyGrail || 0;

    switch (grail) {
        case 1:
        case 2:
        case 3:
        case 5:
            await npc.say('How goes thy quest?');

            if (player.inventory.has(HOLY_GRAIL_ID)) {
                await player.say('I have retrieved the grail');
                await npc.say('wow incredible you truly are a splendid knight');
                player.inventory.remove(HOLY_GRAIL_ID);
                completeHolyGrail(player);
            } else {
                await player.say('I am making progress', 'But I have not recovered the grail yet');
                await npc.say('Well the grail is very elusive', 'It may take some perserverance'); // sic

                if (grail === 1) {
                    await npc.say('As I said before speak to Merlin', 'in the workshop by the library');
                }
            }

            return true;
        case 4:
            await player.say('Hello, do you have a knight named Sir Percival?');
            await npc.say(
                'Ah yes I remember, young percival',
                'He rode off on a quest a couple of months ago',
                "We are getting a bit worried, he's not back yet",
                'He was going to try and recover the golden boots of Arkaneeses'
            );
            await player.say('Any idea which way that would be?');
            await npc.say(
                'Not exactly',
                'We discovered, some magic golden feathers',
                'They are said to point the way to the boots',
                'they certainly point somewhere',
                'just blowing gently on them',
                'Will make them show the way to go'
            );

            if (!player.inventory.has(MAGIC_GOLDEN_FEATHER_ID)) {
                player.message('King arthur gives you a feather');
                player.inventory.add(MAGIC_GOLDEN_FEATHER_ID);
            }

            return true;
        case -1:
            await npc.say(
                'Thankyou for retrieving the grail',
                'You shall be long remembered',
                'As one of the greatest heros', // sic
                'Amongst the knights of the round table'
            );
            return true;
    }

    return false;
}

async function kingArthur(player, npc) {
    if (await arthurHolyGrail(player, npc)) {
        return;
    }

    switch (stageOf(player)) {
        case 0:
        case 1:
        case 2:
        case 3:
        case 4: {
            await npc.say('Welcome to the court of King Arthur');
            await npc.say('I am King Arthur');

            const option = await player.ask(
                [
                    'I want to become a knight of the round table',
                    'So what are you doing in Runescape?',
                    'Thankyou very much'
                ],
                false
            );

            if (option === 0) {
                await player.say('I want to become a knight of the round table');
                await npc.say(
                    'Well I think you need to go on a quest to prove yourself worthy',
                    'My knights like a good quest',
                    'Unfortunately our current quest is to rescue Merlin',
                    'Back in England he got himself trapped in some sort of magical Crystal',
                    "We've moved him from the cave we found him in",
                    "He's upstairs in his tower"
                );
                await player.say('I will see what I can do then');
                await npc.say('Talk to my knights if you need any help');

                if (stageOf(player) === 0) {
                    setStage(player, 1);
                }
            } else if (option === 1) {
                await player.say('So what are you doing in Runescape');
                await npc.say("Well legend says we will return to Britain in it's time of greatest need");
                await npc.say("But that's not for quite a while");
                await npc.say("So we've moved the whole outfit here for now");
                await npc.say("We're passing the time in Runescape");
            } else if (option === 2) {
                await player.say('thankyou very much');
            }

            break;
        }
        case 5:
            await player.say('I have freed Merlin from his crystal');
            await npc.say('Ah a good job well done', 'I knight thee', 'You are now a knight of the round table');
            completeQuest(player);
            break;
        case -1: {
            await player.say('Now i am a knight of the round table', 'Do you have anymore quests for me?');
            await npc.say(
                "Aha, I'm glad you are here",
                'I am sending out various knights on an important quest',
                'I was wondering if you too would like to take up this quest?'
            );

            const q = await player.ask(['Tell me of this quest', 'I am weary of questing for the time being'], true);

            if (q === 0) {
                // START OF THE HOLY GRAIL QUEST
                await npc.say(
                    'Well we recently found out',
                    'The holy grail has passed into the runescape world',
                    'This is most fortuitous',
                    'None of my knights ever did return with it last time',
                    'Now we have the opportunity to give it another go',
                    'Maybe this time we will have more luck'
                );

                const startHoly = await player.ask(
                    ["I'd enjoy trying that", 'I may come back and try that later'],
                    true
                );

                if (startHoly === 0) {
                    await npc.say(
                        'Go speak to Merlin',
                        'He may be able to give a better clue as to where it is',
                        'Now you have freed him from the crystal',
                        'He has set up his workshop in the room next to the library'
                    );
                    player.questStages.theHolyGrail = 1;
                } else if (startHoly === 1) {
                    await npc.say('Be sure that you come speak to me soon then');
                }
            } else if (q === 1) {
                await npc.say('Maybe later then');
                await player.say('Maybe so');
            }

            break;
        }
    }
}

async function gawainKnowsAQuest(player, npc, done) {
    await npc.say('Good day to you sir');

    const opt = await player.ask(['Good day', 'Know you of any quests Sir knight?'], false);

    if (opt === 0) {
        await player.say('good day');
    } else if (opt === 1) {
        await player.say('Know you of any quests sir knight?');
        await npc.say(
            done
                ? "I think you've done the main quest we were on right now"
                : 'The king is the man to talk to if you want a quest'
        );
    }
}

async function sirGawain(player, npc) {
    if (player.cache.talkedToGawain) {
        await npc.say('Good day to you sir');

        const option = await player.ask(["Any idea how to get into Morgan Le Faye's stronghold?", 'Hello again'], true);

        if (option === 0) {
            await npc.say("No you've got me stumped there");
        }

        return;
    }

    switch (stageOf(player)) {
        case 0:
        case 2:
        case 3:
        case 4:
        case 5:
            await gawainKnowsAQuest(player, npc, false);
            break;
        case 1: {
            await npc.say('Good day to you sir');

            const option = await player.ask(
                ['Good day', 'Any ideas on how to get Merlin out that crystal?', 'Do you know how Merlin got trapped'],
                false
            );

            if (option === 0) {
                await player.say('good day');
            } else if (option === 1) {
                await player.say('Any ideas on how to get Merlin out that crystal?');
                await npc.say("I'm a little stumped myself", "We've tried opening it with anything and everything");
            } else if (option === 2) {
                await player.say('Do you know how Merlin got trapped?');
                await npc.say('I would guess this is the work of the evil Morgan Le Faye');
                await player.say('And where can I find her?');
                await npc.say('She lives in her stronghold to the south of here');
                await npc.say('Guarded by some renegade knights led by Sir Mordred');
                player.cache.talkedToGawain = true;

                const sub = await player.ask(
                    ["Any idea how to get into Morgan Le Faye's stronghold?", 'Thankyou for the information'],
                    true
                );

                if (sub === 0) {
                    await npc.say("No you've got me stumped there");
                }
            }

            break;
        }
        case -1:
            await gawainKnowsAQuest(player, npc, true);
            break;
    }
}

async function lancelotFullOfYourself(player, npc) {
    await npc.say('I have every right to be proud of myself', 'My prowess in battle is world renowned');
}

async function sirLancelot(player, npc) {
    await npc.say('Greetings I am Sir Lancelot the greatest knight in the land', 'What do you want?');

    switch (stageOf(player)) {
        case 0:
        case 1:
            if (player.cache.talkedToGawain) {
                const opt = await player.ask(
                    [
                        'I want to get Merlin out of the crystal',
                        "You're a little full of yourself aren't you?",
                        "Any ideas on how to get into Morgan Le Faye's stronghold?"
                    ],
                    false
                );

                if (opt === 0) {
                    await player.say('I want to get Merlin out of the crystal');
                    await npc.say(
                        "Well the knights of the round table can't manage it",
                        "I can't see how a commoner like you could succeed where we have failed"
                    );
                } else if (opt === 1) {
                    await player.say("You're a little full of yourself aren't you?");
                    await lancelotFullOfYourself(player, npc);
                } else if (opt === 2) {
                    await player.say("Any ideas on how to get into Morgan Le Fayes's stronghold"); // sic
                    await npc.say(
                        "That stronghold is built in a strong defensive position",
                        "It's on a big rock sticking out into the sea",
                        'There are two ways in that I know of, the large heavy front doors',
                        'And the sea entrance, only penetrable by boat',
                        'They take all their deliveries by boat'
                    );
                    setStage(player, 2);
                    delete player.cache.talkedToGawain;
                }
            } else {
                const opt = await player.ask(
                    ['I want to get Merlin out of the crystal', "You're a little full of yourself aren't you?"],
                    true
                );

                if (opt === 0) {
                    await npc.say(
                        "Well the knights of the round table can't manage it",
                        "I can't see how a commoner like you could succeed where we have failed"
                    );
                } else if (opt === 1) {
                    await lancelotFullOfYourself(player, npc);
                }
            }

            break;
        default: {
            // 2, 3, 4, 5 and -1
            const opt = await player.ask(["You're a little full of yourself aren't you?", 'I seek a quest'], true);

            if (opt === 0) {
                await lancelotFullOfYourself(player, npc);
            } else if (opt === 1) {
                await npc.say('Leave questing to the profesionals', 'Such as myself'); // sic
            }

            break;
        }
    }
}

const DIALOGUES = {
    [KING_ARTHUR_ID]: kingArthur,
    [SIR_GAWAIN_ID]: sirGawain,
    [SIR_LANCELOT_ID]: sirLancelot
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

async function beehive(player, item) {
    const { world } = player;

    if (item.id === INSECT_REPELLANT_ID) {
        player.message('you squirt insect repellant on the beehive');
        await world.sleepTicks(3);
        player.message('You see bees leaving the hive');
        await world.sleepTicks(3);
        player.cache.squirt = true;
    } else if (item.id === BUCKET_ID) {
        player.message('You try to get some wax from the beehive');
        await world.sleepTicks(3);

        if (player.cache.squirt) {
            player.message('You get some wax from the hive');
            await world.sleepTicks(3);
            player.message('The bees fly back to the hive as the repellant wears off');
            await world.sleepTicks(3);
            player.inventory.remove(BUCKET_ID);
            player.inventory.add(WAX_BUCKET_ID);
            delete player.cache.squirt;
        } else {
            player.message('Suddenly bees fly out of the hive and sting you');
            player.damage(2);
        }
    }

    // Java blocks every item on the hive; anything else does nothing
    return true;
}

async function shatterCrystal(player, crystal) {
    const { world } = player;

    if (stageOf(player) !== 4) {
        player.message('Nothing interesting happens');
        return true;
    }

    player.message('The crystal shatters');
    await world.sleepTicks(3);

    world.removeEntity('gameObjects', crystal);
    world.setTickTimeout(() => world.addEntity('gameObjects', crystal), CRYSTAL_RESPAWN_TICKS);

    const merlin = player
        .getNearbyEntitiesByID('npcs', MERLIN_ID, 10)
        .find((npc) => player.getDistance(npc) <= 10);

    if (merlin) {
        await merlin.say(
            'Thankyou thankyou',
            "It's not fun being trapped in a giant crystal",
            "Go speak to King Arthur, I'm sure he'll reward you"
        );
        player.message('You have set Merlin free now talk to king arthur');
        setStage(player, 5);
    }

    return true;
}

async function onUseWithGameObject(player, gameObject, item) {
    if (gameObject.id === BEEHIVE_ID) {
        return beehive(player, item);
    }

    if (gameObject.id === GIANT_CRYSTAL_ID && item.id === EXCALIBUR_ID) {
        return shatterCrystal(player, gameObject);
    }

    return false;
}

module.exports = { onTalkToNPC, onUseWithGameObject };
