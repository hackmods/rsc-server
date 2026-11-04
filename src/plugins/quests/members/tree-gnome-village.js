// Ported from Open-RSC Core-Framework authentic/quests/members/TreeGnomeVillage.java (AGPL-3.0)
// Tree Gnome Village (quest 31, treeGnomeVillage). Stages: 0 not started, 1 King Bolren sent you for the orb, 2 Commander
// Montai wants six logs, 3 logs given, 4 find the ballista coordinates (height 4, x 3, y 5), 5 the ballista breached the
// Khazard stronghold (the orb is in the chest upstairs), 6 the orb is back but Khazard troops took the other two (the
// Khazard warlord in the dead valleys north of the battlefield carries them; cache looted_orbs_protect once he dropped
// them), -1 done. The maze is entered through the loose fence panels (wall 101 at 633/634,705); Elkoy (396) outside the
// maze leads you to the village at stages 5, 6 and -1, and Bolren's assistant guides you out after his briefings.
// Bolkoy's shop is npcs/tree-gnome-village/bolkoy-general-store.js; the spirit tree that opens at -1 is
// game-objects/spirit-trees.js.

const ELKOY_ID = 396;
const REMSAI_ID = 397;
const LOCAL_GNOME_ID = 399;
const BOLREN_ID = 400;
const KALRON_ID = 402;
const TRACKER_1_ID = 404;
const TRACKER_2_ID = 405;
const TRACKER_3_ID = 406;
const COMMANDER_MONTAI_ID = 408;
const GNOME_TROOP_ID = 409;
const KHAZARD_WARLORD_ID = 410;
const KHAZARD_COMMANDER_ID = 428;

const TALKERS = new Set([
    ELKOY_ID,
    LOCAL_GNOME_ID,
    REMSAI_ID,
    BOLREN_ID,
    GNOME_TROOP_ID,
    COMMANDER_MONTAI_ID,
    TRACKER_3_ID,
    TRACKER_1_ID,
    KHAZARD_WARLORD_ID,
    KALRON_ID
]);

const LOGS_ID = 14;
const ORB_OF_PROTECTION_ID = 740;
const ORBS_OF_PROTECTION_ID = 741;
const GNOME_EMERALD_AMULET_ID = 744;

const LOOSE_FENCE_ID = 101;
const DOORFRAME_ID = 16;
const BALLISTA_ID = 388;
const TRACKER_GATE_ID = 392;
const STRONGHOLD_WALL_ID = 393;
const KHAZARD_CHEST_OPEN_ID = 409;
const KHAZARD_CHEST_CLOSED_ID = 410;

// outside the maze, by Elkoy
const MAZE_EXIT = [624, 675];
// the village, inside the maze
const VILLAGE = [644, 697];
// beside the spirit tree, for the ceremony
const CEREMONY = [658, 696];
const SPIRIT_TREE_TOP = [656, 695];

function stageOf(player) {
    return player.questStages.treeGnomeVillage || 0;
}

function setStage(player, stage) {
    player.questStages.treeGnomeVillage = stage;
}

function hasOrb(player) {
    return player.inventory.has(ORB_OF_PROTECTION_ID);
}

function hasOrbs(player) {
    return player.inventory.has(ORBS_OF_PROTECTION_ID);
}

function looted(player) {
    return !!player.cache.looted_orbs_protect;
}

// Functions.mes + delay(3)
async function mes(player, message) {
    player.message(`@que@${message}`);
    await player.world.sleepTicks(3);
}

// ifnearvisnpc: the nearest free one in range
function nearNpc(player, id, range) {
    return player
        .getNearbyEntitiesByID('npcs', id, range)
        .filter((npc) => !npc.locked && !npc.interlocutor)
        .sort((a, b) => a.getDistance(player) - b.getDistance(player))[0];
}

function guideOut(player) {
    player.message('A gnome guides you out of the maze');
    player.teleport(MAZE_EXIT[0], MAZE_EXIT[1], false);
}

// n.startCombat(player)
async function fight(player, npc) {
    player.disengage();
    await npc.attack(player);
}

