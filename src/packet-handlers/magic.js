// RuneScape Classic magic: the cast* messages the client sends from the magic
// tab (ARSC overlay; upstream had no handler, so every spell was ignored).
//
//  - castSelf: Varrock, Lumbridge, Falador, Camelot, Ardougne and Watchtower
//    teleports, bones to bananas
//  - castNPC: strike/bolt/blast/wave spells, crumble undead, Iban blast and the
//    god spells (with their staffs), and the stat curses
//  - castInventoryItem: low and high level alchemy, superheat item, enchant
//    lvl-1 to lvl-5 amulet
//  - castPlayer: strike/bolt/blast/wave spells and the stat curses on other
//    players, in the Wilderness only (rules in ../wilderness.js); god spells
//    and Mage Arena duels are refused
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

const BONES_TO_BANANAS = 7;
const LOW_ALCHEMY = 10;
const HIGH_ALCHEMY = 28;
const SUPERHEAT = 21;
const CRUMBLE_UNDEAD = 19;

// spell index: max hit ("A strength N missile attack")
const MISSILES = {
    0: 1, // wind strike
    2: 2, // water strike
    4: 3, // earth strike
    6: 4, // fire strike
    8: 5, // wind bolt
    11: 6, // water bolt
    14: 7, // earth bolt
    17: 8, // fire bolt
    19: 7, // crumble undead (undead only)
    20: 9, // wind blast
    23: 10, // water blast
    25: 25, // iban blast
    27: 11, // earth blast
    32: 12, // fire blast
    33: 18, // claws of guthix
    34: 18, // saradomin strike
    35: 18, // flames of zamorak
    37: 13, // wind wave
    39: 14, // water wave
    43: 15, // earth wave
    45: 16 // fire wave
};

// spell index: staff ids that must be wielded, and its name for the message
const REQUIRED_STAFFS = {
    25: { ids: [1000, 1031], name: 'staff of Iban' },
    33: { ids: [1217], name: 'staff of guthix' },
    34: { ids: [1218], name: 'staff of Saradomin' },
    35: { ids: [1216], name: 'staff of zamorak' }
};

// spell index: the stat it drains and by how much
const CURSES = {
    1: { skill: 'attack', fraction: 0.05 }, // confuse
    5: { skill: 'strength', fraction: 0.05 }, // weaken
    9: { skill: 'defense', fraction: 0.05 }, // curse
    41: { skill: 'defense', fraction: 0.1 }, // vulnerability
    44: { skill: 'strength', fraction: 0.1 }, // enfeeble
    46: { skill: 'attack', fraction: 0.1 } // stun
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

// the max hit of a missile spell; Charge lifts the god spells for a god cape
// wearer (Open-RSC CombatFormula.calculateGodSpellDamage)
function getMaxHit(player, id) {
    if (
        GOD_SPELLS.has(id) &&
        isCharged(player) &&
        GOD_CAPE_IDS.some((capeID) => player.inventory.isEquipped(capeID))
    ) {
        return GOD_SPELL_CHARGED_MAX_HIT;
    }

    return MISSILES[id];
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

    const cost = checkCast(player, id, spell);

    if (!cost) {
        return;
    }

    finishCast(player, id, cost);

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

// accuracy roll in the same shape as combat.js rollDamage, magic level and
// magic bonus against the npc's defence; a hit is uniform 1..maxHit
function rollSpellDamage(player, npc, maxHit) {
    const magicBonus = player.equipmentBonuses.magic || 1;
    const accuracy =
        (player.skills.magic.current + 8) * (magicBonus * (1 / 600) + 0.1);
    const protection = npc.skills.defense.current * (1 / 600 + 0.1);
    const odds = Math.floor(
        Math.min(212, (255 * accuracy) / Math.max(protection * 4, 0.01))
    );

    if (Math.random() * 256 > odds) {
        return 0;
    }

    return 1 + Math.floor(Math.random() * maxHit);
}

// the npc fights back like it does against ranged
function retaliate(player, npc) {
    if (npc.locked || npc.opponent || npc.chasing === player) {
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
        player.message(`You need to be wielding the ${staff.name}`);
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

    if (curse) {
        const skill = npc.skills[curse.skill];
        skill.current = Math.max(
            0,
            skill.current - Math.max(1, Math.ceil(skill.base * curse.fraction))
        );
        retaliate(player, npc);
        return;
    }

    const damage = rollSpellDamage(player, npc, getMaxHit(player, id));
    const died = npc.damage(damage, player, 'magic');

    if (!died) {
        retaliate(player, npc);
    }
}

function playerGone(target) {
    return !target.loggedIn || target.skills.hits.current <= 0;
}

// a spell cast on another player (Open-RSC SpellHandler handleMobCast, player
// branch): Wilderness only, missiles and stat curses; god spells are refused
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

    if (GOD_SPELLS.has(id) || inMageArena(player) || inMageArena(victim)) {
        player.message("You can't attack other players here");
        return;
    }

    if (id === CRUMBLE_UNDEAD) {
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
        player.message(`You need to be wielding the ${staff.name}`);
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

    wilderness.skullOnAttack(player, victim);
    wilderness.markCombat(player, victim);

    if (curse) {
        const skill = victim.skills[curse.skill];
        skill.current = Math.max(
            0,
            skill.current - Math.max(1, Math.ceil(skill.base * curse.fraction))
        );

        if (typeof victim.sendStats === 'function') {
            victim.sendStats();
        }

        return;
    }

    const damage = rollSpellDamage(player, victim, getMaxHit(player, id));
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
