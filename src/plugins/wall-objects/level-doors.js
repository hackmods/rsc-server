// Ported from Open-RSC Core-Framework authentic/defaults/DoorAction.java (AGPL-3.0): Fishing Guild, Magic Guild,
// Khazard house, Shantay jail and Zanaris market doors.
// Ported from authentic/npcs/alkharid/ShantayPassNpcs.java (AGPL-3.0): the Shantay Pass Stone Gate.
// Ported from authentic/npcs/shilo/Yohnus.java (AGPL-3.0): the Shilo blacksmiths door (the FASTER_YOHNUS custom option is skipped).
// Ported from authentic/quests/members/undergroundpass/obstacles/UndergroundPassObstaclesMap2.java (AGPL-3.0): the
// unicorn cage railings.
//
// One table drives every door: {id, x?, y?, kind: 'wall' | 'object', skill?, level?, item?, worn?, message?, npc?}.
//   skill/level  current level needed (below it: the npc speaks, then `message`; at it the door opens)
//   item         [id, amount] taken from the inventory when the door opens
//   worn         item ids that must all be equipped
//   npc          {id, bounds: [x1, x2, y1, y2], say: [...]} the npc that turns you away (Java world.getNpc in bounds)
//   custom       name of a handler below for doors whose rule is a dialogue
// Not ported: the Shantay jail Port Sarim prison branch beyond the teleport, the Underground Pass cage-door sealed
// state side effects, the Legends Quest Ancient Wooden Doors (1160, quest owned by quests/members/legends-quest.js),
// the Tourist Trap cave jail door (wall 180) and thieving pick-lock doors 93-100/162 (skills/thieving.js owns them).

const MASTER_FISHER = 368;
const HEAD_WIZARD = 513;
const DOORMAN = 221;
const GUARD_KHAZARD_BYPRISONER = 373;
const GUARD_KHAZARD_BRIBABLE = 374;
const SHANTAY = 549;
const SHANTAY_PASS_GUARD = 719;
const YOHNUS = 622;

const COINS = 10;
const DIAMOND = 161;
const KHAZARD_HELMET = 733;
const KHAZARD_CHAINMAIL = 734;
const SHANTAY_DESERT_PASS = 1030;
const SHANTAY_DISCLAIMER = 1099;
const RAILING = 995;

const STONE_GATE = 916;

const DOORS = [
    {
        id: 112,
        x: 586,
        y: 524,
        kind: 'wall',
        skill: 'fishing',
        level: 68,
        npc: { id: MASTER_FISHER, bounds: [582, 588, 524, 527], say: ['Hello only the top fishers are allowed in here'], delay: 2 },
        message: 'You need a fishing level of 68 to enter'
    },
    {
        id: 146,
        x: 599,
        y: 757,
        kind: 'wall',
        skill: 'magic',
        level: 66,
        npc: {
            id: HEAD_WIZARD,
            bounds: [596, 597, 755, 758],
            say: ['You need a magic level of 66 to get in here', 'The magical energy in here is unsafe for those below that level']
        }
    },
    { id: 113, kind: 'wall', custom: 'khazard', worn: [KHAZARD_HELMET, KHAZARD_CHAINMAIL] },
    { id: 67, kind: 'wall', custom: 'doorman', item: [DIAMOND, 1] },
    { id: 176, kind: 'wall', custom: 'shantayJail' },
    { id: 165, kind: 'wall', custom: 'yohnus' },
    { id: 167, kind: 'wall', custom: 'railings' },
    { id: 168, kind: 'wall', custom: 'railings' },
    { id: 169, kind: 'wall', custom: 'railings', skill: 'thieving', level: 50 },
    { id: 170, kind: 'wall', custom: 'railings' },
    { id: STONE_GATE, kind: 'object', custom: 'stoneGate' }
];

