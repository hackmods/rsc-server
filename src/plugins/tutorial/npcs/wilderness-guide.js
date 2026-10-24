// Tutorial Island wilderness guide (OpenRSC WildernessGuide.java)

const t = require('../core');

async function where(player, npc) {
    await player.say('Where is this wilderness?');
    await npc.say(
        'Once you get into the main playing area head north',
        'then you will eventually reach the wilderness',
        'The deeper you venture into the wilderness',
        'The greater the level range of players who can attack you',
        'So if you go in really deep',
        'Players much stronger than you can attack you'
    );
}

async function die(player, npc) {
    await player.say('What happens when I die?');
    await npc.say(
        'normally when you die',
        'you will lose all of the items in your inventory',
        'Except the three most valuable',
        'You never keep stackable items like coins and runes',
        'which is why it is a good idea to leave things in the bank',
        'However if you attack another player',
        'You get a skull above your head for twenty minutes',
        'If you die with a skull above your head you lose your entire ' +
            'inventory'
    );
}

async function options(player, npc) {
    const choice = await player.ask(
        ['Where is this wilderness?', 'What happens when I die?'],
        false
    );

    if (choice === 0) {
        await where(player, npc);
        await die(player, npc);
    } else if (choice === 1) {
        await die(player, npc);
        await where(player, npc);
    }

    if (choice === 0 || choice === 1) {
        await npc.say('Now proceed through the next door');
        t.setStage(player, 70);
    }
}

async function onTalkToNPC(player, npc) {
    if (npc.id !== t.NPC.WILDERNESS) {
        return false;
    }

    player.engage(npc);

    if (!t.onTutorial(player)) {
        await npc.say('The wilderness is dangerous, be careful out there');
        player.disengage();
        return true;
    }

    await npc.say(
        'Hi are you someone who likes to fight other players?',
        'Granted it has big risks',
        'but it can be very rewarding too'
    );

    const choice = await player.ask(
        ["Yes I'm up for a bit of a fight", "I'd prefer to avoid that"],
        true
    );

    if (choice === 0) {
        await npc.say(
            'Then the wilderness is the place for you',
            'That is the area of the game where you can attack other players',
            'Be careful though',
            'Other players can be a lot more dangerous than monsters',
            'they will be much more persistant in chasing after you',
            'Especially when they hunt in groups'
        );
        await options(player, npc);
    } else if (choice === 1) {
        await npc.say(
            "Then don't stray into the wilderness",
            'That is the area of the game where you can attack other players'
        );
        await options(player, npc);
    }

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
