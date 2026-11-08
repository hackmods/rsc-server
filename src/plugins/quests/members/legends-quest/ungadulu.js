// Ported from Open-RSC Core-Framework authentic/quests/members/legendsquest/npcs/LegendsQuestUngadulu.java (AGPL-3.0): the Shaman
// Ungadulu (766) and his possessed form (767), through the flame octagram and after it. Stage map: shared.js.

const {
    ITEM,
    NPC,
    END,
    stageOf,
    cacheHas,
    cacheSet,
    mes,
    holds,
    give,
    take,
    level,
    setLevel,
    baseLevel,
    hurt,
    changeNpc,
    spawnNpc,
    startFight,
    runGraph,
    nearNpc
} = require('./shared');

// ---- the possessed Shaman ------------------------------------------------------------------------------------------------

async function evilUngadulu(player, npc) {
    await npc.say('Ha Ha ha Vacu...now you will be my pawn...');
    await mes(player, 'The Shaman starts an incantation...', 2);
    await npc.say('Iles Resti Yam Darkus Spiritus Possesi Yanai..');
    await mes(player, 'You feel a strange power coming over you...', 2);
    hurt(player, 5);
    setLevel(player, 'attack', level(player, 'attack') - 5);
    setLevel(player, 'defense', level(player, 'defense') - 5);
    setLevel(player, 'strength', level(player, 'strength') - 5);
    await mes(player, 'The Shaman seems to get stronger...', 2);
    await mes(player, 'The Shaman seems to return to normal...', 2);

    const good = changeNpc(player, npc, NPC.UNGADULU);

    await good.say('Run, run away...', 'Run like the leapard bwana...');
}

// ---- the conversation graph ----------------------------------------------------------------------------------------------

const ok = () => ['Ok, thanks...', 'okThanks'];

