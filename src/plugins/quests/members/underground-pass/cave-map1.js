// Ported from Open-RSC Core-Framework authentic/quests/members/undergroundpass/obstacles/UndergroundPassObstaclesMap1.java and
// mechanism/UndergroundPassMechanismMap1.java (AGPL-3.0): the first cave (x 672-720, y 3409-3470): the carved rocks, the climb
// over the rocks and ledges, the swamps, the trapped rocks, the mud pile, the bridge shot down with a lit arrow (stage 2 -> 3), the
// stalactites, the rocks thrown onto the swamps. The lever (733), the drop-down ledge (812) and the
// puzzle levers (801) are fixed-tile rows of game-objects/object-tele-points.js. Stage map: shared.js.

const {
    ITEM,
    OBJECT,
    stageOf,
    setStage,
    mes,
    delay,
    hurt,
    hitsCurrent,
    level,
    give,
    take,
    holds,
    random,
    nextInt,
    agilityCheck,
    commandOf,
    sendBox,
    objectAt,
    swapObject,
    changeObject,
    addTimedObject,
    ibanVoices
} = require('./shared');

const MAIN_ROCKS = [731, 737, 738, 739, 740, 741, 742, 743, 744, 745, 746, 747, 748, 749];
const MAIN_LEDGES = [732, 750, 751, 752, 753];
const FAIL_SWAMP_ROCKS = [756, 757, 758, 759, 760, 762, 763, 764, 765, 766];
const SPEAR_ROCKS = [806, 807, 808, 809, 810, 811, 882, 883];
const STALACTITES = [OBJECT.STALACTITE_1, OBJECT.STALACTITE_2, OBJECT.STALACTITE_3];

const READ_ROCKS = {
    832: '@red@All those who thirst for knowledge%@red@Bow down to the lord.% %@red@All you that crave eternal life%@red@Come and meet your God.% %@red@For no man nor beast can cast a spell%@red@Against the wake of eternal hell.',
    833: '@red@Most men do live in fear of death%@red@That it might steal their soul.% %@red@Some work and pray to shield their life%@red@From the ravages of the cold.% %@red@But only those who embrace the end%@red@Can truly make their life extend.% %@red@And when all hope begins to fade% %@red@look above and use nature as your aid',
    834: "@red@And now our God has given us%@red@One who is from our own.% %@red@A saviour who once sat upon%@red@His father's glorious thrown.% %@red@It is in your name that we will lead the attack Iban%@red@son of Zamorak!",
    835: '@red@Here lies the sacred font%@red@Where the great Iban will bless all his disciples%@red@in the name of evil.% %@red@Here the forces of darkness are so concentrated they rise%@red@when they detect any positive force close by',
    923: "@red@Ibans Shadow% %@red@Then came the hard part: recreating the parts of a man%@red@that cannot be seen or touched: those intangible things%@red@that are life itself. Using all the mystical force that I could%@red@muster, I performed the ancient ritual of Incantia, a spell%@red@so powerful that it nearly stole the life from my frail and%@red@withered body. Opening my eyes again, I saw the three%@red@demons that had been summoned. Standing in a triangle,%@red@their energy was focused on the doll. These demons%@red@would be the keepers of Iban's shadow. Black as night,%@red@their shared spirit would follow his undead body like an%@red@angel of death.",
    922: "% %@red@Crumbling some of the dove's bones onto the doll, I cast%@red@my mind's eye onto Iban's body. My ritual was complete,%@red@soon he would be coming to life. I, Kardia, had resurrected%@red@the legendary Iban, the most powerful evil being ever to%@red@take human form. And I alone knew that the same%@red@process that I had used to create him, was also capable%@red@of destroying him.% %@red@But now I was exhausted. As I closed my eyes to sleep, I%@red@was settled by a strange feeling of contentment%@red@anticipation of the evil that Iban would soon unleash.",
    881: "@red@Leave this battered corpse be% %@red@For now he lives as spirit alone% %@red@Let his flesh rest and become one with the earth% %@red@As it is the soil that shall rise to protect him% %@red@Only as flesh becomes dust, as wood becomes ash...% %@red@..will Iban's corpse embrace nature and finally rest"
};

const ROCK_TEXT_INTRO = ['the writing seems to have been scracthed...', '..into the rock with bare hands, it reads..'];

