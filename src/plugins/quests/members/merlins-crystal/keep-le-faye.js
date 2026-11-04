// Ported from Open-RSC Core-Framework authentic/quests/members/MerlinsCrystal.java (AGPL-3.0): stowing away in Arhein's
// ship (292/293, Catherby docks) to Keep Le Faye, the bucket crate (291) on the docks, and Sir Mordred (276) spared for
// Morgan Le Faye's (281) secret. Stages: camelot.js.
//   ship: stages 0-1 "I have no reason to do that"; Arhein (280) within 10 tiles shouts; otherwise a short voyage to
//         (456,520) by the keep
//   Mordred: from stage 1 on, his "death" heals him and brings Morgan Le Faye (63 s): "Tell me how to untrap Merlin and
//         I might" moves stage 2 -> 3. "No he deserves to die" removes him (no drops); stage 0 or done drops bones
// Not ported: nothing.

const ARHEIN_ID = 280;
const SIR_MORDRED_ID = 276;
const MORGAN_LE_FAYE_ID = 281;

const BUCKET_CRATE_ID = 291;
const SHIP_IDS = new Set([292, 293]);

const BUCKET_ID = 21;
const BONES_ID = 20;

// addnpc(..., 63 seconds), in 640 ms ticks
const LE_FAYE_TICKS = Math.ceil(63000 / 640);

function stageOf(player) {
    return player.questStages.merlinsCrystal || 0;
}

// Open-RSC Functions.ifnearvisnpc: an npc of that id that is not busy (talking), within radius - 1 tiles on both axes
function nearVisible(player, id, radius) {
    return player
        .getNearbyEntitiesByID('npcs', id, radius)
        .find((npc) => !npc.locked && Math.max(Math.abs(npc.x - player.x), Math.abs(npc.y - player.y)) < radius);
}

async function stowAway(player) {
    const { world } = player;
    const stage = stageOf(player);

    if (stage >= 0 && stage < 2) {
        player.message('I have no reason to do that');
        return true;
    }

    const arhein = nearVisible(player, ARHEIN_ID, 10);

    if (arhein) {
        await arhein.say('Oi get away from there!');
        return true;
    }

    player.teleport(456, 3352);
    player.message('You hide away in the ship');
    await world.sleepTicks(2);
    player.message('The ship starts to move');
    await world.sleepTicks(5);
    player.message('You are out at sea');
    await world.sleepTicks(5);
    player.message('The ship comes to a stop');
    player.teleport(456, 520);
    player.message('You sneak out of the ship');
    await world.sleepTicks(3);

    return true;
}

async function onGameObjectCommandOne(player, gameObject) {
    if (!SHIP_IDS.has(gameObject.id)) {
        return false;
    }

    return stowAway(player);
}

async function onGameObjectCommandTwo(player, gameObject) {
    if (gameObject.id !== BUCKET_CRATE_ID) {
        return false;
    }

    const { world } = player;

    player.message('there are buckets in this crate');
    await world.sleepTicks(2);
    player.message('would you like a bucket?');

    const opt = await player.ask(['Yes', 'No'], true);

    if (opt === 0) {
        player.message('you take a bucket.');
        player.inventory.add(BUCKET_ID);
    }

    return true;
}

async function spareMordred(player, mordred) {
    const { world } = player;

    // MerlinsCrystal.onKillNpc: "from replay should do full heal"
    mordred.abandonFight();
    mordred.skills.hits.current = mordred.skills.hits.base;

    let leFaye = nearVisible(player, MORGAN_LE_FAYE_ID, 8);

    if (!leFaye) {
        leFaye = world.spawnTimedNPC({ id: MORGAN_LE_FAYE_ID, x: 461, y: 2407, ticks: LE_FAYE_TICKS });
    }

    await world.sleepTicks(1);

    player.engage(leFaye);
    await leFaye.say('Please spare my son');

    const option = await player.ask(['Tell me how to untrap Merlin and I might', 'No he deserves to die', 'OK then'], true);

    if (option === 0) {
        if (stageOf(player) === 2) {
            player.questStages.merlinsCrystal = 3;
        }

        await leFaye.say("You have guessed correctly that I'm responsible for that");
        await leFaye.say('I suppose I can live with that fool Merlin being loose');
        await leFaye.say('for the sake of my son');
        await leFaye.say("Setting him free won't be easy though");
        await leFaye.say('You will need to find a pentagram as close to the crystal as you can find');
        await leFaye.say('You will need to drop some bats bones in the pentagram');
        await leFaye.say('while holding a black candle');
        await leFaye.say('This will summon the demon Thrantax');
        await leFaye.say('You will need to bind him with magic words');
        await leFaye.say('Then you will need the sword Excalibur with which the spell was bound');
        await leFaye.say('Shatter the crystal with Excalibur');

        const sub = await player.ask(
            ['So where can I find Excalibur?', 'OK I will do all that', 'What are the magic words?'],
            true
        );

        if (sub === 0) {
            await leFaye.say('The lady of the lake has it');
            await leFaye.say("I don't know if she will give it you though");
            await leFaye.say('She can be rather temperamental');

            const sub2 = await player.ask(['OK I will go do all that', 'What are the magic words?'], false);

            if (sub2 === 0) {
                await player.say('OK I will do all that');
                player.message('Morgan Le Faye vanishes');
            } else if (sub2 === 1) {
                await player.say('What are the magic words?');
                await leFaye.say('You will find the magic words at the base of one of the chaos altars');
                await leFaye.say('Which chaos altar I cannot remember');
            }
        } else if (sub === 1) {
            player.message('Morgan Le Faye vanishes');
        } else if (sub === 2) {
            await leFaye.say('You will find the magic words at the base of one of the chaos altars');
            await leFaye.say('Which chaos altar I cannot remember');
        }
    } else if (option === 1) {
        player.disengage();
        player.message('You kill Mordred');
        world.removeEntity('npcs', mordred);
        return;
    } else if (option === 2) {
        player.message('Morgan Le Faye vanishes');
    }

    player.disengage();
}

// Java blockKillNpc: Mordred never dies the normal way (no drops, no kill reward)
async function onNPCDeath(player, npc) {
    if (npc.id !== SIR_MORDRED_ID || !player) {
        return false;
    }

    const stage = stageOf(player);

    if (stage > 0) {
        await spareMordred(player, npc);
    } else {
        player.world.addPlayerDrop(player, BONES_ID, npc.x, npc.y);
        player.world.removeEntity('npcs', npc);
    }

    return true;
}

module.exports = { onGameObjectCommandOne, onGameObjectCommandTwo, onNPCDeath };
