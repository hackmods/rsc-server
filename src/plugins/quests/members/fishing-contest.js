// Ported from Open-RSC Core-Framework authentic/quests/members/FishingContest.java (AGPL-3.0)
// https://classic.runescape.wiki/w/Fishing_Contest
//
// questStages.fishingContest (the Java stages):
//   0  the Mountain Dwarf (355) guards the stairs (359) under White Wolf Mountain; talked round, he hands over the
//      Fishing competition pass (719) -> 1
//   1  Grandpa Jack (345) at Hemenster: carp bite by the pipes, on red vine worms (715) dug with a spade from the vines
//      (355) in McGrubor's wood -> 2
//   1-2  the contest: Morris (349) lets a pass holder through the gate (358); Bonzo (347) takes 5 coins. Garlic (218) in
//      a pipe (350) drives the Sinister stranger (346) off the pipe spot (352). Three catches end the contest: a Raw giant
//      carp (717) among them wins the Hemenster fishing trophy (720) -> 3
//   3  the dwarf takes the trophy -> -1: 1 quest point and fishing experience; the stairs then lead under the mountain
// The contest spots (351 oak tree, 352 pipes, 353 Big Dave's, 354 Joshua's) need fishing 10, a Fishing Rod (377) and
// Fishing Bait (380) or red vine worms; every cast catches, with no experience.
// Cache flags: paidContestFee, contestCatches (the item ids caught, Java's "contest_catches" string), garlicActivated.
// Open-RSC's "I just want to fish around" (usable_carp_spot) is the custom locked_post_quest_regions_accessible config,
// off in the authentic configs, so it is not here.

const GRANDPA_JACK_ID = 345;
const SINISTER_STRANGER_ID = 346;
const BONZO_ID = 347;
const MORRIS_ID = 349;
const BIG_DAVE_ID = 353;
const JOSHUA_ID = 354;
const MOUNTAIN_DWARF_ID = 355;

const COINS_ID = 10;
const SPADE_ID = 211;
const GARLIC_ID = 218;
const RAW_SHRIMP_ID = 349;
const RAW_SARDINE_ID = 354;
const FISHING_ROD_ID = 377;
const FISHING_BAIT_ID = 380;
const RED_VINE_WORMS_ID = 715;
const RAW_GIANT_CARP_ID = 717;
const COMPETITION_PASS_ID = 719;
const TROPHY_ID = 720;

const PIPE_ID = 350;
const REGULAR_SPOT_ID = 351;
const CARP_SPOT_ID = 352;
const DAVE_SPOT_ID = 353;
const JOSHUA_SPOT_ID = 354;
const RED_VINE_ID = 355;
const GATE_OPEN_ID = 357;
const GATE_CLOSED_ID = 358;
const STAIRS_ID = 359;

function stageOf(player) {
    return player.questStages.fishingContest || 0;
}

function setStage(player, stage) {
    player.questStages.fishingContest = stage;
}

// Open-RSC ifnearvisnpc: the nearest one within `radius` tiles
function nearNpc(player, id, radius) {
    return player
        .getNearbyEntitiesByID('npcs', id, radius * 2 + 1)
        .sort((a, b) => player.getDistance(a) - player.getDistance(b))[0];
}

// a conversation the player started by clicking scenery: the npc stands still and the chat packet names the player
async function converse(player, npc, fn) {
    if (!npc) {
        return;
    }

    const engaged = npc.interlocutor === player;

    if (!engaged) {
        npc.lock();
        npc.interlocutor = player;
    }

    try {
        await fn(npc);
    } finally {
        if (!engaged && npc.interlocutor === player) {
            npc.interlocutor = null;
            npc.unlock();
        }
    }
}

// Open-RSC sinister.teleport(570, 495): a fresh copy on the new tile (an npc moved in place would stay in the old
// quadtree cell), keeping the spawn point and the respawn
function moveNpc(world, npc, x, y) {
    const NPC = require('../../../model/npc');
    const moved = new NPC(world, {
        id: npc.id,
        x,
        y,
        minX: Math.min(npc.minX, x),
        maxX: Math.max(npc.maxX, x),
        minY: Math.min(npc.minY, y),
        maxY: Math.max(npc.maxY, y)
    });

    moved.spawnX = npc.spawnX;
    moved.spawnY = npc.spawnY;
    moved.respawn = npc.respawn;
    npc.respawn = undefined;

    world.removeEntity('npcs', npc);
    world.addEntity('npcs', moved);

    return moved;
}

