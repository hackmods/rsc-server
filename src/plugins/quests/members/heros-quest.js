// Ported from Open-RSC Core-Framework authentic/quests/members/HerosQuest.java, the Hero's Guild door in
// authentic/defaults/DoorAction.java (DOOR_HEROS_GUILD) and the candlestick / miscellaneous key hand-over in
// authentic/itemactions/ArravInvUseOnPlayer.java (AGPL-3.0).
// Reward from plugins/shared/QuestRewardRegistrar.java (HEROS_QUEST: 1 quest point, 300 + 200 per level in twelve skills).
//
// Stages (player.questStages.herosQuest):
//   0 / undefined  Achetties (253) at the Hero's Guild door (Taverley, 372,441) takes applicants with 55 quest points and
//                  Shield of Arrav, Lost City, Merlin's Crystal and Dragon Slayer done -> 1
//   1              find the feather of an Entrana firebird (557, ice gloves 556 worn to pick it up), a cooked lava eel
//                  (590: Gerrant's blamish oil on a fishing rod, npcs/port-sarim/gerrant.js) and a master thief armband
//                  (586: from Katrine or Straven for one of Scarface Pete's candlesticks 585). The candlesticks take two
//                  players, one from each Shield of Arrav gang:
//                  - Black Arm: Katrine (cache blackarm_mission) -> Grubor at the Palm Street door 76 (439,694),
//                    password "four leaved clover" (talked_grubor) -> Trobert gives Hartigen's ID paper 573
//                    (hq_impersonate) -> in black plate body, legs and large helmet, Garv (door 75, 463,681) lets you in
//                    (garv_door) -> Grip takes the paper (talked_grip, door 77 at 463,676 opens) and, asked for work,
//                    hands over the miscellaneous key 582. Trying Grip's drinks cabinet 263 makes Grip come into his room.
//                  - Phoenix: Straven (pheonix_mission, pheonix_alf) -> Alfonse the waiter "Do you sell Gherkins?"
//                    (talked_alf) -> the kitchen door 78 (448,682) -> Olbor's garden -> the strange panel 79 (456,679)
//                    -> door 80 (459,674), opened with the miscellaneous key from the Black Arm partner, into the range
//                    room (459-460 x 672-673): Grip can only be shot or cast at from there (killed_grip).
//                  - Grip drops a bunch of keys 583 (grip_keys when picked up); they open the treasure room door 81
//                    (472,674) and the chest 265 (469,672) gives two candlesticks (looted_grip) -> 2. One goes to the
//                    partner (use it on them).
//   2              the candlesticks are out; Katrine (looted_grip) or Straven (killed_grip) swaps one for the armband
//   -1             Achetties takes the three items: 1 quest point and 300 + 200 x level experience (quarter points) in
//                  strength, defense, hits, attack, ranged, herblaw, fishing, cooking, firemaking, woodcutting, mining
//                  and smithing. The guild door opens from then on.
// Katrine and Straven's parts are in quests/free/shield-of-arrav/{katrine,straven}.js, Alfonse's in
// npcs/brimhaven/alfonse-the-waiter.js and Charlie the cook in npcs/brimhaven/charlie-the-cook.js.
//
// Not ported: the strength cape (WANT_CUSTOM_SPRITES) and the Combat Odyssey (custom). DoorAction completes the quest
// at the guild door without taking the three items (a Java slip): here the door hands them in like Achetties does.

const ACHETTIES_ID = 253;
const GRUBOR_ID = 255;
const TROBERT_ID = 256;
const GARV_ID = 257;
const PIRATE_GUARD_ID = 258;
const GRIP_ID = 259;
const ALFONSE_ID = 260;

const LARGE_BLACK_HELMET_ID = 230;
const BLACK_PLATE_BODY_ID = 196;
const BLACK_PLATE_LEGS_ID = 248;
const ICE_GLOVES_ID = 556;
const FIREBIRD_FEATHER_ID = 557;
const ID_PAPER_ID = 573;
const MISCELLANEOUS_KEY_ID = 582;
const BUNCH_OF_KEYS_ID = 583;
const WHISKY_ID = 584;
const CANDLESTICK_ID = 585;
const MASTER_THIEF_ARMBAND_ID = 586;
const LAVA_EEL_ID = 590;

