// Ported from Open-RSC Core-Framework authentic/quests/members/WitchesHouse.java (AGPL-3.0)
// https://classic.runescape.wiki/w/Witch%27s_House
//
// questStages.witchsHouse (the Java stages):
//   0  the Boy (240) by the house north-west of Taverley asks for his ball -> 1
//   1  the front door key (538) is under the Door mat (255) at (363,494); the magnet (540) is in the cupboard (258/259) in
//      the basement behind the electrified gate (256, gloves and no metal armour); cheese (319) dropped in the rat room
//      (356-357 x 494-496) brings the rat (241); the magnet on the rat opens the garden door (71) -> 2
//   2  opening the shed door (73) brings Nora T Hag (242) out of the back door; slip into the house through door 72 and
//      she walks to the shed and back, leaving it unlocked -> 3. Caught in the garden: teleported away, back to 1
//   3  in the shed the shapeshifter (244) guards the ball (539, ground item at 351,491): spider (245), bear (246) and
//      wolf (247) forms follow, each killed in turn; then the ball can be taken. The Boy takes it -> -1
// Cache flags (Java names): witchSpawned (witch_spawned), foundMagnet (found_magnet), shapeshifter.
// The front door (69) and its key are wall-objects/key-doors.js.

const BOY_ID = 240;
const RAT_ID = 241;
const NORA_T_HAG_ID = 242;
const SHAPESHIFTER_HUMAN_ID = 244;
const SHAPESHIFTER_SPIDER_ID = 245;
const SHAPESHIFTER_BEAR_ID = 246;
const SHAPESHIFTER_WOLF_ID = 247;
const SHAPESHIFTER_IDS = new Set([
    SHAPESHIFTER_HUMAN_ID,
    SHAPESHIFTER_SPIDER_ID,
    SHAPESHIFTER_BEAR_ID,
    SHAPESHIFTER_WOLF_ID
]);

const BALL_ID = 539;
const FRONT_DOOR_KEY_ID = 538;
const MAGNET_ID = 540;
const CHEESE_ID = 319;
const LEATHER_GLOVES_ID = 16;
const ICE_GLOVES_ID = 556;

const DOOR_MAT_ID = 255;
const BASEMENT_GATE_ID = 256;
const CUPBOARD_CLOSED_ID = 258;
const CUPBOARD_OPEN_ID = 259;

const MAIN_ROOM_DOOR_ID = 70; // (358,495)
const RAT_MAGNET_DOOR_ID = 71; // (356,495): rat room to the garden
const HIDEOUT_DOOR_ID = 72; // (356,492): garden to the house
const SHED_DOOR_ID = 73; // (351,492)

// Nora's spell sends an intruder here
const CAUGHT_TELEPORT = { x: 347, y: 616 };

// addnpc(..., 60000) and (..., 300000) in milliseconds, as 640 ms ticks
const WITCH_TICKS = Math.ceil(60000 / 640);
const SHAPESHIFTER_TICKS = Math.ceil(300000 / 640);
// the old rat goes 30 ticks after a new one comes
const OLD_RAT_TICKS = 30;

// the rat room: Java inBounds(356, 357, 494, 496)
const RAT_ROOM = { minX: 356, maxX: 357, minY: 494, maxY: 496 };

const items = require('@2003scape/rsc-data/config/items.json');

// WitchesHouse.METAL_ARMOURS by name: plate bodies and tops, chain bodies (and legs), plate legs and skirts, medium and
// large helmets, square and kite shields, of every metal. Open-RSC's custom chain legs, dragon medium helmet and dragon
// scale mail have no rsc-data item.
const METAL_ARMOUR_RE = new RegExp(
    '^(bronze|iron|steel|mithril|adamantite|black|rune|dragon) ' +
        '(plate mail (body|top|legs)|chain mail (body|legs)|plated skirt|square shield|kite shield)$' +
        '|^(medium|large) (bronze|iron|steel|mithril|adamantite|black|rune|dragon) helmet$' +
        '|^rune skirt$|^dragon scale mail$',
    'i'
);

