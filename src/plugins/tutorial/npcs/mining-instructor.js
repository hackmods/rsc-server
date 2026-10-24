// Tutorial Island mining instructor (OpenRSC MiningInstructor.java)

const t = require('../core');

const NO_ROOM = '@que@You have no room in your inventory for the pickaxe';

async function handOverPickaxe(player) {
    player.message(
        '@que@The instructor somehow produces a large pickaxe from inside ' +
            'his jacket'
    );
    await player.world.sleepTicks(3);
    player.message('@que@The instructor gives you the pickaxe');
    await player.world.sleepTicks(3);
    t.give(player, t.ITEM.BRONZE_PICKAXE, 1);
}

async function onTalkToNPC(player, npc) {
    if (npc.id !== t.NPC.MINING) {
        return false;
    }

    player.engage(npc);

    if (!t.onTutorial(player)) {
        await npc.say("I'm a veteran miner");
        player.disengage();
        return true;
    }

    const stage = t.stage(player);

    if (stage === 45) {
        await player.say('Good day to you');
        await npc.say(
            "hello I'm a veteran miner!",
            "I'm here to show you how to mine",
            'If you want to quickly find out what is in a rock you can ' +
                'prospect it',
            'right click on this rock here',
            'And select prospect'
        );
        t.setStage(player, 49);
    } else if (stage === 49) {
        await player.say('Hello again');
        await npc.say(
            "You haven't prospected that rock yet",
            'Right click on it and select prospect'
        );
    } else if (stage === 50) {
        await player.say("There's tin ore in that rock");
        await npc.say(
            "Yes, thats what's in there",
            'Ok you need to get that tin out of the rock',
            'First of all you need a pick',
            'And here we have a pick'
        );

        if (!player.inventory.has(t.ITEM.BRONZE_PICKAXE)) {
            if (player.inventory.isFull()) {
                player.message(NO_ROOM);
                player.disengage();
                return true;
            }

            await handOverPickaxe(player);
        }

        await npc.say('Now hit those rocks');
        t.setStage(player, 51);
    } else if (stage === 51) {
        if (!player.inventory.has(t.ITEM.BRONZE_PICKAXE)) {
            await player.say('I have lost my pickaxe');

            if (player.inventory.isFull()) {
                player.message(NO_ROOM);
                player.disengage();
                return true;
            }

            await handOverPickaxe(player);
        }

        await npc.say(
            'to mine a rock just left click on it',
            'If you have a pickaxe in your inventory you might get some ore'
        );
    } else if (stage >= 52) {
        if (stage === 52) {
            await npc.say('very good');
        }

        await npc.say(
            'If at a later date you find a rock with copper ore',
            'You can take the copper ore and tin ore to a furnace',
            'use them on the furnace to make bronze bars',
            'which you can then either sell',
            'or use on anvils with a hammer',
            'To make weapons',
            'as your mining and smithing levels grow',
            'you will be able to mine various exciting new metals',
            'now go through the next door to speak to the bankers'
        );
        t.setStage(player, 55);
    } else {
        await npc.say('Go and speak to the other instructors first');
    }

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
