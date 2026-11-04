// Ported from Open-RSC Core-Framework authentic/quests/members/grandtree/GrandTree.java (AGPL-3.0): King Narnode
// Shareen (541 in the Grand Tree, 545 under it), Hazelmere (546) and Hazelmere's riddle, the finale and the reward.
// https://classic.runescape.wiki/w/The_Grand_Tree
//
// questStages.grandTree (the Java stages; the other Grand Tree files say who moves which):
//   0  Narnode (417,163) takes you down to the roots: "i'd be happy to help" gives the translation book (918) and a
//      bark sample (919) -> 1                                                                       narnode.js
//   1  Hazelmere (532,754, the hill on the island south of the Khazard fight arena) takes the bark sample -> 2  narnode.js
//   2  Narnode: "i think so", then Hazelmere's words: none of the above x3, "human came with king's seal",
//      "gave human daconia rock", "daconia rocks will kill tree" (cache gtQ1/gtQ2 carry the first two) -> 3  narnode.js
//   3  Glough (tree house, 714,1424 upstairs) hears of the theft -> 4                                  glough.js
//   4  Narnode: Glough caught a human with the stones -> 5                                             narnode.js
//   5  Charlie (419,2991, the cage at the top of the tree) blames Glough -> 6                           glough.js
//   6  Glough's cupboard (620, 716,1419) holds his journal (921) -> 7                                    glough.js
//   7  Glough has you caged; Charlie names the Karamja foreman and the password ka-lu-min; Narnode frees you -> 8 glough.js
//   8  the glider pilot (552) crashes you in south Karamja (gnome-glider.js); the shipyard gate (624) worker wants the
//      password (shipyard.js); the foreman (560) quizzes you in his hut (561): "his wife is no longer with us",
//      "he loves worm holes", "Anita" -> invoice (922), 10. A wrong answer -> 9 and the foreman attacks; killing him
//      also gives the invoice -> 10                                                                    shipyard.js
//  10  the stronghold gate is barred (game-objects/members-gates.js); Femi (563) smuggles you in (helped with her
//      barrel at stage 0, or 1000 coins) (stronghold.js); Charlie -> 11                                  glough.js
//  11  Anita (565) gives Glough's key (925); the key on his chest (632) gives his notes (926) -> 12       glough.js
//  12  Narnode takes the notes and gives four pebbles (927-930) -> 13                                   narnode.js
//  13  the pebbles on the stone stand (634, top of the watch tower 635, agility 25) in the order 927, 928, 929, 930
//      left to right; pushing the stand down then -> 14                                                roots.js
//  14  down the trunk Glough sets a Black Demon (568) on you; killing it -> 15                          roots.js
//  15  Narnode underground (545, 704,3283) -> 16                                                        narnode.js
//  16  the root at (707,3297) (637) holds the Daconia rock (931); Narnode takes it -> -1: 5 quest points, agility and
//      attack 1600 + 1200 per level, magic 600 + 200 per level (quarter points)                         narnode.js
// Not ported: the custom Combat Odyssey tiers Hazelmere hands out after the quest (OpenRSC WANT_COMBAT_ODYSSEY).

const NARNODE_ID = 541;
const NARNODE_UNDERGROUND_ID = 545;
const HAZELMERE_ID = 546;

const TRANSLATION_BOOK_ID = 918;
const BARK_SAMPLE_ID = 919;
const GLOUGHS_NOTES_ID = 926;
const PEBBLE_1_ID = 927;
const PEBBLE_2_ID = 928;
const PEBBLE_3_ID = 929;
const PEBBLE_4_ID = 930;
const PEBBLE_IDS = [PEBBLE_3_ID, PEBBLE_2_ID, PEBBLE_4_ID, PEBBLE_1_ID]; // the Java gives PEBBLE_3, PEBBLE_2, PEBBLE_4, PEBBLE_1 in this order

// in the Java's order, spelled out so the item audit (scripts/audit/item-sources.js) sees each; `missing` only replaces lost ones
function givePebbles(player, missing = false) {
    if (!missing || !player.inventory.has(PEBBLE_3_ID)) player.inventory.add(PEBBLE_3_ID);
    if (!missing || !player.inventory.has(PEBBLE_2_ID)) player.inventory.add(PEBBLE_2_ID);
    if (!missing || !player.inventory.has(PEBBLE_4_ID)) player.inventory.add(PEBBLE_4_ID);
    if (!missing || !player.inventory.has(PEBBLE_1_ID)) player.inventory.add(PEBBLE_1_ID);
}
const DACONIA_ROCK_ID = 931;

