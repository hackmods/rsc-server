// Ported from Open-RSC Core-Framework authentic/quests/members/touristtrap/TouristTrap.java (AGPL-3.0): the hooks of the
// quest (who talks, the doors and gates of the mining camp, the captain's chest, the jail window, the refusals to attack
// the guards). The conversations are in dialogue.js, the mine's objects in mechanism.js. https://classic.runescape.wiki/w/Tourist_Trap
//
// Not ported: nothing of the quest. The Java's `delay`ed SingleEvents (Captain Siad's evening snooze, the draft mercenary
// leaving) are tick timeouts. The Java wield-position check of the mercenaries (`playerArmed`) is read from the item's equip
// slots: head, body, shield, weapon, hands, feet, neck and cape count (legs do not), except the Desert Clothes, the slaves'
// robes and the metal key.

const {
    ITEM,
    NPC,
    TICK_MS,
    stageOf,
    setStage,
    inTouristTrapCave,
    cacheHas,
    cacheGet,
    cacheSet,
    cacheDel,
    mes,
    nearNpc,
    spawnNpc,
    removeNpc,
    moveNpc,
    attackPlayer,
    withAttacks
} = require('./shared');
const {
    AlShabim,
    Mercenary,
    alShabimDialogue,
    anaDialogue,
    bedabinNomadDialogue,
    captainSiadDialogue,
    desertTPPoints,
    escapingSlaveDialogue,
    failEscapeAnaInBarrel,
    failWindowAnaInBarrel,
    irenaDialogue,
    mercenaryCaptainDialogue,
    mercenaryDialogue,
    mercenaryInsideDialogue,
    rewardMenu,
    slaveDialogue,
    tryToAttackMercenarys
} = require('./dialogue');

const STONE_GATE = 916;
const IRON_GATE = 932;
const JAIL_DOOR = 177;
const WINDOW = 178;
const ROCK_1 = 953;
const WOODEN_DOORS = 958;
const DESK = 1023;
const BOOKCASE = 1004;
const CAPTAINS_CHEST = 1005;
const TENT_DOOR_1 = 198;
const TENT_DOOR_2 = 196;
const CAVE_JAIL_DOOR = 180;
const STURDY_IRON_GATE = 200;

const TALK_IDS = new Set([
    NPC.IRENA,
    NPC.MERCENARY,
    NPC.MERCENARY_CAPTAIN,
    NPC.MERCENARY_ESCAPEGATES,
    NPC.CAPTAIN_SIAD,
    NPC.MINING_SLAVE,
    NPC.ESCAPING_MINING_SLAVE,
    NPC.BEDABIN_NOMAD,
    NPC.BEDABIN_NOMAD_GUARD,
    NPC.AL_SHABIM,
    NPC.MERCENARY_LIFTPLATFORM,
    NPC.MERCENARY_JAILDOOR,
    NPC.ANA
]);

// the guards the quest keeps from being attacked (TouristTrap.blockAttackNpc)
const GUARD_IDS = new Set([
    NPC.CAPTAIN_SIAD,
    NPC.MERCENARY,
    NPC.MERCENARY_ESCAPEGATES,
    NPC.MERCENARY_LIFTPLATFORM,
    NPC.MERCENARY_JAILDOOR
]);

// the Desert Clothes, the slaves' robes and the metal key may be worn past the guards (TouristTrap.allow)
const ALLOWED_WORN = new Set([
    ITEM.DESERT_ROBE,
    ITEM.DESERT_SHIRT,
    ITEM.METAL_KEY,
    ITEM.SLAVES_ROBE_BOTTOM,
    ITEM.SLAVES_ROBE_TOP
]);

// Siad's evening snooze and the draft mercenary's leaving: the Java's SingleEvent delays in ticks
const SIAD_TICKS = 490;
const SIAD_LEAVE_TICKS = 5;
const DRAFT_TICKS = 50;
const DRAFT_LEAVE_TICKS = 5;

// the Java's click strings are the object definition's, lower case
function commandOf(entity, index) {
    const commands = (entity.definition && entity.definition.commands) || [];

    return (commands[index] || '').toLowerCase();
}