// Java doRock: climb onto the rock and step down the other side (or slip: damage and, in the second cave, the spikes below)
async function doRock(player, rock, damage, eventMessage, spikeLocation) {
    player.message('you climb onto the rock');

    const fail = !agilityCheck(player);

    if (!fail) {
        const { x: px, y: py } = player;
        const { x, y, id, direction } = rock;
        let to;

        if (direction === 1 || direction === 2 || direction === 4 || direction === 3) {
            if (x === px - 1 && y === py) {
                to = [x - 1, y];
            } else if (x === px + 1 && y === py) {
                to = [x + 1, y];
            } else if (x === px && y === py + 1) {
                to = id === 749 ? [x, y + 1] : [x + 1, y];
            } else if (x === px && y === py - 1) {
                to = id === 749 ? [x, y - 1] : [x + 1, y];
            }
        }

        if (direction === 6) {
            if (x === px && y === py + 1) {
                to = [x, y + 1];
            } else if (x === px && y === py - 1) {
                to = [x, y - 1];
            } else if (x === px - 1 && y === py) {
                to = [x + 1, y + 1];
            } else if (x === px + 1 && y === py) {
                to = [x, y + 1];
            }
        }

        if (direction === 0) {
            if (x === px - 1 && y === py) {
                to = [x - 1, y];
            } else if (x === px + 1 && y === py) {
                to = [x + 1, y];
            } else if (x === px && y === py + 1) {
                to = [x, y + 1];
            } else if (x === px && y === py - 1) {
                to = [x, y - 1];
            }
        }

        if (direction === 7) {
            if (x === px - 1 && y === py) {
                to = [x - 1, y - 1];
            } else if (x === px + 1 && y === py) {
                to = [x + 1, y];
            } else if (x === px && y === py + 1) {
                to = [x, y + 1];
            } else if (x === px && y === py - 1) {
                to = [x + 1, y];
            }
        }

        if (to) {
            player.teleport(...to);
        }

        player.message('and step down the other side');
    } else {
        player.message('but you slip');
        hurt(player, damage);

        const spikes = { 1: [743, 3475], 2: [748, 3482], 3: [738, 3483], 4: [736, 3475], 5: [730, 3478] }[spikeLocation];

        if (spikes) {
            player.teleport(...spikes);
        }

        await player.say('aargh');
    }

    if (eventMessage) {
        ibanVoices(player, 3, 15);
    }
}

// Java doLedge: climb the ledge and drop down on the far side
async function doLedge(player, ledge, damage) {
    player.message('you climb the ledge');

    if (agilityCheck(player)) {
        const { x, y, id, direction } = ledge;

        if (direction === 2 || direction === 6) {
            if (x === player.x - 1 && y === player.y) {
                player.message('and drop down to the cave floor');
                player.teleport(id === 753 ? x - 2 : x - 1, y);
            } else if (x === player.x + 1 && y === player.y) {
                player.message('and drop down to the cave floor');
                player.teleport(id === 753 ? x + 2 : x + 1, y);
            }
        }

        if (direction === 4 || direction === 0) {
            if (x === player.x && y === player.y + 1) {
                player.teleport(x, y + 1);
                player.message('and drop down to the cave floor');
            } else if (x === player.x && y === player.y - 1) {
                player.teleport(x, y - 1);
            }
        }
    } else {
        player.message('but you slip');
        hurt(player, damage);
        await player.say('aargh');
    }
}

// Java UndergroundPassObstaclesMap1.succeed (a thieving check with the quirks kept as written)
function thievingCheck(player, req) {
    let levelDifference = level(player, 'thieving') - req;
    const percent = random(1, 100);

    if (levelDifference < 0) {
        return true;
    }

    if (levelDifference >= 15) {
        levelDifference = 70;
    }

    if (levelDifference >= 20) {
        levelDifference = 80;
    } else {
        levelDifference = 40 + levelDifference;
    }

    return percent <= levelDifference;
}

async function firstSwamp(player) {
    const slipDamage = () => Math.floor(hitsCurrent(player) / 42) + 1;

    await mes(player, "you try to cross but you're unable to");
    await mes(player, 'the swamp seems to cling to your legs');
    player.message('you slowly feel yourself being dragged below');
    await player.say('gulp!');
    player.teleport(674, 3462);
    await player.say('aargh');
    hurt(player, slipDamage());
    await delay(player, 3);

    for (const [x, y] of [[677, 3462], [680, 3465], [682, 3462], [683, 3465], [685, 3464], [687, 3462]]) {
        player.teleport(x, y);
        await delay(player);
    }

    await player.say('aargh');
    hurt(player, slipDamage());
    player.teleport(690, 3461);
    await mes(player, 'you tumble deep into the cravass');
    await mes(player, 'and land battered and bruised at the base');
}

