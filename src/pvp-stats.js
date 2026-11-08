// ARSC Wilderness PvP record (docs/WILDERNESS.md in Autonomous-RSC). Every
// player-on-player death is a row in the data server's pvp_events table, and
// each player keeps running counters in player.cache.pvp, which is saved with
// the rest of the cache and ranked by the data server (pvpHiscores):
//   kills, deaths, assists, streak (current), bestStreak, damage (PvP damage
//   dealt in the Wilderness), deepest (Wilderness level reached), loot (coin
//   value of the drops taken from players)

const log = require('bole')('pvp');
const wilderness = require('./wilderness');

const REQUEST_MS = 5000;
const STREAK_CALLS = new Set([5, 10, 15, 20, 30, 50]);

function stats(player) {
    if (!player.cache) {
        player.cache = {};
    }

    if (!player.cache.pvp || typeof player.cache.pvp !== 'object') {
        player.cache.pvp = {
            kills: 0,
            deaths: 0,
            assists: 0,
            streak: 0,
            bestStreak: 0,
            damage: 0,
            deepest: 0,
            loot: 0
        };
    }

    return player.cache.pvp;
}

function isPlayer(entity) {
    // NPCs have no username
    return !!entity && typeof entity.username === 'string';
}

// one data-server request with a timeout; resolves {down} or {timeout} when
// there is no answer (the browser build has no data server for these)
async function request(world, message, ms = REQUEST_MS) {
    const client = world && world.server && world.server.dataClient;
    const sent = client && client.sendAndReceive ? client.sendAndReceive(message) : null;

    if (!sent) {
        return { down: true };
    }

    let timer;
    const timeout = new Promise((resolve) => {
        timer = setTimeout(() => resolve({ timeout: true }), ms);
    });

    try {
        return (await Promise.race([sent, timeout])) || { timeout: true };
    } catch (e) {
        log.error(e);
        return { down: true };
    } finally {
        clearTimeout(timer);
    }
}

// Character#damage: PvP damage dealt in the Wilderness
function onDamage(victim, attacker, amount) {
    if (!isPlayer(victim) || !isPlayer(attacker) || amount <= 0) {
        return;
    }

    if (!wilderness.inWilderness(victim)) {
        return;
    }

    stats(attacker).damage += amount;
}

// Player#tick: the deepest Wilderness level this player has stood in
function onMove(player) {
    if (player.pvpLastX === player.x && player.pvpLastY === player.y) {
        return;
    }

    player.pvpLastX = player.x;
    player.pvpLastY = player.y;

    const level = wilderness.wildernessLevel(player);

    if (level > 0) {
        const pvp = stats(player);

        if (level > pvp.deepest) {
            pvp.deepest = level;
        }
    }
}

// the style that dealt most of the killer's damage
function styleOf(victim, killer) {
    const total = (victim.playerDamage && victim.playerDamage.get(killer.id)) || 0;
    const ranged = (victim.rangedDamage && victim.rangedDamage.get(killer.id)) || 0;
    const magic = (victim.magicDamage && victim.magicDamage.get(killer.id)) || 0;
    const melee = total - ranged - magic;

    if (magic > ranged && magic > melee) {
        return 'magic';
    }

    if (ranged > melee) {
        return 'ranged';
    }

    return 'melee';
}

// the other online players who damaged the victim since its last death
function assistsOf(victim, killer) {
    const out = [];

    if (!victim.playerDamage || !victim.world || !victim.world.players) {
        return out;
    }

    for (const [id, damage] of victim.playerDamage.entries()) {
        const player = victim.world.players.getByID(id);

        if (player && player !== killer && player !== victim && damage > 0) {
            out.push(player);
        }
    }

    return out;
}

function lootValue(items) {
    let value = 0;

    for (const item of items || []) {
        const price = (item.definition && item.definition.price) || 0;
        value += price * (item.amount || 1);
    }

    return value;
}

// Player#processDeath, before the damage maps are cleared. `dropped` is the
// items the killer now owns. Updates the counters, tells the clans module
// (battle kills, clan chat), and stores the event. Returns the event
function onKill(victim, killer, { dropped = [], skulled = false } = {}) {
    if (!isPlayer(victim) || !isPlayer(killer)) {
        return null;
    }

    const clans = require('./clans');
    const killerStats = stats(killer);
    const victimStats = stats(victim);
    const assists = assistsOf(victim, killer);
    const loot = lootValue(dropped);

    killerStats.kills += 1;
    killerStats.streak += 1;
    killerStats.bestStreak = Math.max(killerStats.bestStreak, killerStats.streak);
    killerStats.loot += loot;

    const endedStreak = victimStats.streak;
    victimStats.deaths += 1;
    victimStats.streak = 0;

    for (const player of assists) {
        stats(player).assists += 1;
    }

    const event = {
        at: Date.now(),
        killerId: killer.id,
        killer: killer.username,
        victimId: victim.id,
        victim: victim.username,
        killerClan: clans.tagOf(killer.username),
        victimClan: clans.tagOf(victim.username),
        wildLevel: wilderness.wildernessLevel(victim),
        x: victim.x,
        y: victim.y,
        style: styleOf(victim, killer),
        assists: assists.map((player) => player.username),
        lootValue: loot,
        victimSkulled: !!skulled,
        battleId: null
    };

    event.battleId = clans.onKill(event, killer, victim);

    if (STREAK_CALLS.has(killerStats.streak)) {
        clans.announce(
            `${killer.getFormattedUsername()} is on a ${killerStats.streak} kill streak in the Wilderness!`
        );
    }

    if (endedStreak >= 5) {
        clans.announce(
            `${killer.getFormattedUsername()} ended ${victim.getFormattedUsername()}'s ${endedStreak} kill streak!`
        );
    }

    request(killer.world, { handler: 'pvpRecord', event }).then((reply) => {
        if (!reply || reply.down || reply.timeout || !reply.success) {
            log.warn('pvp event not stored', { killer: event.killer, victim: event.victim });
        }
    });

    return event;
}

module.exports = {
    stats,
    request,
    onDamage,
    onMove,
    onKill,
    styleOf,
    assistsOf,
    lootValue
};
