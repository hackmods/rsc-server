// Ported from Open-RSC Core-Framework authentic/quests/members/shilovillage/ShiloVillageObjects.java (AGPL-3.0): the objects of
// the Ah Za Rhoon cave, the hillside entrance and Rashiliyia's tomb, and the items used on them. The bridge blockade's "Jump" and
// the rocks 710 are the agility shortcuts of skills/agility.js; only the blockade's "Investigate" is the quest's. Stage map:
// shared.js.
//
// deviation: the hillside entrance a tree search reveals (Java 15 s, then a fern comes back) stays 60 s, so a bot has time to
//   search it, chisel the key and use it.

const GameObject = require('../../../../model/game-object');
const {
    ITEM,
    OBJECT,
    TICK_MS,
    stageOf,
    setStage,
    cacheHas,
    cacheSet,
    cacheDel,
    mes,
    delay,
    hurt,
    hitsCurrent,
    holds,
    beadsWorn,
    tooTired,
    succeed,
    commandOf,
    sendTeleportBubble,
    swapObject
} = require('./shared');
const { bumpyDirtHolder } = require('./items');

const ENTRANCE_TICKS = Math.ceil(60000 / TICK_MS);

// the quest's objects and what each does for every command (the Java blocks them whatever the command)
const ANY_COMMAND = new Set([
    OBJECT.SEARCH_TREE_FOR_ENTRANCE,
    OBJECT.PILE_OF_RUBBLE,
    OBJECT.PILE_OF_RUBBLE_TATTERED_SCROLL,
    OBJECT.CAVE_SACK,
    OBJECT.WET_ROCKS,
    OBJECT.TOMB_DOLMEN_HANDHOLDS,
    OBJECT.CLIMB_CAVE_ROCKS
]);

const NAMED_COMMAND = new Set([
    OBJECT.SPEC_STONE,
    OBJECT.BUMPY_DIRT,
    OBJECT.SMASHED_TABLE,
    OBJECT.ROTTEN_GALLOWS,
    OBJECT.WELL_STACKED_ROCKS,
    OBJECT.HILLSIDE_ENTRANCE,
    OBJECT.RASH_EXIT_DOOR,
    OBJECT.METALLIC_DUNGEON_GATE,
    OBJECT.TOMB_DOORS,
    OBJECT.BRIDGE_BLOCKADE
]);

function handles(gameObject) {
    return ANY_COMMAND.has(gameObject.id) || NAMED_COMMAND.has(gameObject.id);
}

// ---- the tomb doors (794) and the cave's gate (577), rocks (719), exit door (583), hillside entrance (572) ---------------

async function tombDoors(player, gameObject, command) {
    if (command === 'open') {
        if (cacheHas(player, 'tomb_door_shilo')) {
            swapObject(player, gameObject, OBJECT.DOORS_OPEN, 2);

            if (player.y >= 3632) {
                player.teleport(377, 3631);
            } else {
                player.teleport(377, 3633);
            }

            return;
        }

        player.message('This door is completely sealed, it is very ornately carved.');
    } else if (command === 'search') {
        await mes(player, 'The door is ornately carved with depictions of skeletal warriors.');
        await mes(player, 'You notice that some of the skeletal warriors depictions are not complete.');
        await mes(player, 'Instead, there are reccesses were some of the bones should be.');
        player.message('There are three recesses.');
    }
}

async function climbCaveRocks(player, gameObject) {
    if (tooTired(player)) {
        player.message('You are too fatigued to go any further.');
        return;
    }

    if (!beadsWorn(player)) {
        // going down
        if (gameObject.y > player.y) {
            player.message('@red@You simply cannot concentrate enough to climb down the rocks.');
        } else {
            // going up
            player.message('@red@You simply cannot concentrate enough to climb up the rocks.');
        }

        return;
    }

    player.message('You carefully pick your way through the rocks.');
    player.teleport(349, 3618);

    if (succeed(player, 32)) {
        await delay(player, 2);

        if (gameObject.y === 3619) {
            player.teleport(348, 3616);
            await delay(player, 2);
            player.message('You manage to carefully clamber up.');
        } else {
            player.teleport(348, 3620);
            await delay(player, 2);
            player.message('You manage to carefully clamber down.');
        }
    } else {
        player.message('@red@You fall!');
        await delay(player, 2);
        player.teleport(348, 3620);
        player.message('You take damage!');
        hurt(player, 3);
        await delay(player, 2);
        await player.say('Ooooff!');
    }

    player.addExperience('agility', 5);
}

