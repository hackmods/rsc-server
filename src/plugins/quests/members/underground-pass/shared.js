// Shared by the Underground Pass files in this folder (ports of Open-RSC Core-Framework authentic/quests/members/undergroundpass/
// *.java, AGPL-3.0: npcs/ (Koftik, Kardia, Dwarfs, Iban, IbanDisciple, Kalrag, Paladin, Slaves, Demons), obstacles/ (Map1, Map2,
// Map3, AgilityObstacles, Orbs, DungeonFloor, Puzzle, SmearDollOfIban, Well), mechanism/ (Map1, Map2) and the event
// UndergroundPassMessages): ids, the small Open-RSC Functions.java helpers the Java calls (mes, the cache, giving items) and the
// quest-stage accessors. questStages.undergroundPass is the Java stage (-1 = done). https://classic.runescape.wiki/w/Underground_Pass
//
// The stage map:
//   0 -> 1  King Lathas (quests/members/biohazard.js, after Biohazard)
//   1 -> 2  Koftik outside the cave (713,582) or the cave entrance (725) with him near: koftik.js
//   2 -> 3  the lit arrow fired at the old bridge (726, ranged 25): cave-map1.js
//   3 -> 4  the loose railing of the unicorn cage (168) tipping the boulder (867): cave-map2.js
//   4 -> 5  falling off an obstacle of the black area (agility.js), or Koftik cannot be told: Niloof (642) next
//   5 -> 6  Niloof (dwarves.js)
//   6 -> 7  the temple door (793,3469) with the doll smeared with all four elements (temple.js), also reachable from stage 7
//   7 -> 8  the doll thrown into the Pit of the Damned (913) with Iban near: temple.js
//   8 -> -1 King Lathas (biohazard.js calls completeUndergroundPass): 5 quest points, agility and attack
// The doll of Iban's four elements are cache flags: poison_on_doll (Kalrag's blood), cons_on_doll (the conscience of the caged
// souless), ash_on_doll (the burnt tomb) and shadow_on_doll (the three demons' amulets in the chest).

const ITEM = {
    AMULET_OF_DOOMION: 1010,
    AMULET_OF_HOLTHION: 1011,
    AMULET_OF_OTHAINIAN: 1009,
    A_DOLL_OF_IBAN: 1004,
    ARROW: 984,
    BREAD: 138,
    BUCKET: 21,
    CHOCOLATE_BOMB: 907,
    COAT_OF_ARMS_BLUE: 999,
    COAT_OF_ARMS_RED: 998,
    COINS: 10,
    DAMP_CLOTH: 989,
    DEATH_RUNE: 38,
    DWARF_BREW: 1001,
    FIRE_RUNE: 31,
    FULL_STAT_RESTORATION_POTION: 477,
    FULL_SUPER_ATTACK_POTION: 486,
    IBANS_ASHES: 1002,
    IBANS_CONSCIENCE: 1008,
    IBANS_SHADOW: 1007,
    KARDIA_CAT: 1003,
    KLANKS_GAUNTLETS: 1006,
    LIT_ARROW: 985,
    MEAT_PIE: 259,
    MEAT_PIZZA: 326,
    OLD_JOURNAL: 1005,
    ORB_OF_LIGHT_BLUE: 992,
    ORB_OF_LIGHT_PINK: 993,
    ORB_OF_LIGHT_WHITE: 991,
    ORB_OF_LIGHT_YELLOW: 994,
    PLANK: 410,
    RAILING: 995,
    ROBE_OF_ZAMORAK_BOTTOM: 703,
    ROBE_OF_ZAMORAK_TOP: 702,
    ROCKS: 986,
    ROPE: 237,
    SALMON: 357,
    STAFF_OF_IBAN: 1000,
    STAFF_OF_IBAN_BROKEN: 1031,
    STEW: 346,
    TINDERBOX: 166,
    TWO_ATTACK_POTION: 475,
    TWO_RESTORE_PRAYER_POTION: 484,
    UNICORN_HORN: 997
};

