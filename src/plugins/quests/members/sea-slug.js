// Ported from Open-RSC Core-Framework authentic/quests/members/SeaSlug.java (AGPL-3.0), with the Dry sticks' "rub
// together" from authentic/itemactions/InvAction.java handleDrySticks
// https://classic.runescape.wiki/w/Sea_Slug
//
// questStages.seaSlug (the Java stages):
//   0  Caroline (455) at Witchaven (521,619) asks after her husband Kent and son Kennith -> 1
//   1  Holgart (456) by his row boat (516,612) needs swamp paste to patch it -> 2
//   2  handing Holgart a Swamp paste (785; swamp tar 783 + pot of flour 136 in items/item-on-item.js, warmed on a fire
//      or range in skills/cooking/cooking.js) -> 3; the boat lands on the fishing platform at (495,618)
//   3  Kennith (461), hiding upstairs on the platform (484,1560; Ladder 458 at (494,618)) -> 4
//   4  Holgart on the platform (457) rows to Kent's island (512,639); Kent (459) pulls a sea slug off your neck -> 5
//   5  Bailey (460) gives an unlit Torch (773); Damp sticks (776) dried with Broken glass (778) (item-on-item.js) are
//      rubbed together (firemaking 30) to light it (774) and store cache lit_torch; the platform ladder needs the lit
//      torch at stages 5-6. Kicking the loose panel (wall 124 at (487,1558)) stores loose_panel; operating the Fishing
//      crane (453 at (493,1558)) lowers Kennith to the boat -> 6 (both cache flags cleared)
//   6  Caroline gives 1 quest point, fishing experience and oyster pearls (779) -> -1
// Damp sticks lie on the platform at (482,615) and (488,609), Broken glass at (485,614) (rsc-data ground spawns).
// Every boat crossing from the shore puts a lit torch out. The Java's Point.inArdougne box (500-600, 537-708) also
// holds Kent's island, so there Holgart answers with his shore lines and rows to the platform; his island lines
// ("where are we?", "we had better get back to the platform") are unreachable, as in Open-RSC. Kept as written.

const GameObject = require('../../../model/game-object');

const CAROLINE_ID = 455;
const HOLGART_IDS = new Set([456, 457, 458]); // land, platform, island
const KENT_ID = 459;
const BAILEY_ID = 460;
const KENNITH_ID = 461;
const FISHERMAN_GOLDEN_ID = 462;
const FISHERMAN_PURPLE_ID = 463;
const FISHERMAN_GRAY_ID = 464;

const TALK_IDS = new Set([
    CAROLINE_ID,
    ...HOLGART_IDS,
    KENT_ID,
    BAILEY_ID,
    KENNITH_ID,
    FISHERMAN_GOLDEN_ID,
    FISHERMAN_PURPLE_ID,
    FISHERMAN_GRAY_ID
]);

const SEASLUG_ID = 769;
const UNLIT_TORCH_ID = 773;
const LIT_TORCH_ID = 774;
const DRY_STICKS_ID = 777;
const QUEST_OYSTER_PEARLS_ID = 779;
const SWAMP_PASTE_ID = 785;

const PLATFORM_LADDER_ID = 458;
const FISHING_CRANE_ID = 453;
const LOOSE_PANEL_ID = 124;

const PLATFORM = { x: 495, y: 618 };
const SHORE = { x: 515, y: 613 };
const KENTS_ISLAND = { x: 512, y: 639 };
const PLATFORM_UPSTAIRS = { x: 494, y: 1561 };

// createGroundItemDelayedRemove(..., 12000) as 640 ms ticks
const SLUG_TICKS = Math.ceil(12000 / 640);

function stageOf(player) {
    return player.questStages.seaSlug || 0;
}

function setStage(player, stage) {
    player.questStages.seaSlug = stage;
}

function inBounds(player, minX, minY, maxX, maxY) {
    return player.x >= minX && player.x <= maxX && player.y >= minY && player.y <= maxY;
}

// Open-RSC Point.inArdougne / inPlatformArea
function inArdougne(player) {
    return inBounds(player, 500, 537, 600, 708);
}

function inPlatformArea(player) {
    return inBounds(player, 492, 614, 498, 620);
}

// Open-RSC mes(...) followed by delay(3)
async function mes(player, message) {
    player.message(`@que@${message}`);
    await player.world.sleepTicks(3);
}

