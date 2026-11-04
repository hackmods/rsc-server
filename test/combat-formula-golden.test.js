// Golden tables: src/combat.js against an independent transcription of Open-RSC
// CombatFormula.java (test/fixtures/openrsc-combat-formula.js) over a grid of
// levels, equipment, prayers and styles, plus hand-worked values.

const test = require('node:test');
const assert = require('node:assert/strict');

const combat = require('../src/combat');
const rangedData = require('../src/ranged-data');
const java = require('./fixtures/openrsc-combat-formula');

const LEVELS = [1, 2, 10, 20, 40, 63, 75, 99];
const POINTS = [1, 5, 31, 70, 120];
const STYLES = [0, 1, 2, 3];

// none, then each tier of each stat prayer (Prayers.java ids)
const PRAYER_SETS = [[], [0], [3], [9], [1], [4], [10], [2], [5], [11], [9, 10, 11], [0, 4, 11]];

function serverPlayer({ att = 1, str = 1, def = 1, ranged = 1, style = 0, prayers = [], aim = 1, power = 1, armour = 1 }) {
    const flags = new Array(14).fill(false);
    for (const id of prayers) flags[id] = true;
    return {
        username: 'golden',
        combatStyle: style,
        prayers: flags,
        skills: {
            attack: { current: att },
            strength: { current: str },
            defense: { current: def },
            ranged: { current: ranged },
            hits: { current: 10 }
        },
        equipmentBonuses: { weaponAim: aim, weaponPower: power, armour }
    };
}

function javaPlayer({ att = 1, str = 1, def = 1, ranged = 1, style = 0, prayers = [], aim = 1, power = 1, armour = 1 }) {
    return { isPlayer: true, att, str, def, ranged, style, prayers: new Set(prayers), aim, power, armour };
}

function serverNPC({ att = 1, str = 1, def = 1 }) {
    return {
        skills: { attack: { current: att }, strength: { current: str }, defense: { current: def }, hits: { current: 10 } }
    };
}

function javaNPC({ att = 1, str = 1, def = 1 }) {
    return { isPlayer: false, att, str, def, ranged: 1, style: 0, prayers: new Set(), aim: 0, power: 0, armour: 0 };
}

test('player melee accuracy, defence, max roll and max hit match CombatFormula over the grid', () => {
    let checked = 0;
    for (const level of LEVELS) {
        for (const points of POINTS) {
            for (const style of STYLES) {
                for (const prayers of PRAYER_SETS) {
                    const stats = { att: level, str: level, def: level, style, prayers, aim: points, power: points, armour: points };
                    const p = serverPlayer(stats);
                    const j = javaPlayer(stats);
                    assert.equal(combat.getMeleeAccuracy(p), java.getMeleeAccuracy(j), JSON.stringify(stats));
                    assert.equal(combat.getMeleeDefence(p), java.getMeleeDefence(j), JSON.stringify(stats));
                    assert.equal(combat.getMeleeMaxRoll(p), java.getMeleeDamage(j), JSON.stringify(stats));
                    assert.equal(combat.getMeleeMaxHit(p), java.maxMeleeHit(j), JSON.stringify(stats));
                    checked += 1;
                }
            }
        }
    }
    assert.equal(checked, LEVELS.length * POINTS.length * STYLES.length * PRAYER_SETS.length);
});

test('NPC rolls have no +8, no style, no prayer and no equipment', () => {
    for (const level of LEVELS) {
        const n = serverNPC({ att: level, str: level, def: level });
        const j = javaNPC({ att: level, str: level, def: level });
        assert.equal(combat.getMeleeAccuracy(n), java.getMeleeAccuracy(j));
        assert.equal(combat.getMeleeAccuracy(n), level * 64);
        assert.equal(combat.getMeleeDefence(n), level * 64);
        assert.equal(combat.getMeleeMaxRoll(n), level * 64);
        assert.equal(combat.getMeleeMaxHit(n), java.maxMeleeHit(j));
    }
});

test('hit chance matches calculateAccuracy for player-vs-NPC, NPC-vs-player and player-vs-player', () => {
    for (const a of LEVELS) {
        for (const d of LEVELS) {
            for (const points of POINTS) {
                const attacker = { att: a, aim: points, style: 2 };
                const defender = { def: d, armour: points, style: 3 };

                const pvn = combat.hitChance(combat.getMeleeAccuracy(serverPlayer(attacker)), combat.getMeleeDefence(serverNPC({ def: d })));
                assert.equal(pvn, java.hitChance(java.getMeleeAccuracy(javaPlayer(attacker)), java.getMeleeDefence(javaNPC({ def: d }))));

                const nvp = combat.hitChance(combat.getMeleeAccuracy(serverNPC({ att: a })), combat.getMeleeDefence(serverPlayer(defender)));
                assert.equal(nvp, java.hitChance(java.getMeleeAccuracy(javaNPC({ att: a })), java.getMeleeDefence(javaPlayer(defender))));

                const pvp = combat.hitChance(combat.getMeleeAccuracy(serverPlayer(attacker)), combat.getMeleeDefence(serverPlayer(defender)));
                assert.equal(pvp, java.hitChance(java.getMeleeAccuracy(javaPlayer(attacker)), java.getMeleeDefence(javaPlayer(defender))));
                assert.ok(pvp > 0 && pvp < 1);
            }
        }
    }
});

