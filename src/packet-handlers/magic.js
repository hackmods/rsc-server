// RuneScape Classic magic: the cast* messages the client sends from the magic
// tab (ARSC overlay; upstream had no handler, so every spell was ignored).
//
//  - castSelf: Varrock, Lumbridge, Falador, Camelot, Ardougne and Watchtower
//    teleports, bones to bananas
//  - castNPC: strike/bolt/blast/wave spells, crumble undead, Iban blast and the
//    god spells (with their staffs), and the stat curses
//  - castInventoryItem: low and high level alchemy, superheat item, enchant
//    lvl-1 to lvl-5 amulet
//  - castPlayer: strike/bolt/blast/wave, Iban and god spells and the stat
//    curses on other players, in the Wilderness only (rules in
//    ../wilderness.js)
//  - damage is Open-RSC's (SpellDamages.java, CombatFormula
//    calculateMagicDamage): uniform 0..floor(spell power), no accuracy roll;
//    god spells need 100 casts in the Mage Arena before they work outside it
//  - castSelf also casts Charge (Open-RSC SpellHandler handleGroundCast): a
//    timed flag that lifts the god spells from 18 to 25 for a god cape wearer
//  - castGroundItem, castObject: offered to onCastOnGroundItem and
//    onCastOnGameObject plugins (telegrab and the charge orbs live in
//    plugins/skills/magic.js); otherwise ("Nothing interesting happens")
//  - castWallObject, castGround: not implemented ("Nothing interesting happens")
//
// Every cast checks the members flag, the magic level and the runes (an
// elemental staff stands in for its runes), then takes the runes and gives the
// spell's experience (rsc-data skills/magic.json, stored x4 like all server
// experience). Only exports cast* handlers: server.js registers every export of
// a packet-handler file by name.

const GameObject = require('../model/game-object');
const Item = require('../model/item');
const items = require('@2003scape/rsc-data/config/items');
const log = require('bole')('magic');
const spells = require('@2003scape/rsc-data/config/spells');
const wilderness = require('../wilderness');
const { smelting } = require('@2003scape/rsc-data/skills/smithing');
const { spellExperience } = require('@2003scape/rsc-data/skills/magic');

// ticks between two casts (~1.9s). the client gets no message, like ranged
const CAST_DELAY_TICKS = 3;

// tiles a missile spell reaches (precise radius), and how far we walk for it
const SPELL_RANGE = 5;
const MAX_APPROACH_STEPS = 10;

const PROJECTILE_MAGIC = 1;

const COINS_ID = 10;
const BONES_ID = 20;
const BANANA_ID = 249;
const COAL_ID = 155;
const IRON_ORE_ID = 151;
const STEEL_BAR_ID = 171;
const BRONZE_BAR_ID = 169;

// Charge (Open-RSC SpellHandler): lasts 6 minutes, the effect object shows on
// the caster's tile for a moment
const CHARGE = 47;
const CHARGE_TICKS = Math.round((6 * 60 * 1000) / 640);
const CHARGE_OBJECT_ID = 1147;
const CHARGE_OBJECT_TICKS = 2;
const GOD_SPELLS = new Set([33, 34, 35]);
const GOD_SPELL_CHARGED_MAX_HIT = 25;
const GOD_CAPE_IDS = [1213, 1214, 1215]; // zamorak, saradomin, guthix
// the god spell cast counters the Open-RSC cache keeps (Mage Arena)
const GOD_CAST_KEYS = [
    'Flames of Zamorak_casts',
    'Saradomin strike_casts',
    'Claws of Guthix_casts'
];
const GOD_CASTS_REQUIRED = 100;
// Point.inMageArena
const MAGE_ARENA = { minX: 217, minY: 119, maxX: 239, maxY: 141 };

// rune id: wielded staffs that supply it without limit (same as the client's
// hasInventoryItems)
const STAFF_RUNES = {
    31: [197, 615, 682], // fire
    32: [102, 616, 683], // water
    33: [101, 617, 684], // air
    34: [103, 618, 685] // earth
};

const MEMBERS_SPELLS = new Set([
    'Camelot teleport',
    'Iban blast',
    'Ardougne teleport',
    'Charge Water Orb',
    'Enchant lvl-4 amulet',
    'Watchtower teleport',
    'Claws of Guthix',
    'Saradomin strike',
    'Flames of Zamorak',
    'Charge earth Orb',
    'Wind wave',
    'Charge Fire Orb',
    'Water wave',
    'Charge air Orb',
    'Vulnerability',
    'Enchant lvl-5 amulet',
    'Earth wave',
    'Enfeeble',
    'Fire wave',
    'Stun',
    'Charge'
]);

