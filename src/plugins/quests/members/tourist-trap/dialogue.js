// Ported from Open-RSC Core-Framework authentic/quests/members/touristtrap/TouristTrap.java (AGPL-3.0): every conversation of
// the Tourist Trap (Irena, the mercenaries and their captain, the slaves, Ana, the Bedabin, Captain Siad), the guards' punishments
// and the attack refusals. The dialogue below is translated line by line from the Java (same text, menus, stage numbers);
// the hooks that call it are in tourist-trap.js and mechanism.js. questStages.touristTrap:
//   0  Irena (538) at the Shantay Pass gate asks for Ana -> 1 ("Oh, Ok, I'll get your daughter back for you")
//   1  walk to the mining camp (west of the pass); the mercenary captain (669) is killed or tricked (cache first_kill_captn)
//   2  a slave (671) in the camp: "I can try to undo them for you" -> 2; the lock picked (60% each try, two tries) and the
//      Desert Clothes (shirt 1020, robe 1019, boots 990) -> the slave's rags (1022, 1023), he runs off -> 4 (3 while the
//      clothes are missing)
//   4  in the slaves' robes, down the doors 958 (81,801) into the mine: a guard (670) wants a Tenti pineapple -> 5
//   5  Al Shabim (700) in the Bedabin camp: the Bedobin copy key (1059) -> 6
//   6  Captain Siad (702)'s chest 1005 at (85,1746) upstairs: the plans (1060) once he is distracted -> Al Shabim -> 7
//   7  the experimental anvil 1006 (170,792): bronze bar -> prototype dart tip (smithing 20), + 10 feathers -> prototype dart
//      (fletching 10); show it to Al Shabim -> 8 (a Tenti pineapple and six bronze throwing darts; dart tips can be forged)
//   8  the pineapple to the guard (670) inside the mine -> 9
//   9  the mining cave 963 (82,3639) now opens; Ana (554) in the mine: a barrel (967), the lift 977/966 or the mine cart
//      1025 to the surface; Ana in a barrel (1039) carried to Irena (or through the stone gate 916) -> 10
//   10 Irena's reward menu: two of fletching, agility, smithing, thieving (600 + 600 x level quarter points each) -> -1
// Reward: 2 quest points (QuestRewardRegistrar).

const {
    ITEM,
    NPC,
    TEXT,
    stageOf,
    setStage,
    inTouristTrapCave,
    cacheHas,
    cacheGet,
    cacheSet,
    cacheDel,
    mes,
    randomInt,
    nearNpc,
    spawnNpc,
    removeNpc,
    moveNpc,
    attackPlayer,
    changeNpc
} = require('./shared');

// points the guards leave the player in the desert
const desertTPPoints = [
    { x: 121, y: 743 },
    { x: 135, y: 775 },
    { x: 121, y: 803 },
    { x: 102, y: 775 },
    { x: 93, y: 765 }
];

const Irene = { WHENDIDSHEGO: 0, WHATDIDSHEGO: 1, REWARD: 2, LOOKFORDAUGHTER: 3, GETBACKDAUGHTER: 4 };
const Mercenary = {
    THROW_PLAYER: 0,
    PLACE_START: 1,
    PLACE_SECOND: 2,
    ORDER_KILL_PEOPLE: 3,
    GUARDING_FIRST: 4,
    GUARDING_SECOND: 5,
    ANA_FIRST: 6,
    ANA_SECOND: 7,
    LEAVE_DESERT: 8,
    THROW_PRISON: 9
};
const Slave = { NEWRECRUIT: 0, UNDOTHEM: 1, GIVEITAGO: 2 };
const MercenaryInside = { PINEAPPLES: 0, UNDERSTAND: 1 };
const BedabinNomad = { JUGOFWATER: 0, FULLWATERSKIN: 1, BUCKETOFWATER: 2, SHANTAYPASS: 3, PLACE: 4 };
const AlShabim = { WHATISTHISPLACE: 0, HAVE_PLANS: 1, MADE_WEAPON: 2 };
const MercenaryCaptain = { GUARDING: 0, DONTSCAREME: 1, MUSTBESOMETHINGICANDO: 2 };
const Siad = {
    PREPARETODIE: 0,
    SLAVESBROKENFREE: 1,
    FIREFIRE: 2,
    TWOMINUTES: 3,
    ERM: 4,
    SERVICE: 5,
    DRAGON: 6,
    LONELY: 7,
    PLANS: 8,
    SUCCEED: 9,
    BOOKS: 10,
    PUNISHED: 11
};
const Ana = { TRYGETYOUOUTOFHERE: 0, GOTTHAT: 1, SNEAKEDPAST: 2, GUARDSRUBBISH: 3 };

// TouristTrap.succeedRate: 3 in 5
function succeedRate() {
    return Math.floor(Math.random() * 5) < 3;
}

// the reward: 600 + 600 x level quarter points in the chosen skill (QuestRewardRegistrar XPReward(NONE, 600, 600); the
// Java incStat adds varXP x max level + baseXP)
const REWARD_SKILLS = ['fletching', 'agility', 'smithing', 'thieving'];

function rewardExperience(player, skill) {
    return 600 + 600 * player.skills[skill].base;
}

// TouristTrap.handleReward
function completeQuest(player) {
    player.completeQuest('touristTrap', {
        questPoints: 2,
        message: [
            '',
            '@yel@                          !!!  Well Done !!!   ',
            '',
            '@gre@***********************************************************',
            "@gre@*** You have completed the 'Tourist Trap' Quest ! ***",
            '@gre@***********************************************************'
        ]
    });
}

async function lastRewardMenu(player, npc, showIrenaDialogue) {
    if (showIrenaDialogue) {
        await npc.say(
            'Thank you very much for returning my daughter to me.',
            "I'm really very grateful...",
            'I would like to reward you for your bravery and daring.',
            'I can offer you increased knowledge in one of the following areas.'
        );
    }

    const choice = await player.ask(['Fletching.', 'Agility.', 'Smithing.', 'Thieving'], false);

    if (choice >= 0 && choice < REWARD_SKILLS.length) {
        await skillReward(player, npc, REWARD_SKILLS[choice], false);
    }
}

async function rewardMenu(player, npc) {
    await npc.say(
        'Thank you very much for returning my daughter to me.',
        "I'm really very grateful...",
        'I would like to reward you for your bravery and daring.',
        'I can offer you increased knowledge in two of the following areas.'
    );

    const choice = await player.ask(['Fletching.', 'Agility.', 'Smithing.', 'Thieving'], false);

    if (choice >= 0 && choice < REWARD_SKILLS.length) {
        await skillReward(player, npc, REWARD_SKILLS[choice], true);
    }
}

async function skillReward(player, npc, skill, isFirst) {
    player.addExperience(skill, rewardExperience(player, skill), false);
    await mes(player, `You advance your stat in ${skill.charAt(0).toUpperCase()}${skill.slice(1)}.`);

    if (!isFirst) {
        completeQuest(player);

        if (cacheHas(player, 'advanced1')) {
            cacheDel(player, 'advanced1');
        }
    } else {
        await mes(player, 'Ok, now choose your second skil.');

        if (!cacheHas(player, 'advanced1')) {
            cacheSet(player, 'advanced1', true);
        }

        await lastRewardMenu(player, npc, false);
    }
}

// TouristTrap.indirectTalktoAlShabim: the plans used on Al Shabim
async function indirectTalktoAlShabim(player, npc) {
    if (npc.id === NPC.AL_SHABIM) {
        if (stageOf(player) === 6 || stageOf(player) === 7) {
            await alShabimDialogue(player, npc, AlShabim.HAVE_PLANS);
        } else if (stageOf(player) > 7 || stageOf(player) === -1) {
            await mes(player, 'Al Shabim takes the technical plans off you.');
            await npc.say('Thanks for the technical plans Effendi!', "We've been lost without them!");
        }
    }
}

// TouristTrap.delayedReturnSlave: 50 ticks later the escaping slave is a mining slave again
function delayedReturnSlave(player, n) {
    player.world.setTickTimeout(() => {
        if (player.world.npcs.getByIndex(n.index) === n) {
            changeNpc(player, n, NPC.MINING_SLAVE);
        }
    }, 50);
}

async function irenaDialogue(player, npc, cID) {
    if (npc.id === NPC.IRENA) {
        if (cID === -1) {
            switch (stageOf(player)) {
                case 0:
                    await mes(player, "Irena seems to be very upset and cries as you start to approach her.");
                    await npc.say("Boo hoo, oh dear, my only daughter....");
                    const menu = await player.ask(["What's the matter?", "Cheer up, it might never happen."], true);
                    if (menu === 0) {
                        await npc.say(
                            "Oh dear...my daughter, Ana, has gone missing in the desert.",
                            "I fear that she is lost, or perhaps...*sob* even worse."
                        );
                        const matterMenu = await player.ask(
                            ["When did she go into the desert?",
                                "What did she go into the desert for?",
                                "Is there a reward if I get her back?"
                            ],
                            true
                        );
                        if (matterMenu === 0) {
                            await irenaDialogue(player, npc, Irene.WHENDIDSHEGO);
                        } else if (matterMenu === 1) {
                            await irenaDialogue(player, npc, Irene.WHATDIDSHEGO);
                        } else if (matterMenu === 2) {
                            await irenaDialogue(player, npc, Irene.REWARD);
                        }
                    } else if (menu === 1) {
                        await npc.say(
                            "It may already have happened you thoughtless oaf!",
                            "My daughter, Ana, could be dead or dying in the desert!!!"
                        );
                        const newMenu = await player.ask(
                            ["When did she go into the desert?",
                                "What did she go into the desert for?",
                                "Is there a reward if I get her back?"
                            ],
                            true
                        );
                        if (newMenu === 0) {
                            await irenaDialogue(player, npc, Irene.WHENDIDSHEGO);
                        } else if (newMenu === 1) {
                            await irenaDialogue(player, npc, Irene.WHATDIDSHEGO);
                        } else if (newMenu === 2) {
                            await irenaDialogue(player, npc, Irene.REWARD);
                        }
                    }
                    break;
                case 1:
                case 2:
                case 3:
                case 4:
                case 5:
                case 6:
                case 7:
                case 8:
                    await npc.say(
                        "Please bring my daughter back to me.",
                        "She is most likely lost in the Desert somewhere.",
                        "I miss her so much....",
                        "Wahhhhh!",
                        "*Sob*"
                    );
                    break;
                case 9:
                    if (!player.inventory.has(ITEM.ANA_IN_A_BARREL)) {
                        await npc.say(
                            "Please bring my daughter back to me.",
                            "She is most likely lost in the Desert somewhere.",
                            "I miss her so much....",
                            "Wahhhhh!",
                            "*Sob*"
                        );
                    } else {
                        await npc.say("Hey, great you've found Ana!");
                        await mes(player, "You show Irena the barrel with Ana in it.");
                        player.inventory.remove(ITEM.ANA_IN_A_BARREL, 1);
                        setStage(player, 10);
                        let Ana = spawnNpc(player, NPC.ANA, player.x, player.y, 60000);
                        moveNpc(Ana, player.x, player.y + 1);
                        if (Ana !== null) {
                            await player.world.sleepTicks(1);
                            player.message("@gre@Ana: Hey great, there's my Mum!");
                            await Ana.say(
                                "Great! Thanks for getting me out of that mine!",
                                "And that barrel wasn't too bad anyway!",
                                "Pop by again sometime, I'm sure we'll have a barrel of laughs!",
                                "Oh! I nearly forgot, here's a key I found in the tunnels.",
                                "It might be of some use to you, not sure what it opens."
                            );
                            player.inventory.add(ITEM.WROUGHT_IRON_KEY, 1);
                            await mes(player, "Ana spots Irena and waves...");
                            await Ana.say("Hi Mum!", "Sorry, I have to go now!");
                            removeNpc(player, Ana);
                        }
                        await npc.say("Hi Ana!");
                        await rewardMenu(player, npc);
                        cacheDel(player, "tried_ana_barrel");
                    }
                    break;
                case 10:
                    if (cacheHas(player, "advanced1")) {
                        await lastRewardMenu(player, npc, true);
                    } else {
                        await rewardMenu(player, npc);
                    }
                    break;
                case -1:
                    player.message("Irena seems happy now that her daugher has returned home.");
                    await npc.say(
                        "Thanks so much for returning my daughter to me.",
                        "I expect that she will go on another trip soon though.",
                        "She is the adventurous type...a bit like yourself really!",
                        "Ok, see you around then!"
                    );
                    player.message("Irena goes back to work.");
                    break;
            }
        }
        switch (cID) {
            case Irene.WHENDIDSHEGO:
                await npc.say(
                    "*Sob*",
                    "She went in there just a few days ago, ",
                    "She said she would be back yesterday.",
                    "And she's not..."
                );
                const menu = await player.ask(
                    ["What did she go into the desert for?",
                        "Is there a reward if I get her back?",
                        "I'll look for your daughter."
                    ],
                    true
                );
                if (menu === 0) {
                    await irenaDialogue(player, npc, Irene.WHATDIDSHEGO);
                } else if (menu === 1) {
                    await irenaDialogue(player, npc, Irene.REWARD);
                } else if (menu === 2) {
                    await irenaDialogue(player, npc, Irene.LOOKFORDAUGHTER);
                }
                break;
            case Irene.WHATDIDSHEGO:
                await npc.say(
                    "She was just travelling, a tourist you might say.",
                    "*Sob* She said she would be safe and now she could be.."
                );
                player.message("Irena's bottom lip trembles a little.");
                await npc.say("*Whhhhhaaaaa*");
                player.message("Irena cries her heart out in front of you.");
                const menuWhat = await player.ask(
                    ["When did she go into the desert?",
                        "Is there a reward if I get her back?",
                        "I'll look for your daughter."
                    ],
                    true
                );
                if (menuWhat === 0) {
                    await irenaDialogue(player, npc, Irene.WHENDIDSHEGO);
                } else if (menuWhat === 1) {
                    await irenaDialogue(player, npc, Irene.REWARD);
                } else if (menuWhat === 2) {
                    await irenaDialogue(player, npc, Irene.LOOKFORDAUGHTER);
                }
                break;
            case Irene.REWARD:
                await npc.say(
                    TEXT.TouristTrapIreneWellYesYoullHaveMyGratitude,
                    "And I'm sure that Ana will also be very pleased!",
                    "And I may see if I can get a small reward together...",
                    "But I cannot promise anything.",
                    "So does that mean that you'll look for her then?"
                );
                const rewardMenu = await player.ask(["Oh, Ok, I'll get your daughter back for you.", "No, sorry, I'm just too busy!"], true);
                if (rewardMenu === 0) {
                    await irenaDialogue(player, npc, Irene.GETBACKDAUGHTER);
                } else if (rewardMenu === 1) {
                    await npc.say("Oh really, can't I persuade you in anyway?");
                }
                break;
            case Irene.LOOKFORDAUGHTER:
                await npc.say(
                    "That would be very good of you.",
                    "You would have the gratitude of a very loving mother.",
                    "Are you sure you want to take on that responsibility?"
                );
                const lookMenu = await player.ask(["Oh, Ok, I'll get your daughter back for you.", "No, sorry, I'm just too busy!"], true);
                if (lookMenu === 0) {
                    await irenaDialogue(player, npc, Irene.GETBACKDAUGHTER);
                } else if (lookMenu === 1) {
                    await npc.say("Oh really, can't I persuade you in anyway?");
                }
                break;
            case Irene.GETBACKDAUGHTER:
                await npc.say(
                    "That would be great!",
                    "That's really very nice of you!",
                    "She was wearing a red silk scarf when she left."
                );
                setStage(player, 1);
                break;
        }
    }
}

