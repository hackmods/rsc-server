// ARSC Monster Slayer guild master (Guard def 749) in south-east Varrock (arsc-locations.js).

const slayer = require('../../../slayer');
const npcs = require('@2003scape/rsc-data/config/npcs');

const SLAYER_MASTER_ID = 749;
const MASTER_X = 118;
const MASTER_Y = 504;
const MASTER_RADIUS = 8;

function nearSlayerMaster(npc) {
    return (
        npc.id === SLAYER_MASTER_ID &&
        Math.abs(npc.x - MASTER_X) <= MASTER_RADIUS &&
        Math.abs(npc.y - MASTER_Y) <= MASTER_RADIUS
    );
}

function combatLevelOf(player) {
    if (typeof player.getCombatLevel === 'function') {
        return player.getCombatLevel();
    }

    return player.combatLevel || 3;
}

async function assignDialogue(player, npc) {
    const combatLevel = combatLevelOf(player);
    const result = slayer.assignTask(player, combatLevel);

    if (!result.ok) {
        if (result.reason === 'active_task') {
            await npc.say('Finish or cancel your current assignment first');
        } else {
            await npc.say('You are not experienced enough for any of my tasks yet');
        }

        return;
    }

    const { task, remaining } = result;

    await npc.say(
        `Your task is to kill ${remaining} ${task.name.toLowerCase()}`,
        'Return when you are done'
    );

    player.message(
        `@que@New slayer task: Kill ${remaining} ${task.name.toLowerCase()}`
    );
}

async function statusDialogue(player, npc) {
    const state = slayer.getState(player);

    if (!state || !state.taskId) {
        await npc.say('You have no active slayer assignment');
        return;
    }

    const task = slayer.taskForPlayer(player);
    const name = task ? task.name.toLowerCase() : 'creatures';

    await npc.say(
        `You still need to kill ${state.remaining} ${name}`,
        `You have ${state.points || 0} slayer points`
    );
}

async function cancelDialogue(player, npc) {
    if (!slayer.hasActiveTask(player)) {
        await npc.say('You have no task to cancel');
        return;
    }

    slayer.cancelTask(player);
    await npc.say('Your slayer task has been cancelled');
    player.message('@que@Your slayer task has been cancelled');
}

async function spendDialogue(player, npc) {
    const labels = slayer.SHOP.map(
        (entry) => `${entry.label} (${entry.points} points)`
    );

    labels.push('Never mind');

    const choice = await player.ask(labels, true);

    if (choice >= slayer.SHOP.length) {
        return;
    }

    const result = slayer.spendPoints(player, choice);

    if (!result.ok) {
        if (result.reason === 'not_enough_points') {
            await npc.say('You do not have enough slayer points for that');
        } else {
            await npc.say('I cannot give you that reward right now');
        }

        return;
    }

    await npc.say('There you go');
    player.message(`@que@You spend ${result.entry.points} slayer points`);
}

async function onTalkToNPC(player, npc) {
    if (!slayer.isEnabled() || !nearSlayerMaster(npc)) {
        return false;
    }

    player.engage(npc);

    await npc.say(
        'Welcome to the Monster Slayer guild',
        'I can assign you creatures to hunt for slayer points'
    );

    const choice = await player.ask(
        [
            'Assign me a task',
            'What is my task?',
            'Cancel my task',
            'Spend slayer points',
            'Never mind'
        ],
        true
    );

    switch (choice) {
        case 0:
            await assignDialogue(player, npc);
            break;
        case 1:
            await statusDialogue(player, npc);
            break;
        case 2:
            await cancelDialogue(player, npc);
            break;
        case 3:
            await spendDialogue(player, npc);
            break;
        default:
            await npc.say('Good luck on your hunts');
            break;
    }

    player.disengage();
    return true;
}

async function onNPCDeath(player, npc) {
    if (!player || !slayer.isEnabled()) {
        return false;
    }

    const result = slayer.creditKill(player, npc.id);

    if (!result.credited) {
        return false;
    }

    const name =
        (npcs[npc.id] && npcs[npc.id].name.toLowerCase()) || 'creature';

    if (result.completed) {
        player.message(
            `@que@You have completed your slayer task! Bonus: ${result.bonus} points`
        );
    } else {
        player.message(
            `@que@Slayer task: ${result.remaining} ${name} left (${result.points} points)`
        );
    }

    return false;
}

module.exports = { onTalkToNPC, onNPCDeath, nearSlayerMaster, SLAYER_MASTER_ID };
