// ARSC: an npc that died or despawned on the tick it was queued to appear for a player (localEntities.added) was never
// sent as removed: it joined `known` the next tick and the player kept seeing it. The bots then attacked its index for
// hours (live 2026-10-31: ~200 "invalid npc index" errors in 4 h, index 1045 alone 36 times).

const test = require('node:test');
const assert = require('node:assert/strict');

const Module = require('node:module');

// world.js loads the captcha and the map painter (native canvas), which none of this needs
const realLoad = Module._load;
Module._load = function load(request, ...rest) {
    if (request === '@2003scape/rsc-captcha') return class {};
    if (request === 'canvas') return {};
    return realLoad.call(this, request, ...rest);
};
const World = require('../src/model/world');
Module._load = realLoad;

const EntityList = require('../src/model/entity-list');
const LocalEntities = require('../src/model/local-entities');

function entity(x, y) {
    return {
        x,
        y,
        withinRange(other, range) {
            return Math.abs(this.x - other.x) <= range / 2 && Math.abs(this.y - other.y) <= range / 2;
        }
    };
}

function setup() {
    const npcs = new EntityList(1000, 4000);
    const players = new EntityList(1000, 4000);
    const world = { npcs, players, setTimeout() {} };
    const player = entity(100, 100);
    player.world = world;
    player.getNearbyEntities = () => [];
    player.localEntities = new LocalEntities(player);
    players.add(player);

    const npc = entity(102, 100);
    npc.getNearbyEntities = (type) => (type === 'players' ? [player] : []);
    npcs.add(npc);

    return { world, player, npc, local: player.localEntities };
}

test('an npc removed while only queued to appear is dropped from the queue', () => {
    const { world, npc, local } = setup();
    local.added.npcs.add(npc);

    World.prototype.removeEntity.call(world, 'npcs', npc);

    assert.equal(local.added.npcs.has(npc), false);
    assert.equal(local.removed.npcs.has(npc), false);
});

test('an npc the player knows is still sent as removed', () => {
    const { world, npc, local } = setup();
    local.known.npcs.add(npc);

    World.prototype.removeEntity.call(world, 'npcs', npc);

    assert.equal(local.removed.npcs.has(npc), true);
});

test('updateNearby drops a known npc that is no longer in the world, even in range', () => {
    const { world, npc, local } = setup();
    local.known.npcs.add(npc);
    world.npcs.remove(npc); // gone without anyone telling this player

    local.updateNearby('npcs');

    assert.equal(local.removed.npcs.has(npc), true);
});

test('updateNearby keeps a live npc in range', () => {
    const { npc, local } = setup();
    local.known.npcs.add(npc);

    local.updateNearby('npcs');

    assert.equal(local.removed.npcs.has(npc), false);
});
