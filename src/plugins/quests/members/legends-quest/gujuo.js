// Ported from Open-RSC Core-Framework authentic/quests/members/legendsquest/npcs/LegendsQuestGujuo.java (AGPL-3.0): Gujuo (764), the
// Kharazi native the bull roarer calls, and the golden bowl blessing. The Java's `GujuoDialogue(player, n, cID)` switch is the node
// table below (ids are the Gujuo.* constants in lower camel case). Stage map: shared.js.

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
    takeAll,
    level,
    setLevel,
    random,
    nextInt,
    failCalculation,
    runGraph,
    removeNpc,
    moveNpc
} = require('./shared');

// ---- how Gujuo leaves --------------------------------------------------------------------------------------------------------

const BYE_LINES = [
    'I am tired Bwana, I must go and rest...',
    'I must visit my people now...',
    'I must go and hunt now Bwana..',
    'I have to collect herbs now Bwana...'
];

// gujuoBye: a parting line, and after three ticks he is gone into the jungle (the Java's if-chain also fires its last else
// after a roll of 0, 1 and 2: "I have work to do" follows those)
async function gujuoBye(player, npc) {
    const yell = random(0, 3);

    if (yell === 0) {
        await npc.say(BYE_LINES[0]);
    }

    if (yell === 1) {
        await npc.say(BYE_LINES[1]);
    } else if (yell === 2) {
        await npc.say(BYE_LINES[2]);
    } else if (yell === 3) {
        await npc.say(BYE_LINES[3]);
    } else {
        await npc.say('I have work to do Bwana, I may see you again...');
    }

    await npc.say('');
    player.world.setTickTimeout(() => {
        if (player.loggedIn !== false) {
            player.message('Gujuo disapears into the Kharazi jungle as swiftly as he appeared...');
        }

        removeNpc(player, npc);
    }, 3);
}

// ---- blessing the bowl ---------------------------------------------------------------------------------------------------------

async function blessBowl(player, npc) {
    if (level(player, 'prayer') < 42) {
        await npc.say('Bwana, I am very sorry,', 'But you are too inexperienced to bless this bowl.');
        player.message('You need a prayer ability of 42 to complete this task.');
        return 'howGoes';
    }

    await npc.say('Very well Bwana...');
    await mes(player, 'Gujuo places the bowl on the floor in front of you,', 2);
    await mes(player, 'and leads you into a deep meditation...', 3);
    await npc.say('Ohhhhhmmmmmm');
    await player.say('Oooooommmmmmmmmm');
    await npc.say('Ohhhhhmmmmmm');
    await player.say('Oooooohhhhmmmmmmmmmm');
    await npc.say('Ohhhhhmmmmmm');

    if (failCalculation(player, 'prayer', 42)) {
        await mes(player, 'A totally peacefull aura surrounds you and you ', 2);
        await mes(player, 'bring down the blessings of your god on the bowl.', 2);

        const swaps = [
            [ITEM.GOLDEN_BOWL, ITEM.BLESSED_GOLDEN_BOWL],
            [ITEM.GOLDEN_BOWL_WITH_PURE_WATER, ITEM.BLESSED_GOLDEN_BOWL_WITH_PURE_WATER],
            [ITEM.GOLDEN_BOWL_WITH_PLAIN_WATER, ITEM.BLESSED_GOLDEN_BOWL_WITH_PLAIN_WATER]
        ];

        for (const [from, to] of swaps) {
            if (holds(player, from)) {
                take(player, from);
                give(player, to);
                break;
            }
        }

        return 'howGoes';
    }

    await mes(player, 'You were not able to go into a deep enough trance.', 2);
    await mes(player, 'You lose some prayer...', 2);
    setLevel(player, 'prayer', level(player, 'prayer') - 5);
    await npc.say('Would you like to try again.');

    const fail = await player.ask(["Yes, I'd like to bless my golden bowl.", "No thanks, I'll wait."]);

    if (fail === 0) {
        return 'blessTheBowl';
    }

    await player.say("No thanks, I'll wait.");
    await npc.say('Very well, let me know when you want to try?');

    return 'howGoes';
}

// ---- the conversation graph ----------------------------------------------------------------------------------------------------

const ok = () => ['Ok thanks for your help.', 'okThanks'];