const METAL_ARMOUR_IDS = new Set(
    items
        .map((item, id) => (item && METAL_ARMOUR_RE.test(item.name) ? id : -1))
        .filter((id) => id >= 0)
);

function stageOf(player) {
    return player.questStages.witchsHouse || 0;
}

function setStage(player, stage) {
    player.questStages.witchsHouse = stage;
}

// Open-RSC ifnearvisnpc: the nearest one within `radius` tiles
function nearNpc(player, id, radius) {
    return player
        .getNearbyEntitiesByID('npcs', id, radius * 2 + 1)
        .sort((a, b) => player.getDistance(a) - player.getDistance(b))[0];
}

// npcsay outside a conversation: the chat packet names the player as the npc's interlocutor
async function npcSay(player, npc, ...lines) {
    const engaged = npc.interlocutor === player;

    if (!engaged) {
        npc.interlocutor = player;
    }

    try {
        await npc.say(...lines);
    } finally {
        if (!engaged && npc.interlocutor === player) {
            npc.interlocutor = null;
        }
    }
}

// Open-RSC witch.teleport(x, y): the timed witch is put back on the new tile
function moveWitch(world, witch, x, y) {
    world.removeEntity('npcs', witch);
    return world.spawnTimedNPC({ id: NORA_T_HAG_ID, x, y, ticks: WITCH_TICKS });
}

async function boy(player, npc) {
    const { world } = player;

    switch (stageOf(player)) {
        case 0: {
            await player.say('Hello young man');
            player.message('@que@The boy sobs');
            await world.sleepTicks(3);

            const first = await player.ask(
                [
                    "What's the matter?",
                    "Well if you're not going to answer, I'll go"
                ],
                true
            );

            if (first === 0) {
                await npc.say(
                    "I've kicked my ball over that wall, into that garden",
                    'The old lady who lives there is scary',
                    "She's locked the ball in her wooden shed",
                    'Can you get my ball back for me please'
                );

                const second = await player.ask(
                    ["Ok, I'll see what I can do", 'Get it back yourself'],
                    false
                );

                if (second === 0) {
                    await player.say("Ok I'll see what I can do");
                    await npc.say('Thankyou');
                    setStage(player, 1);
                } else if (second === 1) {
                    await player.say('Get it back yourself');
                }
            } else if (first === 1) {
                player.message('@que@The boy sniffs slightly');
                await world.sleepTicks(3);
            }

            break;
        }
        case 1:
        case 2:
        case 3:
            if (player.inventory.has(BALL_ID)) {
                await player.say(
                    'Hi I have got your ball back',
                    'It was harder than I thought it would be'
                );
                await npc.say('Thankyou very much');
                player.inventory.remove(BALL_ID);

                if (stageOf(player) === 3) {
                    completeQuest(player);
                }
            } else {
                await npc.say('Have you got my ball back yet?');
                await player.say('Not yet');
                await npc.say("Well it's in the shed in that garden");
            }

            break;
        case -1:
            await npc.say('Thankyou for getting my ball back');
            break;
    }
}

// WitchesHouse.handleReward: 4 quest points and hits experience 1300 + 600 per hits level (quarter points)
function completeQuest(player) {
    const hits = player.skills.hits.base;

    player.completeQuest('witchsHouse', {
        questPoints: 4,
        experience: { hits: 1300 + 600 * hits },
        message: 'Well done you have completed the Witches house quest'
    });

    delete player.cache.witchGone;
    delete player.cache.shapeshifter;
    delete player.cache.foundMagnet;
}

async function onTalkToNPC(player, npc) {
    if (npc.id !== BOY_ID) {
        return false;
    }

    player.engage(npc);
    await boy(player, npc);
    player.disengage();

    return true;
}

