// Ported from Open-RSC Core-Framework authentic/quests/members/BioHazard.java, with the doors from
// authentic/defaults/DoorAction.java (DOOR_MOURNER_HEADQUARTERS, DOOR_SICK_MOURNER, DOOR_GUIDOR_ROOM and GATE_COMBAT_CAMP),
// the mourners from authentic/npcs/ardougne/west/Mourner.java (the door mourner 492, the attack mourner 502 and the ill
// mourner 495), the messenger pigeons from authentic/itemactions/InvAction.java handleMessengerPigeons and the Ardougne
// wall gateway from authentic/misc/RandomObjects.java (AGPL-3.0). https://classic.runescape.wiki/w/Biohazard
// Plague City is the prerequisite (Elena's door 152 opens only after it). The east Varrock gate and its guard's search
// (stages 6-7) are game-objects/members-gates.js; the sewer pipe without a gasmask after both quests is
// quests/members/plague-city/east-ardougne.js.
//
// questStages.biohazard (the Java stages):
//   0  Elena (483, her house 605,573 behind door 152) wants the distillator the mourners took: "i'll try to retrieve it for
//      you" -> 1
//   1  Jerico (486, 580,586) tells of Omart (484) waiting at the south end of the wall (624,616) -> 2
//   2  Jerico's cupboard (500 at 581,587) holds Bird feed (800); thrown on the watch tower (494 at 622,585) it sets cache
//      bird_feed; Jerico's messenger pigeons (799, ground spawns 574,583-586) "release"d within 617-622 x 582-590 fly to the
//      tower (cache bird_feed cleared, a pigeon cage 798 left) -> 3. The Java also opens the cage at stage 3 without the feed
//   3  Omart: "ok lets do it" climbs the rope ladder over the wall to (624,606), Kilron (487, 629,613) takes you back -> 4
//   4  West Ardougne. Rotten apples (801, ground spawns 642,565 and 650,564) in the mourners' cooking pot (502 at 635,564)
//      set cache rotten_apples; the mourners' headquarters door (138 at 633,573) then opens for a player wearing the Doctors
//      gown (802, Nurse Sarah's cupboard 510 at 648,602 while the stage is 4 or 5; Sarah 500 is at 647,603). The ill mourner
//      (495, 632,1514 upstairs; door 141 at 633,1513) attacks an impostor and drops the Bronze key (803) when killed. The
//      key opens the crates' gate (504 at 631,1514); the crate (505 at 627,1514) holds the distillator (804) -> 5 (if the
//      apples were used, cache cleared)
//   5  Elena takes the distillator and gives Liquid honey (809), Ethenea (810), Sulphuric broline (811) and the Plague
//      sample (812) -> 6 (Elena replaces lost ones at 6 and 7)
//   6  the chemist (504, 344,665 Rimmington) takes the "I'm Elena's friend" route to Touch paper (813) -> 7
//   7  the errand boys: Chancy (505), Hops (506), DeVinci (507) in Rimmington each carry one vial to the Dancing Donkey inn in
//      Varrock (509, 510, 511 there). Chancy sells the honey to gamble if given the others, Hops drinks the honey and the
//      ethenea, DeVinci paints with the honey and the broline; each hands back only the vial it was meant for. The east
//      Varrock gate guard takes the three vials from anyone who carries them (members-gates.js). Guidor's wife (488, 84,534)
//      wants a priest: Priest robe 807 and Priest gown 808 worn open Guidor's door (145 at 83,534). Guidor (508, 82,534) tests
//      the sample with the vials and the touch paper (all consumed) -> 8
//   8  Elena -> 9 (go to the King of East Ardougne)
//   9  King Lathas (512, 613,602): the plague is a hoax; he gives the Magic amulet (826) -> -1: 3 quest points, thieving
//      2000 + 200 x level quarter points
//  -1  King Lathas starts Underground Pass (the quest is not ported: only its first stage key is set, and the "complete"
//      dialogue at stage 8 is said without the reward); the Ardougne wall gateway (450, 622,588 and 624,588) opens, and the
//      training camp gate (563, 660,551)
// Differences: the Java's generic cupboards (71, 56) and crates (290) are left to the neighbouring ports; the "smuggling
// gate" (60 at 94,521) has no spawn in rsc-data; the non-member dialogues are kept for a world with members off.

const GameObject = require('../../../model/game-object');

const ELENA_ID = 483;
const OMART_ID = 484;
const JERICO_ID = 486;
const KILRON_ID = 487;
const GUIDORS_WIFE_ID = 488;
const MOURNER_ENTRANCE2_ID = 491;
const MOURNER_DOOR_ID = 492;
const MOURNER_ILL_ID = 495;
const NURSE_SARAH_ID = 500;
const MOURNER_ATTACK_ID = 502;
const CHEMIST_ID = 504;
const CHANCY_ID = 505;
const HOPS_ID = 506;
const DEVINCI_ID = 507;
const GUIDOR_ID = 508;
const CHANCY_BAR_ID = 509;
const HOPS_BAR_ID = 510;
const DEVINCI_BAR_ID = 511;
const KING_LATHAS_ID = 512;
const MOURNER_BY_ENTRANCE_ID = 451;
const GUARD_TRAINING_CAMP_ID = 524;

const TALK_IDS = new Set([
    ELENA_ID,
    OMART_ID,
    JERICO_ID,
    KILRON_ID,
    GUIDORS_WIFE_ID,
    MOURNER_DOOR_ID,
    MOURNER_ILL_ID,
    NURSE_SARAH_ID,
    MOURNER_ATTACK_ID,
    CHEMIST_ID,
    CHANCY_ID,
    HOPS_ID,
    DEVINCI_ID,
    GUIDOR_ID,
    CHANCY_BAR_ID,
    HOPS_BAR_ID,
    DEVINCI_BAR_ID,
    KING_LATHAS_ID
]);

const PIGEON_CAGE_ID = 798;
const MESSENGER_PIGEONS_ID = 799;
const BIRD_FEED_ID = 800;
const BIOHAZARD_BRONZE_KEY_ID = 803;
const ROTTEN_APPLES_ID = 801;
const DOCTORS_GOWN_ID = 802;
const DISTILLATOR_ID = 804;
const PRIEST_ROBE_ID = 807;
const PRIEST_GOWN_ID = 808;
const LIQUID_HONEY_ID = 809;
const ETHENEA_ID = 810;
const SULPHURIC_BROLINE_ID = 811;
const PLAGUE_SAMPLE_ID = 812;
const TOUCH_PAPER_ID = 813;
const KING_LATHAS_AMULET_ID = 826;

const ELENAS_DOOR_ID = 152;
const DOOR_MOURNER_HEADQUARTERS_ID = 138;
const DOOR_SICK_MOURNER_ID = 141;
const DOOR_GUIDOR_ROOM_ID = 145;

const JERICOS_CUPBOARD_CLOSED_ID = 499;
const JERICOS_CUPBOARD_OPEN_ID = 500;
const WATCH_TOWER_ID = 494;
const VISUAL_ROPELADDER_ID = 498;
const COOKING_POT_ID = 502;
const NURSE_SARAHS_CUPBOARD_CLOSED_ID = 509;
const NURSE_SARAHS_CUPBOARD_OPEN_ID = 510;
const CRATES_GATE_ID = 504;
const DISTILLATOR_CRATE_ID = 505;
const ARDOUGNE_WALL_GATEWAY_ID = 450;
const GATE_COMBAT_CAMP_ID = 563;

function stageOf(player) {
    return player.questStages.biohazard || 0;
}

function setStage(player, stage) {
    player.questStages.biohazard = stage;
}