async function mercenaryDialogue(player, npc, cID) {
    if (npc.id === NPC.MERCENARY || npc.id === NPC.DRAFT_MERCENARY_GUARD) {
        if (cID === -1) {
            switch (stageOf(player)) {
                case 0:
                    if (player.inventory.has(ITEM.METAL_KEY)) {
                        await npc.say("Move along now..we've had enough of your sort!");
                        return;
                    }
                    await npc.say("Yeah, what do you want?");
                    const menu = await player.ask(["What is this place?", "What are you guarding?"], true);
                    if (menu === 0) {
                        await mercenaryDialogue(player, npc, Mercenary.PLACE_START);
                    } else if (menu === 1) {
                        await mercenaryDialogue(player, npc, Mercenary.GUARDING_FIRST);
                    }
                    break;
                case 1:
                case 2:
                case 3:
                case 4:
                case 5:
                    if (player.inventory.has(ITEM.METAL_KEY) || inTouristTrapCave(player)) {
                        await npc.say("Move along now..we've had enough of your sort!");
                        return;
                    }
                    if (stageOf(player) === 1 && cacheHas(player, "first_kill_captn") && cacheGet(player, "first_kill_captn")) {
                        //dialogue only on stage 1
                        //talking after captain is killed -> special dialogue bet and sets false flag
                        let completed = false;
                        if (!cacheHas(player, "mercenary_bet")) {
                            await npc.say(
                                "Well, you've killed our Captain.",
                                "I guess you've proved yourself in combat.",
                                "However, you've left a horrible mess now.",
                                "And it's gonna cost you for us to clean it up.",
                                "Let's say 20 gold and we won't have to get rough with you?"
                            );
                            const opts = await player.ask(
                                ["Yeah, ok, I'll give you 20 gold.",
                                    "I'll give you 15, that's all you're gettin'",
                                    "You can whistle for you money, I'll take you all on."
                                ],
                                false
                            );
                            if (opts === 0) {
                                await player.say("Yeah, ok, I'll give you 20 gold.");
                                if (player.inventory.has(ITEM.COINS, 20)) {
                                    player.inventory.remove(ITEM.COINS, 20);
                                    await npc.say("Good! Seeya, we have some cleaning to do.");
                                    completed = true;
                                } else {
                                    await npc.say("You don't have the gold and now we're gonna teach you a lesson.");
                                    await mes(player, "The Guards search you!");
                                    await mercenaryDialogue(player, npc, Mercenary.LEAVE_DESERT);
                                    completed = true;
                                }
                            } else if (opts === 1) {
                                await player.say("I'll give you 15, that's all you're gettin'");
                                if (player.inventory.has(ITEM.COINS, 15)) {
                                    player.inventory.remove(ITEM.COINS, 15);
                                    await npc.say("Ok, we'll take fifteen, you push a hard bargain!");
                                    completed = true;
                                } else {
                                    await npc.say("You don't have the gold and now we're gonna teach you a lesson.");
                                    await mes(player, "The Guards search you!");
                                    await mercenaryDialogue(player, npc, Mercenary.LEAVE_DESERT);
                                    completed = true;
                                }
                            } else if (opts === 2) {
                                await player.say("You can whistle for your money, I'll take you all on.");
                                await npc.say("Ok, that's it, we're gonna teach you a lesson.");
                                await mes(player, "The Guards search you!");
                                await mercenaryDialogue(player, npc, Mercenary.LEAVE_DESERT);
                                completed = true;
                            }
                        } else {
                            await player.say("Hey, I've come to collect my bet!");
                            await npc.say("Well, I guess congratulations are in order.");
                            await player.say("Thanks!");
                            await npc.say("And we'll only charge the paltry sum of..erm...");
                            await mes(player, "The guards starts to do some mental calculations...");
                            await mes(player, "You can see his brow furrow and he starts to sweat profusely");
                            switch (cacheGet(player, "mercenary_bet")) {
                                case 5:
                                    await npc.say("Five gold for cleaning up the mess.", "You have won 1 Gold piece!");
                                    player.inventory.add(ITEM.COINS, 1);
                                    break;
                                case 10:
                                    await npc.say("10 gold for cleaning up the mess.", "You have won 2 Gold pieces!");
                                    player.inventory.add(ITEM.COINS, 2);
                                    break;
                                case 15:
                                    await npc.say("15 gold for cleaning up the mess.", "You have won 4 Gold pieces!");
                                    player.inventory.add(ITEM.COINS, 4);
                                    break;
                                case 20:
                                    await npc.say("20 gold for cleaning up the mess.", "You have won 10 Gold pieces!");
                                    player.inventory.add(ITEM.COINS, 10);
                                    break;
                            }
                            await npc.say("Well done..!", "Ha, ha, ha ha!");
                            player.message("The guards walk off chuckling to themselves.");
                            completed = true;
                        }
                        if (completed) {
                            cacheSet(player, "first_kill_captn", false);
                        }
                        return;
                    }

                    await npc.say("Yeah, what do you want?");
                    const option = await player.ask(
                        ["What is this place?",
                            "What are you guarding?",
                            "I'm looking for a woman called Ana, have you seen her?"
                        ],
                        true
                    );
                    if (option === 0) {
                        await mercenaryDialogue(player, npc, Mercenary.PLACE_START);
                    } else if (option === 1) {
                        await mercenaryDialogue(player, npc, Mercenary.GUARDING_FIRST);
                    } else if (option === 2) {
                        await mercenaryDialogue(player, npc, Mercenary.ANA_FIRST);
                    }
                    break;
                case 6:
                case 7:
                case 8:
                case 9:
                case 10:
                    await npc.say("Move along now..we've had enough of your sort!");
                    break;
                case -1:
                    await npc.say("What're you looking at?");
                    break;
            }
        }
        switch (cID) {
            case Mercenary.THROW_PLAYER:
                await npc.say(
                    "Don't try to fool me, you don't have five gold coins!",
                    "Before you try to bribe someone, make sure you have the money effendi!"
                );
                await mercenaryDialogue(player, npc, Mercenary.LEAVE_DESERT);
                break;
            case Mercenary.THROW_PRISON:
                await mes(player, "The Guards search you!");
                let rand = randomInt(0, 3);
                if (player.inventory.has(ITEM.CELL_DOOR_KEY) && rand === 0) {
                    player.message("The guards find the cell door key and remove it!");
                    player.inventory.remove(ITEM.CELL_DOOR_KEY, 1);
                }
                if (player.inventory.has(ITEM.METAL_KEY) && rand === 1) {
                    player.message("The guards find the main gate key and remove it!");
                    player.inventory.remove(ITEM.METAL_KEY, 1);
                }
                await mes(player, "More guards rush to catch you.");
                await mes(player, "You are roughed up a bit by the guards as you're manhandlded to a cell.");
                if (npc !== null) {
                    await npc.say("Into the cell you go! I hope this teaches you a lesson.");
                }
                player.teleport(89, 801);
                break;
            case Mercenary.LEAVE_DESERT:
                await npc.say("Guards, guards!");
                if (!npc.opponent) {
                    attackPlayer(player, npc);
                }
                await mes(player, "Nearby guards quickly grab you and rough you up a bit.");
                await npc.say("Let's see how good you are with desert survival techniques!");
                await mes(player, "You're bundled into the back of a cart and blindfolded...");
                await mes(player, "Sometime later you wake up in the desert.");
                // TODO: can also take waterskins and replace them with single empty waterskin.
                if (player.inventory.has(ITEM.BOWL_OF_WATER)) {
                    await npc.say("You won't be needing that water any more!");
                    await mes(player, "The guards throw your water away...");
                    player.inventory.remove(ITEM.BOWL_OF_WATER, 1);
                }
                let desertLoc = desertTPPoints[Math.floor(Math.random() * desertTPPoints.length)];
                player.teleport(desertLoc.x, desertLoc.y);
                break;
            case Mercenary.PLACE_START:
                await npc.say("It's none of your business now get lost.");
                const menu = await player.ask(["Perhaps five gold coins will make it my business?", "Ok, thanks."], true);
                if (menu === 0) {
                    await npc.say("It certainly will!");
                    if (player.inventory.has(ITEM.COINS, 5)) {
                        player.message("The guard takes the five gold coins.");
                        player.inventory.remove(ITEM.COINS, 5);
                        await npc.say("Now then, what did you want to know?");
                        const secondMenu = await player.ask(["What is this place?", "What are you guarding?"], true);
                        if (secondMenu === 0) {
                            await mercenaryDialogue(player, npc, Mercenary.PLACE_SECOND);
                        } else if (secondMenu === 1) {
                            await mercenaryDialogue(player, npc, Mercenary.GUARDING_SECOND);
                        }
                    } else {
                        await mercenaryDialogue(player, npc, Mercenary.THROW_PLAYER);
                    }
                } else if (menu === 1) {
                    await npc.say("Yeah, whatever!");
                }
                break;
            case Mercenary.PLACE_SECOND:
                await npc.say(
                    "It's just a mining camp. Prisoners are sent here from Al Kharid.",
                    "They serve out their sentence by mining.",
                    "Most prisoners will end their days here, surrounded by desert."
                );
                await player.say("So you could almost say that they got their... 'just desserts'");
                await npc.say("You could say that...");
                await mes(player, "There is an awkward pause");
                await npc.say("But it wouldn't be very funny.");
                await mes(player, "There is another awkward pause.");
                await player.say("When they talk about the silence of the desert,", "this must be what they mean.");
                player.message("The guard starts losing interest in the conversation.");
                const options = await player.ask(["Can I take a look around the place?", "Ok thanks."], true);
                if (options === 0) {
                    await npc.say(
                        "Not really. The Captain won't let you in the compound.",
                        "He's the only one who has the key to the gate.",
                        "And if you talk to him, he'll probably just order us to kill you.",
                        "Unless..."
                    );
                    const newMenu = await player.ask(["Does the Captain order you to kill a lot of people?", "Unless what?"], true);
                    if (newMenu === 0) {
                        await mercenaryDialogue(player, npc, Mercenary.ORDER_KILL_PEOPLE);
                    } else if (newMenu === 1) {
                        await npc.say(
                            "Unless he has a use for you.",
                            "He's been trying to track down a someone called 'Al Zaba Bhasim'.",
                            "You could offer to catch him and that might put you in his good books?"
                        );
                        const tenthMenu = await player.ask(["Where would I find this Al Zaba Bhasim?", "Ok thanks."], true);
                        if (tenthMenu === 0) {
                            await npc.say(
                                "Well, he could be anywhere, he's a nomadic desert dweller.",
                                "However, he is frequently to be found to the west in the ",
                                "hospitality of the tenti's."
                            );
                            const eleventhMenu = await player.ask([//do not send over
                                "The Tenti's, who are they?", "Ok thanks."], false);
                            if (eleventhMenu === 0) {
                                await player.say("The Tenti's, who are they?");
                                await npc.say(
                                    "Well, we're not really sure what they're proper name is.",
                                    "But they live in tents so we call them the 'Tenti's'."
                                );
                                const twelftMenu = await player.ask([//do not send over
                                    "Ok thanks.", "Is Al Zaba Bhasim very tough?"], false);
                                if (twelftMenu === 0) {
                                    await player.say("Ok, thanks.");
                                    await npc.say("Yeah, whatever!");
                                } else if (twelftMenu === 1) {
                                    await player.say("Is Al Zaba Bhasim very tough?");
                                    await npc.say(
                                        "Well, I'm not sure, but by all accounts, he is a slippery fellow.",
                                        "The Captain has been trying to capture him for years.",
                                        "A bit of a waste of time if you ask me.",
                                        "Anyway, I have to get going, I do have work to do."
                                    );
                                    player.message("The guard walks off.");
                                }
                            } else if (eleventhMenu === 1) {
                                await player.say("Ok, thanks.");
                                await npc.say("Yeah, whatever!");
                            }
                        } else if (tenthMenu === 1) {
                            await npc.say("Yeah, whatever!");
                        }
                    }
                } else if (options === 1) {
                    await npc.say("Yeah, whatever!");
                }
                break;
            case Mercenary.ORDER_KILL_PEOPLE:
                player.message("The guard snorts.");
                await npc.say(
                    "*Snort*",
                    "Just about anyone who talks to him.",
                    "Unless he has a use for you, he'll probably just order us to kill you.",
                    "And it's such a horrible job cleaning up the mess afterwards."
                );
                const sixthMenu = await player.ask(["Not to mention the senseless waste of human life.", "Ok thanks."], true);
                if (sixthMenu === 0) {
                    await npc.say("Heh?");
                    await mes(player, "The guard looks at you with a confused stare...");
                    const seventhMenu = await player.ask(
                        ["It doesn't sound as if you respect your Captain much.",
                            "Ok thanks."
                        ],
                        false
                    );
                    if (seventhMenu === 0) {
                        await player.say("It doesn't sound is if you respect your Captain much.");
                        await npc.say("Well, to be honest.");
                        await mes(player, "The guard looks around conspiratorially.");
                        await npc.say(
                            "We think he's not exactly as brave as he makes out.",
                            "But we have to follow his orders.",
                            "If someone called him a coward, ",
                            "or managed to trick him into a one-on-one duel.",
                            "Many of us bet that he'll be slaughtered in double quick time.",
                            "And all the men agreed that they wouldn't intervene."
                        );
                        const eightMenu = await player.ask([//do not send over
                            "Can I have a bet on that?", "Ok Thanks."], false);
                        if (eightMenu === 0) {
                            await player.say("Can I have a bet on that?");
                            if (cacheHas(player, "mercenary_bet")) {
                                await npc.say(
                                    "Sorry, we've already taken your bet, wouldn't want any cheating now.",
                                    "Anyway, I have to get back to work. See ya around..."
                                );
                                return;
                            }
                            await npc.say(
                                "Well, if you think you stand a chance, sure.",
                                "But remember, if he gives us an order, we have to obey."
                            );
                            const ninthMenu = await player.ask(
                                ["I'll bet 5 gold that I win.",
                                    "I'll bet 10 gold that I win.",
                                    "I'll bet 15 gold that I win.",
                                    "I'll bet 20 gold that I win.",
                                    "Ok, thanks."
                                ],
                                true
                            );
                            if (ninthMenu >= 0 && ninthMenu <= 3) {
                                let betAmount = 5, recvAmount = 6;
                                if (ninthMenu === 0) {
                                    betAmount = 5;
                                    recvAmount = 6;
                                } else if (ninthMenu === 1) {
                                    betAmount = 10;
                                    recvAmount = 12;
                                } else if (ninthMenu === 2) {
                                    betAmount = 15;
                                    recvAmount = 19;
                                } else if (ninthMenu === 3) {
                                    betAmount = 20;
                                    recvAmount = 30;
                                }
                                if (player.inventory.has(ITEM.COINS, betAmount)) {
                                    await npc.say("Great, I'll take that bet.");
                                    player.message("You hand over " + betAmount + " gold coins.");
                                    player.inventory.remove(ITEM.COINS, betAmount);
                                    await npc.say("Ok, if you win, you'll get " + recvAmount + "gold back.");
                                    cacheSet(player, "mercenary_bet", betAmount);
                                }
                                await npc.say("Anyway, I have to get going, I do have work to do.");
                                player.message("The guard walks off.");
                            } else if (ninthMenu === 4) {
                                await npc.say("Yeah, whatever!");
                            }
                        } else if (eightMenu === 1) {
                            await player.say("Ok, thanks.");
                            await npc.say("Yeah, whatever!");
                        }
                    } else if (seventhMenu === 1) {
                        await player.say("Ok, thanks.");
                        await npc.say("Yeah, whatever!");
                    }
                } else if (sixthMenu === 1) {
                    await npc.say("Yeah, whatever!");
                }
                break;
            case Mercenary.GUARDING_FIRST:
                await npc.say("Get lost before I chop off your head!");
                const chopMenu = await player.ask(
                    ["Ok thanks.",
                        "Perhaps these five gold coins will sweeten your mood?"
                    ],
                    false
                );
                if (chopMenu === 0) {
                    await player.say("Ok, thanks.");
                    await npc.say("Yeah, whatever!");
                } else if (chopMenu === 1) {
                    await player.say("Perhaps these five gold coins will sweeten your mood?");
                    if (player.inventory.has(ITEM.COINS, 5)) {
                        await npc.say("Well, it certainly will help...");
                        player.message("The guard takes the five gold coins.");
                        player.inventory.remove(ITEM.COINS, 5);
                        await npc.say("Now then, what did you want to know?");
                        const knowMenu = await player.ask(
                            ["What is this place?",
                                "What are you guarding?",
                                "I'm looking for a woman called Ana, have you seen her?"
                            ],
                            true
                        );
                        if (knowMenu === 0) {
                            await mercenaryDialogue(player, npc, Mercenary.PLACE_SECOND);
                        } else if (knowMenu === 1) {
                            await mercenaryDialogue(player, npc, Mercenary.GUARDING_SECOND);
                        } else if (knowMenu === 2) {
                            await mercenaryDialogue(player, npc, Mercenary.ANA_SECOND);
                        }
                    } else {
                        await mercenaryDialogue(player, npc, Mercenary.THROW_PLAYER);
                    }
                }
                break;
            case Mercenary.GUARDING_SECOND:
                await npc.say("Well, if you have to know, we're making sure that no prisoners get out.");
                await mes(player, "The guard gives you a disaproving look.");
                await npc.say("And to make sure that unauthorised people don't get in.");
                await mes(player, "The guard looks around nervously.");
                await npc.say("You'd better go now before the Captain orders us to kill you.");
                const gmenu = await player.ask([//do not send over
                    "Does the Captain order you to kill a lot of people?", "Ok Thanks."], false);
                if (gmenu === 0) {
                    await player.say("Does the Captain order you to kill a lot of people?");
                    await mercenaryDialogue(player, npc, Mercenary.ORDER_KILL_PEOPLE);
                } else if (gmenu === 2) {
                    await player.say("Ok, thanks.");
                    await npc.say("Yeah, whatever!");
                }
                break;
            case Mercenary.ANA_FIRST:
                await npc.say("No, now get lost!");
                const altMenu = await player.ask(["Perhaps five gold coins will help you remember?", "Ok, thanks."], true);
                if (altMenu === 0) {
                    await npc.say("Hmm, it might help!");
                    if (player.inventory.has(ITEM.COINS, 5)) {
                        player.message("The guards takes the five gold coins.");
                        player.inventory.remove(ITEM.COINS, 5);
                        await npc.say("Now then, what did you want to know?");
                        const anaMenu = await player.ask(
                            ["I'm looking for a woman called Ana, have you seen her?",
                                "What is this place?",
                                "What are you guarding?"
                            ],
                            true
                        );
                        if (anaMenu === 0) {
                            await mercenaryDialogue(player, npc, Mercenary.ANA_SECOND);
                        } else if (anaMenu === 1) {
                            await mercenaryDialogue(player, npc, Mercenary.PLACE_SECOND);
                        } else if (anaMenu === 2) {
                            await mercenaryDialogue(player, npc, Mercenary.GUARDING_SECOND);
                        }
                    } else {
                        await mercenaryDialogue(player, npc, Mercenary.THROW_PLAYER);
                    }
                } else if (altMenu === 1) {
                    await npc.say("Yeah, whatever!");
                }
                break;
            case Mercenary.ANA_SECOND:
                await npc.say(
                    "Hmm, well, we get a lot of people in here.",
                    "But not many women though...",
                    "Saw one come in last week....",
                    "But I don't know if it's the woman you're looking for?"
                );
                const lastMenu = await player.ask(["What is this place?", "What are you guarding?"], true);
                if (lastMenu === 0) {
                    await mercenaryDialogue(player, npc, Mercenary.PLACE_SECOND);
                } else if (lastMenu === 1) {
                    await mercenaryDialogue(player, npc, Mercenary.GUARDING_SECOND);
                }
                break;
        }
    }
}