async function khazardWarlord(player, npc) {
    const stage = stageOf(player);

    if (stage >= 0 && stage <= 4) {
        await player.say('hello, how are you?');
        await npc.say(
            "don't speak to me you insignificant wretch!",
            'die, in the name of khazard!'
        );
        await fight(player, npc);
    } else if (stage === 5) {
        await player.say('hello there');
        await npc.say("you think you're so clever", 'you know nothing!');
        await player.say('what?');
        await npc.say("i'll crush you and those pesky little green men!");
        await fight(player, npc);
    } else if (stage === 6 || stage === -1) {
        if ((stage === 6 && looted(player)) || stage === -1) {
            await player.say('i thought i killed you?');
            await npc.say(
                "fool.. warriors blessed by khazard don't die",
                "you can't kill that which is already dead",
                'however i can kill you'
            );
            await fight(player, npc);
        } else {
            await player.say('you there, stop!');
            await npc.say('go back to your pesky little green friends');
            await player.say("i've come for the orbs");
            await npc.say(
                "you're out of your depth traveller",
                'these orbs are part of a much larger picture'
            );
            await player.say("they're stolen goods", 'now give them here');
            await npc.say(
                'hee hee you really think you stand a chance?',
                "i'll crush you!"
            );
            await player.world.sleepTicks(2);
            await fight(player, npc);
        }
    }
}

async function trackerOne(player, npc) {
    switch (stageOf(player)) {
        case 0:
        case 1:
            await player.say('hello');
            await npc.say(
                "i can't talk now",
                "can't you see we're trying to win a battle here?"
            );
            break;
        case 2:
            await player.say('hi there');
            await npc.say(
                "we're trying to hold them back",
                "but without more wood we won't be able to last long"
            );
            await player.say('hang in there little man');
            break;
        case 3:
        case 4:
            await player.say(
                'do you know the coordinates',
                'of the khazard stronghold?'
            );
            await npc.say(
                "i managed to get one although it wasn't easy",
                'the height coordinate is 4'
            );
            await player.say('well done');
            await npc.say(
                'the other two tracker gnomes',
                'should have the other coordinates',
                "if they're still alive"
            );
            await player.say('ok, take care');
            break;
        case 5:
            if (hasOrb(player)) {
                await player.say('how are you tracker?');
                await npc.say(
                    "now we have the globe i'm much better",
                    "they won't stand a chance without it"
                );
                break;
            }

            await player.say('hello again"');
            await npc.say(
                "well done, you've broken down there defenses",
                'this battle must be ours'
            );
            break;
        case 6:
        case -1:
            await player.say('hello');
            await npc.say(
                'when will this battle end?',
                "i feel like i've been fighting forever"
            );
            break;
    }
}

async function trackerThree(player, npc) {
    switch (stageOf(player)) {
        case 0:
        case 1:
            await player.say('hello');
            await npc.say(
                "i can't talk now",
                "can't you see we're trying to win a battle here?"
            );
            break;
        case 2:
            await player.say('hi there');
            await npc.say(
                "i can't stand this war",
                "the misery, the pain, it's driving me crazy",
                'when will it end?'
            );
            player.message(
                "He doesn't seem to be dealing with the battle very well"
            );
            break;
        case 3:
        case 4:
            await player.say('are you ok?');
            player.message('The gnome looks dilerious');
            await npc.say("ok? who's ok? not me", 'hee hee');
            await player.say("what's wrong?");
            await npc.say(
                "you can't see me, no one can",
                "monsters, demons, they're all around me"
            );
            await player.say('what do you mean?');
            await npc.say("they're dancing, all of them hee hee");
            player.message("He's clearly lost the plot");
            await player.say(
                'do you have the x coordinate for the khazard stronghold?'
            );
            await npc.say('who holds the stronghold?');
            await player.say('what?');
            await npc.say('more than me', 'less than our feet');
            await player.say("you're mad");
            await npc.say('more than we', "and khazard's men are beat");
            player.message('The toll of war has affected his mind');
            await player.say("i'll pray for you little man");
            await npc.say('all day we pray in the hay', 'hee hee');
            player.message('The poor gnome has gone mad');
            break;
        case 5:
            await player.say(hasOrb(player) ? 'hello again"' : 'hello again');
            await npc.say(
                "don't talk to me, you can't see me",
                'no one can just the demons'
            );
            player.message('The poor gnome has gone mad');
            break;
        case 6:
        case -1:
            await player.say('hello');
            await npc.say(
                'i feel dizzy, where am i?',
                'oh dear, oh dear i need some rest'
            );
            await player.say('I think you do');
            break;
    }
}