async function clearRocks(player, rocks) {
    if (player.x === 695 && (player.y === 3436 || player.y === 3435)) {
        player.teleport(695, 3435);
        return;
    }

    if (rocks.id === OBJECT.CLEAR_ROCKS_INIT_WEST && player.x > rocks.x && player.y === rocks.y) {
        player.teleport(rocks.x + 1, rocks.y);
    } else if (rocks.id === OBJECT.CLEAR_ROCKS_INIT_EAST && player.x < rocks.x && player.y === rocks.y) {
        player.teleport(rocks.x + 1, rocks.y);
    }

    await mes(player, 'you move the rocks from your path');

    const { x, y } = rocks;

    if (rocks.id !== OBJECT.CLEAR_ROCKS) {
        changeObject(player, rocks, OBJECT.CLEAR_ROCKS);
    }

    player.message('you hear a strange mechanical sound');
    // the cleared rocks look like the trap for 3 seconds
    swapObject(player, objectAt(player.world, OBJECT.CLEAR_ROCKS, x, y) || rocks, OBJECT.CLEAR_ROCKS_TRAP, 5);
    hurt(player, Math.floor(hitsCurrent(player) * 0.2));
    await player.say('aaarrghhh');
    await mes(player, "You've triggered a trap");
}

// the trip wire rocks: step over (the first command) springs the trap, search (the second) can disarm it
async function spearRocks(player, rock, index) {
    const spring = async () => {
        player.teleport(rock.x, rock.y);
        swapObject(player, rock, OBJECT.SPEAR_TRAP, 8);
        hurt(player, Math.floor(hitsCurrent(player) / 6) + 1);
        await player.say('aaarghh');
    };

    if (commandOf(rock, index) === 'step over') {
        await mes(player, 'you step over the rock');
        player.message('you feel a thread tug at your boot');
        player.message("it's a trap");
        await spring();

        return;
    }

    await mes(player, 'you search the rock');
    await mes(player, 'you find a trip wire');
    player.message('do you wish to disarm the trap?');

    const menu = await player.ask(["yes, i'll have a go", 'no chance']);

    if (menu === 0) {
        await mes(player, 'you carefully try and diconnect the trip wire');

        if (thievingCheck(player, 1)) {
            player.message('you manage to delay the trap..');
            player.message('...long enough to cross the rocks');

            if (rock.x === player.x + 1) {
                player.teleport(rock.x + 1, rock.y);
            } else {
                player.teleport(rock.x - 1, rock.y);
            }
        } else {
            player.message('but the trap activates');
            await spring();
        }
    } else if (menu === 1) {
        player.message('you back away from the trap');
    }
}

async function handleObject(player, gameObject, index) {
    const { id } = gameObject;

    if (READ_ROCKS[id]) {
        for (const line of ROCK_TEXT_INTRO) {
            await mes(player, line);
        }

        sendBox(player, READ_ROCKS[id], true);

        return true;
    }

    if (MAIN_ROCKS.includes(id) || FAIL_SWAMP_ROCKS.includes(id)) {
        await doRock(player, gameObject, Math.floor(hitsCurrent(player) / 42) + 1, true, -1);
    } else if (id === OBJECT.FIRST_SWAMP) {
        await firstSwamp(player);
    } else if (id === OBJECT.PILE_OF_MUD_MAP_1) {
        await mes(player, 'you climb up the mud pile');
        player.teleport(685, 3420);
        await mes(player, 'it leads into darkness, the stench is almost unbearable');
        await mes(player, 'you surface by the swamp, covered in muck');
    } else if (MAIN_LEDGES.includes(id)) {
        await doLedge(player, gameObject, Math.floor(hitsCurrent(player) / 42) + 1);
    } else if (id === OBJECT.BLESSED_SPIDER_SWAMP) {
        await mes(player, 'you step in rancid swamp');
        await mes(player, 'it clings to your feet, you cannot cross');
    } else if ([OBJECT.CLEAR_ROCKS, OBJECT.CLEAR_ROCKS_INIT_WEST, OBJECT.CLEAR_ROCKS_INIT_EAST].includes(id)) {
        await clearRocks(player, gameObject);
    } else if (SPEAR_ROCKS.includes(id)) {
        await spearRocks(player, gameObject, index);
    } else {
        return false;
    }

    return true;
}

async function onGameObjectCommandOne(player, gameObject) {
    return handleObject(player, gameObject, 0);
}