const NODES = {
    okThanks: { npc: ['My sincerest pleasure Bwana...'] },
    whatNow: {
        npc: [
            'Well, you should be able to plant the Yommi tree.',
            'And then water it with the sacred water.',
            'You should then be able to start making the Totem pole.',
            'So long as you have banished the spirit',
            'And managed to get some of the sacred water.'
        ],
        menu: [['Yes, I\'ve got the water.', 'gotWater'], ["Yes, I've killed the Spirit.", 'killedSpirit'], ok()]
    },
    killedSpirit: {
        run: async ({ player, npc }) => {
            await player.say('The spirit actually turned out to be the Demon - Nezikchened.');
            await npc.say(
                "That's truly a miracle Bwana,",
                "very few come out of Viyeldi's caves alive.",
                'And you managed to defeat Nezikchened a second time?',
                'You are truly a legend bwana.',
                'Do you have the sacred water yet?'
            );
        },
        menu: [['Yes, I\'ve got the water.', 'gotWater'], ['What do I do now?', 'whatNow'], ok()]
    },
    gotWater: {
        npc: ['That is truly great Bwana...well done!', 'You have the spirit of the jungle lion', 'Did you use the spell and kill the spirit?'],
        say: false,
        menu: [
            ["Yes, I've killed the Spirit.", async ({ player }) => { await player.say("Yes, I've killed the Spirit."); return 'killedSpirit'; }],
            ['What do I do now?', async ({ player }) => { await player.say('What do I do now ?'); return 'whatNow'; }],
            ['Ok, thanks...', async ({ player }) => { await player.say('Ok, thanks...'); return 'okThanks'; }]
        ]
    },
    daggers: {
        npc: [
            'I know something about them, especially magical daggers.',
            "If you have a specific one, show it to me and I'll help",
            'as much as I can.'
        ],
        menu: ({ player }) =>
            cacheHas(player, 'killed_viyeldi')
                ? [['I have killed Viyeldi!', 'killedViyeldi'], ['The spirit told me to kill Viyeldi.', 'toldToKill'], ok()]
                : [['I met a spirit in the Viyeldi Caves.', 'metSpirit'], ['The spirit told me to kill Viyeldi.', 'toldToKill'], ok()]
    },
    killedViyeldi: {
        run: async ({ player, npc }) => {
            await npc.say('Why on earth did you do that?');
            await mes(player, 'The Shaman screams at you...', 2);
            await player.say(
                'A spirit called Echned Zekin said I had to avenge his spirit',
                'by killing Viyeldi if I wanted to get the pure water.'
            );
            await mes(player, 'The Shaman puts his head in his hands.', 2);
            await npc.say(
                'Bwana, you have been tricked by a spirit !',
                'And you have done the worst thing imaginable.',
                'Viyeldi was the sorcerer who controlled the Hero\'s who protect.',
                'the source.',
                'The spirits of these hero\'s are now free',
                'to be controlled by other, more powerful forces.',
                'Most likely the spirit that tricked you.'
            );
        },
        menu: [
            ['Do you know anything about daggers?', 'daggers'],
            [
                'What can we do?',
                async ({ player, npc }) => {
                    if (holds(player, ITEM.HOLY_FORCE_SPELL)) {
                        await npc.say(
                            'You can use that Holy Force spell to try and defeat the spirit.',
                            "Come back and let me know if I can help in any other way."
                        );
                    } else {
                        await npc.say('I am not sure at this time Bwana.', 'Give me a few moments to think.', 'Hmmm....');
                        await mes(player, "The Shaman looks as if he's thinking very deeply.", 2);
                        await mes(player, 'The wizened old Shaman hands over a piece of paper.', 2);
                        await npc.say(
                            'Take this spell and pray that you can defeat',
                            'this evil spirit before it\'s too late.'
                        );
                        give(player, ITEM.HOLY_FORCE_SPELL);
                        await npc.say("I'll take that dagger from you now!");
                        take(player, ITEM.GLOWING_DARK_DAGGER);
                    }

                    return END;
                }
            ],
            ok()
        ]
    },
    metSpirit: {
        npc: [
            'You did well to come to me Bwana...',
            'As I said, I am an expert in spirits of the underworld...',
            'In most circumstances you should just ignore them.',
            'However, beware as many spirits will try to trick you.'
        ],
        menu: [['The spirit told me to kill Viyeldi.', 'toldToKill'], ok()]
    },
    toldToKill: {
        npc: [
            'That sounds very strange Bwana,',
            "I'm glad to see that you didn't comit such a foul act.",
            'I can make a spell that would help you to defeat the spirit.',
            'But I need an item that belongs to the spirit to make it work.',
            'If you have something like that, please show it to me.',
            "And I'll give you the spell.",
            'Beware of everyone in these caves,',
            'I was tricked very easily and was enslaved, as you well know.'
        ],
        menu: [['I met a spirit in the Viyeldi Caves.', 'metSpirit'], ok()]
    },
    sourceKnow: {
        npc: [
            'It is said that the caves where the stream is located, ',
            'are littered with strange remains of a past civilisation.',
            'The dwarves are said to have excavated the area in search',
            'of the source of the sacred water.',
            'Something bad must have happened because soon the area was cursed.',
            'Anyone who entered the area looking for the source of the water,',
            'And who died, would be forver cursed to protect the water...',
            '...forever...'
        ],
        menu: [['I am on a quest to get more pure water.', 'questMoreWater'], ok()]
    },
    questMoreWater: {
        npc: [
            'Well, good luck with your quest Bwana.',
            'You may well find it worthwhile exploring these catacombs.',
            'There is said to be an entrance to the Viyeldi caves.',
            'Which is where the sacred source of the magic pool exists.',
            'Beware though as it is said that the area is cursed.',
            'Anyone who is killed seeking the sacred water,',
            "will forever be sworn to protect it's secret."
        ],
        menu: [['What do you know about the source of the sacred water?', 'sourceKnow'], ok()]
    },
    poolDriedUp: {
        npc: [
            'Hmmm, that sounds odd..',
            "I'm sure that Gujuo will tell you the same as me though.",
            'Searching for the source of the water pool will be difficult.',
            'However, with some help, it might be possible.'
        ],
        menu: [['Where can I get more pure water?', 'morePure'], ok()]
    },
    morePure: {
        npc: [
            'There is said to be a stream of the sacred water that exists underground.',
            "I'm sure that Gujuo will tell you quite a lot about it.",
            "I'm have not explored outside of this room, but I have heard",
            'that there is a door within these catacombs which challenges any',
            'person with a riddle.',
            'Very few have solved the riddle, ',
            'and fewer have been returned alive if they did solve it.',
            'You can try to explore these caverns, it may help.',
            'You may just be able to find the Viyeldi caves.',
            'That is where the sacred source of the pure water resides...'
        ],
        menu: [['The magic pool has dried up and I need some more pure water.', 'poolDriedUp'], ok()]
    },
    moreSeeds: {
        run: async ({ player, npc }) => {
            if (holds(player, ITEM.GERMINATED_YOMMI_TREE_SEED) || holds(player, ITEM.YOMMI_TREE_SEED)) {
                await npc.say(
                    'You already have some Yommi tree seeds...',
                    'Use those first and then come back to me if you need any more.'
                );
                player.message('Ungadulu goes back to his studies.');
            } else {
                await mes(player, 'Ungadulu gives you some more seeds..', 2);
                give(player, ITEM.GERMINATED_YOMMI_TREE_SEED, 3);
                await npc.say('Take more care of these this time around.');
            }

            return END;
        }
    },
    germinated: {
        npc: [
            'Great Bwana, now go plant them in the fertile soil.',
            'You should soon have a great Yommi tree worthy of a most marvelous',
            'totem pole.'
        ],
        menu: [['Where do I plant the seeds?', 'wherePlant'], ok()]
    },
    wherePlant: {
        npc: [
            'Above ground and spaced out througout the whole jungle area',
            'are specially cultivated ferteile soil areas.',
            'Seek one out and plant the Yommi tree in that...',
            'be prepared to water it though...'
        ],
        menu: [['I have germinated the seeds.', 'germinated'], ok()]
    },
    getOut: {
        run: async ({ player, npc }) => {
            if (holds(player, ITEM.MAGICAL_FIRE_PASS)) {
                await npc.say(
                    'Just use the Magical Fire Pass that I gave you to',
                    'get past the flames...',
                    'Then you should be able to find your way out through',
                    'the cave entrance that you came in.'
                );
            } else {
                await npc.say('Well, the way you came, but here...');
                await mes(player, 'The Shaman scrawls a some strange markings onto a piece of paper.', 2);
                give(player, ITEM.MAGICAL_FIRE_PASS);
                player.message('He hands the paper to you...');
                await npc.say('This will allow you to pass the fire without harm in future.');
            }
        },
        menu: [
            ['I need to collect some Yommi tree seeds for Gujuo.', 'collectSeeds'],
            ['What will you do now?', 'whatWillYouDo'],
            ok()
        ]
    },
    whatWillYouDo: {
        npc: [
            'I will remain here in the protection of the flaming Octagram',
            'and continue my research into the spirit world...',
            'I am somewhat of an authority with my recent experience!',
            'But do remember me from time to time and come to visit an old man.',
            'You never know, I may be able to help in you in the future.',
            'And repay you the favour of releasing me from that terrible Demon...'
        ],
        menu: [
            ['I need to collect some Yommi tree seeds for Gujuo.', 'collectSeeds'],
            ['How do I get out of here?', 'getOut'],
            ok()
        ]
    },
    collectSeeds: {
        run: async ({ player, npc }) => {
            if (!holds(player, ITEM.YOMMI_TREE_SEED)) {
                await npc.say(
                    'Oh, yes, Bwana...you will be doing a great favour to our people',
                    'by doing this..however, you must know that it is a difficult task.',
                    'the Yommi tree is difficult to grow. You must have a natural ability',
                    'with such things to have a chance...'
                );
                await mes(player, 'The Shaman holds out his gnarly old hand and reveals three largish green seeds.', 2);
                await npc.say(
                    'Here you go...',
                    'Accept these with my gratitude...',
                    "You'll need to soak them in pure water before planting them.",
                    'I notice that you are already familiar with it ',
                    'to have passed the flaming Octagram.'
                );
                give(player, ITEM.YOMMI_TREE_SEED, 3);

                return 'collectMenu';
            }

            await npc.say('You already have some Yommi tree seeds, use those first..', 'and let me know how you get along.');

            return 'collectMenuShort';
        }
    },
    collectMenu: {
        menu: [['How do I grow the Yommi tree.', 'howGrow'], ['What do you know about the pure water.', 'aboutPure'], ok()]
    },
    collectMenuShort: {
        menu: [['How do I grow the Yommi tree.', 'howGrow'], ['What do you know about the pure water.', 'aboutPure']]
    },
    howGrow: {
        npc: [
            'A good question Bwana...but it is essentially quite simple.',
            'First you will need to soak the seeds in some pure water...',
            'This will help to geminate the seed and begin the growing process.',
            'The Yommi tree is sacred and is also slightly magical.',
            'You need to seek out a patch of fertile earth. ',
            'Such places are located around the jungle and should give ',
            'the Yommi tree a good chance of survival.',
            'The tree should show some remarkable growth quite early',
            'But will slow down, you may be able to speed the process up ',
            'by watering the tree with more pure water, although',
            'it can be difficult to find it.'
        ],
        menu: [['What will you do now?', 'whatWillYouDo'], ['What do you know about the pure water.', 'aboutPure'], ok()]
    },
    aboutPure: {
        npc: [
            'Hmmm, the pure water is sacred to us.',
            'It is from a sacred spring which is fed from deep underground.',
            'It is said that the spring is protected by spirits of long ',
            'dead adventurers who went in search of the springs source..',
            'But it is likely a myth and the source of the spring is buried',
            'deep in the ground with no chance of access.'
        ],
        menu: [['What will you do now?', 'whatWillYouDo'], ['How do I get out of here?', 'getOut'], ok()]
    },
    madeTotem: {
        npc: [
            "This is great news Bwana, you've done really well.",
            'Perhaps we can start to rally our people together now.',
            'And live once again without fear in the jungle.'
        ],
        menu: [["I'm not sure what to do with the Totem pole.", 'whatTotem'], ok()]
    },
    whatTotem: {
        npc: [
            'Well, Bwana, you can simply replace the corrupted totem',
            'pole with the good one you have created.',
            'This will make my people very happy.'
        ],
        menu: [["I've already made the totem pole.", 'madeTotem'], ok()]
    },
    killedDemonAgain: {
        npc: [
            'If you have killed him for the third time,',
            'then you have banished him from our world completely.',
            'This is indeed a legendary accomplishment Bwana,',
            'you should feel proud.'
        ],
        menu: [["I've replaced the evil Totem pole.", 'replacedTotem'], ok()]
    },
    replacedTotem: {
        npc: [
            'Many thanks Bwana, my people are truly grateful.',
            'Have you seen Gujuo, I am sure that he may have something',
            'for you as a token of our appreciation.'
        ],
        menu: [["I've killed Nezikchened the Demon again.", 'killedDemonAgain'], ok()]
    }
};

