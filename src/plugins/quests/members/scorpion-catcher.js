// Ported from Open-RSC Core-Framework authentic/quests/members/ScorpionCatcher.java (AGPL-3.0)
// https://classic.runescape.wiki/w/Scorpion_Catcher
//
// questStages.scorpionCatcher (the Java stages):
//   0  Thormac the sorceror (300, top of the Sorcerer's tower south of Seers' Village) lost three lesser Kharid
//      scorpions. "So how would I go about catching them then?" gives the scorpion cage (678) -> 1
//   1  the Seer (301, Seers' Village) looks into his mirror and names the first scorpion's place -> 2
//   2  the cage is used on each Kharid scorpion; the cage id records which ones it holds:
//        678 none, 679 one, 686 two, 687 three, 680 one+two, 688 one+three, 689 two+three, 681 all three
//      302 Taverley dungeon, behind the secret wall (87) at (383,3353) that only opens at stage 2. The Dusty Key (596)
//          from Velrak the explorer (272, in the black knights' jail: Jail keys 595 open his cell) opens the door
//          (84) on the way; both key doors are wall-objects/key-doors.js
//      303 Barbarian Village, 304 upstairs in the Monastery south of Edgeville
//      Thormac takes the full cage (681) -> -1: 1 quest point, strength 1500 + 500 per strength level (quarter points)
//  -1  Thormac enchants a battlestaff of fire/water/air/earth (615-618) for 40000 coins (682-685)
// Not ported: the custom Combat Odyssey tier hand-off in Thormac's post-quest talk (OpenRSC WANT_COMBAT_ODYSSEY).

const THORMAC_ID = 300;
const SEER_ID = 301;
const VELRAK_ID = 272;
const SCORPION_TAVERLEY_ID = 302;
const SCORPION_BARBARIAN_ID = 303;
const SCORPION_MONASTERY_ID = 304;
const SCORPION_IDS = new Set([SCORPION_TAVERLEY_ID, SCORPION_BARBARIAN_ID, SCORPION_MONASTERY_ID]);

const COINS_ID = 10;
const DUSTY_KEY_ID = 596;

const CAGE = {
    none: 678,
    one: 679,
    oneTwo: 680,
    oneTwoThree: 681,
    two: 686,
    three: 687,
    oneThree: 688,
    twoThree: 689
};
const CAGE_IDS = new Set(Object.values(CAGE));

// which cages already hold each scorpion
const HOLDS = {
    [SCORPION_TAVERLEY_ID]: [CAGE.one, CAGE.oneTwo, CAGE.oneThree, CAGE.oneTwoThree],
    [SCORPION_BARBARIAN_ID]: [CAGE.two, CAGE.oneTwo, CAGE.twoThree, CAGE.oneTwoThree],
    [SCORPION_MONASTERY_ID]: [CAGE.three, CAGE.oneThree, CAGE.twoThree, CAGE.oneTwoThree]
};

// cage in hand -> cage after catching that scorpion
const CATCH = {
    [SCORPION_TAVERLEY_ID]: {
        [CAGE.none]: CAGE.one,
        [CAGE.two]: CAGE.oneTwo,
        [CAGE.three]: CAGE.oneThree,
        [CAGE.twoThree]: CAGE.oneTwoThree
    },
    [SCORPION_BARBARIAN_ID]: {
        [CAGE.none]: CAGE.two,
        [CAGE.one]: CAGE.oneTwo,
        [CAGE.three]: CAGE.twoThree,
        [CAGE.oneThree]: CAGE.oneTwoThree
    },
    [SCORPION_MONASTERY_ID]: {
        [CAGE.none]: CAGE.three,
        [CAGE.one]: CAGE.oneThree,
        [CAGE.two]: CAGE.twoThree,
        [CAGE.oneTwo]: CAGE.oneTwoThree
    }
};

// the secret wall in Taverley dungeon (Java: boundary 87 at y 3353)
const SECRET_DOOR_ID = 87;
const SECRET_DOOR_Y = 3353;

const ENCHANTED = {
    fire: 682,
    water: 683,
    air: 684,
    earth: 685
};

const BATTLESTAFFS = [
    { name: 'fire', staff: 615, enchanted: ENCHANTED.fire },
    { name: 'water', staff: 616, enchanted: ENCHANTED.water },
    { name: 'air', staff: 617, enchanted: ENCHANTED.air },
    { name: 'earth', staff: 618, enchanted: ENCHANTED.earth }
];
const ENCHANT_COST = 40000;

