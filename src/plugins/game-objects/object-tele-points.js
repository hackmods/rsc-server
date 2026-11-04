// Ported from Open-RSC Core-Framework conf/server/defs/extras/ObjectTelePoints.xml and the fixed-tile branches of
// authentic/defaults/Ladders.java, authentic/defaults/DoorAction.java (DOOR_ENTER/EXIT_GRAND_TREE),
// authentic/misc/RandomObjects.java (417, 613) and authentic/npcs/grandtree/Brimstail.java (667), authentic/misc/
// MagicGuildPortals.java, SewerValve.java (rafts), LadyOfTheWaves.java, authentic/skills/mining/Mining.java (rockslide 269),
// authentic/misc/MagicalPool.java (1155, 1166) and the quest passages of authentic/quests/members/DwarfCannon.java (982,
// 983), undergroundpass/obstacles/UndergroundPassObstaclesMap1.java (812, 733) and UndergroundPassPuzzle.java (801),
// legendsquest/obstacles/LegendsQuestGameObjects.java (1158, 1159), watchtower/WatchTowerObstacles.java (the Skavid caves
// 949-950/970-972/975, 998, 1007/1008, 1024, 969 and the cave exit walls 187-192) and Waterfall_Quest.java (raft 464)
// (AGPL-3.0)
//
// One table of objects (and wall objects) whose action only moves the player to a fixed tile. Row fields:
//   id, x, y      the object and the tile it stands on (Java keys the XML by tile and command, never id)
//   command       the object's first command, compared case-insensitively
//   to            [x, y] the player lands on
//   wall          true for a wall object (served by wall-objects/grand-tree-doors.js)
//   before/after  messages sent before / after the teleport; a number is a pause of that many ticks
//   bubble        true for the levers: the teleport bubble is shown on arrival
//   custom        async (player, row, entity): the row needs logic a table cannot say (an item, a skill, a menu, a
//                 cache flag); it replaces the plain teleport and `to` is the row's main destination
//   requires      data only, for bots and the audit: { item, consume } a carried item (consumed), { skill, level,
//                 tool } a level and a tool kind, { npc } an NPC that must be near, { cache } flags that must be set
//   alt           data only: other destinations the same click can reach, [{ to, option?, from?, requires? }]
// The second command (Search, Prospect, turn right) is served by onGameObjectCommandTwo: findTelePoint matches the
// command at the index the hook was called for.
// climbable.js asks findTelePoint so its plane shift does not claim these first. Not here: 198 prayer guild and 223
// mining guild (guilds/), 199 black hole disk (miniquests/), 1027 Mage Arena barrier and the passages gated by a
// quest's own dialogue. The quest passages here keep the Java's checks as they are even where the quest is not ported
// (the Skavid map comes from Watchtower, mageArena from Kolodion), so they work once it lands.
// The Java Champions Guild stairs 331 (150,558) and ladder 6 (148,1507), the lava forge ladder 5 (329,3418) and the Edgeville manhole 79 (243,95) are not placed in rsc-data's landscape (it has stairs 41
// at 151,558 and the emergency escape ladder 158 at 148,1507, both ordinary plane shifts), so they have no row.
//
// Note: in Ladders.java the XML lookup runs before the special 1187 branch, so the Mage Arena ladder at (446,3367)
// lands on the XML tile (223,109); the branch's teleport(222,110) is dead code.
const LEVER = 'You pull the lever';
const STAIRS_UP = 'You go up the stairs';
const CAVE_667 = ['you enter the cave', 3, 'it leads to a ladder', 3, 'you climb down'];
const GRAND_TREE_BEFORE = ['you open the door', 3];
const MAGIC_PORTAL = 'you enter the magic portal';

const PARAMAYA_REST_TICKET_ID = 987;
const SHIP_TICKET_ID = 988;
const KALEB_ID = 621;
const FAIRY_LADDER_ATTENDANT_ID = 229;
const PALADIN_ID = 323;
const MAX_FATIGUE = 75000;
const PICKAXE_IDS = Object.keys(require('@2003scape/rsc-data/skills/mining').pickaxes).map(Number);

function tell(player, ...lines) {
    for (const line of lines) {
        player.message(line);
    }
}

function nearbyNPC(player, id, range) {
    return player.getNearbyEntitiesByID('npcs', id, range).find((npc) => !npc.locked);
}

