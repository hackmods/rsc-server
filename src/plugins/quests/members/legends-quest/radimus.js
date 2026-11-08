// Ported from Open-RSC Core-Framework authentic/quests/members/legendsquest/npcs/LegendsQuestSirRadimusErkle.java,
// LegendsQuestGuildGuard.java and obstacles/LegendsQuestGates.java (AGPL-3.0): Sir Radimus Erkle in his study (735) and in the Guild
// hall (785), the guard (736) at the Mithril gates 1079 (512,550), the hall doors 1080 (512,540) and the reward. Stage map: shared.js.
// The Java's gendered lines (player.getText) use the male wording.

const {
    ITEM,
    NPC,
    OBJECT,
    REWARD_CACHE_KEYS,
    END,
    stageOf,
    cacheHas,
    cacheSet,
    cacheDel,
    cacheInt,
    mes,
    holds,
    give,
    take,
    runGraph,
    swapObject
} = require('./shared');

function hasScrolls(player) {
    return holds(player, ITEM.RADIMUS_SCROLLS) || holds(player, ITEM.RADIMUS_SCROLLS_COMPLETE);
}

// ---- the end of the quest ------------------------------------------------------------------------------------------------

const SKILL_MENUS = [
    ['attack', 'defense', 'strength'],
    ['hits', 'prayer', 'magic'],
    ['woodcutting', 'crafting', 'smithing'],
    ['herblaw', 'agility', 'thieving']
];
const SKILL_LABELS = {
    attack: '* Attack *',
    defense: '* Defense * ',
    strength: '* Strength * ',
    hits: '* Hits * ',
    prayer: '* Prayer * ',
    magic: '* Magic *',
    woodcutting: '* Woodcutting * ',
    crafting: '* Crafting * ',
    smithing: '* Smithing * ',
    herblaw: '* Herblaw *',
    agility: '* Agility *',
    thieving: '* Thieving *'
};
const NEXT_MENU_LABELS = [
    '--- Go to Skill Menu 2 ----',
    '--- Go to Skill Menu 3 ----',
    '--- Go to Skill Menu 4 ----',
    '--- Go to Skill Menu 1 ----'
];

// LegendsQuestSirRadimusErkle.handleReward: 4 quest points; the four chosen skills got 600 + 600 per level (quarter points) each
function handleReward(player) {
    for (const key of REWARD_CACHE_KEYS) {
        cacheDel(player, key);
    }

    player.completeQuest('legendsQuest', {
        questPoints: 4,
        message: '@gre@Well done - you have completed the Legends Guild Quest!'
    });
}

function rewardClaimCount(player) {
    return cacheHas(player, 'legends_reward_claimed') ? cacheInt(player, 'legends_reward_claimed') : 4;
}

function plural(n) {
    return `You can choose ${n} area${n > 1 ? 's' : ''} to increase your abilities in.`;
}

async function skillReward(player, npc, skill) {
    player.addExperience(skill, 600 + 600 * player.skills[skill].base, false);
    cacheSet(player, 'legends_reward_claimed', cacheHas(player, 'legends_reward_claimed') ? cacheInt(player, 'legends_reward_claimed') - 1 : 3);
    player.message(`You receive some training and increase experience to your ${skill[0].toUpperCase()}${skill.slice(1)}.`);

    if (rewardClaimCount(player) === 0) {
        await npc.say(
            "Right, that's all the training I can offer.! ",
            'Hope you\'re happy with your new skills.',
            'Excuse me now won\'t you ?',
            'Do feel free to explore the rest of the building.'
        );
        handleReward(player);
        return;
    }

    await npc.say(plural(rewardClaimCount(player)));
    await skillMenu(player, npc, 0);
}

async function skillMenu(player, npc, page) {
    const skills = SKILL_MENUS[page];
    const choice = await player.ask([...skills.map((s) => SKILL_LABELS[s]), NEXT_MENU_LABELS[page]]);

    if (choice < 3) {
        await skillReward(player, npc, skills[choice]);
    } else {
        await skillMenu(player, npc, (page + 1) % 4);
    }
}