const NPC = {
    DARK_MAGE: 667,
    DOOMION: 646,
    HOLTHION: 647,
    IBAN: 649,
    IBAN_DISCIPLE: 658,
    KALRAG: 641,
    KAMEN: 657,
    KARDIA: 643,
    KING_LATHAS: 512,
    KLANK: 648,
    KOFTIK_ARDOUGNE: 626,
    KOFTIK_CAVE1: 627,
    KOFTIK_CAVE2: 628,
    KOFTIK_CAVE3: 629,
    KOFTIK_CAVE4: 650,
    KOFTIK_RECOVERED: 659,
    NILOOF: 642,
    OTHAINIAN: 645,
    PALADIN_UNDERGROUND: 633,
    PALADIN_UNDERGROUND_BEARD: 632,
    SLAVE_1: 634,
    SLAVE_7: 640,
    SOULESS_HUMAN: 644
};

const OBJECT = {
    // the cave and map 1
    BLESSED_SPIDER_SWAMP: 795,
    CLEAR_ROCKS: 772,
    CLEAR_ROCKS_INIT_EAST: 797,
    CLEAR_ROCKS_INIT_WEST: 796,
    CLEAR_ROCKS_TRAP: 773,
    CRUMBLED_ROCK: 728,
    FIRE: 97,
    FIRST_SWAMP: 754,
    OLD_BRIDGE: 726,
    PILE_OF_MUD_MAP_1: 767,
    SPEAR_TRAP: 805,
    STALACTITE_1: 771,
    STALACTITE_2: 798,
    STALACTITE_3: 799,
    SWAMP_ROCKS: 774,
    UNDERGROUND_CAVE: 725,
    // map 2
    BOULDER: 867,
    CAGE_REMAINS: 871,
    CRATE: 868,
    FLAMES_OF_ZAMORAK: 830,
    GATE_OF_IBAN: 722,
    GATE_OF_ZAMORAK: 875,
    HIJACK_ROCK: 856,
    LEDGE_MAP_2: 837,
    OPEN_DOOR: 723,
    PASSAGE: 873,
    SNAP_TRAP: 826,
    WALL_GRILL_EAST: 836,
    WALL_GRILL_WEST: 838,
    // orbs
    FURNACE: 813,
    SOUTH_WEST_PASSAGE: 815,
    SOUTH_WEST_PASSAGE_CLIMB_UP: 816,
    SOUTH_WEST_PASSAGE_CLIMB_UP_ROPE: 817,
    SOUTH_WEST_STALAGMITE: 818,
    WOODEN_PLANKS: 827,
    // the dungeon floor, the grills and the well
    DWARF_BARREL: 880,
    FAIL_GRILL: 782,
    LADDER: 920,
    LEVER_PUZZLE: 801,
    PILE_OF_MUD_FLOOR: 890,
    SPIKED_PIT: 778,
    TOMB_OF_IBAN: 878,
    CLAWS_OF_IBAN: 879,
    WELL: 814,
    WALK_HERE_ROCK_EAST: 792,
    WALK_HERE_ROCK_WEST: 793,
    // the black area
    FIRST_REMAINING_BRIDGE: 891,
    NORTH_STONE_STEP: 889,
    SOUTH_STONE_STEP: 921,
    // Kardia and the temple
    DEMONS_CHEST_CLOSED: 912,
    DEMONS_CHEST_OPEN: 911,
    PIT_OF_THE_DAMNED: 913,
    TEMPLE_DOOR: 869,
    TEMPLE_DOOR_OPEN: 914,
    WITCH_CHEST: 885,
    // wall objects
    SPIDER_NEST_RAILING: 171,
    WITCH_DOOR: 173,
    WITCH_RAILING: 172
};