async function metallicGate(player, gameObject, command) {
    if (command === 'open') {
        if (player.y >= 3616) {
            swapObject(player, gameObject, OBJECT.GATE_OPEN, 3);
            player.teleport(348, 3614);
            return;
        }

        player.message('The gates feel unearthly cold to the touch!');
        player.message('Are you sure you want to go through?');

        const menu = await player.ask(['Yes, I am completely fearless!', "Err, I'm having second thoughts now!"]);

        if (menu === 0) {
            swapObject(player, gameObject, OBJECT.GATE_OPEN, 3);

            if (!beadsWorn(player)) {
                player.teleport(348, 3616);
                hurt(player, Math.floor(hitsCurrent(player) / 2) + 1);

                if (hitsCurrent(player) > 0) {
                    await mes(player, '@red@You feel invisible hands starting to choke you...');
                    player.teleport(348, 3614);
                    await delay(player, 2);
                    await player.say('*Cough*', '*Choke*');
                    player.message('@red@You can barely manage to crawl back through the gates...');
                    await player.say('*Cough*', '*Choke*', '*...*', '* Gaaaa....*');
                }
            } else {
                player.teleport(348, 3616);
                sendTeleportBubble(player, player.x, player.y);
                player.message('@red@The Beads of the dead start to glow...');
            }
        } else if (menu === 1) {
            player.teleport(348, 3614);
            player.message('You manage to pull your spineless body away from the ancient gates.');
        }
    } else if (command === 'search') {
        await mes(player, 'There is an ancient symbol on the gate.');
        await mes(player, "It looks like a human figure with something around it's neck.");
        player.message('It looks pretty scary.');
    }
}

async function rashExitDoor(player, gameObject, command) {
    if (!beadsWorn(player)) {
        await mes(player, '@red@You feel invisible hands starting to choke you...');
        hurt(player, 18);
    }

    if (command === 'open') {
        await mes(player, 'The door seems to be locked!');
        await player.say(
            'Oh no, I\'m going to be stuck in here forever!',
            'How will I ever get out!',
            "I'm too young to die!"
        );
    } else if (command === 'search') {
        player.message('You can see a small recepticle, not unlike the one on the opposite side of the door!');
    }
}

async function hillsideEntrance(player, gameObject, command) {
    if (command === 'open') {
        await mes(player, 'There seems to be some sort of recepticle,');
        player.message('perhaps it needs a key?');
    } else if (command === 'search') {
        await mes(player, 'Examining the door, you see that it has a very strange lock.');
        player.message('Ewww...it seems to be made out of bone!');
    } else {
        return;
    }

    if (!cacheHas(player, 'can_chisel_bone') && stageOf(player) === 7) {
        cacheSet(player, 'can_chisel_bone');
    }
}

async function searchTreeForEntrance(player) {
    const { world } = player;

    if (stageOf(player) === -1) {
        // LOCKED_POST_QUEST_REGIONS_ACCESSIBLE is off in the authentic config
        player.message('You find nothing significant.');
        return;
    }

    await mes(player, 'You pull the trees apart...');
    player.message('...and reveal an ancient doorway set into the side of the hill!');
    await delay(player, 4);

    const [existing] = world.gameObjects.getAtPoint(350, 782);

    if (existing && existing.id === OBJECT.HILLSIDE_ENTRANCE) {
        return;
    }

    const entrance = new GameObject(world, { id: OBJECT.HILLSIDE_ENTRANCE, x: 350, y: 782, direction: 2 });

    world.addEntity('gameObjects', entrance);
    world.setTickTimeout(() => world.removeEntity('gameObjects', entrance), ENTRANCE_TICKS);
}

// ---- Bervirius's tomb: the handholds (690) and the well stacked rocks (688) -------------------------------------------------

async function handholds(player) {
    await mes(player, 'You start to climb up the side of the rock wall using the hand holds');

    if (succeed(player, 32)) {
        player.message('You push your way through a cunningly designed trap door..');
        player.teleport(471, 836);
        await delay(player);
        player.message('And appear in bright sunshine and the salty sea air.');
    } else {
        player.message('You get halfway but loose your grip.');
        await mes(player, 'You fall back to the floor.');
        player.teleport(380, 3692);
        await player.say('Ahhhhh!');
        hurt(player, Math.floor(hitsCurrent(player) / 10));
        await mes(player, 'And it knocks the wind out of you.');
        hurt(player, Math.floor(hitsCurrent(player) / 10));
        player.teleport(467, 3674);
        await player.say('Oooff!');
    }
}