function give(player, id) {
    player.inventory.add(id, 1);
}

// Open-RSC mes(...) followed by delay(3)
async function mes(player, message) {
    player.message(`@que@${message}`);
    await player.world.sleepTicks(3);
}

// the Java's `n.startCombat(player)` / `n.setChasing(player)`: the npc goes for the player once the talk is over
function chase(player, npc) {
    if (npc && typeof npc.attack === 'function') {
        Promise.resolve(npc.attack(player)).catch(() => {});
    }
}

function nearNpc(player, id, radius) {
    // the Java's radius (Entity.getNearbyEntitiesWithinRadius; getNearbyEntitiesByID takes a box side)
    return player.getNearbyEntitiesWithinRadius('npcs', id, radius).find((npc) => !npc.locked) || null;
}

function inBounds(player, minX, minY, maxX, maxY) {
    return player.x >= minX && player.x <= maxX && player.y >= minY && player.y <= maxY;
}

// BioHazard.handleReward: 3 quest points and thieving 2000 + 200 x level (quarter points)
function completeQuest(player) {
    player.completeQuest('biohazard', {
        questPoints: 3,
        experience: { thieving: 2000 + 200 * player.skills.thieving.base },
        message: 'you have completed the biohazard quest'
    });
}

// ---------------------------------------------------------------- the rope ladder over the wall

async function ropeLadder(player, landing) {
    const { world } = player;
    const ladder = new GameObject(world, { id: VISUAL_ROPELADDER_ID, x: 622, y: 611, direction: 0 });

    world.addEntity('gameObjects', ladder);
    await mes(player, 'you climb up the rope ladder');
    player.teleport(landing.x, landing.y);
    await mes(player, 'and drop down on the other side');
    world.removeEntity('gameObjects', ladder);

}

const ROPE_IN = { x: 624, y: 606 };
const ROPE_BACK = { x: 622, y: 611 };

// ---------------------------------------------------------------- Elena (483)

async function elena(player, npc) {
    switch (stageOf(player)) {
        case 0: {
            await player.say('good to see you, elena');
            await npc.say("you too, thanks for freeing me", "it's just a shame the mourners confiscated my equipment");
            await player.say('what did they take?');
            await npc.say(
                "my distillator, I can't test any plague samples without it",
                "they're holding it in the mourner quarters in west ardounge",
                'i must somehow retrieve that distillator',
                'if i am to find a cure for this awful affliction'
            );

            const menu = await player.ask(["i'll try to retrieve it for you", 'well, good luck'], true);

            if (menu === 0) {
                await npc.say(
                    'i was hoping you would say that',
                    'unfortunately they discovered the tunnel and filled it in',
                    'we need another way over the wall'
                );
                await player.say('any ideas?');
                await npc.say(
                    "my father's friend jerico is in communication with west ardounge",
                    'he might be able to help',
                    'he lives next to the chapel'
                );
                setStage(player, 1);
            } else if (menu === 1) {
                await npc.say('thanks traveller');
            }

            break;
        }
        case 1:
            await player.say('hello elena');
            await npc.say('hello brave adventurer', 'any luck finding the distillator');
            await player.say("no i'm afraid not");
            await npc.say('speak to jerico, he will help you to cross the wall', 'he lives next to the chapel');
            break;
        case 2:
            await player.say("hello elena, i've spoken to jerico");
            await npc.say('was he able to help?');
            await player.say('he has two friends who will help me cross the wall', 'but first i need to distract the watch tower');
            await npc.say('hmmm, could be tricky');
            break;
        case 3:
            await player.say("elena i've distracted the guards at the watch tower");
            await npc.say('yes, i saw', "quickly meet with jerico's friends and cross the wall", 'before the pigeons fly off');
            break;
        case 4:
            await player.say('hello again');
            await npc.say("you're back, did you find the distillator?");
            await player.say("i'm afraid not");
            await npc.say("i can't test the samples without the distillator", "please don't give up until you find it");
            break;
        case 5:
            await npc.say('so, have you managed to retrieve my distillator?');

            if (player.inventory.has(DISTILLATOR_ID)) {
                await npc.say("You have - that's great!", 'Now can you pass me those refraction agents please?');
                await mes(player, 'You hand Elena the distillator and an assortment of vials');
                player.inventory.remove(DISTILLATOR_ID, 1);
                await player.say('These look pretty fancy');
                await npc.say(
                    "Well, yes and no. The liquid honey isn't worth so much",
                    'But the others are- especially this colourless ethenea',
                    "And be careful with the sulphuric broline- it's highly poisonous"
                );
                await player.say("You're not kidding- I can smell it from here");
                await mes(player, 'Elena puts the agents through the distillator');
                await npc.say(
                    "I don't understand...the touch paper hasn't changed colour at all",
                    "You'll need to go and see my old mentor Guidor. He lives in Varrock",
                    'Take these vials and this sample to him'
                );
                await mes(player, 'elena gives you three vials and a sample in a tin container');
                give(player, LIQUID_HONEY_ID);
                give(player, ETHENEA_ID);
                give(player, SULPHURIC_BROLINE_ID);
                give(player, PLAGUE_SAMPLE_ID);
                await npc.say(
                    "But first you'll need some more touch-paper. Go and see the chemist in Rimmington",
                    "Just don't get into any fights, and be careful who you speak to",
                    "Those vials are fragile, and plague carriers don't tend to be too popular"
                );
                setStage(player, 6);
            } else {
                await player.say("i'm afraid not");
                await npc.say("Oh, you haven't", 'People may be dying even as we speak');
            }

            break;
        case 6:
        case 7: {
            await npc.say('what are you doing back here');

            const menu = await player.ask(
                [
                    'I just find it hard to say goodbye sometimes',
                    "I'm afraid I've lost some of the stuff that you gave me...",
                    "i've forgotten what i need to do"
                ],
                false
            );

            if (menu === 0) {
                await player.say('I just find it hard to say goodbye sometimes');
                await npc.say('Yes...I have feelings for you too...', 'Now get to work!');
            } else if (menu === 1) {
                await player.say("I'm afraid I've you lost some of the stuff that you gave me"); // sic
                await npc.say("That's alright, I've got plenty");
                await mes(player, 'Elena replaces your items');

                for (const id of [LIQUID_HONEY_ID, ETHENEA_ID, SULPHURIC_BROLINE_ID, PLAGUE_SAMPLE_ID]) {
                    if (player.inventory.has(id)) {
                        player.inventory.remove(id, 1);
                    }

                    give(player, id);
                }

                await npc.say(
                    "OK so that's the colourless ethenea...",
                    'Some highly toxic sulphuric broline...',
                    'And some bog-standard liquid honey...'
                );
                await player.say("Great. I'll be on my way");
            } else if (menu === 2) {
                await player.say("i've forgotten what i need to do");
                await npc.say(
                    'go to rimmington and get some touch paper from the chemist',
                    'use his errand boys to smuggle the vials into varrock',
                    'then go to varrock and take the sample to guidor, my old mentor'
                );
                await player.say("ok, i'll get to it");
            }

            break;
        }
        case 8:
            await npc.say("You're back! So what did Guidor say?");
            await player.say('Nothing');
            await npc.say('What?');
            await player.say('He said that there is no plague');
            await npc.say('So what, this thing has all been a big hoax?');
            await player.say("Or maybe we're about to uncover something huge");
            await npc.say('Then I think this thing may be bigger than both of us');
            await player.say('What do you mean?');
            await npc.say('I mean that you need to go right to the top', 'You need to see the King of east Ardougne');
            setStage(player, 9);
            break;
        case 9:
            await player.say('hello elena');
            await npc.say('you must go to king lathas immediately');
            break;
        case -1:
            await player.say('hello elena');
            await npc.say('hey, how are you?');
            await player.say('good thanks, yourself?');
            await npc.say('not bad, let me know when you hear from king lathas again');
            await player.say('will do');
            break;
        default:
    }
}

