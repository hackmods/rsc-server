// Tutorial Island fishing instructor (OpenRSC FishingInstructor.java)

const t = require('../core');

async function onTalkToNPC(player, npc) {
    if (npc.id !== t.NPC.FISHING) {
        return false;
    }

    player.engage(npc);

    if (!t.onTutorial(player)) {
        await npc.say('Fishing is a useful skill');
        player.disengage();
        return true;
    }

    const stage = t.stage(player);

    if (stage === 40) {
        if (player.inventory.isFull()) {
            player.message(
                '@que@You have no room in your inventory, make some space first'
            );
            player.disengage();
            return true;
        }

        await player.say('Hi are you here to tell me how to catch fish?');
        await npc.say(
            "Yes that's right, you're a smart one",
            'Fishing is a useful skill',
            'You can sell high level fish for lots of money',
            'Or of course you can cook it and eat it to heal yourself',
            "Unfortunately you'll have to start off catching shrimps",
            'Till your fishing level gets higher',
            "you'll need this"
        );
        player.message(
            '@que@the fishing instructor gives you a somewhat old looking net'
        );
        t.give(player, t.ITEM.NET, 1);
        await npc.say(
            'Go catch some shrimp',
            'left click on that sparkling piece of water',
            'While you have the net in your inventory you might catch some fish'
        );
        t.setStage(player, 41);
    } else if (stage === 41) {
        await npc.say(
            'Left click on that splashing sparkling water',
            'then you can catch some shrimp'
        );

        if (!player.inventory.has(t.ITEM.NET)) {
            await player.say('I have lost my net');

            if (player.inventory.isFull()) {
                player.message(
                    '@que@You have no room in your inventory for the net'
                );
                player.disengage();
                return true;
            }

            await npc.say(
                "Hmm a good fisherman doesn't lose his net",
                'Ah well heres another one'
            );
            t.give(player, t.ITEM.NET, 1);
        }
    } else if (stage === 42) {
        await npc.say(
            'Well done you can now continue with the tutorial',
            'first You can cook the shrimps on my fire here if you like'
        );
        t.setStage(player, 45);
    } else {
        await npc.say(
            'Go through the next door to continue with the tutorial now'
        );
    }

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