function findDoor(kind, entity) {
    return DOORS.find(
        (door) =>
            door.kind === kind &&
            door.id === entity.id &&
            (typeof door.x === 'undefined' || door.x === entity.x) &&
            (typeof door.y === 'undefined' || door.y === entity.y)
    );
}

// Java world.getNpc(id, x1, x2, y1, y2)
function npcInBounds(world, id, [x1, x2, y1, y2]) {
    for (const npc of world.npcs.getAllByID(id)) {
        if (npc.x >= x1 && npc.x <= x2 && npc.y >= y1 && npc.y <= y2) {
            return npc;
        }
    }

    return undefined;
}

// Java ifnearvisnpc(player, id, range)
function nearbyNpc(player, id, range) {
    return player.getNearestEntityByID('npcs', id, range * 2);
}

// the npc talks (when it is free to), then the engagement ends
async function npcSays(player, npc, ...lines) {
    if (!npc || npc.interlocutor) {
        return false;
    }

    player.engage(npc);
    await npc.say(...lines);
    player.disengage();

    return true;
}

function level(player, skill) {
    return player.skills[skill].current;
}

function hasWorn(player, ids) {
    return ids.every((id) => player.inventory.isEquipped(id));
}

// ---- generic skill / worn / item door -------------------------------------------------------------------------

async function genericDoor(player, wallObject, door) {
    if (door.skill && level(player, door.skill) < door.level) {
        if (door.npc) {
            const npc = npcInBounds(player.world, door.npc.id, door.npc.bounds);

            await npcSays(player, npc, ...door.npc.say);

            if (door.npc.delay) {
                await player.world.sleepTicks(door.npc.delay);
            }
        }

        if (door.message) {
            player.message(door.message);
        }

        return true;
    }

    await player.enterDoor(wallObject);

    return true;
}

// ---- Fight Arena: Khazard house (DOOR_KHAZARD_HOUSE) ---------------------------------------------------------

async function khazard(player, wallObject, door) {
    let guard;
    let stop = false;

    if (hasWorn(player, door.worn)) {
        await player.enterDoor(wallObject);
        return true;
    }

    if (wallObject.x === 603 && player.x < wallObject.x) {
        guard = nearbyNpc(player, GUARD_KHAZARD_BYPRISONER, 8);
        stop = true;
    } else if (wallObject.y === 699 && player.y < wallObject.y) {
        guard = nearbyNpc(player, GUARD_KHAZARD_BRIBABLE, 8);
        stop = true;
    } else {
        // inside the building does not matter to exit
        await player.enterDoor(wallObject);
        return true;
    }

    if (stop && guard && !guard.interlocutor) {
        player.engage(guard);

        if (!player.questStages.fightArena) {
            await guard.say(
                'you there! halt!',
                "this is General Khazard's private lodgings",
                "what's your business here?"
            );
            await player.say("I'm looking for the 'Servil' prisoners");
            await guard.say(
                'wait until tomorrow, then you can',
                'see them butchered in the arena haha',
                "Now OUT and don't come back!"
            );
        } else {
            await guard.say('you there! halt!', "this is General Khazard's private lodgings", "now leave and don't return!");
        }

        player.disengage();
    }

    return true;
}

// ---- Zanaris market doorman (DOOR_LOST_CITY_MARKETPLACE) -----------------------------------------------------