// spell index: landing tile (classic landing spots, all checked walkable on
// the server's landscape; rsc-data's regions.json Ardougne spawn 588,521 is in
// Hemenster, so the market-side 588,621 is used)
const TELEPORTS = {
    12: { x: 122, y: 503 }, // Varrock square
    15: { x: 120, y: 648 }, // Lumbridge castle courtyard
    18: { x: 313, y: 550 }, // Falador park side
    22: { x: 465, y: 456 }, // Camelot castle
    26: { x: 588, y: 621 }, // East Ardougne
    31: { x: 637, y: 2628 } // top of the Watchtower
};

const ARDOUGNE_TELEPORT = 26;
const PLAGUE_SAMPLE_ID = 812;
const BONES_TO_BANANAS = 7;
const LOW_ALCHEMY = 10;
const HIGH_ALCHEMY = 28;
const SUPERHEAT = 21;
const CRUMBLE_UNDEAD = 19;
const IBAN_BLAST = 25;

// spell index: spell power { player, npc } against a player and an NPC.
// Open-RSC constants/SpellDamages.java modernMagicProjectiles (the table its
// SpellHandler uses for every elemental missile; on this members world it is
// the same for both targets), Constants.CRUMBLE_UNDEAD_MAX (8),
// CombatFormula.calculateIbanSpellDamage (15) and calculateGodSpellDamage (18,
// 25 charged). The hit is uniform 0..floor(power) with no accuracy roll
// (CombatFormula.calculateMagicDamage).
const MISSILES = {
    0: { player: 1, npc: 1 }, // wind strike
    2: { player: 2, npc: 2 }, // water strike
    4: { player: 3, npc: 3 }, // earth strike
    6: { player: 4, npc: 4 }, // fire strike
    8: { player: 4.5, npc: 4.5 }, // wind bolt
    11: { player: 5, npc: 5 }, // water bolt
    14: { player: 5.5, npc: 5.5 }, // earth bolt
    17: { player: 6, npc: 6 }, // fire bolt
    19: { player: 8, npc: 8 }, // crumble undead (undead only)
    20: { player: 6.5, npc: 6.5 }, // wind blast
    23: { player: 7, npc: 7 }, // water blast
    25: { player: 15, npc: 15 }, // iban blast
    27: { player: 7.5, npc: 7.5 }, // earth blast
    32: { player: 8, npc: 8 }, // fire blast
    33: { player: 18, npc: 18 }, // claws of guthix
    34: { player: 18, npc: 18 }, // saradomin strike
    35: { player: 18, npc: 18 }, // flames of zamorak
    37: { player: 8.5, npc: 8.5 }, // wind wave
    39: { player: 9, npc: 9 }, // water wave
    43: { player: 9.5, npc: 9.5 }, // earth wave
    45: { player: 10, npc: 10 } // fire wave
};

// SpellHandler: the gauntlets of chaos add 1 to a bolt spell
const GAUNTLETS_OF_CHAOS_ID = 701;
const BOLT_SPELLS = new Set([8, 11, 14, 17]);
// Family Crest's cache value for the chaos gauntlets (Gauntlets.CHAOS)
const FAMCREST_CHAOS = 3;

// spell index: staff ids that must be wielded, and the SpellHandler message
const REQUIRED_STAFFS = {
    25: {
        ids: [1000, 1031],
        message: 'you need the staff of iban to cast this spell'
    },
    33: {
        ids: [1217],
        message: 'you must weild the staff of guthix to cast this spell'
    },
    34: {
        ids: [1218],
        message: 'you must weild the staff of saradomin to cast this spell'
    },
    35: {
        ids: [1216],
        message: 'you must weild the staff of zamorak to cast this spell'
    }
};

