// Ported from Open-RSC Core-Framework authentic/quests/members/TribalTotem.java (AGPL-3.0)
// Reward from plugins/shared/QuestRewardRegistrar.java (TRIBAL_TOTEM: 1 quest point, thieving 800 + 300 per level).
//
// Stages (player.questStages.tribalTotem):
//   0 / undefined  not started: Kangai Mau (Brimhaven) asks for the totem back
//   1              started: take the address label from the RPDT crate 329 (559,617) in Ardougne, stick it on the
//                  wizard's tower crate 328 (558,617) (cache "label"), ask the RPDT employee to deliver it
//   2              the crate (and the teleport block in it) went to Handelmort mansion: Wizard Cromperty's teleport
//                  now lands at 560,588 inside the mansion. Combination door 98 (561,586) is B R A D (Horacio's hint:
//                  "his middle name"); the stairs 331 (563,587) are trapped (search them with thieving 21, cache
//                  "trapy"); the chest 332/333 upstairs (560,1531) holds the tribal totem 705
//   -1             done: totem handed to Kangai Mau, 5 swordfish
//
// Not ported: nothing of the authentic path (no custom-config branches in the Java).

const GameObject = require('../../../model/game-object');

const KANGAI_MAU_ID = 332;
const WIZARD_CROMPERTY_ID = 333;
const RPDT_EMPLOYEE_ID = 334;
const HORACIO_ID = 335;

const SWORDFISH_ID = 370;
const ADDRESS_LABEL_ID = 704;
const TRIBAL_TOTEM_ID = 705;

const EMPTY_CRATE_ID = 290;
const WIZARDS_TOWER_CRATE_ID = 328;
const HANDELMORT_CRATE_ID = 329;
const HANDELMORT_STAIRS_ID = 331;
const HANDELMORT_CHEST_OPEN = 332;
const HANDELMORT_CHEST_CLOSED = 333;
const COMBINATION_DOOR_ID = 98;

// Java delayedSpawnObject(loc, 30000): 30 seconds of 640 ms ticks
const CRATE_RESPAWN_TICKS = 47;

function isAt(entity, id, x, y) {
    return entity.id === id && entity.x === x && entity.y === y;
}

// Java n.teleport(x, y) on an NPC: the JS model has no NPC teleport, so move it and tell the players who see it
function moveNpc(npc, x, y) {
    npc.x = x;
    npc.y = y;

    if (typeof npc.broadcastMove === 'function') {
        npc.broadcastMove();
    }
}

async function messages(player, ...lines) {
    for (const line of lines) {
        player.message(line);
        await player.world.sleepTicks(3);
    }
}

// ---- Kangai Mau ----------------------------------------------------------------------------------------------

async function startQuest(player) {
    await player.say('Ok I will get it back');
    player.questStages.tribalTotem = 1;
}

async function findHouse(player, npc) {
    await player.say("How can I find Handelmort's house", 'Ardougne is a big place');
    await npc.say("I don't know Ardougne");
}

async function whyDoesHeHaveIt(player, npc) {
    await player.say('Why does he have it?');
    await npc.say(
        'Lord Handelmort is an Ardougnese explorer',
        'Which mean he think he allowed to come and steal our stuff',
        'To put in his private museum'
    );

    const choice = await player.ask(['Ok I will get it back', "How can I find Handlemort's house?"], false);

    if (choice === 0) {
        await startQuest(player);
    } else if (choice === 1) {
        await findHouse(player, npc);
    }
}

async function missionMenu(player, npc) {
    const choice = await player.ask(
        ['Ok I will get it back', 'Why does he have it?', "How can I find Handelmort's house?"],
        false
    );

    if (choice === 0) {
        await startQuest(player);
    } else if (choice === 1) {
        await whyDoesHeHaveIt(player, npc);
    } else if (choice === 2) {
        await findHouse(player, npc);
    }
}

const MISSION = [
    'I need someone to go on a mission',
    'To the city of Ardougne',
    'There you will need to find the house of Lord Handelmort',
    'In his house he has our tribal totem',
    'We need it back'
];