// the mercenaries' view of what the player wears (TouristTrap.playerArmed): 'none', 'armour', 'weapon' or 'both'.
// Open-RSC wield positions from our equip slots: head 0, body 1, legs 2, shield 3, weapon 4, hands 5, feet 6, neck 7, cape 9
function wornPosition(equip) {
    if (equip.includes('head')) return 0;
    if (equip.includes('body')) return 1;
    if (equip.includes('legs')) return 2;
    if (equip.includes('left-hand') && !equip.includes('right-hand')) return 3;
    if (equip.includes('right-hand')) return 4;
    if (equip.includes('hands')) return 5;
    if (equip.includes('feet')) return 6;
    if (equip.includes('chest')) return 7;
    if (equip.includes('cape')) return 9;

    return -1;
}

function playerArmed(player) {
    let hasArmour = false;
    let hasWeapon = false;

    for (const item of player.inventory.items) {
        if (!item.equipped || !item.definition || !item.definition.equip) {
            continue;
        }

        if (ALLOWED_WORN.has(item.id)) {
            continue;
        }

        const position = wornPosition(item.definition.equip);

        if (![0, 1, 3, 4, 5, 6, 7, 9].includes(position)) {
            continue;
        }

        if (position === 3) {
            if (/shield/i.test(item.definition.name)) {
                hasArmour = true;
            } else {
                hasWeapon = true;
            }
        } else if (position === 4) {
            hasWeapon = true;
        } else {
            hasArmour = true;
        }
    }

    if (hasWeapon && hasArmour) return 'both';
    if (hasWeapon) return 'weapon';
    if (hasArmour) return 'armour';

    return 'none';
}

// Functions.doTentDoor: step through a door by teleporting to the other side
function doTentDoor(object, player) {
    const { x, y, direction } = object;

    if (direction === 0) {
        if (x === player.x && y === player.y) {
            player.teleport(x, y - 1);
        } else {
            player.teleport(x, y);
        }
    } else if (direction === 1) {
        if (x === player.x && y === player.y) {
            player.teleport(x - 1, y);
        } else {
            player.teleport(x, y);
        }
    } else if (direction === 2) {
        // diagonal: front
        if (x === player.x && y === player.y + 1) {
            player.teleport(x, y + 1);
        } else if (x === player.x - 1 && y === player.y) {
            player.teleport(x - 1, y);
        } else if (x === player.x && y === player.y - 1) {
            // back
            player.teleport(x, y - 1);
        } else if (x === player.x + 1 && y === player.y) {
            player.teleport(x + 1, y);
        } else if (x === player.x + 1 && y === player.y + 1) {
            player.teleport(x + 1, y + 1);
        } else if (x === player.x - 1 && y === player.y - 1) {
            player.teleport(x - 1, y - 1);
        }
    } else if (direction === 3) {
        // front
        if (x === player.x && y === player.y - 1) {
            player.teleport(x, y - 1);
        } else if (x === player.x + 1 && y === player.y) {
            player.teleport(x + 1, y);
        } else if (x === player.x && y === player.y + 1) {
            // back
            player.teleport(x, y + 1);
        } else if (x === player.x - 1 && y === player.y) {
            player.teleport(x - 1, y);
        } else if (x === player.x - 1 && y === player.y + 1) {
            player.teleport(x - 1, y + 1);
        } else if (x === player.x + 1 && y === player.y - 1) {
            player.teleport(x + 1, y - 1);
        }
    }
}

// ---- talk ----------------------------------------------------------------------------------------------------------------