// ActionSender.sendBox(player, ..., true): Hazelmere's words in the old tongue
const HAZELMERE_WORDS =
    '@yel@x@red@z@yel@ql@red@:v@yel@ha @red@za@yel@:v@red@ql@yel@::: @red@h:@yel@xa@red@lat@yel@x @red@vo@yel@xa@red@ha@yel@qa@red@sol @yel@sol@red@:::@yel@:v@red@va% %' +
    '@yel@qa@red@:v@yel@::@red@::: @yel@x@red@z@yel@ql@red@:v@yel@ha @red@qe@yel@:v@red@ha @yel@qe@red@:v@yel@za@red@ho@yel@ha@red@xa@yel@:v @red@qi@yel@ho@red@za@yel@vo% %' +
    '@red@qe@yel@:v@red@za@yel@ho@red@ha@yel@xa@red@:v @yel@qi@red@ho@yel@za@red@vo@yel@sol @red@h:@yel@xa@red@va@yel@va @red@vo@yel@xa@red@va@yel@va @yel@lat@red@qi@yel@:::@red@:::';

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

function findNpc(player, id, range) {
    return player.getNearbyEntitiesByID('npcs', id, range)[0];
}

// GrandTree.handleReward
function completeQuest(player) {
    const level = (skill) => player.skills[skill].base;

    player.completeQuest('grandTree', {
        questPoints: 5,
        experience: {
            agility: 1600 + 1200 * level('agility'),
            attack: 1600 + 1200 * level('attack'),
            magic: 600 + 200 * level('magic')
        },
        message: 'well done you have completed the grand tree quest'
    });
}

async function replaceLostBookAndBark(player, npc) {
    if (player.inventory.has(TRANSLATION_BOOK_ID) && player.inventory.has(BARK_SAMPLE_ID)) {
        return false;
    }

    if (!player.inventory.has(BARK_SAMPLE_ID)) {
        await player.say("but i've lost the bark sample");
        await npc.say('here take another and try to hang on to it');
        player.message('king shareem gives you another bark sample');
        player.inventory.add(BARK_SAMPLE_ID);
    }

    if (!player.inventory.has(TRANSLATION_BOOK_ID)) {
        await player.say("but i've lost the book you gave me");
        await npc.say("don't worry i have more", 'here you go');
        player.message('king shareem gives you a translation book');
        player.inventory.add(TRANSLATION_BOOK_ID);
    }

    return true;
}

async function wrongTranslation(player, npc) {
    await npc.say("wait a minute, that doesn't sound like hazelmere", 'are you sure you translated correctly?');
    await player.say('erm...i think so');
    await npc.say(
        "i'm sorry traveller but this is no good",
        "the translation must be perfect or the infomation's no use", // sic
        'please come back when you know exactly what hazelmere said'
    );

    delete player.cache.gtQ1;
    delete player.cache.gtQ2;
}

