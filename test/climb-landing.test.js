// Player.climb lands a multi-tile staircase's climber where Open-RSC's Ladders.coordModifier does, for every direction.
// Direction 2 had its signs swapped: Biohazard's stairs (41 at 632,566) landed the climber at 629,1510, behind the railing,
// and the sick mourner's room was out of reach.

const test = require('node:test');
const assert = require('node:assert/strict');

// player.js pulls in the sleep captcha (native canvas), which climbing never uses.
const Module = require('module');
const load = Module._load;
Module._load = function (request, ...rest) {
    if (request === '@2003scape/rsc-captcha') return {};
    return load.call(this, request, ...rest);
};
const Player = require('../src/model/player');

const PLANE = 944;

function landing(object, up) {
    const at = {};
    const fake = {
        x: object.x,
        y: object.y + 1,
        direction: 0,
        world: { planeElevation: PLANE },
        teleport(x, y) {
            at.x = x;
            at.y = y;
        },
    };
    Player.prototype.climb.call(fake, { ...object, definition: { height: 3 } }, up);
    return [at.x, at.y];
}

test('stairs land like Open-RSC Ladders.coordModifier in all four directions', () => {
    // Open-RSC: 0 up y + height, down y - 1; 2 up x + height, down x - 1; 4 up y - 1, down y + height; 6 up x - 1, down x + height
    assert.deepEqual(landing({ x: 100, y: 500, direction: 0 }, true), [100, 500 + PLANE + 3]);
    assert.deepEqual(landing({ x: 100, y: 1444, direction: 0 }, false), [100, 1444 - PLANE - 1]);
    assert.deepEqual(landing({ x: 632, y: 566, direction: 2 }, true), [635, 566 + PLANE]);
    assert.deepEqual(landing({ x: 632, y: 1510, direction: 2 }, false), [631, 1510 - PLANE]);
    assert.deepEqual(landing({ x: 100, y: 500, direction: 4 }, true), [100, 500 + PLANE - 1]);
    assert.deepEqual(landing({ x: 100, y: 1444, direction: 4 }, false), [100, 1444 - PLANE + 3]);
    assert.deepEqual(landing({ x: 100, y: 500, direction: 6 }, true), [99, 500 + PLANE]);
    assert.deepEqual(landing({ x: 100, y: 1444, direction: 6 }, false), [103, 1444 - PLANE]);
});
