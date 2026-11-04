// Ported from Open-RSC Core-Framework authentic/quests/members/TheHolyGrail.java (AGPL-3.0)
// https://classic.runescape.wiki/w/The_Holy_Grail
//
// questStages.theHolyGrail (the Java stages). King Arthur (275, quests/members/merlins-crystal/camelot.js) starts the quest
// once Merlin's Crystal is done, answers "How goes thy quest?" and takes the grail; Brother Galahad (403,
// npcs/seers-village/brother-galahad.js) lends the Holy table napkin from stage 3; the High priest of Entrana (395,
// npcs/entrana/high-priest-of-entrana.js) is stage 2 -> 3. This file is the rest of TheHolyGrail.java:
//   1  Arthur: "Go speak to Merlin". Merlin (393) in the workshop beside the Camelot library (door 117 at (463,1384) opens
//      only once Merlin's Crystal is done) gives the advice about the holy island -> 2
//   2  the High priest of Entrana (406,562) with the Crone (394) near him: "Go to where the six heads face, blow the
//      whistle and away you go" -> 3
//   3  the Magic whistles (738): the door 116 (202,2438) upstairs in Draynor Manor drops two for the quester; the whistle blown
//      on the square plot (490-491, 652-653) carries you to the first Grail island (396,18). The Fisherman (414) there
//      points at the bells outside the castle (a Bell 743 drops at (421,30) for him); ringing it at the castle gate
//      (411-425, 27-40) puts you inside (420,35). The Black Knight Titan (401, 413,11) guards the way: only Excalibur
//      wielded kills him. The Fisher King (412) -> 4
//   4  the sack 408 at (328,446) holds Sir Percival (411), who can be told his father wants him; give him a whistle -> 5
//      (Arthur gives a Magic golden feather 745 that points at the sack: blow on it)
//   5  the whistle blown on the plot carries you to the second island (492,18) where the grail (746) is free to take, at
//      (514,1924); Arthur takes it -> -1 (camelot.js): 2 quest points, prayer 1000 + 1000 and defense 1200 + 1200 per level
// The first grail at (418,1924) cannot be moved. The Open-RSC `ifnearvisnpc` calls become getNearbyEntitiesByID.

const BELL_ID = 743;
const MAGIC_WHISTLE_ID = 738;
const MAGIC_GOLDEN_FEATHER_ID = 745;
const HOLY_GRAIL_ID = 746;
const BIG_BONES_ID = 413;
const EXCALIBUR_ID = 606;

const MERLIN_LIBRARY_ID = 393;
const BLACK_KNIGHT_TITAN_ID = 401;
const FISHER_KING_ID = 412;
const MAIDEN_ID = 413;
const FISHERMAN_ID = 414;
const KING_PERCIVAL_ID = 415;
const UNHAPPY_PEASANT_ID = 416;
const HAPPY_PEASANT_ID = 417;
const SIR_PERCIVAL_ID = 411;

const TALK_IDS = new Set([
    MERLIN_LIBRARY_ID,
    BLACK_KNIGHT_TITAN_ID,
    UNHAPPY_PEASANT_ID,
    FISHERMAN_ID,
    FISHER_KING_ID,
    KING_PERCIVAL_ID,
    HAPPY_PEASANT_ID
]);

const WHISTLE_DOOR_ID = 116;
const MERLIN_DOOR_ID = 117;
const SACK_ID = 408;
const GRAIL_SPOT = { x: 418, y: 1924 };
const SACK_SPOT = { x: 328, y: 446 };

// addnpc(..., 64 seconds) as 640 ms ticks
const PERCIVAL_TICKS = Math.ceil(64000 / 640);

function stageOf(player) {
    return player.questStages.theHolyGrail || 0;
}

function setStage(player, stage) {
    player.questStages.theHolyGrail = stage;
}

// Open-RSC mes(...) followed by delay(3)
async function mes(player, ...lines) {
    for (const line of lines) {
        player.message(`@que@${line}`);
        await player.world.sleepTicks(3);
    }
}

// Point.inBounds(x1, y1, x2, y2)
function inBounds(player, minX, minY, maxX, maxY) {
    return player.x >= minX && player.x <= maxX && player.y >= minY && player.y <= maxY;
}

// Open-RSC setChasing: the npc goes for the player once the talk is over
function chase(player, npc) {
    if (npc && typeof npc.attack === 'function') {
        Promise.resolve(npc.attack(player)).catch(() => {});
    }
}

// ---------------------------------------------------------------- Merlin