// the stage-specific first words (ungaduluTalkToDialogue with cID -1)
async function ungaduluTalk(player, npc) {
    const stage = stageOf(player);
    const start = (menu) => runGraph(player, npc, { ...NODES, start: { menu } }, 'start');

    switch (stage) {
        case 2:
        case 3: {
            await npc.say('Please run for your life...');
            await mes(player, 'The Shaman seems to be fighting an inner battle.', 2);
            await npc.say('Go...go now...!');

            const evil = changeNpc(player, npc, NPC.EVIL_UNGADULU);

            await mes(player, 'The Shaman seems to change in front of your eyes...', 2);
            await evilUngadulu(player, evil);
            return;
        }
        case 4:
            await npc.say(
                'Greetings bwana...many thanks for defeating the demon...',
                'and releasing me from this dreadful possesion...',
                'Pray tell me, what can I do to repay this great favour?'
            );
            return start([
                ['I need to collect some Yommi tree seeds for Gujuo.', 'collectSeeds'],
                ['How do I get out of here?', 'getOut'],
                ok()
            ]);
        case 5:
            await npc.say('Hello Bwana, how goes your quest with the Yommi tree?');
            return start([
                ['I have germinated the seeds.', 'germinated'],
                ['Where do I plant the seeds?', 'wherePlant'],
                ['I need more Yommi tree seeds.', 'moreSeeds']
            ]);
        case 6:
            await npc.say('Hello Bwana, how goes your quest with the Yommi tree?');
            return start([
                ['The magic pool has dried up and I need some more pure water.', 'poolDriedUp'],
                ['Where can I get more pure water?', 'morePure'],
                ['I need more Yommi tree seeds.', 'moreSeeds']
            ]);
        case 7:
            await npc.say('Hello Bwana, how goes your quest to find the water ?');

            if (cacheHas(player, 'met_spirit') && cacheHas(player, 'killed_viyeldi')) {
                return start([
                    ['I have killed Viyeldi!', 'killedViyeldi'],
                    ['I met a spirit in the Viyeldi Caves.', 'metSpirit'],
                    ['The spirit told me to kill Viyeldi.', 'toldToKill'],
                    ['Do you know anything about daggers?', 'daggers'],
                    ['I need more Yommi tree seeds.', 'moreSeeds']
                ]);
            }

            if (cacheHas(player, 'met_spirit')) {
                return start([
                    ['I met a spirit in the Viyeldi Caves.', 'metSpirit'],
                    ['The spirit told me to kill Viyeldi.', 'toldToKill'],
                    ['Do you know anything about daggers?', 'daggers'],
                    ['I need more Yommi tree seeds.', 'moreSeeds'],
                    ok()
                ]);
            }

            return start([
                ['I am on a quest to get more pure water.', 'questMoreWater'],
                ['What do you know about the source of the sacred water?', 'sourceKnow'],
                ['I need more Yommi tree seeds.', 'moreSeeds']
            ]);
        case 8:
            if (!cacheHas(player, 'crafted_totem_pole')) {
                await mes(player, 'You approach Ungadulu...', 2);
                await npc.say(
                    'Blessings on you Bwana.',
                    'Did you use the spell and kill the spirit?',
                    'Do you have the sacred water yet?'
                );
                await mes(player, 'The Shaman looks so excited about seeing you that he is about to burst.', 2);
                return start([
                    ["Yes, I've killed the Spirit.", 'killedSpirit'],
                    ["Yes, I've got the water.", 'gotWater'],
                    ['I need more Yommi tree seeds.', 'moreSeeds']
                ]);
            }

            if (!holds(player, ITEM.TOTEM_POLE) && !holds(player, ITEM.YOMMI_TREE_SEED)) {
                await npc.say('I see you have no totem pole, or Yommi tree seeds, is everything Ok?');

                if ((await player.ask(["Yes, everything's fine.", 'I need more Yommi tree seeds.'], true)) === 1) {
                    return runGraph(player, npc, NODES, 'moreSeeds');
                }
            }

            await npc.say('Your Legendary exploits are travelling the whole jungle.', 'How goes your quest to grow the sacred Yommi tree ?');
            return start([["I've already made the totem pole.", 'madeTotem'], ["I'm not sure what to do with the Totem pole.", 'whatTotem'], ok()]);
        case 9:
            await npc.say('Your Legendary exploits are travelling the whole jungle.', 'How goes your quest to grow the sacred Yommi tree ?');
            return start([
                ["I've killed Nezikchened the Demon again.", 'killedDemonAgain'],
                ["I've replaced the evil Totem pole.", 'replacedTotem'],
                ok()
            ]);
        case 10:
        case 11:
        case -1:
            return npc.say(
                'Your Legendary exploits are travelling the whole jungle.',
                'Gujuo has been to see me. ',
                'He told me that you have been given a sacred totem pole.',
                'It was constructed by one of my ancestors many moons ago.',
                'It is a noble prize Bwana, you have earned it,',
                'look after it well.'
            );
        default:
            return undefined;
    }
}

