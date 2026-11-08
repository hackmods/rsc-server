// Ported from Open-RSC Core-Framework authentic/quests/members/legendsquest/obstacles/LegendsQuestGameObjects.java,
// LegendsQuestDarkMetalGate.java and LegendsQuestCaveAgility.java (AGPL-3.0): the objects of the Kharazi jungle and its caves, the
// carved rocks and their gems, the Yommi tree and the totem pole. The doors 1160 and the cave mouths 1158 / 1159 were ported earlier
// (game-objects/ancient-wooden-doors.js, game-objects/object-tele-points.js). Stage map: shared.js.

const { pickaxes } = require('@2003scape/rsc-data/skills/mining');
const {
    ITEM,
    NPC,
    OBJECT,
    TICK_MS,
    stageOf,
    cacheHas,
    cacheSet,
    cacheDel,
    cacheInt,
    mes,
    delay,
    holds,
    give,
    take,
    level,
    setLevel,
    decrementLevel,
    hurt,
    random,
    succeed,
    calcProduction,
    failCalculation,
    commandOf,
    swapObject,
    changeObject,
    objectAt,
    dropTimed,
    spawnNpc,
    nearNpc,
    moveNpc,
    bubble,
    sendBox
} = require('./shared');
const { demonFight, echnedTalk, spawnFor } = require('./demon');
const { gujuoTalk } = require('./gujuo');

const PICKAXE_IDS = Object.keys(pickaxes).map(Number);
const LOCKED_POST_QUEST_REGIONS_ACCESSIBLE = false; // Open-RSC default config
const LOOSE_SHALLOW_WATER_CHECK = false;

// the carved rocks: object tile -> attach slot, gem id, gem name
const CARVED = new Map([
    ['471,3722', { slot: 1, gem: ITEM.OPAL, name: 'Opal' }],
    ['474,3730', { slot: 2, gem: ITEM.EMERALD, name: 'Emerald' }],
    ['471,3734', { slot: 3, gem: ITEM.RUBY, name: 'Ruby' }],
    ['466,3739', { slot: 4, gem: ITEM.DIAMOND, name: 'Diamond' }],
    ['460,3737', { slot: 5, gem: ITEM.SAPPHIRE, name: 'Sapphire' }],
    ['464,3730', { slot: 6, gem: ITEM.RED_TOPAZ, name: 'Topaz' }],
    ['469,3728', { slot: 7, gem: ITEM.JADE, name: 'Jade' }]
]);
// item.getDef().getName(): rsc-data's names
const itemDefinitions = require('@2003scape/rsc-data/config/items');
const GEM_NAMES = Object.fromEntries(
    [ITEM.OPAL, ITEM.EMERALD, ITEM.RUBY, ITEM.DIAMOND, ITEM.SAPPHIRE, ITEM.RED_TOPAZ, ITEM.JADE].map((id) => [id, itemDefinitions[id].name])
);
const GEM_SLOT = { [ITEM.OPAL]: 1, [ITEM.EMERALD]: 2, [ITEM.RUBY]: 3, [ITEM.DIAMOND]: 4, [ITEM.SAPPHIRE]: 5, [ITEM.RED_TOPAZ]: 6, [ITEM.JADE]: 7 };

const REFILLABLE = [1188, 1266, 21, 140, 341, 465];
const REFILLED = [1189, 1267, 50, 141, 342, 464];

const YOMMI_TREE_GROW_TICKS = Math.ceil(15000 / TICK_MS);
const YOMMI_TREE_REVERT_TICKS = Math.ceil(60000 / TICK_MS);

function postQuestLocked(player) {
    return stageOf(player) === -1 && !LOCKED_POST_QUEST_REGIONS_ACCESSIBLE;
}

function carvedAt(obj) {
    return CARVED.get(`${obj.x},${obj.y}`);
}

// ---- a Yommi tree stage is replaced after a time, if it is still there -----------------------------------------------------------

function ownedReplace(player, obj, newId, ownerName) {
    const next = changeObject(player, obj, newId);

    if (next && ownerName) {
        next.owner = ownerName;
    }

    return next;
}

function revertLater(player, x, y, fromId, toId, ticks, message) {
    const { world } = player;

    world.setTickTimeout(() => {
        const now = objectAt(world, fromId, x, y);

        if (now) {
            world.replaceEntity('gameObjects', now, toId);

            if (message && player.loggedIn !== false) {
                player.message(message);
            }
        }
    }, ticks);
}

function isOwner(player, obj) {
    return obj.owner === player.username || obj.owner === undefined;
}

// ---- the cave stairs and walkways ----------------------------------------------------------------------------------------------

// Formulae.calcProductionSuccessfulLegacy(req, agility, false, req + 30)
function agilitySucceeds(player, req) {
    return calcProduction(req, level(player, 'agility'), false, req + 30);
}

const STAIRS = {
    1114: { down: (p) => p.x <= 419, mid: [421, 3707], downTo: [423, 3707], upTo: [419, 3707] },
    1123: { down: (p) => p.x >= 426, mid: [424, 3702], downTo: [422, 3702], upTo: [426, 3702] },
    1124: { down: (p) => p.y <= 3702, mid: [419, 3704], downTo: [419, 3706], upTo: [419, 3702] },
    1125: { down: (p) => p.y >= 3706, mid: [426, 3704], downTo: [426, 3702], upTo: [426, 3706] }
};

// the Java names the four stairs by the order of its constants (1114 = STAIRS_1 ... 1125 = STAIRS_4) and each moves between two ends
const STAIRS_BY_ID = {
    1114: { mid: [426, 3704], down: (p) => p.y >= 3706, downTo: [426, 3702], upTo: [426, 3706] },
    1123: { mid: [424, 3702], down: (p) => p.x >= 426, downTo: [422, 3702], upTo: [426, 3702] },
    1124: { mid: [419, 3704], down: (p) => p.y <= 3702, downTo: [419, 3706], upTo: [419, 3702] },
    1125: { mid: [421, 3707], down: (p) => p.x <= 419, downTo: [423, 3707], upTo: [419, 3707] }
};