async function guildTalk(player, npc) {
    const stage = stageOf(player);

    if (stage === 11) {
        if (!cacheHas(player, 'legends_choose_reward')) {
            await npc.say(
                'Welcome to the Legends Guild Main Hall.',
                'We have placed your Totem Pole as pride of place.',
                'All members of the Legends Guild will see it as they walk in.',
                'They will know that you were the person to bring it back.',
                "Congratulations, you're now a fully fledged member.",
                'I would like to to offer you some training.',
                'Which will increase your experience and abilities ',
                'In four areas.',
                'Would you like to train now?'
            );
            cacheSet(player, 'legends_choose_reward');
        } else {
            await npc.say('Hello again...', 'Would you like to continue with your training?');
        }

        const menu = await player.ask(['Yes, I\'ll train now.', "No, I've got something else to do at the moment."]);

        if (menu === 0) {
            await npc.say(plural(rewardClaimCount(player)));
            await skillMenu(player, npc, 0);
        } else {
            await player.say("No, I've got something else to do at the moment.");
            await npc.say(
                'Very well young man.',
                "Return when you are able, but don't leave it too long.",
                "You'll benefit alot from this training.",
                'Now, do excuse me while, I have other things to attend to.',
                'Do feel free to explore the rest of the building.'
            );
        }
    } else if (stage === -1) {
        await npc.say('Hello there! How are you enjoying the Legends Guild?');
        await mes(player, 'Radimus looks busy...', 2);
        await npc.say("Excuse me a moment won't you.", 'Do feel free to explore the rest of the building.');
    }
}

// ---- the study ---------------------------------------------------------------------------------------------------------------

const MENU_WITH_SCROLLS = 'scrolls';
const MENU_NO_SCROLLS = 'noscrolls';

function backToMenu(player) {
    return hasScrolls(player) ? MENU_WITH_SCROLLS : MENU_NO_SCROLLS;
}