// ---------------------------------------------------------------- Omart (484), Jerico (486), Kilron (487)

async function omart(player, npc) {
    switch (stageOf(player)) {
        case 0:
        case 1:
            await player.say('hello there');
            await npc.say('hello');
            await player.say('how are you?');
            await npc.say('fine thanks');
            break;
        case 2:
            await player.say('omart, jerico said you might be able to help me');
            await npc.say(
                'he informed me of your problem traveller',
                'i would be glad to help, i have a rope ladder',
                'and my associate, kilron, is waiting on the other side'
            );
            await player.say('good stuff');
            await npc.say(
                "unfortunately we can't risk it with the watch tower so close",
                'so first we need to distract the guards in the tower'
            );
            await player.say('how?');
            await npc.say("try asking jerico, if he's not too busy with his pigeons", "I'll be waiting here for you");
            break;
        case 3: {
            await npc.say(
                'well done, the guards are having real trouble with those birds',
                "you must go now traveller, it's your only chance"
            );
            await mes(player, 'Omart calls to his associate');
            await npc.say('Kilron!');
            await mes(player, 'he throws one end of the rope ladder over the wall');
            await npc.say('go now traveller');

            const menu = await player.ask(['ok lets do it', "I'll be back soon"], true);

            if (menu === 0) {
                await ropeLadder(player, ROPE_IN);
                setStage(player, 4);
            } else if (menu === 1) {
                await npc.say("don't take long", 'the mourners will soon be rid of those birds');
            }

            break;
        }
        case 4:
        case 5: {
            await player.say('hello omart');
            await npc.say('hello traveller', 'the guards are still distracted if you wish to cross the wall');

            const again = await player.ask(['ok lets do it', "i'll be back soon"], false);

            if (again === 0) {
                await player.say('ok lets do it');
                await ropeLadder(player, ROPE_IN);
            } else if (again === 1) {
                await player.say("I'll be back soon");
                await npc.say("don't take long", 'the mourners will soon be rid of those birds');
            }

            break;
        }
        case 6:
        case 7:
        case 8:
        case 9:
        case -1:
            await player.say('hello omart');
            await npc.say(
                'hello adventurer',
                "i'm afraid it's too risky to use the ladder again",
                "but I believe that edmond's working on another tunnel"
            );
            break;
        default:
    }
}

async function jerico(player, npc) {
    switch (stageOf(player)) {
        case 0:
            await player.say('hello');
            await npc.say('can i help you?');
            await player.say('just passing by');
            break;
        case 1:
            await player.say('hello jerico');
            await npc.say("hello, i've been expecting you", 'elena tells me you need to cross the wall');
            await player.say("that's right");
            await npc.say(
                'my messenger pigeons help me communicate with friends over the wall',
                'i have arranged for two friends to aid you with a rope ladder',
                'omart is waiting for you at the southend of the wall',
                'be careful, if the mourners catch you the punishment will be severe'
            );
            await player.say('thanks jerico');
            setStage(player, 2);
            break;
        case 2:
            await player.say('hello jerico');
            await npc.say(
                'hello again',
                "you'll need someway to distract the watch tower",
                "otherwise you'll be caught for sure"
            );
            await player.say('any ideas?');
            await npc.say('sorry, try asking omart', 'i really must get back to feeding the messenger birds');
            break;
        case 3:
            await player.say('hello there');
            await npc.say('the guards are distracted by the birds', 'you must go now', 'quickly traveller');
            break;
        case 4:
            await player.say('hello again jerico');
            await npc.say('so you\'ve returned traveller', 'did you get what you wanted');
            await player.say('not yet');
            await npc.say('omart will be waiting by the wall', 'In case you need to cross again');
            break;
        case 5:
        case 6:
        case 7:
        case 8:
        case 9:
        case -1:
            player.message('jerico is busy looking for his bird feed');
            break;
        default:
    }
}

async function kilron(player, npc) {
    const stage = stageOf(player);

    if (stage >= 0 && stage <= 3) {
        await player.say('hello there');
        await npc.say('hello');
        await player.say('how are you?');
        await npc.say('busy');
        return;
    }

    await player.say('hello kilron');
    await npc.say('hello traveller', 'do you need to go back over?');

    const menu = await player.ask(['not yet kilron', 'yes i do'], true);

    if (menu === 0) {
        await npc.say('okay, just give me the word');
    } else if (menu === 1) {
        await npc.say('okay, quickly now');
        await ropeLadder(player, ROPE_BACK);
    }
}

// ---------------------------------------------------------------- Nurse Sarah (500)

async function nurseSarah(player, npc) {
    const stage = stageOf(player);

    if (stage !== 4 && stage !== 5) {
        player.message("nurse sarah doesn't feel like talking");
        return;
    }

    if (player.cache.rotten_apples) {
        await player.say('hello nurse');
        await npc.say('oh hello there');
        await npc.say(
            "im afraid i can't stop and talk",
            'a group of mourners have became ill with food poisoning',
            'i need to go over and see what i can do'
        );
        await player.say('hmmm, strange that!');
    } else {
        await player.say('hello nurse');
        await npc.say("i don't know how much longer i can cope here");
        await player.say('what? is the plague getting to you?');
        await npc.say(
            "no, strangely enough the people here don't seem to be affected",
            "it's just the awful living conditions that are making people ill"
        );
        await player.say('i was under the impression that every one here was affected');
        await npc.say("me too, but it doesn't seem to be the case");
    }
}

// ---------------------------------------------------------------- the mourners (Mourner.java)

async function doorMourner(player, npc) {
    if (player.cache.rotten_apples) {
        await player.say('hello there');
        await npc.say('oh dear oh dear', 'i feel terrible, i think it was the stew');
        await player.say('you should be more careful with your ingredients');

        if (!player.inventory.isEquipped(DOCTORS_GOWN_ID)) {
            await npc.say(
                'i need a doctor',
                "the nurses' hut is to the south west",
                "go now and bring us a doctor, that's an order"
            );
        } else {
            await npc.say("there is one mourner who's really sick resting upstairs", 'you should see to him first');
            await player.say("ok i'll see what i can do");
        }
    } else if (stageOf(player) !== 0) {
        await player.say('hello', 'are these the mourner quarters?');
        await npc.say('yes, why?, what do you want?');
        await player.say('i need to go inside');
        await npc.say("they'll be busy feasting all day");
        await player.say('really, even with the food shortages in west ardounge');
        await npc.say("we've no food shortage, just the civilians");

        const menu = await player.ask(['can i join the feast?', 'you should be ashamed of yourself', 'well, enjoy your meal'], true);

        if (menu === 0) {
            await npc.say("don't be so obsurd");
            await player.say('but why not?');
            await npc.say("because i don't like your face");
        } else if (menu === 1) {
            await player.say('there are families here starving, you should be protecting them');
            await npc.say('that sounds like a lot of hard work', "i tell you what, i'll give it some consideration while i'm enjoying my stew");
        } else if (menu === 2) {
            await npc.say('we will, oh and if you get hungry...', '..there are some rotten apples around the corner - help yourself!');
        }
    } else {
        player.message("the mourner doesn't feel like talking");
    }
}