async function wellStackedRocks(player, gameObject, command) {
    if (command === 'investigate') {
        player.message('Rocks that have been stacked uniformly.');
    } else if (command === 'search') {
        const stage = stageOf(player);

        if (stage === -1) {
            player.message('This tomb entrance seems to be completely flooded.');
            player.message('A great sense of peace pervades in this area.');
        } else if (stage >= 5) {
            await mes(player, 'You investigate the rocks and find a dank,narrow crawl-way.');
            await mes(player, 'Do you want to crawl into this dank, dark, narrow,');
            await mes(player, 'possibly dangerous hole?');

            const menu = await player.ask(['Yes please, I can think of nothing nicer !', 'No way could you get me to go in there !']);

            if (menu === 0) {
                player.message('You contort your body and prepare to squirm, worm like, into the hole.');

                if (succeed(player, 32)) {
                    await mes(player, 'You struggle through the narrow crevice in the rocks');
                    player.teleport(471, 3658);
                    player.message('and drop to your feet into a narrow underground corridor');

                    if (stageOf(player) === 5) {
                        setStage(player, 6);
                    }
                } else {
                    await mes(player, 'You managed to get yourself stuck.');
                    await mes(player, 'You have to wrench yourself free to get out.');
                    await mes(player, 'You manage to pull yourself out, but hurt yourself in the process.');
                    hurt(player, 3);
                    await delay(player, 2);
                    player.message('Maybe you\'ll have better luck next time?');
                }
            } else if (menu === 1) {
                player.message('You decide that the surface is the place for you!');
            }
        } else {
            player.message('You find nothing of significance.');
            player.message('And it does look quite scarey.');
        }
    }
}

// ---- the Ah Za Rhoon cave ---------------------------------------------------------------------------------------------------

async function tatteredScrollRubble(player) {
    await mes(player, 'You can see that there is something hidden behind some of the rocks.');
    await mes(player, 'Do you want to have a look?');
    player.message("It looks a bit dangerous because the ceiling doesn't look safe!");

    const menu = await player.ask([
        "Yes, I'll carefully move the rocks to see what's behind them.",
        "No, I'll leave them, I don't like the look of that ceiling."
    ]);

    if (menu === 0) {
        if (player.inventory.has(ITEM.TATTERED_SCROLL)) {
            player.message('You see nothing here but an empty book case behind rocks.');
            return;
        }

        await mes(player, 'You start to slowly move the rocks to one side.');

        if (succeed(player, 32)) {
            await mes(player, 'You carefully manage to remove enough rocks to see a book shelf.');
            await mes(player, 'You gingerly remove a delicate scroll from the shelf');
            player.message('and place it carefully in your inventory.');
            player.inventory.add(ITEM.TATTERED_SCROLL, 1);

            if (!cacheHas(player, 'obtained_shilo_info')) {
                cacheSet(player, 'obtained_shilo_info');
            }

            player.addExperience('agility', 15);
        } else {
            await mes(player, 'You acidently knock some rocks and the ceiling starts to cave in.');
            await mes(player, 'Some rocks fall on you.');
            hurt(player, Math.floor(hitsCurrent(player) * 0.1 + 1));
            player.addExperience('agility', 5);
        }
    } else if (menu === 1) {
        await mes(player, 'You decide to leave the rocks well alone.');
        player.message('The ceiling does look a little unsafe.');
    }
}