// spell index: the stat it drains, by how much, and what a player victim is
// told (SpellHandler)
const CURSES = {
    1: {
        skill: 'attack',
        fraction: 0.05,
        message: 'Your attack has been reduced by a confuse spell!'
    },
    5: {
        skill: 'strength',
        fraction: 0.05,
        message: 'Your strength has been reduced by a weaken spell!'
    },
    9: {
        skill: 'defense',
        fraction: 0.05,
        message: 'Your defense has been reduced by a curse spell!'
    },
    41: {
        skill: 'defense',
        fraction: 0.1,
        message: 'Your defense has been reduced by a vulnerability spell!'
    },
    44: {
        skill: 'strength',
        fraction: 0.1,
        message: 'Your strength has been reduced by an enfeeble spell!'
    },
    46: {
        skill: 'attack',
        fraction: 0.1,
        message: 'Your attack has been reduced by a stun spell!'
    }
};

// spell index: { strung amulet id: enchanted id }, gem name
const ENCHANTS = {
    3: { from: 302, to: 314, gem: 'sapphire' },
    13: { from: 303, to: 315, gem: 'emerald' },
    24: { from: 304, to: 316, gem: 'ruby' },
    30: { from: 305, to: 317, gem: 'diamond' },
    42: { from: 610, to: 522, gem: 'dragonstone' }
};

const UNDEAD = /skeleton|zombie|ghost/i;

// ore id -> bar id, from the smithing data (coal is only ever a secondary)
const ORE_BARS = new Map();

for (const [barID, { ores }] of Object.entries(smelting)) {
    for (const { id: oreID } of ores) {
        if (oreID !== COAL_ID && !ORE_BARS.has(oreID)) {
            ORE_BARS.set(oreID, +barID);
        }
    }
}

function getSpell(id) {
    const spell = spells[id];

    if (!spell) {
        throw new RangeError(`invalid spell id ${id}`);
    }

    return spell;
}

function hasStaffFor(player, runeID) {
    const staffs = STAFF_RUNES[runeID];
    return !!staffs && staffs.some((id) => player.inventory.isEquipped(id));
}

// runes the cast takes from the inventory (a staff supplies its element)
function getRuneCost(player, spell) {
    return spell.runes.filter(({ id }) => !hasStaffFor(player, id));
}

function isCooling(player) {
    return (
        typeof player.magicReadyTick === 'number' &&
        player.world.ticks < player.magicReadyTick
    );
}

// members, level and runes: returns the rune cost, or null after telling the
// player what is wrong
function checkCast(player, id, spell) {
    const { world } = player;

    if (!world.members && MEMBERS_SPELLS.has(spell.name)) {
        player.message('You need to login to a members world to use this spell');
        return null;
    }

    if (player.skills.magic.current < spell.level) {
        player.message('Your magic ability is not high enough for this spell');
        return null;
    }

    const cost = getRuneCost(player, spell);

    for (const rune of cost) {
        if (!player.inventory.has(rune.id, rune.amount)) {
            player.message(
                "You don't have all the reagents you need for this spell"
            );

            return null;
        }
    }

    return cost;
}

// take the runes, give the experience and start the cast delay
function finishCast(player, id, cost, message = 'Cast spell successfully') {
    for (const { id: runeID, amount } of cost) {
        player.inventory.remove(runeID, amount);
    }

    player.magicReadyTick = player.world.ticks + CAST_DELAY_TICKS;
    player.sendSound('spellok');

    if (message) {
        player.message(message);
    }

    player.addExperience('magic', spellExperience[id]);
}

// Open-RSC player.isCharged: the timer is a tick count, and it fades by itself
function isCharged(player) {
    return (
        typeof player.chargeExpiresTick === 'number' &&
        player.world.ticks < player.chargeExpiresTick
    );
}

// SpellHandler: wielded chaos gauntlets (and, when Family Crest has recorded
// them, the chaos enchantment)
function hasChaosGauntlets(player) {
    if (!player.inventory.isEquipped(GAUNTLETS_OF_CHAOS_ID)) {
        return false;
    }

    const recorded = player.cache && player.cache.famcrest_gauntlets;
    return recorded === undefined || recorded === FAMCREST_CHAOS;
}

// the power of a missile spell against a player or an NPC; Charge lifts the
// god spells for a god cape wearer (Open-RSC
// CombatFormula.calculateGodSpellDamage), the chaos gauntlets lift the bolts
function getSpellPower(player, id, target) {
    if (GOD_SPELLS.has(id)) {
        return isCharged(player) &&
            GOD_CAPE_IDS.some((capeID) => player.inventory.isEquipped(capeID))
            ? GOD_SPELL_CHARGED_MAX_HIT
            : MISSILES[id].player;
    }

    const powers = MISSILES[id];
    let power = target && target.username ? powers.player : powers.npc;

    if (BOLT_SPELLS.has(id) && hasChaosGauntlets(player)) {
        power += 1;
    }

    return power;
}

