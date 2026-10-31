const items = require('@2003scape/rsc-data/config/items');
const wieldable = require('@2003scape/rsc-data/wieldable');
const { formatSkillName } = require('./skills');

// First matching type determines the character animation, as in Inventory.equip.
const ANIMATION_TYPES = [
    ['replace-head', 0], ['replace-body', 1], ['replace-legs', 2],
    ['2-handed', 4], ['left-hand', 3], ['right-hand', 4],
    ['head', 5], ['body', 6], ['legs', 7], ['hands', 8],
    ['feet', 9], ['chest', 10], ['cape', 11]
];
const EQUIP_TYPES = new Set(ANIMATION_TYPES.map(([type]) => type));

function getEquipmentAnimationIndex(equip) {
    for (const [type, index] of ANIMATION_TYPES) {
        if (equip.indexOf(type) > -1) return index;
    }
    throw new RangeError(`unable to find animation index for ${equip}`);
}

function equipmentRefusal(player, item) {
    if (!item || !item.definition || !item.definition.wieldable) {
        throw new RangeError('equipping unequipable item');
    }
    const definition = item.definition.wieldable;
    for (const [skillName, level] of Object.entries(definition.requirements || {})) {
        if (player.skills[skillName].base < level) {
            return [
                'You are not a high enough level to use this item',
                `You need to have a ${formatSkillName(skillName)} level of ${level}`
            ];
        }
    }
    if (definition.female && player.isMale()) {
        return ["It doesn't fit!", 'Perhaps I should get someone to adjust it for me'];
    }
    return null;
}

// Returns null for a valid set, throws before the caller changes either store.
// Read trusted definitions directly: constructing Item attaches wieldable to the
// shared item definition, which would make this preflight mutate global data.
function validateEquipmentSet(player, rows) {
    const claimed = new Set();
    for (const row of rows) {
        if (!row.equipped) continue;
        const definition = items[row.id];
        if (!definition) throw new RangeError(`invalid item id: ${row.id}`);
        const item = { id: row.id, definition: { ...definition, wieldable: definition.equip && wieldable[row.id] } };
        const refusal = equipmentRefusal(player, item);
        if (refusal) throw new Error(refusal.join('. '));
        const equip = definition.equip;
        if (!Array.isArray(equip) || !equip.length || equip.some(type => !EQUIP_TYPES.has(type))) {
            throw new RangeError(`invalid equipment slots for item ${row.id}`);
        }
        const animation = item.definition.wieldable.animation;
        if (!Number.isInteger(animation) || animation < 0) throw new RangeError(`invalid equipment animation for item ${row.id}`);
        getEquipmentAnimationIndex(equip);
        for (const type of equip) {
            if (claimed.has(type)) throw new Error(`conflicting equipment slot: ${type}`);
            claimed.add(type);
        }
    }
    return null;
}

module.exports = { equipmentRefusal, validateEquipmentSet, getEquipmentAnimationIndex };
