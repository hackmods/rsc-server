// ARSC poison rules, ported from Open-RSC (AGPL-3.0), server/src/com/openrsc/server:
// - constants/Poison.java: the power a poisonous NPC hits with
// - event/rsc/impl/combat/scripts/all/NpcPoisonPlayerScript.java: 1 in 10 NPC rounds poison the player
// - event/rsc/impl/combat/scripts/all/PlayerPoisonScript.java: poisoned weapon on a player, 1 in 4 rounds, power 48
// - event/rsc/impl/combat/CombatEvent.java: poisoned dagger on an NPC, 1 in 50 rounds, power 60
// - event/rsc/impl/projectile/RangeUtils.java: poisoned ammunition, 1 in 8 on a player (power 20), 1 in 50 on an NPC (60)
// The tick-by-tick damage is in Character#tickPoison (Open-RSC PoisonEvent.java).

const items = require('@2003scape/rsc-data/config/items.json');
const { ammunition } = require('@2003scape/rsc-data/ranged');

// { npcID: power }: poison scorpion, poison spider, dungeon spider, tribesman, jungle savage
const NPC_POISON_POWER = new Map([
    [271, 38],
    [292, 68],
    [656, 38],
    [421, 68],
    [776, 68]
]);

const POISONED_DAGGER = /^poisoned .*dagger$/i;
const POISONED_WEAPON = /^poisoned /i;
const POISONED_AMMUNITION = /^poison /i;

const NPC_ROUND_ODDS = 10;
const PLAYER_ROUND_ODDS = 4;
const NPC_TARGET_ODDS = 50;
const RANGED_PLAYER_ODDS = 8;

const PLAYER_WEAPON_POWER = 48;
const NPC_TARGET_POWER = 60;
const RANGED_PLAYER_POWER = 20;

// 1 in n, like DataConversions.random(1, n) == 1
function oneIn(n) {
    return Math.floor(Math.random() * n) === 0;
}

function hasEquipped(player, pattern) {
    return player.inventory.items.some(
        (item) => item.equipped && pattern.test(item.definition.name)
    );
}

function tellPlayerPoisonedNPC(player, npc) {
    player.message(
        `@gr3@You @gr2@have @gr1@poisioned @gr2@the ${npc.definition.name}!`
    );
}

// an NPC's melee round against a player (before the damage roll)
function npcRound(npc, player) {
    const power = NPC_POISON_POWER.get(npc.id);

    if (power === undefined || Math.floor(Math.random() * 100) < 90) {
        return false;
    }

    return player.poison(power);
}

// a player's melee round (before the damage roll)
function playerRound(player, target) {
    if (target.constructor.name === 'Player') {
        if (oneIn(PLAYER_ROUND_ODDS) && hasEquipped(player, POISONED_WEAPON)) {
            return target.poison(PLAYER_WEAPON_POWER);
        }

        return false;
    }

    if (
        target.poisonPower < 10 &&
        oneIn(NPC_TARGET_ODDS) &&
        hasEquipped(player, POISONED_DAGGER)
    ) {
        target.poison(NPC_TARGET_POWER, player);
        tellPlayerPoisonedNPC(player, target);
        return true;
    }

    return false;
}

// a player's arrow or bolt has hit (or tried to hit) the target
function rangedHit(player, target, ammunitionID) {
    if (
        !ammunition[ammunitionID] ||
        !POISONED_AMMUNITION.test(items[ammunitionID].name)
    ) {
        return false;
    }

    if (target.constructor.name === 'Player') {
        return oneIn(RANGED_PLAYER_ODDS)
            ? target.poison(RANGED_PLAYER_POWER)
            : false;
    }

    if (target.poisonPower < 10 && oneIn(NPC_TARGET_ODDS)) {
        target.poison(NPC_TARGET_POWER, player);
        tellPlayerPoisonedNPC(player, target);
        return true;
    }

    return false;
}

module.exports = { NPC_POISON_POWER, npcRound, playerRound, rangedHit };
