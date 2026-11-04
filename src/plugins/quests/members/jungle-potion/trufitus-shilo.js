// Ported from Open-RSC Core-Framework authentic/quests/members/Jungle_Potion.java (AGPL-3.0): Trufitus after the quest (Shilo Village)
//
// Not a plugin: the Jungle Potion plugin calls trufitusAfterQuest(player, npc) once the quest is complete and the
// one-off "jungle_completed" line has been spent. The Java cID cases (Trufitus.X) are the named async functions below.
//
// Shilo Village stage: player.questStages.shiloVillage (0 not started, -1 complete).
// Cache keys read: read_tomb_notes, obtained_shilo_info, dolmen_zombie, dolmen_skeleton, dolmen_ghost, rashiliya_corpse.

const ZADIMUS_ID = 589;
const STONE_PLAQUE_ID = 958;
const BONE_SHARD_ID = 974;

function shiloStage(player) {
    return player.questStages.shiloVillage || 0;
}

function hasKey(player, key) {
    return player.cache[key] != null;
}

async function trufitusAfterQuest(player, npc) {
    const stage = shiloStage(player);

    if (stage === -1) {
        const conv = Math.floor(Math.random() * 3);

        if (conv === 0) {
            await player.say('Greetings');
            await npc.say(
                'Hello Bwana.',
                'I conclude that you have been succesful.',
                'Mosol sent word that the village is clearing of Zombies.',
                'You have done us all a great dead!',
                'Why not go and visit him and have a look around Shilo',
                'village. You may find some interesting things there!'
            );
        } else if (conv === 1) {
            await player.say('Hello!');
            await npc.say(
                'Hello again Bwana.!',
                'Well Done again for helping to defeat Rashiliyia.',
                'Hopefully things will return to normal around here now.'
            );
        } else if (conv === 2) {
            await player.say('Hello Bwana!');
            await npc.say(
                'Greetings!',
                'I hope things are going well for you now.',
                'I have no new information since last we spoke.',
                'Needless to say, that if something does come up',
                'I will certainly get in touch directly.'
            );
        }
    } else if (stage === 1 || stage === 2) {
        // Handle shilo village start.
        await player.say('Greetings.');
        await npc.say('Greetings Bwana!', 'You look like you have some serious news...');
        await player.say(
            'Well, I think I may have.',
            'I have just spoken to Mosol Rei and he says that ',
            'Rashiliyia has returned...'
        );
        await npc.say('Oh dear, it is more serious than I imagined.');

        const menu = await player.ask(
            ['How are you anyway my friend?', 'What do you know about Rashiliyia?', 'What do you know about Mosol Rei?'],
            true
        );

        if (menu === 0) {
            await npc.say("I'm very well thanks.");

            const subMenu = await player.ask(
                ['What do you know about Rashiliyia?', 'What do you know about Mosol Rei?'],
                true
            );

            if (subMenu === 0) {
                await whatDoYouKnowAboutRashiliyia(player, npc);
            } else if (subMenu === 1) {
                await whatDoYouKnowAboutMoselRei(player, npc);
            }
        } else if (menu === 1) {
            await whatDoYouKnowAboutRashiliyia(player, npc);
        } else if (menu === 2) {
            await whatDoYouKnowAboutMoselRei(player, npc);
        }
    } else if (stage === 3 || stage === 4 || stage === 5) {
        await player.say('Greetings...');
        await npc.say(
            'Greetings Bwana, you have been away!',
            'The situation with Rashiliyia is worsening!',
            'I pray that you have some good news for me.'
        );
        await player.say('I think I found the temple of Ah Za Rhoon.');

        let menu;

        if (stage === 4 || stage === 5) {
            menu = await player.ask(
                [
                    'I have some items that I need help with.',
                    'I need some help with the Temple of Ah Za Rhoon.',
                    "I have just buried Zadimus's corpse."
                ],
                true
            );
        } else {
            menu = await player.ask(
                ['I have some items that I need help with.', 'I need some help with the Temple of Ah Za Rhoon.'],
                true
            );
        }

        if (menu === 0) {
            await showMeTempleItems(player, npc);
        } else if (menu === 1) {
            await npc.say(
                'If you have found the temple, you should search it',
                'thoroughly and see if there are any clues about',
                'Rashiliyia.'
            );
            await showMeTempleItems(player, npc);
        } else if (menu === 2 && (stage === 4 || stage === 5)) {
            await npc.say('Something seems different about you. You look like ', 'you have seen a ghost?');
            await player.say('It just so happens that I have!');
            await npc.say("Oh! So you managed to bury Zadimus's Corpse?");
            await player.say('Yes, it was pretty grisly!');

            // do not send over
            const m = await player.ask(
                ['The spirit said something about keys and kin?', 'The spirit rambled on about some nonsense.'],
                false
            );

            if (m === 0) {
                await player.say(' "The spirit said something about keys and kin?"');
                await keysAndKin(player, npc);
            } else if (m === 1) {
                await player.say('The spirit rambled on about some nonsense.');
                await npc.say('Oh, so it most likely was not very important then?');
            }
        }
    } else if (stage === 6) {
        let chat;

        await player.say('Greetings...');

        if (!hasKey(player, 'read_tomb_notes')) {
            await npc.say('Greetings Bwana, did you find Rashiliyias Tomb?');
            await player.say('Yes, I think so.');

            // do not send over
            chat = await player.ask(
                [
                    'I think I found Bervirius Tomb',
                    'I have some items that I need help with.',
                    'I need some help with the Temple of Ah Za Rhoon.'
                ],
                false
            );

            if (chat === 0) {
                await player.say('I think I found Bervirius Tomb.');
                await npc.say(
                    'Congratulations Bwana,',
                    'but perhaps you need to make a thorough',
                    'examination of the Ah Za Rhoon temple first?',
                    'Show me any items you have found though.',
                    'I may be able to help.'
                );
            } else if (chat === 1) {
                await player.say('I have some items that I need help with.');
                await showMeTempleItems(player, npc);
            } else if (chat === 2) {
                await player.say('I need some help with the Temple of Ah Za Rhoon.');
                await helpWithAhZaRhoonTemple(player, npc);
            }
        } else {
            await npc.say('Greetings Bwana, did you find the tomb of Bervirius?');
            chat = await player.ask(
                ['Yes, I found his tomb.', "No, I didn't find a thing.", 'I actually need help with something else.'],
                true
            );

            if (chat === 0) {
                await npc.say(
                    'That is truly great news Bwana!',
                    'You are certainly very resourceful.',
                    'If you have found any items that you need help with',
                    'please let me see them and I will help as much as I can.'
                );

                const ex5 = await player.ask(
                    ['I actually need help with something else.', "I didn't find anything in the tomb."],
                    true
                );

                if (ex5 === 0) {
                    await actuallyNeedHelpWithSomethingElse(player, npc);
                } else if (ex5 === 1) {
                    await didntFindAnythingInTheTomb(player, npc);
                }
            } else if (chat === 1) {
                await npc.say(
                    'That is a shame Bwana, we really do need to act against',
                    'Rashiliyia soon if we are ever to stand a chance of defeating her.'
                );

                const chat2 = await player.ask(
                    [
                        'Actually I did find the tomb, I was just joking.',
                        'I actually need help with something else.',
                        "I didn't find anything in the tomb."
                    ],
                    true
                );

                if (chat2 === 0) {
                    await npc.say(
                        'Well, Bwana, this is no laughing matter.',
                        'We need to take this very seriously and act now!',
                        'If you have found any items at the tomb that you need help ',
                        'with please let me see them and I will help as much as I can.'
                    );

                    const ex4 = await player.ask(
                        ["I didn't find anything in the tomb.", 'I actually need help with something else.'],
                        true
                    );

                    if (ex4 === 0) {
                        await didntFindAnythingInTheTomb(player, npc);
                    } else if (ex4 === 1) {
                        await actuallyNeedHelpWithSomethingElse(player, npc);
                    }
                } else if (chat2 === 1) {
                    await actuallyNeedHelpWithSomethingElse(player, npc);
                } else if (chat2 === 2) {
                    await didntFindAnythingInTheTomb(player, npc);
                }
            } else if (chat === 2) {
                await actuallyNeedHelpWithSomethingElse(player, npc);
            }
        }
    } else if (stage === 7) {
        await npc.say(
            "You may want to start looking for Rashiliyia's Tomb.",
            'Do you need extra help with locating it?'
        );

        const off = await player.ask(
            ['Yes please.', "No thanks, I've got a good idea where it is.", 'I actually need help with something else.'],
            true
        );

        if (off === 0) {
            await npc.say(
                'You may like to start checking North of Ah Za Rhoon.',
                'There must be some clue as to what to look for when locating',
                'the tomb. Was there anything else at the tomb of Bervirius?'
            );

            const off2 = await player.ask(
                ['Just a Dolmen with some symbols on it.', 'Nothing that was significant.'],
                true
            );

            if (off2 === 0) {
                await npc.say('Well, what symbols were they, perhaps that will', 'give a clue to the location?');
            } else if (off2 === 1) {
                await npc.say(
                    'Oh, perhaps you should take another look at them?',
                    'Any scrap of information might be useful.'
                );
            }
        } else if (off === 1) {
            await npc.say('Well, that is very good Bwana,', 'perhaps you should locate it already?');
        } else if (off === 2) {
            await actuallyNeedHelpWithSomethingElse(player, npc);
        }
    } else if (stage === 8) {
        if (hasKey(player, 'dolmen_zombie') && hasKey(player, 'dolmen_skeleton') && hasKey(player, 'dolmen_ghost')) {
            await player.say('Hello');
            await npc.say(
                'Greetings again Bwana.',
                'I hope that you have managed to locate Rashiliyias Tomb.',
                'Again, if you found any interesting items, please show',
                'them to me.'
            );

            const newMenu2 = await player.ask(['What should I do now?', 'Thanks!'], true);

            if (newMenu2 === 0) {
                player.message('Trufitus scratches his head.');
                await npc.say(
                    'Well Bwana, if you have Rashiliyias remains,',
                    'you need to find a way to put her spirit to rest.',
                    'Perhaps there was a clue with one of the artifacts',
                    'that you have?',
                    'Why not have a look through the artifacts that you have ',
                    'found and see if there is something clue that might help?',
                    'If you do not have her remains, ',
                    'you will need to find them.'
                );
            } else if (newMenu2 === 1) {
                await npc.say("You're more than welcome Bwana!", 'Good luck for the rest of your quest.');
            }

            return;
        } else if (hasKey(player, 'rashiliya_corpse')) {
            await player.say('Hello...');
            await npc.say(
                'Greetings Bwana, I sense that something dreadful has happened.',
                'Mosol Rei has sent word to me to say that the village is over',
                'run with Zombies. Tell me, did you find Rashiliyias Tomb?'
            );

            const optD = await player.ask(
                ['Yes, I found the tomb.', 'I found Rashiliyias remains but I dropped them.', 'I found nothing.'],
                true
            );

            if (optD === 0) {
                await npc.say('And what happened then?');

                const subopt = await player.ask(
                    ['I found Rashiliyias remains but I dropped them.', 'I found nothing.'],
                    true
                );

                if (subopt === 0) {
                    await dropedRashiliyia(player, npc);
                } else if (subopt === 1) {
                    await foundNothing(player, npc);
                }
            } else if (optD === 1) {
                await dropedRashiliyia(player, npc);
            } else if (optD === 2) {
                await foundNothing(player, npc);
            }

            return;
        }

        await player.say('Hello again..');
        await npc.say('And greetings to you Bwana!', 'Have you found anything new Bwana?');

        const tomb = await player.ask(
            [
                "Nope, I haven't found anything.",
                "Yes, I've found Rashiliyia's Tomb!",
                'I get choked when I go into Rashiliyias Tomb.'
            ],
            true
        );

        if (tomb === 0) {
            await npc.say('Well, that is a pity? Perhaps you should keep on looking?');
        } else if (tomb === 1) {
            await npc.say('Very good Bwana, this is very good!', 'Did you find her remains?');

            // do not send over
            const newMenu = await player.ask(['Yes, In fact I did!', "Nope, I haven't found them yet."], false);

            if (newMenu === 0) {
                await player.say('Yes, In fact I did!');
                await npc.say(
                    'This is truly great Bwana.',
                    'If you need help with the remains, ',
                    'please show them to me.'
                );
            } else if (newMenu === 1) {
                await player.say("No, I haven't found them yet.");
                await npc.say(
                    'You really need to find the remains before we',
                    'can hope to defeat her and remove her influence from',
                    'Shilo village.'
                );
            }
        } else if (tomb === 2) {
            await npc.say(
                'Maybe you have missed something, a special clue?',
                'It might be worth searching the temple of Ah Za Rhoon again.',
                'Or go back to Bervirius Tomb',
                'for a more thorough search.'
            );
        }
    } else {
        await npc.say('Greetings once again Bwana,', 'I have no more news since we last spoke.');
    }
}

