// Shared by the Legends' Quest files in this folder (ports of Open-RSC Core-Framework authentic/quests/members/legendsquest/*.java,
// AGPL-3.0): ids, the small Open-RSC Functions.java helpers the Java calls (mes, addnpc, the cache), the quest-stage accessors and
// a menu-graph runner for the long Gujuo / Ungadulu / Radimus conversations. questStages.legendsQuest is the Java stage
// (-1 = done). https://classic.runescape.wiki/w/Legends%27_Quest
//
// The stage map (Java Quests.LEGENDS_QUEST):
//   0       Sir Radimus Erkle (735, study of the Legends Guild 517,545): "Yes actually, what's involved?" / "Yes, it sounds great!" -> 1
//           (the guard 736 at the Mithril gates 1079 (512,550) only lets a player in who has 107 quest points and Heroes', Family
//           Crest, Shilo, Underground Pass and Waterfall done; Radimus himself does not check)
//   1       the machette from the cupboard 1149, the bull roarer swung in the Kharazi jungle calls Gujuo (764): "I will release
//           Ungadulu..." sets cache legends_cavern. The rock 1151 (452,872) crevice needs Agility 50: -> 2
//   2       the Viyeldi... no: the Shaman's cave (460,3700). Beyond the flame octagram 210 (450-456 x 3704-3712) Ungadulu (766) talks
//           through the flames: "Where do I get pure water from?" -> 3
//   3       Gujuo blesses a golden bowl (smithing 2 gold bars; prayer 42), the cut reed 1249 (machette on tall reeds 1163) syphons
//           the shallow water 582 (417,889) into it, the bowl splashed on the flames 5 times douses them (rut 206). The Booking of
//           Binding (the seven gems on the carved rocks 1037) opened before Ungadulu summons Nezikchened (769): killed in the
//           octagram (450-455 x 3704-3711): -> 4
//   4       Ungadulu gives the Yommi tree seeds; a seed used on the blessed bowl with pure water germinates them: -> 5
//   5       the cut reed on the pool: the water is a black sludge: -> 6
//   6       Gujuo "Where is the source of the spring of pure water?" -> 7
//   7       the rope (237) on the wooden beam 1156 (471,3708), down it needs the Gujuo potion (cache gujuo_potion); the Viyeldi caves:
//           the heavy gate 1033 (Strength 50), the boulders (Mining 52), Echned Zekin (740) at the rocks 1116, Viyeldi (772) killed with
//           the dark dagger (cache killed_viyeldi), the three crystals from San Tojalon (663), Irvig Senay (761), Ranalph Devere (762),
//           the heart crystal fused at the lava furnace 1146 (Crafting 50), placed on the red eye rock 1148 and in the cavernous opening
//           1145 (cache cavernous_opening). Ungadulu's Holy Force Spell (1257) on Echned Zekin, and the second fight with Nezikchened in
//           the Viyeldi caves: killed -> 8
//   8       the pure water pool, a Yommi tree grown (fertile earth 1113), watered, felled (Woodcutting 50, Herblaw 45, a rune axe),
//           trimmed, crafted into a totem pole 1183; the totem pole used on the evil totem pole 1169: the third fight with Nezikchened
//           and the Viyeldi companions: killed -> 9
//   9 -> 10 the totem pole replaced (1169 / 1170): Gujuo gives the gilded totem pole 1265
//   10 -> 11 the gilded totem pole shown to Radimus with the complete map (1233)
//   11      Radimus in the Guild hall (785): four skill choices (600 + 600 per level quarter points each): -> -1, 4 quest points

