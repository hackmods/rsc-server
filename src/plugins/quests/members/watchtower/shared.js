// Shared constants and helpers of the Watchtower quest port (quests/members/watchtower/*), from Open-RSC Core-Framework
// authentic/quests/members/watchtower/*.java (WatchTowerDialogues, WatchTowerGateObstacles, WatchTowerGorad,
// WatchTowerMechanism, WatchTowerObstacles, WatchTowerShaman), the Watchtower parts of authentic/itemactions/InvAction.java
// and authentic/skills/herblaw/Herblaw.java (AGPL-3.0). https://classic.runescape.wiki/w/Watchtower
//
// Already on the server before this port (game-objects/watchtower-obstacles.js, object-tele-points.js): the Gu'Tanoth rock jump
// (995, 996), the cave enclave 955 (the nightshade guard), the Rock of Dalgroth 1026, the skavid caves, the dark place, the tunnel
// cave 998, the island ladder 997, the skavid hole 969, the cave exits 187-192 and the ogre trader shop. This port adds the rest.
//
// questStages.watchtower (the Java stages; the quest is done at -1):
//   0  the Watchtower wizard (672) in the Yanille tower (637,2625): "What's the matter ?" ... "Can I be of help ?" -> 1. The tower
//      guard (575) lets nobody up the ladder 659 (638,741) until the quest is started
//   1  search the bushes (961 fingernails at 638,722; 993 armour; 992 eye patch; 991 robe; 990 dagger; 960 nothing) and show the
//      fingernails (1036) to the wizard: "What do you suggest that I do ?" / "So what do I do ?" -> 2
//   2  the ogre settlements: 4 relic parts (cache flags in brackets) make the ogre relic (1044)
//        Grew (681, 663,759) wants an ogre tooth: "Don't eat me, I can help you" (ogre_grew); Gorad (683, 607,794) fights once
//          ogre_grew is set and drops the tooth (ogre tooth 1043) on his death; the tooth to Grew: relic part base (1049) + powering
//          crystal 1 (1037) (ogre_relic_part_2)
//        Og (680, 662,738) gives a key (1047) (ogre_og) for Toban's chest 978 (606,804) holding the stolen gold (1040); the gold to
//          Og: relic part head (1048) (ogre_relic_part_3)
//        Toban (682, 606,803) wants a dragon bone (814) (ogre_toban): relic part body (1050) (ogre_relic_part_1)
//      the three parts to the wizard (wizard_relic_part_1..3) -> the complete ogre relic (1044) -> 3
//   3  the west gate guard (676) at Gu'Tanoth's gate 989 (666,772): shown the relic -> cache has_ogre_companionship. The city guard
//      (691) at (636,793): "I seek passage into the skavid caves" gives a riddle (city_guard_riddle false), the answer is a death rune
//      (38) used on him: the skavid map (1045), city_guard_riddle true -> 4
//   4  the skavid caves (a lit light and the map; teleport caves 970 972 950 971 949 975): the initial skavid (678): "Okay okay i'm
//      not going to hurt you" (skavid_started_language) -> 5
//   5  talk to the four skavids 696 (Ig) 707 (Ar) 708 (Cur) 709 (Nod) with their word (language_ig, _ar, _cur, _nod); the final quiz
//      skavid (679) answers the sayings and gives powering crystal 2 (1152) (skavid_completed_language). Nightshade (1086) to the
//      cave guard 684 at (662,789) runs you past him to the shaman cave (647,3644); the shaman robe (1087) lying at (664,3614):
//      taking it at stage 5 -> 6
//   6  talk to the wizard: the potion hint -> 7
//   7  an ogre potion (1053: vial of water + guam leaf, jangerberries, ground bat bones, Herblaw 14, Druidic Ritual done) to the
//      wizard: the magic ogre potion (1054) -> 8
//   8  the magic ogre potion used on each of the six ogre shamans (673; cache shaman_count): the sixth drops powering crystal 3
//      (1153) and returns the vial, -> 9. A lost crystal 3 is found again by searching the shaman robe
//   9  the Rock of Dalgroth (1026, 646,3615), Mining 40: powering crystal 4 (1154). Showing crystal 4 to the wizard first sets
//      cache crystal_rock. With all four crystals carried, showing any to the wizard -> 10
//   10 the lever 1014 (636,2624) at the top of the tower: the forcefield works, reward and the quest is done (-1)
// Reward (QuestRewardRegistrar): 4 quest points, magic 1000 + 1000 x level (quarter points, as the temple-of-ikov port), 5000 coins
// and the spell scroll (1181) that teaches the Watchtower teleport (cache watchtower_scroll).
//
// Differences from the Java (marked `deviation:` where they happen): the teleport bubbles and think bubbles are left out; a
// plugin's `n.startCombat(player)` is the npc attacking the player once the talk is over; Gorad's death drop is added to the
// default death (the Java kill trigger replaces it).