// Trufitus.DROPED_RASHILIYIA
async function dropedRashiliyia(player, npc) {
    player.message('Trufitus looks at you in amazement...');
    await player.world.sleepTicks(3);
    await npc.say(
        'I am truly speechless bwana.',
        'How could you have been so careless.',
        'You will need to get into her tomb again.',
        'To see if you can reclaim her remains once more',
        'Wait...I hear a voice....'
    );

    let zadimus = player.getNearbyEntitiesByID('npcs', ZADIMUS_ID, 10).filter((n) => !n.locked)[0];

    if (!zadimus) {
        zadimus = player.world.spawnTimedNPC({ id: ZADIMUS_ID, x: player.x, y: player.y, ticks: 100 });
        // npc.say needs someone to talk to (the player is engaged with Trufitus)
        zadimus.interlocutor = player;
        await zadimus.say(
            'Rashiliyia has returned to her tomb and her power grows',
            'you must gain entry to her resting place and',
            'sanctify her remains in the manner of her son.',
            "Remember, 'I am the key, but only kin may approach her.'"
        );
        player.message('The apparition fades into nothingness.');
        await player.world.sleepTicks(3);

        if (!player.inventory.has(BONE_SHARD_ID)) {
            player.message('A shard of bone appears on the ground in front of you.');
            await player.world.sleepTicks(3);
            player.message('You take the bone shard and place it into your inventory.');
            await player.world.sleepTicks(3);
            player.inventory.add(BONE_SHARD_ID, 1);
        }

        player.world.removeEntity('npcs', zadimus);
    }
}