async function rottenGallows(player, gameObject, command) {
    const empty = player.inventory.has(ITEM.ZADIMUS_CORPSE) || stageOf(player) === -1;

    if (command === 'look') {
        await mes(player, 'You take a look at the Gallows.');
        await mes(player, 'The gallows look pretty eerie.');

        if (empty) {
            await mes(player, 'An empty noose swings eerily in the half light of the tomb.');
        } else {
            await mes(player, 'A grisly sight meets your eyes. A human corpse hangs from the noose.');
            await mes(player, 'His hands have been tied behind his back.');
        }
    } else if (command === 'search') {
        await mes(player, 'You search the gallows.');

        if (empty) {
            player.message('The gallows look pretty eerie. You search but find nothing.');
            return;
        }

        await mes(player, 'You find a human corpse hanging in the noose.');
        await mes(player, 'It looks as if the corpse will be removed easily.');
        await mes(player, 'Would you like to remove the corpse from the noose?');

        const menu = await player.ask([
            "I don't think so it might animate and attack me!",
            'Yes, I may find something else on the corpse'
        ]);

        if (menu === 0) {
            await mes(player, 'You move away from the corpse quietly and slowly...');
            await mes(player, '...you have an eerie feeling about this!');
            await player.say('** Gulp! **');
        } else if (menu === 1) {
            await mes(player, 'You gently support the frame of the skeleton and lift the skull through the noose.');
            await mes(player, 'You find an old sack and place the skeleton in this.');
            await mes(player, 'Maybe Trufitus can give you some tips on what to do with it.');
            await mes(player, 'You sense that there is a spirit that needs to be put to rest.');
            player.inventory.add(ITEM.ZADIMUS_CORPSE, 1);

            if (!cacheHas(player, 'obtained_shilo_info')) {
                cacheSet(player, 'obtained_shilo_info');
            }
        }
    }
}

function caveSack(player) {
    if (player.inventory.has(ITEM.CRUMPLED_SCROLL)) {
        player.message('You find nothing in the sacks.');
        return;
    }

    player.message('You find a tattatered, very ornate scroll.');
    player.message('Which you place carefully in your inventory.');
    player.inventory.add(ITEM.CRUMPLED_SCROLL, 1);

    if (!cacheHas(player, 'obtained_shilo_info')) {
        cacheSet(player, 'obtained_shilo_info');
    }
}

async function wetRocks(player) {
    await mes(player, 'You see a huge waterfall blocking your path.');
    await mes(player, 'The rocks look quite perilous but you could try scale them.');
    player.message('Or maybe you could use something to float through the waterfall?');

    const menu = await player.ask(["Yes, I'll try to climb out", "No, thanks, I'll look for another exit."]);

    if (menu === 0) {
        await mes(player, 'You start searching for handholds in the slippery cave entrance...');
        player.teleport(342, 3684);

        // sic: the Java's succeed() is the fall (a quirk of its own succeed(), see shared.js)
        if (succeed(player, 32)) {
            await mes(player, '@red@*** YOU FALL ***');
            await mes(player, 'You slip into the water and get washed out through the waterfall!');
            await mes(player, "You're pumelled as the thrashing water throws");
            await mes(player, 'you against the rocks...');
            player.teleport(339, 808);
            await mes(player, 'You are washed onto the waterfall river bank');
            player.message('barely alive!');
            hurt(player, Math.floor(hitsCurrent(player) * 0.2 + 4));
            player.addExperience('agility', 5);
        } else {
            await mes(player, 'You manage to work your way along the slippery wall');
            await mes(player, 'and avoid falling into the water below.');
            player.teleport(344, 808);
            await mes(player, 'You make it out of the cave');
            player.message('and into the warmth of the jungle.');
            player.addExperience('agility', 100);
        }
    } else if (menu === 1) {
        await mes(player, 'You decide to have another look around.');
        player.message('And see if you can find a better way to get out.');
    }
}

// the raft stops: [x, y, how it ends]
async function raft(player) {
    const { world } = player;
    const stops = [
        { x: 353, y: 3669, run: () => mes(player, 'You place it carefully on the water!', 0) },
        { x: 357, y: 3673, run: () => player.say('Weeeeeeee!'), after: 1 },
        { x: 356, y: 3678, after: 2 },
        { x: 353, y: 3682, run: () => player.say('Weeeeeeee!'), after: 1 },
        { x: 349, y: 3685, after: 1 },
        {
            x: 345,
            y: 3686,
            run: async () => {
                player.message('You come to a huge waterfall...');
                await player.say('* Oh oh! *');
            },
            after: 1
        },
        { x: 341, y: 3686 }
    ];

    await mes(player, 'You see that this table already looks very sea worthy');
    await mes(player, 'it takes virtually no time at all to help fix it into.');
    await mes(player, 'a crude raft.');

    for (const [i, stop] of stops.entries()) {
        const visual = new GameObject(world, { id: OBJECT.CRUDE_RAFT, x: stop.x, y: stop.y, direction: 0 });

        world.addEntity('gameObjects', visual);
        player.teleport(stop.x, stop.y);

        if (i === 0) {
            await mes(player, 'You place it carefully on the water!');
            await mes(player, 'You board the raft!');
            await mes(player, 'You push off!');
        } else if (i === stops.length - 1) {
            await mes(player, '...and plough through it!', 0);
        } else if (stop.run) {
            await stop.run();
        }

        if (stop.after) {
            await delay(player, stop.after);
        }

        world.removeEntity('gameObjects', visual);
    }

    player.message('The raft soon breaks up.');
    await delay(player);
    player.teleport(341, 810);
}

