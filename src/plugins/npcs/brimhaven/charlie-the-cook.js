// Ported from Open-RSC authentic/npcs/brimhaven/CharlieTheCook.java (AGPL-3.0)
// Charlie the cook (the Shrimp and Parrot kitchen, Brimhaven): the Phoenix gang's man for Hero's Quest. He tells of the
// secret door out of the back (the strange panel, quests/members/heros-quest.js) towards Scarface Pete's mansion.

const CHARLIE_ID = 261;

async function fellowPhoenix(player, npc) {
    await npc.say('Aha a fellow phoenix', 'What brings you to Brimhaven?');

    const choice = await player.ask(
        ['Sun, sand and the fresh sea air', "I want to steal Scarface Pete's candlesticks"],
        true
    );

    if (choice === 0) {
        await npc.say('Well they are some things we have here yes');
    } else if (choice === 1) {
        await npc.say(
            'Ah yes the candlesticks',
            "Our progress hasn't been amazing on that front",
            'Though we can help you a bit',
            'The setting up of this restaurant is the start of things',
            'We have a secret door out of the back of here',
            "It leads through the back of Mr Olbor's garden",
            "At the other side of Olbor's garden is an old side entrance",
            "To Scarface Pete's mansion",
            'It seems to have been blocked off from the rest of the mansion',
            "We can't find a way through, we're sure it must be of some use though"
        );
    }
}

async function onTalkToNPC(player, npc) {
    if (npc.id !== CHARLIE_ID) {
        return false;
    }

    player.engage(npc);

    await npc.say('Hey what are you doing round here');

    const choice = await player.ask(
        ["I'm looking for a gherkin", "I'm a fellow member of the phoenix gang", 'Just exploring'],
        true
    );

    if (choice === 0 || choice === 1) {
        await fellowPhoenix(player, npc);
    } else if (choice === 2) {
        await npc.say("This kitchen isn't for exploring", "It's a private establishment, now get out");
    }

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