const HOUSE = {
    whatsInvolved: {
        npc: [
            'Well, you need to complete a quest for us.',
            'You need to map an area called the Kharazi Jungle',
            'It is the unexplored southern part of Karamja Island.',
            'You also need to befriend a native from the Kharazi tribe',
            'in order to get a gift or token of friendship.',
            'We want to display it in the Legends Guild Main hall.',
            'Are you interested in this quest?'
        ],
        menu: [
            ['Yes, it sounds great!', 'start'],
            ['Not just at the moment.', 'veryWell']
        ]
    },
    start: {
        run: async ({ player, npc }) => {
            await npc.say('Excellent!', 'Ok, you\'ll need this starting map of the Kharazi Jungle.');
            player.message('Grand Vizier Erkle gives you some notes and a map.');
            give(player, ITEM.RADIMUS_SCROLLS);
            await npc.say(
                'Complete this map when you get to the Kharazi Jungle.',
                "It's towards the southern most part of Karamja.",
                "You'll need additional papyrus and charcoal to complete the map.",
                'There are three different sectors of the Kharazi jungle to map.'
            );
            await mes(player, 'Radimus shuffles around the back of his desk.', 2);
            await npc.say(
                'It is likely to be very tough going.',
                "You'll need an axe and a machette to cut through ",
                'the dense Kharazi jungle,collect a machette from the ',
                'cupboard before you leave. Bring back some sort of token ',
                'which we can display in the Guild.',
                'And very good luck to you !'
            );
            player.questStages.legendsQuest = 1;
            return END;
        }
    },
    veryWell: { npc: ['Very well, if you change your mind, please come back and see me.'] },
    maybe: { npc: ['Ok, as you wish...'] },
    who: {
        npc: [
            'My name is Radimus Erkle, I am the Grand Vizier of the Legends Guild.',
            'Are you interested in becoming a member?'
        ],
        say: false,
        menu: [
            ['Yes actually, what\'s involved?', async ({ player }) => { await player.say("Yes actually, what's involved ?"); return 'whatsInvolved'; }],
            ['Maybe some other time.', async ({ player }) => { await player.say('Maybe some other time.'); return 'maybe'; }]
        ]
    },
    [MENU_WITH_SCROLLS]: {
        menu: [
            ["It's Ok, but I have forgotten what to do.", 'forgotten'],
            ['I need another machete.', 'machete'],
            ["I've run out of Charcoal.", 'charcoal'],
            ["I've run out of Papyrus.", 'papyrus'],
            ["I've completed the quest.", 'completed']
        ]
    },
    [MENU_NO_SCROLLS]: {
        say: false,
        menu: [
            ['Terrible, I lost my map of the Kharazi Jungle.', async ({ player }) => { await player.say('Terrible, I lost my map of the Kharazi Jungle.'); return 'lostMap'; }],
            ["It's Ok, but I have forgotten what to do.", async ({ player }) => { await player.say("It's Ok, but I have forgotten what to do."); return 'forgotten'; }],
            ['Great, but I need another machete.', async ({ player }) => { await player.say('I need another machete.'); return 'machete'; }],
            ["I've run out of Charcoal.", async ({ player }) => { await player.say("I've run out of Charcoal."); return 'charcoal'; }],
            ["I've run out of Papyrus.", async ({ player }) => { await player.say("I've run out of Papyrus."); return 'papyrus'; }]
        ]
    },
    forgotten: {
        npc: [
            'Tut! How forgetful!',
            'You need to find a way into the Kharazi jungle, ',
            'Then you need to explore and map that entire area.',
            "While you're there, you need to make contact with any jungle natives.",
            'Bring back a tribal gift from the natives',
            'so that we can display it in the Legends Guild.',
            'I hope that answers your question!'
        ],
        run: ({ player }) => backToMenu(player)
    },
    machete: {
        npc: ['Well, just get another one from the cupboard.'],
        run: ({ player }) => backToMenu(player)
    },
    charcoal: {
        npc: ['Well, get some more!', 'Be proactive and get some more from somewhere.'],
        run: async ({ player, npc }) => {
            await mes(player, 'Sir Radimus mutters under his breath.', 2);
            await npc.say("It's hardly legendary if you fail a quest", "because you can't find some charcoal!");
            return backToMenu(player);
        }
    },
    papyrus: {
        npc: ['Well, get some more!', 'Be proactive and try to find some!'],
        run: async ({ player, npc }) => {
            await mes(player, 'Sir Radimus mutters under his breath.', 2);
            await npc.say("It's hardly legendary if you fail a quest", "because you can't find some papyrus!");
            return backToMenu(player);
        }
    },
    completed: {
        npc: [
            'Well, if you have, show me the gift the Kharazi people gave you !',
            'Becoming a legend is more than just fighting you know.',
            'It also requires some carefull diplomacy and problem solving.',
            'Also complete the map of Kharazi jungle',
            'and we will admit you to the Guild.'
        ],
        run: () => MENU_WITH_SCROLLS
    },
    lostMap: {
        npc: ['That is awful, well, luckily I have a copy here.', 'But I need to charge you a copy fee of 30 gold pieces.'],
        run: async ({ player, npc }) => {
            if (!holds(player, ITEM.COINS, 30)) {
                await npc.say('It looks as if you don\'t have the funds for it at the moment.', 'How irritating...');
                return END;
            }

            await npc.say('Do you agree to pay?');

            const pay = await player.ask(["Yes, I'll pay for it.", "No, I won't pay for it."], true);

            if (pay === 0) {
                player.message('You hand over 30 gold coins.');
                take(player, ITEM.COINS, 30);
                give(player, ITEM.RADIMUS_SCROLLS);
                await npc.say("Ok, please don't lose this one..");
                return END;
            }

            await npc.say(
                "Well, that's your decision, of course... ",
                "but you won't be able to complete the quest without it.",
                'Excuse, me now won\'t you, I have other business to attend to.'
            );
            return MENU_NO_SCROLLS;
        }
    }
};

async function houseTalk(player, npc) {
    const stage = stageOf(player);

    if (stage === 0) {
        await npc.say('Good day to you Sir !', 'No doubt you are keen to become a member of the Legends Guild ?');

        const menu = await player.ask(['Yes actually, what\'s involved?', 'Maybe some other time.', 'Who are you?']);

        if (menu === 0) {
            await player.say("Yes actually, what's involved ?");
            await runGraph(player, npc, HOUSE, 'whatsInvolved');
        } else if (menu === 1) {
            await player.say('Maybe some other time.');
            await runGraph(player, npc, HOUSE, 'maybe');
        } else {
            await player.say('Who are you?');
            await runGraph(player, npc, HOUSE, 'who');
        }
    } else if (stage >= 1 && stage <= 10) {
        await npc.say('Hello there, how is the quest going?');
        await runGraph(player, npc, HOUSE, backToMenu(player));
    } else if (stage === 11) {
        await npc.say(
            'Hello again, go through to the main Legends Guild Hall,',
            "I'll meet you in there. ",
            'And we can discuss your reward !'
        );
    } else if (stage === -1) {
        await npc.say('Hello there! How are you enjoying the Legends Guild?');
        await mes(player, 'Radimus looks busy...', 2);
        await npc.say("Excuse me a moment won't you.", 'Do feel free to explore the rest of the building.');
    }
}