function stageOf(player) {
    return player.questStages.scorpionCatcher || 0;
}

function setStage(player, stage) {
    player.questStages.scorpionCatcher = stage;
}

function holdsAny(player, ids) {
    return ids.some((id) => player.inventory.has(id));
}

async function seerLooks(player, npc) {
    const { world } = player;

    await npc.say('Let me look into my looking glass');
    player.message('The seer produces a small mirror');
    await world.sleepTicks(3);
    player.message('The seer gazes into the mirror');
    await world.sleepTicks(3);
    player.message('The seer smoothes his hair with his hand');
    await world.sleepTicks(3);
    await npc.say(
        'I can see a scorpion that you seek',
        'It would appear to be near some  nasty looking spiders',
        'I can see two coffins there as well',
        'The scorpion seems to be going through some crack in the wall',
        "He's gone into some sort of secret room",
        'Well see if you can find that scorpion then',
        "And I'll try and get you some information on the others"
    );
}

async function seerLocateScorpions(player, npc) {
    await npc.say(
        'Well you have come to the right place',
        'I am a master of animal detection',
        'Do you need to locate any particular scorpion',
        'Scorpions are a creature somewhat in abundance'
    );
    await player.say("I'm looking for some lesser kharid scorpions", 'They belong to Thormac the sorceror');
    await seerLooks(player, npc);

    if (stageOf(player) === 1) {
        setStage(player, 2);
    }
}

async function seerPrimary(player, npc) {
    // OG post-quest doesn't say this and jumps directly to menu
    if (stageOf(player) !== -1) {
        await npc.say('Many greetings');
    }

    const menu = await player.ask(['Many greetings', 'I seek knowledge and power'], true);

    if (menu === 1) {
        await npc.say('Knowledge comes from experience, power comes from battleaxes');
    }
}

async function seerDialogue(player, npc) {
    switch (stageOf(player)) {
        case 0:
        case -1:
            await seerPrimary(player, npc);
            break;
        case 1: {
            await npc.say('Many greetings');

            const first = await player.ask(
                [
                    'I need to locate some scorpions',
                    'Your friend Thormac sent me to speak to you',
                    'I seek knowledge and power'
                ],
                true
            );

            if (first === 0) {
                await seerLocateScorpions(player, npc);
            } else if (first === 1) {
                await npc.say('What does the old fellow want');
                await player.say("He's lost his valuable lesser kharid scorpions");
                await seerLocateScorpions(player, npc);
            } else if (first === 2) {
                await npc.say('Knowledge comes from experience, power comes from battleaxes');
            }

            break;
        }
        case 2:
            if (!holdsAny(player, HOLDS[SCORPION_TAVERLEY_ID])) {
                // still needs the first scorpion
                if (!player.inventory.has(CAGE.none)) {
                    await player.say('I need to locate some scorpions');
                    await seerLocateScorpions(player, npc);
                } else {
                    await npc.say('Many greetings');
                    await player.say('Where did you say that scorpion was again?');
                    await seerLooks(player, npc);
                }
            } else if (!holdsAny(player, HOLDS[SCORPION_BARBARIAN_ID])) {
                await player.say('Hi I have retrieved the scorpion from near the spiders');
                await npc.say(
                    "Well I've checked my looking glass",
                    'There seems to be a kharid scorpion in a village full of  axe wielding warriors',
                    'One of the warriors there, dressed mainly in black has picked it up',
                    "That's all I can tell you about that scorpion"
                );
            } else if (!holdsAny(player, HOLDS[SCORPION_MONASTERY_ID])) {
                await npc.say('Many greetings');
                await player.say('I have retrieved a second scoprion'); // sic
                await npc.say(
                    "That's lucky because I've got some information on the last scorpion for you",
                    'It seems to be in some sort of upstairs room',
                    'There seems to be some sort of brown clothing lying on the floor'
                );
            } else {
                await seerPrimary(player, npc);
            }

            break;
    }
}