// Nora catches the player in her garden: a spell sends them away and the quest goes back to stage 1
async function caughtByWitch(player, witch) {
    const { world } = player;

    witch = moveWitch(world, witch, 355, 494);

    await npcSay(player, witch, 'Oi what are you doing in my garden?');
    await npcSay(player, witch, 'Get out you pesky intruder');
    player.message('@que@Nora begins to cast a spell');
    await world.sleepTicks(3);

    player.teleport(CAUGHT_TELEPORT.x, CAUGHT_TELEPORT.y, true);
    world.removeEntity('npcs', witch);

    setStage(player, 1);
    delete player.cache.foundMagnet;
}

async function ratMagnetDoor(player, door) {
    const stage = stageOf(player);

    if (player.cache.witchSpawned && stage === 2) {
        // inside the house for some reason
        if (player.x > 355) {
            await player.enterDoor(door);
        } else {
            const witch = nearNpc(player, NORA_T_HAG_ID, 5);

            if (witch) {
                await caughtByWitch(player, witch);
                delete player.cache.witchSpawned;
            } else {
                await player.enterDoor(door);
                delete player.cache.witchSpawned;
            }
        }

        return;
    }

    if (stage > 1 || stage === -1 || player.x === 355) {
        await player.enterDoor(door);
    } else {
        player.message('The door won\'t open');
    }
}

async function shedDoor(player, door) {
    const { world } = player;
    const stage = stageOf(player);

    if (stage === 3 || stage === -1) {
        await player.enterDoor(door);
        return;
    }

    if (stage < 2) {
        player.message('@que@The shed door is locked');
        await world.sleepTicks(3);
        return;
    }

    const witch = nearNpc(player, NORA_T_HAG_ID, 10);

    // first time, or the witch went away
    if (!player.cache.witchSpawned || !witch) {
        player.message(
            '@que@As you reach out to open the door you hear footsteps inside the house'
        );
        await world.sleepTicks(3);
        player.message('@que@The footsteps approach the back door');
        await world.sleepTicks(3);

        world.spawnTimedNPC({
            id: NORA_T_HAG_ID,
            x: 356,
            y: 495,
            ticks: WITCH_TICKS
        });

        player.cache.witchSpawned = true;
        return;
    }

    player.message('@que@The shed door is locked');
    await world.sleepTicks(3);
    await caughtByWitch(player, witch);
}

async function hideoutDoor(player, door) {
    const { world } = player;
    const fromGarden = player.x <= 355;

    await player.enterDoor(door);

    let witch = nearNpc(player, NORA_T_HAG_ID, 5);

    if (!fromGarden || !player.cache.witchSpawned || !witch) {
        return;
    }

    await world.sleepTicks(3);
    player.message(
        'Through a crack in the door, you see a witch enter the garden'
    );
    witch = moveWitch(world, witch, 353, 492);
    await world.sleepTicks(4);
    witch = moveWitch(world, witch, 351, 491);
    player.message('The witch disappears into the shed');
    await npcSay(
        player,
        witch,
        'How are you tonight my pretty?',
        'Would you like some food?',
        'Just wait there while I get some'
    );
    witch = moveWitch(world, witch, 353, 492);
    player.message('@que@The witch passes  back through the garden again'); // sic
    await world.sleepTicks(3);
    player.message('@que@Leaving the shed door unlocked');
    await world.sleepTicks(3);

    world.removeEntity('npcs', witch);
    delete player.cache.witchSpawned;

    setStage(player, 3);
}

async function onWallObjectCommandOne(player, wallObject) {
    const { id, x, y } = wallObject;

    if (id === MAIN_ROOM_DOOR_ID && x === 358) {
        await player.enterDoor(wallObject);
        return true;
    }

    if (id === RAT_MAGNET_DOOR_ID && y === 495) {
        await ratMagnetDoor(player, wallObject);
        return true;
    }

    if (id === SHED_DOOR_ID && x === 351) {
        await shedDoor(player, wallObject);
        return true;
    }

    if (id === HIDEOUT_DOOR_ID && x === 356) {
        await hideoutDoor(player, wallObject);
        return true;
    }

    return false;
}