async function rockHewnStairs(player, obj) {
    if (level(player, 'agility') < 50) {
        player.message('You need an agility level of 50 to step these stairs');
        return;
    }

    const stairs = STAIRS_BY_ID[obj.id];

    if (agilitySucceeds(player, 50)) {
        const goingDown = stairs.down(player);

        player.message(goingDown ? 'You climb down the steps.' : 'You climb up the stairs.');
        player.teleport(...stairs.mid);
        await delay(player, 1);
        player.addExperience('agility', 20, false);
        player.teleport(...(goingDown ? stairs.downTo : stairs.upTo));
    } else {
        player.message('You slip and fall...');
        hurt(player, random(2, 3));
        player.teleport(...stairs.mid);
        await delay(player, 1);
        player.addExperience('agility', 5, false);
        player.teleport(...stairs.downTo);
    }
}

async function rockyWalkway(player, obj) {
    if (player.x === obj.x && player.y === obj.y) {
        player.message("You're standing there already!");
        return;
    }

    if (agilitySucceeds(player, 50)) {
        player.message('You manage to keep your balance.');
        player.teleport(obj.x, obj.y);
        player.addExperience('agility', 20, false);
        return;
    }

    player.teleport(421, 3699);
    player.message('You slip and fall...');

    const failScene = random(0, 10);

    if (failScene === 0) {
        player.message('...but you luckily avoid any damage.');
    } else if (failScene <= 2) {
        hurt(player, random(3, 6));
        player.message('...and take a bit of damage.');
    } else if (failScene <= 5) {
        hurt(player, random(7, 11));
        player.message('...and take some damage.');
    } else if (failScene <= 7) {
        hurt(player, random(12, 16));
        player.message('...and take damage.');
    } else if (failScene <= 9) {
        hurt(player, random(17, 23));
        player.message('...and are injured.');
    } else {
        hurt(player, random(24, 31));
        player.message('...and take some major damage.');
    }

    player.addExperience('agility', 5, false);
}

// ---- the dark metal gate -------------------------------------------------------------------------------------------------------

async function darkMetalGate(player, obj, command) {
    if (command === 'open') {
        if (player.y <= 3715) {
            await mes(player, 'You open the gates and walk through..', 2);
            player.teleport(474, 3720);
            player.message('You magically appear in another area of the cave system.');
            return;
        }

        await mes(player, "This gate is fused with rock, it doesn't seem possible to open it.", 2);
        await mes(player, 'But it does look slightly strange in some way.', 2);
    } else if (command === 'search') {
        await mes(player, 'It just looks like a normal gate...', 5);
        await mes(player, 'At first...', 1);
        await mes(player, 'And then you notice that some of the bars of metal make up letters.', 2);
        await mes(player, 'After some time you manage to make sense of it...', 2);
        await mes(player, 'Would you like to read it?', 2);

        const menu = await player.ask(["Yes, I'll read it.", "No, I don't want to read that.", 'Search further...']);

        if (menu === 0) {
            await mes(player, 'You attempt to read the message in the gate...', 2);
            sendBox(
                player,
                'Gates of metal will not be kind, % %To those who care not for the way of mind. % %To all men of learning and supernatural powers, % %With book and rune spend the long dark hours. % %If passage further you would endure, % %Give me a taste of your power so pure. % %'
            );
        } else if (menu === 1) {
            player.message("You decide not to read the message.");
        } else {
            await mes(player, 'You scour the gate for any more clues...', 2);
            await mes(player, 'Something etched into the wall nearby catches your eye...', 2);
            await mes(player, 'It looks like a picture of four pillars or constructions.', 2);
            await mes(player, 'Over the first pillar is a picture of a cloud...', 2);
            await mes(player, 'Over the second pillar are some etched flickering flames...', 2);
            await mes(player, 'Over the third pillar is the carved image of a dew drop or a tear...', 2);
            await mes(player, 'Over the fourth pillar is the likeness of a ploughed field...', 2);
            await mes(player, 'All of these images are contained within a sphere.', 2);
            await player.say('Hmmm, I wonder what they could mean?');
        }
    }
}

// the four Charge Orb spells, by spell index (skills/magic.js CHARGE_ORBS): 29 water, 36 earth, 38 fire, 40 air
const CHARGE_SPELLS = new Set([29, 36, 38, 40]);

async function onCastOnGameObject(player, obj, spell, spellID) {
    if (obj.id !== OBJECT.DARK_METAL_GATE) {
        return false;
    }

    if (!CHARGE_SPELLS.has(spellID)) {
        player.message('Nothing interesting happens');
        return true;
    }

    const cast = require('../../../../packet-handlers/magic').cast;
    const cost = cast.checkCast(player, spellID, spell);

    if (!cost) {
        return true;
    }

    cast.finishCast(player, spellID, cost, null);
    await mes(player, 'The orb shatters with the power of the magic.', 2);
    await mes(player, 'The spell works and the gates open.', 2);
    player.teleport(474, 3714);
    await mes(player, 'You magically appear in a different part of the cave system.', 8);
    await mes(player, 'It seems that the gate was a test of magical ability.', 2);
    await mes(player, 'As soon as you enter this room, you are filled with dread.', 2);
    await mes(player, 'In the centre of the room is a large gaping hole.', 2);
    await mes(player, 'It goes down a long way...', 2);

    return true;
}

// ---- the carved rocks and their gems -------------------------------------------------------------------------------------------

async function carvedRockSearch(player, obj) {
    await mes(player, 'You see a delicate inscription on the rock, it says,', 2);
    await mes(player, "@gre@'Once there were crystals to make the pool shine,'", 3);
    await mes(player, "@gre@'Ordered in stature to retrieve what's mine.'", 1);

    const rock = carvedAt(obj);

    if (rock && cacheHas(player, `legends_attach_${rock.slot}`)) {
        // 2: the gem cannot be taken at this point
        cacheSet(player, `legends_attach_${rock.slot}`, 2);
        dropTimed(player, rock.gem, obj.x, obj.y, 8);
        await mes(player, `A barely visible ${rock.name} becomes clear again, spinning above the rock.`, 2);
        await mes(player, 'And then fades again...', 2);
    }
}