async function smashedTable(player, gameObject, command) {
    if (command === 'examine') {
        await mes(player, 'This table might be useful...');
        player.message('with some adjustment');
    } else if (command === 'craft') {
        await mes(player, 'You may be able to turn this delapidated table into ');
        await mes(player, 'something that could help you to get out of this place.');
        await mes(player, 'What would you like to try and turn this table into?');

        const sub = await player.ask(['A ladder', 'A crude raft', 'A pole vault']);

        if (sub === 0) {
            await mes(player, 'Your experience in crafting tells you that');
            player.message('there isn\'t enough wood to complete this task.');
        } else if (sub === 1) {
            await raft(player);
        } else if (sub === 2) {
            await mes(player, 'You happily start hacking away at the table');
            await mes(player, "But realise that you won't have enough woood to properly finish the item off!");
            await player.say('Oops! Not enough wood left to do anything else with the table!');
            await mes(player, "There isn't enough wood left in this table to make anything!");
        }
    }
}

async function pileOfRubble(player, gameObject) {
    await mes(player, 'You can see that there is a narrow gap through into darkness.');
    await mes(player, 'You could try to wriggle through and see where it takes you.');

    const menu = await player.ask(["Yes, I'll wriggle through.", "No, I'll stay here."]);

    if (menu === 0) {
        player.message('You manage to wriggle through the rubble');

        if (gameObject.x === 348 && gameObject.y === 3708) {
            player.teleport(356, 3667);
        } else if (gameObject.x === 357 && gameObject.y === 3668) {
            player.teleport(347, 3709);
        }

        player.addExperience('agility', 10);
    } else if (menu === 1) {
        player.message('You decide to stay where you are');
    }
}

async function bumpyDirt(player, gameObject, command) {
    const stage = stageOf(player);

    if (stage === -1) {
        player.message('The entrance seems to have caved in.');
    } else if (stage >= 2) {
        if (cacheHas(player, 'SV_DIG_BUMP')) {
            await mes(player, 'You see a small fissure in the granite');
            await mes(player, 'that you might just be able to crawl through.');

            if (!player.inventory.has(ITEM.LIT_CANDLE) && !cacheHas(player, 'SV_DIG_LIT')) {
                player.message("It's very dark beyond the fissure.");
            }

            await bumpyDirtHolder(player);
            return;
        }

        if (command === 'look') {
            player.message('It looks as if something is buried here.');
        } else if (command === 'search') {
            await mes(player, 'It looks as if something is buried here.');
            player.message('It looks quite big, you may need some tools to excavate further.');
        }
    } else {
        player.message('It just looks like some bumpy ground');
    }
}

async function specStone(player, gameObject, command) {
    if (command === 'look closer') {
        player.message('This stone seems to have strange markings on it');
    } else if (command === 'investigate') {
        await mes(player, 'This stone seems to have strange markings on it');
        await mes(player, 'Maybe Trufitus can decipher them.');
        await mes(player, 'The stone is too heavy to carry');
        await mes(player, 'But the letters stand proud on a plaque');
        await mes(player, 'Maybe you could seperate the plaque from the rock?');
    }
}

// ---- hooks --------------------------------------------------------------------------------------------------------------------