async function commanderMontai(player, npc) {
    switch (stageOf(player)) {
        case 0:
            await player.say('hello');
            await npc.say(
                "i can't talk now",
                "can't you see we're trying to win a battle here?",
                "if we can't hold back khazard's men",
                "we're all doomed"
            );
            break;
        case 1: {
            await player.say('hello');
            await npc.say(
                'hello traveller',
                'are you here to help or just to watch?'
            );
            await player.say(
                "I've been sent by king Bolren",
                'to retrieve the orb of protection'
            );
            await npc.say(
                'excellent we need all the help we can get',
                "i'm commander montai",
                'the orb is in the khazard stronghold to the north',
                'but until we weaken their defences',
                "we can't get close"
            );
            await player.say('what can i do?');
            await npc.say(
                'first we need to strengthen our own defences',
                'we desperately need wood to make more battlements',
                'six loads of logs should do it',
                "once the battlements are gone it's all over"
            );

            const firstOrb = await player.ask(
                [
                    "Ok, i'll gather some wood",
                    'Sorry i no longer want to be involved'
                ],
                false
            );

            if (firstOrb === 0) {
                await player.say("ok, i'll gather some wood");
                await npc.say(
                    'please be as quick as you can',
                    "i don't know how much longer we can hold out"
                );
                setStage(player, 2);
            } else if (firstOrb === 1) {
                await player.say('sorry i no longer want to be involved');
                await npc.say(
                    "that's a shame we could",
                    'have done with your help'
                );
            }
            break;
        }
        case 2:
            await player.say('hello');
            await npc.say(
                "hello again, we're still desperate for wood soldier"
            );

            if (player.inventory.count(LOGS_ID) >= 6) {
                player.inventory.remove(LOGS_ID, 6);
                await player.say('i have some here');
                player.message('you give some wood to the commander');
                await npc.say(
                    "that's excellent now we can make more defensive battlements",
                    'give me a moment to organise the troops',
                    'and then come speak to me',
                    "i'll inform you of our next phase of attack"
                );
                setStage(player, 3);
            } else {
                await npc.say('we need at least six loads of logs');
                await player.say("i'll see what i can do");
                await npc.say('thankyou');
            }
            break;
        case 3: {
            await player.say('how are you doing montai?');
            await npc.say(
                "we're hanging in there soldier",
                'for the next phase of the attack',
                'we need to breech their stronghold',
                'the ballista can break through the stronghold wall',
                'and then we can advance and seize back the orb'
            );
            await player.say("so what's the problem?");
            await npc.say(
                "from this distance we can't get an accurate shot away",
                'we need the correct coordinates of the stronghold',
                'for a direct hit',
                "i've sent out three tracker gnomes to gather them"
            );
            await player.say('have they returned?');
            await npc.say(
                "i'm afraid not and we're running out of time",
                'I need you to go into the heart of the battlefield',
                'find the trackers and bring back the coordinates.',
                'Do you think you can do it?'
            );

            const phaseTwo = await player.ask(
                ["No, i've had enough of your battle", "I'll try my best"],
                false
            );

            if (phaseTwo === 0) {
                await player.say("no, i've had enough of your battle");
                await npc.say("i understand, this isn't your fight");
            } else if (phaseTwo === 1) {
                await player.say("i'll try my best");
                await npc.say(
                    "thankyou, you're braver than most",
                    "i don't know how long i will be able to hold out",
                    'once you have the coordinates',
                    'come back and fire the ballista',
                    'right into those monsters',
                    'if you can retrieve the orb and bring safety back to my people',
                    'none of the blood spilled on this field will be in vain'
                );
                setStage(player, 4);
            }
            break;
        }
        case 4:
            await player.say('hello');
            await npc.say(
                'hello warrior we need the coordinates',
                'for a direct hit from the ballista',
                'once you have a direct hit you will be able',
                'to enter the stronghold and retrieve the orb'
            );
            break;
        case 5:
            if (hasOrb(player)) {
                await player.say('i have the orb of protection');
                await npc.say('incredible, for a human', 'you really are something');
                await player.say('thanks... i think!');
                await npc.say(
                    "I'll stay here with my troops",
                    "and try and hold khazard's men back",
                    'you return the orb to the gnome village',
                    'go as quick as you can',
                    'the village is still unprotected'
                );
                break;
            }

            await player.say("i've breeched the stronghold");
            await npc.say(
                'i saw, that was a beautiful sight',
                "the khazard troops didn't know what hit them",
                'now is the time to retrieve the orb',
                "it's all in your hands",
                "i'll be praying for you"
            );
            break;
        case 6:
        case -1:
            await player.say('hello montai, how are you?');
            await npc.say(
                "i'm ok, this battle is going",
                'to take longer to win than i expected',
                "the khazard troops won't give up even without the orb"
            );
            await player.say('hang in there');
            break;
    }
}

async function gnomeTroop(player, npc) {
    const stage = stageOf(player);

    if (stage === 5 || stage === -1) {
        await player.say('hi');
        await npc.say('draw your sword warrior', 'and fight along side us!');
        return;
    }

    // the Java's other branch ("death to khazard and all who serve him!") is unreachable: its test is always true
    await player.say('hello');
    await npc.say(
        "i can't talk now",
        "can't you see we're trying",
        'to win a battle here?'
    );
}

