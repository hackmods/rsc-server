// Shared by the Tourist Trap files in this folder (ports of Open-RSC authentic/quests/members/touristtrap/TouristTrap.java
// and Tourist_Trap_Mechanism.java, AGPL-3.0): ids, the small Open-RSC Functions.java helpers the Java calls (mes, addnpc,
// ifnearvisnpc, changenpc, the cache) and the quest-stage accessors. questStages.touristTrap is the Java stage (-1 = done).

const ITEM = {
    ANA_IN_A_BARREL: 1039,
    BEDOBIN_COPY_KEY: 1059,
    BOWL_OF_WATER: 342,
    BRONZE_BAR: 169,
    BRONZE_THROWING_DART: 1013,
    BUCKET_OF_WATER: 50,
    CELL_DOOR_KEY: 1098,
    COINS: 10,
    DESERT_BOOTS: 990,
    DESERT_ROBE: 1019,
    DESERT_SHIRT: 1020,
    FEATHER: 381,
    FRESH_PINEAPPLE: 861,
    FULL_WATER_SKIN: 1016,
    HAMMER: 168,
    JUG_OF_WATER: 141,
    METAL_KEY: 1021,
    MINING_BARREL: 1038,
    PINEAPPLE: 748,
    PINEAPPLE_CHUNKS: 862,
    PINEAPPLE_RING: 749,
    PROTOTYPE_DART_TIP: 1071,
    PROTOTYPE_THROWING_DART: 1014,
    ROCKS: 986,
    SLAVES_ROBE_BOTTOM: 1022,
    SLAVES_ROBE_TOP: 1023,
    TECHNICAL_PLANS: 1060,
    TENTI_PINEAPPLE: 1058,
    WROUGHT_IRON_KEY: 1097
};

const NPC = {
    ANA: 554,
    AL_SHABIM: 700,
    BEDABIN_NOMAD: 701,
    BEDABIN_NOMAD_GUARD: 703,
    CAPTAIN_SIAD: 702,
    DRAFT_MERCENARY_GUARD: 710,
    ESCAPING_MINING_SLAVE: 737,
    IRENA: 538,
    MERCENARY: 668,
    MERCENARY_CAPTAIN: 669,
    MERCENARY_ESCAPEGATES: 670,
    MERCENARY_JAILDOOR: 692,
    MERCENARY_LIFTPLATFORM: 690,
    MINING_CART_DRIVER: 711,
    MINING_SLAVE: 671
};

// the strings Open-RSC's language files hold (conf/server/languages/AuthenticMessages_en_UK_gender_neutral.properties)
const TEXT = {
    TouristTrapIreneWellYesYoullHaveMyGratitude: "Well, yes, you'll have my gratitude young one.",
    TouristTrapMercenaryCaptainGuardsKillThem: 'Guards, kill them.',
    TouristTrapMercenaryLiftPlatformGetThemMen: 'Get them men!',
    TouristTrapCaptainWantsToThrowPlayerOkMenWeNeedToTeachThis: 'Ok men, we need to teach this idiot a thing or two',
    TouristTrapFailEscapeAnaInBarrelRightLadsStuff: "Right lads, stuff them in the mining cell!"
};

// Open-RSC delay() is one 640 ms tick; GAME_TICK * n in a SingleEvent is n ticks, and an addnpc time is milliseconds
const TICK_MS = 640;

function stageOf(player) {
    return player.questStages.touristTrap || 0;
}

function setStage(player, stage) {
    player.questStages.touristTrap = stage;
}

// Point.inTouristTrapCave: inBounds(49, 3600, 95, 3647)
function inTouristTrapCave(player) {
    return player.x >= 49 && player.x <= 95 && player.y >= 3600 && player.y <= 3647;
}

// ---- player cache (Open-RSC getCache().hasKey/store/set/remove) --------------------------------------------------

function cacheHas(player, key) {
    return typeof player.cache[key] !== 'undefined';
}