async function velrakDialogue(player, npc) {
    const { world } = player;

    if (player.inventory.has(DUSTY_KEY_ID)) {
        await player.say('Are you still here?');
        await npc.say("Yes, I'm still plucking up courage", 'To run out past those black knights');
        return;
    }

    await npc.say('Thankyou for rescuing me', "It isn't comfy in this cell");

    const choice = await player.ask(['So do you know anywhere good to explore?', 'Do I get a reward?'], true);

    if (choice === 0) {
        await npc.say(
            'Well this dungeon was quite good to explore',
            'Till I got captured',
            'I got given a key to an inner part of this dungeon',
            'By a mysterious cloaked stranger',
            "It's rather to tough for me to get that far though", // sic
            'I keep getting captured',
            'Would you like to give it a go'
        );

        const take = await player.ask(['Yes please', "No it's to dangerous for me too"], true);

        if (take === 0) {
            player.message('Velrak reaches inside his boot and passes you a key');
            await world.sleepTicks(3);
            player.inventory.add(DUSTY_KEY_ID);
        }
    } else if (choice === 1) {
        await npc.say('Well not really the black knights took all my stuff before throwing me in here');
    }
}

async function thormacWhatsInIt(player, npc) {
    await npc.say(
        'Well I suppose I can aid you with my skills as a staff sorcerer',
        'Most the battlestaffs around here are pretty puny',
        'I can beef them up for you a bit'
    );

    const choice = await player.ask(['So how would I go about catching them then?', 'Ok I will do it then'], true);

    if (choice === 0) {
        await thormacHowToCatch(player, npc);
    }
}

async function thormacHowToCatch(player, npc) {
    const { world } = player;

    if (!player.inventory.has(CAGE.none)) {
        await npc.say('Well I have a scorpion cage here', 'Which you can use to catch them in');
        player.inventory.add(CAGE.none);
        player.message('Thormac gives you a cage');
        await world.sleepTicks(3);
    } else {
        await npc.say('Well you have that scorpion cage I gave you', 'Which you can use to catch them in');
    }

    await npc.say(
        'If you go up to the village of seers to the north of here',
        'One of them will be able to tell you where the scorpions are now'
    );

    if (stageOf(player) === 0) {
        setStage(player, 1); // STARTED QUEST
    }

    const choice = await player.ask(["What's in it for me?", 'Ok I will do it then'], true);

    if (choice === 0) {
        await thormacWhatsInIt(player, npc);
    }
}

async function thormacAssistance(player, npc) {
    await npc.say(
        "I've lost my pet scorpions",
        "They're lesser kharid scorpions, a very rare breed",
        'I left there cage door open', // sic
        "now I don't know where they have gone",
        "There's 3 of them and they're quick little beasties",
        "They're all over runescape"
    );

    const choice = await player.ask(
        ['So how would I go about catching them then?', "What's in it for me?", "I'm not interested then"],
        true
    );

    if (choice === 0) {
        await thormacHowToCatch(player, npc);
    } else if (choice === 1) {
        await thormacWhatsInIt(player, npc);
    } else if (choice === 2) {
        await npc.say('Blast, I suppose I will have to have find someone else then'); // sic
    }
}

// the cages spelled out, so the item audit (scripts/audit/item-sources.js) sees each one
function addCage(player, cage) {
    switch (cage) {
        case CAGE.one:
            player.inventory.add(CAGE.one);
            break;
        case CAGE.two:
            player.inventory.add(CAGE.two);
            break;
        case CAGE.three:
            player.inventory.add(CAGE.three);
            break;
        case CAGE.oneTwo:
            player.inventory.add(CAGE.oneTwo);
            break;
        case CAGE.oneThree:
            player.inventory.add(CAGE.oneThree);
            break;
        case CAGE.twoThree:
            player.inventory.add(CAGE.twoThree);
            break;
        case CAGE.oneTwoThree:
            player.inventory.add(CAGE.oneTwoThree);
            break;
    }
}

// the enchanted staves spelled out, for the same audit
function addEnchanted(player, enchanted) {
    switch (enchanted) {
        case ENCHANTED.fire:
            player.inventory.add(ENCHANTED.fire);
            break;
        case ENCHANTED.water:
            player.inventory.add(ENCHANTED.water);
            break;
        case ENCHANTED.air:
            player.inventory.add(ENCHANTED.air);
            break;
        case ENCHANTED.earth:
            player.inventory.add(ENCHANTED.earth);
            break;
    }
}

// ScorpionCatcher.handleReward: 1 quest point, strength 1500 + 500 per strength level (quarter points)
function completeQuest(player) {
    player.completeQuest('scorpionCatcher', {
        questPoints: 1,
        experience: { strength: 1500 + 500 * player.skills.strength.base },
        message: 'Well done you have completed the scorpion catcher quest'
    });
}