async function ceremony(player, npc) {
    const { world } = player;

    await player.say('bolren, i have returned');
    await npc.say('you made it back', 'do you have the orbs?');
    await player.say('i have them here');
    await npc.say(
        "hooray, you're amazing",
        "i didn't think it was possible",
        "but you've saved us",
        'once the orbs are replaced we will be safe once more',
        'come with me and we shall begin the ceremony'
    );
    player.teleport(CEREMONY[0], CEREMONY[1], true);
    await world.sleepTicks(2);
    await player.say('what now?');
    await npc.say(
        'the spirit tree has looked over us for centuries',
        'now we must pay our respects'
    );
    await mes(player, 'bolren takes the orbs');
    await mes(player, 'the gnomes begin to chant');
    await mes(player, 'Su tana, en tania');
    await mes(player, 'They continue to chant');
    await mes(player, 'As the king gnome climbs the tree');
    await mes(player, 'placing the two Orbs at the peak of the spirit tree');
    player.inventory.remove(ORBS_OF_PROTECTION_ID);

    for (let i = 0; i < 3; i += 1) {
        for (const viewer of npc.getNearbyEntities('players', 16)) {
            viewer.sendTeleportBubble(SPIRIT_TREE_TOP[0], SPIRIT_TREE_TOP[1]);
        }

        if (i < 2) {
            await world.sleepTicks(2);
        }
    }

    await npc.say(
        'now at last my people are safe once more',
        'and can live in peace'
    );
    await player.say("i'm pleased i could help");
    await npc.say(
        'you are modest brave traveller',
        'please for your efforts take this amulet',
        "it's made from the same sacred stone as the orbs of protection",
        'it will help keep you safe on your journeys'
    );
    await player.say('thank you king bolren');
    await npc.say(
        'the tree has many other powers',
        'some of which i cannot reveal',
        'however as a friend of the gnome',
        "people you can now use the tree's",
        'magic to teleport to other trees',
        'grown from related seeds'
    );
    delete player.cache.looted_orbs_protect;

    // TreeGnomeVillage.handleReward: the line, 2 quest points, attack 800 + 900 per level (quarter points), the amulet
    player.completeQuest('treeGnomeVillage', {
        questPoints: 2,
        experience: { attack: player.skills.attack.base * 900 + 800 },
        message: 'Well done you have completed the treequest'
    });
    player.inventory.add(GNOME_EMERALD_AMULET_ID, 1);
}