function catches(player) {
    return Array.isArray(player.cache.contestCatches) ? player.cache.contestCatches : [];
}

function addCatch(player, id) {
    player.cache.contestCatches = [...catches(player), id];
}

function hasCarpCatch(player) {
    return catches(player).some((id) => id === RAW_GIANT_CARP_ID) && player.inventory.has(RAW_GIANT_CARP_ID);
}

// FishingContest.handleReward: 1 quest point, fishing 900 (+800 from fishing 24) + 300 per level, quarter points
function completeQuest(player) {
    const fishing = player.skills.fishing.base;
    const extra = fishing >= 24 ? 800 : 0;

    player.completeQuest('fishingContest', {
        questPoints: 1,
        experience: { fishing: 900 + extra + 300 * fishing },
        message: 'Well done you have completed the fishing competition quest'
    });
}

async function bonzoTimesUp(player, bonzo) {
    const { world } = player;
    const caught = catches(player);
    let hadCarp = false;

    await bonzo.say('Okay folks times up', 'Lets see who caught the biggest fish');
    player.message('@que@You hand over your catch');
    await world.sleepTicks(3);

    for (const id of caught) {
        hadCarp = hadCarp || (id === RAW_GIANT_CARP_ID && player.inventory.has(RAW_GIANT_CARP_ID));
        player.inventory.remove(id);
    }

    delete player.cache.contestCatches;
    delete player.cache.paidContestFee;

    if (hadCarp) {
        await bonzo.say('We have a new winner');
        await bonzo.say(
            'The heroic looking person',
            'who was fishing by the pipes',
            'Has caught the biggest carp',
            "I've seen since Grandpa Jack used to compete"
        );
        player.message('you are given the Hemenster fishing trophy');
        player.inventory.add(TROPHY_ID, 1);
        setStage(player, 3);
        return;
    }

    // someone else wins
    const roll = Math.floor(Math.random() * 101);

    await bonzo.say('And the winner is...');

    if (80 > roll) {
        await bonzo.say('The stranger in black');
    } else if (15 > roll - 80) {
        await bonzo.say('local favourite- Big Dave');
    } else {
        await bonzo.say('the surprising Joshua');
    }
}

async function bonzoDialogue(player, bonzo, isDirectTalk) {
    const { world } = player;
    const sinister = nearNpc(player, SINISTER_STRANGER_ID, 10);

    if (stageOf(player) === -1) {
        if (!isDirectTalk) {
            player.message('@que@you have already won the fishing competition');
            await world.sleepTicks(3);
        } else {
            await bonzo.say('Hello champ', 'So any hints on how to fish so well');
            await player.say("I think I'll keep them to myself");
        }

        return;
    }

    if (player.cache.paidContestFee) {
        await bonzo.say('so how are you doing so far?');

        if (hasCarpCatch(player)) {
            const choice = await player.ask(
                [
                    'I have this big fish,is it enough to win?',
                    'I think I might still be able to find a bigger fish'
                ],
                false
            );

            if (choice === 0) {
                await player.say('I have this big fish', 'Is it enough to win?');
                await bonzo.say("Well we'll just wait till time is up");
                player.message('You wait');
                await world.sleepTicks(3);
                await bonzoTimesUp(player, bonzo);
            } else if (choice === 1) {
                await player.say('I think I might still be able to find a bigger fish');
                await bonzo.say('Ok, good luck');
            }
        } else {
            await player.say('I think I might still be able to find a bigger fish');
            await bonzo.say('Ok, good luck');
        }

        return;
    }

    // a trophy holder may not enter again
    if (player.inventory.has(TROPHY_ID)) {
        await bonzo.say('Hello champ', 'So any hints on how to fish so well');
        await player.say("I think I'll keep them to myself");
        return;
    }

    if (isDirectTalk) {
        await bonzo.say(
            'Roll up, roll up',
            'Enter the great Hemenster fishing competition',
            'only 5gp entrance fee'
        );
    } else {
        await bonzo.say(
            'Hey you need to pay to join the competition first',
            'only 5gp entrance fee'
        );
    }

    const first = await player.ask(
        ["I'll give that a go then", "No thanks, I'll just watch the fun"],
        true
    );

    if (first !== 0) {
        return;
    }

    await bonzo.say('Marvelous');

    if (player.inventory.count(COINS_ID) < 5) {
        player.message("@que@I don't have the 5gp though");
        await world.sleepTicks(3);
        await bonzo.say('No pay, no play');
        return;
    }

    player.message('You pay bonzo 5 coins');
    player.inventory.remove(COINS_ID, 5);
    await bonzo.say(
        "Ok we've got all the fishermen",
        "It's time to roll",
        'Ok nearly everyone is in there place already', // sic
        'You fish in the spot by the oak tree',
        'And the Sinister stranger you fish by the pipes'
    );

    if (!player.cache.garlicActivated) {
        player.message('Your fishing competition spot is beside the oak tree');
    } else {
        if (sinister) {
            await converse(player, sinister, (npc) =>
                npc.say('Arrgh what is that ghastly smell', 'I think I will move over here instead')
            );
            moveNpc(world, sinister, 570, 495);
        }

        await bonzo.say("Hmm you'd better go and take the area by the pipes then");
        player.message('Your fishing competition spot is beside the pipes');
    }

    player.cache.paidContestFee = true;
}

