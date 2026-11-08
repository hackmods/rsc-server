// Ported from Open-RSC Core-Framework authentic/npcs/shilo/JungleForester.java and the gold bar part of authentic/skills/smithing/
// Smithing.java (AGPL-3.0): the Jungle Forester (765) by the edge of the Kharazi jungle, who gives the bull roarer for a copy of the
// completed map, and the golden bowl (2 gold bars at an anvil, Smithing 50) the quest needs, which Smithing refuses to make before
// Legends' Quest stage 3. Stage map: shared.js.

const { ITEM, NPC, END, stageOf, mes, holds, give, calcProduction, level, runGraph } = require('./shared');

const ANVIL_ID = 50;
const DORICS_ANVIL_ID = 177;
const HAMMER_ID = 168;
const GOLD_BOWL_LEVEL = 50;
const GOLD_BOWL_EXPERIENCE = 120; // quarter points, as the Java incExp
const GOLD_MISTAKE_EXPERIENCE = 4;

const ok = () => ['Ok thanks', 'okThanks'];

// the stage 0 (before the quest) talk: JungleForesterNPC
const DEFAULT = {
    whatDoYouDo: {
        npc: [
            "I'm a forester, and I specialise in exotic woods. ",
            "I've not managed to penetrate the Kharazi jungle very far,",
            'but I have found some interesting specimens of trees.',
            'If you do happen to get into the Kharazi jungle, do come and let me know.',
            "I'd love to be able to safely navigate my own way in and out."
        ],
        menu: [['Who are you?', 'whoAreYou'], ['How do I get into the Kharazi jungle?', 'kharaziJungle'], ok()]
    },
    whoAreYou: {
        npc: ["I'm a jungle forester,", 'Names mean little in this part of the world.'],
        menu: [['What do you do here?', 'whatDoYouDo'], ['How do I get into the Kharazi jungle?', 'kharaziJungle']]
    },
    kharaziJungle: {
        npc: [
            "Well, I've not managed it yet, ",
            'But I heard that someone managed to find a way in..',
            'But they only just managed to to escape the jungle with their lives.',
            'Apparently he was on a mission to map the area.',
            'How foolish is that?'
        ],
        say: false,
        menu: [
            [
                'So someone managed to get into the Kharazi Jungle?',
                async ({ player, npc }) => {
                    await player.say('So someone managed to get into the Jungle?');
                    await npc.say(
                        'Yes, he said he was from some place...near the Barbarian outpost.',
                        'Mentioned something about a legend ?',
                        'It meant nothing to me though.'
                    );

                    const menu = await player.ask(['How do I get into the jungle?', 'What do you do here?', 'Ok thanks']);

                    if (menu === 0) {
                        await player.say('How do I get into the Kharazi jungle?');
                        return 'kharaziJungle';
                    }

                    if (menu === 1) {
                        await player.say('What do you do here?');
                        return 'whatDoYouDo';
                    }

                    await player.say('Ok thanks');
                    return 'okThanks';
                }
            ],
            ['What do you do here?', async ({ player }) => { await player.say('What do you do here?'); return 'whatDoYouDo'; }],
            ['Ok thanks', async ({ player }) => { await player.say('Ok thanks'); return 'okThanks'; }]
        ]
    },
    okThanks: { npc: ["You're welcome!", 'See you around...'] }
};