async function mercenaryCaptainDialogue(player, npc, cID) {
    if (npc.id === NPC.MERCENARY_CAPTAIN) {
        if (cID === -1) {
            switch (stageOf(player)) {
                case 0:
                case 1:
                case 2:
                case 3:
                case 4:
                case 5:
                case 6:
                case 7:
                case 8:
                case 9:
                case 10:
                case -1:
                    if (player.inventory.has(ITEM.METAL_KEY)) {
                        await npc.say("Move along now...we've had enough of your sort!");
                        return;
                    }
                    player.message("You approach the Mercenary Captain.");
                    const menu = await player.ask(["Hello.", "You there!", "Hey ugly!"], true);
                    if (menu === 0) {
                        await npc.say("Be off Effendi, you are not wanted around here.");
                        const be = await player.ask(
                            ["That's rude, I ought to teach you some manners.",
                                "I 'll offer you something in return for your time."
                            ],
                            true
                        );
                        if (be === 0) {
                            await npc.say(
                                "Oh yes! How might you do that?",
                                "You seem little more than a gutter dweller.",
                                "How could you teach me manners?"
                            );
                            const manners = await player.ask(
                                ["With my right fist and a good deal of force.",
                                    "Err, sorry, I thought I was talking to someone else."
                                ],
                                false
                            );
                            if (manners === 0) {
                                await player.say("With my good right arm and a good deal of force.");
                                await npc.say(
                                    "Oh yes, ready your weapon then!",
                                    "I'm sure you won't mind if my men join in?",
                                    "Har, har, har!",
                                    "Guards, kill this gutter dwelling slime."
                                );
                                await captainWantToThrowPlayer(player, npc);
                            } else if (manners === 1) {
                                await player.say("Err, sorry, I thought I was talking to someone else.");
                                await npc.say(
                                    "Well, Effendi, you do need to be carefull of what you say to people.",
                                    "Or they may take it the wrong way.",
                                    "Thankfully, I'm very understanding.",
                                    "I'll just let me guards deal with you.",
                                    "Guards, teach this desert weed some manners."
                                );
                                await captainWantToThrowPlayer(player, npc);
                            }
                        } else if (be === 1) {
                            await npc.say("Hmmm, oh yes, what might that be?");
                            const menus = await player.ask(["I have some gold.", "There must be something that I can do for you?"], true);
                            if (menus === 0) {
                                await npc.say(
                                    "Ha, ha, ha! You come to a mining camp and offer us gold!",
                                    "Thanks effendi, but we have all the gold that we'll ever need.",
                                    "Now be off with you,",
                                    "before we reduce you to a bloody mess on the sand."
                                );
                                const option = await player.ask(["There must be something that I can do for you?", "You don't scare me!"], true);
                                if (option === 0) {
                                    await mercenaryCaptainDialogue(player, npc, MercenaryCaptain.MUSTBESOMETHINGICANDO);
                                } else if (option === 1) {
                                    await mercenaryCaptainDialogue(player, npc, MercenaryCaptain.DONTSCAREME);
                                }
                            } else if (menus === 1) {
                                await mercenaryCaptainDialogue(player, npc, MercenaryCaptain.MUSTBESOMETHINGICANDO);
                            }
                        }
                    } else if (menu === 1) {
                        await npc.say(
                            "How dare you talk to me like that!",
                            "Explain your business quickly...",
                            "or my guards will slay you where you stand."
                        );
                        player.message("Some guards close in around you.");
                        const thirdMenu = await player.ask(["I'm lost, can you help me?", "What are you guarding?"], true);
                        if (thirdMenu === 0) {
                            await mes(player, "The captain smiles broadly and with a sickening voice says.");
                            await npc.say(
                                "We are not a charity effendi,",
                                "Be off with you before I have your head removed from your body."
                            );
                            const lostMenu = await player.ask(["What are you guarding?", "You don't scare me!"], true);
                            if (lostMenu === 0) {
                                await mercenaryCaptainDialogue(player, npc, MercenaryCaptain.GUARDING);
                            } else if (lostMenu === 1) {
                                await mercenaryCaptainDialogue(player, npc, MercenaryCaptain.DONTSCAREME);
                            }
                        } else if (thirdMenu === 1) {
                            await mercenaryCaptainDialogue(player, npc, MercenaryCaptain.GUARDING);
                        }
                    } else if (menu === 2) {
                        await npc.say(
                            "I will not tolerate such insults..",
                            TEXT.TouristTrapMercenaryCaptainGuardsKillThem
                        );
                        await mes(player, "The captain marches away in disgust leaving his guards to tackle you.");
                        await captainWantToThrowPlayer(player, npc);
                    }
                    break;
            }
            // 102, 775
        }
        switch (cID) {
            case MercenaryCaptain.GUARDING:
                await npc.say(
                    "Effendi...",
                    "For just one second, imagine that it's none of your business!",
                    "Also imagine having your limbs pulled from your body one at a time.",
                    "Now, what was the question again?"
                );
                const fourthMenu = await player.ask(["Do you have sand in your ears, I said, 'What are you guarding?'", "You don't scare me!"], true);
                if (fourthMenu === 0) {
                    await npc.say("Why....you ignorant, rude and eternally damned infidel,");
                    player.message("The captain seems very agitated with what you just said.");
                    await npc.say("Guards, kill this infidel!");
                    await captainWantToThrowPlayer(player, npc);
                } else if (fourthMenu === 1) {
                    await mercenaryCaptainDialogue(player, npc, MercenaryCaptain.DONTSCAREME);
                }
                break;
            case MercenaryCaptain.DONTSCAREME:
                await npc.say("Well, perhaps I can try a little harder.", "Guards, kill this infidel.");
                await captainWantToThrowPlayer(player, npc);
                break;
            case MercenaryCaptain.MUSTBESOMETHINGICANDO:
                player.message("The Captain ponders a moment and then looks at you critically.");
                await npc.say(
                    "You could bring me the head of Al Zaba Bhasim.",
                    "He is the leader of the notorius desert bandits, they plague us daily.",
                    "You should find them west of here.",
                    "You should have no problem in finishing them all off.",
                    "Do this for me and maybe I will consider helping you."
                );
                if (!cacheHas(player, "find_al_bhasim")) {
                    cacheSet(player, "find_al_bhasim", true);
                }
                const doThis = await player.ask(["Consider it done.", "I don't think I can do that."], true);
                if (doThis === 0) {
                    await npc.say("Good...run along then.", "You stand around flapping your tongue chatting like an insane camel.");
                } else if (doThis === 1) {
                    await npc.say(
                        "Hmm, well yes, I did consider that you might not be right for the job.",
                        "Be off with you then before I turn my men loose on you."
                    );
                    const no = await player.ask(
                        ["I guess you can't fight your own battles then?",
                            "Ok, I'll move on."
                        ],
                        false
                    );
                    if (no === 0) {
                        await player.say("I guess you can't fight your own battles then?");
                        player.message("The men around you fall silent and the Captain silently fumes.");
                        await player.world.sleepTicks(3);
                        player.message("All eyes turn to the Captain...");
                        await npc.say("Very well, if you're challenging me, let's get on with it!");
                        player.message("The guards gather around to watch the fight.");
                        attackPlayer(player, npc);
                    } else if (no === 1) {
                        await player.say("Ok, I'll be moving along then.");
                        await npc.say("Effendi, I think you'll find that is the ", "wisest decision you have made today.");
                    }
                }
                break;
        }
    }
}

