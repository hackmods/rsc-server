// Tutorial Island guide, first room. Port of OpenRSC Guide.java.
const t = require('../core');

async function onTalkToNPC(player, npc) {
    if (npc.id !== t.NPC.GUIDE) {
        return false;
    }

    player.engage(npc);

    if (!t.onTutorial(player)) {
        await npc.say('Welcome back to the island. You already know the ropes');
        player.disengage();
        return true;
    }

    await npc.say(
        'Welcome to the world of runescape',
        'My job is to help newcomers find their feet here'
    );
    await player.say("Ah good, let's get started");
    await npc.say(
        'when speaking to characters such as myself',
        'Sometimes options will appear in the top left corner of the screen',
        'left click on one of them to continue the conversation'
    );

    const choice = await player.ask(
        ['So what else can you tell me?', 'What other controls do I have?'],
        true
    );

    if (choice !== -1) {
        await npc.say(
            'I suggest you go through the  door now',
            'There are several guides and advisors on the island',
            'Speak to them',
            'They will teach you about the various aspects of the game'
        );
        player.message(
            '@que@Use the quest history tab at the bottom of the screen to reread things said to you by ingame characters'
        );
        t.setStage(player, 10);
    }

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
