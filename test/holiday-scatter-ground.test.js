// holiday-drops pickScatterTile: a scattered holiday drop lands on open ground a player can reach (not water, walls or
// inside scenery), so masks and scythes are not lost where nobody can pick them up.

const test = require('node:test');
const assert = require('node:assert/strict');

const { pickScatterTile, isOpenGround } = require('../src/holiday-drops');

// obstacle grid as the real path finder: 2x2 cells per tile; `blocked` tiles fill all four, `walls` refuse steps across
function world({ blocked = [], noExit = [] } = {}) {
    const full = new Set(blocked.map(([x, y]) => `${x},${y}`));
    const shut = new Set(noExit.map(([x, y]) => `${x},${y}`));
    return {
        members: true,
        pathFinder: {
            obstacles: { get: (ox, oy) => full.has(`${Math.floor(ox / 2)},${Math.floor(oy / 2)}`) },
            gameCoordsToObstacleCoords: ({ x, y }) => ({ x: x * 2, y: y * 2 }),
            isValidGameStep: ({ x, y }, { deltaX, deltaY }) =>
                !shut.has(`${x},${y}`) && !full.has(`${x + deltaX},${y + deltaY}`)
        }
    };
}

test('open ground: not inside scenery, and at least two ways off the tile', () => {
    assert.equal(isOpenGround(world(), 10, 10), true);
    assert.equal(isOpenGround(world({ blocked: [[10, 10]] }), 10, 10), false, 'scenery or water fills it');
    assert.equal(isOpenGround(world({ noExit: [[10, 10]] }), 10, 10), false, 'walled in');
    assert.equal(isOpenGround(world({ blocked: [[11, 10], [9, 10], [10, 11]] }), 10, 10), false, 'a dead-end pocket');
    assert.equal(isOpenGround(world({ blocked: [[11, 10], [9, 10]] }), 10, 10), true, 'a corridor');
    assert.equal(isOpenGround({}, 10, 10), true, 'no path finder: every tile');
});

test('a scatter skips blocked tiles and lands on open ground', () => {
    // every tile of the box blocked but (5,5)
    const blocked = [];
    for (let x = 0; x <= 9; x += 1) for (let y = 0; y <= 9; y += 1) if (x !== 5 || y !== 5) blocked.push([x, y]);
    const w = world({ blocked: blocked.filter(([x, y]) => !((x === 5 && y === 6) || (x === 6 && y === 5))) });
    const seq = [0.1, 0.1, 0.5, 0.5]; // first try (1,1) blocked, then (5,5) open
    let i = 0;
    const rnd = () => seq[i++ % seq.length];
    assert.deepEqual(pickScatterTile(w, { minX: 0, maxX: 9, minY: 0, maxY: 9 }, rnd), { x: 5, y: 5 });
});

test('a region with no open ground drops nothing', () => {
    const blocked = [];
    for (let x = 0; x <= 3; x += 1) for (let y = 0; y <= 3; y += 1) blocked.push([x, y]);
    assert.equal(pickScatterTile(world({ blocked }), { minX: 0, maxX: 3, minY: 0, maxY: 3 }), null);
});