async function slaveDialogue(player, npc, cID) {
    if (npc.id === NPC.MINING_SLAVE) {
        if (cID === -1) {
            switch (stageOf(player)) {
                case 0:
                case 1:
                    await npc.say("You look like a new 'recruit'.", "How long have you been here?");
                    const menu = await player.ask(["I've just arrived.", "Oh, I've been here ages."], true);
                    if (menu === 0) {
                        await npc.say("Yeah, it looks like it as well.");
                        await slaveDialogue(player, npc, Slave.NEWRECRUIT);
                    } else if (menu === 1) {
                        await npc.say(
                            "That's funny, I haven't seen you around here before.",
                            "You're clothes look too clean for you to have been here ages."
                        );
                        const secondMenu = await player.ask(["Ok, you caught me out.", "The guards allow me to clean my clothes."], true);
                        if (secondMenu === 0) {
                            await npc.say("Ah ha! I knew it! A new recruit then?");
                            await slaveDialogue(player, npc, Slave.NEWRECRUIT);
                        } else if (secondMenu === 1) {
                            await npc.say(
                                "Oh, a special relationship with the guards heh?",
                                "How very nice of them.",
                                "Maybe you could persuade them to let me out of here?"
                            );
                            await mes(player, "The slave swaggers of with a sarcastic smirk on his face.");
                        }
                    }
                    break;
                case 2:
                    await npc.say("Hello again, are you ready to unlock my chains?");
                    const opt = await player.ask(["Yeah, Ok, let's give it a go.", "I need to do some other things first."], true);
                    if (opt === 0) {
                        await slaveDialogue(player, npc, Slave.GIVEITAGO);
                    } else if (opt === 1) {
                        await npc.say("Ok, fair enough, let me know when you want to give it another go.");
                    }
                    break;
                case 3:
                    await npc.say("Do you have the Desert Clothes yet?");
                    await necessaryStuffSlave(player, npc);
                    break;
                case 4:
                case 5:
                case 6:
                case 7:
                case 8:
                case 9:
                case 10:
                case -1:
                    if (inTouristTrapCave(player)) {
                        await npc.say("Can't you see I'm busy?");
                        if ((!player.inventory.isEquipped(ITEM.SLAVES_ROBE_BOTTOM)
                            || !player.inventory.isEquipped(ITEM.SLAVES_ROBE_TOP)) && stageOf(player) !== -1) {
                            player.message("A guard notices you and starts running after you.");
                            let npcN = nearNpc(player, NPC.MERCENARY, 10);
                            if (npcN === null) {
                                npcN = spawnNpc(player, NPC.MERCENARY, player.x, player.y, 60000);
                                await player.world.sleepTicks(2);
                            }
                            await npcN.say("Hey! You're no slave!");
                            attackPlayer(player, npcN);
                            await mes(player, "The Guards search you!");
                            if (player.inventory.has(ITEM.CELL_DOOR_KEY)) {
                                player.message("The guards find the cell door key and remove it!");
                                player.inventory.remove(ITEM.CELL_DOOR_KEY, 1);
                            }
                            await mes(player, "Some guards rush to help their comrade.");
                            await mes(player, "You are roughed up a bit by the guards as you're manhandlded into a cell.");
                            await npcN.say("Into the cell you go! I hope this teaches you a lesson.");
                            if (stageOf(player) >= 9) {
                                player.teleport(74, 3626);
                            } else {
                                player.teleport(89, 801);
                            }
                        }
                    } else if (player.inventory.has(ITEM.SLAVES_ROBE_BOTTOM)
                        && player.inventory.has(ITEM.SLAVES_ROBE_TOP)) {
                        await npc.say("Not much to do here but mine all day long.");
                    } else {
                        await npc.say(
                            "Oh bother, I was caught by the guards again...",
                            "Listen, if you can get me some Desert Clothes,",
                            " I'll trade you for my slaves clothes again..",
                            "Do you want to trade?"
                        );
                        const trade = await player.ask(["Yes, I'll trade.", "No thanks..."], true);
                        if (trade === 0) {
                            await necessaryStuffSlave(player, npc);
                        } else if (trade === 1) {
                            await npc.say("Ok, fair enough, let me know if you change your mind though.");
                        }
                    }
                    break;
            }
        }
        switch (cID) {
            case Slave.NEWRECRUIT:
                await npc.say(
                    "It's a shame that I won't be around long enough to get to know you.",
                    "I'm making a break for it today.",
                    "I have a plan to get out of here!",
                    "It's amazing in it's sophistication."
                );
                const thirdMenu = await player.ask(
                    ["What are those big wooden doors in the corner of the compound?",
                        "Oh yes, that sounds interesting."
                    ],
                    true
                );
                if (thirdMenu === 0) {
                    await npc.say(
                        "They lead to an underground mine,",
                        "but you really don't want to go down there.",
                        "I've only seen slaves and guards go down there,",
                        "I never see the slaves come back up.",
                        "At least up here you have a nice view and a bit of sun."
                    );
                    await mes(player, "The slave smiles at you happily and then goes back to his work.");
                } else if (thirdMenu === 1) {
                    await npc.say("Yes, it is actually.", "I have all the details figured out except for one.");
                    const four = await player.ask([//do not send over
                        "What's that then?", "Oh, that's a shame."], false);
                    if (four === 0) {
                        await player.say("What's that then?");
                        await mes(player, "The slave shakes his arms and the chains rattle loudly.");
                        await npc.say(
                            "These bracelets, I can't seem to get them off.",
                            "If I could get them off, I'd be able to climb my way",
                            "out of here."
                        );
                        const five = await player.ask(["I can try to undo them for you.", "That's ridiculous, you're talking rubbish."], true);
                        if (five === 0) {
                            await slaveDialogue(player, npc, Slave.UNDOTHEM);
                        } else if (five === 1) {
                            await npc.say("No, it's true, I can make a break for it", "If I can just get these bracelets off.");
                            const six = await player.ask(["Good luck!", "I can try to undo them for you."], true);
                            if (six === 0) {
                                await npc.say("Thanks...same to you.");
                            } else if (six === 1) {
                                await slaveDialogue(player, npc, Slave.UNDOTHEM);
                            }
                        }
                    } else if (four === 1) {
                        await player.say("Oh, that's a shame...", "Still, 'worse things happen at sea right?'");
                        await npc.say(
                            "You've obviously never worked as a slave",
                            "...in a mining camp...",
                            "...in the middle of the desert"
                        );
                        await player.say("Well I suppose I'd better be getting on my way now...");
                        player.message("The slave nods in agreement and goes back to work.");
                    }
                }
                break;
            case Slave.UNDOTHEM:
                await npc.say("Really, that would be great...");
                await mes(player, "The slave looks at you strangely.");
                await npc.say(
                    "Hang on a minute...I suppose you want something for doing this?",
                    "The last time I did a trade in this place,",
                    "I nearly lost the shirt from my back!"
                );
                const trade = await player.ask([//do not send over
                    "It's funny you should say that...", "That sounds awful."], false);
                if (trade === 0) {
                    await player.say("It's funny you should say that actually.");
                    await mes(player, "The slave looks at you blankly.");
                    await npc.say("Yeah, go on!");
                    await player.say("If I can get the chains off, you have to give me something, ok?");
                    await npc.say("Sure, what do you want?");
                    await player.say(
                        "I want your clothes!",
                        "I can dress like a slave and gain access to the mine area to scout it out."
                    );
                    await npc.say(
                        "Blimey! You're either incredibly brave or incredibly stupid.",
                        "But what would I wear if you take my clothes?",
                        "Get me some nice desert clothes and I'll think about it?",
                        "Do you still want to try and undo the locks for me?"
                    );
                    setStage(player, 2);
                    cacheDel(player, "first_kill_captn");
                    cacheDel(player, "mercenary_bet");
                    const go = await player.ask(["Yeah, Ok, let's give it a go.", "I need to do some other things first."], true);
                    if (go === 0) {
                        await slaveDialogue(player, npc, Slave.GIVEITAGO);
                    } else if (go === 1) {
                        await npc.say("Ok, fair enough, let me know when you want to give it another go.");
                    }
                } else if (trade === 1) {
                    await player.say("That sounds awful.");
                    await npc.say(
                        "Yeah, bunch of no hopers, tried to rob me blind.",
                        "But I guess that's what you get when you deal with convicts."
                    );
                }
                break;
            case Slave.GIVEITAGO:
                await npc.say("Great!");
                await mes(player, "You use some nearby bits of wood and wire to try and pick the lock.");
                let attempt1 = randomInt(0, 1);
                //failed attempt 1
                if (attempt1 === 0) {
                    await mes(player, "You fail!");
                    await mes(player, "You didn't manage to pick the lock this time, would you like another go?");
                    const anotherGo = await player.ask(["Yeah, I'll give it another go.", "I'll try something different instead."], true);
                    if (anotherGo === 0) {
                        await mes(player, "You use some nearby bits of wood and wire to try and pick the lock.");
                        let attempt2 = randomInt(0, 1);
                        //failed attempt 2
                        if (attempt2 === 0) {
                            await mes(player, "You fail!");
                            let mercenary = nearNpc(player, NPC.MERCENARY, 15);
                            if (mercenary !== null) {
                                await mes(player, "A nearby guard spots you!");
                                await npc.say("Oh oh!");
                                await mercenary.say("Oi, what are you two doing?");
                                attackPlayer(player, mercenary);
                                await mes(player, "The Guards search you!");
                                await mes(player, "More guards rush to catch you.");
                                await mes(player, "You are roughed up a bit by the guards as you're manhandlded to a cell.");
                                await mercenary.say("Into the cell you go! I hope this teaches you a lesson.");
                                player.teleport(89, 801);
                            }
                        } else {
                            await succeedFreeSlave(player, npc);
                        }
                    } else if (anotherGo === 1) {
                        await mes(player, "You decide to try something else.");
                        await npc.say("Are you givin in already?");
                        await player.say("I just want to try something else.");
                        await npc.say("Ok, if you want to try again, let me know.");
                    }
                } else {
                    await succeedFreeSlave(player, npc);
                }

                break;
        }
    }
}

async function succeedFreeSlave(player, npc) {
    await mes(player, "You hear a satisfying 'click' as you tumble the lock mechanism.");
    await npc.say("Great! You did it!");

    await necessaryStuffSlave(player, npc);
}

async function necessaryStuffSlave(player, npc) {
    if (player.inventory.has(ITEM.DESERT_SHIRT)
        && player.inventory.has(ITEM.DESERT_ROBE)
        && player.inventory.has(ITEM.DESERT_BOOTS)) {
        await npc.say("Great! You have the Desert Clothes!");
        await mes(player, "The slave starts getting undressed right in front of you.");
        await npc.say("Ok, here's the clothes, I won't need them anymore.");
        await mes(player, "The slave gives you his dirty, flea infested robe.");
        await mes(player, "The slave gives you his muddy, sweat soaked shirt.");
        player.inventory.remove(ITEM.DESERT_ROBE, 1);
        player.inventory.add(ITEM.SLAVES_ROBE_BOTTOM);
        player.inventory.remove(ITEM.DESERT_SHIRT, 1);
        player.inventory.add(ITEM.SLAVES_ROBE_TOP);
        player.inventory.remove(ITEM.DESERT_BOOTS, 1);
        let newSlave = changeNpc(player, npc, NPC.ESCAPING_MINING_SLAVE);
        await player.world.sleepTicks(2);
        await delayedReturnSlave(player, newSlave);
        await newSlave.say("Right, I'm off! Good luck!");
        await player.say("Yeah, good luck to you too!");
        if (stageOf(player) === 2 || stageOf(player) === 3)
            setStage(player, 4);
        return;
    }

    if (!player.inventory.has(ITEM.DESERT_SHIRT)
        && !player.inventory.has(ITEM.DESERT_ROBE)
        && !player.inventory.has(ITEM.DESERT_BOOTS)) {
        await npc.say("I need a desert shirt, robe and boots if you want these clothes off me.");
    } else if (!player.inventory.has(ITEM.DESERT_SHIRT)
        && !player.inventory.has(ITEM.DESERT_ROBE)
        && player.inventory.has(ITEM.DESERT_BOOTS)) {
        await npc.say("I need desert robe and shirt if you want these clothes off me.");
    } else if (!player.inventory.has(ITEM.DESERT_SHIRT)
        && player.inventory.has(ITEM.DESERT_ROBE)
        && !player.inventory.has(ITEM.DESERT_BOOTS)) {
        await npc.say("I need a desert shirt and boots if you want these clothes off me.");
    } else if (player.inventory.has(ITEM.DESERT_SHIRT)
        && !player.inventory.has(ITEM.DESERT_ROBE)
        && !player.inventory.has(ITEM.DESERT_BOOTS)) {
        await npc.say("I need desert robe and boots if you want these clothes off me.");
    } else if (!player.inventory.has(ITEM.DESERT_SHIRT)
        && player.inventory.has(ITEM.DESERT_ROBE)
        && player.inventory.has(ITEM.DESERT_BOOTS)) {
        await npc.say("I need a desert shirt if you want these clothes off me.");
    } else if (player.inventory.has(ITEM.DESERT_SHIRT)
        && !player.inventory.has(ITEM.DESERT_ROBE)
        && player.inventory.has(ITEM.DESERT_BOOTS)) {
        await npc.say("I need desert robe if you want these clothes off me.");
    } else if (player.inventory.has(ITEM.DESERT_SHIRT)
        && player.inventory.has(ITEM.DESERT_ROBE)
        && !player.inventory.has(ITEM.DESERT_BOOTS)) {
        await npc.say("I need desert boots if you want these clothes off me.");
    }

    if (stageOf(player) === 2)
        setStage(player, 3);
}

async function escapingSlaveDialogue(player, n) {
    await n.say("Hey, I'm trying to escape!", "You're attracting too much attention to me!", "See ya!");
}