const GRANDPA_STORY = [
    'Well when I were a young man',
    'We used to take fishing trips over to Catherby',
    'The fishing over there - now that was something',
    'Anyway we decided to do a bit of fishing with our nets',
    "I wasn't having the best of days",
    'Tuning up nothing but old boots and bits of seaweed',
    'Then my net suddenly got really heavy',
    'I pulled it up',
    "To my amazement I'd caught this little chest thing",
    'even more amazing was when I opened it',
    'It contained a diamond the size of a radish',
    "That's the best catch I've ever had!"
];

async function grandpaJack(player, npc) {
    const stage = stageOf(player);

    await npc.say(
        'Hello young man',
        'Come to visit old Grandpa Jack?',
        'I can tell ye stories for sure',
        'I used to be the best fisherman these parts have seen'
    );

    if (stage === 1 || stage === 2) {
        const first = await player.ask(
            [
                'Tell me a story then',
                'Are you entering the fishing competition?',
                "Sorry I don't have time now"
            ],
            true
        );

        if (first === 0) {
            await npc.say(...GRANDPA_STORY);
        } else if (first === 1) {
            await npc.say(
                'Ah the Hemenster fishing competition',
                'I know all about that',
                'I won that four years straight',
                "I'm to old for that lark now though" // sic
            );

            const second = await player.ask(
                [
                    "I don't suppose you could give me any hints?",
                    "That's less competition for me then"
                ],
                false
            );

            if (second === 0) {
                await player.say("I don't suppose you could give me any hints?");
                await npc.say(
                    'Well you sometimes get these really big fish',
                    'In the water just by the outflow pipes',
                    "Think they're some kind of carp",
                    'try to get a spot round there',
                    'The best sort of bait for them is red vine worms',
                    "I used to get those from McGruber's wood, north of here",
                    'dig around in the red vines up there'
                );

                if (stageOf(player) !== 2) {
                    setStage(player, 2);
                }
            } else if (second === 1) {
                await player.say('That\'s less competition for me then"'); // sic
            }
        } else if (first === 2) {
            await npc.say('sigh', 'Young people - always in such a rush');
        }

        return;
    }

    const first = await player.ask(
        ['Tell me a story then', "Sorry I don't have time now"],
        true
    );

    if (first === 0) {
        await npc.say(...GRANDPA_STORY);
    } else if (first === 1) {
        await npc.say('sigh', 'Young people - always in such a rush');
    }
}