async function merlin(player, npc) {
    const stage = stageOf(player);

    if (stage >= 1 && stage <= 3) {
        await player.say(
            'Hello King Arthur has sent me on a quest for the holy grail',
            'He thought you could offer some assistance'
        );
        await npc.say(
            'Ah yes the holy grail',
            'That is a powerful artifact indeed',
            'Returning it here would help Camelot a lot',
            'Due to its nature the holy grail is likely to reside in a holy place'
        );
        await player.say('Any suggestions?');
        await npc.say(
            'I believe there is a holy island somewhere not far away',
            "I'm not entirely sure",
            'I spent too long inside that crystal',
            'Anyway go and talk to someone over there',
            'I suppose you could also try speaking to Sir Galahad',
            'He returned from the quest many years after everyone else',
            'He seems to know something about it',
            'but he can only speak about those experiences cryptically'
        );

        if (stage === 1) {
            setStage(player, 2);
        }

        const menu = await player.ask(['Thankyou for the advice', 'Where can I find Sir Galahad?'], false);

        if (menu === 0) {
            await player.say('Thankyou for the advice');
        } else if (menu === 1) {
            await player.say('Where can I find Sir Galahad');
            await npc.say('Galahad now lives a life of religious contemplation', 'He lives somewhere west of McGrubors Wood');
        }
    } else if (stage === -1) {
        await npc.say("hello I'm working on a new spell", 'To turn people into hedgehogs');
    }
}

// ---------------------------------------------------------------- the Grail realm

async function blackKnightTitan(player, npc) {
    await npc.say(
        'I am the black knight titan',
        'You must pass through me before you can continue in this realm'
    );

    const menu = await player.ask(['Ok, have at ye oh evil knight', "Actually I think I'll run away"], true);

    if (menu === 0) {
        await player.world.sleepTicks(2);
        return npc;
    }

    return null;
}

async function fisherman(player, npc) {
    await npc.say("Hi - I don't get many visitors here");

    const menu = await player.ask(["How's the fishing?", 'Any idea how to get into the castle?', 'Yes well this place is a dump'], true);

    if (menu === 0) {
        await npc.say(
            'Not amazing',
            'Not many fish can live in this gungey stuff',
            'I remember when this was a pleasant river',
            'Teaming with every sort of fish'
        );
    } else if (menu === 1) {
        await npc.say('why thats easy', 'just ring one of the bells outside');
        await player.say("I didn't see any bells");
        await npc.say('You must be blind then', "There's always bells there when I go to the castle");
        player.world.addPlayerDrop(player, BELL_ID, 421, 30);
    } else if (menu === 2) {
        await npc.say(
            'This place used to be very beautiful',
            'However as our king grows old and weak',
            'the land seems to be dying too'
        );
    }
}

// "You don't look too well": the Fisher King asks after his son
async function fisherKingNotWell(player, npc) {
    await npc.say(
        "Nope I don't feel so good either",
        'I fear my life is running short',
        'Alas my son and heir is not here',
        'I am waiting for my son to return to this castle',
        'If you could find my son that would be a great weight off my shoulders'
    );
    await player.say('Who is your son?');
    await npc.say('He is known as Percival', 'I believe he is a knight of the round table');
    await player.say('I shall go and see if I can find him');
}

// "I seek the holy grail": the grail cannot be removed yet
async function fisherKingGrail(player, npc) {
    await npc.say(
        'Ah excellent, a knight come to seek the holy grail',
        "Maybe now our land can be restored to it's former glory",
        'At the moment the grail cannot be removed from the castle',
        'legend has it a questing knight will one day',
        'Work out how to restore our land',
        'then he will claim the grail as his prize'
    );
    await player.say('Any ideas how I can restore the land?');
    await npc.say('None at all');

    const menu = await player.ask(["You don't look to well", 'Do you mind if I have a look around?'], false); // sic

    if (menu === 0) {
        await player.say("You don't look too well");
        await fisherKingNotWell(player, npc);
    } else if (menu === 1) {
        await player.say('Do you mind if I have a look around?');
        await npc.say('No not at all, be my guest');
    }
}

async function fisherKing(player, npc) {
    await npc.say(
        'Ah you got inside at last',
        'You spent all that time fumbling around outside',
        "I thought you'd never make it here"
    );

    if (stageOf(player) === 3) {
        setStage(player, 4);
    }

    const menu = await player.ask(['How did you know what I have been doing?', 'I seek the holy grail', "You don't look too well"], true);

    if (menu === 0) {
        await npc.say(
            'Oh I can see what is happening in my realm',
            'I have sent clues to help you get here',
            'Such as the fisherman',
            'And the crone'
        );

        const next = await player.ask(['I seek the holy grail', "You don't look too well", 'Do you mind if I have a look around?'], true);

        if (next === 0) {
            await fisherKingGrail(player, npc);
        } else if (next === 1) {
            await fisherKingNotWell(player, npc);
        } else if (next === 2) {
            await npc.say('No not at all, be my guest');
        }
    } else if (menu === 1) {
        await fisherKingGrail(player, npc);
    } else if (menu === 2) {
        await fisherKingNotWell(player, npc);
    }
}