// Trufitus.FOUND_NOTHING
async function foundNothing(player, npc) {
    await npc.say(
        'You really should try to find the tomb.',
        'It is our only chance if we hope to defeat Rashiliyia!'
    );
}

// Trufitus.DIDNT_FIND_ANYTHING_IN_THE_TOMB
async function didntFindAnythingInTheTomb(player, npc) {
    await npc.say(
        'Maybe you need to look around a little more.',
        'There must be some small detail at least that can help us'
    );

    const chat3 = await player.ask(
        ['I have some items that I need some help with.', 'I actually need help with something else.'],
        true
    );

    if (chat3 === 0) {
        await showMeTempleItems2(player, npc);
    } else if (chat3 === 1) {
        await actuallyNeedHelpWithSomethingElse(player, npc);
    }
}

// Trufitus.HELP_WITH_ZADIMUS
async function helpWithZadimus(player, npc) {
    await npc.say(
        'All I know is that Zadimus was a high priest of Zamorak,',
        'Rashiliyia loved him but he did not return her affections.',
        'When she become a more powerful sorceress, she attacked the',
        'Ah Za Rhoon temple to Zamorak that Zadimus built and ',
        'reduced it to rubble. What his fate was, I do not know. ',
        'If you find anything relating to him at the temple of ',
        'Ah Za Rhoon, please let me see it.'
    );

    const ex = await player.ask(
        [
            'Is there any sacred ground around here?',
            'I need help with Bervirius.',
            'I need help with Rashliyia.',
            'I need some help with the Temple of Ah Za Rhoon.',
            'Ok, thanks!'
        ],
        true
    );

    if (ex === 0) {
        await npc.say('The ground in the centre of the village is very sacred to us', 'Maybe you could try there ?');
    } else if (ex === 1) {
        await helpWithBervirius(player, npc);
    } else if (ex === 2) {
        await helpWithRash(player, npc);
    } else if (ex === 3) {
        await helpWithAhZaRhoonTemple(player, npc);
    } else if (ex === 4) {
        await npc.say("You're quite welcome Bwana.");
    }
}