async function mercenaryInsideDialogue(player, npc, cID) {
    if (npc.id === NPC.MERCENARY_ESCAPEGATES) {
        if (cID === -1) {
            if (inTouristTrapCave(player)) {
                if (!player.inventory.isEquipped(ITEM.SLAVES_ROBE_BOTTOM)
                    || !player.inventory.isEquipped(ITEM.SLAVES_ROBE_TOP)) {
                    player.message("This guard looks as if he's been down here a while.");
                    await npc.say("Hey, you're no slave!", "What are you doing down here?");
                    attackPlayer(player, npc);
                    if (stageOf(player) !== -1) {
                        await mes(player, "More guards rush to catch you.");
                        await mes(player, "You are roughed up a bit by the guards as you're manhandlded to a cell.");
                        await npc.say("Into the cell you go! I hope this teaches you a lesson.");
                        player.teleport(89, 801);
                    }
                    return;
                }
                if (stageOf(player) >= 9 || stageOf(player) === -1) {
                    player.message("This guard looks as if he's been down here a while.");
                    await npc.say("That pineapple was just delicious, many thanks.", "I don't suppose you could get me another?");
                    player.message("The guard looks at you pleadingly.");
                    return;
                }
                player.message("This guard looks as if he's been down here a while.");
                await npc.say("Yeah, what do you want?");
                const mama = await player.ask(["Er nothing really.", "I'd like to mine in a different area."], true);
                if (mama === 0) {
                    await npc.say("Ok...so move along and get on with your work.");
                } else if (mama === 1) {
                    await npc.say("Oh, so you want to work in another area of the mine heh?");
                    await mes(player, "The guard seems quite pleased with his rhetorical question.");
                    await npc.say("Well, I can understand that, a change is as good as a rest they say.");
                    const menu = await player.ask(["Huh, fat chance of a rest for me.", "Yes sir, you're quite right sir."], true);
                    if (menu === 0) {
                        await npc.say("You miserable whelp!", "Get back to work!");
                        player.damage(2);
                        player.message("The guard cuffs you around head.");
                    } else if (menu === 1) {
                        await npc.say(
                            "Of course I'm right...",
                            "And what goes around comes around as they say.",
                            "And it's been absolutely ages since I've had anything different to eat.",
                            "What I wouldn't give for some ripe and juicy pineapple for a change.",
                            "And those Tenti's have the best pineapple in this entire area."
                        );
                        player.message("The guard winks at you.");
                        await npc.say("I'm sure you get my meaning...");
                        const pus = await player.ask(
                            ["How am I going to get some pineapples around here?",
                                "Yes sir, we understand each other perfectly.",
                                "What are the 'Tenti's'?"
                            ],
                            true
                        );
                        if (pus === 0) {
                            await mercenaryInsideDialogue(player, npc, MercenaryInside.PINEAPPLES);
                        } else if (pus === 1) {
                            await mercenaryInsideDialogue(player, npc, MercenaryInside.UNDERSTAND);
                        } else if (pus === 2) {
                            await npc.say(
                                "Well, you really don't come from around here do you?",
                                "The tenti's are what we call the nomadic people west of here.",
                                "They live in tents, so we call them the tenti's",
                                "They have great pineapples!",
                                "I'm sure you get my meaning..."
                            );
                            const pus2 = await player.ask(
                                ["How am I going to get some pineapples around here?",
                                    "Yes sir, we understand each other perfectly."
                                ],
                                true
                            );
                            if (pus2 === 0) {
                                await mercenaryInsideDialogue(player, npc, MercenaryInside.PINEAPPLES);
                            } else if (pus2 === 1) {
                                await mercenaryInsideDialogue(player, npc, MercenaryInside.UNDERSTAND);
                            }
                        }
                    }
                }
                return;
            }
            player.message("This guard looks as if he's been in the sun for a while.");
            await npc.say("Move along now...");
        }
        switch (cID) {
            case MercenaryInside.PINEAPPLES:
                if (stageOf(player) === 4) {
                    setStage(player, 5);
                }
                await npc.say(
                    "Well, that's not my problem is it?",
                    "Also, I know that you slaves trade your items down here.",
                    "I'm sure that if you're resourceful enough, you'll come up with the goods.",
                    "Now, get along and do some work, before we're both in for it."
                );
                break;
            case MercenaryInside.UNDERSTAND:
                if (stageOf(player) === 4) {
                    setStage(player, 5);
                }
                await npc.say("Ok, good then.");
                player.message("The guard moves back to his post and winks at you knowingly.");
                break;
        }
    }
}

async function bedabinNomadDialogue(player, npc, cID) {
    if (npc.id === NPC.BEDABIN_NOMAD) {
        if (cID === -1) {
            await npc.say("Hello Effendi!", "How can I help you?");
            const menu = await player.ask(
                ["What is this place?",
                    "Where is the Shantay Pass?",
                    "Buy a jug of water - 5 Gold Pieces.",
                    "Buy a full waterskin - 20 Gold Pieces.",
                    "Buy a bucket of water - 20 Gold Pieces."
                ],
                false
            );
            if (menu === 0) {
                await player.say("What is this place?");
                await bedabinNomadDialogue(player, npc, BedabinNomad.PLACE);
            } else if (menu === 1) {
                await player.say("Where is the Shantay Pass.");
                await bedabinNomadDialogue(player, npc, BedabinNomad.SHANTAYPASS);
            } else if (menu === 2) {
                await player.say("Buy a jug of water - 5 Gold Pieces.");
                await bedabinNomadDialogue(player, npc, BedabinNomad.JUGOFWATER);
            } else if (menu === 3) {
                await player.say("Buy a full waterskin - 25 Gold Pieces.");
                await bedabinNomadDialogue(player, npc, BedabinNomad.FULLWATERSKIN);
            } else if (menu === 4) {
                await player.say("Buy a bucket of water - 20 Gold Pieces.");
                await bedabinNomadDialogue(player, npc, BedabinNomad.BUCKETOFWATER);
            }
        }
        switch (cID) {
            case BedabinNomad.BUCKETOFWATER:
                if (player.inventory.has(ITEM.COINS, 20)) {
                    await mes(player, "You hand over 20 gold pieces.");
                    player.inventory.remove(ITEM.COINS, 20);
                    await npc.say("Very well Effendi!");
                    await mes(player, "You recieve a bucket of water.");
                    player.inventory.add(ITEM.BUCKET_OF_WATER, 1);
                } else {
                    await mes(player, "Sorry Effendi, you don't seem to have the money.");
                }
                await npc.say("How can I help you?");
                const newMenu = await player.ask(
                    ["What is this place?",
                        "Where is the Shantay Pass.",
                        "Buy a jug of water - 5 Gold Pieces.",
                        "Buy a full waterskin - 25 Gold Pieces.",
                        "Buy a bucket of water - 20 Gold Pieces."
                    ],
                    true
                );
                if (newMenu === 0) {
                    await bedabinNomadDialogue(player, npc, BedabinNomad.PLACE);
                } else if (newMenu === 1) {
                    await bedabinNomadDialogue(player, npc, BedabinNomad.SHANTAYPASS);
                } else if (newMenu === 2) {
                    await bedabinNomadDialogue(player, npc, BedabinNomad.JUGOFWATER);
                } else if (newMenu === 3) {
                    await bedabinNomadDialogue(player, npc, BedabinNomad.FULLWATERSKIN);
                } else if (newMenu === 4) {
                    await bedabinNomadDialogue(player, npc, BedabinNomad.BUCKETOFWATER);
                }

                break;
            case BedabinNomad.FULLWATERSKIN:
                if (player.inventory.has(ITEM.COINS, 25)) {
                    await mes(player, "You hand over 25 gold pieces.");
                    player.inventory.remove(ITEM.COINS, 25);
                    await npc.say("Very well Effendi!");
                    await mes(player, "You recieve a full waterskin.");
                    player.inventory.add(ITEM.FULL_WATER_SKIN, 1);
                } else {
                    await mes(player, "Sorry Effendi, you don't seem to have the money.");
                }
                await npc.say("How can I help you?");
                const option = await player.ask(
                    ["What is this place?",
                        "Where is the Shantay Pass.",
                        "Buy a jug of water - 5 Gold Pieces.",
                        "Buy a full waterskin - 25 Gold Pieces.",
                        "Buy a bucket of water - 20 Gold Pieces."
                    ],
                    true
                );
                if (option === 0) {
                    await bedabinNomadDialogue(player, npc, BedabinNomad.PLACE);
                } else if (option === 1) {
                    await bedabinNomadDialogue(player, npc, BedabinNomad.SHANTAYPASS);
                } else if (option === 2) {
                    await bedabinNomadDialogue(player, npc, BedabinNomad.JUGOFWATER);
                } else if (option === 3) {
                    await bedabinNomadDialogue(player, npc, BedabinNomad.FULLWATERSKIN);
                } else if (option === 4) {
                    await bedabinNomadDialogue(player, npc, BedabinNomad.BUCKETOFWATER);
                }
                break;
            case BedabinNomad.JUGOFWATER:
                if (player.inventory.has(ITEM.COINS, 5)) {
                    await mes(player, "You hand over 5 gold pieces.");
                    player.inventory.remove(ITEM.COINS, 5);
                    await npc.say("Very well Effendi!");
                    await mes(player, "You recieve a jug full or water.");
                    player.inventory.add(ITEM.JUG_OF_WATER, 1);
                } else {
                    await mes(player, "Sorry Effendi, you don't seem to have the money.");
                }
                await npc.say("How can I help you?");
                const optiony = await player.ask(
                    ["What is this place?",
                        "Where is the Shantay Pass.",
                        "Buy a jug of water - 5 Gold Pieces.",
                        "Buy a full waterskin - 25 Gold Pieces.",
                        "Buy a bucket of water - 20 Gold Pieces."
                    ],
                    true
                );
                if (optiony === 0) {
                    await bedabinNomadDialogue(player, npc, BedabinNomad.PLACE);
                } else if (optiony === 1) {
                    await bedabinNomadDialogue(player, npc, BedabinNomad.SHANTAYPASS);
                } else if (optiony === 2) {
                    await bedabinNomadDialogue(player, npc, BedabinNomad.JUGOFWATER);
                } else if (optiony === 3) {
                    await bedabinNomadDialogue(player, npc, BedabinNomad.FULLWATERSKIN);
                } else if (optiony === 4) {
                    await bedabinNomadDialogue(player, npc, BedabinNomad.BUCKETOFWATER);
                }
                break;
            case BedabinNomad.PLACE:
                await npc.say("This is the camp of the Bedabin.", "Talk to our leader, Al Shabim, he'll be happy to chat.");
                player.message("We can sell you very reasonably priced water...");
                await npc.say("How can I help you?");
                const opt = await player.ask(
                    ["Where is the Shantay Pass.",
                        "Buy a jug of water - 5 Gold Pieces.",
                        "Buy a full waterskin - 25 Gold Pieces.",
                        "Buy a bucket of water - 20 Gold Pieces."
                    ],
                    true
                );
                if (opt === 0) {
                    await bedabinNomadDialogue(player, npc, BedabinNomad.SHANTAYPASS);
                } else if (opt === 1) {
                    await bedabinNomadDialogue(player, npc, BedabinNomad.JUGOFWATER);
                } else if (opt === 2) {
                    await bedabinNomadDialogue(player, npc, BedabinNomad.FULLWATERSKIN);
                } else if (opt === 3) {
                    await bedabinNomadDialogue(player, npc, BedabinNomad.BUCKETOFWATER);
                }

                break;
            case BedabinNomad.SHANTAYPASS:
                await npc.say(
                    "It is North East of here effendi, across the trackless desert.",
                    "It will be a thirsty trip, can I interest you in a drink?",
                    "How can I help you?"
                );
                const options = await player.ask(
                    ["Buy a jug of water - 5 Gold Pieces.",
                        "What is this place?",
                        "Buy a full waterskin - 25 Gold Pieces.",
                        "Buy a bucket of water - 20 Gold Pieces."
                    ],
                    true
                );
                if (options === 0) {
                    await bedabinNomadDialogue(player, npc, BedabinNomad.JUGOFWATER);
                } else if (options === 1) {
                    await bedabinNomadDialogue(player, npc, BedabinNomad.PLACE);
                } else if (options === 2) {
                    await bedabinNomadDialogue(player, npc, BedabinNomad.FULLWATERSKIN);
                } else if (options === 3) {
                    await bedabinNomadDialogue(player, npc, BedabinNomad.BUCKETOFWATER);
                }
                break;
        }
    }
}

