// Ported from Open-RSC Core-Framework authentic/quests/members/DwarfCannon.java (AGPL-3.0): the Dwarf commander (771,
// Lawgof) and the Dwarf near him (694)
// https://classic.runescape.wiki/w/Dwarf_Cannon
//
// questStages.dwarfCannon (the Java stages):
//   0  Lawgof at the black guard camp north of the coal trucks (605,467) gives six Railings 1042 -> 1
//   1  fix the six broken railings 181-186 around the camp (objects.js; cache railone..railsix) -> 2
//   2  climb the watch tower ladder 981 (616,492), take the dwarf remains 1046 upstairs (cache grabed_dwarf_remains)
//      and show them to Lawgof -> 3
//   3  the goblin cave 982 (576,523) leads down to the crate 987 (620,3313) where Lollk is tied up (cache savedlollk);
//      Lawgof then hands over a Tool kit 1055 -> 4
//   4  fix the four parts of the multicannon 994 in the shed (objects.js; cache pipe, barrel, axle, shaft ->
//      cannon_complete) -> 5
//   5  the Dwarf Cannon engineer (770, Nulodion, south of Ice Mountain) gives Nulodion's notes 1056 and the cannon ammo
//      mould 1057 (cache spoken_nulodion) -> 6
//   6  hand both to Lawgof -> -1: 1 quest point and crafting 1000 + 200 per crafting level (quarter points). Nulodion
//      then sells the cannon (cannon-engineer.js), which items/multi-cannon.js sets up and fires.

const DWARF_COMMANDER_ID = 771;
const DWARF_NEAR_COMMANDER_ID = 694;

const RAILING_ID = 1042;
const DWARF_REMAINS_ID = 1046;
const TOOL_KIT_ID = 1055;
const NULODIONS_NOTES_ID = 1056;
const CANNON_AMMO_MOULD_ID = 1057;

const RAIL_KEYS = ['railone', 'railtwo', 'railthree', 'railfour', 'railfive', 'railsix'];

function stageOf(player) {
    return player.questStages.dwarfCannon || 0;
}

function has(player, key) {
    return player.cache[key] !== undefined;
}

async function mes(player, line) {
    player.message(line);
    await player.world.sleepTicks(3);
}

// DwarfCannon.handleReward: crafting experience, the quest point, then the two lines
async function completeQuest(player) {
    player.completeQuest('dwarfCannon', {
        questPoints: 1,
        experience: { crafting: 1000 + 200 * player.skills.crafting.base }
    });

    await mes(player, 'well done');
    await mes(player, 'you have completed the dwarf cannon quest');
}

async function notStarted(player, npc) {
    await player.say('hello');
    await npc.say(
        "hello traveller, i'm pleased to see you",
        'we were hoping to find an extra pair of hands',
        "that's if you don't mind helping?"
    );
    await player.say("why, what's wrong?");
    await npc.say(
        'as part of the dwarven black guard..',
        '...it is our duty to protect these mines',
        "but we just don't have the man power",
        'could you help?'
    );

    const choice = await player.ask(["i'm sorry, i'm too busy mining", "yeah, i'd love to help"], true);

    if (choice === 0) {
        await npc.say("ok then, we'll have find someone else");
    } else if (choice === 1) {
        await npc.say(
            'thankyou, we have no time to waste',
            'the goblins have been attacking from the forests to the south',
            'they manage to get through the broken railings',
            'could you please replace them with these new ones'
        );
        await player.say('sounds easy enough');
        await mes(player, 'the Dwarf commander gives you six railings');
        player.inventory.add(RAILING_ID, 6);
        await npc.say("let me know once you've fixed the railings");
        await player.say('ok , commander');
        player.questStages.dwarfCannon = 1;
    }
}

async function railings(player, npc) {
    await player.say('hello');
    await npc.say('hello again traveller', 'how are you doing with those railings?');
    await player.say("i'm getting there");

    if (RAIL_KEYS.every((key) => has(player, key))) {
        await npc.say('the goblins seemed to have stopped getting in', "i think you've done the job");
        await player.say('good stuff');
        await npc.say(
            'could you do me one more favour?',
            'i need you to go check up on a guard',
            'he should be in the black guard watch tower just to the south of here',
            'he should have reported in by now'
        );
        await player.say("ok, i'll see what i can find out");
        await npc.say('thanks traveller');
        player.questStages.dwarfCannon = 2;

        for (const key of RAIL_KEYS) {
            delete player.cache[key];
        }
    } else {
        await npc.say('the goblins are still getting in', 'so there must still be some broken railings');
        await player.say("don't worry, i'll find them soon enough");

        if (!player.inventory.has(RAILING_ID)) {
            await player.say("but i'm out of railings");
            await npc.say("ok, we've got plenty");
            await mes(player, 'the Dwarf commander gives you another railing');
            player.inventory.add(RAILING_ID, 1);
        }
    }
}