const NODES = {
    okThanks: {
        npc: ['You are more than welcome bwana...'],
        run: async ({ player, npc }) => {
            await gujuoBye(player, npc);
            return END;
        }
    },
    blessTheBowl: { run: ({ player, npc }) => blessBowl(player, npc) },
    sorryItWasAMistake: {
        npc: ['Very good Bwana...however, it begs the question...', 'What are you doing in the Kharazi jungle'],
        menu: [
            ['I want to develop friendly relations with your people.', 'friendlyRelations'],
            ["I'm lost, can you show me the way out?", 'imLost']
        ]
    },
    imLost: {
        npc: ['Yes Bwana...', 'I can take you to the edge of the Kharazi jungle.', 'Would you like me to take you?'],
        menu: [
            [
                'Yes Please...',
                async ({ player, npc }) => {
                    await npc.say('Follow me...');
                    await mes(player, 'Gujuo takes you out of the jungle...', 2);
                    player.teleport(397, 865);
                    moveNpc(npc, 398, 865);
                    await player.world.sleepTicks(1);
                    await npc.say('');
                    await mes(player, 'Gujuo disapears into the Kharazi jungle as swiftly as he appeared...', 3);
                    removeNpc(player, npc);
                    return END;
                }
            ],
            ['No thanks...', 'noThanks']
        ]
    },
    noThanks: {
        npc: ['As you wish...', 'Again, Bwana, What is it that brings you to the Kharazi jungle?'],
        menu: [
            ['I want to develop friendly relations with your people.', 'friendlyRelations'],
            ["I'm lost, can you show me the way out?", 'imLost']
        ]
    },
    friendlyRelations: {
        run: async ({ player, npc }) => {
            await mes(player, 'Gujuo smiles and shakes your hand warmly...', 2);
            await npc.say(
                'Very good Bwana...this is indeed a very pleasant gesture.',
                'However, my people are very distributed throughout the Kharazi jungle.'
            );

            const opt5 = await player.ask(['Can you get your people together ?', "I'm lost, can you show me the way out?"], true);

            if (opt5 === 1) {
                return 'imLost';
            }

            await npc.say(
                'All of my people normally congregate around a totem pole, ',
                'But ours has been polluted by an evil spirit.',
                'It has been transformed, ',
                'and now our people are afraid to approach it...',
                'We tried to drive the evil spirit out of the totem pole,',
                'but it does not seem to work.'
            );

            const opt6 = await player.ask(['What can we do instead then?', "I'm lost, can you show me the way out?"], true);

            if (opt6 === 1) {
                return 'imLost';
            }

            await npc.say(
                'We could try to make a new totem pole.',
                'However, we need to make it from the trunk of the ',
                'sacred Yommi tree. '
            );

            const opt7 = await player.ask(['How do we make the totem pole?', "I'm lost, can you show me the way out?"]);

            if (opt7 === 1) {
                await player.say("I'm lost, can you show me the way out?");
                return 'imLost';
            }

            await player.say('How do we make a totem pole?');
            await npc.say(
                'First we need to plant a sacred Yommi tree..',
                'It is a magical tree of great power, however, our Shaman..',
                'Ungadulu is the only person with the seeds for this tree.'
            );
            await mes(player, "Gujuo's expression changes to sadness...", 2);
            await npc.say(
                'And I fear that it is impossible to get some seeds.',
                'He is being held against his will in some caves in ',
                'north western part of the Kharazi jungle.'
            );

            const opt8 = await player.ask(['I will release Ungadulu...', 'Oh well, sorry to hear about that ?'], true);

            if (opt8 === 0) {
                return 'willReleaseUngadulu';
            }

            await mes(player, "Gujuo's expression of sadness deepens...", 2);
            await npc.say(
                'Yes Bwana, perhaps we will become friends sometime in the future...',
                'But not today...',
                'Ungadulu has problably lost his mind anyway... ',
                'it is most likely a lost cause...'
            );

            const opt9 = await player.ask(['I will release Ungadulu...', 'Ok thanks for your help.'], true);

            return opt9 === 0 ? 'willReleaseUngadulu' : 'okThanks';
        }
    },
    willReleaseUngadulu: {
        npc: [
            'You make me very happy Bwana...',
            'In the North western part of this Kharazi jungle area, near some great cliffs.',
            'You will find three rocks that form a triangle shape.',
            'They are flanked by the palm which also forms the divine geometry',
            'You will find that they cover a small entrance...',
            'That is where Ungadulu is being kept,',
            'If you can free him, he will entrust to you some of the sacred Yommi tree seeds.'
        ],
        run: async ({ player, npc }) => {
            cacheSet(player, 'legends_cavern');
            await gujuoBye(player, npc);
            return END;
        }
    },
    // ---- stage 3: the bowl, the flames
    howGoes: {
        npc: ['How goes your quest to release Ungadulu Bwana?'],
        menu: [
            ['Ungadulu looks strange.', 'ungaduluLooksStrange'],
            ['I need to douse some flames with pure water.', 'douseFlames'],
            ["Ungadulu called me 'Vacu', what does that mean?", 'calledMeVacu'],
            ok()
        ]
    },
    ungaduluLooksStrange: {
        npc: ['Be wary Bwana.', 'There are many unknown spirits that reside in these dark areas.', 'You may be tricked by an unknown force...'],
        menu: [
            ['I need to douse some flames with pure water.', 'douseFlames'],
            ['What kind of unknown forces...', 'unknownForces'],
            ok()
        ]
    },
    calledMeVacu: {
        run: async ({ player, npc }) => {
            await mes(player, 'Gujuo shakes his head slightly in sadness.', 2);
            await npc.say(
                'It seems that Ungadulu has started to lose his senses.',
                'In our native and ancient history, ',
                'the Vacu were the servants of the evil spirits from the underworld.',
                'Originally they were priests who had summoned spirits of our ancestors,',
                'but they were enslaved...along with the rest of the village.',
                'But this is ancient history and is most likely a myth,',
                'a story told to frighten poorly behaved children...'
            );
        },
        menu: [
            ['Ungadulu looks strange.', 'ungaduluLooksStrange'],
            ['I need to douse some flames with pure water.', 'douseFlames'],
            ok()
        ]
    },
    unknownForces: {
        npc: [
            'Strange spirits that our forefathers summoned for visions.',
            'They haunt the underworld and caves that exist in this area.',
            'Take not anything as it might first appear.'
        ],
        menu: [
            ['I need to douse some flames with pure water.', 'douseFlames'],
            ['How did they summon the spirits?', 'howSummon'],
            ok()
        ]
    },
    howSummon: {
        npc: [
            'I am unlearned in such matters.',
            'But I am told of sacred patterns that are scored on the ground',
            'to bind the spirit and confine it...',
            'But that is all I know.'
        ],
        menu: [
            ['Ungadulu looks strange.', 'ungaduluLooksStrange'],
            ['I need to douse some flames with pure water.', 'douseFlames'],
            ok()
        ]
    },
    douseFlames: {
        npc: [
            'This sounds very strange Bwana...but maybe I can help.',
            'There is a pool of water that is sacred to us...',
            'It is located in the middle of the Kharazi jungle ',
            'The water contains special properties but it can only',
            'be contained in a blessed vessel made from metal of the sun.',
            'The water is difficult to get to, ',
            'but I am sure you will manage to claim some.'
        ],
        menu: [
            ['Metal of the sun, what is that?', 'metalOfSun'],
            ['Ungadulu looks strange.', 'ungaduluLooksStrange'],
            ['What kind of a vessel?', 'kindOfVessel'],
            ok()
        ]
    },
    kindOfVessel: {
        npc: ['A vessel made of sun metal, but it can be of any shape.', 'However, it must be blessed.'],
        run: async ({ player, npc }) => {
            if (!holds(player, ITEM.ROUGH_SKETCH_OF_A_BOWL)) {
                await mes(player, 'Gujuo takes out a small scroll and some charcoal and draws a rough sketch.', 2);
                await mes(player, 'When he has finished, he gives the sketch to you.', 2);
                give(player, ITEM.ROUGH_SKETCH_OF_A_BOWL);
                await npc.say('Here, have this as an example...I pray that it will help you.');
            } else {
                await npc.say('Similar to the picture I have already given you.');
            }
        },
        menu: [
            ['Ungadulu looks strange.', 'ungaduluLooksStrange'],
            ['I need to douse some flames with pure water.', 'douseFlames'],
            ['How do I bless the bowl.', 'howBless'],
            ok()
        ]
    },
    metalOfSun: {
        npc: [
            'It is a bright and precious metal that is very rare.',
            'It is the same glorious colour as the sun and it never loses',
            "it's wonderous lustre...",
            'A blessed vessel made of this metal protects the purity of the water.'
        ],
        menu: [
            ['Where can I find this metal?', 'whereMetal'],
            ['What kind of a vessel?', 'kindOfVessel'],
            ok()
        ]
    },
    howBless: {
        npc: [
            'When you have made a bowl, bring it to me and I will help.',
            'But you need to ensure that you are devout and have faith.',
            'Your ability in prayer will be thoroughly tested.'
        ],
        menu: [
            ['Ungadulu looks strange.', 'ungaduluLooksStrange'],
            ['I need to douse some flames with pure water.', 'douseFlames'],
            ['What kind of a vessel?', 'kindOfVessel'],
            ok()
        ]
    },
    whereMetal: {
        npc: [
            'It is found in some rocks and must be extracted.',
            'It has a magical ability over some men and women, it can posess them.',
            'They fall within it\'s power and seek to gain more and more of this',
            'precious metal for themselves.',
            'A blessed vessel made of this metal protects the purity of the water.'
        ],
        menu: [
            ['Metal of the sun, what is that?', 'metalOfSun'],
            ['Ungadulu looks strange.', 'ungaduluLooksStrange'],
            ['What kind of a vessel?', 'kindOfVessel'],
            ok()
        ]
    },
    notSure: {
        npc: ["Don't you need to take some pure water down to the caves?", "If you haven't got the water yet, try getting some from the pool."],
        menu: [['Can you help me?', 'canYouHelp'], ok()]
    },
    canYouHelp: {
        npc: ['I am sorry Bwana, but I have no experience of these things.', 'I am sure that I would get in your way...'],
        menu: [["I'm not sure what to do?", 'notSure'], ok()]
    },
    // ---- stage 4: the seeds
    ungaduluIsFree: {
        npc: ['You are indeed brave Bwana, a truly fearsome warrior to take on ', 'Such an enemy! Well Done!'],
        menu: [
            ['I have the Yommi tree seeds.', 'haveSeeds'],
            ['What do I do now?', 'whatNow'],
            ok()
        ]
    },
    haveSeeds: {
        run: async ({ player, npc }) => {
            if (holds(player, ITEM.YOMMI_TREE_SEED)) {
                await npc.say(
                    "That's great Bwana. Now you just need to germinate ",
                    'the seeds and then plant them in some fertile soil.',
                    "I'm sure that Ungadulu has explained all this to you already."
                );
                return 'haveSeedsMenu';
            }

            await npc.say("Hmmm, well I don't see them...", 'Why not go and see Ungadulu and see if you can get some more.');
            return END;
        }
    },
    haveSeedsMenu: {
        menu: [
            ['Ungadulu is free, he was possesed by a demon and I killed it.', 'ungaduluIsFree'],
            ['What do I do now?', 'whatNow'],
            ok()
        ]
    },
    whatNow: {
        npc: [
            'If you have the Yommi tree seeds, you will need to germinate them.',
            'You need to place the seeds into pure water.',
            'And they will begin to sprout tiny shoots...',
            'You can then plant them in fertile soil.'
        ],
        menu: [
            ['Ungadulu is free, he was possesed by a demon and I killed it.', 'ungaduluIsFree'],
            ['I have the Yommi tree seeds.', 'haveSeeds'],
            ok()
        ]
    },
    // ---- stage 5: planting
    germinated: {
        npc: [
            'Well done Bwana,',
            'With the blessings of the gods we will soon have our Totem Pole.',
            'Bwana, you now need to plant the seed in the fertile earth.'
        ],
        menu: [['Where is the fertile soil.', 'fertileSoil'], ok()]
    },
    fertileSoil: {
        npc: [
            'You should be able to find many places where the ',
            'ground is fertile in the Kharazi Jungle.',
            'Planting the Yommi tree seeds in fertile soil gives it a good ',
            'chance to grow. My people are trying to grow the Yommi tree as well.',
            'But so far we have not met with any success.',
            'If you find a rotten tree or what looks like a rotten totem pole.',
            "You'll need to remove it yourself to get to the fertile soil.",
            'It will take a very sharp, robust axe to do it.'
        ],
        menu: [['I have germinated the Yommi tree seeds.', 'germinated'], ok()]
    },
    // ---- stage 6: the pool has dried up
    poolDried: {
        npc: [
            'This is indeed a bad omen Bwana, that pool is sacred to us...',
            'I have seen it and it is full of filth, it is not natural...',
            'I suspect that some evil is at work here.'
        ],
        menu: [
            ['Does the Yommi tree have to have pure water?', 'treeNeedsWater'],
            ['Where is the source of the spring of pure water ?', 'sourceFirst']
        ]
    },
    treeDied: {
        npc: ['Well, it requires pure sacred water for it to grow.', 'It is a very special tree...'],
        menu: [
            ['The sacred water pool has dried up and I need more water.', 'poolDried'],
            ['Does the Yommi tree have to have pure water?', 'treeNeedsWater']
        ]
    },
    treeNeedsWater: {
        npc: ['Yes, it is a magical tree and can only survive on the water ', 'from the sacred pool. This is indeed a tragedy...'],
        menu: [['Where is the source of the spring of pure water ?', 'sourceFirst'], ok()]
    },
    sourceFirst: {
        run: async ({ player, npc }) => {
            await sourceLines(player, npc);

            if (stageOf(player) === 6) {
                player.questStages.legendsQuest = 7;
            }
        },
        menu: [
            ["Ok, I won't go...", 'wontGo'],
            ['If I went, could you help me?', 'couldYouHelp'],
            ['I searched the catacombs thoroughly but found nothing else..', 'searchedCatacombs']
        ]
    },
    // ---- stage 7: the source
    source: {
        run: ({ player, npc }) => sourceLines(player, npc),
        menu: [
            ['If I went in search of the source, could you help me?', 'couldYouHelp'],
            ['I searched the catacombs thoroughly but found nothing else..', 'searchedCatacombs'],
            ok()
        ]
    },
    wontGo: {
        npc: [
            'I understand Bwana,',
            'It would be a waste of a perfectly good life.',
            'We will try to defeat the evil spirits in other ways ?',
            'But I am not sure how we will do that.'
        ],
        menu: [['If I went, could you help me?', 'couldYouHelp'], ok()]
    },
    moreWater: {
        npc: [
            'If the pool of sacred water has dried up,',
            'there may be a way to get to the source of the spring.',
            'But it is said to be very, very dangerous.'
        ],
        menu: [
            ['Where is the source of the spring of pure water ?', 'source'],
            ['If I went in search of the source, could you help me?', 'couldYouHelp'],
            ok()
        ]
    },
    searchedCatacombs: {
        npc: [
            'Perhaps the location has been hidden or buried under a rubble?',
            'These stories were told to me as a child by the village elders.',
            'They were probably meant to frighten us away from the caves.',
            'It could all just be a myth !',
            'You should perhaps talk to Ungadulu, he may know something ?',
            'Perhaps there is another way to get to the source of the stream?',
            'But I am not sure where it is...'
        ],
        say: false,
        menu: ({ player }) => [
            [
                'Where is the source of the spring of pure water ?',
                async ({ player: p }) => {
                    await p.say('Where is the source of the spring of pure water ?');
                    return 'source';
                }
            ],
            [
                cacheHas(player, 'gujuo_potion') ? 'If I went in search of the source, could you help me?' : 'If I went, could you help me?',
                async ({ player: p }) => {
                    await p.say('If I went, could you help me?');
                    return 'couldYouHelp';
                }
            ],
            [
                'Ok thanks for your help.',
                async ({ player: p }) => {
                    await p.say('Ok thanks for your help.');
                    return 'okThanks';
                }
            ]
        ]
    },
    couldYouHelp: {
        npc: [
            'Well, if you are sure you want to go.',
            'I will assist as much as I can.',
            'You will need the bravery of the Jungle lion,',
            'if you are to go into that forbidden place.',
            'I can give you the recipe for a potion to help with that.'
        ],
        run: async ({ player, npc }) => {
            if (cacheHas(player, 'gujuo_potion')) {
                await npc.say(
                    'You will need to find two herbs, Snake weed and ardrigal.',
                    'Add them both to a vial of water,',
                    'and you will walk with the bravery of the lion.'
                );
            } else {
                await npc.say(
                    'You will need to find two herbs, Snake weed and Ardrigal.',
                    'Add them both to a vial of water,',
                    'and you will walk with the bravery of the Kharazi lion.'
                );
            }
        },
        say: false,
        menu: [
            ['Where can I find Snake weed?', async ({ player }) => { await player.say('Where can I find Snake weed ?'); return 'snakeWeed'; }],
            ['Where is the source of the spring of pure water ?', async ({ player }) => { await player.say('Where is the source of the spring of pure water ?'); return 'source'; }],
            ['Where can I find ardrigal.', async ({ player }) => { await player.say('Where can I find ardrigal.'); return 'ardrigal'; }],
            ['Will I need this potion? I feel brave enough as I am.', async ({ player }) => { await player.say('Will I need this potion? I feel brave enough as I am.'); return 'needPotion'; }],
            ['Ok thanks for your help.', async ({ player }) => { await player.say('Ok thanks for your help.'); return 'okThanks'; }]
        ]
    },
    snakeWeed: {
        run: async ({ player, npc }) => {
            if (cacheHas(player, 'gujuo_potion')) {
                await npc.say(
                    'Snake weed is usually found by swampy marshy areas.',
                    'It is not very common and it may be quite difficult to find.',
                    'There is some marsh to the south of Tai Bwo Wannai village,',
                    'The herb grows near Jungle Vines, so check all around very carefully.'
                );
                return 'snakeWeedAfterPotion';
            }

            await npc.say(
                'Snake weed is usually found in swampy marshy areas.',
                'It is not very common and it may be quite difficult to find.',
                'There is some marsh to the South of Tai Bwo Wannai village.',
                'Near to where the river becomes the sea.',
                'The herb grows near Jungle Vines, so check all around very carefully.'
            );
            return 'snakeWeedNoPotion';
        }
    },
    snakeWeedAfterPotion: {
        menu: [
            ['Where can I find ardrigal.', 'ardrigal'],
            ['Where is the source of the spring of pure water ?', 'source'],
            ['If I went, could you help me ?', 'couldYouHelp'],
            ['Will I need this potion? I feel brave enough as I am.', 'needPotion'],
            ok()
        ]
    },
    snakeWeedNoPotion: {
        menu: [
            ['Where is the source of the spring of pure water ?', 'source'],
            ['Where can I find ardrigal.', 'ardrigal'],
            ['If I went in search of the source, could you help me?', 'couldYouHelp'],
            ok()
        ]
    },
    ardrigal: {
        npc: [
            'Ardrigal is often found growing near to large groups of palms.',
            'Such a collection exists in the North. If you head east out of',
            'Tai Bwo Wannai village you should come across them.',
            'The herb grows in the shade of the palm so check carefully.'
        ],
        run: ({ player }) => (cacheHas(player, 'gujuo_potion') ? 'ardrigalAfterPotion' : 'ardrigalNoPotion')
    },
    ardrigalAfterPotion: {
        menu: [
            ['Where can I find Snake weed ?', 'snakeWeed'],
            ['Where is the source of the spring of pure water ?', 'source'],
            ['If I went, could you help me ?', 'couldYouHelp'],
            ['Will I need this potion? I feel brave enough as I am.', 'needPotion'],
            ok()
        ]
    },
    ardrigalNoPotion: {
        say: false,
        menu: [
            ['Where is the source of the spring of pure water ?', async ({ player }) => { await player.say('Where is the source of the spring of pure water ?'); return 'source'; }],
            ['Where can I find Snake weed?', async ({ player }) => { await player.say('Where can I find Snake weed ?'); return 'snakeWeed'; }],
            ['If I went in search of the source, could you help me?', async ({ player }) => { await player.say('If I went in search of the source, could you help me?'); return 'couldYouHelp'; }],
            ['Ok thanks for your help.', async ({ player }) => { await player.say('Ok thanks for your help.'); return 'okThanks'; }]
        ]
    },
    needPotion: {
        npc: ['I would urge you to take it, Bwana, '],
        run: async ({ player, npc }) => {
            await npc.say(
                cacheHas(player, 'gujuo_potion')
                    ? 'I have heard that the caves are protected by supernatural '
                    : 'I have heard that the caves are protected by a supernatural ',
                'fear that renders even the bravest man to a trembling wreck.',
                'You will need all your wits about you when dealing with',
                'the terrors that exist down there. '
            );
            cacheSet(player, 'gujuo_potion');
        },
        menu: [
            ['Where can I find Snake weed?', 'snakeWeed'],
            ['Where is the source of the spring of pure water ?', 'source'],
            ['Where can I find ardrigal.', 'ardrigal'],
            ok()
        ]
    },
    // ---- stage 2 and the caves
    foundWay: {
        npc: ["That's great Bwana, good luck with your quest...", 'and take care!'],
        menu: [
            ['Do you know anything more about the caves?', 'moreAboutCaves'],
            ['Who is Viyeldi?', 'whoIsViyeldi'],
            ['Where is the source of the spring of pure water ?', 'source'],
            ok()
        ]
    },
    moreAboutCaves: {
        npc: ["I am sorry to say that I don't Bwana.", 'You will need to explore that area,', 'but use your wits, and you may be lucky.'],
        menu: [
            ['I have found a way into the caves !', 'foundWay'],
            ['Who is Viyeldi?', 'whoIsViyeldi'],
            ['Where is the source of the spring of pure water ?', 'source'],
            ok()
        ]
    },
    whoIsViyeldi: {
        run: async ({ player, npc }) => {
            await mes(player, 'Gujuo scratches his head for a moment.', 2);
            await npc.say('Well, I have heard that name before, perhaps from the eldars.');
            await mes(player, 'Gujuo suddenly has an inspiration.', 2);
            await npc.say(
                'Ah, yes, I think that is the name of the wizard who first',
                'went in search of the source.',
                'Be wary of him Bwana, he may try to trick you.'
            );
        },
        menu: [
            ['I have found a way into the caves !', 'foundWay'],
            ['Do you know anything more about the caves?', 'moreAboutCaves'],
            ['Where is the source of the spring of pure water ?', 'source'],
            ok()
        ]
    },
    // ---- stages 8 and 9
    foundSourceAndWater: {
        npc: ['Great Bwana, you are truly a brave warrior.', 'Now you can try to grow the Yommi tree in earnest and make the totem pole.'],
        menu: () => lateMenu()
    },
    killedDemonAgain: {
        npc: [
            'You are indeed very brave Bwana,',
            'We have  noticed a difference in the Kharazi jungle,',
            "The tree's seem to sing again.",
            'And we have you to thank for it.'
        ],
        menu: () => lateMenu()
    },
    howTotem: {
        npc: [
            'You will need to grow the Yommi tree to full height.',
            'And then, before it rots. you must chop it down.',
            'Once you have felled the tree, you need to trim the branches.',
            'And finally, you need to craft the totem pole out of the trunk.',
            "You'll need a very sharp, very tough axe to do all this.",
            'But once you have completed the totem pole.',
            'You will need to use it to replace a totem pole that already exists.',
            "As they're all placed on sacred areas to my people."
        ],
        menu: () => lateMenu()
    }
};