// SeaSlug.handleReward: 1 quest point, fishing 700 + 800 * level (QuestRewardRegistrar, quarter points)
function completeQuest(player) {
    player.completeQuest('seaSlug', {
        questPoints: 1,
        experience: { fishing: 700 + 800 * player.skills.fishing.base },
        message: 'well done, you have completed the sea slug quest'
    });
}

// SeaSlug.checkTorchCrossing
async function checkTorchCrossing(player) {
    if (player.inventory.has(LIT_TORCH_ID)) {
        player.inventory.remove(LIT_TORCH_ID);
        player.inventory.add(UNLIT_TORCH_ID);
        await mes(player, 'your torch goes out on the crossing');
    }
}

async function rowToPlatform(player) {
    await mes(player, 'you board the small row boat');
    await checkTorchCrossing(player);
    await mes(player, 'you arrive at the fishing platform');
    player.teleport(PLATFORM.x, PLATFORM.y);
}

// "hello holgart": from the shore out to the platform
async function holgartFromShore(player, npc) {
    await player.say('hello holgart');
    await npc.say('hello again land lover', "there's some strange going's on, on that platform i tell you");

    const option = await player.ask(['will you take me there?', "i'm keeping away from there"], false);

    if (option === 0) {
        await player.say('will you take me back there?');
        await npc.say("of course m'hearty", "if that's what you want");
        await rowToPlatform(player);
    } else if (option === 1) {
        await player.say("i'm keeping away from there");
        await npc.say("fair enough m'hearty");
    }
}

// "hey holgart": from the platform back to the shore
async function holgartFromPlatform(player, npc) {
    await player.say('hey holgart');
    await npc.say('have you had enough of this place yet?', "it's scaring me");

    const option = await player.ask(["no, i'm going to stay a while", 'okay, lets go back'], true);

    if (option === 0) {
        await npc.say("okay, you're the boss");
    } else if (option === 1) {
        await npc.say("okay m'hearty jump on");
        await mes(player, 'you arrive back on shore');
        player.teleport(SHORE.x, SHORE.y);
    }
}

