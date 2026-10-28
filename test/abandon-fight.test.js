// ARSC: a player who logs out or teleports away mid-fight left the npc locked, with the player as its opponent, still
// swinging every tick at someone who was gone (live 2026-10-28: npcs and bots "ghost fighting" in empty spots).

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const Character = require('../src/model/character');

function fighters() {
    const calls = [];
    const player = { fightStage: 1, direction: 9 };
    const npc = {
        fightStage: 0,
        direction: 9,
        locked: true,
        unlock() {
            this.locked = false;
        },
        faceDirection(x, y) {
            calls.push(['face', x, y]);
            this.direction = 0;
        }
    };
    player.opponent = npc;
    npc.opponent = player;
    player.abandonFight = Character.prototype.abandonFight;
    return { player, npc, calls };
}

test('abandonFight frees the npc and clears both sides', () => {
    const { player, npc, calls } = fighters();
    player.abandonFight();
    assert.strictEqual(player.opponent, null);
    assert.strictEqual(npc.opponent, null);
    assert.strictEqual(player.fightStage, -1);
    assert.strictEqual(npc.fightStage, -1);
    assert.strictEqual(npc.locked, false);
    assert.deepStrictEqual(calls, [['face', 0, 0]]);
});

test('abandonFight with no fight does nothing', () => {
    const player = { opponent: null, fightStage: -1, abandonFight: Character.prototype.abandonFight };
    assert.doesNotThrow(() => player.abandonFight());
    assert.strictEqual(player.opponent, null);
});

test('logout and teleport both end the fight first', () => {
    const src = fs.readFileSync(path.join(__dirname, '../src/model/player.js'), 'utf8');
    for (const name of ['async logout()', 'teleport(x, y, bubble = false)']) {
        const body = src.slice(src.indexOf(name), src.indexOf(name) + 900);
        assert.match(body, /this\.abandonFight\(\)/, `${name} must call abandonFight`);
    }
});