async function bolren(player, npc) {
    switch (stageOf(player)) {
        case 0: {
            await player.say('hello');
            await npc.say(
                'well hello stranger',
                "my name's bolren, i'm the king of the tree gnomes",
                "i'm surprised you made it in",
                'maybe i made the maze too easy'
            );
            await player.say('maybe');
            await npc.say(
                "i'm afraid i have more serious concerns at the moment",
                'very serious'
            );

            const first = await player.ask(
                ["I'll leave you to it then", 'Can i help at all?'],
                false
            );

            if (first === 0) {
                await player.say("i'll leave you too it then");
                await npc.say('ok take care');
                break;
            }

            if (first !== 1) {
                break;
            }

            await player.say('can i help at all?');
            await npc.say(
                "i'm glad you asked",
                'the truth is my people are in grave danger',
                'we have always been protected by the spirit tree',
                'no creature dark of heart can harm us',
                'while its three orbs are in place.',
                'We are not a violent race',
                'but we fight when we must',
                'many gnomes have fallen',
                'battling the dark forces of khazard to the north',
                'we became desperate',
                'so we took one orb of protection to the battlefield',
                'it was a foolish move',
                'khazard troops siezed the orb',
                'and now we are completely defenseless'
            );
            await player.say('how can i help?');
            await npc.say(
                'you would be a huge benefit on the battlefield',
                'if you would go there and try and retrieve the orb',
                'my people and i will be forever grateful'
            );

            const second = await player.ask(
                ['I would be glad to help', "I'm sorry but i won't be involved"],
                false
            );

            if (second === 0) {
                await player.say('i would be glad to help');
                await npc.say(
                    'thank you',
                    'the battlefield is to the north of the maze',
                    'commander montai will inform you of their current situation',
                    "that's if he's still alive",
                    'my assistant shall guide you out',
                    'try your best to return the orb',
                    'good luck friend'
                );
                guideOut(player);

                if (stageOf(player) === 0) {
                    setStage(player, 1);
                }
            } else if (second === 1) {
                await player.say("i'm sorry but i won't be involved");
                await npc.say('ok then, travel safe');
            }
            break;
        }
        case 1:
            await player.say('hello bolren');
            await npc.say(
                "hello traveller, we must retrieve the orb",
                "it's being held by khazard troops",
                'to the west of the maze',
                'above the khazard fight arena'
            );
            await player.say("ok i'll try my best");
            break;
        case 2:
        case 3:
        case 4:
            await player.say('hello bolren');
            await npc.say(
                'the orb is being held at the battlefield',
                'to the north of the maze',
                'above the khazard fight arena'
            );
            break;
        case 5: {
            await player.say('king bolren are you ok?');

            if (!hasOrb(player)) {
                await npc.say('do you have the orb?');
                await player.say("no, i'm afraid not");
                await npc.say('please, we must have the orb', 'if we are to survive');
                break;
            }

            await player.say('i have the orb');
            await npc.say(
                "thank you traveller, but it's too late",
                "we're all doomed",
                'oh my the misery, the horror'
            );
            await player.say('what happened?');
            await npc.say('they came in the night', "i don't how many, enough");
            await player.say('who?');
            await npc.say(
                'khazard troops',
                'they slaughtered anyone who got in their way',
                'women, children, my wife'
            );
            await player.say("i'm sorry");
            await npc.say('they took the other orbs', "now we're defenseless");
            await player.say('where did they take them?');
            await npc.say(
                'they headed north of the',
                'battlefields to the dead valleys',
                'a warlord carries the orbs'
            );

            const newOrbs = await player.ask(
                [
                    'I will find the warlord and bring back the orbs',
                    "I'm sorry but i can't help"
                ],
                false
            );

            if (newOrbs === 0) {
                await player.say('i will find the warlord and bring back the orbs');
                await npc.say(
                    'you are brave',
                    'but this task will be tough even for you,',
                    'i wish you the best of luck traveller',
                    'once again you are our only hope',
                    'i will safeguard this orb',
                    'and pray for your safe return',
                    'my assistant will guide you out'
                );
                guideOut(player);
                setStage(player, 6);
                player.inventory.remove(ORB_OF_PROTECTION_ID);
            } else if (newOrbs === 1) {
                await player.say("i'm sorry but i can't help");
                await npc.say("i understand, this isn't your battle");
            }
            break;
        }
        case 6:
            if (hasOrbs(player)) {
                await ceremony(player, npc);
            } else if (looted(player)) {
                await player.say('bolren, i have returned');
                await npc.say('you made it back', 'do you have the orbs?');
                await player.say("no, i'm afraid not");
                await npc.say('please, we must have the orbs', 'if we are to survive');
            } else {
                await player.say('hello bolren');
                await npc.say(
                    'the orbs are gone',
                    'taken north of the battlefield by a khazard warlord',
                    "we're all doomed"
                );
            }
            break;
        case -1:
            await player.say('hello again bolren');
            await npc.say("well hello, it's good to see you again");

            if (!player.inventory.has(GNOME_EMERALD_AMULET_ID)) {
                await player.say("i've lost my amulet");
                await npc.say('oh dear', 'here take another');
                player.inventory.add(GNOME_EMERALD_AMULET_ID, 1);
            } else {
                await player.say('good to see you');
            }
            break;
    }
}

async function remsai(player, npc) {
    switch (stageOf(player)) {
        case 0:
            await player.say('hello');
            await npc.say(
                'well done, well done',
                'not many find their way in here',
                "i'm remsai, a tree gnome",
                'we live in this maze for our protection',
                'have a look around and enjoy'
            );
            break;
        case 1:
            await npc.say('oh my, oh my');
            await player.say("what's wrong?");
            await npc.say(
                'the orb, they have the orb',
                'it must be returned',
                "or we're doomed"
            );
            break;
        case 2:
        case 3:
        case 4:
            await npc.say(
                'the orb, they have the orb',
                "if it's not returned we're doomed"
            );
            break;
        case 5:
            await player.say('hello remsai');
            await npc.say('hello, did you find the orb?');

            if (hasOrb(player)) {
                await player.say('i have it here');
                await npc.say("you're our saviour");
            } else {
                await player.say("no, i'm afraid not");
                await npc.say('please we must have the orb', 'if we are to survive');
            }
            break;
        case 6:
            if (hasOrbs(player)) {
                await player.say("i've returned");
                await npc.say(
                    "you're back, well done brave adventurer",
                    'now the orbs are safe',
                    'we can perform the ritual for the orb tree',
                    'and we can live in peace once again'
                );
            } else {
                await player.say('are you ok?');
                await npc.say(
                    "Khazard's men came",
                    'without the orb we were defenseless',
                    'they killed many',
                    'and then took our last hope',
                    'the other orbs',
                    "now surely we're all doomed",
                    'without them the spirit tree is useless'
                );
            }
            break;
        case -1:
            await player.say('hello');
            await npc.say(
                'hi there traveller',
                "you're a legend around these parts"
            );
            await player.say('thanks remsai');
            break;
    }
}