function wearingInsulatingGloves(player) {
    return (
        player.inventory.isEquipped(LEATHER_GLOVES_ID) ||
        player.inventory.isEquipped(ICE_GLOVES_ID)
    );
}

function wearingMetalArmour(player) {
    if (wearingInsulatingGloves(player)) {
        return false;
    }

    for (const id of METAL_ARMOUR_IDS) {
        if (player.inventory.isEquipped(id)) {
            return true;
        }
    }

    return false;
}

async function basementGate(player, gate) {
    let shouldShock = false;

    if (wearingMetalArmour(player)) {
        player.message('As your metal armour touches the gate you feel a shock');
        shouldShock = true;
    } else if (!wearingInsulatingGloves(player)) {
        player.message('As your bare hands touch the gate you feel a shock');
        shouldShock = true;
    }

    if (shouldShock) {
        const damage =
            player.skills.hits.current < 20
                ? Math.floor(Math.random() * 9) + 1
                : Math.floor(Math.random() * 14) + 1;

        player.damage(damage);
    } else {
        await player.enterGate(gate);
    }
}

async function searchCupboard(player) {
    if (!player.inventory.has(MAGNET_ID)) {
        player.message('You find a magnet in the cupboard');
        player.inventory.add(MAGNET_ID, 1);

        if (stageOf(player) > 0) {
            player.cache.foundMagnet = true;
        }
    } else {
        player.message('You search the cupboard, but find nothing');
    }
}

async function onGameObjectCommand(player, gameObject, index) {
    const { world } = player;
    const { id, x, y } = gameObject;

    if (id === DOOR_MAT_ID) {
        if (!player.inventory.has(FRONT_DOOR_KEY_ID)) {
            player.message('You find a key under the mat');
            player.inventory.add(FRONT_DOOR_KEY_ID, 1);
        } else {
            player.message('You find nothing interesting');
        }

        return true;
    }

    if (id === BASEMENT_GATE_ID && x === 363) {
        await basementGate(player, gameObject);
        return true;
    }

    if ((id === CUPBOARD_OPEN_ID || id === CUPBOARD_CLOSED_ID) && y === 3328) {
        const command = (gameObject.definition.commands[index] || '').toLowerCase();

        if (command === 'open') {
            world.replaceEntity('gameObjects', gameObject, CUPBOARD_OPEN_ID);
            player.message('You open the cupboard');
        } else if (command === 'close') {
            world.replaceEntity('gameObjects', gameObject, CUPBOARD_CLOSED_ID);
            player.message('You close the cupboard');
        } else {
            await searchCupboard(player);
        }

        return true;
    }

    return false;
}

async function onGameObjectCommandOne(player, gameObject) {
    return onGameObjectCommand(player, gameObject, 0);
}

async function onGameObjectCommandTwo(player, gameObject) {
    if (gameObject.id === DOOR_MAT_ID) {
        return false; // Examine
    }

    return onGameObjectCommand(player, gameObject, 1);
}

function inRatRoom(player) {
    return (
        player.x >= RAT_ROOM.minX &&
        player.x <= RAT_ROOM.maxX &&
        player.y >= RAT_ROOM.minY &&
        player.y <= RAT_ROOM.maxY
    );
}

async function onDropItem(player, item) {
    if (!item || item.id !== CHEESE_ID || !inRatRoom(player)) {
        return false;
    }

    const { world } = player;

    if (stageOf(player) === -1) {
        await player.say('I would rather eat it to be honest');
        return true;
    }

    player.inventory.remove(CHEESE_ID);
    player.message('@que@A rat appears from a hole and eats the cheese');
    await world.sleepTicks(3);

    // a rat already there goes 30 ticks later
    const oldRat = nearNpc(player, RAT_ID, 5);

    if (oldRat) {
        world.setTickTimeout(() => {
            world.removeEntity('npcs', oldRat);
        }, OLD_RAT_TICKS);
    }

    // Open-RSC addnpc without a despawn time: the rat stays until the magnet sends it home
    world.spawnTimedNPC({ id: RAT_ID, x: 356, y: 494 });

    return true;
}