async function kangaiMau(player, npc) {
    const stage = player.questStages.tribalTotem;

    if (!stage) {
        await npc.say('Hello I Kangai Mau', 'Of the Rantuki tribe');

        const choice = await player.ask(
            ['And what are you doing in Brimhaven?', "I'm in search of adventure", 'Who are the Rantuki tribe?'],
            true
        );

        if (choice === 0) {
            await npc.say(
                'I looking for someone brave',
                'To go on important mission for me',
                'Someone skilled in thievery and sneaking about',
                'I am told I can find such people in Brimhaven'
            );

            const subChoice = await player.ask(
                ['Tell me of this mission', 'Yep I have heard there are many of that type here'],
                true
            );

            if (subChoice === 0) {
                await player.say('I may be able to help');
                await npc.say(...MISSION);
                await missionMenu(player, npc);
            }
        } else if (choice === 1) {
            await npc.say('Adventure is something I may be able to give', ...MISSION);
            await missionMenu(player, npc);
        } else if (choice === 2) {
            await npc.say(
                'A proud and noble tribe of Karamja',
                'Now we are few',
                'Men come from across sea',
                'And settle on our hunting grounds'
            );
        }
    } else if (stage === 1 || stage === 2) {
        await npc.say('Have you got our totem back?');

        if (player.inventory.has(TRIBAL_TOTEM_ID)) {
            await player.say('Yes I have');
            await npc.say('Thank you brave adventurer');

            player.completeQuest('tribalTotem', {
                questPoints: 1,
                experience: { thieving: 800 + player.skills.thieving.base * 300 },
                message: 'Well done you have completed the tribal totem quest'
            });

            await npc.say('Here have some freshly cooked Karamja fish', 'Caught specially by our people');
            player.inventory.remove(TRIBAL_TOTEM_ID);
            player.inventory.add(SWORDFISH_ID, 5);
        } else {
            await player.say("No it's not that easy");
            await npc.say('Bah, you no good');
        }
    } else if (stage === -1) {
        await npc.say('greetings esteemed thief');
    }
}

// ---- Horacio -------------------------------------------------------------------------------------------------

async function horacio(player, npc) {
    await npc.say("It's a fine day to be out in the garden isn't it?");

    const choice = await player.ask(["Yes, it's very nice", 'So who are you?'], false);

    if (choice === 0) {
        await player.say("Yes, it's very nice");
    } else if (choice === 1) {
        await player.say('So who are you');
        await npc.say('My name is Horacio Dobson', 'I am the gardener to Lord Handelmort', 'All this around you is my handywork');

        if (player.questStages.tribalTotem) {
            const subChoice = await player.ask(['So do you garden round the back too?', 'Do you need any help?'], true);

            if (subChoice === 0) {
                await npc.say('That I do');
                await player.say("Doesn't all this security in this house", 'get in your way?');
                await npc.say(
                    "Ah, I'm used to all that",
                    'I have my keys, the dogs knows me',
                    'And I know by heart the combination to the door lock',
                    "It's rather easy, it's his middle name"
                );
                await player.say("Who's middle name?");
                await npc.say("Hmm I shouldn't have said that", 'Forget I said it');
            } else if (subChoice === 1) {
                await npc.say('Trying to muscle in on my job ehh?', "I'm happy to do this all myself");
            }
        }
    }
}

// ---- Wizard Cromperty ----------------------------------------------------------------------------------------

async function teleportBlock(player, npc) {
    await npc.say('By all means', "Though I don't know where you will come out", 'Wherever the other teleport block is I suppose');

    const choice = await player.ask(['Yes, that sounds good teleport me', 'That sounds dangerous leave me here'], false);

    if (choice === 0) {
        await player.say('Yes, that sounds good', 'teleport me');
        player.teleport(545, 577, false);
        await messages(player, 'Cromperty takes out a small box', 'Cromperty presses a switch on the box');

        const stage = player.questStages.tribalTotem;

        if (stage === 2 || stage === -1) {
            // the block went to Handelmort mansion with the relabelled crate
            player.teleport(560, 588, true);
        } else {
            // the RPDT depot, where the crate waits to be delivered
            player.teleport(558, 617, true);
        }
    } else if (choice === 1) {
        await player.say('That sounds dangerous leave me here');
    }
}

async function inventedDialogue(player, npc) {
    await npc.say(
        'My latest inevention is my patent pending teleport block',
        'Stand on this block here',
        'I do a bit of the old hocus pocus',
        'And abracadabra you end up on the other teleport block'
    );

    const choice = await player.ask(
        ['So where is the other block?', 'Can I be teleported please?', "Well done, that's very clever"],
        true
    );

    if (choice === 0) {
        await npc.say(
            'I would guess somewhere between here and the wizards tower in Misthalin',
            "All I know is it hasn't got there yet",
            'Or the wizards there would have contacted me',
            'I am using the RPDT to deliver it'
        );

        const subChoice = await player.ask(['Can I be teleported please?', 'Who are the RPDT?'], true);

        if (subChoice === 0) {
            await teleportBlock(player, npc);
        } else if (subChoice === 1) {
            await npc.say('The runescape parcel delivery team');
        }
    } else if (choice === 1) {
        await teleportBlock(player, npc);
    }
}