async function localGnome(player, npc) {
    switch (stageOf(player)) {
        case 0:
        case 1:
        case 2:
        case 3:
        case 4:
            await player.say('hello');
            await npc.say('lardi dee, lardi da');
            await player.say('are you alright?');
            await npc.say('hee hee, lardi da, lardi dee');
            player.message('The gnome appears to be singing');
            break;
        case 5:
            await player.say('hello little man');
            await npc.say(
                'little man stronger than big man',
                'hee hee',
                'lardi dee, lardi da'
            );
            player.message('Cheeky little gnome');
            break;
        case 6:
            if (looted(player)) {
                await player.say('hello gnome');
                await npc.say(
                    "soon we're gonna have the sacred ceremony",
                    'and boy am i going to party',
                    'lock up your daughters',
                    'hee hee'
                );
            } else {
                await player.say('hi');
                await npc.say(
                    'must save the orbs and kill the khazard warlord',
                    'that will be fun',
                    'hee hee'
                );
            }
            break;
        case -1:
            await player.say('hello');
            await npc.say("you're the best");
            await player.say('thanks');
            await npc.say("well, i'm better", 'hee hee');
            break;
    }
}

// "would you like me to show you the way to the village?"
async function elkoyLeads(player, npc) {
    const menu = await player.ask(['Yes please', 'No thanks elkoy'], false);

    if (menu === 0) {
        await player.say('yes please');
        await npc.say('ok then follow me');
        player.message('elkoy leads you to the gnome village');
        player.teleport(VILLAGE[0], VILLAGE[1], false);
    } else if (menu === 1) {
        await player.say('no thanks elkoy');
        await npc.say('ok then take care');
    }
}

async function elkoy(player, npc) {
    switch (stageOf(player)) {
        case 0:
            await player.say('hello there');
            await npc.say(
                'hello, welcome to our maze',
                "i'm elkoy the tree gnome"
            );
            await player.say("i haven't heard of your sort");
            await npc.say(
                "there's not many of us left",
                'once you could find tree gnomes',
                'anywhere in the world, now we hide',
                'in small groups to avoid capture'
            );
            await player.say('capture by whom?');
            await npc.say(
                'tree gnomes have been hunted',
                "for so called 'fun' since i",
                'can remember, our main threat',
                "nowadays are General Khazard's troops",
                'they know no mercy, but are also',
                "very dense, they'll never find",
                'their way through our maze',
                'have fun'
            );
            break;
        case 1:
            await player.say('hello elkoy');
            await npc.say('oh my, oh my');
            await player.say("what's wrong?");
            await npc.say('the orb, they have the orb', "we're doomed");
            break;
        case 2:
        case 3:
        case 4:
            await player.say('hello');
            await npc.say(
                'you must retrieve the orb',
                'or the gnome village is doomed'
            );
            break;
        case 5: {
            await player.say('hello elkoy');
            await npc.say("you're back! and the orb?");

            if (!hasOrb(player)) {
                await player.say("no, i'm afraid not");
                await npc.say('please, we must have the orb', 'if we are to survive');
                break;
            }

            await player.say('i have it here');
            await npc.say(
                "you're our saviour",
                'please return it to the village and we are all saved',
                'would you like me to show you the way to the village?'
            );

            const gotOrb = await player.ask(['Yes please', 'No thanks Elkoy'], false);

            if (gotOrb === 0) {
                await player.say('yes please');
                await npc.say('ok then follow me');
                player.message('elkoy leads you to the gnome village');
                player.teleport(VILLAGE[0], VILLAGE[1], false);
            } else if (gotOrb === 1) {
                await player.say('no thanks elkoy');
                await npc.say('ok then take care');
            }
            break;
        }
        case 6:
            await player.say('hello elkoy');

            if (looted(player)) {
                await npc.say("you truly are a hero");
                await player.say('thanks');
                await npc.say(
                    'you saved us by',
                    'returning the orbs of"',
                    "protection, i'm humbled",
                    'and wish you well',
                    'would you like me to show',
                    'you the way to the village?'
                );
            } else {
                await npc.say(
                    "did you hear? khazard's men",
                    'have pillaged the village!',
                    'they slaughtered many',
                    'and took the other orbs',
                    'in an attempt to lead us',
                    'all out of the maze',
                    'when will the misery end?',
                    'would you like me to show',
                    'you the way to the village?'
                );
            }

            await elkoyLeads(player, npc);
            break;
        case -1:
            await player.say('hello little man');
            await npc.say(
                'hi there, hope life',
                'is treating you well',
                'would you like me to show',
                'you the way to the village?'
            );
            await elkoyLeads(player, npc);
            break;
    }
}

