// https://classic.runescape.wiki/w/Woodcutting

const items = require('@2003scape/rsc-data/config/items');
const { axes, trees } = require('@2003scape/rsc-data/skills/woodcutting');
const { rollSkillSuccess } = require('../../rolls');

// percent chance a tree falls after a log is cut: the `fell` field of Open-RSC Core-Framework
// conf/server/defs/extras/ObjectWoodcutting.xml, rolled as DataConversions.random(1, 100) <= fell by authentic
// Woodcutting.java. Normal trees (0, 1, 70) are 100: they always fall.
const FELL_CHANCE = new Map([
    [0, 100],
    [1, 100],
    [70, 100],
    [306, 10], // oak
    [307, 12], // willow
    [308, 15], // maple
    [309, 17], // yew
    [310, 20] // magic
]);
// a tree missing from FELL_CHANCE (none today) falls like the old flat 12.5% roll
const DEFAULT_FELL = 12;
const TREE_IDS = new Set(Object.keys(trees).map(Number));

// in order of best to worst
// > Unlike RuneScape 2, there is no woodcutting level requirement to use each
// > axe for woodcutting
// this is unlike pickaxes, which do require mining levels to use
const AXE_IDS = Object.keys(axes)
    .map(Number)
    .sort((a, b) => {
        if (axes[a] === axes[b]) {
            return 0;
        }

        return axes[a] > axes[b] ? -1 : 1;
    });

function getDefinition(id) {
    const tree = trees[id];

    if (typeof tree.reference !== 'undefined') {
        return getDefinition(tree.reference);
    }

    return tree;
}

async function onGameObjectCommand(player, gameObject) {
    const treeID = gameObject.id;

    if (!TREE_IDS.has(treeID)) {
        return false;
    }

    const tree = getDefinition(treeID);
    const woodcuttingLevel = player.skills.woodcutting.current;

    if (tree.level > woodcuttingLevel) {
        player.message(
            `You need a woodcutting level of ${tree.level} to axe this tree`
        );

        return true;
    }

    let bestAxeID = -1;

    for (const axeID of AXE_IDS) {
        if (player.inventory.has(axeID)) {
            bestAxeID = axeID;
            break;
        }
    }

    if (bestAxeID === -1) {
        player.message('@que@You need an axe to chop this tree down');
        return true;
    }

    if (player.isTired()) {
        player.message('@que@You are too tired to cut the tree');
        return true;
    }

    const { world } = player;
    const { x, y } = gameObject;
    const axeName = items[bestAxeID].name.toLowerCase();

    player.message(`@que@You swing your ${axeName} at the tree...`);
    player.sendBubble(bestAxeID);

    await world.sleepTicks(3);

    const logSuccess = rollSkillSuccess(
        tree.roll[0] * axes[bestAxeID],
        tree.roll[1] * axes[bestAxeID],
        woodcuttingLevel
    );

    if (world.gameObjects.getAtPoint(x, y)[0] === gameObject && logSuccess) {
        const fell = FELL_CHANCE.has(treeID)
            ? FELL_CHANCE.get(treeID)
            : DEFAULT_FELL;
        const shouldFall = Math.floor(Math.random() * 100) + 1 <= fell;

        if (shouldFall) {
            const stump = world.replaceEntity(
                'gameObjects',
                gameObject,
                tree.stump
            );

            world.setTimeout(() => {
                world.replaceEntity('gameObjects', stump, treeID);
            }, tree.respawn);
        }

        player.addExperience('woodcutting', tree.experience);
        player.message('@que@You get some wood');
        player.inventory.add(tree.log);
    } else {
        player.message('@que@You slip and fail to hit the tree');
    }

    return true;
}

// Ported from Open-RSC Core-Framework authentic/skills/woodcutting/WoodcutJungle.java (AGPL-3.0)
// and the Dramen tree case (245) of authentic/quests/members/LostCity.java (AGPL-3.0)

// rsc-data config/objects: "Dense Jungle Tree" and "Dense Jungle Palm" (all Chop)
const JUNGLE_TREES = new Set([1086, 1100, 1099, 1092, 1091]);
// "Jungle tree stump" (commands Walk, Examine): walking on it moves you through the jungle
const JUNGLE_TREE_STUMP = 1087;
// "Dramen Tree" (Chop)
const DRAMEN_TREE = 245;
// config/wall-objects "Jungle" (Chop): the vine. Game object 204 is a table, not the vine
const JUNGLE_VINE = 204;
// config/npcs "tree spirit"
const TREE_SPIRIT = 216;
// config/items "Dramen Branch"
const DRAMEN_BRANCH = 510;
// config/items "Machette" (sic), needed to cut through the jungle
const MACHETE = 1172;
// config/items "Logs"
const LOGS = 14;

// Formulae.woodcuttingAxeIDs, best first, with the bonus from WoodcutJungle.calcAxeBonus (ids are rsc-data's).
// The Java DRAGON_WOODCUTTING_AXE (1480) has no rsc-data item, so it is left out.
const JUNGLE_AXE_BONUS = new Map([
    [405, 16], // rune
    [204, 8], // adamantite
    [203, 4], // mithril
    [428, 3], // black
    [88, 2], // steel
    [12, 1], // iron
    [87, 0] // bronze
]);