function cacheGet(player, key) {
    return player.cache[key];
}

function cacheSet(player, key, value) {
    player.cache[key] = value;
}

function cacheDel(player, key) {
    delete player.cache[key];
}

// ---- Functions.java ----------------------------------------------------------------------------------------------

// mes("...") followed by delay(n): a quest message, then n ticks (n = 0: the message alone)
async function mes(player, message, ticks = 3) {
    player.message(`@que@${message}`);

    if (ticks > 0) {
        await player.world.sleepTicks(ticks);
    }
}

// DataConversions.random(low, high) is inclusive
function randomInt(low, high) {
    return low + Math.floor(Math.random() * (high - low + 1));
}

// Java ifnearvisnpc(player, id, radius): the nearest npc of the type in view that is not busy (talking or fighting)
function nearNpc(player, id, radius) {
    const found = player
        .getNearbyEntitiesWithinRadius('npcs', id, radius)
        .filter((npc) => !npc.interlocutor && !npc.opponent);

    found.sort((a, b) => player.getDistance(a) - player.getDistance(b));

    return found[0] || null;
}

// Java addnpc(world, id, x, y[, time in ms]): an npc that leaves after `time` (none: stays until removed)
function spawnNpc(player, id, x, y, time) {
    return player.world.spawnTimedNPC({ id, x, y, ticks: time ? Math.ceil(time / TICK_MS) : undefined });
}

// Java npc.remove()
function removeNpc(player, npc) {
    if (!npc) {
        return;
    }

    if (typeof npc.abandonFight === 'function') {
        npc.abandonFight();
    }

    player.world.removeEntity('npcs', npc);
}

// Java n.teleport(x, y) on an NPC: the JS model has no NPC teleport, so move it and tell the players who see it
function moveNpc(npc, x, y) {
    if (!npc) {
        return;
    }

    npc.x = x;
    npc.y = y;

    if (typeof npc.broadcastMove === 'function') {
        npc.broadcastMove();
    }
}

// Java n.startCombat(player) / n.setChasing(player): the npc goes for the player. The scripts that call it carry on (a
// teleport to a cell, a timed message) before the fight would matter, so the attack starts when the hook that is running
// finishes (withAttacks): a player who was sent away by then is not followed.
const pendingAttackers = new WeakMap();

function attackPlayer(player, npc) {
    if (!npc || typeof npc.attack !== 'function') {
        return;
    }

    const pending = pendingAttackers.get(player);

    if (pending) {
        pending.add(npc);
    } else {
        Promise.resolve(npc.attack(player)).catch(() => {});
    }
}

// run a hook body; the npcs it told to attack start their attack afterwards
async function withAttacks(player, fn) {
    const outer = pendingAttackers.get(player);
    const pending = outer || new Set();

    pendingAttackers.set(player, pending);

    try {
        return await fn();
    } finally {
        if (!outer) {
            pendingAttackers.delete(player);

            for (const npc of pending) {
                Promise.resolve(npc.attack(player)).catch(() => {});
            }
        }
    }
}

// Java changenpc(n, newID, true): the npc turns into another and the old one does not respawn. The new one keeps the
// respawn of its own type unless the caller says otherwise (the escaping slave must not come back when killed)
function changeNpc(player, npc, id, { respawn = true } = {}) {
    const changed = player.world.replaceEntity('npcs', npc, id);

    if (!respawn) {
        changed.respawn = undefined;
    }

    return changed;
}

module.exports = {
    ITEM,
    NPC,
    TEXT,
    TICK_MS,
    stageOf,
    setStage,
    inTouristTrapCave,
    cacheHas,
    cacheGet,
    cacheSet,
    cacheDel,
    mes,
    randomInt,
    nearNpc,
    spawnNpc,
    removeNpc,
    moveNpc,
    attackPlayer,
    withAttacks,
    changeNpc
};