async function translationRiddle(player, npc) {
    // multi(player, ...) with no npc: the player still says the option
    const first = await player.ask(
        [
            'hello there traveller',
            'king shareem must be stopped',
            'praise to the great zamorak',
            'have you any bread',
            'none of the above'
        ],
        true
    );

    if (first === 4) {
        player.cache.gtQ1 = true;
    }

    const second = await player.ask(
        [
            'you must warn the gnomes',
            'soon the eternal night will come',
            'the seven must reunite',
            'only one the fifth night',
            'none of the above'
        ],
        true
    );

    if (second === 4 && player.cache.gtQ1 && !player.cache.gtQ2) {
        player.cache.gtQ2 = true;
    }

    const third = await player.ask(
        ['all shall peril', 'chicken, it must be chicken', 'and then you will know', 'the tree will live', 'none of the above'],
        true
    );

    if (third !== 4 || !player.cache.gtQ1 || !player.cache.gtQ2) {
        await wrongTranslation(player, npc);
        return;
    }

    delete player.cache.gtQ1;
    delete player.cache.gtQ2;

    const fourth = await player.ask(
        [
            "monster came with king's sword",
            'giant left with tree stone',
            "ogre came with king's head",
            "human came with king's seal",
            'fairy came with eternal flower'
        ],
        true
    );

    if (fourth !== 3) {
        await wrongTranslation(player, npc);
        return;
    }

    const fifth = await player.ask(
        [
            'gave the ever-light to human',
            'gave human daconia rock',
            'gave human rock to daconia',
            'human attacked by daconia',
            'human destroyed daconia rock'
        ],
        true
    );

    if (fifth !== 1) {
        await wrongTranslation(player, npc);
        return;
    }

    const sixth = await player.ask(
        [
            'daconia rocks will save tree',
            'daconia will fall to gnome kingdom',
            'gnome kingdom will fall to daconia',
            'daconia rocks will kill tree',
            'daconia rocks killed human'
        ],
        true
    );

    if (sixth !== 3) {
        await wrongTranslation(player, npc);
        return;
    }

    await player.say(
        "he said a human came to him with the king's seal",
        'hazelmere gave the man daconia rocks',
        'and daconia rocks will kill the tree'
    );
    await npc.say(
        'of course, i should have known',
        'some one must have forged my royal seal',
        'and convinced hazelmere that i sent for the daconia stones'
    );
    await player.say('what are daconia stones?');
    await npc.say(
        'hazelmere created the daconia stones',
        'they were a safty measure, in case the tree grew out of control', // sic
        "they're the only thing that can kill the tree",
        'this is terrible, those stones must be retrieved'
    );
    await player.say('can i help?');
    await npc.say(
        'first i must warn the tree guardians',
        'please, could you tell the chief tree guardian glough',
        'he lives in a tree house just in front of the grand tree',
        "if he's not there he will be at anita's, his girlfriend",
        "meet me back here once you've told him"
    );
    await player.say("ok, i'll be back soon");
    setStage(player, 3);
}

async function narnodeStart(player, npc) {
    const { world } = player;

    await player.say('hello there');
    await npc.say("hello traveller, i'm king shareem, welcome", "it's nice to see an outsider");
    await player.say('it seems to be quite a busy settlement');
    await npc.say('for now it is, thankfully');
    player.message('King shareem seems troubled');

    const option = await player.ask(["you seem worried, what's wrong?", "well, i'll be on my way"], true);

    if (option === 1) {
        await npc.say('ok then, enjoy your stay with us', "there's many shops and sights to see");
        return;
    }

    if (option !== 0) {
        return;
    }

    await npc.say('adventurer, can i speak to you in the strictest confidence');
    await player.say('of course narnode');
    await npc.say('not here, follow me');
    player.message('king shareem bends down and places his hands on the stone tile');
    await mes(player, 'you here a creak as he turns the tile clockwise'); // sic
    await mes(player, 'the tile slides away, revealing a small tunnel');
    await mes(player, 'you follow king shareem down');

    player.disengage();
    player.teleport(703, 3284);
    await world.sleepTicks(3); // the teleport lands after 2 ticks

    const king = findNpc(player, NARNODE_UNDERGROUND_ID, 15);

    if (!king) {
        return;
    }

    await player.say('so what is this place?');
    await king.say('these my friend, are the foundations of the stronghold');
    await player.say('they just look like roots');
    await king.say(
        'not any roots traveller',
        'these were conjured in the past age by gnome mages',
        'since then, they have grown into our mighty stronghold'
    );
    await player.say('impressive, but what exactly is the problem?');
    await king.say(
        'in the last two months our tree guardians have reported...',
        '...continuing deterioration of the grand trees health',
        "i've never seen this before, it could mean the end for all of us"
    );
    await player.say('you mean the tree is ill');
    await king.say('in a magical sense yes', 'would you be willing to help us discover the cause of this illness');

    const help = await player.ask(["i'm sorry i don't want to get involved", "i'd be happy to help"], true);

    if (help === 0) {
        await king.say('i understand traveller', 'please keep this to yourself');
        await player.say('of course');
        await king.say("i'll show you the way back up");
        player.message('you follow king shareem up the ladder');
        player.teleport(415, 163);
    } else if (help === 1) {
        await king.say('thank guthix for you arrival', "the first task is to find out what's killing my tree");
        await player.say('have you any ideas?');
        await king.say(
            "my top tree guardian, glough, believes it's human sabotage",
            "i'm not so sure",
            'the only way to really know, is to talk to Hazelmere'
        );
        await player.say("who's hazelmere?");
        await king.say(
            'a once all powerful mage who created the grand tree',
            'one of the only survivors of the old age',
            'take this bark sample to him, he should be able to help',
            "the mage only talks in the old tongue, you'll need this"
        );
        await player.say('what is it?');
        await king.say(
            'a translation book, translate carefully, his words may save us all',
            "you'll find his dwellings high upon a towering hill..",
            '..on a island south of the khazard fight arena'
        );
        player.message('king shareem gives you a book and a bark sample');
        player.inventory.add(TRANSLATION_BOOK_ID);
        player.inventory.add(BARK_SAMPLE_ID);
        await king.say("i'll show you the way back up");
        player.message('you follow king shareem up the ladder');
        player.teleport(415, 163);
        setStage(player, 1);
    }
}