const ITEM = {
    A_BLUE_WIZARDS_HAT: 1264,
    A_CHUNK_OF_CRYSTAL: 1219,
    A_GLOWING_RED_CRYSTAL: 1231,
    A_HUNK_OF_CRYSTAL: 1221,
    A_LUMP_OF_CRYSTAL: 1220,
    A_RED_CRYSTAL: 1222,
    ASHES: 181,
    BLESSED_GOLDEN_BOWL: 1266,
    BLESSED_GOLDEN_BOWL_WITH_PLAIN_WATER: 1286,
    BLESSED_GOLDEN_BOWL_WITH_PURE_WATER: 1267,
    BOOKING_OF_BINDING: 1238,
    BOWL: 341,
    BOWL_OF_WATER: 342,
    BUCKET: 21,
    BUCKET_OF_WATER: 50,
    BULL_ROARER: 1177,
    COINS: 10,
    CUT_REED_PLANT: 1249,
    DARK_DAGGER: 1255,
    DIAMOND: 161,
    EMERALD: 163,
    EMPTY_VIAL: 465,
    ENCHANTED_VIAL: 1240,
    GERMINATED_YOMMI_TREE_SEED: 1254,
    GILDED_TOTEM_POLE: 1265,
    GLOWING_DARK_DAGGER: 1256,
    GOLD_BAR: 172,
    GOLDEN_BOWL: 1188,
    GOLDEN_BOWL_WITH_PLAIN_WATER: 1287,
    GOLDEN_BOWL_WITH_PURE_WATER: 1189,
    GUJUO_POTION: 1253,
    HOLY_FORCE_SPELL: 1257,
    HOLY_WATER_VIAL: 1239,
    JADE: 893,
    JUG: 140,
    JUG_OF_WATER: 141,
    LOCKPICK: 714,
    LOGS: 14,
    MACHETTE: 1172,
    MAGICAL_FIRE_PASS: 1250,
    OPAL: 894,
    PAPYRUS: 982,
    A_LUMP_OF_CHARCOAL: 983,
    RADIMUS_SCROLLS: 1163,
    RADIMUS_SCROLLS_COMPLETE: 1233,
    RED_TOPAZ: 892,
    ROPE: 237,
    ROUGH_SKETCH_OF_A_BOWL: 1246,
    RUBY: 162,
    RUNE_AXE: 405,
    SAPPHIRE: 164,
    SCATCHED_NOTES: 1243,
    SCRAWLED_NOTES: 1242,
    SCRIBBLED_NOTES: 1241,
    SHAMANS_TOME: 1244,
    SNAKE_WEED: 816,
    ARDRIGAL: 818,
    TOTEM_POLE: 1183,
    VIAL: 464,
    YOMMI_TREE_SEED: 1182,
    // runes
    AIR_RUNE: 33,
    BLOOD_RUNE: 619,
    BODY_RUNE: 36,
    CHAOS_RUNE: 41,
    COSMIC_RUNE: 46,
    DEATH_RUNE: 38,
    EARTH_RUNE: 34,
    FIRE_RUNE: 31,
    LAW_RUNE: 42,
    LIFE_RUNE: 37,
    MIND_RUNE: 35,
    NATURE_RUNE: 40,
    SOUL_RUNE: 825,
    WATER_RUNE: 32
};

const NPC = {
    ECHNED_ZEKIN: 740,
    EVIL_UNGADULU: 767,
    GUJUO: 764,
    IRVIG_SENAY: 761,
    JUNGLE_FORESTER: 765,
    JUNGLE_SAVAGE: 776,
    JUNGLE_SPIDER: 521,
    KARAMJA_WOLF: 775,
    LEGENDS_GUILD_GUARD: 736,
    NEZIKCHENED: 769,
    OOMLIE_BIRD: 777,
    RANALPH_DEVERE: 762,
    SAN_TOJALON: 663,
    SIR_RADIMUS_ERKLE_GUILD: 785,
    SIR_RADIMUS_ERKLE_HOUSE: 735,
    UNGADULU: 766,
    VIYELDI: 772
};