const TALKS = {
    [MERLIN_LIBRARY_ID]: merlin,
    [FISHERMAN_ID]: fisherman,
    [FISHER_KING_ID]: fisherKing,
    [UNHAPPY_PEASANT_ID]: async (player, npc) => {
        await npc.say('Woe is me', 'Our crops are all failing', 'How shall I feed myself this winter?');
    },
    [KING_PERCIVAL_ID]: async (player, npc) => {
        await npc.say(
            'You missed all the excitement',
            'I got here and agreed to take over duties as king here',
            'Then before my eyes the most miraculous changes occured here',
            'Grass and trees were growing outside before our very eyes',
            'Thankyou very much for showing me the way home'
        );
    },
    [HAPPY_PEASANT_ID]: async (player, npc) => {
        await npc.say('Oh happy day', 'suddenly our crops are growing again', "It'll be a bumper harvest this year");
    }
};

async function onTalkToNPC(player, npc) {
    if (!TALK_IDS.has(npc.id)) {
        return false;
    }

    player.engage(npc);

    let chaser = null;

    try {
        if (npc.id === BLACK_KNIGHT_TITAN_ID) {
            chaser = await blackKnightTitan(player, npc);
        } else {
            await TALKS[npc.id](player, npc);
        }
    } finally {
        if (player.interlocutor) {
            player.disengage();
        }
    }

    chase(player, chaser);
    return true;
}

// ---------------------------------------------------------------- doors

async function onWallObjectCommandOne(player, wallObject) {
    if (wallObject.id === MERLIN_DOOR_ID) {
        if ((stageOf(player) >= 1 && player.questStages.merlinsCrystal === -1) || stageOf(player) === -1) {
            await player.enterDoor(wallObject);
        } else {
            player.message("The door won't open");
        }

        return true;
    }

    if (wallObject.id === WHISTLE_DOOR_ID) {
        player.message('You go through the door');
        await player.enterDoor(wallObject);

        const stage = stageOf(player);

        if (player.inventory.count(MAGIC_WHISTLE_ID) !== 2 && (stage >= 3 || stage === -1)) {
            player.world.addPlayerDrop(player, MAGIC_WHISTLE_ID, 204, 2440);
            player.world.addPlayerDrop(player, MAGIC_WHISTLE_ID, 204, 2440);
        }

        return true;
    }

    return false;
}

// ---------------------------------------------------------------- items

async function blowWhistle(player) {
    const stage = stageOf(player);

    if (inBounds(player, 490, 652, 491, 653)) {
        // the square plot
        if (stage === 5 || stage === -1) {
            player.teleport(492, 18);
        } else {
            player.teleport(396, 18);
        }
    } else if (inBounds(player, 388, 4, 427, 40)) {
        // the first island
        player.teleport(490, 651);
    } else if (
        inBounds(player, 484, 4, 523, 40) ||
        inBounds(player, 511, 976, 519, 984) ||
        inBounds(player, 511, 1920, 518, 1925)
    ) {
        // the second island, its second floor and the top floor of the castle
        player.teleport(490, 651);
    } else {
        await mes(player, 'The whistle makes no noise', 'It will not work in this location');
    }
}

async function ringBell(player) {
    player.message('Ting a ling a ling');

    if (!inBounds(player, 411, 27, 425, 40)) {
        return;
    }

    if (Math.random() < 0.5) {
        const [maiden] = player.getNearbyEntitiesByID('npcs', MAIDEN_ID, 5);

        if (maiden) {
            await maiden.say('welcome to the grail castle', 'you should come inside', "It's cold out there");
        }
    }

    player.message('Somehow you are now inside the castle');
    player.teleport(420, 35);
}

// the feather points at the sack in the goblin camp
function blowFeather(player) {
    const sackX = SACK_SPOT.x;
    const sackY = SACK_SPOT.y;
    const { x, y } = player;
    const pX = x - sackX;
    const pY = y - sackY;

    if (stageOf(player) === -1) {
        player.message('nothing interesting happens');
    } else if (Math.abs(pY) > Math.abs(pX) && y <= sackY) {
        player.message('the feather points south');
    } else if (Math.abs(pX) > Math.abs(pY) && x > sackX) {
        player.message('the feather points east');
    } else if (x < sackX) {
        player.message('the feather points west');
    } else if (Math.abs(pY) > Math.abs(pX) && y >= sackY) {
        player.message('the feather points north');
    }
}

