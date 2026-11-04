// Ported from Open-RSC Core-Framework authentic/quests/members/grandtree/GrandTree.java (AGPL-3.0): Glough (547) and
// his tree house (cupboard 619/620, chest 632), Charlie in the cage (550) and Anita (565). Stages 3, 5, 6, 7, 10, 11:
// the stage table is in narnode.js.
// Cache flag: helpedFemi (Java helped_femi) is dropped once the chest is opened past stage 10.

const GLOUGH_ID = 547;
const CHARLIE_ID = 550;
const ANITA_ID = 565;
const GNOME_GUARD_PRISON_ID = 551;
const NARNODE_ID = 541;

const GLOUGHS_CUPBOARD_CLOSED_ID = 619;
const GLOUGHS_CUPBOARD_OPEN_ID = 620;
const GLOUGHS_CHEST_CLOSED_ID = 632;
const GLOUGHS_CHEST_OPEN_ID = 631;

const TRANSLATION_BOOK_ID = 918;
const GLOUGHS_JOURNAL_ID = 921;
const GLOUGHS_KEY_ID = 925;
const GLOUGHS_NOTES_ID = 926;

// addnpc(..., 12 s) and (..., 36 s), changeloc(GAME_TICK * 5), as 640 ms ticks
const GUARD_TICKS = Math.ceil(12000 / 640);
const NARNODE_TICKS = Math.ceil(36000 / 640);
const CHEST_OPEN_TICKS = 5;

function stageOf(player) {
    return player.questStages.grandTree || 0;
}

function setStage(player, stage) {
    player.questStages.grandTree = stage;
}

async function mes(player, line, ticks = 3) {
    player.message(line);
    await player.world.sleepTicks(ticks);
}

async function gloughCaged(player, npc) {
    const { world } = player;

    await player.say("glough, i don't know what you're up to...", '...but i know you paid charlie to get those rocks');
    await npc.say("you're a fool human", 'you have no idea whats going on');
    await player.say("i know the grand tree's dying", "and i think you're part of the reason");
    await npc.say("how dare you accuse me, i'm the head tree guardian", 'guards...guards');
    player.message('gnome guards hurry up the ladder');

    const guard = world.spawnTimedNPC({ id: GNOME_GUARD_PRISON_ID, x: 714, y: 1421, ticks: GUARD_TICKS });

    await npc.say('take him away');
    await player.say('what for?');
    await npc.say('grand treason against his majesty king shareem', 'this man is a human spy');
    world.removeEntity('npcs', guard);
    await npc.say('lock him up');
    await mes(player, 'the gnome guards take you to the top of the grand tree');

    player.disengage();
    player.teleport(419, 2992);
    await world.sleepTicks(8);

    const charlie = player.getNearbyEntitiesByID('npcs', CHARLIE_ID, 5)[0];

    if (!charlie) {
        return;
    }

    await charlie.say('so, they\'ve got you as well');
    await player.say("it's glough, he's trying to cover something up");
    await charlie.say(
        "i shouldn't tell you this adventurer",
        'but if you want to get to the bottom of this',
        'you should go and talk to the karamja foreman'
    );
    await player.say('why?');
    await charlie.say(
        'glough sent me to karamja to meet him',
        'i delivered a large amount of gold',
        'for what i do not know',
        "but he may be able to tell you what glough's up to",
        "that's if you can get out of here",
        "you'll find him in a ship yard south of birmhaven", // sic
        "be careful, if he discovers that you're not...",
        "...working for glough there'll be trouble",
        'the sea men use the pass word ka-lu-min'
    );
    await player.say('thanks charlie');
    await world.sleepTicks(8);

    const narnode = world.spawnTimedNPC({ id: NARNODE_ID, x: 419, y: 2993, ticks: NARNODE_TICKS });

    await narnode.say(
        'adventurer please accept my apologies',
        'glough had no right to arrest you',
        "i just think he's scared of humans",
        'let me get you out of there'
    );
    await mes(player, 'king shareem opens the cage');
    player.teleport(418, 2993);
    await player.say("i don't think you can trust glough, narnode", 'he seems to have a unatural hatred for humans'); // sic
    await narnode.say(
        'i know he can seem a little extreme at times',
        "but he's the best tree guardian i have",
        'he has however caused much fear towards humans',
        "i'm afraid he's placed guards on the front gate...",
        '...to stop you escaping',
        'let my glider pilot fly you away',
        'untill things calm down around here' // sic
    );
    await player.say("well, if that's how you feel");
    world.removeEntity('npcs', narnode);
    setStage(player, 8);
}