const GUILD_DOOR_ID = 74;
const GARV_DOOR_ID = 75;
const GRUBOR_DOOR_ID = 76;
const GRIP_DOOR_ID = 77;
const KITCHEN_DOOR_ID = 78;
const STRANGE_PANEL_ID = 79;
const RANGE_ROOM_DOOR_ID = 80;
const TREASURE_DOOR_ID = 81;

const CUPBOARD_CLOSED_ID = 263;
const CUPBOARD_OPEN_ID = 264;
const CHEST_OPEN_ID = 265;
const CHEST_CLOSED_ID = 266;

// Java SingleEvent(GAME_TICK * 1000): Grip goes back to his post after 1000 ticks
const GRIP_RETURN_TICKS = 1000;

const REWARD_SKILLS = [
    'strength',
    'defense',
    'hits',
    'attack',
    'ranged',
    'herblaw',
    'fishing',
    'cooking',
    'firemaking',
    'woodcutting',
    'mining',
    'smithing'
];

const QUEST_FLAGS = [
    'talked_grip',
    'killed_grip',
    'looted_grip',
    'grip_keys',
    'hq_impersonate',
    'talked_alf',
    'talked_grubor',
    'blackarm_mission',
    'garv_door',
    'armband'
];

const NOT_HERE = [
    "I can't attack the head guard here",
    'There are too many witnesses to see me do it',
    "I'd have the whole of Brimhaven after me",
    'Besides if he dies I want to have the chance of being promoted'
];

let gripReturnTimer = null;

function stageOf(player) {
    return player.questStages.herosQuest || 0;
}

// ShieldOfArrav.isBlackArmGang / isPhoenixGang: the gang the player joined in Shield of Arrav
function isBlackArmGang(player) {
    return player.cache.blackArmStage === -1;
}

function isPhoenixGang(player) {
    return player.cache.phoenixStage === -1;
}

function isAt(entity, id, x, y) {
    return entity.id === id && entity.x === x && entity.y === y;
}

// Point.inHeroQuestRangeRoom
function inRangeRoom(player) {
    return player.x >= 459 && player.x <= 460 && player.y >= 672 && player.y <= 673;
}

// Open-RSC ifnearvisnpc: the nearest one within `radius` tiles
function nearNpc(player, id, radius) {
    return player
        .getNearbyEntitiesByID('npcs', id, radius * 2 + 1)
        .filter((npc) => !npc.opponent)
        .sort((a, b) => player.getDistance(a) - player.getDistance(b))[0];
}

// Java n.teleport(x, y) on an NPC: the JS model has no NPC teleport, so move it and tell the players who see it
function moveNpc(npc, x, y) {
    npc.x = x;
    npc.y = y;

    if (typeof npc.broadcastMove === 'function') {
        npc.broadcastMove();
    }
}

function wearsBlackArmour(player) {
    return (
        player.inventory.isEquipped(BLACK_PLATE_LEGS_ID) &&
        player.inventory.isEquipped(LARGE_BLACK_HELMET_ID) &&
        player.inventory.isEquipped(BLACK_PLATE_BODY_ID)
    );
}

function hasQuestItems(player) {
    return (
        player.inventory.has(MASTER_THIEF_ARMBAND_ID) &&
        player.inventory.has(LAVA_EEL_ID) &&
        player.inventory.has(FIREBIRD_FEATHER_ID)
    );
}