// Ladders.java 348: the wilderness lever (warning menu, cache hide_wild_lever_warn)
async function pullWildernessLever(player, row) {
    const [x, y] = row.to;

    if (!player.cache.hideWildLeverWarn) {
        tell(
            player,
            'warning pulling this lever will teleport you deep into the wilderness',
            'Are you sure you wish to pull it?'
        );

        const choice = await player.ask([
            "Yes I'm brave",
            'Eeep the wilderness no thankyou',
            "Yes please, don't show this message again"
        ]);

        if (choice === 1) {
            return;
        }

        if (choice === 2) {
            player.cache.hideWildLeverWarn = true;
        }
    }

    player.message('you pull the lever');
    player.teleport(x, y);
    player.sendTeleportBubble(x, y);
    await player.world.sleepTicks(2);

    if (player.x === x && player.y === y) {
        player.sendTeleportBubble(x, y);
    }
}

// Ladders.java 776: the Paramaya Rest hostel dormitory ladder takes a ticket
async function climbToDormitory(player, row) {
    if (player.inventory.has(PARAMAYA_REST_TICKET_ID)) {
        player.inventory.remove(PARAMAYA_REST_TICKET_ID, 1);
        tell(player, 'The barman takes your ticket and allows you up to', 'the dormitory.');
        player.teleport(...row.to);
        player.message('You climb up the ladder');
        return;
    }

    const kaleb = nearbyNPC(player, KALEB_ID, 10);

    if (!kaleb) {
        player.message('Kaleb is busy at the moment.');
        return;
    }

    player.message('You need a ticket to access the dormitory');
    await kaleb.say('You can buy a ticket to the dormitory from me.', 'And have a lovely nights rest.');
}

// Ladders.java 249: the Zanaris ladder out, a one-way trip confirmed with the Fairy Ladder attendant
async function leaveZanaris(player, row) {
    const attendant = nearbyNPC(player, FAIRY_LADDER_ATTENDANT_ID, 5);

    if (!attendant) {
        return;
    }

    await attendant.say(
        'This ladder leaves Zanaris',
        'It leads to near Al Kharid in your mortal realm',
        "You won't be able to return this way",
        'Are you sure you have sampled your fill of delights from our market?'
    );

    const choice = await player.ask(["I think I'll stay down here a bit longer", "Yes, I'm ready to leave"], true);

    if (choice === 1) {
        player.message('You climb up the ladder');
        player.teleport(...row.to);
    }
}

// Ladders.java 342: the Ardougne castle stairs; a Paladin within 4 shouts and gives chase, and if that starts a fight
// (the player is in combat after 2 ticks) the player does not climb
async function climbPaladinStairs(player, row) {
    const paladin = nearbyNPC(player, PALADIN_ID, 4);

    if (paladin) {
        paladin.broadcastChat('Stop right there', true);
        paladin.chase(player).catch(() => {});
        await player.world.sleepTicks(2);

        if (player.opponent) {
            return;
        }
    }

    player.teleport(...row.to);
    player.message('You go up the stairs');
}

// Mining.java 269: dig through the rockslide (a pickaxe and 50 Mining), to the side the player is not on
async function clearRockslide(player, row) {
    if (!PICKAXE_IDS.some((id) => player.inventory.has(id))) {
        player.message('you need a pickaxe to clear the rockslide');
    } else if (player.skills.mining.current < 50) {
        player.message('You need a mining level of 50 to clear the rockslide');
    } else {
        player.message('you manage to dig a way through the rockslide');
        player.teleport(...(player.x <= 425 ? row.to : row.alt[0].to));
    }
}

// SewerValve.java: the raft goes as far along the sewer as the valves above it are set (cache flags of the five valves)
const RAFT_STOPS = [
    { cache: ['valve1Right', 'valve2Left', 'valve3Right', 'valve4Right', 'valve5Left'], to: [587, 3411], text: ['the raft washes up the sewer, the sewer passages end here'] },
    { cache: ['valve1Right', 'valve2Left', 'valve3Right', 'valve4Right'], to: [600, 3409], text: ['the raft washes up the sewer, and stops at the fifth island'] },
    { cache: ['valve1Right', 'valve2Left', 'valve3Right'], to: [622, 3410], text: ['the raft washes up the sewer, and stops at the fourth island'] },
    { cache: ['valve1Right', 'valve2Left'], to: [622, 3422], text: ['the raft washes up the sewer, and stops at the third island'] },
    { cache: ['valve1Right'], to: [622, 3434], text: ['the raft washes up the sewer, and stops at the second island'] },
    { cache: [], to: [621, 3465], text: ['the raft washes up the sewer, and stops at the first island'] }
];
const RAFT_HINT = ['You need to find the right combination', 'of the 5 sewer valves above to get further'];