async function watchTower(player, npc) {
    await player.say('hello');

    if (has(player, 'grabed_dwarf_remains')) {
        await npc.say('have you been to the watch tower yet?');
        await player.say('yes, i went up but there was no one');
        await npc.say("that's strange, gilob never leaves his post");

        if (player.inventory.has(DWARF_REMAINS_ID)) {
            await player.say('i may have some bad news for you commander');
            await mes(player, 'you show the Dwarf commander the remains');
            await npc.say("what's this?, oh no , it can't be!");
            await player.say("i'm sorry, it looks like the goblins got him");
            await npc.say('noooo... those..those animals', "but where's gilobs son?, he was also there");
            await player.say('the goblins must have taken him');
            await npc.say(
                'please traveller, seek out the goblins base..',
                '...and return the lad to us',
                'they must sleep somewhere!'
            );
            await player.say("ok, i'll see if i can find their hide out");
            player.inventory.remove(DWARF_REMAINS_ID);
            player.questStages.dwarfCannon = 3;
            delete player.cache.grabed_dwarf_remains;
        } else {
            await npc.say('his son was also with him, its too strange', 'can you return and look for clues?');
            await player.say('ok then');
        }
    } else {
        await npc.say('hello, any news from the watch man?');
        await player.say('not yet');
        await npc.say('well, as quick as you can then');
    }
}

async function goblinBase(player, npc) {
    if (has(player, 'savedlollk')) {
        await player.say('hello, has lollk returned yet?');
        await npc.say(
            'he has, and i thank you from the bottom of my heart..',
            "...with out you he'd be goblin barbecue"
        );
        await player.say('always a pleasure to help');
        await npc.say(
            'in that case i have one more favour to ask you',
            "as you've seen, our defences are too weak against those goblins",
            'the black guard have sent us a cannon to help the situation'
        );
        await player.say('sounds good');
        await npc.say(
            "unfortunatly we're having trouble fixing the thing",
            'the cannon is stored in our shed',
            'if you could fix it, it would be a great help'
        );

        const choice = await player.ask(["ok, i'll see what i can do", "sorry, i've done enough for today"], true);

        if (choice === 0) {
            await npc.say("that's great,you'll need this");
            await mes(player, 'the Dwarf commander gives you a tool kit');
            player.inventory.add(TOOL_KIT_ID, 1);
            await npc.say('let me know how you get on');
            player.questStages.dwarfCannon = 4;
            delete player.cache.savedlollk;
        } else if (choice === 1) {
            await npc.say(' fair enough, take care traveller');
        }

        return;
    }

    await player.say('hello again');
    await npc.say('traveller have you managed to find the goblins base?');
    await player.say("not yet i'm afraid, but i'll keep looking");
}

async function fixCannon(player, npc) {
    if (has(player, 'cannon_complete')) {
        await player.say('hello again');
        await npc.say("hello there traveller, how's things?");
        await player.say("well, i think i've done it, take a look");
        await npc.say('really!');
        await mes(player, 'the Dwarf commander pops into the shed to take a closer look');
        await npc.say("well i don't believe it, it seems to be in working order");
        await player.say('not bad for an adventurer');
        await npc.say(
            'not bad at all, your effort is appreciated my friend',
            'now, if i could only figure what the thing uses as ammo',
            'the black guard forgot to send instructions',
            'i know i said that was the last favour..but..'
        );
        await player.say('what now?');
        await npc.say(
            "i can't leave this post, could you go to the black guard..",
            '..base and find out what this thing actually shoots?'
        );

        const choice = await player.ask(["sorry, i've really done enough", 'ok then, just for you'], true);

        if (choice === 0) {
            await npc.say('fair enough');
        } else if (choice === 1) {
            await npc.say(
                "you're a good adventurer, we were lucky to find you",
                'the base is located just south of the ice mountain',
                "you'll need to speak to the dwarf Cannon engineer",
                "he's the weapons development chief for the black guard",
                "so if anyone knows how to fire that thing, it'll be him"
            );
            await player.say("ok, i'll see what i can do");
            player.questStages.dwarfCannon = 5;
            delete player.cache.cannon_complete;
        }

        return;
    }

    await npc.say(
        'how are doing in there bold adventurer?',
        "we've been trying our best with that thing",
        "but i just haven't got the patience"
    );
    await player.say("it's not an easy job, but i'm getting there");
    await npc.say(
        'good stuff, let me know if you have any luck',
        'if we manage to get that thing working...',
        'those goblins will be know trouble at all'
    );

    if (!player.inventory.has(TOOL_KIT_ID)) {
        await player.say("i'm afraid i lost the tool kit");
        await npc.say('that was silly, never mind, here you go');
        await mes(player, 'the Dwarf commander gives you another tool kit');
        player.inventory.add(TOOL_KIT_ID, 1);
    }
}

