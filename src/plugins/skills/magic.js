// Ported from Open-RSC Core-Framework authentic net/rsc/handlers/SpellHandler.java
// (handleChargeOrb and the TELEKINETIC_GRAB case of handleItemCast) (AGPL-3.0)

const { cast } = require('../../packet-handlers/magic');

const TELEKINETIC_GRAB = 16;
const TELEGRAB_RANGE = 4;
const MAX_APPROACH_STEPS = 10;

// spell index: the obelisk it works on, the charged orb it makes. spell
// indexes, object and item ids checked by name against rsc-data
const CHARGE_ORBS = {
    29: { obelisk: 300, orb: 613, element: 'water' }, // Obelisk of water
    36: { obelisk: 304, orb: 627, element: 'earth' }, // Obelisk of earth
    38: { obelisk: 301, orb: 612, element: 'fire' }, // Obelisk of fire
    40: { obelisk: 303, orb: 626, element: 'air' } // Obelisk of air
};

// items "I can't use telekinetic grab on this object" (Open-RSC list):
// scythe, bunny ears, the four orbs of light, Kardia's cat, the god capes,
// holy grail, the large cogs, staff of Armadyl, ice arrows, firebird feather,
// the ball, the restless ghost's skull
const UNGRABBABLE = new Set([
    1289, 1156, 991, 992, 993, 994, 1003, 1213, 1214, 1215, 746, 727, 728, 729,
    730, 725, 723, 557, 539, 27
]);

const PRESENT_ID = 980;
const BLUE_WIZARDS_HAT_ID = 1264;
const GERTRUDES_CAT_ID = 1093;
const ANA_IN_A_BARREL_ID = 1039;
const COINS_ID = 10;

// the carved rock gems of Legends' Quest: item id, x, y
const LEGENDS_GEMS = [
    [894, 471, 3722], // opal
    [163, 474, 3730], // emerald
    [162, 471, 3734], // ruby
    [161, 466, 3739], // diamond
    [164, 460, 3737], // sapphire
    [892, 464, 3730], // red topaz
    [893, 469, 3728] // jade
];

function inBounds({ x, y }, minX, minY, maxX, maxY) {
    return x >= minX && x <= maxX && y >= minY && y <= maxY;
}

function inWatchtowerPedestal({ x, y }) {
    return (
        (x === 490 || x === 495) && (y === 3520 || y === 3525)
    );
}

async function chargeOrb(player, gameObject, spell, spellID) {
    const { obelisk, orb, element } = CHARGE_ORBS[spellID];

    if (gameObject.id !== obelisk) {
        player.message(`This spell can only be used on ${element} obelisks`);
        return;
    }

    const cost = cast.checkCast(player, spellID, spell);

    if (!cost) {
        return;
    }

    // the unpowered orb is one of the spell's runes: finishCast takes it
    // (freeing its slot), then the charged orb arrives
    cast.finishCast(player, spellID, cost, null);
    player.inventory.add(orb);
    player.message('You succesfully charge the orb');
}

async function onCastOnGameObject(player, gameObject, spell, spellID) {
    if (!CHARGE_ORBS[spellID]) {
        return false;
    }

    await chargeOrb(player, gameObject, spell, spellID);
    return true;
}

// walk at the item until it is within the Open-RSC walk-to radius
async function approach(player, groundItem) {
    const { world } = player;

    for (let i = 0; i < MAX_APPROACH_STEPS; i += 1) {
        if (player.withinRange(groundItem, TELEGRAB_RANGE * 2, true)) {
            return true;
        }

        if (player.walkQueue.length || player.locked) {
            return false;
        }

        const [step] = player.getPointSteps(groundItem.x, groundItem.y, false);

        if (!step || !player.canWalk(step.deltaX, step.deltaY)) {
            break;
        }

        player.walkTo(step.deltaX, step.deltaY);
        await world.sleepTicks(1);
    }

    return player.withinRange(groundItem, TELEGRAB_RANGE * 2, true);
}

function isStillThere(world, groundItem) {
    return world.groundItems.getByIndex(groundItem.index) === groundItem;
}

// the checks the Open-RSC spell makes once it reaches the item; returns the
// message to show (null for the silent refusals) or undefined when it is fine
function refusal(groundItem) {
    const { id, x, y } = groundItem;

    if (id === PRESENT_ID) {
        return null;
    }

    if (UNGRABBABLE.has(id)) {
        return "I can't use telekinetic grab on this object";
    }

    if (LEGENDS_GEMS.some(([gemID, gemX, gemY]) =>
        id === gemID && x === gemX && y === gemY)) {
        return null;
    }

    // upstairs of the Seers' party hall
    if (inBounds(groundItem, 490, 1408, 500, 1415)) {
        return "You can't cast this spell within the vicinity of the party hall";
    }

    if (inWatchtowerPedestal(groundItem)) {
        return "I can't see the object from here";
    }

    if (id === BLUE_WIZARDS_HAT_ID) {
        return 'The spell fizzles as the magical hat resists your spell.';
    }

    if (id === GERTRUDES_CAT_ID) {
        return "I can't use telekinetic grab on the cat";
    }

    if (id === ANA_IN_A_BARREL_ID) {
        return "I can't use telekinetic grab on Ana";
    }

    // Rashiliyia's Tomb coin respawn
    if (id === COINS_ID && x === 358 && y === 3626) {
        return 'The coins turn to dust in your inventory...';
    }

    // upstairs of the Varrock museum, where drop parties were held
    if (inBounds(groundItem, 97, 1428, 106, 1440)) {
        return 'Telekinetic grab cannot be used in here';
    }

    return undefined;
}

async function telegrab(player, groundItem, spell, spellID) {
    const { world } = player;

    // level and runes are checked before the walk, like the Open-RSC sanity
    // checks, so a missing rune costs no steps
    if (!cast.checkCast(player, spellID, spell)) {
        return;
    }

    // one walk-in at a time: a second click while walking is dropped
    if (player.magicApproaching) {
        return;
    }

    player.walkQueue.length = 0;
    player.magicApproaching = true;

    let reached;

    try {
        reached = await approach(player, groundItem);
    } finally {
        player.magicApproaching = false;
    }

    if (!isStillThere(world, groundItem)) {
        return;
    }

    if (!reached) {
        player.message("I can't get close enough");
        return;
    }

    if (!player.withinLineOfSight(groundItem, true)) {
        player.message("I can't see the object from here");
        return;
    }

    const refused = refusal(groundItem);

    if (typeof refused !== 'undefined') {
        if (refused) {
            player.message(refused);
        }

        return;
    }

    // the walk took ticks: everything may have changed
    const cost = cast.checkCast(player, spellID, spell);

    if (!cost || !isStillThere(world, groundItem)) {
        return;
    }

    player.sendTeleportBubble(groundItem.x, groundItem.y, 'telegrab');

    for (const other of player.localEntities.known.players) {
        other.sendTeleportBubble(groundItem.x, groundItem.y, 'telegrab');
    }

    world.removeEntity('groundItems', groundItem);
    cast.finishCast(player, spellID, cost, 'Spell successful');
    player.inventory.add(groundItem.id, groundItem.amount);
}

async function onCastOnGroundItem(player, groundItem, spell, spellID) {
    if (spellID !== TELEKINETIC_GRAB) {
        return false;
    }

    await telegrab(player, groundItem, spell, spellID);
    return true;
}

module.exports = { onCastOnGameObject, onCastOnGroundItem };