// the Legends' Quest talk (stage 1 on, and after): JungleForesterNPC_LegendsQuest
const LEGENDS = {
    whatDoYouDo: {
        npc: DEFAULT.whatDoYouDo.npc,
        menu: [['How do I get into the Kharazi jungle?', 'kharaziJungle'], ['Have you seen any natives in the jungle?', 'natives'], ok()]
    },
    natives: {
        npc: [
            "Well, I've heard some funny sounds...",
            "And I think I've seen a native...but I'm not sure",
            "They generally don't like to be seen I guess...",
            'But I found an item that you might be interested in.',
            'You swing it above your head and it makes a strange sound,',
            'it seems to attract their attention.'
        ],
        menu: [
            [
                'Can I have the item please?',
                async ({ player, npc }) => {
                    await npc.say(
                        'Well, I wish I could give it to you.',
                        'However, I have grown fond of it.',
                        'And it may help me incase I get lost in the jungle.'
                    );

                    if ((await player.ask(['Will you trade something for it?', 'Ok thanks'], true)) === 0) {
                        await npc.say(
                            'Well, if you have something interesting, let me have a look at it',
                            "and I'll offer you something in return...",
                            "OK, I have to go now, but it's been nice talking with you."
                        );
                        return END;
                    }

                    return 'okThanks';
                }
            ],
            ['How do I get into the jungle?', 'kharaziJungle'],
            ok()
        ]
    },
    kharaziJungle: {
        npc: DEFAULT.kharaziJungle.npc,
        menu: [
            [
                'Well, in fact I plan to map that area myself.',
                async ({ player, npc }) => {
                    await mes(player, 'The forester looks very interested..', 2);
                    await npc.say(
                        'Oh, well, that sounds quite good actually...',
                        "Sorry if I sounded rude before, it just didn't seem like a good idea to me.",
                        "I guess I just wouldn't want to do it myself.",
                        'But a map of that area would certainly be a big task.',
                        'And it would certainly be very useful...'
                    );
                    await mes(player, 'The forester looks very thoughtfull', 1);
                    await npc.say(
                        'Hey, if you manage to complete it, be sure to let me take a look!',
                        "Well, best of luck with it, I'm sure you're going to need it."
                    );

                    const opt = await player.ask(
                        ['Do you have any other tips about the Kharazi jungle?', 'Have you seen any natives in the jungle?', 'Ok thanks'],
                        true
                    );

                    if (opt === 0) {
                        await npc.say("Not really, but I would say be careful, it's a dangerous place.", 'And good luck.');
                        return END;
                    }

                    return opt === 1 ? 'natives' : 'okThanks';
                }
            ],
            [
                'Are you calling me foolish?',
                async ({ npc }) => {
                    await npc.say('No, of course not...', 'Sorry, I have to be on myway...');
                    return END;
                }
            ],
            ['What do you do here?', 'whatDoYouDo'],
            ['Have you seen any natives in the jungle?', 'natives'],
            ok()
        ]
    },
    makeACopy: {
        npc: ['Many thanks friend.'],
        run: async ({ player, npc }) => {
            await mes(player, 'The Jungle Forester takes out some parchment and some charcoal.', 2);
            await mes(player, 'He studiously renders another copy of your map.', 2);
            await npc.say('Many thanks friend.');
            await mes(player, 'He takes out a strange looking object and hands it to you.', 2);
            await npc.say(
                "Here, I won't be needing this any longer, and it may help you.",
                'Whenever I\'ve used it before, it attracted the attention of jungle natives.'
            );
            give(player, ITEM.BULL_ROARER);
            return END;
        }
    },
    okThanks: DEFAULT.okThanks
};

async function onTalkToNPC(player, npc) {
    if (npc.id !== NPC.JUNGLE_FORESTER) {
        return false;
    }

    player.engage(npc);

    try {
        await npc.say("Hello friend, you're a long way from civilisation!");

        if (stageOf(player) === 0) {
            await runGraph(player, npc, {
                ...DEFAULT,
                start: {
                    menu: [
                        ['What do you do here?', 'whatDoYouDo'],
                        ['How do I get into the jungle?', 'kharaziJungle'],
                        ['Who are you?', 'whoAreYou']
                    ]
                }
            }, 'start');
        } else {
            await runGraph(player, npc, {
                ...LEGENDS,
                start: {
                    menu: [
                        ['How do I get into the Kharazi jungle?', 'kharaziJungle'],
                        ['What do you do here?', 'whatDoYouDo'],
                        ['Have you seen any natives in the jungle?', 'natives']
                    ]
                }
            }, 'start');
        }
    } finally {
        player.disengage();
    }

    return true;
}