async function cromperty(player, npc) {
    await npc.say('Hello there', 'My name is Cromperty', 'I am a wizard and an inventor');

    const choice = await player.ask(['Two jobs, thats got to be tough', 'So what have you invented?'], true);

    if (choice === 0) {
        await npc.say("Not when you combine them it isn't", 'I invent magic things');

        const subChoice = await player.ask(['So what have you invented?', 'Well I shall leave you to your inventing'], true);

        if (subChoice === 0) {
            await inventedDialogue(player, npc);
        }
    } else if (choice === 1) {
        await inventedDialogue(player, npc);
    }
}

// ---- RPDT employee -------------------------------------------------------------------------------------------

async function rpdtEmployee(player, npc) {
    const { world } = player;

    await npc.say('Welcome to RPDT');

    if (!('label' in player.cache) || player.questStages.tribalTotem !== 1) {
        await player.say('Thank you very much');
        return;
    }

    const choice = await player.ask(
        ['So when are you going to deliver this crate?', "Thank you, it's interesting in here"],
        true
    );

    if (choice !== 0) {
        return;
    }

    await npc.say('I suppose I could do it now');
    moveNpc(npc, 558, 616);

    // the relabelled crate leaves the depot for 30 seconds
    const crate =
        world.gameObjects && world.gameObjects.getAtPoint(558, 617).find((o) => o.id === WIZARDS_TOWER_CRATE_ID);

    if (crate) {
        world.removeEntity('gameObjects', crate);
        world.setTickTimeout(() => {
            world.addEntity(
                'gameObjects',
                new GameObject(world, { id: crate.id, x: crate.x, y: crate.y, direction: crate.direction })
            );
        }, CRATE_RESPAWN_TICKS);
    }

    player.message('The employee picks up the crate');
    await world.sleepTicks(3);
    moveNpc(npc, 559, 612);
    player.message('And takes it out to be delivered');
    await world.sleepTicks(3);

    delete player.cache.label;
    player.questStages.tribalTotem = 2;
}

const TALKERS = {
    [KANGAI_MAU_ID]: kangaiMau,
    [HORACIO_ID]: horacio,
    [WIZARD_CROMPERTY_ID]: cromperty,
    [RPDT_EMPLOYEE_ID]: rpdtEmployee
};

async function onTalkToNPC(player, npc) {
    const talk = TALKERS[npc.id];

    if (!talk) {
        return false;
    }

    player.engage(npc);
    await talk(player, npc);
    player.disengage(npc);

    return true;
}

// ---- objects -------------------------------------------------------------------------------------------------

async function handelmortCrate(player) {
    await messages(player, 'There is a label on this crate', 'It says', 'to Lord Handelmort', 'Handelmort Mansion', 'Ardougne');

    if (player.inventory.has(ADDRESS_LABEL_ID) || 'label' in player.cache) {
        await messages(player, "It doesn't seem possible to open the crate");
    } else {
        await messages(player, 'You take the label');
        player.inventory.add(ADDRESS_LABEL_ID);
    }
}

async function wizardsTowerCrate(player) {
    if ('label' in player.cache) {
        await messages(player, 'There is a label on this crate', 'It says', 'to Lord Handelmort', 'Handelmort Mansion', 'Ardougne');
        return;
    }

    await messages(
        player,
        'Its ready to be delivered',
        "To the wizard's tower in Misthalin",
        "It doesn't seem possible to open the crate"
    );
}

async function searchStairs(player) {
    if (player.skills.thieving.current < 21) {
        await messages(player, "You don't find anything interesting");
    } else {
        await messages(
            player,
            'You find a trap in the stairs',
            "You make a note of the trap's location",
            'Ready for next time you go up the stairs'
        );
        player.cache.trapy = true;
    }
}

async function goUpStairs(player) {
    if ('trapy' in player.cache) {
        player.message('You go up the stairs');
        delete player.cache.trapy;
        player.teleport(563, 1534, false);
    } else {
        await messages(player, 'You here a click beneath you', 'You feel yourself falling', 'You have fallen through a trap');
        player.teleport(563, 3418, false);
        player.damage(7);
    }
}