async function ammo(player, npc) {
    if (
        has(player, 'spoken_nulodion') &&
        player.inventory.has(NULODIONS_NOTES_ID) &&
        player.inventory.has(CANNON_AMMO_MOULD_ID)
    ) {
        await player.say('hi');
        await npc.say('hello traveller, any word from the Cannon engineer?');
        await player.say('yes, i have spoken to him', 'he gave me these to give to you');
        await mes(player, 'you hand the Dwarf commander the mould and the notes');
        player.inventory.remove(NULODIONS_NOTES_ID);
        player.inventory.remove(CANNON_AMMO_MOULD_ID);
        await npc.say(
            'aah, of course, we make the ammo',
            'this is great, now we will be able to defend ourselves',
            "i don't know how to thank you"
        );
        await player.say('you could give me a cannon');
        await npc.say(
            "hah, you'd be lucky, those things are worth a fortune",
            'hmmm, now i think about it the Cannon engineer may be able to help',
            'he controls production of the cannons',
            "he won't be able to give you one",
            "but for the right price, i'm sure he'll sell one to you"
        );
        await player.say('hmmm, sounds interesting');
        await npc.say('take care of yourself traveller, and thanks again');
        await player.say('you take care too');
        delete player.cache.spoken_nulodion;
        await completeQuest(player);
    } else if (has(player, 'spoken_nulodion')) {
        await player.say('hi');
        await npc.say('hello traveller, any word from the Cannon engineer?');
        await player.say(
            'yes, i have spoken to him',
            'he gave me some items to give you...',
            'but i seem to have lost something'
        );
        await npc.say("if you could go back and get another, i'd appreciate it");
        await player.say('ok then');
    } else {
        await player.say('hi again');
        await npc.say('hello traveller', 'any word from the Cannon engineer?');
        await player.say('not yet');
        await npc.say(
            'the black guard camp is just south of the ice mountain',
            'the quicker we can get some ammo for this thing..',
            '.. the quicker those goblins will leave us be'
        );
        await player.say("i'll get to it");
    }
}

async function commander(player, npc) {
    switch (stageOf(player)) {
        case 0:
            await notStarted(player, npc);
            break;
        case 1:
            await railings(player, npc);
            break;
        case 2:
            await watchTower(player, npc);
            break;
        case 3:
            await goblinBase(player, npc);
            break;
        case 4:
            await fixCannon(player, npc);
            break;
        case 5:
        case 6:
            await ammo(player, npc);
            break;
        case -1:
            await player.say('hello');
            await npc.say('well, hello there, how you doing?');
            await player.say('not bad, yourself?');
            await npc.say("i'm great, the goblins can't get close with this cannon blasting at them");
            break;
    }
}

// the Dwarf near the commander; Open-RSC has no spawn for him either
async function nearCommander(player, npc) {
    const selected = Math.floor(Math.random() * 2);

    await player.say('hello"'); // sic

    if (selected === 0) {
        await npc.say('blooming goblins, such dirty beasts');
        await player.say('really!');
        await npc.say("i've spent the whole morning cleaning up their do'ings");
        await player.say('yuck');
    } else {
        await npc.say("next goblin i catch sneeking around's..", '..gonna be hung on my wall, little green..');
        await player.say('yep..they can be troublesome');
    }
}

async function onTalkToNPC(player, npc) {
    if (npc.id === DWARF_COMMANDER_ID) {
        await commander(player, npc);
        return true;
    }

    if (npc.id === DWARF_NEAR_COMMANDER_ID) {
        await nearCommander(player, npc);
        return true;
    }

    return false;
}

module.exports = { onTalkToNPC };