async function handle(player, gameObject, index) {
    const command = commandOf(gameObject, index);

    switch (gameObject.id) {
        case OBJECT.TOMB_DOORS:
            await tombDoors(player, gameObject, command);
            return true;
        case OBJECT.CLIMB_CAVE_ROCKS:
            await climbCaveRocks(player, gameObject);
            return true;
        case OBJECT.METALLIC_DUNGEON_GATE:
            await metallicGate(player, gameObject, command);
            return true;
        case OBJECT.RASH_EXIT_DOOR:
            await rashExitDoor(player, gameObject, command);
            return true;
        case OBJECT.HILLSIDE_ENTRANCE:
            await hillsideEntrance(player, gameObject, command);
            return true;
        case OBJECT.SEARCH_TREE_FOR_ENTRANCE:
            await searchTreeForEntrance(player);
            return true;
        case OBJECT.TOMB_DOLMEN_HANDHOLDS:
            await handholds(player);
            return true;
        case OBJECT.WELL_STACKED_ROCKS:
            await wellStackedRocks(player, gameObject, command);
            return true;
        case OBJECT.BRIDGE_BLOCKADE:
            // only "Investigate" is the quest's; "Jump" is the agility shortcut
            if (command !== 'investigate') {
                return false;
            }

            player.message('Someone has put this here to prevent access to the other side.');
            player.message('The remainder of the bridge looks even more rickety..');
            return true;
        case OBJECT.PILE_OF_RUBBLE_TATTERED_SCROLL:
            await tatteredScrollRubble(player);
            return true;
        case OBJECT.ROTTEN_GALLOWS:
            await rottenGallows(player, gameObject, command);
            return true;
        case OBJECT.CAVE_SACK:
            caveSack(player);
            return true;
        case OBJECT.WET_ROCKS:
            await wetRocks(player);
            return true;
        case OBJECT.SMASHED_TABLE:
            await smashedTable(player, gameObject, command);
            return true;
        case OBJECT.PILE_OF_RUBBLE:
            await pileOfRubble(player, gameObject);
            return true;
        case OBJECT.BUMPY_DIRT:
            await bumpyDirt(player, gameObject, command);
            return true;
        case OBJECT.SPEC_STONE:
            await specStone(player, gameObject, command);
            return true;
        default:
            return false;
    }
}

async function onGameObjectCommandOne(player, gameObject) {
    return handles(gameObject) ? handle(player, gameObject, 0) : false;
}

async function onGameObjectCommandTwo(player, gameObject) {
    return handles(gameObject) ? handle(player, gameObject, 1) : false;
}

// ---- items used on the objects ------------------------------------------------------------------------------------------------

const USED_ON = new Map([
    [OBJECT.BUMPY_DIRT, new Set([ITEM.SPADE, ITEM.LIT_CANDLE, ITEM.ROPE])],
    [OBJECT.HILLSIDE_ENTRANCE, new Set([ITEM.BONE_SHARD, ITEM.BONE_KEY])],
    [OBJECT.RASH_EXIT_DOOR, new Set([ITEM.BONE_KEY])],
    [OBJECT.TOMB_DOORS, new Set([ITEM.BONES])],
    [OBJECT.SPEC_STONE, new Set([ITEM.CHISEL])]
]);