async function alShabimDialogue(player, npc, cID) {
    if (npc.id === NPC.AL_SHABIM) {
        if (cID === -1) {
            switch (stageOf(player)) {
                case 0:
                    await npc.say("Hello Effendi!", "I am Al Shabim, greetings on behalf of the Bedabin nomads.");
                    const menu = await player.ask(["What is this place?", "Goodbye!"], true);
                    if (menu === 0) {
                        await alShabimDialogue(player, npc, AlShabim.WHATISTHISPLACE);
                    } else if (menu === 1) {
                        await npc.say("Very well, good day Effendi!");
                    }
                    break;
                case 1:
                case 2:
                case 3:
                case 4:
                    await npc.say("Hello Effendi!", "I am Al Shabim, greetings on behalf of the Bedabin nomads.");
                    let menuO;
                    if (cacheHas(player, "find_al_bhasim") &&
                        !player.inventory.has(ITEM.METAL_KEY)) {
                        menuO = await player.ask(["I am looking for Al Zaba Bhasim.", "What is this place?"], true);
                        if (menuO === 0) {
                            await npc.say(
                                "Huh! You have been talking to the guards at the mining camp.",
                                "Or worse, that cowardly mercenary captain.",
                                "Al Zaba Bhasim does not exist, he is a figment of their imagination!",
                                "Go back and tell this captain that if he wants to find this man",
                                "he should search for him personally.",
                                "See how much of his own time he would like to waste."
                            );
                        } else if (menuO === 1) {
                            await alShabimDialogue(player, npc, AlShabim.WHATISTHISPLACE);
                        }
                    } else {
                        menuO = await player.ask(["What is this place?", "Goodbye!"], true);
                        if (menuO === 0) {
                            await alShabimDialogue(player, npc, AlShabim.WHATISTHISPLACE);
                        } else if (menuO === 1) {
                            await npc.say("Very well, good day Effendi!");
                        }
                    }
                    break;
                case 5:
                    await npc.say("Hello Effendi!", "I am Al Shabim, greetings on behalf of the Bedabin nomads.");
                    const option = await player.ask(["I am looking for a pineapple.", "What is this place?"], true);
                    if (option === 0) {
                        await npc.say(
                            "Oh yes, well that is interesting.",
                            "Our sweet pineapples are renowned throughout the whole of Kharid !",
                            "And I'll give you one if you do me a favour?"
                        );
                        await player.say("Yes ?");
                        await npc.say(
                            "Captain Siad at the mining camp is holding some secret information.",
                            "It is very important to us and we would like you to get it for us.",
                            "It gives details of an interesting, yet ancient weapon.",
                            "We would gladly share this information with you.",
                            "All you have to do is gain access to his private room upstairs.",
                            "We have a key for the chest that contains this information.",
                            "Are you interested in our deal?"
                        );
                        const opt = await player.ask(["Yes, I'm interested.", "Not at the moment."], true);
                        if (opt === 0) {
                            await npc.say(
                                "That's great Effendi!",
                                "Here is a copy of the key that should give you access to the chest.",
                                "Bring us back the plans inside the chest, they should be sealed.",
                                "All haste to you Effendi!"
                            );
                            player.inventory.add(ITEM.BEDOBIN_COPY_KEY, 1);
                            setStage(player, 6);
                        } else if (opt === 1) {
                            await npc.say("Very well Effendi!");
                        }
                    } else if (option === 1) {
                        await alShabimDialogue(player, npc, AlShabim.WHATISTHISPLACE);
                    }
                    break;
                case 6:
                case 7:
                    await npc.say("Hello Effendi!");
                    if (player.inventory.has(ITEM.PROTOTYPE_THROWING_DART)) {
                        await alShabimDialogue(player, npc, AlShabim.MADE_WEAPON);
                    } else if (player.inventory.has(ITEM.TECHNICAL_PLANS)
                        && !player.inventory.has(ITEM.PROTOTYPE_THROWING_DART)) {
                        await alShabimDialogue(player, npc, AlShabim.HAVE_PLANS);
                    } else if (player.inventory.has(ITEM.BEDOBIN_COPY_KEY)
                        && !player.inventory.has(ITEM.TECHNICAL_PLANS)) {
                        await npc.say("How are things going Effendi?");
                        const dede = await player.ask(["Very well thanks!", "Not so good actually!", "What is this place?", "Goodbye!"], true);
                        if (dede === 0) {
                            if (!cacheHas(player, "tech_plans")) {
                                await npc.say("Well, hurry along and get those plans for me.");
                            } else {
                                await npc.say("I really need those plans!");
                            }
                        } else if (dede === 1) {
                            if (!cacheHas(player, "tech_plans")) {
                                await npc.say("Well, first you need to get those plans from Captain Siad.");
                            } else {
                                await npc.say("Bring me the plans from Captain Siad's office...they're in a chest.");
                            }
                        } else if (dede === 2) {
                            await alShabimDialogue(player, npc, AlShabim.WHATISTHISPLACE);
                        } else if (dede === 3) {
                            await npc.say("Very well, good day Effendi!");
                        }
                    } else if (cacheHas(player, "tech_plans")) {
                        const keke = await player.ask(["I've lost the key and the plans!", "What is this place?", "Goodbye!"], true);
                        if (keke === 0) {
                            await npc.say("How very careless of you!");
                            player.message("Al Shabim thinks for a moment.");
                            await npc.say(
                                "The Captain may have some new plans drawn up.",
                                "Go back and see if you can collect them.",
                                "Here is the key you'll need for the chest!"
                            );
                            player.message("Al Shabim gives you another key.");
                            player.inventory.add(ITEM.BEDOBIN_COPY_KEY, 1);
                        } else if (keke === 1) {
                            await alShabimDialogue(player, npc, AlShabim.WHATISTHISPLACE);
                        } else if (keke === 2) {
                            await npc.say("Very well, good day Effendi!");
                        }
                    } else {
                        const kaka = await player.ask(["I've lost the key!", "What is this place?", "Goodbye!"], true);
                        if (kaka === 0) {
                            await npc.say("How very careless of you!", "Here is another key, don't lose it this time !");
                            player.message("Al Shabim gives you another key.");
                            player.inventory.add(ITEM.BEDOBIN_COPY_KEY, 1);
                        } else if (kaka === 1) {
                            await alShabimDialogue(player, npc, AlShabim.WHATISTHISPLACE);
                        } else if (kaka === 2) {
                            await npc.say("Very well, good day Effendi!");
                        }
                    }
                    break;
                case 8:
                case 9:
                case 10:
                case -1:
                    if (player.inventory.has(ITEM.PROTOTYPE_THROWING_DART)) {
                        await npc.say(
                            "Hello Effendi!",
                            "Wonderful, I see you have made the new weapon!",
                            "Where did you get this from Effendi!",
                            "I'll have to confiscate this for your own safety!"
                        );
                        player.inventory.remove(ITEM.PROTOTYPE_THROWING_DART, 1);
                        return;
                    }
                    if (player.inventory.has(ITEM.TECHNICAL_PLANS)) {
                        await npc.say("Hello Effendi!");
                        await alShabimDialogue(player, npc, AlShabim.HAVE_PLANS);
                        return;
                    }
                    if (stageOf(player) === 8) {
                        await npc.say("Hello Effendi!", "Many thanks with your help previously Effendi!");
                        if (player.inventory.has(ITEM.TENTI_PINEAPPLE)) {
                            const mopt = await player.ask(["What is this place?", "Goodbye!"], true);
                            if (mopt === 0) {
                                await alShabimDialogue(player, npc, AlShabim.WHATISTHISPLACE);
                            } else if (mopt === 1) {
                                await npc.say("Very well, good day Effendi!");
                            }
                        } else {
                            const mopt = await player.ask(["I am looking for a pineapple.", "What is this place?"], true);
                            if (mopt === 0) {
                                await npc.say("Here is another pineapple, try not to lose this one.");
                                player.message("Al Shabim gives you another pineapple.");
                                player.inventory.add(ITEM.TENTI_PINEAPPLE, 1);
                            } else if (mopt === 1) {
                                await alShabimDialogue(player, npc, AlShabim.WHATISTHISPLACE);
                            }
                        }
                    } else {
                        await npc.say(
                            "Hello Effendi!",
                            "Many thanks with your help previously Effendi!",
                            "I am Al Shabim, greetings on behalf of the Bedabin nomads."
                        );
                        const mopt = await player.ask(["What is this place?", "Goodbye!"], true);
                        if (mopt === 0) {
                            await alShabimDialogue(player, npc, AlShabim.WHATISTHISPLACE);
                        } else if (mopt === 1) {
                            await npc.say("Very well, good day Effendi!");
                        }
                    }
                    break;
            }
        }
        switch (cID) {
            case AlShabim.WHATISTHISPLACE:
                await npc.say(
                    "This is the home of the Bedabin, ",
                    "We're a peaceful tribe of desert dwellers.",
                    "Some idiots call us 'Tenti's', a childish name borne of ignorance.",
                    "We're renowned for surviving in the harshest desert climate.",
                    "We also grow the 'Bedabin ambrosia.'...",
                    "A pineapple of such delicious sumptiousness that it defies description.",
                    "Take a look around our camp if you like!"
                );
                const menu = await player.ask(["Ok Thanks!", "What is there to do around here?"], true);
                if (menu === 0) {
                    await npc.say("Good day Effendi!");
                } else if (menu === 1) {
                    await npc.say(
                        "Well, we are all very busy most of the time tending to the pineapples.",
                        "They are grown in a secret location.",
                        "To stop thieves from raiding our most precious prize."
                    );
                }
                break;
            case AlShabim.HAVE_PLANS:
                await npc.say(
                    "Aha! I see you have the plans.",
                    "This is great!",
                    "However, these plans do indeed look very technical",
                    "My people have further need of your skills.",
                    "If you can help us to manufacture this item,",
                    "we will share it's secret with you.",
                    "Does this deal interest you effendi?"
                );
                const tati = await player.ask(["Yes, I'm very interested.", "No, sorry."], true);
                if (tati === 0) {
                    if (player.inventory.has(ITEM.BRONZE_BAR)
                        && player.inventory.has(ITEM.FEATHER, 10)) {
                        await npc.say("Aha! I see you have the items we need!", "Are you still willing to help make the weapon?");
                        const make = await player.ask(["Yes, I'm kind of curious.", "No,sorry."], true);
                        if (make === 0) {
                            await npc.say(
                                "Ok Effendi, you need to follow the plans.",
                                "You will need some special tools for this...",
                                "There is a forge in the other tent.",
                                "You have my permision to use it, but show the plans to the guard.",
                                "You have the plans and the all the items needed, ",
                                "You should be able to complete the item on your own.",
                                "Please bring me the item when it is finished."
                            );
                            if (stageOf(player) === 6) {
                                setStage(player, 7);
                            }
                        } else if (make === 1) {
                            await npc.say("As you wish effendi!", "Come back if you change your mind!");
                        }
                    } else {
                        await npc.say(
                            "Great, we need the following items.",
                            "A bar of pure bronze and 10 feathers.",
                            "Bring them to me and we'll continue to make the item."
                        );
                    }
                } else if (tati === 1) {
                    await npc.say("As you wish effendi!", "Come back if you change your mind!");
                }
                break;
            case AlShabim.MADE_WEAPON:
                await npc.say("Wonderful, I see you have made the new weapon!");
                await mes(player, "You show Al Shabim the prototype dart.");
                player.inventory.remove(ITEM.PROTOTYPE_THROWING_DART, 1);
                await npc.say("This is truly fantastic Effendi!");
                if (player.inventory.has(ITEM.TECHNICAL_PLANS)) {
                    await npc.say("We will take the technical plans for the weapon as well.");
                    player.inventory.remove(ITEM.TECHNICAL_PLANS, 1);
                    await mes(player, "You hand over the technical plans for the weapon.");
                }
                await npc.say(
                    "We are forever grateful for this gift.",
                    "My advisors have discovered some secrets which we will share with you."
                );
                await mes(player, "Al Shabim's advisors show you some advanced techniques for making the new weapon.");
                await npc.say("Oh, and here is your pineapple!");
                player.inventory.add(ITEM.TENTI_PINEAPPLE, 1);
                await npc.say("Please accept this selection of six bronze throwing darts", "as a token of our appreciation.");
                player.inventory.add(ITEM.BRONZE_THROWING_DART, 6);
                if (player.inventory.has(ITEM.BEDOBIN_COPY_KEY)) {
                    await npc.say("I'll take that key off your hands as well effendi!");
                    player.inventory.remove(ITEM.BEDOBIN_COPY_KEY, 1);
                    await npc.say("Many thanks!");
                }
                player.message("");
                player.message("********************************************************************");
                player.message("*** You can now make a new weapon type: Throwing dart. ***");
                player.message("********************************************************************");
                setStage(player, 8); //>= 8 or -1 for throwing darts.
                break;
        }
    }
}

