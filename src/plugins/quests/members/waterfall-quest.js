// Ported from Open-RSC Core-Framework authentic/quests/members/Waterfall_Quest.java (AGPL-3.0)
// https://classic.runescape.wiki/w/Waterfall_Quest
//
// questStages.waterfallQuest (the Java stages):
//   0  Almera (470) in the house by the river (656,448), Baxtorian Falls east of Seers' Village: "how can I help?" -> 1
//   1  the log raft (464, game-objects/object-tele-points.js, already there) lands on Hudon's mound (662,463); Hudon (471)
//      answers there -> 2 (or talk to him: the same). Gerald (481) and Hadley (472, the tourist guide of Hemenster, upstairs
//      in the tourist centre south of the falls, has the book on Baxtorian in the bookcase 470 (650,1435)) only talk.
//   2  read the book on Baxtorian (788, "read") -> 3; a stage 2 player may also talk to Almera about it
//   3  the pebble: Golrie (475) in the goblin-ridden cave (663,3530 gate 480) gives Glarial's pebble (787) for the large key
//      (789, crate 481 at (655,3535)); the pebble on Glarial's gravestone (479 at (631,476)) -> 4, climbing down to the
//      underground passage (631,3305). The pebble fails while a dagger, scimitar, bow, mail, plated item, rune skirt, shield,
//      sword, mace, helmet, axe, throwing knife or spear is carried ("only visitors with peaceful intent")
//   4  jump off (462, 463, 482) the trees over the river, tying a Rope (237) to the far one lands on the ledge and the falls;
//      the cupboard 506/507 (634,3295) holds Glarial's urn (805), the coffin 467 (646,3305) Glarial's amulet (782, wear
//      it), the crate 492 (650,3290) an old key (797) for the locked door 135 (668,3281). The doors 471 (659,3303) open to
//      someone wearing the amulet, else the corridor floods. The statue of Glarial 483 (647,3266) with the amulet lifts the
//      ground to the chalice room (647,3267); the urn emptied into the Chalice of eternity (485 at (647,3269)) ends the quest.
//   -1 1 quest point, attack and strength 1000 + 900 x level (quarter points), 40 Mithril seeds, 2 Gold bars, 2 Diamonds
// Open-RSC quirk kept: the stone stands (473-478) take an air, water or earth rune each and remember it
// (waterfall_<stand>_<rune>), but the statue's check loops `for (int y = 32; i < 34; i++)` can never run, so the statue works
// without any runes. The runes are still used up when placed.

const GameObject = require('../../../model/game-object');
const items = require('@2003scape/rsc-data/config/items');

const ALMERA_ID = 470;
const HUDON_ID = 471;
const HADLEY_ID = 472;
const GOLRIE_ID = 475;
const GERALD_ID = 481;

const TALK_IDS = new Set([ALMERA_ID, HUDON_ID, HADLEY_ID, GERALD_ID, GOLRIE_ID]);

const WATER_RUNE_ID = 32;
const AIR_RUNE_ID = 33;
const EARTH_RUNE_ID = 34;
const DIAMOND_ID = 161;
const GOLD_BAR_ID = 172;
const ROPE_ID = 237;
const RUNE_SKIRT_ID = 406;
const GLARIALS_AMULET_ID = 782;
const GLARIALS_PEBBLE_ID = 787;
const BOOK_ON_BAXTORIAN_ID = 788;
const LARGE_KEY_ID = 789;
const MITHRIL_SEED_ID = 796;
const AN_OLD_KEY_ID = 797;
const GLARIALS_URN_ID = 805;
const GLARIALS_URN_EMPTY_ID = 806;

const RUNE_IDS = new Set([WATER_RUNE_ID, AIR_RUNE_ID, EARTH_RUNE_ID]);
// the names Open-RSC's item definitions give (rsc-data spells them air-rune)
const RUNE_NAMES = { [WATER_RUNE_ID]: 'water rune', [AIR_RUNE_ID]: 'air rune', [EARTH_RUNE_ID]: 'earth rune' };

const BAXTORIAN_CUPBOARD_CLOSED_ID = 506;
const BAXTORIAN_CUPBOARD_OPEN_ID = 507;
const TREE_IDS = new Set([462, 463, 482]);
const WATERFALL_ID = 469;
const BOOKCASE_ID = 470;
const GRAVESTONE_ID = 479;
const GATE_ID = 480;
const CRATE_LARGE_KEY_ID = 481;
const COFFIN_ID = 467;
const FLOOD_DOORS_ID = 471;
const CRATE_OLD_KEY_ID = 492;
const LOCKED_DOOR_ID = 135;
const STATUE_ID = 483;
const CHALICE_ID = 485;
const DOORWAY_ID = 486;
const SEED_TREE_ID = 490;
const STAND_IDS = new Set([473, 474, 475, 476, 477, 478]);