// Open-RSC delay() is one 640 ms tick; an addloc/addnpc time is milliseconds
const TICK_MS = 640;

function stageOf(player) {
    return player.questStages.undergroundPass || 0;
}

function setStage(player, stage) {
    player.questStages.undergroundPass = stage;
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

const ORB_KEYS = ['orb_of_light1', 'orb_of_light2', 'orb_of_light3', 'orb_of_light4'];

function allOrbsBurnt(player) {
    return ORB_KEYS.every((key) => cacheHas(player, key));
}

function dollDone(player) {
    return ['poison_on_doll', 'cons_on_doll', 'ash_on_doll', 'shadow_on_doll'].every((key) => cacheHas(player, key));
}

// the keys the Java removes when Iban is destroyed (UndergroundPassIban); the doll's four smears among them
const IBAN_DEAD_CACHE_KEYS = [
    ...ORB_KEYS,
    'stalagmite',
    'crate_food',
    'paladin_food',
    'brew_on_tomb',
    'rope_wall_grill',
    'flames_of_zamorak1',
    'flames_of_zamorak2',
    'flames_of_zamorak3',
    'doll_of_iban',
    'kardia_cat',
    'poison_on_doll',
    'cons_on_doll',
    'ash_on_doll',
    'shadow_on_doll'
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

// Java give(player, id, n)
function give(player, id, amount = 1) {
    player.inventory.add(id, amount);
}

// Java getCarriedItems().remove(new Item(id, n))
function take(player, id, amount = 1) {
    player.inventory.remove(id, amount);
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

// Formulae.calcProductionSuccessfulLegacy(levelReq, skillLevel, stopsFailing, levelStopFail): a 1-256 roll against a threshold
// that grows with the level (64 at level 1; the cap is 255, or 256 when the skill stops failing)
function calcProduction(levelReq, skillLevel, stopsFailing, levelStopFail) {
    const roll = random(1, 256);

    if (skillLevel < levelReq) {
        return false;
    }

    const maxThreshold = stopsFailing ? 256 : 255;
    const threshold = Math.min(maxThreshold, Math.floor(64 + (skillLevel - 1) * (19200 / (levelStopFail * 98))));

    return roll <= threshold;
}

// the agility test of every rock, ledge and bridge here: calcProductionSuccessfulLegacy(1, agility, false, 71)
function agilityCheck(player, req = 1) {
    return calcProduction(req, player.skills.agility.current, false, req + 70);
}

// the Java ladder/obstacle helpers read player.getX() at the moment of the click
function isNear(entity, x, y) {
    return entity.x === x && entity.y === y;
}

// Java ifnearvisnpc(player, id, radius): the closest npc of that id within the radius, not busy
function nearNpc(player, id, radius) {
    return player.getNearbyEntitiesWithinRadius('npcs', id, radius).find((npc) => !npc.locked);
}

// Java addobject(id, amount, x, y, owner): a ground item only the player sees at first
function dropFor(player, id, x, y) {
    return player.world.addPlayerDrop(player, id, x, y);
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
function sendBox(player, message, onTop = true) {
    player.send({ type: onTop ? 'serverMessageOnTop' : 'serverMessage', message });
}

// displayTeleportBubble(player, x, y, telegrab)
function bubble(player, x, y, telegrab = false) {
    if (typeof player.sendTeleportBubble === 'function') {
        player.sendTeleportBubble(x, y, telegrab ? 'telegrab' : 'teleport');
    }
}

// the object of `id` standing on (x, y), or undefined (the fakes of the tests have a plain list)
function objectAt(world, id, x, y) {
    return world.gameObjects ? world.gameObjects.getAtPoint(x, y).find((o) => o.id === id) : undefined;
}

// Java replaceGameObject(obj, new) + delayedSpawnObject(loc, ms) / changeloc(obj, ms, id): the object looks like another for
// a moment and then is itself again
function swapObject(player, gameObject, newId, ticks) {
    const { world } = player;

    if (gameObject && typeof world.replaceTimed === 'function') {
        return world.replaceTimed('gameObjects', gameObject, newId, ticks);
    }
}

// Java changeloc(obj, new) with no time: the object stays another one
function changeObject(player, gameObject, newId) {
    if (gameObject) {
        return player.world.replaceEntity('gameObjects', gameObject, newId);
    }
}

// Java registerGameObject(new) + delayedRemoveObject(ms): an object appears for a moment
function addTimedObject(player, id, x, y, direction, ticks) {
    const { world } = player;

    if (typeof world.addTimedObject === 'function') {
        return world.addTimedObject({ id, x, y, direction, ticks });
    }

    const GameObject = require('../../../../model/game-object');
    const object = new GameObject(world, { id, x, y, direction });

    world.addEntity('gameObjects', object);
    world.setTickTimeout(() => {
        if (world.gameObjects.getByIndex(object.index) === object) {
            world.removeEntity('gameObjects', object);
        }
    }, ticks);

    return object;
}

// Java delloc(obj) + addloc(world, loc, ms): the object is gone for a moment
function hideObject(player, gameObject, ticks) {
    const { world } = player;
    const { id, x, y, direction } = gameObject;

    world.removeEntity('gameObjects', gameObject);
    world.setTickTimeout(() => {
        const GameObject = require('../../../../model/game-object');

        world.addEntity('gameObjects', new GameObject(world, { id, x, y, direction }));
    }, ticks);
}

// UndergroundPassMessages: a few ticks after a rock, ledge or bridge, one of the voices of the cave may speak
function ibanVoices(player, minTicks, maxTicks) {
    player.world.setTickTimeout(() => {
        if (player.loggedIn === false) {
            return;
        }

        const roll = nextInt(6);
        const stage = stageOf(player);

        if (roll === 0) {
            player.message('@red@iban will save you....he\'ll save us all');
        } else if (roll === 1) {
            player.message('@red@join us...join us...embrace the mysery');
        } else if (roll === 2 && stage >= 4) {
            player.message("@red@I see you adventurer...you can't hide");
        } else if (roll === 3 && stage >= 4) {
            player.message('@red@Come taste the pleasure of evil');
        } else if (roll === 4 && stage >= 4) {
            player.message('@red@Death is only the beginning');
        }
    }, random(minTicks, maxTicks));
}

// ---- the end of the quest ------------------------------------------------------------------------------------------------

// UndergroundPassKoftik.handleReward: 5 quest points and agility and attack (QuestRewardRegistrar 41: 2000 + 200 per level,
// quarter points), the staff of Iban's charges (25 casts of Iban blast) and the end of the warning flag
function completeUndergroundPass(player) {
    cacheSet(player, 'Iban blast_casts', 25);
    cacheDel(player, 'advised_koftik');

    player.completeQuest('undergroundPass', {
        questPoints: 5,
        experience: {
            agility: 2000 + 200 * player.skills.agility.base,
            attack: 2000 + 200 * player.skills.attack.base
        },
        message: 'you have completed the underground pass quest'
    });
}

module.exports = {
    ITEM,
    NPC,
    OBJECT,
    ORB_KEYS,
    IBAN_DEAD_CACHE_KEYS,
    TICK_MS,
    stageOf,
    setStage,
    atStages,
    cacheHas,
    cacheSet,
    cacheDel,
    allOrbsBurnt,
    dollDone,
    mes,
    delay,
    hurt,
    hitsCurrent,
    level,
    holds,
    give,
    take,
    worn,
    random,
    nextInt,
    calcProduction,
    agilityCheck,
    isNear,
    nearNpc,
    dropFor,
    removeNpc,
    attackSoon,
    commandOf,
    sendBox,
    bubble,
    objectAt,
    swapObject,
    changeObject,
    addTimedObject,
    hideObject,
    ibanVoices,
    completeUndergroundPass
};