async function useGemOnCarvedRock(player, obj, item) {
    const rock = carvedAt(obj);
    const slot = rock && rock.gem === item.id ? rock.slot : -1;
    const gemName = GEM_NAMES[item.id];

    if (slot !== -1 && cacheHas(player, `legends_attach_${slot}`)) {
        cacheSet(player, `legends_attach_${slot}`, 2);
        player.message(`You have already placed an ${gemName} above this rock.`);
        dropTimed(player, item.id, obj.x, obj.y, 8);
        await mes(player, `A barely visible ${gemName} becomes clear again, spinning above the rock.`, 2);
        player.message('And then fades again...');
        return;
    }

    if (slot === -1 || holds(player, ITEM.BOOKING_OF_BINDING)) {
        player.message('You carefully move the gem closer to the rock.');
        player.message('but nothing happens...');
        return;
    }

    take(player, item.id);
    player.message('You carefully move the gem closer to the rock.');
    player.message(`The ${gemName} glows and starts spinning as it hovers above the rock.`);
    dropTimed(player, item.id, obj.x, obj.y, 8);
    cacheSet(player, `legends_attach_${slot}`, 1);

    if ([1, 2, 3, 4, 5, 6, 7].every((n) => cacheHas(player, `legends_attach_${n}`))) {
        await mes(player, 'Suddenly all the crystals begin to glow very brightly.', 2);
        await mes(player, 'The room is lit up with the bright light...', 2);
        await mes(player, 'Soon, the light from all the crystals converges into a point.', 2);
        await mes(player, 'And you see a strange book appear where the light is focused.', 2);
        await mes(player, 'You pick the book up and place it in your inventory.', 2);
        await mes(player, 'All the crystals disapear...and the light fades...', 2);
        give(player, ITEM.BOOKING_OF_BINDING);

        for (let i = 0; i < 8; i += 1) {
            cacheDel(player, `legends_attach_${i}`);
        }
    }
}

// onTakeObj: the seven gems above the rocks cannot be picked up, except the one just placed
async function onGroundItemTake(player, groundItem) {
    const slot = GEM_SLOT[groundItem.id];
    const rock = slot && CARVED.get(`${groundItem.x},${groundItem.y}`);

    if (!rock || rock.gem !== groundItem.id) {
        return false;
    }

    if (cacheInt(player, `legends_attach_${slot}`) === 1) {
        player.message(`You take the ${GEM_NAMES[groundItem.id]}.`);
        player.world.removeEntity('groundItems', groundItem);
        give(player, groundItem.id);
        cacheDel(player, `legends_attach_${slot}`);
    }

    return true;
}

// ---- the totem poles -------------------------------------------------------------------------------------------------------------

async function awe(player) {
    await mes(player, 'This totem pole is truly awe inspiring.', 2);
    await mes(player, 'It depicts powerful Karamja jungle animals.', 2);
    await mes(player, 'It is very well carved and brings a sense of power ', 2);
    await mes(player, 'and spiritual fullfilment to anyone who looks at it.', 2);
}

async function corrupted(player) {
    await mes(player, 'This totem pole looks very corrupted,', 2);
    await mes(player, 'there is a darkness about it that seems quite unnatural.', 2);
    await mes(player, "You don't like to look at it for too long.", 2);
}

async function replaceTotemPole(player, obj, calledGujuo) {
    if (!holds(player, ITEM.TOTEM_POLE)) {
        player.message('I shall replace it with the Totem pole');
        return;
    }

    if (stageOf(player) === 9) {
        player.questStages.legendsQuest = 10;
    }

    swapObject(player, obj, OBJECT.TOTEM_POLE_RED, 16);
    take(player, ITEM.TOTEM_POLE);
    await mes(player, 'You remove the evil totem pole.', 3);
    await mes(player, 'And replace it with the one you carved yourself.', 3);
    await mes(player, 'As you do so, you feel a lightness in the air,', 3);
    player.message('almost as if the Kharazi jungle were sighing.');
    player.message('Perhaps Gujuo would like to see the totem pole.');

    if (calledGujuo) {
        const gujuo = spawnNpc(player, NPC.GUJUO, player.x, player.y, 150000);

        if (gujuo) {
            player.engage(gujuo);

            try {
                await gujuoTalk(player, gujuo);
            } finally {
                player.disengage();
            }
        }
    }
}

async function totemPole(player, obj) {
    const stage = stageOf(player);

    if (obj.id === OBJECT.TOTEM_POLE) {
        if (stage >= 10 || stage === -1) {
            swapObject(player, obj, OBJECT.TOTEM_POLE_RED, 16);
            await awe(player);
            return;
        }

        if (stage === 9) {
            await replaceTotemPole(player, obj, false);
            return;
        }
    } else {
        if (stage >= 10 || stage === -1) {
            await awe(player);
            return;
        }

        if (stage === 9) {
            await replaceTotemPole(player, obj, false);
            return;
        }

        changeObject(player, obj, OBJECT.TOTEM_POLE);
    }

    await corrupted(player);
}

async function useTotemPoleOnPole(player, obj) {
    const stage = stageOf(player);

    if (stage >= 10 || stage === -1) {
        await mes(player, 'You have already replaced the evil totem pole with your own.', 3);
        await mes(player, 'You feel a great sense of accomplishment', 3);
        return;
    }

    if (stage === 9) {
        await replaceTotemPole(player, obj, true);
        return;
    }

    if (stage === 8) {
        if (cacheHas(player, 'killed_viyeldi') && !cacheHas(player, 'viyeldi_companions')) {
            cacheSet(player, 'viyeldi_companions', 1);
        }

        await mes(player, 'You attempt to replace the evil totem pole.', 3);
        await mes(player, 'A black cloud emanates from the evil totem pole.', 3);
        player.message('It slowly forms into the dread demon Nezikchened...');
        await demonFight(player);
        return;
    }

    player.message('Nothing interesting happens');
}

// ---- the Yommi tree ----------------------------------------------------------------------------------------------------------------

