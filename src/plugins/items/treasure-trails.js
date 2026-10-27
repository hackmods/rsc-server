// ARSC treasure trails (src/clues): read a clue scroll, dig with a spade,
// talk to an NPC, search an object or kill an NPC to solve each step, then
// open the tier's casket. Listed early in plugins/index.js: talk, search and
// kill only claim the action when it solves the carried clue, so the NPC's or
// object's own handler still runs otherwise.

const clues = require('../../clues');

const SPADE_ID = 211;

async function dig(player) {
    const { world } = player;

    player.message('@que@You dig a hole in the ground');
    await world.sleepTicks(2);

    const solved = clues.solveIfMatched(player, 'dig', null, player);

    if (!solved) {
        player.message('@que@But you find nothing of interest');
        return;
    }

    player.message('@que@You find something buried here!');
    clues.advance(player, solved.tier);
}

async function onInventoryCommand(player, item) {
    const scrollTier = clues.tierOfScroll(item.id);

    if (scrollTier) {
        const state = clues.ensureState(player, scrollTier);

        if (state) {
            clues.showClue(player, scrollTier, state);
        }

        return true;
    }

    const casketTier = clues.tierOfCasket(item.id);

    if (casketTier) {
        clues.openCasket(player, casketTier);
        return true;
    }

    // the spade's Dig option only means something while a clue is carried
    if (item.id === SPADE_ID && clues.carriedClues(player).length) {
        await dig(player);
        return true;
    }

    return false;
}

async function onTalkToNPC(player, npc) {
    const solved = clues.solveIfMatched(player, 'talk', npc.id, npc);

    if (!solved) {
        return false;
    }

    player.engage(npc);
    await npc.say('Ah, a treasure hunter! I was told to give you this');
    player.message('@que@You are handed another piece of the trail');
    player.disengage();

    clues.advance(player, solved.tier);
    return true;
}

async function searchObject(player, gameObject, commandIndex) {
    const commands = (gameObject.definition && gameObject.definition.commands) || [];
    const command = (commands[commandIndex] || '').toLowerCase();
    const solved = clues.solveIfMatched(player, 'search', gameObject.id, gameObject);

    if (!solved || command !== solved.step.command.toLowerCase()) {
        return false;
    }

    player.message(`@que@You ${command} the ${gameObject.definition.name.toLowerCase()}...`);
    await player.world.sleepTicks(1);
    player.message('@que@Tucked away inside, you find the next clue!');
    clues.advance(player, solved.tier);
    return true;
}

// world.loadPlugins registers a hook by its function name
async function onGameObjectCommandOne(player, gameObject) {
    return searchObject(player, gameObject, 0);
}

async function onGameObjectCommandTwo(player, gameObject) {
    return searchObject(player, gameObject, 1);
}

// never claims: the NPC's own drops must still fall
async function onNPCDeath(player, npc) {
    if (!player || !player.inventory) {
        return false;
    }

    const solved = clues.solveIfMatched(player, 'kill', npc.id, npc);

    if (solved) {
        player.message('@que@As it falls, the creature drops a scrap of parchment...');
        clues.advance(player, solved.tier);
    }

    return false;
}

// dropping the scroll ends its trail
async function onDropItem(player, item) {
    const tier = item && clues.tierOfScroll(item.id);

    if (tier && clues.getState(player, tier)) {
        clues.clearState(player, tier);
        player.message(`Your ${tier} treasure trail is abandoned`);
    }

    return false;
}

// one scroll per tier: a second one stays on the ground
async function onGroundItemTake(player, groundItem) {
    const tier = clues.tierOfScroll(groundItem.id);

    if (!tier || clues.canReceive(player, tier)) {
        return false;
    }

    player.message(`You already have ${clues.withArticle(clues.scrollName(tier))}`);
    return true;
}

module.exports = {
    onInventoryCommand,
    onTalkToNPC,
    onGameObjectCommandOne,
    onGameObjectCommandTwo,
    onNPCDeath,
    onDropItem,
    onGroundItemTake
};