async function goDownDialogue(player, dwarf) {
    await dwarf.say(
        'This is the home of the mountain dwarves',
        'How would you like it if I wanted to take a short cut through your home'
    );

    const third = await player.ask(
        [
            'Ooh is this a short cut to somewhere',
            "Oh sorry I hadn't realised it was private",
            "If you were my friend I wouldn't mind it"
        ],
        false
    );

    if (third === 0) {
        await player.say('Ooh is this a short cut to somewhere?');
        await dwarf.say(
            'Well it is easier to go this way',
            'Than through passes full of wolves'
        );
    } else if (third === 1) {
        await player.say("Oh sorry I hadn't realised it was private");
    } else if (third === 2) {
        await player.say("If you were my friend I wouldn't mind");
        await dwarf.say("Yes, but I don't even know you");

        const fourth = await player.ask(
            ['Well lets be friends', "You're a grumpy little man aren't you?"],
            false
        );

        if (fourth === 0) {
            await player.say('Well lets be friends');
            await dwarf.say(
                "I don't make friends easily",
                'People need to earn my trust first'
            );

            const fifth = await player.ask(
                ['And how am I meant to do that?', "You're a grumpy little man aren't you?"],
                false
            );

            if (fifth === 0) {
                await player.say('And how am I meant to do that?');
                await dwarf.say(
                    "My we are the persistant one aren't we", // sic
                    "Well theres a certain gold artifact we're after",
                    'We dwarves are big fans of gold',
                    'This artifact is the first prize at the hemenster fishing competition',
                    'Fortunately we have acquired a pass to enter that competition',
                    "Unfortunately Dwarves don't make good fishermen"
                );

                const six = await player.ask(
                    ["Fortunately I'm alright at fishing", "I'm not much of a fisherman either"],
                    false
                );

                if (six === 0) {
                    await player.say("fortunately I'm alright at fishing");
                    await dwarf.say(
                        'Okay I entrust you with our competition pass',
                        'go to Hemenster and do us proud'
                    );
                    player.inventory.add(COMPETITION_PASS_ID, 1);
                    setStage(player, 1);
                } else if (six === 1) {
                    await player.say("I'm not much of a fisherman either");
                    await dwarf.say('what good are you?');
                }
            } else if (fifth === 1) {
                await player.say("You're a grumpy little man aren't you");
                await dwarf.say(" Don't you know it"); // sic
            }
        } else if (fourth === 1) {
            await player.say("You're a grumpy little man aren't you");
            await dwarf.say(" Don't you know it"); // sic
        }
    }
}

function passHeldOrBanked(player) {
    return (
        player.inventory.has(COMPETITION_PASS_ID) ||
        Boolean(player.bank && player.bank.has(COMPETITION_PASS_ID))
    );
}

async function mountainDwarf(player, dwarf) {
    const { world } = player;

    switch (stageOf(player)) {
        case 0: {
            await dwarf.say('hmmph what do you want');

            const first = await player.ask(
                ['I was wondering what was down those stairs?', 'I was just stopping to say hello'],
                false
            );

            if (first === 0) {
                await player.say('I was just wondering what was down those stairs?');
                await dwarf.say("You can't go down there");

                const second = await player.ask(
                    ["I didn't want to anyway", 'Why not?', "I'm bigger than you let me by"],
                    false
                );

                if (second === 0) {
                    await player.say("I didn't want to anyway");
                    await dwarf.say('Good');
                } else if (second === 1) {
                    await player.say('Why not?');
                    await goDownDialogue(player, dwarf);
                } else if (second === 2) {
                    await player.say("I'm bigger than you", 'Let me by');
                    await dwarf.say('Go away', "You're not going to bully your way in here");
                }
            } else if (first === 1) {
                await player.say('I was just stopping to say hello');
                await dwarf.say('Hello then');
            }

            break;
        }
        case 1:
        case 2:
            await dwarf.say('Have you won yet?');

            if (!passHeldOrBanked(player)) {
                const choice = await player.ask(
                    [
                        'No I need another competition pass',
                        'No it takes preparation to win fishing competitions'
                    ],
                    false
                );

                if (choice === 0) {
                    await player.say('I need another competition pass');
                    await dwarf.say('Hmm its a good job they sent us spares', 'there you go');
                    player.inventory.add(COMPETITION_PASS_ID, 1);
                } else if (choice === 1) {
                    await player.say('No it takes preparation to win fishing competitions');
                    await dwarf.say('Maybe that\'s where we are going wrong when we try fishing');
                }
            } else {
                await player.say('No not yet');
            }

            break;
        case 3:
            await dwarf.say('Have you won yet?');
            await player.say('Yes I have');
            await dwarf.say('Well done, so where is the trophy?');

            if (player.inventory.has(TROPHY_ID)) {
                await player.say('I have it right here');
                player.message('@que@you give the trophy to the dwarf');
                await world.sleepTicks(3);
                player.inventory.remove(TROPHY_ID);
                await dwarf.say('Okay we will let you in now');
                completeQuest(player);
            } else {
                await player.say("I don't have it with me");
            }

            break;
        case -1:
            await dwarf.say('Welcome oh great fishing champion', 'Feel free to pop by any time');
            break;
    }
}

