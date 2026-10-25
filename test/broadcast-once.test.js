// A second sprite or movement broadcast in one tick is skipped, not thrown: shootRanged faces the target from a
// tick timeout, and the old "two broadcasts in one tick" debug throw there crashed the whole server (live, 2026-10-24).

const test = require('node:test');
const assert = require('node:assert/strict');

// player.js pulls in the sleep captcha (native canvas), which the broadcast code never uses.
const Module = require('module');
const load = Module._load;
Module._load = function (request, ...rest) {
    if (request === '@2003scape/rsc-captcha') return {};
    return load.call(this, request, ...rest);
};
const Player = require('../src/model/player');
Module._load = load;

function fakePlayer(ticks) {
    const watcher = {
        loggedIn: true,
        localEntities: { added: { players: new Set() }, removed: { players: new Set() }, spriteChanged: { players: new Set() }, known: { players: new Set() }, moved: { players: new Set() } }
    };
    const self = Object.create(Player.prototype);
    self.world = { ticks };
    self.localEntities = { known: { players: new Set([watcher]) } };
    self.getNearbyEntities = () => [watcher];
    return { self, watcher };
}

test('broadcastDirection twice in one tick does not throw and marks the sprite once', () => {
    const { self, watcher } = fakePlayer(10);
    self.broadcastDirection();
    assert.doesNotThrow(() => self.broadcastDirection());
    assert.ok(watcher.localEntities.spriteChanged.players.has(self));
    self.world.ticks = 11;
    watcher.localEntities.spriteChanged.players.clear();
    self.broadcastDirection();
    assert.ok(watcher.localEntities.spriteChanged.players.has(self), 'next tick broadcasts again');
});

test('broadcastMove after broadcastDirection in the same tick does not throw', () => {
    const { self } = fakePlayer(20);
    self.broadcastDirection();
    assert.doesNotThrow(() => self.broadcastMove());
});