async function plantSeed(player, obj) {
    if (stageOf(player) !== 8 || !holds(player, ITEM.BLESSED_GOLDEN_BOWL_WITH_PURE_WATER)) {
        player.message("You'll need some sacred water to feed ");
        player.message('the tree when it starts growing.');
        return;
    }

    if (!holds(player, ITEM.RUNE_AXE)) {
        player.message("You'll need a very tough, very sharp axe to");
        player.message('fell the tree once it is grown.');
        return;
    }

    if (level(player, 'woodcutting') < 50) {
        player.message('You need an woodcut level of 50 to');
        player.message('fell the tree once it is grown.');
        return;
    }

    if (level(player, 'herblaw') < 45) {
        player.message('You need a herblaw skill of at least 45 to complete this task.');
        return;
    }

    take(player, ITEM.GERMINATED_YOMMI_TREE_SEED);

    if (random(0, 1) === 1) {
        player.message('You planted the seed incorrectly, it withers and dies.');
        return;
    }

    const { x, y } = obj;
    const baby = changeObject(player, obj, OBJECT.BABY_YOMMI_TREE);

    await mes(player, 'You bury the Germinated Yommi tree seed in the fertile earth...', 2);
    await mes(player, 'You start to see something growing.', 2);
    changeObject(player, baby, OBJECT.YOMMI_TREE);
    player.world.setTickTimeout(() => {
        const tree = objectAt(player.world, OBJECT.YOMMI_TREE, x, y);

        if (tree) {
            ownedReplace(player, tree, OBJECT.DEAD_YOMMI_TREE, player.username);

            if (player.loggedIn !== false) {
                player.message('The Sapling dies.');
            }

            revertLater(player, x, y, OBJECT.DEAD_YOMMI_TREE, OBJECT.FERTILE_EARTH, YOMMI_TREE_REVERT_TICKS);
        }
    }, YOMMI_TREE_GROW_TICKS);
    player.message('The plant grows at a remarkable rate.');
    player.message('It looks as if the tree needs to be watered...');
}

async function waterTree(player, obj) {
    const { x, y } = obj;

    take(player, ITEM.BLESSED_GOLDEN_BOWL_WITH_PURE_WATER);
    give(player, ITEM.BLESSED_GOLDEN_BOWL);
    bubble(player, x, y);
    await mes(player, 'You water the Yommi tree from the golden bowl...', 2);
    await mes(player, 'It grows at a remarkable rate.', 2);
    ownedReplace(player, obj, OBJECT.GROWN_YOMMI_TREE, player.username);
    player.world.setTickTimeout(() => {
        const tree = objectAt(player.world, OBJECT.GROWN_YOMMI_TREE, x, y);

        if (tree) {
            ownedReplace(player, tree, OBJECT.ROTTEN_YOMMI_TREE, player.username);

            if (player.loggedIn !== false) {
                player.message("The Yommi tree is past it's prime and dies .");
            }

            revertLater(player, x, y, OBJECT.ROTTEN_YOMMI_TREE, OBJECT.FERTILE_EARTH, YOMMI_TREE_REVERT_TICKS);
        }
    }, YOMMI_TREE_GROW_TICKS);
    await mes(player, 'Soon the tree stops growing...', 2);
    await mes(player, 'It looks tall enough now to make a good totem pole.', 2);
}

async function axeOnTree(player, obj) {
    const { x, y } = obj;

    if (obj.id === OBJECT.DEAD_YOMMI_TREE || obj.id === OBJECT.ROTTEN_YOMMI_TREE) {
        await mes(player, 'You chop the dead Yommi Tree down.', 1);
        await mes(player, 'You gain some logs..', 2);
        changeObject(player, obj, OBJECT.FERTILE_EARTH);
        give(player, ITEM.LOGS);
        return;
    }

    if (!isOwner(player, obj)) {
        player.message('This is not your Yommi Tree.');
        return;
    }

    if (obj.id === OBJECT.GROWN_YOMMI_TREE) {
        await mes(player, 'You wield the Rune Axe and prepare to chop the Yommi tree.', 2);
        ownedReplace(player, obj, OBJECT.CHOPPED_YOMMI_TREE, player.username);
        revertLater(player, x, y, OBJECT.CHOPPED_YOMMI_TREE, OBJECT.FERTILE_EARTH, YOMMI_TREE_REVERT_TICKS);
        await mes(player, 'You chop the Yommi tree down.', 2);
        await mes(player, 'Perhaps you should trim those branches ?', 2);
    } else if (obj.id === OBJECT.CHOPPED_YOMMI_TREE) {
        await mes(player, 'You professionally wield your Rune Axe...', 2);
        await mes(player, 'As you trim the branches from the Yommi tree.', 2);
        ownedReplace(player, obj, OBJECT.TRIMMED_YOMMI_TREE, player.username);
        revertLater(player, x, y, OBJECT.TRIMMED_YOMMI_TREE, OBJECT.FERTILE_EARTH, YOMMI_TREE_REVERT_TICKS);
    } else if (obj.id === OBJECT.TRIMMED_YOMMI_TREE) {
        await mes(player, 'You craft a totem pole out of the Yommi tree.', 2);
        ownedReplace(player, obj, OBJECT.CRAFTED_TOTEM_POLE, player.username);
        revertLater(player, x, y, OBJECT.CRAFTED_TOTEM_POLE, OBJECT.FERTILE_EARTH, YOMMI_TREE_REVERT_TICKS);
    }
}

async function liftTotemPole(player, obj) {
    if (!isOwner(player, obj)) {
        player.message('This is not your totem pole to carry.');
        return;
    }

    await mes(player, 'This totem pole looks very heavy...', 2);
    changeObject(player, obj, OBJECT.FERTILE_EARTH);
    give(player, ITEM.TOTEM_POLE);
    cacheSet(player, 'crafted_totem_pole');
    player.message('Carrying this totem pole saps your strength...');
    setLevel(player, 'strength', Math.trunc(level(player, 'strength') * 0.9));
}

// ---- the plain searches --------------------------------------------------------------------------------------------------------------

async function searchFor(player, id, searchMessage, foundLines, emptyMessage = 'You cannot find anything else in here.', ticksBefore = 2) {
    player.message(searchMessage);

    if (holds(player, id)) {
        player.message(emptyMessage);
        return;
    }

    await delay(player, ticksBefore);
    give(player, id);

    for (const line of foundLines) {
        await mes(player, line, 2);
    }
}

// ---- the main dispatcher (LegendsQuestGameObjects.onOpLoc) ------------------------------------------------------------------------