function lateMenu() {
    return [
        ['I found the source of the spring and I got the water.', 'foundSourceAndWater'],
        ['I killed the demon again.', 'killedDemonAgain'],
        ['How do I make the totem pole?', 'howTotem'],
        ok()
    ];
}

async function sourceLines(player, npc) {
    await mes(player, 'Gujuo looks very uncomfortable...', 2);
    await npc.say(
        'I am not sure...',
        'But I have heard that deeper in the Catacombs where you found Ungadulu,',
        'deep underground,',
        'There is a terrible place guarded by the spirits of the undead.',
        'Since they died trying to find the source of the stream,',
        'They are cursed to guard it for all eternity.',
        'The first to seek the source was said to be a high level sorcerer.',
        'He created a powerfull spell in the caves,',
        'Now, all those who venture near are overcome by a supernatural fear...',
        'With all my heart Bwana, I would never go near such a place.'
    );
}

// ---- the first words, by stage ---------------------------------------------------------------------------------------------

async function gujuoTalk(player, npc) {
    const stage = stageOf(player);

    switch (stage) {
        case 1:
            await npc.say('Grettings Bwana...', 'Why do you make such strange sounds and disturb the peace of the jungle?');

            if ((await player.ask(['I was hoping to attract the attention of a native.', 'Sorry, it was a mistake?'], true)) === 0) {
                await npc.say(
                    'Well, it had the desired effect...',
                    'I am Gujuo, proud member of the Kharazi tribe.',
                    'What did you want to talk about Bwana ?'
                );

                const opt = await player.ask(['I want to develop friendly relations with your people.', 'Sorry, it was a mistake?'], true);

                return runGraph(player, npc, NODES, opt === 0 ? 'friendlyRelations' : 'sorryItWasAMistake');
            }

            return runGraph(player, npc, NODES, 'sorryItWasAMistake');
        case 2:
            await npc.say('How goes your quest to release Ungadulu Bwana?');

            if ((await player.ask(["I've found the caves, but I don't know what to do.", 'Ok thanks for your help.'], true)) === 0) {
                await npc.say(
                    'Search the caves and try to talk to Ungadulu, there may be some',
                    'clues to be had by searching all the items in the cave...'
                );
                return gujuoBye(player, npc);
            }

            return runGraph(player, npc, NODES, 'okThanks');
        case 3:
            if (holds(player, ITEM.GOLDEN_BOWL) || holds(player, ITEM.GOLDEN_BOWL_WITH_PURE_WATER) || holds(player, ITEM.GOLDEN_BOWL_WITH_PLAIN_WATER)) {
                await npc.say('Greetings Bwana.', 'Ah I see you have the golden bowl !', 'Would like me to show you how to bless it?');

                const bowl = await player.ask(['Yes, I\'d like you to bless my gold bowl.', 'No thanks, I need help with something else.']);

                return runGraph(player, npc, NODES, bowl === 0 ? 'blessTheBowl' : 'howGoes');
            }

            if (holds(player, ITEM.BLESSED_GOLDEN_BOWL) || holds(player, ITEM.BLESSED_GOLDEN_BOWL_WITH_PURE_WATER) || holds(player, ITEM.BLESSED_GOLDEN_BOWL_WITH_PLAIN_WATER)) {
                await npc.say('How goes your quest to release Ungadulu Bwana?');

                const opt = await player.ask(
                    ['Ungadulu looks strange.', 'I need to douse some flames with pure water.', "I'm not sure what to do?", 'Can you help me?'],
                    true
                );

                return runGraph(player, npc, NODES, ['ungaduluLooksStrange', 'douseFlames', 'notSure', 'canYouHelp'][opt]);
            }

            return runGraph(player, npc, NODES, 'howGoes');
        case 4:
            await npc.say('How goes your Quest to release Ungadulu?');

            return runGraph(player, npc, {
                ...NODES,
                start: {
                    menu: [
                        ['Ungadulu is free, he was possesed by a demon and I killed it.', 'ungaduluIsFree'],
                        ['I have the Yommi tree seeds.', 'haveSeeds'],
                        ['What do I do now?', 'whatNow']
                    ]
                }
            }, 'start');
        case 5:
            await npc.say('Congratulations on releasing Ungadulu! My people are very pleased...', 'How goes the growing of the Yommi tree?');

            return runGraph(player, npc, {
                ...NODES,
                start: {
                    menu: [
                        ['I have germinated the Yommi tree seeds.', 'germinated'],
                        ['Where is the fertile soil.', 'fertileSoil'],
                        ok()
                    ]
                }
            }, 'start');
        case 6:
            await npc.say(
                'I have visited Ungadulu in the caves, he is hard at work studying.',
                'He looks well!',
                'Have you grown the Yommi tree yet?'
            );

            {
                const opt = await player.ask(['The water pool has dried up and I need more water.', 'The Yommi tree died']);

                if (opt === 0) {
                    await player.say('The water pool has dried up and I need more pure water.');
                    return runGraph(player, npc, NODES, 'poolDried');
                }

                await player.say('The Yommi tree died');

                return runGraph(player, npc, NODES, 'treeDied');
            }
        case 7:
            await npc.say('I have visited Ungadulu in the caves, he is hard at work studying..', 'He looks well!', 'How is your quest Bwana ?');

            return runGraph(player, npc, {
                ...NODES,
                start: {
                    menu: [
                        [cacheHas(player, 'cavernous_opening') ? 'I have found a way into the caves !' : 'Where can I get more water for the Yommi tree?', cacheHas(player, 'cavernous_opening') ? 'moreWaterOrWay' : 'moreWater'],
                        ['Where is the source of the spring of pure water ?', 'source'],
                        ['I searched the catacombs thoroughly but found nothing else.', 'searchedCatacombs'],
                        ['If I went in search of the source, could you help me?', 'couldYouHelp'],
                        ok()
                    ]
                },
                // the Java sends both first options of stage 7 to WHERE_CAN_I_GET_MORE_WATER_FOR_THE_YOMMI_TREE
                moreWaterOrWay: NODES.moreWater
            }, 'start');
        case 8:
        case 9:
            await npc.say(
                'Hello Bwana, I am very pleased to see you again.',
                'Things seem much happier now in the Kharazi Jungle.',
                'I suspect that it is down to your good doings !'
            );

            return runGraph(player, npc, { ...NODES, start: { menu: lateMenu() } }, 'start');
        case 10:
        case 11:
        case -1:
            return lastWords(player, npc);
        default:
            return undefined;
    }
}