// HerosQuest.handleReward
function completeQuest(player) {
    player.inventory.remove(MASTER_THIEF_ARMBAND_ID);
    player.inventory.remove(LAVA_EEL_ID);
    player.inventory.remove(FIREBIRD_FEATHER_ID);

    for (const flag of QUEST_FLAGS) {
        delete player.cache[flag];
    }

    const experience = {};

    for (const skill of REWARD_SKILLS) {
        experience[skill] = player.skills[skill].base * 200 + 300;
    }

    player.completeQuest('herosQuest', {
        questPoints: 1,
        experience,
        message: 'Well done you have completed the hero guild entry quest'
    });
}

function meetsRequirements(player) {
    const { questStages } = player;

    return (
        questStages.lostCity === -1 &&
        questStages.shieldOfArrav === -1 &&
        questStages.merlinsCrystal === -1 &&
        questStages.dragonSlayer === -1 &&
        player.questPoints >= 55
    );
}

async function hints(player, npc, sayLast) {
    const choice = await player.ask(
        [
            'Any hints on getting the armband?',
            'Any hints on getting the feather?',
            'Any hints on getting the eel?',
            "I'll start looking for all those things then"
        ],
        false
    );

    if (choice === 0) {
        await player.say('Any hints on getting the thieves armband?');
        await npc.say("I'm sure you have relevant contacts to find out about that");
    } else if (choice === 1) {
        await player.say('Any hints on getting the feather?');
        await npc.say('Not really - Entrana firebirds live on Entrana');
    } else if (choice === 2) {
        await player.say('Any hints on getting the eel?');
        await npc.say('Maybe go and find someone who knows a lot about fishing?');
    } else if (choice === 3 && sayLast) {
        // DoorAction says it; Achetties' own menu leaves it unsaid
        await player.say("I'll start looking for all those things then");
    }
}

async function howGoesThyQuest(player, npc, atDoor = false) {
    await npc.say("Greetings welcome to the hero's guild", 'How goes thy quest?');

    if (hasQuestItems(player)) {
        await player.say('I have all the things needed');
        completeQuest(player);
        return;
    }

    await player.say("It's tough, I've not done it yet");
    await npc.say(
        'Remember you need the feather of an Entrana firebird',
        'A master thief armband',
        'And a cooked lava eel'
    );
    await hints(player, npc, atDoor);
}

async function achetties(player, npc) {
    const stage = stageOf(player);

    if (stage === 0) {
        await npc.say(
            "Greetings welcome to the hero's guild",
            "Only the foremost hero's of the land can enter here"
        );

        const choice = await player.ask(
            ["I'm a hero, may I apply to join?", "Good for the foremost hero's of the land"],
            true
        );

        if (choice !== 0) {
            return;
        }

        if (!meetsRequirements(player)) {
            const { world } = player;

            await npc.say("You're a hero?, I've never heard of you");
            player.message('You need to have 55 quest points to file for an application');
            await world.sleepTicks(3);
            player.message('You also need to have completed the following quests');
            await world.sleepTicks(3);
            player.message('The shield of arrav, the lost city');
            await world.sleepTicks(3);
            player.message('Merlin\'s crystal and dragon slayer"'); // sic
            await world.sleepTicks(3);
            return;
        }

        await npc.say(
            'Ok you may begin the tasks for joining the hero\'s guild',
            'You need the feather of an Entrana firebird',
            'A master thief armband',
            'And a cooked lava eel'
        );

        player.questStages.herosQuest = 1;

        const hint = await player.ask(
            [
                'Any hints on getting the armband?',
                'Any hints on getting the feather?',
                'Any hints on getting the eel?',
                "I'll start looking for all those things then"
            ],
            false
        );

        if (hint === 0) {
            await player.say('Any hints on getting the thieves armband?');
            await npc.say("I'm sure you have relevant contacts to find out about that");
        } else if (hint === 1) {
            await player.say('Any hints on getting the feather?');
            await npc.say('Not really - Entrana firebirds live on Entrana');
        } else if (hint === 2) {
            await player.say('Any hints on getting the eel?');
            await npc.say('Maybe go and find someone who knows a lot about fishing?');
        }
    } else if (stage === 1 || stage === 2) {
        await howGoesThyQuest(player, npc);
    } else {
        await npc.say("Greetings welcome to the hero's guild");
    }
}