// the highest hit a spell can give (calculateMagicDamage floors the power)
function getMaxHit(player, id, target) {
    return Math.floor(getSpellPower(player, id, target));
}

function inMageArena({ x, y }) {
    return (
        x >= MAGE_ARENA.minX &&
        x <= MAGE_ARENA.maxX &&
        y >= MAGE_ARENA.minY &&
        y <= MAGE_ARENA.maxY
    );
}

// can the player cast at all right now (not busy, no window open)
function isBusy(player) {
    return player.locked || player.hasInterfaceOpen() || isCooling(player);
}

async function teleport(player, id, spell) {
    if (wilderness.wildernessLevel(player) > 20) {
        player.message(
            'A mysterious force blocks your teleport spell!',
            "You can't use teleport after level 20 wilderness"
        );

        return;
    }

    // Open-RSC SpellHandler.canTeleport: the Ardougne teleport is learnt from Plague City's magic scroll
    // (quests/members/plague-city/items.js sets cache.ardougneScroll)
    if (id === ARDOUGNE_TELEPORT && !player.cache.ardougneScroll) {
        player.message("You don't know how to cast this spell yet", 'You need to do the plague city quest');
        return;
    }

    const cost = checkCast(player, id, spell);

    if (!cost) {
        return;
    }

    finishCast(player, id, cost);

    // Open-RSC SpellHandler.handleTeleport: Biohazard's plague sample (812) is too delicate for a teleport spell
    const { inventory } = player;

    if (inventory.has(PLAGUE_SAMPLE_ID)) {
        player.message('the plague sample is too delicate...', 'it disintegrates in the crossing');
        inventory.remove(PLAGUE_SAMPLE_ID, inventory.count(PLAGUE_SAMPLE_ID));
    }

    const { x, y } = TELEPORTS[id];
    player.teleport(x, y, true);
}

function bonesToBananas(player, id, spell) {
    const { inventory } = player;
    const boneIndexes = [];

    for (let i = 0; i < inventory.items.length; i += 1) {
        if (inventory.items[i].id === BONES_ID) {
            boneIndexes.push(i);
        }
    }

    if (!boneIndexes.length) {
        player.message("You aren't holding any bones!");
        return;
    }

    const cost = checkCast(player, id, spell);

    if (!cost) {
        return;
    }

    // swap in place so the inventory order (and the rune indexes) hold
    for (const index of boneIndexes) {
        const banana = new Item({ id: BANANA_ID });
        inventory.items[index] = banana;
        inventory.sendUpdate(index, banana);
    }

    finishCast(player, id, cost);
}

function charge(player, id, spell) {
    const { world } = player;

    // outside the Mage Arena only after 100 casts of every god spell tried
    if (!inMageArena(player)) {
        const casts = GOD_CAST_KEYS.filter((key) => key in player.cache);

        if (
            !casts.length ||
            casts.some((key) => player.cache[key] < GOD_CASTS_REQUIRED)
        ) {
            player.message('this spell can only be used in the mage arena');
            return;
        }
    }

    if (world.gameObjects.getAtPoint(player.x, player.y).length) {
        player.message(
            "You can't charge power here, please move to a different area"
        );

        return;
    }

    const cost = checkCast(player, id, spell);

    if (!cost) {
        return;
    }

    player.message('@gre@You feel charged with magic power');

    // casting again only restarts the countdown
    const expires = world.ticks + CHARGE_TICKS;
    player.chargeExpiresTick = expires;

    world.setTickTimeout(() => {
        if (player.chargeExpiresTick === expires) {
            delete player.chargeExpiresTick;
            player.message('@red@Your magic charge fades');
        }
    }, CHARGE_TICKS);

    const effect = new GameObject(world, {
        id: CHARGE_OBJECT_ID,
        direction: 0,
        x: player.x,
        y: player.y
    });

    world.addEntity('gameObjects', effect);

    world.setTickTimeout(() => {
        if (world.gameObjects.getByIndex(effect.index) === effect) {
            world.removeEntity('gameObjects', effect);
        }
    }, CHARGE_OBJECT_TICKS);

    finishCast(player, id, cost);
}