async function sinisterVampire(npc) {
    await npc.say(
        "Just because I can't stand the smell of garlic",
        "and I don't like bright sunlight",
        "Doesn't necessarily mean I'm a vampire"
    );
}

async function sinisterFishing(player, npc) {
    await npc.say(
        'My doctor told be to take up a velaxing hobby', // sic
        'vhen I am stressed I tend to get a little..',
        '..thirsty'
    );

    const third = await player.ask(
        [
            "You're a vampire aren't you?",
            'If you get thirsty you should drink something',
            'Well good look with the fishing' // sic
        ],
        false
    );

    if (third === 0) {
        await player.say("You're a vampire aren't you?");
        await sinisterVampire(npc);
    } else if (third === 1) {
        await player.say('If you get thirsty', 'You should drink something');
        await npc.say('I think I may do that soon');
    } else if (third === 2) {
        await player.say('Well good luck with the fishing');
        await npc.say('Luck has nothing to do vith it', 'It is all in the technique');
    }
}

async function sinisterStranger(player, npc) {
    if (stageOf(player) === 0) {
        return;
    }

    await npc.say('..');

    const first = await player.ask(['..?', 'Who are you?', 'so you like fishing?'], false);

    if (first === 0) {
        await player.say('..?');
        await npc.say(' ...');
    } else if (first === 1) {
        await player.say('Who are you?');
        await npc.say('My name is Vlad', 'I come from far avay, vere the sun is not so bright');

        const second = await player.ask(["You're a vampire aren't you?", 'Is it nice there?'], true);

        if (second === 0) {
            await sinisterVampire(npc);
        } else if (second === 1) {
            await npc.say('It is vonderful', 'the vomen are beautiful', 'and the nights are long');

            const third = await player.ask(
                [
                    "You're a vampire aren't you?",
                    'So you like fishing?',
                    'Well good luck with the fishing'
                ],
                false
            );

            if (third === 0) {
                await player.say("You're a vampire aren't you?");
                await sinisterVampire(npc);
            } else if (third === 1) {
                await player.say('So you like fishing');
                await sinisterFishing(player, npc);
            } else if (third === 2) {
                await player.say('Well good luck with the fishing');
                await npc.say('Luck has nothing to do vith it', 'It is all in the technique');
            }
        }
    } else if (first === 2) {
        await player.say('So you like fishing');
        await sinisterFishing(player, npc);
    }
}

const TALK_NPCS = new Set([MOUNTAIN_DWARF_ID, BONZO_ID, SINISTER_STRANGER_ID, GRANDPA_JACK_ID]);

async function onTalkToNPC(player, npc) {
    if (!TALK_NPCS.has(npc.id)) {
        return false;
    }

    player.engage(npc);

    if (npc.id === MOUNTAIN_DWARF_ID) {
        await mountainDwarf(player, npc);
    } else if (npc.id === BONZO_ID) {
        await bonzoDialogue(player, npc, true);
    } else if (npc.id === SINISTER_STRANGER_ID) {
        await sinisterStranger(player, npc);
    } else if (npc.id === GRANDPA_JACK_ID) {
        await grandpaJack(player, npc);
    }

    player.disengage();
    return true;
}

