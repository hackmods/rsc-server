// ARSC Monster Slayer guild: task assignment, kill credit and point shop (plugins/npcs/varrock/slayer-master.js).

const tasks = require('./tasks.json');

const TASK_BY_ID = new Map(tasks.map((task) => [task.id, task]));
const COMPLETION_BONUS_MULTIPLIER = 5;

const SHOP = [
    { points: 5, itemId: 10, amount: 10, label: '10 coins' },
    { points: 15, itemId: 132, amount: 1, label: 'Cooked meat' },
    { points: 15, itemId: 138, amount: 1, label: 'Bread' },
    { points: 40, itemId: 373, amount: 1, label: 'Lobster' }
];

let enabledOverride;

function isEnabled() {
    if (enabledOverride !== undefined) {
        return enabledOverride;
    }

    const config = require('../../config.json');

    return !!(config.slayerGuild && config.slayerGuild.enabled);
}

function setEnabledForTests(value) {
    enabledOverride = value;
}

function resetEnabledForTests() {
    enabledOverride = undefined;
}

function randomInt(min, max, random = Math.random) {
    return min + Math.floor(random() * (max - min + 1));
}

function ensureState(player) {
    if (!player.cache) {
        player.cache = {};
    }

    if (!player.cache.slayer) {
        player.cache.slayer = {
            taskId: null,
            npcId: null,
            remaining: 0,
            points: 0,
            assignedAt: null
        };
    }

    return player.cache.slayer;
}

function getState(player) {
    return player.cache && player.cache.slayer;
}

function hasActiveTask(player) {
    const state = getState(player);

    return !!(state && state.taskId && state.remaining > 0);
}

function clearTask(player) {
    const state = ensureState(player);

    state.taskId = null;
    state.npcId = null;
    state.remaining = 0;
    state.assignedAt = null;
}

function cancelTask(player) {
    clearTask(player);
}

function assignTask(player, combatLevel, random = Math.random) {
    const eligible = tasks.filter((task) => combatLevel >= task.combatMin);

    if (!eligible.length) {
        return { ok: false, reason: 'no_tasks' };
    }

    if (hasActiveTask(player)) {
        return { ok: false, reason: 'active_task' };
    }

    const task = eligible[Math.floor(random() * eligible.length)];
    const remaining = randomInt(task.minCount, task.maxCount, random);
    const state = ensureState(player);

    state.taskId = task.id;
    state.npcId = task.npcId;
    state.remaining = remaining;
    state.assignedAt = Date.now();

    return { ok: true, task, remaining };
}

function creditKill(player, npcId) {
    if (!isEnabled()) {
        return { credited: false };
    }

    const state = getState(player);

    if (!state || !state.taskId || state.npcId !== npcId || state.remaining <= 0) {
        return { credited: false };
    }

    const task = TASK_BY_ID.get(state.taskId);

    if (!task) {
        return { credited: false };
    }

    state.remaining -= 1;
    state.points = (state.points || 0) + task.pointsPerKill;

    const result = {
        credited: true,
        task,
        remaining: state.remaining,
        points: state.points
    };

    if (state.remaining <= 0) {
        const bonus = task.pointsPerKill * COMPLETION_BONUS_MULTIPLIER;

        state.points += bonus;
        result.bonus = bonus;
        result.completed = true;
        clearTask(player);
    }

    return result;
}

function spendPoints(player, shopIndex) {
    const entry = SHOP[shopIndex];

    if (!entry) {
        return { ok: false, reason: 'invalid_option' };
    }

    const state = ensureState(player);

    if ((state.points || 0) < entry.points) {
        return { ok: false, reason: 'not_enough_points' };
    }

    if (!player.inventory) {
        return { ok: false, reason: 'no_inventory' };
    }

    state.points -= entry.points;
    player.inventory.add(entry.itemId, entry.amount);

    return { ok: true, entry, points: state.points };
}

function taskForPlayer(player) {
    const state = getState(player);

    if (!state || !state.taskId) {
        return null;
    }

    return TASK_BY_ID.get(state.taskId) || null;
}

module.exports = {
    tasks,
    SHOP,
    isEnabled,
    setEnabledForTests,
    resetEnabledForTests,
    ensureState,
    getState,
    hasActiveTask,
    assignTask,
    creditKill,
    cancelTask,
    clearTask,
    spendPoints,
    taskForPlayer,
    TASK_BY_ID
};
