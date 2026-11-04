// A literal JavaScript transcription of Open-RSC's authentic combat formula,
// kept apart from src/combat.js so the golden tests compare two independent
// readings of the Java. Source (source/OpenRSC-Core-Framework):
//   server/src/com/openrsc/server/event/rsc/impl/combat/CombatFormula.java
//   server/src/com/openrsc/server/constants/SpellDamages.java
// Line numbers are CombatFormula.java's unless noted. Java's doubles are
// IEEE 754 like JS numbers, and (int) of a positive double truncates like
// Math.floor, so the arithmetic below is bit-for-bit the Java's.
//
// A "mob" here is { isPlayer, att, str, def, ranged, style, prayers: Set of
// Prayers.java ids, aim, power, armour } where aim/power/armour are the
// Equipment totals (1 + wielded bonuses, Equipment.java:773-830) for a
// player; an NPC returns 0 for them (Npc.java:275-285).

const Prayers = {
    THICK_SKIN: 0,
    BURST_OF_STRENGTH: 1,
    CLARITY_OF_THOUGHT: 2,
    ROCK_SKIN: 3,
    SUPERHUMAN_STRENGTH: 4,
    IMPROVED_REFLEXES: 5,
    STEEL_SKIN: 9,
    ULTIMATE_STRENGTH: 10,
    INCREDIBLE_REFLEXES: 11,
    PROTECT_FROM_MISSILES: 13
};

// Skills.java
const CONTROLLED_MODE = 0;
const AGGRESSIVE_MODE = 1;
const ACCURATE_MODE = 2;
const DEFENSIVE_MODE = 3;

const ATTACK = 0;
const DEFENSE = 1;
const STRENGTH = 2;

// Player.getWeaponAimPoints etc. (Player.java:1618-1633): max(points, 1)
function weaponAimPoints(m) {
    return m.isPlayer ? Math.max(m.aim, 1) : 0;
}

function weaponPowerPoints(m) {
    return m.isPlayer ? Math.max(m.power, 1) : 0;
}

function armourPoints(m) {
    return m.isPlayer ? Math.max(m.armour, 1) : 0;
}

// 299-309
function styleBonus(attacker, skill) {
    if (!attacker.isPlayer) return 0;
    const style = attacker.style;
    if (style === CONTROLLED_MODE) return 1;
    return (skill === ATTACK && style === ACCURATE_MODE) ||
        (skill === DEFENSE && style === DEFENSIVE_MODE) ||
        (skill === STRENGTH && style === AGGRESSIVE_MODE)
        ? 3
        : 0;
}

// 317-331
function addPrayers(source, prayer1, prayer2, prayer3) {
    if (source.isPlayer) {
        if (source.prayers.has(prayer3)) return 1.15;
        if (source.prayers.has(prayer2)) return 1.1;
        if (source.prayers.has(prayer1)) return 1.05;
    }
    return 1.0;
}

// 222-231
function getMeleeDamage(source) {
    const sb = styleBonus(source, 2);
    const prayerBonus = addPrayers(
        source,
        Prayers.BURST_OF_STRENGTH,
        Prayers.SUPERHUMAN_STRENGTH,
        Prayers.ULTIMATE_STRENGTH
    );
    const bonusConstant = source.isPlayer ? 8 : 0;
    const maxRoll =
        (Math.floor(source.str * prayerBonus) + bonusConstant + sb) *
        (weaponPowerPoints(source) + 64);
    return Math.trunc(maxRoll);
}

// 252-260
function getMeleeDefence(defender) {
    const sb = styleBonus(defender, 1);
    const prayerBonus = addPrayers(
        defender,
        Prayers.THICK_SKIN,
        Prayers.ROCK_SKIN,
        Prayers.STEEL_SKIN
    );
    const bonusConstant = defender.isPlayer ? 8 : 0;
    return (
        (Math.floor(defender.def * prayerBonus) + bonusConstant + sb) *
        (armourPoints(defender) + 64)
    );
}

// 281-291
function getMeleeAccuracy(attacker) {
    const sb = styleBonus(attacker, 0);
    const prayerBonus = addPrayers(
        attacker,
        Prayers.CLARITY_OF_THOUGHT,
        Prayers.IMPROVED_REFLEXES,
        Prayers.INCREDIBLE_REFLEXES
    );
    const bonusConstant = attacker.isPlayer ? 8 : 0;
    return (
        (Math.floor(attacker.att * prayerBonus) + bonusConstant + sb) *
        (weaponAimPoints(attacker) + 64)
    );
}

// 239-244 (post-Fletching powers, RETRO_RANGED_DAMAGE off)
function getRangedDamage(source, power) {
    const bonusConstant = source.isPlayer ? 8 : 0;
    return Math.trunc((source.ranged + bonusConstant) * (power + 1 + 64));
}

// 270-273
function getRangedAccuracy(attacker, aim) {
    const bonusConstant = attacker.isPlayer ? 8 : 0;
    return (attacker.ranged + bonusConstant) * (aim + 1 + 64);
}

// 109-121, the chance the Math.random() <= hitChance test passes
function hitChance(accuracy, defence) {
    if (accuracy > defence) {
        return 1 - (defence + 2) / (2 * (accuracy + 1));
    }
    return accuracy / (2 * (defence + 1));
}

// 32-36: (nextInt(maxRoll) + 320) / 640, nextInt in 0..maxRoll-1
function maxMeleeHit(source) {
    const maxRoll = getMeleeDamage(source);
    return maxRoll <= 0 ? 0 : Math.trunc((maxRoll - 1 + 320) / 640);
}

function maxRangedHit(source, power) {
    return Math.trunc((getRangedDamage(source, power) - 1 + 320) / 640);
}

// SpellDamages.java:73-122 (modernMagicProjectiles), by Spells name
const MODERN_MAGIC = {
    WIND_STRIKE: [1.0, 1.0],
    WATER_STRIKE: [2.0, 2.0],
    EARTH_STRIKE: [3.0, 3.0],
    FIRE_STRIKE: [4.0, 4.0],
    WIND_BOLT: [4.5, 4.5],
    WATER_BOLT: [5.0, 5.0],
    EARTH_BOLT: [5.5, 5.5],
    FIRE_BOLT: [6.0, 6.0],
    WIND_BLAST: [6.5, 6.5],
    WATER_BLAST: [7.0, 7.0],
    EARTH_BLAST: [7.5, 7.5],
    FIRE_BLAST: [8.0, 8.0],
    WIND_WAVE: [8.5, 8.5],
    WATER_WAVE: [9.0, 9.0],
    EARTH_WAVE: [9.5, 9.5],
    FIRE_WAVE: [10.0, 10.0]
};

// 58-62: nextInt(floor(power) + 1)
function maxMagicHit(power) {
    return Math.floor(power);
}

module.exports = {
    Prayers,
    CONTROLLED_MODE,
    AGGRESSIVE_MODE,
    ACCURATE_MODE,
    DEFENSIVE_MODE,
    getMeleeDamage,
    getMeleeDefence,
    getMeleeAccuracy,
    getRangedDamage,
    getRangedAccuracy,
    hitChance,
    maxMeleeHit,
    maxRangedHit,
    maxMagicHit,
    MODERN_MAGIC
};
