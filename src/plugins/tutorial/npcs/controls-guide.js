// Tutorial Island controls guide, second room. Port of OpenRSC ControlsGuide.java.
const t = require('../core');

async function onTalkToNPC(player, npc) {
    if (npc.id !== t.NPC.CONTROLS_GUIDE) {
        return false;
    }

    player.engage(npc);

    if (!t.onTutorial(player)) {
        await npc.say('Remember, the map is a handy way of getting around');
        player.disengage();
        return true;
    }

    await npc.say(
        "Hello I'm here to tell you more about the game's controls",
        'Most of your options and character information',
        'can be accesed by the menus in the top right corner of the screen',
        'moving your mouse over the map icon',
        'which is the second icon from the right',
        'gives you a view of the area you are in',
        'clicking on this map is an effective way of walking around',
        'though if the route is blocked, for example by a closed door',
        "then your character won't move",
        'Also notice the compass on the map which may be of help to you'
    );
    await player.say('Thankyou for your help');
    await npc.say('Now carry on to speak to the combat instructor');

    t.setStage(player, 15);

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