async function attackMourner(player, npc, out) {
    if (!player.inventory.isEquipped(DOCTORS_GOWN_ID)) {
        await npc.say('how did you get in here?', 'this is a restricted area');
        out.fight = npc;
    } else {
        await player.say('hello');
        await npc.say('hello doc, i feel terrible', 'i think it was the stew');
        await player.say('be more careful with your ingredients next time');
    }
}

async function illMourner(player, npc, out) {
    if (stageOf(player) > 4) {
        await mes(player, 'the mourner is sick');
        await mes(player, "he doesn't feel like talking");
        return;
    }

    await player.say('hello there');
    await npc.say("you're here at last", "i don't know what i've eaten", 'but i feel like i\'m on death\'s door');
    await player.say('hmm... interesting, sounds like food poisoning');
    await npc.say("yes, i'd figured that out already", 'what can you give me to help');

    const menu = await player.ask(
        [
            'just hold your breath and count to ten',
            'the best i can do is pray for you',
            "there's nothing i can do, it's fatal"
        ],
        true
    );

    if (menu === 0) {
        await npc.say('what, how will that help?', 'what kind of doctor are you?');
        await player.say('erm .. i\'m new, i just started');
        await npc.say("you're no doctor");
        out.fight = npc;
    } else if (menu === 1) {
        await npc.say('prey for me?', "you're no doctor", 'an impostor'); // sic
        out.fight = npc;
    } else if (menu === 2) {
        await npc.say("no, i'm too young to die", "i've never even had a girlfriend");
        await player.say("that's life for you");
        await npc.say("wait a minute, where's your equipment?");
        await player.say("it's..erm , at home");
        await npc.say("you're no doctor");
        out.fight = npc;
    }
}

// ---------------------------------------------------------------- the chemist (504) and his errand boys

async function chemist(player, npc) {
    const stage = stageOf(player);

    if (stage === 7) {
        await player.say('hello again');
        await npc.say('oh hello, do you need more touch paper?');

        if (!player.inventory.has(TOUCH_PAPER_ID)) {
            await player.say('yes please');
            await npc.say('ok there you go');
            player.message('the chemist gives you some touch paper');
            give(player, TOUCH_PAPER_ID);
        } else {
            await player.say('no i just wanted to say hello');
            await npc.say('oh, ok then ... hello');
            await player.say('hi');
        }

        return;
    }

    if (
        stage === 6 &&
        player.inventory.has(PLAGUE_SAMPLE_ID) &&
        player.inventory.has(LIQUID_HONEY_ID) &&
        player.inventory.has(SULPHURIC_BROLINE_ID) &&
        player.inventory.has(ETHENEA_ID)
    ) {
        await npc.say("Sorry, I'm afraid we're just closing now, you'll have to come back another time");

        const menu = await player.ask(
            ["This can't wait,I'm carrying a plague sample that desperately needs analysis", "It's OK I'm Elena's friend"],
            true
        );

        if (menu === 0) {
            await chemistTakesSample(player, npc);
        } else if (menu === 1) {
            await npc.say(
                "Oh, well that's different then. Must be pretty important to come all this way",
                "How's everyone doing there anyway? Wasn't there was some plague scare"
            );

            const last = await player.ask(
                [
                    "that's why I'm here: I need some more touch paper for this plague sample",
                    'Who knows... I just need some touch paper for a guy called Guidor'
                ],
                true
            );

            if (last === 0) {
                await chemistTakesSample(player, npc);
            } else if (last === 1) {
                await npc.say(
                    "Guidor? This one's on me then- the poor guy. Sorry about the interrogation",
                    "It's just that there's been rumours of a man travelling with a plague on him",
                    "They're even doing spot checks in Varrock: it's a pharmeceutical disaster"
                );
                await player.say('Oh right...so am I going to be OK carrying these three vials with me?');
                await npc.say(
                    "With touch paper as well? You're asking for trouble",
                    "You'd be better using my errand boys outside- give them a vial each",
                    "They're not the most reliable people in the world",
                    "One's a painter, one's a gambler, and one's a drunk",
                    "Still, if you pay peanuts you'll get monkeys, right?",
                    "And it's better than entering Varrock with half a laborotory in your napsack"
                );
                await player.say('OK- thanks for your help, I know that Elena appreciates it');
                await npc.say(
                    "Yes well don't stand around here gassing",
                    "You'd better hurry if you want to see Guidor",
                    "He won't be around for much longer"
                );
                player.message('He gives you the touch paper');
                give(player, TOUCH_PAPER_ID);
                setStage(player, 7);
            }
        }

        return;
    }

    player.message('The chemist is busy at the moment');
}

async function chemistTakesSample(player, npc) {
    await npc.say(
        'You idiot! A plague sample should be confined to a lab',
        "I'm taking it off you- I'm afraid it's the only responsible thing to do"
    );
    player.message('He takes the plague sample from you');
    player.inventory.remove(PLAGUE_SAMPLE_ID, 1);
}

const VIAL_LINES = {
    [ETHENEA_ID]: ['You give him the vial of ethenea', 'You have no ethenea to give'],
    [LIQUID_HONEY_ID]: ['You give him the vial of liquid honey', 'You have no liquid honey to give'],
    [SULPHURIC_BROLINE_ID]: ['You give him the vial of sulphuric broline', 'You have no sulphuric broline to give']
};

const VIAL_MENU = [
    'You give him the vial of ethenea',
    'You give him the vial of liquid honey',
    'You give him the vial of sulphuric broline'
];
const VIAL_IDS = [ETHENEA_ID, LIQUID_HONEY_ID, SULPHURIC_BROLINE_ID];

// one errand boy takes a vial: `flags` names the cache flag a vial leaves in his pocket (right: the vial he was meant to
// carry, wrong: the others), `lines` how the Java tells it (its own mes / message wording per boy)
async function giveVial(player, npc, boy) {
    const menu = await player.ask(VIAL_MENU, false);
    const id = VIAL_IDS[menu];
    const flag = boy.flagFor(id);

    if (!player.inventory.has(id)) {
        player.message(boy.missing(id));
        return;
    }

    if (player.cache[flag]) {
        return;
    }

    player.cache[flag] = true;
    player.inventory.remove(id, 1);
    await boy.gave(player, npc, id);
}

const HOPS_BOY = {
    flagFor: (id) => (id === SULPHURIC_BROLINE_ID ? 'vial_hops' : 'wrong_vial_hops'),
    missing: (id) => VIAL_LINES[id][1],
    async gave(player, npc, id) {
        player.message(VIAL_LINES[id][0]);
        await player.say("OK. I'll see you in Varrock");
        await npc.say("Sure. I'm a regular at the The dancing donkey inn as it happens");
    }
};

const CHANCY_BOY = {
    flagFor: (id) => (id === LIQUID_HONEY_ID ? 'vial_chancy' : 'wrong_vial_chancy'),
    missing: () => "You can't give him what you don't have",
    async gave(player, npc, id) {
        await mes(player, VIAL_LINES[id][0]);
        await player.say(
            id === SULPHURIC_BROLINE_ID
                ? "Right.I'll see you later in the dancing donkey inn"
                : "Right. I'll see you later in the dancing donkey inn"
        );
        await npc.say('Be lucky');
    }
};

const DEVINCI_BOY = {
    flagFor: (id) => (id === ETHENEA_ID ? 'vial_vinci' : 'wrong_vial_vinci'),
    missing: () => "You can't give him what you don't have",
    async gave(player, npc, id) {
        await mes(player, VIAL_LINES[id][0]);
        await npc.say('OK. We\'re meeting at the dancing donkey in Varrock right?');
        await player.say("That's right.");
    }
};

