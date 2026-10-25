// Character#canWalk: a player inside a fully blocked tile (Open-RSC teleports onto scenery, e.g. the barbarian
// course's spiked pit at 486,3389) may take any step until they are out.

const test = require('node:test');
const assert = require('node:assert/strict');

const Character = require('../src/model/character');

// obstacle grid: 2x2 cells per tile, tile (x, y) -> cells (2x..2x+1, 2y..2y+1); `blocked` tiles fill all four
function fakePathFinder(blocked) {
    const full = new Set(blocked.map(([x, y]) => `${x},${y}`));
    return {
        obstacles: { get: (ox, oy) => full.has(`${Math.floor(ox / 2)},${Math.floor(oy / 2)}`) },
        gameCoordsToObstacleCoords: ({ x, y }) => ({ x: x * 2, y: y * 2 }),
        // the real path finder reads the start tile's cells as walls: a full start tile blocks every step
        isValidGameStep: ({ x, y }, { deltaX, deltaY }) => !full.has(`${x},${y}`) && !full.has(`${x + deltaX},${y + deltaY}`)
    };
}

function walker(x, y, blocked) {
    const c = Object.create(Character.prototype);
    Object.assign(c, { x, y, world: { pathFinder: fakePathFinder(blocked), npcs: { getAtPoint: () => [] } } });
    return c;
}

test('a character inside a blocked tile can step out to an open tile', () => {
    assert.equal(walker(486, 3389, [[486, 3389]]).canWalk(1, 0), true);
});

test('inside a 2x2 object it can cross the rest of the object to get out', () => {
    const pit = [[486, 3389], [487, 3389], [486, 3390], [487, 3390]];
    assert.equal(walker(486, 3389, pit).canWalk(1, 0), true);
    assert.equal(walker(487, 3389, pit).canWalk(1, 0), true);
});

test('an ordinary step is unchanged', () => {
    assert.equal(walker(10, 10, []).canWalk(0, 1), true);
    assert.equal(walker(10, 10, [[10, 11]]).canWalk(0, 1), false);
});
