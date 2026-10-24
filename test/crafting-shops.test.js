// Rommik (Rimmington) and Dommik (Al Kharid) share one crafting-shop dialogue, as Open-RSC's CraftingEquipmentShops.java
// does. dommik.js imports buyEquipment from rommik.js; before it was exported, talking to Dommik threw and World#callPlugin
// swallowed the error, so the player saw nothing.

const test = require('node:test');
const assert = require('node:assert');

const rommik = require('../src/plugins/npcs/rimmington/rommik');
const dommik = require('../src/plugins/npcs/al-kharid/dommik');
const shops = require('@2003scape/rsc-data/shops');

function fakePlayer(choice) {
    const player = {
        opened: null,
        engage() {},
        disengage() {},
        async ask() {
            return choice;
        },
        openShop(name) {
            player.opened = name;
        }
    };
    return player;
}

const npc = (id) => ({ id, async say() {} });

test('Dommik opens the Al Kharid crafting shop', async () => {
    const player = fakePlayer(1);
    assert.strictEqual(await dommik.onTalkToNPC(player, npc(173)), true);
    assert.strictEqual(player.opened, 'dommiks-crafting');
    assert.ok(shops['dommiks-crafting']);
});

test('Rommik opens the Rimmington crafting shop', async () => {
    const player = fakePlayer(1);
    assert.strictEqual(await rommik.onTalkToNPC(player, npc(156)), true);
    assert.strictEqual(player.opened, 'rommiks-crafty-supplies');
    assert.ok(shops['rommiks-crafty-supplies']);
});

test('saying no claims the talk without opening a shop; other npcs are left alone', async () => {
    const no = fakePlayer(0);
    assert.strictEqual(await dommik.onTalkToNPC(no, npc(173)), true);
    assert.strictEqual(no.opened, null);
    assert.strictEqual(await dommik.onTalkToNPC(fakePlayer(1), npc(156)), false);
    assert.strictEqual(await rommik.onTalkToNPC(fakePlayer(1), npc(173)), false);
});

test('buyEquipment is exported but is not a hook, so it is not registered as one', () => {
    assert.strictEqual(typeof rommik.buyEquipment, 'function');
    assert.ok(!/^on[A-Z]/.test(rommik.buyEquipment.name));
});