async function talk(player, npc) {
    if (npc.id === NPC.IRENA) {
        await irenaDialogue(player, npc, -1);
    } else if (npc.id === NPC.MERCENARY) {
        await mercenaryDialogue(player, npc, -1);
    } else if (npc.id === NPC.MERCENARY_CAPTAIN) {
        await mercenaryCaptainDialogue(player, npc, -1);
    } else if (npc.id === NPC.MERCENARY_ESCAPEGATES) {
        await mercenaryInsideDialogue(player, npc, -1);
    } else if (npc.id === NPC.MINING_SLAVE) {
        await slaveDialogue(player, npc, -1);
    } else if (npc.id === NPC.ESCAPING_MINING_SLAVE) {
        await escapingSlaveDialogue(player, npc);
    } else if (npc.id === NPC.BEDABIN_NOMAD) {
        await bedabinNomadDialogue(player, npc, -1);
    } else if (npc.id === NPC.BEDABIN_NOMAD_GUARD) {
        if ([8, 9, 10, -1].includes(stageOf(player))) {
            await npc.say(
                "Sorry, but you can't use the tent without permission.",
                'But thanks for your help to the Bedabin people.'
            );

            if (player.inventory.has(ITEM.TECHNICAL_PLANS)) {
                await npc.say("And we'll take those plans off your hands as well!");
                player.inventory.remove(ITEM.TECHNICAL_PLANS, 1);
            }
        } else {
            await npc.say('Sorry, this is a private tent, no one is allowed in.', 'Orders of Al Shabim...');
        }
    } else if (npc.id === NPC.AL_SHABIM) {
        await alShabimDialogue(player, npc, -1);
    } else if (npc.id === NPC.CAPTAIN_SIAD) {
        await captainSiadDialogue(player, npc, -1, null);
    } else if (npc.id === NPC.MERCENARY_LIFTPLATFORM) {
        await liftPlatformGuard(player, npc);
    } else if (npc.id === NPC.MERCENARY_JAILDOOR) {
        await jailDoorGuard(player, npc);
    } else if (npc.id === NPC.ANA) {
        await anaDialogue(player, npc, -1);
    }
}

// "Get them men!" and the guards drag the player to a cell below (the Java repeats this for both guards)
async function guardsDragToCell(player, npc) {
    await npc.say("Why you ungrateful whelp...I'll teach you some manners.");

    if (stageOf(player) === -1) {
        attackPlayer(player, npc);
    } else {
        await mes(player, 'The guard shouts for help.');
        attackPlayer(player, npc);
        await mes(player, 'Other guards start arriving.');
        await npc.say('Get them men!');
        player.message('The guards rough you up a bit and then drag you to a cell.');
        player.teleport(76, 3625);
    }
}

async function liftPlatformGuard(player, npc) {
    if (stageOf(player) === -1) {
        await npc.say("Move along please, don't want any trouble today!");
        return;
    }

    await npc.say('Yes, what do you want?');

    const menu = await player.ask(['Nothing thanks - sorry for disturbing you.', 'Your head on a stick.'], true);

    if (menu === 0) {
        await npc.say("Well...I guess that's Ok, get on your way though.");
    } else if (menu === 1) {
        await guardsDragToCell(player, npc);
    }
}

async function jailDoorGuard(player, npc) {
    await npc.say('Yeah, what do you want?');

    const menu = await player.ask(
        ['What are you guarding?', 'Oh, nothing sorry for disturbing you.', 'Your head on a stick.'],
        true
    );

    if (menu === 0) {
        await npc.say(
            "I'm guarding troublesome prisoners.",
            'They think they can get away with attacking the guards.',
            'Well, we taught them a thing or two.'
        );
    } else if (menu === 1) {
        await npc.say('I should think so to, now get back to work.');
    } else if (menu === 2) {
        await guardsDragToCell(player, npc);
    }
}

async function onTalkToNPC(player, npc) {
    if (!TALK_IDS.has(npc.id)) {
        return false;
    }

    player.engage(npc);

    try {
        await withAttacks(player, () => talk(player, npc));
    } finally {
        if (player.interlocutor) {
            player.disengage();
        }
    }

    return true;
}

// ---- objects ---------------------------------------------------------------------------------------------------------------

const OBJECT_IDS = new Set([IRON_GATE, ROCK_1, WOODEN_DOORS, DESK, BOOKCASE, CAPTAINS_CHEST]);

function handlesObject(player, gameObject) {
    return OBJECT_IDS.has(gameObject.id) || (gameObject.id === STONE_GATE && player.y >= 735);
}

