// Ported from Open-RSC Core-Framework authentic/quests/members/LostCity.java (AGPL-3.0)
// https://classic.runescape.wiki/w/Lost_City
//
// questStages.lostCity (the Java stages):
//   0  the Adventurers (207-210) camped in Lumbridge swamp let slip that a leprechaun knows where Zanaris is -> 1
//   1  searching the Tree (237) at (172,662) shakes out the Leprechaun (211); caught, he names the shed in the swamp and
//      the Dramenwood staff -> 2
//   2  on Entrana the Monk of Entrana (213) by the Ladder (244) warns about the dungeon; down there, chopping the Dramen
//      tree (245) brings out the tree spirit (216) -> 3 (skills/woodcutting.js)
//   3  killing the tree spirit -> 4
//   4  the Dramen tree gives a Dramen branch (510, woodcutting 36), a knife carves it into a Dramen staff (509, crafting
//      31); the shed door (66) at (126,686) with the staff wielded leads to Zanaris (126,3518) -> -1, 3 quest points
// The Magic Door (65) at (406,3392) is the dungeon's way out, deep into the wilderness (109,245).
// Talking to the Entrana monk (213) stays the ferry back to Port Sarim (npcs/port-sarim/monks-of-entrana.js; rsc-data
// places no other monk on Entrana); his Lost City warning comes from the ladder, as in the Java OpLoc.

const ADVENTURER_IDS = new Set([207, 208, 209, 210]);
const LEPRECHAUN_ID = 211;
const MONK_OF_ENTRANA_ID = 213;
const TREE_SPIRIT_ID = 216;

const KNIFE_ID = 13;
const DRAMEN_STAFF_ID = 509;
const DRAMEN_BRANCH_ID = 510;

const LEPRECHAUN_TREE_ID = 237;
const ENTRANA_LADDER_ID = 244;

const MAGIC_DOOR_ID = 65;
const ZANARIS_DOOR_ID = 66;

const ZANARIS = { x: 126, y: 3518 };
const WILDERNESS_EXIT = { x: 109, y: 245 };

// addnpc(..., 180 seconds) as 640 ms ticks
const LEPRECHAUN_TICKS = Math.ceil(180000 / 640);

function stageOf(player) {
    return player.questStages.lostCity || 0;
}

function setStage(player, stage) {
    player.questStages.lostCity = stage;
}

// Open-RSC ifnearvisnpc: the nearest one within `radius` tiles
function nearNpc(player, id, radius) {
    return player
        .getNearbyEntitiesByID('npcs', id, radius * 2 + 1)
        .sort((a, b) => player.getDistance(a) - player.getDistance(b))[0];
}

// LostCity.handleReward: 3 quest points, no experience
function completeQuest(player) {
    player.completeQuest('lostCity', {
        questPoints: 3,
        message: 'Well done you have completed the Lost City of Zanaris quest'
    });
}

function leprechaunVanishes(player, npc) {
    player.message('The leprechaun magically disapeers'); // sic
    player.disengage();
    player.world.removeEntity('npcs', npc);
}