async function doorman(player, wallObject, door) {
    let npc;

    if (player.x === 115 || player.y === 3539) {
        npc = npcInBounds(player.world, DOORMAN, [105, 116, 3536, 3547]);
    } else if (player.x === 116 || player.y === 3538) {
        npc = npcInBounds(player.world, DOORMAN, [117, 125, 3531, 3538]);
    }

    if (!npc || npc.interlocutor) {
        return true;
    }

    player.engage(npc);

    await npc.say('You cannot go through this door without paying the trading tax');
    await player.say('What do I need to pay?');
    await npc.say('One diamond');

    const choice = await player.ask(['Okay', 'A diamond, are you crazy?', "I haven't brought my diamonds with me"]);

    if (choice === 0) {
        await player.say('Okay');

        if (!player.inventory.has(door.item[0])) {
            await player.say("I haven't brought my diamonds with me");
            player.disengage();
        } else {
            player.disengage();
            player.message('You give the doorman a diamond');
            player.inventory.remove(door.item[0], door.item[1]);
            await player.enterDoor(wallObject);
        }
    } else if (choice === 1) {
        await player.say('A diamond?', 'are you crazy?');
        await npc.say('Nope those are the rules');
        player.disengage();
    } else {
        await player.say("I haven't brought my diamonds with me");
        player.disengage();
    }

    return true;
}

// ---- Shantay Pass jail door (JAIL_DOOR_SHANTAY_PASS) ---------------------------------------------------------

async function payFine(player, shantay) {
    await shantay.say('Good, I see that you have come to your senses.');

    if (player.inventory.has(COINS, 5)) {
        player.message('You hand over five gold pieces to Shantay.');
        await player.world.sleepTicks(3);
        await shantay.say('Great Effendi, now please try to keep the peace.');
        player.message('Shantay unlocks the door to the cell.');
        await player.world.sleepTicks(3);
        player.inventory.remove(COINS, 5);
        delete player.cache.shantayJail;
        return;
    }

    await shantay.say(
        "You don't have that kind of cash on you I see.",
        'But perhaps you have some in your bank?',
        'You can transfer some money from your bank and pay the fine.',
        'or you will be sent to a maximum security prison in Port Sarim.',
        'Which is it going to be?'
    );

    const choice = await player.ask(["I'll pay the fine.", "I'm not paying the fine!"]);

    if (choice === 0) {
        await player.say("I'll pay the fine.");
        await shantay.say("Ok then..., you'll need access to your bank.");
        delete player.cache.shantayJail;
        player.disengage();
        player.bank.open();
    } else {
        await player.say("No thanks, you're not having my money.");
        await sendToPortSarim(player, shantay, 1);
    }
}

async function sendToPortSarim(player, shantay, path) {
    if (path === 0) {
        await shantay.say(
            'You are to be transported to a maximum security prison in Port Sarim.',
            "I hope you've learnt an important lesson from this."
        );
    } else {
        await shantay.say('Very well, I grow tired of you, you\'ll be taken to a new jail in Port Sarim.');
    }

    player.teleport(281, 665, false);
    delete player.cache.shantayJail;
}

async function shantayJail(player, wallObject) {
    if (!player.cache.shantayJail) {
        player.message('The door opens.');
        player.message('');
        await player.enterDoor(wallObject);
        return true;
    }

    player.message('This door is locked.');

    // on the side of the jail
    if (player.x < 66) {
        return true;
    }

    const shantay = nearbyNpc(player, SHANTAY, 8);

    if (!shantay || shantay.interlocutor) {
        return true;
    }

    player.engage(shantay);
    player.message('Shantay saunters over to talk with you.');
    await shantay.say('If you want to be let out, you have to pay a fine of five gold.', 'Do you want to pay now?');

    const pay = await player.ask(['Yes, Ok.', "No thanks, you're not having my money."]);

    if (pay === 0) {
        await payFine(player, shantay);
    } else {
        await shantay.say(
            'You have a choice.',
            'You can either pay five gold pieces or...',
            'You can be transported to a maximum security prison in Port Sarim.',
            'Will you pay the five gold pieces?'
        );

        const again = await player.ask(['Yes, Ok.', 'No, do your worst!']);

        if (again === 0) {
            await payFine(player, shantay);
        } else {
            await sendToPortSarim(player, shantay, 0);
        }
    }

    if (player.interlocutor) {
        player.disengage();
    }

    return true;
}

// ---- Shilo blacksmiths door (Yohnus.java) ---------------------------------------------------------------------