async function talkRadimus(player, npc) {
    if (npc.id !== NPC.SIR_RADIMUS_ERKLE_HOUSE && npc.id !== NPC.SIR_RADIMUS_ERKLE_GUILD) {
        return false;
    }

    player.engage(npc);

    try {
        if (npc.id === NPC.SIR_RADIMUS_ERKLE_HOUSE) {
            await houseTalk(player, npc);
        } else {
            await guildTalk(player, npc);
        }
    } finally {
        player.disengage();
    }

    return true;
}

async function onUseWithNPC(player, npc, item) {
    if (npc.id !== NPC.SIR_RADIMUS_ERKLE_HOUSE) {
        return false;
    }

    if (item.id === ITEM.GILDED_TOTEM_POLE) {
        player.engage(npc);

        try {
            const stage = stageOf(player);

            if (stage === 11) {
                await npc.say('Go through to the main Legends Guild and I will join you.');
            } else if (stage === 10) {
                await npc.say('Sir, this is truly amazing...');

                if (!holds(player, ITEM.RADIMUS_SCROLLS_COMPLETE)) {
                    await npc.say('However, I need you to complete the map of the ,', 'Kharazi Jungle before your quest is complete.');
                } else {
                    await mes(player, 'Radimus Erkle orders some guards to take the totem pole,', 2);
                    await mes(player, 'into the main Legends Hall.', 2);
                    take(player, ITEM.GILDED_TOTEM_POLE);
                    await npc.say(
                        'That will take pride of place in the Legends Guild ',
                        'As a reminder of your quest to gain entry.',
                        'And so that many other great adventurers can admire your bravery.',
                        'Well, it seems that you have completed the tasks I set you.',
                        'That map of the Kharazi jungle will be very helpful in future.',
                        'Congratulations, welcome to the Legends Guild.',
                        'Go through to the main Legends Guild building ',
                        'and I will join you shortly.'
                    );
                    player.questStages.legendsQuest = 11;
                }
            } else {
                player.message('You have not completed this quest - submitting bug abuse.');
            }
        } finally {
            player.disengage();
        }

        return true;
    }

    if (item.id === ITEM.TOTEM_POLE) {
        player.engage(npc);

        try {
            await npc.say(
                'Hmmm, well, it is very impressive.',
                'Especially since it looks very heavy...',
                'However, it lacks a certain authenticity,',
                'my guess is that you made it.',
                "But I'm not sure why.",
                'We would like to have a really nice display object',
                'to put on display in the Legends Guild main hall.',
                'Do you think you could get something more authentic ?'
            );
        } finally {
            player.disengage();
        }

        return true;
    }

    if (item.id === ITEM.RADIMUS_SCROLLS_COMPLETE) {
        player.engage(npc);

        try {
            await npc.say(
                'Well done Sir, very well done...',
                "However, you'll probably need it while you search",
                'for natives of the Kharazi tribe in the Kharazi jungle.',
                'Remember, we want a very special token of friendship from them.',
                'To place in the Legends Guild.',
                "I'll take the map off your hands once we get the ",
                'proof that you have met the natives.'
            );
        } finally {
            player.disengage();
        }

        return true;
    }

    return false;
}

// ---- the guard and the gates ---------------------------------------------------------------------------------------------

const QUEST_REQUIREMENTS = [
    ['herosQuest', "Hero's Quest."],
    ['familyCrest', 'Family Crest Quest.'],
    ['shiloVillage', 'Shilo Village Quest.'],
    ['undergroundPass', 'Underground Pass Quest.'],
    ['waterfallQuest', 'Waterfall Quest.']
];

function eligible(player) {
    return player.questPoints >= 107 && QUEST_REQUIREMENTS.every(([key]) => player.questStages[key] === -1);
}

// LegendsQuestGuildGuard.openGates: the gate looks open for 4 ticks and the player is put inside
function openGates(player) {
    const gate = player.world.gameObjects && player.world.gameObjects.getAtPoint
        ? player.world.gameObjects.getAtPoint(512, 550).find((o) => o.id === OBJECT.MITHRIL_GATES)
        : undefined;

    if (gate) {
        swapObject(player, gate, OBJECT.GATE_OPEN, 4);
    }

    player.teleport(513, 549);
}

