// Ported from Open-RSC Core-Framework authentic/quests/members/undergroundpass/obstacles/UndergroundPassObstaclesMap3.java and
// npcs/UndergroundPassIban.java (AGPL-3.0): the temple side of the dungeon (x 788-815, y 3405-3545): the cages of the souless
// (888, 887: the dove's remains for Iban's conscience), the chest (912) opened with the three demons' amulets for Iban's shadow,
// the temple door (869) that wants the robes of Zamorak and, with the doll complete, starts Iban's blasts (stage 6 -> 7), and the
// Pit of the Damned (913) the finished doll is thrown into (stage 7 -> 8: Iban's staff, runes and the collapse). Stage map: shared.js.

const {
    ITEM,
    NPC,
    OBJECT,
    IBAN_DEAD_CACHE_KEYS,
    stageOf,
    setStage,
    atStages,
    dollDone,
    cacheHas,
    cacheSet,
    cacheDel,
    mes,
    delay,
    hurt,
    hitsCurrent,
    give,
    take,
    holds,
    worn,
    random,
    nearNpc,
    removeNpc,
    bubble,
    swapObject
} = require('./shared');

const CAGES = [888, 887];
// the temple's inside: the door pulls the player in over 794-800; Iban's blasts land in "ibans_room" (Areas.java)
const BOUND_AREA = { minX: 794, maxX: 800, minY: 3467, maxY: 3471 };
const IBANS_ROOM = { minX: 796, maxX: 799, minY: 3467, maxY: 3471 };
const BLAST_TIMEOUT_MS = 1000 * 60 * 2;

async function cage(player, obj) {
    const gauntlets = worn(player, ITEM.KLANKS_GAUNTLETS);
    const conscience = obj.id === CAGES[1];

    player.message('the man seems to be entranced');
    await mes(player, 'the cage is locked');

    const souless = nearNpc(player, NPC.SOULESS_HUMAN, 6);

    if (souless) {
        await souless.say('kuluf ali monopiate');
    }

    await mes(player, 'you search through the bottom of the cage');

    if (conscience) {
        if (!cacheHas(player, 'cons_on_doll')) {
            player.message('but the souless bieng bites into your arm');

            if (gauntlets) {
                player.message('klanks gaunlett protects you');
            } else {
                hurt(player, Math.floor(hitsCurrent(player) / 10) + 5);
                await player.say('aaarrgghh');
            }
        }

        if (!holds(player, ITEM.IBANS_CONSCIENCE) && !cacheHas(player, 'cons_on_doll')) {
            player.message('you find the remains of a dove');
            give(player, ITEM.IBANS_CONSCIENCE);
        } else {
            // kosher was separated lol
            player.message(gauntlets ? 'but you find find nothing' : 'you find nothing');
        }

        return;
    }

    player.message('but the souless bieng bites into your arm');

    if (gauntlets) {
        player.message('klanks gaunlett protects you');
        player.message('but you find find nothing');
    } else {
        hurt(player, Math.floor(hitsCurrent(player) / 10) + 5);
        await player.say('aaarrgghh');
        player.message('you find nothing');
    }
}

async function demonsChest(player, chest) {
    await mes(player, 'you attempt to open the chest');

    if (
        holds(player, ITEM.AMULET_OF_OTHAINIAN) &&
        holds(player, ITEM.AMULET_OF_DOOMION) &&
        holds(player, ITEM.AMULET_OF_HOLTHION) &&
        !cacheHas(player, 'shadow_on_doll')
    ) {
        await mes(player, 'the three amulets glow red in your satchel');
        take(player, ITEM.AMULET_OF_OTHAINIAN);
        take(player, ITEM.AMULET_OF_DOOMION);
        take(player, ITEM.AMULET_OF_HOLTHION);
        player.message('you place them on the chest and the chest opens');
        swapObject(player, chest, OBJECT.DEMONS_CHEST_OPEN, 3);
        await delay(player, 2);
        player.message('inside you find a strange dark liquid');
        give(player, ITEM.IBANS_SHADOW);
    } else {
        player.message("but it's magically sealed");
    }
}

// ---- Iban's blasts ---------------------------------------------------------------------------------------------------------

function inBounds(player, area) {
    return player.x >= area.minX && player.x <= area.maxX && player.y >= area.minY && player.y <= area.maxY;
}

function blastDamage(player) {
    return Math.floor(hitsCurrent(player) / 10) + 4 + random(-1, 1);
}

// the DelayedEvent of the Java: every tick a blast lands somewhere in Iban's room; standing within one tile of it throws the
// player back to the door; two minutes inside throws him out. Ends when he leaves, logs out or Iban falls
function startBlasts(player) {
    const { world } = player;
    const start = Date.now();
    const loop = () => {
        if (Date.now() - start > BLAST_TIMEOUT_MS && inBounds(player, BOUND_AREA)) {
            player.message("you're blasted out of the temple");
            player.message('@yel@Iban: and stay out');
            player.teleport(790, 3469);

            return;
        }

        if (
            player.loggedIn === false ||
            !inBounds(player, {
                minX: BOUND_AREA.minX,
                maxX: BOUND_AREA.maxX + 4,
                minY: BOUND_AREA.minY - 3,
                maxY: BOUND_AREA.maxY + 3
            })
        ) {
            return;
        }

        if (player.ibanBubbleShow) {
            return;
        }

        const x = random(IBANS_ROOM.minX, IBANS_ROOM.maxX);
        const y = random(IBANS_ROOM.minY, IBANS_ROOM.maxY);

        bubble(player, x, y, true);

        if (Math.max(Math.abs(player.x - x), Math.abs(player.y - y)) <= 1) {
            const damage = blastDamage(player);
            const willDie = damage >= hitsCurrent(player);

            hurt(player, damage);

            if (!willDie) {
                player.teleport(795, 3469);
                player.say('aarrgh');
                player.message("you're blasted back to the door");
            }
        }

        world.setTickTimeout(loop, 1);
    };

    world.setTickTimeout(loop, 1);
}

