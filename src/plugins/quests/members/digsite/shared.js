// Shared constants and helpers of the Dig Site quest port (quests/members/digsite/*), from Open-RSC Core-Framework
// authentic/quests/members/digsite/*.java (AGPL-3.0). https://classic.runescape.wiki/w/Digsite
//
// questStages.digsite (the Java stages; the quest is done at -1):
//   0  the Examiner (723) in the exam centre south of the digsite (20,568): "Can I take an exam ?" gives the unstamped letter of
//      recommendation (1147) -> 1
//   1  the Curator (39) of Varrock museum stamps the letter (use it on him -> 1146); the Examiner takes the stamped letter
//      -> 2 and starts the level 1 exam at once (a first try with no help always fails)
//   2  the three students (orange 727, green 725, purple 724) each lose a rock sample and tell the exam answers for a return:
//      orange: panning (a full tray, game-objects/panning.js) -> 1148; green: pickpocketing a workman (1117, thieving 25);
//      purple: searching the bush 1073 at (32,541) -> 1149. Handing a sample back stores cache student_<colour>_c
//      The level 1 exam with all three answers (cache student_*_c) -> trowel + level 1 certificate, 3
//   3  each student tells one level 2 answer (cache student_<colour>_exam2) when asked; the level 2 exam -> certificate, 4
//   4  orange and green tell one level 3 answer (cache student_<colour>_exam3); purple wants an uncut opal first (cache
//      student_purple_opal, then student_purple_exam3); the level 3 exam -> certificate, 5
//   5  level 3 digging (specimen jar from the sacks 1076 at (15,502), specimen brush from a workman, trowel) finds the Talisman
//      of Zaros (1175): the Expert (728) swaps it for the digsite scroll (1173); use the scroll on a workman (722) for the winch
//      permission (cache digsite_winshaft). The winches 1095 (14,504) and 1053 (26,515) each need a rope tied to their bucket
//      (cache winch_rope_1, winch_rope_2) and Agility 10. The explosive compound is mixed from nitroglycerin (empty vial in the
//      barrel 1083 after a trowel opened barrel 1082, shown to the Expert), ammonium nitrate (the powder in the tent chest 1085,
//      opened with the chest key 1164 the underground workman 738 gives for begging, shown to the Expert), ground charcoal and an
//      arcenia root (Herblaw 10, Druidic Ritual done); poured over the bricks 1096 (13,3337) and lit with a tinderbox -> 6
//   6  the stone tablet (1174) lies in the altar cavern; the Expert is shown it: 2 gold bars and the quest is done (-1)
// Reward (QuestRewardRegistrar): 2 quest points, mining 1200 + 1200 x level and herblaw 500 + 500 x level (quarter points, the
// same convention as the temple-of-ikov port).
//
// Differences from the Java (marked `deviation:` where they happen): the Java keeps the examiner's CORRECT_ANSWERS in a field
// shared by every player, here it is a local; the workman a dig spot summons (addnpc 30 s, "npcWalkFromPlayer") is spawned
// as a timed npc and stays where the player stands; the think bubbles are left out.

const SOIL_IDS = [1065, 1066, 1067];

const NPC = {
    WORKMAN: 722,
    EXAMINER: 723,
    STUDENT_PURPLE: 724,
    STUDENT_GREEN: 725,
    GUIDE: 726,
    STUDENT_ORANGE: 727,
    EXPERT: 728,
    WORKMAN_UNDERGROUND: 738,
    CURATOR: 39
};