const RIVER_BANK = { x: 654, y: 485 };
const DOORWAY_TO = { x: 667, y: 3279 };
const PASSAGE = { x: 631, y: 3305 };
const LEDGE = { x: 659, y: 3305 };
const CHALICE_ROOM = { x: 647, y: 3267 };

// delayedRemoveObject(..., 60000) as 640 ms ticks
const SEED_TREE_TICKS = Math.ceil(60000 / 640);

function stageOf(player) {
    return player.questStages.waterfallQuest || 0;
}

function setStage(player, stage) {
    player.questStages.waterfallQuest = stage;
}

// Open-RSC mes(...) followed by delay(3)
async function mes(player, ...lines) {
    for (const line of lines) {
        player.message(`@que@${line}`);
        await player.world.sleepTicks(3);
    }
}

function itemName(id) {
    return items[id].name.toLowerCase();
}

// Waterfall_Quest.handleReward, QuestRewardRegistrar: 1 quest point, attack and strength 1000 + 900 per level
function completeQuest(player) {
    const { skills } = player;

    for (let stand = 473; stand < 478; stand += 1) {
        for (const rune of RUNE_IDS) {
            delete player.cache[`waterfall_${stand}_${rune}`];
        }
    }

    player.completeQuest('waterfallQuest', {
        questPoints: 1,
        experience: {
            strength: 1000 + 900 * skills.strength.base,
            attack: 1000 + 900 * skills.attack.base
        },
        message: 'you have completed the Baxtorian waterfall quest'
    });
    player.inventory.add(MITHRIL_SEED_ID, 40);
    player.inventory.add(GOLD_BAR_ID, 2);
    player.inventory.add(DIAMOND_ID, 2);
}

// the river washes you up at the bank, 4-10 damage the poorer (DataConversions.random(4, 10))
async function washedUp(player, lines) {
    player.teleport(RIVER_BANK.x, RIVER_BANK.y);
    player.damage(4 + Math.floor(Math.random() * 7));
    await player.say('ouch!');
    await mes(player, ...lines);
}

function findNpcIn(world, id, minX, maxX, minY, maxY) {
    for (const npc of world.npcs.getAllByID(id)) {
        if (npc.x >= minX && npc.x <= maxX && npc.y >= minY && npc.y <= maxY) {
            return npc;
        }
    }

    return undefined;
}

// ---------------------------------------------------------------- dialogue

async function almera(player, npc) {
    switch (stageOf(player)) {
        case 0: {
            await player.say('hello madam');
            await npc.say(
                'ah, hello there',
                'nice to see an outsider for a change',
                'are you busy young man?, i have a problem'
            );

            const option = await player.ask(["i'm afraid i'm in a rush", 'how can i help?'], true);

            if (option === 0) {
                await npc.say('oh okay, never mind');
            } else if (option === 1) {
                await npc.say(
                    "it's my son hudon, he's always getting into trouble",
                    "the boy's convinced there's hidden treasure in the river",
                    "and i'm a bit worried about his safety",
                    "the poor lad can't even swim"
                );
                await player.say('i could go and take a look for you if you like');
                await npc.say(
                    'would you kind sir?',
                    'you can use the small raft out back if you wish',
                    'do be careful, the current down stream is very strong'
                );
                setStage(player, 1);
            }

            break;
        }
        case 1:
            await player.say('hello almera');
            await npc.say('hello brave adventurer', 'have you seen my boy yet?');
            await player.say("i'm afraid not, but i'm sure he hasn't gone far");
            await npc.say('i do hope so', "you can't be too careful these days");
            break;
        case 2:
            await npc.say("well hello, you're still around then");
            await player.say('i saw hudon by the river but he refused to come back with me');
            await npc.say(
                'yes he told me',
                'the foolish lad came in drenched to the bone',
                "he had fallen into the waterfall, lucky he wasn't killed",
                'now he can spend the rest of the summer in his room'
            );
            await player.say('any ideas on what i could do while i\'m here?');
            await npc.say('why don\'t you visit the tourist centre south of the waterfall?');
            break;
        case 3:
            await player.say('hello again almera');
            await npc.say('well hello again brave adventurer', 'are you enjoying the tranquil scenery of these parts?');
            await player.say('yes, very relaxing');
            await npc.say(
                "well i'm glad to hear it",
                'the authorities wanted to dig up this whole area for a mine',
                "but the few locals who lived here wouldn't budge and they gave up"
            );
            await player.say('good for you');
            await npc.say('good for all of us');
            break;
        case 4:
        case -1:
            await player.say('hello almera');
            await npc.say('hello adventurer', "how's your treasure hunt going?");
            await player.say("oh, i'm just sight seeing");
            await npc.say(
                'no adventurer stays here this long just to sight see',
                'but your business is yours alone',
                'if you need to use the raft go ahead',
                'but please try not crash it this time'
            );
            await player.say('thanks almera');
            break;
        default:
    }
}