async function boardRaft(player) {
    player.message('you carefully board the small raft');
    await player.world.sleepTicks(3);

    const stop = RAFT_STOPS.find((s) => s.cache.every((key) => player.cache[key]));

    player.teleport(...stop.to);
    tell(player, ...stop.text);

    if (stop !== RAFT_STOPS[0]) {
        tell(player, ...RAFT_HINT);
    }
}

async function raftBack(player, row) {
    tell(player, 'the raft floats down the sewers', 'to the cave entrance');
    player.teleport(...row.to);
}

// LadyOfTheWaves.java: the Shilo ship takes a Ship Ticket to Khazard Port or Port Sarim
async function boardLadyOfTheWaves(player, row) {
    tell(player, 'This ship looks like it might take you somewhere.', 'The captain shouts down,', '@yel@Captain: Where would you like to go?');

    const choice = await player.ask(['Khazard Port', 'Port Sarim', 'No where thanks!']);

    if (choice === 2) {
        await player.say('No where thanks!');
        player.message('@yel@Captain: Ok, come back if you change your mind.');
        return;
    }

    const { world } = player;

    if (!player.inventory.has(SHIP_TICKET_ID)) {
        player.message('The captain shakes his head.');
        await world.sleepTicks(2);
        player.message('@yel@Captain: Sorry Bwana, but you need a ticket!');
        await world.sleepTicks(2);
        player.message('@yel@Captain: You can get one in Shilo Village ');
        await world.sleepTicks(2);
        player.message('@yel@Captain: Just above the fishing shop. ');
        await world.sleepTicks(2);
        return;
    }

    player.inventory.remove(SHIP_TICKET_ID, 1);
    player.message("@yel@Captain: Thanks for the ticket, let's set sail!");
    await world.sleepTicks(2);
    player.message('You board the ship and it sails off.');
    await world.sleepTicks(2);

    if (choice === 0) {
        player.teleport(...row.to);
        player.message("Before you know it, you're in Khazard Port.");
    } else {
        player.teleport(...row.alt[0].to);
        player.message("Before you know it, you're in Port Sarim.");
    }
}

// RandomObjects.java 613: search the Shilo village cart to climb across it, east side to west without a question
async function searchShiloCart(player, row) {
    const { world } = player;

    if (player.x >= 386) {
        player.message('You climb up onto the cart.');
        await world.sleepTicks(3);
        player.message('You nimbly jump from one side of the cart...');
        await world.sleepTicks(3);
        player.teleport(...row.alt[0].to);
        player.message('...to the other and climb down again.');
        return;
    }

    player.message('It looks as if you can climb across.');
    await world.sleepTicks(3);
    player.message('You search the cart.');
    await world.sleepTicks(3);

    if (player.fatigue >= MAX_FATIGUE) {
        player.message('You are too fatigued to attempt climb across');
        return;
    }

    player.message('You may be able to climb across the cart.');
    await world.sleepTicks(3);
    player.message('Would you like to try?');
    await world.sleepTicks(3);

    const choice = await player.ask(['Yes, I am am very nimble and agile!', 'No, I am happy where I am thanks!']);

    if (choice === 0) {
        player.message('You climb up onto the cart');
        await world.sleepTicks(3);
        player.message('You nimbly jump from one side of the cart to the other.');
        await world.sleepTicks(3);
        player.teleport(...row.to);
        player.message('And climb down again');
    } else {
        player.message('You think better of clambering over the cart, you might get dirty.');
        await world.sleepTicks(3);
        await player.say("I'd probably have just scraped my knees up as well.");
    }
}

// MagicalPool.java 1155: Kolodion's cave pool lets through only a player Kolodion has sent on (cache mage_arena >= 2;
// nothing sets player.cache.mageArena until the Mage Arena minigame is ported)
async function stepIntoKolodionPool(player, row) {
    if ((player.cache.mageArena || 0) >= 2) {
        player.teleport(...row.to);
        player.message('you are teleported further under ground');
        return;
    }

    await runSteps(player, ['you step into the pool', 2, 'you wet your boots', 2]);
}

