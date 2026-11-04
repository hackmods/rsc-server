// Ported from Open-RSC Core-Framework authentic/quests/members/grandtree/GrandTree.java (AGPL-3.0) and the Daconia rock
// branch of authentic/skills/mining/Mining.java: the watch tower (635 up at 710,1420, agility 25; 646 down), the stone
// stand on top (634 at 709,2364) and the four pebbles, Glough's lair under the tree with the Black Demon (568), the
// roots (609, 610, 637: the Daconia rock 931 is in the root at 707,3297), the roots to the gnome mine (638, 639) and the
// Daconia rocks (699, no ore). Stages 13-16: the stage table is in narnode.js.
// Cache flags: pebble1..pebble4 (Java pebble_1..4), set when that pebble goes in its own indent:
//   far left 927 (ho), centre left 928 (ni), centre right 929 (:::), far right 930 (ha).

const GLOUGH_UNDERGROUND_ID = 566;
const BLACK_DEMON_ID = 568;

const WATCH_TOWER_UP_ID = 635;
const WATCH_TOWER_DOWN_ID = 646;
const STONE_STAND_ID = 634;
const ROOT_IDS = new Set([609, 610, 637]);
const DACONIA_ROOT_ID = 637;
const PUSH_ROOT_ID = 638;
const PUSH_ROOT_BACK_ID = 639;
const DACONIA_ROCKS_ID = 699;

const DACONIA_ROCK_ID = 931;
// indent (menu index) -> the pebble that belongs there and its cache flag
const INDENTS = [
    { pebble: 927, flag: 'pebble1' },
    { pebble: 928, flag: 'pebble2' },
    { pebble: 929, flag: 'pebble3' },
    { pebble: 930, flag: 'pebble4' }
];
const PEBBLE_IDS = new Set(INDENTS.map((indent) => indent.pebble));
const PICKAXES = require('@2003scape/rsc-data/skills/mining').pickaxes;

// addnpc(..., 63 s) and (..., 250 s) as 640 ms ticks
const GLOUGH_TICKS = Math.ceil(63000 / 640);
const DEMON_TICKS = Math.ceil(250000 / 640);
const LAIR = [711, 3306];

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

function clearPebbles(player) {
    for (const { flag } of INDENTS) {
        delete player.cache[flag];
    }
}

async function dropIntoLair(player) {
    await mes(player, 'you squeeze down the inner of the tree trunk');
    await mes(player, 'you drop out of the bottom onto a mud floor');
    player.teleport(...LAIR);
}

async function gloughsAmbush(player) {
    const { world } = player;

    await world.sleepTicks(2);
    await mes(player, 'around you, you can see piles of strange looking rocks');
    await mes(player, 'you here the sound of small footsteps coming from the darkness'); // sic

    // glough despawns in almost 1 minute
    const glough = world.spawnTimedNPC({ id: GLOUGH_UNDERGROUND_ID, x: 709, y: 3306, ticks: GLOUGH_TICKS });

    await glough.say(
        'you really are becoming a headache',
        'well, at least now you can die knowing you were right',
        'it will save me having to hunt you down',
        'like all the over human filth of runescape' // sic
    );
    await player.say("you're crazy glough");
    await glough.say(
        "i'm angry, you think you're so special",
        "well, soon you'll see, the gnome's are ready to fight",
        'in three weeks this tree will be dead wood',
        'in ten weeks it will be 30 battleships',
        'ready to finally rid the world of the disease called humanity'
    );
    await player.say("what makes you think i'll let you get away with it?");
    await glough.say('ha, do you think i would challange you humans alone', 'fool.....meet my little friend'); // sic
    await mes(player, 'from the darkness you hear a deep growl');
    await mes(player, 'and the sound of heavy footsteps');

    const demon = world.spawnTimedNPC({ id: BLACK_DEMON_ID, x: 709, y: 3306, ticks: DEMON_TICKS });

    if (typeof demon.broadcastChat === 'function') {
        demon.broadcastChat('grrrrr');
    }

    demon.attack(player).catch(() => {});
}

async function pushStand(player) {
    const { world } = player;
    const stage = stageOf(player);

    if (stage === 15 || stage === 16 || stage === -1) {
        await dropIntoLair(player);
        return;
    }

    await mes(player, 'you push down on the pillar');
    player.message('you feel it shift downwards slightly');
    await world.sleepTicks(4);

    const placed = INDENTS.every(({ flag }) => player.cache[flag]);

    if (!placed && stage !== 14) {
        player.message('you here some noise below the pillar...'); // sic
        player.message('...but nothing seems to happen');
        return;
    }

    clearPebbles(player);

    if (stage === 13) {
        setStage(player, 14);
    }

    player.message('the pillar shifts back revealing a ladder');
    await world.sleepTicks(4);
    await mes(player, 'it seems to lead down through the tree trunk');

    // multi(player, ...): the player says the choice
    const menu = await player.ask(['climb down', 'come back later'], true);

    if (menu === 0) {
        await dropIntoLair(player);
        await gloughsAmbush(player);
    } else if (menu === 1) {
        player.message('you decide to come back later');
    }
}