async function kalron(player, npc) {
    switch (stageOf(player)) {
        case 0:
        case 1:
        case 2:
        case 3:
        case 4:
            await player.say('hello');
            await npc.say(
                'gotta find a way out',
                'we built this maze for protection',
                "but i can't get used to it",
                "i'm always getting lost"
            );
            break;
        case 5:
            await player.say('hello there');
            await npc.say(
                'oh my, oh my',
                'the village has been',
                "and i'm still lost",
                'oh dear'
            );
            break;
        case 6:
            if (looted(player)) {
                await player.say('hello little man');
                await npc.say(
                    'hello i hope they come out and find me soon,',
                    "it's getting cold"
                );
            } else {
                await player.say('hello, how are you?');
                await npc.say(
                    "oh my i'll never find my way back",
                    "before khazard's men come and hunt me down"
                );
            }
            break;
        case -1:
            await player.say('hello there, you look lost');
            await npc.say('are you trying to be funny?');
            await player.say('no');
            await npc.say('hmmm');
            break;
    }
}

const TALK = {
    [KHAZARD_WARLORD_ID]: khazardWarlord,
    [TRACKER_1_ID]: trackerOne,
    [TRACKER_3_ID]: trackerThree,
    [COMMANDER_MONTAI_ID]: commanderMontai,
    [GNOME_TROOP_ID]: gnomeTroop,
    [BOLREN_ID]: bolren,
    [REMSAI_ID]: remsai,
    [LOCAL_GNOME_ID]: localGnome,
    [ELKOY_ID]: elkoy,
    [KALRON_ID]: kalron
};

async function onTalkToNPC(player, npc) {
    if (!TALKERS.has(npc.id)) {
        return false;
    }

    player.engage(npc);
    await TALK[npc.id](player, npc);

    // the warlord's fight already freed both
    if (player.interlocutor === npc) {
        player.disengage();
    }

    return true;
}

// the loose fence panels into the maze (633/634,705) and the one at (540,445)
async function onWallObjectCommandOne(player, wallObject) {
    if (
        wallObject.id !== LOOSE_FENCE_ID ||
        !(wallObject.y === 705 || (wallObject.x === 540 && wallObject.y === 445))
    ) {
        return false;
    }

    player.message('You push your way through the fence');
    await player.enterDoor(wallObject, DOORFRAME_ID);
    return true;
}

// tracker 2, locked up behind the gate (392 at 648,629)
async function trackerTwo(player) {
    const tracker = nearNpc(player, TRACKER_2_ID, 5);

    if (!tracker) {
        return;
    }

    player.engage(tracker);

    switch (stageOf(player)) {
        case 0:
        case 1:
            await player.say('hello');
            await tracker.say(
                "i can't talk now",
                "if the guards catch me i'll be dead gnome meat"
            );
            break;
        case 2:
            await player.say('hi there');
            await tracker.say(
                'the battle is far from over',
                'if you have a pure heart you will help us win'
            );
            break;
        case 3:
        case 4:
            player.message('The gnome looks beaten and weak');
            await tracker.say(
                'they caught me spying on the stronghold..',
                'they beat and tortured me',
                "but i didn't crack, i told them nothing",
                "they can't break me"
            );
            await player.say("i'm sorry little man");
            await tracker.say(
                "don't be, i have the position of the stronghold",
                'the y coordinate is 5'
            );
            await player.say('well done');
            await tracker.say('now leave before they find you and all is lost');
            await player.say('hang in there');
            await tracker.say('go');
            break;
        case 5:
            if (hasOrb(player)) {
                await player.say('how are you tracker?');
                await tracker.say(
                    "now we have the globe 'm much better",
                    'soon my comrades will come and free me'
                );
                break;
            }

            await player.say('hello again');
            await tracker.say(
                "well done you've broken down there defenses",
                'this battle must be ours'
            );
            break;
        case 6:
        case -1:
            await player.say('hello');
            await tracker.say(
                'when will this battle end?',
                "i feel like i've been locked up my whole life"
            );
            break;
    }

    player.disengage();
}

// TreeGnomeVillage.fireBallistaMenu: height 4, x 3, y 5 (menu indexes 3, 2, 4)
async function fireBallista(player) {
    const coords = ['coord 1', 'coord 2', 'coord 3', 'coord 4', 'coord 5'];

    await mes(player, 'To fire the ballista you Must first set the coordinates');
    await mes(player, 'Set the height coordinate to');
    const height = await player.ask(coords, true);
    player.message('Set the x coordinate to');
    const x = await player.ask(coords, true);
    player.message('Set the y coordinate to');
    const y = await player.ask(coords, true);

    player.message('You fire the ballista');
    await mes(player, 'The huge spear flies through the air');

    if (height === 3 && x === 2 && y === 4) {
        await mes(player, 'And screams down directly into the Khazard stronghold');
        await mes(player, 'A deafening crash echoes over the battlefield');
        await mes(player, 'The front entrance is reduced to rubble');
        setStage(player, 5);
    } else {
        await mes(player, 'Straight over the khazard stronghold');
        await mes(player, 'Into the valleys behond');
        await mes(player, "You've missed the target");
    }
}