async function captainSiadDialogue(player, npc, cID, obj) {
    // USED FOR CHEST AND TALK-TO
    if (npc.id === NPC.CAPTAIN_SIAD) {
        if (cID === -1) {
            switch (stageOf(player)) {
                case 0:
                case 1:
                case 2:
                case 3:
                case 4:
                case 5:
                case 6:
                case 7:
                case 8:
                case 9:
                case 10:
                case -1:
                    if (obj !== null) {
                        await mes(player, "The captains spots you before you manage to open the chest...");
                    } else {
                        await mes(player, "The captain looks up from his work as you address him.");
                    }
                    if (player.inventory.has(ITEM.TECHNICAL_PLANS) || stageOf(player) >= 8 || stageOf(player) === -1) {
                        await npc.say("I don't have time to talk to you.", "Move along please!");
                        return;
                    }
                    await npc.say("What are you doing in here?");
                    const menu = await player.ask(
                        ["I wanted to have a chat?",
                            "What's it got to do with you?",
                            "Prepare to die!",
                            "All the slaves have broken free!",
                            "Fire!Fire!"
                        ],
                        true
                    );
                    if (menu === 0) {
                        await npc.say("You don't belong in here, get out!");
                        const m = await player.ask(
                            ["But I just need two minutes of your time?",
                                "Prepare to die!",
                                "All the slaves have broken free!",
                                "Fire!Fire!",
                                "You seem to have a lot of books!"
                            ],
                            true
                        );
                        if (m === 0) {
                            await captainSiadDialogue(player, npc, Siad.TWOMINUTES, null);
                        } else if (m === 1) {
                            await captainSiadDialogue(player, npc, Siad.PREPARETODIE, null);
                        } else if (m === 2) {
                            await captainSiadDialogue(player, npc, Siad.SLAVESBROKENFREE, null);
                        } else if (m === 3) {
                            await captainSiadDialogue(player, npc, Siad.FIREFIRE, null);
                        } else if (m === 4) {
                            await captainSiadDialogue(player, npc, Siad.BOOKS, null);
                        }
                    } else if (menu === 1) {
                        await npc.say("This happens to be my office.", "Now explain yourself before I run you through!");
                        const keke = await player.ask(["The guard downstairs said you were lonely.", "I need to service your chest."], true);
                        if (keke === 0) {
                            await captainSiadDialogue(player, npc, Siad.LONELY, null);
                        } else if (keke === 1) {
                            await captainSiadDialogue(player, npc, Siad.SERVICE, null);
                        }
                    } else if (menu === 2) {
                        await captainSiadDialogue(player, npc, Siad.PREPARETODIE, null);
                    } else if (menu === 3) {
                        await captainSiadDialogue(player, npc, Siad.SLAVESBROKENFREE, null);
                    } else if (menu === 4) {
                        await captainSiadDialogue(player, npc, Siad.FIREFIRE, null);
                    }
                    break;
            }
        }
        switch (cID) {
            case Siad.PREPARETODIE:
                await npc.say("I'll teach you a lesson!", "Guards! Guards!");
                await captainSiadDialogue(player, npc, Siad.PUNISHED, null);
                break;
            case Siad.PUNISHED:
                await mes(player, "The Guards search you!");
                let rand = randomInt(0, 3);
                if (player.inventory.has(ITEM.CELL_DOOR_KEY) && rand === 0) {
                    player.message("The guards find the cell door key and remove it!");
                    player.inventory.remove(ITEM.CELL_DOOR_KEY, 1);
                }
                if (player.inventory.has(ITEM.METAL_KEY) && rand === 1) {
                    player.message("The guards find the main gate key and remove it!");
                    player.inventory.remove(ITEM.METAL_KEY, 1);
                }
                await mes(player, "Some guards rush to help the captain.");
                await mes(player, "You are roughed up a bit by the guards as you're manhandlded into a cell.");
                player.damage(7);
                await mes(player, "@yel@Guards: Into the cell you go! I hope this teaches you a lesson.");
                player.teleport(89, 801);
                break;
            case Siad.TWOMINUTES:
                await npc.say("Well, ok, but very quickly.", "I am a very busy person you know!");
                const menu = await player.ask(["Well, er...erm, I err....", "Oh my, a dragon just flew straight past your window!"], true);
                if (menu === 0) {
                    await captainSiadDialogue(player, npc, Siad.ERM, null);
                } else if (menu === 1) {
                    await captainSiadDialogue(player, npc, Siad.DRAGON, null);
                }
                break;
            case Siad.SLAVESBROKENFREE:
                if (!succeedRate(player)) {
                    await npc.say(
                        "Don't talk rubbish, the warning siren isn't sounding.",
                        "Now state your business before I have you thrown out."
                    );
                    const gay = await player.ask(["The guard downstairs said you were lonely.", "I need to service your chest."], true);
                    if (gay === 0) {
                        await captainSiadDialogue(player, npc, Siad.LONELY, null);
                    } else if (gay === 1) {
                        await captainSiadDialogue(player, npc, Siad.SERVICE, null);
                    }
                } else {
                    await mes(player, "The captain seems distracted with what you just said.");
                    await mes(player, "The captain looks out of the window to see if there are any prisoners escaping.");
                    if (!cacheHas(player, "tourist_chest")) {
                        cacheSet(player, "tourist_chest", true); // if don't have the key, remove the cache.
                    }
                }
                break;
            case Siad.ERM:
                await npc.say("Come on, spit it out!", "Right that's it!", "Guards!");
                await captainSiadDialogue(player, npc, Siad.PUNISHED, null);
                break;
            case Siad.SERVICE:
                await npc.say("You need to what?");
                await player.say("I need to service your chest?");
                await npc.say("There's nothing wrong with the chest, it's fine, now get out!");
                const fire = await player.ask(["I'm here to take your plans, hand them over now or I'll kill you!", "Fire!Fire!"], true);
                if (fire === 0) {
                    await captainSiadDialogue(player, npc, Siad.PLANS, null);
                } else if (fire === 1) {
                    await captainSiadDialogue(player, npc, Siad.FIREFIRE, null);
                }
                break;
            case Siad.DRAGON:
                if (!succeedRate(player)) {
                    await npc.say(
                        "Really! Where?",
                        "I don't see any dragons young man?",
                        "Now, please get out of my office, I have work to do."
                    );
                    player.message("The Captain goes back to his work.");
                } else {
                    await captainSiadDialogue(player, npc, Siad.SUCCEED, null);
                }
                break;
            case Siad.LONELY:
                await mes(player, "The captain gives you a puzzled look.");
                await npc.say(
                    "Well, I most certainly am not lonely!",
                    "I'm an incredibly busy man you know!",
                    "Now, get to the point, what do you want?"
                );
                const opt = await player.ask(["Well, er...erm, I err....", "I need to service your chest."], true);
                if (opt === 0) {
                    await captainSiadDialogue(player, npc, Siad.ERM, null);
                } else if (opt === 1) {
                    await captainSiadDialogue(player, npc, Siad.SERVICE, null);
                }
                break;
            case Siad.PLANS:
                await npc.say("Don't be silly!", "I'm going to teach you a lesson!", "Guards! Guards!");
                await captainSiadDialogue(player, npc, Siad.PUNISHED, null);
                break;
            case Siad.SUCCEED:
                await mes(player, "The captain seems distracted with what you just said.");
                await mes(player, "The captain looks out of the window for the dragon.");
                if (!cacheHas(player, "tourist_chest")) {
                    cacheSet(player, "tourist_chest", true); // if don't have the key, remove the cache.
                }
                break;
            case Siad.FIREFIRE:
                if (!succeedRate(player)) {
                    await npc.say("Where's the fire?", "I don't see any fire?");
                    const fireMenu = await player.ask(
                        ["It's down in the lower mines, sound the alarm!",
                            "Oh yes,  you're right, they must have put it out!"
                        ],
                        true
                    );
                    if (fireMenu === 0) {
                        await npc.say(
                            "You go and sound the alarm, I can't see anything wrong with the mine.",
                            "Have you seen the fire yourself?"
                        );
                        const variableF = await player.ask(["Yes actually!", "Er, no, one of the slaves told me."], true);
                        if (variableF === 0) {
                            await npc.say("Well, why didn't you raise the alarm?");
                            const variableG = await player.ask(
                                ["I don't know where the alarm is.",
                                    "I was so concerned for your safety that I rushed to save you."
                                ],
                                true
                            );
                            if (variableG === 0) {
                                await npc.say(
                                    "That's the most ridiculous thing I've heard.",
                                    "Who are you? Where do you come from?",
                                    "It doesn't matter..."
                                );
                                await mes(player, "The Captain shouts the guards...");
                                await npc.say("Guards!", "Show this person out!");
                                await captainSiadDialogue(player, npc, Siad.PUNISHED, null);
                            } else if (variableG === 1) {
                                await npc.say(
                                    "Well, that's very good of you.",
                                    "But as you can see, I am very fine and well thanks!",
                                    "Now, please leave so that I can get back to my work."
                                );
                                player.message("The Captain goes back to his desk.");
                            }
                        } else if (variableF === 1) {
                            await npc.say(
                                "Well...you can't believe them, they're all a bunch of convicts.",
                                "Anyway, it doesn't look as if there is a fire down there.",
                                "So I'm going to get on with my work.",
                                "Please remove yourself from my office."
                            );
                            player.message("The Captain goes back to his desk and starts studying.");
                        }
                    } else if (fireMenu === 1) {
                        await npc.say("Good, now perhaps you can leave me in peace?", "After all I do have some work to do.");
                        const er = await player.ask(["Er, yes Ok then.", "Well, er...erm, I err...."], true);
                        if (er === 0) {
                            await npc.say("Good!", "Please remove yourself from my office.");
                            player.message("The Captain goes back to his desk and starts studying.");
                        } else if (er === 1) {
                            await captainSiadDialogue(player, npc, Siad.ERM, null);
                        }
                    }
                } else {
                    await mes(player, "The captain seems distracted with what you just said.");
                    await mes(player, "The captain looks out of the window to see if is a fire.");
                    if (!cacheHas(player, "tourist_chest")) {
                        cacheSet(player, "tourist_chest", true); // if don't have the key, remove the cache.
                    }
                }
                break;
            case Siad.BOOKS:
                await npc.say("Yes, I do. Now please get to the point?");
                let books = 0;
                if (cacheHas(player, "sailing")) {
                    books = await player.ask(
                        ["How long have you been interested in books?",
                            "I could get you some books!",
                            "So, you're interested in sailing?"
                        ],
                        true
                    );
                } else {
                    books = await player.ask(["How long have you been interested in books?", "I could get you some books!"], true);
                }
                if (books === 0) {
                    await npc.say("Long enough to know when someone is stalling!", "Ok, that's it, get out!", "Guards!");
                    await captainSiadDialogue(player, npc, Siad.PUNISHED, null);
                } else if (books === 1) {
                    await npc.say("Oh, really!", "Sorry, not interested!", "GUARDS!");
                    await captainSiadDialogue(player, npc, Siad.PUNISHED, null);
                } else if (books === 2) {
                    player.message("The captain's interest seems to perk up.");
                    await npc.say("Well, yes actually...", "It's been a passion of mine for some years...");
                    const sail = await player.ask(["I could tell by the cut of your jib.", "Not much sailing to be done around here though?"], true);
                    if (sail === 0) {
                        await npc.say("Oh yes? Really?");
                        player.message("The Captain looks flattered.");
                        await npc.say("Well, you know, I was quite the catch in my day you know!");
                        await mes(player, "The captain starts rambling on about his days as a salty sea dog.");
                        await mes(player, "He looks quite distracted...");
                        if (!cacheHas(player, "tourist_chest")) {
                            cacheSet(player, "tourist_chest", true); // if don't have the key, remove the cache.
                        }
                    } else if (sail === 1) {
                        player.message("The captain frowns slightly...");
                        await npc.say("Well of course there isn't, we're surrounded by desert.", "Now, why are you here exactly?");
                        const again = await player.ask(["Oh my, a dragon just flew straight past your window!", "Well, er...erm, I err...."], true);
                        if (again === 0) {
                            await captainSiadDialogue(player, npc, Siad.DRAGON, null);
                        } else if (again === 1) {
                            await captainSiadDialogue(player, npc, Siad.ERM, null);
                        }
                    }
                }
                break;
        }
    }
}

async function anaDialogue(player, npc, cID) {
    if (cID === -1) {
        if (stageOf(player) === -1) {
            player.message("This slave does not appear interested in talking to you.");
            return;
        }
        if ((!player.inventory.isEquipped(ITEM.SLAVES_ROBE_BOTTOM)
            || !player.inventory.isEquipped(ITEM.SLAVES_ROBE_TOP)) && stageOf(player) !== -1) {
            player.message("A guard notices you and starts running after you.");
            let npcN = nearNpc(player, NPC.MERCENARY, 10);
            if (npcN === null) {
                npcN = spawnNpc(player, NPC.MERCENARY, player.x, player.y, 60000);
                await player.world.sleepTicks(2);
            }
            await npcN.say("Hey! You're no slave!");
            attackPlayer(player, npcN);
            await mes(player, "The Guards search you!");
            if (player.inventory.has(ITEM.CELL_DOOR_KEY)) {
                await mes(player, "The guards find the cell door key and remove it!");
                player.inventory.remove(ITEM.CELL_DOOR_KEY, 1);
            }
            await mes(player, "Some guards rush to help their comrade.");
            await mes(player, "You are roughed up a bit by the guards as you're manhandlded into a cell.");
            await npcN.say("Into the cell you go! I hope this teaches you a lesson.");
            player.teleport(75, 3625);
            return;
        }
        await player.say("Hello!");
        await npc.say("Hello there, I don't think I've seen you before.");
        const menu = await player.ask(["No, I'm new here!", "What's your name."], true);
        if (menu === 0) {
            await npc.say(
                "I thought so you know!",
                "How do you like the hospitality down here?",
                "Not exactly Al Kharid Inn style is it?",
                "Well, I guess I'd better get back to work.",
                "Don't want to get into trouble with the guards again."
            );
            const ooo = await player.ask(["Do you get into trouble with guards often?", "I want to try and get you out of here."], true);
            if (ooo === 0) {
                await npc.say(
                    "No, not really, because I'm usually working very hard.",
                    "Come to think of it, I'd better get back to work."
                );
                const often = await player.ask(["Do you enjoy it down here?", "Ok, see ya!"], true);
                if (often === 0) {
                    await npc.say("Of course not!", "I just don't have much choice about it a the moment.");
                    const enjoy = await player.ask(
                        ["I want to try and get you out of here.",
                            "Do you have any ideas about how we can get out of here?"
                        ],
                        true
                    );
                    if (enjoy === 0) {
                        await anaDialogue(player, npc, Ana.TRYGETYOUOUTOFHERE);
                    } else if (enjoy === 1) {
                        await npc.say(
                            "Hmmm, not really, I would have tried them already if I did.",
                            "The guards seem to live in the compound.",
                            "How did you get in there anyway?"
                        );
                        const mmm = await player.ask(
                            ["I managed to sneak past the guards.",
                                "Huh, these guards are rubbish, it was easy to sneak past them!"
                            ],
                            true
                        );
                        if (mmm === 0) {
                            await anaDialogue(player, npc, Ana.SNEAKEDPAST);
                        } else if (mmm === 1) {
                            await anaDialogue(player, npc, Ana.GUARDSRUBBISH);
                        }
                    }
                } else if (often === 1) {
                    await npc.say("Goodbye and good luck!");
                }
            } else if (ooo === 1) {
                await anaDialogue(player, npc, Ana.TRYGETYOUOUTOFHERE);
            }
        } else if (menu === 1) {
            await npc.say(
                "My name? Oh, how sweet, my name is Ana,",
                "I come from Al Kharid, thought the desert might be interesting.",
                "What a surprise I got!"
            );
            const opt = await player.ask(
                ["What kind of suprise did you get?",
                    "Do you want to go back to Al Kharid?"
                ],
                false
            );
            if (opt === 0) {
                await player.say("What kind of surpise did you get?");
                await npc.say(
                    "Well, I was just touring the desert looking for the nomad tribe to west.",
                    "And I was set upon by these armoured men.",
                    "I think that the guards think I am an escaped prisoner.",
                    "They didn't understand that I was exploring the desert as an adventurer."
                );
            } else if (opt === 1) {
                await player.say("Do you want to go back to Al Kharid?");
                await npc.say(
                    "Sure, I miss my Mum, her name is Irena and she is probably waiting for me.",
                    "how do you propose we get out of here though?",
                    "I'm sure you've noticed the many square jawed guards around here.",
                    "You look like you can handle yourself, ",
                    "but I have my doubts that you can take them all on!"
                );
            }
        }
    }
    switch (cID) {
        case Ana.TRYGETYOUOUTOFHERE:
            await npc.say(
                "Wow! You're brave. How do you propose we do that?",
                "In case you hadn't noticed, this place is quite well guarded."
            );
            const menu = await player.ask(["We could try to sneak out.", "Have you got any suggestions?"], true);
            if (menu === 0) {
                await npc.say(
                    "That doesn't sound very likely. How did you get in here anway?",
                    "Did you deliberately hand yourself over to the guards?",
                    "Ha, ha ha ha! Sorry, just kidding."
                );
                const last = await player.ask(
                    ["I managed to sneak past the guards.",
                        "Huh, these guards are rubbish, it was easy to sneak past them!"
                    ],
                    true
                );
                if (last === 0) {
                    await anaDialogue(player, npc, Ana.SNEAKEDPAST);
                } else if (last === 1) {
                    await anaDialogue(player, npc, Ana.GUARDSRUBBISH);
                }
            } else if (menu === 1) {
                await npc.say(
                    "Hmmm, let me think...",
                    "Hmmm.",
                    "No, sorry...",
                    "The only thing that gets out of here is the rock that we mine.",
                    "Not even the dead get a decent funeral.",
                    "Bodies are just thrown down dissused mine holes.",
                    "It's very disrespectful..."
                );
                const gah = await player.ask(["Ok, I'll check around for another way to try and get out.", "How does the rock get out?"], true);
                if (gah === 0) {
                    await npc.say("Good luck!");
                } else if (gah === 1) {
                    await npc.say(
                        "Well, in this section we mine it, ",
                        "Then someone else scoops it into a barrel. ",
                        "The barrels are loaded onto a mine cart.",
                        "Then they're desposited near the surface lift.",
                        "I have no idea where they go from there.",
                        "But that's not going to help us, is it?"
                    );
                    const kaka = await player.ask(
                        ["Maybe? I'll come back to you when I have a plan.",
                            "Where would I get one of those barrels from?"
                        ],
                        true
                    );
                    if (kaka === 0) {
                        await npc.say("Ok, well, I'm not going anywhere!");
                        player.message("Ana nods at a nearby guard!");
                        await npc.say("Unless he feels generous enough to let me go!");
                        player.message("The guard ignores the comment.");
                        await npc.say("Oh well, I'd better get back to work, you take care!");
                    } else if (kaka === 1) {
                        await npc.say("Well, you would get one from around by the lift area.", "But why would you want one of those?");
                        const tjatja = await player.ask(
                            ["Er no reason! Just wondering.",
                                "You could hide in one of those barrels and I could try to sneak you out!"
                            ],
                            true
                        );
                        if (tjatja === 0) {
                            await npc.say(
                                "Hmmm, just don't get any funny ideas...",
                                "I am not going to get into one of those barrels!",
                                "Ok, have you got that?"
                            );
                            await anaDialogue(player, npc, Ana.GOTTHAT);
                        } else if (tjatja === 1) {
                            await npc.say("There is no way that you are getting me into a barrel.", "No WAY! DO you understand?");
                            await anaDialogue(player, npc, Ana.GOTTHAT);
                        }
                    }
                }
            }
            break;
        case Ana.GOTTHAT:
            const gotit = await player.ask(["Ok, yep, I've got that.", "Well, we'll see, it might be the only way."], true);
            if (gotit === 0) {
                await npc.say(
                    "Good, just make sure you keep it in mind.",
                    "Anyway, I have to get back to work.",
                    "The guards will come along soon and give us some trouble else."
                );
            } else if (gotit === 1) {
                await npc.say(
                    "No, there has to be a better way!",
                    "Anyway, I have to get back to work.",
                    "The guards will come along soon and give us some trouble else."
                );
            }
            break;
        case Ana.SNEAKEDPAST:
            await npc.say(
                "Hmm, impressive, but can you so easily sneak out again?",
                "How did you manage to get through the gate?"
            );
            const gosh = await player.ask([//do not send over
                "I have a key", "It's a trade secret!"], false);
            if (gosh === 0) {
                await player.say("I used a key.");
                let guard = spawnNpc(player, NPC.MERCENARY, player.x, player.y, 60000);
                if (guard !== null) {
                    await guard.say("I heard that! So you used a key did you?! ");
                    if (player.inventory.has(ITEM.METAL_KEY)) {
                        await guard.say("Right, we'll have that key off you!");
                        player.inventory.remove(ITEM.METAL_KEY, 1);
                    }
                    await guard.say("Guards! Guards!");
                    attackPlayer(player, guard);
                    await npc.say("Oopps! See ya!");
                    await mes(player, "Some guards rush to help their comrade.");
                    await mes(player, "You are roughed up a bit by the guards as you're manhandlded into a cell.");
                    await guard.say("Into the cell you go! I hope this teaches you a lesson.");
                    player.teleport(75, 3625);
                }
            } else if (gosh === 1) {
                await player.say("It's a trade secret!");
                await npc.say(
                    "Oh, right, well, I guess you know what you're doing.",
                    "Anyway, I have to get back to work.",
                    "The guards will come along soon and give us some trouble else."
                );
            }
            break;
        case Ana.GUARDSRUBBISH:
            let guard = spawnNpc(player, NPC.MERCENARY, player.x, player.y, 60000);
            if (guard !== null) {
                await guard.say("I heard that! So you managed to sneak in did you!", "Guards! Guards!");
                attackPlayer(player, guard);
                await npc.say("Oopps! See ya!");
                await mes(player, "The Guards search you!");
                await mes(player, "Some guards rush to help their comrade.");
                await mes(player, "You are roughed up a bit by the guards as you're manhandlded into a cell.");
                await guard.say("Into the cell you go! I hope this teaches you a lesson.");
                player.teleport(75, 3625);
            }
            break;
    }
}