const ITEM = {
    COINS: 10,
    BONES: 20,
    NEEDLE: 39,
    GOLD: 152,
    GOLD_BAR: 172,
    IRON_DAGGER: 28,
    LEATHER_GLOVES: 16,
    BOOTS: 17,
    COPPER_ORE: 150,
    CLAY: 149,
    POT: 135,
    JUG: 140,
    ROPE: 237,
    TINDERBOX: 166,
    SPADE: 211,
    PIE_DISH: 251,
    RATS_TAIL: 271,
    CHOCOLATE_CAKE: 332,
    MEDIUM_BLACK_HELMET: 470,
    EMPTY_VIAL: 465,
    PURPLEDYE: 516,
    BRONZE_SPEAR: 827,
    BRONZE_PICKAXE: 156,
    BROKEN_GLASS: 778,
    ROTTEN_APPLES: 801,
    FRUIT_BLAST: 866,
    UNCUT_OPAL: 891,
    OPAL: 894,
    CHARCOAL: 983,
    ICE_GLOVES: 556,
    STEEL_GAUNTLETS: 698,
    GAUNTLETS_OF_GOLDSMITHING: 699,
    GAUNTLETS_OF_COOKING: 700,
    GAUNTLETS_OF_CHAOS: 701,
    KLANKS_GAUNTLETS: 1006,
    IRON_THROWING_KNIFE: 1075,
    PANNING_TRAY: 1111,
    PANNING_TRAY_GOLD_NUGGET: 1112,
    PANNING_TRAY_FULL: 1113,
    ROCK_PICK: 1114,
    SPECIMEN_BRUSH: 1115,
    SPECIMEN_JAR: 1116,
    ROCK_SAMPLE_GREEN: 1117,
    GOLD_NUGGETS: 1118,
    BOOK_OF_EXPERIMENTAL_CHEMISTRY: 1141,
    LEVEL_1_CERTIFICATE: 1142,
    LEVEL_2_CERTIFICATE: 1143,
    LEVEL_3_CERTIFICATE: 1144,
    TROWEL: 1145,
    STAMPED_LETTER: 1146,
    UNSTAMPED_LETTER: 1147,
    ROCK_SAMPLE_ORANGE: 1148,
    ROCK_SAMPLE_PURPLE: 1149,
    CRACKED_ROCK_SAMPLE: 1150,
    BELT_BUCKLE: 1151,
    OLD_BOOT: 1155,
    DAMAGED_ARMOUR_1: 1157,
    DAMAGED_ARMOUR_2: 1158,
    RUSTY_SWORD: 1159,
    AMMONIUM_NITRATE: 1160,
    NITROGLYCERIN: 1161,
    OLD_TOOTH: 1162,
    CHEST_KEY: 1164,
    BROKEN_ARROW: 1165,
    BUTTONS: 1166,
    BROKEN_STAFF: 1167,
    VASE: 1168,
    CERAMIC_REMAINS: 1169,
    BROKEN_GLASS_LVL_2: 1170,
    UNIDENTIFIED_POWDER: 1171,
    DIGSITE_SCROLL: 1173,
    STONE_TABLET: 1174,
    TALISMAN_OF_ZAROS: 1175,
    EXPLOSIVE_COMPOUND: 1176,
    MIXED_CHEMICALS_1: 1178,
    GROUND_CHARCOAL: 1179,
    MIXED_CHEMICALS_2: 1180,
    UNIDENTIFIED_LIQUID: 1232,
    ARCENIA_ROOT: 1284
};

// ItemId.NOTHING (-1) and NOTHING_INTEREST (-2): the random tables' blanks
const NOTHING = -1;
const NOTHING_INTEREST = -2;

// workmen the dig spots summon (addnpc ..., 30000) and the like, as 640 ms ticks
const WORKMAN_TICKS = Math.ceil(30000 / 640);

// DataConversions.random(low, high), inclusive. Tests replace rng.int to fix the roll
const rng = {
    int: (low, high) => low + Math.floor(Math.random() * (high - low + 1))
};

// DigsiteDigAreas.doDigsiteItemMessages: what a find is called. Used by the digging and the tray
const FIND_MESSAGES = {
    [NOTHING]: 'You find nothing',
    [-2]: 'You find nothing of interest',
    [ITEM.BONES]: 'You find some bones',
    [ITEM.PURPLEDYE]: 'You find some purple dye',
    [ITEM.POT]: 'You find an old pot',
    [ITEM.CLAY]: 'You find some clay',
    [ITEM.BROKEN_GLASS]: 'You find some broken glass',
    [ITEM.BROKEN_GLASS_LVL_2]: 'You find some broken glass',
    [ITEM.RATS_TAIL]: "You find a rat's tail",
    [ITEM.BROKEN_STAFF]: 'You find a broken staff',
    [ITEM.DAMAGED_ARMOUR_1]: 'You find some old armour',
    [ITEM.DAMAGED_ARMOUR_2]: 'You find some old armour',
    [ITEM.JUG]: 'You find an old jug',
    [ITEM.OLD_BOOT]: 'You find an old boot',
    [ITEM.VASE]: 'You find an old vase',
    [ITEM.CRACKED_ROCK_SAMPLE]: 'You find a broken rock sample',
    [ITEM.CHARCOAL]: 'You find some charcoal',
    [ITEM.BROKEN_ARROW]: 'You find a broken arrow',
    [ITEM.OPAL]: 'You find an opal',
    [ITEM.OLD_TOOTH]: 'You find an old tooth',
    [ITEM.COPPER_ORE]: 'You find some copper ore',
    [ITEM.ROTTEN_APPLES]: 'You find a rotten apple',
    [ITEM.BUTTONS]: 'You find some buttons',
    [ITEM.RUSTY_SWORD]: 'You find a rusty sword',
    [ITEM.TALISMAN_OF_ZAROS]: 'You find a strange talisman',
    [ITEM.BRONZE_SPEAR]: 'You find a bronze spear',
    [ITEM.PIE_DISH]: 'You find a pie dish',
    [ITEM.NEEDLE]: 'You find a needle',
    [ITEM.IRON_THROWING_KNIFE]: 'You find a throwing knife',
    [ITEM.MEDIUM_BLACK_HELMET]: 'You find an black helmet', // sic
    [ITEM.CERAMIC_REMAINS]: 'You find some old pottery',
    [ITEM.BELT_BUCKLE]: 'You find a belt buckle',
    [ITEM.IRON_DAGGER]: 'You find a dagger'
};