async function opLoc(player, obj, command) {
    switch (obj.id) {
        case OBJECT.ECHNED_ZEKIN_ROCK: {
            if (stageOf(player) === 8) {
                await mes(player, 'The rock moves quite easily.', 2);
                player.message('And the spirit of Echned Zekin seems to have disapeared.');
                swapObject(player, obj, OBJECT.SHALLOW_WATER, Math.ceil(10000 / TICK_MS));
                return true;
            }

            let echned = nearNpc(player, NPC.ECHNED_ZEKIN, 2);

            if (!echned) {
                await mes(player, 'A thick, green mist seems to emanate from the water...', 2);
                await mes(player, 'It slowly congeals into the shape of a body...', 2);
                echned = spawnNpc(player, NPC.ECHNED_ZEKIN, player.x, player.y, 180000);

                if (echned) {
                    await delay(player, 2);
                    await mes(player, 'Which slowly floats towards you.', 2);
                    await echnedTalk(player, echned);
                }

                return true;
            }

            await echnedTalk(player, echned);
            return true;
        }
        case OBJECT.CAVERNOUS_OPENING:
            if (command === 'enter') {
                if (player.y >= 3733) {
                    player.message('You enter the dark cave...');
                    player.teleport(395, 3725);
                } else if (cacheHas(player, 'cavernous_opening') || stageOf(player) === -1) {
                    await mes(player, 'You walk carefully into the darkness of the cavern..', 2);
                    player.teleport(395, 3733);
                } else {
                    await mes(player, 'You walk into an invisible barrier...', 2);
                    await mes(player, 'Somekind of magical force will not allow you to pass into the cavern.', 1);
                }
            } else if (command === 'search') {
                if (cacheHas(player, 'cavernous_opening')) {
                    await mes(player, 'You can see a glowing crystal shape in the wall.', 2);
                    await mes(player, 'It looks like the Crystal is magical, ', 2);
                    await mes(player, 'it allows access to the cavern.', 2);
                } else {
                    await mes(player, 'You see a heart shaped depression in the wall next to the cavern.', 2);
                    await mes(player, 'And a message reads...', 2);
                    await mes(player, "@gre@All ye who stand 'ere the dragons teeth,", 2);
                    await mes(player, '@gre@Place your full true heart and proceed...', 1);
                }
            } else {
                return false;
            }

            return true;
        case OBJECT.ANCIENT_LAVA_FURNACE:
            if (command === 'look') {
                await mes(player, 'This is an ancient looking furnace.', 1);
            } else if (command === 'search') {
                await mes(player, 'You search the lava furnace.', 2);
                await mes(player, 'You find a small compartment that you may be able to use.', 2);
                await mes(player, 'Strangely, it looks as if it is designed for a specific purpose...', 2);
                await mes(player, 'to fuse things together at very high temperatures...', 1);
            } else {
                return false;
            }

            return true;
        case OBJECT.RED_EYE_ROCK:
            await mes(player, 'These rocks look somehow manufactured..', 1);
            return true;
        case OBJECT.ROPE_UP:
            if (command === 'examine') {
                return false;
            }

            player.message('You climb the rope back out again.');
            player.teleport(471, 3707);
            return true;
        case OBJECT.WOODEN_BEAM_ROPE:
            if (command === 'examine') {
                return false;
            }

            await ropeDown(player);
            return true;
        case OBJECT.WOODEN_BEAM:
            player.message('You search the wooden beam...');

            if (cacheHas(player, 'legends_wooden_beam')) {
                player.message('You search the wooden beam and find the rope you attached.');
                swapObject(player, obj, OBJECT.WOODEN_BEAM_ROPE, 8);
            } else {
                await mes(player, 'You see nothing special about this...', 2);
                player.message('Perhaps if you had a rope, it might be more functional.');
            }

            return true;
        case OBJECT.CARVED_ROCK:
            await carvedRockSearch(player, obj);
            return true;
        case OBJECT.HALF_BURIED_REMAINS:
            await mes(player, 'It looks as if some poor unfortunate soul died here.', 3);
            return true;
        case OBJECT.HEAVY_METAL_GATE:
            return heavyMetalGate(player, obj, command);
        case OBJECT.SMASH_BOULDERS[0]:
        case OBJECT.SMASH_BOULDERS[1]:
        case OBJECT.SMASH_BOULDERS[2]:
            if (command === 'walkto') {
                return false;
            }

            await smashBoulder(player, obj);
            return true;
        case OBJECT.CRUDE_DESK:
            await mes(player, 'You search the desk ...', 2);

            if (holds(player, ITEM.SHAMANS_TOME)) {
                player.message('...but find nothing.');
            } else {
                give(player, ITEM.SHAMANS_TOME);
                player.message('You find a book...it looks like an ancient tome...');
            }

            return true;
        case OBJECT.BOOKCASE:
            await mes(player, 'You search the bookcase...', 2);
            await mes(player, 'And find a large gaping hole at the back.', 2);
            player.message('Would you like to climb through the hole?');

            if ((await player.ask(["Yes, I'll climb through the hole.", "No, I'll stay here."])) === 0) {
                await mes(player, 'You climb through the hole in the wall..', 2);
                await mes(player, "It's very narrow and you have to contort your body a lot.", 2);
                await mes(player, 'After some time, you  manage to wriggle out of a small cavern...', 2);
                player.teleport(444, 3699);
            } else {
                player.message('You decide to stay where you are.');
            }

            return true;
        case OBJECT.TABLE:
            await searchFor(player, ITEM.SCRAWLED_NOTES, 'You start searching the table...', ['You find a scrap of paper with nonesense written on it.']);
            return true;
        case OBJECT.CRUDE_BED:
            if (command !== 'search') {
                return false;
            }

            await searchFor(player, ITEM.SCATCHED_NOTES, 'You search the flea infested rags..', ['You find a scrap of paper with spidery writing on it.']);
            return true;
        case OBJECT.CRATE:
            player.message('You search the crate.');

            if (holds(player, ITEM.SCRIBBLED_NOTES)) {
                player.message('You cannot find anything else in here.');
            } else {
                await delay(player, 2);
                give(player, ITEM.SCRIBBLED_NOTES);
                await mes(player, 'After some time you find a scrumpled up piece of paper.', 2);
                player.message('It looks like rubbish...');
            }

            return true;
        case OBJECT.SHALLOW_WATER: {
            const stage = stageOf(player);

            if (stage === 8 && player.y >= 3723 && player.y <= 3740) {
                player.message('A magical looking pool.');
            } else if (stage >= 5 || stage === -1) {
                player.message('A disgusting sess pit of filth and stench...');
            } else {
                await mes(player, 'A bubbling brook with effervescent water...', 1);
            }

            return true;
        }
        case OBJECT.TALL_REEDS:
            await mes(player, 'These tall reeds look nice and long, ', 2);
            await mes(player, 'with a long tube for a stem.', 2);
            await mes(player, 'They reach all the way down to the water.', 1);
            return true;
        case OBJECT.ROCK:
            await crevice(player);
            return true;
        case OBJECT.TOTEM_POLE:
        case OBJECT.TOTEM_POLE_RED:
            if (command === 'examine') {
                return false;
            }

            await totemPole(player, obj);
            return true;
        case OBJECT.GRAND_VIZIERS_DESK:
            if (command === 'walkto') {
                return false;
            }

            player.message('You rap loudly on the desk.');
            {
                const radimus = nearNpc(player, NPC.SIR_RADIMUS_ERKLE_HOUSE, 6);

                if (radimus) {
                    moveNpc(radimus, 517, 545);
                    player.engage(radimus);

                    try {
                        await require('./radimus').onTalkToNPC(player, radimus);
                    } finally {
                        player.disengage();
                    }
                } else {
                    player.message('Sir Radimus Erkle is currently busy at the moment.');
                }
            }

            return true;
        case OBJECT.LEGENDS_CUPBOARD:
            if (command === 'examine') {
                return false;
            }

            if (stageOf(player) >= 1 || stageOf(player) === -1) {
                if (holds(player, ITEM.MACHETTE)) {
                    player.message('The cupboard is empty.');
                } else {
                    await mes(player, 'You open the cupboard and find a machette.', 2);
                    await mes(player, 'You take it out and add it to your inventory.', 2);
                    give(player, ITEM.MACHETTE);
                }
            } else {
                player.message('@gre@Sir Radimus Erkle: You\'re not authorised to open that cupboard.');
            }

            return true;
        case OBJECT.CRAFTED_TOTEM_POLE:
            if (command === 'examine') {
                return false;
            }

            await liftTotemPole(player, obj);
            return true;
        default:
            return false;
    }
}