async function narnodeDialogue(player, npc) {
    switch (stageOf(player)) {
        case 0:
            await narnodeStart(player, npc);
            break;
        case 1:
            await player.say('hello king shareem');
            await npc.say("traveller, you've returned", 'any word from hazelmere?');
            await player.say("not yet i'm afraid");

            if (!(await replaceLostBookAndBark(player, npc))) {
                await npc.say(
                    'hazalmere lives on a island just south of the fight arena', // sic
                    'give him the sample and translate his reply',
                    'i just hope he can help in our hour of need'
                );
            }

            break;
        case 2: {
            await player.say('hello again king shareem');
            await npc.say('well hello traveller, did you speak to hazelmere?');
            await player.say('yes, i managed to find him');
            await npc.say('and do you know what he said?');

            const menu = await player.ask(['i think so', 'no, i need to go back'], true);

            if (menu === 0) {
                await npc.say('so what did he say?');
                await translationRiddle(player, npc);
            } else if (menu === 1) {
                await replaceLostBookAndBark(player, npc);
                await npc.say('time is of the essence adventurer');
            }

            break;
        }
        case 3:
            await player.say('hello narnode');
            await npc.say('hello traveller, did you speak to glough?');
            await player.say('not yet');
            await npc.say('ok, he lives just in front of the grand tree', "let me know once you've spoken to him");
            break;
        case 4:
            await player.say('hello king shareem', 'have you any news on the daconia stones?');
            await npc.say(
                "it's ok traveller, thank's to glough",
                'he found a human sneaking around...',
                '...with three daconia stones in his satchel'
            );
            await player.say("i'm amazed that you retrieved them so easily");
            await npc.say(
                'yes, glough must really know what he\'s doing',
                "the human has been detained until we know who's involved",
                'maybe glough was right, maybe humans are invading'
            );
            await player.say('i doubt it, can i speak to the prisoner');
            await npc.say(
                "certainly, he's on the top level of the grand tree",
                "be careful up there, it's a long way down"
            );
            setStage(player, 5);
            break;
        case 5:
            await player.say('hi narnode');
            await npc.say(
                'hello traveller',
                'if you wish to talk to the prisoner',
                'go to the top tree level',
                "you'll find him there"
            );
            await player.say('thanks');
            break;
        case 6:
            await player.say('king shareem');
            await npc.say('hello adventurer, so did you speak to the culprit?');
            await player.say("yes i did and something's not right");
            await npc.say('what do you mean?');
            await player.say('the prisoner claims he was paid by glough to get the stones');
            await npc.say(
                "that's an absurd story, he's just trying to save himself",
                "since glough's wife died he has been a little strange",
                'but he would never wrongly imprison someone',
                "now the culprit's locked up we can all relax",
                "it's sad but i think glough was right",
                'humans are planning to invade and wipe us tree gnomes out'
            );
            await player.say('but why?');
            await npc.say(
                'who knows? but you may have to leave soon adventurer',
                'i trust you, but the local gnomes are getting paranoid'
            );
            await player.say("that's a shame");
            await npc.say("hopefully i can keep my people calm, we'll see");
            break;
        case 7:
            await player.say("king shareem, i'm concerned about glough");
            await npc.say(
                "why, don't worry yourself about him",
                'now the culprit has been caught...',
                "..i'm sure glough's resentment of humans will die away"
            );
            await player.say("i'm not so sure");
            await npc.say('he just has an active imagination', 'if your really concerned, speak to him'); // sic
            break;
        case 8:
        case 9:
            await player.say('hello narnode');
            await npc.say(
                "traveller, haven't you heard",
                'glough has set a warrant for your arrest',
                'he has guards at the exit',
                "i shouldn't have told you this",
                'but i can see your a good person', // sic
                "please take the glider and leave before it's too late"
            );
            await player.say('all the best narnode');
            break;
        case 10:
            await player.say('king shareem,i need to talk');
            await npc.say(
                'traveller, what are you doing here?',
                'the stronghold has been put on full alert',
                "it's not safe for you here"
            );
            await player.say('narnode, i believe glough is killing the trees', 'in order to make a mass fleet of warships');
            await npc.say("that's an absurd accusation");
            await player.say('his hatred for humanity is stronger than you know');
            await npc.say(
                "that's enough traveller, you sound as paranoid as him",
                'traveller please leave',
                "it's bad enough having one human locked up"
            );
            break;
        case 11:
            await player.say('hello narnode');
            await npc.say('please traveller, if the gnomes see me talking to you', "they'll revolt against me");
            await player.say("that's crazy");
            await npc.say(
                "glough's scared the whole town",
                'he expects the humans to attack any day',
                "he's even began to recuit hundreds of gnome soldiers" // sic
            );
            await player.say("don't you understand he's creating his own army");
            await npc.say("please traveller, just leave before it's too late");
            break;
        case 12:
            await player.say('hi narnode, did you think about what i said?');
            await npc.say(
                "look, if you're right about glough i would have him arrested",
                "but there's no reason for me to think he's lying"
            );

            if (player.inventory.has(GLOUGHS_NOTES_ID)) {
                await player.say("look, i found this at glough's home");
                await mes(player, 'you give the king the strategic notes');
                player.inventory.remove(GLOUGHS_NOTES_ID);
                await npc.say(
                    "hmmm, these are interesting",
                    "but it's not proof, any one could have made these",
                    'traveller, i understand your concern',
                    "i had guards search glough's house",
                    'but they found nothing suspicious',
                    'just these old pebbles'
                );
                await mes(player, 'narnode gives you four old pebbles');

                givePebbles(player);

                await npc.say(
                    "on the other hand, if glough's right about the humans",
                    'we will need an army of gnomes to protect ourselves',
                    "so i've decided to allow glough to raise a mighty gnome army",
                    "the grand tree's still slowly dying, if it is human sabotage",
                    'we must respond'
                );
                setStage(player, 13);
            }

            break;
        case 13:
            await player.say('hello again narnode');
            await npc.say('please traveller, take my advice and leave');

            if (!PEBBLE_IDS.every((id) => player.inventory.has(id))) {
                await player.say('have you any more of those pebbles');
                await npc.say('well, yes as it goes, why?');
                await player.say('i lost some');
                await npc.say("here take these, i don't see how it will help though");
                await mes(player, 'narnode replaces your lost pebbles');

                for (const flag of ['pebble1', 'pebble2', 'pebble3', 'pebble4']) {
                    delete player.cache[flag];
                }

                givePebbles(player, true);
            } else {
                await npc.say("it's not safe for you here");
            }

            break;
        case 14:
            await player.say('narnode, it\'s true about glough i tell you', "he's planning to take over runescape");
            await npc.say(
                "i'm sorry traveller but it's just not realistic",
                'how could glough- even with a gnome army- take over?'
            );
            await player.say(
                Math.random() < 0.5
                    ? "he plans to make a fleet of warships from the grand trees' wood"
                    : "he plans to make a fleet of warships from the grand tree's wood"
            );
            await npc.say(
                "that's enough traveller, i've no time for make believe",
                "the tree's still dying, i must get to the truth of this"
            );
            break;
        case -1:
            await player.say('hello narnode');
            await npc.say('well hello again adventurer', 'how are you?');
            await player.say("i'm good thanks, how's the tree?");
            await npc.say('better than ever, thanks for asking');

            // CAN_RETRIEVE_POST_QUEST_ITEMS
            if (!player.inventory.has(TRANSLATION_BOOK_ID)) {
                await player.say("i've lost the book you gave me");
                await npc.say("don't worry i have more", 'here you go');
                player.message('king shareem gives you a translation book');
                player.inventory.add(TRANSLATION_BOOK_ID);
            }

            break;
    }
}

