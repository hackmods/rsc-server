// Ranged weapon and ammunition numbers from Open-RSC (authentic formulas,
// Wave 1). @2003scape/rsc-data ranged.json keeps its own scale (bow accuracy
// 6..69, arrow power 7..49) and has no thrown weapons at all, so the combat
// formula reads these tables instead:
//
//  - RANGED_AIM: CombatFormula.rangedAim(bowId) (server/src/com/openrsc/server/
//    event/rsc/impl/combat/CombatFormula.java:448-538), the bow's or the thrown
//    weapon's aim
//  - RANGED_POWER: CombatFormula.rangedPower(arrowId) (CombatFormula.java:355-443),
//    the arrow's, bolt's or thrown weapon's power
//  - THROWING_IDS: Formulae.throwingIDs (util/rsc/Formulae.java:38-51), the items
//    a player throws when one is wielded (ThrowingEvent.java)
//  - THROWING_DARTS: RangeUtils.THROWING_DARTS (RangeUtils.java:92-105), thrown
//    from 4 tiles, knives and spears from 3 (ThrowingEvent.canReach)
//  - POISONED_ITEMS: RangeUtils.POISONED_ITEMS (RangeUtils.java:107-141)
//
// Item ids are Open-RSC ItemId.java catalog ids, which are rsc-data's.

const SHORTBOW = 189;
const LONGBOW = 188;
const CROSSBOW = 60;
const PHOENIX_CROSSBOW = 59;

const DARTS = {
    bronze: 1013,
    iron: 1015,
    steel: 1024,
    mithril: 1068,
    adamantite: 1069,
    rune: 1070
};

const POISONED_DARTS = {
    bronze: 1122,
    iron: 1123,
    steel: 1124,
    mithril: 1125,
    adamantite: 1126,
    rune: 1127
};

const KNIVES = {
    iron: 1075,
    bronze: 1076,
    steel: 1077,
    mithril: 1078,
    adamantite: 1079,
    rune: 1080,
    black: 1081
};

const POISONED_KNIVES = {
    bronze: 1128,
    iron: 1129,
    steel: 1130,
    mithril: 1131,
    black: 1132,
    adamantite: 1133,
    rune: 1134
};

const SPEARS = {
    bronze: 827,
    iron: 1088,
    steel: 1089,
    mithril: 1090,
    adamantite: 1091,
    rune: 1092
};

const POISONED_SPEARS = {
    bronze: 1135,
    iron: 1136,
    steel: 1137,
    mithril: 1138,
    adamantite: 1139,
    rune: 1140
};

// both the plain and the poisoned item of a metal
function both(plain, poisoned, metal, value, into) {
    into[plain[metal]] = value;
    into[poisoned[metal]] = value;
}

// CombatFormula.rangedAim
const RANGED_AIM = {
    [SHORTBOW]: 10,
    [CROSSBOW]: 12,
    [PHOENIX_CROSSBOW]: 12,
    [LONGBOW]: 15,
    649: 15, // oak shortbow
    651: 20, // willow shortbow
    648: 20, // oak longbow
    653: 25, // maple shortbow
    650: 25, // willow longbow
    655: 30, // yew shortbow
    652: 30, // maple longbow
    657: 35, // magic shortbow
    654: 35, // yew longbow
    656: 40, // magic longbow
    1453: 40 // dragon crossbow
};

for (const [metal, aim] of Object.entries({
    bronze: 25,
    iron: 30,
    steel: 35,
    mithril: 40,
    adamantite: 45,
    rune: 50
})) {
    both(DARTS, POISONED_DARTS, metal, aim, RANGED_AIM);
}

for (const [metal, aim] of Object.entries({
    bronze: 30,
    iron: 35,
    steel: 40,
    black: 40,
    mithril: 45,
    adamantite: 50,
    rune: 55
})) {
    both(KNIVES, POISONED_KNIVES, metal, aim, RANGED_AIM);
}

for (const [metal, aim] of Object.entries({
    bronze: 25,
    iron: 33,
    steel: 41,
    mithril: 49,
    adamantite: 57,
    rune: 65
})) {
    both(SPEARS, POISONED_SPEARS, metal, aim, RANGED_AIM);
}

// CombatFormula.rangedPower
const RANGED_POWER = {
    11: 15, // bronze arrows
    574: 15, // poison bronze arrows
    638: 20, // iron arrows
    639: 20, // poison iron arrows
    190: 20, // crossbow bolts
    592: 20, // poison crossbow bolts
    640: 25, // steel arrows
    641: 25, // poison steel arrows
    642: 30, // mithril arrows
    643: 30, // poison mithril arrows
    786: 30, // oyster pearl bolts
    644: 35, // adamantite arrows
    645: 35, // poison adamantite arrows
    646: 40, // rune arrows
    647: 40, // poison rune arrows
    1449: 50, // dragon arrows
    1450: 50, // poison dragon arrows
    1451: 50, // dragon bolts
    1452: 50 // poison dragon bolts
};

for (const [metal, power] of Object.entries({
    bronze: 15,
    iron: 17,
    steel: 22,
    mithril: 25,
    adamantite: 27,
    rune: 30
})) {
    both(DARTS, POISONED_DARTS, metal, power, RANGED_POWER);
}

for (const [metal, power] of Object.entries({
    bronze: 25,
    iron: 30,
    steel: 35,
    black: 35,
    mithril: 40,
    adamantite: 45,
    rune: 50
})) {
    both(KNIVES, POISONED_KNIVES, metal, power, RANGED_POWER);
}

for (const [metal, power] of Object.entries({
    bronze: 29,
    iron: 37,
    steel: 46,
    mithril: 53,
    adamantite: 61,
    rune: 69
})) {
    both(SPEARS, POISONED_SPEARS, metal, power, RANGED_POWER);
}

const THROWING_DARTS = new Set([
    ...Object.values(DARTS),
    ...Object.values(POISONED_DARTS)
]);

const THROWING_IDS = new Set([
    ...THROWING_DARTS,
    ...Object.values(KNIVES),
    ...Object.values(POISONED_KNIVES),
    ...Object.values(SPEARS),
    ...Object.values(POISONED_SPEARS)
]);

const POISONED_ITEMS = new Set([
    ...Object.values(POISONED_DARTS),
    ...Object.values(POISONED_KNIVES),
    ...Object.values(POISONED_SPEARS),
    1450, // poison dragon arrows
    1452 // poison dragon bolts
]);

// ThrowingEvent.canReach: darts 4 tiles, knives and spears 3
function throwingRadius(id) {
    return THROWING_DARTS.has(id) ? 4 : 3;
}

function rangedAim(bowId) {
    return RANGED_AIM[bowId] || 0;
}

function rangedPower(arrowId) {
    return RANGED_POWER[arrowId] || 0;
}

module.exports = {
    RANGED_AIM,
    RANGED_POWER,
    THROWING_IDS,
    THROWING_DARTS,
    POISONED_ITEMS,
    DARTS,
    POISONED_DARTS,
    KNIVES,
    POISONED_KNIVES,
    SPEARS,
    POISONED_SPEARS,
    throwingRadius,
    rangedAim,
    rangedPower
};