async function lastWords(player, npc) {
    if (!cacheHas(player, 'rewarded_totem') && stageOf(player) >= 10) {
        await player.world.sleepTicks(1);
        await npc.say(
            'Greetins Bwana,',
            'We witnessed your fight with the Demon from some distance away.',
            'My people are so pleased with your heroic efforts.',
            'Your strength and ability as a warrior are Legendary.'
        );
        await mes(player, 'Gujuo offers you an awe inspiring jungle crafted Totem Pole.', 2);
        give(player, ITEM.GILDED_TOTEM_POLE);
        cacheSet(player, 'rewarded_totem');
        await npc.say(
            'Please accept this as a token of our appreciation.',
            'Please, now consider yourself a friend of my people.',
            'And visit us anytime.'
        );

        if (takeAll(player, ITEM.GERMINATED_YOMMI_TREE_SEED) > 0) {
            await npc.say("I'll take those Germinated Yommi tree seeds to Ungadulu,", "I'm sure he'll apreciate them.");
        }

        await gujuoBye(player, npc);
        return;
    }

    await npc.say('Good day Bwana.');
    await npc.say(nextInt(2) === 0 ? 'The Kharazi jungle is especially beautifull today isn\'t it?' : 'The jungle is especially beatifull today isn\'t it?');
    await npc.say('My village people pass on their thanks to you.');

    const hasGift = holds(player, ITEM.GILDED_TOTEM_POLE) || stageOf(player) === -1;
    const options = hasGift
        ? ['Do you have any news?', 'Where are all your people.', 'Ok thanks for your help.']
        : ['Do you have any news?', 'Where are all your people.', "I've lost the tribal gift you gave me.", 'Ok thanks for your help.'];
    const last = await player.ask(options, true);

    if (last === 0) {
        await npc.say('Just that everything is fine in the jungle with us.', 'And that we are gratefull to you for your help.');
    } else if (last === 1) {
        await npc.say(
            'My people are all happy living in the jungle.',
            'They are still afraid of strangers and will not approach',
            'But they are around, none the less.',
            'Your story has been woven into the fabric of our society.',
            'And we all sing your many praises Bwana.'
        );
    } else if (last === 2 && !hasGift) {
        await npc.say(
            "Well, that wasn't very nice of you.",
            'It took us a long time to make that Totem pole.',
            'Luckily, I made another one at the same time.'
        );
        player.message('Gujuo hands over another totem pole.');
        give(player, ITEM.GILDED_TOTEM_POLE);
    } else {
        await runGraph(player, npc, NODES, 'okThanks');
    }
}

