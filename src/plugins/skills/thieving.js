// ARSC overlay: replaces the upstream stub. Classic thieving (https://classic.runescape.wiki/w/Thieving):
//  - pickpocket (npc second option, onNPCCommand), data from rsc-data skills/thieving.json `pickpocket`;
//  - stalls and counters ("steal from"), `stalls`: the stall empties and respawns, owner/guards that see you shout and attack;
//  - chests ("search for traps" / "picklock"), `chests`: the trap hurts you on a failed search or a plain "Open";
//  - doors (wall object "pick lock"), `doors`.
// Every id the data names is claimed (returns true) so the server does not also say "Nothing interesting happens".

const items = require('@2003scape/rsc-data/config/items');
const thieving = require('@2003scape/rsc-data/skills/thieving');
const rolls = require('../../rolls');

const COINS_ID = 10;
const LOCKPICK_ID = 714;
const EMPTY_STALL_ID = 341;
const OPEN_CHEST_ID = 339;

// stall owners and guards within this range (withinRange halves it: 6 tiles) that can see the thief react
const SPOTTED_RANGE = 12;

// the ogre rock cake counters have no empty version; a per-spot cooldown stands in for it
const COUNTER_IDS = new Set([999, 1034]);
const cooldowns = new Map();

const pickpocketNPCs = resolveTable(thieving.pickpocket);
const stalls = resolveTable(thieving.stalls);
const chests = resolveTable(thieving.chests);
const doors = resolveTable(thieving.doors);

// follow { reference: id } entries to their definition; the entry's own fields (alias ...) win
function resolveTable(table) {
    const out = new Map();

    for (const key of Object.keys(table)) {
        const { reference, ...own } = table[key];
        out.set(Number(key), typeof reference === 'undefined' ? own : { ...table[reference], ...own });
    }

    return out;
}

function thievingLevel(player) {
    return player.skills.thieving.current;
}

// roll a weighted/unweighted item list (the rolls.js weights are out of 128). never returns an empty drop for a
// non-empty table.
function rollLoot(table) {
    const weighted = table.some((entry) => entry.weight);

    if (!weighted) {
        return table.map((entry) => ({ id: entry.id, amount: entry.amount || 1 }));
    }

    for (let i = 0; i < 8; i += 1) {
        const drops = rolls.rollItemDrop({ 0: table }, 0);

        if (drops.length) {
            return drops;
        }
    }

    return [{ id: table[0].id, amount: table[0].amount || 1 }];
}

function itemName(id) {
    return items[id].name.toLowerCase();
}

function describeLoot(drop) {
    const name = itemName(drop.id);

    if (drop.id === COINS_ID) {
        return `${drop.amount} coin${drop.amount === 1 ? '' : 's'}`;
    }

    return drop.amount > 1 ? `${drop.amount} ${name}` : `a ${name}`;
}

// success chance for actions the data gives no roll for (doors, chest traps): 55% at the required level, +2% per
// level above, capped at 95%
function marginRoll(level, required) {
    return Math.random() < Math.min(0.95, 0.55 + 0.02 * Math.max(0, level - required));
}

// lose hits to a trap without ever dying to it
function hurtByTrap(player, damage) {
    const spare = player.skills.hits.current - 1;
    const amount = Math.min(damage, spare);

    if (amount > 0) {
        player.damage(amount);
    }
}

function attackSoon(world, npc, player) {
    if (npc.skills.hits.base <= 0) {
        return;
    }

    // not inside the plugin: the packet handler unlocks the player when the plugin returns
    world.setTickTimeout(() => {
        if (npc.opponent || player.opponent || npc.skills.hits.current <= 0) {
            return;
        }

        npc.unlock();

        Promise.resolve(npc.attack(player)).catch(() => {});
    }, 2);
}

// ---- pickpocketing -------------------------------------------------------------------------------------------