async function placePebble(player, item) {
    await mes(player, 'on top are four pebble size indents');
    await mes(player, 'they span from left to right');
    await mes(player, 'you place the pebble...');

    const menu = await player.ask(['To the far left', 'Centre left', 'Centre right', 'To the far right'], true);
    const indent = INDENTS[menu];

    if (!indent) {
        return;
    }

    await mes(player, 'you place the pebble in the indent');
    await mes(player, 'it crumbles into dust');
    player.inventory.remove(item.id);

    if (item.id === indent.pebble) {
        player.cache[indent.flag] = true;
    }
}

async function climbTower(player) {
    const { world } = player;

    if (player.isTired()) {
        player.message('you are too tired to climb up the tower');
        return;
    }

    if (player.skills.agility.current < 25) {
        player.message('You need an agility level of 25 to climb up the platform');
        return;
    }

    player.message('you jump up and grab hold of the platform');
    player.teleport(710, 2364);
    player.addExperience('agility', 30);
    await world.sleepTicks(5);
    player.message('and pull yourself up');
}

async function searchRoot(player, gameObject) {
    await mes(player, 'you search the root...');

    if (gameObject.id === DACONIA_ROOT_ID && stageOf(player) === 16) {
        if (!player.inventory.has(DACONIA_ROCK_ID)) {
            await mes(player, 'and find a small glowing rock');
            player.inventory.add(DACONIA_ROCK_ID);
        } else {
            await mes(player, 'but find nothing');
        }

        return;
    }

    await mes(player, '...but find nothing');
}

// ACCESS TO GNOME MINE, after the quest
async function pushRoot(player, gameObject) {
    await mes(player, 'you push the roots');

    if (stageOf(player) !== -1) {
        await mes(player, "they don't seem to mind");
        return;
    }

    await mes(player, 'they wrap around your arms');
    player.message('and drag you deeper forwards');

    if (gameObject.id === PUSH_ROOT_BACK_ID) {
        player.teleport(700, 3280);
    } else {
        player.teleport(701, 3278);
    }
}

function bestPickaxe(player) {
    const level = player.skills.mining.current;

    return Object.entries(PICKAXES)
        .filter(([id, { level: needed }]) => needed <= level && player.inventory.has(Number(id)))
        .sort(([, a], [, b]) => b.attempts - a.attempts)
        .map(([id]) => Number(id))[0];
}

// Mining.java: a rock with no ObjectMiningDef row
async function mineDaconia(player) {
    if (!bestPickaxe(player)) {
        await mes(player, 'You need a pickaxe to mine this rock');
        await mes(player, 'You do not have a pickaxe which you have the mining level to use');
        return;
    }

    player.sendSound('mine');
    player.sendBubble(156); // the Java shows the bronze pickaxe whichever is used
    player.message('@que@You swing your pick at the rock...');
    await player.world.sleepTicks(3);
    player.message('@que@There is currently no ore available in this rock');
}

async function prospectDaconia(player) {
    player.sendSound('prospect');
    player.message('@que@You examine the rock for ores...');
    await player.world.sleepTicks(3);
    player.message('@que@You fail to find anything interesting');
}

async function onGameObjectCommandOne(player, gameObject) {
    switch (gameObject.id) {
        case WATCH_TOWER_UP_ID:
            await climbTower(player);
            return true;
        case PUSH_ROOT_ID:
        case PUSH_ROOT_BACK_ID:
            await pushRoot(player, gameObject);
            return true;
        case DACONIA_ROCKS_ID:
            await mineDaconia(player);
            return true;
    }

    if (ROOT_IDS.has(gameObject.id)) {
        await searchRoot(player, gameObject);
        return true;
    }

    return false;
}

async function onGameObjectCommandTwo(player, gameObject) {
    switch (gameObject.id) {
        case WATCH_TOWER_DOWN_ID:
            await mes(player, 'you climb down the tower');
            player.teleport(712, 1420);
            await mes(player, 'and drop to the platform below');
            return true;
        case STONE_STAND_ID:
            await pushStand(player);
            return true;
        case DACONIA_ROCKS_ID:
            await prospectDaconia(player);
            return true;
    }

    return false;
}

async function onUseWithGameObject(player, gameObject, item) {
    if (gameObject.id !== STONE_STAND_ID || !PEBBLE_IDS.has(item.id)) {
        return false;
    }

    await placePebble(player, item);
    return true;
}

// never claims: the demon dies like any npc; Glough flees
async function onNPCDeath(player, npc) {
    if (npc.id !== BLACK_DEMON_ID || !player || !player.questStages || stageOf(player) !== 14) {
        return false;
    }

    setStage(player, 15);

    for (const glough of player.getNearbyEntitiesByID('npcs', GLOUGH_UNDERGROUND_ID, 15)) {
        player.world.removeEntity('npcs', glough);
    }

    (async () => {
        await mes(player, 'the beast slumps to the floor');
        await mes(player, 'glough has fled');
    })().catch(() => {});

    return false;
}

module.exports = { onGameObjectCommandOne, onGameObjectCommandTwo, onUseWithGameObject, onNPCDeath };