// ungaduluWallDialogue: the Shaman speaks through the flames
const WALL = {
    extinguish: {
        run: async ({ player, npc }) => {
            await npc.say('Please don\'t try to extinguish...');

            const evil = changeNpc(player, npc, NPC.EVIL_UNGADULU);

            await evil.say('Yes, douse the flames with water, pure water...foo...');
            await player.world.sleepTicks(1);

            const good = changeNpc(player, evil, NPC.UNGADULU);

            await good.say("Please, leave now...don't listen to me...", "I beg you,leave now, don't touch the flames...");

            return 'afterExtinguish';
        }
    },
    afterExtinguish: {
        menu: [['Where do I get pure water from ?', 'whereWater'], ['Who are you?', 'whoAreYou']]
    },
    whoAreYou: {
        run: async ({ player, npc }) => {
            await npc.say('I am Ungadulu,trapped here many years now...', 'Leave these caves and save yourself...');

            const evil = changeNpc(player, npc, NPC.EVIL_UNGADULU);

            await evil.say('Wait...get pure water from the pool...above lands...');
            await player.world.sleepTicks(1);

            const good = changeNpc(player, evil, NPC.UNGADULU);

            await good.say('Please Bwana, don\'t listen to me...run, save yourself...');

            return 'afterWho';
        }
    },
    afterWho: {
        menu: [['How can I extinguish the flames?', 'extinguish'], ['Where do I get pure water from ?', 'whereWater']]
    },
    whereWater: {
        run: async ({ player, npc }) => {
            await npc.say('Please, leave now...');

            let current = changeNpc(player, npc, NPC.EVIL_UNGADULU);

            await current.say('...from the above lands...hurry and release me...');
            current = changeNpc(player, current, NPC.UNGADULU);
            await current.say('Leave here, please, go...now...');
            current = changeNpc(player, current, NPC.EVIL_UNGADULU);
            await current.say('Hurry, Vacu, the heat kills me...ha ha ha');
            current = changeNpc(player, current, NPC.UNGADULU);
            player.message('The Shaman throws himself down on the floor and starts shaking.');

            if (stageOf(player) === 2) {
                player.questStages.legendsQuest = 3;
            }

            return END;
        }
    }
};