async function castSelf({ player }, { id }) {
    const spell = getSpell(id);

    if (player.opponent && TELEPORTS[id]) {
        player.message("You can't do that whilst you are fighting");
        return;
    }

    if (isBusy(player)) {
        return;
    }

    if (TELEPORTS[id]) {
        await teleport(player, id, spell);
    } else if (id === BONES_TO_BANANAS) {
        bonesToBananas(player, id, spell);
    } else if (id === CHARGE) {
        charge(player, id, spell);
    } else {
        player.message('Nothing interesting happens');
    }
}

function withinSpellRange(player, npc) {
    return (
        player.withinRange(npc, SPELL_RANGE * 2, true) &&
        player.withinLineOfSight(npc, true)
    );
}

function isGone(world, npc) {
    return npc.skills.hits.current <= 0 || !world.npcs.getByIndex(npc.index);
}

// walk straight at the npc until the spell reaches it. a new walk click
// (walkQueue refilled) or a dead target cancels
async function approach(
    player,
    npc,
    gone = (target) => isGone(player.world, target)
) {
    const { world } = player;

    for (let i = 0; i < MAX_APPROACH_STEPS; i += 1) {
        if (withinSpellRange(player, npc)) {
            return true;
        }

        if (player.walkQueue.length || player.locked || gone(npc)) {
            return false;
        }

        const [step] = player.getPointSteps(npc.x, npc.y, false);

        if (!step || !player.canWalk(step.deltaX, step.deltaY)) {
            break;
        }

        player.walkTo(step.deltaX, step.deltaY);
        await world.sleepTicks(1);
    }

    return withinSpellRange(player, npc);
}

// Open-RSC CombatFormula.calculateMagicDamage (CombatFormula.java:58-62):
// nextInt(floor(power) + 1), uniform 0..floor(power). There is no accuracy
// roll against the target's defence and no magic bonus in the damage
function rollSpellDamage(player, target, id) {
    const maxHit = getMaxHit(player, id, target);
    return Math.floor(Math.random() * (maxHit + 1));
}

// Open-RSC SpellHandler god spells: outside the Mage Arena only after 100
// casts of that spell inside it. Returns true (after telling the player) when
// the cast is refused
function godSpellRefused(player, id, spell) {
    if (!GOD_SPELLS.has(id) || inMageArena(player)) {
        return false;
    }

    const casts = player.cache ? player.cache[`${spell.name}_casts`] : undefined;

    if (typeof casts === 'number' && casts >= GOD_CASTS_REQUIRED) {
        return false;
    }

    const left =
        typeof casts === 'number' ? GOD_CASTS_REQUIRED - casts : GOD_CASTS_REQUIRED;

    player.message(
        'this spell can only be used in the mage arena',
        `You must learn this spell first, you need ${left} more casts in the ` +
            'mage arena'
    );

    return true;
}

// Open-RSC SpellHandler IBAN_BLAST: only after the Underground Pass quest, and 25 casts per charge of the staff (cache
// "Iban blast_casts", set to 25 by the quest and by the Flames of Zamorak). Returns true (after telling the player) when refused
function ibanBlastRefused(player, id, spell) {
    if (id !== IBAN_BLAST) {
        return false;
    }

    if (!player.questStages || player.questStages.undergroundPass !== -1) {
        player.message('you need to complete underground pass quest to cast this spell');
        return true;
    }

    const key = `${spell.name}_casts`;
    const casts = player.cache ? player.cache[key] : undefined;

    if (typeof casts === 'number' && casts < 1) {
        player.message('you need to recharge the staff of iban');
        player.message("at iban's temple");
        return true;
    }

    return false;
}

// each Iban blast uses a charge
function countIbanCast(player, id, spell) {
    const key = `${spell.name}_casts`;

    if (id === IBAN_BLAST && player.cache && typeof player.cache[key] === 'number') {
        player.cache[key] -= 1;
    }
}

// a god spell cast inside the Mage Arena counts towards the 100
function countGodCast(player, id, spell) {
    if (!GOD_SPELLS.has(id) || !inMageArena(player) || !player.cache) {
        return;
    }

    const key = `${spell.name}_casts`;
    const casts = typeof player.cache[key] === 'number' ? player.cache[key] : 0;

    player.cache[key] = casts + 1;

    if (casts === GOD_CASTS_REQUIRED - 1) {
        player.message(
            `Well done .. you can now use the ${spell.name} outside the arena`
        );
    }
}

