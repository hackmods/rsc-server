'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Inventory = require('../src/model/inventory');
const Bank = require('../src/model/bank');
const Item = require('../src/model/item');
// Only exercise Player's save methods; captcha rendering is unrelated and
// requires a native canvas binary that is absent on some development hosts.
const Module = require('node:module');
const originalLoad = Module._load;
let Player;
try {
    Module._load = function (request, ...rest) {
        return request === '@2003scape/rsc-captcha' ? class {} : originalLoad.call(this, request, ...rest);
    };
    Player = require('../src/model/player');
} finally {
    Module._load = originalLoad;
}
const items = require('@2003scape/rsc-data/config/items');
const wieldable = require('@2003scape/rsc-data/wieldable');
const { command } = require('../src/bank-presets');
const COINS = 10;
const DAGGER = 0;
const OTHER = 13;

function player(inventory = [], bank = []) {
    const messages = [];
    const packets = [];
    const saves = [];
    const p = { cache: { unrelated: true }, interfaceOpen: { bank: true },
        locked: true, animations: Array(12).fill(999), equipmentBonuses: {},
        appearance: { headSprite: 1, bodySprite: 2 },
        skills: { hits: { current: 99, base: 99 }, attack: { base: 99 },
            defense: { base: 99 }, strength: { base: 99 }, ranged: { base: 99 },
            magic: { base: 99 }, prayer: { base: 99 } },
        world: { members: true, ticks: 1000,
            plugins: new Map([['onWearItem', []], ['onRemoveItem', []]]),
            addPlayerDrop() { throw new Error('Preset created a ground drop'); },
            server: { dataClient: { async sendAndReceive(message) {
                saves.push(JSON.parse(JSON.stringify(message)));
            } } } },
        message(...texts) { messages.push(texts.join(' ')); },
        send(packet) { packets.push(packet); },
        sendEquipmentBonuses() { packets.push({ type: 'equipmentBonuses' }); },
        broadcastPlayerAppearance(self) { packets.push({ type: 'appearance', self }); },
        isMale() { return true; },
        save: Player.prototype.save, serialWrite: Player.prototype.serialWrite,
        getSaveMessage: Player.prototype.getSaveMessage,
        messages, packets, saves };
    p.inventory = new Inventory(p, inventory);
    p.bank = new Bank(p, bank);
    return p;
}
function state(p) {
    return JSON.stringify({ cache: p.cache, inventory: p.inventory,
        bank: p.bank, slots: p.inventory.equipmentSlots, animations: p.animations,
        bonuses: p.equipmentBonuses });
}
function totals(p) {
    const result = {};
    for (const item of [...p.inventory.items, ...p.bank.items]) {
        result[item.id] = (result[item.id] || 0) + item.amount;
    }
    return result;
}
function preset(p, rows) {
    p.cache.bankPresets = { version: 1, slots: { '1': rows } };
}

test('save captures isolated rows and persists the full cache through real Player.save', async () => {
    const p = player([{ id: DAGGER, equipped: true }, { id: COINS, amount: 500 }]);
    const result = await command(p, ['save', '1']);
    assert.equal(result.saved, true);
    assert.equal(p.locked, true);
    assert.deepEqual(p.cache.bankPresets, { version: 1, slots: { '1': [
        { id: DAGGER, amount: 1, equipped: true }, { id: COINS, amount: 500, equipped: false }
    ] } });
    assert.equal(p.saves.length, 1);
    assert.deepEqual(p.saves[0].cache, p.cache);
    p.inventory.items[1].amount = 123;
    assert.equal(p.cache.bankPresets.slots['1'][1].amount, 500);
    const oldCache = p.cache;
    const oldSlot = oldCache.bankPresets.slots['1'];
    await command(p, ['save', '2']);
    assert.notEqual(p.cache, oldCache);
    assert.notEqual(p.cache.bankPresets.slots['1'], oldSlot);
    assert.notEqual(p.cache.bankPresets.slots['1'][0], oldSlot[0]);
    assert.equal(p.cache.unrelated, true);
});