const GUARD = {
    whatIsThisPlace: {
        npc: [
            'This is the Legends Guild sir !',
            'Legendary RuneScape citizens are invited on a quest',
            'in order to become members of the guild.'
        ],
        menu: [
            ['Can I go on the quest?', 'canIGo'],
            ['What kind of quest is it?', 'whatKind']
        ]
    },
    howDoIGetIn: {
        npc: [
            'Well sir,',
            "you'll need to be a legendary citizen of RuneScape.",
            'If you want to use the Legends Hall, ',
            "you'll be invited to complete a quest.",
            'Once you have completed that Quest,',
            "you'll be a fully fledged member of the Guild."
        ],
        menu: [
            ['What is this place?', 'whatIsThisPlace'],
            ['Can I speak to someone in charge?', 'someoneInCharge'],
            ['Can I go on the quest?', 'canIGo']
        ]
    },
    someoneInCharge: {
        npc: [
            'Well, Sir,',
            'Radimus Erkle is the Grand Vizier of the Legends Guild.',
            "He's a very busy man.",
            "And he'll only talk to those people eligible for the quest."
        ],
        menu: [
            ['Can I go on the quest?', 'canIGo'],
            ['What kind of quest is it?', 'whatKind']
        ]
    },
    okThanks: { npc: ['Very well Sir !'] },
    canIGo: {
        run: async ({ player, npc }) => {
            await mes(player, 'The guard gets out a scroll of paper and starts looking through it.', 3);

            if (eligible(player)) {
                await npc.say(
                    'Well, it looks as if you are eligable for the quest.',
                    'Grand Vizier Erkle will give you the details about the quest.',
                    'You can go and talk to him about it if you like?'
                );

                const opt = await player.ask(
                    ['Who is Grand Vizier Erkle?', "Yes, I'd like to talk to Grand Vizier Erkle.", 'Some other time perhaps.'],
                    true
                );

                if (opt === 0) {
                    return 'whoIsErkle';
                }

                return opt === 1 ? 'talkToErkle' : END;
            }

            await npc.say("I'm very sorry,", 'But you need to complete more quests before you qualify.', 'You also need to have 107 quest points.');

            const deny = await player.ask(['Which quests do I need to complete?', 'Ok thanks.'], true);

            if (deny === 0) {
                await npc.say('You need to complete the...');

                for (const [key, label] of QUEST_REQUIREMENTS) {
                    if (player.questStages[key] !== -1) {
                        await npc.say(label);
                    }
                }

                if (player.questPoints < 107) {
                    await npc.say('You also need to have 107 Quest Points as well!');
                }

                await npc.say("They don't call it the Legends Guild for nothing you know!", 'Best of luck if you intend to become a member!');
            } else {
                await npc.say("That's no problem...", 'Best of luck if you intend to become a member!');
            }

            return END;
        }
    },
    whatKind: {
        npc: ["Well, to be honest Sir, I'm not really sure.", "You'll need to talk to Grand Vizier Erkle to find that out."],
        say: false,
        menu: [
            ['Can I go on the quest?', async ({ player }) => { await player.say('Can I go on the quest?'); return 'canIGo'; }],
            [
                'Thanks for your help.',
                async ({ player, npc }) => {
                    await player.say('Thanks for your help');
                    await npc.say("You're welcome..");
                    player.message('The Guard marches off on patrol again.');
                    return END;
                }
            ]
        ]
    },
    whoIsErkle: {
        npc: [
            'He is the head of the Legends Guild.',
            'His full name is Radimus Erkle.',
            'Would you like to talk to him about the quest?'
        ],
        say: false,
        menu: [
            ["Yes, I'd like to talk to Grand Vizier Erkle.", async ({ player }) => { await player.say("Yes, I'd like to talk to Grand Vizier Erkle."); return 'talkToErkle'; }],
            ['Some other time perhaps.', async ({ player }) => { await player.say('Some other time perhaps'); return END; }]
        ]
    },
    talkToErkle: {
        npc: ['Ok, very well...', "You need  to go into the building on the left, he's in his study."],
        run: async ({ player, npc }) => {
            player.message('The guard unlocks the gate and opens it for you.');
            await npc.say('Good Luck!');
            openGates(player);
            return END;
        }
    }
};