async function ungaduluWallDialogue(player, npc) {
    const stage = stageOf(player);

    if (stage === 2 || stage === 3) {
        player.message('You see a white robed figure gesturing to you.');
        await npc.say('Please come no closer...the flames will incinerate you.');
        await runGraph(player, npc, {
            ...WALL,
            start: { menu: [['How can I extinguish the flames?', 'extinguish'], ['Who are you?', 'whoAreYou']] }
        }, 'start');
    } else if (stage !== 0 && stage !== 1) {
        await ungaduluTalk(player, npc);
    }
}

// ---- hooks ---------------------------------------------------------------------------------------------------------------------

async function onTalkToNPC(player, npc) {
    if (npc.id !== NPC.UNGADULU && npc.id !== NPC.EVIL_UNGADULU) {
        return false;
    }

    player.engage(npc);

    try {
        if (npc.id === NPC.UNGADULU) {
            await ungaduluTalk(player, npc);
        } else {
            await evilUngadulu(player, npc);
        }
    } finally {
        player.disengage();
    }

    return true;
}

// onAttackNpc / onPlayerRangeNpc / onSpellNpc
async function attackedUngadulu(player, npc, byMelee) {
    if (npc.id === NPC.UNGADULU) {
        player.message('You feel a strange force coming over you...');
        player.message('You feel weakened....');
        setLevel(player, 'attack', 0);
        setLevel(player, 'strength', 0);

        if (!byMelee) {
            player.message('The spell fizzles and dies...');
            player.message('Some sort of magical effect seems to be protecting the Shaman.');
            return;
        }

        if (stageOf(player) >= 9 || stageOf(player) === -1) {
            await mes(player, 'The Shaman casts a debilitating spell on you..', 2);
            await mes(player, "You're sent reeling backwards through the flames..", 2);
            player.teleport(454, 3702);
            hurt(player, 5);
            await npc.say('Think twice in future before attacking me..');
            await player.say('Ughhh!');
            return;
        }

        startFight(player, npc);
        return;
    }

    player.message('A strange power stops you from attacking the Shaman.');
    await evilUngadulu(player, npc);
}