test('load atomically conserves stock, clears stale equipment and synchronizes derived state', async () => {
    const p = player([{ id: OTHER }], [{ id: DAGGER }, { id: COINS, amount: 100 }]);
    p.inventory.equipmentSlots.cape = 77;
    preset(p, [{ id: DAGGER, equipped: true }, { id: COINS, amount: 70 }]);
    const owned = totals(p);
    const result = await command(p, ['load', '1']);
    assert.equal(result.saved, true);
    assert.deepEqual(totals(p), owned);
    assert.equal(p.inventory.equipmentSlots.cape, -1);
    for (const type of items[DAGGER].equip) assert.equal(p.inventory.equipmentSlots[type], 0);
    assert.ok(!p.animations.includes(999));
    assert.equal(p.equipmentBonuses.weaponAim, 1 + wieldable[DAGGER].weaponAim);
    assert.deepEqual(p.packets.map(packet => packet.type),
        ['inventoryItems', 'bankOpen', 'equipmentBonuses', 'appearance']);
    assert.equal(p.saves[0].inventory[0].equipped, true);
    assert.deepEqual(p.saves[0].bank, p.bank.toJSON().map(item => item.toJSON()));
});

test('an empty preset removes worn items and resets animations, bonuses and all indexes', async () => {
    const p = player([{ id: DAGGER, equipped: true }]);
    p.inventory.updateEquipmentSlots();
    preset(p, []);
    assert.equal((await command(p, ['load', '1'])).ok, true);
    assert.equal(p.inventory.items.length, 0);
    assert.ok(Object.values(p.inventory.equipmentSlots).every(index => index === -1));
    assert.deepEqual(p.animations.slice(0, 3), [1, 2, 3]);
    assert.ok(p.animations.slice(3).every(value => value === 0));
    assert.ok(Object.values(p.equipmentBonuses).every(value => value === 1));
});

test('closed bank, trade, dead, combat and malformed command refusals leave state unchanged', async () => {
    const setups = [p => { p.interfaceOpen.bank = false; }, p => { p.interfaceOpen.trade = true; },
        p => { p.interfaceOpen.duel = true; }, p => { p.skills.hits.current = 0; },
        p => { p.opponent = {}; }, p => { p.lastCombatTick = p.world.ticks; }];
    for (const setup of setups) {
        const p = player([{ id: OTHER }]);
        preset(p, []);
        setup(p);
        const before = state(p);
        assert.equal((await command(p, ['load', '1'])).ok, false);
        assert.equal(state(p), before);
        assert.equal(p.saves.length, 0);
    }
    for (const args of [['load', '0'], ['load', '4'], ['save', '01'], ['save', '1.0'],
        ['save', '1', 'extra'], ['delete', '1'], ['load', '__proto__'], ['load', ['1']]]) {
        const p = player();
        const before = state(p);
        assert.equal((await command(p, args)).ok, false);
        assert.equal(state(p), before);
    }
});

test('load refuses hooks, missing stock, conflicts, membership and equip requirements before mutation', async () => {
    const member = items.findIndex(def => def && def.members && !def.stackable);
    const gated = Number(Object.keys(wieldable).find(id => wieldable[id].requirements));
    const cases = [
        p => { p.world.plugins.set('onWearItem', [() => {}]); },
        p => { p.world.plugins.set('onRemoveItem', [() => {}]); },
        p => { preset(p, [{ id: OTHER }]); },
        p => { preset(p, [{ id: DAGGER, equipped: true }, { id: DAGGER, equipped: true }]); },
        p => { p.bank.items.push(new Item({ id: member })); p.world.members = false; preset(p, [{ id: member }]); },
        p => { p.bank.items.push(new Item({ id: gated }));
            for (const skill of Object.keys(wieldable[gated].requirements)) p.skills[skill] = { base: 0 };
            preset(p, [{ id: gated, equipped: true }]); },
        p => { p.cache.bankPresets.version = 2; }
    ];
    for (const setup of cases) {
        const p = player([], [{ id: DAGGER, amount: 2 }]);
        preset(p, [{ id: DAGGER, equipped: true }]);
        setup(p);
        const before = state(p);
        assert.equal((await command(p, ['load', '1'])).ok, false);
        assert.equal(state(p), before);
        assert.equal(p.packets.length, 0);
    }
});

