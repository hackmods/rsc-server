// Ported from Open-RSC Core-Framework authentic/quests/members/watchtower/WatchTowerObstacles.java (the Gu'Tanoth side
// of it: ROCK_OVER 995 / ROCK_BACK 996, OGRE_CAVE_ENCLAVE 955, YANILLE_HOLE 968, WRONG_STEAL_COUNTER 973) and
// authentic/skills/mining/Mining.java (1026, the Rock of Dalgroth) (AGPL-3.0).
//
// The Watchtower quest is not on this server yet: player.questStages.watchtower is undefined, which these checks treat
// as the Java's stage 0 (not started). The quest gates are kept as the Java has them (the enclave is shut after the quest,
// the Rock of Dalgroth only gives its crystal at stage 9) so the quest port plugs in without touching this file.
// The island ladder 997 and the Skavid caves are fixed-tile rows in object-tele-points.js.

const COINS_ID = 10;
const BRONZE_PICKAXE_ID = 156;
const POWERING_CRYSTAL4_ID = 1154;
const PICKAXE_IDS = Object.keys(require('@2003scape/rsc-data/skills/mining').pickaxes).map(Number);

const ROCK_OVER = 995;
const ROCK_BACK = 996;
const OGRE_CAVE_ENCLAVE = 955;
const YANILLE_HOLE = 968;
const WRONG_STEAL_COUNTER = 973;
const ROCK_OF_DALGROTH = 1026;

const OGRE_GUARD_CAVE_ENTRANCE_ID = 684;
const OGRE_GUARD_BRIDGE_ID = 697;

const JUMP_LEVEL = 30;
const JUMP_EXPERIENCE = 50; // Java incExp(AGILITY, 50, true): quarter points, as rsc-data
const DALGROTH_LEVEL = 40;

const watchtowerStage = (player) => player.questStages.watchtower || 0;

function nearbyNPC(player, id, range) {
    return player.getNearbyEntitiesByID('npcs', id, range).find((npc) => !npc.locked);
}

// Java npc.startCombat(player): after the plugin returns, since the packet handler unlocks the player then
function attackSoon(player, npc) {
    player.world.setTickTimeout(() => {
        if (npc.opponent || player.opponent || npc.skills.hits.current <= 0) {
            return;
        }

        npc.unlock();
        Promise.resolve(npc.attack(player)).catch(() => {});
    }, 2);
}

// the authentic config (want_fatigue, stop_skilling_fatigued 1) refuses at full fatigue
function tooTired(player) {
    return typeof player.isTired === 'function' && player.isTired();
}

function jumpAcross(player) {
    if (tooTired(player)) {
        player.message('You are too tired to attempt this jump');
        return false;
    }

    player.message('You daringly jump across the chasm');
    player.teleport(647, 799);
    player.addExperience('agility', JUMP_EXPERIENCE);

    return true;
}

async function jumpOver(player, gameObject) {
    if (player.skills.agility.current < JUMP_LEVEL) {
        player.message(`You need agility level of ${JUMP_LEVEL} to attempt this jump`);
        return;
    }

    if (gameObject.id === ROCK_BACK) {
        player.teleport(646, 805);
        await player.say("I'm glad that was easier on the way back!");
        return;
    }

    const guard = nearbyNPC(player, OGRE_GUARD_BRIDGE_ID, 5);

    if (!guard) {
        if (jumpAcross(player)) {
            await player.say('Phew! I just made it');
        }

        return;
    }

    await guard.say('Oi! Little thing, if you want to cross here', 'You can pay me first - 20 gold pieces!');
    await player.say('20 gold pieces to jump off a bridge!!?');
    await guard.say("That's what I said, like it or lump it");

    const choice = await player.ask(["Okay i'll pay it", "Forget it, i'm not paying"], true);

    if (choice === 0) {
        await guard.say('A wise choice little thing');

        if (!player.inventory.has(COINS_ID, 20)) {
            await guard.say('And where is your money ? Grrrr!', 'Do you want to get hurt or something ?');
            return;
        }

        player.inventory.remove(COINS_ID, 20);

        if (jumpAcross(player)) {
            await player.say('Phew! I just made it');
        }
    } else if (choice === 1) {
        await guard.say("In that case you're not crossing");
        player.message('The guard blocks your path');
    }
}

async function enterOgreEnclave(player) {
    // LOCKED_POST_QUEST_REGIONS_ACCESSIBLE is false in the authentic config
    if (watchtowerStage(player) === -1) {
        player.message('The ogres have blocked this entrance now');
        return;
    }

    const guard = nearbyNPC(player, OGRE_GUARD_CAVE_ENTRANCE_ID, 5);

    if (guard) {
        await guard.say("No you don't!");
        attackSoon(player, guard);
    } else {
        // the quest way in: use nightshade on the ogre guard
        player.message('Nothing interesting happens');
    }
}

async function mineDalgroth(player) {
    if (watchtowerStage(player) !== 9) {
        await player.say("I can't touch it...", 'Perhaps it is linked with the shaman some way ?');
        return;
    }

    if (!PICKAXE_IDS.some((id) => player.inventory.has(id))) {
        player.message('@que@You need a pickaxe to mine the rock');
        return;
    }

    if (player.skills.mining.current < DALGROTH_LEVEL) {
        player.message(`@que@You need a mining level of ${DALGROTH_LEVEL} to mine this crystal out`);
        return;
    }

    if (player.inventory.has(POWERING_CRYSTAL4_ID)) {
        await player.say('I already have this crystal', 'There is no benefit to getting another');
        return;
    }

    player.sendSound('mine');
    // the Java shows the bronze pickaxe bubble here whatever pickaxe is used
    player.sendBubble(BRONZE_PICKAXE_ID);
    player.message('You have a swing at the rock!');
    player.message('@que@You swing your pick at the rock...');
    player.message('A crack appears in the rock and you prize a crystal out');
    player.inventory.add(POWERING_CRYSTAL4_ID);
}

function prospectDalgroth(player) {
    player.sendSound('prospect');
    player.message('@que@You examine the rock for ores...');
    player.message('@que@This rock contains a crystal!');
}

const command = (gameObject, index) => String((gameObject.definition.commands || [])[index] || '').toLowerCase();

async function onCommand(player, gameObject, index) {
    const cmd = command(gameObject, index);

    switch (gameObject.id) {
        case ROCK_OVER:
        case ROCK_BACK:
            if (cmd === 'look at') {
                player.message('The bridge has collapsed');
                player.message('It seems this rock is placed here to jump from');
            } else if (cmd === 'jump over') {
                await jumpOver(player, gameObject);
            } else {
                return false;
            }
            return true;
        case OGRE_CAVE_ENCLAVE:
            if (cmd !== 'enter') return false;
            await enterOgreEnclave(player);
            return true;
        case YANILLE_HOLE:
            if (cmd !== 'enter') return false;
            await player.say("I can't get through this way", 'This hole must lead to somewhere...');
            return true;
        case WRONG_STEAL_COUNTER:
            if (cmd !== 'steal from') return false;
            player.message('You find nothing to steal');
            return true;
        case ROCK_OF_DALGROTH:
            if (cmd === 'mine') {
                await mineDalgroth(player);
            } else if (cmd === 'prospect') {
                prospectDalgroth(player);
            } else {
                return false;
            }
            return true;
        default:
            return false;
    }
}

async function onGameObjectCommandOne(player, gameObject) {
    return onCommand(player, gameObject, 0);
}

async function onGameObjectCommandTwo(player, gameObject) {
    return onCommand(player, gameObject, 1);
}

module.exports = { onGameObjectCommandOne, onGameObjectCommandTwo };