async function thormacEnchant(player, npc) {
    await npc.say(
        "Yes it'll cost you 40000 coins for the materials needed mind you",
        'Which sort of staff did you want enchanting?'
    );

    const choice = await player.ask(
        [
            'Battlestaff of fire',
            'battlestaff of water',
            'battlestaff of air',
            'battlestaff of earth',
            "I won't bother yet actually"
        ],
        false
    );

    if (choice === 4) {
        await player.say("I won't bother yet actually");
        return;
    }

    const staff = BATTLESTAFFS[choice];

    if (!staff) {
        return;
    }

    await player.say(`battlestaff of ${staff.name} please`);

    if (!player.inventory.has(staff.staff)) {
        await player.say(`I don't have a battlestaff of ${staff.name} yet though`);
        return;
    }

    if (!player.inventory.has(COINS_ID, ENCHANT_COST)) {
        await player.say("I'll just get the money for you");
        return;
    }

    player.inventory.remove(COINS_ID, ENCHANT_COST);
    player.inventory.remove(staff.staff);
    addEnchanted(player, staff.enchanted);
    player.message('Thormac enchants your staff');
}

async function thormacDialogue(player, npc) {
    switch (stageOf(player)) {
        case 0: {
            await npc.say('Hello I am Thormac the sorceror', "I don't suppose you could be of assistance to me?");

            const first = await player.ask(['What do you need assistance with?', "I'm a little busy"], true);

            if (first === 0) {
                await thormacAssistance(player, npc);
            }

            break;
        }
        case 1:
        case 2:
            await npc.say('How goes your quest?');

            if (!player.inventory.has(CAGE.none) && !player.inventory.has(CAGE.oneTwoThree)) {
                // no empty cage, no full cage
                const menu = await player.ask(["I've lost my cage", "I've not caught all the scorpions yet"], true);

                if (menu === 0) {
                    await npc.say('Ok here is another cage', "You're almost as bad at loosing things as me"); // sic
                    player.inventory.add(CAGE.none);
                } else if (menu === 1) {
                    await npc.say('Well remember, go speak to the seers north of here if you need any help');
                }
            } else if (player.inventory.has(CAGE.oneTwoThree)) {
                await player.say('I have retrieved all your scorpions');
                await npc.say('aha my little scorpions home at last');
                player.inventory.remove(CAGE.oneTwoThree);
                completeQuest(player);
            } else {
                await player.say("I've not caught all the scorpions yet");
                await npc.say('Well remember, go speak to the seers north of here if you need any help');
            }

            break;
        case -1: {
            await npc.say('Thankyou for rescuing my scorpions');

            const four = await player.ask(["That's ok", "You said you'd enchant my battlestaff for me"], true);

            if (four === 1) {
                await thormacEnchant(player, npc);
            }

            break;
        }
    }
}

const DIALOGUES = {
    [THORMAC_ID]: thormacDialogue,
    [SEER_ID]: seerDialogue,
    [VELRAK_ID]: velrakDialogue
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

// Java blockUseNpc: any item on a Kharid scorpion that is not a cage already holding it
async function onUseWithNPC(player, npc, item) {
    if (!SCORPION_IDS.has(npc.id) || HOLDS[npc.id].includes(item.id)) {
        return false;
    }

    if (stageOf(player) !== 2) {
        player.message('Talk to Seer before you attempt catching this scorpion');
        return true;
    }

    if (!CAGE_IDS.has(item.id)) {
        player.message('Nothing interesting happens');
        return true;
    }

    const next = CATCH[npc.id][item.id];

    player.message('You catch a scorpion');

    if (next) {
        player.inventory.remove(item.id);
        addCage(player, next);
    }

    // delnpc(n, true): it respawns like any npc
    player.world.removeEntity('npcs', npc);
    return true;
}

// the secret wall to the Taverley scorpion opens only while the quest is on stage 2
async function onWallObjectCommandOne(player, wallObject) {
    if (wallObject.id !== SECRET_DOOR_ID || wallObject.y !== SECRET_DOOR_Y) {
        return false;
    }

    if (stageOf(player) === 2) {
        await player.enterDoor(wallObject);
        player.message('You just went through a secret door');
    }

    return true;
}

module.exports = { onTalkToNPC, onUseWithNPC, onWallObjectCommandOne, CAGE };
