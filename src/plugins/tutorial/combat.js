// Tutorial Island's combat lessons: the rat (melee) and the chickens (magic).

const t = require('./core');

const WIND_STRIKE = 0;

async function onNPCAttack(player, npc) {
    if (npc.id !== t.NPC.RAT || !t.onTutorial(player)) {
        return false;
    }

    if (t.stage(player) < 16) {
        player.message('@que@Speak to the combat instructor before you attack the rat');
        return true;
    }

    return false;
}

async function onNPCDeath(player, npc) {
    if (npc.id === t.NPC.RAT && t.stage(player) === 16) {
        t.setStage(player, 20);
        player.message('@que@Well done, you have killed the rat');
        player.message('@que@Now speak to the combat instructor again');
    }

    // never block the default drop and respawn
    return false;
}

// the default cast (runes, damage, xp) still runs; this only records progress
async function onCastOnNPC(player, npc, spell, spellIndex) {
    if (npc.id !== t.NPC.CHICKEN || spellIndex !== WIND_STRIKE) {
        return false;
    }

    const stage = t.stage(player);

    if (stage !== 76 && stage !== 77) {
        return false;
    }

    const runes = spell.runes || [];

    if (!runes.every(({ id, amount }) => player.inventory.has(id, amount))) {
        return false;
    }

    t.setStage(player, stage + 1);

    if (stage === 76) {
        player.message('@que@Well done, now cast the spell once more');
    } else {
        player.message('@que@Now speak to the magic instructor again');
    }

    return false;
}

module.exports = { onNPCAttack, onNPCDeath, onCastOnNPC };