async function gloughDialogue(player, npc) {
    switch (stageOf(player)) {
        case 3:
            await player.say('hello');
            await mes(player, 'the gnome is munching on a worm hole');
            await npc.say("can i help human, can't you see i'm eating?", 'these are my favourite');
            await mes(player, 'the gnome continues to eat');
            await player.say('the king asked me to inform you...', 'that the daconia rocks have been taken');
            await npc.say('surley not!'); // sic
            await player.say('apparently a human took them from hazelmere', "he had a permission note with the king's seal");
            await npc.say('i should have known, the humans are going to invade');
            await player.say('never');
            await npc.say("your type can't be trusted", "i'll take care of this, you go back to the king");
            setStage(player, 4);
            break;
        case 7:
            await gloughCaged(player, npc);
            break;
        case 10:
            await player.say("I know what you're up to glough");
            await npc.say('you have no idea human');
            await player.say('you may be able to make a fleet', 'but the tree gnomes will never follow you into battle');
            await npc.say(
                "so, you know more than i thought, i'm impressed",
                'the gnomes fear humanity more than any other race',
                'i just need to give them a push in the right direction',
                "there's nothing you can do traveller",
                "leave before it's too late",
                'soon all of runescape will feel the wrath of glough'
            );
            await player.say("king shareem won't allow it");
            await npc.say("the king's a fool and a coward, he'll soon bow to me", "and you'll soon be back in that cage");
            break;
        case 11:
            await player.say("i'm going to stop you glough");
            await npc.say("you're becoming quite annoying traveller");
            await mes(player, 'glough is searching his pockets');
            await mes(player, 'he seems very uptight');
            await npc.say('damn keys', 'leave human, before i have you put in the cage');
            break;
        default:
            await player.say('hello there');
            await npc.say("you shouldn't be here human");
            await player.say('what do you mean?');
            await npc.say('the gnome stronghold is for gnomes alone');
            await player.say('surely not!');
            await npc.say("we don't need you're sort around here"); // sic
            await mes(player, "he doesn't seem very nice");
            break;
    }
}

async function charlieDialogue(player, npc) {
    switch (stageOf(player)) {
        case 5:
            await player.say('tell me,why would you want to kill the grand tree?');
            await npc.say('what do you mean?');
            await player.say("don't tell me, you just happened to be caught carrying daconia rocks!");
            await npc.say('all i know, is that i did what i was asked');
            await player.say("i don't understand?");
            await npc.say(
                'glough paid me to go see this gnome on a hill',
                'i gave the gnome a letter glough gave me',
                'and he gave me some rocks to give glough',
                "i've been doing it for weeks, it's just this time..",
                '...when i returned glough locked me up here',
                "i just don't understand it"
            );
            await player.say("sounds like glough's hiding something");
            await npc.say("i don't know what he's up to", 'but if you want to find out...', '..you better search his home');
            await player.say('ok, thanks charlie');
            await npc.say('good luck');
            setStage(player, 6);
            break;
        case 6:
        case 7:
            await player.say('hello charlie');
            await npc.say("hello adventurer, have you figured out what's going on?");
            await player.say('no idea');
            await npc.say("to get to the bottom of this you'll need to search glough's home");
            break;
        case 8:
        case 9:
            await player.say("i can't figure this out charlie");
            await npc.say(
                'go and see a forman in west karamja', // sic
                "there's a shipyard there,you might find some clues",
                "don't forget the password's ka-lu-min",
                "if they realise that you're not working for glough...",
                "...there'll be trouble"
            );
            break;
        case 10:
        case 11:
            await player.say('how are you doing charlie');
            await npc.say("i've been better");
            await player.say('glough has some plan to rule runescape');
            await npc.say("i wouldn't put it past him, the gnome's crazy");
            await player.say('i need some proof to convince the king');
            await npc.say(
                'hmmm, you could be in luck',
                'before glough had me locked up i heard him mention..',
                "..that he'd left his chest lock keys at his girlfriends"
            );
            await player.say('where does she live?');
            await npc.say('just west of the toad swamp');
            await player.say("okay, i'll see what i can find");

            if (stageOf(player) === 10) {
                setStage(player, 11);
            }

            break;
        default:
            player.message('the prisoner is in no mood to talk');
            break;
    }
}

