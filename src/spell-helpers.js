const spells = require('@2003scape/rsc-data/config/spells.json');

// elemental rune ids
const FIRE = 31;
const WATER = 32;
const AIR = 33;
const EARTH = 34;

// staff item id -> rune it stands in for
const STAFF_RUNES = { 101: AIR, 102: WATER, 103: EARTH, 197: FIRE };

const TIER_MAX_HIT = { strike: 0, bolt: 4, blast: 8, wave: 12 };
const STRIKE_MAX_HIT = { wind: 1, water: 2, earth: 3, fire: 4 };
const PROJECTILE_MAGIC = 1;

// returns max hit for strike/bolt/blast/wave elemental spells, else 0
function getMaxHit(spell) {
    const match = /^(wind|water|earth|fire) (strike|bolt|blast|wave)$/i.exec(
        spell && spell.name
    );

    if (!match) {
        return 0;
    }

    const element = match[1].toLowerCase();
    const tier = match[2].toLowerCase();

    // strikes 1-4, bolts 5-8, blasts 9-12, waves 13-16
    return STRIKE_MAX_HIT[element] + TIER_MAX_HIT[tier];
}

// does the player lack runes? staffs cover their element. `inventory` needs
// has(id, amount) and isEquipped(id)
function hasRunes(inventory, spell) {
    const covered = new Set();

    for (const [staffID, runeID] of Object.entries(STAFF_RUNES)) {
        if (inventory.has(+staffID) && inventory.isEquipped(+staffID)) {
            covered.add(runeID);
        }
    }

    return spell.runes.every(
        ({ id, amount }) => covered.has(id) || inventory.has(id, amount)
    );
}

// the runes that actually need removing (staff-covered ones excluded)
function getRunesToRemove(inventory, spell) {
    return spell.runes.filter(({ id }) => {
        for (const [staffID, runeID] of Object.entries(STAFF_RUNES)) {
            if (
                runeID === id &&
                inventory.has(+staffID) &&
                inventory.isEquipped(+staffID)
            ) {
                return false;
            }
        }

        return true;
    });
}

// experience in internal units (displayed xp * 4, like addExperience expects):
// 2 * spell level + 2 * damage, times 4
function getSpellExperience(spell, damage) {
    return (2 * spell.level + 2 * damage) * 4;
}

function rollSpellDamage(spell, random = Math.random) {
    const max = getMaxHit(spell);
    return Math.floor(random() * (max + 1));
}

module.exports = {
    spells,
    STAFF_RUNES,
    PROJECTILE_MAGIC,
    getMaxHit,
    hasRunes,
    getRunesToRemove,
    getSpellExperience,
    rollSpellDamage
};