async function onUseWithGameObject(player, gameObject, item) {
    const items = USED_ON.get(gameObject.id);

    if (!items || !items.has(item.id)) {
        return false;
    }

    const stage = stageOf(player);

    if (gameObject.id === OBJECT.TOMB_DOORS) {
        if (!holds(player, ITEM.BONES, 3)) {
            player.message('You do not have enough bones for all the recesses.');
            return true;
        }

        for (let i = 0; i < 3; i++) {
            player.inventory.remove(ITEM.BONES, 1);
        }

        await mes(player, 'You fit the bones into the reccesses of the door.');
        await mes(player, 'The door seems to change slightly.');
        await mes(player, 'Two depictions of skeletal warriors turn their heads towards you.');
        await mes(player, 'They are alive!');
        await mes(player, 'The Skeletons wrench themselves free of the door.');
        await mes(player, 'Stepping out of the door, with grinning teeth they push the huge doors open.');
        swapObject(player, gameObject, OBJECT.DOORS_OPEN, 2);
        player.teleport(377, 3631);

        if (!cacheHas(player, 'tomb_door_shilo')) {
            cacheSet(player, 'tomb_door_shilo');
        }
    } else if (gameObject.id === OBJECT.RASH_EXIT_DOOR) {
        if (!beadsWorn(player)) {
            await mes(player, '@red@You feel invisible hands starting to choke you...');
            hurt(player, Math.floor(hitsCurrent(player) / 2));
        }

        await mes(player, 'You insert the key into the lock and it merges with the door.');
        await mes(player, 'The doors creak open revealing bright day light.');
        player.message('You walk outside into the warmth of the Jungle heat.');
        player.teleport(350, 782);
        cacheDel(player, 'tomb_door_shilo');
    } else if (gameObject.id === OBJECT.HILLSIDE_ENTRANCE && item.id === ITEM.BONE_KEY) {
        await mes(player, 'You try the key with the lock.');
        await mes(player, 'As soon as you push the key into the lock.');
        sendTeleportBubble(player, 350, 782);
        await delay(player, 2);
        player.message('A shimmering light dances over the doors, before you can blink, the doors creak open.');
        player.teleport(348, 3611);
        await delay(player);
        await mes(player, 'You feel a strange force pulling you inside.');
        await mes(player, 'The doors close behind you with the sound of crunching bone.');
        await mes(player, 'Before you stretches a winding tunnel blocked by an ancient gate.');

        if (stageOf(player) === 7) {
            setStage(player, 8);
        }
    } else if (gameObject.id === OBJECT.HILLSIDE_ENTRANCE) {
        await mes(player, 'You try to use the bone shard on the lock.');
        await mes(player, 'Although it isabout the right size,');
        player.message('you find that it just doesn\'t fit the delicate lock mechanism.');
    } else if (gameObject.id === OBJECT.BUMPY_DIRT) {
        await useOnBumpyDirt(player, item, stage);
    } else if (gameObject.id === OBJECT.SPEC_STONE) {
        await mes(player, 'You cleanly cut the plaque of letters away from the rock.');
        await mes(player, 'You place it carefully into your inventory.');
        player.inventory.add(ITEM.STONE_PLAQUE, 1);
        player.addExperience('crafting', 10);
    }

    return true;
}

async function useOnBumpyDirt(player, item, stage) {
    if (stage === -1) {
        player.message('The entrance seems to have caved in.');
        return;
    }

    if (item.id === ITEM.ROPE) {
        if (stage >= 2) {
            if (!cacheHas(player, 'SV_DIG_LIT')) {
                player.message("It's too dark to see where to attach it.");
            } else if (!cacheHas(player, 'SV_DIG_ROPE')) {
                await mes(player, 'You see where to attach the rope very clearly.');
                await mes(player, 'You secure it well.');
                player.message('A rope is already secured there');
                cacheSet(player, 'SV_DIG_ROPE');
                player.inventory.remove(ITEM.ROPE, 1);
            } else {
                player.message('A rope is already secured there');
            }
        } else {
            player.message('Nothing interesting happens');
        }
    } else if (item.id === ITEM.LIT_CANDLE) {
        if (stage >= 2) {
            if (!cacheHas(player, 'SV_DIG_LIT')) {
                await mes(player, 'You hold the candle to the fissure and see that');
                await mes(player, 'there is quite a large drop after you get through the hole.');

                if (!player.inventory.has(ITEM.ROPE)) {
                    player.message("It's a pity you don't have some rope");
                } else {
                    player.message('Some rope might help here');
                }

                cacheSet(player, 'SV_DIG_LIT');
                player.inventory.remove(ITEM.LIT_CANDLE, 1);
            } else {
                player.message('The spot is already lit');
            }
        } else {
            player.message('Nothing interesting happens');
        }
    } else if (item.id === ITEM.SPADE) {
        if (stage >= 2) {
            if (!cacheHas(player, 'SV_DIG_BUMP')) {
                await mes(player, 'You dig a small hole and almost immediately hit granite');
                await mes(player, 'You excavate the hole a bit more and see that there is a small fissure');
                await mes(player, 'that you might just be able to crawl through.');

                if (!player.inventory.has(ITEM.LIT_CANDLE) && !cacheHas(player, 'SV_DIG_LIT')) {
                    player.message("It's very dark beyond the fissure.");
                }

                cacheSet(player, 'SV_DIG_BUMP');
                await bumpyDirtHolder(player);
            } else {
                player.message('You have already excavated this area.');
                player.message('Your spade clangs against the granite');
            }
        } else {
            await mes(player, 'You start digging...');
            await mes(player, 'But without knowing what you\'re digging for...');
            player.message('you decide to give up.');
        }
    }
}

module.exports = {
    onGameObjectCommandOne,
    onGameObjectCommandTwo,
    onUseWithGameObject
};