async function hudon(player, npc) {
    switch (stageOf(player)) {
        case 0:
            await player.say('hello there');
            await npc.say('what do you want?');
            await player.say('nothing, just passing by');
            break;
        case 1:
            await player.say('Hello hudon', 'hello son, are you alright?');
            await npc.say("don't play nice with me", 'i know your looking for the treasure to'); // sic
            await player.say('your mother sent me to find you hudon');
            await npc.say("i'll go home when i've found the treasure", "i'm going to be a rich rich man");
            await player.say('where is this treasure you talk of?');
            await npc.say(
                "just because i'm small doesn't mean i'm dumb",
                "if i told you, then you'd take it all for yourself"
            );
            await player.say('maybe i could help?');
            await npc.say("if you want to help go and tell my mother that i won't be back for a while");
            await mes(player, 'hudon is refusing to leave the waterfall');
            await player.say("ok i'll leave you to it");
            setStage(player, 2);
            break;
        case 2:
            await player.say('so your still here'); // sic
            await npc.say("i'll find that treasure soon", 'just you wait and see');
            break;
        case 3:
            await player.say('hello hudon');
            await npc.say('oh it\'s you', 'trying to find my treasure again are you?');
            await player.say("i didn't know it belonged to you");
            await npc.say(
                'it will do when i find it',
                'i just need to get into this blasted waterfall',
                "i've been washed downstream three times already"
            );
            break;
        case 4:
            await player.say('hello again');
            await npc.say("not you still, why don't you give up?");
            await player.say('and miss all the fun!');
            await npc.say('you do understand that anything you find you have to share it with me');
            await player.say("why's that?");
            await npc.say('because i told you about the treasure');
            await player.say("well, i wouldn't count on it");
            await npc.say("that's not fair");
            await player.say('neither is life kid');
            break;
        case -1:
            await player.say('hello again');
            await npc.say('you stole my treasure i saw you');
            await player.say("i'll make sure it goes to a good cause");
            await npc.say('hmmmm');
            break;
        default:
    }
}

async function gerald(player, npc) {
    if (stageOf(player) === 0) {
        await player.say('hello there');
        await npc.say('good day to you traveller', 'are you here to fish or just looking around?', "i've caught some beauties down here");
        await player.say('really');
        await npc.say('the last one was this big');
        await mes(player, 'gerald stretches his arms out to full width');
    } else {
        await player.say('hello');
        await npc.say('hello traveller', 'are you here to fish or to hunt for treasure?');
        await player.say('why do you say that?');
        await npc.say('adventurers pass through here every week', 'they never find anything though');
    }
}

// HADLEY.ALL = -1, WHAT_HAPPENED = 0, WHERE_ELSE = 1, IS_THERE_TREAS = 2 (menus drop the line just discussed)
const MAIN_OPTIONS = [
    'can you tell me what happened to the elf king?',
    'where else is worth visiting around here?',
    'is there treasure under the waterfall?',
    'thanks then, goodbye'
];

const ALT_OPTIONS = [
    'what happened to the elf king?',
    'where else is worth visiting around here?',
    "i don't like nature, it gives me a rash",
    'thanks then, goodbye'
];

async function hadleyMenu(player, options, discard) {
    const shown = options.filter((_, index) => index !== discard);
    let choice = await player.ask(shown, true);

    if (discard !== -1 && choice >= discard) {
        choice += 1;
    }

    return choice;
}

