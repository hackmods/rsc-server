// Melee and ranged hit rolls, ported line by line from Open-RSC's authentic
// formula (server/src/com/openrsc/server/event/rsc/impl/combat/CombatFormula.java;
// line numbers below are that file's). Replaces 2003scape's approximation (hit
// chance capped at 212/256, normal-shaped damage from 1, no +8, /600).
//
//  - accuracy and defence are "rolls": (floor(level * prayer) + 8 + style) *
//    (equipment points + 64); an NPC has no +8, no style, no prayer and 0
//    equipment points (Npc.getArmourPoints etc. return 0)
//  - the hit chance is uncapped: 1 - (def + 2) / (2 * (acc + 1)) when the
//    attacker is ahead, acc / (2 * (def + 1)) otherwise (calculateAccuracy)
//  - damage is (random(0..maxRoll-1) + 320) / 640: 0..max, near uniform; a
//    miss is 0
//  - ranged: (ranged level + 8) * (aim or power + 1 + 64), against the
//    victim's melee defence; aim and power from ./ranged-data (no prayer, no
//    style)
//
// A player's equipment points are equipmentBonuses (1 + the wielded items'
// bonuses, like Open-RSC Equipment.getArmour/getWeaponAim/getWeaponPower).

const { rangedAim, rangedPower } = require('./ranged-data');

// Prayers.java ids, the three tiers of each stat prayer (addPrayers)
const STAT_PRAYERS = {
    defense: [0, 3, 9], // thick skin, rock skin, steel skin
    strength: [1, 4, 10], // burst of strength, superhuman, ultimate strength
    attack: [2, 5, 11] // clarity of thought, improved/incredible reflexes
};

const PROTECT_FROM_MISSILES = 13;

// Skills.java combat modes, as the client sends them (combat-style.js)
const CONTROLLED_MODE = 0;
const AGGRESSIVE_MODE = 1;
const ACCURATE_MODE = 2;
const DEFENSIVE_MODE = 3;

// an NPC ranges with a level of 1 (EntityHandler: def.ranged = 0 or 1)
const NPC_RANGED_LEVEL = 1;

function isPlayer(mob) {
    return !!mob.username;
}

// CombatFormula.addPrayers (317-331): the highest active tier wins
function addPrayers(mob, skill) {
    if (!isPlayer(mob) || !mob.prayers) {
        return 1;
    }

    const [prayer1, prayer2, prayer3] = STAT_PRAYERS[skill];

    if (mob.prayers[prayer3]) {
        return 1.15;
    }

    if (mob.prayers[prayer2]) {
        return 1.1;
    }

    if (mob.prayers[prayer1]) {
        return 1.05;
    }

    return 1;
}

// { defense, strength, attack } multipliers (kept for callers and tests)
function getPrayerBonuses(mob) {
    const player = { username: true, prayers: mob.prayers };

    return {
        defense: addPrayers(player, 'defense'),
        strength: addPrayers(player, 'strength'),
        attack: addPrayers(player, 'attack')
    };
}

// CombatFormula.styleBonus (299-309)
function styleBonus(mob, skill) {
    if (!isPlayer(mob)) {
        return 0;
    }

    const style = mob.combatStyle || CONTROLLED_MODE;

    if (style === CONTROLLED_MODE) {
        return 1;
    }

    return (skill === 'attack' && style === ACCURATE_MODE) ||
        (skill === 'defense' && style === DEFENSIVE_MODE) ||
        (skill === 'strength' && style === AGGRESSIVE_MODE)
        ? 3
        : 0;
}

// Player.getWeaponAimPoints & co (max(points, 1)); an NPC has 0
function equipmentPoints(mob, bonus) {
    if (!isPlayer(mob)) {
        return 0;
    }

    const bonuses = mob.equipmentBonuses || {};
    return Math.max(bonuses[bonus] || 0, 1);
}

function bonusConstant(mob) {
    return isPlayer(mob) ? 8 : 0;
}

function level(mob, skill) {
    const entry = mob.skills[skill];
    return entry ? entry.current : 0;
}

// getMeleeAccuracy (281-291)
function getMeleeAccuracy(attacker) {
    return (
        (Math.floor(level(attacker, 'attack') * addPrayers(attacker, 'attack')) +
            bonusConstant(attacker) +
            styleBonus(attacker, 'attack')) *
        (equipmentPoints(attacker, 'weaponAim') + 64)
    );
}

// getMeleeDefence (252-260)
function getMeleeDefence(defender) {
    return (
        (Math.floor(
            level(defender, 'defense') * addPrayers(defender, 'defense')
        ) +
            bonusConstant(defender) +
            styleBonus(defender, 'defense')) *
        (equipmentPoints(defender, 'armour') + 64)
    );
}

// getMeleeDamage (222-231): the max roll, not the max hit
function getMeleeMaxRoll(source) {
    return Math.floor(
        (Math.floor(
            level(source, 'strength') * addPrayers(source, 'strength')
        ) +
            bonusConstant(source) +
            styleBonus(source, 'strength')) *
            (equipmentPoints(source, 'weaponPower') + 64)
    );
}

