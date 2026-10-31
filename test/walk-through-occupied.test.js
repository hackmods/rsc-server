// Character#canWalk: a walk may pass through players and NPCs but not end on one. A player's last step is an empty
// walk queue; stepsLeft is the NPC wander counter, which chase() (every NPC talk) and the player packet handler zero
// on players too. Reading it refused every step onto anyone once a player had talked to an NPC.

const test = require('node:test');
const assert = require('node:assert/strict');

const Character = require('../src/model/character');

const OCCUPIED = '11,10';

function world() {
    const at = (x, y) => (`${x},${y}` === OCCUPIED ? [{ definition: {} }] : []);
    return {
        pathFinder: {
            obstacles: { get: () => false },
            gameCoordsToObstacleCoords: ({ x, y }) => ({ x: x * 2, y: y * 2 }),
            isValidGameStep: () => true
        },
        players: { getAtPoint: at },
        npcs: { getAtPoint: () => [] }
    };
}

function player(props) {
    const c = Object.create(Character.prototype);
    Object.assign(c, { x: 10, y: 10, world: world(), walkQueue: [] }, props);
    return c;
}

test('a player walks through someone mid-walk', () => {
    assert.equal(player({ walkQueue: [{ deltaX: 1, deltaY: 0 }] }).canWalk(1, 0), true);
});

test('after an NPC talk (stepsLeft zeroed) a player still walks through someone mid-walk', () => {
    const p = player({ walkQueue: [{ deltaX: 1, deltaY: 0 }], stepsLeft: 0 });
    assert.equal(p.canWalk(1, 0), true);
});

test("a player's walk still cannot end on someone", () => {
    assert.equal(player({}).canWalk(1, 0), false);
    assert.equal(player({ stepsLeft: 0 }).canWalk(1, 0), false);
    assert.equal(player({}).canWalk(0, 1), true);
});

test('a walk action may end on someone', () => {
    assert.equal(player({ walkAction: () => {} }).canWalk(1, 0), true);
});

test('an NPC (no walk queue) ends its wander on nobody, passes through mid-wander', () => {
    const npc = (stepsLeft) => player({ walkQueue: undefined, stepsLeft });
    assert.equal(npc(0).canWalk(1, 0), false);
    assert.equal(npc(3).canWalk(1, 0), true);
});