// Trufitus.HELP_WITH_AH_ZA_RHOON_TEMPLE
async function helpWithAhZaRhoonTemple(player, npc) {
    await npc.say(
        'If you have found the temple, you should search it',
        'thoroughly and see if there are any clues about',
        'Rashiliyia.'
    );

    // do not send over
    const ex3 = await player.ask(
        [
            'I need help with Rashlilia.',
            'I need help with Zadimus.',
            'I have some items that I need help with.',
            'I need help with Bervirius.',
            'Ok, thanks!'
        ],
        false
    );

    if (ex3 === 0) {
        await player.say('I need help with Rashliyia.');
        await helpWithRash(player, npc);
    } else if (ex3 === 1) {
        await player.say('I need help with Zadimus.');
        await helpWithZadimus(player, npc);
    } else if (ex3 === 2) {
        await player.say('I have some items that I need help with.');
        await showMeTempleItems(player, npc);
    } else if (ex3 === 3) {
        await player.say('I need help with Bervirius.');
        await helpWithBervirius(player, npc);
    } else if (ex3 === 4) {
        await player.say('Ok, thanks!');
        await npc.say("You're quite welcome Bwana.");
    }
}

// Trufitus.HELP_WITH_BERVIRIUS
async function helpWithBervirius(player, npc) {
    await npc.say(
        'Bervirius is the Son of Rashiliyia.',
        'His tomb may hold some clues as to how',
        'Rashiliyia may be defeated.'
    );

    const ex2 = await player.ask(
        [
            'I need help with Zadimus.',
            'I have some items that I need help with.',
            'I need help with Rashliyia.',
            'I need some help with the Temple of Ah Za Rhoon.',
            'Ok, thanks!'
        ],
        true
    );

    if (ex2 === 0) {
        await helpWithZadimus(player, npc);
    } else if (ex2 === 1) {
        await showMeTempleItems(player, npc);
    } else if (ex2 === 2) {
        await helpWithRash(player, npc);
    } else if (ex2 === 3) {
        await helpWithAhZaRhoonTemple(player, npc);
    } else if (ex2 === 4) {
        await npc.say("You're quite welcome Bwana.");
    }
}