async function holgart(player, npc) {
    const stage = stageOf(player);

    if (stage === 0) {
        await player.say('hello there');
        await npc.say("well hello m'laddy", "beautiful day isn't it");
        await player.say('not bad i suppose');
        await npc.say('just smell that sea air... beautiful');
        await player.say('hmm...lovely!');
    } else if (stage === 1) {
        await player.say('hello');
        await npc.say("hello m'hearty");
        await player.say('i would like a ride on your boat to the fishing platform');
        await npc.say(
            "i'm afraid it isn't sea worthy, it's full of holes",
            "to fill the holes i'll need some swamp paste"
        );
        await player.say('swamp paste?');
        await npc.say('yes, swamp tar mixed with flour heated over a fire');
        await player.say('where can i find swamp tar?');
        await npc.say(
            'unfortunately the only supply of swamp tar is in the swamps below lumbridge',
            "it's too far for an old man like me to travel",
            'if you can make me some swamp paste i will give you a ride on my boat'
        );
        await player.say("i'll see what i can do");
        setStage(player, 2);
    } else if (stage === 2) {
        await player.say('hello holgart');
        await npc.say("hello m'hearty", 'did you manage to make some swamp paste?');

        if (player.inventory.has(SWAMP_PASTE_ID)) {
            player.inventory.remove(SWAMP_PASTE_ID, 1);
            await player.say('yes i have some here');
            player.message('you give holgart the swamp paste');
            await npc.say('superb, this looks great');
            player.message('holgart smears the paste over the under side of his boat');
            await npc.say("that's done the job, now we can go", 'jump aboard');
            setStage(player, 3);

            const option = await player.ask(["i'll come back later", 'okay, lets do it'], true);

            if (option === 0) {
                await npc.say('okay then', "i'll wait here for you");
            } else if (option === 1) {
                await npc.say('hold on tight');
                await mes(player, 'you board the small row boat');
                await mes(player, 'you arrive at the fishing platform');
                player.teleport(PLATFORM.x, PLATFORM.y);
            }
        } else {
            await player.say("i'm afraid not");
            await npc.say(
                'to make it you need swamp tar mixed with flour heated over a fire',
                'the only supply of swamp tar is in the swamps below lumbridge',
                "i can't fix the row boat without it"
            );
            await player.say("ok, i'll try to find some");
        }
    } else if (stage === 3) {
        if (inArdougne(player)) {
            await holgartFromShore(player, npc);
        } else {
            await holgartFromPlatform(player, npc);
        }
    } else if (stage === 4) {
        if (inPlatformArea(player)) {
            await player.say('holgart, something strange is going on here');
            await npc.say("you're telling me", 'none of the sailors seem to remember who i am');
            await player.say('apparently kenniths father left for help a couple of days ago');
            await npc.say("that's a worry, no ones heard from him on shore", 'come on, we better go look for him');
            await mes(player, 'you board the row boat');
            await mes(player, 'you arrive on a small island');
            player.teleport(KENTS_ISLAND.x, KENTS_ISLAND.y);
        } else if (inArdougne(player)) {
            await holgartFromShore(player, npc);
        } else {
            // kents island
            await player.say('where are we?');
            await npc.say('someway of mainland still', "you better see if old matey's okay");
        }
    } else if (stage === 5) {
        if (inPlatformArea(player)) {
            await holgartFromPlatform(player, npc);
        } else if (inArdougne(player)) {
            await holgartFromShore(player, npc);
        } else {
            // kents island to fishing platform
            await player.say('we had better get back to the platform', "and see what's going on");
            await npc.say("you're right", 'it all sounds pretty creepy');
            await mes(player, 'you arrive back at the fishing platform');
            player.teleport(PLATFORM.x, PLATFORM.y);
        }
    } else if (stage === 6) {
        if (inPlatformArea(player)) {
            await player.say('did you get the kid back to shore?');
            await npc.say("yes, he's safe and sound with his parents", 'your turn to return to land now adventurer');
            await player.say('looking forward to it');
            player.message('you board the small row boat');
            player.message('you arrive back on shore');
            player.teleport(SHORE.x, SHORE.y);
        } else {
            await holgartFromShore(player, npc);
        }
    } else if (stage === -1) {
        if (inArdougne(player)) {
            await player.say('hello again holgart');
            await npc.say(
                "well hello again m'hearty",
                'your land loving legs getting bored?',
                'fancy some cold and wet underfoot?'
            );
            await player.say('pardon');
            await npc.say('fancy going out to sea?');

            const option = await player.ask(["i'll come back later", 'okay lets do it'], true);

            if (option === 0) {
                await npc.say('okay then', "i'll wait here for you");
            } else if (option === 1) {
                await npc.say('hold on tight');
                await rowToPlatform(player);
            }
        } else {
            await holgartFromPlatform(player, npc);
        }
    }
}

async function caroline(player, npc) {
    const stage = stageOf(player);

    if (stage === 0) {
        await player.say('hello there');
        await npc.say('is there any chance you could help me?');
        await player.say("what's wrong?");
        await npc.say(
            "it's my husband, he works on a fishing platform",
            'once a month he takes our son kennith out with him',
            "they usually write to me regularly but i've heard nothing all week",
            "it's very strange"
        );
        await player.say('maybe the post was lost!');
        await npc.say(
            "maybe, but no one's heard from the other fishermen on the platform",
            'their families are becoming quite concerned',
            "is there any chance you could visit the platform and find out what's going on?"
        );

        const option = await player.ask(['i suppose so, how do i get there?',"i'm sorry i'm too busy"], true);

        if (option === 0) {
            await npc.say("that's very good of you traveller", 'my friend holgart will take you there');
            await player.say("okay i'll go and see if they're ok");
            await npc.say(
                'i will reward you for your time',
                "and it'll give me great piece of mind", // sic
                'to know kennith and my husband kent are safe'
            );
            setStage(player, 1);
        } else if (option === 1) {
            await npc.say('thats a shame');
            await player.say('bye');
            await npc.say('bye');
        }
    } else if (stage >= 1 && stage <= 5) {
        await player.say('hello caroline');
        await npc.say('brave adventurer have you any news about my son and his father?');
        await player.say("i'm working on it now caroline");
        await npc.say('please bring them back safe and sound');
        await player.say("i'll do my best");
    } else if (stage === 6) {
        await player.say('hello');
        await npc.say(
            "brave adventurer you've returned",
            'kennith told me about the strange going ons on the platform',
            'i had no idea it was so serious',
            "i could have lost my son and my husband if it wasn't for you"
        );
        await player.say('we found kent stranded on a island');
        await npc.say(
            'yes, holgart told me and sent a rescue party out',
            "kent's back at home now, resting with kennith",
            "i don't think he'll be doing any fishing for a while",
            'here, take these oyster pearls as a reward',
            "they're worth a fair bit",
            'and can be used to make lethal crossbow bolts'
        );
        completeQuest(player);
        await player.say('thanks');
        await npc.say('thank you', 'take care of yourself adventurer');
        player.inventory.add(QUEST_OYSTER_PEARLS_ID, 1);
    } else if (stage === -1) {
        await player.say('hello again');
        await npc.say('hello traveler', 'how are you?');
        await player.say('not bad thanks, yourself?');
        await npc.say("i'm good", 'busy as always looking after kent and kennith but no complaints');
    }
}

