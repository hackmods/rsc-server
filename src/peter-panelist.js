// Peter Panelist: a folk-tale NPC who hides across the world and hops to a new hiding place every 1-2 minutes.
// Talk to him once per hiding place: 1 in 5 gives a Christmas cracker (pull it with a friend for the party table in
// plugins/items/christmas-cracker.js), otherwise coins from 1 to 100,000. Talk: plugins/npcs/peter-panelist.js.
// Rumours about him in taverns: plugins/npcs/peter-rumours.js. Knowledge: Autonomous-RSC source/knowledge/rsc-peter-panelist.md.
// Not in the 2001 game; the lone Leprechaun (211) has no other spawn, and the client shows that name and body.

const PETER_NPC_ID = 211;
const CHRISTMAS_CRACKER_ID = 575;
const COINS_ID = 10;
const CRACKER_CHANCE = 0.2;

// 640ms ticks: a hop every 94 to 188 ticks is 60 to 120 seconds
const HOP_MIN_TICKS = 94;
const HOP_MAX_TICKS = 188;
const RETRY_TICKS = 5;
const SHOUT_TICKS = 12;
const SHOUT_CHANCE = 0.7;
const RECENT_SPOTS = 6;

// every spot was snapped to an open tile of the landscape with a walkable region of at least 400 tiles
// (test/peter-panelist.test.js re-checks the list against the real landscape)
const SPOTS = [
    { id: 'swamp', name: 'the Lumbridge swamp, by the old shack', x: 116, y: 710 },
    { id: 'shantay', name: 'the edge of the desert by the Shantay Pass', x: 65, y: 733 },
    { id: 'bedabin', name: 'a Bedabin camp deep in the desert', x: 175, y: 810 },
    { id: 'oziach', name: 'a lonely hut above Edgeville', x: 244, y: 447 },
    { id: 'monastery', name: 'the grounds of the monastery', x: 253, y: 469 },
    { id: 'oracle', name: 'the snow by the Oracle on Ice Mountain', x: 288, y: 456 },
    { id: 'stonecircle', name: 'the stone circle near Taverley', x: 364, y: 460 },
    { id: 'observatory', name: 'the observatory, far to the west', x: 714, y: 682 },
    { id: 'scorpius', name: 'the grave of Scorpius', x: 692, y: 649 },
    { id: 'battlefield', name: 'the Khazard battlefield', x: 654, y: 627 },
    { id: 'ogres', name: "the stinking ogre lands of Gu'Tanoth", x: 612, y: 791 },
    { id: 'zoo', name: 'behind the Ardougne zoo', x: 573, y: 612 },
    { id: 'omad', name: 'the monks south of Ardougne', x: 582, y: 667 },
    { id: 'wizards', name: "the Wizards' Tower", x: 597, y: 755 },
    { id: 'entrana', name: 'the island of Entrana', x: 412, y: 560 },
    { id: 'gnomeball', name: 'the gnome ball field', x: 733, y: 457 },
    { id: 'sinclair', name: 'the Sinclair mansion grounds', x: 482, y: 390 },
    { id: 'barbarian', name: 'a Barbarian Village longhouse', x: 233, y: 502 },
    { id: 'sheep', name: "Fred the farmer's sheep field", x: 160, y: 618 },
    { id: 'manor', name: 'the gates of Draynor Manor', x: 210, y: 568 },
    { id: 'park', name: 'the Falador park', x: 289, y: 544 },
    { id: 'goblins', name: 'the goblin village', x: 325, y: 448 },
    { id: 'doric', name: "Doric's hut on the hill", x: 329, y: 488 },
    { id: 'gnomevillage', name: 'the gnome tree village', x: 658, y: 448 },
    { id: 'stronghold', name: 'the Gnome Stronghold', x: 711, y: 536 },
    { id: 'shilo', name: 'Shilo Village', x: 383, y: 854 },
    { id: 'bandits', name: 'the Bandit camp in the Wilderness', x: 280, y: 296 },
    { id: 'camelot', name: 'Camelot castle', x: 463, y: 434 },
    { id: 'lucien', name: 'north-east of Varrock, where Lucien lurks', x: 165, y: 470 },
    { id: 'darkmage', name: "a dark mage's hideaway", x: 666, y: 567 },
    { id: 'thordur', name: "Thordur's chamber in the Dwarven Mine", x: 313, y: 3348 },
    { id: 'taibwo', name: 'the Tai Bwo Wannai jungle', x: 438, y: 752 },
    { id: 'dwarfmine', name: 'the dwarven mine tunnels', x: 276, y: 565 },
    { id: 'seers', name: "the coal trucks outside Seers' Village", x: 614, y: 454 }
];