// Trufitus.HELP_WITH_RASH
async function helpWithRash(player, npc) {
    await npc.say(
        "We need to find Rashiliyia's resting place ",
        'and learn how to put her spirit to rest. ',
        'You may find some clues to her resting place',
        'in Ah Za Rhoon or Bervirius Tomb.'
    );

    const b = await player.ask(
        [
            'I need help with Zadimus.',
            'I have some items that I need help with.',
            'I need help with Bervirius.',
            'I need some help with the Temple of Ah Za Rhoon.',
            'Ok, thanks!'
        ],
        true
    );

    if (b === 0) {
        await helpWithZadimus(player, npc);
    } else if (b === 1) {
        await showMeTempleItems(player, npc);
    } else if (b === 2) {
        await helpWithBervirius(player, npc);
    } else if (b === 3) {
        await helpWithAhZaRhoonTemple(player, npc);
    } else if (b === 4) {
        await npc.say("You're quite welcome Bwana.");
    }
}

// Trufitus.ACTUALLY_NEED_HELP_WITH_SOMETHING_ELSE
async function actuallyNeedHelpWithSomethingElse(player, npc) {
    await npc.say('What could I possibly help you with Bwana?');

    // do not send over
    const c = await player.ask(
        [
            'I need help with Rashiliyia.',
            'I need help with Zadimus.',
            'I have some items that I need help with.',
            'I need help with Bervirius.',
            'Ok, thanks!'
        ],
        false
    );

    if (c === 0) {
        await player.say('I need help with Rashliyia.');
        await helpWithRash(player, npc);
    } else if (c === 1) {
        await player.say('I need help with Zadimus.');
        await helpWithZadimus(player, npc);
    } else if (c === 2) {
        await player.say('I have some items that I need help with.');
        await showMeTempleItems(player, npc);
    } else if (c === 3) {
        await player.say('I need help with Bervirius.');
        await helpWithBervirius(player, npc);
    } else if (c === 4) {
        await player.say('Ok, thanks!');
        await npc.say("You're quite welcome Bwana.");
    }
}