// the Stone Gate seen from the desert side: out with Ana in a barrel, or the poster
async function stoneGate(player, gameObject, command) {
    if (command === 'go through') {
        if (!player.inventory.has(ITEM.ANA_IN_A_BARREL)) {
            player.message('you go through the gate');
            player.teleport(62, 732);
            return;
        }

        if (stageOf(player) !== 9) {
            // should not have an Ana in a barrel in other stages
            player.inventory.remove(ITEM.ANA_IN_A_BARREL, 1);
            return;
        }

        await mes(player, 'Ana looks out of the barrel...');
        await mes(player, '@gre@Ana: Hey great, we\'re at the Shantay Pass!');
        player.inventory.remove(ITEM.ANA_IN_A_BARREL, 1);
        setStage(player, 10);

        const Ana = spawnNpc(player, NPC.ANA, player.x, player.y, 60000);

        moveNpc(Ana, player.x, player.y + 1);
        await player.world.sleepTicks(1);
        await Ana.say(
            'Great! Thanks for getting me out of that mine!',
            "And that barrel wasn't too bad anyway!",
            "Pop by again sometime, I'm sure we'll have a barrel of laughs!",
            "Oh! I nearly forgot, here's a key I found in the tunnels.",
            "It might be of some use to you, not sure what it opens."
        );
        player.inventory.add(ITEM.WROUGHT_IRON_KEY, 1);
        await mes(player, 'Ana spots Irena and waves...');
        await Ana.say('Hi Mum!', 'Sorry, I have to go now!');
        removeNpc(player, Ana);

        const Irena = nearNpc(player, NPC.IRENA, 15);

        if (Irena !== null) {
            await Irena.say('Hi Ana!');
            await rewardMenu(player, Irena);
            cacheDel(player, 'tried_ana_barrel');
        }
    } else if (command === 'look') {
        await mes(player, 'You look at the huge Stone Gate.');
        await mes(player, 'On the gate is a large poster, it reads.');
        await mes(player, '@gre@The Desert is a VERY Dangerous place...do not enter if you are scared of dying.');
        await mes(player, '@gre@Beware of high temperatures, sand storms, robbers, and slavers...');
        await mes(player, '@gre@No responsibility is taken by Shantay ');
        await mes(player, '@gre@If anything bad should happen to you in any circumstances whatsoever.');
        await mes(player, 'Despite this warning lots of people seem to pass through the gate.');
    }
}

async function ironGate(player, gameObject, command) {
    if (command === 'open') {
        if (player.inventory.has(ITEM.ANA_IN_A_BARREL)) {
            await failEscapeAnaInBarrel(player, null);
            return;
        }

        if (!player.inventory.has(ITEM.METAL_KEY)) {
            player.message("This gate is locked, you'll need a key to open it.");
            return;
        }

        const armedVal = playerArmed(player);

        // an armed player makes the mercenary follow the weapon/armour dialogue, not the slave one
        if (
            player.inventory.isEquipped(ITEM.SLAVES_ROBE_BOTTOM) &&
            player.inventory.isEquipped(ITEM.SLAVES_ROBE_TOP) &&
            armedVal === 'none'
        ) {
            const guard = nearNpc(player, NPC.MERCENARY, 5);

            if (guard !== null) {
                player.message('A guard notices you as you try to slip past...');
                await guard.say('Hey! Where do you think you\'re going?');
                attackPlayer(player, guard);
                await guard.say('Guards! Slave escaping!');

                if (stageOf(player) === -1) {
                    player.message('No other guards come to the rescue.');
                    return;
                }

                if (player.x <= 91) {
                    // sent to jail
                    await mercenaryDialogue(player, guard, Mercenary.THROW_PRISON);
                } else {
                    // sent to desert
                    await mercenaryDialogue(player, guard, Mercenary.LEAVE_DESERT);
                }
            }

            return;
        }

        await mes(player, 'You use the metal key to unlock the gates.');
        await mes(player, 'You manage to sneak past the guards!.');
        await player.enterGate(gameObject);
        player.message('The gate swings open.');
        await player.world.sleepTicks(2);
        player.message('The gates close behind you.');

        const n = nearNpc(player, NPC.MERCENARY_ESCAPEGATES, 15);

        // no dialogue after the quest on just opening the gates
        if (n !== null && stageOf(player) !== -1 && armedVal !== 'none') {
            if (armedVal === 'weapon') {
                await n.say('Oi You with the weapon, what are you doing?');
            } else if (armedVal === 'armour') {
                await n.say('Oi You with the armour on, what are you doing?');
            } else {
                await n.say('Oi You with the weapon and armour, what are you doing?');
            }

            await n.say("You don't belong in here!");
            player.message('More guards come to arrest you.');
            attackPlayer(player, n);
            await n.say("Right, you're going in the cell!");
            await mes(player, "You're outnumbered by all the guards.");
            await mes(player, 'They man-handle you into a cell.');
            player.teleport(89, 801);
        }
    } else if (command === 'search') {
        await mes(player, 'You search the gate.');
        await mes(player, 'Inside the compound you can see that there are lots of slaves mining away.');
        await mes(player, 'They all seem to be dressed in dirty disgusting desert rags.');
        await mes(player, 'And equiped only with a mining pick.');
        await mes(player, 'Each slave is chained to a rock where they seemingly mine all day long.');
        await mes(player, 'Guards patrol the area extensively.');
        await mes(player, 'But you might be able to sneak past them if you try to blend in.');
    }
}