// the curses lower the stat by a share of its current level (SpellHandler:
// ceil(level * lowersBy))
function curseStat(skill, fraction) {
    skill.current = Math.max(
        0,
        skill.current - Math.ceil(skill.current * fraction)
    );
}

// the npc fights back like it does against ranged
function retaliate(player, npc) {
    if (npc.locked || npc.opponent || npc.chasing === player) {
        return;
    }

    // a plugin's onCastOnNPC may forbid the chase (Open-RSC setChasing = false:
    // Kolodion and the battle mages in the Mage Arena, minigames/mage-arena.js)
    if (npc.magicNoChase) {
        return;
    }

    npc.attack(player)
        .then(() => {
            npc.retreatTicks = 4;
        })
        .catch((e) => log.error(e));
}

async function castNPC({ player }, { index, id }) {
    const spell = getSpell(id);
    const { world } = player;
    const npc = world.npcs.getByIndex(index);

    if (!npc) {
        throw new RangeError(`invalid npc index ${index}`);
    }

    // in melee the player is locked, but may still cast at their opponent
    const fightingIt = player.opponent === npc;

    if (
        (player.locked && !fightingIt) ||
        player.hasInterfaceOpen() ||
        isCooling(player)
    ) {
        return;
    }

    const isMissile = MISSILES[id] !== undefined;
    const curse = CURSES[id];

    if (!isMissile && !curse) {
        player.message('Nothing interesting happens');
        return;
    }

    if (!npc.definition.hostility) {
        player.message("I can't attack that");
        return;
    }

    if (id === CRUMBLE_UNDEAD && !UNDEAD.test(npc.definition.name)) {
        player.message(
            'This spell can only be used on skeletons, zombies and ghosts'
        );

        return;
    }

    const staff = REQUIRED_STAFFS[id];

    if (
        staff &&
        !staff.ids.some((staffID) => player.inventory.isEquipped(staffID))
    ) {
        player.message(staff.message);
        return;
    }

    if (godSpellRefused(player, id, spell) || ibanBlastRefused(player, id, spell)) {
        return;
    }

    if (curse && npc.skills[curse.skill].current < npc.skills[curse.skill].base) {
        const skillName = curse.skill === 'defense' ? 'defence' : curse.skill;
        player.message(`Your opponent already has weakened ${skillName}`);
        return;
    }

    // check before walking so a missing rune costs no steps
    if (!checkCast(player, id, spell)) {
        return;
    }

    if (!fightingIt) {
        // one walk-in at a time: a second click while walking is dropped
        if (player.magicApproaching) {
            return;
        }

        player.walkQueue.length = 0;
        player.magicApproaching = true;

        let reached;

        try {
            reached = await approach(player, npc);
        } finally {
            player.magicApproaching = false;
        }

        if (!reached) {
            if (isGone(world, npc)) {
                return;
            }

            player.message(
                player.withinRange(npc, SPELL_RANGE * 2, true)
                    ? "I can't get a clear shot from here"
                    : "I can't get close enough"
            );

            return;
        }
    }

    // the walk took ticks: everything may have changed
    const cost = checkCast(player, id, spell);

    if (!cost || isGone(world, npc) || isCooling(player)) {
        return;
    }

    // plugins (Tutorial Island's chickens) may take over the cast
    if (await world.callPlugin('onCastOnNPC', player, npc, spell, id)) {
        return;
    }

    player.faceEntity(npc);
    player.sendProjectile(npc, PROJECTILE_MAGIC);
    finishCast(player, id, cost, null);
    countGodCast(player, id, spell);
    countIbanCast(player, id, spell);

    if (curse) {
        curseStat(npc.skills[curse.skill], curse.fraction);
        retaliate(player, npc);
        return;
    }

    const damage = rollSpellDamage(player, npc, id);
    const died = npc.damage(damage, player, 'magic');

    if (!died) {
        retaliate(player, npc);
    }
}

function playerGone(target) {
    return !target.loggedIn || target.skills.hits.current <= 0;
}