// Trufitus.WHAT_DO_YOU_KNOW_ABOUT_MOSEL_REI
async function whatDoYouKnowAboutMoselRei(player, npc) {
    await npc.say(
        'I know he is a brave warrior, he lives in a village south of here.',
        'Your journeys have taken you far!'
    );

    const opt = await player.ask(['What do you know about Rashiliyia?', 'Do you trust him?'], true);

    if (opt === 0) {
        await whatDoYouKnowAboutRashiliyia(player, npc);
    } else if (opt === 1) {
        await npc.say(
            'He is a little headstrong, but for the right reasons.',
            'I think he is generally to be trusted.'
        );

        const opt2 = await player.ask(
            ['What do you know about Rashiliyia?', 'Mosol Rei said something about a legend?'],
            true
        );

        if (opt2 === 0) {
            await whatDoYouKnowAboutRashiliyia(player, npc);
        } else if (opt2 === 1) {
            await somethingAboutALegend(player, npc);
        }
    }
}

// Trufitus.WHAT_DO_YOU_KNOW_ABOUT_RASHILIYIA
async function whatDoYouKnowAboutRashiliyia(player, npc) {
    await npc.say(
        "Hmmm, it's been a long time since I heard that name.",
        'She is the Queen of the Undead.',
        'and a more fearsome enemy you will be unlikely to find.',
        'I fear that you bring me news that she has returned to plague us once again?',
        'Alas I know of no weakness that she has.'
    );

    const opt3 = await player.ask(
        [
            'So there is nothing we can do?',
            'Should I start to evacuate the island?',
            'Mosol Rei said something about a legend?'
        ],
        true
    );

    if (opt3 === 0) {
        await npc.say('Not that I can think of');

        const opt8 = await player.ask(['Oh, ok!', 'Should I start to evacuate the Island?'], true);

        if (opt8 === 0) {
            await ohOk(player, npc);
        } else if (opt8 === 1) {
            await evacuateIsland(player, npc);
        }
    } else if (opt3 === 1) {
        await evacuateIsland(player, npc);
    } else if (opt3 === 2) {
        await somethingAboutALegend(player, npc);
    }
}

// Trufitus.SOMETHING_ABOUT_A_LEGEND
async function somethingAboutALegend(player, npc) {
    await npc.say(
        'Ah, yes, there is a legend, but it is lost in the midst of antiquity...',
        'The last place to hold any details regarding this mystery',
        'was in the temple of Ah-Za_Rhoon',
        'And that has long since vanished, it crumbled into dust.'
    );

    const opt4 = await player.ask(
        ['Why was it called Ah Za Rhoon?', 'Do you know anything more about the temple?'],
        true
    );

    if (opt4 === 0) {
        await ahZaRhoon(player, npc);
    } else if (opt4 === 1) {
        await moreAboutTheTemple(player, npc);
    }
}

// Trufitus.MORE_ABOUT_THE_TEMPLE
async function moreAboutTheTemple(player, npc) {
    await npc.say(
        'Not much',
        'I would say that is about it...',
        'Even the great priest Zadimus who built the temple did not survive.',
        'Some say that Rashiliyia caused the temple to colapse.',
        'She was angry at Zadimus for not returning her affections.',
        'She was a great sorceress even before they met.'
    );

    const opt6 = await player.ask(['Tell me more', 'Are there any traps there?'], true);

    if (opt6 === 0) {
        await npc.say("I don't know anymore.", "You're very demanding aren't you!");
    } else if (opt6 === 1) {
        await npc.say(
            'How am I supposed to know?',
            'Alot of what I know is most probably wrong',
            'But some of it seems right to me.',
            'Excuse me but I must get back to my studies.'
        );
    }
}