async function ballista(player) {
    const stage = stageOf(player);

    if (stage >= 5 || stage === -1) {
        player.message('The ballista has been damaged, it is out of use');
    } else if (stage < 4) {
        await mes(player, 'The ballista is damaged');
        await mes(
            player,
            'It cannot be used until the gnomes have finished their repairs'
        );
    } else {
        await fireBallista(player);
    }
}

// the Khazard stronghold wall (393 at 658,632): rubble once the ballista hit it
async function strongholdWall(player) {
    const { world } = player;
    const stage = stageOf(player);

    if (stage >= 5 || stage === -1) {
        await mes(player, 'The wall is reduced to');
        await mes(player, 'Rubble, you manage to climb over');

        if (player.y >= 633) {
            player.teleport(659, 632, false);

            if (!player.cache.over_gnomefield_wall) {
                const commander = nearNpc(player, KHAZARD_COMMANDER_ID, 12);

                if (commander) {
                    // the teleport lands after two ticks
                    await world.sleepTicks(2);
                    player.engage(commander);
                    await commander.say(
                        'what?! how did you manage to get in here?'
                    );
                    await player.say("i've come for the orb");
                    await commander.say("i'll never let you take it!");
                    await fight(player, commander);
                }

                player.cache.over_gnomefield_wall = true;
            }
        } else {
            player.teleport(659, 633, false);
        }
    } else if (player.y >= 633) {
        await mes(player, 'The wall is damaged');
        await mes(player, 'But not enough to climb through');
    } else {
        await mes(player, 'The wall is glitchy');
        await mes(player, 'you manage to climb over');
        player.teleport(659, 633, false);
    }
}

function searchChest(player) {
    if (!player.inventory.has(ORB_OF_PROTECTION_ID)) {
        player.message('You search the chest');
        player.message('And find the orb of protection');
        player.inventory.add(ORB_OF_PROTECTION_ID, 1);
    } else {
        player.message('You search the chest, but find nothing');
    }
}

async function onGameObjectCommandOne(player, gameObject) {
    switch (gameObject.id) {
        case TRACKER_GATE_ID:
            await trackerTwo(player);
            return true;
        case BALLISTA_ID:
            await ballista(player);
            return true;
        case STRONGHOLD_WALL_ID:
            await strongholdWall(player);
            return true;
        case KHAZARD_CHEST_OPEN_ID: // Search
            searchChest(player);
            return true;
        case KHAZARD_CHEST_CLOSED_ID: // Open
            player.world.replaceEntity('gameObjects', gameObject, KHAZARD_CHEST_OPEN_ID);
            player.message('You open the chest');
            return true;
    }

    return false;
}

async function onGameObjectCommandTwo(player, gameObject) {
    if (gameObject.id !== KHAZARD_CHEST_OPEN_ID) {
        return false;
    }

    // Close: the Java closes it into the open chest id (closeGenericObject(obj, player, KHAZARD_CHEST_OPEN, ...)), so
    // it stays open; only the line changes
    player.message('You close the chest');
    return true;
}

// TreeGnomeVillage.onKillNpc: the warlord drops the orbs at stage 6. Never claims, so his own drops still fall and he
// is removed; the lines run on their own so the corpse does not wait for them
async function onNPCDeath(player, npc) {
    if (
        !player ||
        !npc ||
        npc.id !== KHAZARD_WARLORD_ID ||
        stageOf(player) !== 6
    ) {
        return false;
    }

    (async () => {
        await mes(player, 'As he falls to the ground...');
        await mes(player, 'A ghostly vapour floats upwards from his battle worn armour');
        await mes(
            player,
            'Out of sight, you hear a shrill scream in the still air of the valley'
        );

        if (!player.inventory.has(ORBS_OF_PROTECTION_ID)) {
            player.message('You search his satchel and find the orbs of protection');
            player.inventory.add(ORBS_OF_PROTECTION_ID, 1);
            player.cache.looted_orbs_protect = true;
        }
    })().catch(() => {});

    return false;
}

module.exports = {
    onTalkToNPC,
    onWallObjectCommandOne,
    onGameObjectCommandOne,
    onGameObjectCommandTwo,
    onNPCDeath
};