async function onGameObjectCommandTwo(player, gameObject) {
    return handleObject(player, gameObject, 1);
}

// ---- mechanism/UndergroundPassMechanismMap1.java -------------------------------------------------------------------------

function isArrows(item) {
    return /arrows/.test(((item.definition && item.definition.name) || '').toLowerCase());
}

function hasABow(player) {
    return player.inventory.items.some((item) => /bow/.test(((item.definition && item.definition.name) || '').toLowerCase()));
}

// the damp cloth round the head of an arrow
async function onUseWithInventory(player, item, target) {
    const cloth = item.id === ITEM.DAMP_CLOTH ? item : target.id === ITEM.DAMP_CLOTH ? target : null;
    const arrow = cloth === item ? target : item;

    if (!cloth || !arrow || !isArrows(arrow)) {
        return false;
    }

    player.message('you wrap the damp cloth around the arrow head');
    take(player, ITEM.DAMP_CLOTH);
    take(player, arrow.id);
    give(player, ITEM.ARROW);

    return true;
}

async function shootBridge(player, bridge) {
    if (!hasABow(player)) {
        player.message("first you'll need a bow");

        return;
    }

    take(player, ITEM.LIT_ARROW);

    if (level(player, 'ranged') < 25 || (player.y !== 3417 && player.x < 701)) {
        await mes(player, 'you fire the lit arrow at the bridge');
        await mes(player, 'it burns out and has little effect');

        return;
    }

    await mes(player, 'you fire your arrow at the rope supporting the bridge');

    if (nextInt(5) === 1) {
        player.message('the arrow just misses the rope');

        return;
    }

    if (stageOf(player) === 2) {
        setStage(player, 3);
    }

    await mes(player, 'the arrow impales the wooden bridge, just below the rope support');
    await mes(player, 'the rope catches alight and begins to burn');
    await mes(player, 'the bridge swings down creating a walkway');
    swapObject(player, bridge, 727, 16);
    player.teleport(702, 3420);
    await delay(player, 2);
    player.teleport(706, 3420);
    await delay(player);
    player.teleport(709, 3420);
    player.message('you rush across the bridge');
}

async function useRocksOnSwamp(player, swamp) {
    await mes(player, 'you throw the rocks onto the swamp');
    player.message('and carefully tread from one to another');
    take(player, ITEM.ROCKS);

    if (swamp.id === OBJECT.FIRST_SWAMP) {
        const x = player.x;

        addTimedObject(player, OBJECT.SWAMP_ROCKS, 697, 3441, 2, 16);

        if (x <= 695) {
            player.teleport(698, 3441);
            await delay(player, 2);
            player.teleport(700, 3441);
        } else {
            player.teleport(698, 3441);
            await delay(player, 2);
            player.teleport(695, 3441);
        }
    } else {
        const y = player.y;

        addTimedObject(player, OBJECT.SWAMP_ROCKS, 714, 3418, 0, 16);

        if (y >= 3418) {
            player.teleport(715, 3416);
        } else {
            player.teleport(713, 3420);
        }
    }
}

async function onUseWithGameObject(player, gameObject, item) {
    const { id } = gameObject;

    if (item.id === ITEM.ARROW && id === OBJECT.FIRE) {
        player.message('you light the cloth wrapped arrow head');
        take(player, ITEM.ARROW);
        give(player, ITEM.LIT_ARROW);

        return true;
    }

    if (item.id === ITEM.LIT_ARROW && id === OBJECT.OLD_BRIDGE) {
        await shootBridge(player, gameObject);

        return true;
    }

    if (item.id === ITEM.ROPE && STALACTITES.includes(id)) {
        await mes(player, 'you lasso the rope around the stalactite');
        await mes(player, 'and pull yourself up');

        if (id === OBJECT.STALACTITE_1) {
            player.teleport(695, 3435);
        } else if (id === OBJECT.STALACTITE_2) {
            player.teleport(677, 3435);
        } else {
            player.teleport(682, 3436);
        }

        player.message('you climb from stalactite to stalactite and over the rocks');

        return true;
    }

    if (item.id === ITEM.ROCKS && (id === OBJECT.FIRST_SWAMP || id === OBJECT.BLESSED_SPIDER_SWAMP)) {
        await useRocksOnSwamp(player, gameObject);

        return true;
    }

    return false;
}

module.exports = {
    onGameObjectCommandOne,
    onGameObjectCommandTwo,
    onUseWithInventory,
    onUseWithGameObject,
    doRock,
    doLedge
};