async function ropeDown(player) {
    if (stageOf(player) >= 9 || postQuestLocked(player)) {
        await mes(player, "The rope snaps as you're about to climb down it.", 2);
        await mes(player, 'Perhaps you need a new rope.', 2);
        return;
    }

    await mes(player, 'This rope climb looks pretty dangerous,', 2);
    await mes(player, 'Are you sure you want to go down?', 2);

    const menu = await player.ask(["Yes,I'll go down the rope...", 'No way do I want to go down there.']);

    if (menu === 1) {
        player.message('You decide not to go down the rope.');
        return;
    }

    await mes(player, 'You prepare to climb down the rope...', 2);
    await player.say('! Gulp !');
    await delay(player, 2);

    if ((stageOf(player) >= 0 && !cacheHas(player, 'gujuo_potion')) || postQuestLocked(player)) {
        await mes(player, '...but a terrible fear grips you...', 2);
        player.message('And you can go no further.');
        return;
    }

    if (random(0, 4) === 0) {
        await mes(player, 'but fear stabs at your heart...', 2);
        await mes(player, 'and you lose concentration,', 2);
        await mes(player, 'you slip and fall....', 2);
        hurt(player, random(10, 15));
    } else {
        await mes(player, 'And although fear stabs at your heart...', 2);
        await mes(player, 'You shimmey down the rope...', 2);
    }

    player.teleport(426, 3707);
}

async function heavyMetalGate(player, obj, command) {
    if (command === 'look') {
        await mes(player, 'This huge metal gate bars the way further...', 2);
        await mes(player, 'There is an intense and unpleasant feeling from this place.', 2);
        player.message('And you can see why, shadowy flying creatures seem to hover in the still dark air.');
        return true;
    }

    if (command !== 'push') {
        return false;
    }

    await mes(player, 'You push the gates...they\'re very stiff...', 2);
    await mes(player, "They won't budge with a normal push.", 2);
    await mes(player, 'Do you want to try to force them open with brute strength?', 2);

    const menu = await player.ask(["Yes, I'm very strong, I'll force them open.", "No, I'm having second thoughts."]);

    if (menu === 1) {
        player.message('You decide against forcing the gates.');
        return true;
    }

    if (level(player, 'strength') < 50) {
        player.message('You need a Strength of at least 50 to affect these gates.');
        return true;
    }

    await mes(player, 'You ripple your muscles...preparing too exert yourself...', 2);
    await player.say('Hup!');
    await mes(player, 'You brace yourself against the doors...', 2);
    await player.say('Urghhhhh!');
    await mes(player, 'You start to force against the gate..', 2);
    await player.say('Arghhhhhhh!');
    await mes(player, 'You push and push,', 2);
    await player.say('Shhhhhhhshshehshsh');

    if (failCalculation(player, 'strength', 50)) {
        await mes(player, 'You just manage to force the gates open slightly, ', 2);
        await mes(player, 'just enough to force yourself through.', 2);
        swapObject(player, obj, OBJECT.GATE_OPEN, 3);
        player.teleport(441, player.y <= 3717 ? 3719 : 3717);
    } else {
        await mes(player, "but run out of steam before you're able to force the gates open.", 2);
        player.message('The effort of trying to force the gates reduces your strength temporarily');
        decrementLevel(player, 'strength');
    }

    return true;
}

// the boulders each give way to a swing of a pickaxe and let the player through to the next ledge
const BOULDER_CROSSINGS = {
    1117: [[(p) => p.y <= 3704, [441, 3707]], [(p) => p.y >= 3707, [442, 3704]]],
    1184: [[(p) => p.y <= 3708, [441, 3711]], [(p) => p.y >= 3711, [441, 3708]]],
    1185: [[(p) => p.y <= 3712, [441, 3715]], [(p) => p.y >= 3715, [441, 3712]]]
};

