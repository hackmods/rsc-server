// Ported from Open-RSC Core-Framework authentic/npcs/seers/BrotherGalahad.java (AGPL-3.0)
// Brother Galahad, the hermit west of McGrubor's Wood: every talk ends with a cup of tea (739). During The Holy Grail
// (questStages.theHolyGrail, quests/members/holy-grail.js; unset reads as not started) he talks about the grail castle and,
// from stage 3 on, lends the holy table napkin (742).

const BROTHER_GALAHAD_ID = 403;
const CUP_OF_TEA_ID = 739;
const HOLY_TABLE_NAPKIN_ID = 742;

const grailStage = (player) => player.questStages.theHolyGrail || 0;

function giveTea(player, verb = 'give') {
    player.message(`Sir Galahad ${verb} you a cup of tea`);
    player.inventory.add(CUP_OF_TEA_ID);
}

async function lendNapkin(player) {
    await player.say("I don't suppose I could borrow that?", 'it could come in useful on my quest');
    player.message('Galahad reluctantly passes you a small cloth');
    player.inventory.add(HOLY_TABLE_NAPKIN_ID);
}

async function betterBeGoing(player, npc) {
    await npc.say('Half a moment your cup of tea is ready');
    giveTea(player, 'gives');
    await npc.say(
        'If you do come across any particularily difficult obstacles on your quest',
        'Do not hesitate to ask my advice',
        'I know more about the realm of the grail than many',
        'I have a feeling you may need to come back and speak to me anyway'
    );
}

async function didntBring(player, npc) {
    await npc.say("I'm not sure", 'Because it seemed to be needed in the grail castle', 'Half a moment your cup of tea is ready');
    giveTea(player);
}

async function leave(player, npc) {
    await npc.say(
        'apparently the time is getting close',
        'When the world will need Arthur and his knights of the round table again',
        'And that includes me',
        'leaving was tough for me',
        'I took this small cloth from the table as a keepsake'
    );

    if (!player.inventory.has(HOLY_TABLE_NAPKIN_ID) && grailStage(player) >= 3) {
        await lendNapkin(player);
    }
}

// the sub-menus loop back into each other; each choice is one step
async function grailMenu(player, npc, options, handlers) {
    const choice = await player.ask(options, false);
    const [line, next] = handlers[choice] || [];

    if (line) {
        await player.say(line);
        await next(player, npc);
    }
}

async function findIt(player, npc) {
    await npc.say('I did not find it through looking', 'though admidtedly I looked long and hard', 'Eventually it found me');
    await grailMenu(
        player,
        npc,
        ['What are you talking about?', 'Why did you leave', "why didn't you bring the grail with you?", "Well I'd better be going then"],
        [
            ['What are you talking about?', talkingAbout],
            ['Why did you leave?', leave],
            ["Why didn't you bring the grail with you?", didntBring],
            ["well I'd better be going then", betterBeGoing]
        ]
    );
}

async function talkingAbout(player, npc) {
    await npc.say('The grail castle', "It's hard to describe with words", 'It mostly felt like a dream');
    await grailMenu(
        player,
        npc,
        ['So how can I find it?', 'Why did you leave?', "why didn't you bring the grail with you?", "Well I'd better be going then"],
        [
            ['So how can I find it?', findIt],
            ['Why did you leave?', leave],
            ["Why didn't you bring the grail with you?", didntBring],
            ["well I'd better be going then", betterBeGoing]
        ]
    );
}

async function onTalkToNPC(player, npc) {
    if (npc.id !== BROTHER_GALAHAD_ID) {
        return false;
    }

    player.engage(npc);

    const stage = grailStage(player);

    if (stage === -1) {
        await npc.say('would you like a cup of tea?', "I'll just put the kettle on");
        player.message('Brother galahad hangs a kettle over the fire');
        await player.say('I returned the holy grail to camelot');
        await npc.say("I'm impressed", "That's something I was never able to do", 'Half a moment your cup of tea is ready');
        giveTea(player, 'gives');
        player.disengage();
        return true;
    }

    await npc.say('Welcome to my home', 'Its rare for me to have guests', 'would you like a cup of tea?', "I'll just put the kettle on");
    player.message('Brother galahad hangs a kettle over the fire');

    let options = ['Are you any relation to Sir Galahad?', 'do you get lonely here on your own?'];

    if (stage >= 3 && !player.inventory.has(HOLY_TABLE_NAPKIN_ID)) {
        options = [
            'Are you any relation to Sir Galahad?',
            "I'm on a quest to find the holy grail",
            'do you get lonely here on your own?',
            'I seek an item from the realm of the fisher king'
        ];
    } else if (stage >= 2) {
        options = ['Are you any relation to Sir Galahad?', "I'm on a quest to find the holy grail", 'do you get lonely here on your own?'];
    }

    const choice = await player.ask(options, false);

    if (choice === 0) {
        await player.say('Are you any relation to Sir Galahad');
        await npc.say(
            'I am Sir Galahad',
            "Though I've given up being a knight for now",
            'I am now live as a solitary monk',
            'I prefer to be known as brother rather than sir now',
            'Half a moment your cup of tea is ready'
        );
        giveTea(player);
    } else if (choice === 1 && options.length > 2) {
        await player.say("I'm on a quest to find the holy grail");
        await npc.say('Ah the grail yes', 'that did fill be with wonder', 'Oh, that I could have stayed forever', 'The spear, the food, the people');
        await grailMenu(
            player,
            npc,
            ['So how can I find it?', 'What are you talking about?', 'Why did you leave', "why didn't you bring the grail with you?"],
            [
                ['So how can I find it?', findIt],
                ['What are you talking about?', talkingAbout],
                ['Why did you leave?', leave],
                ["Why didn't you bring the grail with you?", didntBring]
            ]
        );
    } else if (choice === 2 || (choice === 1 && options.length === 2)) {
        await player.say('Do you get lonely out here on your own?');
        await npc.say(
            'Sometimes I do yes',
            'Still not many people to share my solidarity with',
            'Most the religious men around here are worshippers od Saradomin',
            'Half a moment your cup of tea is ready'
        );
        giveTea(player);
    } else if (choice === 3) {
        await player.say('I seek an item from the realm of the fisher king');
        await npc.say('when i left there', 'I took this small cloth from the table as a keepsake');
        await lendNapkin(player);
    }

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