async function yohnus(player) {
    if (player.y <= 844) {
        player.teleport(400, 845);
        return true;
    }

    const npc = nearbyNpc(player, YOHNUS, 5);

    if (!npc || npc.interlocutor) {
        return true;
    }

    player.engage(npc);
    await npc.say(
        'Sorry but the blacksmiths is closed.',
        'But I can let you use the furnace at the cost',
        'of 20 gold pieces.'
    );

    const choice = await player.ask(['Use Furnace - 20 Gold', 'No thanks!']);

    if (choice === 0) {
        if (player.inventory.has(COINS, 20)) {
            player.inventory.remove(COINS, 20);
            await npc.say('Thanks Bwana!', 'Enjoy the facilities!');
            player.teleport(400, 844);
            player.message("You're shown into the Blacksmiths where you can see a furnace");
        } else {
            await npc.say('Sorry Bwana, it seems that you are short of funds.');
        }
    } else {
        await player.say('No thanks!');
        await npc.say('Very well Bwana, have a nice day.');
    }

    player.disengage();

    return true;
}

// ---- Underground Pass cage railings (click 0: pick lock, click 1: search) -------------------------------------

async function railings(player, wallObject, door, click) {
    if (click === 0) {
        if (wallObject.id === 168) {
            player.message('the cage door has been sealed shut');
            await player.world.sleepTicks(3);
            player.message("the poor unicorn can't escape");
            return true;
        }

        player.message('you attempt to pick the lock');

        if (door.skill && level(player, door.skill) < door.level) {
            player.message('you need a level of 50 thieving to pick this lock');
            return true;
        }

        player.message('You manage to pick the lock');
        player.message('you walk through');

        if (wallObject.direction === 0) {
            if (wallObject.y === player.y) {
                player.teleport(wallObject.x, wallObject.y - 1);
            } else {
                player.teleport(wallObject.x, wallObject.y);
            }
        }

        if (wallObject.direction === 1) {
            if (wallObject.x === player.x) {
                player.teleport(wallObject.x - 1, wallObject.y);
            } else {
                player.teleport(wallObject.x, wallObject.y);
            }
        }

        player.addExperience('thieving', 15);
        await player.world.sleepTicks(3);
        player.message('the cage slams shut behind you');

        return true;
    }

    if (wallObject.id === 168) {
        player.message('you search the cage');
        await player.world.sleepTicks(3);

        if (!player.inventory.has(RAILING)) {
            player.message('you find a loose railing lying on the floor');
            player.inventory.add(RAILING, 1);
        } else {
            player.message('but you find nothing');
        }

        return true;
    }

    player.message('the cage has been locked');

    return true;
}

// ---- Shantay Pass Stone Gate (916) ----------------------------------------------------------------------------

async function posterAndMenu(player) {
    if (!player.inventory.has(SHANTAY_DISCLAIMER)) {
        player.message('There is a large poster on the wall near the gateway. It reads..');
        await player.world.sleepTicks(3);
        player.message('@gre@The Desert is a VERY Dangerous place...do not enter if you are scared of dying.');
        await player.world.sleepTicks(3);
        player.message('@gre@Beware of high temperatures, sand storms, robbers, and slavers...');
        await player.world.sleepTicks(3);
        player.message('@gre@No responsibility is taken by Shantay ');
        await player.world.sleepTicks(3);
        player.message('@gre@If anything bad should happen to you in any circumstances whatsoever.');
        await player.world.sleepTicks(3);
        player.message('That seems pretty scary! Are you sure you want to go through?');
        await player.world.sleepTicks(3);

        return player.ask(["Yeah, that poster doesn't scare me!", "No, I'm having serious second thoughts now."]);
    }

    player.message('A poster on the wall says exactly the same as the disclaimer.');
    await player.world.sleepTicks(3);
    player.message('Are you sure you want to go through?');
    await player.world.sleepTicks(3);

    return player.ask(["Yeah, I'm not scared!", "No, I'm having serious second thoughts now."]);
}