async function tryToAttackMercenarys(player, affectedmob) {
    // We should probably return if the player is already in combat.
    // This should only happen if the player is trying to mage another guard while in combat.
    // We don't need them fighting two enemies at once, and we don't want them to be able
    // to get teleported if they accidentally cast on another enemy.
    if (player.opponent) return;

    if (affectedmob.id === NPC.CAPTAIN_SIAD) {
        player.message("Captain Siad looks pretty aggressive.");
        player.message("Are you sure you want to attack him?");
        const menu = await player.ask(["Yes, I want to attack him.", "Nope, I've changed my mind."], true);
        if (menu === 0) {
            await affectedmob.say("Guards! Guards!");
            attackPlayer(player, affectedmob);
            await captainSiadDialogue(player, affectedmob, Siad.PUNISHED, null);
        } else if (menu === 1) {
            player.message("You change your mind about attacking the Captain.");
        }
    } else if (affectedmob.id === NPC.MERCENARY_CAPTAIN || affectedmob.id === NPC.MERCENARY || affectedmob.id === NPC.MERCENARY_ESCAPEGATES) {
        player.message("This guard looks fearsome and very aggressive.");
        player.message("Are you sure you want to attack him?");
        const menu = await player.ask(["Yes, I want to attack him.", "Nope, I've changed my mind."], true);
        if (menu === 0) {
            player.message("You decide to attack the guard.");
            await affectedmob.say("Guards! Guards!");
            if (affectedmob.id === NPC.MERCENARY_CAPTAIN) {
                let helpermob = nearNpc(player, NPC.MERCENARY, 10);
                if (helpermob !== null) affectedmob = helpermob;
            }
            attackPlayer(player, affectedmob);
            if (affectedmob.id === NPC.MERCENARY_ESCAPEGATES) {
                player.message("More guards rush to catch you.");
                await mes(player, "You are roughed up a bit by the guards as you're manhandlded to a cell.");
                await affectedmob.say("Into the cell you go! I hope this teaches you a lesson.");
                player.teleport(89, 801);
            } else {
                await affectedmob.say("Guards, guards!");
                await mes(player, "Nearby guards quickly grab you and rough you up a bit.");
                await affectedmob.say("Let's see how good you are with desert survival techniques!");
                await mes(player, "You're bundled into the back of a cart and blindfolded...");
                await mes(player, "Sometime later you wake up in the desert.");
                if (player.inventory.has(ITEM.BOWL_OF_WATER)) {
                    await affectedmob.say("You won't be needing that water any more!");
                    await mes(player, "The guards throw your water away...");
                    player.inventory.remove(ITEM.BOWL_OF_WATER, 1);
                }
                await mes(player, "The guards move off in the cart leaving you stranded in the desert.");
                let desertLoc = desertTPPoints[Math.floor(Math.random() * desertTPPoints.length)];
                player.teleport(desertLoc.x, desertLoc.y);
            }
        } else if (menu === 1) {
            player.message("You decide not to attack the guard.");
        }
    } else if (affectedmob.id === NPC.MERCENARY_LIFTPLATFORM || affectedmob.id === NPC.MERCENARY_JAILDOOR) {
        player.message("This guard looks fearsome and very aggressive.");
        player.message("Are you sure you want to attack him?");
        const menu = await player.ask(["Yes, I want to attack him.", "Nope, I've changed my mind."], true);
        if (menu === 0) {
            player.message("You decide to attack the guard.");
            await affectedmob.say("Guards! Guards!");
            attackPlayer(player, affectedmob);
            if (player.inventory.has(ITEM.ANA_IN_A_BARREL)) {
                await affectedmob.say("Hey, what's in this barrel?", "Right...we'll take that off your hands!");
                await mes(player, "The guards drag Ana into the distance...");
                player.inventory.remove(ITEM.ANA_IN_A_BARREL, 1);
            }
            await mes(player, "Some guards rush to help their comrade.");
            await mes(player, "You are roughed up a bit by the guards as you're manhandlded into a cell.");
            await affectedmob.say("Into the cell you go! I hope this teaches you a lesson.");
            player.teleport(74, 3626);
        } else if (menu === 1) {
            player.message("You decide not to attack the guard.");
        }
    }
}

async function captainWantToThrowPlayer(player, n) {
    n = nearNpc(player, NPC.MERCENARY, 10);
    if (n !== null) {
        let punishment = randomInt(0, 3);
        if (punishment === 0) {
            player.message("A guard approaches you and pretends to start hiting you.");
            await n.say("Take that you infidel!");
            player.message("The guard leans closer to you and says in a low voice.");
            await n.say(
                "We're sick of having to kill every lunatic that comes along",
                "and insults the captain, it makes such a mess.",
                "Thankfully, he's a bit decrepid so he doesn't notice",
                "so please, buzz off and don't come here again."
            );
        } else if (punishment === 1) {
            player.message("The guard approaches you again kicks you slightly.");
            await player.say("Ow!");
            await n.say("Take that you mad child of a dog!");
            player.message("The guard leans closer to you and says in a low voice.");
            await n.say(
                "What are you doing here again?",
                "Didn't I tell you to get out of here!",
                "Now get lost, properly this time!",
                "Or we may be forced to see his orders through properly."
            );
        } else if (punishment === 2) {
            player.message("A guard approaches you and looks very angry, he slaps you across the face.");
            await n.say("Prepare to die effendi!");
            player.message("The guard leans close and whispers");
            await n.say(
                "Are you mad effendi!",
                "This is your last chance.",
                "Leave now and never come back.",
                "Or I'll introduce you to my friend."
            );
            player.message("The guard half draws his fearsome looking scimitar.");
            await n.say("And we'll be pleased to clean the mess up after you've been dispatched.");
        } else {
            player.message("An angry guard approaches you and whips out his sword.");
            await n.say(
                ((Math.random() < 0.5) ? "Guard: " : "") +"Ok, that does it!",
                "You're in serious trouble now!"
            );
            if ((Math.random() < 0.5)) {
                await n.say(
                    TEXT.TouristTrapCaptainWantsToThrowPlayerOkMenWeNeedToTeachThis,
                    "about desert survival techniques."
                );
                await mes(player, "The guards grab you and beat you up.");
            } else {
                await n.say("Ok men, we need to teach this person a thing or two", "about desert survival techniques.");
                await mes(player, "The guards grab you and rough you up a bit.");
            }
            player.damage(randomInt(4, 7));
            await mes(player, "You're grabed and manhandled onto a cart.");
            await mes(player, "Sometime later you're dumped in the middle of the desert.");
            await mes(player, "The guards move off in the cart leaving you stranded in the desert.");
            let desertLoc = desertTPPoints[Math.floor(Math.random() * desertTPPoints.length)];
            player.teleport(desertLoc.x, desertLoc.y);
        }
    }
}

async function failEscapeAnaInBarrel(player, n) {
    if (player.inventory.has(ITEM.ANA_IN_A_BARREL)) {
        n = spawnNpc(player, NPC.MERCENARY, player.x, player.y, 60000);
        await player.world.sleepTicks(1);
        await n.say(
            "Hey, where d'ya think you're going with that barrel?",
            "You should know that they go out on the cart!",
            "We'd better check this out!"
        );
        player.message("The guards prize the lid off the barrel.");
        player.inventory.remove(ITEM.ANA_IN_A_BARREL, 1);
        await n.say("Blimey! It's a jail break!", "They're making a break for it!");
        let ana = spawnNpc(player, NPC.ANA, player.x, player.y, 30000);
        await player.world.sleepTicks(1);
        await ana.say("I could have told you we wouldn't get away with it!", "Now look at the mess you've caused!");
        player.message("The guards grab Ana and drag her away.");
        if (ana !== null) {
            removeNpc(player, ana);
        }
        await mes(player, "@gre@Ana: Hey, watch it with the hands buster.");
        await mes(player, "@gre@Ana: These are the upper market slaves clothes doncha know!");
        await n.say("Right, we'd better teach you a lesson as well!");
        await mes(player, "The guards rough you up a bit.");
        await n.say(
            TEXT.TouristTrapFailEscapeAnaInBarrelRightLadsStuff,
            "Specially for our most honoured guests."
        );
        player.message("The guards drag you away to a cell.");
        await mes(player, "@yel@Guards: There you go, we hope you 'dig' you're stay here.");
        await mes(player, "@yel@Guards: Har! Har! Har!");
        if (n !== null) {
            removeNpc(player, n);
        }
        player.teleport(75, 3626);
    }
}

async function failWindowAnaInBarrel(player, n) {
    if (player.inventory.has(ITEM.ANA_IN_A_BARREL)) {
        await mes(player, "You focus all of your strength on the bar. Your muscles ripple!");
        await mes(player, "You manage to bend the bars on the window .");
        await mes(player, "You'll never get Ana in the Barrel through the window.");
        await mes(player, "The barrel is just too big.");
        await mes(player, "@gre@Ana: Don't think for one minute ...");
        await mes(player, "@gre@Ana: you're gonna get me through that window!");
    }
}
module.exports = {
    AlShabim,
    Mercenary,
    Siad,
    alShabimDialogue,
    anaDialogue,
    bedabinNomadDialogue,
    captainSiadDialogue,
    captainWantToThrowPlayer,
    completeQuest,
    delayedReturnSlave,
    desertTPPoints,
    escapingSlaveDialogue,
    failEscapeAnaInBarrel,
    failWindowAnaInBarrel,
    indirectTalktoAlShabim,
    irenaDialogue,
    lastRewardMenu,
    mercenaryCaptainDialogue,
    mercenaryDialogue,
    mercenaryInsideDialogue,
    rewardMenu,
    slaveDialogue,
    succeedRate,
    tryToAttackMercenarys
};