// a spell cast on another player (Open-RSC SpellHandler handleMobCast, player
// branch): Wilderness only, missiles (god spells included) and stat curses
async function castPlayer({ player }, { index, id }) {
    const spell = getSpell(id);
    const { world } = player;
    const victim = world.players.getByIndex(index);

    if (!victim || victim === player || !victim.loggedIn) {
        return;
    }

    const fightingIt = player.opponent === victim;

    if (
        (player.locked && !fightingIt) ||
        player.hasInterfaceOpen() ||
        isCooling(player)
    ) {
        return;
    }

    const isMissile = MISSILES[id] !== undefined;
    const curse = CURSES[id];

    if (!isMissile && !curse) {
        player.message('Nothing interesting happens');
        return;
    }

    // Open-RSC SpellHandler: crumble undead is refused on players ("You can
    // not use this spell on a Player"); god spells are allowed like any
    // missile, under their staff and Mage Arena rules
    if (id === CRUMBLE_UNDEAD) {
        player.message('You can not use this spell on a Player');
        return;
    }

    const staff = REQUIRED_STAFFS[id];

    if (
        staff &&
        !staff.ids.some((staffID) => player.inventory.isEquipped(staffID))
    ) {
        player.message(staff.message);
        return;
    }

    if (godSpellRefused(player, id, spell) || ibanBlastRefused(player, id, spell)) {
        return;
    }

    // true (after telling the caster) when the Wilderness rules refuse
    const refused = () => {
        const refusal = wilderness.attackRefusal(player, victim, {
            missile: true
        });

        if (refusal === null) {
            return false;
        }

        if (refusal) {
            player.message(refusal);
        }

        return true;
    };

    if (refused()) {
        return;
    }

    if (
        curse &&
        victim.skills[curse.skill].current < victim.skills[curse.skill].base
    ) {
        const skillName = curse.skill === 'defense' ? 'defence' : curse.skill;
        player.message(`Your opponent already has weakened ${skillName}`);
        return;
    }

    // check before walking so a missing rune costs no steps
    if (!checkCast(player, id, spell)) {
        return;
    }

    if (!fightingIt) {
        if (player.magicApproaching) {
            return;
        }

        player.walkQueue.length = 0;
        player.magicApproaching = true;

        let reached;

        try {
            reached = await approach(player, victim, playerGone);
        } finally {
            player.magicApproaching = false;
        }

        if (!reached) {
            if (playerGone(victim)) {
                return;
            }

            player.message(
                player.withinRange(victim, SPELL_RANGE * 2, true)
                    ? "I can't get a clear shot from here"
                    : "I can't get close enough"
            );

            return;
        }
    }

    // the walk took ticks: everything may have changed
    const cost = checkCast(player, id, spell);

    if (!cost || playerGone(victim) || isCooling(player) || refused()) {
        return;
    }

    player.faceEntity(victim);
    player.sendProjectile(victim, PROJECTILE_MAGIC);
    finishCast(player, id, cost, null);
    countGodCast(player, id, spell);
    countIbanCast(player, id, spell);

    wilderness.skullOnAttack(player, victim);
    wilderness.markCombat(player, victim);

    if (curse) {
        curseStat(victim.skills[curse.skill], curse.fraction);

        if (typeof victim.sendStats === 'function') {
            victim.sendStats();
        }

        if (curse.message && typeof victim.message === 'function') {
            victim.message(curse.message);
        }

        return;
    }

    const damage = rollSpellDamage(player, victim, id);
    victim.damage(damage, player, 'magic');
}

function alchemy(player, id, spell, item, rate) {
    if (item.id === COINS_ID) {
        player.message("That's already made of gold!");
        return;
    }

    const cost = checkCast(player, id, spell);

    if (!cost) {
        return;
    }

    const coins = Math.floor(item.definition.price * rate);

    player.inventory.remove(item.id, 1);
    finishCast(player, id, cost);

    if (coins > 0) {
        player.inventory.add(COINS_ID, coins);
    }
}