// TouristTrap.succeedRate: 3 in 5
function climbSucceeds() {
    return Math.floor(Math.random() * 5) < 3;
}

async function woodenDoors(player, gameObject, command) {
    if (command === 'open') {
        await mes(player, 'You push the door.');
        await player.say('Ugh!');

        if (player.inventory.isEquipped(ITEM.SLAVES_ROBE_BOTTOM) && player.inventory.isEquipped(ITEM.SLAVES_ROBE_TOP)) {
            await mes(player, 'The door opens with some effort ');

            if (gameObject.x === 81 && gameObject.y === 3633) {
                player.teleport(82, 802);
                return;
            }

            player.teleport(82, 3630);
            await mes(player, 'The huge doors open into a dark, dank and smelly tunnel.');
            await mes(player, 'The associated smells of a hundred sweaty miners greets your nostrils.');
            await mes(player, "And your ears ring with the 'CLANG CLANG CLANG' as metal hits rock.");
            return;
        }

        const n = spawnNpc(player, NPC.DRAFT_MERCENARY_GUARD, player.x, player.y, (DRAFT_TICKS + DRAFT_LEAVE_TICKS) * TICK_MS);

        player.world.setTickTimeout(() => {
            n.say('Is that the time, I ought to be going.').catch(() => {});
        }, DRAFT_TICKS);
        await player.world.sleepTicks(2);
        await n.say('Oi You!');
        await mes(player, 'A guard notices you and approaches...');
        attackPlayer(player, n);
        await n.say("Hey, you're no slave, where do you think you're going!");
        await n.say('Guards, guards!');

        if (stageOf(player) === -1) {
            player.message('No other guards come to the rescue.');
            return;
        }

        await mercenaryDialogue(player, n, Mercenary.THROW_PRISON);
    } else if (command === 'watch') {
        if (gameObject.x === 81 && gameObject.y === 3633) {
            player.message('Nothing much seems to happen.');
        } else {
            await mes(player, 'You watch the doors for some time.');
            await mes(player, 'You notice that only slaves seem to go down there.');
            await mes(player, 'You might be able to sneak down if you pass as a slave.');
        }
    }
}

async function desk(player) {
    await mes(player, 'You search the captains desk while he\'s not looking.');

    const hasCell = player.inventory.has(ITEM.CELL_DOOR_KEY);
    const hasMetal = player.inventory.has(ITEM.METAL_KEY);
    const hasWrought = player.inventory.has(ITEM.WROUGHT_IRON_KEY);
    const stage = stageOf(player);
    const beforeWrought = stage >= 0 && stage <= 9;

    if (hasCell && hasMetal && (beforeWrought || hasWrought)) {
        await mes(player, '...but you find nothing of interest.');
        return;
    }

    if (!hasCell) {
        await mes(player, 'You find a cell door key.');
        player.inventory.add(ITEM.CELL_DOOR_KEY, 1);
    }

    if (!hasMetal) {
        await mes(player, 'You find a large metalic key.');
        player.inventory.add(ITEM.METAL_KEY, 1);
    }

    // only after the player has passed the stage of the wrought iron key
    if (!beforeWrought && !hasWrought) {
        await mes(player, 'You find a large wrought iron key.');
        player.inventory.add(ITEM.WROUGHT_IRON_KEY, 1);
    }
}