// LegendsQuestGameObjects.java 1159 (CAVE_ENTRANCE_FROM_BOULDERS): a menu, the player does not say the option
async function enterBoulderCave(player, row) {
    await runSteps(player, ['You see a small cave entrance.', 2, 'Would you like to climb into it?', 2]);

    const choice = await player.ask(["Yes, I'll climb into it.", "No, I'll stay where I am."]);

    if (choice === 0) {
        player.message('You clamber into the small cave...');
        player.teleport(...row.to);
    } else if (choice === 1) {
        player.message('You decide against climbing into the small, uncomfortable looking tunnel.');
    }
}

// WatchTowerObstacles.java TELEPORT_CAVES (970, 972, 950, 971, 949, 975): the Skavid caves need the Skavid map and a lit
// light source. Without the map the player comes out at another cave mouth (alt[0]); with the map and no light, in the
// dark place under them (alt[1]), whose way out is rock 1008
const SKAVID_MAP_ID = 1045;
const LIGHT_SOURCE_IDS = [601, 602, 774]; // lit candle, lit black candle, lit torch
const SKAVID_DARK_PLACE = [629, 3558];
const SKAVID_CAVE_REQUIRES = { item: SKAVID_MAP_ID, anyOf: LIGHT_SOURCE_IDS.map((item) => ({ item })) };

async function enterSkavidCave(player, row) {
    if (!player.inventory.has(SKAVID_MAP_ID)) {
        player.message("There's no way I can find my way through without a map of some kind");
        player.teleport(...row.alt[0].to);
        return;
    }

    if (LIGHT_SOURCE_IDS.some((id) => player.inventory.has(id))) {
        player.message('You enter the cave');
        player.teleport(...row.to);
        return;
    }

    player.teleport(...row.alt[1].to);
    await player.say(
        "Oh my! It's dark!",
        'All I can see are lots of rocks on the floor',
        'I suppose I better search them for a way out'
    );
}

function skavidCave(id, x, y, to, noMap) {
    return {
        id,
        x,
        y,
        command: 'enter',
        to,
        requires: SKAVID_CAVE_REQUIRES,
        alt: [
            { to: noMap, from: 'no Skavid map' },
            { to: SKAVID_DARK_PLACE, from: 'a Skavid map but no lit light source' }
        ],
        custom: enterSkavidCave
    };
}

// WatchTowerObstacles.java DARK_PLACE_TELEPORT_ROCK (1008): the way out of the dark place
const DARK_PLACE_ROCKS_ID = 1007;

async function searchDarkPlaceRock(player, row) {
    tell(player, 'You search the rock', 'You uncover a tunnel entrance');
    player.teleport(...row.to);
    await player.say('Phew! At last i\'m out...', 'Next time I will take some light!');
}

// WatchTowerObstacles.java TUNNEL_CAVE (998): the island tunnel to the Skavid caves
async function enterTunnelCave(player, row) {
    player.message('You enter the cave');
    player.teleport(...row.to);
    await player.say('Wow! that tunnel went a long way');
}

// WatchTowerObstacles.java SKAVID_HOLE (969): the tunnel up to Yanille. The authentic config (want_fatigue,
// stop_skilling_fatigued 1) refuses at 95% fatigue
async function enterSkavidHole(player, row) {
    if (player.fatigue >= 0.95 * MAX_FATIGUE) {
        player.message('You are too tired to enter this tunnel');
        return;
    }

    tell(player, 'You enter the tunnel', "So that's how the skavids are getting into yanille!");
    player.teleport(...row.to);
}

// a world object of `id` on (x, y), or undefined (the fakes in tests have no world map)
function objectAt(world, id, x, y) {
    return world.gameObjects ? world.gameObjects.getAtPoint(x, y).find((o) => o.id === id) : undefined;
}

// UndergroundPassObstaclesMap1.java LEVER (733): the old bridge (726 at 704,3417) is lowered for 10 seconds (727) and
// the player is walked across it
const OLD_BRIDGE_ID = 726;
const OLD_BRIDGE_DOWN_ID = 727;
const OLD_BRIDGE_DOWN_TICKS = 16; // Java delayedSpawnObject 10000 ms, in 640 ms ticks