// Trufitus.EVACUATE_ISLAND
async function evacuateIsland(player, npc) {
    await npc.say('Yes, that may be a good idea', 'Many people could die!', 'If only there was a way to defeat her!');

    const opt7 = await player.ask(
        ['Mosol Rei said something about a legend?', 'Will you pack your things now?'],
        true
    );

    if (opt7 === 0) {
        await somethingAboutALegend(player, npc);
    } else if (opt7 === 1) {
        await npc.say(
            'I will wait and see what will happen.',
            'Maybe she does not have the power to strike too far from her resting place?',
            'But there are many things that I need to do now'
        );

        const opt9 = await player.ask(['Is her resting place important?', 'Oh, ok!'], true);

        if (opt9 === 0) {
            await restingPlace(player, npc);
        } else if (opt9 === 1) {
            await ohOk(player, npc);
        }
    }
}

// Trufitus.THANKS_FOR_THE_INFORMATION
async function thanksForTheInformation(player, npc) {
    await npc.say('What information?');
    player.message('Trufitus looks at you blankly, then wanders off.');
    await player.world.sleepTicks(3);
    await npc.say('Hmmm, well, you are welcome bwana.');
}

// Trufitus.AH_ZA_RHOON
async function ahZaRhoon(player, npc) {
    await npc.say(
        'It is from an ancient language.',
        'The direct translation is...',
        "'Magnificence floating on water'",
        'But my research makes me believe that the temple was built on land',
        'And most likely between large bodies of water, for example large lakes.',
        'However, many people have searched for the temple, and have failed.',
        'I would hate to see you waste your time on a pointless search like that.'
    );

    if (shiloStage(player) === 1) {
        player.questStages.shiloVillage = 2;
    }

    const opt5 = await player.ask(
        ['Thanks for the information!', 'Do you know anything more about the temple?'],
        true
    );

    if (opt5 === 0) {
        await thanksForTheInformation(player, npc);
    } else if (opt5 === 1) {
        await moreAboutTheTemple(player, npc);
    }
}

// Trufitus.OH_OK
async function ohOk(player, npc) {
    await npc.say("Yes, it's a bit sad really, I liked that village.");
    player.message('Trufitus seems deeply touched...');
    await player.world.sleepTicks(3);
    await npc.say('Well, I hope you will excuse me, but I need to get back to my studies.');
}

// Trufitus.WEAKNESS
async function weakness(player, npc) {
    await npc.say(
        'I am not sure, but the legend about her certainly is long',
        "It's a pity that the temple of Ah Za Rhoon has crumbled",
        'as there my be some clues that could help us to defeat her.',
        'Usually, the largest problem is locating her resting place.'
    );

    const opt12 = await player.ask(['Why was it called Ah Za Rhoon?', 'Is her resting place important?'], true);

    if (opt12 === 0) {
        await ahZaRhoon(player, npc);
    } else if (opt12 === 1) {
        await restingPlace(player, npc);
    }
}

// Trufitus.RESTING_PLACE
async function restingPlace(player, npc) {
    await npc.say(
        'Only a few people ever reported seeing a ghost like wraith',
        'It only ever appeared in the place where her bones were laid to rest',
        'Of course, she only has to get one of her minions to move the bones',
        'And she has a new land to unleash her undead plague.'
    );

    const opt10 = await player.ask(['What are minions?', 'What are onions?'], true);

    if (opt10 === 0) {
        await npc.say(
            'Minions are the fiendish undead creatures that she controls.',
            'She has very few living worshippers, but they need to be dealt with at some point',
            'Usually a strong creature of some sort will be guarding her remains',
            'And of course, she is a very powerful spell caster herself ',
            'Not to be tackled lightly'
        );

        const opt13 = await player.ask(['Thanks for the information!', 'Does she have any weaknesses?'], true);

        if (opt13 === 0) {
            await thanksForTheInformation(player, npc);
        } else if (opt13 === 1) {
            await weakness(player, npc);
        }
    } else if (opt10 === 1) {
        player.message('Trufitus looks at you blankly');
        await player.world.sleepTicks(3);
        await npc.say('Surely you mean Minions?');
        await player.say('Yes of course, I mean Minions, what made you think I said Onions?');
        player.message('Trufitus frowns at you but continues about...minions...');
        await player.world.sleepTicks(3);
        await npc.say(
            'Minions are the fiendish undead creatures that Rashiliyia controls.',
            'She has very few living worshippers, but they need to be dealt with at some point',
            'Usually a strong creature of some sort will be guarding the bones',
            'And it is not to be tackled lightly'
        );

        const opt11 = await player.ask(['Thanks for the information!', 'Does she have any weaknesses?'], true);

        if (opt11 === 0) {
            await thanksForTheInformation(player, npc);
        } else if (opt11 === 1) {
            await weakness(player, npc);
        }
    }
}

