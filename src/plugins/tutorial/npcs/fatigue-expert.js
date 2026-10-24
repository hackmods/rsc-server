// Tutorial Island fatigue expert. Port of OpenRSC FatigueExpert.java
// (the WANT_FATIGUE variant). Waking from sleep at 85 -> 86 is in core.onWake.

const t = require('../core');

async function onTalkToNPC(player, npc) {
    if (npc.id !== t.NPC.FATIGUE) {
        return false;
    }

    player.engage(npc);

    if (!t.onTutorial(player)) {
        await npc.say('Make sure you get plenty of rest');
        player.disengage();
        return true;
    }

    const stage = t.stage(player);

    if (stage < 80) {
        await npc.say(
            'Hello there',
            'Please speak to the other instructors first'
        );
    } else if (stage <= 85) {
        const needsBag = !player.inventory.has(t.ITEM.SLEEPING_BAG);

        if (needsBag && player.inventory.isFull()) {
            player.message(
                '@que@You need some free inventory space to take a sleeping bag'
            );
            player.disengage();
            return true;
        }

        await player.say("Hi I'm feeling a little tired after all this learning");
        await npc.say(
            'Yes when you use your skills you will slowly get fatigued',
            'If you look on your stats menu you will see a fatigue stat',
            'When your fatigue reaches 100 percent then you will be very tired',
            "You won't be able to concentrate enough to gain experience in your skills",
            'To reduce your fatigue you will need to go to sleep',
            'Click on the bed to go sleep',
            'Then follow the instructions to wake up',
            'When you have done that talk to me again'
        );

        if (needsBag) {
            await npc.say('Here, take this sleeping bag too');
            t.give(player, t.ITEM.SLEEPING_BAG, 1);
            player.message('@que@The expert hands you a sleeping bag');
        }

        t.setStage(player, 85);
    } else if (stage === 86) {
        await npc.say('How are you feeling now?');
        await player.say('I feel much better rested now');
        await npc.say(
            'Good, keep that sleeping bag',
            'So you can rest anywhere',
            'This saves you the trouble of finding a bed',
            'but you will need to sleep longer to restore your fatigue fully',
            'You can now go through the next door'
        );
        t.setStage(player, 90);
    } else {
        await npc.say(
            'When you use your skills you will slowly get fatigued',
            'If you look on your stats menu you will see a fatigue stat',
            'When your fatigue reaches 100 percent then you will be very tired',
            "You won't be able to concentrate enough to gain experience in your skills",
            'To reduce your fatigue you can either eat some food or go to sleep',
            'Click on a bed  or sleeping bag to go sleep',
            'Then follow the instructions to wake up',
            'You can now go through the next door'
        );
    }

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