// CombatFormula.rangedAim / rangedPower switch cases, copied from the Java
const JAVA_AIM = {
    189: 10, 60: 12, 59: 12, 188: 15, 649: 15, 651: 20, 648: 20, 653: 25, 650: 25, 655: 30, 652: 30, 657: 35,
    654: 35, 656: 40, 1453: 40,
    1013: 25, 1122: 25, 1015: 30, 1123: 30, 1076: 30, 1128: 30, 1024: 35, 1124: 35, 1075: 35, 1129: 35,
    1068: 40, 1125: 40, 1081: 40, 1132: 40, 1077: 40, 1130: 40, 1069: 45, 1126: 45, 1078: 45, 1131: 45,
    1070: 50, 1127: 50, 1079: 50, 1133: 50, 1080: 55, 1134: 55,
    827: 25, 1135: 25, 1088: 33, 1136: 33, 1089: 41, 1137: 41, 1090: 49, 1138: 49, 1091: 57, 1139: 57,
    1092: 65, 1140: 65
};

const JAVA_POWER = {
    1013: 15, 1122: 15, 11: 15, 574: 15, 1015: 17, 1123: 17, 638: 20, 639: 20, 190: 20, 592: 20, 1024: 22,
    1124: 22, 640: 25, 641: 25, 1068: 25, 1125: 25, 1076: 25, 1128: 25, 1069: 27, 1126: 27, 1070: 30, 1127: 30,
    642: 30, 643: 30, 786: 30, 1075: 30, 1129: 30, 644: 35, 645: 35, 1077: 35, 1130: 35, 1081: 35, 1132: 35,
    646: 40, 647: 40, 1078: 40, 1131: 40, 1079: 45, 1133: 45, 1080: 50, 1134: 50, 1449: 50, 1450: 50, 1451: 50,
    1452: 50, 827: 29, 1135: 29, 1088: 37, 1136: 37, 1089: 46, 1137: 46, 1090: 53, 1138: 53, 1091: 61,
    1139: 61, 1092: 69, 1140: 69
};

test('ranged aim and power tables are CombatFormula.rangedAim / rangedPower', () => {
    assert.deepEqual(
        Object.fromEntries(Object.entries(rangedData.RANGED_AIM).map(([k, v]) => [k, v])),
        Object.fromEntries(Object.entries(JAVA_AIM).map(([k, v]) => [k, v]))
    );
    assert.deepEqual(
        Object.fromEntries(Object.entries(rangedData.RANGED_POWER).map(([k, v]) => [k, v])),
        Object.fromEntries(Object.entries(JAVA_POWER).map(([k, v]) => [k, v]))
    );
    assert.equal(rangedData.rangedAim(999), 0);
    assert.equal(rangedData.rangedPower(999), 0);
});

test('player ranged accuracy and max hit match CombatFormula for every bow, thrown weapon and ammunition', () => {
    for (const level of LEVELS) {
        const p = serverPlayer({ ranged: level });
        const j = javaPlayer({ ranged: level });
        for (const [bow, aim] of Object.entries(JAVA_AIM)) {
            assert.equal(combat.getRangedAccuracy(p, +bow), java.getRangedAccuracy(j, aim));
        }
        for (const [ammo, power] of Object.entries(JAVA_POWER)) {
            assert.equal(combat.getRangedMaxRoll(p, +ammo), java.getRangedDamage(j, power));
            assert.equal(combat.getRangedMaxHit(p, +ammo), java.maxRangedHit(j, power));
        }
    }
});

test('ranged ignores prayers and styles, and an NPC archer ranges at level 1', () => {
    const plain = serverPlayer({ ranged: 50 });
    const prayed = serverPlayer({ ranged: 50, style: 1, prayers: [10, 11] });
    assert.equal(combat.getRangedAccuracy(plain, 188), combat.getRangedAccuracy(prayed, 188));
    assert.equal(combat.getRangedMaxRoll(plain, 11), combat.getRangedMaxRoll(prayed, 11));

    const npc = serverNPC({ att: 90 });
    assert.equal(combat.getRangedAccuracy(npc, 188), 1 * (15 + 65));
    assert.equal(combat.getRangedMaxHit(npc, 11), 0); // (1 * 80 - 1 + 320) / 640
});