function superheat(player, id, spell, item) {
    let barID = ORE_BARS.get(item.id);

    if (!barID) {
        player.message('This spell can only be used on ore');
        return;
    }

    if (item.id === IRON_ORE_ID && player.inventory.has(COAL_ID, 2)) {
        barID = STEEL_BAR_ID;
    }

    const { level, experience, ores } = smelting[barID];
    const metalName = items[barID].name.toLowerCase().replace(' bar', '');

    if (player.skills.smithing.current < level) {
        player.message(
            `@que@You need to be at least level-${level} smithing to ` +
                `smelt ${metalName}`
        );

        return;
    }

    for (const { id: oreID, amount = 1 } of ores) {
        if (!player.inventory.has(oreID, amount)) {
            const oreName = items[oreID].name.toLowerCase().replace(' ore', '');

            // same wording as smelting at a furnace (skills/smithing/smelting)
            if (barID === BRONZE_BAR_ID) {
                player.message(
                    `@que@You also need some ${oreName} to make ${metalName}`
                );
            } else {
                player.message(
                    `You need ${amount} heaps of ${oreName} to smelt ` +
                        metalName
                );
            }

            return;
        }
    }

    const cost = checkCast(player, id, spell);

    if (!cost) {
        return;
    }

    for (const { id: oreID, amount = 1 } of ores) {
        player.inventory.remove(oreID, amount);
    }

    finishCast(player, id, cost);
    player.inventory.add(barID);
    player.addExperience('smithing', experience);
}

function enchant(player, id, spell, item, index) {
    const { from, to, gem } = ENCHANTS[id];

    if (item.id !== from) {
        player.message(
            `This spell can only be used on unenchanted ${gem} amulets`
        );

        return;
    }

    const cost = checkCast(player, id, spell);

    if (!cost) {
        return;
    }

    const { inventory } = player;

    if (item.equipped) {
        inventory.unequip(index);
    }

    // the amulet keeps its slot; runes never sit at an amulet's index
    const enchanted = new Item({ id: to });
    inventory.items[index] = enchanted;
    inventory.sendUpdate(index, enchanted);
    finishCast(player, id, cost);
}

async function castInventoryItem({ player }, { index, id }) {
    const spell = getSpell(id);
    const item = player.inventory.items[index];

    if (!item) {
        throw new RangeError(`invalid item index ${index}`);
    }

    if (isBusy(player)) {
        return;
    }

    if (id === LOW_ALCHEMY) {
        alchemy(player, id, spell, item, 0.4);
    } else if (id === HIGH_ALCHEMY) {
        alchemy(player, id, spell, item, 0.6);
    } else if (id === SUPERHEAT) {
        superheat(player, id, spell, item);
    } else if (ENCHANTS[id]) {
        enchant(player, id, spell, item, index);
    } else {
        player.message('Nothing interesting happens');
    }
}

// wall object and ground spells: not implemented
async function notImplemented({ player }, { id }) {
    getSpell(id);

    if (isBusy(player)) {
        return;
    }

    player.message('Nothing interesting happens');
}

// plugins get the cast first (Open-RSC SpellLocTrigger: the charge orbs); an
// unclaimed cast gets the default message
async function castObject({ player }, { x, y, id }) {
    const spell = getSpell(id);

    if (isBusy(player)) {
        return;
    }

    const [gameObject] = player.world.gameObjects.getAtPoint(x, y);

    if (
        gameObject &&
        (await player.world.callPlugin(
            'onCastOnGameObject',
            player,
            gameObject,
            spell,
            id
        ))
    ) {
        return;
    }

    player.message('Nothing interesting happens');
}

async function castGroundItem({ player }, { x, y, id, itemID }) {
    const spell = getSpell(id);

    if (isBusy(player)) {
        return;
    }

    const groundItem = player.world.groundItems
        .getAtPoint(x, y)
        .find(
            (item) =>
                item.id === itemID && (!item.owner || item.owner === player.id)
        );

    // ARSC Iron Man (src/ironman.js, Open-RSC SpellHandler telekinetic grab)
    const ironman = groundItem && require('../ironman').takeRefusal(player, groundItem);

    if (ironman) {
        player.message(ironman);
        return;
    }

    if (
        groundItem &&
        (await player.world.callPlugin(
            'onCastOnGroundItem',
            player,
            groundItem,
            spell,
            id
        ))
    ) {
        return;
    }

    player.message('Nothing interesting happens');
}

module.exports = {
    castSelf,
    castNPC,
    castPlayer,
    castInventoryItem,
    castGroundItem,
    castObject,
    castWallObject: notImplemented,
    castGround: notImplemented
};

// the cast bookkeeping for plugins (plugins/skills/magic.js). not enumerable:
// server.js registers every enumerable export as a packet handler
Object.defineProperty(module.exports, 'cast', {
    value: { checkCast, finishCast, isCharged },
    enumerable: false
});