async function onUseWithNPC(player, npc, item) {
    if (npc.id !== NPC.JUNGLE_FORESTER || item.id !== ITEM.RADIMUS_SCROLLS_COMPLETE) {
        return false;
    }

    player.engage(npc);

    try {
        player.message('You show the completed map of Kharazi Jungle to the Forester.');

        if (holds(player, ITEM.BULL_ROARER)) {
            await npc.say("It's a great map, thanks for letting me take a copy!", 'It has helped me out a number of times now.');
            return true;
        }

        await npc.say('*Gasp*');
        player.message('The jungle forester looks speechless.');
        await npc.say('This is very impressive!', "I'm amazed, it's just great!", "Do you mind if I make a copy of it, and I'll give you an item in return.");

        const menu = await player.ask(['Yes, go ahead make a copy!', 'What will you give me in return?', 'Sorry, I must complete my quest.'], true);
        const leave = async () => {
            await npc.say('Very well friend, I understand, I must be on my way as well.');
            player.message('The Jungle Forester seems a bit annoyed...and wanders off.');
        };

        if (menu === 0) {
            await runGraph(player, npc, LEGENDS, 'makeACopy');
        } else if (menu === 1) {
            await npc.say('Well, I can offer you this?');
            await mes(player, 'The Jungle Forester takes out a strange looking object.', 2);
            await mes(player, 'It looks like a wooden pole, with string attached to one end.', 2);
            player.message('And at the other end of the string is shaped piece of wood.');
            await npc.say(
                'If you swing this above your head, it makes a strange sound.',
                'I noticed that it attracts the attention of the natives.',
                'Is it a deal? Can I make a copy of your map?'
            );

            if ((await player.ask(['Yes, go ahead make a copy!', 'Sorry, I must complete my quest.'], true)) === 0) {
                await runGraph(player, npc, LEGENDS, 'makeACopy');
            } else {
                await leave();
            }
        } else {
            await leave();
        }
    } finally {
        player.disengage();
    }

    return true;
}

// ---- the golden bowl --------------------------------------------------------------------------------------------------------------------

async function smithGoldBowl(player) {
    if (!holds(player, HAMMER_ID)) {
        player.message('@que@You need a hammer to work the metal with.');
        return;
    }

    if (stageOf(player) >= 0 && stageOf(player) <= 2) {
        player.message("You're not quite sure what to make from the gold..");
        return;
    }

    player.message('What would you like to make?');

    if ((await player.ask(['Golden bowl.', 'Cancel'])) === 1) {
        return;
    }

    // the Java repeats while the player has bars (batch progression); one bowl per click here
    {
        if (player.inventory.count(ITEM.GOLD_BAR) < 2) {
            player.message('You need two bars of gold to make this item.');
            return;
        }

        await mes(player, 'You hammer the metal...', 3);

        // Formulae.breakGoldenItem(50, level): a failure of calcProductionSuccessfulLegacy(50, level, true, 80)
        if (calcProduction(GOLD_BOWL_LEVEL, level(player, 'smithing'), true, GOLD_BOWL_LEVEL + 30)) {
            player.inventory.remove(ITEM.GOLD_BAR, 2);
            player.message('You forge a beautiful bowl made out of solid gold.');
            give(player, ITEM.GOLDEN_BOWL);
            player.addExperience('smithing', GOLD_BOWL_EXPERIENCE);
        } else {
            player.message('You make a mistake forging the bowl..');
            await player.world.sleepTicks(3);
            player.message('You pour molten gold all over the floor..');
            player.inventory.remove(ITEM.GOLD_BAR, 1);
            player.addExperience('smithing', GOLD_MISTAKE_EXPERIENCE);
        }

    }
}

async function onUseWithGameObject(player, gameObject, item) {
    if ((gameObject.id !== ANVIL_ID && gameObject.id !== DORICS_ANVIL_ID) || item.id !== ITEM.GOLD_BAR) {
        return false;
    }

    await smithGoldBowl(player);

    return true;
}

module.exports = { onTalkToNPC, onUseWithNPC, onUseWithGameObject };