// ---- Scarface Pete's mansion ---------------------------------------------------------------------------------

async function treasureRoomLines(npc) {
    await npc.say(
        'Well I might post you outside it sometimes',
        'I prefer to be the only one allowed inside though',
        "There's some pretty valuable stuff in there",
        "Those keys stay only with the head guard and with Scarface Pete"
    );
}

async function dutiesDialogue(player, npc) {
    await npc.say(
        "You'll have various guard duty shifts",
        'I may have specific tasks to give you as they come up',
        'If anything happens to me you need to take over as head guard',
        "You'll find Important keys to the treasure room and Pete's quarters",
        'Inside my jacket'
    );

    const choice = await player.ask(
        [
            'So can I guard the treasure room please',
            "Well I'd better sort my new room out",
            'Anything I can do now?'
        ],
        true
    );

    if (choice === 0) {
        await treasureRoomLines(npc);
    } else if (choice === 1) {
        await npc.say("Yeah I'll give you time to settle in");
    } else if (choice === 2) {
        if (!player.inventory.has(MISCELLANEOUS_KEY_ID)) {
            await npc.say(
                'Hmm well you could find out what this key does',
                "Apparantly it's to something in this building", // sic
                "Though I don't for the life of me know what"
            );
            await player.say('Grip hands you a key');
            player.inventory.add(MISCELLANEOUS_KEY_ID);
        } else {
            await npc.say("Can't think of anything right now");
        }
    }
}

async function treasureRoomDialogue(player, npc) {
    await treasureRoomLines(npc);

    const choice = await player.ask(
        ['So what do my duties involve?', "Well I'd better sort my new room out"],
        true
    );

    if (choice === 0) {
        await dutiesDialogue(player, npc);
    } else if (choice === 1) {
        await npc.say("Yeah I'll give you time to settle in");
    }
}

async function gripMenu(player, npc) {
    const choice = await player.ask(
        [
            'So can I guard the treasure room please',
            'So what do my duties involve?',
            "Well I'd better sort my new room out"
        ],
        true
    );

    if (choice === 0) {
        await treasureRoomDialogue(player, npc);
    } else if (choice === 1) {
        await dutiesDialogue(player, npc);
    } else if (choice === 2) {
        await npc.say("Yeah I'll give you time to settle in");
    }
}

async function grip(player, npc) {
    if (player.cache.talked_grip || stageOf(player) === -1) {
        await gripMenu(player, npc);
        return;
    }

    await player.say('Hi I am Hartigen', "I've come to take the job as your deputy");
    await npc.say(
        "Ah good at last, you took you're time getting here", // sic
        'Now let me see',
        'Your quarters will be that room nearest the sink',
        "I'll get your hours of duty sorted in a bit",
        'Oh and have you got your I.D paper',
        'Internal security is almost as important as external security for a guard'
    );

    if (!player.inventory.has(ID_PAPER_ID)) {
        await player.say("Oh dear I don't have that with me any more");
        return;
    }

    player.message('You hand your I.D paper to grip');
    player.inventory.remove(ID_PAPER_ID);
    player.cache.talked_grip = true;
    await gripMenu(player, npc);
}

async function garvInspect(player, npc) {
    await player.say("Hi, I'm Hartigen", "I've come to work here");

    if (!wearsBlackArmour(player)) {
        await npc.say('Hartigen the black knight?', "I don't think so - he doesn't dress like that");
        return;
    }

    await npc.say('So have you got your i.d paper?');

    if (player.inventory.has(ID_PAPER_ID)) {
        await npc.say('You had better come in then', 'Grip will want to talk to you');
        player.cache.garv_door = true;
    } else {
        await player.say('No I must have left it in my other suit of armour');
    }
}