async function onNPCCommand(player, npc) {
    const pocket = pickpocketNPCs.get(npc.id);

    if (!pocket) {
        return false;
    }

    const { world } = player;
    const name = (pocket.alias || npc.definition.name).toLowerCase();
    const level = thievingLevel(player);

    if (pocket.level > level) {
        player.message(`You need a thieving level of ${pocket.level} to steal from the ${name}`);
        return true;
    }

    player.message(`You attempt to pick the ${name}'s pocket`);
    npc.lock();

    try {
        await world.sleepTicks(2);

        if (npc.opponent || npc.skills.hits.current <= 0) {
            return true;
        }

        if (rolls.rollSkillSuccess(pocket.roll[0], pocket.roll[1], level)) {
            player.message(`You pick the ${name}'s pocket`);

            for (const drop of rollLoot(pocket.items)) {
                player.inventory.add(drop.id, drop.amount);
            }

            if (pocket.experience) {
                player.addExperience('thieving', pocket.experience);
            }

            return true;
        }

        player.message(`You fail to pick the ${name}'s pocket`);
        npc.broadcastChat(`${pocket.exclaimation}?`);

        // the stun: the caught thief can do nothing while the victim squares up
        await world.sleepTicks(2);
    } finally {
        npc.unlock();
    }

    attackSoon(world, npc, player);

    return true;
}

// ---- stalls --------------------------------------------------------------------------------------------------

function spotThief(world, player, stall) {
    const watchers = player
        .getNearbyEntities('npcs', SPOTTED_RANGE * 2)
        .filter(
            (npc) =>
                (npc.id === stall.owner || stall.guards.indexOf(npc.id) > -1) &&
                !npc.opponent &&
                player.withinRange(npc, SPOTTED_RANGE) &&
                player.withinLineOfSight(npc)
        )
        .sort((a, b) => (b.id === stall.owner) - (a.id === stall.owner) || player.getDistance(a) - player.getDistance(b));

    if (!watchers.length) {
        return;
    }

    const fighter = watchers.find((npc) => npc.skills.hits.base > 0);
    const shouters = new Set([watchers[0], fighter].filter(Boolean));

    for (const npc of shouters) {
        npc.broadcastChat('Hey! Get your hands off there!');
    }

    if (fighter) {
        attackSoon(world, fighter, player);
    }
}

async function stealFromStall(player, gameObject) {
    const stall = stalls.get(gameObject.id);
    const { world } = player;
    const { x, y } = gameObject;
    const name = gameObject.definition.name.toLowerCase();
    const level = thievingLevel(player);

    if (stall.level > level) {
        player.message(`You need a thieving level of ${stall.level} to steal from this ${name}`);
        return true;
    }

    const spot = `${x}:${y}`;

    if (cooldowns.has(spot) && cooldowns.get(spot) > Date.now()) {
        player.message(`There is nothing left to steal from the ${name}`);
        return true;
    }

    player.message(`You attempt to steal from the ${name}`);
    await world.sleepTicks(2);

    if (world.gameObjects.getAtPoint(x, y)[0] !== gameObject) {
        player.message(`There is nothing left to steal from the ${name}`);
        return true;
    }

    if (COUNTER_IDS.has(gameObject.id)) {
        cooldowns.set(spot, Date.now() + stall.respawn);
    } else {
        const empty = world.replaceEntity('gameObjects', gameObject, EMPTY_STALL_ID);

        world.setTimeout(() => {
            if (world.gameObjects.getAtPoint(x, y)[0] === empty) {
                world.replaceEntity('gameObjects', empty, gameObject.id);
            }
        }, stall.respawn);
    }

    const loot = rollLoot(stall.items);

    for (const drop of loot) {
        player.inventory.add(drop.id, drop.amount);
    }

    player.message(`You steal ${describeLoot(loot[0])} from the ${name}`);
    player.addExperience('thieving', stall.experience);

    spotThief(world, player, stall);

    return true;
}

// ---- chests --------------------------------------------------------------------------------------------------

async function openChest(player, gameObject) {
    const chest = chests.get(gameObject.id);

    if (chest.lockpick) {
        player.message('The chest is locked');
        return true;
    }

    // opening a trapped chest without searching for the trap first
    player.message('You have activated a trap on the chest');
    hurtByTrap(player, 1 + Math.floor(chest.level / 15));

    return true;
}