async function onNPCAttack(player, npc) {
    if (npc.id !== NPC.UNGADULU && npc.id !== NPC.EVIL_UNGADULU) {
        return false;
    }

    player.engage(npc);

    try {
        await attackedUngadulu(player, npc, true);
    } finally {
        player.disengage();
    }

    return true;
}

async function onNPCRangedAttack(player, npc) {
    if (npc.id !== NPC.UNGADULU && npc.id !== NPC.EVIL_UNGADULU) {
        return false;
    }

    await attackedUngadulu(player, npc, true);

    return true;
}

async function onCastOnNPC(player, npc) {
    if (npc.id !== NPC.UNGADULU && npc.id !== NPC.EVIL_UNGADULU) {
        return false;
    }

    await attackedUngadulu(player, npc, false);

    return true;
}

// onEscapeNpc: the player runs from the Shaman
async function onNPCEscape(player, npc) {
    if (npc.id !== NPC.UNGADULU) {
        return false;
    }

    npc.abandonFight();
    await player.world.sleepTicks(1);
    await npc.say('Run then....run away....', 'Save yourself....');
    setLevel(player, 'attack', baseLevel(player, 'attack') - 19 + level(player, 'attack'));
    setLevel(player, 'strength', baseLevel(player, 'strength') - 19 + level(player, 'strength'));
    player.message('Strangely, you start to feel better.');

    return true;
}

