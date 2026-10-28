// Ported from Open-RSC Core-Framework authentic/misc/SpiritTrees.java (AGPL-3.0): the spirit trees of the tree gnomes
// carry a player who has finished the gnome quests between the stronghold, the tree gnome village, the Khazard
// battlefield and the forest north of Varrock. The client shows them with a face in the trunk
// (Autonomous-RSC scripts/client-config/fruit-trees.mjs), because rsc-data gives them the plain tree model.

const STRONGHOLD_SPIRIT_TREE_ID = 661;
const VILLAGE_SPIRIT_TREE_ID = 390;
const YOUNG_SPIRIT_TREE_ID = 391;
const PLAGUE_SAMPLE_ID = 812;

const KHAZARD = [629, 629];
const VARROCK_FOREST = [161, 453];
const VILLAGE = [656, 694];
const STRONGHOLD = [703, 487];
// where the young trees (Varrock forest, Khazard battlefield) take you: the village, a little off the big tree
const VILLAGE_FROM_YOUNG = [658, 695];

// quest that must be finished for each tree to talk, and the third destination of the big trees
const BIG_TREES = new Map([
    [STRONGHOLD_SPIRIT_TREE_ID, { quest: 'grandTree', third: ['the gnome tree village', VILLAGE] }],
    [VILLAGE_SPIRIT_TREE_ID, { quest: 'treeGnomeVillage', third: ['the gnome stronghold', STRONGHOLD] }]
]);

const IDLE = "the tree doesn't feel like talking";

async function pause(player) {
    await player.world.sleepTicks(3);
}

function breakPlagueSample(player) {
    if (!player.inventory.has(PLAGUE_SAMPLE_ID)) {
        return;
    }

    player.message('the plague sample is too delicate...');
    player.message('it disintegrates in the crossing');
    player.inventory.remove(PLAGUE_SAMPLE_ID, player.inventory.count(PLAGUE_SAMPLE_ID));
}

async function travel(player, [x, y]) {
    player.message('You place your hands on the dry tough bark of the spirit tree');
    await pause(player);
    player.message('and feel a surge of energy run through your veins');
    await pause(player);
    breakPlagueSample(player);
    player.teleport(x, y);
}

async function bigTree(player, tree) {
    if (player.questStages[tree.quest] !== -1) {
        player.message(IDLE);
        return;
    }

    player.message('The tree talks in an old tired voice...');
    await pause(player);
    player.message('@yel@Spirit Tree: You friend of gnome people, you friend of mine');
    await pause(player);
    player.message('@yel@Spirit Tree: Would you like me to take you somewhere?');
    await pause(player);

    if ((await player.ask(['No thanks old tree', 'Where can i go?'])) === 0) {
        return;
    }

    player.message('The tree talks again..');
    await pause(player);
    player.message('@yel@Spirit Tree: You can travel to the trees');
    await pause(player);
    player.message('@yel@Spirit Tree: Which are related to myself');
    await pause(player);

    const [name, destination] = tree.third;
    const choice = await player.ask(['Battlefield of Khazard', 'Forest north of Varrock', name]);

    await travel(player, [KHAZARD, VARROCK_FOREST, destination][choice]);
}

async function youngTree(player) {
    if (player.questStages.treeGnomeVillage !== -1) {
        player.message(IDLE);
        return;
    }

    player.message('The young spirit tree talks..');
    player.message('@yel@Young Spirit Tree: Hello gnome friend');
    await pause(player);
    player.message('@yel@Young Spirit Tree: Would you like to travel to the home of the tree gnomes?');
    await pause(player);

    if ((await player.ask(['No thank you', 'Yes please'])) === 1) {
        await travel(player, VILLAGE_FROM_YOUNG);
    }
}

async function onGameObjectCommandOne(player, gameObject) {
    if (BIG_TREES.has(gameObject.id)) {
        await bigTree(player, BIG_TREES.get(gameObject.id));
        return true;
    }

    if (gameObject.id === YOUNG_SPIRIT_TREE_ID) {
        await youngTree(player);
        return true;
    }

    return false;
}

module.exports = { onGameObjectCommandOne };