const OBJECT = {
    ANCIENT_LAVA_FURNACE: 1146,
    BABY_YOMMI_TREE: 1112,
    BOOKCASE: 931,
    CARVED_ROCK: 1037,
    CAVE_ENTRANCE_FROM_BOULDERS: 1159,
    CAVE_ENTRANCE_LEAVE_DUNGEON: 1158,
    CAVERNOUS_OPENING: 1145,
    CHOPPED_YOMMI_TREE: 1109,
    CRAFTED_TOTEM_POLE: 1111,
    CRATE: 1144,
    CRUDE_BED: 1162,
    CRUDE_DESK: 1032,
    DARK_METAL_GATE: 1165,
    DEAD_YOMMI_TREE: 1141,
    ECHNED_ZEKIN_ROCK: 1116,
    FERTILE_EARTH: 1113,
    GRAND_VIZIERS_DESK: 1177,
    GROWN_YOMMI_TREE: 1108,
    HALF_BURIED_REMAINS: 1168,
    HEAVY_METAL_GATE: 1033,
    LEGENDS_CUPBOARD: 1149,
    LEGENDS_HALL_DOOR: 1080,
    MITHRIL_GATES: 1079,
    RED_EYE_ROCK: 1148,
    ROCK: 1151,
    ROPE_UP: 1167,
    ROTTEN_YOMMI_TREE: 1172,
    SHALLOW_WATER: 582,
    SMASH_BOULDERS: [1117, 1184, 1185],
    TABLE: 1161,
    TALL_REEDS: 1163,
    TOTEM_POLE: 1169,
    TOTEM_POLE_RED: 1170,
    TRIMMED_YOMMI_TREE: 1110,
    WOODEN_BEAM: 1156,
    WOODEN_BEAM_ROPE: 1157,
    YOMMI_TREE: 1107,
    // visual stand-ins
    DOORS_OPEN: 497,
    GATE_OPEN: 181,
    ROCKS_SMASHED: 1143,
    // wall objects
    FLAME_WALL: 210,
    RUT: 206,
    ANCIENT_WALL: 212,
    RUINED_WALL: 211
};

// Open-RSC delay() is one 640 ms tick; an addnpc / SingleEvent time is milliseconds
const TICK_MS = 640;

const QUEST = 'legendsQuest';

function stageOf(player) {
    return player.questStages[QUEST] || 0;
}

function setStage(player, stage) {
    player.questStages[QUEST] = stage;
}