async function onUseWithNPC(player, npc, item) {
    if (npc.id !== NPC.UNGADULU) {
        return false;
    }

    if (item.id === ITEM.DARK_DAGGER) {
        player.engage(npc);

        try {
            await mes(player, 'You hand the dagger over to the Shaman.', 2);
            await mes(player, "The Shaman's face turns pale...", 2);

            if (cacheHas(player, 'killed_viyeldi')) {
                await npc.say(
                    'Oh dear Bwana, I sense something terrible has happened.',
                    'This dagger is a portent of some evil action...',
                    'Please, reveal to me anything that you have done',
                    'so that I might understand this better.'
                );

                if ((await player.ask(["I've killed Viyeldi.", "Er, I can't think of anything."], true)) === 0) {
                    await npc.say(
                        "Poor Viyeldi',",
                        'He was the guardian of the dead hero\'s that protected the source.',
                        'Their tormented spirits will now be at the beck and',
                        'call of the one who gave you the dagger.'
                    );

                    if (holds(player, ITEM.HOLY_FORCE_SPELL)) {
                        await npc.say(
                            'Take the Holy Force spell I gave you and pray that you',
                            "can defeat this spirit before it's too late."
                        );
                    } else {
                        give(player, ITEM.HOLY_FORCE_SPELL);
                        await mes(player, 'The wizened old Shaman hands over a piece of paper.', 2);
                        await npc.say(
                            'Take this spell and pray that you can defeat',
                            "this evil spirit before it's too late.",
                            'The spell will force the spirit to reveal its true self.',
                            'And it will also be vulerable to normal attacks.'
                        );
                    }
                } else {
                    await npc.say('Well, that is strange...', 'I sense a growing evil power since you visited the caves.');
                    player.message('The Wizened old Shaman mutters to himself and wanders off.');
                }

                return true;
            }

            await npc.say(
                'This dagger has been made for one purpose only...',
                'Praise the gods that you brought it to me.',
                'I can make you a spell with this item which will force the spirit',
                'to reveal its true self.',
                'Once activated, you will be able to attack it like',
                'a normal creature.'
            );
            take(player, ITEM.DARK_DAGGER);
            give(player, ITEM.HOLY_FORCE_SPELL);
            await mes(player, 'The Shaman takes the dagger and gives you a folded piece of paper.', 2);
            await npc.say(
                'Use this spell on the Spirit.',
                "It will force the spirit to show it's true self.",
                'And it will also be vulerable to normal attacks.'
            );
        } finally {
            player.disengage();
        }

        return true;
    }

    if (item.id === ITEM.GLOWING_DARK_DAGGER) {
        player.engage(npc);

        try {
            await mes(player, 'You hand the dagger over to the Shaman.', 2);
            await mes(player, "The Shaman's face turns pale...", 2);
            await npc.say(
                'Oh dear Bwana.',
                "Poor Viyeldi's spirit is trapped inside this weapon.",
                'No doubt the evil spirit that told you to kill Viyeldi,',
                'is planning to use it for some vile purpose.',
                "I will try to release Viyeldi's spirit from the dagger.",
                'Here, you take this spell...'
            );
            take(player, ITEM.GLOWING_DARK_DAGGER);
            give(player, ITEM.HOLY_FORCE_SPELL);
            await mes(player, 'The Shaman takes the dagger and gives you a folded piece of paper.', 2);
            await npc.say(
                'Use this spell on the Spirit.',
                "It will force the spirit to show it's true self.",
                'And it will also be vulerable to normal attacks.'
            );
        } finally {
            player.disengage();
        }

        return true;
    }

    if (item.id === ITEM.BOOKING_OF_BINDING) {
        if (stageOf(player) === 3) {
            await mes(player, 'You open the book of binding in front of Ungadulu.', 3);
            await mes(player, 'A blinding light fills the room...', 2);
            await mes(player, 'A supernatural light falls on Ungadulu...', 2);
            await mes(player, 'And a mighty demon forms in front of you...', 2);

            const nez = spawnNpc(player, NPC.NEZIKCHENED, npc.x, npc.y, 500000);

            nez.spawnedFor = player;
            await nez.say('Curse you foul intruder...your faith will help you little here.');
            startFight(player, nez);
            setLevel(player, 'prayer', Math.ceil(level(player, 'prayer') / 4));
            await mes(player, 'A sense of hopelessness fills your body...', 2);
            await nez.say("'Ere near to death ye comes now that ye has meddled in my dealings..");

            if (cacheHas(player, 'holy_water_neiz')) {
                player.message('The holy water starts smoking on the Demons skin...');
                await nez.say('Ahhhrhhhhhghhhh...it burns.....');

                for (const skill of ['attack', 'defense', 'strength']) {
                    const current = nez.skills[skill].current;

                    nez.skills[skill].current = current - Math.trunc(current * 0.15);
                }
            }
        } else {
            player.engage(npc);

            try {
                await npc.say("Ha, ha ha! There's no need to use that on me any more...", "I'm cured now, remember...");
            } finally {
                player.disengage();
            }
        }

        return true;
    }

    return false;
}

module.exports = {
    onTalkToNPC,
    onNPCAttack,
    onNPCRangedAttack,
    onCastOnNPC,
    onNPCEscape,
    onUseWithNPC,
    ungaduluWallDialogue,
    ungaduluTalk,
    evilUngadulu,
    NODES,
    nearNpc
};