async function lowerOldBridge(player, row) {
    const { world } = player;

    await runSteps(player, ['you pull back on the old lever', 3, 'the bridge slowly lowers', 3]);

    const bridge = objectAt(world, OLD_BRIDGE_ID, 704, 3417);

    if (bridge) {
        world.replaceTimed('gameObjects', bridge, OLD_BRIDGE_DOWN_ID, OLD_BRIDGE_DOWN_TICKS);
    }

    player.teleport(709, 3420);
    await world.sleepTicks(1);
    player.teleport(706, 3420);
    await world.sleepTicks(1);
    player.teleport(...row.to);
    player.message('you cross the bridge');
}

// UndergroundPassPuzzle.java LEVER (801): both levers raise the railing (cage 802 at 690,3449 opens to 803 for 5
// seconds) and put the player past it
const CAGE_ID = 802;
const CAGE_OPEN_ID = 803;
const CAGE_OPEN_TICKS = 8; // Java delayedSpawnObject 5000 ms, in 640 ms ticks

async function raiseRailing(player, row) {
    const { world } = player;

    await runSteps(player, ['you pull on the lever', 3, 'you hear a loud mechanical churning', 3]);

    const cage = objectAt(world, CAGE_ID, 690, 3449);

    if (cage) {
        world.replaceTimed('gameObjects', cage, CAGE_OPEN_ID, CAGE_OPEN_TICKS);
    }

    tell(player, 'as the huge railing raises to the cave roof', 'the cage lowers behind you');
    player.teleport(...row.to);
}

// Waterfall_Quest.java 464: the log raft down the river. At Waterfall Quest stage 1 Hudon, wherever he is, answers
// and the quest moves to stage 2 (the quest itself is not ported, so only ::setquest reaches stage 1)
const HUDON_ID = 471;

async function boardLogRaft(player, row) {
    const { world } = player;

    await runSteps(player, [
        'you board the small raft',
        3,
        'and push off down stream',
        3,
        'the raft is pulled down stream by strong currents',
        3,
        'you crash into a small land mound',
        3
    ]);
    player.teleport(...row.to);

    const hudon = world.npcs ? world.npcs.getByID(HUDON_ID) : undefined;

    if (!hudon || player.questStages.waterfallQuest !== 1) {
        return;
    }

    await player.say('hello son, are you okay?');
    await hudon.say('it looks like you need the help');
    await player.say('your mum sent me to find you');
    await hudon.say("don't play nice with me", 'i know your looking for the treasure');
    await player.say('where is this treasure you talk of?');
    await hudon.say("just because i'm small doesn't mean i'm dumb", 'if i told you, you would take it all for yourself');
    await player.say('maybe i could help');
    await hudon.say("i'm fine alone");
    player.questStages.waterfallQuest = 2;
    await runSteps(player, ['hudon is refusing to leave the waterfall', 3]);
}

