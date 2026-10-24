// Tutorial Island boatman. Port of OpenRSC boatman.java.

const t = require('../core');

async function onTalkToNPC(player, npc) {
    if (npc.id !== t.NPC.BOATMAN) {
        return false;
    }

    player.engage(npc);

    if (!t.onTutorial(player)) {
        await npc.say('Fair winds to you, adventurer');
        player.disengage();
        return true;
    }

    if (t.stage(player) < 100) {
        await npc.say(
            'You are not ready to leave yet',
            'Finish your training and speak to the community instructor first'
        );
        player.disengage();
        return true;
    }

    await npc.say(
        'Hello my job is to take you to the main game area',
        "It's only a short row",
        'I shall take you to the small town of Lumbridge',
        'In the kingdom of Misthalin'
    );

    const choice = await player.ask(
        ["Ok I'm ready to go", "I'm not done here yet"],
        true
    );

    if (choice === 0) {
        await npc.say('Lets go then');
        player.message('@que@You have completed the tutorial');
        // disengage first so the teleport is not blocked by the dialogue
        player.disengage();
        await t.complete(player);
        return true;
    }

    await npc.say('Ok come back when you are ready');
    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