// Trufitus.SHOW_ME_TEMPLE_ITEMS2
async function showMeTempleItems2(player, npc) {
    await showMeItemsDialogue(player, npc, 1);
}

// Trufitus.SHOW_ME_TEMPLE_ITEMS
async function showMeTempleItems(player, npc) {
    await showMeItemsDialogue(player, npc, 0);
}

// Trufitus.KEYS_AND_KIN
async function keysAndKin(player, npc) {
    await npc.say(
        "Hmmm, maybe it's a clue of some kind?",
        'Well, Rashiliyias only kin, Bervirius, is entombed',
        'on a small island which lies to the South West.',
        'I will do some research into this as well.',
        'But I think we must take this clue literally',
        'and get some item that belonged to Bervirius',
        'as it may be the only way to approach Rashiliyia.'
    );

    if (shiloStage(player) === 4) {
        player.questStages.shiloVillage = 5;
    }
}

async function showMeItemsDialogue(player, npc, path) {
    if (path === 0) {
        await npc.say("Well, just let me see the item and I'll help as much as I can.");
    } else if (path === 1) {
        await npc.say("Well, just show me the items and I'll help as much as I can.");
    }

    if (shiloStage(player) >= 6) {
        const optTemp = await player.ask(
            [
                'I need help with Zadimus.',
                'I need help with Bervirius.',
                'I need help with Rashliyia.',
                'I need some help with the Temple of Ah Za Rhoon.',
                'Ok, thanks!'
            ],
            true
        );

        // sic: the Java maps each option to the next topic along (option 0 "Zadimus" opens Bervirius, option 1
        // "Bervirius" opens Rashiliyia, option 2 opens the temple, option 3 is the farewell)
        if (optTemp === 0) {
            await helpWithBervirius(player, npc);
        } else if (optTemp === 1) {
            await helpWithRash(player, npc);
        } else if (optTemp === 2) {
            await helpWithAhZaRhoonTemple(player, npc);
        } else if (optTemp === 3) {
            await npc.say("You're quite welcome Bwana.");
        }

        return;
    }

    // no stone-plaque in bank or inventory
    if (!player.bank.has(STONE_PLAQUE_ID) && !player.inventory.has(STONE_PLAQUE_ID)) {
        await npc.say('Look for something that can identify the place.', 'Leave no stone unturned.');
    } else {
        await npc.say('We need to identify that the place you have found', 'is indeed Ah Za Rhoon.');
    }

    // player has not explored inner Ah Za Rhoon
    if (!hasKey(player, 'obtained_shilo_info')) {
        await npc.say(
            'Look for details of Rashiliyias Kin, these may be well hidden.',
            'There is a legend about Rashiliyia, look for it in the temple.',
            'Look for something relating to Zadimus at the temple.',
            'And best of luck!'
        );
    } else {
        await npc.say(
            'Any scrolls or information about Rashiliyias Kin would be helpful',
            'Have you got any items concerning Rashiliyia?',
            'If so, please show me them.',
            'There must be something relating to Zadimus at the temple',
            'Did you find anything? If so, let me see it.',
            'And best of luck!'
        );
    }
}

module.exports = {
    trufitusAfterQuest,
    dropedRashiliyia,
    foundNothing,
    didntFindAnythingInTheTomb,
    helpWithZadimus,
    helpWithAhZaRhoonTemple,
    helpWithBervirius,
    helpWithRash,
    actuallyNeedHelpWithSomethingElse,
    whatDoYouKnowAboutMoselRei,
    whatDoYouKnowAboutRashiliyia,
    somethingAboutALegend,
    moreAboutTheTemple,
    evacuateIsland,
    thanksForTheInformation,
    ahZaRhoon,
    ohOk,
    weakness,
    restingPlace,
    showMeTempleItems,
    showMeTempleItems2,
    keysAndKin,
    showMeItemsDialogue
};