function rangedLevel(source) {
    return isPlayer(source) ? level(source, 'ranged') : NPC_RANGED_LEVEL;
}

// getRangedAccuracy (270-273)
function getRangedAccuracy(attacker, bowId) {
    return (
        (rangedLevel(attacker) + bonusConstant(attacker)) *
        (rangedAim(bowId) + 1 + 64)
    );
}

// getRangedDamage (239-244), the post-Fletching powers
function getRangedMaxRoll(source, arrowId) {
    return Math.floor(
        (rangedLevel(source) + bonusConstant(source)) *
            (rangedPower(arrowId) + 1 + 64)
    );
}

// calculateAccuracy (109-121): the chance, without the roll
function hitChance(accuracy, defence) {
    if (accuracy > defence) {
        return 1 - (defence + 2) / (2 * (accuracy + 1));
    }

    return accuracy / (2 * (defence + 1));
}

function rollAccuracy(accuracy, defence) {
    return Math.random() <= hitChance(accuracy, defence);
}

// calculateMeleeDamage/calculateRangedDamage (32-51): nextInt(maxRoll) is
// 0..maxRoll-1
function rollDamageFromMaxRoll(maxRoll) {
    if (maxRoll <= 0) {
        return 0;
    }

    return Math.floor((Math.floor(Math.random() * maxRoll) + 320) / 640);
}

// the highest value rollDamageFromMaxRoll can give
function maxHitFromMaxRoll(maxRoll) {
    return maxRoll <= 0 ? 0 : Math.floor((maxRoll - 1 + 320) / 640);
}

// doMeleeDamage (154-191) without the skill capes (custom content)
function rollMeleeDamage(source, victim) {
    const isHit = rollAccuracy(getMeleeAccuracy(source), getMeleeDefence(victim));
    const damage = rollDamageFromMaxRoll(getMeleeMaxRoll(source));

    return isHit ? damage : 0;
}

// doRangedDamage (202-215) without the ranged cape
function rollRangedDamage(source, bowId, arrowId, victim) {
    if (!rollAccuracy(getRangedAccuracy(source, bowId), getMeleeDefence(victim))) {
        return 0;
    }

    return rollDamageFromMaxRoll(getRangedMaxRoll(source, arrowId));
}

function getMeleeMaxHit(source) {
    return maxHitFromMaxRoll(getMeleeMaxRoll(source));
}

function getRangedMaxHit(source, arrowId) {
    return maxHitFromMaxRoll(getRangedMaxRoll(source, arrowId));
}

// the bow (or thrown weapon) and the ammunition (or the thrown weapon itself)
function rangedIDs(player, bowId, arrowId) {
    if (typeof bowId !== 'number') {
        const weapon = player.inventory.getRangedWeapon();
        bowId = weapon ? weapon.id : -1;
    }

    if (typeof arrowId !== 'number') {
        arrowId = player.inventory.getAmmunitionID(false);
    }

    return { bowId, arrowId };
}

// Prayers.PROTECT_FROM_MISSILES (RangeEvent.java:114, ThrowingEvent.java:114,
// RangeEventNpc.java:82): a player praying it cannot be shot or thrown at
function protectedFromMissiles(mob) {
    return isPlayer(mob) && !!mob.prayers && !!mob.prayers[PROTECT_FROM_MISSILES];
}

function rollPlayerNPCDamage(player, npc) {
    return rollMeleeDamage(player, npc);
}

function rollPlayerPlayerDamage(player, targetPlayer) {
    return rollMeleeDamage(player, targetPlayer);
}

function rollNPCDamage(npc, player) {
    return rollMeleeDamage(npc, player);
}

function rollPlayerNPCRangedDamage(player, npc, bowId, arrowId) {
    const ids = rangedIDs(player, bowId, arrowId);
    return rollRangedDamage(player, ids.bowId, ids.arrowId, npc);
}

function rollPlayerPlayerRangedDamage(player, targetPlayer, bowId, arrowId) {
    const ids = rangedIDs(player, bowId, arrowId);
    return rollRangedDamage(player, ids.bowId, ids.arrowId, targetPlayer);
}

// RangeEventNpc.java:88: an NPC archer shoots a longbow with bronze arrows
function rollNPCRangedDamage(npc, player) {
    return rollRangedDamage(npc, 188, 11, player);
}

module.exports = {
    rollPlayerNPCDamage,
    rollPlayerPlayerDamage,
    rollNPCDamage,
    rollPlayerNPCRangedDamage,
    rollPlayerPlayerRangedDamage,
    rollNPCRangedDamage,
    rollMeleeDamage,
    rollRangedDamage,
    getPrayerBonuses,
    getMeleeAccuracy,
    getMeleeDefence,
    getMeleeMaxRoll,
    getMeleeMaxHit,
    getRangedAccuracy,
    getRangedMaxRoll,
    getRangedMaxHit,
    hitChance,
    maxHitFromMaxRoll,
    rollDamageFromMaxRoll,
    protectedFromMissiles,
    PROTECT_FROM_MISSILES
};