const TELE_POINTS = [
    // ObjectTelePoints.xml (18 entries)
    { id: 1188, x: 223, y: 110, command: 'Climb-Down', to: [446, 3368] },
    { id: 1187, x: 446, y: 3367, command: 'Climb-Up', to: [223, 109] },
    { id: 156, x: 414, y: 1107, command: 'walk through', to: [700, 1395], wall: true },
    { id: 156, x: 701, y: 1395, command: 'walk through', to: [414, 1107], wall: true },
    { id: 155, x: 419, y: 1107, command: 'walk through', to: [708, 1395], wall: true },
    { id: 155, x: 707, y: 1395, command: 'walk through', to: [418, 1107], wall: true },
    { id: 630, x: 576, y: 3577, command: 'Go down', to: [576, 3528] },
    { id: 160, x: 702, y: 2338, command: 'walk through', to: [415, 2051], wall: true },
    { id: 158, x: 705, y: 2338, command: 'walk through', to: [417, 2051], wall: true },
    { id: 159, x: 703, y: 2340, command: 'walk through', to: [416, 2052], wall: true },
    { id: 157, x: 703, y: 2337, command: 'walk through', to: [416, 2050], wall: true },
    { id: 157, x: 416, y: 2050, command: 'walk through', to: [703, 2336], wall: true },
    { id: 159, x: 416, y: 2053, command: 'walk through', to: [703, 2340], wall: true },
    { id: 160, x: 415, y: 2051, command: 'walk through', to: [701, 2338], wall: true },
    { id: 158, x: 418, y: 2051, command: 'walk through', to: [705, 2338], wall: true },
    { id: 585, x: 416, y: 2051, command: 'climb-up', to: [417, 2994] },
    { id: 586, x: 417, y: 2993, command: 'Climb-down', to: [415, 2051] },
    { id: 616, x: 703, y: 3283, command: 'climb-up', to: [416, 162] },
    // Ladders.java fixed-tile branches
    { id: 629, x: 576, y: 3529, command: 'Go up', to: [576, 3580], after: [STAIRS_UP] },
    { id: 621, x: 605, y: 3509, command: 'Go up', to: [606, 3556], after: [STAIRS_UP] },
    { id: 5, x: 98, y: 2930, command: 'Climb-Up', to: [243, 96], after: ['You climb up the ladder'] },
    { id: 5, x: 137, y: 2932, command: 'Climb-Up', to: [243, 96], after: ['You climb up the ladder'] },
    { id: 41, x: 516, y: 1479, command: 'Go up', to: [516, 2426], before: [STAIRS_UP] },
    { id: 41, x: 316, y: 546, command: 'Go up', to: [316, 1493], before: [STAIRS_UP] },
    { id: 487, x: 282, y: 3020, command: 'pull', to: [567, 3330], before: [LEVER], bubble: true },
    { id: 488, x: 567, y: 3331, command: 'pull', to: [282, 3019], before: [LEVER], bubble: true },
    { id: 349, x: 180, y: 129, command: 'pull', to: [621, 596], before: [LEVER], bubble: true },
    { id: 348, x: 621, y: 596, command: 'pull', to: [180, 128], custom: pullWildernessLever },
    { id: 776, x: 395, y: 1770, command: 'Climb-Up', to: [395, 2713], requires: { item: PARAMAYA_REST_TICKET_ID, consume: 1 }, custom: climbToDormitory },
    { id: 342, x: 611, y: 601, command: 'Go up', to: [611, 1544], requires: { npc: PALADIN_ID }, custom: climbPaladinStairs },
    { id: 249, x: 98, y: 3537, command: 'Climb-Up', to: [98, 706], requires: { npc: FAIRY_LADDER_ATTENDANT_ID }, custom: leaveZanaris },
    // RandomObjects.java 417 (Hazeel cult cave) and Brimstail.java 667
    { id: 417, x: 619, y: 649, command: 'enter', to: [617, 3479], before: ['you enter the cave'], after: ['it leads downwards to the sewer'] },
    { id: 667, x: 731, y: 501, command: 'enter', to: [730, 3334], before: CAVE_667 },
    { id: 667, x: 694, y: 632, command: 'enter', to: [730, 3334], before: CAVE_667 },
    // MagicGuildPortals.java (wall objects 147, 148, 149)
    { id: 147, x: 602, y: 2642, command: 'enter', to: [212, 695], before: [MAGIC_PORTAL], bubble: true, wall: true },
    { id: 147, x: 603, y: 2642, command: 'enter', to: [212, 695], before: [MAGIC_PORTAL], bubble: true, wall: true },
    { id: 148, x: 599, y: 2645, command: 'enter', to: [511, 1452], before: [MAGIC_PORTAL], bubble: true, wall: true },
    { id: 148, x: 599, y: 2646, command: 'enter', to: [511, 1452], before: [MAGIC_PORTAL], bubble: true, wall: true },
    { id: 149, x: 602, y: 2650, command: 'enter', to: [362, 1515], before: [MAGIC_PORTAL], bubble: true, wall: true },
    { id: 149, x: 603, y: 2650, command: 'enter', to: [362, 1515], before: [MAGIC_PORTAL], bubble: true, wall: true },
    // Mining.java 269, SewerValve.java rafts 432/433, LadyOfTheWaves.java 780/781, RandomObjects.java 613
    { id: 269, x: 426, y: 438, command: 'Mine', to: [428, 438], alt: [{ to: [425, 438] }], requires: { skill: 'mining', level: 50, tool: 'pickaxe' }, custom: clearRockslide },
    {
        id: 432,
        x: 621,
        y: 3477,
        command: 'board',
        to: [621, 3465],
        alt: RAFT_STOPS.slice(0, 5).reverse().map((s) => ({ to: s.to, requires: { cache: s.cache } })),
        custom: boardRaft
    },
    ...[[622, 3436], [621, 3409], [621, 3422], [622, 3464], [600, 3410], [589, 3409]].map(([x, y]) => ({ id: 433, x, y, command: 'board', to: [620, 3478], custom: raftBack })),
    { id: 780, x: 471, y: 850, command: 'board', to: [545, 703], alt: [{ to: [269, 640], option: 'Port Sarim' }], requires: { item: SHIP_TICKET_ID, consume: 1 }, custom: boardLadyOfTheWaves },
    { id: 781, x: 466, y: 850, command: 'board', to: [545, 703], alt: [{ to: [269, 640], option: 'Port Sarim' }], requires: { item: SHIP_TICKET_ID, consume: 1 }, custom: boardLadyOfTheWaves },
    { id: 613, x: 384, y: 851, command: 'Search', to: [386, 852], alt: [{ to: [383, 852], from: 'east side (x >= 386)' }], custom: searchShiloCart },
    // DoorAction.java DOOR_EXIT_GRAND_TREE (154) and DOOR_ENTER_GRAND_TREE (153)
    { id: 154, x: 416, y: 166, command: 'walk through', to: [703, 455], before: GRAND_TREE_BEFORE, after: ['and walk through'], wall: true },
    { id: 153, x: 703, y: 455, command: 'walk through', to: [416, 165], before: GRAND_TREE_BEFORE, after: ['and walk through'], wall: true },
    // DwarfCannon.java 982 (only the cave at y 523) and 983, the goblin cave and its mudpile
    { id: 982, x: 576, y: 523, command: 'enter', to: [578, 3356], before: ['you cautiously enter the cave', 3] },
    { id: 983, x: 577, y: 3355, command: 'climb', to: [578, 521], before: ['you climb the mudpile', 3] },
    // UndergroundPassObstaclesMap1.java DROP_DOWN_LEDGE 812 and LEVER 733, UndergroundPassPuzzle.java LEVER 801
    { id: 812, x: 706, y: 3440, command: 'drop down', to: [706, 3439], before: ['you drop down to the cave floor'] },
    { id: 733, x: 711, y: 3418, command: 'pull', to: [703, 3420], custom: lowerOldBridge },
    { id: 801, x: 689, y: 3444, command: 'pull', to: [690, 3451], custom: raiseRailing },
    { id: 801, x: 689, y: 3453, command: 'pull', to: [690, 3451], custom: raiseRailing },
    // LegendsQuestGameObjects.java CAVE_ENTRANCE_LEAVE_DUNGEON 1158 and CAVE_ENTRANCE_FROM_BOULDERS 1159
    { id: 1158, x: 462, y: 3699, command: 'Enter', to: [452, 874], before: ['You crawl back out from the cavern...', 2] },
    { id: 1159, x: 446, y: 3698, command: 'enter', to: [452, 3702], custom: enterBoulderCave },
    // MagicalPool.java 1155 (requires.cache: Java checks mage_arena >= 2) and 1166
    { id: 1155, x: 446, y: 3374, command: 'step into', to: [471, 3385], requires: { cache: ['mageArena'] }, custom: stepIntoKolodionPool },
    {
        id: 1166,
        x: 471,
        y: 3383,
        command: 'step into',
        to: [447, 3373],
        before: ['you step into the sparkling water', 2, 'you feel energy rush through your veins', 2],
        after: ['you are teleported to kolodions cave']
    },
    // WatchTowerObstacles.java: TELEPORT_CAVES, the dark place rock 1008, TUNNEL_CAVE 998, OGRE_ENCLAVE_EXIT 1024,
    // SKAVID_HOLE 969 and the CAVE_EXITS wall objects 187-192
    skavidCave(970, 649, 770, [650, 3555], [629, 777]),
    skavidCave(970, 640, 786, [650, 3555], [629, 777]),
    skavidCave(972, 628, 778, [626, 3564], [624, 807]),
    skavidCave(950, 625, 807, [627, 3591], [648, 769]),
    skavidCave(971, 638, 779, [638, 3564], [631, 789]),
    skavidCave(949, 630, 788, [629, 3574], [629, 777]),
    skavidCave(975, 647, 812, [647, 3596], [638, 777]),
    { id: 1008, x: 654, y: 3580, command: 'Search', to: [638, 776], custom: searchDarkPlaceRock },
    { id: 998, x: 668, y: 825, command: 'enter', to: [605, 803], custom: enterTunnelCave },
    { id: 1024, x: 648, y: 3604, command: 'enter', to: [662, 788] },
    { id: 969, x: 651, y: 3592, command: 'enter', to: [609, 742], custom: enterSkavidHole },
    { id: 187, x: 626, y: 3591, command: 'Leave', to: [624, 807], wall: true },
    { id: 188, x: 649, y: 3554, command: 'Leave', to: [648, 769], wall: true },
    { id: 189, x: 638, y: 3563, command: 'Leave', to: [638, 777], wall: true },
    { id: 190, x: 627, y: 3563, command: 'Leave', to: [629, 777], wall: true },
    { id: 191, x: 629, y: 3573, command: 'Leave', to: [631, 789], wall: true },
    { id: 192, x: 646, y: 3596, command: 'Leave', to: [645, 812], wall: true },
    // Waterfall_Quest.java 464, the log raft
    { id: 464, x: 660, y: 449, command: 'board', to: [662, 463], custom: boardLogRaft }
];