async function kent(player, npc) {
    const stage = stageOf(player);

    if (stage === 4) {
        await npc.say('oh thank Saradomin', 'i thought i would be left out here forever');
        await player.say('your wife sent me out to find you and your boy', "kennith's fine he's on the platform");
        await npc.say(
            "i knew the row boat wasn't sea worthy",
            "i couldn't risk bringing him along but you must get him of that platform"
        );
        await player.say("what's going on on there?");
        await npc.say(
            'five days ago we pulled in huge catch',
            'as well as fish we caught small slug like sea creatures, hundreds of them',
            "that's when the fishermen began to act strange",
            'it was the sea slugs, they attach themselves to your body',
            'and somehow take over the mind of the carrier',
            'i told Kennith to hide until i returned but i was washed up here',
            'please go back and get my boy',
            'you can send help for me later',
            'traveler wait!'
        );
        await mes(player, 'kent reaches behind your neck');
        await mes(player, 'slooop');
        await mes(player, 'he pulls a sea slug from under your top');
        // kent drops slug at 511, 636 and stays for about 12s
        player.world.addTimedGroundItem({
            id: SEASLUG_ID,
            amount: 1,
            x: 511,
            y: 636,
            ticks: SLUG_TICKS,
            owner: player
        });
        await npc.say('a few more minutes and that thing would have full control you body');
        await player.say('yuck..thanks kent');
        setStage(player, 5);
    } else if (stage === 5) {
        await player.say('hello');
        await npc.say('oh my', 'i must get back to shore');
    }
}

async function kennith(player, npc) {
    const stage = stageOf(player);

    if (stage === 3) {
        await player.say('are you okay young one?');
        await npc.say('no i want my daddy');
        await player.say('Where is your father?');
        await npc.say(
            'he went to get help days ago',
            'the nasty fisher men tried to throw me and daddy into the sea',
            'so he told me to hide in here'
        );
        await player.say("that's good advice", "you stay here and i'll go try and find your father");
        setStage(player, 4);
    } else if (stage === 4) {
        await player.say('are you okay?');
        await npc.say('i want to see daddy');
        await player.say("i'm working on it");
    } else if (stage === 5) {
        if (player.cache.loose_panel !== undefined) {
            await player.say("kennith i've made an opening in the wall", 'you can come out there');
            await npc.say('are their any sea slugs on the other side?'); // sic
            await player.say('not one');
            await npc.say('how will i get down stairs');
            await player.say("i'll figure that out in a moment");
            await npc.say("okay, when you have i'll come out");
            return;
        }

        await player.say('hello kennith', 'are you okay?');
        await npc.say('no i want my daddy');
        await player.say(
            "you'll be able to see him soon",
            'first we need to get you back to land',
            'come with me to the boat'
        );
        await npc.say('no');
        await player.say('what, why not?');
        await npc.say("i'm scared of those nasty sea slugs", "i won't go near them");
        await player.say("okay, you wait here and i'll figure another way to get you out");
    } else if (stage === 6 || stage === -1) {
        await mes(player, "He doesn't seem interested in talking");
    }
}