async function hadleyMain(player, npc, choice) {
    if (choice === -1) {
        await player.say('hello there');
        await npc.say(
            'are you on holiday?, if so you\'ve come to the right place',
            "i'm hadley the tourist guide, anything you need to know just ask me",
            'we have some of the most unspoilt wildlife and scenery in runescape',
            'people come from miles around to fish in the clear lakes',
            'or to wander the beautiful hill sides'
        );
        await player.say('it is quite pretty');
        await npc.say(
            'surely pretty is an understatement kind sir',
            'beautiful, amazing or possibly life changing would be more suitable wording',
            'have your seen the baxtorian waterfall?',
            "it's named after the elf king who was buried beneath"
        );
        choice = await hadleyMenu(player, MAIN_OPTIONS, -1);
    }

    if (choice === 0) {
        await npc.say(
            'there are many myths about baxtorian',
            'One popular story is this',
            'after defending his kingdom against the invading dark forces from the west',
            'baxtorian returned to find his wife glarial had been captured by the enemy',
            'this destroyed baxtorian, after years of searching he reclused',
            'to the secret home he had made for glarial under the waterfall',
            'he never came out and it is told that only glarial could enter'
        );
        await player.say('what happened to him?');
        await npc.say(
            "oh, i don't know",
            'i believe we have some pages on him upstairs in our archives',
            "if you wish to look at them please be careful, they're all pretty delicate"
        );
        choice = await hadleyMenu(player, MAIN_OPTIONS, 0);
    } else if (choice === 1) {
        await npc.say(
            "there's a lovely spot for a picnic on the hill to the north east",
            'there lies a monument to the deceased elven queen glarial',
            'it really is quite pretty'
        );
        await player.say('who was queen glarial?');
        await npc.say(
            'baxtorians wife, the only person who could also enter the waterfall',
            'she was queen when this land was inhabited by elven kind',
            'glarial was kidnapped while buxtorian was away',
            'but they eventually recovered her body and brought her home to rest'
        );
        await player.say("that's sad");
        await npc.say(
            'true, i believe there\'s some information about her upstairs',
            'if you look at them please be careful'
        );
        choice = await hadleyMenu(player, MAIN_OPTIONS, 1);
    } else if (choice === 2) {
        await npc.say(
            'ha ha, another treasure hunter',
            "well if there is no one's been able to get to it",
            "they've been searching that river for decades, all to no avail"
        );
        choice = await hadleyMenu(player, MAIN_OPTIONS, 2);
    } else if (choice === 3) {
        await npc.say('enjoy your visit');
        return;
    }

    if (choice >= 0) {
        await hadleyMain(player, npc, choice);
    }
}

async function hadleyBook(player, npc) {
    await player.say('hello there');
    await npc.say(
        "i hope you're enjoying your stay",
        'there should be lots of useful infomation in that book',
        'places to go, people to see'
    );

    const choice = await hadleyMenu(player, MAIN_OPTIONS, -1);

    if (choice >= 0) {
        await hadleyMain(player, npc, choice);
    }
}

async function hadleyAlt(player, npc, choice) {
    if (choice === -1) {
        await player.say('hello there');
        await npc.say(
            'well hello, come in, come in',
            "my names hadley, i'm head of tourism here in hemenster",
            "there's some of the most unspoilt wildlife and scenery in runescape here",
            'people come from miles around to fish in the clear lakes',
            'or to wander the beautiful hill sides'
        );
        await player.say('it is quite pretty');
        await npc.say(
            'surely pretty is an understatement kind sir',
            'beautiful, amazing or possibly life changing would be more suitable wording',
            'have your seen the baxtorian waterfall',
            "it's quite a sight",
            'named after the elf king who was buried beneath'
        );
        choice = await hadleyMenu(player, ALT_OPTIONS, -1);
    }

    if (choice === 0) {
        await npc.say(
            'baxtorian, i guess he died a long long time ago',
            "it's quite sad really",
            'after defending his kingdom against the invading dark forces from the west',
            'baxtorian returned to find his beautiful wife glarial had been captured',
            'this destroyed baxtorian, after years of searching he became a recluse',
            'in the secret home he had made for glarial under the waterfall',
            'he never came out and to this day no one has managed to get in'
        );
        await player.say('what happened to him?');
        await npc.say('no one knows');
        choice = await hadleyMenu(player, ALT_OPTIONS, 0);
    } else if (choice === 1) {
        await npc.say(
            "well, there's a wide variety wildlife",
            "although unfortunately most of it's quite dangerous",
            "please don't feed the goblins"
        );
        await player.say('ok');
        await npc.say(
            'there is a lovely spot for a picnic on the hill to the north east',
            "there's a monument to the deceased elven queen glarial",
            'it really is quite pretty'
        );
        choice = await hadleyMenu(player, ALT_OPTIONS, 1);
    } else if (choice === 2) {
        await npc.say("that's just silly talk");
        return;
    } else if (choice === 3) {
        await npc.say('enjoy your visit');
        return;
    }

    if (choice >= 0) {
        await hadleyAlt(player, npc, choice);
    }
}