// the row for this object's click, or undefined. commandIndex 0 is the first command, 1 the second.
function findTelePoint(entity, { wall = false, commandIndex = 0 } = {}) {
    const command = entity.definition && entity.definition.commands && entity.definition.commands[commandIndex];

    if (!command) {
        return undefined;
    }

    return TELE_POINTS.find(
        (row) =>
            Boolean(row.wall) === wall &&
            row.id === entity.id &&
            row.x === entity.x &&
            row.y === entity.y &&
            row.command.toLowerCase() === command.toLowerCase()
    );
}

async function runSteps(player, steps = []) {
    for (const step of steps) {
        if (typeof step === 'number') {
            await player.world.sleepTicks(step);
        } else {
            player.message(step);
        }
    }
}

async function travel(player, row, entity) {
    if (row.custom) {
        await row.custom(player, row, entity);
        return true;
    }

    const [x, y] = row.to;

    await runSteps(player, row.before);
    player.teleport(x, y);
    await runSteps(player, row.after);

    if (row.bubble) {
        // Ladders.java: delay(), then the bubble on arrival
        await player.world.sleepTicks(2);

        if (player.x === x && player.y === y) {
            player.sendTeleportBubble(x, y);
        }
    }

    return true;
}

// SewerValve.java: turning a valve sets or clears one cache flag. [object id]: [flag, flag is set when turned left]
const VALVES = {
    412: ['valve1Right', false],
    413: ['valve2Left', true],
    414: ['valve3Right', false],
    415: ['valve4Right', false],
    416: ['valve5Left', true]
};