function findMessage(item, level3) {
    if (item === ITEM.COINS) {
        return level3 ? 'You find some coins' : 'You find a coin';
    }

    return FIND_MESSAGES[item];
}

function stageOf(player) {
    return player.questStages.digsite || 0;
}

function setStage(player, stage) {
    player.questStages.digsite = stage;
}

// Open-RSC mes(...) followed by delay(3)
async function mes(player, message, ticks = 3) {
    player.message(`@que@${message}`);
    await player.world.sleepTicks(ticks);
}

// give(player, id, amount): an add; a full pack drops it to the ground (Inventory#add)
function give(player, id, amount = 1) {
    player.inventory.add(id, amount);
}

function inBounds(player, minX, minY, maxX, maxY) {
    return player.x >= minX && player.x <= maxX && player.y >= minY && player.y <= maxY;
}

// the object's command text for a CommandOne (index 0) or CommandTwo (index 1) click, lowercase
function commandOf(gameObject, index) {
    const commands = (gameObject.definition && gameObject.definition.commands) || [];

    return String(commands[index] || '').toLowerCase();
}

// Open-RSC addnpc(workman) at the player: the "Oi!" workman. `script` gets the npc to speak and returns when done
async function withWorkman(player, script) {
    const { world } = player;
    const workman = world.spawnTimedNPC({ id: NPC.WORKMAN, x: player.x, y: player.y, ticks: WORKMAN_TICKS });

    try {
        await script(workman);
    } finally {
        world.removeEntity('npcs', workman);
    }
}

// DigsiteWorkman, StudentsX etc: the nearest idle npc of the id within a Java radius
function findNpc(player, id, radius) {
    return player.getNearbyEntitiesWithinRadius('npcs', id, radius).find((npc) => !npc.locked);
}

// Digsite.handleReward + sendQuestComplete
function completeQuest(player) {
    delete player.cache.winch_rope_2;
    delete player.cache.winch_rope_1;
    delete player.cache.digsite_winshaft;

    player.completeQuest('digsite', {
        questPoints: 2,
        experience: {
            mining: 1200 + 1200 * player.skills.mining.base,
            herblaw: 500 + 500 * player.skills.herblaw.base
        },
        message: 'Congratulations, you have finished the digsite quest'
    });
}

// the digsite regions (DigsiteDigAreas.java)
function inTrainingArea(player) {
    return inBounds(player, 13, 526, 17, 529) || inBounds(player, 24, 526, 27, 529);
}

function inLevel1Area(player) {
    return inBounds(player, 19, 516, 21, 526) || inBounds(player, 13, 516, 17, 524);
}

function inLevel2Area(player) {
    return (
        inBounds(player, 24, 514, 26, 516) || inBounds(player, 14, 506, 15, 509) || inBounds(player, 20, 505, 27, 509)
    );
}

function inLevel3Area(player) {
    return inBounds(player, 10, 495, 14, 499) || inBounds(player, 23, 518, 28, 524);
}

function inDigsite(player) {
    return inBounds(player, 5, 492, 42, 545);
}

module.exports = {
    SOIL_IDS,
    NPC,
    ITEM,
    NOTHING,
    NOTHING_INTEREST,
    WORKMAN_TICKS,
    rng,
    FIND_MESSAGES,
    findMessage,
    stageOf,
    setStage,
    mes,
    give,
    inBounds,
    commandOf,
    withWorkman,
    findNpc,
    completeQuest,
    inTrainingArea,
    inLevel1Area,
    inLevel2Area,
    inLevel3Area,
    inDigsite
};