async function hadley(player, npc) {
    const stage = stageOf(player);

    if (stage === 0 || stage === 1) {
        await hadleyAlt(player, npc, -1);
    } else if (player.inventory.has(BOOK_ON_BAXTORIAN_ID)) {
        await hadleyBook(player, npc);
    } else {
        await hadleyMain(player, npc, -1);
    }
}

async function golrie(player, npc) {
    const hasPebble = player.inventory.has(GLARIALS_PEBBLE_ID);

    await player.say('is your name golrie?');
    await npc.say(
        "that's me",
        "i've been stuck in here for weeks",
        'those goblins are trying to steal my families heirlooms',
        'my grandad gave me all sorts of old junk'
    );
    await player.say('do you mind if i have a look?');

    if (!hasPebble) {
        await npc.say('no, of course not');
        await mes(player, 'mixed with the junk on the floor', 'you find glarials pebble');
        player.inventory.add(GLARIALS_PEBBLE_ID, 1);
        await player.say('could i take this old pebble?');
        await npc.say('oh that, yes have it', "it's just some old elven junk i believe");
        player.inventory.remove(LARGE_KEY_ID);
        await mes(player, 'you give golrie the key');
        await npc.say('well thanks again for the key', "i think i'll wait in here until those goblins get bored and leave");
        await player.say('okay, take care golrie');
    } else {
        await npc.say('no, of course not');
        player.inventory.remove(LARGE_KEY_ID);
        await mes(player, 'you find nothing of interest', 'you give golrie the key');
        await npc.say('thanks a lot for the key traveller', "i think i'll wait in here until those goblins get bored and leave");
        await player.say('okay, take care golrie');
    }

    if (player.cache.golrie_key == null) {
        player.cache.golrie_key = true;
    }
}

const TALKS = {
    [ALMERA_ID]: almera,
    [HUDON_ID]: hudon,
    [GERALD_ID]: gerald,
    [HADLEY_ID]: hadley,
    [GOLRIE_ID]: golrie
};

async function onTalkToNPC(player, npc) {
    if (!TALK_IDS.has(npc.id)) {
        return false;
    }

    player.engage(npc);

    try {
        await TALKS[npc.id](player, npc);
    } finally {
        if (player.interlocutor) {
            player.disengage();
        }
    }

    return true;
}

// ---------------------------------------------------------------- objects

async function jumpIntoRapids(player) {
    await mes(player, 'you jump into the wild rapids below');
    await washedUp(player, ['you tumble over the water fall', 'and are washed up by the river side']);
}

async function searchBookcase(player) {
    await mes(player, 'you search the bookcase');

    if (!player.inventory.has(BOOK_ON_BAXTORIAN_ID)) {
        await mes(player, "and find a book named 'book on baxtorian'");
        player.inventory.add(BOOK_ON_BAXTORIAN_ID, 1);
    } else {
        await mes(player, 'but find nothing of interest');
    }
}

async function searchCrateForKey(player) {
    if (stageOf(player) === 0) {
        player.message('the crate is empty');
        return;
    }

    await mes(player, 'you search the crate');

    if (!player.inventory.has(LARGE_KEY_ID)) {
        await mes(player, 'and find a large key');
        player.inventory.add(LARGE_KEY_ID, 1);
    } else {
        player.message('but find nothing');
    }
}

async function golriesGate(player, gate) {
    const { world } = player;
    const golrieNpc = findNpcIn(world, GOLRIE_ID, 663, 668, 3520, 3529);

    if (stageOf(player) === 0) {
        if (golrieNpc) {
            await golrieNpc.say('what are you doing down here', 'leave before you get yourself into trouble');
        }

        return;
    }

    if (player.y <= 3529) {
        await player.enterGate(gate);
        return;
    }

    if ((player.y >= 3530 && player.cache.golrie_key != null) || stageOf(player) === -1) {
        player.message('golrie has locked himself in');
        return;
    }

    if (golrieNpc) {
        player.engage(golrieNpc);

        try {
            await player.say('are you ok?');
            await golrieNpc.say(
                "it's just those blasted hobgoblins",
                'i locked myself in here for protection',
                "but i've left the key somewhere",
                'and now i\'m stuck'
            );

            if (!player.inventory.has(LARGE_KEY_ID)) {
                await player.say("okay, i'll have a look for a key");
            } else {
                await player.say('i found a key');
                await golrieNpc.say("well don't wait all day", 'give it a try');
            }
        } finally {
            if (player.interlocutor) {
                player.disengage();
            }
        }
    }
}

async function readGravestone(player) {
    await mes(
        player,
        'the grave is covered in elven script',
        'some of the writing is in common tongue, it reads',
        'here lies glarial, wife of baxtorian',
        'true friend of nature in life and death',
        'may she now rest knowing',
        'only visitors with peaceful intent can enter'
    );
}