async function bailey(player, npc) {
    const stage = stageOf(player);

    if (stage === 3 || stage === 4) {
        await player.say('hello');
        await npc.say('well hello there', 'what are you doing here?');
        await player.say("i'm trying to find out what happened to a boy named kennith");
        await npc.say("oh, you mean kent's son", "he's around somewhere, probably hiding");
        await player.say('hiding from what?');
        await npc.say("haven't you seen all those things out there?");
        await player.say('the sea slugs?');
        await npc.say(
            'ever since we pulled up that haul something strange has been going on',
            'the fishermen spend all day pulling in hauls of fish',
            'only to throw back the fish and keep those nasty sea slugs',
            'what am i supposed to do with those',
            "i haven't figured out how to kill one yet",
            'if i put them near the stove they squirm and jump away'
        );
        await player.say('i doubt they would taste too good');
    } else if (stage === 5) {
        if (player.cache.lit_torch === undefined) {
            await player.say('hello');
            await npc.say(
                "oh thank god it's you",
                "they've all gone mad i tell you",
                'one of the fishermen tried to throw me into the sea'
            );
            await player.say("they're all being controlled by the sea slugs");
            await npc.say('i figured as much');
            await player.say("i need to get kennith of this platform but i can't get past the fishermen");
            await npc.say('the sea slugs are scared of heat', 'i figured that out when i tried to cook them');

            if (!player.inventory.has(UNLIT_TORCH_ID)) {
                await npc.say('here');
                await mes(player, 'bailey gives you a torch');
                player.inventory.add(UNLIT_TORCH_ID, 1);
                await npc.say(
                    'i doubt the fishermen will come near you if you can get this torch to light',
                    'the only problem is all the wood and flint is damp',
                    "i can't light a thing"
                );
            } else {
                await player.say('i better figure a way to light this torch');
            }
        } else if (player.inventory.has(LIT_TORCH_ID)) {
            await player.say("i've managed to light the torch");
            await npc.say(
                'well done traveler',
                'you better get kennith out of here soon',
                'the fishermen are becoming stranger by the minute',
                'and they keep pulling up those blasted sea slugs'
            );
        } else if (!player.inventory.has(UNLIT_TORCH_ID)) {
            await player.say("i've managed to lose my torch");
            await npc.say('that was silly, fortunately i have another', 'here, take it');
            player.inventory.add(UNLIT_TORCH_ID, 1);
        }
    } else if (stage === 6) {
        await player.say('hello bailey');
        await npc.say(
            'hello again',
            'i saw you managed to get kennith of the platform',
            "well done, he wasn't safe around these slugs"
        );
        await player.say('are you going to come back with us?');
        await npc.say(
            'no, these fishermen are my friends',
            "i'm sure they can be saved",
            "i'm going to stay and try to get rid of all these slugs"
        );
        await player.say("you're braver than most", 'take care of yourself bailey');
        await npc.say('you to traveler');
    } else if (stage === -1) {
        await player.say('hello bailey');
        await npc.say('well hello again traveler', 'what brings you back out here');
        await player.say('just looking around');
        await npc.say("well don't go touching any of those blasted slugs");
    }
}

async function fisherman(player, npc) {
    if (npc.id === FISHERMAN_GOLDEN_ID) {
        await player.say('hello');
        player.message('his eyes are fixated');
        player.message('starring at the sea'); // sic
        await npc.say('keep away human', 'leave or face the deep blue');
        await player.say('pardon?');
        await npc.say("you'll all end up in the blue", 'deep deep under the blue');
        return;
    }

    await player.say('hello there');
    player.message('his eyes are fixated');
    player.message('starring at the sea'); // sic
    await npc.say('must find family');
    await player.say('what?');
    await npc.say("soon we'll all be together");
    await player.say('are you okay?');
    await npc.say('must find family', "they're all under the blue", 'deep deep under the blue');
    await player.say("ermm..i'll leave you to it then");
}

async function onTalkToNPC(player, npc) {
    if (!TALK_IDS.has(npc.id)) {
        return false;
    }

    player.engage(npc);

    try {
        if (npc.id === KENT_ID) {
            await kent(player, npc);
        } else if (npc.id === KENNITH_ID) {
            await kennith(player, npc);
        } else if (npc.id === BAILEY_ID) {
            await bailey(player, npc);
        } else if (npc.id === CAROLINE_ID) {
            await caroline(player, npc);
        } else if (HOLGART_IDS.has(npc.id)) {
            await holgart(player, npc);
        } else {
            await fisherman(player, npc);
        }
    } finally {
        if (player.interlocutor) {
            player.disengage();
        }
    }

    return true;
}

// the sea slugs lying about the platform bite and are dropped again
async function onGroundItemTake(player, groundItem) {
    if (groundItem.id !== SEASLUG_ID) {
        return false;
    }

    const damage = Math.floor(Math.random() * 8) + 1;

    player.message('you pick up the seaslug', 'it sinks its teeth deep into you hand');
    player.damage(damage);
    await player.say('ouch');
    player.message('you drop the sea slug');

    return true;
}