async function garv(player, npc) {
    await npc.say('Hello, what do you want?');

    if (isBlackArmGang(player) && player.cache.hq_impersonate && !player.cache.garv_door) {
        await garvInspect(player, npc);
        return;
    }

    const choice = await player.ask(['Can I go in there?', 'I want for nothing'], true);

    if (choice === 0) {
        await npc.say('No in there is private');
    } else if (choice === 1) {
        await npc.say("You're one of a very lucky few then");
    }
}

async function trobert(player, npc) {
    if (stageOf(player) === -1) {
        return;
    }

    if (player.cache.hq_impersonate) {
        if (player.inventory.has(ID_PAPER_ID)) {
            return;
        }

        await player.say("I have lost Hartigen's I.D paper");
        await npc.say('That was careless', 'He had a spare fortunatley', 'Here it is'); // sic
        player.inventory.add(ID_PAPER_ID);
        await npc.say('Be more careful this time');
        return;
    }

    await npc.say('Hi, welcome to our Brimhaven headquarters', "I'm Trobert and I'm in charge here");

    const choice = await player.ask(
        ["So can you help me get Scarface Pete's candlesticks?", 'pleased to meet you'],
        false
    );

    if (choice === 0) {
        await player.say("So can you help me get Scarface Pete's candlesticks?");
        await npc.say(
            'Well we have made some progress there',
            "We know one of the keys to Pete's treasure room is carried by Grip the head guard",
            'So we thought it might be good to get close to the head guard',
            'Grip was taking on a new deputy called Hartigen',
            'Hartigen was an Asgarnian black knight',
            'However he was deserting the black knight fortress and seeking new employment',
            'We managed to waylay him on the way here',
            'We now have his i.d paper',
            'Next we need someone to impersonate the black knight'
        );

        const volunteer = await player.ask(['I volunteer to undertake that mission', 'Well good luck then'], true);

        if (volunteer === 0) {
            await npc.say("Well here's the I.d");
            player.inventory.add(ID_PAPER_ID);
            player.cache.hq_impersonate = true;
            await npc.say("Take that to the guard room at Scarface Pete's mansion");
        }
    } else if (choice === 1) {
        await player.say('Pleased to meet you');
    }
}

async function onTalkToNPC(player, npc) {
    const handlers = {
        [ACHETTIES_ID]: achetties,
        [GRUBOR_ID]: async () => {
            await player.say('Hi');
            await npc.say("Hi, I'm a little busy right now");
        },
        [TROBERT_ID]: trobert,
        [GRIP_ID]: grip,
        [GARV_ID]: garv
    };

    const handler = handlers[npc.id];

    if (!handler) {
        return false;
    }

    player.engage(npc);
    await handler(player, npc);
    player.disengage();
    return true;
}

// ---- doors ----------------------------------------------------------------------------------------------------

async function withNpc(player, npc, fn) {
    if (!npc || npc.interlocutor) {
        return;
    }

    player.engage(npc);
    await fn(npc);
    player.disengage();
}

async function goThrough(player, wallObject) {
    player.message('you open the door');
    player.message('You go through the door');
    await player.enterDoor(wallObject);
}

async function guildDoor(player, wallObject) {
    if (stageOf(player) === -1) {
        await player.enterDoor(wallObject);
        return;
    }

    const npc = nearNpc(player, ACHETTIES_ID, 10);

    await withNpc(player, npc, async (achettiesNpc) => {
        if (stageOf(player) === 0) {
            await achetties(player, achettiesNpc);
        } else {
            await howGoesThyQuest(player, achettiesNpc, true);
        }
    });
}