async function leprechaun(player, npc) {
    const stage = stageOf(player);

    if (stage === 0) {
        await npc.say(
            'Ay you big elephant',
            'You have caught me',
            'What would you be wanting with old Shamus then?'
        );
        await player.say("I'm not sure");
        await npc.say("Well you'll have to catch me again when you are");
        leprechaunVanishes(player, npc);
    } else if (stage === 1) {
        await npc.say(
            'Ay you big elephant',
            'You have caught me',
            'What would you be wanting with old Shamus then?'
        );
        await player.say('I want to find Zanaris');
        await npc.say(
            'Zanaris?',
            'You need to go in the funny little shed',
            'in the middle of the swamp'
        );
        await player.say('Oh I thought Zanaris was a city');
        await npc.say('It is');

        const menu = await player.ask(
            ['How does it fit in a shed then?', "I've been in that shed, I didn't see a city"],
            false
        );

        if (menu === 0) {
            await player.say('How does it fit in a shed then?');
            await npc.say(
                'Silly person',
                "The city isn't in the shed",
                'The shed is a portal to Zanaris'
            );
            await player.say('So I just walk into the shed and end up in Zanaris?');
        } else if (menu === 1) {
            await player.say("I've been in that shed", "I didn't see a city");
        }

        await npc.say(
            "Oh didn't I say?",
            'You need to be carrying a Dramenwood staff',
            'Otherwise you do just end up in a shed'
        );
        await player.say('So where would I get a staff?');
        await npc.say(
            'Dramenwood staffs are crafted from branches',
            'These staffs are cut from the Dramen tree',
            'located somewhere in a cave on the island of Entrana',
            'I believe the monks of Entrana have recetnly', // sic
            'Started running a ship from port sarim to Entrana'
        );
        setStage(player, 2);
        leprechaunVanishes(player, npc);
    } else {
        await npc.say(
            'Ay you big elephant',
            'You have caught me',
            'What would you be wanting with old Shamus then?'
        );

        const menu = await player.ask(["I'm not sure", 'How do I get to Zanaris again?'], true);

        if (menu === 0) {
            await npc.say(
                'I dunno, what stupid people',
                "Who go to all the trouble to catch leprechaun's",
                "When they don't even know what they want"
            );
            leprechaunVanishes(player, npc);
        } else if (menu === 1) {
            await npc.say(
                'You need to enter the shed in the middle of the swamp',
                'While holding a dramenwood staff',
                'Made from a branch',
                'Cut from the dramen tree on the island of Entrana'
            );
            leprechaunVanishes(player, npc);
        }
    }
}

async function zanarisMenu(player, npc) {
    const next = await player.ask(
        ["If it's hidden how are you planning to find it", "There's no such thing"],
        true
    );

    if (next === 0) {
        await npc.say(
            "Well we don't want to tell others that",
            'We want all the glory of finding it for ourselves'
        );

        const after = await player.ask(
            ['please tell me', "looks like you don't know either if you're sitting around here"],
            false
        );

        if (after === 0) {
            await player.say('Please tell me');
            await npc.say('No');
        } else if (after === 1) {
            await player.say("looks like you don't know either if you're sitting around here");
            await npc.say(
                'Of course we know',
                "We haven't worked out which tree the stupid leprechaun is in yet",
                "Oops I didn't mean to tell you that"
            );
            await player.say('So a Leprechaun knows where Zanaris is?');
            await npc.say('Eerm', 'yes');
            await player.say("And he's in a tree somewhere around here", 'thankyou very much');
            setStage(player, 1);
        }
    } else if (next === 1) {
        await npc.say(
            'Well when we find which tree the leprechaun is in',
            'You can eat those words',
            "Oops I didn't mean to tell you that"
        );
        await player.say('So a Leprechaun knows where Zanaris is?');
        await npc.say('Eerm', 'yes');
        await player.say("And he's in a tree somewhere around here", 'thankyou very much');
        setStage(player, 1);
    }
}

async function whatsZanaris(player, npc) {
    await player.say("what's Zanaris?");
    await npc.say("I don't think we want other people competing with us to find it");

    const next = await player.ask(['Please tell me', 'Oh well never mind'], true);

    if (next === 0) {
        await npc.say('No');
    }
}