// Open-RSC changeloc delay of 60 seconds, in 640 ms ticks
const JUNGLE_TREE_STUMP_TICKS = 94;
// Open-RSC delayedSpawnObject of 5500 ms for the vine
const JUNGLE_VINE_RESPAWN_MS = 5500;
// Open-RSC addnpc with no timer: the spirit stays until it dies. Here a very long timer, see the port notes
const TREE_SPIRIT_TICKS = 100000;
// Open-RSC warns at fatigue 149840 of 150000 (160 short of max). MAX_FATIGUE here is 75000, so 80 short
const FATIGUE_WARNING_OFFSET = 80;

// Formulae.calcGatheringSuccessfulLegacy, with DataConversions.random(1, 128) as the roll
function rollLegacyGathering(levelReq, skillLevel, bonus) {
    const roll = Math.floor(Math.random() * 128) + 1;

    if (skillLevel < levelReq) {
        return false;
    }

    const threshold = Math.min(
        127,
        Math.max(1, skillLevel + bonus + 40 - Math.floor(levelReq * 1.5))
    );

    return roll <= threshold;
}

// WoodcutJungle.cutJungle. A vine is hacked away for 5.5 seconds, a tree becomes a stump for 60 seconds.
// force is the fatigue exit: no roll, no XP, no message.
async function cutJungle(player, obj, isVine, bonus, force) {
    const { world } = player;
    const target = isVine ? 'jungle vines' : 'tree';

    if (
        !force &&
        !rollLegacyGathering(50, player.skills.woodcutting.current, bonus)
    ) {
        player.message(`@que@You slip and fail to hit the ${target}`);
        return;
    }

    const objects = isVine ? world.wallObjects : world.gameObjects;
    const existing = objects
        .getAtPoint(obj.x, obj.y)
        .find((other) => other.id === obj.id);

    if (existing) {
        if (isVine) {
            existing.respawn = JUNGLE_VINE_RESPAWN_MS;
            world.removeEntity('wallObjects', existing);

            if (!force) {
                player.message('@que@You hack your way through the jungle.');
            }

            await world.sleepTicks(2);
        } else {
            world.replaceTimed(
                'gameObjects',
                existing,
                JUNGLE_TREE_STUMP,
                JUNGLE_TREE_STUMP_TICKS
            );
        }

        if (!force) {
            player.addExperience('woodcutting', 20);
        }
    }

    // DataConversions.random(0, 10) == 8
    if (Math.floor(Math.random() * 11) === 8) {
        player.inventory.add(LOGS);
        player.message('@que@You get some wood');
    }

    player.teleport(obj.x, obj.y);

    if (player.y > 871) {
        if (isVine) {
            await world.sleepTicks(6);
        }

        player.message('You manage to hack your way into the Kharazi Jungle.');
    }
}

// WoodcutJungle.handleJungleWoodcut. obj is a jungle tree game object, or the vine wall object when isVine.
async function woodcutJungle(player, obj, isVine) {
    const { world } = player;
    const target = isVine ? 'jungle vines' : 'tree';

    if (player.isTired()) {
        player.message(`@que@You are too tired to cut the ${target}`);

        // Shilo side of the jungle (y < 866): nothing more happens
        if (player.y < 866) {
            return true;
        }

        // Khazari side: the jungle pushes you out
        player.message(
            'It takes you some time, but you eventually make your way'
        );
        player.message('out of the Khazari jungle.');
        await cutJungle(player, obj, isVine, 0, true);

        return true;
    }

    if (player.skills.woodcutting.current < 50) {
        player.message('You need a woodcutting level of 50 to axe this tree');
        return true;
    }

    if (!player.inventory.has(MACHETE)) {
        player.message(
            "@que@This jungle is very thick, you'll need a machette to cut through."
        );
        await world.sleepTicks(3);
        return true;
    }

    let axeID = MACHETE;

    if (!isVine) {
        axeID = [...JUNGLE_AXE_BONUS.keys()].find((id) =>
            player.inventory.has(id)
        );

        if (typeof axeID === 'undefined') {
            player.message('@que@You need an axe to chop this tree down');
            return true;
        }
    }

    player.sendBubble(axeID);
    player.message(
        `@que@You swing your ${items[axeID].name.toLowerCase()} at the ${target}...`
    );

    if (!player.isTired() && player.isTired(FATIGUE_WARNING_OFFSET)) {
        player.message(
            'You are getting very tired, you may get stuck if you continue into the jungle.'
        );
    }

    const bonus = JUNGLE_AXE_BONUS.get(axeID) || 0;

    await cutJungle(player, obj, isVine, bonus, false);

    return true;
}