async function gruborDoor(player, wallObject) {
    const grubor = nearNpc(player, GRUBOR_ID, 10);

    if (stageOf(player) === -1) {
        await withNpc(player, grubor, async (npc) => {
            await npc.say('Yes? what do you want?');

            const choice = await player.ask(
                ['Would you like to have your windows refitting?', 'I want to come in', 'Do you want to trade?'],
                false
            );

            if (choice === 0) {
                await player.say('Would you like to have your windows refitting?');
                await npc.say("Don't be daft, we don't have any windows");
            } else if (choice === 1) {
                await player.say('I want to come in');
                await npc.say('No, go away');
            } else if (choice === 2) {
                await player.say('Do you want to trade');
                await npc.say("No I'm busy");
            }
        });
        return;
    }

    if (!player.cache.blackarm_mission) {
        player.message("The door won't open");
        return;
    }

    if (player.cache.talked_grubor) {
        await goThrough(player, wallObject);
        return;
    }

    await withNpc(player, grubor, async (npc) => {
        await npc.say('Yes? what do you want?');

        const choice = await player.ask(['Rabbit\'s foot', 'four leaved clover', 'Lucky Horseshoe', 'Black cat'], false);

        if (choice === 1) {
            await player.say('Four leaved clover');
            await npc.say("Oh you're one of the gang are you", "Just a second I'll let you in");
            player.message('You here the door being unbarred'); // sic
            player.cache.talked_grubor = true;
            return;
        }

        if (choice === 0) {
            await player.say("Rabbit's foot");
        } else if (choice === 2) {
            await player.say('Lucky Horseshoe');
        } else if (choice === 3) {
            await player.say('Black cat');
        }

        await npc.say('What are you on about', 'Go away');
    });
}

async function gripDoor(player, wallObject) {
    if (!player.cache.talked_grip && stageOf(player) !== -1) {
        player.message("You can't get through the door");
        player.message('You need to speak to grip first');
        return;
    }

    const { world } = player;
    const gripNpc = player.getNearestEntityByID('npcs', GRIP_ID, 31);

    // Grip leaves his room behind the player when he is not fighting and the player opens it from inside
    const moveGrip = player.y <= 675 && gripNpc && gripNpc.y <= 675 && !gripNpc.opponent;

    await goThrough(player, wallObject);

    if (moveGrip) {
        clearGripReturn(world);
        world.setTickTimeout(() => moveNpc(gripNpc, 463, 676), 2);
    }
}

function clearGripReturn(world) {
    if (gripReturnTimer && typeof world.clearTickTimeout === 'function') {
        world.clearTickTimeout(gripReturnTimer);
    }

    gripReturnTimer = null;
}

async function onWallObjectCommandOne(player, wallObject) {
    if (isAt(wallObject, GUILD_DOOR_ID, 372, 441)) {
        await guildDoor(player, wallObject);
        return true;
    }

    if (isAt(wallObject, KITCHEN_DOOR_ID, 448, 682)) {
        if (player.cache.talked_alf || stageOf(player) === -1) {
            await goThrough(player, wallObject);
        } else {
            await withNpc(player, nearNpc(player, ALFONSE_ID, 10), async (npc) => {
                await npc.say("Hey you can't go through there, that's private");
            });
        }

        return true;
    }

    if (isAt(wallObject, GRUBOR_DOOR_ID, 439, 694)) {
        await gruborDoor(player, wallObject);
        return true;
    }

    if (isAt(wallObject, GARV_DOOR_ID, 463, 681)) {
        if (player.cache.garv_door || stageOf(player) === -1) {
            await goThrough(player, wallObject);
            return true;
        }

        await withNpc(player, nearNpc(player, GARV_ID, 12), async (npc) => {
            await npc.say("Where do you think you're going?");

            if (isBlackArmGang(player) && player.cache.hq_impersonate) {
                await garvInspect(player, npc);
            }
        });

        return true;
    }

    if (isAt(wallObject, GRIP_DOOR_ID, 463, 676)) {
        await gripDoor(player, wallObject);
        return true;
    }

    if (isAt(wallObject, STRANGE_PANEL_ID, 456, 679)) {
        player.sendSound('secretdoor');
        player.message('You just went through a secret door');
        await player.enterDoor(wallObject, 11);
        return true;
    }

    if (isAt(wallObject, RANGE_ROOM_DOOR_ID, 459, 674)) {
        player.message('The door is locked');
        await player.say(
            "This room isn't a lot of use on it's own",
            'Maybe I can get extra help from the inside somehow',
            'I wonder if any of the other players have found a way in'
        );
        return true;
    }

    if (isAt(wallObject, TREASURE_DOOR_ID, 472, 674)) {
        player.message('The door is locked');
        return true;
    }

    return false;
}