async function adventurer(player, npc) {
    const stage = stageOf(player);

    if (stage === 0) {
        await npc.say('hello traveller');

        const option = await player.ask(
            ['What are you camped out here for?', 'Do you know any good adventures I can go on?'],
            false
        );

        if (option === 0) {
            await player.say('What are you camped here for?');
            await npc.say("We're looking for Zanaris");

            const sub = await player.ask(
                ["Who's Zanaris?", "what's Zanaris?", "What makes you think it's out here"],
                false
            );

            if (sub === 0 || sub === 2) {
                if (sub === 0) {
                    await player.say("Who's Zanaris?");
                    await npc.say("hehe Zanaris isn't a person", "It's a magical hidden city");
                } else {
                    await player.say("what makes you think it's out here?");
                    await npc.say(
                        "Don't you know the legends?",
                        'Of the magical city, hidden in the swamp'
                    );
                }

                await zanarisMenu(player, npc);
            } else if (sub === 1) {
                await whatsZanaris(player, npc);
            }
        } else if (option === 1) {
            await player.say('Do you know any good adventures I can go on');
            await npc.say(
                "Well we're on an adventure now",
                'Mind you this is our adventure',
                "We don't want to share it - find your own"
            );

            const insist = await player.ask(
                ['Please tell me', "I don't think you've found a good adventure at all"],
                true
            );

            if (insist === 0) {
                await npc.say('No');
            } else if (insist === 1) {
                await npc.say(
                    "We're on one of the greatest adventures I'll have you know",
                    "Searching for Zanaris isn't a walk in the park"
                );

                const sub = await player.ask(
                    ["Who's Zanaris?", "what's Zanaris?", "What makes you think it's out here"],
                    false
                );

                if (sub === 0 || sub === 2) {
                    if (sub === 0) {
                        await npc.say("hehe Zanaris isn't a person", "It's a magical hidden city");
                    } else {
                        await npc.say(
                            "Don't you know the legends?",
                            'Of the magical city, hidden in the swamp'
                        );
                    }

                    await zanarisMenu(player, npc);
                } else if (sub === 1) {
                    await whatsZanaris(player, npc);
                }
            }
        }
    } else if (stage === 1) {
        await player.say(
            'So let me get this straight',
            'I need to search the trees near here for a leprechaun?',
            'And he will tell me where Zanaris is?'
        );
        await npc.say('That is what the legends and rumours are,yes');
    } else {
        await player.say(
            'thankyou for your information',
            'It has helped me a lot in my quest to find Zanaris'
        );
        await npc.say('So what have you found out?', 'Where is Zanaris?');
        await player.say('I think I will keep that to myself');
    }
}

// LostCity.freePlayerDialogue (reconstructed in Open-RSC): the adventurers on a free world
async function freeWorldAdventurer(npc) {
    await npc.say('hello adventurer', "can't talk here", 'meet me in a members world so we can talk');
}

async function onTalkToNPC(player, npc) {
    if (!ADVENTURER_IDS.has(npc.id) && npc.id !== LEPRECHAUN_ID) {
        return false;
    }

    player.engage(npc);

    if (!player.world.members) {
        if (ADVENTURER_IDS.has(npc.id)) {
            await freeWorldAdventurer(npc);
        }
    } else if (npc.id === LEPRECHAUN_ID) {
        await leprechaun(player, npc);
    } else {
        await adventurer(player, npc);
    }

    player.disengage();
    return true;
}

// the monk's warning at the top of the ladder; the ladder goes one way, and prayer is drained to 1-3
async function entranaLadder(player, ladder) {
    const { world } = player;
    const monk = nearNpc(player, MONK_OF_ENTRANA_ID, 10);

    if (!monk) {
        return;
    }

    player.engage(monk);

    try {
        await monk.say(
            'Be careful going in there',
            'You are unarmed, and there is much evilness lurking down there',
            'The evilness seems to block off our contact with our gods',
            'Our prayers seem to have less effect down there',
            "Oh also you won't be able to come back this way",
            'This ladder only goes one way',
            'The only way out is a portal which leads deep into the wilderness'
        );

        const option = await player.ask(
            ["I don't think I'm strong enough to enter then", 'Well that is a risk I will have to take'],
            true
        );

        if (option !== 1) {
            return;
        }

        player.disengage();
        player.message('You climb down the ladder');
        await world.sleepTicks(2);
        player.climb(ladder, false);

        const prayer = player.skills.prayer.current;
        const drained = prayer <= 3 ? 1 : prayer <= 39 ? 2 : 3;

        player.changeStat('prayer', drained - prayer);
    } finally {
        if (player.interlocutor) {
            player.disengage();
        }
    }
}