// LostCity.java case 245. Stages 4, 3, 2 and -1 can chop it; the others get the "ominous aura" message.
async function chopDramenTree(player) {
    const { world } = player;
    const stage = player.questStages.lostCity;

    if (![4, 3, 2, -1].includes(stage)) {
        player.message('@que@the tree seems to have a ominous aura to it');
        player.message('@que@you do not feel like chopping it down');
        await world.sleepTicks(3);
        return true;
    }

    if (player.skills.woodcutting.current < 36) {
        player.message(
            '@que@You are not a high enough woodcutting level to chop down this tree'
        );
        await world.sleepTicks(3);
        player.message('@que@You need a woodcutting level of 36');
        await world.sleepTicks(3);
        return true;
    }

    const hasAxe = [...JUNGLE_AXE_BONUS.keys()].some((id) =>
        player.inventory.has(id)
    );

    if (!hasAxe) {
        player.message('You need an axe to chop down this tree');
        return true;
    }

    if (stage === 4 || stage === -1) {
        player.message('@que@You cut a branch from the Dramen tree');
        await world.sleepTicks(3);
        player.inventory.add(DRAMEN_BRANCH, 1);
        return true;
    }

    if (stage === 2) {
        player.questStages.lostCity = 3;
    }

    const spirit = player
        .getNearbyEntitiesByID('npcs', TREE_SPIRIT, 15)
        .find((npc) => !npc.locked);

    if (spirit) {
        await spirit.say(
            'Stop',
            'I am the spirit of the Dramen Tree',
            'You must come through me before touching that tree'
        );
        return true;
    }

    // Open-RSC spawns the spirit at a fixed tile, whatever the player's position
    const treeSpirit = world.spawnTimedNPC({
        id: TREE_SPIRIT,
        x: 412,
        y: 3403,
        ticks: TREE_SPIRIT_TICKS
    });

    await world.sleepTicks(3);
    await treeSpirit.say(
        'Stop',
        'I am the spirit of the Dramen Tree',
        'You must come through me before touching that tree'
    );

    return true;
}

// game objects this section owns: the jungle trees, the stump and the Dramen tree
function claimsJungleGameObject(id) {
    return JUNGLE_TREES.has(id) || id === JUNGLE_TREE_STUMP || id === DRAMEN_TREE;
}

async function onJungleGameObjectCommand(player, gameObject, index) {
    if (gameObject.id === JUNGLE_TREE_STUMP) {
        // OpLoc on the stump walks you onto its tile, for its first command (Walk) only
        if (index !== 0) {
            return false;
        }

        player.teleport(gameObject.x, gameObject.y);
        return true;
    }

    if (!/chop/i.test(gameObject.definition.commands[index])) {
        return false;
    }

    if (gameObject.id === DRAMEN_TREE) {
        return await chopDramenTree(player);
    }

    return await woodcutJungle(player, gameObject, false);
}

async function onGameObjectCommandOne(player, gameObject) {
    if (claimsJungleGameObject(gameObject.id)) {
        return await onJungleGameObjectCommand(player, gameObject, 0);
    }

    if (!/chop/i.test(gameObject.definition.commands[0])) {
        return false;
    }

    return await onGameObjectCommand(player, gameObject);
}

async function onGameObjectCommandTwo(player, gameObject) {
    if (claimsJungleGameObject(gameObject.id)) {
        return await onJungleGameObjectCommand(player, gameObject, 1);
    }

    if (!/chop/i.test(gameObject.definition.commands[1])) {
        return false;
    }

    return await onGameObjectCommand(player, gameObject);
}

// axe on a jungle tree or the stump (Open-RSC UseLoc; classic clients always send it)
async function onUseWithGameObject(player, gameObject, item) {
    if (!JUNGLE_AXE_BONUS.has(item.id)) {
        return false;
    }

    if (gameObject.id === JUNGLE_TREE_STUMP) {
        player.teleport(gameObject.x, gameObject.y);
        return true;
    }

    if (!JUNGLE_TREES.has(gameObject.id)) {
        return false;
    }

    return await woodcutJungle(player, gameObject, false);
}

// the vine is a wall object: Chop cuts it, Examine is left alone
async function onWallObjectCommand(player, wallObject, index) {
    if (wallObject.id !== JUNGLE_VINE) {
        return false;
    }

    if (!/chop/i.test(wallObject.definition.commands[index])) {
        return false;
    }

    return await woodcutJungle(player, wallObject, true);
}

async function onWallObjectCommandOne(player, wallObject) {
    return await onWallObjectCommand(player, wallObject, 0);
}

async function onWallObjectCommandTwo(player, wallObject) {
    return await onWallObjectCommand(player, wallObject, 1);
}

async function onUseWithWallObject(player, wallObject, item) {
    if (wallObject.id !== JUNGLE_VINE || !JUNGLE_AXE_BONUS.has(item.id)) {
        return false;
    }

    return await woodcutJungle(player, wallObject, true);
}

module.exports = {
    onGameObjectCommandOne,
    onGameObjectCommandTwo,
    onWallObjectCommandOne,
    onWallObjectCommandTwo,
    onUseWithGameObject,
    onUseWithWallObject
};