async function templeDoor(player, door) {
    if (player.x <= 792) {
        if (stageOf(player) === -1) {
            await mes(player, 'the temple is in ruins...');
            player.message('...you cannot enter');

            return;
        }

        if (worn(player, ITEM.ROBE_OF_ZAMORAK_TOP) && worn(player, ITEM.ROBE_OF_ZAMORAK_BOTTOM)) {
            swapObject(player, door, OBJECT.TEMPLE_DOOR_OPEN, 5);
            player.teleport(792, 3469);
            await delay(player);
            player.teleport(795, 3469);
            await mes(player, 'you pull open the large doors');
            player.message('and walk into the temple');

            if (stageOf(player) === 7 || dollDone(player)) {
                if (stageOf(player) === 6) {
                    setStage(player, 7);
                }

                player.ibanBubbleShow = false;
                player.message('Iban seems to sense danger');
                await mes(player, '@yel@Iban: who dares bring the witches magic into my temple');
                await mes(player, 'his eyes fixate on you as he raises his arm');
                await mes(player, '@yel@Iban: an imposter dares desecrate this sacred place..');
                await mes(player, '@yel@Iban: ..home to the only true child of zamorak');
                await mes(player, '@yel@Iban: join the damned, mortal');
                player.message('iban raises his staff to the air');
                await mes(player, 'a blast of energy comes from ibans staff');
                player.message('you are hit by ibans magic bolt');
                bubble(player, 795 + 1, 3469, true);
                hurt(player, blastDamage(player));
                await player.say('aarrgh');
                await mes(player, '@yel@Iban:die foolish mortal');
                startBlasts(player);
            } else {
                player.message('inside iban stands preaching at the alter');
            }
        } else {
            await mes(player, 'The door refuses to open');
            player.message('only followers of zamorak may enter');
        }
    } else {
        swapObject(player, door, OBJECT.TEMPLE_DOOR_OPEN, 5);
        player.teleport(794, 3469);
        await delay(player);
        player.teleport(791, 3469);
        await delay(player, 2);
        player.message('you pull open the large doors');
        player.message('and walk out of the temple');
    }
}

// ---- the Pit of the Damned -------------------------------------------------------------------------------------------------

async function throwDoll(player) {
    // iban has been killed (the state of the doll does not matter)
    if (atStages(player, 8, -1)) {
        player.message('iban is already dead');

        return;
    }

    if (!dollDone(player)) {
        player.message('the doll is still incomplete');

        return;
    }

    const iban = nearNpc(player, NPC.IBAN, 10);

    if (!iban) {
        player.message('iban is still not here');

        return;
    }

    await mes(player, 'you throw the doll of iban into the pit');
    take(player, ITEM.A_DOLL_OF_IBAN);
    player.ibanBubbleShow = true;
    await iban.say("what's happening?, it's dark here...so dark", "im falling into the dark, what have you done?");
    await mes(player, 'iban falls to his knees clutching his throat');
    await iban.say('noooooooo!');
    player.message('iban slumps motionless to the floor');
    removeNpc(player, iban);

    await mes(player, 'a roar comes from the pit of the damned');
    await mes(player, 'the infamous iban has finally gone to rest');
    player.message('amongst ibans remains you find his staff..');
    await mes(player, '...and some runes');
    player.message('suddenly around you rocks crash to the floor..');
    await mes(player, '...as the ground begins to shake');
    await mes(player, 'the temple walls begin to collapse in');
    await mes(player, "and you're thrown from the temple platform");
    give(player, ITEM.STAFF_OF_IBAN);
    give(player, ITEM.DEATH_RUNE, 15);
    give(player, ITEM.FIRE_RUNE, 30);
    player.teleport(687, 3485);
    // the player may teleport out after defeating iban without talking to koftik
    setStage(player, 8);

    for (const key of IBAN_DEAD_CACHE_KEYS) {
        cacheDel(player, key);
    }

    // reset the flag of the last map koftik npc
    cacheSet(player, 'advised_koftik', false);
}

async function handleObject(player, obj) {
    const { id } = obj;

    if (CAGES.includes(id)) {
        await cage(player, obj);
    } else if (id === OBJECT.DEMONS_CHEST_CLOSED) {
        await demonsChest(player, obj);
    } else if (id === OBJECT.TEMPLE_DOOR) {
        await templeDoor(player, obj);
    } else {
        return false;
    }

    return true;
}

async function onGameObjectCommandOne(player, gameObject) {
    return handleObject(player, gameObject);
}

async function onGameObjectCommandTwo(player, gameObject) {
    return handleObject(player, gameObject);
}

async function onUseWithGameObject(player, gameObject, item) {
    if (gameObject.id !== OBJECT.PIT_OF_THE_DAMNED || item.id !== ITEM.A_DOLL_OF_IBAN) {
        return false;
    }

    await throwDoll(player);

    return true;
}

module.exports = { onGameObjectCommandOne, onGameObjectCommandTwo, onUseWithGameObject, startBlasts };