async function onUseWithGameObject(player, gameObject, item) {
    if (gameObject.id !== RED_VINE_ID && gameObject.id !== PIPE_ID) {
        return false;
    }

    const { world } = player;

    if (gameObject.id === RED_VINE_ID && item.id === SPADE_ID) {
        player.message('@que@you dig in amoungst the vines'); // sic
        await world.sleepTicks(3);
        player.message('@que@You find a red vine worm');
        await world.sleepTicks(3);
        player.inventory.add(RED_VINE_WORMS_ID, 1);
    } else if (gameObject.id === PIPE_ID && item.id === GARLIC_ID) {
        const sinister = nearNpc(player, SINISTER_STRANGER_ID, 10);
        const bonzo = nearNpc(player, BONZO_ID, 15);

        // stashing garlic does not check for garlic already there
        player.message('@que@You stash the garlic in the pipe');
        await world.sleepTicks(3);
        player.inventory.remove(GARLIC_ID);

        if (player.cache.paidContestFee && !player.cache.garlicActivated) {
            if (sinister) {
                await converse(player, sinister, (npc) =>
                    npc.say('Arrgh what is that ghastly smell', 'I think I will move over here instead')
                );
                moveNpc(world, sinister, 570, 495);
            }

            if (bonzo) {
                await converse(player, bonzo, (npc) =>
                    npc.say("Hmm you'd better go and take the area by the pipes then")
                );
            }

            player.message('Your fishing competition spot has been moved to beside the pipes');
        }

        player.cache.garlicActivated = true;
    }

    // any other item on the vines or the pipes does nothing
    return true;
}

// one cast at a contest spot: `withWorms` and `withBait` are what each bait catches there
async function castAtSpot(player, bonzo, withWorms, withBait, record) {
    if (player.skills.fishing.current < 10) {
        player.message('You need at least level 10 fishing to lure these fish');
        return;
    }

    if (!player.inventory.has(FISHING_ROD_ID)) {
        player.message("I don't have the equipment to catch a fish");
        return;
    }

    if (!player.inventory.has(FISHING_BAIT_ID) && !player.inventory.has(RED_VINE_WORMS_ID)) {
        player.message('you have no bait to catch fish here');
        return;
    }

    const caught = player.inventory.has(RED_VINE_WORMS_ID) ? withWorms : withBait;

    player.message(caught.message);
    player.inventory.add(caught.id, 1);
    player.inventory.remove(player.inventory.has(RED_VINE_WORMS_ID) ? RED_VINE_WORMS_ID : FISHING_BAIT_ID);

    if (record) {
        addCatch(player, caught.id);
    }

    if (record && catches(player).length > 2 && bonzo) {
        await converse(player, bonzo, () => bonzoTimesUp(player, bonzo));
    }
}

async function regularSpot(player) {
    const sinister = nearNpc(player, SINISTER_STRANGER_ID, 10);
    const bonzo = nearNpc(player, BONZO_ID, 15);

    if (player.inventory.has(TROPHY_ID)) {
        player.message('you have already won the fishing competition');
        return;
    }

    if (bonzo && !player.cache.paidContestFee) {
        await converse(player, bonzo, () => bonzoDialogue(player, bonzo, false));
        return;
    }

    if (stageOf(player) > 0 && !player.cache.garlicActivated) {
        await castAtSpot(
            player,
            bonzo,
            { id: RAW_SARDINE_ID, message: 'You catch a sardine' },
            { id: RAW_SHRIMP_ID, message: 'You catch some shrimps' },
            true
        );
    } else if (sinister) {
        await converse(player, sinister, (npc) => npc.say('I think you will find that is my spot'));
    }
}

async function carpSpot(player) {
    const sinister = nearNpc(player, SINISTER_STRANGER_ID, 10);
    const bonzo = nearNpc(player, BONZO_ID, 15);
    const stage = stageOf(player);

    if (player.inventory.has(TROPHY_ID)) {
        player.message('you have already won the fishing competition');
        return;
    }

    if (bonzo && !player.cache.paidContestFee) {
        await converse(player, bonzo, () => bonzoDialogue(player, bonzo, false));
        return;
    }

    if (stage > 0 && player.cache.garlicActivated) {
        await castAtSpot(
            player,
            bonzo,
            { id: RAW_GIANT_CARP_ID, message: 'You catch a giant carp' },
            { id: RAW_SARDINE_ID, message: 'You catch a sardine' },
            true
        );
    } else if (stage === -1) {
        player.message('you have already won the fishing competition');
    } else if (sinister) {
        await converse(player, sinister, async (npc) => {
            await npc.say('I think you will find that is my spot');
            await player.say("Can't you go to another spot?");
            await npc.say('I like this place', 'I like to savour the aroma coming from these pipes');
        });
    }
}