// FINALE COMPLETION: Narnode under the tree
async function narnodeUndergroundDialogue(player, npc) {
    switch (stageOf(player)) {
        case 15:
            await npc.say('traveller you\'re wounded, what happened?');
            await player.say("it's glough, he set a demon on me");
            await npc.say('what, glough, with a demon?');
            await player.say(
                'glough has a store of daconia rocks further up the passage way',
                "he's been accessing the roots from a secret passage at his home"
            );
            await npc.say("never, not glough, he's a good gnome at heart", 'guard, go and check out that passage way');
            await mes(player, "one of the king's guards runs of up the passage"); // sic
            await npc.say("look, maybe it's stress playing with your mind");
            await mes(player, 'the gnome guard returns');
            await mes(player, 'and talks to the king');
            await npc.say('what?, never, why that little...', 'they found glough hiding under a horde of daconia rocks..');
            await player.say("that's what i've been trying to tell you", "glough's been fooling you");
            await npc.say("i..i don't know what to say", 'how could i have been so blind');
            await mes(player, 'king shareem calls out to another guard');
            await npc.say(
                'guard, call off the military training',
                'the humans are not attacking',
                'you have my full apologies traveller, and my gratitude',
                'a reward will have to wait though, the tree is still dying',
                "the guards are clearing glough's rock supply now",
                'but there must be more daconia hidden somewhere in the roots',
                'please traveller help us search, we have little time'
            );
            setStage(player, 16);
            break;
        case 16:
            await npc.say('traveller, have you managed to find the rock', "i think there's only one");

            if (player.inventory.has(DACONIA_ROCK_ID)) {
                await player.say('is this it?');
                await npc.say('yes, excellent, well done');
                await mes(player, 'you give king shareem the daconia rock');
                player.inventory.remove(DACONIA_ROCK_ID);
                await npc.say(
                    "it's incredible, the tree's health is improving already",
                    "i don't what to say, we owe you so much", // sic
                    'to think glough had me fooled all along'
                );
                await player.say('all that matters now is that man...', '...and gnome can live together in peace');
                await npc.say("i'll drink to that");
                completeQuest(player);
                await npc.say(
                    'from now on i vow to make this stronghold',
                    'a welcome place for all no matter what their creed',
                    "i'll grant you access to all our facilities"
                );
                await player.say('thanks, i think');
                await npc.say(
                    'it should make your stay here easier',
                    'you can use the spirit tree to transport yourself',
                    '..as well as the gnome glider',
                    'i also give you access to our mine'
                );
                await player.say('mine?');
                await npc.say(
                    'very few know of the secret mine under the grand tree',
                    'if you push on the roots just to my north',
                    'the grand tree will take you there'
                );
                await player.say('strange');
                await npc.say("that's magic trees for you", 'all the best traveller and thanks again');
                await player.say('you too narnode');
            } else {
                await player.say('no sign of it so far');
                await npc.say("the tree will still die if we don't find it", 'it could be anywhere');
                await player.say("don't worry narnode, we'll find it");
            }

            break;
        case -1:
            await player.say('hello narnode');
            await npc.say('well hello again adventurer', 'how are you?');
            await player.say("i'm good thanks, how's the tree?");
            await npc.say(Math.random() < 0.5 ? 'better than ever, thanks to you' : 'better than ever, thanks for asking');
            break;
    }
}