async function lootChest(player, gameObject) {
    const chest = chests.get(gameObject.id);
    const { world } = player;
    const { x, y } = gameObject;
    const level = thievingLevel(player);

    if (chest.level > level) {
        player.message(`You need a thieving level of ${chest.level} to ${chest.lockpick ? 'pick this lock' : 'disarm this trap'}`);
        return true;
    }

    if (chest.lockpick && !player.inventory.has(LOCKPICK_ID)) {
        player.message('You need a lockpick to open this chest');
        return true;
    }

    player.message(chest.lockpick ? 'You attempt to pick the lock on the chest' : 'You search the chest for traps');
    await world.sleepTicks(2);

    if (world.gameObjects.getAtPoint(x, y)[0] !== gameObject) {
        player.message('The chest has already been emptied');
        return true;
    }

    if (!marginRoll(level, chest.level)) {
        if (chest.lockpick) {
            player.message('You fail to pick the lock');
        } else {
            player.message('You fail to find the trap');
            player.message('You have activated a trap on the chest');
            hurtByTrap(player, 1 + Math.floor(chest.level / 15));
        }

        return true;
    }

    player.message(chest.lockpick ? 'You manage to pick the lock' : 'You find a trap on the chest...');

    if (!chest.lockpick) {
        await world.sleepTicks(1);
        player.message('You disable the trap');
    }

    const open = world.replaceEntity('gameObjects', gameObject, OPEN_CHEST_ID);

    world.setTimeout(() => {
        if (world.gameObjects.getAtPoint(x, y)[0] === open) {
            world.replaceEntity('gameObjects', open, gameObject.id);
        }
    }, chest.respawn);

    for (const drop of rollLoot(chest.items)) {
        player.inventory.add(drop.id, drop.amount);
    }

    player.message('You open the chest and find treasure inside!');
    player.addExperience('thieving', chest.experience);

    return true;
}

// ---- doors ---------------------------------------------------------------------------------------------------

async function pickLock(player, wallObject) {
    const door = doors.get(wallObject.id);
    const { world } = player;
    const level = thievingLevel(player);

    if (door.level > level) {
        player.message(`You need a thieving level of ${door.level} to pick this lock`);
        return true;
    }

    if (door.lockpick && !player.inventory.has(LOCKPICK_ID)) {
        player.message('You need a lockpick to pick this lock');
        return true;
    }

    player.message('You attempt to pick the lock');
    await world.sleepTicks(2);

    if (!marginRoll(level, door.level)) {
        player.message('You fail to pick the lock');
        return true;
    }

    player.message('You manage to pick the lock');
    player.addExperience('thieving', door.experience);
    await player.enterDoor(wallObject);
    player.message('You go through the door');

    return true;
}

// ---- plugin hooks --------------------------------------------------------------------------------------------

function commandMatches(gameObject, index, pattern) {
    return pattern.test((gameObject.definition.commands || [])[index] || '');
}

async function onGameObjectCommandOne(player, gameObject) {
    if (stalls.has(gameObject.id) && commandMatches(gameObject, 0, /steal/i)) {
        return stealFromStall(player, gameObject);
    }

    if (chests.has(gameObject.id) && commandMatches(gameObject, 0, /open/i)) {
        return openChest(player, gameObject);
    }

    return false;
}

async function onGameObjectCommandTwo(player, gameObject) {
    if (stalls.has(gameObject.id) && commandMatches(gameObject, 1, /steal/i)) {
        return stealFromStall(player, gameObject);
    }

    if (chests.has(gameObject.id) && commandMatches(gameObject, 1, /search|pick/i)) {
        return lootChest(player, gameObject);
    }

    return false;
}

async function onWallObjectCommandOne(player, wallObject) {
    if (!doors.has(wallObject.id)) {
        return false;
    }

    player.message('The door is locked');

    return true;
}

async function onWallObjectCommandTwo(player, wallObject) {
    if (!doors.has(wallObject.id)) {
        return false;
    }

    return pickLock(player, wallObject);
}

module.exports = { onNPCCommand, onGameObjectCommandOne, onGameObjectCommandTwo, onWallObjectCommandOne, onWallObjectCommandTwo };
