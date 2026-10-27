// Wilderness PvP rules, shared by the attack, magic, ranged, death and logout
// paths. Ported from Open-RSC Core-Framework (AGPL-3.0):
//   Player.checkAttack, setSkulledOn, addSkull/removeSkull, canBeReattacked,
//   canLogout (Player.java), Point.wildernessLevel, Inventory.dropOnDeath.
// Times are in ticks (640 ms): Java's 20 minute skull is 1875 ticks.

const SKULL_TICKS = 1875;
// Player.canLogout: no logout within 10 s of the last combat (16 ticks)
const COMBAT_LOGOUT_TICKS = 16;
// PVP_REATTACK_TIMER: a player who ran away can't be attacked again in melee
// for 5 ticks
const REATTACK_TICKS = 5;
// setSkulledOn: retaliating within 20 minutes of being attacked gives no skull
const RETALIATE_MS = 20 * 60 * 1000;

// the classic level formula (the client's skull indicator): ground floor and
// every plane above or below it share the overworld's level
function wildernessLevel({ x, y, world }) {
    const planeElevation = (world && world.planeElevation) || 944;
    const planeY = y % planeElevation;
    let depth = 2203 - (planeY + 1776);

    if (x + 2304 >= 2640) {
        depth = -50;
    }

    return depth > 0 ? 1 + Math.floor(depth / 6) : 0;
}

function inWilderness(entity) {
    return wildernessLevel(entity) > 0;
}

// Player.checkAttack (wilderness branch): a message for the attacker when the
// attack is refused, null when it may go ahead
function attackRefusal(attacker, victim, { missile = false } = {}) {
    const myLevel = wildernessLevel(attacker);
    const victimLevel = wildernessLevel(victim);

    if (myLevel < 1 || victimLevel < 1) {
        return "You can't attack other players here. Move to the wilderness";
    }

    const diff = Math.abs(attacker.combatLevel - victim.combatLevel);

    if (diff > myLevel) {
        return (
            `You can only attack players within ${myLevel} levels of your ` +
            'own here'
        );
    }

    if (diff > victimLevel) {
        return (
            'You can only attack players within ' +
            `${victimLevel} levels of your own there`
        );
    }

    if (!missile && !canBeReattacked(victim)) {
        return '';
    }

    return null;
}

function canBeReattacked(player) {
    const { world } = player;
    const ranAway = player.ranAwayTick;

    return (
        typeof ranAway !== 'number' ||
        !world ||
        ranAway + REATTACK_TICKS <= world.ticks
    );
}

// setSkulledOn: the attacker is skulled unless the victim attacked them first
// (within 20 minutes)
function skullOnAttack(attacker, victim, now = Date.now()) {
    if (!victim.attackedBy) {
        victim.attackedBy = new Map();
    }

    victim.attackedBy.set(attacker.id, now);

    const lastAttackedBy = attacker.attackedBy
        ? attacker.attackedBy.get(victim.id)
        : undefined;

    if (typeof lastAttackedBy === 'number' && now - lastAttackedBy <= RETALIATE_MS) {
        return false;
    }

    attacker.addSkull(SKULL_TICKS);
    return true;
}

function markCombat(...players) {
    for (const player of players) {
        if (player && player.username && player.world) {
            player.lastCombatTick = player.world.ticks;
        }
    }
}

function inCombatCooldown(player) {
    const { world } = player;

    if (player.opponent) {
        return true;
    }

    return (
        typeof player.lastCombatTick === 'number' &&
        !!world &&
        world.ticks - player.lastCombatTick < COMBAT_LOGOUT_TICKS
    );
}

// Inventory.dropOnDeath: the items a dead player keeps. Stackables (runes,
// coins, arrows, notes) are always lost; the 3 most valuable others are kept,
// none when skulled, +1 with Protect Item either way
function keptOnDeath(items, { skulled = false, protectItem = false } = {}) {
    const amount = (skulled ? 0 : 3) + (protectItem ? 1 : 0);

    const ranked = items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => !item.definition.stackable)
        .sort(
            (a, b) =>
                b.item.definition.price - a.item.definition.price ||
                a.index - b.index
        );

    return ranked.slice(0, amount).map(({ item }) => item);
}

module.exports = {
    SKULL_TICKS,
    COMBAT_LOGOUT_TICKS,
    REATTACK_TICKS,
    RETALIATE_MS,
    wildernessLevel,
    inWilderness,
    attackRefusal,
    canBeReattacked,
    skullOnAttack,
    markCombat,
    inCombatCooldown,
    keptOnDeath
};