function turnValve(player, gameObject, left) {
    const [flag, setOnLeft] = VALVES[gameObject.id];

    tell(
        player,
        'you turn the large metal',
        `valve to the ${left ? 'left' : 'right'}`,
        'beneath the soil you can',
        'hear the gushing of water'
    );

    if (left === setOnLeft) {
        player.cache[flag] = true;
    } else {
        delete player.cache[flag];
    }
}

async function onGameObjectCommandOne(player, gameObject) {
    if (VALVES[gameObject.id]) {
        turnValve(player, gameObject, true);
        return true;
    }

    // WatchTowerObstacles.java DARK_PLACE_ROCKS: every other rock of the dark place (the Java claims the id everywhere)
    if (gameObject.id === DARK_PLACE_ROCKS_ID) {
        tell(player, 'You search the rock', "There's nothing here");
        return true;
    }

    const row = findTelePoint(gameObject);

    if (!row) {
        return false;
    }

    return travel(player, row, gameObject);
}

async function onGameObjectCommandTwo(player, gameObject) {
    if (VALVES[gameObject.id]) {
        turnValve(player, gameObject, false);
        return true;
    }

    // Mining.java 269 prospect
    if (gameObject.id === 269) {
        tell(player, 'these rocks contain nothing interesting', 'they are just in the way');
        return true;
    }

    const row = findTelePoint(gameObject, { commandIndex: 1 });

    if (!row) {
        return false;
    }

    return travel(player, row, gameObject);
}

module.exports = { TELE_POINTS, VALVES, findTelePoint, travel, onGameObjectCommandOne, onGameObjectCommandTwo };
