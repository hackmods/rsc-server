// Ported from Open-RSC Core-Framework conf/server/defs/extras/ObjectTelePoints.xml and the fixed-tile branches of
// authentic/defaults/Ladders.java, authentic/defaults/DoorAction.java (DOOR_ENTER/EXIT_GRAND_TREE),
// authentic/misc/RandomObjects.java (417, 613) and authentic/npcs/grandtree/Brimstail.java (667), authentic/misc/
// MagicGuildPortals.java, SewerValve.java (rafts), LadyOfTheWaves.java, authentic/skills/mining/Mining.java (rockslide 269)
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
// mining guild (guilds/), 199 black hole disk (miniquests/), 1027 Mage Arena barrier and
// every quest-gated passage. The Java Champions Guild stairs 331 (150,558) and ladder 6 (148,1507), the lava forge
// ladder 5 (329,3418) and the Edgeville manhole 79 (243,95) are not placed in rsc-data's landscape (it has stairs 41
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
    { id: 153, x: 703, y: 455, command: 'walk through', to: [416, 165], before: GRAND_TREE_BEFORE, after: ['and walk through'], wall: true }
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