async function onInventoryCommand(player, item) {
    if (item.id === MAGIC_WHISTLE_ID) {
        await blowWhistle(player);
        return true;
    }

    if (item.id === BELL_ID) {
        await ringBell(player);
        return true;
    }

    if (item.id === MAGIC_GOLDEN_FEATHER_ID) {
        blowFeather(player);
        return true;
    }

    return false;
}

// the grail in the first castle cannot be moved
async function onGroundItemTake(player, groundItem) {
    if (groundItem.id !== HOLY_GRAIL_ID || groundItem.x !== GRAIL_SPOT.x || groundItem.y !== GRAIL_SPOT.y) {
        return false;
    }

    await mes(player, 'You feel that the grail shouldn\'t be moved', 'You must complete some task here before you are worthy');
    return true;
}

// ---------------------------------------------------------------- the titan

async function onNPCDeath(player, npc) {
    if (npc.id !== BLACK_KNIGHT_TITAN_ID || !player || !player.questStages) {
        return false;
    }

    const { world } = player;

    if (player.inventory.isEquipped(EXCALIBUR_ID)) {
        world.addPlayerDrop(player, BIG_BONES_ID, npc.x, npc.y);
        npc.abandonFight();
        world.removeEntity('npcs', npc);
        player.message('Well done you have defeated the black knight titan');
        player.teleport(414, 11);
        return true;
    }

    // the titan will not stay down without Excalibur: he is back on his feet where he stood
    npc.skills.hits.current = npc.skills.hits.base;
    npc.abandonFight();
    player.message('Maybe you need something more to beat the titan');
    await npc.say("You can't defeat me little man", "I'm invincible!");
    return true;
}

// ---------------------------------------------------------------- the sack

async function beHisHeir(player, percival) {
    await player.say('He is dying and wishes you to be his heir');
    await percival.say('I have been told that before', 'I have not been able to find that castle again though');
    await player.say('Well I do have the means to get us there - a magic whistle');

    if (player.inventory.has(MAGIC_WHISTLE_ID)) {
        await mes(player, 'You give a whistle to Sir Percival', 'You tell sir Percival what to do with the whistle');
        player.inventory.remove(MAGIC_WHISTLE_ID);
        await percival.say('Ok I will see you there then');
        setStage(player, 5);
    } else {
        await player.say('I will just go and get you one');
    }
}

async function openSack(player) {
    const { world } = player;

    await mes(player, 'You hear muffled noises from the sack');
    player.message('You open the sack');

    const percival = world.spawnTimedNPC({ id: SIR_PERCIVAL_ID, x: SACK_SPOT.x, y: SACK_SPOT.y, ticks: PERCIVAL_TICKS });

    player.engage(percival);

    try {
        await percival.say('Wow thankyou', 'I could hardly breathe in there');

        const menu = await player.ask(
            ['How did you end up in a sack?', 'Come with me, I shall make you a king', 'Your father wishes to speak to you'],
            true
        );

        const makeKing = async () => {
            await percival.say('What are you talking about?', 'The king of where?');
            await player.say('Your father is apparently someone called the fisher king');
            await beHisHeir(player, percival);
        };

        const father = async () => {
            await percival.say('My father? you have spoken to him recently?');
            await beHisHeir(player, percival);
        };

        if (menu === 0) {
            await percival.say(
                "It's a little embarrassing really",
                'After going on a long and challenging quest',
                'to retrieve the boots of arkaneeses',
                'defeating many powerful enemies on the way',
                'I fell into a goblin trap',
                "I've been kept as a slave here for the last 3 months",
                'a day or so ago, they decided it was a fun game',
                'To put me in this sack',
                'Then they forgot about me',
                "I'm now very hungry and my bones feel very stiff"
            );

            const next = await player.ask(['Come with me, I shall make you a king', 'Your father wishes to speak to you'], true);

            if (next === 0) {
                await makeKing();
            } else if (next === 1) {
                await father();
            }
        } else if (menu === 1) {
            await makeKing();
        } else if (menu === 2) {
            await father();
        }
    } finally {
        if (player.interlocutor) {
            player.disengage();
        }
    }
}

async function onGameObjectCommandOne(player, gameObject) {
    if (gameObject.id !== SACK_ID) {
        return false;
    }

    if (stageOf(player) === 4) {
        await openSack(player);
    } else {
        player.message('nothing interesting happens');
    }

    return true;
}

// the sack's second command is "prod": the Java answers any command alike
async function onGameObjectCommandTwo(player, gameObject) {
    return onGameObjectCommandOne(player, gameObject);
}

module.exports = {
    onTalkToNPC,
    onWallObjectCommandOne,
    onInventoryCommand,
    onGroundItemTake,
    onNPCDeath,
    onGameObjectCommandOne,
    onGameObjectCommandTwo
};