// Open-RSC openGenericObject / closeGenericObject
function openCupboard(player, cupboard) {
    player.world.replaceEntity('gameObjects', cupboard, BAXTORIAN_CUPBOARD_OPEN_ID);
    player.message('you open the cupboard');
}

function closeCupboard(player, cupboard) {
    player.world.replaceEntity('gameObjects', cupboard, BAXTORIAN_CUPBOARD_CLOSED_ID);
    player.message('you shut the cupboard');
}

async function searchCupboard(player) {
    await mes(player, 'you search the cupboard');

    if (!player.inventory.has(GLARIALS_URN_ID)) {
        player.message('and find a metel urn'); // sic
        player.inventory.add(GLARIALS_URN_ID, 1);
    } else {
        player.message("it's empty");
    }
}

async function searchCoffin(player) {
    await mes(player, 'you search the coffin');

    if (!player.inventory.has(GLARIALS_AMULET_ID)) {
        await mes(player, 'inside you find a small amulet', 'you take the amulet and close the coffin');
        player.inventory.add(GLARIALS_AMULET_ID, 1);
    } else {
        await mes(player, "it's empty");
    }
}

async function floodDoors(player, doors) {
    await mes(player, 'the doors begin to open');

    if (player.inventory.isEquipped(GLARIALS_AMULET_ID)) {
        await player.enterGate(doors, 63);
        await mes(player, 'You go through the door');
    } else {
        await mes(player, 'suddenly the corridor floods', 'flushing you back into the river');
        await washedUp(player, ['you tumble over the water fall']);
    }
}

async function searchCrateForOldKey(player) {
    await mes(player, 'you search the crate');

    if (!player.inventory.has(AN_OLD_KEY_ID)) {
        await mes(player, 'you find an old key');
        player.inventory.add(AN_OLD_KEY_ID, 1);
    } else {
        player.message('it is empty');
    }
}

async function chalice(player) {
    if (stageOf(player) === -1) {
        await mes(player, 'the chalice is empty', 'it will not move');
        return;
    }

    await mes(player, 'as you touch the chalice it tips over', 'it falls to the floor', 'you hear a gushing of water', 'water floods into the cavern');
    player.damage(1 + Math.floor(Math.random() * 10));
    player.teleport(RIVER_BANK.x, RIVER_BANK.y);
    await mes(player, 'ouch!', 'you tumble over the water fall', 'and are washed up by the river side');
}

async function onGameObjectCommandOne(player, gameObject) {
    const { id } = gameObject;

    if (TREE_IDS.has(id)) {
        // "jump off" is the first command of all three trees
        await jumpIntoRapids(player);
        return true;
    }

    switch (id) {
        case WATERFALL_ID:
            await jumpIntoRapids(player);
            return true;
        case BOOKCASE_ID:
            await searchBookcase(player);
            return true;
        case CRATE_LARGE_KEY_ID:
            await searchCrateForKey(player);
            return true;
        case GATE_ID:
            await golriesGate(player, gameObject);
            return true;
        case GRAVESTONE_ID:
            await readGravestone(player);
            return true;
        case BAXTORIAN_CUPBOARD_CLOSED_ID:
            openCupboard(player, gameObject);
            return true;
        case BAXTORIAN_CUPBOARD_OPEN_ID:
            await searchCupboard(player);
            return true;
        case COFFIN_ID:
            await searchCoffin(player);
            return true;
        case FLOOD_DOORS_ID:
            await floodDoors(player, gameObject);
            return true;
        case CRATE_OLD_KEY_ID:
            await searchCrateForOldKey(player);
            return true;
        case CHALICE_ID:
            await chalice(player);
            return true;
        case DOORWAY_ID:
            player.message('you walk through the doorway');
            player.teleport(DOORWAY_TO.x, DOORWAY_TO.y);
            return true;
        default:
            return false;
    }
}

async function onGameObjectCommandTwo(player, gameObject) {
    const { id } = gameObject;

    // the first two trees have a second command
    if (id === 462 || id === 463) {
        await mes(player, 'the tree is too far off to jump to', 'you need someway to pull yourself across');
        return true;
    }

    if (id === BAXTORIAN_CUPBOARD_OPEN_ID) {
        closeCupboard(player, gameObject);
        return true;
    }

    if (id === CRATE_OLD_KEY_ID) {
        await searchCrateForOldKey(player);
        return true;
    }

    return false;
}