async function contestGate(player, gate) {
    if (player.x <= 564) {
        const morris = nearNpc(player, MORRIS_ID, 15);

        if (!morris) {
            return;
        }

        await converse(player, morris, async () => {
            await morris.say('competition pass please');

            if (player.inventory.has(COMPETITION_PASS_ID)) {
                player.message('@que@You show Morris your pass');
                await player.world.sleepTicks(3);
                await morris.say('Move on through');
                await player.enterGate(gate, GATE_OPEN_ID);
                return;
            }

            const choice = await player.ask(["I don't have one of them", 'What do I need that for?'], true);

            if (choice === 1) {
                await morris.say('This is the entrance to the Hementster fishing competition'); // sic
                await morris.say("It's a high class competition");
                await morris.say('Invitation only');
            }
        });

        return;
    }

    if (stageOf(player) === 3) {
        await player.enterGate(gate, GATE_OPEN_ID);
        return;
    }

    const bonzo = nearNpc(player, BONZO_ID, 15);

    if (bonzo && player.cache.paidContestFee) {
        await converse(player, bonzo, async () => {
            await bonzo.say("so you're calling it quits here for now?");

            const choice = await player.ask(
                ["Yes I'll compete again another day", "Actually I'll go back and catch some more"],
                true
            );

            if (choice === 0) {
                delete player.cache.paidContestFee;
                delete player.cache.contestCatches;
                await player.enterGate(gate, GATE_OPEN_ID);
            } else if (choice === 1) {
                await bonzo.say('Good luck');
            }
        });

        return;
    }

    await player.enterGate(gate, GATE_OPEN_ID);
}

async function dwarfStairs(player, stairs) {
    if (stageOf(player) === -1) {
        player.message('You go down the stairs');

        if (stairs.x === 426 && stairs.y === 458) {
            player.teleport(426, 3294);
        } else {
            player.teleport(385, 3301);
        }

        return;
    }

    const dwarf = nearNpc(player, MOUNTAIN_DWARF_ID, 25);

    if (!dwarf) {
        return;
    }

    await converse(player, dwarf, async () => {
        if (stageOf(player) !== 0) {
            await mountainDwarf(player, dwarf);
            return;
        }

        await dwarf.say('Hoi there, halt', "You can't come in here");

        const choice = await player.ask(
            ['why not?', "Oh sorry I hadn't realised it was private", "I'm bigger than you let me by"],
            false
        );

        if (choice === 0) {
            await dwarf.say('Why not?'); // sic: Open-RSC has the dwarf say it
            await goDownDialogue(player, dwarf);
        } else if (choice === 1) {
            await player.say("Oh sorry I hadn't realised it was private");
        } else if (choice === 2) {
            await player.say("I'm bigger than you", 'Let me by');
            await dwarf.say('Go away', "You're not going to bully your way in here");
        }
    });
}

async function onGameObjectCommandOne(player, gameObject) {
    switch (gameObject.id) {
        case GATE_CLOSED_ID:
            await contestGate(player, gameObject);
            return true;
        case REGULAR_SPOT_ID:
            await regularSpot(player);
            return true;
        case CARP_SPOT_ID:
            await carpSpot(player);
            return true;
        case DAVE_SPOT_ID: {
            const dave = nearNpc(player, BIG_DAVE_ID, 10);
            await converse(player, dave, (npc) =>
                npc.say("Oi whaddya think ya doin'", "I'm fishin' here", 'Now beat it')
            );
            return true;
        }
        case JOSHUA_SPOT_ID: {
            const joshua = nearNpc(player, JOSHUA_ID, 10);
            await converse(player, joshua, (npc) =>
                npc.say('This is my fishing spot', "Ya don't wanna be fishing 'ere mate", "Cos I'll break your knuckles")
            );
            return true;
        }
        case STAIRS_ID:
            await dwarfStairs(player, gameObject);
            return true;
    }

    return false;
}

async function onUseWithNPC(player, npc, item) {
    if (npc.id !== SINISTER_STRANGER_ID || item.id !== GARLIC_ID) {
        return false;
    }

    await converse(player, npc, () =>
        npc.say(
            'urrggh get zat horrible ving avay from me',
            'How do people like to eat that stuff',
            "I can't stand even to be near it for ten seconds"
        )
    );

    return true;
}

module.exports = {
    onTalkToNPC,
    onUseWithGameObject,
    onGameObjectCommandOne,
    onUseWithNPC,
    GATE_CLOSED_ID
};