test('hand-worked values', () => {
    // a fresh player (1/1/1, no gear, controlled): (1 + 8 + 1) * (1 + 64) = 650, max hit (649 + 320) / 640 = 1
    const fresh = serverPlayer({});
    assert.equal(combat.getMeleeAccuracy(fresh), 650);
    assert.equal(combat.getMeleeMaxRoll(fresh), 650);
    assert.equal(combat.getMeleeMaxHit(fresh), 1);

    // 99 strength, ultimate strength, aggressive, power 71 (rune 2h 70 + 1):
    // (floor(99 * 1.15) = 113 + 8 + 3) * 135 = 16740, max (16739 + 320) / 640 = 26
    const maxed = serverPlayer({ str: 99, style: 1, prayers: [10], power: 71 });
    assert.equal(combat.getMeleeMaxRoll(maxed), 16740);
    assert.equal(combat.getMeleeMaxHit(maxed), 26);

    // the prayer multiplies the level, floored, before +8 and the style: floor(20 * 1.15) = 23
    const twenty = serverPlayer({ att: 20, prayers: [11] });
    assert.equal(combat.getMeleeAccuracy(twenty), (23 + 8 + 1) * 65);
    // the highest tier wins when several are on
    const stacked = serverPlayer({ att: 20, prayers: [2, 5, 11] });
    assert.equal(combat.getMeleeAccuracy(stacked), (23 + 8 + 1) * 65);

    // a chicken (defence 3): 192; the fresh player hits 1 - 194 / 1302
    assert.equal(combat.hitChance(650, 3 * 64), 1 - 194 / 1302);

    // behind: 64 vs 650 -> 64 / 1302
    assert.equal(combat.hitChance(64, 650), 64 / 1302);

    // ranged 1, shortbow + bronze arrows: acc (1 + 8) * 75 = 675, max (9 * 80 - 1 + 320) / 640 = 1
    const archer = serverPlayer({ ranged: 1 });
    assert.equal(combat.getRangedAccuracy(archer, 189), 675);
    assert.equal(combat.getRangedMaxHit(archer, 11), 1);

    // ranged 99 and rune spear: (107) * (69 + 65) = 14338, max (14337 + 320) / 640 = 22
    const spear = serverPlayer({ ranged: 99 });
    assert.equal(combat.getRangedMaxRoll(spear, 1092), 14338);
    assert.equal(combat.getRangedMaxHit(spear, 1092), 22);
});

test('a roll is (random(0..maxRoll-1) + 320) / 640 on a hit and 0 on a miss', (t) => {
    const roll = 650 * 10;
    let next = [];
    t.mock.method(Math, 'random', () => next.shift());

    next = [0];
    assert.equal(combat.rollDamageFromMaxRoll(roll), 0); // (0 + 320) / 640
    next = [0.9999999];
    assert.equal(combat.rollDamageFromMaxRoll(roll), combat.maxHitFromMaxRoll(roll));
    assert.equal(combat.maxHitFromMaxRoll(roll), Math.floor((roll - 1 + 320) / 640));
    assert.equal(combat.rollDamageFromMaxRoll(0), 0);

    // melee: the accuracy roll, then the damage roll; a miss is 0
    const attacker = serverPlayer({ att: 99, str: 99, aim: 100, power: 100 });
    const chicken = serverNPC({ def: 3 });
    next = [0, 0.9999999];
    assert.equal(combat.rollMeleeDamage(attacker, chicken), combat.getMeleeMaxHit(attacker));
    next = [0.9999999, 0.9999999];
    assert.equal(combat.rollMeleeDamage(attacker, chicken), 0);
});

test('a hit lands about as often as the formula says (uniform damage from 0)', () => {
    const attacker = serverPlayer({ att: 40, str: 40, aim: 20, power: 20, style: 2 });
    const target = serverNPC({ def: 30 });
    const p = combat.hitChance(combat.getMeleeAccuracy(attacker), combat.getMeleeDefence(target));
    const max = combat.getMeleeMaxHit(attacker);
    const n = 40000;
    let hits = 0;
    let maxSeen = 0;
    const counts = new Array(max + 1).fill(0);
    for (let i = 0; i < n; i += 1) {
        const d = combat.rollMeleeDamage(attacker, target);
        if (d > 0) hits += 1;
        counts[d] += 1;
        maxSeen = Math.max(maxSeen, d);
    }
    assert.equal(maxSeen, max);
    // P(d > 0) = p * (1 - P(roll < 320)); P(roll < 320) = 320 / maxRoll
    const maxRoll = combat.getMeleeMaxRoll(attacker);
    const expected = p * (1 - 320 / maxRoll);
    assert.ok(Math.abs(hits / n - expected) < 0.02, `${hits / n} vs ${expected}`);
});
