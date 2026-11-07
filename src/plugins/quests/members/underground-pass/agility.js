// Ported from Open-RSC Core-Framework authentic/quests/members/undergroundpass/obstacles/UndergroundPassAgilityObstacles.java
// (AGPL-3.0): the ledges, stone steps and stone bridges that link the pockets of the cave and cross the black area (x 726-783,
// y 585-667). Falling from the north stone step or the first remaining bridge at stage 4 moves the quest to 5. Stage map: shared.js.

const {
    NPC,
    OBJECT,
    stageOf,
    setStage,
    cacheHas,
    cacheSet,
    mes,
    hurt,
    hitsCurrent,
    agilityCheck,
    nearNpc,
    ibanVoices
} = require('./shared');

const LEDGES = [862, 864, 863, 872, 865, 866];
const STONE_JUMP_BRIDGES = [898, 892, 896, 910, 906, 908, 902, 904, 900, 894];
const STONE_REMAINING_BRIDGES = [893, 907, 905, 909, 903, 901, 895, 899, 897];

// where a fall from an obstacle lands (fallTeleportLocation)
const FALL_TO = {
    [OBJECT.NORTH_STONE_STEP]: [738, 584],
    [OBJECT.FIRST_REMAINING_BRIDGE]: [738, 584],
    898: [756, 591],
    893: [753, 608],
    892: [734, 596],
    896: [734, 610],
    910: [734, 662],
    907: [733, 646],
    906: [731, 639],
    905: [742, 630],
    904: [742, 630],
    908: [760, 638],
    909: [745, 656],
    902: [759, 664],
    903: [761, 613],
    901: [727, 617],
    895: [727, 618],
    899: [734, 619],
    900: [734, 666],
    894: [763, 613],
    897: [753, 585]
};

async function failBlackAreaObstacle(player, obstacle) {
    player.message('..but you slip and tumble into the darkness');

    const to = FALL_TO[obstacle.id];

    if (to) {
        player.teleport(...to);
    }

    hurt(player, Math.floor(hitsCurrent(player) / 5) + 5); // 6 lowest, 25 max.
    await player.say('ouch!');

    if (stageOf(player) >= 4) {
        if (stageOf(player) === 4) {
            setStage(player, 5);
        }

        // only on the "first-time" fall at stages 5 to 8
        const koftik = nearNpc(player, NPC.KOFTIK_RECOVERED, 10);

        if (koftik && !(cacheHas(player, 'advised_koftik') && player.cache.advised_koftik === true)) {
            await koftik.say('traveller is that you?.. my friend on a mission');
            await player.say('koftik, you\'re still here, you should leave');
            await koftik.say('leave?...leave?..this is my home now', 'home with my lord, he talks to me, he\'s my friend');
            player.message('koftik seems to be in a weak state of mind');
            await player.say('koftik you really should leave these caverns');
            await koftik.say("not now, we're all the same down here", 'now there\'s just you and those dwarfs to be converted');
            await player.say('dwarfs?');
            await koftik.say(
                'foolish dwarfs, still believing that they can resist',
                'no one resists iban, go traveller',
                "the dwarfs to the south, they're not safe in the south",
                "we'll show them, go slay them m'lord",
                "he'll be so proud, that's all i want"
            );
            await player.say("i'll pray for you");
            cacheSet(player, 'advised_koftik', true);
        }
    }
}

async function ledge(player, obj) {
    await mes(player, 'you climb the ledge');

    if (!agilityCheck(player)) {
        player.message('but you loose your footing');
        hurt(player, 2);
        await player.say('aargh');

        return;
    }

    const afterIntro = stageOf(player) >= 4 || stageOf(player) === -1;

    switch (obj.id) {
        case 862:
            player.teleport(730, 3494);
            break;
        case 864:
            player.teleport(afterIntro ? 751 : 734, 3496);
            break;
        case 863:
            player.teleport(763, 3442);
            break;
        case 872:
            player.teleport(afterIntro ? 765 : 748, 3497);
            break;
        case 865:
            player.teleport(728, 3499);
            break;
        case 866:
            player.teleport(afterIntro ? 755 : 738, 3501);
            break;
        default:
    }

    player.message('you drop down to the cave floor');
}

async function handleObject(player, obj) {
    const { id } = obj;

    if (LEDGES.includes(id)) {
        await ledge(player, obj);
    } else if (id === OBJECT.NORTH_STONE_STEP) {
        if (stageOf(player) === 4) {
            await failBlackAreaObstacle(player, obj); // fail directly, to get stage 5.
        } else {
            await mes(player, 'you walk down the stone steps');
            player.teleport(766, 585);
        }
    } else if (id === OBJECT.SOUTH_STONE_STEP) {
        await mes(player, 'you walk down the steps');
        await mes(player, 'they lead to a ladder, you climb down');
        player.teleport(739, 667);
    } else if (id === OBJECT.FIRST_REMAINING_BRIDGE) {
        await mes(player, 'you attempt to walk over the remaining bridge..');

        if (stageOf(player) === 4) {
            await failBlackAreaObstacle(player, obj); // fail directly, to get stage 5.
        } else if (agilityCheck(player)) {
            player.teleport(obj.x === player.x + 1 ? 776 : 773, obj.y);
            player.message('..you manage to cross safley');
        } else {
            await failBlackAreaObstacle(player, obj);
        }
    } else if (STONE_REMAINING_BRIDGES.includes(id) || STONE_JUMP_BRIDGES.includes(id)) {
        if (STONE_JUMP_BRIDGES.includes(id)) {
            await mes(player, 'you attempt to jump across the gap..');
        } else {
            await mes(player, 'you attempt to walk over the remaining bridge..');
        }

        if (agilityCheck(player)) {
            if (obj.x === player.x + 1) {
                player.teleport(obj.x + 3, obj.y);
            } else if (obj.x === player.x - 3) {
                player.teleport(obj.x - 1, obj.y);
            } else if (obj.y === player.y + 1) {
                player.teleport(obj.x, obj.y + 3);
            } else if (obj.y === player.y - 3) {
                player.teleport(obj.x, obj.y - 1);
            }

            player.message('..you manage to cross safley');
        } else {
            await failBlackAreaObstacle(player, obj);
        }

        ibanVoices(player, 5, 25);
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

module.exports = { onGameObjectCommandOne, onGameObjectCommandTwo };