// Java atQuestStages(player, quest, ...stages)
function atStages(player, ...stages) {
    return stages.includes(stageOf(player));
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

function cacheInt(player, key) {
    return Number(player.cache[key]) || 0;
}

// the keys the Java removes when the quest is rewarded (LegendsQuestSirRadimusErkle.handleReward)
const REWARD_CACHE_KEYS = [
    'gujuo_potion',
    'JUNGLE_EAST',
    'JUNGLE_MIDDLE',
    'JUNGLE_WEST',
    'already_cast_holy_spell',
    'ran_from_2nd_nezi',
    'legends_choose_reward',
    'legends_reward_claimed',
    'ancient_wall_runes',
    'gave_glowing_dagger',
    'met_spirit',
    'cavernous_opening',
    'viyeldi_companions',
    'killed_viyeldi',
    'legends_wooden_beam',
    'rewarded_totem',
    'holy_water_neiz',
    'crafted_totem_pole'
];

// ---- Functions.java ------------------------------------------------------------------------------------------------------

// mes("...") followed by delay(n): a quest message, then n ticks (n = 0: the message alone)
async function mes(player, message, ticks = 3) {
    player.message(`@que@${message}`);

    if (ticks > 0) {
        await player.world.sleepTicks(ticks);
    }
}

// the Java's mes(...) is followed by delay(2) nearly everywhere: several lines in a row
async function mesAll(player, ticks, ...lines) {
    for (const line of lines) {
        await mes(player, line, ticks);
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

function level(player, skill) {
    return player.skills[skill].current;
}

function baseLevel(player, skill) {
    return player.skills[skill].base;
}

// Java getSkills().setLevel(skill, value): the current level only
function setLevel(player, skill, value) {
    player.changeStat(skill, Math.max(0, value) - player.skills[skill].current);
}

// Java getSkills().decrementLevel(skill)
function decrementLevel(player, skill) {
    player.changeStat(skill, -1);
}

// Java ifheld(player, id, n)
function holds(player, id, amount = 1) {
    return player.inventory.has(id, amount);
}

function give(player, id, amount = 1) {
    player.inventory.add(id, amount);
}

function take(player, id, amount = 1) {
    player.inventory.remove(id, amount);
}

// Java getCarriedItems().remove(new Item(id, count of that item))
function takeAll(player, id) {
    const amount = player.inventory.count(id);

    if (amount > 0) {
        player.inventory.remove(id, amount);
    }

    return amount;
}

function worn(player, id) {
    return player.inventory.isEquipped(id);
}

// DataConversions.random(low, high), inclusive
function random(low, high) {
    return low + Math.floor(Math.random() * (high - low + 1));
}

// Java Random.nextInt(bound)
function nextInt(bound) {
    return Math.floor(Math.random() * bound);
}

// Formulae.failCalculation(player, skill, req): despite the name, true is a success. Below the level it never is, 20 levels above
// it always is, in between 1 - 1 / (levelDiff + 2)
function failCalculation(player, skill, req) {
    const levelDiff = level(player, skill) - req;

    if (levelDiff < 0) {
        return false;
    }

    if (levelDiff >= 20) {
        return true;
    }

    return random(0, levelDiff + 1) !== 0;
}

// Formulae.calcProductionSuccessfulLegacy(levelReq, skillLevel, stopsFailing, levelStopFail): a 1-256 roll against a threshold that
// grows with the level (64 at level 1; the cap is 255, or 256 when the skill stops failing)
function calcProduction(levelReq, skillLevel, stopsFailing, levelStopFail, minFail = 1) {
    const roll = random(1, 256);

    if (skillLevel < levelReq) {
        return false;
    }

    const maxThreshold = stopsFailing ? 256 : 256 - minFail;
    const threshold = Math.min(maxThreshold, Math.floor(64 + (skillLevel - 1) * (19200 / (levelStopFail * 98))));

    return roll <= threshold;
}

// Java ShiloVillageUtils.succeed, kept as written (the ruined wall uses it): below the required level it always succeeds, from 0 to
// 14 levels above it is 30 + difference per cent, from 15 to 19 it is always, and from 20 up it is 90 per cent.
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

// Java ifnearvisnpc(player, id, radius): the closest npc of that id within the radius, not busy
function nearNpc(player, id, radius) {
    return player.getNearbyEntitiesWithinRadius('npcs', id, radius).find((npc) => !npc.locked);
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

// Java changenpc(npc, id, keepFight): the npc becomes another one in place
function changeNpc(player, npc, id) {
    if (!npc || npc.id === id) {
        return npc;
    }

    return player.world.replaceEntity('npcs', npc, id) || npc;
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

// Java startCombat inside a dialogue: the fight starts now (the npc was spawned beside the player)
function startFight(player, npc) {
    if (!npc || npc.opponent || player.opponent) {
        return;
    }

    if (typeof npc.unlock === 'function') {
        npc.unlock();
    }

    Promise.resolve(npc.attack(player)).catch(() => {});
}

// the Java's click strings are the object definition's, lower case
function commandOf(entity, index) {
    const commands = (entity.definition && entity.definition.commands) || [];

    return (commands[index] || '').toLowerCase();
}

// ActionSender.sendBox(player, text, onTop): the message box, '%' breaks a line
function sendBox(player, message, onTop = true) {
    player.send({ type: onTop ? 'serverMessageOnTop' : 'serverMessage', message });
}

// displayTeleportBubble(player, x, y, telegrab)
function bubble(player, x, y, telegrab = false) {
    if (typeof player.sendTeleportBubble === 'function') {
        player.sendTeleportBubble(x, y, telegrab ? 'telegrab' : 'teleport');
    }
}

function inBounds(entity, minX, minY, maxX, maxY) {
    return entity.x >= minX && entity.x <= maxX && entity.y >= minY && entity.y <= maxY;
}

// Point.isInsideFlameWall / isAroundBoulderRock / isAroundTotemPole: where each of the three fights with Nezikchened is
function insideFlameWall(entity) {
    return inBounds(entity, 450, 3704, 455, 3711);
}

function aroundBoulderRock(entity) {
    return (
        inBounds(entity, 404, 3730, 418, 3744) ||
        inBounds(entity, 407, 3718, 421, 3732) ||
        inBounds(entity, 417, 3716, 431, 3730)
    );
}

function aroundTotemPole(entity) {
    return (
        inBounds(entity, 360, 881, 374, 895) ||
        inBounds(entity, 388, 889, 402, 903) ||
        inBounds(entity, 456, 882, 470, 896)
    );
}

// the Kharazi jungle (LegendsQuestBullRoarer.inKharaziJungle)
function inKharaziJungle(entity) {
    return inBounds(entity, 338, 869, 477, 908);
}

// Java changeloc(obj, delay, newId): the object looks like another for a moment
function swapObject(player, gameObject, newId, ticks) {
    const { world } = player;

    if (gameObject && typeof world.replaceTimed === 'function') {
        return world.replaceTimed('gameObjects', gameObject, newId, ticks);
    }
}

// Java changeloc(obj, new GameObject): the object stays another one
function changeObject(player, gameObject, newId) {
    if (gameObject) {
        return player.world.replaceEntity('gameObjects', gameObject, newId);
    }
}

// the object of `id` standing on (x, y), or undefined (the fakes of the tests have a plain list)
function objectAt(world, id, x, y) {
    return world.gameObjects ? world.gameObjects.getAtPoint(x, y).find((o) => o.id === id) : undefined;
}

// Java addobject(id, amount, x, y, owner): a ground item only the player sees at first
function dropFor(player, id, x, y) {
    return player.world.addPlayerDrop(player, id, x, y);
}

// Java createGroundItemDelayedRemove(item, ms): a ground item only the player sees, gone after `ticks`
function dropTimed(player, id, x, y, ticks) {
    const { world } = player;

    if (typeof world.addTimedGroundItem === 'function') {
        return world.addTimedGroundItem({ id, amount: 1, x, y, ticks, owner: player });
    }
}

// ---- a menu graph runner ------------------------------------------------------------------------------------------------------
//
// The long Java conversations are `GujuoDialogue(player, n, cID)` switches: each case has the npc speak, offers a menu and calls the
// next case. A node here is { npc: [lines], run: async (ctx) => id | undefined | END, menu: [[label, next], ...] | (ctx) => [...],
// say: true|false } and the runner follows the ids. `say` (default true, Java multi(player, n, ...)) has the player speak the picked
// option; false is the Java `multi(player, n, false, ...)` (its own say() follows when the Java has one, which `next` then does).
// A `next` that is a function runs and returns the next id.

const END = null;

async function runGraph(player, npc, nodes, startId) {
    let id = startId;

    while (id !== END && id !== undefined) {
        const node = nodes[id];

        if (!node) {
            throw new Error(`dialogue node ${id} is missing`);
        }

        if (node.npc && node.npc.length) {
            await npc.say(...node.npc);
        }

        if (node.run) {
            const result = await node.run({ player, npc });

            if (result !== undefined) {
                id = result;
                continue;
            }
        }

        const menu = typeof node.menu === 'function' ? node.menu({ player, npc }) : node.menu;

        if (!menu || !menu.length) {
            return;
        }

        const choice = await player.ask(
            menu.map((entry) => entry[0]),
            node.say !== false
        );
        let next = menu[choice][1];

        if (typeof next === 'function') {
            next = await next({ player, npc });
        }

        id = next;
    }
}

module.exports = {
    ITEM,
    NPC,
    OBJECT,
    TICK_MS,
    QUEST,
    REWARD_CACHE_KEYS,
    END,
    stageOf,
    setStage,
    atStages,
    cacheHas,
    cacheSet,
    cacheDel,
    cacheInt,
    mes,
    mesAll,
    delay,
    hurt,
    level,
    baseLevel,
    setLevel,
    decrementLevel,
    holds,
    give,
    take,
    takeAll,
    worn,
    random,
    nextInt,
    failCalculation,
    calcProduction,
    succeed,
    nearNpc,
    spawnNpc,
    removeNpc,
    moveNpc,
    changeNpc,
    attackSoon,
    startFight,
    commandOf,
    sendBox,
    bubble,
    inBounds,
    insideFlameWall,
    aroundBoulderRock,
    aroundTotemPole,
    inKharaziJungle,
    swapObject,
    changeObject,
    objectAt,
    dropFor,
    dropTimed,
    runGraph
};