// the pebble does not work for anyone carrying arms or armour
function carriesWeapon(player) {
    return player.inventory.items.some((item) => {
        const name = itemName(item.id);

        return (
            name.includes('dagger') ||
            name.includes('scimitar') ||
            name.includes('bow') ||
            name.includes('mail') ||
            name.includes('plated') ||
            item.id === RUNE_SKIRT_ID ||
            name.includes('shield') ||
            (name.includes('sword') && !['swordfish', 'burnt swordfish', 'raw swordfish'].includes(name)) ||
            name.includes('mace') ||
            name.includes('helmet') ||
            name.includes('axe') ||
            name.includes('throwing knife') ||
            name.includes('spear')
        );
    });
}

function article(word) {
    return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

async function pebbleOnGravestone(player) {
    await mes(player, 'you place the pebble in the gravestones small indent', 'it fits perfectly');

    if (carriesWeapon(player)) {
        await mes(player, 'but nothing happens');
        return;
    }

    await mes(
        player,
        'You hear a loud creek',
        'the stone slab slides back revealing a ladder down',
        'you climb down to an underground passage'
    );
    player.teleport(PASSAGE.x, PASSAGE.y);

    if (stageOf(player) === 3) {
        setStage(player, 4);
    }
}

async function ropeOnTree(player, tree) {
    await mes(
        player,
        'you tie one end of the rope around the tree',
        'you tie the other end into a loop',
        'and throw it towards the other dead tree'
    );

    if (tree.id === 462) {
        await mes(player, 'the rope loops around the tree', 'you lower yourself into the rapidly flowing stream');
        player.teleport(662, 467);
        await mes(player, 'you manage to pull yourself over to the land mound');
    } else if (tree.id === 463) {
        await mes(player, 'the rope loops around the tree', 'you lower yourself into the rapidly flowing stream');
        player.teleport(659, 471);
        await mes(player, 'you manage to pull yourself over to the land mound');
    } else {
        await mes(player, 'you gently drop to the rock below', 'under the waterfall there is a secret passage');
        player.teleport(LEDGE.x, LEDGE.y);
    }
}

async function runeOnStand(player, stand, item) {
    const key = `waterfall_${stand.id}_${item.id}`;
    const name = RUNE_NAMES[item.id];

    if (player.cache[key] == null) {
        player.message(`you place the ${name} on the stand`);
        player.message('the rune stone crumbles into dust');
        player.cache[key] = true;
        player.inventory.remove(item.id, 1);
    } else {
        player.message(`you have already placed ${article(name)} ${name} here`);
    }
}

async function amuletOnStatue(player) {
    // the Java's `flag` is never set (see the header), so the statue always answers
    await mes(player, 'you place the amulet around the statue', 'you hear a loud rumble beneath you', 'the ground raises up before you');
    player.teleport(CHALICE_ROOM.x, CHALICE_ROOM.y);
}

async function urnOnChalice(player) {
    if (stageOf(player) === -1) {
        // lost info, but possible message
        player.message('You have already completed this quest');
        return;
    }

    player.message('@que@you carefully poor the ashes in the chalice');
    player.inventory.remove(GLARIALS_URN_ID);
    await player.world.sleepTicks(3);
    player.inventory.add(GLARIALS_URN_EMPTY_ID, 1);
    await mes(
        player,
        'as you remove the baxtorian treasure',
        'the chalice remains standing',
        'inside you find a mithril case',
        'containing 40 seeds',
        "two diamond's and two gold bars"
    );
    completeQuest(player);
}

async function onUseWithGameObject(player, gameObject, item) {
    const { id } = gameObject;

    if (id === GATE_ID && item.id === LARGE_KEY_ID) {
        if (player.inventory.has(LARGE_KEY_ID)) {
            await player.enterGate(gameObject);
        }

        return true;
    }

    if (id === GRAVESTONE_ID && item.id === GLARIALS_PEBBLE_ID) {
        await pebbleOnGravestone(player);
        return true;
    }

    if (TREE_IDS.has(id) && item.id === ROPE_ID) {
        await ropeOnTree(player, gameObject);
        return true;
    }

    if (STAND_IDS.has(id) && RUNE_IDS.has(item.id)) {
        await runeOnStand(player, gameObject, item);
        return true;
    }

    if (id === STATUE_ID && item.id === GLARIALS_AMULET_ID) {
        await amuletOnStatue(player);
        return true;
    }

    if (id === CHALICE_ID && item.id === GLARIALS_URN_ID) {
        await urnOnChalice(player);
        return true;
    }

    return false;
}

// the locked door of the dungeon: an old key opens it, anything else only knocks
async function onWallObjectCommandOne(player, wallObject) {
    if (wallObject.id !== LOCKED_DOOR_ID) {
        return false;
    }

    await mes(player, 'the door is locked', 'you need a key');
    return true;
}

async function onUseWithWallObject(player, wallObject, item) {
    if (wallObject.id !== LOCKED_DOOR_ID || item.id !== AN_OLD_KEY_ID) {
        return false;
    }

    player.message('@que@you open the door with the key');
    await player.enterDoor(wallObject);
    await mes(player, 'You go through the door');

    return true;
}

// ---------------------------------------------------------------- inventory

async function readBook(player) {
    await mes(player, 'the book is old with many pages missing', 'a few are translated from elven into common tongue');

    if (stageOf(player) === 2) {
        setStage(player, 3);
    }

    const menu = await player.ask(['the missing relics', 'the sonnet of baxtorian', 'the power of nature', 'ode to eternity'], true);
    const box = (message) => player.send({ type: 'serverMessageOnTop', message });

    if (menu === 0) {
        box(
            '@yel@The Missing Relics@whi@% %' +
                'Many artifacts of elven history were lost after the second age. % ' +
                'The greatest loss to our collection of elf history were the hidden%' +
                'treasures of Baxtorian.' +
                '% %Some believe these treasures are still unclaimed, but it is more' +
                '%commonly believed that dwarf miners recovered the treasure at' +
                '%the beginning of the third age. ' +
                "% %Another great loss was Glarial's pebble a key which allowed her" +
                '% ancestors to visit her tomb. The stone was stolen by a gnome' +
                '% family over a century ago.' +
                '% % It is believed that the gnomes ancestor Glorie still has the stone' +
                'hidden in the caves of the gnome tree village.'
        );
    } else if (menu === 1) {
        box(
            '@yel@The Sonnet of Baxtorian@whi@' +
                '% %The love between Baxtorian and Glarial was said to have lasted' +
                '%over a century. They lived a peaceful life learning and teaching ' +
                '%the laws of nature.' +
                "% %When Baxtorian's kingdom was invaded by the dark forces he left" +
                '%on a five year campaign. He returned to find his people' +
                '%slaughtered and his wife taken by the enemy.' +
                '% %After years of searching for his love he finally gave up, he' +
                '%returned to the home he made for himself and Glarial under the ' +
                '% baxtorian waterfall. Once he entered he never returned.' +
                '% % Only Glarial had the power to also enter the waterfall. Since' +
                "%Baxtorian entered no one but her can follow him in, it's as if the" +
                '%powers of nature still work to protect him.'
        );
    } else if (menu === 2) {
        player.send({
            type: 'serverMessage',
            message:
                '@yel@The Power of Nature@whi@' +
                '%Glarial and Baxtorian were masters of nature. Trees would grow,' +
                '%mountains form and rivers flood all to their command. Baxtorian' +
                '%in particular had perfected rune lore. It was said that he could' +
                '%use the stones to control the water, earth and air.'
        });
    } else if (menu === 3) {
        box(
            '@yel@Ode to Eternity@whi@' +
                '% %@yel@A Short Piece Written by Baxtorian himself@whi@' +
                '% % What care I for this mortal coil, where treasures are yet so frail,' +
                '%for it is you that is my life blood, the wine to my holy grail' +
                '% %and if I see the judgement day, when the gods fill the air with' +
                "% dust, I'll happily choke on your memory, as my kingdom turns to " +
                'rust.'
        );
    }
}

async function plantMithrilSeed(player) {
    const { world } = player;

    await mes(player, 'you open the small mithril case');

    if (world.gameObjects.getAtPoint(player.x, player.y).length > 0) {
        player.message("you can't plant a tree here");
        return;
    }

    player.inventory.remove(MITHRIL_SEED_ID);
    await mes(player, 'and drop a seed by your feet');

    const tree = new GameObject(world, { id: SEED_TREE_ID, x: player.x, y: player.y, direction: 0 });

    world.addEntity('gameObjects', tree);
    world.setTickTimeout(() => world.removeEntity('gameObjects', tree), SEED_TREE_TICKS);
    player.message('a tree magically sprouts around you');
}

async function onInventoryCommand(player, item) {
    if (item.id === BOOK_ON_BAXTORIAN_ID) {
        await readBook(player);
        return true;
    }

    if (item.id === MITHRIL_SEED_ID) {
        await plantMithrilSeed(player);
        return true;
    }

    return false;
}

module.exports = {
    onTalkToNPC,
    onGameObjectCommandOne,
    onGameObjectCommandTwo,
    onUseWithGameObject,
    onWallObjectCommandOne,
    onUseWithWallObject,
    onInventoryCommand
};