const NPC = {
    TOWER_GUARD: 575,
    WATCHTOWER_WIZARD: 672,
    OGRE_SHAMAN: 673,
    OGRE_GUARD_EASTGATE: 675,
    OGRE_GUARD_WESTGATE: 676,
    OGRE_GUARD_BATTLEMENT: 677,
    SKAVID_INITIAL: 678,
    SKAVID_FINALQUIZ: 679,
    OG: 680,
    GREW: 681,
    TOBAN: 682,
    GORAD: 683,
    OGRE_GUARD_CAVE_ENTRANCE: 684,
    OGRE_TRADER_ROCKCAKE: 688,
    OGRE_TRADER_FOOD: 689,
    CITY_GUARD: 691,
    SKAVID_IG: 696,
    OGRE_CITIZEN: 704,
    OGRE_GENERAL: 706,
    SKAVID_AR: 707,
    SKAVID_CUR: 708,
    SKAVID_NOD: 709,
    POISON_SCORPION: 271,
    POISON_SPIDER: 292,
    CHAOS_DWARF: 190,
    RAT_LVL8: 19
};

const ITEM = {
    COINS: 10,
    IRON_DAGGER: 28,
    DEATH_RUNE: 38,
    KEY: 1047,
    EMERALD: 163,
    GOLD_BAR: 172,
    WIZARDS_ROBE: 184,
    GOBLIN_ARMOUR: 273,
    BURNT_PIKE: 365,
    BONES: 20,
    VIAL: 464,
    EMPTY_VIAL: 465,
    GUAM_LEAF: 444,
    BAT_BONES: 604,
    EYE_PATCH: 609,
    LIT_CANDLE: 601,
    LIT_BLACK_CANDLE: 602,
    LIT_TORCH: 774,
    ROTTEN_APPLES: 801,
    DRAGON_BONES: 814,
    JANGERBERRIES: 936,
    FINGERNAILS: 1036,
    POWERING_CRYSTAL1: 1037,
    STOLEN_GOLD: 1040,
    OGRE_TOOTH: 1043,
    OGRE_RELIC: 1044,
    SKAVID_MAP: 1045,
    OGRE_RELIC_PART_HEAD: 1048,
    OGRE_RELIC_PART_BASE: 1049,
    OGRE_RELIC_PART_BODY: 1050,
    GROUND_BAT_BONES: 1051,
    UNFINISHED_OGRE_POTION: 1052,
    OGRE_POTION: 1053,
    MAGIC_OGRE_POTION: 1054,
    ROCK_CAKE: 1061,
    UNFINISHED_POTION: 1074,
    NIGHTSHADE: 1086,
    SHAMAN_ROBE: 1087,
    POWERING_CRYSTAL2: 1152,
    POWERING_CRYSTAL3: 1153,
    POWERING_CRYSTAL4: 1154,
    SPELL_SCROLL: 1181,
    ROBE: 1234,
    ARMOUR: 1235,
    DAGGER: 1236,
    WATCH_TOWER_EYE_PATCH: 1237
};

const CRYSTALS = [ITEM.POWERING_CRYSTAL1, ITEM.POWERING_CRYSTAL2, ITEM.POWERING_CRYSTAL3, ITEM.POWERING_CRYSTAL4];

const RELIC_PARTS = [ITEM.OGRE_RELIC_PART_BODY, ITEM.OGRE_RELIC_PART_BASE, ITEM.OGRE_RELIC_PART_HEAD];

const LIGHT_SOURCES = [ITEM.LIT_CANDLE, ITEM.LIT_BLACK_CANDLE, ITEM.LIT_TORCH];

function stageOf(player) {
    return player.questStages.watchtower || 0;
}

function setStage(player, stage) {
    player.questStages.watchtower = stage;
}

// the quest is done: stage -1
function isDone(player) {
    return stageOf(player) === -1;
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

// the Java's `n.startCombat(player)` / `n.setChasing(player)`: the npc goes for the player once the talk is over
function chase(player, npc) {
    if (npc && typeof npc.attack === 'function') {
        Promise.resolve(npc.attack(player)).catch(() => {});
    }
}

// ifnearvisnpc(player, id, radius): the nearest idle npc of the id within a Java radius
function findNpc(player, id, radius) {
    return player.getNearbyEntitiesWithinRadius('npcs', id, radius).find((npc) => !npc.locked);
}

// the object's command text for a CommandOne (index 0) or CommandTwo (index 1) click, lowercase
function commandOf(gameObject, index) {
    const commands = (gameObject.definition && gameObject.definition.commands) || [];

    return String(commands[index] || '').toLowerCase();
}

// DataConversions.random(low, high), inclusive. Tests replace rng.int to fix the roll
const rng = {
    int: (low, high) => low + Math.floor(Math.random() * (high - low + 1))
};

// Open-RSC Player#hasCarried(id): carried, not banked
function carries(player, id) {
    return player.inventory.has(id);
}

// addnpc(..., 60000 * n) as 640 ms ticks
const ticksOf = (ms) => Math.ceil(ms / 640);

// Quest.WATCHTOWER.reward(), applied by the lever 1014 (WatchTowerObstacles) at stage 10
function completeQuest(player) {
    player.completeQuest('watchtower', {
        questPoints: 4,
        experience: { magic: 1000 + 1000 * player.skills.magic.base },
        message: 'Congratulations, you have finished the watchtower quest'
    });
}

module.exports = {
    NPC,
    ITEM,
    CRYSTALS,
    RELIC_PARTS,
    LIGHT_SOURCES,
    stageOf,
    setStage,
    isDone,
    mes,
    give,
    chase,
    findNpc,
    commandOf,
    rng,
    carries,
    ticksOf,
    completeQuest
};