async function onUseWithNPC(player, npc, item) {
    if (item.id !== MAGNET_ID || npc.id !== RAT_ID) {
        return false;
    }

    const { world } = player;

    if (stageOf(player) === -1) {
        return true;
    }

    if (!player.cache.foundMagnet) {
        player.message('You need to get the magnet yourself to do this quest');
        return true;
    }

    player.message('You put the magnet on the rat');
    world.removeEntity('npcs', npc);
    player.message('@que@The rat runs back into his hole');
    await world.sleepTicks(3);
    player.message('@que@You hear a click and whirr');
    await world.sleepTicks(3);
    player.inventory.remove(MAGNET_ID);
    setStage(player, 2);

    return true;
}

const SHAPE_NAMES = {
    [SHAPESHIFTER_SPIDER_ID]: 'spider',
    [SHAPESHIFTER_BEAR_ID]: 'bear',
    [SHAPESHIFTER_WOLF_ID]: 'wolf'
};

// never claims: the form dies like any npc (experience, bones) and the next one takes its place
async function onNPCDeath(player, npc) {
    if (!SHAPESHIFTER_IDS.has(npc.id) || !player || !player.cache) {
        return false;
    }

    const { world } = player;

    if (npc.id >= SHAPESHIFTER_WOLF_ID) {
        player.message('You finally kill the shapeshifter once and for all');
        player.cache.shapeshifter = true;
        return false;
    }

    const nextShape = world.spawnTimedNPC({
        id: npc.id + 1,
        x: npc.x,
        y: npc.y,
        ticks: SHAPESHIFTER_TICKS
    });

    // the forms have no Attack option, so a fleeing form could never be finished
    nextShape.retreats = false;

    player.message(`The shapeshifer turns into a ${SHAPE_NAMES[nextShape.id]}!`); // sic

    // after the kill frees the player (Npc#die ends the fight once the hooks are done)
    world.setTickTimeout(() => {
        if (world.npcs.getByIndex(nextShape.index) === nextShape) {
            nextShape.attack(player).catch(() => {});
        }
    }, 2);

    return false;
}

async function onNPCAttack(player, npc) {
    if (npc.id !== SHAPESHIFTER_HUMAN_ID || stageOf(player) !== -1) {
        return false;
    }

    player.message('I have already done that quest');
    return true;
}

// the shapeshifter's glare: attack, defense and strength drop by ceil((max - 4) / 15)
function weakenPlayer(player) {
    player.message('The shapeshifter glares at you');
    player.message('You feel slightly weakened');

    for (const skill of ['attack', 'defense', 'strength']) {
        const lowerBy = Math.ceil((player.skills[skill].base - 4) / 15);
        const newLevel = Math.max(0, player.skills[skill].current - lowerBy);

        player.changeStat(skill, newLevel - player.skills[skill].current);
    }
}

async function onGroundItemTake(player, groundItem) {
    if (groundItem.id !== BALL_ID || groundItem.x !== 351 || groundItem.y !== 491) {
        return false;
    }

    const stage = stageOf(player);

    if (stage !== -1 && player.cache.shapeshifter) {
        return false; // the shapeshifter is dead: take the ball
    }

    if (!player.cache.shapeshifter) {
        const shapeshifter = nearNpc(player, SHAPESHIFTER_HUMAN_ID, 20);

        if (shapeshifter) {
            await shapeshifter.attack(player);

            if (Math.floor(Math.random() * 4) === 0) {
                weakenPlayer(player);
            }
        }
    } else if (stage === -1) {
        await player.say("I'd better not take it, its not mine");
    }

    return true;
}

module.exports = {
    onTalkToNPC,
    onWallObjectCommandOne,
    onGameObjectCommandOne,
    onGameObjectCommandTwo,
    onDropItem,
    onUseWithNPC,
    onNPCDeath,
    onNPCAttack,
    onGroundItemTake,
    METAL_ARMOUR_IDS
};
