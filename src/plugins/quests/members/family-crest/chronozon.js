// Ported from Open-RSC Core-Framework authentic/quests/members/FamilyCrest.java onKillNpc and
// net/rsc/handlers/SpellHandler.java (the "chronoz_<element>" attributes) (AGPL-3.0).
// Chronozon (315), the blood demon under the obelisk of air (Wilderness): he regenerates on death unless this player
// has hit him with wind, water, earth and fire blast. When he dies he drops ashes (his drop table) and, at stage 8,
// crest fragment 697.

const { ITEMS, NPCS, stage } = require('./shared');

const ELEMENTS = ['wind', 'water', 'earth', 'fire'];

// Java keeps these as player attributes: they last until logout, not saved
function blasts(player) {
    if (!player.chronozonBlasts) {
        player.chronozonBlasts = new Set();
    }

    return player.chronozonBlasts;
}

// SpellHandler: every "... blast" cast on Chronozon weakens him and records its element. The cast goes on (false).
async function onCastOnNPC(player, npc, spell) {
    if (npc.id !== NPCS.chronozon || !spell || !/blast/.test(spell.name)) {
        return false;
    }

    player.message('chronozon weakens');
    blasts(player).add(spell.name.split(' ')[0].toLowerCase());

    return false;
}

async function onNPCDeath(player, npc) {
    if (npc.id !== NPCS.chronozon || !player) {
        return false;
    }

    if (!ELEMENTS.every((element) => blasts(player).has(element))) {
        npc.skills.hits.current = npc.skills.hits.base;
        player.message('Chronozon regenerates');
        return true;
    }

    if (stage(player) === 8) {
        player.world.addPlayerDrop(player, ITEMS.crestFragmentThree, npc.x, npc.y);
    }

    // the default death drops his ashes, removes him and pays the kill
    return false;
}

module.exports = { onCastOnNPC, onNPCDeath };
