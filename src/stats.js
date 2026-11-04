// The RuneScript stat functions the Open-RSC plugins use (server/src/com/openrsc/server/plugins/Functions.java addstat,
// substat, healstat; AGPL-3.0). Skill names are this server's (player.skills keys: 'attack', 'defense', 'hits' ...).
// player.changeStat sends the stats.

// addstat: current + constant + current * percent / 100, capped at max + constant + max * percent / 100
function addStat(player, skill, constant, percent) {
    const stat = player.skills[skill];
    const cap = stat.base + constant + Math.floor((stat.base * percent) / 100);
    const level = Math.min(stat.current + constant + Math.floor((stat.current * percent) / 100), cap);

    player.changeStat(skill, level - stat.current, { cap });
}

// substat: current - (constant + current * percent / 100); on hits it is a real hit (a damage splat)
function subStat(player, skill, constant, percent) {
    const damage = constant + Math.floor((player.skills[skill].current * percent) / 100);

    if (skill === 'hits') {
        player.damage(damage);
    } else {
        player.changeStat(skill, -damage);
    }
}

// healstat: current + constant + max * percent / 100, never above the max (HEALSTAT_ON_CURRENT_STAT is off by default)
function healStat(player, skill, constant, percent) {
    const stat = player.skills[skill];
    const level = Math.min(stat.current + constant + Math.floor((stat.base * percent) / 100), stat.base);

    if (level > stat.current) {
        player.changeStat(skill, level - stat.current);
    }
}

module.exports = { addStat, subStat, healStat };
