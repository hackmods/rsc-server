// Tutorial Island community instructor. Port of OpenRSC
// CommunityInstructor.java (no global chat option).

const t = require('../core');

const HOW_TO_COMMUNICATE = 'How can I communicate with other players?';
const ARE_THERE_RULES = 'Are there rules on ingame behaviour?';
const GOODBYE = 'goodbye then';

async function communicate(npc) {
    await npc.say(
        'typing in the game window will bring up chat',
        'Which players in the nearby area will be able to see',
        'If you want to speak to a particular friend anywhere in the game',
        'You will be able to select the smiley face icon',
        "then click to add a friend, and type in your friend's name",
        'If that player is logged in on the same world as you',
        'their name will go green',
        'If they are logged in on a different world their name will go yellow',
        'clicking on their name will allow you to send a message'
    );
}

async function behaviour(npc) {
    await npc.say(
        'Yes you should follow the rules of conduct for this world',
        'To make sure you do nothing to get yourself banned',
        'but as general guide always try to be courteous to people in game',
        'Remember the people in the game are real people somewhere',
        'With real feelings',
        'If you go round being abusive or causing trouble',
        'your character could quickly be the one in trouble'
    );
}

async function onTalkToNPC(player, npc) {
    if (npc.id !== t.NPC.COMMUNITY) {
        return false;
    }

    player.engage(npc);

    if (!t.onTutorial(player)) {
        await npc.say('Be courteous to the other players out there');
        player.disengage();
        return true;
    }

    if (t.stage(player) < 90) {
        await npc.say(
            'Hello there',
            'Please speak to the other instructors first'
        );
        player.disengage();
        return true;
    }

    await npc.say(
        "You're almost ready to go out into the main game area",
        'When you get out there',
        'You will be able to interact with thousands of other players'
    );

    // the option just chosen is dropped from the next menu
    let last = null;

    for (;;) {
        const options = [HOW_TO_COMMUNICATE, ARE_THERE_RULES, GOODBYE].filter(
            (o) => o !== last
        );
        const choice = options[await player.ask(options, true)];

        if (choice === HOW_TO_COMMUNICATE) {
            await communicate(npc);
        } else if (choice === ARE_THERE_RULES) {
            await behaviour(npc);
        } else {
            await npc.say('Good luck');
            t.setStage(player, 100);
            break;
        }

        last = choice;
    }

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
