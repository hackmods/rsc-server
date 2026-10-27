const assert = require('node:assert/strict');
const test = require('node:test');
const NPC = require('../src/model/npc');
const npcs = require('@2003scape/rsc-data/config/npcs');

// y 400 is in the wilderness (level > 0), y 600 is not
const WILD = { x: 200, y: 400 };
const SAFE = { x: 200, y: 600 };

function fakeWorld(id, pos) {
    return new NPC({}, { id, x: pos.x, y: pos.y, minX: 0, maxX: 0, minY: 0, maxY: 0 });
}

function npcAt(id, pos, combatLevel) {
    const npc = fakeWorld(id, pos);
    Object.defineProperty(npc, 'combatLevel', { value: combatLevel });
    return npc;
}

const player = (level, pos) => ({ combatLevel: level, x: pos.x, y: pos.y });

const skeleton = npcs.findIndex((n) => n.name.toLowerCase() === 'skeleton' && n.hostility === 'aggressive');
const rat = npcs.findIndex((n) => n.name.toLowerCase() === 'rat' && n.hostility === 'retreats');

test('a retreating rat in the wilderness is not aggressive', () => {
    assert.ok(rat >= 0);
    assert.equal(npcAt(rat, WILD, 1).aggressive, false);
});

test('an aggressive skeleton is aggressive by definition', () => {
    assert.equal(npcAt(skeleton, SAFE, 20).aggressive, true);
});

test('wilderness skeleton aggroes a level 90 player', () => {
    const npc = npcAt(skeleton, WILD, 20);
    assert.equal(npc.isAggressive(player(90, WILD)), true);
});

test('skeleton outside the wilderness ignores level 90, attacks level 3', () => {
    const npc = npcAt(skeleton, SAFE, 20);
    assert.equal(npc.isAggressive(player(90, SAFE)), false);
    assert.equal(npc.isAggressive(player(3, SAFE)), true);
});

test('level cap is inclusive at twice the npc level (Java < 2n+1)', () => {
    const npc = npcAt(skeleton, SAFE, 20);
    assert.equal(npc.isAggressive(player(40, SAFE)), true);
    assert.equal(npc.isAggressive(player(41, SAFE)), false);
});

test('waiver needs both npc and player in the wilderness', () => {
    const npc = npcAt(skeleton, WILD, 20);
    assert.equal(npc.isAggressive(player(90, SAFE)), false);
});