async function hops(player, npc) {
    if (stageOf(player) !== 7) {
        player.message('He is not in a fit state to talk');
        return;
    }

    if (player.cache.vial_hops || player.cache.wrong_vial_hops) {
        await npc.say("I suppose I'd better get going", "I'll meet you at the The dancing donkey inn");
        return;
    }

    await player.say("Hi,I've got something for you to take to Varrock");
    await npc.say('Sounds like pretty thirsty work');
    await player.say("Well, there's a pub in Varrock if you're desperate");
    await npc.say("Don't worry, I'm a pretty resourceful fellow you know");
    await giveVial(player, npc, HOPS_BOY);
}

async function chancy(player, npc) {
    if (stageOf(player) !== 7) {
        player.message("Chancy doesn't feel like talking");
        return;
    }

    if (player.cache.vial_chancy || player.cache.wrong_vial_chancy) {
        await npc.say("look, I've got your vial, but I'm not taking two", 'I always like to play the percentages');
        return;
    }

    await player.say("Hello, I've got a vial for you to take to Varrock");
    await npc.say('Tssch... that chemist asks a lot for the wages he pays');
    await player.say('Maybe you should ask him for more money');
    await npc.say('Nah...I just use my initiative here and there');
    await giveVial(player, npc, CHANCY_BOY);
}

async function devinci(player, npc) {
    if (stageOf(player) !== 7) {
        player.message('Devinci does not feel sufficiently moved to talk');
        return;
    }

    if (player.cache.vial_vinci || player.cache.wrong_vial_vinci) {
        await npc.say("Oh, it's you again", "Please don't distract me now, I'm contemplating the sublime");
        return;
    }

    await player.say('Hello.i hear you\'re an errand boy for the chemist');
    await npc.say(
        "Well that's my day job yes",
        "But I don't necessarily define my identity in such black and white terms"
    );
    await player.say('Good for you', 'Now can you take a vial to Varrock for me?');
    await npc.say('Go on then');
    await giveVial(player, npc, DEVINCI_BOY);
}

// the three in the Dancing Donkey inn, Varrock

async function hopsBar(player, npc) {
    if (stageOf(player) !== 7) {
        player.message("Hops doesn't feel like talking");
        return;
    }

    if (player.cache.wrong_vial_hops) {
        await player.say('Hello. How was your journey?');
        await npc.say('Pretty thirst-inducing actually...');
        await player.say("Please tell me that you haven't drunk the contents");
        await npc.say(
            "Of course I can tell you that I haven't drunk the contents",
            "But I'd be lying",
            'Sorry about that me old mucker- can I get you a drink?'
        );
        await player.say("No, I think you've done enough for now");
        delete player.cache.wrong_vial_hops;
    } else if (player.cache.vial_hops) {
        await player.say('Hello. How was your journey?');
        await npc.say('Pretty thirst-inducing actually...');
        await player.say("Please tell me that you haven't drunk the contents");
        await npc.say('Oh the gods no! What do you take me for?', 'Besides, the smell kind of put me off ', "Here's your vial anyway");
        player.message('He gives you the vial of sulphuric broline');
        give(player, SULPHURIC_BROLINE_ID);
        await player.say("Thanks. I'll leave you to your drink now");
        delete player.cache.vial_hops;
    }
}

async function devinciBar(player, npc) {
    if (stageOf(player) !== 7) {
        player.message("devinci doesn't feel like talking");
        return;
    }

    if (player.cache.wrong_vial_vinci) {
        await npc.say('Hello again', 'I hope your journey was as pleasant as mine');
        await player.say("Yep. Anyway, I'll take the package off you now");
        await npc.say("Package? That's a funny way to describe a liquid of such exquisite beauty");

        const menu = await player.ask(["I'm getting a bad feeling about this", 'Just give me the stuff now please'], true);

        await player.say("You do still have it don't you?");
        await npc.say("Absolutely", "Its' just not stored in a vial anymore");
        await player.say('What?');
        await npc.say(
            'Instead it has been liberated',
            'And it now gleams from the canvas of my latest epic:',
            'The Majesty of Varrock'
        );

        if (menu === 0) {
            await player.say("That's great", "Thanks to you I'll have to walk back to East Ardougne to get another vial");
        } else {
            await player.say("That's great", "Now I'll have to walk all the way back to East Ardougne to get another vial");
        }

        await npc.say("Well you can't put a price on art");
        delete player.cache.wrong_vial_vinci;
    } else if (player.cache.vial_vinci) {
        await npc.say('Hello again', 'I hope your journey was as pleasant as mine');
        await player.say("Well, it's always sunny in Runescape, as they say");
        await npc.say('OK. Here it is');
        await mes(player, 'He gives you the vial of ethenea');
        give(player, ETHENEA_ID);
        await player.say("Thanks. You've been a big help");
        delete player.cache.vial_vinci;
    }
}

async function chancyBar(player, npc) {
    if (stageOf(player) !== 7) {
        player.message("chancy doesn't feel like talking");
        return;
    }

    if (player.cache.wrong_vial_chancy) {
        await player.say('Hi.Thanks for doing that');
        await npc.say("No problem. I've got some money for you actually");
        await player.say('What do you mean?');
        await npc.say("Well it turns out that that potion you gave me was quite valuable...");
        await player.say('What?');
        await npc.say(
            "And I know that I probably shouldn't have sold it...",
            'But some friends and I were having a little wager- the odds were just too good'
        );
        await player.say('You sold my vial and gambled with the money?');
        await npc.say('Actually, yes... but praise be to Saradomin, because I won!', "So all's well that ends well right?");

        const menu = await player.ask(
            ['No. Nothing could be further from the truth', 'You have no idea of what you have just done'],
            true
        );

        if (menu === 0) {
            await npc.say("Well there's no pleasing some people");
        } else if (menu === 1) {
            await npc.say('Ignorance is bliss I\'m afraid');
        }

        delete player.cache.wrong_vial_chancy;
    } else if (player.cache.vial_chancy) {
        await player.say('Hi.Thanks for doing that');
        await npc.say('No problem');
        player.message('He gives you the vial of liquid honey');
        give(player, LIQUID_HONEY_ID);
        await npc.say('Next time give me something more valuable', "I couldn't get anything for this on the blackmarket");
        await player.say('That was the idea');
        delete player.cache.vial_chancy;
    }
}

// ---------------------------------------------------------------- Guidor (508) and his wife (488), Varrock

async function guidorsWife(player, npc) {
    const stage = stageOf(player);

    if (stage === 9 || stage === -1) {
        await player.say('hello');
        await npc.say("oh hello, i can't chat now", 'i have to keep an eye on my husband', "he's very ill");
        await player.say("i'm sorry to hear that");
        return;
    }

    if (stage === 8) {
        await player.say('hello again');
        await npc.say('hello there', 'i fear guidor may not be long for this world');
        return;
    }

    if (stage !== 7) {
        return;
    }

    if (player.inventory.isEquipped(PRIEST_ROBE_ID) && player.inventory.isEquipped(PRIEST_GOWN_ID)) {
        await npc.say(
            "Father, thank heavens you're here. My husband is very ill",
            'Perhaps you could go and perform his final ceremony'
        );
        await player.say("I'll see what I can do");
    } else {
        await player.say("Hello, I'm a friend of Elena, here to see Guidor");
        await npc.say(
            "I'm afraid...(she sobs)... that Guidor is not long for this world",
            "So I'm not letting people see him now"
        );
        await player.say("I'm really sorry to hear about Guidor...", 'but I do have some very important business to attend to');
        await npc.say(
            'You heartless rogue. What could be more important than Guidor\'s life?',
            '...A life spent well, if not always wisely...',
            'I just hope that Saradomin shows mercy on his soul'
        );
        await player.say('Guidor is a religious man?');
        await npc.say('Oh god no. But I am', 'if only i could get him to see a priest');
    }
}