async function hazelmereSpeaks(player) {
    await mes(player, 'the mage speaks in a strange ancient tongue');
    await mes(player, 'he says....');
    player.send({ type: 'serverMessageOnTop', message: HAZELMERE_WORDS });
}

async function hazelmereDialogue(player, npc) {
    switch (stageOf(player)) {
        case 0:
            await mes(player, 'the mage mumbles in an ancient tounge'); // sic
            await mes(player, "you can't understand a word");
            break;
        case 1:
            await player.say('hello');

            if (player.inventory.has(BARK_SAMPLE_ID)) {
                await mes(player, 'you give the mage the bark sample');
                player.inventory.remove(BARK_SAMPLE_ID);
                await hazelmereSpeaks(player);
                setStage(player, 2);
            } else {
                await mes(player, 'the mage mumbles in an ancient tounge');
                await mes(player, "you can't understand a word");
                await mes(player, 'you need to give him the bark sample');
            }

            break;
        case 2:
            await hazelmereSpeaks(player);
            break;
        default:
            player.message('the mage mumbles in an ancient tounge');
            player.message("you can't understand a word");
            break;
    }
}

const DIALOGUES = {
    [NARNODE_ID]: narnodeDialogue,
    [NARNODE_UNDERGROUND_ID]: narnodeUndergroundDialogue,
    [HAZELMERE_ID]: hazelmereDialogue
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

module.exports = { onTalkToNPC, HAZELMERE_WORDS };