async function smashBoulder(player, obj) {
    if (!PICKAXE_IDS.some((id) => holds(player, id))) {
        await mes(player, "You'll need a pickaxe to smash your way through these boulders.", 3);
        return;
    }

    if (level(player, 'mining') < 52) {
        if (player.y < 3707) {
            player.message('You need a mining ability of at least 52 to affect these boulders.');
            return;
        }

        await mes(player, 'You could be stuck here for ages until your mining ability returns.', 3);
        await mes(player, 'Would you like to try to climb out?', 3);
        await mes(player, "It looks rough going, but at least you won't be stuck here for ages.", 3);

        if ((await player.ask(["Yes, I'll climb out.", "No, I'll stay here a while."])) === 0) {
            while (player.y > 3707) {
                hurt(player, 2);
                player.teleport(player.x, player.y - 3);
                await delay(player, 3);
            }

            hurt(player, 1);
            player.teleport(442, 3703);
        } else {
            await mes(player, 'You decide to stay where you are.', 3);
        }
    }

    if (failCalculation(player, 'mining', 50)) {
        await mes(player, 'You take a good swing at the rock with your pick...', 2);
        swapObject(player, obj, OBJECT.ROCKS_SMASHED, 3);

        for (const [test, to] of BOULDER_CROSSINGS[obj.id]) {
            if (test(player)) {
                player.teleport(...to);
                break;
            }
        }

        await mes(player, '...and smash it into smaller pieces.', 3);
        player.message('Another large rock falls down replacing the one that you smashed.');
    } else {
        player.message('You fail to make a mark on the rocks.');
        player.message('You miss hit the rock and the vibration shakes your bones.');
        player.message('Your mining ability suffers...');
        decrementLevel(player, 'mining');
    }
}

async function crevice(player) {
    const stage = stageOf(player);

    if (!(cacheHas(player, 'legends_cavern') || stage >= 2 || stage === -1)) {
        player.message('You see nothing significant.');
        return;
    }

    if (stage === 1) {
        await mes(player, 'You see nothing significant...', 2);
        await mes(player, 'At first....', 2);
    }

    await mes(player, 'You see that there is a small crevice that you may be able to crawl though.?', 2);
    await mes(player, 'Would you like to try to crawl through, it looks quite an enclosed area.', 2);

    const menu = await player.ask(["Yes, I'll crawl through, I'm very athletic.", "No, I'm pretty scared of enclosed areas."]);

    if (menu === 1) {
        await mes(player, 'You decide against forcing yourself into the tiny crevice..', 2);
        await mes(player, 'And realise that you have much better things to do..', 2);
        await mes(player, "Like visit Inn's and mine ore...", 2);
        return;
    }

    if (level(player, 'agility') < 50) {
        player.message('You need an agility of 50 to even attempt this.');
        return;
    }

    await mes(player, 'You try to crawl through...', 2);
    await mes(player, 'You contort your body to fit the crevice.', 2);

    if (failCalculation(player, 'agility', 50)) {
        await mes(player, 'You adroitely squeeze serpent like into the crevice.', 2);
        await mes(player, 'You find a small narrow tunnel that goes for some distance.', 2);
        await mes(player, 'After some time, you find a small cave opening...and walk through.', 2);
        player.teleport(461, 3700);

        if (cacheHas(player, 'legends_cavern')) {
            cacheDel(player, 'legends_cavern');
            player.questStages.legendsQuest = 2;
        }
    } else {
        await mes(player, 'You get cramped into a tiny space and start to suffocate.', 5);
        await mes(player, 'You wriggle and wriggle but you cannot get out..', 5);
        await mes(player, 'Eventually you manage to break free.', 2);
        await mes(player, 'But you scrape yourself very badly as your force your way out.', 2);
        await mes(player, "And you're totally exhausted from the experience.", 2);
        hurt(player, 5);
    }
}

// ---- the commands -----------------------------------------------------------------------------------------------------------------

async function command(player, obj, command) {
    if (STAIRS_BY_ID[obj.id]) {
        if (command === 'examine') {
            return false;
        }

        await rockHewnStairs(player, obj);
        return true;
    }

    if ([558, 559, 560, 561].includes(obj.id)) {
        if (command === 'examine') {
            return false;
        }

        await rockyWalkway(player, obj);
        return true;
    }

    if (obj.id === OBJECT.DARK_METAL_GATE) {
        await darkMetalGate(player, obj, command);
        return true;
    }

    return opLoc(player, obj, command);
}

async function onGameObjectCommandOne(player, obj) {
    return command(player, obj, commandOf(obj, 0));
}

async function onGameObjectCommandTwo(player, obj) {
    return command(player, obj, commandOf(obj, 1));
}

// ---- items used on the objects ---------------------------------------------------------------------------------------------------

async function onUseWithGameObject(player, obj, item) {
    const id = item.id;

    if (obj.id === OBJECT.TOTEM_POLE && id === ITEM.TOTEM_POLE) {
        await useTotemPoleOnPole(player, obj);
        return true;
    }

    if (
        [OBJECT.TRIMMED_YOMMI_TREE, OBJECT.CHOPPED_YOMMI_TREE, OBJECT.GROWN_YOMMI_TREE, OBJECT.DEAD_YOMMI_TREE, OBJECT.ROTTEN_YOMMI_TREE].includes(obj.id) &&
        id === ITEM.RUNE_AXE
    ) {
        await axeOnTree(player, obj);
        return true;
    }

    if (obj.id === OBJECT.YOMMI_TREE && id === ITEM.BLESSED_GOLDEN_BOWL_WITH_PURE_WATER) {
        await waterTree(player, obj);
        return true;
    }

    if (obj.id === OBJECT.FERTILE_EARTH && id === ITEM.YOMMI_TREE_SEED) {
        player.message('These seeds need to be germinated in pure water before they');
        player.message('can be planted in the fertile soil.');
        return true;
    }

    if (obj.id === OBJECT.FERTILE_EARTH && id === ITEM.GERMINATED_YOMMI_TREE_SEED) {
        await plantSeed(player, obj);
        return true;
    }

    if (obj.id === OBJECT.CAVERNOUS_OPENING && id === ITEM.A_GLOWING_RED_CRYSTAL) {
        await mes(player, 'You carefully place the glowing heart shaped crystal into ', 2);
        await mes(player, 'the depression, it slots in perfectly and glows even brighter.', 2);
        await mes(player, 'You hear a snapping sound coming from in front of the cave.', 2);
        take(player, id);
        cacheSet(player, 'cavernous_opening');
        return true;
    }

    if (obj.id === OBJECT.RED_EYE_ROCK && id === ITEM.A_RED_CRYSTAL) {
        await mes(player, 'You carefully place the Dragon Crystal on the rock.', 2);
        await mes(player, 'The rocks seem to vibrate and hum and the crystal starts to glow.', 2);
        player.message('The vibration in the area diminishes, but the crystal continues to glow.');
        take(player, ITEM.A_RED_CRYSTAL);
        give(player, ITEM.A_GLOWING_RED_CRYSTAL);
        return true;
    }

    if (obj.id === OBJECT.ANCIENT_LAVA_FURNACE) {
        await useOnFurnace(player, id);
        return true;
    }

    if (obj.id === OBJECT.WOODEN_BEAM && id === ITEM.ROPE) {
        player.message('You throw one end of the rope around the beam.');
        take(player, ITEM.ROPE);
        swapObject(player, obj, OBJECT.WOODEN_BEAM_ROPE, 8);
        cacheSet(player, 'legends_wooden_beam');
        return true;
    }

    if (obj.id === OBJECT.CARVED_ROCK) {
        if (GEM_SLOT[id]) {
            await useGemOnCarvedRock(player, obj, item);
        } else {
            player.message('Nothing interesting happens');
        }

        return true;
    }

    if (obj.id === OBJECT.TALL_REEDS && id === ITEM.MACHETTE) {
        give(player, ITEM.CUT_REED_PLANT);
        await mes(player, 'You use your machette to cut down a tall reed.', 2);
        await mes(player, 'You cut it into a length of pipe.', 2);
        return true;
    }

    if (obj.id === OBJECT.SHALLOW_WATER && id === ITEM.BLESSED_GOLDEN_BOWL) {
        if (stageOf(player) === 8 && player.y >= 3723 && player.y <= 3740) {
            player.message('You fill the bowl up with water..');
            take(player, ITEM.BLESSED_GOLDEN_BOWL);
            give(player, ITEM.BLESSED_GOLDEN_BOWL_WITH_PURE_WATER);
            return true;
        }

        await mes(player, 'The water is awkward to get to...', 2);
        await mes(player, 'The gap to the water is too narrow.', 2);
        return true;
    }

    if (obj.id === OBJECT.SHALLOW_WATER && id === ITEM.CUT_REED_PLANT) {
        await reedOnWater(player);
        return true;
    }

    return false;
}