async function stoneGateGoThrough(player) {
    const menu = await posterAndMenu(player);
    const guard = nearbyNpc(player, SHANTAY_PASS_GUARD, 5);

    if (menu !== 0) {
        player.message('You decide that your visit to the desert can be postponed..');
        await player.world.sleepTicks(3);
        player.message('Perhaps indefinitely!');
        return;
    }

    if (!player.inventory.has(SHANTAY_DESERT_PASS)) {
        player.message('A guard stops you on your way out of the gate...');
        await player.world.sleepTicks(3);

        if (guard && !guard.interlocutor) {
            await npcSays(
                player,
                guard,
                'You need a Shantay pass to get through this gate.',
                'See Shantay, he will sell you one for a very reasonable price.'
            );
        } else {
            player.message('Shantay guard seem to be busy at the moment.');
        }

        return;
    }

    if (!guard || guard.interlocutor) {
        player.message('Shantay guard seem to be busy at the moment.');
        return;
    }

    player.engage(guard);
    await guard.say('Can I see your Shantay Desert Pass please.');
    player.message('You hand over a Shantay Pass.');
    player.inventory.remove(SHANTAY_DESERT_PASS, 1);
    await player.say('Sure, here you go!');

    if (!player.inventory.has(SHANTAY_DISCLAIMER)) {
        await guard.say('Here, have a disclaimer...', "It means that Shantay isn't responsible if you die in the desert.");
        player.message('The guard gives you a disclaimer.');
        player.inventory.add(SHANTAY_DISCLAIMER, 1);
    }

    player.disengage();
    player.message('you go through the gate');
    player.teleport(62, 735);
}

async function stoneGateLook(player) {
    player.message('You look at the huge Stone Gate.');
    await player.world.sleepTicks(3);
    player.message('On the gate is a large poster, it reads.');
    await player.world.sleepTicks(3);
    player.message('@gre@The Desert is a VERY Dangerous place...do not enter if you are scared of dying.');
    await player.world.sleepTicks(3);
    player.message('@gre@Beware of high temperatures, sand storms, robbers, and slavers...');
    await player.world.sleepTicks(3);
    player.message('@gre@No responsibility is taken by Shantay ');
    await player.world.sleepTicks(3);
    player.message('@gre@If anything bad should happen to you in any circumstances whatsoever.');
    await player.world.sleepTicks(3);
    player.message('Despite this warning lots of people seem to pass through the gate.');
    await player.world.sleepTicks(3);
}

// ---- hooks ----------------------------------------------------------------------------------------------------

const CUSTOM = { khazard, doorman, shantayJail, yohnus, railings };

async function openWall(player, wallObject, click) {
    const door = findDoor('wall', wallObject);

    if (!door) {
        return false;
    }

    // only the railings have a second command that does something; the rest are "Open" only
    if (door.custom !== 'railings' && click !== 0) {
        return false;
    }

    if (door.custom) {
        return CUSTOM[door.custom](player, wallObject, door, click);
    }

    return genericDoor(player, wallObject, door);
}

async function onWallObjectCommandOne(player, wallObject) {
    return openWall(player, wallObject, 0);
}

async function onWallObjectCommandTwo(player, wallObject) {
    return openWall(player, wallObject, 1);
}

async function onGameObjectCommandOne(player, gameObject) {
    if (!findDoor('object', gameObject)) {
        return false;
    }

    // the gate does nothing from the desert side
    if (player.y < 735) {
        await stoneGateGoThrough(player);
    }

    return true;
}

async function onGameObjectCommandTwo(player, gameObject) {
    if (!findDoor('object', gameObject)) {
        return false;
    }

    if (player.y < 735) {
        await stoneGateLook(player);
    }

    return true;
}

module.exports = { onWallObjectCommandOne, onWallObjectCommandTwo, onGameObjectCommandOne, onGameObjectCommandTwo };
