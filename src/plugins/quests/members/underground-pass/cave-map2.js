// Ported from Open-RSC Core-Framework authentic/quests/members/undergroundpass/obstacles/UndergroundPassObstaclesMap2.java and
// mechanism/UndergroundPassMechanismMap2.java (AGPL-3.0): the second cave (x 720-770, y 3430-3500): the piles of mud, the crate of
// food, the dug-up tunnels, the ledge and the wall grills, the spiked rocks, the pressure-trigger passages, the cage remains
// with the unicorn horn, the boulder tipped with the cage's railing (stage 3 -> 4), the Gate of Iban and the Flames of Zamorak
// that open it, and the Gate of Zamorak. The cage railings (167-170) are in wall-objects/level-doors.js. Stage map: shared.js.

const {
    ITEM,
    OBJECT,
    stageOf,
    setStage,
    cacheHas,
    cacheSet,
    mes,
    delay,
    hurt,
    hitsCurrent,
    give,
    take,
    holds,
    nextInt,
    commandOf,
    sendBox,
    bubble,
    swapObject,
    hideObject
} = require('./shared');
const { doRock } = require('./cave-map1');

// the piles of mud and where each leads
const MUD_PILES = {
    841: { to: [727, 3448], first: 'you climb the pile of mud...', then: ['it leads to a small tunnel...'], last: '..ending at the well entrance' },
    843: { to: [753, 3481] },
    844: { to: [753, 3475] },
    845: { to: [743, 3483] },
    846: { to: [740, 3476] },
    847: { to: [735, 3478] }
};

// the spiked rocks: which pit the fall lands in (spikeLocation of the Java)
const ROCK_SPIKES = { 859: 5, 858: 5, 854: 4, 853: 4, 855: 4, 857: 4, 852: 3, 851: 2, 849: 1, 850: 1, 860: 1 };
const ITEMS_TO_FLAMES = [ITEM.UNICORN_HORN, ITEM.COAT_OF_ARMS_RED, ITEM.COAT_OF_ARMS_BLUE];
const FLAMES_INSCRIPTION =
    '@red@While I sense the soft beating of a good heart I will not open% %@red@Feed me three crests of the blessed warriors, and the%@red@creatures remains% %@red@Throw them to me as an offering, a gift of hatred, a token% %@red@Then finally rejoice as all goodness dies in my flames';

function gateOfIbanOpens(player) {
    return (
        (cacheHas(player, 'flames_of_zamorak1') &&
            cacheHas(player, 'flames_of_zamorak2') &&
            cacheHas(player, 'flames_of_zamorak3') &&
            player.cache.flames_of_zamorak3 >= 2) ||
        [7, 8, -1].includes(stageOf(player))
    );
}

async function mudPile(player, pile) {
    const { to, first, then, last } = MUD_PILES[pile.id];

    await mes(player, first || 'you climb the pile of mud');

    for (const line of then || []) {
        await mes(player, line);
    }

    player.teleport(...to);

    if (last) {
        player.message(last);
    }
}

async function ledgeJump(player, ledge, index) {
    if (commandOf(ledge, index) === 'climb up') {
        player.message('you climb the ledge');

        if (nextInt(10) <= 1) {
            player.message('but you slip');
            hurt(player, Math.floor(hitsCurrent(player) / 42) + 1);
            await player.say('aargh');
        } else {
            player.teleport(764, 3463);
        }
    } else {
        player.message('you take a few paces back...');
        player.message('and run torwards the ledge...');
        player.teleport(764, 3461);
        await delay(player, 3);
        player.message('you land way short of the other platform');
        hurt(player, Math.floor(hitsCurrent(player) / 5) + 5);
        player.teleport(764, 3467);
        await player.say('ooof');
    }
}

async function passage(player, obj) {
    await mes(player, 'you walk down the passage way');
    player.message('you step on a pressure trigger');
    player.message("it's a trap");

    if (obj.x === 737 || obj.x === 735) {
        player.teleport(737, 3489);
    } else if (obj.x === 733) {
        player.teleport(733, 3489);
    }

    swapObject(player, obj, OBJECT.SNAP_TRAP, 8);
    hurt(player, Math.floor(hitsCurrent(player) / 5) + 5);
    await player.say('aaarghh');
}

async function cageRemains(player) {
    if (stageOf(player) >= 5 || stageOf(player) === -1) {
        await mes(player, 'you search the cage remains');
        player.message('nothing remains');

        return;
    }

    if (!holds(player, ITEM.UNICORN_HORN)) {
        await delay(player, 3);
        player.message('all that remains is a damaged horn');
        give(player, ITEM.UNICORN_HORN);
    } else {
        player.message('nothing remains');
    }
}

async function gateOfIban(player, gate) {
    player.message('you pull on the great door');

    if (gateOfIbanOpens(player)) {
        await mes(player, 'from behind the door you hear cry\'s and moans');
        player.message('the door slowly creeks open');
        swapObject(player, gate, OBJECT.OPEN_DOOR, 5);
        player.teleport(766, 3417);
        await delay(player, 2);
        player.teleport(770, 3417);
        player.message('you walk into the darkness');
    } else {
        player.message('the door refuses to open');
    }
}

async function gateOfZamorak(player, gate) {
    swapObject(player, gate, OBJECT.OPEN_DOOR, 5);
    player.teleport(766, 3417);
    await mes(player, 'you open the huge wooden door');
    player.teleport(763, 3417);
    player.message('and walk through');
}