async function anitaDialogue(player, npc) {
    if (stageOf(player) !== 11) {
        player.message('anita is to busy cleaning to talk'); // sic
        return;
    }

    await player.say('hello there');
    await npc.say("oh hello, i've seen you with the king");
    await player.say("yes, i'm helping him with a problem");
    await npc.say('you must know my boy friend glough then');
    await player.say('indeed!');
    await npc.say('could you do me a favour?');
    await player.say('i suppose so');
    await npc.say('give this key to glough', 'he left it here last night');
    await mes(player, 'anita gives you a key');
    player.inventory.add(GLOUGHS_KEY_ID);
    await npc.say('thanks a lot');
    await player.say('no, thankyou');
}

const DIALOGUES = {
    [GLOUGH_ID]: gloughDialogue,
    [CHARLIE_ID]: charlieDialogue,
    [ANITA_ID]: anitaDialogue
};

async function onTalkToNPC(player, npc) {
    const dialogue = DIALOGUES[npc.id];

    if (!dialogue) {
        return false;
    }

    player.engage(npc);
    await dialogue(player, npc);

    // a dialogue that ends in a fight has already let go (the fight holds the player now)
    if (player.interlocutor) {
        player.disengage();
    }

    return true;
}

// Charlie is behind bars
async function onNPCAttack(player, npc) {
    if (npc.id !== CHARLIE_ID) {
        return false;
    }

    player.message("you can't attack through the bars");
    return true;
}

async function cupboard(player, gameObject, command) {
    const { world } = player;

    if (command === 'open') {
        world.replaceEntity('gameObjects', gameObject, GLOUGHS_CUPBOARD_OPEN_ID);
        player.message('You open the cupboard');
    } else if (command === 'close') {
        world.replaceEntity('gameObjects', gameObject, GLOUGHS_CUPBOARD_CLOSED_ID);
        player.message('You close the cupboard');
    } else {
        await mes(player, 'you search the cupboard');

        if (stageOf(player) === 6) {
            await mes(player, "inside you find glough's journal");
            player.inventory.add(GLOUGHS_JOURNAL_ID);
            setStage(player, 7);
        } else {
            await mes(player, 'but find nothing of interest');
        }
    }

    return true;
}

async function objectCommand(player, gameObject, index) {
    if (gameObject.id === GLOUGHS_CUPBOARD_OPEN_ID || gameObject.id === GLOUGHS_CUPBOARD_CLOSED_ID) {
        const command = String(gameObject.definition.commands[index] || '').toLowerCase();
        return cupboard(player, gameObject, command);
    }

    if (gameObject.id === GLOUGHS_CHEST_CLOSED_ID && index === 0) {
        await mes(player, 'the chest is locked...');
        await mes(player, '...you need a key');
        return true;
    }

    return false;
}

async function onGameObjectCommandOne(player, gameObject) {
    return objectCommand(player, gameObject, 0);
}

async function onGameObjectCommandTwo(player, gameObject) {
    return objectCommand(player, gameObject, 1);
}

async function onUseWithGameObject(player, gameObject, item) {
    if (gameObject.id !== GLOUGHS_CHEST_CLOSED_ID || item.id !== GLOUGHS_KEY_ID) {
        return false;
    }

    const { world } = player;

    await mes(player, 'the key fits the chest');
    player.message('you open the chest');
    player.message('and search it...');
    world.replaceTimed('gameObjects', gameObject, GLOUGHS_CHEST_OPEN_ID, CHEST_OPEN_TICKS);
    await mes(player, 'inside you find some paper work');
    player.message('and an old gnome tongue translation book');
    player.inventory.add(GLOUGHS_NOTES_ID);
    player.inventory.add(TRANSLATION_BOOK_ID);

    if (stageOf(player) === 11) {
        setStage(player, 12);
    }

    await mes(player, 'you close the chest');

    if ('helpedFemi' in player.cache && stageOf(player) > 10) {
        // no longer needed
        delete player.cache.helpedFemi;
    }

    return true;
}

module.exports = {
    onTalkToNPC,
    onNPCAttack,
    onGameObjectCommandOne,
    onGameObjectCommandTwo,
    onUseWithGameObject
};