async function onTalkToNPC(player, npc) {
    if (npc.id !== NPC.GUJUO) {
        return false;
    }

    player.engage(npc);

    try {
        await gujuoTalk(player, npc);
    } finally {
        player.disengage();
    }

    return true;
}

async function onUseWithNPC(player, npc, item) {
    if (
        npc.id !== NPC.GUJUO ||
        (item.id !== ITEM.GOLDEN_BOWL && item.id !== ITEM.GOLDEN_BOWL_WITH_PURE_WATER && item.id !== ITEM.GOLDEN_BOWL_WITH_PLAIN_WATER)
    ) {
        return false;
    }

    player.engage(npc);

    try {
        await npc.say('Aha Bwana, well done, you have made the golden bowl.', 'Would you like me to show you how to bless it.');

        const menu = await player.ask(["Yes, I'd like to bless my golden bowl.", "No thanks, I'll wait."]);

        if (menu === 0) {
            await runGraph(player, npc, NODES, 'blessTheBowl');
        } else {
            await player.say("No thanks, I'll wait.");
            await npc.say('Very well, let me know when you want to try?');
            await runGraph(player, npc, NODES, 'howGoes');
        }
    } finally {
        player.disengage();
    }

    return true;
}

module.exports = { onTalkToNPC, onUseWithNPC, gujuoTalk, NODES };