async function guidorThatsWhy(player, npc) {
    await npc.say(
        "Well that's just it. Nothing has happened",
        "I don't know what this sample is, but it certainly isn't toxic"
    );
    await player.say('So what about the plague?');
    await npc.say(
        "Don't you understand, there is no plague!",
        "I'm very sorry, I can see that you've worked hard for this...",
        '...but it seems that someone has been lying to you',
        'The only question is...',
        '...why?'
    );
}

async function guidor(player, npc) {
    const stage = stageOf(player);

    if (stage === 8 || stage === 9 || stage === -1) {
        await player.say('hello again guidor');
        await npc.say('well hello traveller', "i still can't understand why they would lie about the plague");
        await player.say("it's strange, anyway how are you doing?");
        await npc.say("i'm hanging in there");
        await player.say('good for you');
        return;
    }

    await player.say('Hello,you must be Guidor. I understand that you are unwell');
    await npc.say(
        'Is my wife asking priests to visit me now?',
        "I'm a man of science, for god's sake!",
        'Ever since she heard rumours of a plague carrier travelling from Ardougne',
        "she's kept me under house arrest",
        'Of course she means well, and I am quite frail now...',
        'So what brings you here?'
    );

    const menu = await player.ask(
        [
            "I've come to ask your assistance in stopping a plague that could kill thousands",
            'Oh,nothing,I was just going to bless your room and I\'ve done that now  Goodbye'
        ],
        false
    );

    if (menu === 1) {
        await player.say("Oh, nothing, I was just going to bless your room, and I've done that now. Goodbye");
        return;
    }

    await player.say(
        "Well it's funny you should ask actually...",
        "I've come to ask your assistance in stopping a plague that could kill thousands"
    );
    await npc.say("So you're the plague carrier!");
    await player.ask(
        [
            'No! Well, yes... but not exactly. It\'s contained in a sealed unit from elena',
            "I've been sent by your old pupil Elena, she's trying to halt the virus"
        ],
        true
    );
    await npc.say('Elena eh?');
    await player.say('Yes. She wants you to analyse it', 'You might be the only one that can help');
    await npc.say("Right then. Sounds like we'd better get to work!");

    if (!player.inventory.has(PLAGUE_SAMPLE_ID)) {
        await npc.say(
            "Seems like you don't actually HAVE the plague sample",
            "It's a long way to come empty-handed...",
            'And quite a long way back too'
        );
        return;
    }

    await player.say('I have the plague sample');
    await npc.say("Now I'll be needing some liquid honey,some sulphuric broline,and then...");
    await player.say('...some ethenea?');
    await npc.say('Indeed!');

    if (
        !player.inventory.has(ETHENEA_ID) ||
        !player.inventory.has(SULPHURIC_BROLINE_ID) ||
        !player.inventory.has(LIQUID_HONEY_ID)
    ) {
        await npc.say('Look,I need all three reagents to test the plague sample', "Come back when you've got them");
        return;
    }

    if (!player.inventory.has(TOUCH_PAPER_ID)) {
        await npc.say("Oh. You don't have any touch-paper", "And so I won't be able to help you after all");
        return;
    }

    player.message('You give him the vials and the touch paper');

    for (const id of [TOUCH_PAPER_ID, PLAGUE_SAMPLE_ID, ETHENEA_ID, LIQUID_HONEY_ID, SULPHURIC_BROLINE_ID]) {
        player.inventory.remove(id, 1);
    }

    await npc.say("Now I'll just apply these to the sample and...", "I don't get it...the touch paper has remained the same");
    setStage(player, 8);

    const last = await player.ask(
        ["That's why Elena wanted you to do it- because she wasn't sure what was happening", 'So what does that mean exactly?'],
        true
    );

    if (last === 0) {
        await guidorThatsWhy(player, npc);
    } else if (last === 1) {
        await player.say(
            "That's why Elena wanted you to do it- because she wasn't sure what was happening"
        );
        await guidorThatsWhy(player, npc);
    }
}

// ---------------------------------------------------------------- King Lathas (512)

async function kingLathas(player, npc) {
    const stage = stageOf(player);

    if (stage === -1) {
        const underground = player.questStages.undergroundPass || 0;

        if (underground >= 0 && underground <= 2) {
            await player.say('hello king lathas');
            await npc.say('adventurer, thank saradomin for your arrival');
            await player.say('have your scouts found a way though the mountains');
            await npc.say(
                'Not quite, we found a path to where we expected..',
                "..to find the 'well of voyage' an ancient portal to west runescape",
                "however over the past era's a cluster of cultists",
                'have settled there, run by a madman named iban'
            );
            await player.say('iban?');
            await npc.say(
                'a crazy loon who claims to be the son of zamorok',
                'go meet my main tracker koftik, he will help you',
                'he waits for you at the west side of west ardounge',
                'we must find a way through these caverns..',
                'if we are to stop my brother tyras'
            );
            await player.say("i'll do my best lathas");
            await npc.say(
                'a warning traveller the ungerground pass..', // sic
                'is lethal, we lost many men exploring those caverns',
                "go preparred with food and armour or you won't last long"
            );

            if (underground === 0) {
                player.questStages.undergroundPass = 1;
            }
        } else if (underground >= 3 && underground <= 7) {
            await player.say('hello king lanthas'); // sic
            await npc.say('traveller, how are you managing down there?');
            await player.say("it's a pretty nasty place but i'm ok");
            await npc.say('well keep up the good work');
        } else if (underground === 8) {
            await npc.say('the traveller returns..any news?');
            await player.say('indeed, the quest is complete lathas', 'i have defeated iban and his undead minions');
            await npc.say(
                'incrediable, you are a truly awesome warrior',
                'now we can begin to restore the well of voyage',
                'once our mages have re-summoned the well',
                'i will send a band of troops led by yourself',
                'to head into west runescape and stop tryas'
            );
            await player.say('i will be ready and waiting');
            await npc.say('your loyalty is appreiciated traveller');
            // the Java completes Underground Pass here: that quest is not ported
        } else if (underground === -1) {
            await player.say('hello king lathas');
            await npc.say(
                'well hello there traveller',
                'the mages are still ressurecting the well of voyage',
                "but i'll have word sent to you as soon as its ready"
            );
            await player.say('ok then, take care');
            await npc.say('you too');
        }

        return;
    }

    if (stage !== 9) {
        player.message('the king is too busy to talk');
        return;
    }

    await player.say('I assume that you are the King of east Ardougne?');
    await npc.say('You assume correctly- but where do you get such impertinence?');
    await player.say('I get it from finding out that the plague is a hoax');
    await npc.say("A hoax, I've never heard such a ridiculous thing...");
    await player.say('I have evidence- from Guidor in Varrock');
    await npc.say('Ah... I see. Well then you are right about the plague', 'But I did it for the good of my people');
    await player.say('When is it ever good to lie to people like that?');
    await npc.say('When it protects them from a far greater danger- a fear too big to fathom');

    const menu = await player.ask(["I don't understand...", "Well I've wasted enough of my time here"], true);

    if (menu === 0) {
        await npc.say(
            'Their King, tyras, journeyed out to the West, on a voyage of discovery',
            'But he was captured by the Dark Lord',
            'The Dark Lord agreed to spare his life, but only on one condition...',
            'That he would drink from the chalice of eternity'
        );
        await player.say('So what happened?');
        await npc.say(
            'The chalice corrupted him. He joined forces with the Dark Lord...',
            '...The embodiment of pure evil, banished all those years ago...',
            'And so I erected this wall, not just to protect my people',
            'But to protect all the people of Runescape',
            'Because now, with the King of West Ardougne...',
            '...The dark lord has an ally on the inside',
            "So I'm sorry that I lied about the plague",
            'I just hope that you can understand my reasons'
        );
        await player.say('Well at least I know now. But what can we do about it?');
        await npc.say(
            'Nothing at the moment',
            "I'm waiting for my scouts to come back",
            'They will tell us how we can get through the mountains',
            'When this happens, can I count on your support?'
        );
        await player.say('Absolutely');
        await npc.say(
            'Thank the gods. Let me give you this amulet',
            'Think of it as a thank you, for all that you have done',
            '...but know that one day it may turn red',
            '...Be ready for this moment',
            "And to help, I give you permission to use my training area",
            "It's located just to the north west of ardounge",
            'There you can prepare for the challenge ahead'
        );
        await player.say("OK. There's just one thing I don't understand");
        await player.say('How do you know so much about King Tyras');
        await npc.say('How could I not do?', 'He was my brother');
        player.message('king lathas gives you a magic amulet');
        give(player, KING_LATHAS_AMULET_ID);
        completeQuest(player);
    } else if (menu === 1) {
        await npc.say('No time is ever wasted- thanks for all you\'ve done');
    }
}