async function bookcase(player, gameObject, command) {
    if (command === 'search') {
        player.message('You notice several books on the subject of Sailing.');

        if (!cacheHas(player, 'sailing')) {
            cacheSet(player, 'sailing', true);
        }
    } else if (command === 'look') {
        player.message('The captain seems to collect lots of books!');
    }
}

async function captainsChest(player, gameObject) {
    if (cacheHas(player, 'tourist_chest') || stageOf(player) === -1) {
        if (player.inventory.has(ITEM.BEDOBIN_COPY_KEY)) {
            if (!player.inventory.has(ITEM.TECHNICAL_PLANS)) {
                await mes(player, "While the Captain's distracted, you quickly unlock the chest.");
                await mes(player, 'You use the Bedobin Copy Key to open the chest.');
                await mes(player, 'You open the chest and take out the plans.');
                player.inventory.add(ITEM.TECHNICAL_PLANS, 1);

                if (!cacheHas(player, 'tech_plans')) {
                    cacheSet(player, 'tech_plans', true);
                }
            } else {
                player.message('The chest is empty.');
            }
        } else {
            player.message('This chest needs a key!');
        }

        cacheDel(player, 'sailing');
        cacheDel(player, 'tourist_chest');

        return;
    }

    let n = nearNpc(player, NPC.CAPTAIN_SIAD, 5);

    if (n === null) {
        const siad = spawnNpc(player, NPC.CAPTAIN_SIAD, 85, 1745, (SIAD_TICKS + SIAD_LEAVE_TICKS) * TICK_MS);

        player.world.setTickTimeout(() => {
            siad.say('Ah, time for my evening snooze!').catch(() => {});
        }, SIAD_TICKS);
        n = siad;
        await player.world.sleepTicks(2);
    }

    player.engage(n);

    try {
        await captainSiadDialogue(player, n, -1, gameObject);
    } finally {
        if (player.interlocutor) {
            player.disengage();
        }
    }
}

async function objectAction(player, gameObject, command) {
    switch (gameObject.id) {
        case STONE_GATE:
            await stoneGate(player, gameObject, command);
            break;
        case IRON_GATE:
            await ironGate(player, gameObject, command);
            break;
        case ROCK_1:
            player.message('You start climbing the rocky elevation.');

            if (!climbSucceeds()) {
                player.message('You slip a little and tumble the rest of the way down the slope.');
                player.damage(7);
            }

            player.teleport(93, 799);
            break;
        case WOODEN_DOORS:
            await woodenDoors(player, gameObject, command);
            break;
        case DESK:
            await desk(player);
            break;
        case BOOKCASE:
            await bookcase(player, gameObject, command);
            break;
        case CAPTAINS_CHEST:
            await captainsChest(player, gameObject);
            break;
    }
}

async function onGameObjectCommandOne(player, gameObject) {
    if (!handlesObject(player, gameObject)) {
        return false;
    }

    await withAttacks(player, () => objectAction(player, gameObject, commandOf(gameObject, 0)));

    return true;
}

async function onGameObjectCommandTwo(player, gameObject) {
    if (!handlesObject(player, gameObject)) {
        return false;
    }

    const command = commandOf(gameObject, 1);

    // "Examine" is the client's own
    if (command === 'examine') {
        return false;
    }

    await withAttacks(player, () => objectAction(player, gameObject, command));

    return true;
}

// ---- wall objects (OpBound) ------------------------------------------------------------------------------------------------

function isWindow(wallObject) {
    return wallObject.id === WINDOW && (wallObject.x === 90 || wallObject.x === 89) && wallObject.y === 802;
}

function handlesWall(wallObject) {
    return (
        isWindow(wallObject) ||
        (wallObject.id === JAIL_DOOR && wallObject.x === 88 && wallObject.y === 801) ||
        wallObject.id === TENT_DOOR_1 ||
        wallObject.id === TENT_DOOR_2 ||
        wallObject.id === CAVE_JAIL_DOOR ||
        wallObject.id === STURDY_IRON_GATE
    );
}

