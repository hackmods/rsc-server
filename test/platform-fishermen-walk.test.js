// Character#canWalk: an attackable NPC (any rsc-data hostility) refuses a step onto its tile, except the Sea Slug platform
// fishermen (462-464): one of them stands in the one-tile corridor to Kennith, and Open-RSC (npc_blocking 2) only lets
// aggressive NPCs block.

const test = require('node:test');
const assert = require('node:assert/strict');

const Character = require('../src/model/character');

function walker(npc) {
    const c = Object.create(Character.prototype);
    Object.assign(c, {
        x: 10,
        y: 10,
        walkQueue: [{ deltaX: 1, deltaY: 0 }],
        world: {
            pathFinder: {
                obstacles: { get: () => false },
                gameCoordsToObstacleCoords: ({ x, y }) => ({ x: x * 2, y: y * 2 }),
                isValidGameStep: () => true
            },
            players: { getAtPoint: () => [] },
            npcs: { getAtPoint: (x, y) => (x === 11 && y === 10 ? [npc] : []) }
        }
    });
    return c;
}

test('an attackable NPC blocks a step onto its tile', () => {
    assert.equal(walker({ id: 1, definition: { hostility: 'retreats' } }).canWalk(1, 0), false);
    assert.equal(walker({ id: 1, definition: { hostility: 'aggressive' } }).canWalk(1, 0), false);
});

test('a talk-only NPC does not', () => {
    assert.equal(walker({ id: 1, definition: { hostility: null } }).canWalk(1, 0), true);
});

test('the Sea Slug platform fishermen never block', () => {
    for (const id of [462, 463, 464]) {
        assert.equal(walker({ id, definition: { hostility: 'retreats' } }).canWalk(1, 0), true, `npc ${id}`);
    }
});