async function handleObject(player, obj, index) {
    const { id } = obj;

    if (MUD_PILES[id]) {
        await mudPile(player, obj);
    } else if (id === OBJECT.CRATE) {
        await mes(player, 'you search the crate');

        if (!cacheHas(player, 'crate_food')) {
            player.message('inside you find some food');
            give(player, ITEM.SALMON, 2);
            give(player, ITEM.MEAT_PIE, 2);
            cacheSet(player, 'crate_food');
        } else {
            player.message('but you find nothing');
        }
    } else if (id === 839 || id === 840) {
        await mes(player, 'under the soil is a tunnel');
        player.message('would you like to enter?');

        const menu = await player.ask(['no, im scared of small spaces', "yep, let's do it"]);

        if (menu === 1) {
            await mes(player, 'you climb into the small tunnel');
            player.teleport(...(id === 840 ? [745, 3457] : [747, 3470]));
            player.message('and crawl into a small dark passage');
        }
    } else if (id === OBJECT.LEDGE_MAP_2) {
        await ledgeJump(player, obj, index);
    } else if (id === OBJECT.WALL_GRILL_EAST) {
        if (!cacheHas(player, 'rope_wall_grill')) {
            await mes(player, 'the wall grill is too high');
            player.message("you can't quite reach");
        } else {
            await mes(player, 'you use the rope tied to the grill to pull yourself up');
            player.message('you then climb across the grill to the otherside');
            player.teleport(762, 3472);
        }
    } else if (id === OBJECT.WALL_GRILL_WEST) {
        await mes(player, 'you climb across the grill to the otherside');
        player.teleport(766, 3463);
    } else if (ROCK_SPIKES[id]) {
        await doRock(player, obj, Math.floor(hitsCurrent(player) / 5) + 5, false, ROCK_SPIKES[id]);
    } else if (id === OBJECT.HIJACK_ROCK) {
        player.message('you climb onto the rock');

        if (nextInt(5) === 4) {
            player.message('but you slip');
            hurt(player, Math.floor(hitsCurrent(player) / 5) + 5);
            player.teleport(734, 3483);
            await player.say('aargh');
        } else {
            player.teleport(...(player.x === 734 ? [735, 3479] : [734, 3480]));
            player.message('and step down the other side');
        }
    } else if (id === OBJECT.PASSAGE) {
        await passage(player, obj);
    } else if (id === OBJECT.CAGE_REMAINS) {
        await cageRemains(player);
    } else if (id === OBJECT.GATE_OF_IBAN) {
        await gateOfIban(player, obj);
    } else if (id === OBJECT.GATE_OF_ZAMORAK) {
        await gateOfZamorak(player, obj);
    } else if (id === OBJECT.FLAMES_OF_ZAMORAK) {
        await mes(player, 'you search the stone structure');
        player.message('on the side you find an old inscription');
        player.message('it reads...');
        sendBox(player, FLAMES_INSCRIPTION, true);
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

// ---- mechanism/UndergroundPassMechanismMap2.java ----------------------------------------------------------------------------

async function onUseWithGameObject(player, gameObject, item) {
    const { id } = gameObject;

    if (id === OBJECT.WALL_GRILL_EAST && item.id === ITEM.ROPE) {
        if (player.x === 763 && player.y === 3463) {
            player.message("you can't reach the grill from here");
        } else {
            await mes(player, 'you tie the rope to the grill...');
            player.message('..and poke it through to the otherside');
            cacheSet(player, 'rope_wall_grill');
        }

        return true;
    }

    if (id === OBJECT.PASSAGE && item.id === ITEM.PLANK) {
        player.message('you carefully place the planks over the pressure triggers');
        player.message('you walk across the wooden planks');
        take(player, ITEM.PLANK);
        player.teleport(735, 3489);
        await delay(player, 2);

        if (gameObject.x === 737) {
            player.teleport(732, 3489);
        } else if (gameObject.x === 733) {
            player.teleport(738, 3489);
        }

        return true;
    }

    if (id === OBJECT.BOULDER && item.id === ITEM.RAILING) {
        await mes(player, 'you use the pole as leverage...');
        await mes(player, '..and tip the bolder onto its side');
        hideObject(player, gameObject, 8);
        player.message('it tumbles down the slope');

        if (stageOf(player) === 3) {
            setStage(player, 4);
        }

        return true;
    }

    if (id === OBJECT.FLAMES_OF_ZAMORAK && ITEMS_TO_FLAMES.includes(item.id)) {
        const name = ((item.definition && item.definition.name) || '').toLowerCase();

        await mes(player, `you throw the ${name} into the flames`);

        if (![7, 8, -1].includes(stageOf(player))) {
            if (!cacheHas(player, 'flames_of_zamorak1') && item.id === ITEM.UNICORN_HORN) {
                cacheSet(player, 'flames_of_zamorak1');
            }

            if (!cacheHas(player, 'flames_of_zamorak2') && item.id === ITEM.COAT_OF_ARMS_RED) {
                cacheSet(player, 'flames_of_zamorak2');
            }

            if (item.id === ITEM.COAT_OF_ARMS_BLUE) {
                if (!cacheHas(player, 'flames_of_zamorak3')) {
                    cacheSet(player, 'flames_of_zamorak3', 1);
                } else if (player.cache.flames_of_zamorak3 < 2) {
                    cacheSet(player, 'flames_of_zamorak3', player.cache.flames_of_zamorak3 + 1);
                }
            }
        }

        take(player, item.id);
        player.message('you hear a howl in the distance');

        return true;
    }

    if (id === OBJECT.FLAMES_OF_ZAMORAK && item.id === ITEM.STAFF_OF_IBAN) {
        await mes(player, 'you hold the staff above the well');
        bubble(player, player.x, player.y, true);
        player.message('and feel the power of zamorak flow through you');
        cacheSet(player, 'Iban blast_casts', 25);

        return true;
    }

    return false;
}

module.exports = { onGameObjectCommandOne, onGameObjectCommandTwo, onUseWithGameObject };