async function useOnFurnace(player, id) {
    const keys = {
        [ITEM.A_CHUNK_OF_CRYSTAL]: 'a_chunk_of_crystal',
        [ITEM.A_LUMP_OF_CRYSTAL]: 'a_lump_of_crystal',
        [ITEM.A_HUNK_OF_CRYSTAL]: 'a_hunk_of_crystal'
    };
    const key = keys[id];

    if (!key) {
        player.message('Nothing interesting happens');
        return;
    }

    if (level(player, 'crafting') < 50) {
        player.message('You need a crafting ability of at least 50 to perform this task.');
        return;
    }

    if (!cacheHas(player, key)) {
        cacheSet(player, key);
        take(player, id);
        await mes(player, 'You carefully place the piece of crystal into ', 2);
        await mes(player, 'a specially shaped compartment in the furnace.', 2);
    }

    if (Object.values(keys).every((k) => cacheHas(player, k))) {
        await mes(player, 'You place the final segment of the crystal together into the ', 2);
        await mes(player, 'strangely shaped compartment, all the pieces seem to fit...', 2);
        await mes(player, 'You use your crafting skill to control the furnace.', 2);
        await mes(player, 'The heat in the furnace slowly rises and soon fuses the parts together...', 2);
        await mes(player, 'As soon as the item cools, you pick it up...', 2);
        await mes(player, 'As the crystal touches your hands a voice inside of your head says..', 2);
        await mes(player, '@gre@Voice in head: Bring life to the dragons eye.', 2);
        Object.values(keys).forEach((k) => cacheDel(player, k));
        give(player, ITEM.A_RED_CRYSTAL);
    } else {
        await mes(player, "The compartment in the furnace isn't full yet.", 2);
        await mes(player, 'It looks like you need more pieces of crystal.', 1);
    }
}

async function reedOnWater(player) {
    const stage = stageOf(player);

    if (stage === 5 || stage === 6 || stage === 7) {
        await mes(player, 'It looks as if this pool has dried up...', 2);
        await mes(player, 'A thick black sludge has replaced the sparkling pure water...', 2);
        await mes(player, 'There is a disgusting stench of death that emanates from this area...', 2);
        await mes(player, 'Maybe Gujuo knows what\'s happened...', 2);

        if (stage === 5) {
            player.questStages.legendsQuest = 6;
        }

        return;
    }

    if ((stage >= 9 || stage === -1) && !LOOSE_SHALLOW_WATER_CHECK) {
        await mes(player, 'You use the cut reed plant to syphon some water from the pool.', 2);
        await mes(player, 'You take a refreshing drink from the pool.', 2);
        await mes(player, 'The cut reed is soaked through with water and is now all soggy.', 2);
        return;
    }

    const found = REFILLABLE.findIndex((id) => holds(player, id));

    if (found === -1) {
        await mes(player, 'You start to syphon some water up the tube...', 2);
        await mes(player, 'But you have nothing to put the water in.', 1);
        return;
    }

    const emptyID = REFILLABLE[found];
    const refilledID = REFILLED[found];

    await mes(player, 'You use the cut reed plant to syphon some water from the pool.', 2);

    if (emptyID === ITEM.GOLDEN_BOWL) {
        await mes(player, 'into your gold bowl.', 2);
        take(player, ITEM.GOLDEN_BOWL);
        give(player, ITEM.GOLDEN_BOWL_WITH_PURE_WATER);
        await mes(player, "The water doesn't seem to sparkle as much as it did in the pool.", 2);
    } else if (emptyID === ITEM.BLESSED_GOLDEN_BOWL) {
        await mes(player, 'into your blessed gold bowl.', 2);
        take(player, ITEM.BLESSED_GOLDEN_BOWL);
        give(player, ITEM.BLESSED_GOLDEN_BOWL_WITH_PURE_WATER);
        await mes(player, 'The water seems to bubble and sparkle as if alive.', 2);
    } else {
        const names = { 21: 'bucket', 140: 'jug', 341: 'bowl', 465: 'vial' };

        await mes(player, `You put some water in the ${names[emptyID]}.`, 2);
        take(player, emptyID);
        give(player, refilledID);
    }

    take(player, ITEM.CUT_REED_PLANT);
    await mes(player, 'The cut reed is soaked through with water and is now all soggy.', 1);
}

module.exports = {
    onGameObjectCommandOne,
    onGameObjectCommandTwo,
    onUseWithGameObject,
    onCastOnGameObject,
    onGroundItemTake,
    spawnFor
};