async function leprechaunTree(player) {
    const stage = stageOf(player);
    const { world } = player;

    if (stage === 0 || !world.members || stage < 1 || stage > 3) {
        player.message('There is nothing in this tree');
        return;
    }

    if (nearNpc(player, LEPRECHAUN_ID, 15)) {
        player.message('There is nothing in this tree');
        return;
    }

    player.message('A Leprechaun jumps down from the tree and runs off');

    // Open-RSC walks him to (173,661) then (177, 656-666): his wander box here
    world.spawnTimedNPC({
        id: LEPRECHAUN_ID,
        x: 172,
        y: 661,
        minX: 172,
        maxX: 177,
        minY: 656,
        maxY: 666,
        ticks: LEPRECHAUN_TICKS
    });
}

async function onGameObjectCommandOne(player, gameObject) {
    if (gameObject.id === ENTRANA_LADDER_ID) {
        await entranaLadder(player, gameObject);
        return true;
    }

    if (gameObject.id === LEPRECHAUN_TREE_ID) {
        await leprechaunTree(player);
        return true;
    }

    return false;
}

// Java blockAttackNpc: the spirit only fights a player at stage 3 (the attack is dropped without a word otherwise)
async function onNPCAttack(player, npc) {
    if (npc.id !== TREE_SPIRIT_ID || stageOf(player) === 3) {
        return false;
    }

    return true;
}

// never claims: the spirit dies like any npc
async function onNPCDeath(player, npc) {
    if (npc.id !== TREE_SPIRIT_ID || !player || !player.questStages) {
        return false;
    }

    if (stageOf(player) === 3) {
        setStage(player, 4);
    }

    return false;
}

async function onUseWithInventory(player, item, target) {
    const ids = [item.id, target.id];

    if (!ids.includes(KNIFE_ID) || !ids.includes(DRAMEN_BRANCH_ID)) {
        return false;
    }

    const { world } = player;

    if (!player.inventory.has(DRAMEN_BRANCH_ID)) {
        return true;
    }

    if (player.skills.crafting.current < 31) {
        player.message('@que@You are not a high enough crafting level to craft this staff');
        await world.sleepTicks(3);
        player.message('@que@You need a crafting level of 31');
        await world.sleepTicks(3);
        return true;
    }

    player.inventory.remove(DRAMEN_BRANCH_ID);
    player.message('@que@you carve the branch into a staff');
    await world.sleepTicks(3);
    player.inventory.add(DRAMEN_STAFF_ID, 1);

    return true;
}

async function onWallObjectCommandOne(player, wallObject) {
    const { world } = player;

    if (wallObject.id === MAGIC_DOOR_ID) {
        player.teleport(WILDERNESS_EXIT.x, WILDERNESS_EXIT.y, true);
        await world.sleepTicks(1);
        player.message('you go through the door and find yourself somewhere else');
        return true;
    }

    if (wallObject.id !== ZANARIS_DOOR_ID) {
        return false;
    }

    const stage = stageOf(player);

    if (
        player.inventory.isEquipped(DRAMEN_STAFF_ID) &&
        (stage === 4 || stage === -1) &&
        world.members
    ) {
        player.message('@que@The world starts to shimmer');
        await world.sleepTicks(3);
        player.message('@que@You find yourself in different surroundings');
        await world.sleepTicks(3);
        player.teleport(ZANARIS.x, ZANARIS.y);

        if (stage !== -1) {
            completeQuest(player);
        }
    } else {
        await player.enterDoor(wallObject);
        player.message('you go through the door and find yourself in a shed.');
    }

    return true;
}

module.exports = {
    onTalkToNPC,
    onGameObjectCommandOne,
    onNPCAttack,
    onNPCDeath,
    onUseWithInventory,
    onWallObjectCommandOne
};