async function onUseWithWallObject(player, wallObject, item) {
    if (isAt(wallObject, RANGE_ROOM_DOOR_ID, 459, 674)) {
        if (item.id !== MISCELLANEOUS_KEY_ID) {
            return false;
        }

        player.sendBubble(item.id);
        player.message('You unlock the door');
        player.message('You go through the door');
        await player.enterDoor(wallObject);
        return true;
    }

    if (isAt(wallObject, TREASURE_DOOR_ID, 472, 674)) {
        if (item.id !== BUNCH_OF_KEYS_ID) {
            return false;
        }

        player.message('You open the door');
        player.message('You go through the door');
        await player.enterDoor(wallObject);
        return true;
    }

    return false;
}

// ---- Grip's drinks cabinet and Scarface Pete's chest ---------------------------------------------------------

async function cupboard(player, gameObject, command) {
    const { world } = player;
    const guard = nearNpc(player, PIRATE_GUARD_ID, 10);

    if (!guard) {
        player.message('The guard is busy at the moment');
        return;
    }

    let peek = false;

    await withNpc(player, guard, async (npc) => {
        await npc.say("I don't think Mr Grip will like you opening that up", "That's his drinks cabinet");
        peek = (await player.ask(["He won't notice me having a quick look", "Ok I'll leave it"], true)) === 0;
    });

    if (!peek) {
        return;
    }

    const gripNpc = player.getNearestEntityByID('npcs', GRIP_ID, 31);

    if (gripNpc) {
        // Grip comes into his room to shout at you; he goes back to his post after 1000 ticks
        moveNpc(gripNpc, 463, 673);
        clearGripReturn(world);
        gripReturnTimer = world.setTickTimeout(() => {
            gripReturnTimer = null;

            if (gripNpc.y <= 675) {
                moveNpc(gripNpc, 463, 677);
            }
        }, GRIP_RETURN_TICKS);

        await withNpc(player, gripNpc, async (npc) => {
            await npc.say('Hey what are you doing there', "That's my drinks cabinet get away from it");
        });
    } else if (command === 'open') {
        world.replaceEntity('gameObjects', gameObject, CUPBOARD_OPEN_ID);
        player.message('You open the cupboard');
    } else {
        player.message('You find a bottle of whisky in the cupboard');
        player.inventory.add(WHISKY_ID);
    }
}

async function chestSearch(player) {
    const { world } = player;

    if (player.inventory.has(CANDLESTICK_ID) || (!player.cache.grip_keys && stageOf(player) !== -1)) {
        player.message('The chest is empty');
        return;
    }

    player.inventory.add(CANDLESTICK_ID, 2);
    player.message('You find two candlesticks in the chest');
    await world.sleepTicks(3);
    player.message('So that will be one for you');
    await world.sleepTicks(3);
    player.message('And one to the person who killed grip for you');
    await world.sleepTicks(3);

    if (stageOf(player) === 1) {
        player.questStages.herosQuest = 2;
    }

    if (stageOf(player) >= 1) {
        player.cache.looted_grip = true;
    }
}

async function onGameObjectCommandOne(player, gameObject) {
    const { world } = player;

    switch (gameObject.id) {
        case CUPBOARD_CLOSED_ID:
            await cupboard(player, gameObject, 'open');
            return true;
        case CUPBOARD_OPEN_ID:
            await cupboard(player, gameObject, 'search');
            return true;
        case CHEST_CLOSED_ID:
            world.replaceEntity('gameObjects', gameObject, CHEST_OPEN_ID);
            player.message('You open the chest');
            return true;
        case CHEST_OPEN_ID:
            await chestSearch(player);
            return true;
    }

    return false;
}