async function attemptBendBar(player) {
    await mes(player, 'You focus all of your strength on the bar. Your muscles ripple!');

    const inCell = player.x <= 89;
    const success = Math.floor(Math.random() * 2) === 1;

    if (!success) {
        await mes(player, 'You find it hard to bend the bar, perhaps you should try again?');

        const stay = await player.ask(["Yes, I'll try to bend the bar again.", "No, I'm going to give up."], true);

        if (stay === 0) {
            await attemptBendBar(player);
        } else if (stay === 1) {
            await mes(player, 'You decide to stay in the cell.');
            await mes(player, 'Maybe they\'ll let you out soon?');
        }

        return;
    }

    if (player.inventory.has(ITEM.ANA_IN_A_BARREL)) {
        await failWindowAnaInBarrel(player, null);
    } else if (inCell) {
        await mes(player, 'You manage to bend the bar and climb out of the window.');
        player.addExperience('strength', 40);
        player.teleport(90, 802);
        player.message('You land near some rough rocks, which you may be able to climb.');
    } else {
        await mes(player, 'You manage to bend the bar !');
        player.addExperience('strength', 40);
        player.teleport(89, 802);
        player.message('You climb back inside the cell.');
    }
}

async function wallAction(player, wallObject) {
    if (isWindow(wallObject)) {
        await mes(player, 'You search the window.');
        await mes(player, 'After some time you find that one of the bars looks weak,  ');
        await mes(player, 'you may be able to bend one of the bars. ');
        await mes(player, 'Would you like to try ?');

        const menu = await player.ask(["Yes, I'll bend the bar.", "No, I'd better stay here."], true);

        if (menu === 0) {
            await attemptBendBar(player);
        } else if (menu === 1) {
            await mes(player, 'You decide to stay in the cell.');
            await mes(player, 'Maybe they\'ll let you out soon?');
        }
    } else if (wallObject.id === JAIL_DOOR) {
        if (player.inventory.has(ITEM.CELL_DOOR_KEY)) {
            player.message('You unlock the door and walk through.');
            await player.enterDoor(wallObject);
        } else {
            await mes(player, 'You need a key to unlock this door,');
            await mes(player, "And you don't seem to have one that fits.");
        }
    } else if (wallObject.id === TENT_DOOR_1) {
        if (player.y <= 793) {
            player.teleport(171, 795);
            return;
        }

        let n = nearNpc(player, NPC.BEDABIN_NOMAD_GUARD, 5);

        if (n === null) {
            n = spawnNpc(player, NPC.BEDABIN_NOMAD_GUARD, player.x, player.y, 60000);
            await player.world.sleepTicks(1);
        }

        moveNpc(n, 170, 794);

        if ([8, 9, 10, -1].includes(stageOf(player))) {
            await n.say(
                "Sorry, but you can't use the tent without permission.",
                'But thanks for your help to the Bedabin people.'
            );

            if (player.inventory.has(ITEM.TECHNICAL_PLANS)) {
                await n.say("And we'll take those plans off your hands as well!");
                player.inventory.remove(ITEM.TECHNICAL_PLANS, 1);
            }
        } else {
            await n.say('Sorry, this is a private tent, no one is allowed in.', 'Orders of Al Shabim...');
        }
    } else if (wallObject.id === TENT_DOOR_2) {
        doTentDoor(wallObject, player);
    } else if (wallObject.id === CAVE_JAIL_DOOR) {
        const n = nearNpc(player, NPC.MERCENARY_JAILDOOR, 5);

        if (n !== null) {
            if (player.x >= 72) {
                if (!player.inventory.has(ITEM.ROCKS, 15)) {
                    await n.say(
                        'Hey, move away from the gate.',
                        "If you wanna get out, you're gonna have to mine for it.",
                        "You're gonna have to bring me 15 loads of rocks - in one go!",
                        "And then I'll let you out.",
                        'You can go back and work with the other slaves then!'
                    );
                } else {
                    await player.say('Hey, I have your rocks here, let me out.');
                    player.inventory.remove(ITEM.ROCKS, 15);
                    await n.say('Ok, ok, come on out.');
                    player.teleport(71, 3626);
                    player.message('The guard unlocks the gate and lets you out.');
                    player.teleport(69, 3625);
                }
            } else {
                await n.say('Hey, move away from that gate!');
            }
        }
    } else if (wallObject.id === STURDY_IRON_GATE) {
        if (player.y >= 3617) {
            if (player.inventory.has(ITEM.WROUGHT_IRON_KEY)) {
                player.message('You use the wrought iron key to unlock the gate.');
                player.teleport(player.x, player.y - 1);
            } else {
                await mes(player, 'You need a key to unlock this door,');
                await mes(player, "And you don't seem to have one that fits.");
            }
        } else {
            player.message('You push the gate open and walk through.');
            player.teleport(player.x, player.y + 1);
        }
    }
}