function isChest(gameObject) {
    return (
        (gameObject.id === HANDELMORT_CHEST_OPEN || gameObject.id === HANDELMORT_CHEST_CLOSED) &&
        gameObject.x === 560 &&
        gameObject.y === 1531
    );
}

async function searchChest(player) {
    const { world } = player;

    player.message('You search the chest');
    await world.sleepTicks(4);

    if (player.inventory.has(TRIBAL_TOTEM_ID)) {
        player.message('The chest is empty');
        await world.sleepTicks(4);
    } else {
        player.message('You find a tribal totem which you take');
        await world.sleepTicks(4);
        player.inventory.add(TRIBAL_TOTEM_ID);
    }
}

// command one: stairs "Go up", chest "Open" (333) / "Search" (332)
async function onGameObjectCommandOne(player, gameObject) {
    if (isAt(gameObject, HANDELMORT_STAIRS_ID, 563, 587)) {
        await goUpStairs(player);
        return true;
    }

    if (isChest(gameObject)) {
        if (gameObject.id === HANDELMORT_CHEST_CLOSED) {
            player.world.replaceEntity('gameObjects', gameObject, HANDELMORT_CHEST_OPEN);
            player.message('You open the chest');
        } else {
            await searchChest(player);
        }

        return true;
    }

    return false;
}

// command two: the crates' "Search", stairs "Search for traps", chest "Close" (332)
async function onGameObjectCommandTwo(player, gameObject) {
    if (isAt(gameObject, EMPTY_CRATE_ID, 557, 615) || isAt(gameObject, EMPTY_CRATE_ID, 557, 614)) {
        player.message('The crate is empty');
        return true;
    }

    if (isAt(gameObject, HANDELMORT_CRATE_ID, 559, 617)) {
        await handelmortCrate(player);
        return true;
    }

    if (isAt(gameObject, WIZARDS_TOWER_CRATE_ID, 558, 617)) {
        await wizardsTowerCrate(player);
        return true;
    }

    if (isAt(gameObject, HANDELMORT_STAIRS_ID, 563, 587)) {
        await searchStairs(player);
        return true;
    }

    if (isChest(gameObject) && gameObject.id === HANDELMORT_CHEST_OPEN) {
        player.world.replaceEntity('gameObjects', gameObject, HANDELMORT_CHEST_CLOSED);
        player.message('You close the chest');
        return true;
    }

    return false;
}

async function onUseWithGameObject(player, gameObject, item) {
    if (gameObject.id !== WIZARDS_TOWER_CRATE_ID || item.id !== ADDRESS_LABEL_ID) {
        return false;
    }

    if (player.questStages.tribalTotem === -1) {
        player.message("You've already done this!");
    } else {
        player.message('You stick the label on the crate');
        await player.say('Now I just need someone to deliver it for me');
        player.inventory.remove(ADDRESS_LABEL_ID);
        player.cache.label = true;
    }

    return true;
}

// the combination door: four dials, B R A D opens it. The Java keeps the first three answers in fields of the plugin
// instance (shared by every player and never reset, so one right dial stayed right for everyone afterwards); here they
// are locals of one attempt.
async function onWallObjectCommandOne(player, wallObject) {
    if (!isAt(wallObject, COMBINATION_DOOR_ID, 561, 586)) {
        return false;
    }

    const letters = ['postition A', 'position B', 'Position C', 'Position D']; // sic

    player.message('choose a position for dial 1');
    const firstRight = (await player.ask(letters, true)) === 1;

    player.message('choose a position for dial 2');
    const secondRight = (await player.ask(['position R', 'position S', 'position T', 'Position U'], true)) === 0;

    player.message('choose a position for dial 3');
    const thirdRight = (await player.ask(letters, true)) === 0;

    player.message('choose a position for dial 4');
    const fourthRight = (await player.ask(letters, true)) === 3;

    if (firstRight && secondRight && thirdRight && fourthRight) {
        player.message('You here a satisfying click');
        player.message('You go through the door');
        await player.enterDoor(wallObject);
    } else {
        player.message('The door fails to open');
    }

    return true;
}

module.exports = {
    onTalkToNPC,
    onGameObjectCommandOne,
    onGameObjectCommandTwo,
    onUseWithGameObject,
    onWallObjectCommandOne
};