async function guardTalk(player, npc) {
    const stage = stageOf(player);

    if (stage === 0) {
        await mes(player, 'You approach a nearby guard...', 2);
        await npc.say('Yes Sir, how can I help you?');
        await runGraph(player, npc, { ...GUARD, start: {
            menu: [
                ['What is this place?', 'whatIsThisPlace'],
                ['How do I get in here?', 'howDoIGetIn'],
                ['Can I speak to someone in charge?', 'someoneInCharge'],
                ["It's Ok thanks.", 'okThanks']
            ]
        } }, 'start');
    } else if (stage >= 1 && stage <= 10) {
        player.message('A guard nods at you as you walk past.');
        await npc.say('Hope the quest is going well Sir !');
    } else if (stage === 11 || stage === -1) {
        player.message('The guards Salute you as you walk past.');
        await npc.say('! ! ! Attention ! ! !', 'Legends Guild Member Approaching');
        openGates(player);
    }
}

async function mithrilGates(player, gameObject, command) {
    if (command === 'search') {
        await mes(player, 'The gates to the Legends Guild are made from wrought Mithril.', 2);
        await mes(player, 'A small path leads away up to a very grandiose building.', 2);
        await mes(player, 'To the left is a smaller out building, but it is no less impressive.', 2);
        await mes(player, 'All the buildings are set in wonderfully landscaped gardens.', 2);
        player.message('Two well dressed guards seem to be guarding the gate.');
        return;
    }

    if (player.y <= 550) {
        swapObject(player, gameObject, OBJECT.GATE_OPEN, 4);
        player.teleport(513, 552);
        return;
    }

    const guard = player.getNearbyEntitiesWithinRadius('npcs', NPC.LEGENDS_GUILD_GUARD, 5).find((n) => !n.locked);
    const stage = stageOf(player);

    if (stage === 0) {
        if (guard) {
            await mes(player, 'A nearby guard approaches you...', 2);
            player.engage(guard);

            try {
                await guardTalk(player, guard);
            } finally {
                player.disengage();
            }
        } else {
            player.message('The guards is currently busy.');
        }
    } else if (stage >= 1 && stage <= 10) {
        if (guard) {
            player.message('A guard nods at you as you walk past.');
            await guard.say('Hope the quest is going well Sir !');
        }

        openGates(player);
    } else {
        if (guard) {
            player.message('The guards Salute you as you walk past.');
            await guard.say('! ! ! Attention ! ! !', 'Legends Guild Member Approaching');
        }

        openGates(player);
    }
}

async function legendsHallDoor(player, gameObject, command) {
    if (command === 'search') {
        player.message('Nothing interesting happens');
        return;
    }

    const stage = stageOf(player);

    if (stage >= 11 || stage === -1) {
        swapObject(player, gameObject, OBJECT.DOORS_OPEN, 4);
        player.message('You open the impressive wooden doors.');
        player.teleport(513, player.y <= 539 ? 541 : 539);
    } else {
        await mes(player, 'You need to complete the Legends Guild Quest', 2);
        await mes(player, 'before you can enter the Legends Guild', 2);
    }
}

async function onTalkToGuard(player, npc) {
    player.engage(npc);

    try {
        await guardTalk(player, npc);
    } finally {
        player.disengage();
    }

    return true;
}

async function onTalkToNPC(player, npc) {
    if (npc.id === NPC.LEGENDS_GUILD_GUARD) {
        return onTalkToGuard(player, npc);
    }

    return talkRadimus(player, npc);
}

async function onGameObjectCommandOne(player, gameObject) {
    if (gameObject.id === OBJECT.MITHRIL_GATES) {
        await mithrilGates(player, gameObject, 'open');
        return true;
    }

    if (gameObject.id === OBJECT.LEGENDS_HALL_DOOR) {
        await legendsHallDoor(player, gameObject, 'open');
        return true;
    }

    return false;
}

async function onGameObjectCommandTwo(player, gameObject) {
    if (gameObject.id === OBJECT.MITHRIL_GATES) {
        await mithrilGates(player, gameObject, 'search');
        return true;
    }

    if (gameObject.id === OBJECT.LEGENDS_HALL_DOOR) {
        await legendsHallDoor(player, gameObject, 'search');
        return true;
    }

    return false;
}

module.exports = {
    onTalkToNPC,
    onUseWithNPC,
    onGameObjectCommandOne,
    onGameObjectCommandTwo,
    handleReward,
    eligible
};
