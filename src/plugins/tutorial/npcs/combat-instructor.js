// Tutorial Island combat instructor (dialogue only; the rat kill and attack
// gate live in ../combat.js). Port of OpenRSC CombatInstructor.java.
const t = require('../core');

const RAT_RANGE = 10;
const RAT_SPAWN = { x: 231, y: 735 };

function isEquipped(player, id) {
    const item = player.inventory.items.find((i) => i && i.id === id);
    return !!item && !!item.equipped;
}

// a missing item counts as fine, as in the Java
function wieldedOrAbsent(player, id) {
    return !player.inventory.has(id) || isEquipped(player, id);
}

function ratNearby(player) {
    const entities = (player.world.npcs && player.world.npcs.entities) || [];

    return [...entities].some(
        (n) =>
            n &&
            n.id === t.NPC.RAT &&
            Math.abs(n.x - player.x) <= RAT_RANGE &&
            Math.abs(n.y - player.y) <= RAT_RANGE
    );
}

function releaseRat(player) {
    const NPC = require('../../../model/npc');

    const rat = new NPC(player.world, {
        id: t.NPC.RAT,
        x: RAT_SPAWN.x,
        y: RAT_SPAWN.y,
        minX: RAT_SPAWN.x - 3,
        maxX: RAT_SPAWN.x + 3,
        minY: RAT_SPAWN.y - 3,
        maxY: RAT_SPAWN.y + 3
    });

    delete rat.respawn;
    player.world.addEntity('npcs', rat);
}

async function onTalkToNPC(player, npc) {
    if (npc.id !== t.NPC.COMBAT) {
        return false;
    }

    player.engage(npc);

    if (!t.onTutorial(player)) {
        await npc.say('Stay sharp out there, and watch the colour of the names');
        player.disengage();
        return true;
    }

    const stage = t.stage(player);

    if (stage < 15) {
        await npc.say(
            'Hold on there',
            'Speak to the controls guide before you come to me'
        );
    } else if (
        stage === 15 &&
        !player.inventory.has(t.ITEM.WOODEN_SHIELD) &&
        !player.inventory.has(t.ITEM.BRONZE_LONG_SWORD)
    ) {
        await npc.say('Aha a new recruit');

        if (player.inventory.items.length + 2 > 30) {
            player.message(
                '@que@You need two free inventory spaces for your weapon and shield'
            );
            player.disengage();
            return true;
        }

        await npc.say(
            "I'm here to teach you the basics of fighting",
            'First of all you need weapons'
        );
        t.give(player, t.ITEM.WOODEN_SHIELD, 1);
        t.give(player, t.ITEM.BRONZE_LONG_SWORD, 1);
        player.message('@que@The instructor gives you a sword and shield');
        await player.world.sleepTicks(3);
        await npc.say(
            'look after these well',
            'These items will now have appeared in your inventory',
            'You can access them by selecting the bag icon in the menu bar',
            'which can be found in the top right hand corner of the screen',
            'To wield your weapon and shield left click on them within your inventory',
            'their box will go red to show you are wearing them'
        );
        player.message(
            '@que@When you have done this speak to the combat instructor again'
        );
        t.setStage(player, 16);
    } else if (stage === 15 || stage === 16) {
        // stage 15 with gear already carried: the Java does nothing; we treat
        // it like stage 16 so the player cannot get stuck
        if (
            wieldedOrAbsent(player, t.ITEM.WOODEN_SHIELD) &&
            wieldedOrAbsent(player, t.ITEM.BRONZE_LONG_SWORD)
        ) {
            if (stage === 15) {
                t.setStage(player, 16);
            }

            await npc.say("Today we're going to be killing giant rats");

            if (!ratNearby(player)) {
                await npc.say("I'll just let out some rats for you");
                player.message('@que@The combat instructor releases a rat');
                releaseRat(player);
            } else {
                await npc.say(
                    'move your mouse over a rat you will see it is level 7',
                    "You will see that it's level is written in green",
                    'If it is green this means you have a strong chance of killing it',
                    'creatures with their name in red should probably be avoided',
                    'As this indicates they are tougher than you',
                    'left click on the rat to attack it'
                );
            }
        } else {
            await npc.say(
                'You need to wield your equipment',
                'You can access it by selecting the bag icon',
                'which can be found in the top right hand corner of the screen',
                'To wield your weapon and shield left click on them',
                'their boxs will go red to show you are wearing them'
            );
            player.message(
                '@que@When you have done this speak to the combat instructor again'
            );
        }
    } else if (stage >= 20) {
        await npc.say(
            "Well done you're a born fighter",
            'As you kill things',
            'Your combat experience will go up',
            'this expereince will slowly cause you to get tougher',
            'eventually you will be able to take on stronger enemies',
            'Such as those found in dungeons',
            'Now contine to the building to the northeast'
        );
        t.setStage(player, 25);
    }

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