async function onGameObjectCommandTwo(player, gameObject) {
    const { world } = player;

    if (gameObject.id === CUPBOARD_OPEN_ID) {
        world.replaceEntity('gameObjects', gameObject, CUPBOARD_CLOSED_ID);
        player.message('You close the cupboard');
        return true;
    }

    if (gameObject.id === CHEST_OPEN_ID) {
        world.replaceEntity('gameObjects', gameObject, CHEST_CLOSED_ID);
        player.message('You close the chest');
        return true;
    }

    return false;
}

// ---- the firebird feather and Grip's keys ------------------------------------------------------------------

async function onGroundItemTake(player, groundItem) {
    if (groundItem.id === FIREBIRD_FEATHER_ID) {
        if (stageOf(player) <= 0) {
            // stage -1 counts too, as in the Java (getQuestStage <= 0)
            await player.say('It looks dangerously hot', 'And I have no reason to take it');
            return true;
        }

        if (!player.inventory.isEquipped(ICE_GLOVES_ID)) {
            player.message('Ouch that is too hot to take');
            player.message('I need something cold to pick it up with');
            player.damage(Math.round(player.skills.hits.current * 0.15));
            return true;
        }

        return false;
    }

    if (groundItem.id === BUNCH_OF_KEYS_ID) {
        if (!player.cache.grip_keys && stageOf(player) >= 1) {
            player.cache.grip_keys = true;
        }

        player.world.removeEntity('groundItems', groundItem);
        player.inventory.add(BUNCH_OF_KEYS_ID);
        player.sendSound('takeobject');
        return true;
    }

    return false;
}

// ---- Grip: only from the range room --------------------------------------------------------------------------

async function tooManyWitnesses(player) {
    await player.say(...NOT_HERE);
    player.message("Maybe you need another player's help");
}

async function onNPCAttack(player, npc) {
    if (npc.id !== GRIP_ID) {
        return false;
    }

    // blockAttackNpc claims every melee attack on Grip; only the range room says nothing
    if (!inRangeRoom(player)) {
        await tooManyWitnesses(player);
    }

    return true;
}

async function onNPCRangedAttack(player, npc) {
    if (npc.id !== GRIP_ID || inRangeRoom(player)) {
        return false;
    }

    await tooManyWitnesses(player);
    return true;
}

async function onCastOnNPC(player, npc) {
    if (npc.id !== GRIP_ID || inRangeRoom(player)) {
        return false;
    }

    await tooManyWitnesses(player);
    return true;
}

// Grip's bunch of keys is his rsc-data drop; the kill only marks the killer's part
async function onNPCDeath(player, npc) {
    if (npc.id !== GRIP_ID || !player) {
        return false;
    }

    if (!player.cache.killed_grip && stageOf(player) >= 1) {
        player.cache.killed_grip = true;
    }

    clearGripReturn(player.world);
    return false;
}

// ---- ArravInvUseOnPlayer: the key and the candlestick change hands -----------------------------------------

async function onUseWithPlayer(player, otherPlayer, item) {
    if (item.id !== MISCELLANEOUS_KEY_ID && item.id !== CANDLESTICK_ID) {
        return false;
    }

    if (otherPlayer.inventory.isFull()) {
        player.message("Other player doesn't have enough inventory space to receive the object");
        return true;
    }

    const name = item.definition ? item.definition.name : item.id === CANDLESTICK_ID ? 'Candlestick' : 'Miscellaneous key';

    player.inventory.remove(item.id);
    otherPlayer.inventory.add(item.id);
    player.message(`You give the ${name} to ${otherPlayer.username}`);
    await player.world.sleepTicks(1);
    otherPlayer.message(`${player.username} has given you a ${name}`);
    return true;
}

module.exports = {
    onTalkToNPC,
    onWallObjectCommandOne,
    onUseWithWallObject,
    onGameObjectCommandOne,
    onGameObjectCommandTwo,
    onGroundItemTake,
    onNPCAttack,
    onNPCRangedAttack,
    onCastOnNPC,
    onNPCDeath,
    onUseWithPlayer,
    isBlackArmGang,
    isPhoenixGang
};
