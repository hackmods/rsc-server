// Shared by the Shilo Village files in this folder (ports of Open-RSC Core-Framework authentic/quests/members/shilovillage/*.java,
// AGPL-3.0: ShiloVillageMosolRei, ShiloVillageNazastarool, ShiloVillageObjects, ShiloVillageTombDolmen, ShiloVillageTrufitusInvUse
// and ShiloVillageUtils): ids, the small Open-RSC Functions.java helpers the Java calls (mes, addnpc, the cache) and the
// quest-stage accessors. questStages.shiloVillage is the Java stage (-1 = done). https://classic.runescape.wiki/w/Shilo_Village
//
// The stage map (Trufitus's talk is jungle-potion/trufitus-shilo.js, already ported with the Jungle Potion quest, and it sets
// the stages that are marked "T"):
//   0      Mosol Rei (539, outside the Shilo gate, 382,852): "Why do I need to run?", "Rashiliyia? Who is she?", "What can we do?" -> 1
//   1 -> 2 T  Trufitus (517, Tai Bwo Wannai): "What do you know about Rashiliyia?" ... "Why was it called Ah Za Rhoon?" -> 2
//   2 -> 3 the bumpy dirt (651, 353,816): a candle lit on it (SV_DIG_LIT), a rope tied (SV_DIG_ROPE), a spade (SV_DIG_BUMP), then the
//          crawl through the fissure drops into the Ah Za Rhoon cave (352,3650) (hurt without the rope): -> 3
//   3 -> 4 the gallows (682, 359,3722) give Zadimus's corpse (962); buried (inventory "Bury" or dropped) within 445-449 x 749-753,
//          the sacred ground in Tai Bwo Wannai, it leaves a bone shard (974): -> 4
//   4 -> 5 T  Trufitus: "I have just buried Zadimus's corpse." -> "The spirit said something about keys and kin?" -> 5
//   5 -> 6 Bervirius's tomb: the well stacked rocks (688, 473,825), searched, crawl into the tomb (471,3658) (Agility 32 gets there:
//          the island is across the rickety bridge, the rocks 710 and the bridge blockade 691 of skills/agility.js): -> 6
//   6 -> 7 the tomb's dolmen (689, 464,3672), searched, gives the sword pommel 973, the locating crystal 972 and the Bervirius tomb
//          notes 961; the notes shown to Trufitus (used on him): -> 7. The handholds (690, 466,3675) climb out to (471,836)
//   7 -> 8 the search of the trees 573 (350,781) opens the hillside entrance 572 (350,782); searching the entrance sets
//          can_chisel_bone, a chisel on the bone shard (crafting 20) makes the bone key 835; the pommel + chisel make bone beads
//          976 (crafting 20), beads + bronze wire 979 (crafting 20) the Beads of the dead 852, which must be WORN in the tomb;
//          the bone key used on the entrance goes in (348,3611): -> 8
//   8      inside Rashiliyia's tomb: the gate 577 (348,3615), the rocks 719 (348..349,3617..3619), three bones on the tomb doors
//          794 (377,3632) (tomb_door_shilo), the Nazastarool dolmen 724 (378,3622): the zombie, the skeleton and the ghost (cache
//          dolmen_zombie/_skeleton/_ghost) and then the dolmen gives Rashiliyia's remains 977; the bone key on the exit door 583
//          (348,3608) leads out to (350,782)
//   8 -> done  the remains used on Bervirius's dolmen 689: 2 quest points and crafting 500 + 500 per crafting level (quarter points)

const ITEM = {
    A_LUMP_OF_CHARCOAL: 983,
    BEADS_OF_THE_DEAD: 852,
    BERVIRIUS_TOMB_NOTES: 961,
    BONE_BEADS: 976,
    BONE_KEY: 835,
    BONE_SHARD: 974,
    BONES: 20,
    BRONZE_WIRE: 979,
    CHISEL: 167,
    COINS: 10,
    CRUMPLED_SCROLL: 960,
    LIT_CANDLE: 601,
    LOCATING_CRYSTAL: 972,
    PAPYRUS: 982,
    RASHILIYA_CORPSE: 977,
    ROPE: 237,
    SPADE: 211,
    STONE_PLAQUE: 958,
    SWORD_POMMEL: 973,
    TATTERED_SCROLL: 959,
    ZADIMUS_CORPSE: 962
};

const NPC = {
    CART_DRIVER_BRIMHAVEN: 618,
    CART_DRIVER_SHILO: 619,
    MOSOL: 539,
    NAZASTAROOL_GHOST: 615,
    NAZASTAROOL_SKELETON: 614,
    NAZASTAROOL_ZOMBIE: 613,
    RASHILIYIA: 533,
    SKELETON: 40,
    TRUFITUS: 517,
    UNDEAD_ONE: 542,
    YANNI: 624,
    ZADIMUS: 589
};

const OBJECT = {
    BRIDGE_BLOCKADE: 691,
    BUMPY_DIRT: 651,
    CAVE_SACK: 783,
    CLIMB_CAVE_ROCKS: 719,
    HILLSIDE_ENTRANCE: 572,
    METALLIC_DUNGEON_GATE: 577,
    PILE_OF_RUBBLE: 670,
    PILE_OF_RUBBLE_TATTERED_SCROLL: 683,
    RASH_EXIT_DOOR: 583,
    ROTTEN_GALLOWS: 682,
    SEARCH_TREE_FOR_ENTRANCE: 573,
    SMASHED_TABLE: 697,
    SPEC_STONE: 674,
    TOMB_DOLMEN: 689,
    TOMB_DOLMEN_HANDHOLDS: 690,
    TOMB_DOLMEN_NAZASTAROOL: 724,
    TOMB_DOORS: 794,
    WELL_STACKED_ROCKS: 688,
    WET_ROCKS: 696,
    // visual stand-ins
    CRUDE_RAFT: 698,
    DOORS_OPEN: 497,
    GATE_OPEN: 181
};