// BioHazard.freePlayerDialogue: the same npcs in a world without members
async function freePlayerDialogue(player, npc) {
    switch (npc.id) {
        case CHEMIST_ID:
            await npc.say(
                "It's very nice that you've come",
                'all the way down here',
                "but I really don't have time to talk at the moment",
                "Maybe if you come back later I'll be able to help"
            );
            break;
        case DEVINCI_ID:
        case DEVINCI_BAR_ID:
            await npc.say(
                'Bah!',
                'A great artist such as myself should not have to',
                'suffer the HUMILIATION of spending time where the',
                'likes of you wander everywhere!'
            );
            break;
        case HOPS_ID:
        case HOPS_BAR_ID:
            await npc.say("Hops don't wanna talk now");
            break;
        case CHANCY_ID:
        case CHANCY_BAR_ID:
            await player.say('Hello!', 'Playing solitaire?');
            await npc.say(
                'Hush',
                "I'm trying to perfect the art of",
                'dealing off the bottom of the deck',
                'Whatever you want',
                "come back later and I'll speak to you then"
            );
            break;
        case GUIDORS_WIFE_ID:
            await npc.say('Oh dear! Oh dear!', "I don't have time to chat!");
            break;
        default:
    }
}

const TALKS = {
    [ELENA_ID]: elena,
    [OMART_ID]: omart,
    [JERICO_ID]: jerico,
    [KILRON_ID]: kilron,
    [NURSE_SARAH_ID]: nurseSarah,
    [HOPS_BAR_ID]: hopsBar,
    [DEVINCI_BAR_ID]: devinciBar,
    [CHANCY_BAR_ID]: chancyBar,
    [HOPS_ID]: hops,
    [CHANCY_ID]: chancy,
    [CHEMIST_ID]: chemist,
    [DEVINCI_ID]: devinci,
    [KING_LATHAS_ID]: kingLathas,
    [GUIDORS_WIFE_ID]: guidorsWife,
    [GUIDOR_ID]: guidor,
    [MOURNER_DOOR_ID]: doorMourner,
    [MOURNER_ATTACK_ID]: attackMourner,
    [MOURNER_ILL_ID]: illMourner
};

async function onTalkToNPC(player, npc) {
    if (!TALK_IDS.has(npc.id)) {
        return false;
    }

    player.engage(npc);

    const out = { fight: null };

    try {
        if (!player.world.members) {
            await freePlayerDialogue(player, npc);
        } else {
            await TALKS[npc.id](player, npc, out);
        }
    } finally {
        if (player.interlocutor) {
            player.disengage();
        }
    }

    chase(player, out.fight);

    return true;
}

// the ill mourner is searched when he falls: the Bronze key (the Java removes him instead of letting him die)
async function onNPCDeath(player, npc) {
    if (npc.id !== MOURNER_ILL_ID || !player || !player.questStages) {
        return false;
    }

    const { world } = player;

    if (!player.inventory.has(BIOHAZARD_BRONZE_KEY_ID)) {
        await mes(player, 'you search the mourner');
        give(player, BIOHAZARD_BRONZE_KEY_ID);
        await mes(player, 'and find a key');
    }

    npc.abandonFight();
    world.removeEntity('npcs', npc);

    return true;
}

// ---------------------------------------------------------------- doors

async function onWallObjectCommandOne(player, wallObject) {
    const { id } = wallObject;

    if (id === ELENAS_DOOR_ID) {
        if (player.questStages.plagueCity === -1) {
            player.message('You go through the door');
            await player.enterDoor(wallObject);
        } else {
            player.message('the door is locked');
        }

        return true;
    }

    if (id === DOOR_MOURNER_HEADQUARTERS_ID) {
        await mournerHeadquarters(player, wallObject);
        return true;
    }

    if (id === DOOR_SICK_MOURNER_ID) {
        if (player.y >= 1513) {
            player.message('@que@You go through the door');
            await player.enterDoor(wallObject);
            return true;
        }

        if (player.inventory.isEquipped(DOCTORS_GOWN_ID)) {
            player.message('@que@You go through the door');
            await player.enterDoor(wallObject);
        } else {
            player.message('the mourner is refusing to open the door');
        }

        return true;
    }

    if (id === DOOR_GUIDOR_ROOM_ID) {
        const stage = stageOf(player);

        if (stage === 7 || stage === 8 || stage === 9 || stage === -1) {
            if (player.x <= 82) {
                player.message('@que@You go through the door');
                await player.enterDoor(wallObject);
                return true;
            }

            if (player.inventory.isEquipped(PRIEST_ROBE_ID) && player.inventory.isEquipped(PRIEST_GOWN_ID)) {
                player.message('guidors wife allows you to go in');
                player.message('@que@You go through the door');
                await player.enterDoor(wallObject);
            } else {
                player.message('guildors wife refuses to let you enter'); // sic
            }
        } else {
            player.message('the door is locked');
        }

        return true;
    }

    return false;
}

async function mournerHeadquarters(player, wallObject) {
    const stage = stageOf(player);
    const feast = player.cache.rotten_apples;

    if (!feast && stage === 4) {
        await mes(player, 'the door is locked');
        await mes(player, 'inside you can hear the mourners eating');
        await mes(player, 'you need to distract them from their stew');
    } else if (feast || stage === 5) {
        if (player.y <= 572) {
            await player.enterDoor(wallObject);
            player.message('@que@you open the door');
            player.message('@que@You go through the door');
            return;
        }

        const mourner = nearNpc(player, MOURNER_DOOR_ID, 10);

        if (!mourner) {
            return;
        }

        player.engage(mourner);

        if (player.inventory.isEquipped(DOCTORS_GOWN_ID)) {
            await mourner.say('in you go doc');
            player.disengage();
            await player.enterDoor(wallObject);
            player.message('@que@You go through the door');
        } else {
            await mourner.say('keep away from there');
            await player.say('why?');
            await mourner.say('several mourners are ill with food poisoning', "we're waiting for a doctor");
            player.disengage();
        }
    } else if ((stage > 5 || stage === -1) && player.inventory.isEquipped(DOCTORS_GOWN_ID)) {
        await player.enterDoor(wallObject);
    } else {
        player.message('the door is locked');
    }
}