async function platformLadder(player) {
    const stage = stageOf(player);

    if (stage < 5) {
        await mes(player, 'You climb up the ladder');
        player.teleport(PLATFORM_UPSTAIRS.x, PLATFORM_UPSTAIRS.y);
        return;
    }

    if (!player.inventory.has(LIT_TORCH_ID)) {
        // DataConversions.getRandom().nextInt(1) + 7
        player.message(
            'You attempt to climb up the ladder',
            'the fishermen approach you',
            'and throw you back down the ladder'
        );
        player.damage(7);
        await player.say('ouch');
    } else {
        await mes(player, 'You climb up the ladder');
        player.teleport(PLATFORM_UPSTAIRS.x, PLATFORM_UPSTAIRS.y);
        player.message('the fishermen seem afraid of your torch');
    }
}

// Open-RSC replaceGameObject with the same id turned to another direction
function turnCrane(world, crane, direction) {
    const turned = new GameObject(world, { id: crane.id, x: crane.x, y: crane.y, direction });

    world.removeEntity('gameObjects', crane);
    world.addEntity('gameObjects', turned);

    return turned;
}

async function fishingCrane(player, crane) {
    const stage = stageOf(player);
    const { world } = player;

    if (stage === 5) {
        await mes(player, 'you rotate the crane around');
        await mes(player, 'to the far platform');
        crane = turnCrane(world, crane, 5);
        await world.sleepTicks(1);
        crane = turnCrane(world, crane, 6);
        await player.say('jump on kennith!');
        player.message('kennith comes out through the broken panal'); // sic
        crane = turnCrane(world, crane, 5);
        await world.sleepTicks(1);
        turnCrane(world, crane, 4);
        await mes(player, 'he climbs onto the fishing net');
        await mes(player, 'you rotate the crane back around');
        await mes(player, 'and lower kennith to the row boat waiting below');
        setStage(player, 6);
        delete player.cache.loose_panel;
        delete player.cache.lit_torch;
    } else if (stage > 0 && stage < 5) {
        await mes(player, 'you rotate the crane around');
    } else {
        player.message('Nothing interesting happens');
    }
}

async function onGameObjectCommandOne(player, gameObject) {
    if (gameObject.id === PLATFORM_LADDER_ID) {
        await platformLadder(player);
        return true;
    }

    if (gameObject.id === FISHING_CRANE_ID) {
        await fishingCrane(player, gameObject);
        return true;
    }

    return false;
}

async function onWallObjectCommandOne(player, wallObject) {
    if (wallObject.id !== LOOSE_PANEL_ID) {
        return false;
    }

    if (stageOf(player) === 5) {
        await mes(player, 'you kick the loose panel');
        await mes(player, 'the wood is rotten and crumbles away');
        await mes(player, 'leaving an opening big enough for kennith to climb through');
        player.cache.loose_panel = true;
    } else {
        await mes(player, 'you kick the loose panal'); // sic
        await mes(player, 'nothing interesting happens');
    }

    return true;
}

// InvAction.handleDrySticks: the sticks light an unlit torch at firemaking 30; they are not used up
async function onInventoryCommand(player, item) {
    if (item.id !== DRY_STICKS_ID) {
        return false;
    }

    player.message('you rub together the dry sticks');

    if (player.skills.firemaking.current < 30) {
        player.message('you need a firemaking level of 30 or above', 'the sticks smoke momentarily then die out');
        return true;
    }

    await mes(player, 'The sticks catch alight');

    if (player.inventory.has(UNLIT_TORCH_ID)) {
        player.inventory.remove(UNLIT_TORCH_ID, 1);
        player.message('you place the smouldering twigs to your torch', 'your torch lights');
        player.inventory.add(LIT_TORCH_ID, 1);
        // Firemaking.getExp(maxStat, 25) = (25 + maxStat * 1.75) * 4, quarter points
        player.addExperience('firemaking', Math.floor((25 + player.skills.firemaking.base * 1.75) * 4));

        if (stageOf(player) === 5 && player.cache.lit_torch === undefined) {
            player.cache.lit_torch = true;
        }
    } else {
        player.message('the sticks smoke momentarily then die out');
    }

    return true;
}

module.exports = {
    onTalkToNPC,
    onGroundItemTake,
    onGameObjectCommandOne,
    onWallObjectCommandOne,
    onInventoryCommand
};