// coin tiers: weight out of 1000, inclusive range. Small change is common, a fortune is a legend.
const COIN_TIERS = [
    { weight: 500, min: 1, max: 100 },
    { weight: 300, min: 101, max: 1000 },
    { weight: 140, min: 1001, max: 10000 },
    { weight: 55, min: 10001, max: 50000 },
    { weight: 5, min: 50001, max: 100000 }
];

const SHOUTS = [
    'Psst! Over here!',
    'Nobody ever finds the panelist!',
    'Order, order!',
    'The panel is in session!',
    "I'm not hiding. You're just not looking!",
    'Pssst... free prizes!',
    'Ahem! Panelist present!',
    'The panel demands a contestant!'
];

function randInt(min, max, random = Math.random) {
    return min + Math.floor(random() * (max - min + 1));
}

function nextHopTicks(random = Math.random) {
    return randInt(HOP_MIN_TICKS, HOP_MAX_TICKS, random);
}

// never one of the last few spots
function pickSpot(recentIds = [], random = Math.random) {
    const fresh = SPOTS.filter((spot) => !recentIds.includes(spot.id));
    const pool = fresh.length ? fresh : SPOTS;

    return pool[Math.floor(random() * pool.length)];
}

// { kind: 'cracker' } 1 time in 5, otherwise { kind: 'coins', amount } from 1 to 100,000
function rollReward(random = Math.random) {
    if (random() < CRACKER_CHANCE) {
        return { kind: 'cracker' };
    }

    const roll = random() * 1000;
    let upTo = 0;

    for (const tier of COIN_TIERS) {
        upTo += tier.weight;

        if (roll < upTo) {
            return { kind: 'coins', amount: randInt(tier.min, tier.max, random) };
        }
    }

    const last = COIN_TIERS[COIN_TIERS.length - 1];

    return { kind: 'coins', amount: randInt(last.min, last.max, random) };
}

function isPeter(npc) {
    return !!npc && npc.peterPanelist === true;
}

// the one Peter in the world
const state = { world: null, npc: null, recent: [], hops: 0 };

function hide(world, spot) {
    const npc = world.spawnTimedNPC({ id: PETER_NPC_ID, x: spot.x, y: spot.y });

    npc.peterPanelist = true;
    npc.spot = spot;
    npc.rewarded = new Set();
    state.npc = npc;
    state.recent = [spot.id, ...state.recent].slice(0, RECENT_SPOTS);
    state.hops += 1;

    return npc;
}

function hop(world) {
    const old = state.npc;

    // someone is mid-conversation: let them finish
    if (old && old.interlocutor) {
        world.setTickTimeout(() => hop(world), RETRY_TICKS);
        return;
    }

    if (old) {
        old.abandonFight();
        world.removeEntity('npcs', old);
    }

    hide(world, pickSpot(state.recent));
    world.setTickTimeout(() => hop(world), nextHopTicks());
}

// he calls attention to himself while anyone can see him and he is not busy
function shout(world) {
    const npc = state.npc;

    if (npc && !npc.interlocutor && npc.knownPlayers && npc.knownPlayers.size > 0 && Math.random() < SHOUT_CHANCE) {
        npc.broadcastChat(SHOUTS[Math.floor(Math.random() * SHOUTS.length)], true);
    }

    world.setTickTimeout(() => shout(world), SHOUT_TICKS);
}

function start(world) {
    if (state.world === world) {
        return;
    }

    state.world = world;
    hide(world, pickSpot());
    world.setTickTimeout(() => hop(world), nextHopTicks());
    world.setTickTimeout(() => shout(world), SHOUT_TICKS);
}

// the last few hiding places, newest first (stale news makes the best rumour)
function recentSpots() {
    return state.recent.map((id) => SPOTS.find((spot) => spot.id === id)).filter(Boolean);
}

module.exports = {
    PETER_NPC_ID,
    CHRISTMAS_CRACKER_ID,
    COINS_ID,
    CRACKER_CHANCE,
    HOP_MIN_TICKS,
    HOP_MAX_TICKS,
    SPOTS,
    COIN_TIERS,
    SHOUTS,
    nextHopTicks,
    pickSpot,
    rollReward,
    isPeter,
    recentSpots,
    hop,
    start,
    state
};