// ---------------------------------------------------------------- objects

// the first option of a shut cupboard opens it, of an open one searches it (the second closes it)
async function cupboard(player, gameObject, openId, search) {
    if (gameObject.id !== openId) {
        player.world.replaceEntity('gameObjects', gameObject, openId);
        player.message('You open the cupboard');
        return;
    }

    await search();
}

async function searchJericosCupboard(player) {
    player.message('you search the cupboard');

    if (!player.inventory.has(BIRD_FEED_ID)) {
        player.message('and find some pigeon feed');
        give(player, BIRD_FEED_ID);
    } else {
        player.message('but find nothing of interest');
    }
}

async function searchNursesCupboard(player) {
    player.message('you search the cupboard');

    const stage = stageOf(player);

    if (!player.inventory.has(DOCTORS_GOWN_ID) && (stage === 4 || stage === 5)) {
        player.message("inside you find a doctor's gown");
        give(player, DOCTORS_GOWN_ID);
    } else {
        player.message('but find nothing of interest');
    }
}

async function searchCrate(player) {
    await mes(player, 'you search the crate');

    if (!player.inventory.has(DISTILLATOR_ID)) {
        await mes(player, "and find elena's distillator");
        give(player, DISTILLATOR_ID);

        if (player.cache.rotten_apples) {
            delete player.cache.rotten_apples;
            setStage(player, 5);
        }
    } else {
        await mes(player, "it's empty");
    }
}

async function cratesGate(player, gameObject) {
    if (player.x <= 630) {
        await player.enterGate(gameObject);
        player.message('you open the gate and pass through');
    } else {
        await mes(player, 'the gate is locked');
        player.message('you need a key');
    }
}

async function ardougneWallGateway(player) {
    await mes(player, 'you pull on the large wooden doors');

    if (stageOf(player) !== -1) {
        player.message('but it will not open');
        return;
    }

    player.message('you open it and walk through');

    const mourner = nearNpc(player, MOURNER_BY_ENTRANCE_ID, 15);

    if (mourner) {
        player.engage(mourner);
        await mourner.say('go through');
        player.disengage();
    }

    if (player.x >= 624) {
        player.teleport(620, 589);
    } else {
        player.teleport(626, 588);
    }
}

async function combatCampGate(player, gameObject) {
    const guard = nearNpc(player, GUARD_TRAINING_CAMP_ID, 10);

    if (stageOf(player) === -1) {
        if (player.y > 551 && guard) {
            player.engage(guard);
            await guard.say(
                'the king has granted you access to this training area',
                'make good use of it, soon all you strength will be needed'
            );
            player.disengage();
        }

        await player.enterGate(gameObject);
        player.message('you open the gate');
    } else if (guard) {
        player.engage(guard);
        await guard.say('this is a restricted area', 'you can only enter under the authority of king lathas');
        player.disengage();
    }
}

async function onGameObjectCommandOne(player, gameObject) {
    switch (gameObject.id) {
        case JERICOS_CUPBOARD_OPEN_ID:
        case JERICOS_CUPBOARD_CLOSED_ID:
            await cupboard(player, gameObject, JERICOS_CUPBOARD_OPEN_ID, () =>
                searchJericosCupboard(player)
            );
            return true;
        case NURSE_SARAHS_CUPBOARD_OPEN_ID:
        case NURSE_SARAHS_CUPBOARD_CLOSED_ID:
            await cupboard(player, gameObject, NURSE_SARAHS_CUPBOARD_OPEN_ID, () =>
                searchNursesCupboard(player)
            );
            return true;
        case WATCH_TOWER_ID: {
            const mourner = nearNpc(player, MOURNER_ENTRANCE2_ID, 15);

            if (mourner) {
                player.engage(mourner);
                await mourner.say('keep away civilian');
                await player.say("what's it to you?");
                await mourner.say("the tower's here for your protection");
                player.disengage();
            }

            return true;
        }
        case CRATES_GATE_ID:
            await cratesGate(player, gameObject);
            return true;
        case DISTILLATOR_CRATE_ID:
            await searchCrate(player);
            return true;
        case ARDOUGNE_WALL_GATEWAY_ID:
            await ardougneWallGateway(player);
            return true;
        case GATE_COMBAT_CAMP_ID:
            await combatCampGate(player, gameObject);
            return true;
        default:
            return false;
    }
}

// the second option of an open cupboard is "close"; the crate's is "Search"
async function onGameObjectCommandTwo(player, gameObject) {
    const { world } = player;

    switch (gameObject.id) {
        case JERICOS_CUPBOARD_OPEN_ID:
            world.replaceEntity('gameObjects', gameObject, JERICOS_CUPBOARD_CLOSED_ID);
            player.message('You close the cupboard');
            return true;
        case NURSE_SARAHS_CUPBOARD_OPEN_ID:
            world.replaceEntity('gameObjects', gameObject, NURSE_SARAHS_CUPBOARD_CLOSED_ID);
            player.message('You close the cupboard');
            return true;
        case DISTILLATOR_CRATE_ID:
            await searchCrate(player);
            return true;
        default:
            return false;
    }
}

async function onUseWithGameObject(player, gameObject, item) {
    if (item.id === BIRD_FEED_ID && gameObject.id === WATCH_TOWER_ID) {
        if (stageOf(player) === 2) {
            await mes(player, 'you throw a hand full of seeds onto the watch tower');
            await mes(player, 'the mourners do not seem to notice');
            player.inventory.remove(BIRD_FEED_ID, 1);

            if (!player.cache.bird_feed) {
                player.cache.bird_feed = true;
            }
        } else {
            player.message('nothing interesting happens');
        }

        return true;
    }

    if (item.id === ROTTEN_APPLES_ID && gameObject.id === COOKING_POT_ID) {
        const stage = stageOf(player);

        await mes(player, 'you place the rotten apples in the pot');

        if (stage === 4 || stage === 5) {
            await mes(player, 'they quickly dissolve into the stew');
            await mes(player, "that wasn't very nice");

            if (!player.cache.rotten_apples) {
                player.cache.rotten_apples = true;
            }
        } else {
            await mes(player, "that wasn't very nice");
        }

        player.inventory.remove(ROTTEN_APPLES_ID, 1);

        return true;
    }

    if (item.id === BIOHAZARD_BRONZE_KEY_ID && gameObject.id === CRATES_GATE_ID) {
        await mes(player, 'the key fits the gate');
        player.message('you open it and pass through');
        await player.enterGate(gameObject);

        return true;
    }

    return false;
}

// InvAction.handleMessengerPigeons: "release" on the pigeons (799)
async function onInventoryCommand(player, item) {
    if (item.id !== MESSENGER_PIGEONS_ID) {
        return false;
    }

    player.message('you open the cage');

    if ((player.cache.bird_feed || stageOf(player) === 3) && inBounds(player, 617, 582, 622, 590)) {
        await mes(player, 'the pigeons fly towards the watch tower');
        await mes(player, 'they begin pecking at the bird feed');
        await mes(player, 'the mourners are frantically trying to scare the pigeons away');

        if (stageOf(player) === 2) {
            setStage(player, 3);
        }

        delete player.cache.bird_feed;
        player.inventory.remove(MESSENGER_PIGEONS_ID, 1);
        give(player, PIGEON_CAGE_ID);
    } else {
        player.message("the pigeons don't want to leave");
    }

    return true;
}

module.exports = {
    onTalkToNPC,
    onNPCDeath,
    onWallObjectCommandOne,
    onGameObjectCommandOne,
    onGameObjectCommandTwo,
    onUseWithGameObject,
    onInventoryCommand
};
