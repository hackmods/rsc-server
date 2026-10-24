// Tutorial Island cooking instructor. Port of OpenRSC CookingInstructor.java.
const t = require('../core');

async function onTalkToNPC(player, npc) {
    if (npc.id !== t.NPC.COOKING) {
        return false;
    }

    player.engage(npc);

    if (!t.onTutorial(player)) {
        await npc.say('Keep an eye on your hits and eat when you need to');
        player.disengage();
        return true;
    }

    const stage = t.stage(player);

    if (stage < 25) {
        await npc.say(
            'You look like you have not finished with the combat instructor',
            'Speak to him first'
        );
    } else if (stage === 25) {
        await npc.say(
            "looks like you've been fighting",
            'If you get hurt in a fight',
            'You will slowly heal',
            'Eating food will heal you much more quickly',
            "I'm here to show you some simple cooking"
        );

        if (!player.inventory.has(t.ITEM.RAW_RAT_MEAT)) {
            if (player.inventory.isFull()) {
                player.message(
                    '@que@You need some free inventory space before I can give you the meat'
                );
                player.disengage();
                return true;
            }

            t.give(player, t.ITEM.RAW_RAT_MEAT, 1);
            await npc.say('First you need something to cook');
            player.message('@que@the instructor gives you a piece of meat');
        } else {
            await npc.say('I see you have bought your own meat', 'good stuff');
        }

        await npc.say(
            'ok cook it on the range',
            'To use an item you are holding',
            'Open your inventory and click on the item you wish to use',
            'Then click on whatever you wish to use it on',
            'In this case use it on the range'
        );
    } else if (stage === 30) {
        await player.say('I burnt the meat');
        await npc.say(
            "Well I'm sure you'll get the hang of it soon",
            "Let's try again"
        );

        if (!player.inventory.has(t.ITEM.RAW_RAT_MEAT)) {
            if (player.inventory.isFull()) {
                player.message(
                    '@que@You need some free inventory space before I can give you more meat'
                );
                player.disengage();
                return true;
            }

            await npc.say("Here's another piece of meat to cook");
            t.give(player, t.ITEM.RAW_RAT_MEAT, 1);
        }
    } else if (stage === 31) {
        await player.say("I've cooked the meat correctly this time");
        await npc.say(
            'Very well done',
            'Now you can tell whether you need to eat or not',
            'look in your stats menu',
            'Click on bar graph icon in the menu bar',
            'Your stats are low right now',
            'As you use the various skills, these stats will increase',
            'If you look at your hits you will see 2 numbers',
            'The number on the right is your hits when you are at full health',
            'The number on the left is your current hits',
            'If the number on the left is lower eat some food to be healed'
        );
        t.setStage(player, 34);
    } else if (stage >= 34) {
        const hits = player.skills && player.skills.hits;

        if (
            player.inventory.has(t.ITEM.COOKED_MEAT) &&
            hits &&
            hits.current < 10
        ) {
            await npc.say(
                'to eat the food left click on it in your inventory'
            );
        } else {
            await npc.say(
                'There are many other sorts of food you can cook',
                'As your cooking level increases you will be able to cook even more',
                'Some of these dishes are more complicated to prepare',
                'If you want to know more about cookery',
                'You could consult the online manual',
                'Now proceed through the next door'
            );
        }

        t.setStage(player, 35);
    } else {
        // 26-29 and 32-33: the Java says nothing; remind them what to do
        await npc.say('Cook the meat on the range');
    }

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
