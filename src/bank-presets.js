'use strict';

const items = require('@2003scape/rsc-data/config/items');
const Inventory = require('./model/inventory');
const Item = require('./model/item');
const { planPreset } = require('./bank-presets-plan');
const { validateEquipmentSet, getEquipmentAnimationIndex } = require('./equipment-eligibility');
const { inCombatCooldown } = require('./wilderness');
const BONUSES = ['armour', 'weaponAim', 'weaponPower', 'magic', 'prayer'];
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

function available(player) {
    if (!player.interfaceOpen || player.interfaceOpen.bank !== true) {
        throw new Error('Open your bank before using a preset');
    }
    if (['trade', 'duel', 'shop', 'sleep', 'appearance'].some(key => player.interfaceOpen[key]) ||
        player.skills.hits.current <= 0 || inCombatCooldown(player)) {
        throw new Error('You cannot use a bank preset right now');
    }
    // Bank.open locks the player; that lock is expected and is not a refusal.
}

function snapshot(rows) {
    return rows.map(({ id, amount = 1, equipped = false }) => ({ id, amount, equipped }));
}

function prepare(player, rows) {
    validateEquipmentSet(player, rows);
    const inventory = new Inventory(player, rows);
    const animations = Array(12).fill(0);
    animations[0] = player.appearance.headSprite;
    animations[1] = player.appearance.bodySprite;
    animations[2] = 3;
    const bonuses = Object.fromEntries(BONUSES.map(name => [name, 1]));
    inventory.items.forEach((item, index) => {
        if (!item.equipped) return;
        for (const type of item.definition.equip) inventory.equipmentSlots[type] = index;
        animations[getEquipmentAnimationIndex(item.definition.equip)] = item.definition.wieldable.animation;
        for (const bonus of BONUSES) bonuses[bonus] += item.definition.wieldable[bonus];
    });
    if (Object.values(bonuses).some(value => !Number.isFinite(value))) {
        throw new Error('Invalid equipment bonuses');
    }
    return { inventory, animations, bonuses };
}

async function command(player, args) {
    let action;
    let slot;
    let prepared;
    let newBank;
    let newCache;
    try {
        if (!Array.isArray(args) || args.length !== 2 ||
            !['save', 'load'].includes(args[0]) ||
            !['string', 'number'].includes(typeof args[1]) || !/^[1-3]$/.test(String(args[1]))) {
            throw new Error('Usage: ::bankpreset save|load 1|2|3');
        }
        [action] = args;
        slot = String(args[1]);
        available(player);
        const existing = player.cache.bankPresets;
        if (existing !== undefined && (!existing || existing.version !== 1 ||
            !existing.slots || typeof existing.slots !== 'object' || Array.isArray(existing.slots))) {
            throw new Error('Unsupported or invalid bank presets');
        }
        let requested;
        if (action === 'save') {
            requested = snapshot(player.inventory.items);
        } else {
            if (!existing || !own(existing.slots, slot)) throw new Error(`Bank preset ${slot} is empty`);
            requested = existing.slots[slot];
            for (const hook of ['onWearItem', 'onRemoveItem']) {
                if ((player.world.plugins.get(hook) || []).length) {
                    throw new Error('Bank presets cannot load while equipment hooks are active');
                }
            }
        }
        const plan = planPreset({ inventory: player.inventory.items, bank: player.bank.items,
            preset: requested, items, bankCapacity: player.bank.maxItems });
        if (plan.inventory.some(row => !player.world.members && items[row.id].members)) {
            throw new Error('This preset contains members-only items');
        }
        validateEquipmentSet(player, plan.inventory);
        if (action === 'save') {
            // Copy every retained preset too, so the new cache owns all rows.
            const slots = {};
            for (const key of ['1', '2', '3']) {
                if (existing && own(existing.slots, key)) slots[key] = snapshot(existing.slots[key]);
            }
            slots[slot] = snapshot(plan.inventory);
            newCache = { ...player.cache, bankPresets: { version: 1, slots } };
        } else {
            prepared = prepare(player, plan.inventory);
            newBank = plan.bank.map(row => new Item(row));
        }
    } catch (error) {
        player.message(error.message);
        return { ok: false, reason: error.message };
    }

    // No await between validation and this synchronous commit. Never call the
    // normal add/remove paths: full-inventory adds may create ground drops.
    if (action === 'save') {
        player.cache = newCache;
    } else {
        player.inventory.items = prepared.inventory.items;
        player.inventory.equipmentSlots = prepared.inventory.equipmentSlots;
        player.bank.items = newBank;
        player.animations = prepared.animations;
        player.equipmentBonuses = prepared.bonuses;
    }
    let syncFailed = false;
    if (action === 'load') {
        try {
            player.inventory.sendAll();
            player.bank.sendOpen();
            player.sendEquipmentBonuses();
            player.broadcastPlayerAppearance(true);
        } catch (_) {
            syncFailed = true;
        }
    }
    // Player.save serializes writes and snapshots when its turn runs. An IO
    // failure does not undo the applied in-memory transfer.
    try {
        await player.save();
    } catch (_) {
        player.message(`Bank preset ${slot} ${action === 'load' ? 'loaded' : 'saved in memory'}, but persistence failed; changes remain applied`);
        return { ok: true, applied: true, saved: false, action, slot };
    }
    player.message(`Bank preset ${slot} ${action === 'load' ? 'loaded' : 'saved'}${syncFailed ? '; reconnect to refresh your display' : ''}`);
    return { ok: true, applied: true, saved: true, action, slot };
}

module.exports = { command };
