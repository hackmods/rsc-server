// Entrana safety deposit box at the Port Sarim docks: stash weapons and armour before the monk's search, then
// withdraw them after returning from the island. Same forbidden-item rules as monks-of-entrana.js.

const items = require('@2003scape/rsc-data/config/items');
const { isForbiddenItem } = require('../npcs/port-sarim/monks-of-entrana.js');

const SAFETY_DEPOSIT_BOX_ID = 942;
const DEPOSIT_TILE = { x: 266, y: 660 };
const DEPOSIT_TILE_RANGE = 2;

function isSafetyDepositBox(gameObject) {
    if (gameObject.id !== SAFETY_DEPOSIT_BOX_ID) {
        return false;
    }

    return (
        Math.abs(gameObject.x - DEPOSIT_TILE.x) <= DEPOSIT_TILE_RANGE &&
        Math.abs(gameObject.y - DEPOSIT_TILE.y) <= DEPOSIT_TILE_RANGE
    );
}

function collectForbiddenItems(player) {
    const stored = [];

    for (const item of player.inventory.items) {
        if (isForbiddenItem(item)) {
            stored.push({ id: item.id, amount: item.amount });
        }
    }

    return stored;
}

function canFitAll(player, entries) {
    let slots = 30 - player.inventory.items.length;

    for (const { id, amount } of entries) {
        if (items[id].stackable) {
            const hasStack = player.inventory.items.some((item) => item.id === id);

            if (!hasStack) {
                if (slots < 1) {
                    return false;
                }

                slots -= 1;
            }
        } else if (slots < amount) {
            return false;
        } else {
            slots -= amount;
        }
    }

    return true;
}

async function deposit(player) {
    if (player.cache && player.cache.entranaDeposit) {
        player.message(
            '@que@You already have items stored in the safety deposit box'
        );
        return;
    }

    const forbidden = collectForbiddenItems(player);

    if (forbidden.length === 0) {
        player.message(
            '@que@You are not carrying any weapons or armour to deposit'
        );
        return;
    }

    for (const { id, amount } of forbidden) {
        player.inventory.remove(id, amount);
    }

    if (!player.cache) {
        player.cache = {};
    }

    player.cache.entranaDeposit = { items: forbidden };

    if (typeof player.save === 'function') {
        await player.save();
    }

    player.message(
        '@que@You deposit your weapons and armour in the safety deposit box'
    );
}

async function withdraw(player) {
    const deposit = player.cache && player.cache.entranaDeposit;

    if (!deposit || !deposit.items || deposit.items.length === 0) {
        player.message('@que@The safety deposit box is empty');
        return;
    }

    if (!canFitAll(player, deposit.items)) {
        player.message(
            '@que@You do not have enough inventory space to withdraw your items'
        );
        return;
    }

    for (const { id, amount } of deposit.items) {
        player.inventory.add(id, amount);
    }

    delete player.cache.entranaDeposit;

    if (typeof player.save === 'function') {
        await player.save();
    }

    player.message(
        '@que@You withdraw your items from the safety deposit box'
    );
}

async function onGameObjectCommandOne(player, gameObject) {
    if (!isSafetyDepositBox(gameObject)) {
        return false;
    }

    const choice = await player.ask([
        'Deposit forbidden items',
        'Withdraw stored items',
        'Never mind'
    ]);

    if (choice === 0) {
        await deposit(player);
    } else if (choice === 1) {
        await withdraw(player);
    }

    return true;
}

module.exports = { onGameObjectCommandOne, isSafetyDepositBox };
