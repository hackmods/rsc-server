// Tutorial Island's combat lessons: the rat (melee) and the chickens (magic).

const t = require('./core');

const WIND_STRIKE = 0;

async function onNPCAttack(player, npc) {
    if (npc.id !== t.NPC.RAT || !t.onTutorial(player)) {
        return false;
    }

    const stage = t.stage(player);

    // authentic: the rat may only be fought during the lesson itself
    if (stage === 16) {
        return false;
    }

    player.message(
        stage < 16
            ? '@que@Speak to the combat instructor before killing rats'
            : "@que@That's enough rat killing for now"
    );

    return true;
}

async function onNPCDeath(player, npc) {
    if (npc.id === t.NPC.RAT && t.stage(player) === 16) {
        t.setStage(player, 20);
        player.message("@que@Well done you've killed the rat");
        await player.world.sleepTicks(3);
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
