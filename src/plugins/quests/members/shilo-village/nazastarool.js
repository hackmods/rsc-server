// Ported from Open-RSC Core-Framework authentic/quests/members/shilovillage/ShiloVillageNazastarool.java (AGPL-3.0): the
// Nazastarool dolmen (724) in Rashiliyia's tomb. Touching it raises Nazastarool as a zombie, then a skeleton, then a ghost (cache
// dolmen_zombie, dolmen_skeleton, dolmen_ghost); once all three are beaten the dolmen gives Rashiliyia's remains. Without the
// Beads of the dead worn the invisible hands choke the player. Stage map: shared.js.
//
// deviation: the Java's EscapeNpcTrigger (a player who runs from the fight is sent to 379,3626 and the Nazastarool removed) has no
//   hook here; the fight just goes on, and the dolmen raises a new one for the stage still undone.
// deviation: Nazastarool's definition is hostility "retreats", which makes an npc flee at a quarter of its hits; it is a boss
//   that fights to the death here, so the flag is cleared.

const {
    ITEM,
    NPC,
    cacheHas,
    cacheSet,
    mes,
    delay,
    hurt,
    hitsCurrent,
    beadsWorn,
    spawnNpc,
    moveNpc,
    attackSoon
} = require('./shared');

const DOLMEN = 724;
const NAZASTAROOL = new Set([NPC.NAZASTAROOL_ZOMBIE, NPC.NAZASTAROOL_SKELETON, NPC.NAZASTAROOL_GHOST]);
const FIVE_MINUTES = 60000 * 5;

async function choke(player) {
    await mes(player, '@red@You feel invisible hands starting to choke you...');
    hurt(player, Math.floor(hitsCurrent(player) / 2));
}

async function shout(npc) {
    if (npc.id === NPC.NAZASTAROOL_ZOMBIE) {
        await npc.say("Who dares disturb Rashiliyias' rest?", 'I am Nazastarool!', 'Prepare to die!');
    } else if (npc.id === NPC.NAZASTAROOL_SKELETON) {
        await npc.say('Quake in fear, for I am reborn!', 'Your death will be swift.');
    } else if (npc.id === NPC.NAZASTAROOL_GHOST) {
        await npc.say('Nazastarool returns with vengeance!', 'Soon you will serve Rashiliyia!');
    }
}

// spawnAndMoveAway
async function spawnAndMoveAway(player, id) {
    const npc = spawnNpc(player, id, 380, 3625, FIVE_MINUTES);

    npc.retreats = false;
    await delay(player, 2);
    moveNpc(npc, 381, 3625);
    await shout(npc);
    attackSoon(player, npc, 4);

    return npc;
}

async function dolmen(player, gameObject) {
    if (gameObject.id !== DOLMEN) {
        return false;
    }

    if (cacheHas(player, 'dolmen_zombie') && cacheHas(player, 'dolmen_skeleton') && cacheHas(player, 'dolmen_ghost')) {
        if (!beadsWorn(player)) {
            await choke(player);
        }

        if (player.inventory.has(ITEM.RASHILIYA_CORPSE)) {
            player.message('You find nothing new on the Dolmen.');
            return true;
        }

        await mes(player, 'You search the Dolmen...');
        await mes(player, 'and find the mumified remains of a human female corpse.');
        player.message('Do you want to take the corpse?');

        const menu = await player.ask(["Yes, I'll take the remains.", "No, I'll leave them where they are."]);

        if (menu === 0) {
            player.message('You carefully place the remains in your inventory.');
            player.inventory.add(ITEM.RASHILIYA_CORPSE, 1);

            if (!cacheHas(player, 'rashiliya_corpse')) {
                cacheSet(player, 'rashiliya_corpse');
            }
        } else if (menu === 1) {
            player.message('You decide to leave the remains where they are.');
        }

        return true;
    }

    if (!beadsWorn(player)) {
        await choke(player);
    }

    player.message('You touch the Dolmen, and the ground starts to shake.');
    await delay(player, 2);
    player.message('You hear an unearthly voice booming and ');
    await delay(player, 2);
    player.message('you step away from the Dolmen in anticipation...');
    await delay(player, 2);
    player.teleport(380, 3625);

    if (!beadsWorn(player)) {
        await choke(player);
    }

    if (!cacheHas(player, 'dolmen_zombie')) {
        await spawnAndMoveAway(player, NPC.NAZASTAROOL_ZOMBIE);
    } else if (!cacheHas(player, 'dolmen_skeleton')) {
        await spawnAndMoveAway(player, NPC.NAZASTAROOL_SKELETON);
    } else if (!cacheHas(player, 'dolmen_ghost')) {
        await spawnAndMoveAway(player, NPC.NAZASTAROOL_GHOST);
    }

    return true;
}

// Look is the same as Search in the Java (it claims every command)
async function onGameObjectCommandOne(player, gameObject) {
    return dolmen(player, gameObject);
}

async function onGameObjectCommandTwo(player, gameObject) {
    return dolmen(player, gameObject);
}

// ShiloVillageNazastarool.onKillNpc: the next form rises (the default drops carry on)
async function onNPCDeath(player, npc) {
    if (!player || !player.questStages || !NAZASTAROOL.has(npc.id)) {
        return false;
    }

    if (npc.id === NPC.NAZASTAROOL_ZOMBIE) {
        if (!cacheHas(player, 'dolmen_zombie')) {
            cacheSet(player, 'dolmen_zombie');
        }

        player.message('You defeat Nazastarool and the corpse falls to  ');
        await delay(player, 2);
        player.message('the ground. The bones start to move again and   ');
        await delay(player, 2);
        player.message('soon they reform into a grisly giant skeleton.  ');
        await delay(player, 2);
        await spawnAndMoveAway(player, NPC.NAZASTAROOL_SKELETON);
    } else if (npc.id === NPC.NAZASTAROOL_SKELETON) {
        if (!cacheHas(player, 'dolmen_skeleton')) {
            cacheSet(player, 'dolmen_skeleton');
        }

        player.message('You defeat the Nazastarool Skeleton as the corpse falls to ');
        await delay(player, 2);
        player.message('the ground. An ethereal form starts taking shape above the ');
        await delay(player, 2);
        player.message('bones and you soon face the vengeful ghost of Nazastarool ');
        await delay(player, 2);
        await spawnAndMoveAway(player, NPC.NAZASTAROOL_GHOST);
    } else if (npc.id === NPC.NAZASTAROOL_GHOST) {
        if (!cacheHas(player, 'dolmen_ghost')) {
            cacheSet(player, 'dolmen_ghost');
        }

        player.message('@yel@Nazastarool: May you perish in the fires of Zamoraks furnace!');
        await delay(player, 2);
        player.message('@yel@Nazastarool: May Rashiliyias Curse be upon you!');
        await delay(player, 2);
        player.message('You see something appear on the Dolmen');
    }

    // the default death carries on
    return false;
}

// ShiloVillageNazastarool.onSpellNpc: a spell never lands, it chokes the caster without the beads and heals the Nazastarool
async function onCastOnNPC(player, npc) {
    if (!NAZASTAROOL.has(npc.id)) {
        return false;
    }

    if (!beadsWorn(player)) {
        await choke(player);
    }

    npc.skills.hits.current = npc.skills.hits.base;

    return true;
}

module.exports = { onGameObjectCommandOne, onGameObjectCommandTwo, onNPCDeath, onCastOnNPC };