test('bank-full swap succeeds without transient overflow or ground drops', async () => {
    const p = player([{ id: OTHER }], [{ id: DAGGER }]);
    p.bank.maxItems = 1;
    preset(p, [{ id: DAGGER }]);
    assert.equal((await command(p, ['load', '1'])).saved, true);
    assert.equal(p.bank.items[0].id, OTHER);
});

test('persistence failure reports applied state honestly and never rolls back', async () => {
    const p = player([], [{ id: COINS, amount: 100 }]);
    preset(p, [{ id: COINS, amount: 50 }]);
    p.world.server.dataClient.sendAndReceive = async () => { throw new Error('offline'); };
    const result = await command(p, ['load', '1']);
    assert.equal(result.ok, true);
    assert.equal(result.saved, false);
    assert.equal(p.inventory.items[0].amount, 50);
    assert.equal(p.bank.items[0].amount, 50);
    assert.match(p.messages.at(-1), /loaded, but persistence failed; changes remain applied/);
});

test('public command routing bypasses denied admin policy while preserving the bank guard', async () => {
    const { command: route } = require('../src/packet-handlers/command');
    const admin = require('../src/world-admin');
    const previous = process.env.ARSC_CMD_POLICY;
    process.env.ARSC_CMD_POLICY = 'rank';
    try {
        const p = player([{ id: COINS, amount: 100 }]);
        p.rank = 0;
        p.isAdministrator = () => false;
        p.username = 'ordinaryplayer';
        assert.equal(admin.canUseCommands(p), false);
        await route({ player: p }, { command: 'bankpreset', args: ['save', '1'] });
        assert.equal(p.cache.bankPresets.slots['1'][0].amount, 100);
        assert.equal(p.saves.length, 1);
        p.interfaceOpen.bank = false;
        const before = state(p);
        await route({ player: p }, { command: 'bankpreset', args: ['load', '1'] });
        assert.equal(state(p), before);
        assert.equal(p.saves.length, 1);
        assert.match(p.messages.at(-1), /Open your bank/);
    } finally {
        if (previous === undefined) delete process.env.ARSC_CMD_POLICY;
        else process.env.ARSC_CMD_POLICY = previous;
    }
});

test('concurrent commands retain isolated presets and serialize fresh snapshots behind an older save', async () => {
    const p = player([{ id: COINS, amount: 100 }]);
    let release;
    const blocked = new Promise(resolve => { release = resolve; });
    const writes = [];
    let active = 0;
    let maximumActive = 0;
    p.world.server.dataClient.sendAndReceive = async message => {
        active++;
        maximumActive = Math.max(maximumActive, active);
        writes.push(JSON.parse(JSON.stringify(message)));
        if (writes.length === 1) await blocked;
        active--;
    };
    const olderSave = p.save();
    await Promise.resolve(); // the old write has captured its snapshot
    assert.equal(writes.length, 1);
    const first = command(p, ['save', '1']);
    p.inventory.items[0].amount = 50;
    const second = command(p, ['save', '2']);
    assert.equal(p.cache.bankPresets.slots['1'][0].amount, 100);
    assert.equal(p.cache.bankPresets.slots['2'][0].amount, 50);
    assert.equal(writes.length, 1);
    release();
    const [, firstResult, secondResult] = await Promise.all([olderSave, first, second]);
    assert.equal(firstResult.saved, true);
    assert.equal(secondResult.saved, true);
    assert.equal(maximumActive, 1);
    assert.equal(writes.length, 3);
    assert.equal(writes[0].cache.bankPresets, undefined);
    for (const saved of writes.slice(1)) {
        assert.equal(saved.cache.bankPresets.slots['1'][0].amount, 100);
        assert.equal(saved.cache.bankPresets.slots['2'][0].amount, 50);
        assert.equal(saved.inventory[0].amount, 50);
    }
});