// Open-RSC delay() is one 640 ms tick; an addnpc time is milliseconds
const TICK_MS = 640;

function stageOf(player) {
    return player.questStages.shiloVillage || 0;
}

function setStage(player, stage) {
    player.questStages.shiloVillage = stage;
}

// ---- player cache (Open-RSC getCache().hasKey/store/remove) -------------------------------------------------------------

function cacheHas(player, key) {
    return player.cache[key] != null;
}

function cacheSet(player, key, value = true) {
    player.cache[key] = value;
}

function cacheDel(player, key) {
    delete player.cache[key];
}

// the keys the Java removes when the quest is rewarded (ShiloVillageTombDolmen.handleReward)
const REWARD_CACHE_KEYS = [
    'obtained_shilo_info',
    'coins_shilo_cave',
    'can_chisel_bone',
    'tomb_door_shilo',
    'SV_DIG_LIT',
    'SV_DIG_ROPE',
    'SV_DIG_BUMP',
    'dolmen_zombie',
    'dolmen_skeleton',
    'dolmen_ghost'
];

// ---- Functions.java ------------------------------------------------------------------------------------------------------

// mes("...") followed by delay(n): a quest message, then n ticks (n = 0: the message alone)
async function mes(player, message, ticks = 3) {
    player.message(`@que@${message}`);

    if (ticks > 0) {
        await player.world.sleepTicks(ticks);
    }
}

async function delay(player, ticks = 1) {
    await player.world.sleepTicks(ticks);
}

// player.damage(n): the red hit; the 0 a low level rounds to is left out
function hurt(player, amount) {
    if (amount > 0) {
        player.damage(amount);
    }
}

function hitsCurrent(player) {
    return player.skills.hits.current;
}

function level(player, skill) {
    return player.skills[skill].current;
}

// Java ifheld(player, id, n)
function holds(player, id, amount = 1) {
    return player.inventory.has(id, amount);
}

function beadsWorn(player) {
    return player.inventory.isEquipped(ITEM.BEADS_OF_THE_DEAD);
}

// Java getCurrentLevel(fatigue) check: the authentic config (want_fatigue, stop_skilling_fatigued 1) refuses at full fatigue
function tooTired(player) {
    return typeof player.isTired === 'function' && player.isTired();
}

// Java ShiloVillageUtils.succeed, kept as written (deviation-free quirk): below the required level (level_difference < 0) it
// always succeeds, from 0 to 14 levels above it is 30 + difference per cent, from 15 to 19 it is always (30 + 80 > 100),
// and from 20 up it is 90 per cent.
function succeed(player, req) {
    const levelDifference = level(player, 'agility') - req;
    const percent = 1 + Math.floor(Math.random() * 100);

    if (levelDifference < 0) {
        return true;
    }

    let chance;

    if (levelDifference >= 20) {
        chance = 90;
    } else if (levelDifference >= 15) {
        chance = 30 + 80;
    } else {
        chance = 30 + levelDifference;
    }

    return percent <= chance;
}

// Java addnpc(world, id, x, y, time in ms): an npc that leaves after `time`
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

// Java npc.teleport(x, y): the JS model has no NPC teleport, so move it and tell the players who see it
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

// Java npc.startCombat(player), after the hook that is running has finished (the packet handler unlocks the player then)
function attackSoon(player, npc, ticks = 2) {
    player.world.setTickTimeout(() => {
        if (!npc || npc.opponent || player.opponent || (npc.skills && npc.skills.hits.current <= 0)) {
            return;
        }

        if (typeof npc.unlock === 'function') {
            npc.unlock();
        }

        Promise.resolve(npc.attack(player)).catch(() => {});
    }, ticks);
}

// the Java's click strings are the object definition's, lower case
function commandOf(entity, index) {
    const commands = (entity.definition && entity.definition.commands) || [];

    return (commands[index] || '').toLowerCase();
}

// ActionSender.sendBox(player, text, onTop): the message box, '%' breaks a line
function sendBox(player, message, onTop) {
    player.send({ type: onTop ? 'serverMessageOnTop' : 'serverMessage', message });
}

function sendTeleportBubble(player, x, y) {
    if (typeof player.sendTeleportBubble === 'function') {
        player.sendTeleportBubble(x, y, 'teleport');
    }
}

function inBounds(entity, minX, minY, maxX, maxY) {
    return entity.x >= minX && entity.x <= maxX && entity.y >= minY && entity.y <= maxY;
}

// Java changeloc(obj, delay, newId): the object looks like another for a moment
function swapObject(player, gameObject, newId, ticks) {
    const { world } = player;

    if (typeof world.replaceTimed === 'function') {
        world.replaceTimed('gameObjects', gameObject, newId, ticks);
    }
}

module.exports = {
    ITEM,
    NPC,
    OBJECT,
    TICK_MS,
    REWARD_CACHE_KEYS,
    stageOf,
    setStage,
    cacheHas,
    cacheSet,
    cacheDel,
    mes,
    delay,
    hurt,
    hitsCurrent,
    level,
    holds,
    beadsWorn,
    tooTired,
    succeed,
    spawnNpc,
    removeNpc,
    moveNpc,
    attackSoon,
    commandOf,
    sendBox,
    sendTeleportBubble,
    inBounds,
    swapObject
};