async function onWallObjectCommandOne(player, wallObject) {
    if (!handlesWall(wallObject)) {
        return false;
    }

    await withAttacks(player, () => wallAction(player, wallObject));

    return true;
}

async function onWallObjectCommandTwo(player, wallObject) {
    // only the window has a second command that does something (Search); the doors' is "Examine"
    if (!isWindow(wallObject)) {
        return false;
    }

    await withAttacks(player, () => wallAction(player, wallObject));

    return true;
}

// ---- npcs ------------------------------------------------------------------------------------------------------------------

// the Mercenary Captain's "Watch"
async function onNPCCommand(player, npc) {
    if (npc.id !== NPC.MERCENARY_CAPTAIN) {
        return false;
    }

    await mes(player, 'You watch the Mercenary Captain for some time.');
    await mes(player, 'He has a large metal key attached to his belt.');
    await mes(player, 'You notice that he usually gets his men to do his dirty work.');

    return true;
}

// TouristTrap.onKillNpc: the captain drops his key (the default death drops carry on)
async function onNPCDeath(player, npc) {
    if (!player || !player.questStages || npc.id !== NPC.MERCENARY_CAPTAIN) {
        return false;
    }

    player.message('You kill the captain!');

    if (stageOf(player) === 1 && !cacheHas(player, 'first_kill_captn')) {
        cacheSet(player, 'first_kill_captn', true);
    }

    if (!player.inventory.has(ITEM.METAL_KEY)) {
        player.inventory.add(ITEM.METAL_KEY, 1);
        await mes(player, 'The mercenary captain drops a metal key on the floor.');
        await mes(player, 'You quickly grab the key and add it to your inventory.');
    }

    return false;
}

// TouristTrap.blockAttackNpc / blockPlayerRangeNpc / blockSpellNpc
function guardsProtected(player, npc) {
    if (stageOf(player) < 0) {
        return false;
    }

    return (
        GUARD_IDS.has(npc.id) || (npc.id === NPC.MERCENARY_CAPTAIN && player.inventory.count(ITEM.METAL_KEY) < 1)
    );
}

async function onNPCAttack(player, npc) {
    if (!guardsProtected(player, npc)) {
        return false;
    }

    await withAttacks(player, () => tryToAttackMercenarys(player, npc));

    return true;
}

async function onNPCRangedAttack(player, npc) {
    return onNPCAttack(player, npc);
}

async function onCastOnNPC(player, npc) {
    if (!guardsProtected(player, npc)) {
        return false;
    }

    // already fighting this npc: the spell goes on
    if (player.opponent === npc) {
        return false;
    }

    await withAttacks(player, () => tryToAttackMercenarys(player, npc));

    return true;
}

// the prototype dart shown to Al Shabim
async function onUseWithNPC(player, npc, item) {
    if (item.id !== ITEM.PROTOTYPE_THROWING_DART || npc.id !== NPC.AL_SHABIM) {
        return false;
    }

    if (player.inventory.has(ITEM.PROTOTYPE_THROWING_DART)) {
        if (stageOf(player) === 7) {
            await alShabimDialogue(player, npc, AlShabim.MADE_WEAPON);
        } else if (stageOf(player) > 7 || stageOf(player) === -1) {
            await npc.say("Where did you get this from Effendi!", "I'll have to confiscate this for your own safety!");
            player.inventory.remove(ITEM.PROTOTYPE_THROWING_DART, 1);
        }
    }

    return true;
}

module.exports = {
    onTalkToNPC,
    onGameObjectCommandOne,
    onGameObjectCommandTwo,
    onWallObjectCommandOne,
    onWallObjectCommandTwo,
    onNPCCommand,
    onNPCDeath,
    onNPCAttack,
    onNPCRangedAttack,
    onCastOnNPC,
    onUseWithNPC,
    playerArmed
};
